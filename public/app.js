// Front end: only displays results from the server (see CLAUDE.md rule 5).

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function checkServer() {
  const status = document.getElementById('server-status');
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    status.textContent = 'Server connected';
    status.className = 'status status-ok';
  } catch (error) {
    status.textContent = 'Server not reachable';
    status.className = 'status status-error';
    console.error('Health check failed:', error);
  }
}

function renderPlaceholderMonths() {
  const grid = document.getElementById('month-grid');
  grid.innerHTML = MONTH_NAMES.map(
    (name) => `<div class="month-card"><h3>${name}</h3><p class="placeholder">Coming soon</p></div>`
  ).join('');
}

renderPlaceholderMonths();
checkServer();
