// GET /api/activities?q=&category=: the activity library, searchable by name,
// country and region, filterable by category. Empty params mean "all".

const express = require('express');
const { db } = require('../db');

const router = express.Router();

const CATEGORIES = ['nature', 'culture', 'city', 'beach', 'snow', 'wildlife', 'festival'];

// Activity row -> API shape (best_months back to an array)
function toActivity(row) {
  return { ...row, best_months: JSON.parse(row.best_months) };
}

function activityById(id) {
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  return row ? toActivity(row) : null;
}

router.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of ${CATEGORIES.join(', ')}.` });
  }
  const where = [];
  const params = [];
  if (q) {
    // instr rather than LIKE, so % and _ in the search text are matched literally
    where.push('(instr(lower(name), ?) > 0 OR instr(lower(country), ?) > 0 OR instr(lower(region), ?) > 0)');
    params.push(q, q, q);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const sql = `SELECT * FROM activities ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name`;
  res.json(db.prepare(sql).all(...params).map(toActivity));
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
module.exports.activityById = activityById;
