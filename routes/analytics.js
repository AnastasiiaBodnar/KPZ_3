const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/top-debtors', async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    // складний запит топ боржників
    const result = await db.query(`
      SELECT 
        s.id,
        s.surname || ' ' || s.name as student_name,
        s.faculty,
        s.course,
        s.phone,
        COUNT(p.id) as unpaid_records,
        SUM(p.amount) as total_debt
      FROM students s
      JOIN payments p ON s.id = p.student_id
      WHERE p.status = 'unpaid'
      GROUP BY s.id, s.surname, s.name, s.faculty, s.course, s.phone
      HAVING SUM(p.amount) > 0
      ORDER BY total_debt DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/floors', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.floor,
        COUNT(r.id) as total_rooms,
        SUM(r.total_beds) as total_beds,
        SUM(r.occupied_beds) as occupied_beds,
        SUM(r.total_beds - r.occupied_beds) as free_beds,
        ROUND(SUM(r.occupied_beds) * 100.0 / NULLIF(SUM(r.total_beds), 0), 2) as occupancy_rate
      FROM rooms r
      GROUP BY r.floor
      ORDER BY r.floor
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;