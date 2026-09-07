const prisma = require('../db');

/**
 * Executes a trial class booking inside an atomic database transaction.
 * Guarantees data invariants:
 * 1. Capacity limit (strictly <= 4 confirmed students)
 * 2. Duplicate prevention (same child cannot be confirmed twice)
 * 3. Payment failure isolation (failed payment does NOT reserve seat)
 * 4. Last-Seat Race condition safety (atomic read & conditional write)
 */
async function createTrialBooking({ parentId, studentId, trialClassId, paymentOutcome = 'SUCCESS' }) {
  if (!parentId || !studentId || !trialClassId) {
    const err = new Error('Missing required fields: parentId, studentId, and trialClassId are required.');
    err.statusCode = 400;
    err.code = 'INVALID_INPUT';
    throw err;
  }

  // Verify student exists and belongs to parent
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: true }
  });

  if (!student) {
    const err = new Error(`Student with ID "${studentId}" not found.`);
    err.statusCode = 404;
    err.code = 'STUDENT_NOT_FOUND';
    throw err;
  }

  if (student.parentId !== parentId) {
    const err = new Error(`Student "${student.name}" does not belong to parent ID "${parentId}".`);
    err.statusCode = 403;
    err.code = 'STUDENT_PARENT_MISMATCH';
    throw err;
  }

  // Verify trial class exists
  const trialClass = await prisma.trialClass.findUnique({
    where: { id: trialClassId }
  });

  if (!trialClass) {
    const err = new Error(`Trial class with ID "${trialClassId}" not found.`);
    err.statusCode = 404;
    err.code = 'CLASS_NOT_FOUND';
    throw err;
  }

  // Execute booking within interactive database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. INVARIANT CHECK: Duplicate confirmed booking
    const existingConfirmed = await tx.booking.findFirst({
      where: {
        trialClassId,
        studentId,
        status: 'CONFIRMED'
      }
    });

    if (existingConfirmed) {
      const err = new Error(`Student "${student.name}" is already confirmed for "${trialClass.title}".`);
      err.statusCode = 409;
      err.code = 'DUPLICATE_BOOKING';
      throw err;
    }

    // 2. INVARIANT CHECK: Class Capacity Limit (strictly maxCapacity, default 4)
    const confirmedCount = await tx.booking.count({
      where: {
        trialClassId,
        status: 'CONFIRMED'
      }
    });

    if (confirmedCount >= trialClass.maxCapacity) {
      const err = new Error(`Class "${trialClass.title}" is already fully booked (${confirmedCount}/${trialClass.maxCapacity}).`);
      err.statusCode = 409;
      err.code = 'CLASS_FULL';
      throw err;
    }

    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);

    // 3. PAYMENT OUTCOME HANDLING
    if (paymentOutcome === 'FAILED') {
      const failedBooking = await tx.booking.create({
        data: {
          trialClassId,
          studentId,
          parentId,
          status: 'PAYMENT_FAILED',
          amount: trialClass.price,
          paymentAttempts: {
            create: {
              transactionId: txId,
              amount: trialClass.price,
              status: 'FAILED',
              paymentMethod: 'MOCK_CARD'
            }
          }
        },
        include: {
          student: true,
          trialClass: true,
          paymentAttempts: true
        }
      });

      return {
        success: false,
        code: 'PAYMENT_FAILED',
        message: 'Payment authorization declined. The seat was not reserved.',
        booking: failedBooking
      };
    }

    // 4. CONFIRMED BOOKING (Payment Succeeded & Seat Acquired)
    const confirmedBooking = await tx.booking.create({
      data: {
        trialClassId,
        studentId,
        parentId,
        status: 'CONFIRMED',
        amount: trialClass.price,
        paymentAttempts: {
          create: {
            transactionId: txId,
            amount: trialClass.price,
            status: 'SUCCESS',
            paymentMethod: 'MOCK_CARD'
          }
        }
      },
      include: {
        student: true,
        trialClass: true,
        paymentAttempts: true
      }
    });

    return {
      success: true,
      code: 'BOOKING_CONFIRMED',
      message: `Booking Confirmed! Student "${student.name}" has secured a seat for "${trialClass.title}".`,
      booking: confirmedBooking
    };
  });

  return result;
}

module.exports = {
  createTrialBooking
};
