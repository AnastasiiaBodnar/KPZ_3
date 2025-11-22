let paymentsData = [];
let currentPaymentsPage = 1;
let totalPaymentsPages = 1;
const paymentsPerPage = 50;
const MONTHLY_RATE = 500; 

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
    
    let periodText = '';
    const monthCount = payment.month_to - payment.month_from + 1;
    
    if (payment.month_from === payment.month_to) {
      periodText = months[payment.month_from - 1];
    } else {
      periodText = `${months[payment.month_from - 1]} - ${months[payment.month_to - 1]} <small class="text-muted">(${monthCount} міс.)</small>`;
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
            <button class="btn btn-sm btn-success btn-action" onclick="openPartialPaymentModal(${payment.id})" title="Внести оплату">
              <i class="bi bi-cash"></i> Оплатити
            </button>
          ` : ''}
          <button class="btn btn-sm btn-danger btn-action" onclick="deletePayment(${payment.id})" title="Видалити">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

async function openPartialPaymentModal(paymentId) {
  const payment = paymentsData.find(p => p.id === paymentId);
  
  if (!payment) {
    showAlert('Запис про оплату не знайдено', 'danger');
    return;
  }
  
  const monthCount = payment.month_to - payment.month_from + 1;
  const totalAmount = parseFloat(payment.amount);
  const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  
  const periodText = payment.month_from === payment.month_to 
    ? months[payment.month_from - 1]
    : `${months[payment.month_from - 1]} - ${months[payment.month_to - 1]}`;
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="partialPaymentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="bi bi-cash-coin"></i> Внести оплату
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <strong>Студент:</strong> ${payment.student_name}<br>
              <strong>Період:</strong> ${periodText} ${payment.year}<br>
              <strong>До сплати:</strong> ${totalAmount.toFixed(2)} грн (${monthCount} міс. × ${MONTHLY_RATE} грн)
            </div>
            
            <form id="partialPaymentForm">
              <div class="mb-3">
                <label class="form-label">Скільки студент вніс? (грн) *</label>
                <input type="number" class="form-control" id="paid_amount" 
                       value="${totalAmount.toFixed(2)}" 
                       step="0.01" min="0.01" max="${totalAmount}" required
                       oninput="calculatePartialPayment(${totalAmount}, ${monthCount})">
                <small class="text-muted">Введіть суму від 0.01 до ${totalAmount.toFixed(2)} грн</small>
              </div>
              
              <div id="payment_breakdown" class="alert alert-success">
                <strong> Розрахунок:</strong><br>
                <span id="breakdown_text">Повна оплата за ${monthCount} ${monthCount === 1 ? 'місяць' : 'місяці'}</span>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Дата оплати *</label>
                <input type="date" class="form-control" id="partial_payment_date" 
                       value="${new Date().toISOString().split('T')[0]}" required>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-success" onclick="savePartialPayment(${paymentId}, ${totalAmount}, ${monthCount})">
              <i class="bi bi-check-circle"></i> Підтвердити оплату
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('partialPaymentModal'));
  modal.show();
  
  // Додаємо функцію розрахунку в глобальну область
  window.calculatePartialPayment = function(totalAmount, monthCount) {
    const paidAmount = parseFloat(document.getElementById('paid_amount').value) || 0;
    const remaining = totalAmount - paidAmount;
    const monthsPaid = Math.floor(paidAmount / MONTHLY_RATE);
    const monthsRemaining = monthCount - monthsPaid;
    
    const breakdown = document.getElementById('breakdown_text');
    const breakdownDiv = document.getElementById('payment_breakdown');
    
    if (paidAmount >= totalAmount - 0.01) {
      breakdown.innerHTML = '✅ <strong>Повна оплата</strong> за ' + monthCount + ' ' + (monthCount === 1 ? 'місяць' : 'місяці');
      breakdownDiv.className = 'alert alert-success';
    } else if (paidAmount >= MONTHLY_RATE) {
      breakdown.innerHTML = 
        '⚠️ <strong>Часткова оплата:</strong><br>' +
        '• Оплачено: <strong>' + monthsPaid + ' ' + (monthsPaid === 1 ? 'місяць' : 'місяці') + '</strong> (' + paidAmount.toFixed(2) + ' грн)<br>' +
        '• Залишок боргу: <strong>' + remaining.toFixed(2) + ' грн</strong> (≈ ' + monthsRemaining + ' ' + (monthsRemaining === 1 ? 'місяць' : 'місяці') + ')';
      breakdownDiv.className = 'alert alert-warning';
    } else if (paidAmount > 0) {
      breakdown.innerHTML = '❌ <strong>Мінімальна сума оплати - ' + MONTHLY_RATE + ' грн (1 місяць)</strong>';
      breakdownDiv.className = 'alert alert-danger';
    } else {
      breakdown.innerHTML = '❌ Введіть суму оплати';
      breakdownDiv.className = 'alert alert-danger';
    }
  };
  
  // Викликаємо одразу
  window.calculatePartialPayment(totalAmount, monthCount);
}

async function savePartialPayment(paymentId, totalAmount, monthCount) {
  const form = document.getElementById('partialPaymentForm');
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }
  
  const paidAmount = parseFloat(document.getElementById('paid_amount').value);
  const paymentDate = document.getElementById('partial_payment_date').value;
  
  if (paidAmount <= 0 || paidAmount > totalAmount) {
    showAlert(`Сума має бути від 0.01 до ${totalAmount.toFixed(2)} грн`, 'warning');
    return;
  }
  
  if (paidAmount < MONTHLY_RATE && paidAmount < totalAmount) {
    showAlert(`Мінімальна сума оплати - ${MONTHLY_RATE} грн (1 місяць)`, 'warning');
    return;
  }
  
  const remaining = totalAmount - paidAmount;
  
  // Повна оплата
  if (remaining < 0.01) {
    if (!confirm(`Підтвердити повну оплату ${totalAmount.toFixed(2)} грн?`)) return;
    
    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_date: paymentDate, 
          status: 'paid' 
        })
      });
      
      if (response.ok) {
        showAlert('Оплату підтверджено!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('partialPaymentModal')).hide();
        loadPayments(currentPaymentsPage);
        loadStatistics();
      } else {
        const data = await response.json();
        showAlert('Помилка: ' + data.error, 'danger');
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('Помилка оновлення оплати', 'danger');
    }
  } else {
    // Часткова оплата
    const monthsPaid = Math.floor(paidAmount / MONTHLY_RATE);
    const monthsRemaining = monthCount - monthsPaid;
    
    if (!confirm(
      `Підтвердити часткову оплату?\n\n` +
      `Оплачено: ${monthsPaid} міс. (${paidAmount.toFixed(2)} грн)\n` +
      `Залишок боргу: ${remaining.toFixed(2)} грн (${monthsRemaining} міс.)\n\n` +
      `Буде створено новий запис про залишок боргу.`
    )) return;
    
    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}/partial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_amount: paidAmount,
          payment_date: paymentDate
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showAlert(`Часткову оплату внесено! Залишок боргу: ${data.remaining_debt.toFixed(2)} грн`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('partialPaymentModal')).hide();
        loadPayments(currentPaymentsPage);
        loadStatistics();
      } else {
        showAlert('Помилка: ' + data.error, 'danger');
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('Помилка збереження часткової оплати', 'danger');
    }
  }
}

async function markAsPaid(paymentId) {
  openPartialPaymentModal(paymentId);
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
              <i class="bi bi-plus-circle"></i> Додати нарахування
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
                <strong>Тариф:</strong> ${MONTHLY_RATE} грн за місяць проживання<br>
                <small>Ця форма створює нарахування (борг). Оплату можна внести пізніше.</small>
              </div>
              
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Місяць (початок) *</label>
                  <select class="form-select" id="payment_month_from" required onchange="updatePaymentAmount()">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                      `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Місяць (кінець) *</label>
                  <select class="form-select" id="payment_month_to" required onchange="updatePaymentAmount()">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                      `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Рік *</label>
                <input type="number" class="form-control" id="payment_year" value="${currentYear}" min="2020" max="2100" required>
              </div>
              
              <div class="mb-3">
                <div id="amount_info" class="alert alert-success">
                  <strong> Сума до сплати:</strong> <span id="calculated_amount">500 грн</span> (1 місяць)
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="savePayment()">
              <i class="bi bi-check-circle"></i> Створити нарахування
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
  modal.show();
  
  window.updatePaymentAmount = function() {
    const monthFrom = parseInt(document.getElementById('payment_month_from').value);
    const monthTo = parseInt(document.getElementById('payment_month_to').value);
    
    if (monthTo < monthFrom) {
      document.getElementById('payment_month_to').value = monthFrom;
      window.updatePaymentAmount();
      return;
    }
    
    const monthCount = monthTo - monthFrom + 1;
    const totalAmount = monthCount * MONTHLY_RATE;
    
    const amountInfo = document.getElementById('calculated_amount');
    amountInfo.textContent = totalAmount + ' грн (' + monthCount + ' ' + (monthCount === 1 ? 'місяць' : monthCount < 5 ? 'місяці' : 'місяців') + ')';
  };
  
  window.updatePaymentAmount();
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
  
  const monthCount = monthTo - monthFrom + 1;
  const amount = monthCount * MONTHLY_RATE;
  
  const formData = {
    student_id: parseInt(document.getElementById('payment_student_id').value),
    month_from: monthFrom,
    month_to: monthTo,
    year: parseInt(document.getElementById('payment_year').value),
    amount: amount,
    payment_date: null,
    status: 'unpaid'
  };
  
  if (!confirm(`Створити нарахування на ${amount} грн за ${monthCount} ${monthCount === 1 ? 'місяць' : 'місяці'}?`)) return;
  
  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Нарахування створено', 'success');
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
    
    paymentsData = debtors;
    displayPayments(debtors);
    
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