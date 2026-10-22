// Trips: GET/POST /api/trips, PUT/DELETE /api/trips/:id. Every trip comes back in the
// same shape (docs/api.md "Trip"), with its longest break and the projected balance
// on its start date. The maths is in lib/ (rule 5); this file loads and saves rows.

const express = require('express');
const { db } = require('../db');
const { toPerthDateString, isValidDate, defaultPlanningYear } = require('../lib/dates');
const { balanceOn } = require('../lib/leave');
const { buildFreeDates, longestBreak } = require('../lib/breaks');
const { pickPresetTrips } = require('../lib/presets');

const router = express.Router();

const TRIP_COLUMNS = 'id, title, source, range_start, range_end, leave_days, enabled, activity_id, notes';

function readSettings() {
  return db
    .prepare(
      'SELECT balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day FROM settings WHERE id = 1'
    )
    .get();
}

function publicHolidays() {
  return db
    .prepare("SELECT date, name FROM holidays WHERE country = 'AU' AND type = 'public' ORDER BY date")
    .all();
}

// Adds break, balance_on_start and short to trip rows. Needs every trip, since
// the leave of all enabled trips (any year) comes off the rolling balance (rule 4).
function decorateTrips(rows) {
  const settings = readSettings();
  const holidayDates = publicHolidays().map((h) => h.date);
  const freeDatesByYear = new Map();
  const freeDatesFor = (year) => {
    if (!freeDatesByYear.has(year)) freeDatesByYear.set(year, buildFreeDates(year, holidayDates));
    return freeDatesByYear.get(year);
  };

  const withBreaks = rows.map((row) => ({
    row,
    brk: longestBreak({
      rangeStart: row.range_start,
      rangeEnd: row.range_end,
      leaveDays: row.leave_days,
      freeDates: freeDatesFor(Number(row.range_start.slice(0, 4))),
    }),
  }));
  // Disabled trips still show a break and balance, but their leave isn't deducted
  const leaveDates = withBreaks
    .filter(({ row, brk }) => row.enabled && brk)
    .flatMap(({ brk }) => brk.leave_dates)
    .sort();

  return withBreaks.map(({ row, brk }) => {
    const balance = balanceOn(brk ? brk.start : row.range_start, settings, leaveDates);
    return {
      id: row.id,
      title: row.title,
      source: row.source,
      range_start: row.range_start,
      range_end: row.range_end,
      leave_days: row.leave_days,
      enabled: Boolean(row.enabled),
      activity_id: row.activity_id,
      notes: row.notes ?? '',
      break: brk,
      balance_on_start: balance,
      short: brk ? balance.days < brk.leave_used : false,
    };
  });
}

function allTripRows() {
  return db.prepare(`SELECT ${TRIP_COLUMNS} FROM trips ORDER BY range_start, id`).all();
}

// One trip in the full Trip shape, or null if there is no such trip
function tripById(id) {
  return decorateTrips(allTripRows()).find((t) => t.id === id) ?? null;
}

// Creates the 2 presets for `year` if none exist yet. Without synced WA public
// holidays there are no clusters, so nothing is created until a sync.
function ensurePresets(year) {
  const existing = db
    .prepare("SELECT COUNT(*) AS n FROM trips WHERE source = 'preset' AND substr(range_start, 1, 4) = ?")
    .get(String(year)).n;
  if (existing > 0) return;
  const holidays = publicHolidays();
  const presets = pickPresetTrips({
    year,
    publicHolidays: holidays,
    freeDates: buildFreeDates(year, holidays.map((h) => h.date)),
  });
  const insert = db.prepare(
    "INSERT INTO trips (title, source, range_start, range_end, leave_days, enabled, notes) VALUES (?, 'preset', ?, ?, ?, 1, '')"
  );
  for (const p of presets) insert.run(p.title, p.range_start, p.range_end, p.leave_days);
}

