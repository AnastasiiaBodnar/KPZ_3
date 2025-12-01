let studentsData = [];
let searchMatches = [];
let currentSearchIndex = -1;
let currentPage = 1;
let totalPages = 1;
const studentsPerPage = 50;

async function loadStudents(sortBy = null, sortOrder = null, page = 1) {
  showLoading();
  try {
    if (sortBy) {
      currentSort.students.field = sortBy;
      currentSort.students.order = sortOrder || 'ASC';
    }
    
    currentPage = page;
    
    const search = document.getElementById('searchStudent')?.value || '';
    const course = document.getElementById('filterCourse')?.value || '';
    const faculty = document.getElementById('filterFaculty')?.value || '';
    
    const params = new URLSearchParams({
      sortBy: currentSort.students.field,
      sortOrder: currentSort.students.order,
      page: currentPage,
      limit: studentsPerPage,
      search: search,
      course: course,
      faculty: faculty
    });
    
    const url = `${API_URL}/students?${params}`;
    const response = await fetch(url);
    const result = await response.json();
    
    studentsData = result.data;
    totalPages = result.pagination.totalPages;
    
    displayStudents(studentsData);
    displayPagination(result.pagination, 'students-pagination');
    
  } catch (error) {
    console.error('Error loading students:', error);
    showAlert('Помилка завантаження студентів', 'danger');
  }
  hideLoading();
}

function sortStudents(field) {
  if (currentSort.students.field === field) {
    currentSort.students.order = currentSort.students.order === 'ASC' ? 'DESC' : 'ASC';
  } else {
    currentSort.students.field = field;
    currentSort.students.order = 'ASC';
  }
  loadStudents();
}

function displayStudents(students) {
  const searchTerm = document.getElementById('searchStudent')?.value.toLowerCase() || '';
  
  const tbody = document.getElementById('students-table');
  
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">Студентів не знайдено</td></tr>';
    return;
  }
  
  tbody.innerHTML = students.map((student, index) => {
    const matchesSearch = searchTerm && (
      student.surname.toLowerCase().includes(searchTerm) || 
      student.name.toLowerCase().includes(searchTerm)
    );
    
    const isCurrentResult = matchesSearch && currentSearchIndex >= 0 && 
                           searchMatches[currentSearchIndex] === index;
    const rowClass = isCurrentResult ? 'table-active' : (matchesSearch ? 'table-warning' : '');
    const rowId = matchesSearch ? `search-match-${index}` : '';
    
    const debtBadge = student.total_debt > 0 
      ? `<span class="badge bg-danger ms-2" title="Борг">${parseFloat(student.total_debt).toFixed(0)} грн</span>` 
      : '';
    
    const accommodationBadge = student.is_accommodated
      ? `<span class="badge bg-success" title="Заселений">Кімната ${student.room_number}</span>`
      : '<span class="badge bg-secondary" title="Не заселений">Не заселений</span>';
    
    return `
    <tr class="${rowClass}" id="${rowId}">
      <td>${student.id}</td>
      <td>${highlightText(student.surname, searchTerm)}${debtBadge}</td>
      <td>${highlightText(student.name, searchTerm)}</td>
      <td>${student.patronymic || '-'}</td>
      <td>${student.course}</td>
      <td>${student.faculty}</td>
      <td>${student.phone || '-'}</td>
      <td>${student.passport || '-'}</td>
      <td>${accommodationBadge}</td>
      <td>
        <button class="btn btn-sm btn-info btn-action" onclick="viewStudentDetails(${student.id})" title="Деталі">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning btn-action" onclick="editStudent(${student.id})" title="Редагувати">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger btn-action" onclick="deleteStudent(${student.id})" title="Видалити">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `}).join('');
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function searchStudents() {
  currentPage = 1;
  loadStudents(null, null, 1);
}

function navigateSearch(direction) {
  if (searchMatches.length === 0) return;

  currentSearchIndex += direction;

  if (currentSearchIndex >= searchMatches.length) {
    currentSearchIndex = 0;
  } else if (currentSearchIndex < 0) {
    currentSearchIndex = searchMatches.length - 1;
  }

  updateSearchCounter(currentSearchIndex + 1, searchMatches.length);
  displayStudents(studentsData);
  scrollToSearchResult(currentSearchIndex);
}

