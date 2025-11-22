let accommodationData = [];
let currentAccommodationPage = 1;
let totalAccommodationPages = 1;
const accommodationPerPage = 50;

async function loadAccommodation(page = 1, status = 'active') {
  showLoading();
  try {
    currentAccommodationPage = page;
    
    const params = new URLSearchParams({
      page: currentAccommodationPage,
      limit: accommodationPerPage,
      status: status
    });
    
    const response = await fetch(`${API_URL}/accommodation?${params}`);
    const result = await response.json();
    
    accommodationData = result.data;
    totalAccommodationPages = result.pagination.totalPages;
    
    displayAccommodation(accommodationData);
    displayPagination(result.pagination, 'accommodation-pagination');
  } catch (error) {
    console.error('Error loading accommodation:', error);
    showAlert('Помилка завантаження заселення', 'danger');
  }
  hideLoading();
}

function displayAccommodation(accommodations) {
  const tbody = document.getElementById('accommodation-table');
  
  if (accommodations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Записів про заселення не знайдено</td></tr>';
    return;
  }
  
  tbody.innerHTML = accommodations.map(acc => {
    let statusClass = 'secondary';
    let statusText = 'Невідомий';
    let statusIcon = 'question-circle';
    
    if (acc.status === 'active') {
      statusClass = 'success';
      statusText = 'Активний';
      statusIcon = 'check-circle';
    } else if (acc.status === 'moved_out') {
      statusClass = 'secondary';
      statusText = 'Виселений';
      statusIcon = 'box-arrow-right';
    } else if (acc.status === 'transferred') {
      statusClass = 'info';
      statusText = 'Переселений';
      statusIcon = 'arrow-left-right';
    }
    
    return `
      <tr class="${acc.status === 'active' ? '' : 'table-light'}">
        <td>${acc.id}</td>
        <td>
          <strong>${acc.student_name}</strong>
          <br>
          <small class="text-muted">${acc.course} курс, ${acc.faculty}</small>
        </td>
        <td><strong>${acc.room_number}</strong></td>
        <td>${acc.floor}</td>
        <td>${acc.block || '-'}</td>
        <td>${new Date(acc.date_in).toLocaleDateString('uk-UA')}</td>
        <td>${acc.date_out ? new Date(acc.date_out).toLocaleDateString('uk-UA') : '-'}</td>
        <td>
          <span class="badge bg-${statusClass}">
            <i class="bi bi-${statusIcon}"></i> ${statusText}
          </span>
        </td>
        <td>
          ${acc.status === 'active' ? `
            <button class="btn btn-sm btn-primary btn-action" onclick="openTransferModal(${acc.id})" title="Переселити">
              <i class="bi bi-arrow-left-right"></i> Переселити
            </button>
            <button class="btn btn-sm btn-warning btn-action" onclick="checkoutStudent(${acc.id})" title="Виселити">
              <i class="bi bi-box-arrow-right"></i> Виселити
            </button>
          ` : `
            <span class="text-muted">-</span>
          `}
        </td>
      </tr>`;
  }).join('');
}

async function openAccommodationModal() {
  // Отримуємо студентів які не заселені
  const studentsResponse = await fetch(`${API_URL}/students/available`);
  const students = await studentsResponse.json();
  
  // Отримуємо кімнати з вільними місцями
  const roomsResponse = await fetch(`${API_URL}/rooms/available`);
  const availableRooms = await roomsResponse.json();
  
  if (students.length === 0) {
    showAlert('Всі студенти вже заселені', 'info');
    return;
  }
  
  if (availableRooms.length === 0) {
    showAlert('Немає вільних кімнат', 'warning');
    return;
  }
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="accommodationModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="bi bi-house-check"></i> Заселити студента
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="accommodationForm">
              <div class="mb-3">
                <label class="form-label">Студент *</label>
                <select class="form-select" id="student_id" required>
                  <option value="">Оберіть студента</option>
                  ${students.map(s => 
                    `<option value="${s.id}">${s.surname} ${s.name} (${s.course} курс, ${s.faculty})</option>`
                  ).join('')}
                </select>
                <small class="text-muted">Показані тільки студенти, які ще не заселені</small>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Кімната *</label>
                <select class="form-select" id="room_id" required>
                  <option value="">Оберіть кімнату</option>
                  ${availableRooms.map(r => {
                    const freeBeds = r.total_beds - r.occupied_beds;
                    return `<option value="${r.id}">
                      Кімната ${r.room_number} (${r.floor} поверх${r.block ? ', блок ' + r.block : ''}) - 
                      ${freeBeds} ${freeBeds === 1 ? 'вільне місце' : 'вільних місць'}
                    </option>`;
                  }).join('')}
                </select>
                <small class="text-muted">Показані тільки кімнати з вільними місцями</small>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Дата заселення *</label>
                <input type="date" class="form-control" id="date_in" 
                       value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-success" onclick="saveAccommodation()">
              <i class="bi bi-check-circle"></i> Заселити
            </button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('accommodationModal')).show();
}

