const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kopano-dev-secret-change-in-production';

// Register
router.post('/register', async (req, res) => {
  const { phone, pin, businessName, category, location } = req.body;
  const db = req.app.locals.db;
  
  try {
    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    
    const pinHash = await bcrypt.hash(pin, 12);
    const result = await db.query(
      `INSERT INTO users (phone, pin_hash, business_name, category, location)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, phone, business_name, category`,
      [phone, pinHash, businessName, category, location]
    );
    
    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { phone, pin } = req.body;
  const db = req.app.locals.db;
  
  try {
    const result = await db.query(
      'SELECT id, phone, business_name, category, pin_hash, subscription_tier, kyc_status, total_savings FROM users WHERE phone = $1',
      [phone]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone or PIN' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid phone or PIN' });
    }
    
    delete user.pin_hash;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get me
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = req.app.locals.db;
    const result = await db.query(
      'SELECT id, phone, business_name, category, location, subscription_tier, kyc_status, total_savings FROM users WHERE id = $1',
      [decoded.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;