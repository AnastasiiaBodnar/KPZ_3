function downloadStudentsExcel() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `${API_URL}/reports/students/excel`;
  document.body.appendChild(iframe);

  iframe.onload = function() {
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

function downloadDebtorsPdf() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `${API_URL}/reports/debtors/pdf`;
  document.body.appendChild(iframe);
  
  iframe.onload = function() {
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

function downloadStudentsWord() {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = `${API_URL}/reports/rooms/word`;
  document.body.appendChild(iframe);

  iframe.onload = function() {
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}
