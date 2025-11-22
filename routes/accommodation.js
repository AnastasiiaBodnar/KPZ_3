const express = require('express');
const router = express.Router();
const db = require('../db');

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

router.post('/', async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;