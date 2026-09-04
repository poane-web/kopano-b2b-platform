'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createApp } = require('../src/app');
const { wrapPglite } = require('../src/models/db');
const { signToken } = require('../src/middleware/auth');

const SCHEMA = fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf8');

async function createTestDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite();
  await pglite.exec(SCHEMA);
  return wrapPglite(pglite);
}

async function createPgTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;
  const { Pool } = require('pg');
  const schema = 'kopano_it_' + crypto.randomBytes(4).toString('hex');
  const pool = new Pool({ connectionString: url, max: 10 });
  await pool.query(`CREATE SCHEMA ${schema}`);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(SCHEMA);
  } finally {
    client.release();
  }

  async function withSearchPath(fn) {
    const c = await pool.connect();
    try {
      await c.query(`SET search_path TO ${schema}, public`);
      return await fn(c);
    } finally {
      c.release();
    }
  }

  return {
    schema,
    pool,
    query: (text, params) => withSearchPath((c) => c.query(text, params)),
    getClient: async () => {
      const c = await pool.connect();
      await c.query(`SET search_path TO ${schema}, public`);
      const origRelease = c.release.bind(c);
      c.release = () => origRelease();
      return c;
    },
    healthCheck: async () => {
      const r = await withSearchPath((c) => c.query('SELECT 1 AS ok'));
      return r.rows[0]?.ok === 1;
    },
    cleanup: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    },
  };
}

function startServer(db) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars!!';
  process.env.OM_WEBHOOK_SECRET = process.env.OM_WEBHOOK_SECRET || 'webhook-test-secret';
  process.env.OM_REQUIRE_HMAC = process.env.OM_REQUIRE_HMAC || 'true';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.SILENT_LOGS = 'true';
  process.env.DISABLE_RATE_LIMIT = 'true';
  process.env.PAYMENT_ALLOW_UNCONFIGURED = 'true';
  process.env.PAYMENT_RESERVATION_TTL_MINUTES = process.env.PAYMENT_RESERVATION_TTL_MINUTES || '20';
  delete process.env.PAYMENT_SANDBOX_AUTO_COMPLETE;

  const app = createApp({ db, disableRateLimit: true });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        base: `http://127.0.0.1:${port}`,
        app,
      });
    });
  });
}

async function request(base, method, url, { token, body, headers, rawBody } = {}) {
  const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers };
}

async function seedUser(db, { phone, pin, role = 'customer', businessName = 'Shop', category = 'retail', supplierId = null }) {
  const hash = await bcrypt.hash(pin, 4);
  const r = await db.query(
    `INSERT INTO users (phone, pin_hash, business_name, category, role, supplier_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [phone, hash, businessName, category, role, supplierId]
  );
  return r.rows[0];
}

async function seedSupplier(db, { name, email, password }) {
  const hash = await bcrypt.hash(password, 4);
  const s = await db.query(
    `INSERT INTO suppliers (name, email, password_hash, active) VALUES ($1,$2,$3,true) RETURNING *`,
    [name, email, hash]
  );
  const u = await seedUser(db, {
    phone: '+2677' + String(Math.floor(1000000 + Math.random() * 8999999)).slice(0, 7),
    pin: '1234',
    role: 'supplier',
    businessName: name,
    supplierId: s.rows[0].id,
  });
  return { supplier: s.rows[0], user: u };
}

async function seedGroup(db, { supplierId, target = 10, current = 0, deadlineDays = 5, unitPrice = 100, retailPrice = 150 }) {
  // Seed `current` as already-confirmed (paid) quantity so
  // current_quantity = reserved_quantity + confirmed_quantity holds.
  const r = await db.query(
    `INSERT INTO buying_groups (
       supplier_id, product_name, category, description, unit_price, retail_price,
       target_quantity, current_quantity, reserved_quantity, confirmed_quantity, unit, deadline, status
     ) VALUES ($1,'Test Rice','food','desc',$2,$3,$4,$5,0,$5,'bags', NOW() + ($6 || ' days')::interval, 'open')
     RETURNING *`,
    [supplierId, unitPrice, retailPrice, target, current, String(deadlineDays)]
  );
  return r.rows[0];
}

function tokenFor(user, extra = {}) {
  return signToken({
    userId: user.id,
    role: user.role || 'customer',
    supplierId: user.supplier_id || extra.supplierId || null,
    agentId: extra.agentId || null,
  });
}

async function hydratePay(db, pay) {
  if (!pay?.json?.transactionId) return pay;
  const r = await db.query(`SELECT notif_token, external_reference FROM transactions WHERE id = $1`, [
    pay.json.transactionId,
  ]);
  if (r.rows[0]) {
    pay.json.notifToken = r.rows[0].notif_token;
    pay.json.externalReference = r.rows[0].external_reference;
  }
  return pay;
}

function signWebhook(body, secret = process.env.OM_WEBHOOK_SECRET) {
  const raw = Buffer.isBuffer(body)
    ? body
    : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

module.exports = {
  createTestDb,
  createPgTestDb,
  startServer,
  request,
  seedUser,
  seedSupplier,
  seedGroup,
  tokenFor,
  hydratePay,
  signWebhook,
};
