const express = require('express');
const router = express.Router();
const db = require('../db');


app.get('/api/statistics', async (req, res) => {
  try {
    const totalStudents = await db.query('SELECT COUNT(*) FROM students');
    const totalRooms = await db.query('SELECT COUNT(*) FROM rooms');
    const occupiedBeds = await db.query('SELECT SUM(occupied_beds) FROM rooms');
    const totalBeds = await db.query('SELECT SUM(total_beds) FROM rooms');
    const activeAccommodations = await db.query("SELECT COUNT(*) FROM accommodation WHERE status = 'active'");
    const unpaidPayments = await db.query("SELECT COUNT(*) FROM payments WHERE status = 'unpaid'");

    res.json({
      totalStudents: parseInt(totalStudents.rows[0].count),
      totalRooms: parseInt(totalRooms.rows[0].count),
      occupiedBeds: parseInt(occupiedBeds.rows[0].sum) || 0,
      totalBeds: parseInt(totalBeds.rows[0].sum) || 0,
      activeAccommodations: parseInt(activeAccommodations.rows[0].count),
      unpaidPayments: parseInt(unpaidPayments.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// ANALYTICS
// ============================================

app.get('/api/analytics/top-debtors', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
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

app.get('/api/analytics/floors', async (req, res) => {
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

app.get('/api/students/:id/roommates', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        s.id,
        s.surname || ' ' || s.name as student_name,
        s.faculty,
        s.course,
        s.phone,
        a.date_in
      FROM accommodation a
      JOIN students s ON a.student_id = s.id
      WHERE a.room_id = (
        SELECT room_id FROM accommodation 
        WHERE student_id = $1 AND status = 'active'
      )
      AND a.status = 'active'
      AND a.student_id != $1
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/students/:id/coursemates', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        s2.*,
        r.room_number,
        r.floor,
        COALESCE(debt_info.total_debt, 0) as total_debt
      FROM students s1
      JOIN students s2 ON s1.faculty = s2.faculty AND s1.course = s2.course
      LEFT JOIN accommodation a ON s2.id = a.student_id AND a.status = 'active'
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN (
        SELECT student_id, SUM(amount) as total_debt
        FROM payments
        WHERE status = 'unpaid'
        GROUP BY student_id
      ) debt_info ON s2.id = debt_info.student_id
      WHERE s1.id = $1 AND s2.id != $1
      ORDER BY s2.surname, s2.name
    `, [id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});