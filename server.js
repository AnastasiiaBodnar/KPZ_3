const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONTHLY_RATE = 500; // 500 грн за місяць

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================
// STUDENTS - Управління студентами з пагінацією
// ============================================

app.get('/api/students', async (req, res) => {
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

app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT s.*, 
        r.room_number,
        r.floor,
        r.block,
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

app.post('/api/students', async (req, res) => {
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

app.put('/api/students/:id', async (req, res) => {
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

app.delete('/api/students/:id', async (req, res) => {
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

app.get('/api/students/available', async (req, res) => {
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

// ============================================
// ROOMS - Управління кімнатами з пагінацією
// ============================================

app.get('/api/rooms', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const floor = req.query.floor || '';
    const status = req.query.status || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (floor) {
      paramCount++;
      whereClause += ` AND floor = $${paramCount}`;
      params.push(floor);
    }

    if (status === 'available') {
      whereClause += ` AND occupied_beds < total_beds`;
    } else if (status === 'full') {
      whereClause += ` AND occupied_beds >= total_beds`;
    }

    const countQuery = `SELECT COUNT(*) FROM rooms ${whereClause}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const query = `
      SELECT * FROM rooms 
      ${whereClause}
      ORDER BY floor, room_number
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

app.get('/api/rooms/available', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM rooms WHERE occupied_beds < total_beds ORDER BY floor, room_number'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { room_number, floor, block, total_beds } = req.body;
    
    const existing = await db.query(
      'SELECT id FROM rooms WHERE room_number = $1',
      [room_number]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Кімната з таким номером вже існує' });
    }

    const result = await db.query(
      'INSERT INTO rooms (room_number, floor, block, total_beds) VALUES ($1, $2, $3, $4) RETURNING *',
      [room_number, floor, block, total_beds]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, floor, block, total_beds } = req.body;
    
    const room = await db.query('SELECT occupied_beds FROM rooms WHERE id = $1', [id]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (total_beds < room.rows[0].occupied_beds) {
      return res.status(400).json({ 
        error: `Неможливо встановити ${total_beds} місць. Зараз зайнято ${room.rows[0].occupied_beds} місць.` 
      });
    }

    const existing = await db.query(
      'SELECT id FROM rooms WHERE room_number = $1 AND id != $2',
      [room_number, id]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Кімната з таким номером вже існує' });
    }

    const result = await db.query(
      'UPDATE rooms SET room_number = $1, floor = $2, block = $3, total_beds = $4 WHERE id = $5 RETURNING *',
      [room_number, floor, block, total_beds, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const occupied = await db.query('SELECT occupied_beds FROM rooms WHERE id = $1', [id]);
    if (occupied.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (occupied.rows[0].occupied_beds > 0) {
      return res.status(400).json({ 
        error: 'Неможливо видалити кімнату з заселеними студентами' 
      });
    }

    const result = await db.query('DELETE FROM rooms WHERE id = $1 RETURNING *', [id]);
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ACCOMMODATION - Управління заселенням з переселенням
// ============================================

app.get('/api/accommodation', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND a.status = $${paramCount}`;
      params.push(status);
    }

    const countQuery = `
      SELECT COUNT(*) FROM accommodation a
      JOIN students s ON a.student_id = s.id
      JOIN rooms r ON a.room_id = r.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(`
      SELECT a.*, 
        s.surname || ' ' || s.name || ' ' || COALESCE(s.patronymic, '') as student_name,
        s.course,
        s.faculty,
        r.room_number, 
        r.floor, 
        r.block
      FROM accommodation a
      JOIN students s ON a.student_id = s.id
      JOIN rooms r ON a.room_id = r.id
      ${whereClause}
      ORDER BY a.date_in DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    
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

app.post('/api/accommodation', async (req, res) => {
  const client = await db.query('BEGIN');
  
  try {
    const { student_id, room_id, date_in } = req.body;

    const activeCheck = await db.query(
      "SELECT a.id, r.room_number FROM accommodation a JOIN rooms r ON a.room_id = r.id WHERE a.student_id = $1 AND a.status = 'active'",
      [student_id]
    );

    if (activeCheck.rows.length > 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Студент вже заселений в кімнату ${activeCheck.rows[0].room_number}. Спочатку виселіть або переселіть студента.` 
      });
    }
    
    const room = await db.query('SELECT * FROM rooms WHERE id = $1', [room_id]);
    if (room.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Кімната не знайдена' });
    }
    
    if (room.rows[0].occupied_beds >= room.rows[0].total_beds) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `В кімнаті ${room.rows[0].room_number} немає вільних місць` 
      });
    }

    const result = await db.query(
      'INSERT INTO accommodation (student_id, room_id, date_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, room_id, date_in || new Date(), 'active']
    );

    await db.query(
      'UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1',
      [room_id]
    );

    await db.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accommodation/:id/transfer', async (req, res) => {
  const client = await db.query('BEGIN');
  
  try {
    const { id } = req.params;
    const { new_room_id, transfer_date } = req.body;

    const currentAccommodation = await db.query(
      'SELECT * FROM accommodation WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (currentAccommodation.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Активне заселення не знайдено' });
    }

    const oldRoomId = currentAccommodation.rows[0].room_id;
    const studentId = currentAccommodation.rows[0].student_id;

    if (oldRoomId === new_room_id) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Студент вже в цій кімнаті' });
    }

    const newRoom = await db.query('SELECT * FROM rooms WHERE id = $1', [new_room_id]);
    if (newRoom.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Нова кімната не знайдена' });
    }

    if (newRoom.rows[0].occupied_beds >= newRoom.rows[0].total_beds) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `В кімнаті ${newRoom.rows[0].room_number} немає вільних місць` 
      });
    }

    const dateTransfer = transfer_date || new Date();

    await db.query(
      "UPDATE accommodation SET date_out = $1, status = 'transferred' WHERE id = $2",
      [dateTransfer, id]
    );

    const newAccommodation = await db.query(
      'INSERT INTO accommodation (student_id, room_id, date_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [studentId, new_room_id, dateTransfer, 'active']
    );

    await db.query('UPDATE rooms SET occupied_beds = occupied_beds - 1 WHERE id = $1', [oldRoomId]);
    await db.query('UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1', [new_room_id]);

    await db.query('COMMIT');
    res.json({
      message: 'Студента успішно переселено',
      accommodation: newAccommodation.rows[0]
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accommodation/:id/checkout', async (req, res) => {
  const client = await db.query('BEGIN');
  
  try {
    const { id } = req.params;
    const { date_out } = req.body;

    const accRecord = await db.query(
      'SELECT room_id, status FROM accommodation WHERE id = $1', 
      [id]
    );
    
    if (accRecord.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Запис про заселення не знайдено' });
    }

    if (accRecord.rows[0].status !== 'active') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Студент вже виселений' });
    }

    const room_id = accRecord.rows[0].room_id;
    
    const result = await db.query(
      'UPDATE accommodation SET date_out = $1, status = $2 WHERE id = $3 RETURNING *',
      [date_out || new Date(), 'moved_out', id]
    );

    await db.query(
      'UPDATE rooms SET occupied_beds = occupied_beds - 1 WHERE id = $1',
      [room_id]
    );

    await db.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PAYMENTS - Управління оплатами з ФІКСОВАНОЮ ЦІНОЮ
// ============================================

app.get('/api/payments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || '';
    const year = req.query.year || '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND p.status = $${paramCount}`;
      params.push(status);
    }

    if (year) {
      paramCount++;
      whereClause += ` AND p.year = $${paramCount}`;
      params.push(year);
    }

    const countQuery = `
      SELECT COUNT(*) FROM payments p
      JOIN students s ON p.student_id = s.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(`
      SELECT p.*, 
        s.surname || ' ' || s.name || ' ' || COALESCE(s.patronymic, '') as student_name,
        s.course,
        s.faculty
      FROM payments p
      JOIN students s ON p.student_id = s.id
      ${whereClause}
      ORDER BY p.year DESC, p.month_from DESC, p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    
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

app.get('/api/payments/debtors', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, 
        s.surname || ' ' || s.name || ' ' || COALESCE(s.patronymic, '') as student_name,
        s.phone,
        s.course,
        s.faculty
      FROM payments p
      JOIN students s ON p.student_id = s.id
      WHERE p.status = 'unpaid'
      ORDER BY p.year DESC, p.month_from DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { student_id, month_from, month_to, year, amount, payment_date, status } = req.body;
    
    if (!student_id || !month_from || !year || !amount) {
      return res.status(400).json({ error: 'Обов\'язкові поля: студент, місяць початку, рік, сума' });
    }

    const monthTo = month_to || month_from;

    if (monthTo < month_from) {
      return res.status(400).json({ error: 'Кінцевий місяць не може бути раніше початкового' });
    }

    if (month_from < 1 || month_from > 12 || monthTo < 1 || monthTo > 12) {
      return res.status(400).json({ error: 'Місяці повинні бути від 1 до 12' });
    }

    const monthCount = monthTo - month_from + 1;
    const expectedAmount = monthCount * MONTHLY_RATE;

    if (Math.abs(amount - expectedAmount) > 1) {
      return res.status(400).json({ 
        error: `Неправильна сума. За ${monthCount} місяць(ів) має бути ${expectedAmount} грн (${monthCount} × ${MONTHLY_RATE} грн)` 
      });
    }

    const studentCheck = await db.query('SELECT id FROM students WHERE id = $1', [student_id]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Студента не знайдено' });
    }

    const existing = await db.query(`
      SELECT id, month_from, month_to FROM payments 
      WHERE student_id = $1 
        AND year = $2 
        AND (
          (month_from <= $3 AND month_to >= $3) OR
          (month_from <= $4 AND month_to >= $4) OR
          (month_from >= $3 AND month_to <= $4)
        )
    `, [student_id, year, month_from, monthTo]);

    if (existing.rows.length > 0) {
      const existingPeriod = existing.rows[0];
      const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
      return res.status(400).json({ 
        error: `Цей період перекривається з існуючою оплатою: ${months[existingPeriod.month_from-1]} - ${months[existingPeriod.month_to-1]} ${year}` 
      });
    }

    const result = await db.query(
      `INSERT INTO payments (student_id, month_from, month_to, year, amount, payment_date, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [student_id, month_from, monthTo, year, expectedAmount, payment_date, status || 'unpaid']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, status } = req.body;
    
    const result = await db.query(
      'UPDATE payments SET payment_date = $1, status = $2 WHERE id = $3 RETURNING *',
      [payment_date, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM payments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STATISTICS
// ============================================

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

// ============================================
// REPORTS
// ============================================

const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

app.get('/api/reports/students/excel', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.surname,
        s.name,
        s.patronymic,
        s.course,
        s.faculty,
        s.phone,
        s.passport,
        r.room_number,
        COALESCE(debt_info.total_debt, 0) as total_debt
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id AND a.status = 'active'
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN (
        SELECT student_id, SUM(amount) as total_debt
        FROM payments
        WHERE status = 'unpaid'
        GROUP BY student_id
      ) debt_info ON s.id = debt_info.student_id
      ORDER BY s.surname, s.name
    `);

    const students = result.rows;
    const workbook = xlsx.utils.book_new();
    const worksheetData = [
      ['ID', 'Прізвище', 'Ім\'я', 'По батькові', 'Курс', 'Факультет', 'Телефон', 'Паспорт', 'Кімната', 'Борг (грн)']
    ];

    students.forEach(s => {
      worksheetData.push([
        s.id,
        s.surname,
        s.name,
        s.patronymic || '',
        s.course,
        s.faculty,
        s.phone || '',
        s.passport || '',
        s.room_number || 'Не заселений',
        parseFloat(s.total_debt).toFixed(2)
      ]);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Студенти');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating Excel report' });
  }
});

app.get('/api/reports/debtors/pdf', async (req, res) => {
  try {
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
      LIMIT 20
    `);

    const debtors = result.rows;
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=debtors_report.pdf');

    doc.pipe(res);
    doc.fontSize(20).text('Звіт по боржниках', { align: 'center' });
    doc.fontSize(12).text(`Дата: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10);
    let y = doc.y;

    doc.text('#', 50, y, { width: 30, continued: true })
       .text('Студент', 80, y, { width: 150, continued: true })
       .text('Факультет', 230, y, { width: 60, continued: true })
       .text('Курс', 290, y, { width: 40, continued: true })
       .text('Телефон', 330, y, { width: 100, continued: true })
       .text('Борг (грн)', 430, y, { width: 100 });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 5;

    debtors.forEach((debtor, index) => {
      y += 20;
      doc.text(index + 1, 50, y, { width: 30, continued: true })
         .text(debtor.student_name, 80, y, { width: 150, continued: true })
         .text(debtor.faculty, 230, y, { width: 60, continued: true })
         .text(debtor.course, 290, y, { width: 40, continued: true })
         .text(debtor.phone || '-', 330, y, { width: 100, continued: true })
         .text(parseFloat(debtor.total_debt).toFixed(2), 430, y, { width: 100 });
    });

    y += 40;
    const totalDebt = debtors.reduce((sum, d) => sum + parseFloat(d.total_debt), 0);
    doc.fontSize(12).text(`Загальний борг: ${totalDebt.toFixed(2)} грн`, 50, y);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF report' });
  }
});

app.get('/api/reports/charts/faculty-stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.faculty,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE WHEN a.status = 'active' THEN s.id END) as accommodated_students,
        COALESCE(SUM(CASE WHEN p.status = 'unpaid' THEN p.amount ELSE 0 END), 0) as total_debt
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id
      LEFT JOIN payments p ON s.id = p.student_id
      GROUP BY s.faculty
      ORDER BY s.faculty
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/reports/charts/payments-by-month', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        month_from as month,
        year,
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as unpaid_amount
      FROM payments
      WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY year, month_from
      ORDER BY year, month_from
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});