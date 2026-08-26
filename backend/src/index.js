'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createApp } = require('./app');
const { getDb, wrapPglite } = require('./models/db');

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k] || (k === 'JWT_SECRET' && process.env[k].length < 32));
  if (missing.length) {
    console.error('FATAL: Missing or weak production config:', missing.join(', '));
    process.exit(1);
  }
}

async function resolveDb() {
  if (process.env.DATABASE_URL || process.env.DB_HOST) {
    return getDb();
  }
  if (isProd) {
    console.error('FATAL: DATABASE_URL required in production');
    process.exit(1);
  }
  console.warn('No DATABASE_URL — using in-memory PGlite (development only)');
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = new PGlite();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pglite.exec(schema);
  const seedPath = path.join(__dirname, '../../init.sql');
  if (fs.existsSync(seedPath)) {
    try {
      await pglite.exec(fs.readFileSync(seedPath, 'utf8'));
    } catch (e) {
      console.warn('seed skipped', e.message);
    }
  }
  return wrapPglite(pglite);
}

async function applyMigrations(db) {
  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    try {
      await db.query(sql);
      console.log('Applied migration', f);
    } catch (e) {
      console.warn('migration', f, e.message);
    }
  }
}

let db;
let server;

async function start() {
  db = await resolveDb();
  try {
    await db.healthCheck();
    console.log('Database connection OK');
  } catch (err) {
    console.warn('Database not ready yet:', err.message);
    if (isProd) process.exit(1);
  }
  try {
    await applyMigrations(db);
  } catch (err) {
    console.warn('migrations:', err.message);
    if (isProd) process.exit(1);
  }
  const app = createApp({ db });
  const PORT = parseInt(process.env.PORT || '3000', 10);
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kopano API listening on port ${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  });
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  if (server) {
    server.close(() => {
      Promise.resolve(db && db.pool && db.pool.end && db.pool.end())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  } else process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) start();

module.exports = { start };
