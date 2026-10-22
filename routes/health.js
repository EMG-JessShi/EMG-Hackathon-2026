// GET /api/health: lets the front end check the server and database are up.

const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  res.json({
    status: 'ok',
    tables: {
      settings: count('settings'),
      trips: count('trips'),
      holidays: count('holidays'),
      activities: count('activities'),
    },
  });
});

module.exports = router;
