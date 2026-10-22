// "Ask your AI" copy-prompt flow. The app never calls an AI itself: buildPrompt makes
// text for the user to paste into their own AI chat, and parseAiReply checks the reply
// they paste back. This is the one module to swap for a Claude API call later.
// Pure functions only.

const { addDays, isValidDate } = require('./dates');

const CATEGORIES = ['nature', 'culture', 'city', 'beach', 'snow', 'wildlife', 'festival'];
const FIELDS = [
  'id', 'name', 'country', 'region', 'category', 'best_months',
  'peak_start', 'peak_end', 'typical_days', 'tips', 'crowd_note',
];

const EXAMPLE = {
  id: 'japan-cherry-blossom',
  name: 'Japan cherry blossom',
  country: 'Japan',
  region: 'East Asia',
  category: 'nature',
  best_months: [3, 4],
  peak_start: '03-25',
  peak_end: '04-10',
  typical_days: 10,
  tips: 'Tokyo and Kyoto usually peak from late March to early April. Keep dates flexible.',
  crowd_note: "Very busy with domestic and international visitors. Early April can overlap China's Qingming break.",
};

// Holiday rows (one per date) -> "2027-04-10 to 2027-04-25 WA school holidays" lines,
// joining consecutive dates with the same name and type.
function holidayLines(holidays) {
  const sorted = [...holidays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const runs = [];
  for (const h of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.name === h.name && last.type === h.type && addDays(last.end, 1) === h.date) {
      last.end = h.date;
    } else {
      runs.push({ name: h.name, type: h.type, start: h.date, end: h.date, estimate: Boolean(h.is_estimate) });
    }
  }
  return runs.map(
    (r) => `- ${r.start === r.end ? r.start : `${r.start} to ${r.end}`}: ${r.name}${r.estimate && !/estimate/i.test(r.name) ? ' (estimate)' : ''}`
  );
}

function section(title, lines) {
  return `${title}:\n${lines.length ? lines.join('\n') : '- none on record'}`;
}

// wish: the user's text. settings: the settings row. balance: { hours, days } today.
// holidays: holiday rows for the planning year. year: the planning year.
// trips (optional): enabled trips with their break, so the AI avoids clashes.
function buildPrompt({ wish, settings, balance, holidays, year, trips = [] }) {
  const of = (country, type) => holidays.filter((h) => h.country === country && h.type === type);
  const planned = trips
    .filter((t) => t.break)
    .map((t) => `- ${t.title}: ${t.break.start} to ${t.break.end} (${t.break.leave_used} leave days)`);

  return [
    'I live in Perth, Western Australia, and I am planning annual leave for a holiday.',
    `My wish: ${wish}`,
    '',
    `Planning year: ${year}`,
    `My leave balance today: ${balance.hours} hours, which is ${balance.days} whole days ` +
      `(1 day = ${settings.hours_per_day} hours). I earn about ${settings.accrual_hours_per_workday} ` +
      'hours of leave for every weekday.',
    '',
    section('Trips I have already planned', planned),
    '',
    section(`WA public holidays in ${year} (free days for me)`, holidayLines(of('AU', 'public'))),
    '',
    section(`WA school holidays in ${year} (busy in Australia)`, holidayLines(of('AU', 'school'))),
    '',
    section(`China public holidays in ${year} (busy in Asia)`, holidayLines(of('CN', 'cn_holiday'))),
    '',
    section(`China school holidays in ${year} (busy in Asia)`, holidayLines(of('CN', 'school'))),
    '',
    'Suggest the one destination and activity that best fits my wish, and the best season for it,',
    'avoiding the busiest crowd periods where you can.',
    '',
    'Reply with ONLY a JSON object, no other text, using exactly these fields:',
    '- id: short lowercase slug with hyphens, e.g. "japan-cherry-blossom"',
    '- name: short name of the activity',
    '- country: country name in English',
    '- region: world region, e.g. "East Asia", "Europe", "Oceania"',
    `- category: one of ${CATEGORIES.map((c) => `"${c}"`).join(', ')}`,
    '- best_months: array of month numbers (1 to 12)',
    '- peak_start: start of the best season as "MM-DD"',
    '- peak_end: end of the best season as "MM-DD" (may be earlier than peak_start if the season runs over New Year)',
    '- typical_days: whole number of days a typical trip takes, including travel',
    '- tips: one or two sentences of practical tips',
    '- crowd_note: one sentence on when it is busy',
    '',
    'Example:',
    JSON.stringify(EXAMPLE, null, 2),
  ].join('\n');
}

// Takes the JSON out of a pasted reply: inside a ``` code fence if there is one,
// otherwise from the first { to the last }.
function extractJson(text) {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end < start) {
    throw new Error('No JSON object found in the reply. Paste the whole reply from your AI, including the { and }.');
  }
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new Error('The reply is not valid JSON. Ask your AI to reply with only the JSON object, then paste it again.');
  }
}

function checkText(value, field, max) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`"${field}" must be some text.`);
  if (value.trim().length > max) throw new Error(`"${field}" must be ${max} characters or fewer.`);
  return value.trim();
}

function checkMonthDay(value, field) {
  // 2028 is a leap year, so 02-29 is accepted
  if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value) || !isValidDate(`2028-${value}`)) {
    throw new Error(`"${field}" must be a month and day as "MM-DD", e.g. "03-25".`);
  }
  return value;
}

// Pasted AI reply -> { activity } with every activities field checked.
// Throws Error('clear message') if anything is missing or wrong. Extra fields are ignored.
function parseAiReply(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error('Paste the reply from your AI first.');
  const data = extractJson(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The reply must be a single JSON object, not a list.');
  }
  const missing = FIELDS.filter((f) => data[f] === undefined || data[f] === null);
  if (missing.length > 0) throw new Error(`The reply is missing: ${missing.join(', ')}.`);

  const id = checkText(data.id, 'id', 60).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error('"id" must be lowercase letters and numbers joined by hyphens, e.g. "japan-cherry-blossom".');
  }
  if (!CATEGORIES.includes(data.category)) {
    throw new Error(`"category" must be one of ${CATEGORIES.join(', ')}.`);
  }
  const months = data.best_months;
  if (
    !Array.isArray(months) ||
    months.length === 0 ||
    !months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12) ||
    new Set(months).size !== months.length
  ) {
    throw new Error('"best_months" must be a list of different month numbers from 1 to 12, e.g. [3, 4].');
  }
  if (!Number.isInteger(data.typical_days) || data.typical_days < 1 || data.typical_days > 60) {
    throw new Error('"typical_days" must be a whole number from 1 to 60.');
  }
  if (typeof data.tips !== 'string' || typeof data.crowd_note !== 'string') {
    throw new Error('"tips" and "crowd_note" must be text.');
  }

  return {
    activity: {
      id,
      name: checkText(data.name, 'name', 100),
      country: checkText(data.country, 'country', 100),
      region: checkText(data.region, 'region', 100),
      category: data.category,
      best_months: months,
      peak_start: checkMonthDay(data.peak_start, 'peak_start'),
      peak_end: checkMonthDay(data.peak_end, 'peak_end'),
      typical_days: data.typical_days,
      tips: data.tips.trim().slice(0, 1000),
      crowd_note: data.crowd_note.trim().slice(0, 1000),
    },
  };
}

module.exports = { buildPrompt, parseAiReply };
