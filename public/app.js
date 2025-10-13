const API_URL = 'http://localhost:3000/api';

function showLoading() {
  document.getElementById('loadingSpinner').classList.remove('d-none');
}

function hideLoading() {
  document.getElementById('loadingSpinner').classList.add('d-none');
}

function showSection(sectionName) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.add('d-none');
  });
  
  document.getElementById(`${sectionName}-section`).classList.remove('d-none');
  
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  event.target.classList.add('active');
  
  switch(sectionName) {
    case 'dashboard':
      loadStatistics();
      break;
    case 'students':
      loadStudents();
      break;
    case 'rooms':
      loadRooms();
      break;
    case 'accommodation':
      loadAccommodation();
      break;
    case 'payments':
      loadPayments();
      break;
  }
}

function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 3000);
}

async function loadStatistics() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/statistics`);
    const stats = await response.json();
    
    document.getElementById('statistics').innerHTML = `
      <div class="col-md-3">
        <div class="card stat-card border-primary">
          <div class="card-body">
            <h6 class="text-muted">Всього студентів</h6>
            <h2 class="text-primary"><i class="bi bi-people"></i> ${stats.totalStudents}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card border-success">
          <div class="card-body">
            <h6 class="text-muted">Всього кімнат</h6>
            <h2 class="text-success"><i class="bi bi-door-open"></i> ${stats.totalRooms}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card border-info">
          <div class="card-body">
            <h6 class="text-muted">Заповненість</h6>
            <h2 class="text-info"><i class="bi bi-pie-chart"></i> ${stats.occupiedBeds}/${stats.totalBeds}</h2>
            <small class="text-muted">${Math.round((stats.occupiedBeds / stats.totalBeds) * 100)}%</small>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card border-warning">
          <div class="card-body">
            <h6 class="text-muted">Боржників</h6>
            <h2 class="text-warning"><i class="bi bi-exclamation-triangle"></i> ${stats.unpaidPayments}</h2>
          </div>
        </div>
      </div>`;
  } catch (error) {
    console.error('Error loading statistics:', error);
    showAlert('Помилка завантаження статистики', 'danger');
  }
  hideLoading();
}

let studentsData = [];

async function loadStudents() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/students`);
    studentsData = await response.json();
    displayStudents(studentsData);
  } catch (error) {
    console.error('Error loading students:', error);
    showAlert('Помилка завантаження студентів', 'danger');
  }
  hideLoading();
}

