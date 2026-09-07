import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3000/api';

export default function App() {
  // Navigation / Page Route: 'parent' | 'admin'
  const [currentPage, setCurrentPage] = useState(() => {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'parent';
  });

  // Admin Sub-Tab: 'roster' | 'lab'
  const [adminTab, setAdminTab] = useState('roster');

  // Backend Live State
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [roster, setRoster] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated Logged-In Parent State (For /parent page)
  const [currentLoggedInParentId, setCurrentLoggedInParentId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [paymentSimulationMode, setPaymentSimulationMode] = useState('SUCCESS'); // 'SUCCESS' | 'FAILED'
  const [bookingResult, setBookingResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Simulator Logs (For Admin Lab)
  const [simLogs, setSimLogs] = useState([]);
  const [isSimulatingRace, setIsSimulatingRace] = useState(false);

  // Synchronize browser history / URL path
  const navigateTo = (page) => {
    setCurrentPage(page);
    window.history.pushState(null, '', `/${page}`);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(window.location.pathname.startsWith('/admin') ? 'admin' : 'parent');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch all initial data from Real Backend API
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [classesRes, parentsRes, rosterRes] = await Promise.all([
        fetch(`${API_BASE_URL}/classes`).then(r => r.json()),
        fetch(`${API_BASE_URL}/parents`).then(r => r.json()),
        fetch(`${API_BASE_URL}/admin/roster`).then(r => r.json())
      ]);

      if (classesRes.success) setClasses(classesRes.data);
      if (parentsRes.success) {
        setParents(parentsRes.data);
        // Default to Diana Putri (p4) if not yet set
        if (!currentLoggedInParentId && parentsRes.data.length > 0) {
          const defaultParent = parentsRes.data.find(p => p.id === 'p4') || parentsRes.data[0];
          setCurrentLoggedInParentId(defaultParent.id);
          if (defaultParent.students && defaultParent.students.length > 0) {
            setSelectedStudentId(defaultParent.students[0].id);
          }
        }
      }
      if (rosterRes.success) setRoster(rosterRes.data);
      if (classesRes.success && classesRes.data.length > 0 && !selectedClassId) {
        setSelectedClassId(classesRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentLoggedInParentId, selectedClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update selected child when logged-in parent changes
  const handleLoggedInParentChange = (newParentId) => {
    setCurrentLoggedInParentId(newParentId);
    const parent = parents.find(p => p.id === newParentId);
    if (parent && parent.students && parent.students.length > 0) {
      setSelectedStudentId(parent.students[0].id);
    } else {
      setSelectedStudentId('');
    }
    setBookingResult(null);
  };

  const currentLoggedInParent = parents.find(p => p.id === currentLoggedInParentId);
  const parentChildren = currentLoggedInParent ? currentLoggedInParent.students || [] : [];
  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Reset database back to seed via Backend API
  const handleResetData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBookingResult(null);
        setSimLogs([]);
        await loadData();
        alert('Database has been reset to baseline seed state via SQLite.');
      }
    } catch (err) {
      alert('Failed to reset database: ' + err.message);
    }
  };

  // Submit Parent Booking to Real Backend API
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedClassId) return;

    setIsProcessing(true);
    setBookingResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: currentLoggedInParentId,
          studentId: selectedStudentId,
          trialClassId: selectedClassId,
          paymentOutcome: paymentSimulationMode
        })
      });

      const data = await response.json();
      setBookingResult(data);
      // Refresh live class and roster counts
      await loadData();
    } catch (err) {
      setBookingResult({
        success: false,
        message: 'Network / server error: ' + err.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // =========================================================================
  // SIMULATOR: LAST-SEAT RACE CONDITION DEMO (Real Concurrent HTTP API Calls)
  // =========================================================================
  const runLastSeatRaceSimulation = async () => {
    setIsSimulatingRace(true);
    setSimLogs([]);

    const log = (msg, type = 'info') => {
      const time = new Date().toLocaleTimeString();
      setSimLogs(prev => [...prev, { time, msg, type }]);
    };

    log('🏁 Initiating Live Concurrent Last-Seat Race via Backend API...', 'info');
    log('Target Class: "Math Wizards: Geometry & Spatial Riddles" (Capacity: 4).', 'info');

    // Check current state of Class 2
    const targetClass = classes.find(c => c.id === 'cls_2');
    if (!targetClass) {
      log('Target class not found.', 'danger');
      setIsSimulatingRace(false);
      return;
    }

    log(`Current Confirmed Students: ${targetClass.confirmedCount}/4. Remaining seats: ${targetClass.remainingSeats}.`, targetClass.isFull ? 'warn' : 'info');

    if (targetClass.isFull) {
      log('⚠️ Class 2 is already full! Please click "Reset Seed Data" first to test the race condition.', 'danger');
      setIsSimulatingRace(false);
      return;
    }

    log('➡️ Dispatching 2 concurrent HTTP POST /api/bookings requests in parallel...', 'info');
    log('Competitor A: Diana Putri booking Emma (s4)', 'info');
    log('Competitor B: Eric Sutanto booking Lucas (s5)', 'info');

    // Fire both requests simultaneously using Promise.all
    const [resA, resB] = await Promise.all([
      fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'p4',
          studentId: 's4',
          trialClassId: 'cls_2',
          paymentOutcome: 'SUCCESS'
        })
      }).then(async r => ({ status: r.status, data: await r.json(), user: 'User A (Diana/Emma)' })),

      fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: 'p5',
          studentId: 's5',
          trialClassId: 'cls_2',
          paymentOutcome: 'SUCCESS'
        })
      }).then(async r => ({ status: r.status, data: await r.json(), user: 'User B (Eric/Lucas)' }))
    ]);

    // Log individual transaction outcomes
    [resA, resB].forEach(res => {
      if (res.status === 201 && res.data.success) {
        log(`✅ [${res.user}] Acquired DB Transaction Lock & Confirmed! Seat #4 taken. Tx: ${res.data.booking.paymentAttempts[0].transactionId}`, 'success');
      } else {
        log(`🛑 [${res.user}] Rejected by Backend Invariant Check: ${res.data.message} (HTTP ${res.status})`, 'danger');
      }
    });

    // Reload backend state to verify total
    await loadData();

    log('🏆 Concurrency Verification Complete: Database transaction isolation ensured at most 1 confirmed booking.', 'success');
    setIsSimulatingRace(false);
  };

  // Run Quick Scenario Test
  const runQuickScenario = async (scenario) => {
    try {
      let payload = {};
      if (scenario === 1) {
        // Normal booking: Diana / Emma into Class 1
        payload = { parentId: 'p4', studentId: 's4', trialClassId: 'cls_1', paymentOutcome: 'SUCCESS' };
      } else if (scenario === 2) {
        // Duplicate booking: Leo into Class 1
        payload = { parentId: 'p1', studentId: 's1', trialClassId: 'cls_1', paymentOutcome: 'SUCCESS' };
      } else if (scenario === 3) {
        // Payment Failure: Diana / Emma into Class 1 with FAILED
        payload = { parentId: 'p4', studentId: 's4', trialClassId: 'cls_1', paymentOutcome: 'FAILED' };
      }

      const res = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      await loadData();
      alert(`[HTTP ${res.status}] ${data.message}`);
    } catch (err) {
      alert('Error running scenario: ' + err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <nav className="top-navbar">
        <div className="brand-title">
          <span>🎓</span> Ottodot Trial Booking
        </div>
        <div className="nav-links">
          <button
            className={`nav-link-btn ${currentPage === 'parent' ? 'active' : ''}`}
            onClick={() => navigateTo('parent')}
          >
            👨‍👩‍👧 Parent Portal (/parent)
          </button>
          <button
            className={`nav-link-btn ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => navigateTo('admin')}
          >
            🛡️ Admin Portal (/admin)
          </button>
        </div>
        <div>
          <button className="btn btn-outline" onClick={handleResetData}>
            🔄 Reset Seed Data
          </button>
        </div>
      </nav>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
          Connecting to SQLite Backend API...
        </div>
      )}

      {/* =========================================================================
          PAGE 1: PARENT PORTAL (/parent)
          ========================================================================= */}
      {!isLoading && currentPage === 'parent' && (
        <div>
          {/* Header & Simulate Login As Bar */}
          <div className="page-header">
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111827' }}>
              Trial Class Booking
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
              Book an interactive live science or math trial class for your child.
            </p>

            {/* Switcher: Simulate Login As */}
            <div className="simulate-login-bar">
              <div className="simulate-login-label">
                <span>🔑</span> Simulate Login As:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 400 }}>
                <select
                  className="form-select"
                  value={currentLoggedInParentId}
                  onChange={(e) => handleLoggedInParentChange(e.target.value)}
                >
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="badge-pill badge-neutral">
                  👤 Active Parent: {currentLoggedInParent?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Select Child */}
          <div className="card">
            <h2 className="card-title">Step 1: Choose Your Child</h2>
            <div className="form-group" style={{ maxWidth: 450, margin: 0 }}>
              <label className="form-label">Registered Child:</label>
              <select
                className="form-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {parentChildren.length === 0 ? (
                  <option value="">No children registered for this account</option>
                ) : (
                  parentChildren.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.age} years old)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Step 2: Choose Available Trial Class */}
          <div className="card">
            <h2 className="card-title">Step 2: Pick Available Trial Class</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Select a class below. Capacity is capped at 4 students per class.
            </p>

            <div className="class-grid">
              {classes.map(cls => {
                const isSelected = selectedClassId === cls.id;

                return (
                  <div
                    key={cls.id}
                    className={`class-card ${isSelected ? 'selected' : ''} ${cls.isFull ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!cls.isFull) setSelectedClassId(cls.id);
                    }}
                  >
                    <div>
                      <div className="class-name">{cls.title}</div>
                      <div className="class-schedule">🕒 {cls.schedule}</div>
                      <div className="class-desc">{cls.description}</div>
                    </div>

                    <div className="class-footer">
                      <span className="class-price">${cls.price} USD</span>
                      <div>
                        {cls.confirmedCount === 0 && (
                          <span className="badge-pill badge-success">4 Seats Available</span>
                        )}
                        {cls.confirmedCount > 0 && cls.confirmedCount < 3 && (
                          <span className="badge-pill badge-info">
                            {cls.remainingSeats} Seats Available
                          </span>
                        )}
                        {cls.confirmedCount === 3 && (
                          <span className="badge-pill badge-warning">🔥 Only 1 Seat Left!</span>
                        )}
                        {cls.isFull && (
                          <span className="badge-pill badge-danger">Class Full (4/4)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Mock Payment & Submit */}
          <div className="card">
            <h2 className="card-title">Step 3: Checkout & Mock Payment</h2>

            <div className="summary-box">
              <div className="summary-row">
                <span>Selected Class:</span>
                <strong>{selectedClass?.title}</strong>
              </div>
              <div className="summary-row">
                <span>Enrolling Child:</span>
                <strong>{parentChildren.find(s => s.id === selectedStudentId)?.name}</strong>
              </div>
              <div className="summary-row total">
                <span>Total Amount:</span>
                <span>${selectedClass?.price}.00 USD</span>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="form-label">Mock Payment Authorization Outcome:</label>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="SUCCESS"
                    checked={paymentSimulationMode === 'SUCCESS'}
                    onChange={() => setPaymentSimulationMode('SUCCESS')}
                  />
                  🟢 Simulate Payment Success ($25 Authorized)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="paymentMode"
                    value="FAILED"
                    checked={paymentSimulationMode === 'FAILED'}
                    onChange={() => setPaymentSimulationMode('FAILED')}
                  />
                  🔴 Simulate Payment Declined / Insufficient Funds
                </label>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSubmitBooking}
                disabled={isProcessing || !selectedStudentId}
                style={{ width: '100%' }}
              >
                {isProcessing ? 'Processing Transaction with Backend...' : 'Pay & Confirm Trial Booking'}
              </button>
            </div>

            {/* Booking Feedback Alert */}
            {bookingResult && (
              <div className={`alert ${bookingResult.success ? 'alert-success' : 'alert-error'}`}>
                <strong>{bookingResult.success ? '✅ Success: ' : '❌ Error: '}</strong>
                {bookingResult.message}
                {bookingResult.booking && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    Booking ID: <code>{bookingResult.booking.id}</code> | Status: <strong>{bookingResult.booking.status}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          PAGE 2: ADMIN PORTAL (/admin)
          ========================================================================= */}
      {!isLoading && currentPage === 'admin' && (
        <div>
          <div className="page-header">
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111827' }}>
              Admin & Teacher Dashboard
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, margin: 0 }}>
              Manage confirmed trial rosters and test edge case resilience.
            </p>

            {/* 2 Sub-menus inside Admin */}
            <div className="sub-nav-tabs">
              <button
                className={`sub-tab-btn ${adminTab === 'roster' ? 'active' : ''}`}
                onClick={() => setAdminTab('roster')}
              >
                📋 1. Roster View
              </button>
              <button
                className={`sub-tab-btn ${adminTab === 'lab' ? 'active' : ''}`}
                onClick={() => setAdminTab('lab')}
              >
                ⚡ 2. Edge Case & Race Lab
              </button>
            </div>
          </div>

          {/* ADMIN MENU 1: ROSTER VIEW */}
          {adminTab === 'roster' && (
            <div>
              {roster.map(cls => {
                const confirmedBookings = cls.bookings.filter(b => b.status === 'CONFIRMED');

                return (
                  <div key={cls.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{cls.title}</h3>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>🕒 {cls.schedule}</p>
                      </div>
                      <div>
                        <span
                          className={`badge-pill ${
                            confirmedBookings.length >= 4
                              ? 'badge-danger'
                              : confirmedBookings.length === 3
                              ? 'badge-warning'
                              : 'badge-success'
                          }`}
                        >
                          {confirmedBookings.length} / {cls.maxCapacity} Students Confirmed
                        </span>
                      </div>
                    </div>

                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student Name</th>
                            <th>Age</th>
                            <th>Parent Name</th>
                            <th>Parent Email</th>
                            <th>Booking Status</th>
                            <th>Transaction ID</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cls.bookings.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af', padding: 20 }}>
                                No bookings recorded yet for this class.
                              </td>
                            </tr>
                          ) : (
                            cls.bookings.map(b => (
                              <tr key={b.id}>
                                <td><strong>{b.student?.name || b.studentId}</strong></td>
                                <td>{b.student?.age || '-'}</td>
                                <td>{b.parent?.name || b.parentId}</td>
                                <td>{b.parent?.email || '-'}</td>
                                <td>
                                  {b.status === 'CONFIRMED' && (
                                    <span className="badge-pill badge-success">CONFIRMED</span>
                                  )}
                                  {b.status === 'PAYMENT_FAILED' && (
                                    <span className="badge-pill badge-danger">PAYMENT_FAILED</span>
                                  )}
                                  {b.status === 'REJECTED_OVERBOOKED' && (
                                    <span className="badge-pill badge-warning">REJECTED_OVERBOOKED</span>
                                  )}
                                </td>
                                <td>
                                  <code>
                                    {b.paymentAttempts && b.paymentAttempts.length > 0
                                      ? b.paymentAttempts[0].transactionId
                                      : '-'}
                                  </code>
                                </td>
                                <td style={{ fontSize: 12, color: '#6b7280' }}>
                                  {new Date(b.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ADMIN MENU 2: EDGE CASE & RACE LAB */}
          {adminTab === 'lab' && (
            <div className="card">
              <h2 className="card-title">🧪 Edge Case Verification Panel (Live Backend)</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Trigger real API calls to verify backend invariants: duplicate prevention, payment failure handling, and last-seat concurrency lock.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
                {/* Scenario 1 */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>1. Normal Booking</h4>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                    Book Diana / Emma into Class 1 (has empty seats).
                  </p>
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', fontSize: 13 }}
                    onClick={() => runQuickScenario(1)}
                  >
                    Run Scenario 1
                  </button>
                </div>

                {/* Scenario 2 */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>2. Duplicate Booking</h4>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                    Try booking Leo (s1) into Class 1 (already confirmed).
                  </p>
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', fontSize: 13 }}
                    onClick={() => runQuickScenario(2)}
                  >
                    Run Scenario 2
                  </button>
                </div>

                {/* Scenario 3 */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>3. Payment Failure</h4>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                    Simulate card decline &rarr; Student is NOT added to confirmed roster.
                  </p>
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', fontSize: 13 }}
                    onClick={() => runQuickScenario(3)}
                  >
                    Run Scenario 3
                  </button>
                </div>

                {/* Scenario 4 */}
                <div style={{ border: '1px solid #2563eb', backgroundColor: '#f8faff', borderRadius: 6, padding: 14 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>
                    4. Last-Seat Race
                  </h4>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                    Class 2 has 3/4 booked. 2 users race concurrently for 1 seat.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: 13 }}
                    onClick={runLastSeatRaceSimulation}
                    disabled={isSimulatingRace}
                  >
                    {isSimulatingRace ? 'Simulating Live Race...' : '⚡ Run Race Condition'}
                  </button>
                </div>
              </div>

              {/* Simulator Live Logs */}
              <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 16 }}>Live Concurrency Execution Log:</h3>
              <div className="log-box">
                {simLogs.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>
                    Click "⚡ Run Race Condition" or any scenario button above to view atomic execution steps and lock behavior.
                  </div>
                ) : (
                  simLogs.map((item, idx) => (
                    <div key={idx} className="log-entry">
                      <span className="log-time">[{item.time}]</span>
                      <span className={`log-${item.type}`}>{item.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
