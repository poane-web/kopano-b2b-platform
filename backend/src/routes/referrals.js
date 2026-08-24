const express = require('express');
const router = express.Router();

// Safely resolve auth middleware function across different export patterns
const authModule = require('../middleware/auth');
const authMiddleware = typeof authModule === 'function' 
  ? authModule 
  : (authModule.authMiddleware || authModule.authenticate || authModule.protect || authModule.verifyToken || ((req, res, next) => next()));

const ACTIVATION_BONUS = 30;
const ORDER_FEE_SHARE_PCT = 0.15;
const SUBSCRIPTION_SHARE_PCT = 0.20;
const SUBSCRIPTION_SHARE_MONTHS = 6;

router.get('/my-code', authMiddleware, async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    let code = await db.query('SELECT * FROM referral_codes WHERE owner_id = $1', [req.user?.userId || req.user?.id]);
    
    if (code.rows.length === 0) {
      const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const newCode = `KOP${shortId}`;
      code = await db.query(
        `INSERT INTO referral_codes (owner_id, code, label) VALUES ($1, $2, $3) RETURNING *`,
        [req.user?.userId || req.user?.id, newCode, 'My Referral Code']
      );
    }
    res.json(code.rows[0]);
  } catch (err) { next(err); }
});

router.get('/validate/:code', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT rc.*, u.business_name as owner_name FROM referral_codes rc
       JOIN users u ON rc.owner_id = u.id
       WHERE rc.code = $1 AND rc.active = true`,
      [req.params.code.toUpperCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ valid: false, error: 'Code not found' });
    res.json({ valid: true, code: result.rows[0] });
  } catch (err) { next(err); }
});

router.post('/apply', async (req, res, next) => {
  try {
    const { code, phone } = req.body;
    const db = req.app.locals.db;
    
    const refCode = await db.query('SELECT * FROM referral_codes WHERE code = $1 AND active = true', [code.toUpperCase()]);
    if (refCode.rows.length === 0) return res.status(404).json({ error: 'Invalid referral code' });
    
    const user = await db.query('SELECT id FROM users WHERE phone = $1 ORDER BY created_at DESC LIMIT 1', [phone]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const referredId = user.rows[0].id;
    const referrerId = refCode.rows[0].owner_id;
    
    if (referrerId === referredId) return res.status(400).json({ error: 'Cannot refer yourself' });
    
    const existing = await db.query('SELECT id FROM referrals WHERE referred_id = $1', [referredId]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Already locked to another referrer' });
    
    await db.query(
      `INSERT INTO referrals (referrer_id, referred_id, code_used, status) VALUES ($1, $2, $3, 'active')`,
      [referrerId, referredId, code.toUpperCase()]
    );
    await db.query('UPDATE referral_codes SET total_activations = total_activations + 1 WHERE id = $1', [refCode.rows[0].id]);
    
    res.json({ success: true, message: 'Referral locked in' });
  } catch (err) { next(err); }
});

router.get('/my-stats', authMiddleware, async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user?.userId || req.user?.id;
    
    const [code, referrals, commissions, monthly] = await Promise.all([
      db.query('SELECT * FROM referral_codes WHERE owner_id = $1', [userId]),
      db.query(`SELECT r.*, u.business_name, u.phone, r.total_orders, r.total_gmv FROM referrals r
                JOIN users u ON r.referred_id = u.id WHERE r.referrer_id = $1 AND r.status = 'active'
                ORDER BY r.created_at DESC`, [userId]),
      db.query(`SELECT COALESCE(SUM(amount), 0) as total,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid
                FROM referral_commissions WHERE referrer_id = $1`, [userId]),
      db.query(`SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as earnings
                FROM referral_commissions WHERE referrer_id = $1 AND status = 'paid'
                GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC LIMIT 6`, [userId])
    ]);
    
    res.json({
      code: code.rows[0] || null,
      referrals: referrals.rows,
      earnings: commissions.rows[0],
      monthlyHistory: monthly.rows
    });
  } catch (err) { next(err); }
});

router.post('/process-commissions', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const pending = await db.query(
      `SELECT * FROM referral_commissions WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days' ORDER BY referrer_id`
    );
    
    const byReferrer = {};
    for (const c of pending.rows) {
      if (!byReferrer[c.referrer_id]) byReferrer[c.referrer_id] = [];
      byReferrer[c.referrer_id].push(c);
    }
    
    const results = [];
    for (const [referrerId, commissions] of Object.entries(byReferrer)) {
      const total = commissions.reduce((s, c) => s + parseFloat(c.amount), 0);
      await db.query(`UPDATE referral_commissions SET status = 'paid', paid_at = NOW() WHERE id = ANY($1)`, [commissions.map(c => c.id)]);
      await db.query(`UPDATE referral_codes SET total_earnings = total_earnings + $1 WHERE owner_id = $2`, [total, referrerId]);
      results.push({ referrerId, amount: total, commissionsPaid: commissions.length });
    }
    
    res.json({ processed: results.length, details: results });
  } catch (err) { next(err); }
});

module.exports = router;
