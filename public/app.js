// Front end: only displays results from the server (see CLAUDE.md rule 5).

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

let planningYear = null; // default_year from GET /api/settings

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
}

async function loadSettings() {
  try {
    const settings = await api('/api/settings');
    renderSettings(settings);
    planningYear = settings.default_year;
    loadTrips();
  } catch (error) {
    console.error('Loading settings failed:', error);
    showSettingsMessage(`Couldn't load your settings: ${error.message}`, 'error');
    showTripsMessage("Trips can't be shown until your settings load.", 'error');
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
    renderSettings(settings);
    showSettingsMessage('Settings saved.', 'ok');
    loadTrips(); // projected balances depend on the settings
  } catch (saveError) {
    console.error('Saving settings failed:', saveError);
    showSettingsMessage(`Couldn't save your settings: ${saveError.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

// ---- Trips ----

// TODO: remove when API is ready. Shaped exactly like the Trip in docs/api.md.
const SAMPLE_TRIPS = [
  {
    id: 1, title: 'Easter', source: 'preset',
    range_start: '2027-03-20', range_end: '2027-04-05',
    leave_days: 4, enabled: true, activity_id: null, notes: '',
    break: {
      start: '2027-03-26', end: '2027-04-04', length: 10, leave_used: 4,
      leave_dates: ['2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02'],
    },
    balance_on_start: { hours: 61.2, days: 8 },
    short: false,
  },
  {
    id: 2, title: 'Christmas to New Year', source: 'preset',
    range_start: '2027-12-18', range_end: '2028-01-09',
    leave_days: 4, enabled: true, activity_id: null, notes: '',
    break: {
      start: '2027-12-24', end: '2028-01-03', length: 11, leave_used: 4,
      leave_dates: ['2027-12-24', '2027-12-29', '2027-12-30', '2027-12-31'],
    },
    balance_on_start: { hours: 22.8, days: 3 },
    short: true,
  },
  {
    id: 3, title: 'Bali beach week', source: 'custom',
    range_start: '2027-07-03', range_end: '2027-07-18',
    leave_days: 5, enabled: false, activity_id: null, notes: 'Go before the July school holidays end.',
    break: {
      start: '2027-07-03', end: '2027-07-11', length: 9, leave_used: 5,
      leave_dates: ['2027-07-05', '2027-07-06', '2027-07-07', '2027-07-08', '2027-07-09'],
    },
    balance_on_start: { hours: 75.3, days: 9 },
    short: false,
  },
];

const SOURCE_LABELS = { preset: 'Preset', custom: 'Custom', activity: 'Activity', ai: 'From your AI' };

let tripsUseSample = false;

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function showTripsMessage(text, kind = '') {
  const message = document.getElementById('trips-message');
  message.textContent = text;
  message.className = `form-message ${kind ? `form-message-${kind}` : ''}`;
}

function showCardMessage(card, text, kind = '') {
  const message = card.querySelector('.card-message');
  message.textContent = text;
  message.className = `form-message card-message ${kind ? `form-message-${kind}` : ''}`;
}

function renderBreak(trip) {
  if (!trip.break) {
    return '<p class="trip-break trip-break-none">No break fits in this range.</p>';
  }
  const b = trip.break;
  const fewer = b.leave_used < trip.leave_days
    ? ` <span class="note">(the range only needs ${plural(b.leave_used, 'day')})</span>`
    : '';
  return `
    <p class="trip-break">
      <span class="trip-break-length">${plural(b.length, 'day')} off</span>
      <span class="trip-dates">${formatDate(b.start)} to ${formatDate(b.end)}</span>
    </p>
    <p class="trip-detail">Leave used: <strong>${plural(b.leave_used, 'day')}</strong>${fewer}</p>`;
}

function renderBalance(trip) {
  const balance = trip.balance_on_start;
  if (!balance) return '';
  const figures = `${formatHours(balance.hours)} (${plural(balance.days, 'day')})`;
  if (trip.short) {
    return `
      <p class="trip-balance trip-short" role="alert">
        <strong>Not enough leave:</strong> your balance on the start date is ${figures}.
      </p>`;
  }
  return `<p class="trip-detail trip-balance">Balance on start date: <strong>${figures}</strong></p>`;
}

function renderTripCard(trip) {
  return `
    <article class="card trip-card${trip.enabled ? '' : ' trip-disabled'}${trip.short ? ' trip-card-short' : ''}" data-id="${trip.id}">
      <header class="trip-header">
        <div>
          <span class="badge badge-${escapeHtml(trip.source)}">${escapeHtml(SOURCE_LABELS[trip.source] || trip.source)}</span>
          <h3 class="trip-title">${escapeHtml(trip.title)}</h3>
        </div>
        <label class="switch" title="Include this trip in your plan">
          <input type="checkbox" class="trip-toggle" ${trip.enabled ? 'checked' : ''} />
          <span>${trip.enabled ? 'On' : 'Off'}</span>
        </label>
      </header>
      ${renderBreak(trip)}
      ${renderBalance(trip)}
      ${trip.notes ? `<p class="trip-notes">${escapeHtml(trip.notes)}</p>` : ''}
      <details class="trip-edit">
        <summary>Edit trip</summary>
        <form class="trip-form" novalidate>
          <label class="field field-wide"><span>Title</span>
            <input type="text" name="title" value="${escapeHtml(trip.title)}" required /></label>
          <label class="field"><span>Range start</span>
            <input type="date" name="range_start" value="${escapeHtml(trip.range_start)}" required /></label>
          <label class="field"><span>Range end</span>
            <input type="date" name="range_end" value="${escapeHtml(trip.range_end)}" required /></label>
          <label class="field"><span>Leave days</span>
            <input type="number" name="leave_days" value="${escapeHtml(trip.leave_days)}" min="0" step="1" required /></label>
          <label class="field field-wide"><span>Notes</span>
            <input type="text" name="notes" value="${escapeHtml(trip.notes)}" /></label>
          <div class="form-actions">
            <button type="submit" class="button">Save</button>
            <button type="button" class="button button-danger trip-delete">Delete</button>
          </div>
        </form>
      </details>
      <p class="form-message card-message" role="status"></p>
    </article>`;
}

function renderTrips(trips) {
  const list = document.getElementById('trip-list');
  list.innerHTML = trips.length
    ? trips.map(renderTripCard).join('')
    : '<p class="placeholder">No trips yet. Add one below.</p>';
  document.getElementById('trips-sample').hidden = !tripsUseSample;
  document.getElementById('trips-year').textContent = planningYear ? `Planning year: ${planningYear}` : '';
}

async function loadTrips() {
  if (!planningYear) return;
  try {
    const trips = await api(`/api/trips?year=${planningYear}`);
    tripsUseSample = false;
    renderTrips(trips);
    showTripsMessage('');
  } catch (error) {
    console.error('Loading trips failed:', error);
    tripsUseSample = true;
    renderTrips(SAMPLE_TRIPS);
    showTripsMessage(`Couldn't load your trips: ${error.message}`, 'error');
  }
}

// Reads a trip form. Returns { body } or { error } for missing or obviously invalid input;
// the server does the real validation (including date order) and its message is shown.
function readTripForm(form) {
  const title = form.elements.title.value.trim();
  const rangeStart = form.elements.range_start.value;
  const rangeEnd = form.elements.range_end.value;
  const leaveText = form.elements.leave_days.value.trim();
  if (!title) return { error: 'Please enter a title.' };
  if (!rangeStart || !rangeEnd) return { error: 'Please choose a range start and end date.' };
  const leaveDays = Number(leaveText);
  if (leaveText === '' || !Number.isInteger(leaveDays) || leaveDays < 0) {
    return { error: 'Leave days must be a whole number of 0 or more.' };
  }
  return {
    body: {
      title,
      range_start: rangeStart,
      range_end: rangeEnd,
      leave_days: leaveDays,
      notes: form.elements.notes.value.trim(),
    },
  };
}

// Any trip change can move every later trip's projected balance, so reload them all afterwards.
async function changeTrip(card, request, doneText) {
  card.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
  showCardMessage(card, 'Saving…');
  try {
    await request();
    await loadTrips();
    if (doneText) showTripsMessage(doneText, 'ok');
  } catch (error) {
    console.error('Trip change failed:', error);
    card.querySelectorAll('button, input').forEach((el) => { el.disabled = false; });
    const toggle = card.querySelector('.trip-toggle');
    toggle.checked = toggle.defaultChecked; // undo a toggle the server didn't accept
    showCardMessage(card, `Couldn't save: ${error.message}`, 'error');
  }
}

function onTripListChange(event) {
  if (!event.target.classList.contains('trip-toggle')) return;
  const card = event.target.closest('.trip-card');
  const enabled = event.target.checked;
  changeTrip(card, () => api(`/api/trips/${card.dataset.id}`, {
    method: 'PUT', body: JSON.stringify({ enabled }),
  }));
}

function onTripListSubmit(event) {
  if (!event.target.classList.contains('trip-form')) return;
  event.preventDefault();
  const card = event.target.closest('.trip-card');
  const { body, error } = readTripForm(event.target);
  if (error) {
    showCardMessage(card, error, 'error');
    return;
  }
  changeTrip(card, () => api(`/api/trips/${card.dataset.id}`, {
    method: 'PUT', body: JSON.stringify(body),
  }), `Saved "${body.title}".`);
}

function onTripListClick(event) {
  if (!event.target.classList.contains('trip-delete')) return;
  const card = event.target.closest('.trip-card');
  const title = card.querySelector('.trip-title').textContent;
  if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
  changeTrip(card, () => api(`/api/trips/${card.dataset.id}`, { method: 'DELETE' }), `Deleted "${title}".`);
}

async function addTrip(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('add-trip-message');
  const { body, error } = readTripForm(form);
  if (error) {
    message.textContent = error;
    message.className = 'form-message form-message-error';
    return;
  }
  if (!body.notes) delete body.notes;

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  message.textContent = 'Adding…';
  message.className = 'form-message';
  try {
    await api('/api/trips', { method: 'POST', body: JSON.stringify(body) });
    form.reset();
    message.textContent = `Added "${body.title}".`;
    message.className = 'form-message form-message-ok';
    await loadTrips();
  } catch (addError) {
    console.error('Adding trip failed:', addError);
    message.textContent = `Couldn't add the trip: ${addError.message}`;
    message.className = 'form-message form-message-error';
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
const tripList = document.getElementById('trip-list');
tripList.addEventListener('change', onTripListChange);
tripList.addEventListener('submit', onTripListSubmit);
tripList.addEventListener('click', onTripListClick);
document.getElementById('add-trip-form').addEventListener('submit', addTrip);

renderPlaceholderMonths();
checkServer();
loadSettings();
