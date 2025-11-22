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
  alertDiv.style.minWidth = '300px';
  alertDiv.innerHTML = `
    <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'x-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 4000);
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
      loadStudents(null, null, 1);
      break;
    case 'rooms':
      loadRooms(1);
      break;
    case 'accommodation':
      loadAccommodation(1);
      break;
    case 'payments':
      loadPayments(1);
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
    
    const occupancyPercent = stats.totalBeds > 0 
      ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) 
      : 0;
    
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
            <div class="progress mt-2" style="height: 20px;">
              <div class="progress-bar bg-info" role="progressbar" 
                   style="width: ${occupancyPercent}%" 
                   aria-valuenow="${occupancyPercent}" aria-valuemin="0" aria-valuemax="100">
                ${occupancyPercent}%
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card stat-card border-warning">
          <div class="card-body">
            <h6 class="text-muted">Боржників</h6>
            <h2 class="text-warning"><i class="bi bi-exclamation-triangle"></i> ${stats.unpaidPayments}</h2>
            ${stats.unpaidPayments > 0 
              ? '<small class="text-danger">Потребує уваги!</small>' 
              : '<small class="text-success">Всі оплатили!</small>'}
          </div>
        </div>
      </div>`;
  } catch (error) {
    console.error('Error loading statistics:', error);
    showAlert('Помилка завантаження статистики', 'danger');
  }
  hideLoading();
}

// Функція для відображення пагінації
function displayPagination(pagination, containerId) {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.warn(`Pagination container ${containerId} not found`);
    return;
  }
  
  const { page, totalPages } = pagination;
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let paginationHTML = '<nav><ul class="pagination justify-content-center mb-0">';
  
  // Кнопка "Перша"
  paginationHTML += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(1); return false;">
        <i class="bi bi-chevron-double-left"></i>
      </a>
    </li>
  `;
  
  // Кнопка "Попередня"
  paginationHTML += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${page - 1}); return false;">
        <i class="bi bi-chevron-left"></i>
      </a>
    </li>
  `;
  
  // Номери сторінок
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, page + 2);
  
  // Показуємо першу сторінку якщо не в діапазоні
  if (startPage > 1) {
    paginationHTML += `
      <li class="page-item">
        <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(1); return false;">1</a>
      </li>
    `;
    if (startPage > 2) {
      paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
      <li class="page-item ${i === page ? 'active' : ''}">
        <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${i}); return false;">${i}</a>
      </li>
    `;
  }
  
  // Показуємо останню сторінку якщо не в діапазоні
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
    paginationHTML += `
      <li class="page-item">
        <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${totalPages}); return false;">${totalPages}</a>
      </li>
    `;
  }
  
  // Кнопка "Наступна"
  paginationHTML += `
    <li class="page-item ${page === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${page + 1}); return false;">
        <i class="bi bi-chevron-right"></i>
      </a>
    </li>
  `;
  
  // Кнопка "Остання"
  paginationHTML += `
    <li class="page-item ${page === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${totalPages}); return false;">
        <i class="bi bi-chevron-double-right"></i>
      </a>
    </li>
  `;
  
  paginationHTML += '</ul></nav>';
  
  // Додаємо інформацію про сторінку
  paginationHTML += `
    <div class="text-center mt-2 text-muted">
      <small>Сторінка ${page} з ${totalPages}</small>
    </div>
  `;
  
  container.innerHTML = paginationHTML;
}

// Допоміжна функція для визначення entity за ID контейнера
function getEntityName(containerId) {
  if (containerId.includes('students')) return 'Students';
  if (containerId.includes('rooms')) return 'Rooms';
  if (containerId.includes('accommodation')) return 'Accommodation';
  if (containerId.includes('payments')) return 'Payments';
  return '';
}

// Функції зміни сторінки для кожної сутності
function changePageStudents(page) {
  loadStudents(null, null, page);
}

function changePageRooms(page) {
  loadRooms(page);
}

function changePageAccommodation(page) {
  loadAccommodation(page);
}

function changePagePayments(page) {
  loadPayments(page);
}

document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
  
  // Підтримка Enter/Shift+Enter для пошуку студентів
  const searchInput = document.getElementById('searchStudent');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        navigateSearch(1); 
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        navigateSearch(-1); 
      }
    });
  }
});