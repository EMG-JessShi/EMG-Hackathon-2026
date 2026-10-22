// GET /api/settings and PUT /api/settings: the user's leave balance and accrual settings.

const express = require('express');
const { db } = require('../db');
const { toPerthDateString, isValidDate, defaultPlanningYear } = require('../lib/dates');
const { usableDays } = require('../lib/leave');

const router = express.Router();

const NUMBER_FIELDS = {
  // Negative is allowed: people can take leave in advance
  balance_hours: { label: 'Balance (hours)', allowZero: true, allowNegative: true },
  accrual_hours_per_workday: { label: 'Accrual per weekday (hours)', allowZero: true },
  hours_per_day: { label: 'Hours per day', allowZero: false },
};

function readSettings() {
  const row = db
    .prepare(
      'SELECT balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day FROM settings WHERE id = 1'
    )
    .get();
  return {
    balance_hours: row.balance_hours,
    balance_as_of: row.balance_as_of,
    accrual_hours_per_workday: row.accrual_hours_per_workday,
    hours_per_day: row.hours_per_day,
    balance_days: usableDays(row.balance_hours, row.hours_per_day),
    default_year: defaultPlanningYear(toPerthDateString(new Date())),
  };
}

// Returns { updates } or { error } for a PUT body
function validateUpdates(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send the settings as a JSON object.' };
  }
  const updates = {};
  for (const [field, { label, allowZero, allowNegative }] of Object.entries(NUMBER_FIELDS)) {
    if (!(field in body)) continue;
    const value = body[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { error: `${label} must be a number.` };
    }
    if (!allowNegative && (allowZero ? value < 0 : value <= 0)) {
      return { error: `${label} must be ${allowZero ? 'zero or more' : 'more than zero'}.` };
    }
    updates[field] = value;
  }
  if ('balance_as_of' in body) {
    if (!isValidDate(body.balance_as_of)) {
      return { error: 'Balance as-of date must be a real date in YYYY-MM-DD format.' };
    }
    updates.balance_as_of = body.balance_as_of;
  }
  if (Object.keys(updates).length === 0) {
    return {
      error:
        'Nothing to update. Send any of balance_hours, balance_as_of, accrual_hours_per_workday, hours_per_day.',
    };
  }
  return { updates };
}

router.get('/', (req, res) => {
  res.json(readSettings());
});

router.put('/', (req, res) => {
  const { updates, error } = validateUpdates(req.body);
  if (error) return res.status(400).json({ error });
  const fields = Object.keys(updates);
  db.prepare(`UPDATE settings SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = 1`).run(
    ...fields.map((f) => updates[f])
  );
  res.json(readSettings());
});

module.exports = router;