async function saveAccommodation() {
  const form = document.getElementById('accommodationForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
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
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Студента заселено', 'success');
      bootstrap.Modal.getInstance(document.getElementById('accommodationModal')).hide();
      loadAccommodation(currentAccommodationPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving accommodation:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

// НОВА ФУНКЦІЯ: Переселення студента
async function openTransferModal(accommodationId) {
  const accommodation = accommodationData.find(a => a.id === accommodationId);
  
  if (!accommodation) {
    showAlert('Запис про заселення не знайдено', 'danger');
    return;
  }
  
  // Отримуємо кімнати з вільними місцями (крім поточної)
  const roomsResponse = await fetch(`${API_URL}/rooms/available`);
  const availableRooms = await roomsResponse.json();
  
  // Фільтруємо поточну кімнату
  const otherRooms = availableRooms.filter(r => r.id !== accommodation.room_id);
  
  if (otherRooms.length === 0) {
    showAlert('Немає інших вільних кімнат для переселення', 'warning');
    return;
  }
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="transferModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="bi bi-arrow-left-right"></i> Переселити студента
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <strong>Студент:</strong> ${accommodation.student_name}<br>
              <strong>Поточна кімната:</strong> ${accommodation.room_number} (${accommodation.floor} поверх${accommodation.block ? ', блок ' + accommodation.block : ''})
            </div>
            
            <form id="transferForm">
              <div class="mb-3">
                <label class="form-label">Нова кімната *</label>
                <select class="form-select" id="new_room_id" required>
                  <option value="">Оберіть нову кімнату</option>
                  ${otherRooms.map(r => {
                    const freeBeds = r.total_beds - r.occupied_beds;
                    return `<option value="${r.id}">
                      Кімната ${r.room_number} (${r.floor} поверх${r.block ? ', блок ' + r.block : ''}) - 
                      ${freeBeds} ${freeBeds === 1 ? 'вільне місце' : 'вільних місць'}
                    </option>`;
                  }).join('')}
                </select>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Дата переселення *</label>
                <input type="date" class="form-control" id="transfer_date" 
                       value="${new Date().toISOString().split('T')[0]}" required>
              </div>
              
              <div class="alert alert-warning">
                <i class="bi bi-info-circle"></i> 
                Поточне заселення буде автоматично закрито, а студента буде переселено в нову кімнату
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveTransfer(${accommodationId})">
              <i class="bi bi-arrow-left-right"></i> Переселити
            </button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('transferModal')).show();
}

async function saveTransfer(accommodationId) {
  const form = document.getElementById('transferForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const formData = {
    new_room_id: parseInt(document.getElementById('new_room_id').value),
    transfer_date: document.getElementById('transfer_date').value
  };
  
  if (!confirm('Ви впевнені, що хочете переселити студента?')) return;
  
  try {
    const response = await fetch(`${API_URL}/accommodation/${accommodationId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Студента успішно переселено', 'success');
      bootstrap.Modal.getInstance(document.getElementById('transferModal')).hide();
      loadAccommodation(currentAccommodationPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error transferring student:', error);
    showAlert('Помилка переселення', 'danger');
  }
}

async function checkoutStudent(accommodationId) {
  const accommodation = accommodationData.find(a => a.id === accommodationId);
  const confirmText = accommodation 
    ? `Ви впевнені, що хочете виселити ${accommodation.student_name} з кімнати ${accommodation.room_number}?`
    : 'Ви впевнені, що хочете виселити цього студента?';
    
  if (!confirm(confirmText)) return;
  
  try {
    const response = await fetch(`${API_URL}/accommodation/${accommodationId}/checkout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_out: new Date().toISOString().split('T')[0] })
    });
    
    if (response.ok) {
      showAlert('Студента виселено', 'success');
      loadAccommodation(currentAccommodationPage);
      loadStatistics();
    } else {
      const data = await response.json();
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error checking out student:', error);
    showAlert('Помилка виселення', 'danger');
  }
}

function filterAccommodation() {
  const status = document.getElementById('filterAccommodationStatus')?.value || 'active';
  loadAccommodation(1, status);
}

function resetAccommodationFilters() {
  const filterSelect = document.getElementById('filterAccommodationStatus');
  if (filterSelect) {
    filterSelect.value = 'active';
  }
  loadAccommodation(1, 'active');
}