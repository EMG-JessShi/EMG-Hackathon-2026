// Holiday Optimiser: Express server. Serves the front end from public/ and the API under /api.

const path = require('node:path');
const express = require('express');
require('./db'); // opens the database and creates tables on start

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // only this computer can reach the app

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/health', require('./routes/health'));

// Unknown API routes return JSON rather than the HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
});

// Client mistakes (e.g. malformed JSON) keep their 4xx status and message
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

// Express 5 passes startup errors (such as the port being taken) to this callback
app.listen(PORT, HOST, (error) => {
  if (error) {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use. Stop the other server (Ctrl+C in its window) or use a different port (see README).`
        : error
    );
    process.exit(1);
  }
  console.log(`Holiday Optimiser is running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
