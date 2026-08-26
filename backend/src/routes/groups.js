'use strict';

const express = require('express');
const router = express.Router();
const reservations = require('../services/reservations');

router.get('/', async (req, res) => {
  const { category, status = 'open' } = req.query;
  const db = req.app.locals.db;
  try {
    let query = `
      SELECT g.*, s.name AS supplier_name,
        CASE WHEN g.target_quantity > 0
          THEN ROUND((g.current_quantity::numeric / g.target_quantity) * 100, 1)
          ELSE 0 END AS fill_percentage,
        GREATEST(g.target_quantity - g.current_quantity, 0) AS remaining_quantity
      FROM buying_groups g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      WHERE g.status = $1
        AND (g.deadline IS NULL OR g.deadline > NOW())
    `;
    const params = [status];
    if (category) {
      query += ` AND g.category = $2`;
      params.push(category);
    }
    query += ` ORDER BY g.deadline ASC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('groups list', err.message);
    res.status(500).json({ error: 'Failed to list groups', code: 'SERVER_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await reservations.expireStaleReservations(client, req.params.id);
    const result = await client.query(
      `SELECT g.*, s.name AS supplier_name,
        CASE WHEN g.target_quantity > 0
          THEN ROUND((g.current_quantity::numeric / g.target_quantity) * 100, 1)
          ELSE 0 END AS fill_percentage,
        GREATEST(g.target_quantity - g.current_quantity, 0) AS remaining_quantity
       FROM buying_groups g
       LEFT JOIN suppliers s ON g.supplier_id = s.id
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found', code: 'NOT_FOUND' });
    }
    const members = await client.query(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM orders
       WHERE group_id = $1 AND reservation_status IN ('reserved','confirmed')`,
      [req.params.id]
    );
    await client.query('COMMIT');
    const group = result.rows[0];
    group.member_count = members.rows[0].count;
    group.is_expired = group.deadline ? new Date(group.deadline) < new Date() : false;
    group.is_open = group.status === 'open' && !group.is_expired;
    res.json(group);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('group detail', err.message);
    res.status(500).json({ error: 'Failed to load group', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

module.exports = router;
