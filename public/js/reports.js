let facultyChart = null;
let paymentsChart = null;

function downloadStudentsExcel() {
  window.open(`${API_URL}/reports/students/excel`, '_blank');
}

function downloadDebtorsPdf() {
  window.open(`${API_URL}/reports/debtors/pdf`, '_blank');
}