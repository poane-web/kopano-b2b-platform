'use strict';

const { Pool } = require('pg');

function splitSqlStatements(sql) {
  return String(sql || '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      const body = s
        .split('\n')
        .map((line) => {
          const i = line.indexOf('--');
          return (i === -1 ? line : line.slice(0, i)).trim();
        })
        .filter(Boolean)
        .join('\n')
        .trim();
      return body.length > 0;
    });
}

async function runSql(db, sql) {
  if (!sql || !String(sql).trim()) return;
  if (typeof db.exec === 'function') {
    await db.exec(sql);
    return;
  }
  for (const stmt of splitSqlStatements(sql)) {
    await db.query(stmt);
  }
}

function createPgPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    (process.env.DB_HOST
      ? `postgres://${encodeURIComponent(process.env.DB_USER || 'kopano')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'kopano'}`
      : null);

  if (!connectionString && process.env.NODE_ENV === 'production') {
    console.error('FATAL: DATABASE_URL (or DB_*) is required in production');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString || 'postgres://kopano:kopano123@localhost:5432/kopano',
    ssl:
      process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '5000', 10),
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', { message: err.message });
  });

  return {
    pool,
    query: (text, params) => pool.query(text, params),
    exec: (text) => pool.query(text),
    getClient: () => pool.connect(),
    healthCheck: async () => {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },
  };
}

/**
 * Wrap a PGlite instance with a pg-like interface.
 * Serializes getClient() so tests can exercise reservation logic safely.
 * PGlite query() cannot run multi-statement SQL; use exec() for migrations.
 */
function wrapPglite(pglite) {
  let chain = Promise.resolve();

  async function getClient() {
    let releaseNext;
    const myTurn = chain;
    chain = new Promise((resolve) => {
      releaseNext = resolve;
    });
    await myTurn;
    return {
      query: (text, params) => pglite.query(text, params),
      release() {
        releaseNext();
      },
    };
  }

  return {
    pool: {
      end: async () => {
        if (typeof pglite.close === 'function') await pglite.close();
      },
    },
    query: (text, params) => pglite.query(text, params),
    exec: (text) => pglite.exec(text),
    getClient,
    healthCheck: async () => {
      const result = await pglite.query('SELECT 1 AS ok');
      return Number(result.rows[0]?.ok) === 1;
    },
  };
}

let singleton = null;

function getDb() {
  if (singleton) return singleton;
  singleton = createPgPool();
  return singleton;
}

module.exports = { getDb, createPgPool, wrapPglite, splitSqlStatements, runSql };
