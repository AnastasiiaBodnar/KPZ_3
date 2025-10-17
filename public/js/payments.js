let paymentsData = [];

async function loadPayments() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/payments`);
    paymentsData = await response.json();
    displayPayments(paymentsData);
  } catch (error) {
    console.error('Error loading payments:', error);
    showAlert('Помилка завантаження оплат', 'danger');
  }
  hideLoading();
}

function displayPayments(payments) {
  const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  
  document.getElementById('payments-table').innerHTML = payments.map(payment => {
    const statusClass = payment.status === 'paid' ? 'success' : 'danger';
    const statusText = payment.status === 'paid' ? 'Оплачено' : 'Не оплачено';
    
    return `
      <tr>
        <td>${payment.id}</td>
        <td>${payment.student_name}</td>
        <td>${months[payment.month - 1]}</td>
        <td>${payment.year}</td>
        <td>${parseFloat(payment.amount).toFixed(2)}</td>
        <td>${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('uk-UA') : '-'}</td>
        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
        <td>
          ${payment.status === 'unpaid' ? `
            <button class="btn btn-sm btn-success btn-action" onclick="markAsPaid(${payment.id})">
              <i class="bi bi-check-circle"></i> Оплачено
            </button>
          ` : ''}
        </td>
      </tr>`;
  }).join('');
}

async function openPaymentModal() {
  const studentsResponse = await fetch(`${API_URL}/students`);
  const students = await studentsResponse.json();
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  document.getElementById('modals-container').innerHTML = `
    <div class="modal fade" id="paymentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Додати оплату</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="paymentForm">
              <div class="mb-3">
                <label class="form-label">Студент *</label>
                <select class="form-select" id="payment_student_id" required>
                  <option value="">Оберіть студента</option>
                  ${students.map(s => `<option value="${s.id}">${s.surname} ${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Місяць *</label>
                <select class="form-select" id="payment_month" required>
                  ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
                    `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][m-1]}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Рік *</label>
                <input type="number" class="form-control" id="payment_year" value="${currentYear}" min="2020" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Сума (грн) *</label>
                <input type="number" class="form-control" id="payment_amount" value="1500.00" step="0.01" min="0" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Дата оплати</label>
                <input type="date" class="form-control" id="payment_date">
              </div>
              <div class="mb-3">
                <label class="form-label">Статус *</label>
                <select class="form-select" id="payment_status" required>
                  <option value="unpaid">Не оплачено</option>
                  <option value="paid">Оплачено</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Скасувати</button>
            <button type="button" class="btn btn-primary" onclick="savePayment()">Зберегти</button>
          </div>
        </div>
      </div>
    </div>`;
  
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

async function savePayment() {
  const formData = {
    student_id: parseInt(document.getElementById('payment_student_id').value),
    month: parseInt(document.getElementById('payment_month').value),
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
    
    if (response.ok) {
      showAlert('Оплату додано', 'success');
      bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
      loadPayments();
      loadStatistics();
    } else {
      const error = await response.json();
      showAlert('Помилка: ' + error.error, 'danger');
    }
  } catch (error) {
    console.error('Error saving payment:', error);
    showAlert('Помилка збереження', 'danger');
  }
}

async function markAsPaid(paymentId) {
  const payment_date = new Date().toISOString().split('T')[0];
  
  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date, status: 'paid' })
    });
    
    if (response.ok) {
      showAlert('Оплату підтверджено', 'success');
      loadPayments();
      loadStatistics();
    } else {
      showAlert('Помилка оновлення оплати', 'danger');
    }
  } catch (error) {
    console.error('Error updating payment:', error);
    showAlert('Помилка оновлення', 'danger');
  }
}

async function loadDebtors() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/payments/debtors`);
    const debtors = await response.json();
    displayPayments(debtors);
    showAlert(`Знайдено боржників: ${debtors.length}`, 'warning');
  } catch (error) {
    console.error('Error loading debtors:', error);
    showAlert('Помилка завантаження боржників', 'danger');
  }
  hideLoading();
}