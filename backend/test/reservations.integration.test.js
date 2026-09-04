'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  createTestDb,
  startServer,
  request,
  seedUser,
  seedSupplier,
  seedGroup,
  tokenFor,
  signWebhook,
  hydratePay,
} = require('./helpers');

async function capacity(db, groupId) {
  const r = await db.query(
    `SELECT current_quantity, reserved_quantity, confirmed_quantity, target_quantity, status
     FROM buying_groups WHERE id = $1`,
    [groupId]
  );
  const row = r.rows[0];
  return {
    current: Number(row.current_quantity),
    reserved: Number(row.reserved_quantity),
    confirmed: Number(row.confirmed_quantity),
    target: Number(row.target_quantity),
    status: row.status,
  };
}

describe('reservation / payment lifecycle', async () => {
  let db, srv, base, customerA, customerB, admin, supplier;

  before(async () => {
    db = await createTestDb();
    srv = await startServer(db);
    base = srv.base;
    customerA = await seedUser(db, { phone: '+26772220001', pin: '1234', businessName: 'Res A' });
    customerB = await seedUser(db, { phone: '+26772220002', pin: '1234', businessName: 'Res B' });
    admin = await seedUser(db, { phone: '+26772220003', pin: '1234', businessName: 'Res Admin', role: 'admin' });
    supplier = await seedSupplier(db, { name: 'Res Supplier', email: 'res@sup.test', password: 'passA1!' });
  });

  after(async () => {
    await new Promise((r) => srv.server.close(r));
  });

  it('successful payment preserves reservation and confirms the order', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 100, current: 90, unitPrice: 50, retailPrice: 80 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(order.status, 201);
    let cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 10);
    assert.equal(cap.confirmed, 90);
    assert.equal(cap.current, 100);
    assert.equal(cap.status, 'filled');

    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, pay);
    assert.equal(pay.status, 200);
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-TEST-1',
      amount: pay.json.amount,
    };
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': signWebhook(body) },
    });
    assert.equal(w.status, 200);
    assert.equal(w.json.status, 'paid');
    cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.confirmed, 100);
    assert.equal(cap.current, 100);
    assert.equal(cap.status, 'filled');
    const o = await db.query(`SELECT status, reservation_status FROM orders WHERE id = $1`, [order.json.id]);
    assert.equal(o.rows[0].status, 'paid');
    assert.equal(o.rows[0].reservation_status, 'confirmed');
  });

  it('failed payment releases the reservation', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 100, current: 90, unitPrice: 40, retailPrice: 70 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(order.status, 201);
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, pay);
    const body = {
      status: 'FAILED',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-FAIL-1',
      amount: pay.json.amount,
    };
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': signWebhook(body) },
    });
    assert.equal(w.status, 200);
    assert.equal(w.json.status, 'failed');
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.confirmed, 90);
    assert.equal(cap.current, 90);
    assert.equal(cap.status, 'open');
    const o = await db.query(`SELECT status, reservation_status FROM orders WHERE id = $1`, [order.json.id]);
    assert.equal(o.rows[0].reservation_status, 'released');
    assert.notEqual(o.rows[0].status, 'paid');
  });

  it('expired payment releases the reservation', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 50, current: 40, unitPrice: 20, retailPrice: 30 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(order.status, 201);
    await db.query(`UPDATE orders SET reserved_until = NOW() - INTERVAL '1 minute' WHERE id = $1`, [order.json.id]);
    const exp = await request(base, 'POST', '/api/payments/expire-stale', { token: tokenFor(admin) });
    assert.equal(exp.status, 200);
    assert.ok(exp.json.releasedCount >= 1);
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.confirmed, 40);
    assert.equal(cap.current, 40);
    assert.equal(cap.status, 'open');
    const o = await db.query(`SELECT status, reservation_status FROM orders WHERE id = $1`, [order.json.id]);
    assert.equal(o.rows[0].status, 'expired');
    assert.equal(o.rows[0].reservation_status, 'released');
  });

  it('cancelled order releases the reservation', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 20, current: 0, unitPrice: 15, retailPrice: 25 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 5, paymentMethod: 'orange_money' },
    });
    assert.equal(order.status, 201);
    const cancel = await request(base, 'POST', `/api/orders/${order.json.id}/cancel`, { token: tokenFor(customerA) });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.json.released, true);
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.current, 0);
    assert.equal(cap.status, 'open');
  });

  it('two customers competing for the final units cannot oversell', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 100, current: 90, unitPrice: 10, retailPrice: 12 });
    const [r1, r2] = await Promise.all([
      request(base, 'POST', '/api/orders', {
        token: tokenFor(customerA),
        body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
      }),
      request(base, 'POST', '/api/orders', {
        token: tokenFor(customerB),
        body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
      }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    assert.equal(statuses[0], 201);
    assert.ok(statuses[1] === 409 || statuses[1] === 400, `got ${statuses}`);
    const cap = await capacity(db, g.id);
    assert.equal(cap.current, 100);
    assert.ok(cap.current <= cap.target);
    assert.equal(cap.reserved + cap.confirmed, cap.current);
    assert.equal(cap.confirmed, 90);
    assert.equal(cap.reserved, 10);
  });

  it('a failed reservation allows another customer to purchase those units', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 100, current: 90, unitPrice: 22, retailPrice: 40 });
    const orderA = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.equal(orderA.status, 201);
    const blocked = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerB),
      body: { groupId: g.id, quantity: 10, paymentMethod: 'orange_money' },
    });
    assert.ok(blocked.status === 409 || blocked.status === 400);

    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: orderA.json.id },
    });
    await hydratePay(db, pay);
    const failBody = {
      status: 'FAILED',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-FAIL-2',
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
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 10);
    assert.equal(cap.confirmed, 90);
    assert.equal(cap.current, 100);
  });

  it('duplicate webhook does not double-confirm or double-release quantities', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 20, current: 0, unitPrice: 80, retailPrice: 120 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 2, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, pay);
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-DUP-1',
      amount: pay.json.amount,
    };
    const sig = signWebhook(body);
    const w1 = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': sig },
    });
    const w2 = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': sig },
    });
    assert.equal(w1.json.status, 'paid');
    assert.equal(w2.json.status, 'already_completed');
    const cap = await capacity(db, g.id);
    assert.equal(cap.confirmed, 2);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.current, 2);
  });

  it('repeated payment attempts do not create duplicate reservations', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 30, current: 0, unitPrice: 10, retailPrice: 15 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 3, paymentMethod: 'orange_money' },
    });
    const p1 = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, p1);
    const p2 = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, p2);
    assert.equal(p1.status, 200);
    assert.equal(p2.status, 200);
    assert.equal(p1.json.transactionId, p2.json.transactionId);
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 3);
    assert.equal(cap.current, 3);
    const txs = await db.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE order_id = $1`, [order.json.id]);
    assert.equal(txs.rows[0].c, 1);
  });

  it('group status reflects available / reserved / confirmed capacity', async () => {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 10, current: 0, unitPrice: 5, retailPrice: 9 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 4, paymentMethod: 'orange_money' },
    });
    assert.equal(order.json.capacity.reserved, 4);
    assert.equal(order.json.capacity.confirmed, 0);
    assert.equal(order.json.capacity.available, 6);
    assert.equal(order.json.capacity.status, 'open');

    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, pay);
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-CAP-1',
      amount: pay.json.amount,
    };
    await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': signWebhook(body) },
    });
    const cap = await capacity(db, g.id);
    assert.equal(cap.reserved, 0);
    assert.equal(cap.confirmed, 4);
    assert.equal(cap.current, 4);
    assert.equal(cap.status, 'open');
    const detail = await request(base, 'GET', `/api/groups/${g.id}`);
    assert.equal(Number(detail.json.reserved_quantity), 0);
    assert.equal(Number(detail.json.confirmed_quantity), 4);
    assert.equal(Number(detail.json.remaining_quantity), 6);
  });
});
