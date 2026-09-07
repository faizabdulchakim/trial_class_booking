const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { seedDatabase } = require('../../prisma/seed');

// GET /api/admin/roster - Get full roster of all trial classes
router.get('/roster', async (req, res) => {
  try {
    const classes = await prisma.trialClass.findMany({
      include: {
        bookings: {
          include: {
            student: true,
            parent: true,
            paymentAttempts: true
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admin roster.' });
  }
});

// POST /api/admin/reset - Reset database back to baseline seed data
router.post('/reset', async (req, res) => {
  try {
    await seedDatabase();
    res.json({ success: true, message: 'Database successfully reset to initial seed state.' });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ success: false, error: 'Failed to reset database.' });
  }
});

module.exports = router;
