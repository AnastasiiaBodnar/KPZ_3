const express = require('express');
const router = express.Router();
const db = require('../db');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

router.get('/students/excel', async (req, res) => {
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

router.get('/debtors/pdf', async (req, res) => {
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

router.get('/charts/faculty-stats', async (req, res) => {
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

router.get('/charts/payments-by-month', async (req, res) => {
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

module.exports = router;