function parseYear(value) {
  if (value === undefined || value === '') return defaultPlanningYear(toPerthDateString(new Date()));
  const year = Number(value);
  if (!/^\d{4}$/.test(String(value)) || year < 2000 || year > 2100) return null;
  return year;
}

// Checks a full set of trip fields. Returns an error message or null.
function tripError(t) {
  if (typeof t.title !== 'string' || t.title.trim() === '') return 'Title is required.';
  if (t.title.length > 200) return 'Title must be 200 characters or fewer.';
  if (!isValidDate(t.range_start)) return 'Start date must be a real date in YYYY-MM-DD format.';
  if (!isValidDate(t.range_end)) return 'End date must be a real date in YYYY-MM-DD format.';
  if (t.range_end < t.range_start) return 'End date must be on or after the start date.';
  // Free days are known for the start year and the next one only (lib/breaks buildFreeDates)
  if (Number(t.range_end.slice(0, 4)) > Number(t.range_start.slice(0, 4)) + 1) {
    return 'A trip can run into the next year but no further.';
  }
  if (!Number.isInteger(t.leave_days) || t.leave_days < 0) {
    return 'Leave days must be a whole number of 0 or more.';
  }
  if (t.leave_days > 365) return 'Leave days must be 365 or fewer.';
  if (typeof t.enabled !== 'boolean') return 'Enabled must be true or false.';
  if (typeof t.notes !== 'string') return 'Notes must be text.';
  return null;
}

function parseId(value) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

router.get('/', (req, res) => {
  const year = parseYear(req.query.year);
  if (year === null) return res.status(400).json({ error: 'Year must be a whole number such as 2027.' });
  ensurePresets(year);
  // Trips that overlap the year, including ones that start late in the year before
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  res.json(decorateTrips(allTripRows()).filter((t) => t.range_start <= last && t.range_end >= first));
});

router.post('/', (req, res) => {
  const body = req.body ?? {};
  const trip = {
    title: typeof body.title === 'string' ? body.title.trim() : body.title,
    range_start: body.range_start,
    range_end: body.range_end,
    leave_days: body.leave_days,
    enabled: true,
    notes: body.notes ?? '',
  };
  const error = tripError(trip);
  if (error) return res.status(400).json({ error });
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO trips (title, source, range_start, range_end, leave_days, enabled, notes) VALUES (?, 'custom', ?, ?, ?, 1, ?)"
    )
    .run(trip.title, trip.range_start, trip.range_end, trip.leave_days, trip.notes);
  res.status(201).json(tripById(Number(lastInsertRowid)));
});

const EDITABLE = ['title', 'range_start', 'range_end', 'leave_days', 'enabled', 'notes'];

router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  const row = id === null ? null : db.prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: `No trip with id ${req.params.id}.` });
  const body = req.body ?? {};
  const fields = EDITABLE.filter((f) => f in body);
  if (fields.length === 0) {
    return res.status(400).json({ error: `Nothing to update. Send any of ${EDITABLE.join(', ')}.` });
  }
  const updated = { ...row, enabled: Boolean(row.enabled), notes: row.notes ?? '' };
  for (const f of fields) updated[f] = f === 'title' && typeof body.title === 'string' ? body.title.trim() : body[f];
  const error = tripError(updated);
  if (error) return res.status(400).json({ error });
  db.prepare(
    'UPDATE trips SET title = ?, range_start = ?, range_end = ?, leave_days = ?, enabled = ?, notes = ? WHERE id = ?'
  ).run(
    updated.title,
    updated.range_start,
    updated.range_end,
    updated.leave_days,
    updated.enabled ? 1 : 0,
    updated.notes,
    id
  );
  res.json(tripById(id));
});

router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  const { changes } = id === null ? { changes: 0 } : db.prepare('DELETE FROM trips WHERE id = ?').run(id);
  if (changes === 0) return res.status(404).json({ error: `No trip with id ${req.params.id}.` });
  res.status(204).end();
});

module.exports = router;
module.exports.tripById = tripById;