function displayStudents(students) {
  document.getElementById('students-table').innerHTML = students.map(student => `
    <tr>
      <td>${student.id}</td>
      <td>${student.surname}</td>
      <td>${student.name}</td>
      <td>${student.patronymic || '-'}</td>
      <td>${student.course}</td>
      <td>${student.faculty}</td>
      <td>${student.phone || '-'}</td>
      <td>${student.passport || '-'}</td>
      <td>
        <button class="btn btn-sm btn-warning btn-action" onclick="editStudent(${student.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger btn-action" onclick="deleteStudent(${student.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function filterStudents() {
  const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
  const courseFilter = document.getElementById('filterCourse').value;
  const facultyFilter = document.getElementById('filterFaculty').value.toLowerCase();
  
  const filtered = studentsData.filter(student => {
    const matchesSearch = student.surname.toLowerCase().includes(searchTerm) || student.name.toLowerCase().includes(searchTerm);
    const matchesCourse = !courseFilter || student.course == courseFilter;
    const matchesFaculty = !facultyFilter || student.faculty.toLowerCase().includes(facultyFilter);
    return matchesSearch && matchesCourse && matchesFaculty;
  });
  
  displayStudents(filtered);
}

function resetFilters() {
  document.getElementById('searchStudent').value = '';
  document.getElementById('filterCourse').value = '';
  document.getElementById('filterFaculty').value = '';
  displayStudents(studentsData);
}

function openStudentModal(studentId = null) {
  const isEdit = studentId !== null;
  let formData = { surname: '', name: '', patronymic: '', course: '', faculty: '', phone: '', passport: '' };
  
  if (isEdit) {
    const student = studentsData.find(s => s.id === studentId);
    if (student) formData = student;
  }
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="studentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? 'Редагувати студента' : 'Додати студента'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="studentForm">
              <div class="mb-3">
                <label class="form-label">Прізвище *</label>
                <input type="text" class="form-control" id="surname" value="${formData.surname}" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Ім'я *</label>
                <input type="text" class="form-control" id="name" value="${formData.name}" required>
              </div>
              <div class="mb-3">
                <label class="form-label">По батькові</label>
                <input type="text" class="form-control" id="patronymic" value="${formData.patronymic || ''}">
              </div>
              <div class="mb-3">
                <label class="form-label">Курс *</label>
                <select class="form-select" id="course" required>
                  <option value="">Оберіть курс</option>
                  ${[1,2,3,4,5,6].map(c => `<option value="${c}" ${formData.course == c ? 'selected' : ''}>${c} курс</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Факультет *</label>
                <input type="text" class="form-control" id="faculty" value="${formData.faculty}" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Телефон</label>
                <input type="tel" class="form-control" id="phone" value="${formData.phone || ''}" placeholder="+380501234567">
              </div>
              <div class="mb-3">
                <label class="form-label">Паспорт</label>
                <input type="text" class="form-control" id="passport" value="${formData.passport || ''}" placeholder="АА123456">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveStudent(${isEdit ? studentId : null})">Зберегти</button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('studentModal')).show();
}

async function saveStudent(studentId) {
  const formData = {
    surname: document.getElementById('surname').value,
    name: document.getElementById('name').value,
    patronymic: document.getElementById('patronymic').value || null,
    course: parseInt(document.getElementById('course').value),
    faculty: document.getElementById('faculty').value,
    phone: document.getElementById('phone').value || null,
    passport: document.getElementById('passport').value || null
  };
  
  try {
    const url = studentId ? `${API_URL}/students/${studentId}` : `${API_URL}/students`;
    const response = await fetch(url, {
      method: studentId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showAlert(studentId ? 'Студента оновлено' : 'Студента додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('studentModal')).hide();
      loadStudents();
    } else {
      const error = await response.json();
      showAlert('Помилка: ' + error.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving student:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

function editStudent(studentId) {
  openStudentModal(studentId);
}

async function deleteStudent(studentId) {
  if (!confirm('Ви впевнені, що хочете видалити цього студента?')) return;
  
  try {
    const response = await fetch(`${API_URL}/students/${studentId}`, { method: 'DELETE' });
    if (response.ok) {
      showAlert('Студента видалено', 'success');
      loadStudents();
    } else {
      showAlert('Помилка видалення', 'danger');
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    showAlert('Помилка видалення', 'danger');
  }
}

let roomsData = [];

async function loadRooms() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/rooms`);
    roomsData = await response.json();
    displayRooms(roomsData);
  } catch (error) {
    console.error('Error loading rooms:', error);
    showAlert('Помилка завантаження кімнат', 'danger');
  }
  hideLoading();
}

function displayRooms(rooms) {
  document.getElementById('rooms-table').innerHTML = rooms.map(room => {
    const available = room.total_beds - room.occupied_beds;
    const statusClass = available > 0 ? 'success' : 'danger';
    const statusText = available > 0 ? 'Є вільні місця' : 'Зайнято';
    
    return `
      <tr>
        <td>${room.id}</td>
        <td>${room.room_number}</td>
        <td>${room.floor}</td>
        <td>${room.block || '-'}</td>
        <td>${room.total_beds}</td>
        <td>${room.occupied_beds}</td>
        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-warning btn-action" onclick="editRoom(${room.id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger btn-action" onclick="deleteRoom(${room.id})">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

function openRoomModal(roomId = null) {
  const isEdit = roomId !== null;
  let formData = { room_number: '', floor: '', block: '', total_beds: '' };
  
  if (isEdit) {
    const room = roomsData.find(r => r.id === roomId);
    if (room) formData = room;
  }
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="roomModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEdit ? 'Редагувати кімнату' : 'Додати кімнату'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="roomForm">
              <div class="mb-3">
                <label class="form-label">Номер кімнати *</label>
                <input type="text" class="form-control" id="room_number" value="${formData.room_number}" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Поверх *</label>
                <input type="number" class="form-control" id="floor" value="${formData.floor}" min="1" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Блок</label>
                <input type="text" class="form-control" id="block" value="${formData.block || ''}" maxlength="5">
              </div>
              <div class="mb-3">
                <label class="form-label">Кількість місць *</label>
                <input type="number" class="form-control" id="total_beds" value="${formData.total_beds}" min="1" required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveRoom(${isEdit ? roomId : null})">Зберегти</button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('roomModal')).show();
}

async function saveRoom(roomId) {
  const formData = {
    room_number: document.getElementById('room_number').value,
    floor: parseInt(document.getElementById('floor').value),
    block: document.getElementById('block').value || null,
    total_beds: parseInt(document.getElementById('total_beds').value)
  };
  
  try {
    const url = roomId ? `${API_URL}/rooms/${roomId}` : `${API_URL}/rooms`;
    const response = await fetch(url, {
      method: roomId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showAlert(roomId ? 'Кімнату оновлено' : 'Кімнату додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('roomModal')).hide();
      loadRooms();
    } else {
      const error = await response.json();
      showAlert('Помилка: ' + error.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving room:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

function editRoom(roomId) {
  openRoomModal(roomId);
}

async function deleteRoom(roomId) {
  if (!confirm('Ви впевнені, що хочете видалити цю кімнату?')) return;
  
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, { method: 'DELETE' });
    if (response.ok) {
      showAlert('Кімнату видалено', 'success');
      loadRooms();
    } else {
      showAlert('Помилка видалення', 'danger');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    showAlert('Помилка видалення', 'danger');
  }
}

let accommodationData = [];

async function loadAccommodation() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/accommodation`);
    accommodationData = await response.json();
    displayAccommodation(accommodationData);
  } catch (error) {
    console.error('Error loading accommodation:', error);
    showAlert('Помилка завантаження заселення', 'danger');
  }
  hideLoading();
}

function displayAccommodation(accommodations) {
  document.getElementById('accommodation-table').innerHTML = accommodations.map(acc => {
    const statusClass = acc.status === 'active' ? 'success' : 'secondary';
    const statusText = acc.status === 'active' ? 'Активний' : 'Виселений';
    
    return `
      <tr>
        <td>${acc.id}</td>
        <td>${acc.student_name}</td>
        <td>${acc.room_number}</td>
        <td>${acc.floor}</td>
        <td>${acc.block || '-'}</td>
        <td>${new Date(acc.date_in).toLocaleDateString('uk-UA')}</td>
        <td>${acc.date_out ? new Date(acc.date_out).toLocaleDateString('uk-UA') : '-'}</td>
        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
        <td>
          ${acc.status === 'active' ? `
            <button class="btn btn-sm btn-warning btn-action" onclick="checkoutStudent(${acc.id})">
              <i class="bi bi-box-arrow-right"></i> Виселити
            </button>
          ` : ''}
        </td>
      </tr>`;
  }).join('');
}

async function openAccommodationModal() {
  const studentsResponse = await fetch(`${API_URL}/students`);
  const students = await studentsResponse.json();
  
  const roomsResponse = await fetch(`${API_URL}/rooms/available`);
  const availableRooms = await roomsResponse.json();
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="accommodationModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Заселити студента</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="accommodationForm">
              <div class="mb-3">
                <label class="form-label">Студент *</label>
                <select class="form-select" id="student_id" required>
                  <option value="">Оберіть студента</option>
                  ${students.map(s => `<option value="${s.id}">${s.surname} ${s.name} (${s.course} курс)</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Кімната *</label>
                <select class="form-select" id="room_id" required>
                  <option value="">Оберіть кімнату</option>
                  ${availableRooms.map(r => `<option value="${r.id}">Кімната ${r.room_number} (${r.total_beds - r.occupied_beds} вільних місць)</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Дата заселення *</label>
                <input type="date" class="form-control" id="date_in" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveAccommodation()">Заселити</button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('accommodationModal')).show();
}

async function saveAccommodation() {
  const formData = {
    student_id: parseInt(document.getElementById('student_id').value),
    room_id: parseInt(document.getElementById('room_id').value),
    date_in: document.getElementById('date_in').value
  };
  
  try {
    const response = await fetch(`${API_URL}/accommodation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showAlert('Студента заселено', 'success');
      bootstrap.Modal.getInstance(document.getElementById('accommodationModal')).hide();
      loadAccommodation();
      loadStatistics();
    } else {
      const error = await response.json();
      showAlert('Помилка: ' + error.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving accommodation:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

async function checkoutStudent(accommodationId) {
  if (!confirm('Ви впевнені, що хочете виселити цього студента?')) return;
  
  try {
    const response = await fetch(`${API_URL}/accommodation/${accommodationId}/checkout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_out: new Date().toISOString().split('T')[0] })
    });
    
    if (response.ok) {
      showAlert('Студента виселено', 'success');
      loadAccommodation();
      loadStatistics();
    } else {
      showAlert('Помилка виселення', 'danger');
    }
  } catch (error) {
    console.error('Error checking out student:', error);
    showAlert('Помилка виселення', 'danger');
  }
}

let paymentsData = [];

async function loadPayments() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/payments`);
    paymentsData = await response.json();
    displayPayments(paymentsData);
  } catch (error) {
    console.error('Error loading payments:', error);
    showAlert('Помилка завантаження оплат', 'danger');
  }
  hideLoading();
}

function displayPayments(payments) {
  const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  
  document.getElementById('payments-table').innerHTML = payments.map(payment => {
    const statusClass = payment.status === 'paid' ? 'success' : 'danger';
    const statusText = payment.status === 'paid' ? 'Оплачено' : 'Не оплачено';
    
    return `
      <tr>
        <td>${payment.id}</td>
        <td>${payment.student_name}</td>
        <td>${months[payment.month - 1]}</td>
        <td>${payment.year}</td>
        <td>${payment.amount.toFixed(2)}</td>
        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('uk-UA') : '-'}</td>
        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
        <td>
          ${payment.status === 'unpaid' ? `
            <button class="btn btn-sm btn-success btn-action" onclick="markAsPaid(${payment.id})">
              <i class="bi bi-check-circle"></i> Оплачено
            </button>
          ` : ''}
        </td>
      </tr>`;
  }).join('');
}

async function openPaymentModal() {
  const studentsResponse = await fetch(`${API_URL}/students`);
  const students = await studentsResponse.json();
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="paymentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Додати оплату</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="paymentForm">
              <div class="mb-3">
                <label class="form-label">Студент *</label>
                <select class="form-select" id="payment_student_id" required>
                  <option value="">Оберіть студента</option>
                  ${students.map(s => `<option value="${s.id}">${s.surname} ${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Місяць *</label>
                <select class="form-select" id="payment_month" required>
                  ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                    `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Рік *</label>
                <input type="number" class="form-control" id="payment_year" value="${currentYear}" min="2020" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Сума (грн) *</label>
                <input type="number" class="form-control" id="payment_amount" value="1500.00" step="0.01" min="0" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Дата оплати</label>
                <input type="date" class="form-control" id="payment_date">
              </div>
              <div class="mb-3">
                <label class="form-label">Статус *</label>
                <select class="form-select" id="payment_status" required>
                  <option value="unpaid">Не оплачено</option>
                  <option value="paid">Оплачено</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="savePayment()">Зберегти</button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

async function savePayment() {
  const formData = {
    student_id: parseInt(document.getElementById('payment_student_id').value),
    month: parseInt(document.getElementById('payment_month').value),
    year: parseInt(document.getElementById('payment_year').value),
    amount: parseFloat(document.getElementById('payment_amount').value),
    payment_date: document.getElementById('payment_date').value || null,
    status: document.getElementById('payment_status').value
  };
  
  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      showAlert('Оплату додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      loadPayments();
      loadStatistics();
    } else {
      const error = await response.json();
      showAlert('Помилка: ' + error.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving payment:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

async function markAsPaid(paymentId) {
  const payment_date = new Date().toISOString().split('T')[0];
  
  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date, status: 'paid' })
    });
    
    if (response.ok) {
      showAlert('Оплату підтверджено', 'success');
      loadPayments();
      loadStatistics();
    } else {
      showAlert('Помилка оновлення оплати', 'danger');
    }
  } catch (error) {
    console.error('Error updating payment:', error);
    showAlert('Помилка оновлення', 'danger');
  }
}

async function loadDebtors() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/payments/debtors`);
    const debtors = await response.json();
    displayPayments(debtors);
    showAlert(`Знайдено боржників: ${debtors.length}`, 'warning');
  } catch (error) {
    console.error('Error loading debtors:', error);
    showAlert('Помилка завантаження боржників', 'danger');
  }
  hideLoading();
}

function sortTable(columnIndex, tableId) {
  const table = document.getElementById(tableId);
  const rows = Array.from(table.rows);
  const isAscending = table.dataset.sortOrder !== 'asc';
  
  rows.sort((a, b) => {
    const aValue = a.cells[columnIndex].textContent.trim();
    const bValue = b.cells[columnIndex].textContent.trim();
    
    const aNum = parseFloat(aValue);
    const bNum = parseFloat(bValue);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return isAscending ? aNum - bNum : bNum - aNum;
    }
    
    return isAscending 
      ? aValue.localeCompare(bValue, 'uk')
      : bValue.localeCompare(aValue, 'uk');
  });
  
  table.innerHTML = '';
  rows.forEach(row => table.appendChild(row));
  
  table.dataset.sortOrder = isAscending ? 'asc' : 'desc';
}

document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
});