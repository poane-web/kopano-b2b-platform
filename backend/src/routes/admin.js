'use strict';

const express = require('express');
const router = express.Router();
const { audit } = require('../lib/audit');

router.use((req, _res, next) => {
  audit(req.app.locals.db, {
    actorId: req.user?.userId,
    actorRole: req.user?.role,
    action: `admin.${req.method}.${req.path}`,
    ip: req.ip,
  });
  next();
});

router.get('/stats', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [users, revenue, groups, fillRate] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM users'),
      db.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE type = 'payment' AND status = 'completed'`),
      db.query(`SELECT COUNT(*)::int AS count FROM buying_groups WHERE status = 'open'`),
      db.query(`SELECT COALESCE(AVG(CASE WHEN target_quantity > 0 THEN current_quantity::float / target_quantity ELSE 0 END), 0) AS rate
                FROM buying_groups WHERE status IN ('open', 'filled')`),
    ]);
    res.json({
      totalUsers: users.rows[0].count,
      totalRevenue: revenue.rows[0].total,
      activeGroups: groups.rows[0].count,
      avgFillRate: Math.round(Number(fillRate.rows[0].rate || 0) * 100),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats', code: 'SERVER_ERROR' });
  }
});

router.get('/users', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT u.id, u.business_name, u.category, u.phone, u.role, u.subscription_tier,
             u.kyc_status, u.total_savings, u.account_status, u.created_at,
             COUNT(o.id)::int AS order_count
      FROM users u LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users', code: 'SERVER_ERROR' });
  }
});

router.get('/groups', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT g.*, s.name AS supplier_name,
        COUNT(DISTINCT o.user_id)::int AS member_count
      FROM buying_groups g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      LEFT JOIN orders o ON g.id = o.group_id
      GROUP BY g.id, s.name ORDER BY g.created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load groups', code: 'SERVER_ERROR' });
  }
});

router.get('/revenue', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const monthly = await db.query(`
      SELECT DATE_TRUNC('month', created_at) AS month,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END)::float AS payments,
        SUM(CASE WHEN type = 'fee' THEN amount ELSE 0 END)::float AS fees
      FROM transactions WHERE status = 'completed'
      GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC LIMIT 12`);
    res.json(monthly.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load revenue', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
