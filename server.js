const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/students', require('./routes/students'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/accommodation', require('./routes/accommodation'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/auth', require('./routes/auth'));

const db = require('./db');

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