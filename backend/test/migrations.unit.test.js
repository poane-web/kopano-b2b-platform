'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { splitSqlStatements, runSql, wrapPglite } = require('../src/models/db');

describe('migration SQL runner', () => {
  it('splits multi-statement files into individual commands', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../src/migrations/002_reservations.sql'), 'utf8');
    const stmts = splitSqlStatements(sql);
    assert.ok(stmts.length >= 8, `expected several statements, got ${stmts.length}`);
    assert.ok(stmts.some((s) => /ALTER TABLE buying_groups/i.test(s)));
    assert.ok(stmts.some((s) => /CREATE UNIQUE INDEX/i.test(s)));
  });

  it('applies 001–003 on PGlite after schema.sql without prepared-statement errors', async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const pglite = new PGlite();
    const schema = fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf8');
    await pglite.exec(schema);
    const db = wrapPglite(pglite);
    const dir = path.join(__dirname, '../src/migrations');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    assert.deepEqual(files, ['001_production_hardening.sql', '002_reservations.sql', '003_integrity.sql']);
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await runSql(db, sql);
    }
    const cols = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'buying_groups' AND column_name IN ('reserved_quantity','confirmed_quantity')`
    );
    assert.equal(cols.rows.length, 2);
    await pglite.close();
  });
});
