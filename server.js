const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// STUDENTS - Управління студентами

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

//редагування
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

//отримання студентів які не заселенні
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

// ROOMS - Управління кімнатами

app.get('/api/rooms', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms ORDER BY room_number');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

//отримання списку вільних кімнат
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

//редагування
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

// ACCOMMODATION - Управління заселенням

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

    const activeCheck = await db.query(
      "SELECT id FROM accommodation WHERE student_id = $1 AND status = 'active'",
      [student_id]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Студент вже заселений в іншу кімнату.' });
    }
    
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

    await db.query(
      'UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1',
      [room_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//виселення
app.put('/api/accommodation/:id/checkout', async (req, res) => {
  try {
    const { id } = req.params;
    const { date_out } = req.body;

    const accRecord = await db.query('SELECT room_id FROM accommodation WHERE id = $1', [id]);
    if (accRecord.rows.length === 0) {
        return res.status(404).json({ error: 'Accommodation record not found' });
    }
    const room_id = accRecord.rows[0].room_id;
    
    const result = await db.query(
      'UPDATE accommodation SET date_out = $1, status = $2 WHERE id = $3 RETURNING *',
      [date_out || new Date(), 'moved_out', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }
    await db.query(
      'UPDATE rooms SET occupied_beds = occupied_beds - 1 WHERE id = $1',
      [room_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PAYMENTS - Управління оплатами

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

// STATISTICS - Статистика для головної сторінки

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


//складні запити

// Топ боржників
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
        COUNT(p.id) as unpaid_months,
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

// Завантаженість по поверхах
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

// Сусіди по кімнаті
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
// ЗВІТИ ТА ЕКСПОРТ ДАНИХ
// ============================================

const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const fs = require('fs');

// Експорт студентів у Excel
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

    // Створення Excel файлу
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

// Експорт боржників у PDF
app.get('/api/reports/debtors/pdf', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.surname || ' ' || s.name as student_name,
        s.faculty,
        s.course,
        s.phone,
        COUNT(p.id) as unpaid_months,
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

    // Створення PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=debtors_report.pdf');

    doc.pipe(res);

    // Заголовок
    doc.fontSize(20).text('Звіт по боржниках', { align: 'center' });
    doc.fontSize(12).text(`Дата формування: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
    doc.moveDown(2);

    // Таблиця
    doc.fontSize(10);
    let y = doc.y;

    // Заголовки таблиці
    doc.text('#', 50, y, { width: 30, continued: true })
       .text('Студент', 80, y, { width: 150, continued: true })
       .text('Факультет', 230, y, { width: 60, continued: true })
       .text('Курс', 290, y, { width: 40, continued: true })
       .text('Телефон', 330, y, { width: 100, continued: true })
       .text('Борг (грн)', 430, y, { width: 100 });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 5;

    // Дані
    debtors.forEach((debtor, index) => {
      y += 20;
      doc.text(index + 1, 50, y, { width: 30, continued: true })
         .text(debtor.student_name, 80, y, { width: 150, continued: true })
         .text(debtor.faculty, 230, y, { width: 60, continued: true })
         .text(debtor.course, 290, y, { width: 40, continued: true })
         .text(debtor.phone || '-', 330, y, { width: 100, continued: true })
         .text(parseFloat(debtor.total_debt).toFixed(2), 430, y, { width: 100 });
    });

    // Підсумок
    y += 40;
    const totalDebt = debtors.reduce((sum, d) => sum + parseFloat(d.total_debt), 0);
    doc.fontSize(12).text(`Загальний борг: ${totalDebt.toFixed(2)} грн`, 50, y);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF report' });
  }
});

// Дані для діаграм
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
        month,
        year,
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as unpaid_amount
      FROM payments
      WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY year, month
      ORDER BY year, month
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