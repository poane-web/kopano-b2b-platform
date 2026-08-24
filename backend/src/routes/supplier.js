'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, requireSupplier } = require('../middleware/auth');
const { parseCsv, validateCatalogRow } = require('../lib/csv');
const { audit } = require('../lib/audit');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_BYTES || String(1 * 1024 * 1024), 10), files: 1 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain' ||
      (file.originalname && file.originalname.toLowerCase().endsWith('.csv'));
    if (!ok) return cb(new Error('Only CSV files are allowed'));
    cb(null, true);
  },
});

router.use(authenticate, requireSupplier);

function supplierId(req) {
  return req.user.supplierId;
}

router.get('/dashboard', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  try {
    const [groups, orders, revenue] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM buying_groups WHERE supplier_id = $1`, [sid]),
      db.query(
        `SELECT COUNT(*)::int AS count FROM orders o
         JOIN buying_groups g ON g.id = o.group_id WHERE g.supplier_id = $1`,
        [sid]
      ),
      db.query(
        `SELECT COALESCE(SUM(o.total_amount - o.platform_fee), 0)::float AS total
         FROM orders o JOIN buying_groups g ON g.id = o.group_id
         WHERE g.supplier_id = $1 AND o.status IN ('paid','group_filling','ordered','ready_pickup','delivered')`,
        [sid]
      ),
    ]);
    res.json({
      groups: groups.rows[0].count,
      orders: orders.rows[0].count,
      estimatedPayout: revenue.rows[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard', code: 'SERVER_ERROR' });
  }
});

router.get('/orders', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  try {
    const result = await db.query(
      `SELECT o.id, o.order_number, o.quantity, o.status, o.created_at, o.unit_price,
              g.product_name, g.id AS group_id
       FROM orders o
       JOIN buying_groups g ON g.id = o.group_id
       WHERE g.supplier_id = $1
       ORDER BY o.created_at DESC
       LIMIT 200`,
      [sid]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders', code: 'SERVER_ERROR' });
  }
});

router.get('/orders/:id', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  try {
    const result = await db.query(
      `SELECT o.id, o.order_number, o.quantity, o.status, o.created_at, o.unit_price,
              g.product_name, g.id AS group_id
       FROM orders o
       JOIN buying_groups g ON g.id = o.group_id
       WHERE o.id = $1 AND g.supplier_id = $2`,
      [req.params.id, sid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order', code: 'SERVER_ERROR' });
  }
});

router.get('/analytics', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  try {
    const result = await db.query(
      `SELECT g.id, g.product_name, g.current_quantity, g.target_quantity, g.status,
              COUNT(o.id)::int AS order_count
       FROM buying_groups g
       LEFT JOIN orders o ON o.group_id = g.id AND o.status NOT IN ('cancelled','expired')
       WHERE g.supplier_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [sid]
    );
    res.json({ period: req.query.period || '30days', groups: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics', code: 'SERVER_ERROR' });
  }
});

router.post('/groups/:groupId/confirm-filled', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  try {
    const result = await db.query(
      `UPDATE buying_groups SET status = 'ordering', updated_at = NOW()
       WHERE id = $1 AND supplier_id = $2 AND status IN ('filled','open')
       RETURNING id, status`,
      [req.params.groupId, sid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    await audit(db, {
      actorId: req.user.userId,
      actorRole: 'supplier',
      action: 'supplier.confirm_filled',
      resourceType: 'buying_group',
      resourceId: req.params.groupId,
    });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm', code: 'SERVER_ERROR' });
  }
});

router.post('/deliveries', async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  const { groupId, orderId, notes } = req.body || {};
  try {
    if (groupId) {
      const g = await db.query(`SELECT id FROM buying_groups WHERE id = $1 AND supplier_id = $2`, [groupId, sid]);
      if (!g.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    }
    if (orderId) {
      const o = await db.query(
        `SELECT o.id FROM orders o JOIN buying_groups g ON g.id = o.group_id
         WHERE o.id = $1 AND g.supplier_id = $2`,
        [orderId, sid]
      );
      if (!o.rows.length) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    }
    const result = await db.query(
      `INSERT INTO deliveries (supplier_id, group_id, order_id, status, notes)
       VALUES ($1,$2,$3,'pending',$4) RETURNING *`,
      [sid, groupId || null, orderId || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record delivery', code: 'SERVER_ERROR' });
  }
});

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  const sid = supplierId(req);
  const persist = req.query.persist === 'true' || req.body?.persist === true || req.body?.persist === 'true';

  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded', code: 'NO_FILE' });
    const { records } = parseCsv(req.file.buffer.toString('utf8'), { maxRows: 500 });
    const valid = [];
    const invalid = [];
    const seen = new Set();
    for (const row of records) {
      const v = validateCatalogRow(row);
      if (!v.ok) {
        invalid.push({ line: row.__line, errors: v.errors });
        continue;
      }
      const key = v.value.title.toLowerCase();
      if (seen.has(key)) {
        invalid.push({ line: row.__line, errors: ['duplicate title in file'] });
        continue;
      }
      seen.add(key);
      valid.push(v.value);
    }

    if (!persist) {
      await audit(db, {
        actorId: req.user.userId,
        actorRole: 'supplier',
        action: 'supplier.csv_preview',
        resourceType: 'catalog',
        meta: { valid: valid.length, invalid: invalid.length },
      });
      return res.json({
        success: true,
        persisted: false,
        message: `Parsed ${valid.length} valid items (${invalid.length} rejected). Confirm with persist=true to save.`,
        items: valid,
        errors: invalid,
      });
    }

    if (invalid.length) {
      return res.status(400).json({
        error: 'CSV has validation errors; nothing saved',
        code: 'CSV_INVALID',
        errors: invalid,
      });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const item of valid) {
        const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const r = await client.query(
          `INSERT INTO buying_groups (
             supplier_id, product_name, category, description, unit_price, retail_price,
             target_quantity, current_quantity, unit, deadline, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,'open') RETURNING id, product_name`,
          [sid, item.title, item.category, item.description, item.groupPrice, item.rrp, item.targetUnits, item.unit, deadline]
        );
        created.push(r.rows[0]);
      }
      await client.query('COMMIT');
      await audit(db, {
        actorId: req.user.userId,
        actorRole: 'supplier',
        action: 'supplier.csv_persist',
        resourceType: 'catalog',
        meta: { count: created.length },
      });
      res.json({ success: true, persisted: true, items: created });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === 'ROW_LIMIT' || err.code === 'MALFORMED_CSV' || err.code === 'INVALID_CSV') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error', code: 'UPLOAD_ERROR' });
    }
    console.error('bulk-upload', err.message);
    res.status(500).json({ error: 'Upload processing failed', code: 'UPLOAD_ERROR' });
  }
});

module.exports = router;
