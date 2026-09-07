const express = require('express');
const router = express.Router();
const { createTrialBooking } = require('../services/bookingService');

// POST /api/bookings - Submit a trial booking with mock payment
router.post('/', async (req, res) => {
  try {
    const { parentId, studentId, trialClassId, paymentOutcome } = req.body;

    const result = await createTrialBooking({
      parentId,
      studentId,
      trialClassId,
      paymentOutcome: paymentOutcome || 'SUCCESS'
    });

    if (!result.success && result.code === 'PAYMENT_FAILED') {
      return res.status(402).json(result); // Payment Required / Payment Failed
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Booking submission error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred during booking.'
    });
  }
});

module.exports = router;
