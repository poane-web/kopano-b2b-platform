'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
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
const { hmacHex, verifyRawHmac, parseRawJson } = require('../src/lib/omWebhook');

describe('Orange Money webhook verification', async () => {
  let db, srv, base, customer, supplier;

  before(async () => {
    db = await createTestDb();
    srv = await startServer(db);
    base = srv.base;
    customer = await seedUser(db, { phone: '+26773330001', pin: '1234', businessName: 'Hook Shop' });
    supplier = await seedSupplier(db, { name: 'Hook Sup', email: 'hook@sup.test', password: 'passA1!' });
  });

  after(async () => {
    await new Promise((r) => srv.server.close(r));
  });

  async function startPayment() {
    const g = await seedGroup(db, { supplierId: supplier.supplier.id, target: 20, current: 0, unitPrice: 30, retailPrice: 50 });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customer),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customer),
      body: { orderId: order.json.id },
    });
    await hydratePay(db, pay);
    return { g, order, pay };
  }

  it('official Orange payload (status, notif_token, txnid; no amount) is accepted', async () => {
    const { pay } = await startPayment();
    const raw = JSON.stringify({
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP150709.1341.A00073',
    });
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      rawBody: raw,
      headers: { 'X-Om-Signature': signWebhook(raw) },
    });
    assert.equal(w.status, 200);
    assert.equal(w.json.status, 'paid');
  });

  it('HMAC is over raw bytes, not JSON.stringify of a parsed object', () => {
    const raw = Buffer.from('{"status":"SUCCESS","notif_token":"abc"}');
    const secret = 'webhook-test-secret';
    const fromRaw = hmacHex(raw, secret);
    const fromParsed = hmacHex(JSON.stringify(JSON.parse(raw.toString())), secret);
    assert.equal(fromRaw, fromParsed);
    const spaced = Buffer.from('{ "status": "SUCCESS", "notif_token": "abc" }');
    assert.notEqual(hmacHex(spaced, secret), fromRaw);
    const v = verifyRawHmac(raw, fromRaw, secret);
    assert.equal(v.ok, true);
    assert.equal(verifyRawHmac(spaced, fromRaw, secret).ok, false);
    assert.deepEqual(parseRawJson(raw), { status: 'SUCCESS', notif_token: 'abc' });
  });

  it('valid provider HMAC over raw body is accepted', async () => {
    const { pay } = await startPayment();
    const raw = JSON.stringify({
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP150709.1341.A00073',
      amount: pay.json.amount,
    });
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      rawBody: raw,
      headers: { 'X-Om-Signature': signWebhook(raw) },
    });
    assert.equal(w.status, 200);
    assert.equal(w.json.status, 'paid');
  });

  it('modified body with original signature is rejected', async () => {
    const { pay, order } = await startPayment();
    const original = JSON.stringify({
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP-ORIG',
      amount: pay.json.amount,
    });
    const modified = JSON.stringify({
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP-TAMPER',
      amount: pay.json.amount,
    });
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      rawBody: modified,
      headers: { 'X-Om-Signature': signWebhook(original) },
    });
    assert.equal(w.status, 401);
    const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
    assert.notEqual(o.rows[0].status, 'paid');
  });

  it('invalid signature is rejected', async () => {
    const { pay, order } = await startPayment();
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP-BAD',
      amount: pay.json.amount,
    };
    const w = await request(base, 'POST', '/api/payments/webhook/orange-money', {
      body,
      headers: { 'X-Om-Signature': 'deadbeef' },
    });
    assert.equal(w.status, 401);
    const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
    assert.notEqual(o.rows[0].status, 'paid');
  });

  it('replay / duplicate callback is idempotent', async () => {
    const { pay } = await startPayment();
    const body = {
      status: 'SUCCESS',
      notif_token: pay.json.notifToken,
      txnid: 'MP-REPLAY',
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
  });

  it('Orange-style unsigned callback authenticates via notif_token when HMAC is not required', async () => {
    const prev = process.env.OM_REQUIRE_HMAC;
    process.env.OM_REQUIRE_HMAC = 'false';
    try {
      const { pay, order } = await startPayment();
      const body = {
        status: 'SUCCESS',
        notif_token: pay.json.notifToken,
        txnid: 'MP150709.1341.A00073',
        amount: pay.json.amount,
      };
      const w = await request(base, 'POST', '/api/payments/webhook/orange-money', { body });
      assert.equal(w.status, 200);
      assert.equal(w.json.status, 'paid');
      const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
      assert.equal(o.rows[0].status, 'paid');
    } finally {
      process.env.OM_REQUIRE_HMAC = prev;
    }
  });

  it('unknown notif_token is rejected', async () => {
    const prev = process.env.OM_REQUIRE_HMAC;
    process.env.OM_REQUIRE_HMAC = 'false';
    try {
      const body = { status: 'SUCCESS', notif_token: 'not-a-real-token', txnid: 'MP-X' };
      const w = await request(base, 'POST', '/api/payments/webhook/orange-money', { body });
      assert.equal(w.status, 401);
    } finally {
      process.env.OM_REQUIRE_HMAC = prev;
    }
  });

  it('does not leak notif_token to the client and rejects client-visible ids as webhook auth', async () => {
    const g = await seedGroup(db, {
      supplierId: supplier.supplier.id,
      target: 20,
      current: 0,
      unitPrice: 30,
      retailPrice: 50,
    });
    const order = await request(base, 'POST', '/api/orders', {
      token: tokenFor(customer),
      body: { groupId: g.id, quantity: 1, paymentMethod: 'orange_money' },
    });
    const pay = await request(base, 'POST', '/api/payments/orange-money', {
      token: tokenFor(customer),
      body: { orderId: order.json.id },
    });
    assert.equal(pay.status, 200);
    assert.equal(pay.json.notifToken, undefined);
    assert.equal(pay.json.externalReference, undefined);
    const tx = await db.query(`SELECT notif_token, external_reference FROM transactions WHERE id = $1`, [
      pay.json.transactionId,
    ]);
    assert.ok(tx.rows[0].notif_token);
    assert.notEqual(tx.rows[0].notif_token, tx.rows[0].external_reference);

    const prev = process.env.OM_REQUIRE_HMAC;
    process.env.OM_REQUIRE_HMAC = 'false';
    try {
      const forged = await request(base, 'POST', '/api/payments/webhook/orange-money', {
        body: { status: 'SUCCESS', notif_token: tx.rows[0].external_reference, txnid: 'MP-LEAK' },
      });
      assert.equal(forged.status, 401);
      const byOrder = await request(base, 'POST', '/api/payments/webhook/orange-money', {
        body: { status: 'SUCCESS', order_id: order.json.id, txnid: 'MP-LEAK2' },
      });
      assert.equal(byOrder.status, 401);
      const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
      assert.notEqual(o.rows[0].status, 'paid');
    } finally {
      process.env.OM_REQUIRE_HMAC = prev;
    }
  });

  it('production never marks paid when provider confirmation is skipped', async () => {
    const { pay, order } = await startPayment();
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const body = {
        status: 'SUCCESS',
        notif_token: pay.json.notifToken,
        txnid: 'MP-PROD-SKIP',
        amount: pay.json.amount,
      };
      const res = await request(base, 'POST', '/api/payments/webhook/orange-money', {
        body,
        headers: { 'X-Om-Signature': signWebhook(body) },
      });
      assert.equal(res.status, 502, JSON.stringify(res.json));
      assert.equal(res.json.code, 'PROVIDER_UNCONFIRMED');
      const o = await db.query(`SELECT status FROM orders WHERE id = $1`, [order.json.id]);
      assert.notEqual(o.rows[0].status, 'paid');
      const tx = await db.query(`SELECT status FROM transactions WHERE id = $1`, [pay.json.transactionId]);
      assert.notEqual(tx.rows[0].status, 'completed');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
