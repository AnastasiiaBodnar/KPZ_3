let roomsData = [];
let currentRoomsPage = 1;
let totalRoomsPages = 1;
const roomsPerPage = 50;

async function loadRooms(page = 1) {
  showLoading();
  try {
    currentRoomsPage = page;
    
    const params = new URLSearchParams({
      page: currentRoomsPage,
      limit: roomsPerPage
    });
    
    const response = await fetch(`${API_URL}/rooms?${params}`);
    const result = await response.json();
    
    roomsData = result.data;
    totalRoomsPages = result.pagination.totalPages;
    
    displayRooms(roomsData);
    displayPagination(result.pagination, 'rooms-pagination');
  } catch (error) {
    console.error('Error loading rooms:', error);
    showAlert('Помилка завантаження кімнат', 'danger');
  }
  hideLoading();
}

function displayRooms(rooms) {
  const tbody = document.getElementById('rooms-table');
  
  if (rooms.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Кімнат немає</td></tr>';
    return;
  }
  
  tbody.innerHTML = rooms.map(room => {
    const freeBeds = room.total_beds - room.occupied_beds;
    
    return `
      <tr>
        <td>${room.id}</td>
        <td><strong>${room.room_number}</strong></td>
        <td>${room.floor}</td>
        <td>${room.total_beds}</td>
        <td>${room.occupied_beds}</td>
        <td><strong>${freeBeds}</strong></td>
        <td><span class="badge bg-${freeBeds > 0 ? 'success' : 'danger'}">${freeBeds > 0 ? 'Вільна' : 'Заповнена'}</span></td>
        <td>
          ${room.occupied_beds > 0 ? `<button class="btn btn-sm btn-danger" onclick="clearRoom(${room.id})">Звільнити</button>` : ''}
          <button class="btn btn-sm btn-warning" onclick="editRoom(${room.id})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-secondary" onclick="deleteRoom(${room.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }).join('');
}

async function clearRoom(roomId) {
  if (!confirm('Виселити всіх студентів з кімнати?')) return;
  
  showLoading();
  
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Кімнату звільнено!', 'success');
      loadRooms(currentRoomsPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Помилка', 'danger');
  }
  
  hideLoading();
}

async function openRoomModal(roomId = null) {
  const isEdit = roomId !== null;
  let formData = { room_number: '', floor: '', total_beds: '' };
  
  if (isEdit) {
    const room = roomsData.find(r => r.id === roomId);
    if (room) formData = room;
  }
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="roomModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-${isEdit ? 'gear' : 'plus-circle'}"></i> 
              ${isEdit ? 'Редагувати кімнату' : 'Додати кімнату'}
            </h5>
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
                <input type="number" class="form-control" id="floor" value="${formData.floor}" min="1" max="20" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Кількість місць *</label>
                <input type="number" class="form-control" id="total_beds" value="${formData.total_beds}" min="1" max="10" required>
                <small class="text-muted">Максимум 10 місць в кімнаті</small>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="saveRoom(${isEdit ? roomId : null})">
              <i class="bi bi-check-circle"></i> Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('roomModal')).show();
}

async function saveRoom(roomId) {
  const form = document.getElementById('roomForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const formData = {
    room_number: document.getElementById('room_number').value.trim(),
    floor: parseInt(document.getElementById('floor').value),
    total_beds: parseInt(document.getElementById('total_beds').value)
  };
  
  try {
    const url = roomId ? `${API_URL}/rooms/${roomId}` : `${API_URL}/rooms`;
    const response = await fetch(url, {
      method: roomId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert(roomId ? 'Кімнату оновлено' : 'Кімнату додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('roomModal')).hide();
      loadRooms(currentRoomsPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
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
  const room = roomsData.find(r => r.id === roomId);
  const confirmText = room 
    ? `Ви впевнені, що хочете видалити кімнату ${room.room_number}?`
    : 'Ви впевнені, що хочете видалити цю кімнату?';
    
  if (!confirm(confirmText)) return;
  
  try {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, { method: 'DELETE' });
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Кімнату видалено', 'success');
      loadRooms(currentRoomsPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    showAlert('Помилка видалення', 'danger');
  }
}

function changePageRooms(page) {
  loadRooms(page);
}