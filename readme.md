# Ottodot Trial Class Booking — Reliability & Concurrency Take-Home

A full-stack, transactional trial class booking system built with **Express, Prisma ORM, SQLite, and React**. It strictly enforces business invariants and prevents overbooking under concurrent last-seat race conditions.

---

## 1. What Was Built

- **Parent Booking Portal (`/parent`):**
  - View live trial classes with dynamic capacity indicators.
  - "Simulate Login As" to switch between synthetic parent profiles and their registered children.
  - Mock checkout step with instant success/failure simulation.
  - Real-time booking feedback with receipt/transaction IDs.
- **Admin & Teacher Dashboard (`/admin`):**
  - **Roster View:** Live table of all classes with confirmed student rosters, ages, parent emails, and transaction IDs.
  - **Edge Case & Race Lab:** Interactive testing suite simulating normal booking, duplicate booking, payment failure, and parallel concurrent requests for the final seat.
- **Transactional Backend API (Express + Prisma + SQLite):**
  - ACID database transactions guaranteeing at most 4 confirmed students per class.
  - Duplicate booking prevention at both service and database levels.
  - Dedicated payment failure isolation (failed payments do not occupy seats).
- **Automated Test Suite (Jest + Supertest):**
  - 5 comprehensive tests including parallel `Promise.all` concurrent request tests verifying race condition immunity.

---

## 2. Key Architecture & Backend Decisions

### Data Model & Schema (`prisma/schema.prisma`)

```prisma
model Parent {
  id        String    @id @default(uuid())
  name      String
  email     String    @unique
  students  Student[]
  bookings  Booking[]
  createdAt DateTime  @default(now())
}

model Student {
  id        String    @id @default(uuid())
  name      String
  age       Int
  parentId  String
  parent    Parent    @relation(fields: [parentId], references: [id], onDelete: Cascade)
  bookings  Booking[]
  createdAt DateTime  @default(now())
}

model TrialClass {
  id          String    @id @default(uuid())
  title       String
  subject     String
  schedule    String
  price       Float     @default(25.0)
  maxCapacity Int       @default(4)
  description String
  bookings    Booking[]
  createdAt   DateTime  @default(now())
}

model Booking {
  id              String           @id @default(uuid())
  trialClassId    String
  studentId       String
  parentId        String
  status          String           // 'CONFIRMED' | 'PAYMENT_FAILED' | 'REJECTED_OVERBOOKED'
  amount          Float
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  trialClass      TrialClass       @relation(fields: [trialClassId], references: [id], onDelete: Cascade)
  student         Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  parent          Parent           @relation(fields: [parentId], references: [id], onDelete: Cascade)
  paymentAttempts PaymentAttempt[]

  @@index([trialClassId, status])
  @@index([studentId, trialClassId])
}

model PaymentAttempt {
  id            String   @id @default(uuid())
  bookingId     String
  transactionId String   @unique
  amount        Float
  status        String   // 'SUCCESS' | 'FAILED' | 'REFUNDED'
  paymentMethod String   @default("MOCK_CARD")
  createdAt     DateTime @default(now())

  booking       Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}
```

### Booking Statuses Used

- `CONFIRMED`: Payment authorized and seat officially claimed. Child is added to the teacher's roster.
- `PAYMENT_FAILED`: Payment card declined or authorization failed. Recorded for audit trail; seat is **not** occupied.
- `REJECTED_OVERBOOKED`: Payment reached the server, but all seats were already filled by a faster transaction. Seat is **not** occupied; automatic refund is recorded.

---

## 3. Handling Edge Cases & The Last-Seat Race Condition

### A. How We Prevent Duplicate Bookings
Before reserving a seat, the system checks for any existing booking where `trialClassId = targetClassId`, `studentId = targetStudentId`, and `status = 'CONFIRMED'`. If found, the transaction immediately aborts and returns an HTTP `409 Conflict` with error code `DUPLICATE_BOOKING`.

### B. How We Handle Payment Failure
If payment authorization fails:
1. A `Booking` record is saved with status `PAYMENT_FAILED`.
2. A `PaymentAttempt` record is saved with status `FAILED`.
3. The seat is **not** reserved, so other parents can still book it.
4. Returns HTTP `402 Payment Required` to the user with a clear explanation.

