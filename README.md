# EMG-Hackathon-2026
Workshop that teaches everyone about agentic development, speedrun a simple web app within 4 hours


## Holiday Optimiser

A personal web app for planning annual leave around public and school holidays. It runs locally on your computer. See `CLAUDE.md` for the full spec and `PROGRESS.md` for build status.

### Requirements

- [Node.js](https://nodejs.org) **24 or newer** (check with `node -v`)
- Git

### Run it locally

```bash
git clone https://github.com/EMG-JessShi/Holiday-Optimiser.git
cd Holiday-Optimiser
npm install
npm start
```

Then open http://localhost:3000 in your browser. Press `Ctrl+C` in the terminal to stop the server.

The database (`data/holiday.db`) is created automatically on first start. To start fresh, stop the server and delete that file.

### Other commands

- `npm run dev`: start the server and restart it automatically when you save a file
- `npm test`: run the tests
- Use a different port: `PORT=4000 npm start` (macOS/Linux) or `$env:PORT=4000; npm start` (PowerShell)

### Project layout

- `server.js`: Express server; serves `public/` and the API under `/api`
- `db.js`: opens the SQLite database, creates tables and seeds default settings
- `routes/`: API routes
- `lib/`: pure logic (date and leave maths) with tests
- `public/`: front end (plain HTML, CSS and JavaScript)
- `data/`: seed data (`activities.json`) and the local database
