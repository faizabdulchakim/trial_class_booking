const express = require('express');
const cors = require('cors');

const classesRouter = require('./routes/classes');
const parentsRouter = require('./routes/parents');
const bookingsRouter = require('./routes/bookings');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in non-test environment
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Routes
app.use('/api/classes', classesRouter);
app.use('/api/parents', parentsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server if not running in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Ottodot Trial Booking Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
