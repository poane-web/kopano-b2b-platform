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

function startServer(db) {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-at-least-32-chars!!';
  process.env.OM_WEBHOOK_SECRET = process.env.OM_WEBHOOK_SECRET || 'webhook-test-secret';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.SILENT_LOGS = 'true';
  process.env.DISABLE_RATE_LIMIT = 'true';
  process.env.PAYMENT_ALLOW_UNCONFIGURED = 'true';
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

async function request(base, method, url, { token, body, headers } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
  const r = await db.query(
    `INSERT INTO buying_groups (
       supplier_id, product_name, category, description, unit_price, retail_price,
       target_quantity, current_quantity, unit, deadline, status
     ) VALUES ($1,'Test Rice','food','desc',$2,$3,$4,$5,'bags', NOW() + ($6 || ' days')::interval, 'open')
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

function signWebhook(body, secret = process.env.OM_WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

module.exports = {
  createTestDb,
  startServer,
  request,
  seedUser,
  seedSupplier,
  seedGroup,
  tokenFor,
  signWebhook,
};
