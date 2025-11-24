const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'id';      
    const sortOrder = req.query.sortOrder || 'ASC';
    const search = req.query.search || '';
    const course = req.query.course || '';
    const faculty = req.query.faculty || '';

    const allowedFields = ['id', 'surname', 'name', 'course', 'faculty', 'phone', 'passport'];
    
    if (!allowedFields.includes(sortBy)) {
      return res.status(400).json({ error: 'Invalid sort field' });
    }

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (LOWER(surname) LIKE $${paramCount} OR LOWER(name) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    if (course) {
      paramCount++;
      whereClause += ` AND course = $${paramCount}`;
      params.push(course);
    }

    if (faculty) {
      paramCount++;
      whereClause += ` AND faculty = $${paramCount}`;
      params.push(faculty);
    }

    const countQuery = `SELECT COUNT(*) FROM students ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);

    const query = `
      SELECT s.*, 
        r.room_number,
        r.floor,
        COALESCE(debt_info.total_debt, 0) as total_debt,
        CASE WHEN a.id IS NOT NULL THEN true ELSE false END as is_accommodated
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id AND a.status = 'active'
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN (
        SELECT student_id, SUM(amount) as total_debt
        FROM payments
        WHERE status = 'unpaid'
        GROUP BY student_id
      ) debt_info ON s.id = debt_info.student_id
      
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    
    const result = await db.query(query, params);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

//студенти які не заселені
router.get('/available', async (req, res) => {
  try {
    const query = `
      SELECT s.*
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id AND a.status = 'active'
      WHERE a.id IS NULL
      ORDER BY s.surname, s.name
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT s.*, 
        r.room_number,
        r.floor,
        a.date_in as accommodation_date,
        COALESCE(debt_info.total_debt, 0) as total_debt,
        COALESCE(debt_info.unpaid_months, 0) as unpaid_months
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id AND a.status = 'active'
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN (
        SELECT student_id, 
          SUM(amount) as total_debt,
          COUNT(*) as unpaid_months
        FROM payments
        WHERE status = 'unpaid'
        GROUP BY student_id
      ) debt_info ON s.id = debt_info.student_id
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id/roommates', async (req, res) => {
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

// складний запит
router.get('/:id/coursemates', async (req, res) => {
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

router.post('/', async (req, res) => {
  try {
    const { surname, name, patronymic, course, faculty, phone, passport } = req.body;
    
    if (!surname || !name || !course || !faculty) {
      return res.status(400).json({ error: 'Обов\'язкові поля: прізвище, ім\'я, курс, факультет' });
    }

    if (passport) {
      const existingPassport = await db.query(
        'SELECT id FROM students WHERE passport = $1',
        [passport]
      );
      if (existingPassport.rows.length > 0) {
        return res.status(400).json({ error: 'Студент з таким паспортом вже існує' });
      }
    }

    const result = await db.query(
      'INSERT INTO students (surname, name, patronymic, course, faculty, phone, passport) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [surname, name, patronymic, course, faculty, phone, passport]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// оновити студента
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { surname, name, patronymic, course, faculty, phone, passport } = req.body;
    
    if (passport) {
      const existingPassport = await db.query(
        'SELECT id FROM students WHERE passport = $1 AND id != $2',
        [passport, id]
      );
      if (existingPassport.rows.length > 0) {
        return res.status(400).json({ error: 'Студент з таким паспортом вже існує' });
      }
    }

    const result = await db.query(
      'UPDATE students SET surname = $1, name = $2, patronymic = $3, course = $4, faculty = $5, phone = $6, passport = $7 WHERE id = $8 RETURNING *',
      [surname, name, patronymic, course, faculty, phone, passport, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const accommodation = await db.query(
      "SELECT id FROM accommodation WHERE student_id = $1 AND status = 'active'",
      [id]
    );
    
    if (accommodation.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Неможливо видалити студента, який заселений. Спочатку виселіть студента.' 
      });
    }

    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;