// Front end: only displays results from the server (see CLAUDE.md rule 5).

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// TODO: remove when API is ready. Shaped exactly like GET /api/settings in docs/api.md.
const SAMPLE_SETTINGS = {
  balance_hours: 61.2,
  balance_as_of: '2026-10-01',
  accrual_hours_per_workday: 0.5846,
  hours_per_day: 7.6,
  balance_days: 8,
  default_year: 2027,
};

const SETTINGS_FIELDS = ['balance_hours', 'balance_as_of', 'accrual_hours_per_workday', 'hours_per_day'];

// Calls the API and returns parsed JSON. Throws an Error carrying the server's { error } message.
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `The server replied with an error (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

// Formats 'YYYY-MM-DD' as e.g. '1 October 2026' by splitting the string (no date maths here).
function formatDate(dateString) {
  const [year, month, day] = String(dateString).split('-');
  if (!year || !month || !day) return dateString;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

function formatHours(hours) {
  return `${Number(Number(hours).toFixed(2))} h`;
}

// ---- Settings panel ----

let settingsUseSample = false;

function showSettingsMessage(text, kind = '') {
  const message = document.getElementById('settings-message');
  message.textContent = text;
  message.className = `form-message ${kind ? `form-message-${kind}` : ''}`;
}

function renderSettings(settings) {
  const form = document.getElementById('settings-form');
  for (const field of SETTINGS_FIELDS) form.elements[field].value = settings[field];

  document.getElementById('balance-hours').textContent = formatHours(settings.balance_hours);
  const days = settings.balance_days;
  document.getElementById('balance-days').textContent = `${days} ${days === 1 ? 'day' : 'days'}`;
  document.getElementById('balance-as-of-text').textContent =
    `As of ${formatDate(settings.balance_as_of)}, at ${settings.hours_per_day} hours per day.`;
  document.getElementById('settings-sample').hidden = !settingsUseSample;
}

async function loadSettings() {
  try {
    const settings = await api('/api/settings');
    settingsUseSample = false;
    renderSettings(settings);
  } catch (error) {
    console.error('Loading settings failed:', error);
    settingsUseSample = true;
    renderSettings(SAMPLE_SETTINGS);
    showSettingsMessage(`Couldn't load your settings: ${error.message}`, 'error');
  }
}

// Reads the form and returns { body } or { error } for obviously missing or invalid input.
// The server does the real validation; its message is shown if it rejects the values.
function readSettingsForm(form) {
  const body = {};
  for (const field of SETTINGS_FIELDS) {
    const input = form.elements[field];
    const label = input.closest('.field').querySelector('span').textContent;
    if (input.value.trim() === '') return { error: `Please enter ${label.toLowerCase()}.` };
    if (input.type === 'number') {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < 0) return { error: `${label} must be a number of 0 or more.` };
      body[field] = value;
    } else {
      body[field] = input.value;
    }
  }
  if (body.hours_per_day <= 0) return { error: 'Hours per leave day must be more than 0.' };
  return { body };
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const { body, error } = readSettingsForm(form);
  if (error) {
    showSettingsMessage(error, 'error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  showSettingsMessage('Saving…');
  try {
    const settings = await api('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
    settingsUseSample = false;
    renderSettings(settings);
    showSettingsMessage('Settings saved.', 'ok');
  } catch (saveError) {
    console.error('Saving settings failed:', saveError);
    showSettingsMessage(`Couldn't save your settings: ${saveError.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

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

document.getElementById('settings-form').addEventListener('submit', saveSettings);

renderPlaceholderMonths();
checkServer();
loadSettings();
