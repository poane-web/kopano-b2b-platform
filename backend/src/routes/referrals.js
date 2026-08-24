'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/my-code', authenticate, async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    let code = await db.query('SELECT * FROM referral_codes WHERE owner_id = $1', [userId]);
    if (code.rows.length === 0) {
      const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const newCode = `KOP${shortId}`;
      code = await db.query(
        `INSERT INTO referral_codes (owner_id, code, label) VALUES ($1, $2, $3) RETURNING *`,
        [userId, newCode, 'My Referral Code']
      );
    }
    res.json(code.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/validate/:code', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT rc.code, rc.active, u.business_name as owner_name
       FROM referral_codes rc JOIN users u ON rc.owner_id = u.id
       WHERE UPPER(rc.code) = UPPER($1) AND rc.active = true`,
      [req.params.code]
    );
    if (!result.rows.length) return res.status(404).json({ valid: false, error: 'Code not found' });
    res.json({ valid: true, code: result.rows[0].code, owner_name: result.rows[0].owner_name });
  } catch (err) {
    res.status(500).json({ error: 'Validation failed', code: 'SERVER_ERROR' });
  }
});

router.post('/apply', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required', code: 'VALIDATION' });
    const db = req.app.locals.db;
    const referredId = req.user.userId;

    const refCode = await db.query(
      'SELECT * FROM referral_codes WHERE UPPER(code) = UPPER($1) AND active = true',
      [code]
    );
    if (!refCode.rows.length) return res.status(404).json({ error: 'Invalid referral code' });

    const referrerId = refCode.rows[0].owner_id;
    if (referrerId === referredId) {
      return res.status(400).json({ error: 'Cannot refer yourself', code: 'SELF_REFERRAL' });
    }

    const existing = await db.query('SELECT id FROM referrals WHERE referred_id = $1', [referredId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already locked to another referrer', code: 'ALREADY_REFERRED' });
    }

    await db.query(
      `INSERT INTO referrals (referrer_id, referred_id, code_used, status) VALUES ($1, $2, $3, 'active')`,
      [referrerId, referredId, refCode.rows[0].code]
    );
    await db.query('UPDATE referral_codes SET total_activations = total_activations + 1 WHERE id = $1', [
      refCode.rows[0].id,
    ]);
    res.json({ success: true, message: 'Referral locked in' });
  } catch (err) {
    res.status(500).json({ error: 'Apply failed', code: 'SERVER_ERROR' });
  }
});

router.get('/my-stats', authenticate, async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const userId = req.user.userId;
    const [code, referrals, commissions, monthly] = await Promise.all([
      db.query('SELECT * FROM referral_codes WHERE owner_id = $1', [userId]),
      db.query(
        `SELECT r.id, r.status, r.created_at, r.total_orders, r.total_gmv, u.business_name
         FROM referrals r JOIN users u ON r.referred_id = u.id
         WHERE r.referrer_id = $1 AND r.status = 'active' ORDER BY r.created_at DESC`,
        [userId]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid
         FROM referral_commissions WHERE referrer_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as earnings
         FROM referral_commissions WHERE referrer_id = $1 AND status = 'paid'
         GROUP BY DATE_TRUNC('month', created_at) ORDER BY month DESC LIMIT 6`,
        [userId]
      ),
    ]);
    res.json({
      code: code.rows[0] || null,
      referrals: referrals.rows,
      earnings: commissions.rows[0],
      monthlyHistory: monthly.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/process-commissions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const pending = await db.query(
      `SELECT * FROM referral_commissions WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days'`
    );
    const byReferrer = {};
    for (const c of pending.rows) {
      if (!byReferrer[c.referrer_id]) byReferrer[c.referrer_id] = [];
      byReferrer[c.referrer_id].push(c);
    }
    const results = [];
    for (const [referrerId, commissions] of Object.entries(byReferrer)) {
      const total = commissions.reduce((s, c) => s + parseFloat(c.amount), 0);
      const ids = commissions.map((c) => c.id);
      await db.query(`UPDATE referral_commissions SET status = 'paid', paid_at = NOW() WHERE id = ANY($1::uuid[])`, [ids]);
      await db.query(`UPDATE referral_codes SET total_earnings = total_earnings + $1 WHERE owner_id = $2`, [
        total,
        referrerId,
      ]);
      results.push({ referrerId, amount: total, commissionsPaid: commissions.length });
    }
    res.json({ processed: results.length, details: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