function scrollToSearchResult(index) {
  const element = document.getElementById(`search-match-${searchMatches[index]}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateSearchCounter(current, total) {
  const counter = document.getElementById('searchCounter');
  if (!counter) return;
  
  if (total === 0) {
    counter.textContent = '';
  } else {
    counter.textContent = `Результат ${current} з ${total}`;
  }
}

function filterStudents() {
  currentPage = 1;
  loadStudents(null, null, 1);
}

function resetFilters() {
  const searchInput = document.getElementById('searchStudent');
  const courseFilter = document.getElementById('filterCourse');
  const facultyFilter = document.getElementById('filterFaculty');
  const prevBtn = document.getElementById('prevSearchBtn');
  const nextBtn = document.getElementById('nextSearchBtn');
  
  if (searchInput) searchInput.value = '';
  if (courseFilter) courseFilter.value = '';
  if (facultyFilter) facultyFilter.value = '';
  
  searchMatches = [];
  currentSearchIndex = -1;
  updateSearchCounter(0, 0);
  
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  
  currentPage = 1;
  loadStudents(null, null, 1);
}

async function viewStudentDetails(studentId) {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/students/${studentId}`);
    const student = await response.json();
    
    document.getElementById('modals-container').innerHTML = `
      <div class="modal fade" id="studentDetailsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-person-circle"></i> ${student.surname} ${student.name} ${student.patronymic || ''}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row">
                <div class="col-md-6">
                  <h6 class="border-bottom pb-2">Особиста інформація</h6>
                  <p><strong>ID:</strong> ${student.id}</p>
                  <p><strong>ПІБ:</strong> ${student.surname} ${student.name} ${student.patronymic || ''}</p>
                  <p><strong>Курс:</strong> ${student.course}</p>
                  <p><strong>Факультет:</strong> ${student.faculty}</p>
                  <p><strong>Телефон:</strong> ${student.phone || '-'}</p>
                  <p><strong>Паспорт:</strong> ${student.passport || '-'}</p>
                </div>
                <div class="col-md-6">
                  <h6 class="border-bottom pb-2">Заселення та оплати</h6>
                  ${student.room_number ? `
                    <p><strong>Кімната:</strong> ${student.room_number}</p>
                    <p><strong>Поверх:</strong> ${student.floor}</p>
                    <p><strong>Дата заселення:</strong> ${new Date(student.accommodation_date).toLocaleDateString('uk-UA')}</p>
                  ` : '<p class="text-muted">Студент не заселений</p>'}
                  
                  ${student.total_debt > 0 ? `
                    <div class="alert alert-danger mt-3">
                      <strong>Борг:</strong> ${parseFloat(student.total_debt).toFixed(2)} грн<br>
                      <strong>Неоплачених періодів:</strong> ${student.unpaid_months}
                    </div>
                  ` : '<div class="alert alert-success mt-3">Немає боргів</div>'}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрити</button>
              <button type="button" class="btn btn-warning" onclick="bootstrap.Modal.getInstance(document.getElementById('studentDetailsModal')).hide(); editStudent(${studentId});">
                <i class="bi bi-pencil"></i> Редагувати
              </button>
            </div>
          </div>
        </div>
      </div>`;
    
    new bootstrap.Modal(document.getElementById('studentDetailsModal')).show();
  } catch (error) {
    console.error('Error loading student details:', error);
    showAlert('Помилка завантаження деталей студента', 'danger');
  }
  hideLoading();
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
            <h5 class="modal-title">
              <i class="bi bi-person-${isEdit ? 'gear' : 'plus'}"></i> 
              ${isEdit ? 'Редагувати студента' : 'Додати студента'}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="studentForm">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Прізвище *</label>
                  <input type="text" class="form-control" id="surname" value="${formData.surname}" required>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Ім'я *</label>
                  <input type="text" class="form-control" id="name" value="${formData.name}" required>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">По батькові</label>
                <input type="text" class="form-control" id="patronymic" value="${formData.patronymic || ''}">
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Курс *</label>
                  <select class="form-select" id="course" required>
                    <option value="">Оберіть курс</option>
                    ${[1,2,3,4].map(c => `<option value="${c}" ${formData.course == c ? 'selected' : ''}>${c} курс</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Факультет *</label>
                  <select class="form-select" id="faculty" required>
                    <option value="">Оберіть факультет</option>
                    <option value="ПІ" ${formData.faculty === 'ПІ' ? 'selected' : ''}>ПІ - Програмна інженерія</option>
                    <option value="КІ" ${formData.faculty === 'КІ' ? 'selected' : ''}>КІ - Комп'ютерна інженерія</option>
                    <option value="АТ" ${formData.faculty === 'АТ' ? 'selected' : ''}>АТ - Автомобільний транспорт</option>
                    <option value="ЕК" ${formData.faculty === 'ЕК' ? 'selected' : ''}>ЕК - Економіка</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Телефон</label>
                <input type="tel" class="form-control" id="phone" value="${formData.phone || ''}" 
                       placeholder="+380501234567" pattern="\\+380\\d{9}" 
                       title="Формат: +380XXXXXXXXX (9 цифр після +380)">
                <small class="text-muted">Формат: +380501234567</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Паспорт</label>
                <input type="text" class="form-control" id="passport" value="${formData.passport || ''}" 
                       placeholder="АА123456" pattern="[A-ZА-ЯІЇЄҐ]{2}\\d{6}" maxlength="8" 
                       style="text-transform: uppercase;" 
                       title="Формат: 2 великі літери + 6 цифр"
                       oninput="this.value = this.value.toUpperCase()">
                <small class="text-muted">Формат: АА123456 (2 літери + 6 цифр)</small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveStudent(${isEdit ? studentId : null})">
              <i class="bi bi-check-circle"></i> Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('studentModal')).show();
}

async function saveStudent(studentId) {
  const form = document.getElementById('studentForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const formData = {
    surname: document.getElementById('surname').value.trim(),
    name: document.getElementById('name').value.trim(),
    patronymic: document.getElementById('patronymic').value.trim() || null,
    course: parseInt(document.getElementById('course').value),
    faculty: document.getElementById('faculty').value,
    phone: document.getElementById('phone').value.trim() || null,
    passport: document.getElementById('passport').value.trim() || null
  };
  
  try {
    const url = studentId ? `${API_URL}/students/${studentId}` : `${API_URL}/students`;
    const response = await fetch(url, {
      method: studentId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert(studentId ? 'Студента оновлено' : 'Студента додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('studentModal')).hide();
      loadStudents(null, null, currentPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
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
  const student = studentsData.find(s => s.id === studentId);
  const confirmText = student 
    ? `Ви впевнені, що хочете видалити студента ${student.surname} ${student.name}?`
    : 'Ви впевнені, що хочете видалити цього студента?';
    
  if (!confirm(confirmText)) return;
  
  try {
    const response = await fetch(`${API_URL}/students/${studentId}`, { method: 'DELETE' });
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Студента видалено', 'success');
      loadStudents(null, null, currentPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    showAlert('Помилка видалення', 'danger');
  }
}