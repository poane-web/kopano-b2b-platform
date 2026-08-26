'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { money } = require('../lib/money');
const reservations = require('../services/reservations');

const MAX_QTY_PER_ORDER = parseInt(process.env.MAX_ORDER_QTY || '100', 10);
const PLATFORM_FEE_BPS = parseInt(process.env.PLATFORM_FEE_BPS || '300', 10);

router.post('/', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.userId;
  const { groupId, paymentMethod } = req.body;
  const quantity = parseInt(req.body.quantity, 10);

  if (!groupId) return res.status(400).json({ error: 'groupId required', code: 'VALIDATION' });
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer', code: 'INVALID_QUANTITY' });
  }
  if (quantity > MAX_QTY_PER_ORDER) {
    return res.status(400).json({ error: `quantity exceeds maximum (${MAX_QTY_PER_ORDER})`, code: 'QTY_LIMIT' });
  }
  const allowedMethods = ['orange_money', 'mascom_wallet', 'card', 'dpo'];
  if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid payment method', code: 'INVALID_PAYMENT_METHOD' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await reservations.expireStaleReservations(client, groupId);

    const groupRes = await client.query(`SELECT * FROM buying_groups WHERE id = $1 FOR UPDATE`, [groupId]);
    if (!groupRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found', code: 'NOT_FOUND' });
    }
    const g = groupRes.rows[0];
    if (g.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Group is not open for orders', code: 'GROUP_CLOSED' });
    }
    if (g.deadline && new Date(g.deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Group deadline has passed', code: 'GROUP_EXPIRED' });
    }
    const remaining = g.target_quantity - g.current_quantity;
    if (quantity > remaining) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient capacity',
        code: 'OVER_CAPACITY',
        remaining: Math.max(0, remaining),
      });
    }

    const unitPrice = money(g.unit_price);
    const subtotal = money(unitPrice * quantity);
    const platformFee = money((subtotal * PLATFORM_FEE_BPS) / 10000);
    const deliveryFee = money(g.delivery_fee || 15);
    const grandTotal = money(subtotal + platformFee + deliveryFee);
    const orderNum = 'KPN-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const orderRes = await client.query(
      `INSERT INTO orders (
         order_number, user_id, group_id, quantity, unit_price,
         total_amount, delivery_fee, platform_fee, payment_method, status,
         reservation_status, reserved_until
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_payment','reserved', NOW() + ($10 || ' minutes')::interval)
       RETURNING *`,
      [orderNum, userId, groupId, quantity, unitPrice, grandTotal, deliveryFee, platformFee, paymentMethod, String(reservations.ttlMinutes())]
    );

    const reserved = await reservations.reserveCapacity(client, { groupId, quantity, orderId: orderRes.rows[0].id });
    if (!reserved.ok) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Insufficient capacity',
        code: 'OVER_CAPACITY',
        remaining: 0,
      });
    }

    await client.query('COMMIT');
    const order = orderRes.rows[0];
    const cap = reserved.group;
    res.status(201).json({
      ...order,
      breakdown: { unitPrice, quantity, subtotal, platformFee, deliveryFee, grandTotal, currency: 'BWP' },
      capacity: {
        reserved: cap.reserved_quantity,
        confirmed: cap.confirmed_quantity,
        current: cap.current_quantity,
        target: cap.target_quantity,
        available: Math.max(0, cap.target_quantity - cap.current_quantity),
        status: cap.status,
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('order create error', err.message);
    res.status(500).json({ error: 'Order creation failed', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

router.post('/:id/cancel', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const peek = await client.query(`SELECT * FROM orders WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.userId,
    ]);
    if (!peek.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    }
    const order = peek.rows[0];
    if (order.status === 'paid' || order.reservation_status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Paid orders cannot be cancelled here', code: 'ALREADY_PAID' });
    }
    if (['cancelled', 'expired'].includes(order.status) && order.reservation_status === 'released') {
      await client.query('COMMIT');
      return res.json({ id: order.id, status: order.status, reservation_status: 'released', released: false });
    }
    // lockGroupAndOrder inside releaseReservation (group then order)
    const locked = await reservations.lockGroupAndOrder(client, order.id);
    if (!locked || locked.user_id !== req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    }
    if (locked.status === 'paid' || locked.reservation_status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Paid orders cannot be cancelled here', code: 'ALREADY_PAID' });
    }
    const released = await reservations.releaseReservation(client, order.id, { newOrderStatus: 'cancelled' });
    await client.query('COMMIT');
    res.json({ id: order.id, status: 'cancelled', reservation_status: 'released', released: !!released.released });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('order cancel error', err.message);
    res.status(500).json({ error: 'Cancel failed', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

router.get('/my', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT o.*, g.product_name, g.category, g.unit, g.retail_price, g.pickup_location
       FROM orders o JOIN buying_groups g ON o.group_id = g.id
       WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders', code: 'SERVER_ERROR' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT o.*, g.product_name, g.category, g.unit, g.retail_price, g.pickup_location,
              g.reserved_quantity, g.confirmed_quantity, g.current_quantity, g.target_quantity, g.status AS group_status
       FROM orders o JOIN buying_groups g ON o.group_id = g.id WHERE o.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    const order = result.rows[0];
    if (order.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(404).json({ error: 'Order not found', code: 'NOT_FOUND' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
