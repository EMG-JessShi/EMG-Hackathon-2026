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
    showCalendarMessage("The calendar can't be shown until your settings load.", 'error');
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
      if (!Number.isFinite(value)) return { error: `${label} must be a number.` };
      // A negative balance is allowed (leave taken in advance); the other numbers can't be negative.
      if (value < 0 && field !== 'balance_hours') return { error: `${label} must be a number of 0 or more.` };
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

const SOURCE_LABELS = { preset: 'Preset', custom: 'Custom', activity: 'Activity', ai: 'From your AI' };

let tripTitles = {}; // trip id -> title, for calendar tooltips

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
    ? ` <span class="note">(you asked for ${trip.leave_days}; this range only needs ${b.leave_used})</span>`
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
        <svg class="warn-icon" aria-hidden="true" focusable="false"><use href="#i-warn"/></svg>
        <span><strong>Not enough leave:</strong> your balance on the start date is ${figures}.</span>
      </p>`;
  }
  return `<p class="trip-detail trip-balance">Balance on start date: <strong>${figures}</strong></p>`;
}

// Formats 'YYYY-MM-DD' as e.g. '26 Mar' by splitting the string (no date maths here).
function formatShortDate(dateString) {
  const [, month, day] = String(dateString).split('-');
  if (!month || !day) return dateString;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1].slice(0, 3)}`;
}

function renderOverlaps(trip) {
  const overlaps = trip.overlaps || []; // treat a missing field as no overlaps
  if (!overlaps.length) return '';
  const items = overlaps.map((o) => `
    <li>Overlaps with <button type="button" class="overlap-link" data-trip-id="${escapeHtml(o.id)}">${escapeHtml(o.title)}</button>
      (${escapeHtml(formatShortDate(o.start))} to ${escapeHtml(formatShortDate(o.end))}).</li>`).join('');
  return `
    <div class="trip-overlap" role="note">
      <svg class="overlap-icon" aria-hidden="true" focusable="false"><use href="#i-overlap"/></svg>
      <div>
        <ul>${items}</ul>
        <p>Shared leave days are only counted once.</p>
      </div>
    </div>`;
}

function renderTripCard(trip) {
  return `
    <article class="card trip-card${trip.enabled ? '' : ' trip-disabled'}${trip.short ? ' trip-card-short' : ''}" data-id="${trip.id}" data-source="${escapeHtml(trip.source)}">
      <header class="trip-header">
        <div>
          <span class="badge badge-${escapeHtml(trip.source)}">${escapeHtml(SOURCE_LABELS[trip.source] || trip.source)}</span>
          <h3 class="trip-title">${escapeHtml(trip.title)}</h3>
        </div>
        <div class="trip-actions">
          <label class="switch" title="Include this trip in your plan">
            <input type="checkbox" class="trip-toggle" ${trip.enabled ? 'checked' : ''} />
            <span>${trip.enabled ? 'On' : 'Off'}</span>
          </label>
          <button type="button" class="icon-button trip-delete" aria-label="Delete ${escapeHtml(trip.title)}" title="Delete trip">
            <svg aria-hidden="true" focusable="false"><use href="#i-trash"/></svg>
          </button>
        </div>
      </header>
      ${renderBreak(trip)}
      ${renderBalance(trip)}
      ${renderOverlaps(trip)}
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
  tripTitles = Object.fromEntries(trips.map((trip) => [trip.id, trip.title]));
}

async function loadTrips() {
  if (!planningYear) return;
  renderYear();
  try {
    const trips = await api(`/api/trips?year=${planningYear}`);
    renderTrips(trips);
    showTripsMessage('');
  } catch (error) {
    console.error('Loading trips failed:', error);
    showTripsMessage(`Couldn't load your trips: ${error.message}`, 'error');
  }
  loadCalendar(); // leave days, trip spans and balances follow the trips
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
  const overlapLink = event.target.closest('.overlap-link');
  if (overlapLink) {
    scrollToTrip(overlapLink.dataset.tripId);
    return;
  }
  if (!event.target.closest('.trip-delete')) return;
  const card = event.target.closest('.trip-card');
  const title = card.querySelector('.trip-title').textContent;
  const question = card.dataset.source === 'preset'
    ? `Delete the preset trip "${title}"? Presets are picked automatically and it won't come back.`
    : `Delete "${title}"? This can't be undone.`;
  if (!window.confirm(question)) return;
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

