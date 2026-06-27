// server.js — Express API Server
// Smart Manufacturing Analytics System
// M.Tech Project

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { connectDB, startChangeStream } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Routes ──────────────────────────────────
app.use('/api/production', require('./routes/production'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/alerts',     require('./routes/alerts'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: 'manufacturing_db', time: new Date() });
});

// ─── 404 + Error Handlers ────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// ─── Start ───────────────────────────────────
(async () => {
  const db = await connectDB();
  // Uncomment for replica set environments (needed for change streams):
  // await startChangeStream(db);
  app.listen(PORT, () => {
    console.log(`\n🚀 Manufacturing API running at http://localhost:${PORT}`);
    console.log(`   GET /api/analytics/summary`);
    console.log(`   GET /api/analytics/oee`);
    console.log(`   GET /api/analytics/defect-analysis`);
    console.log(`   GET /api/production?page=1&limit=20`);
  });
})();
