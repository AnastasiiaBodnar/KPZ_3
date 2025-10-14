const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


app.get('/api/students', async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'id';      
    const sortOrder = req.query.sortOrder || 'ASC';    

    const allowedFields = ['id', 'surname', 'name', 'course', 'faculty', 'phone', 'passport'];
    
    if (!allowedFields.includes(sortBy)) {
      return res.status(400).json({ error: 'Invalid sort field' });
    }

    const query = `SELECT * FROM students ORDER BY ${sortBy} ${sortOrder}`;
    const result = await db.query(query);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM students WHERE id = $1', [id]);
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


app.get('/api/rooms', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms ORDER BY room_number');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/rooms/available', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms WHERE occupied_beds < total_beds ORDER BY room_number');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { room_number, floor, block, total_beds } = req.body;
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
    const result = await db.query(
      'UPDATE rooms SET room_number = $1, floor = $2, block = $3, total_beds = $4 WHERE id = $5 RETURNING *',
      [room_number, floor, block, total_beds, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM rooms WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/accommodation', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, 
        s.surname || ' ' || s.name || ' ' || COALESCE(s.patronymic, '') as student_name,
        r.room_number, r.floor, r.block
      FROM accommodation a
      JOIN students s ON a.student_id = s.id
      JOIN rooms r ON a.room_id = r.id
      ORDER BY a.date_in DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/accommodation', async (req, res) => {
  try {
    const { student_id, room_id, date_in } = req.body;

    const room = await db.query('SELECT * FROM rooms WHERE id = $1', [room_id]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.rows[0].occupied_beds >= room.rows[0].total_beds) {
      return res.status(400).json({ error: 'No available beds in this room' });
    }

    const result = await db.query(
      'INSERT INTO accommodation (student_id, room_id, date_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, room_id, date_in || new Date(), 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/accommodation/:id/checkout', async (req, res) => {
  try {
    const { id } = req.params;
    const { date_out } = req.body;
    const result = await db.query(
      'UPDATE accommodation SET date_out = $1, status = $2 WHERE id = $3 RETURNING *',
      [date_out || new Date(), 'moved_out', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, 
        s.surname || ' ' || s.name || ' ' || COALESCE(s.patronymic, '') as student_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      ORDER BY p.year DESC, p.month DESC
    `);
    res.json(result.rows);
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
        s.phone
      FROM payments p
      JOIN students s ON p.student_id = s.id
      WHERE p.status = 'unpaid'
      ORDER BY p.year DESC, p.month DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const { student_id, month, year, amount, payment_date, status } = req.body;
    const result = await db.query(
      'INSERT INTO payments (student_id, month, year, amount, payment_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [student_id, month, year, amount, payment_date, status || 'unpaid']
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

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});