// ---- Year calendar ----

const WEEKDAY_HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEATHER_LABELS = { hot: 'Hot', comfortable: 'Comfortable', cold: 'Cold' };
const WEATHER_ICONS = { hot: 'i-sun', comfortable: 'i-leaf', cold: 'i-cloud' };
const CROWD_LABELS = { low: 'Low', mid: 'Mid', high: 'High', peak: 'Peak' };

let calendarRequest = 0; // ignore replies from older requests

function showCalendarMessage(text, kind = '') {
  const message = document.getElementById('calendar-message');
  message.textContent = text;
  message.className = `form-message ${kind ? `form-message-${kind}` : ''}`;
}

function dayTooltip(day) {
  const parts = [formatDate(day.date)];
  if (day.public_holiday) parts.push(`WA public holiday: ${day.public_holiday}`);
  if (day.leave) parts.push('Your leave day');
  for (const id of day.trip_ids) parts.push(`Trip: ${tripTitles[id] || `#${id}`}`);
  if (day.school_holiday) parts.push('WA school holidays');
  if (day.cn_holiday) parts.push(`China holiday: ${day.cn_holiday.name}${day.cn_holiday.is_estimate ? ' (estimate)' : ''}`);
  if (day.cn_workday) parts.push('China make-up workday');
  if (day.cn_school_holiday) parts.push('China school holidays (estimate)');
  return parts.join('\n');
}

function renderDay(day) {
  const classes = ['day'];
  if (day.is_weekend) classes.push('day-weekend');
  if (day.public_holiday) classes.push('day-public');
  if (day.trip_ids.length) classes.push('day-trip');
  if (day.leave) classes.push('day-leave');
  if (day.school_holiday) classes.push('day-school');
  const marker = day.cn_holiday
    ? `<span class="cn-dot${day.cn_holiday.is_estimate ? ' cn-dot-estimate' : ''}"></span>`
    : day.cn_workday ? '<span class="cn-workday"></span>' : '';
  const label = escapeHtml(dayTooltip(day));
  return `<div class="${classes.join(' ')}" title="${label}" aria-label="${label}">${Number(day.date.slice(8, 10))}${marker}</div>`;
}

function renderTag(kind, value, text) {
  return `<span class="tag tag-${kind}-${escapeHtml(value)}">${escapeHtml(text)}</span>`;
}

function renderMonthCard(month, days) {
  // Blank cells before the 1st come from the API's weekday (Mon = 1), not browser date maths.
  const leading = days.length ? Math.max(0, days[0].weekday - 1) : 0;
  const balance = month.balance_end;
  return `
    <article class="month-card">
      <h3>${WEATHER_ICONS[month.weather] ? `<svg class="season-icon season-${month.weather}" aria-hidden="true" focusable="false"><use href="#${WEATHER_ICONS[month.weather]}"/></svg>` : ''}${escapeHtml(month.name)}</h3>
      <div class="tags">
        ${renderTag('weather', month.weather, WEATHER_LABELS[month.weather] || month.weather)}
        ${renderTag('crowd', month.au_crowd, `AU crowd: ${CROWD_LABELS[month.au_crowd] || month.au_crowd}`)}
        ${renderTag('crowd', month.cn_crowd, `CN crowd: ${CROWD_LABELS[month.cn_crowd] || month.cn_crowd}`)}
      </div>
      <div class="day-grid">
        ${WEEKDAY_HEADINGS.map((d) => `<div class="day-heading">${d}</div>`).join('')}
        ${'<div class="day day-blank"></div>'.repeat(leading)}
        ${days.map(renderDay).join('')}
      </div>
      ${balance ? `<p class="month-balance${balance.hours < 0 ? ' month-balance-short' : ''}">
        Balance at month end: <strong>${formatHours(balance.hours)} (${plural(balance.days, 'day')})</strong></p>` : ''}
    </article>`;
}

function renderCalendar(calendar) {
  // Group days by the month part of their YYYY-MM-DD string.
  const byMonth = {};
  for (const day of calendar.days) (byMonth[Number(day.date.slice(5, 7))] ||= []).push(day);
  document.getElementById('month-grid').innerHTML =
    calendar.months.map((month) => renderMonthCard(month, byMonth[month.month] || [])).join('');
}

async function loadCalendar() {
  if (!planningYear) return;
  const request = ++calendarRequest;
  try {
    const calendar = await api(`/api/calendar?year=${planningYear}`);
    if (request !== calendarRequest) return;
    renderCalendar(calendar);
    showCalendarMessage('');
  } catch (error) {
    if (request !== calendarRequest) return;
    console.error('Loading the calendar failed:', error);
    showCalendarMessage(`Couldn't load the calendar: ${error.message}`, 'error');
  }
}

// ---- Activity library ----

const CATEGORY_LABELS = {
  nature: 'Nature', culture: 'Culture', city: 'City', beach: 'Beach',
  snow: 'Snow', wildlife: 'Wildlife', festival: 'Festival',
};

let activitiesRequest = 0; // ignore replies from older searches
let activitiesSearchTimer = null;

function showActivitiesMessage(text, kind = '') {
  const message = document.getElementById('activities-message');
  message.textContent = text;
  message.className = `form-message ${kind ? `form-message-${kind}` : ''}`;
}

// Formats 'MM-DD' as e.g. '25 Mar' by splitting the string (no date maths here).
function formatMonthDay(monthDay) {
  const [month, day] = String(monthDay).split('-');
  if (!month || !day) return monthDay;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1].slice(0, 3)}`;
}

function renderActivityCard(activity) {
  const months = (activity.best_months || []).map((m) => MONTH_NAMES[m - 1]?.slice(0, 3) || m).join(', ');
  return `
    <article class="card activity-card" data-id="${escapeHtml(activity.id)}">
      <header>
        <span class="badge badge-category">${escapeHtml(CATEGORY_LABELS[activity.category] || activity.category)}</span>
        <h3 class="activity-name">${escapeHtml(activity.name)}</h3>
        <p class="activity-place">${escapeHtml(activity.country)} · ${escapeHtml(activity.region)}</p>
      </header>
      <dl class="activity-facts">
        <div><dt>Best months</dt><dd>${escapeHtml(months)}</dd></div>
        <div><dt>Peak</dt><dd>${escapeHtml(formatMonthDay(activity.peak_start))} to ${escapeHtml(formatMonthDay(activity.peak_end))}</dd></div>
        <div><dt>Typical trip</dt><dd>${escapeHtml(plural(activity.typical_days, 'day'))}</dd></div>
      </dl>
      <p class="activity-tips">${escapeHtml(activity.tips)}</p>
      <p class="activity-crowd"><strong>Crowds:</strong> ${escapeHtml(activity.crowd_note)}</p>
      <div class="form-actions">
        <button type="button" class="button activity-plan">Plan this</button>
        <p class="form-message card-message" role="status"></p>
      </div>
    </article>`;
}

function renderActivities(activities) {
  const list = document.getElementById('activity-list');
  list.innerHTML = activities.length
    ? activities.map(renderActivityCard).join('')
    : '<p class="placeholder">No activities match. Try a different search or category.</p>';
  document.getElementById('activities-count').textContent =
    `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} found`;
}

async function loadActivities() {
  const q = document.getElementById('activity-search').value.trim();
  const category = document.getElementById('activity-category').value;
  const request = ++activitiesRequest;
  const params = new URLSearchParams({ q, category });
  try {
    const activities = await api(`/api/activities?${params}`);
    if (request !== activitiesRequest) return;
    renderActivities(activities);
    showActivitiesMessage('');
  } catch (error) {
    if (request !== activitiesRequest) return;
    console.error('Loading activities failed:', error);
    showActivitiesMessage(`Couldn't load the activity library: ${error.message}`, 'error');
  }
}

