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

// Initiate Orange Money payment
router.post('/orange-money', authMiddleware, async (req, res) => {
  const { orderId, phone } = req.body;
  const db = req.app.locals.db;
  
  try {
    const order = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.userId]
    );
    
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const o = order.rows[0];
    
    // In production: call Orange Money API
    // POST to Orange Money merchant API with:
    // - merchant_id, merchant_key
    // - amount, currency (BWP)
    // - customer_msisdn (phone)
    // - order_id
    // - callback_url
    
    // For MVP: simulate successful payment
    await db.query('BEGIN');
    
    // Create transaction record
    await db.query(
      `INSERT INTO transactions (order_id, user_id, amount, type, method, external_reference, status)
       VALUES ($1, $2, $3, 'payment', 'orange_money', $4, 'completed')`,
      [orderId, req.user.userId, o.total_amount, 'OM-' + Date.now()]
    );
    
    // Update order status
    await db.query(
      'UPDATE orders SET status = $1, payment_reference = $2, updated_at = NOW() WHERE id = $3',
      ['paid', 'OM-' + Date.now(), orderId]
    );
    
    // Update user savings
    const group = await db.query(
      'SELECT retail_price, unit_price FROM buying_groups WHERE id = $1',
      [o.group_id]
    );
    const savings = (group.rows[0].retail_price - group.rows[0].unit_price) * o.quantity;
    
    await db.query(
      'UPDATE users SET total_savings = total_savings + $1 WHERE id = $2',
      [savings, req.user.userId]
    );
    
    await db.query('COMMIT');
    
    res.json({ success: true, message: 'Payment completed', orderId });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Webhook for Orange Money callbacks
router.post('/webhook/orange-money', async (req, res) => {
  // Verify Orange Money signature
  // Update transaction status
  // Update order status
  res.status(200).json({ received: true });
});

module.exports = router;