# AI Usage & Collaboration Report

This document details the collaboration with AI tools during the implementation of the Ottodot Trial Booking system, adhering to the take-home evaluation guidelines.

---

## 1. AI Tools Used
- **Antigravity AI Agent (Gemini 3.7 Flash High)** for architecture scaffolding, automated test authoring, database schema design, and browser-driven end-to-end verification.

---

## 2. What AI Was Used For
- **Scaffolding:** Rapid generation of SQLite Prisma schemas, seed files, and Express REST controllers.
- **Frontend Architecture:** Creating a clean React UI with separated parent and admin portals without boilerplate overhead.
- **Concurrency Test Authoring:** Writing the parallel `Promise.all` Jest test harness to simulate high-concurrency race conditions.
- **Browser Automation Verification:** Running headless browser subagents to record video sessions and verify network requests end-to-end.

---

## 3. One Place Where AI Helped Move Faster
- **Concurrency & Race Condition Test Harness:** Creating an isolated SQLite test database with seed state and 4 parallel simulated HTTP requests in `tests/booking.test.js`. Writing and debugging multi-promise concurrency assertions manually often takes significant trial-and-error; AI generated a working Jest test suite in under 3 minutes, proving that the atomic transaction lock worked reliably.

---

## 4. One Place Where AI Output Was Corrected / Rejected
- **Unified All-In-One UI vs. Realistic User Segmentation:**
  - *Initial AI Suggestion:* AI initially combined the Parent booking form, Admin roster, and Race simulator into a single unified tabbed dashboard, including a "Select Parent" dropdown in the booking flow.
  - *Correction / Rejection:* I rejected this approach because in a realistic application, parents do not select other parents' profiles. I steered the AI to:
    1. Separate the application into distinct `/parent` and `/admin` portals.
    2. Convert the parent selector into a clear **"Simulate Login As"** switcher that filters children specifically belonging to that parent.
    3. Confine administrative roster views and diagnostic testing tools strictly to `/admin`.

---

## 5. What to Change About the AI Workflow in the Future
- **Start with Database Contracts First:** In this run, we iterated on a frontend mockup before generating the backend Prisma models. Starting by defining the database transaction invariants first would have allowed the backend tests to be written even faster before integrating the UI.

---

## 6. How the Final Implementation Was Verified
1. **Automated Unit & Concurrency Tests (`npm test`):**
   - 5/5 automated test suites executed via Jest, confirming zero duplicate bookings, correct payment failure handling, and strict 4/4 capacity enforcement under parallel race conditions.
2. **Browser Subagent End-to-End Testing:**
   - Navigated through `/parent`, submitted real bookings via API, inspected database state in `/admin` roster, and triggered live concurrent HTTP requests in the Race Lab.
3. **Database Direct Inspection:**
   - Verified that SQLite `dev.db` accurately recorded rows in `Booking` and `PaymentAttempt` tables with correct statuses (`CONFIRMED`, `PAYMENT_FAILED`, `REJECTED_OVERBOOKED`).
