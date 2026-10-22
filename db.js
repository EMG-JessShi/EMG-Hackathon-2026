// Opens the local SQLite database, creates the tables and seeds default settings.

const fs = require('node:fs');
const path = require('node:path');
const { toPerthDateString, eachDate } = require('./lib/dates');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  console.error(
    `Holiday Optimiser needs Node.js 24 or newer (you have ${process.version}).\n` +
      'Download the LTS version from https://nodejs.org and try again.'
  );
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'holiday.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance_hours REAL NOT NULL DEFAULT 0,
    balance_as_of TEXT NOT NULL,
    accrual_hours_per_workday REAL NOT NULL DEFAULT 0.5846,
    hours_per_day REAL NOT NULL DEFAULT 7.6
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT NOT NULL,
    category TEXT NOT NULL
      CHECK (category IN ('nature', 'culture', 'city', 'beach', 'snow', 'wildlife', 'festival')),
    best_months TEXT NOT NULL,
    peak_start TEXT NOT NULL,
    peak_end TEXT NOT NULL,
    typical_days INTEGER NOT NULL,
    tips TEXT,
    crowd_note TEXT
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('preset', 'custom', 'activity', 'ai')),
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    leave_days INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    activity_id TEXT REFERENCES activities(id),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL CHECK (country IN ('AU', 'CN')),
    type TEXT NOT NULL CHECK (type IN ('public', 'school', 'cn_holiday', 'cn_workday')),
    is_estimate INTEGER NOT NULL DEFAULT 0,
    UNIQUE (date, country, type)
  );
`;

function seedDefaultSettings(db) {
  db.prepare('INSERT OR IGNORE INTO settings (id, balance_as_of) VALUES (1, ?)').run(
    toPerthDateString(new Date())
  );
}

// Seeds school holidays and estimated China holidays from data/holidays-seed.json.
// A group (country, type, year) is skipped once synced (non-estimate) rows exist
// for it, so estimates never come back after a sync has replaced them.
function seedHolidays(db) {
  const { ranges } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'holidays-seed.json'), 'utf8'));
  const hasSyncedRows = db.prepare(
    `SELECT 1 FROM holidays
     WHERE country = ? AND type = ? AND substr(date, 1, 4) = ? AND is_estimate = 0 LIMIT 1`
  );
  const insert = db.prepare(
    'INSERT OR IGNORE INTO holidays (date, name, country, type, is_estimate) VALUES (?, ?, ?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    for (const r of ranges) {
      if (r.is_estimate && hasSyncedRows.get(r.country, r.type, r.start.slice(0, 4))) continue;
      for (const date of eachDate(r.start, r.end)) {
        insert.run(date, r.name, r.country, r.type, r.is_estimate);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function openDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  seedDefaultSettings(db);
  seedHolidays(db);
  return db;
}

const db = openDatabase();

module.exports = { db, DB_PATH };
