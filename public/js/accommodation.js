let accommodationData = [];
let currentAccommodationPage = 1;
let totalAccommodationPages = 1;
const accommodationPerPage = 50;

async function loadAccommodation(page = 1, status = '') {
  showLoading();
  try {
    currentAccommodationPage = page;
    
    if (!status) {
      const filterElement = document.getElementById('filterAccommodationStatus');
      status = filterElement ? filterElement.value : 'active';
    }
    
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
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Записів про заселення не знайдено</td></tr>';
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
    
    const showActions = acc.status === 'active';
    
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
        <td>${new Date(acc.date_in).toLocaleDateString('uk-UA')}</td>
        <td>${acc.date_out ? new Date(acc.date_out).toLocaleDateString('uk-UA') : '-'}</td>
        <td>
          <span class="badge bg-${statusClass}">
            <i class="bi bi-${statusIcon}"></i> ${statusText}
          </span>
        </td>
        <td>
          ${showActions ? `
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
  const studentsResponse = await fetch(`${API_URL}/students/available`);
  const students = await studentsResponse.json();
  
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
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const MONTHLY_RATE = 500;
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="accommodationModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="bi bi-house-check"></i> Заселити студента
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="accommodationForm">
              <h6 class="border-bottom pb-2 mb-3"><i class="bi bi-1-circle"></i> Інформація про заселення</h6>
              
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
                      Кімната ${r.room_number} (${r.floor} поверх) - 
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
              
              <h6 class="border-bottom pb-2 mb-3 mt-4"><i class="bi bi-2-circle"></i> Створити нарахування за проживання</h6>
              
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="create_payment" checked 
                       onchange="togglePaymentFields()">
                <label class="form-check-label" for="create_payment">
                  <strong>Одразу створити нарахування за проживання</strong>
                  <br>
                  <small class="text-muted">Рекомендується для автоматичного обліку оплат</small>
                </label>
              </div>
              
              <div id="payment_fields">
                <div class="alert alert-info">
                  <i class="bi bi-info-circle"></i> 
                  <strong>Тариф:</strong> ${MONTHLY_RATE} грн за місяць проживання
                </div>
                
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Місяць (початок) *</label>
                    <select class="form-select" id="payment_month_from" onchange="updateAccommodationAmount()">
                      ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                        `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                      ).join('')}
                    </select>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Місяць (кінець) *</label>
                    <select class="form-select" id="payment_month_to" onchange="updateAccommodationAmount()">
                      ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                        `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                      ).join('')}
                    </select>
                  </div>
                </div>
                
                <div class="mb-3">
                  <label class="form-label">Рік *</label>
                  <input type="number" class="form-control" id="payment_year" value="${currentYear}" min="2020" max="2100">
                </div>
                
                <div class="mb-3">
                  <div id="accommodation_amount_info" class="alert alert-success">
                    <strong> Сума до сплати:</strong> <span id="accommodation_calculated_amount">${MONTHLY_RATE} грн</span> (1 місяць)
                  </div>
                </div>
                
                <div class="form-check mb-3">
                  <input class="form-check-input" type="checkbox" id="mark_as_paid">
                  <label class="form-check-label" for="mark_as_paid">
                    Студент одразу оплатив (позначити як "оплачено")
                  </label>
                </div>
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
  
  const modal = new bootstrap.Modal(document.getElementById('accommodationModal'));
  modal.show();
  
  window.togglePaymentFields = function() {
    const checked = document.getElementById('create_payment').checked;
    const fields = document.getElementById('payment_fields');
    fields.style.display = checked ? 'block' : 'none';
  };
  
  window.updateAccommodationAmount = function() {
    const monthFrom = parseInt(document.getElementById('payment_month_from').value);
    const monthTo = parseInt(document.getElementById('payment_month_to').value);
    
    if (monthTo < monthFrom) {
      document.getElementById('payment_month_to').value = monthFrom;
      window.updateAccommodationAmount();
      return;
    }
    
    const monthCount = monthTo - monthFrom + 1;
    const totalAmount = monthCount * MONTHLY_RATE;
    
    const amountInfo = document.getElementById('accommodation_calculated_amount');
    amountInfo.textContent = totalAmount + ' грн (' + monthCount + ' ' + (monthCount === 1 ? 'місяць' : monthCount < 5 ? 'місяці' : 'місяців') + ')';
  };
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
    date_in: document.getElementById('date_in').value,
    create_payment: document.getElementById('create_payment').checked
  };
  
  if (formData.create_payment) {
    const monthFrom = parseInt(document.getElementById('payment_month_from').value);
    const monthTo = parseInt(document.getElementById('payment_month_to').value);
    
    if (monthTo < monthFrom) {
      showAlert('Кінцевий місяць не може бути раніше початкового', 'warning');
      return;
    }
    
    formData.payment = {
      month_from: monthFrom,
      month_to: monthTo,
      year: parseInt(document.getElementById('payment_year').value),
      mark_as_paid: document.getElementById('mark_as_paid').checked
    };
  }
  
  try {
    const response = await fetch(`${API_URL}/accommodation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      let message = 'Студента заселено';
      if (formData.create_payment) {
        message += formData.payment.mark_as_paid 
          ? ' та оплату підтверджено' 
          : ' та створено нарахування';
      }
      showAlert(message, 'success');
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

async function openTransferModal(accommodationId) {
  const accommodation = accommodationData.find(a => a.id === accommodationId);
  
  if (!accommodation) {
    showAlert('Запис про заселення не знайдено', 'danger');
    return;
  }
  
  const roomsResponse = await fetch(`${API_URL}/rooms/available`);
  const availableRooms = await roomsResponse.json();
  
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
              <strong>Поточна кімната:</strong> ${accommodation.room_number} (${accommodation.floor} поверх)
            </div>
            
            <form id="transferForm">
              <div class="mb-3">
                <label class="form-label">Нова кімната *</label>
                <select class="form-select" id="new_room_id" required>
                  <option value="">Оберіть нову кімнату</option>
                  ${otherRooms.map(r => {
                    const freeBeds = r.total_beds - r.occupied_beds;
                    return `<option value="${r.id}">
                      Кімната ${r.room_number} (${r.floor} поверх) - 
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
  const status = document.getElementById('filterAccommodationStatus')?.value || '';
  loadAccommodation(1, status);
}

function resetAccommodationFilters() {
  const filterSelect = document.getElementById('filterAccommodationStatus');
  if (filterSelect) {
    filterSelect.value = 'active';
  }
  loadAccommodation(1, 'active');
}