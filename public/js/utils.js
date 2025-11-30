const API_URL = 'http://localhost:3000/api';

let currentSort = {
  students: { field: 'id', order: 'ASC' },
  rooms: { field: 'id', order: 'ASC' },
  accommodation: { field: 'id', order: 'ASC' },
  payments: { field: 'id', order: 'ASC' }
};

// Глобальні змінні для графіків
let occupancyChart = null;
let facultyChart = null;

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
      loadDashboardCharts();
      break;
    case 'students':
      loadStudents(null, null, 1);
      break;
    case 'rooms':
      loadRooms();
      break;
    case 'accommodation':
      loadAccommodation(1);
      break;
    case 'payments':
      loadPayments(1);
      break;
    case 'reports':
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

async function loadOccupancyChart() {
  try {
    const statsResponse = await fetch(`${API_URL}/statistics`);
    const stats = await statsResponse.json();
    
    const ctx = document.getElementById('occupancyChart');
    if (!ctx) return;

    if (occupancyChart) {
      occupancyChart.destroy();
    }

    const occupied = stats.occupiedBeds;
    const free = stats.totalBeds - stats.occupiedBeds;
    const occupancyRate = stats.totalBeds > 0 ? (occupied / stats.totalBeds * 100) : 0;

    occupancyChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Зайнято', 'Вільно'],
        datasets: [{
          data: [occupied, free],
          backgroundColor: [
            '#ff6384', 
            '#36a2eb'   
          ],
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 12,
                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
              },
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = occupied + free;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} місць (${percentage}%)`;
              }
            }
          },
          title: {
            display: true,
            text: `Загальна заповненість: ${occupancyRate.toFixed(1)}%`,
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: 10
          }
        },
        cutout: '55%',
        animation: {
          animateScale: true,
          animateRotate: true
        }
      }
    });
  } catch (error) {
    console.error('Error loading occupancy chart:', error);
  }
}

async function loadDashboardFacultyChart() {
  try {
    const response = await fetch(`${API_URL}/reports/charts/faculty-stats`);
    const data = await response.json();

    const ctx = document.getElementById('facultyChart');
    if (!ctx) return;

    if (facultyChart) {
      facultyChart.destroy();
    }

    facultyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.faculty),
        datasets: [
          {
            label: 'Всього студентів',
            data: data.map(d => parseInt(d.total_students)),
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Заселено',
            data: data.map(d => parseInt(d.accommodated_students)),
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            },
            title: {
              display: true,
              text: 'Кількість студентів'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Факультети'
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              afterBody: function(context) {
                const datasetIndex = context[0].datasetIndex;
                const dataIndex = context[0].dataIndex;
                if (datasetIndex === 0) {
                  const total = context[0].raw;
                  const accommodated = facultyChart.data.datasets[1].data[dataIndex];
                  const percentage = total > 0 ? ((accommodated / total) * 100).toFixed(1) : 0;
                  return `Заселено: ${percentage}%`;
                }
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading faculty chart:', error);
  }
}

async function loadDashboardCharts() {
  showLoading();
  try {
    await Promise.all([
      loadOccupancyChart(),
      loadDashboardFacultyChart()
    ]);
  } catch (error) {
    console.error('Error loading dashboard charts:', error);
  }
  hideLoading();
}

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
  
  paginationHTML += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(1); return false;">
        <i class="bi bi-chevron-double-left"></i>
      </a>
    </li>
  `;
  
  paginationHTML += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${page - 1}); return false;">
        <i class="bi bi-chevron-left"></i>
      </a>
    </li>
  `;
  
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, page + 2);
  
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
  
  paginationHTML += `
    <li class="page-item ${page === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${page + 1}); return false;">
        <i class="bi bi-chevron-right"></i>
      </a>
    </li>
  `;
  
  paginationHTML += `
    <li class="page-item ${page === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="changePage${getEntityName(containerId)}(${totalPages}); return false;">
        <i class="bi bi-chevron-double-right"></i>
      </a>
    </li>
  `;
  
  paginationHTML += '</ul></nav>';

  paginationHTML += `
    <div class="text-center mt-2 text-muted">
      <small>Сторінка ${page} з ${totalPages}</small>
    </div>
  `;
  
  container.innerHTML = paginationHTML;
}

function getEntityName(containerId) {
  if (containerId.includes('students')) return 'Students';
  if (containerId.includes('rooms')) return 'Rooms';
  if (containerId.includes('accommodation')) return 'Accommodation';
  if (containerId.includes('payments')) return 'Payments';
  return '';
}

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