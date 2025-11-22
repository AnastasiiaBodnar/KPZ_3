let paymentsData = [];
let currentPaymentsPage = 1;
let totalPaymentsPages = 1;
const paymentsPerPage = 50;

async function loadPayments(page = 1, status = '', year = '') {
  showLoading();
  try {
    currentPaymentsPage = page;
    
    const params = new URLSearchParams({
      page: currentPaymentsPage,
      limit: paymentsPerPage,
      status: status,
      year: year
    });
    
    const response = await fetch(`${API_URL}/payments?${params}`);
    const result = await response.json();
    
    paymentsData = result.data;
    totalPaymentsPages = result.pagination.totalPages;
    
    displayPayments(paymentsData);
    displayPagination(result.pagination, 'payments-pagination');
  } catch (error) {
    console.error('Error loading payments:', error);
    showAlert('Помилка завантаження оплат', 'danger');
  }
  hideLoading();
}

function displayPayments(payments) {
  const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  
  const tbody = document.getElementById('payments-table');
  
  if (payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Записів про оплати не знайдено</td></tr>';
    return;
  }
  
  tbody.innerHTML = payments.map(payment => {
    const statusClass = payment.status === 'paid' ? 'success' : 'danger';
    const statusText = payment.status === 'paid' ? 'Оплачено' : 'Не оплачено';
    
    // Формування періоду
    let periodText = '';
    if (payment.month_from === payment.month_to) {
      periodText = months[payment.month_from - 1];
    } else {
      periodText = `${months[payment.month_from - 1]} - ${months[payment.month_to - 1]}`;
    }
    
    return `
      <tr class="${payment.status === 'unpaid' ? 'table-warning' : ''}">
        <td>${payment.id}</td>
        <td>
          ${payment.student_name}
          <br>
          <small class="text-muted">${payment.course} курс, ${payment.faculty}</small>
        </td>
        <td><strong>${periodText}</strong></td>
        <td>${payment.year}</td>
        <td><strong>${parseFloat(payment.amount).toFixed(2)} грн</strong></td>
        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('uk-UA') : '-'}</td>
        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
        <td>
          ${payment.status === 'unpaid' ? `
            <button class="btn btn-sm btn-success btn-action" onclick="markAsPaid(${payment.id})" title="Підтвердити оплату">
              <i class="bi bi-check-circle"></i> Оплачено
            </button>
          ` : ''}
          <button class="btn btn-sm btn-danger btn-action" onclick="deletePayment(${payment.id})" title="Видалити">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

async function openPaymentModal() {
  const studentsResponse = await fetch(`${API_URL}/students?limit=1000`);
  const studentsResult = await studentsResponse.json();
  const students = studentsResult.data || studentsResult;
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="paymentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="bi bi-cash-coin"></i> Додати оплату
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="paymentForm">
              <div class="mb-3">
                <label class="form-label">Студент *</label>
                <select class="form-select" id="payment_student_id" required>
                  <option value="">Оберіть студента</option>
                  ${students.map(s => {
                    const debtBadge = s.total_debt > 0 ? ` 🔴 ${parseFloat(s.total_debt).toFixed(0)} грн` : '';
                    return `<option value="${s.id}">${s.surname} ${s.name} (${s.course} курс, ${s.faculty})${debtBadge}</option>`;
                  }).join('')}
                </select>
              </div>
              
              <div class="alert alert-info">
                <i class="bi bi-info-circle"></i> 
                <strong>Підтримка періодів:</strong> Ви можете вказати оплату за один місяць або за період (наприклад, з січня по березень)
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Місяць (початок) *</label>
                  <select class="form-select" id="payment_month_from" required onchange="updateMonthTo()">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                      `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Місяць (кінець)</label>
                  <select class="form-select" id="payment_month_to">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                      `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                    ).join('')}
                  </select>
                  <small class="text-muted">Якщо оплата за один місяць - залиште той самий</small>
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Рік *</label>
                <input type="number" class="form-control" id="payment_year" value="${currentYear}" min="2020" max="2100" required>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Сума (грн) *</label>
                <input type="number" class="form-control" id="payment_amount" value="1500.00" step="0.01" min="0.01" required>
                <small class="text-muted">Рекомендована місячна оплата: 1500 грн</small>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Дата оплати</label>
                <input type="date" class="form-control" id="payment_date">
                <small class="text-muted">Залиште порожнім якщо ще не оплачено</small>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Статус *</label>
                <select class="form-select" id="payment_status" required onchange="togglePaymentDate()">
                  <option value="unpaid">Не оплачено</option>
                  <option value="paid">Оплачено</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="savePayment()">
              <i class="bi bi-check-circle"></i> Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      function updateMonthTo() {
        const monthFrom = parseInt(document.getElementById('payment_month_from').value);
        const monthTo = document.getElementById('payment_month_to');
        if (parseInt(monthTo.value) < monthFrom) {
          monthTo.value = monthFrom;
        }
      }
      
      function togglePaymentDate() {
        const status = document.getElementById('payment_status').value;
        const dateInput = document.getElementById('payment_date');
        if (status === 'paid' && !dateInput.value) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
      }
    </script>
  `;
  
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

async function savePayment() {
  const form = document.getElementById('paymentForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const monthFrom = parseInt(document.getElementById('payment_month_from').value);
  const monthTo = parseInt(document.getElementById('payment_month_to').value);
  
  if (monthTo < monthFrom) {
    showAlert('Кінцевий місяць не може бути раніше початкового', 'warning');
    return;
  }
  
  const formData = {
    student_id: parseInt(document.getElementById('payment_student_id').value),
    month_from: monthFrom,
    month_to: monthTo,
    year: parseInt(document.getElementById('payment_year').value),
    amount: parseFloat(document.getElementById('payment_amount').value),
    payment_date: document.getElementById('payment_date').value || null,
    status: document.getElementById('payment_status').value
  };
  
  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Оплату додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      loadPayments(currentPaymentsPage);
      loadStatistics();
    } else {
      showAlert('Помилка: ' + data.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving payment:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

async function markAsPaid(paymentId) {
  const payment = paymentsData.find(p => p.id === paymentId);
  const confirmText = payment 
    ? `Підтвердити оплату для ${payment.student_name}?`
    : 'Підтвердити оплату?';
    
  if (!confirm(confirmText)) return;
  
  const payment_date = new Date().toISOString().split('T')[0];
  
  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date, status: 'paid' })
    });
    
    if (response.ok) {
      showAlert('Оплату підтверджено', 'success');
      loadPayments(currentPaymentsPage);
      loadStatistics();
    } else {
      showAlert('Помилка оновлення оплати', 'danger');
    }
  } catch (error) {
    console.error('Error updating payment:', error);
    showAlert('Помилка оновлення', 'danger');
  }
}

async function deletePayment(paymentId) {
  if (!confirm('Ви впевнені, що хочете видалити цей запис про оплату?')) return;
  
  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, { 
      method: 'DELETE' 
    });
    
    if (response.ok) {
      showAlert('Запис про оплату видалено', 'success');
      loadPayments(currentPaymentsPage);
      loadStatistics();
    } else {
      showAlert('Помилка видалення', 'danger');
    }
  } catch (error) {
    console.error('Error deleting payment:', error);
    showAlert('Помилка видалення', 'danger');
  }
}

async function loadDebtors() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/payments/debtors`);
    const debtors = await response.json();
    
    // Показуємо без пагінації, тільки боржників
    paymentsData = debtors;
    displayPayments(debtors);
    
    // Приховуємо пагінацію
    const paginationContainer = document.getElementById('payments-pagination');
    if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
    
    showAlert(`Знайдено боржників: ${debtors.length}`, 'warning');
  } catch (error) {
    console.error('Error loading debtors:', error);
    showAlert('Помилка завантаження боржників', 'danger');
  }
  hideLoading();
}

function filterPayments() {
  const status = document.getElementById('filterPaymentStatus')?.value || '';
  const year = document.getElementById('filterPaymentYear')?.value || '';
  loadPayments(1, status, year);
}

function resetPaymentFilters() {
  if (document.getElementById('filterPaymentStatus')) {
    document.getElementById('filterPaymentStatus').value = '';
  }
  if (document.getElementById('filterPaymentYear')) {
    document.getElementById('filterPaymentYear').value = '';
  }
  loadPayments(1);
}