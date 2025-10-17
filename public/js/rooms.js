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
    const availableBeds = room.total_beds - room.occupied_beds;
    const statusClass = availableBeds > 0 ? 'success' : 'danger';
    const statusText = availableBeds > 0 ? 'Доступна' : 'Зайнята';
    
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
  let formData = { 
    room_number: '', 
    floor: '', 
    block: '', 
    total_beds: 2 
  };
  
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
                <input type="number" class="form-control" id="floor" value="${formData.floor}" min="1" max="20" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Блок</label>
                <input type="text" class="form-control" id="block" value="${formData.block || ''}" placeholder="A, B, C...">
              </div>
              <div class="mb-3">
                <label class="form-label">Всього місць *</label>
                <input type="number" class="form-control" id="total_beds" value="${formData.total_beds}" min="1" max="10" required>
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
      loadStatistics();
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
      loadStatistics();
    } else {
      showAlert('Помилка видалення', 'danger');
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    showAlert('Помилка видалення', 'danger');
  }
}