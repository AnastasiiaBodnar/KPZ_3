const express = require('express');
const router = express.Router();
const db = require('../db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Студенти');
    
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Прізвище', key: 'surname', width: 15 },
      { header: 'Ім\'я', key: 'name', width: 15 },
      { header: 'По батькові', key: 'patronymic', width: 15 },
      { header: 'Курс', key: 'course', width: 10 },
      { header: 'Факультет', key: 'faculty', width: 15 },
      { header: 'Телефон', key: 'phone', width: 15 },
      { header: 'Паспорт', key: 'passport', width: 15 },
      { header: 'Кімната', key: 'room_number', width: 12 },
      { header: 'Борг (грн)', key: 'total_debt', width: 12 }
    ];

    result.rows.forEach(student => {
      worksheet.addRow({
        id: student.id,
        surname: student.surname,
        name: student.name,
        patronymic: student.patronymic || '',
        course: student.course,
        faculty: student.faculty,
        phone: student.phone || '',
        passport: student.passport || '',
        room_number: student.room_number || 'Не заселений',
        total_debt: parseFloat(student.total_debt).toFixed(2)
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка генерації Excel звіту' });
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
    
    try {
      doc.registerFont('DejaVu', 'node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
      doc.font('DejaVu');
    } catch (fontErr) {
      console.warn('DejaVu font not found, trying alternative...');
      doc.font('Courier');
    }
    
    doc.fontSize(20).text('Звіт по боржниках', { align: 'center' });
    doc.fontSize(12).text(`Дата: ${new Date().toLocaleDateString('uk-UA')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10);
    let y = doc.y;

    doc.text('#', 50, y, { width: 30, continued: false });
    doc.text('Студент', 80, y, { width: 150, continued: false });
    doc.text('Факультет', 230, y, { width: 60, continued: false });
    doc.text('Курс', 290, y, { width: 40, continued: false });
    doc.text('Телефон', 330, y, { width: 100, continued: false });
    doc.text('Борг (грн)', 430, y, { width: 100, continued: false });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    debtors.forEach((debtor, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      doc.text(String(index + 1), 50, y, { width: 30, continued: false });
      doc.text(debtor.student_name, 80, y, { width: 150, continued: false });
      doc.text(debtor.faculty, 230, y, { width: 60, continued: false });
      doc.text(String(debtor.course), 290, y, { width: 40, continued: false });
      doc.text(debtor.phone || '-', 330, y, { width: 100, continued: false });
      doc.text(parseFloat(debtor.total_debt).toFixed(2), 430, y, { width: 100, continued: false });
      
      y += 25;
    });

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;
    
    const totalDebt = debtors.reduce((sum, d) => sum + parseFloat(d.total_debt), 0);
    doc.fontSize(12).font('DejaVu').text(`Загальний борг: ${totalDebt.toFixed(2)} грн`, 50, y, { 
      continued: false,
      width: 500 
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка генерації PDF звіту' });
  }
});

// складний запит
router.get('/charts/faculty-stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.faculty,
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT CASE WHEN a.status = 'active' THEN s.id END) as accommodated_students
      FROM students s
      LEFT JOIN accommodation a ON s.id = a.student_id
      GROUP BY s.faculty
      ORDER BY s.faculty
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка бази даних' });
  }
});

//складний запит
router.get('/charts/payments-by-month', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        month_from as month,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as unpaid_amount
      FROM payments
      WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY month_from
      ORDER BY month_from
    `);
    
    const allMonths = [];
    for (let i = 1; i <= 12; i++) {
      const monthData = result.rows.find(r => parseInt(r.month) === i);
      allMonths.push({
        month: i,
        paid_amount: monthData ? parseFloat(monthData.paid_amount) : 0,
        unpaid_amount: monthData ? parseFloat(monthData.unpaid_amount) : 0
      });
    }
    
    res.json(allMonths);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Помилка бази даних' });
  }
});

module.exports = router;