function onActivitySearchInput() {
  clearTimeout(activitiesSearchTimer);
  activitiesSearchTimer = setTimeout(loadActivities, 250);
}

function scrollToTrip(id) {
  const card = document.querySelector(`.trip-card[data-id="${CSS.escape(String(id))}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('trip-card-new');
  setTimeout(() => card.classList.remove('trip-card-new'), 2500);
}

async function onActivityListClick(event) {
  if (!event.target.classList.contains('activity-plan')) return;
  const card = event.target.closest('.activity-card');
  const button = event.target;
  if (!planningYear) {
    showCardMessage(card, "Your settings haven't loaded, so the planning year is unknown.", 'error');
    return;
  }
  button.disabled = true;
  showCardMessage(card, 'Planning…');
  try {
    const trip = await api(`/api/trips/from-activity/${encodeURIComponent(card.dataset.id)}`, {
      method: 'POST', body: JSON.stringify({ year: planningYear }),
    });
    showCardMessage(card, `Added to your ${planningYear} trips.`, 'ok');
    await loadTrips();
    showTripsMessage(`Added "${trip.title}" from the activity library.`, 'ok');
    scrollToTrip(trip.id);
  } catch (error) {
    console.error('Planning activity failed:', error);
    showCardMessage(card, `Couldn't plan this: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

// ---- Ask your AI (copy-prompt flow) ----

function showAiMessage(id, text, kind = '') {
  const message = document.getElementById(id);
  message.textContent = text;
  message.className = `form-message ${kind ? `form-message-${kind}` : ''}`;
}

async function buildPrompt(event) {
  event.preventDefault();
  const wish = document.getElementById('ai-wish').value.trim();
  if (!wish) {
    showAiMessage('ai-prompt-message', 'Please type a wish first.', 'error');
    return;
  }
  if (!planningYear) {
    showAiMessage('ai-prompt-message', "Your settings haven't loaded, so the planning year is unknown.", 'error');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const output = document.getElementById('ai-prompt');
  button.disabled = true;
  showAiMessage('ai-prompt-message', 'Building the prompt…');
  try {
    const { prompt } = await api('/api/prompt', { method: 'POST', body: JSON.stringify({ wish, year: planningYear }) });
    output.value = prompt;
    showAiMessage('ai-prompt-message', 'Prompt ready. Copy it into your AI chat.', 'ok');
  } catch (error) {
    console.error('Building the prompt failed:', error);
    showAiMessage('ai-prompt-message', `Couldn't build the prompt: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    document.getElementById('ai-prompt-output').hidden = !output.value;
  }
}

async function copyPrompt() {
  const output = document.getElementById('ai-prompt');
  try {
    await navigator.clipboard.writeText(output.value);
    showAiMessage('ai-copy-message', 'Copied.', 'ok');
  } catch (error) {
    // Clipboard access can be blocked: select the text so Ctrl+C (or Cmd+C) works instead.
    output.focus();
    output.select();
    showAiMessage('ai-copy-message', 'Press Ctrl+C (Cmd+C on a Mac) to copy the selected prompt.');
  }
}

async function createTripFromJson(event) {
  event.preventDefault();
  const text = document.getElementById('ai-reply').value.trim();
  const saveToLibrary = document.getElementById('ai-save').checked;
  if (!text) {
    showAiMessage('ai-reply-message', "Please paste your AI's reply first.", 'error');
    return;
  }
  if (!planningYear) {
    showAiMessage('ai-reply-message', "Your settings haven't loaded, so the planning year is unknown.", 'error');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  showAiMessage('ai-reply-message', 'Creating the trip…');
  try {
    const { trip } = await api('/api/trips/from-json', {
      method: 'POST', body: JSON.stringify({ text, year: planningYear, save_to_library: saveToLibrary }),
    });
    showAiMessage('ai-reply-message',
      `Created "${trip.title}"${saveToLibrary ? ' and saved it to the activity library' : ''}.`, 'ok');
    document.getElementById('ai-reply').value = '';
    await loadTrips();
    if (saveToLibrary) loadActivities();
    showTripsMessage(`Added "${trip.title}" from your AI's reply.`, 'ok');
    scrollToTrip(trip.id);
  } catch (error) {
    console.error('Creating a trip from JSON failed:', error);
    showAiMessage('ai-reply-message', `Couldn't create the trip: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

// ---- Holiday sync ----

// Fetches WA and China holidays for the planning year. Source errors are normal when offline.
async function syncHolidays() {
  if (!planningYear) return;
  const button = document.getElementById('holidays-sync');
  const message = document.getElementById('sync-message');
  button.disabled = true;
  message.textContent = `Syncing holidays for ${planningYear}…`;
  message.className = 'form-message';
  try {
    const result = await api('/api/holidays/sync', { method: 'POST', body: JSON.stringify({ year: planningYear }) });
    const summary = `Added ${result.added}, updated ${result.updated}, removed ${result.removed ?? 0}.`;
    const problems = (result.errors || []).map((e) => e.message).join(' ');
    message.textContent = problems ? `${summary} Some sources couldn't be reached: ${problems}` : `Holidays synced. ${summary}`;
    message.className = `form-message ${problems ? 'form-message-warn' : 'form-message-ok'}`;
    await loadTrips(); // also reloads the calendar
  } catch (error) {
    console.error('Holiday sync failed:', error);
    message.textContent = `Couldn't sync holidays: ${error.message}`;
    message.className = 'form-message form-message-error';
  } finally {
    button.disabled = false;
  }
}

// ---- Planning year ----

// Moving the year by one is simple arithmetic on the year number, not date maths.
function changeYear(step) {
  if (!planningYear) return;
  planningYear += step;
  loadTrips(); // also reloads the calendar
}

function renderYear() {
  document.getElementById('year-label').textContent = planningYear ?? '';
  document.getElementById('trips-year').textContent = planningYear ? `Trips for ${planningYear}` : '';
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

document.getElementById('settings-form').addEventListener('submit', saveSettings);
const tripList = document.getElementById('trip-list');
tripList.addEventListener('change', onTripListChange);
tripList.addEventListener('submit', onTripListSubmit);
tripList.addEventListener('click', onTripListClick);
document.getElementById('add-trip-form').addEventListener('submit', addTrip);
document.getElementById('year-prev').addEventListener('click', () => changeYear(-1));
document.getElementById('year-next').addEventListener('click', () => changeYear(1));
document.getElementById('holidays-sync').addEventListener('click', syncHolidays);
document.getElementById('activity-search').addEventListener('input', onActivitySearchInput);
document.getElementById('activity-category').addEventListener('change', loadActivities);
document.getElementById('activity-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadActivities();
});
document.getElementById('activity-list').addEventListener('click', onActivityListClick);
document.getElementById('ai-prompt-form').addEventListener('submit', buildPrompt);
document.getElementById('ai-copy').addEventListener('click', copyPrompt);
document.getElementById('ai-reply-form').addEventListener('submit', createTripFromJson);

checkServer();
loadSettings();
loadActivities();
