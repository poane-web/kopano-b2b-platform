const express = require('express');
const router = express.Router();

// Simple admin check middleware
function adminCheck(req, res, next) {
  // In production: check req.user.role === 'admin'
  next();
}

// Dashboard stats
router.get('/stats', adminCheck, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const users = await db.query('SELECT COUNT(*) as count FROM users');
    const revenue = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'payment' AND status = 'completed'"
    );
    const groups = await db.query('SELECT COUNT(*) as count FROM buying_groups WHERE status = $1', ['open']);
    const fillRate = await db.query(`
      SELECT AVG(CASE WHEN target_quantity > 0 THEN current_quantity::float / target_quantity ELSE 0 END) as rate
      FROM buying_groups WHERE status IN ('open', 'filled')
    `);
    
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total),
      activeGroups: parseInt(groups.rows[0].count),
      avgFillRate: Math.round((parseFloat(fillRate.rows[0].rate || 0)) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List users
router.get('/users', adminCheck, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT u.id, u.business_name, u.category, u.phone, u.subscription_tier, u.kyc_status, u.total_savings,
        COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List groups with details
router.get('/groups', adminCheck, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT g.*, s.name as supplier_name,
        COUNT(DISTINCT o.user_id) as member_count
      FROM buying_groups g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      LEFT JOIN orders o ON g.id = o.group_id AND o.status IN ('paid', 'group_filling', 'ordered', 'ready_pickup')
      GROUP BY g.id, s.name
      ORDER BY g.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue breakdown
router.get('/revenue', adminCheck, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const monthly = await db.query(`
      SELECT DATE_TRUNC('month', created_at) as month,
        SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as payments,
        SUM(CASE WHEN type = 'fee' THEN amount ELSE 0 END) as fees
      FROM transactions
      WHERE status = 'completed'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 6
    `);
    res.json(monthly.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;