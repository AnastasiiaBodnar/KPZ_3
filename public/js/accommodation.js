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