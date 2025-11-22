let facultyChart = null;
let paymentsChart = null;

// Функції для завантаження файлів
function downloadStudentsExcel() {
  window.open(`${API_URL}/reports/students/excel`, '_blank');
}

function downloadDebtorsPdf() {
  window.open(`${API_URL}/reports/debtors/pdf`, '_blank');
}

// Завантаження діаграми по факультетах - ОПТИМІЗОВАНА
async function loadFacultyChart() {
  try {
    const response = await fetch(`${API_URL}/reports/charts/faculty-stats`);
    const data = await response.json();

    const ctx = document.getElementById('facultyChart');
    if (!ctx) return;

    // Знищити попередню діаграму
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
          title: {
            display: false
          }
        },
        animation: {
          duration: 500 // Швидша анімація
        }
      }
    });
  } catch (error) {
    console.error('Error loading faculty chart:', error);
    showAlert('Помилка завантаження діаграми факультетів', 'danger');
  }
}

// Завантаження діаграми оплат - ОПТИМІЗОВАНА
async function loadPaymentsChart() {
  try {
    const response = await fetch(`${API_URL}/reports/charts/payments-by-month`);
    const data = await response.json();

    const monthNames = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер',
                        'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

    const ctx = document.getElementById('paymentsChart');
    if (!ctx) return;

    // Знищити попередню діаграму
    if (paymentsChart) {
      paymentsChart.destroy();
    }

    paymentsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => monthNames[d.month - 1]),
        datasets: [
          {
            label: 'Оплачено (грн)',
            data: data.map(d => parseFloat(d.paid_amount)),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Не оплачено (грн)',
            data: data.map(d => parseFloat(d.unpaid_amount)),
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
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
          title: {
            display: false
          }
        },
        animation: {
          duration: 500 // Швидша анімація
        }
      }
    });
  } catch (error) {
    console.error('Error loading payments chart:', error);
    showAlert('Помилка завантаження діаграми оплат', 'danger');
  }
}

// Завантаження всіх діаграм
async function loadAllCharts() {
  showLoading();
  try {
    await Promise.all([
      loadFacultyChart(),
      loadPaymentsChart()
    ]);
  } catch (error) {
    console.error('Error loading charts:', error);
  }
  hideLoading();
}