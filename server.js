// Holiday Optimiser: Express server. Serves the front end from public/ and the API under /api.

const path = require('node:path');
const express = require('express');
require('./db'); // opens the database and creates tables on start

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/health', require('./routes/health'));

// Unknown API routes return JSON rather than the HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Holiday Optimiser is running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
