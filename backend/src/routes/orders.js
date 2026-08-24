const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kopano-dev-secret-change-in-production';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Create order
router.post('/', authMiddleware, async (req, res) => {
  const { groupId, quantity, paymentMethod } = req.body;
  const db = req.app.locals.db;
  
  try {
    await db.query('BEGIN');
    
    // Lock group row
    const group = await db.query(
      'SELECT * FROM buying_groups WHERE id = $1 FOR UPDATE',
      [groupId]
    );
    
    if (group.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const g = group.rows[0];
    if (g.status === 'cancelled') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Group has been cancelled' });
    }
    
    const unitPrice = parseFloat(g.unit_price);
    const totalAmount = unitPrice * quantity;
    const platformFee = totalAmount * 0.03; // 3% transaction fee
    const deliveryFee = parseFloat(g.delivery_fee || 15);
    const grandTotal = totalAmount + platformFee + deliveryFee;
    
    const orderNum = 'KPN-' + Date.now().toString().slice(-5);
    
    const order = await db.query(
      `INSERT INTO orders (order_number, user_id, group_id, quantity, unit_price, total_amount, delivery_fee, platform_fee, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_payment')
       RETURNING *`,
      [orderNum, req.user.userId, groupId, quantity, unitPrice, grandTotal, deliveryFee, platformFee, paymentMethod]
    );
    
    await db.query('COMMIT');
    res.status(201).json(order.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Get my orders
router.get('/my', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT o.*, g.product_name, g.category, g.unit
      FROM orders o
      JOIN buying_groups g ON o.group_id = g.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `, [req.user.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;