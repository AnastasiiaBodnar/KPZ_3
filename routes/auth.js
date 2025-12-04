const express = require('express');
const router = express.Router();
const db = require('../db');

// логін
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Введіть логін та пароль' });
    }

    // перевірка адміна
    if (username === 'admin' && password === 'admin123') {
      return res.json({
        role: 'admin',
        username: 'admin',
        name: 'Адміністратор'
      });
    }

    // пошук студента по ID
    const student = await db.query(
      'SELECT * FROM students WHERE id = $1',
      [parseInt(username)]
    );

    if (student.rows.length === 0) {
      return res.status(401).json({ error: 'Невірний ID або пароль' });
    }

    const studentData = student.rows[0];
    
    // пароль = ID студента (просто для тесту, можна змінити)
    if (password !== String(studentData.id)) {
      return res.status(401).json({ error: 'Невірний ID або пароль' });
    }

    res.json({
      role: 'student',
      student_id: studentData.id,
      username: studentData.passport,
      name: `${studentData.surname} ${studentData.name}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

module.exports = router;