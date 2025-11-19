let studentsData = [];
let searchMatches = [];
let currentSearchIndex = -1;

async function loadStudents(sortBy = null, sortOrder = null) {
  showLoading();
  try {
    if (sortBy) {
      currentSort.students.field = sortBy;
      currentSort.students.order = sortOrder || 'ASC';
    }
    
    const url = `${API_URL}/students?sortBy=${currentSort.students.field}&sortOrder=${currentSort.students.order}`;
    const response = await fetch(url);
    studentsData = await response.json();
    displayStudents(studentsData);
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
  const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
  
  document.getElementById('students-table').innerHTML = students.map((student, index) => {
    const matchesSearch = searchTerm && (
      student.surname.toLowerCase().includes(searchTerm) || 
      student.name.toLowerCase().includes(searchTerm)
    );
    
    const isCurrentResult = matchesSearch && currentSearchIndex >= 0 && 
                           searchMatches[currentSearchIndex] === index;
    const rowClass = isCurrentResult ? 'table-active' : (matchesSearch ? 'table-warning' : '');
    const rowId = matchesSearch ? `search-match-${index}` : '';
    
    return `
    <tr class="${rowClass}" id="${rowId}">
      <td>${student.id}</td>
      <td>${highlightText(student.surname, searchTerm)}</td>
      <td>${highlightText(student.name, searchTerm)}</td>
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
  `}).join('');
}

function highlightText(text, searchTerm) {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function searchStudents() {
  const searchTerm = document.getElementById('searchStudent').value.toLowerCase();
  
  if (!searchTerm) {
    displayStudents(studentsData);
    updateSearchCounter(0, 0);
    document.getElementById('prevSearchBtn').disabled = true;
    document.getElementById('nextSearchBtn').disabled = true;
    return;
  }

  searchMatches = studentsData
    .map((student, index) => ({
      student,
      index,
      matches: student.surname.toLowerCase().includes(searchTerm) || 
               student.name.toLowerCase().includes(searchTerm)
    }))
    .filter(item => item.matches)
    .map(item => item.index);
  
  currentSearchIndex = searchMatches.length > 0 ? 0 : -1;

  displayStudents(studentsData);

  updateSearchCounter(searchMatches.length > 0 ? 1 : 0, searchMatches.length);
  document.getElementById('prevSearchBtn').disabled = searchMatches.length === 0;
  document.getElementById('nextSearchBtn').disabled = searchMatches.length === 0;

  if (searchMatches.length > 0) {
    scrollToSearchResult(0);
  }
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
  if (total === 0) {
    counter.textContent = '';
  } else {
    counter.textContent = `Результат ${current} з ${total}`;
  }
}

function filterStudents() {
  const courseFilter = document.getElementById('filterCourse').value;
  const facultyFilter = document.getElementById('filterFaculty').value;
  
  const filtered = studentsData.filter(student => {
    const matchesCourse = !courseFilter || student.course == courseFilter;
    const matchesFaculty = !facultyFilter || student.faculty === facultyFilter;
    return matchesCourse && matchesFaculty;
  });
  
  displayStudents(filtered);
  
  document.getElementById('searchStudent').value = '';
  searchMatches = [];
  currentSearchIndex = -1;
  updateSearchCounter(0, 0);
  document.getElementById('prevSearchBtn').disabled = true;
  document.getElementById('nextSearchBtn').disabled = true;
}

function resetFilters() {
  document.getElementById('searchStudent').value = '';
  document.getElementById('filterCourse').value = '';
  document.getElementById('filterFaculty').value = '';
  searchMatches = [];
  currentSearchIndex = -1;
  updateSearchCounter(0, 0);
  document.getElementById('prevSearchBtn').disabled = true;
  document.getElementById('nextSearchBtn').disabled = true;
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
                <select class="form-select" id="faculty" required>
                  <option value="">Оберіть факультет</option>
                  <option value="ПІ" ${formData.faculty === 'ПІ' ? 'selected' : ''}>ПІ - Програмна інженерія</option>
                  <option value="КІ" ${formData.faculty === 'КІ' ? 'selected' : ''}>КІ - Комп'ютерна інженерія</option>
                  <option value="АТ" ${formData.faculty === 'АТ' ? 'selected' : ''}>АТ - Автоматизація</option>
                  <option value="ЕК" ${formData.faculty === 'ЕК' ? 'selected' : ''}>ЕК - Економіка</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Телефон</label>
                <input type="tel" class="form-control" id="phone" value="${formData.phone || ''}" placeholder="+380501234567" pattern="\\+380\\d{9}" title="Формат: +380XXXXXXXXX (9 цифр після +380)">
                <small class="text-muted">Формат: +380501234567</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Паспорт</label>
                <input type="text" class="form-control" id="passport" value="${formData.passport || ''}" placeholder="АА123456" pattern="[A-ZА-ЯІЇЄҐ]{2}\\d{6}" maxlength="8" style="text-transform: uppercase;" title="Формат: 2 великі літери + 6 цифр">
                <small class="text-muted">Формат: АА123456 (2 літери + 6 цифр)</small>
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