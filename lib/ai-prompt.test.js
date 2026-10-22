const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, parseAiReply } = require('./ai-prompt');

const GOOD = {
  id: 'beijing-autumn-leaves',
  name: 'Beijing autumn leaves',
  country: 'China',
  region: 'East Asia',
  category: 'nature',
  best_months: [10, 11],
  peak_start: '10-20',
  peak_end: '11-10',
  typical_days: 7,
  tips: 'Fragrant Hills is best in late October.',
  crowd_note: 'Avoid National Day week.',
};

test('parseAiReply accepts plain JSON', () => {
  assert.deepEqual(parseAiReply(JSON.stringify(GOOD)).activity, GOOD);
});

test('parseAiReply strips code fences and surrounding text', () => {
  const text = `Sure! Here it is:\n\`\`\`json\n${JSON.stringify(GOOD, null, 2)}\n\`\`\`\nEnjoy.`;
  assert.deepEqual(parseAiReply(text).activity, GOOD);
});

test('parseAiReply ignores extra fields', () => {
  assert.deepEqual(parseAiReply(JSON.stringify({ ...GOOD, budget: 'high' })).activity, GOOD);
});

test('parseAiReply rejects bad replies with clear messages', () => {
  const bad = (change) => JSON.stringify({ ...GOOD, ...change });
  assert.throws(() => parseAiReply(''), /Paste the reply/);
  assert.throws(() => parseAiReply('no json here'), /No JSON object/);
  assert.throws(() => parseAiReply('{ "id": }'), /not valid JSON/);
  assert.throws(() => parseAiReply(JSON.stringify({ name: 'x' })), /missing: id, country/);
  assert.throws(() => parseAiReply(bad({ category: 'food' })), /category/);
  assert.throws(() => parseAiReply(bad({ best_months: [0, 13] })), /best_months/);
  assert.throws(() => parseAiReply(bad({ best_months: [] })), /best_months/);
  assert.throws(() => parseAiReply(bad({ peak_start: '2027-10-20' })), /peak_start/);
  assert.throws(() => parseAiReply(bad({ peak_end: '02-30' })), /peak_end/);
  assert.throws(() => parseAiReply(bad({ typical_days: 7.5 })), /typical_days/);
  assert.throws(() => parseAiReply(bad({ id: 'Beijing Leaves!' })), /"id"/);
  assert.throws(() => parseAiReply(bad({ name: '  ' })), /"name"/);
});

test('parseAiReply accepts 02-29', () => {
  assert.equal(parseAiReply(JSON.stringify({ ...GOOD, peak_end: '02-29' })).activity.peak_end, '02-29');
});

test('buildPrompt includes the wish, balance, joined holiday ranges and the fields', () => {
  const prompt = buildPrompt({
    wish: 'see autumn leaves in Beijing',
    settings: { hours_per_day: 7.6, accrual_hours_per_workday: 0.5846 },
    balance: { hours: 61.2, days: 8 },
    year: 2027,
    holidays: [
      { date: '2027-04-10', name: 'WA school holidays', country: 'AU', type: 'school', is_estimate: 0 },
      { date: '2027-04-11', name: 'WA school holidays', country: 'AU', type: 'school', is_estimate: 0 },
      { date: '2027-10-01', name: 'National Day', country: 'CN', type: 'cn_holiday', is_estimate: 1 },
      { date: '2027-07-01', name: 'China summer school holidays (estimate)', country: 'CN', type: 'school', is_estimate: 1 },
    ],
    trips: [{ title: 'Easter', break: { start: '2027-03-26', end: '2027-04-04', leave_used: 4 } }],
  });
  assert.match(prompt, /My wish: see autumn leaves in Beijing/);
  assert.match(prompt, /61\.2 hours, which is 8 whole days/);
  assert.match(prompt, /2027-04-10 to 2027-04-11: WA school holidays/);
  assert.match(prompt, /2027-10-01: National Day \(estimate\)/);
  assert.match(prompt, /2027-07-01: China summer school holidays \(estimate\)\n/);
  assert.match(prompt, /Easter: 2027-03-26 to 2027-04-04/);
  assert.match(prompt, /typical_days/);
});

test('buildPrompt uses "day" for exactly 1', () => {
  const prompt = buildPrompt({
    wish: 'a short trip',
    settings: { hours_per_day: 7.6, accrual_hours_per_workday: 0.5846 },
    balance: { hours: 7.6, days: 1 },
    year: 2027,
    holidays: [],
    trips: [{ title: 'Long weekend', break: { start: '2027-06-05', end: '2027-06-08', leave_used: 1 } }],
  });
  assert.match(prompt, /which is 1 whole day \(/);
  assert.match(prompt, /\(1 leave day\)/);
});
