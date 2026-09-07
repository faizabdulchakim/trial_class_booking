const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/classes - List all trial classes with dynamic capacity calculation
router.get('/', async (req, res) => {
  try {
    const classes = await prisma.trialClass.findMany({
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          select: { id: true, studentId: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const formatted = classes.map(cls => {
      const confirmedCount = cls.bookings.length;
      const remainingSeats = Math.max(0, cls.maxCapacity - confirmedCount);
      const isFull = confirmedCount >= cls.maxCapacity;

      return {
        id: cls.id,
        title: cls.title,
        subject: cls.subject,
        schedule: cls.schedule,
        price: cls.price,
        maxCapacity: cls.maxCapacity,
        description: cls.description,
        confirmedCount,
        remainingSeats,
        isFull
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trial classes.' });
  }
});

module.exports = router;
