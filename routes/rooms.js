const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
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

router.get('/available', async (req, res) => {
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

router.post('/:id/clear', async (req, res) => {
  const roomId = req.params.id;
  
  try {
    await db.query('BEGIN');
    
    const room = await db.query('SELECT * FROM rooms WHERE id = ' + roomId);
    
    if (room.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Кімната не знайдена' });
    }
    
    await db.query('UPDATE accommodation SET status = \'moved_out\', date_out = NOW() WHERE room_id = ' + roomId + ' AND status = \'active\'');
    
    await db.query('UPDATE rooms SET occupied_beds = 0 WHERE id = ' + roomId);
    
    await db.query('COMMIT');
    
    res.json({ 
      message: 'Кімнату звільнено',
      room_number: room.rows[0].room_number
    });
    
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Помилка' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { room_number, floor, total_beds } = req.body;
    
    const existing = await db.query(
      'SELECT id FROM rooms WHERE room_number = $1',
      [room_number]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Кімната з таким номером вже існує' });
    }

    const result = await db.query(
      'INSERT INTO rooms (room_number, floor, total_beds) VALUES ($1, $2, $3) RETURNING *',
      [room_number, floor, total_beds]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { room_number, floor, total_beds } = req.body;
    
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
      'UPDATE rooms SET room_number = $1, floor = $2, total_beds = $3 WHERE id = $4 RETURNING *',
      [room_number, floor, total_beds, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
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

module.exports = router;