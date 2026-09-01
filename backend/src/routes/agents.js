'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticate, requireAgent } = require('../middleware/auth');
const { normalizePhone, validatePin } = require('../lib/phone');
const { audit } = require('../lib/audit');

router.use(authenticate, requireAgent);

async function agentRow(db, req) {
  if (req.user.agentId) {
    const r = await db.query(`SELECT * FROM agents WHERE id = $1 AND active = true`, [req.user.agentId]);
    return r.rows[0] || null;
  }
  const r = await db.query(`SELECT * FROM agents WHERE user_id = $1 AND active = true`, [req.user.userId]);
  return r.rows[0] || null;
}

router.get('/my-stats', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const agent = await agentRow(db, req);
    if (!agent) return res.status(403).json({ error: 'Not an active agent', code: 'FORBIDDEN' });
    const activations = await db.query(
      `SELECT COUNT(*)::int AS count FROM agent_activations WHERE agent_id = $1`,
      [agent.id]
    );
    res.json({
      agentId: agent.id,
      region: agent.region,
      totalActivations: activations.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats', code: 'SERVER_ERROR' });
  }
});

router.get('/shops', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const agent = await agentRow(db, req);
    if (!agent) return res.status(403).json({ error: 'Not an active agent', code: 'FORBIDDEN' });
    const shops = await db.query(
      `SELECT u.id, u.business_name, u.phone, u.category, u.location, u.created_at, aa.created_at AS activated_at
       FROM agent_activations aa
       JOIN users u ON u.id = aa.shop_user_id
       WHERE aa.agent_id = $1
       ORDER BY aa.created_at DESC
       LIMIT 200`,
      [agent.id]
    );
    res.json(shops.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load shops', code: 'SERVER_ERROR' });
  }
});

router.post('/activation', async (req, res) => {
  const db = req.app.locals.db;
  const { businessName, category, location, pin } = req.body;
  const phone = normalizePhone(req.body.phone);
  try {
    const agent = await agentRow(db, req);
    if (!agent) return res.status(403).json({ error: 'Not an active agent', code: 'FORBIDDEN' });
    if (!phone) return res.status(400).json({ error: 'Invalid phone', code: 'INVALID_PHONE' });
    if (!validatePin(pin)) return res.status(400).json({ error: 'PIN must be 4–6 digits', code: 'INVALID_PIN' });
    if (!businessName) return res.status(400).json({ error: 'businessName required', code: 'VALIDATION' });
    const allowed = ['retail', 'beauty', 'food', 'construction', 'other'];
    if (!allowed.includes(category)) return res.status(400).json({ error: 'Invalid category', code: 'INVALID_CATEGORY' });

    const existing = await db.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
    if (existing.rows.length) return res.status(409).json({ error: 'Phone already registered', code: 'PHONE_EXISTS' });

    const pinHash = await bcrypt.hash(pin, 10);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const u = await client.query(
        `INSERT INTO users (phone, pin_hash, business_name, category, location, role)
         VALUES ($1,$2,$3,$4,$5,'customer') RETURNING id, phone, business_name, role`,
        [phone, pinHash, businessName.trim(), category, location || null]
      );
      await client.query(`INSERT INTO agent_activations (agent_id, shop_user_id) VALUES ($1,$2)`, [
        agent.id,
        u.rows[0].id,
      ]);
      await client.query(`UPDATE agents SET total_activations = total_activations + 1 WHERE id = $1`, [agent.id]);
      await client.query('COMMIT');
      await audit(db, {
        actorId: req.user.userId,
        actorRole: 'agent',
        action: 'agent.activate_shop',
        resourceType: 'user',
        resourceId: u.rows[0].id,
      });
      res.status(201).json({ shop: u.rows[0] });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agent activation', err.message);
    res.status(500).json({ error: 'Activation failed', code: 'SERVER_ERROR' });
  }
});

router.post('/order-assist', async (req, res) => {
  const db = req.app.locals.db;
  const { orderId } = req.body;
  try {
    const agent = await agentRow(db, req);
    if (!agent) return res.status(403).json({ error: 'Not an active agent', code: 'FORBIDDEN' });
    if (!orderId) return res.status(400).json({ error: 'orderId required', code: 'VALIDATION' });

    const order = await db.query(
      `SELECT o.id, o.status, o.order_number, o.user_id
       FROM orders o
       JOIN agent_activations aa ON aa.shop_user_id = o.user_id
       WHERE o.id = $1 AND aa.agent_id = $2`,
      [orderId, agent.id]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    res.json({
      orderId: order.rows[0].id,
      orderNumber: order.rows[0].order_number,
      status: order.rows[0].status,
      assisted: true,
    });
  } catch (err) {
    res.status(500).json({ error: 'Assist failed', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
