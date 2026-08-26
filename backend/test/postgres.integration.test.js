'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  createPgTestDb,
  startServer,
  request,
  seedUser,
  seedSupplier,
  seedGroup,
  tokenFor,
  signWebhook,
} = require('./helpers');

const HAVE_PG = Boolean(process.env.TEST_DATABASE_URL);

describe('postgresql reservation lifecycle', { skip: HAVE_PG ? false : 'TEST_DATABASE_URL not set; real PostgreSQL not available in this environment' }, async () => {
  let db, srv, base, customerA, customerB, supplier;

  before(async () => {
    db = await createPgTestDb();
    if (!db) throw new Error('TEST_DATABASE_URL set but createPgTestDb returned null');
    srv = await startServer(db);
    base = srv.base;
    customerA = await seedUser(db, { phone: '+26774440001', pin: '1234', businessName: 'PG A' });
    customerB = await seedUser(db, { phone: '+26774440002', pin: '1234', businessName: 'PG B' });
    supplier = await seedSupplier(db, { name: 'PG Sup', email: 'pg@sup.test', password: 'passA1!' });
  });

  after(async () => {
    if (srv) await new Promise((r) => srv.server.close(r));
    if (db && db.cleanup) await db.cleanup();
  });

  it('FOR UPDATE prevents oversell on real PostgreSQL', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 100, current: 90, unitPrice: 10, retailPrice: 15 });
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(base, 'POST', '/api/orders', {
          token: tokenFor(i % 2 === 0 ? customerA : customerB),
          body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
        })
      )
    );
    const ok = attempts.filter((r) => r.status === 201);
    const rejected = attempts.filter((r) => r.status === 409 || r.status === 400);
    assert.equal(ok.length, 1);
    assert.equal(rejected.length, 7);
    const cap = await db.query(
      `SELECT current_quantity, reserved_quantity, confirmed_quantity, target_quantity FROM buying_groups WHERE id = $1`,
      [g.id]
    );
    assert.equal(Number(cap.rows[0].current_quantity), 100);
    assert.equal(Number(cap.rows[0].reserved_quantity), 10);
    assert.ok(Number(cap.rows[0].current_quantity) <= Number(cap.rows[0].target_quantity));
  });

  it('failed payment releases capacity for another buyer on PostgreSQL', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 10, current: 0, unitPrice: 8, retailPrice: 12 });
    const orderA = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(orderA.status, 201);
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: orderA.json.id },
    });
    const failBody = {
      status: 'FAILED',
      notif_token: pay.json.notifToken,
      txnid: 'MP-PG-FAIL',
      amount: pay.json.amount,
    };
    const fail = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body: failBody,
      headers: { 'X-Om-Signature': signWebhook(failBody) },
    });
    assert.equal(fail.json.status, 'failed');
    const orderB = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerB),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(orderB.status, 201);
  });
});
