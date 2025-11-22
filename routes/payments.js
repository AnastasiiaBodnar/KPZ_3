const express = require('express');
const router = express.Router();
const db = require('../db');

const MONTHLY_RATE = 500; // 500 грн за місяць

router.get('/', async (req, res) => {
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

router.get('/debtors', async (req, res) => {
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

//створити нарахування
router.post('/', async (req, res) => {
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

// складний запит Перевірка перекриття періодів
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

// часткова оплата
router.post('/:id/partial', async (req, res) => {
  const client = await db.query('BEGIN');
  
  try {
    const { id } = req.params;
    const { paid_amount, payment_date } = req.body;
    
    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND status = $2',
      [id, 'unpaid']
    );
    
    if (paymentResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Неоплачене нарахування не знайдено' });
    }
    
    const payment = paymentResult.rows[0];
    const totalAmount = parseFloat(payment.amount);
    const paidAmount = parseFloat(paid_amount);
    
    if (paidAmount <= 0 || paidAmount > totalAmount) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Сума має бути від 0.01 до ${totalAmount.toFixed(2)} грн` 
      });
    }
    
    const remaining = totalAmount - paidAmount;
    
    if (remaining < 0.01) {
      await db.query(
        'UPDATE payments SET payment_date = $1, status = $2 WHERE id = $3',
        [payment_date, 'paid', id]
      );
      
      await db.query('COMMIT');
      return res.json({
        message: 'Повну оплату підтверджено',
        remaining_debt: 0
      });
    }
    
    // Часткова оплата - розділяємо на 2 записи
    const monthsPaid = Math.floor(paidAmount / MONTHLY_RATE);
    const monthsRemaining = (payment.month_to - payment.month_from + 1) - monthsPaid;
    
    if (monthsPaid === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Мінімальна сума для оплати - ${MONTHLY_RATE} грн (1 місяць)` 
      });
    }
    
    // 1. Оновлюємо поточний запис - позначаємо як оплачений
    const newMonthTo = payment.month_from + monthsPaid - 1;
    
    await db.query(
      'UPDATE payments SET month_to = $1, amount = $2, payment_date = $3, status = $4 WHERE id = $5',
      [newMonthTo, paidAmount, payment_date, 'paid', id]
    );
    
    // 2. Створюємо новий запис для залишку боргу
    const newMonthFrom = newMonthTo + 1;
    
    await db.query(
      `INSERT INTO payments (student_id, month_from, month_to, year, amount, payment_date, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, NULL, 'unpaid', NOW())`,
      [payment.student_id, newMonthFrom, payment.month_to, payment.year, remaining]
    );
    
    await db.query('COMMIT');
    
    res.json({
      message: 'Часткову оплату внесено успішно',
      paid_amount: paidAmount,
      months_paid: monthsPaid,
      remaining_debt: remaining,
      months_remaining: monthsRemaining
    });
    
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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

module.exports = router;