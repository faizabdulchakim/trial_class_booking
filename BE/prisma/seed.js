const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Clean up existing data
  await prisma.paymentAttempt.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.trialClass.deleteMany();

  // 1. Seed Parents
  const parents = [
    { id: 'p1', name: 'Alice Tan', email: 'alice@example.com' },
    { id: 'p2', name: 'Bob Wijaya', email: 'bob@example.com' },
    { id: 'p3', name: 'Charlie Lee', email: 'charlie@example.com' },
    { id: 'p4', name: 'Diana Putri', email: 'diana@example.com' },
    { id: 'p5', name: 'Eric Sutanto', email: 'eric@example.com' },
  ];

  for (const parent of parents) {
    await prisma.parent.create({ data: parent });
  }
  console.log(`✅ Created ${parents.length} parents`);

  // 2. Seed Students
  const students = [
    { id: 's1', name: 'Leo Tan', age: 8, parentId: 'p1' },
    { id: 's2', name: 'Maya Wijaya', age: 7, parentId: 'p2' },
    { id: 's3', name: 'Noah Lee', age: 9, parentId: 'p3' },
    { id: 's4', name: 'Emma Putri', age: 8, parentId: 'p4' },
    { id: 's5', name: 'Lucas Sutanto', age: 7, parentId: 'p5' },
  ];

  for (const student of students) {
    await prisma.student.create({ data: student });
  }
  console.log(`✅ Created ${students.length} students`);

  // 3. Seed Trial Classes (Capacity 4)
  const classes = [
    {
      id: 'cls_1',
      title: '🧪 Science Explorers: Volcanoes & Reactions',
      subject: 'Science',
      schedule: 'Saturday, 10:00 AM - 11:00 AM',
      price: 25.0,
      maxCapacity: 4,
      description: 'Hands-on chemistry and volcanic eruption experiments for ages 7-10.'
    },
    {
      id: 'cls_2',
      title: '📐 Math Wizards: Geometry & Spatial Riddles',
      subject: 'Math',
      schedule: 'Saturday, 02:00 PM - 03:00 PM',
      price: 25.0,
      maxCapacity: 4,
      description: 'Fun spatial challenges, 2D/3D shapes, and logic puzzles. (Target for Last-Seat Race Condition)'
    },
    {
      id: 'cls_3',
      title: '🌌 Astronomy Junior: Solar System Adventures',
      subject: 'Science',
      schedule: 'Sunday, 09:00 AM - 10:00 AM',
      price: 25.0,
      maxCapacity: 4,
      description: 'Journey through planetary orbits, black holes, and space missions.'
    }
  ];

  for (const cls of classes) {
    await prisma.trialClass.create({ data: cls });
  }
  console.log(`✅ Created ${classes.length} trial classes`);

  // 4. Seed Invariant Bookings
  // - Class 1: 1 confirmed (3 seats available)
  // - Class 2: 3 confirmed (1 seat remaining)
  // - Class 3: 4 confirmed (FULL)
  const seedBookings = [
    // Class 1
    {
      id: 'bk_101',
      trialClassId: 'cls_1',
      studentId: 's1',
      parentId: 'p1',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T10:00:00Z'),
      txId: 'tx_seed_101'
    },
    // Class 2 (3 confirmed -> 1 remaining)
    {
      id: 'bk_201',
      trialClassId: 'cls_2',
      studentId: 's1',
      parentId: 'p1',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T09:00:00Z'),
      txId: 'tx_seed_201'
    },
    {
      id: 'bk_202',
      trialClassId: 'cls_2',
      studentId: 's2',
      parentId: 'p2',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T09:15:00Z'),
      txId: 'tx_seed_202'
    },
    {
      id: 'bk_203',
      trialClassId: 'cls_2',
      studentId: 's3',
      parentId: 'p3',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T09:30:00Z'),
      txId: 'tx_seed_203'
    },
    // Class 3 (4 confirmed -> FULL)
    {
      id: 'bk_301',
      trialClassId: 'cls_3',
      studentId: 's1',
      parentId: 'p1',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T08:00:00Z'),
      txId: 'tx_seed_301'
    },
    {
      id: 'bk_302',
      trialClassId: 'cls_3',
      studentId: 's2',
      parentId: 'p2',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T08:10:00Z'),
      txId: 'tx_seed_302'
    },
    {
      id: 'bk_303',
      trialClassId: 'cls_3',
      studentId: 's3',
      parentId: 'p3',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T08:20:00Z'),
      txId: 'tx_seed_303'
    },
    {
      id: 'bk_304',
      trialClassId: 'cls_3',
      studentId: 's4',
      parentId: 'p4',
      status: 'CONFIRMED',
      amount: 25.0,
      createdAt: new Date('2026-09-07T08:30:00Z'),
      txId: 'tx_seed_304'
    }
  ];

  for (const item of seedBookings) {
    const { txId, ...bookingData } = item;
    const createdBooking = await prisma.booking.create({ data: bookingData });
    await prisma.paymentAttempt.create({
      data: {
        bookingId: createdBooking.id,
        transactionId: txId,
        amount: item.amount,
        status: 'SUCCESS',
        paymentMethod: 'MOCK_CARD'
      }
    });
  }

  console.log(`✅ Created ${seedBookings.length} bookings and payment attempts.`);
  console.log('🎉 Seeding finished successfully!');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedDatabase };
