'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const paymentService = require('../services/payments');
const reservations = require('../services/reservations');
const { money, mulQty, subMoney } = require('../lib/money');
const omWebhook = require('../lib/omWebhook');

async function finalizeSuccessfulPayment(client, { orderId, transactionId, externalReference, userId, providerPayload }) {
  const txCheck = await client.query(`SELECT status FROM transactions WHERE id = $1 FOR UPDATE`, [transactionId]);
  if (txCheck.rows[0]?.status === 'completed') return { duplicate: true };

  const confirmed = await reservations.confirmReservation(client, orderId);
  if (!confirmed.confirmed) {
    return { duplicate: false, paid: false, reason: confirmed.reason || 'NO_CAPACITY' };
  }

  await client.query(
    `UPDATE transactions
     SET status = 'completed',
         provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2 AND status != 'completed'`,
    [JSON.stringify(providerPayload || {}), transactionId]
  );

  const orderRes = await client.query(
    `UPDATE orders SET status = 'paid', payment_reference = $1, updated_at = NOW()
     WHERE id = $2 AND status != 'paid' RETURNING *`,
    [externalReference, orderId]
  );

  if (orderRes.rows.length && !confirmed.duplicate) {
    const o = orderRes.rows[0];
    const group = await client.query(`SELECT retail_price, unit_price FROM buying_groups WHERE id = $1`, [o.group_id]);
    if (group.rows.length) {
      const savings = mulQty(subMoney(group.rows[0].retail_price, group.rows[0].unit_price), o.quantity);
      await client.query(
        `UPDATE users SET total_savings = total_savings + $1, updated_at = NOW() WHERE id = $2`,
        [savings, userId]
      );
    }
  }
  return { duplicate: !!confirmed.duplicate, paid: true };
}

