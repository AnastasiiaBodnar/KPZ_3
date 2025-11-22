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

// ВИПРАВЛЕНИЙ POST /api/accommodation - заселення з можливістю створити нарахування
router.post('/', async (req, res) => {
  const client = await db.query('BEGIN');
  
  try {
    const { student_id, room_id, date_in, create_payment, payment } = req.body;

    // Перевірка чи студент вже заселений
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
    
    // КРИТИЧНО: Отримуємо актуальний стан кімнати з блокуванням рядка
    const room = await db.query(
      'SELECT id, room_number, total_beds, occupied_beds FROM rooms WHERE id = $1 FOR UPDATE', 
      [room_id]
    );
    
    if (room.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Кімната не знайдена' });
    }

    const currentRoom = room.rows[0];
    const availableBeds = currentRoom.total_beds - currentRoom.occupied_beds;

    console.log(`🔍 Кімната ${currentRoom.room_number}: всього=${currentRoom.total_beds}, зайнято=${currentRoom.occupied_beds}, вільно=${availableBeds}`);

    // Перевірка чи є вільні місця ДО створення запису
    if (availableBeds <= 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `В кімнаті ${currentRoom.room_number} немає вільних місць (зайнято ${currentRoom.occupied_beds} з ${currentRoom.total_beds})` 
      });
    }

    // ВАЖЛИВО: Спочатку оновлюємо кількість зайнятих місць
    const updateResult = await db.query(
      'UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1 AND occupied_beds < total_beds RETURNING *',
      [room_id]
    );

    if (updateResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Не вдалося оновити кімнату. Можливо, всі місця вже зайняті.` 
      });
    }

    console.log(`✅ Оновлено кімнату: зайнято ${updateResult.rows[0].occupied_beds} з ${updateResult.rows[0].total_beds}`);

    // Тепер створюємо запис про заселення
    const accommodationResult = await db.query(
      'INSERT INTO accommodation (student_id, room_id, date_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, room_id, date_in || new Date(), 'active']
    );

    // Якщо потрібно створити нарахування
    if (create_payment && payment) {
      const { month_from, month_to, year, mark_as_paid } = payment;
      
      // Валідація
      if (month_to < month_from) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Кінцевий місяць не може бути раніше початкового' });
      }

      if (month_from < 1 || month_from > 12 || month_to < 1 || month_to > 12) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Місяці повинні бути від 1 до 12' });
      }

      // Перевірка на дублікати періодів
      const existing = await db.query(`
        SELECT id, month_from, month_to FROM payments 
        WHERE student_id = $1 
          AND year = $2 
          AND (
            (month_from <= $3 AND month_to >= $3) OR
            (month_from <= $4 AND month_to >= $4) OR
            (month_from >= $3 AND month_to <= $4)
          )
      `, [student_id, year, month_from, month_to]);

      if (existing.rows.length > 0) {
        await db.query('ROLLBACK');
        const existingPeriod = existing.rows[0];
        const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
        return res.status(400).json({ 
          error: `Цей період перекривається з існуючою оплатою: ${months[existingPeriod.month_from-1]} - ${months[existingPeriod.month_to-1]} ${year}` 
        });
      }

      // Розраховуємо суму
      const monthCount = month_to - month_from + 1;
      const amount = monthCount * MONTHLY_RATE;
      
      // Створюємо нарахування
      const paymentStatus = mark_as_paid ? 'paid' : 'unpaid';
      const paymentDate = mark_as_paid ? (date_in || new Date()) : null;
      
      await db.query(
        `INSERT INTO payments (student_id, month_from, month_to, year, amount, payment_date, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [student_id, month_from, month_to, year, amount, paymentDate, paymentStatus]
      );
    }

    await db.query('COMMIT');
    
    res.status(201).json({
      accommodation: accommodationResult.rows[0],
      payment_created: create_payment ? true : false,
      room_status: {
        room_number: currentRoom.room_number,
        occupied_beds: updateResult.rows[0].occupied_beds,
        total_beds: updateResult.rows[0].total_beds,
        available_beds: updateResult.rows[0].total_beds - updateResult.rows[0].occupied_beds
      }
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('❌ Помилка заселення:', err);
    
    // Перевіряємо чи це помилка обмеження beds_check
    if (err.message && err.message.includes('beds_check')) {
      return res.status(400).json({ 
        error: 'Перевищено ліміт місць у кімнаті. Спробуйте оновити сторінку.' 
      });
    }
    
    res.status(500).json({ error: err.message || 'Помилка заселення' });
  }
});

router.post('/:id/transfer', async (req, res) => {
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

    // Блокуємо нову кімнату для перевірки
    const newRoom = await db.query(
      'SELECT * FROM rooms WHERE id = $1 FOR UPDATE', 
      [new_room_id]
    );
    
    if (newRoom.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Нова кімната не знайдена' });
    }

    const availableBeds = newRoom.rows[0].total_beds - newRoom.rows[0].occupied_beds;

    if (availableBeds <= 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `В кімнаті ${newRoom.rows[0].room_number} немає вільних місць (зайнято ${newRoom.rows[0].occupied_beds} з ${newRoom.rows[0].total_beds})` 
      });
    }

    const dateTransfer = transfer_date || new Date();

    // Закриваємо старе заселення
    await db.query(
      "UPDATE accommodation SET date_out = $1, status = 'transferred' WHERE id = $2",
      [dateTransfer, id]
    );

    // Оновлюємо стару кімнату
    await db.query('UPDATE rooms SET occupied_beds = occupied_beds - 1 WHERE id = $1', [oldRoomId]);

    // Оновлюємо нову кімнату
    await db.query('UPDATE rooms SET occupied_beds = occupied_beds + 1 WHERE id = $1', [new_room_id]);

    // Створюємо нове заселення
    const newAccommodation = await db.query(
      'INSERT INTO accommodation (student_id, room_id, date_in, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [studentId, new_room_id, dateTransfer, 'active']
    );

    await db.query('COMMIT');
    res.json({
      message: 'Студента успішно переселено',
      accommodation: newAccommodation.rows[0]
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('❌ Помилка переселення:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/checkout', async (req, res) => {
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
    console.error('❌ Помилка виселення:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;