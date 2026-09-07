const request = require('supertest');
const app = require('../src/server');
const prisma = require('../src/db');
const { seedDatabase } = require('../prisma/seed');

beforeEach(async () => {
  // Reset database before each test suite to ensure clean isolation
  await seedDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Ottodot Trial Booking API & Invariant Verification', () => {

  // =========================================================================
  // SCENARIO 1: Normal Booking with Available Seats
  // =========================================================================
  test('Scenario 1: Successfully book an available seat in Class 1', async () => {
    // Class 1 initially has 1 confirmed student (Leo Tan - s1).
    // Parent Diana (p4) books for student Emma (s4).
    const response = await request(app)
      .post('/api/bookings')
      .send({
        parentId: 'p4',
        studentId: 's4',
        trialClassId: 'cls_1',
        paymentOutcome: 'SUCCESS'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.code).toBe('BOOKING_CONFIRMED');
    expect(response.body.booking.status).toBe('CONFIRMED');
    expect(response.body.booking.paymentAttempts[0].status).toBe('SUCCESS');

    // Verify DB count increased to 2
    const confirmedCount = await prisma.booking.count({
      where: { trialClassId: 'cls_1', status: 'CONFIRMED' }
    });
    expect(confirmedCount).toBe(2);
  });

  // =========================================================================
  // SCENARIO 2: Duplicate Booking Prevention
  // =========================================================================
  test('Scenario 2: Reject duplicate booking for the same child and class', async () => {
    // Student Leo (s1) is already confirmed in Class 1 from seed.
    const response = await request(app)
      .post('/api/bookings')
      .send({
        parentId: 'p1',
        studentId: 's1',
        trialClassId: 'cls_1',
        paymentOutcome: 'SUCCESS'
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('DUPLICATE_BOOKING');
    expect(response.body.message).toContain('already confirmed');

    // Verify DB count remains unchanged at 1
    const confirmedCount = await prisma.booking.count({
      where: { trialClassId: 'cls_1', status: 'CONFIRMED' }
    });
    expect(confirmedCount).toBe(1);
  });

  // =========================================================================
  // SCENARIO 3: Payment Failure Handling
  // =========================================================================
  test('Scenario 3: Handle payment failure without adding student to confirmed roster', async () => {
    // Diana (p4) tries to book for Emma (s4) with payment outcome FAILED
    const response = await request(app)
      .post('/api/bookings')
      .send({
        parentId: 'p4',
        studentId: 's4',
        trialClassId: 'cls_1',
        paymentOutcome: 'FAILED'
      });

    expect(response.status).toBe(402);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('PAYMENT_FAILED');
    expect(response.body.booking.status).toBe('PAYMENT_FAILED');
    expect(response.body.booking.paymentAttempts[0].status).toBe('FAILED');

    // Crucial check: Confirmed roster count must STILL be 1!
    const confirmedCount = await prisma.booking.count({
      where: { trialClassId: 'cls_1', status: 'CONFIRMED' }
    });
    expect(confirmedCount).toBe(1);
  });

  // =========================================================================
  // SCENARIO 4: Fully Booked Class Rejection
  // =========================================================================
  test('Scenario 4: Reject booking on a class that is already full (4/4)', async () => {
    // Class 3 has 4 confirmed students in seed data.
    // Eric (p5) tries to book Lucas (s5) into Class 3.
    const response = await request(app)
      .post('/api/bookings')
      .send({
        parentId: 'p5',
        studentId: 's5',
        trialClassId: 'cls_3',
        paymentOutcome: 'SUCCESS'
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('CLASS_FULL');
    expect(response.body.message).toContain('fully booked');
  });

  // =========================================================================
  // SCENARIO 5: LAST-SEAT RACE CONDITION (PARALLEL CONCURRENT REQUESTS)
  // =========================================================================
  test('Scenario 5 [CRITICAL]: Last-Seat Race - At most 1 user wins the last available seat under high concurrency', async () => {
    // Class 2 has 3 confirmed students (s1, s2, s3). Only 1 seat remaining (Capacity: 4).
    // We create additional candidate students to fire 4 concurrent booking requests simultaneously.
    const extraParent = await prisma.parent.create({
      data: { name: 'Fiona Gallagher', email: 'fiona@example.com' }
    });
    const extraStudent1 = await prisma.student.create({
      data: { name: 'Liam Gallagher', age: 7, parentId: extraParent.id }
    });
    const extraStudent2 = await prisma.student.create({
      data: { name: 'Carl Gallagher', age: 9, parentId: extraParent.id }
    });

    // We now have 4 candidates racing for 1 seat:
    // Candidate 1: Diana (p4) / Emma (s4)
    // Candidate 2: Eric (p5) / Lucas (s5)
    // Candidate 3: Fiona / Liam (extraStudent1)
    // Candidate 4: Fiona / Carl (extraStudent2)
    const competitors = [
      { parentId: 'p4', studentId: 's4' },
      { parentId: 'p5', studentId: 's5' },
      { parentId: extraParent.id, studentId: extraStudent1.id },
      { parentId: extraParent.id, studentId: extraStudent2.id },
    ];

    // Fire all 4 requests in parallel simultaneously via Promise.all
    const responses = await Promise.all(
      competitors.map(c =>
        request(app)
          .post('/api/bookings')
          .send({
            parentId: c.parentId,
            studentId: c.studentId,
            trialClassId: 'cls_2',
            paymentOutcome: 'SUCCESS'
          })
      )
    );

    // Filter successful vs rejected responses
    const successful = responses.filter(r => r.status === 201 && r.body.success === true);
    const rejected = responses.filter(r => r.status === 409 && r.body.code === 'CLASS_FULL');

    // INVARIANT ASSERTIONS:
    // 1. Exactly 1 competitor must succeed
    expect(successful.length).toBe(1);
    expect(successful[0].body.code).toBe('BOOKING_CONFIRMED');

    // 2. Exactly 3 competitors must be rejected
    expect(rejected.length).toBe(3);

    // 3. Database MUST have EXACTLY 4 confirmed bookings for Class 2 (no overbooking)
    const finalConfirmedCount = await prisma.booking.count({
      where: { trialClassId: 'cls_2', status: 'CONFIRMED' }
    });
    expect(finalConfirmedCount).toBe(4);
  });
});