### C. The Last-Seat Race Condition: Approach & Tradeoffs
**The Scenario:**
1. Class 2 has 3 confirmed students (capacity: 4). Exactly 1 seat remains.
2. User A and User B open checkout for the same class at the same time.
3. User B completes payment first at T=0.
4. User A completes payment slightly later at T+50ms.

#### The Approach Chosen: **Atomic Database Transactions with Conditional Verification**
We wrap seat allocation and payment recording inside `prisma.$transaction(async (tx) => { ... })`.

1. Inside the transaction, the database locks the table/rows and counts the current confirmed bookings for the class:
   ```js
   const confirmedCount = await tx.booking.count({
     where: { trialClassId, status: 'CONFIRMED' }
   });
   ```
2. If `confirmedCount >= maxCapacity` (4), the transaction aborts and throws `CLASS_FULL`.
3. If `confirmedCount < 4`, the booking is inserted as `CONFIRMED`, and the transaction commits.
4. When User B's transaction commits, the count becomes 4. When User A's transaction executes immediately after, `confirmedCount` evaluates to 4, rejecting User A's booking with HTTP `409 Conflict` and initiating an automatic refund.

#### Why We Chose It
- **Absolute Correctness:** Guarantees zero overbooking regardless of network latency or concurrent requests.
- **No Stale Holds:** Unlike a temporary reservation hold system (which holds a seat for 10 minutes and risks seats expiring unpurchased), this allows true first-come, first-served purchasing.

#### Tradeoffs Accepted
- **Late Rejection for User A:** User A enters payment details believing a seat is available, but gets rejected at the final submission if User B finishes faster. In production, this is paired with instant refund webhooks and real-time WebSocket seat alerts.

---

## 4. Layer Responsibility Matrix

| Check / Responsibility | Layer | Rationale |
| :--- | :--- | :--- |
| **Disabled "Full" UI buttons & seat badges** | **UI (Frontend)** | Immediate user feedback; prevents unnecessary checkout attempts. |
| **Parent-child ownership verification** | **Backend Service** | Business logic validation to prevent ID tampering. |
| **Capacity lock & Duplicate checking** | **Database Transaction** | Absolute source of truth; prevents race conditions under high concurrency. |
| **Payment refund / Async webhook processing** | **Background Job / Webhook** | Decouples payment gateway reconciliation from synchronous user requests. |

---

## 5. How to Run Locally

### Prerequisites
- Node.js (v18+) & npm

### 1. Setup Backend (`BE`)
```bash
cd BE
npm install
npm run prisma:push   # Syncs SQLite schema to dev.db
npm run seed          # Populates synthetic parents, students, classes, and bookings
npm start             # Starts server on http://localhost:3000
```

### 2. Run Automated Tests (`BE`)
```bash
cd BE
npm test              # Executes Jest test suite (all 5 invariant & concurrency tests)
```

### 3. Setup Frontend (`FE`)
```bash
cd FE
npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
```

Open:
- **Parent Portal:** [http://localhost:5173/parent](http://localhost:5173/parent)
- **Admin Portal:** [http://localhost:5173/admin](http://localhost:5173/admin)

---

## 6. Project Metadata

- **Time Spent:** ~3.5 hours
- **Assumptions Made:**
  - Standard trial class capacity is fixed at 4 students per class.
  - Payment gateway is mocked; payment results can be simulated synchronously.
  - Parents and children are pre-registered in the synthetic seed dataset.
- **What Was Deliberately Cut:**
  - Full JWT authentication / OAuth (replaced with clean "Simulate Login As" selector to respect the timebox).
  - Regular semester enrollment & waitlist queues (prompt explicitly scoped to trial booking only).
- **What to Monitor in Production:**
  - Rate of HTTP 409 `CLASS_FULL` conflicts at checkout (to identify high-demand class slots).
  - Payment gateway authorization failure rates & webhook processing latency.
  - Database transaction execution duration and lock wait times.
- **Next Steps with More Time:**
  - WebSockets (SSE) for real-time seat availability updates on the frontend.
  - Automated waitlist notifications when a confirmed booking cancels.
  - Integration with Stripe / Xendit webhooks with idempotent event handling.