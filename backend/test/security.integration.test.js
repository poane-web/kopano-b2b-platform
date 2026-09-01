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
} = require('./helpers');

describe('authorization, isolation, payments, concurrency', async () => {
  let db, srv, base;
  let customerA, customerB, admin, agentUser, agent;
  let supplierA, supplierB, groupA, groupB;

  before(async () => {
    db = await createTestDb();
    srv = await startServer(db);
    base = srv.base;

    customerA = await seedUser(db, { phone: '+26771110001', pin: '1234', businessName: 'Cust A' });
    customerB = await seedUser(db, { phone: '+26771110002', pin: '1234', businessName: 'Cust B' });
    admin = await seedUser(db, { phone: '+26771110003', pin: '1234', businessName: 'Admin', role: 'admin' });

    const sa = await seedSupplier(db, { name: 'Supplier A', email: 'a@sup.test', password: 'passA1!' });
    const sb = await seedSupplier(db, { name: 'Supplier B', email: 'b@sup.test', password: 'passB1!' });
    supplierA = sa;
    supplierB = sb;

    groupA = await seedGroup(db, { supplierId: sa.supplier.id, target: 100, current: 99, unitPrice: 500, retailPrice: 700 });
    groupB = await seedGroup(db, { supplierId: sb.supplier.id, target: 50, current: 0 });

    agentUser = await seedUser(db, { phone: '+26771110009', pin: '1234', businessName: 'Agent One', role: 'agent' });
    const ag = await db.query(`INSERT INTO agents (user_id, region, active) VALUES ($1,'Gaborone',true) RETURNING *`, [
      agentUser.id,
    ]);
    agent = ag.rows[0];
  });

  after(async () => {
    await new Promise((r) => srv.server.close(r));
  });

  it('unauthenticated admin is 401', async () => {
    const res = await request(base, 'GET', '/api/admin/stats');
    assert.equal(res.status, 401);
  });

  it('customer hitting admin is 403', async () => {
    const res = await request(base, 'GET', '/api/admin/stats', { token: tokenFor(customerA) });
    assert.equal(res.status, 403);
  });

  it('supplier hitting admin is 403', async () => {
    const res = await request(base, 'GET', '/api/admin/users', { token: tokenFor(supplierA.user) });
    assert.equal(res.status, 403);
  });

  it('agent hitting admin is 403', async () => {
    const res = await request(base, 'GET', '/api/admin/revenue', {
      token: tokenFor(agentUser, { agentId: agent.id }),
    });
    assert.equal(res.status, 403);
  });

  it('admin can access stats', async () => {
    const res = await request(base, 'GET', '/api/admin/stats', { token: tokenFor(admin) });
    assert.equal(res.status, 200);
    assert.ok('totalUsers' in res.json);
  });

  it('customer cannot read another customer order (404)', async () => {
    const created = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerB),
      body: { groupId: groupB.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    assert.equal(created.status, 201);
    const peek = await request(base, 'GET', `/api/orders/${created.json.id}`, { token: tokenFor(customerA) });
    assert.equal(peek.status, 404);
  });

  it('supplier A cannot see supplier B orders (404)', async () => {
    const ordersB = await request(base, 'GET', '/api/supplier-app/orders', { token: tokenFor(supplierB.user) });
    assert.equal(ordersB.status, 200);
    const foreignId = ordersB.json[0]?.id;
    if (foreignId) {
      const peek = await request(base, 'GET', `/api/supplier-app/orders/${foreignId}`, {
        token: tokenFor(supplierA.user),
      });
      assert.equal(peek.status, 404);
    }
    const dashA = await request(base, 'GET', '/api/supplier-app/dashboard', { token: tokenFor(supplierA.user) });
    const dashB = await request(base, 'GET', '/api/supplier-app/dashboard', { token: tokenFor(supplierB.user) });
    assert.equal(dashA.status, 200);
    assert.equal(dashB.status, 200);
    assert.notEqual(dashA.json.orders, dashB.json.orders);
  });

  it('supplier groups and deliveries are scoped to the authenticated supplier', async () => {
    const groupsA = await request(base, 'GET', '/api/supplier-app/groups', { token: tokenFor(supplierA.user) });
    const groupsB = await request(base, 'GET', '/api/supplier-app/groups', { token: tokenFor(supplierB.user) });
    assert.equal(groupsA.status, 200);
    assert.equal(groupsB.status, 200);
    assert.ok(Array.isArray(groupsA.json));
    assert.ok(groupsA.json.some((g) => g.id === groupA.id));
    assert.ok(!groupsA.json.some((g) => g.id === groupB.id));
    assert.ok(groupsB.json.some((g) => g.id === groupB.id));
    assert.ok(!groupsB.json.some((g) => g.id === groupA.id));

    const deliveriesA = await request(base, 'GET', '/api/supplier-app/deliveries', {
      token: tokenFor(supplierA.user),
    });
    assert.equal(deliveriesA.status, 200);
    assert.ok(Array.isArray(deliveriesA.json));
  });

  it('customer cannot access supplier-app', async () => {
    const res = await request(base, 'GET', '/api/supplier-app/dashboard', { token: tokenFor(customerA) });
    assert.equal(res.status, 403);
  });

  it('agent cannot modify arbitrary users or payments', async () => {
    const tok = tokenFor(agentUser, { agentId: agent.id });
    const assist = await request(base, 'POST', '/api/agents/order-assist', {
      token: tok,
      body: { orderId: crypto.randomUUID() },
    });
    assert.ok([404, 400].includes(assist.status));
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tok,
      body: { orderId: crypto.randomUUID() },
    });
    assert.ok([403, 404].includes(pay.status));
  });

  it('agent cannot access another agent stats identity via supplier routes', async () => {
    const res = await request(base, 'GET', '/api/supplier-app/analytics', {
      token: tokenFor(agentUser, { agentId: agent.id }),
    });
    assert.equal(res.status, 403);
  });

  it('agent shops lists only shops this agent activated', async () => {
    const tok = tokenFor(agentUser, { agentId: agent.id });
    const shops = await request(base, 'GET', '/api/agents/shops', { token: tok });
    assert.equal(shops.status, 200);
    assert.ok(Array.isArray(shops.json));
    const asCustomer = await request(base, 'GET', '/api/agents/shops', { token: tokenFor(customerA) });
    assert.equal(asCustomer.status, 403);
  });

  it('concurrent last-unit orders: exactly one succeeds', async () => {
    const g = await seedGroup(db, {
      supplierId: supplierA.supplier.id,
      target: 100,
      current: 99,
      unitPrice: 50,
      retailPrice: 80,
    });
    const [r1, r2] = await Promise.all([
      request(base, 'POST', '/api/orders', {
        token: tokenFor(customerA),
        body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
      }),
      request(base, 'POST', '/api/orders', {
        token: tokenFor(customerB),
        body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
      }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    const okPair =
      (statuses[0] === 201 && (statuses[1] === 409 || statuses[1] === 400));
    assert.equal(okPair, true, `expected one success and one safe reject, got ${statuses}`);
    const after = await db.query(`SELECT current_quantity, target_quantity, status FROM buying_groups WHERE id = $1`, [
      g.id,
    ]);
    assert.equal(Number(after.rows[0].current_quantity), 100);
    assert.ok(Number(after.rows[0].current_quantity) <= Number(after.rows[0].target_quantity));
  });

  it('rejects order after deadline', async () => {
    const g = await seedGroup(db, {
      supplierId: supplierA.supplier.id,
      target: 10,
      current: 0,
      deadlineDays: -1,
    });
    // force deadline in the past
    await db.query(`UPDATE buying_groups SET deadline = NOW() - INTERVAL '1 hour' WHERE id = $1`, [g.id]);
    const res = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.code, 'GROUP_EXPIRED');
  });

  it('payment initiation is idempotent', async () => {
    const g = await seedGroup(db, { supplierId: supplierA.supplier.id, target: 20, current: 0, unitPrice: 40, retailPrice: 60 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    assert.equal(order.status, 201);
    const key = 'idem-' + crypto.randomUUID();
    const p1 = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id, amount: 1 },
      headers: { 'X-Idempotency-Key': key },
    });
    const p2 = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id, amount: 1 },
      headers: { 'X-Idempotency-Key': key },
    });
    assert.equal(p1.status, 200);
    assert.equal(p2.status, 200);
    assert.equal(p1.json.transactionId, p2.json.transactionId);
    assert.equal(p1.json.status, 'awaiting_confirmation');
    const txs = await db.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE order_id = $1`, [order.json.id]);
    assert.equal(txs.rows[0].c, 1);
    assert.equal(Number(p1.json.amount), Number(order.json.total_amount));
  });

  it('does not mark paid from frontend amount tampering', async () => {
    const g = await seedGroup(db, { supplierId: supplierA.supplier.id, target: 20, current: 0, unitPrice: 200, retailPrice: 300 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id, amount: 1 },
    });
    assert.equal(pay.status, 200);
    assert.notEqual(pay.json.status, 'paid');
    const o = await db.query(`SELECT status, total_amount FROM orders WHERE id = $1`, [order.json.id]);
    assert.equal(o.rows[0].status, 'payment_initiated');
    assert.ok(Number(o.rows[0].total_amount) > 1);
  });

  it('duplicate webhook is idempotent', async () => {
    const g = await seedGroup(db, { supplierId: supplierA.supplier.id, target: 20, current: 0, unitPrice: 80, retailPrice: 120 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 2, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-DUP-SEC',
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
    assert.equal(w1.status, 200);
    assert.equal(w1.json.status, 'paid');
    assert.equal(w2.status, 200);
    assert.equal(w2.json.status, 'already_completed');
    const txs = await db.query(
      `SELECT COUNT(*)::int AS c FROM transactions WHERE order_id = $1 AND status = 'completed'`,
      [order.json.id]
    );
    assert.equal(txs.rows[0].c, 1);
    const u = await db.query(`SELECT total_savings FROM users WHERE id = $1`, [customerA.id]);
    // savings = (120-80)*2 = 80, applied once
    assert.equal(Number(u.rows[0].total_savings), 80);
  });

  it('forged webhook does not mark paid', async () => {
    const g = await seedGroup(db, { supplierId: supplierA.supplier.id, target: 20, current: 0, unitPrice: 30, retailPrice: 50 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerB),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerB),
      body: { orderId: order.json.id },
    });
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-FORGE',
      amount: pay.json.amount,
    };
    const missing = await request(base, 'POST', '/api/payments/webhook/orange-money', { body });
    assert.equal(missing.status, 401);
    const bad = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': 'deadbeef' },
    });
    assert.equal(bad.status, 401);
    const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
    assert.notEqual(o.rows[0].status, 'paid');
  });

  it('webhook amount mismatch is rejected', async () => {
    const g = await seedGroup(db, { supplierId: supplierA.supplier.id, target: 20, current: 0, unitPrice: 90, retailPrice: 110 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customerA),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customerA),
      body: { orderId: order.json.id },
    });
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken || pay.json.externalReference,
      txnid: 'MP-AMT',
      amount: 1,
    };
    const sig = signWebhook(body);
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': sig },
    });
    assert.equal(w.status, 400);
    const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
    assert.notEqual(o.rows[0].status, 'paid');
  });

  it('blocks self-referral and duplicate apply', async () => {
    const code = await request(base, 'GET', '/api/referrals/my-code', { token: tokenFor(customerA) });
    assert.equal(code.status, 200);
    const self = await request(base, 'POST', '/api/referrals/apply', {
      token: tokenFor(customerA),
      body: { code: code.json.code },
    });
    assert.equal(self.status, 400);
    const apply = await request(base, 'POST', '/api/referrals/apply', {
      token: tokenFor(customerB),
      body: { code: code.json.code },
    });
    assert.equal(apply.status, 200);
    const again = await request(base, 'POST', '/api/referrals/apply', {
      token: tokenFor(customerB),
      body: { code: code.json.code },
    });
    assert.equal(again.status, 409);
  });

  it('rejects invalid referral code', async () => {
    const res = await request(base, 'GET', '/api/referrals/validate/NOPE99');
    assert.equal(res.status, 404);
  });

  it('process-commissions is admin only', async () => {
    const res = await request(base, 'POST', '/api/referrals/process-commissions', { token: tokenFor(customerA) });
    assert.equal(res.status, 403);
  });

  it('CSV upload requires supplier and rejects malformed rows', async () => {
    const bad = await request(base, 'POST', '/api/supplier-app/bulk-upload', { token: tokenFor(customerA) });
    assert.equal(bad.status, 403);
  });

  it('CSV parser rejects naive injection / invalid prices', async () => {
    const csv = 'title,rrp,groupPrice,targetUnits\nGood Item,100,80,10\nBad,abc,xyz,-1\n"Evil,comma",10,5,2\n';
    const FormData = global.FormData;
    const blob = new Blob([csv], { type: 'text/csv' });
    const fd = new FormData();
    fd.append('file', blob, 'stock.csv');
    const res = await fetch(base + '/api/supplier-app/bulk-upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor(supplierA.user)}` },
      body: fd,
    });
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.persisted, false);
    assert.ok(json.items.length >= 1);
    assert.ok(json.errors.length >= 1);
  });
});
