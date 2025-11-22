async function loadTopDebtors() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/analytics/top-debtors?limit=10`);
    const debtors = await response.json();
    displayTopDebtors(debtors);
  } catch (error) {
    console.error('Error loading top debtors:', error);
    showAlert('Помилка завантаження топ боржників', 'danger');
  }
  hideLoading();
}

function displayTopDebtors(debtors) {
  const tbody = document.getElementById('top-debtors-table');
  
  if (debtors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Боржників не знайдено! 🎉</td></tr>';
    return;
  }
  
  tbody.innerHTML = debtors.map((debtor, index) => `
    <tr class="${index < 3 ? 'table-danger' : ''}">
      <td><strong>${index + 1}</strong></td>
      <td>
        <a href="#" onclick="showStudentDetails(${debtor.id})" class="text-decoration-none">
          ${debtor.student_name}
        </a>
      </td>
      <td>${debtor.faculty}</td>
      <td>${debtor.course} курс</td>
      <td>${debtor.phone || '-'}</td>
      <td><span class="badge bg-warning">${debtor.unpaid_records}</span></td>
      <td><strong class="text-danger">${parseFloat(debtor.total_debt).toFixed(2)} грн</strong></td>
    </tr>
  `).join('');
}

async function loadFloorsAnalytics() {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/analytics/floors`);
    const floors = await response.json();
    displayFloorsAnalytics(floors);
  } catch (error) {
    console.error('Error loading floors analytics:', error);
    showAlert('Помилка завантаження аналітики поверхів', 'danger');
  }
  hideLoading();
}

function displayFloorsAnalytics(floors) {
  const tbody = document.getElementById('floors-analytics-table');
  
  if (floors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Немає даних</td></tr>';
    return;
  }
  
  tbody.innerHTML = floors.map(floor => {
    const occupancyRate = parseFloat(floor.occupancy_rate) || 0;
    let progressColor = 'success';
    if (occupancyRate >= 90) progressColor = 'danger';
    else if (occupancyRate >= 70) progressColor = 'warning';
    
    return `
      <tr>
        <td><strong>${floor.floor} поверх</strong></td>
        <td>${floor.total_rooms}</td>
        <td>${floor.total_beds}</td>
        <td>${floor.occupied_beds}</td>
        <td>${floor.free_beds}</td>
        <td><strong>${occupancyRate}%</strong></td>
        <td>
          <div class="progress" style="height: 25px;">
            <div class="progress-bar bg-${progressColor}" role="progressbar" 
                 style="width: ${occupancyRate}%" 
                 aria-valuenow="${occupancyRate}" aria-valuemin="0" aria-valuemax="100">
              ${occupancyRate}%
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadStudentSelector() {
  try {
    const response = await fetch(`${API_URL}/students?limit=1000`);
    const result = await response.json();
    const students = result.data || result;
    
    const selector = document.getElementById('student-selector');
    selector.innerHTML = '<option value="">-- Оберіть студента --</option>' +
      students.map(s => 
        `<option value="${s.id}">${s.surname} ${s.name} (${s.course} курс, ${s.faculty})</option>`
      ).join('');
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

async function loadStudentConnections() {
  const studentId = document.getElementById('student-selector').value;
  
  if (!studentId) {
    document.getElementById('roommates-section').classList.add('d-none');
    document.getElementById('coursemates-section').classList.add('d-none');
    return;
  }
  
  showLoading();
  
  try {
    const roommatesResponse = await fetch(`${API_URL}/students/${studentId}/roommates`);
    const roommates = await roommatesResponse.json();
    displayRoommates(roommates);
    
    const coursematesResponse = await fetch(`${API_URL}/students/${studentId}/coursemates`);
    const coursemates = await coursematesResponse.json();
    displayCoursemates(coursemates);
    
  } catch (error) {
    console.error('Error loading student connections:', error);
    showAlert('Помилка завантаження зв\'язків студента', 'danger');
  }
  
  hideLoading();
}

function displayRoommates(roommates) {
  const section = document.getElementById('roommates-section');
  const tbody = document.getElementById('roommates-table');
  
  if (roommates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Студент живе один або не заселений</td></tr>';
  } else {
    tbody.innerHTML = roommates.map(rm => `
      <tr>
        <td>${rm.student_name}</td>
        <td>${rm.faculty}</td>
        <td>${rm.course} курс</td>
        <td>${rm.phone || '-'}</td>
        <td>${new Date(rm.date_in).toLocaleDateString('uk-UA')}</td>
      </tr>
    `).join('');
  }
  
  section.classList.remove('d-none');
}

function displayCoursemates(coursemates) {
  const section = document.getElementById('coursemates-section');
  const tbody = document.getElementById('coursemates-table');
  const info = document.getElementById('coursemates-info');
  
  if (coursemates.length === 0) {
    info.textContent = 'Немає інших студентів на цьому курсі та факультеті';
    tbody.innerHTML = '';
  } else {
    info.textContent = `Знайдено ${coursemates.length} однокурсників`;
    tbody.innerHTML = coursemates.map(cm => {
      const hasDebt = parseFloat(cm.total_debt) > 0;
      return `
        <tr class="${hasDebt ? 'table-warning' : ''}">
          <td>${cm.surname} ${cm.name}</td>
          <td>${cm.room_number || '<span class="text-muted">Не заселений</span>'}</td>
          <td>${cm.floor || '-'}</td>
          <td>${cm.phone || '-'}</td>
          <td class="${hasDebt ? 'text-danger fw-bold' : ''}">
            ${parseFloat(cm.total_debt).toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');
  }
  
  section.classList.remove('d-none');
}

function showStudentDetails(studentId) {
  showAlert(`Деталі студента #${studentId} (розробка...)`, 'info');
}