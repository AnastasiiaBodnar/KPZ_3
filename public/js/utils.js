const API_URL = 'http://localhost:3000/api';

let currentSort = {
  students: { field: 'id', order: 'ASC' },
  rooms: { field: 'id', order: 'ASC' },
  accommodation: { field: 'id', order: 'ASC' },
  payments: { field: 'id', order: 'ASC' }
};

function showLoading() {
  document.getElementById('loadingSpinner').classList.remove('d-none');
}

function hideLoading() {
  document.getElementById('loadingSpinner').classList.add('d-none');
}

function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 3000);
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
    case 'analytics':
      loadTopDebtors();
      loadFloorsAnalytics();
      loadStudentSelector();
      break;
      case 'reports':
        loadAllCharts();
      break;
  }
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

document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
});