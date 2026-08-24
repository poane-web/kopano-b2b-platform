'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const {
  authenticate,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../middleware/auth');
const { normalizePhone, validatePin } = require('../lib/phone');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const MAX_PIN_ATTEMPTS = 5;

function tokensFor(user) {
  const payload = {
    userId: user.id,
    role: user.role || 'customer',
    supplierId: user.supplier_id || null,
    agentId: user.agent_id || null,
  };
  return {
    token: signToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

router.post('/register', async (req, res) => {
  const db = req.app.locals.db;
  const { pin, businessName, category, location, referralCode } = req.body;
  const phone = normalizePhone(req.body.phone);

  if (!phone) return res.status(400).json({ error: 'Invalid Botswana phone number', code: 'INVALID_PHONE' });
  if (!validatePin(pin)) return res.status(400).json({ error: 'PIN must be 4–6 digits', code: 'INVALID_PIN' });
  if (!businessName || typeof businessName !== 'string' || businessName.trim().length < 2) {
    return res.status(400).json({ error: 'Business name required', code: 'INVALID_BUSINESS' });
  }
  const allowedCategories = ['retail', 'beauty', 'food', 'construction', 'other'];
  if (!category || !allowedCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category', code: 'INVALID_CATEGORY' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Phone number already registered', code: 'PHONE_EXISTS' });
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const result = await client.query(
      `INSERT INTO users (phone, pin_hash, business_name, category, location, role)
       VALUES ($1, $2, $3, $4, $5, 'customer')
       RETURNING id, phone, business_name, category, location, role, subscription_tier, kyc_status, total_savings, supplier_id`,
      [phone, pinHash, businessName.trim(), category, location || null]
    );
    const user = result.rows[0];

    if (referralCode && typeof referralCode === 'string') {
      const codeRow = await client.query(
        `SELECT rc.* FROM referral_codes rc WHERE UPPER(rc.code) = UPPER($1) AND rc.active = true`,
        [referralCode.trim()]
      );
      if (codeRow.rows.length && codeRow.rows[0].owner_id !== user.id) {
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_id, code_used, status)
           VALUES ($1, $2, $3, 'active') ON CONFLICT (referred_id) DO NOTHING`,
          [codeRow.rows[0].owner_id, user.id, codeRow.rows[0].code]
        );
        await client.query(
          `UPDATE referral_codes SET total_activations = total_activations + 1 WHERE id = $1`,
          [codeRow.rows[0].id]
        );
      }
    }

    const newCode = 'KOP' + String(user.id).replace(/-/g, '').slice(0, 5).toUpperCase();
    await client.query(
      `INSERT INTO referral_codes (owner_id, code, label) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [user.id, newCode, (user.business_name || 'Shop') + ' Code']
    );

    await client.query('COMMIT');
    res.status(201).json({ ...tokensFor(user), user });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('register error', err.message);
    res.status(500).json({ error: 'Registration failed', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const db = req.app.locals.db;
  const phone = normalizePhone(req.body.phone);
  const { pin } = req.body;
  if (!phone || !validatePin(pin)) {
    return res.status(401).json({ error: 'Invalid phone or PIN', code: 'INVALID_CREDENTIALS' });
  }

  try {
    const result = await db.query(
      `SELECT u.id, u.phone, u.business_name, u.category, u.location, u.pin_hash, u.role,
              u.subscription_tier, u.kyc_status, u.total_savings, u.account_status,
              u.failed_login_attempts, u.locked_until, u.supplier_id, a.id AS agent_id
       FROM users u
       LEFT JOIN agents a ON a.user_id = u.id
       WHERE u.phone = $1`,
      [phone]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid phone or PIN', code: 'INVALID_CREDENTIALS' });
    }
    const user = result.rows[0];
    if (user.account_status && user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active', code: 'ACCOUNT_DISABLED' });
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked', code: 'ACCOUNT_LOCKED' });
    }
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await db.query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW() WHERE id = $3`,
        [attempts, lockUntil, user.id]
      );
      return res.status(401).json({ error: 'Invalid phone or PIN', code: 'INVALID_CREDENTIALS' });
    }
    await db.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id]
    );
    delete user.pin_hash;
    delete user.failed_login_attempts;
    delete user.locked_until;
    res.json({ ...tokensFor(user), user });
  } catch (err) {
    console.error('login error', err.message);
    res.status(500).json({ error: 'Login failed', code: 'SERVER_ERROR' });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required', code: 'VALIDATION' });
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT u.id, u.role, u.account_status, u.supplier_id, a.id AS agent_id
       FROM users u LEFT JOIN agents a ON a.user_id = u.id WHERE u.id = $1`,
      [decoded.userId]
    );
    if (!result.rows.length || (result.rows[0].account_status && result.rows[0].account_status !== 'active')) {
      return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
    }
    const u = result.rows[0];
    res.json({
      token: signToken({
        userId: u.id,
        role: u.role || 'customer',
        supplierId: u.supplier_id || null,
        agentId: u.agent_id || null,
      }),
    });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(
      `SELECT id, phone, business_name, category, location, role, subscription_tier, kyc_status, total_savings, created_at, supplier_id
       FROM users WHERE id = $1`,
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile', code: 'SERVER_ERROR' });
  }
});

router.post('/supplier-login', async (req, res) => {
  const db = req.app.locals.db;
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required', code: 'VALIDATION' });
  }
  try {
    const result = await db.query(
      `SELECT s.*, u.id AS user_id, u.role, u.account_status
       FROM suppliers s
       JOIN users u ON u.supplier_id = s.id AND u.role = 'supplier'
       WHERE LOWER(s.email) = LOWER($1) AND s.active = true`,
      [email.trim()]
    );
    if (!result.rows.length || !result.rows[0].password_hash) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }
    const s = result.rows[0];
    const ok = await bcrypt.compare(password, s.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    if (s.account_status && s.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active', code: 'ACCOUNT_DISABLED' });
    }
    const payload = { userId: s.user_id, role: 'supplier', supplierId: s.id };
    res.json({
      token: signToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: s.user_id, role: 'supplier', supplierId: s.id, name: s.name, email: s.email },
    });
  } catch (err) {
    console.error('supplier-login', err.message);
    res.status(500).json({ error: 'Login failed', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
