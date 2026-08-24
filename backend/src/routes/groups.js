const express = require('express');
const router = express.Router();

// List groups with filters
router.get('/', async (req, res) => {
  const { category, status = 'open' } = req.query;
  const db = req.app.locals.db;
  
  try {
    let query = `
      SELECT g.*, s.name as supplier_name,
        (g.current_quantity::float / g.target_quantity * 100) as fill_percentage
      FROM buying_groups g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      WHERE g.status = $1
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
    res.status(500).json({ error: err.message });
  }
});

// Get single group
router.get('/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT g.*, s.name as supplier_name,
        (g.current_quantity::float / g.target_quantity * 100) as fill_percentage
      FROM buying_groups g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      WHERE g.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get member count
    const members = await db.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE group_id = $1 AND status IN ($2, $3, $4, $5)',
      [req.params.id, 'paid', 'group_filling', 'ordered', 'ready_pickup']
    );
    
    const group = result.rows[0];
    group.member_count = parseInt(members.rows[0].count);
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;