router.post('/orange-money', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const { orderId } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;

  if (!orderId) return res.status(400).json({ error: 'orderId required', code: 'VALIDATION' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const peek = await client.query(`SELECT group_id FROM orders WHERE id = $1 AND user_id = $2`, [orderId, userId]);
    if (!peek.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    }
    await reservations.expireStaleReservations(client, peek.rows[0].group_id);

    const orderRes = await client.query(`SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`, [orderId, userId]);
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    }
    const order = orderRes.rows[0];
    if (order.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Order already paid', code: 'ALREADY_PAID' });
    }
    if (!['pending_payment', 'payment_initiated'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order not payable in current state', code: 'INVALID_STATE' });
    }

    const held = await reservations.ensureReservation(client, order);
    if (!held.ok) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Insufficient capacity to re-reserve', code: 'OVER_CAPACITY' });
    }

    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM transactions WHERE user_id = $1 AND idempotency_key = $2 ORDER BY created_at DESC LIMIT 1`,
        [userId, idempotencyKey]
      );
      if (existing.rows.length) {
        await client.query('COMMIT');
        const t = existing.rows[0];
        return res.json({
          success: true,
          status: t.status,
          transactionId: t.id,
          orderId,
          message: 'Existing payment attempt returned (idempotent)',
        });
      }
    }

    const paidTx = await client.query(
      `SELECT id FROM transactions WHERE order_id = $1 AND type = 'payment' AND status = 'completed'`,
      [orderId]
    );
    if (paidTx.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Order already has a completed payment', code: 'ALREADY_PAID' });
    }

    const openTx = await client.query(
      `SELECT * FROM transactions
       WHERE order_id = $1 AND type = 'payment' AND status IN ('initiated','awaiting_confirmation')
       ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );
    if (openTx.rows.length && !idempotencyKey) {
      await client.query('COMMIT');
      const t = openTx.rows[0];
      return res.json({
        success: true,
        status: t.status,
        transactionId: t.id,
        orderId,
        message: 'Existing payment attempt returned (no duplicate reservation)',
      });
    }

    const externalRef = 'OM-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const notifToken = crypto.randomBytes(24).toString('hex');
    const amount = money(order.total_amount);

    const txRes = await client.query(
      `INSERT INTO transactions (
         order_id, user_id, amount, type, method, external_reference, status, idempotency_key, provider, notif_token
       ) VALUES ($1,$2,$3,'payment','orange_money',$4,'initiated',$5,'orange_money',$6) RETURNING *`,
      [orderId, userId, amount, externalRef, idempotencyKey, notifToken]
    );
    const tx = txRes.rows[0];
    await client.query(
      `UPDATE orders SET status = 'payment_initiated', payment_reference = $1, updated_at = NOW() WHERE id = $2`,
      [externalRef, orderId]
    );
    await client.query('COMMIT');

    let providerResult;
    try {
      const u = await db.query(`SELECT phone FROM users WHERE id = $1`, [userId]);
      providerResult = await paymentService.initiateOrangeMoneyPayment({
        amount,
        phone: u.rows[0]?.phone,
        orderId: order.id,
        externalRef,
        callbackUrl: process.env.PAYMENT_RETURN_URL || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/success`,
        notifUrl: `${process.env.API_PUBLIC_URL || 'http://localhost:3000'}/api/payments/webhook/orange-money`,
      });
    } catch (provErr) {
      await db.query(`UPDATE transactions SET status = 'failed', provider_payload = $1 WHERE id = $2`, [
        JSON.stringify({ error: provErr.message }),
        tx.id,
      ]);
      return res.status(502).json({ error: 'Payment provider unavailable', code: 'PROVIDER_ERROR', transactionId: tx.id });
    }

    const storedNotif =
      paymentService.isConfigured() && providerResult?.notif_token ? providerResult.notif_token : notifToken;
    const payToken = providerResult?.payment_token || null;
    await db.query(
      `UPDATE transactions
       SET status = 'awaiting_confirmation',
           notif_token = $1,
           pay_token = $2,
           provider_payload = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [storedNotif, payToken, JSON.stringify(providerResult || {}), tx.id]
    );

    const sandboxAutoPay = process.env.PAYMENT_SANDBOX_AUTO_COMPLETE === 'true' && process.env.NODE_ENV !== 'production';
    if (sandboxAutoPay) {
      const c2 = await db.getClient();
      try {
        await c2.query('BEGIN');
        await finalizeSuccessfulPayment(c2, {
          orderId,
          transactionId: tx.id,
          externalReference: externalRef,
          userId,
          providerPayload: { sandbox: true },
        });
        await c2.query('COMMIT');
      } catch (e) {
        try { await c2.query('ROLLBACK'); } catch (_) {}
        throw e;
      } finally {
        c2.release();
      }
      return res.json({
        success: true,
        status: 'paid',
        transactionId: tx.id,
        orderId,
        message: 'Sandbox auto-completed (not available in production)',
        sandbox: true,
      });
    }

    res.json({
      success: true,
      status: 'awaiting_confirmation',
      transactionId: tx.id,
      orderId,
      paymentUrl: providerResult?.payment_url || null,
      amount,
      message: 'Payment initiated — complete on provider and await confirmation',
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (err.code === '23505') return res.status(409).json({ error: 'Duplicate payment attempt', code: 'DUPLICATE' });
    console.error('payment initiate error', err.message);
    res.status(500).json({ error: 'Payment initiation failed', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

router.post('/webhook/orange-money', async (req, res) => {
  const db = req.app.locals.db;
  const webhookSecret = process.env.OM_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  const requireHmac = process.env.OM_REQUIRE_HMAC === 'true';
  const rawBody = req.rawBody;
  const sigHeader = req.headers['x-om-signature'] || req.headers['x-callback-signature'] || '';

  let body;
  try {
    body = rawBody ? omWebhook.parseRawJson(rawBody) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
  }

  // Optional HMAC is over RAW bytes only (never JSON.stringify of parsed body).
  // Orange Money WebPay itself does not send HMAC; tests / reverse-proxies may.
  if (requireHmac || sigHeader) {
    if (!rawBody || !webhookSecret) {
      return res.status(401).json({ error: 'Invalid signature', code: 'WEBHOOK_SIG' });
    }
    const verified = omWebhook.verifyRawHmac(rawBody, sigHeader, webhookSecret);
    if (!verified.ok) return res.status(401).json({ error: 'Invalid signature', code: 'WEBHOOK_SIG' });
  } else if (isProd && !webhookSecret && process.env.OM_ALLOW_UNSIGNED !== 'true') {
    // Production unsigned path still authenticates via notif_token below.
  }

  const notifToken = omWebhook.extractNotifToken(body);
  if (!notifToken) {
    return res.status(401).json({ error: 'Missing notif_token', code: 'WEBHOOK_AUTH' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const txRes = await client.query(
      `SELECT * FROM transactions WHERE notif_token = $1 FOR UPDATE`,
      [notifToken]
    );
    if (!txRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Unknown notification token', code: 'WEBHOOK_AUTH' });
    }
    const tx = txRes.rows[0];

    if (notifToken && tx.notif_token && notifToken !== tx.notif_token) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'notif_token mismatch', code: 'WEBHOOK_AUTH' });
    }

    if (body.amount != null && money(body.amount) !== money(tx.amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Amount mismatch', code: 'AMOUNT_MISMATCH' });
    }

    if (tx.status === 'completed') {
      await client.query('COMMIT');
      return res.status(200).json({ received: true, status: 'already_completed' });
    }

    const kind = omWebhook.classifyStatus(body);

    if (kind === 'success') {
      const confirmation = await paymentService.confirmOrangeMoneyStatus({
        payToken: tx.pay_token,
        orderId: tx.external_reference,
        amount: tx.amount,
      });
      // Production never marks paid when the provider cannot confirm.
      // Tests / unconfigured sandbox may skip confirmation after notif_token auth.
      if (isProd && (confirmation.skipped || !confirmation.ok)) {
        await client.query('ROLLBACK');
        return res.status(502).json({ error: 'Provider status not confirmed', code: 'PROVIDER_UNCONFIRMED' });
      }
      if (!confirmation.skipped && !confirmation.ok) {
        await client.query('ROLLBACK');
        return res.status(502).json({ error: 'Provider status not confirmed', code: 'PROVIDER_UNCONFIRMED' });
      }
      const result = await finalizeSuccessfulPayment(client, {
        orderId: tx.order_id,
        transactionId: tx.id,
        externalReference: tx.external_reference,
        userId: tx.user_id,
        providerPayload: { ...body, txnid: body.txnid || null },
      });
      if (!result.paid && !result.duplicate) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Capacity no longer available', code: result.reason || 'NO_CAPACITY' });
      }
      await client.query('COMMIT');
      return res.status(200).json({ received: true, status: result.duplicate ? 'already_completed' : 'paid' });
    }

    if (kind === 'failed' || kind === 'expired') {
      await client.query(
        `UPDATE transactions SET status = $3, provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(body), tx.id, kind === 'expired' ? 'expired' : 'failed']
      );
      const newOrderStatus = kind === 'expired' ? 'expired' : 'pending_payment';
      await reservations.releaseReservation(client, tx.order_id, { newOrderStatus });
      await client.query('COMMIT');
      return res.status(200).json({ received: true, status: kind });
    }

    await client.query(
      `UPDATE transactions SET provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(body), tx.id]
    );
    await client.query('COMMIT');
    res.status(200).json({ received: true, status: 'ignored' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('webhook error', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  } finally {
    client.release();
  }
});

router.post('/expire-stale', authenticate, requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await reservations.expireAllStaleReservations(client);
    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: 'Expire failed', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

router.get('/status/:transactionId', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT id, order_id, user_id, amount, status, method, created_at, updated_at
       FROM transactions WHERE id = $1`,
      [req.params.transactionId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    const tx = result.rows[0];
    if (tx.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    }
    delete tx.user_id;
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load status', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
