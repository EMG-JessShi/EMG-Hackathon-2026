// POST /api/holidays/sync: fetches WA public holidays (Nager.Date) and China holidays
// (holiday-cn) and upserts them into the holidays table. This is the only place the
// app calls external APIs (rule 7); a source that is down is reported, never a crash.

const express = require('express');
const { db } = require('../db');
const { toPerthDateString, defaultPlanningYear } = require('../lib/dates');

const router = express.Router();

const FETCH_TIMEOUT_MS = 10000;
const nagerUrl = (year) => `https://date.nager.at/api/v3/PublicHolidays/${year}/AU`;
const holidayCnUrl = (year) =>
  `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`;

// Australian names for the few Nager.Date entries that use other wording (rule 1)
const AU_NAMES = { "St. Stephen's Day": 'Boxing Day' };

// holiday-cn names are in Chinese; the UI is in English (rule 1)
const CN_NAMES = {
  元旦: "New Year's Day",
  春节: 'Spring Festival',
  清明节: 'Qingming Festival',
  劳动节: 'May Day',
  端午节: 'Dragon Boat Festival',
  中秋节: 'Mid-Autumn Festival',
  国庆节: 'National Day',
  '国庆节、中秋节': 'National Day and Mid-Autumn Festival',
};

// `missing` is returned for a 404 (holiday-cn has no file until a year is announced)
async function fetchJson(url, missing) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error(`No reply from ${url} within 10 seconds.`);
    throw new Error(`Could not reach ${url}. Check your internet connection.`);
  }
  if (response.status === 404 && missing !== undefined) return missing;
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

// Nager.Date list -> WA public holiday rows (global, or counties includes AU-WA)
function parseNager(list) {
  if (!Array.isArray(list)) throw new Error('Unexpected reply from Nager.Date');
  return list
    .filter((h) => h.global || (h.counties || []).includes('AU-WA'))
    .map((h) => ({
      date: h.date,
      name: AU_NAMES[h.name] || h.name,
      country: 'AU',
      type: 'public',
    }));
}

// holiday-cn file -> China holiday and make-up workday rows (empty until announced)
function parseHolidayCn(file) {
  if (!file || !Array.isArray(file.days)) throw new Error('Unexpected reply from holiday-cn');
  return file.days.map((d) => {
    const name = CN_NAMES[d.name] || 'China public holiday';
    return d.isOffDay
      ? { date: d.date, name, country: 'CN', type: 'cn_holiday' }
      : { date: d.date, name: `Make-up workday (${name})`, country: 'CN', type: 'cn_workday' };
  });
}

// Writes one source's rows for one year in a transaction. `replaceTypes` rows of that
// year that the source no longer lists (including seeded estimates) are removed.
function saveRows(rows, year, country, replaceTypes, counts) {
  const find = db.prepare(
    'SELECT id, name, is_estimate FROM holidays WHERE date = ? AND country = ? AND type = ?'
  );
  const insert = db.prepare(
    'INSERT INTO holidays (date, name, country, type, is_estimate) VALUES (?, ?, ?, ?, 0)'
  );
  const update = db.prepare('UPDATE holidays SET name = ?, is_estimate = 0 WHERE id = ?');
  const listYear = db.prepare(
    'SELECT id, date FROM holidays WHERE country = ? AND type = ? AND substr(date, 1, 4) = ?'
  );
  const remove = db.prepare('DELETE FROM holidays WHERE id = ?');

  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const existing = find.get(row.date, row.country, row.type);
      if (!existing) {
        insert.run(row.date, row.name, row.country, row.type);
        counts.added++;
      } else if (existing.name !== row.name || existing.is_estimate !== 0) {
        update.run(row.name, existing.id);
        counts.updated++;
      }
    }
    for (const type of replaceTypes) {
      const kept = new Set(rows.filter((r) => r.type === type).map((r) => r.date));
      for (const old of listYear.all(country, type, String(year))) {
        if (!kept.has(old.date)) {
          remove.run(old.id);
          counts.removed++;
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function syncHolidays(year) {
  const counts = { added: 0, updated: 0, removed: 0 };
  const errors = [];
  // Fetch the next year too: trips can cross into it, and holiday-cn may put
  // late-December dates in the next year's file.
  const years = [year, year + 1];

  for (const y of years) {
    try {
      const rows = parseNager(await fetchJson(nagerUrl(y))).filter((r) => r.date.startsWith(`${y}-`));
      // An empty list means something is wrong upstream, so keep the old data
      if (rows.length > 0) saveRows(rows, y, 'AU', ['public'], counts);
    } catch (error) {
      errors.push({ source: `Nager.Date ${y}`, message: error.message });
    }
  }

  const cnRows = [];
  const announced = new Set(); // years whose own holiday-cn file has dates
  for (const y of years) {
    try {
      const rows = parseHolidayCn(await fetchJson(holidayCnUrl(y), { days: [] }));
      if (rows.length > 0) announced.add(y);
      cnRows.push(...rows);
    } catch (error) {
      errors.push({ source: `holiday-cn ${y}`, message: error.message });
    }
  }
  // Group by the year each date falls in. A year that has been announced replaces its
  // rows (seeded estimates included); otherwise only add, keeping the estimates.
  for (const y of new Set(cnRows.map((r) => Number(r.date.slice(0, 4))))) {
    const rows = cnRows.filter((r) => r.date.startsWith(`${y}-`));
    saveRows(rows, y, 'CN', announced.has(y) ? ['cn_holiday', 'cn_workday'] : [], counts);
  }

  return { ok: errors.length === 0, ...counts, errors };
}

router.post('/sync', async (req, res) => {
  let year = req.body?.year;
  if (year === undefined || year === null) {
    year = defaultPlanningYear(toPerthDateString(new Date()));
  } else if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Year must be a whole number such as 2027.' });
  }
  res.json(await syncHolidays(year));
});

module.exports = router;
