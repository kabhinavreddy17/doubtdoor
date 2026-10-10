// Doubtdoor server. Start it with:  npm start
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const cfg = require('./lib/config');
const store = require('./lib/store');
const ai = require('./lib/ai');
const { rankTutors, slotsFor, priceBreakdown, SUBJECTS, LANGUAGES, AREAS } = require('./lib/matching');

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'doubtdoor-admin';
const PAY_METHODS = ['upi', 'card', 'netbanking', 'cash']; // online methods are demo only. Cash means: pay the tutor after class

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Wraps a route so any error becomes a friendly JSON message instead of a crash.
const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ error: e.message || 'Something went wrong' });
  });

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const db = () => store.get();
const secret = () => crypto.randomBytes(3).toString('hex');
const isApproved = (t) => t.status !== 'pending' && t.status !== 'rejected';
const cleanPhone = (p) => String(p || '').trim();
const phoneOk = (p) => /^[0-9+\-\s]{8,15}$/.test(p);

function receiptFor(method, amount) {
  if (method === 'cash') return { method, status: 'due', amount: Math.round(amount), receipt: 'DD' + Date.now().toString().slice(-8), dueAt: 'after class' };
  return { method, status: 'paid', amount: Math.round(amount), receipt: 'DD' + Date.now().toString().slice(-8), paidAt: Date.now(), demo: true };
}
function parentFrom(body, student) {
  const name = String((body && body.name) || '').trim().slice(0, 60);
  const phone = cleanPhone(body && body.phone);
  if (!name) return { error: 'Please add a parent or guardian name for home visits' };
  if (!phoneOk(phone)) return { error: 'Please enter a valid parent or guardian phone number' };
  student.parentName = name; student.parentPhone = phone;
  return { parent: { name, phone, status: 'pending', code: secret() } };
}
function checkSafety(body, student, needHome) {
  if (needHome && body.guardianAck !== true) return 'Please tick the box confirming that a parent or guardian will be at home during the visit';
  if (body.payment && body.payment.method === 'cash' && body.cashAgree !== true) return 'Please tick the box agreeing to pay the tutor in cash right after the class';
  if (!student.address) return 'Please log in again and add your address';
  return null;
}
const findStudent = (id) => db().students.find((s) => s.id === id);
const student0 = findStudent;
const findTutor = (id) => db().tutors.find((t) => t.id === id);
const findBooking = (id) => db().bookings.find((b) => b.id === id);

/* ------------------------------------------------------------------ basics */

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) =>
  res.json({ aiEnabled: cfg.ai.enabled, provider: cfg.ai.provider, subjects: SUBJECTS, languages: LANGUAGES, areas: AREAS })
);

app.get('/api/tutors', (req, res) => res.json(db().tutors.filter(isApproved)));

app.get('/api/tutors/:id', (req, res) => {
  const t = findTutor(req.params.id);
  if (!t) return bad(res, 'Tutor not found', 404);
  const done = db().bookings.filter((b) => b.tutorId === t.id && b.status === 'completed');
  const reviewsList = done.filter((b) => b.review).map((b) => ({
    student: String(b.studentName).split(' ')[0], rating: b.review.rating, comment: b.review.comment, at: b.review.at, subject: b.subject,
  })).slice(-6).reverse();
  res.json({ ...t, sessionsDone: done.length, reviewsList, slots: slotsFor(t.id) });
});

// Login is simple on purpose (demo): students type a name, tutors pick their profile.
app.post('/api/login', (req, res) => {
  const { role, name, area, language, tutorId, passcode } = req.body || {};
  if (role === 'admin') {
    if (passcode !== ADMIN_PASSCODE) return bad(res, 'Wrong admin passcode', 401);
    return res.json({ id: 'admin', role: 'admin', name: 'Admin', passcode });
  }
  if (role === 'tutor') {
    const t = findTutor(tutorId);
    if (!t || !isApproved(t)) return bad(res, 'Tutor not found or not yet approved', 404);
    return res.json({ id: t.id, role: 'tutor', name: t.name, area: t.area });
  }
  if (role === 'student') {
    if (name === 'Aarav (demo)') return res.json({ ...findStudent('s_demo'), role: 'student' });
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) return bad(res, 'Please enter your name');
    let s = db().students.find((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (s && req.body.age === undefined) return res.json({ ...s, role: 'student' }); // returning visit
    const age = Math.round(Number(req.body.age));
    const institution = String(req.body.institution || '').trim().slice(0, 80);
    const classLevel = String(req.body.classLevel || '').trim().slice(0, 40);
    const address = String(req.body.address || '').trim().slice(0, 200);
    if (!(age >= 5 && age <= 60)) return bad(res, 'Please enter your age (5 to 60)');
    if (!institution) return bad(res, 'Please enter your school or college');
    if (!classLevel) return bad(res, 'Please enter your class or year');
    if (!AREAS.includes(area)) return bad(res, 'Choose your area: ' + AREAS.join(', ') + '.');
    if (address.length < 10) return bad(res, 'Please write your full address (house number, street, landmark)');
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    const mapUrl = Number.isFinite(lat) && Number.isFinite(lng) && req.body.lat !== '' && req.body.lat != null
      ? 'https://www.google.com/maps?q=' + lat + ',' + lng
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address + ', ' + area);
    const fields = { area, language: LANGUAGES.includes(language) ? language : 'English', age, institution, classLevel, address, mapUrl, pinned: mapUrl.includes('?q=') };
    if (!s) { s = { id: store.newId('s'), name: clean }; db().students.push(s); }
    Object.assign(s, fields);
    store.save();
    return res.json({ ...s, role: 'student' });
  }
  bad(res, 'Choose student or tutor');
});

/* ------------------------------------------------------------------ tutor applications + admin */

app.post('/api/tutor-applications', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 40);
  const subjects = (Array.isArray(b.subjects) ? b.subjects : []).filter((s) => SUBJECTS.includes(s)).slice(0, 3);
  const languages = (Array.isArray(b.languages) ? b.languages : []).filter((l) => LANGUAGES.includes(l));
  const rateOnline = Number(b.rateOnline), rateOffline = Number(b.rateOffline) || 0;
  if (name.length < 2) return bad(res, 'Please enter your name');
  if (!subjects.length) return bad(res, 'Choose at least one subject');
  if (!languages.length) return bad(res, 'Choose at least one language');
  if (!AREAS.includes(b.area)) return bad(res, 'Choose your area');
  if (!(rateOnline >= 50 && rateOnline <= 1000)) return bad(res, 'Online rate should be between ₹50 and ₹1000 per hour');
  const offline = !!b.offline;
  if (offline && !(rateOffline >= 50 && rateOffline <= 1500)) return bad(res, 'Home visit rate should be between ₹50 and ₹1500 per hour');
  const t = {
    id: store.newId('t'), name, subjects, languages, rating: 0, reviews: 0, area: b.area,
    rateOnline: Math.round(rateOnline), rateOffline: offline ? Math.round(rateOffline) : 0, online: true, offline,
    experience: Math.max(0, Math.min(40, Number(b.experience) || 0)), levels: String(b.levels || '').slice(0, 60) || 'School level',
    bio: String(b.bio || '').trim().slice(0, 200) || 'New tutor on Doubtdoor.', status: 'pending', verified: false, appliedAt: Date.now(),
  };
  db().tutors.push(t);
  store.save();
  res.json({ id: t.id, status: t.status });
});

function adminOnly(req, res, next) {
  if (req.get('x-admin-passcode') !== ADMIN_PASSCODE) return bad(res, 'Admin only', 401);
  next();
}
app.get('/api/admin/overview', adminOnly, (req, res) => {
  const d = db();
  res.json({
    pending: d.tutors.filter((t) => t.status === 'pending'),
    approved: d.tutors.filter(isApproved).length,
    students: d.students.length, bookings: d.bookings.length, doubts: d.doubts.length,
  });
});
app.post('/api/admin/tutors/:id/:action', adminOnly, (req, res) => {
  const t = findTutor(req.params.id);
  if (!t) return bad(res, 'Tutor not found', 404);
  if (req.params.action === 'approve') { t.status = 'approved'; t.verified = true; }
  else if (req.params.action === 'reject') { t.status = 'rejected'; t.verified = false; }
  else return bad(res, 'Unknown action');
  store.save();
  res.json(t);
});

/* ------------------------------------------------------------------ doubts (AI) */

app.post('/api/doubts', wrap(async (req, res) => {
  const { studentId, text, image } = req.body || {};
  const student = findStudent(studentId);
  if (!student) return bad(res, 'Please log in first', 401);
  const cleanText = String(text || '').trim().slice(0, 2000);
  if (!cleanText && !image) return bad(res, 'Type your doubt or add a photo');
  const img = image && image.data && image.mime ? { mime: String(image.mime), data: String(image.data) } : null;

  const r = await ai.solveDoubt({ text: cleanText, image: img });
  const doubt = {
    id: store.newId('d'), studentId, text: cleanText || '(photo doubt)', hasImage: !!img,
    subject: r.subject, topic: r.topic, answer: r.answer, confidence: r.confidence, mode: r.mode,
    needsTutor: r.needsTutor, resolved: false, createdAt: Date.now(),
  };
  db().doubts.push(doubt);
  store.save();
  res.json(doubt);
}));

app.get('/api/doubts', (req, res) =>
  res.json(db().doubts.filter((d) => d.studentId === req.query.studentId).sort((a, b) => b.createdAt - a.createdAt))
);

app.post('/api/doubts/:id/resolve', (req, res) => {
  const d = db().doubts.find((x) => x.id === req.params.id);
  if (!d) return bad(res, 'Doubt not found', 404);
  d.resolved = req.body.resolved !== false;
  store.save();
  res.json(d);
});

/* ------------------------------------------------------------------ matching + slots */

app.get('/api/match', (req, res) => {
  const { subject, mode = 'online', area, language } = req.query;
  const ranked = rankTutors({ subject, mode, area, language }).slice(0, 6);
  res.json(ranked.map((t) => ({ ...t, slots: slotsFor(t.id) })));
});

/* ------------------------------------------------------------------ bookings */

app.post('/api/bookings', (req, res) => {
  const { studentId, tutorId, mode, slotKey, slotLabel, groupSize, doubtId, payment, parent } = req.body || {};
  const safetyErr = student0(studentId) && checkSafety(req.body || {}, student0(studentId), (mode || '') !== 'online');
  if (safetyErr && PAY_METHODS.includes(payment && payment.method)) return bad(res, safetyErr);
  const student = findStudent(studentId);
  const tutor = findTutor(tutorId);
  if (!student) return bad(res, 'Please log in first', 401);
  if (!tutor || !isApproved(tutor)) return bad(res, 'Tutor not found', 404);
  if (!['online', 'offline', 'group'].includes(mode)) return bad(res, 'Choose online, home visit or group');
  if ((mode !== 'online' && !tutor.offline) || (mode === 'online' && !tutor.online)) return bad(res, 'This tutor does not offer that mode');
  if (!slotKey) return bad(res, 'Choose a time slot');
  if (!payment || !PAY_METHODS.includes(payment.method)) return bad(res, 'Choose a payment method');
  if (db().bookings.some((b) => b.tutorId === tutorId && b.slotKey === slotKey && b.status === 'booked')) return bad(res, 'That slot was just taken. Pick another.', 409);

  let parentInfo = null;
  if (mode !== 'online') {
    const p = parentFrom(parent, student);
    if (p.error) return bad(res, p.error);
    parentInfo = p.parent;
  }

  const doubt = db().doubts.find((d) => d.id === doubtId);
  const hours = mode === 'group' ? 2 : 1;
  const size = mode === 'group' ? Math.min(6, Math.max(2, Number(groupSize) || 2)) : 1;
  const price = priceBreakdown(tutor, mode, hours, size);
  const id = store.newId('b');

  const booking = {
    id, studentId, studentName: student.name, studentAge: student.age, studentInstitution: student.institution, studentClass: student.classLevel,
    studentAddress: mode !== 'online' ? student.address : null, studentMapUrl: mode !== 'online' ? student.mapUrl : null, guardianAck: mode !== 'online', tutorId, tutorName: tutor.name,
    mode, slotKey, slotLabel, hours, groupSize: size, extraMinutes: 0,
    subject: doubt ? doubt.subject : req.body.subject || 'Other', topic: doubt ? doubt.topic : 'General',
    doubtId: doubt ? doubt.id : null, doubtText: doubt ? doubt.text : '',
    ...price, status: 'booked', notes: '', summary: null, review: null, createdAt: Date.now(),
    payment: receiptFor(payment.method, mode === 'group' ? price.perStudent : price.total), extensions: [],
    parent: parentInfo, messages: [],
    meetUrl: mode === 'online' ? 'https://meet.jit.si/Doubtdoor-' + id : null,
  };
  db().bookings.push(booking);
  store.save();
  res.json(booking);
});

app.get('/api/bookings', (req, res) => {
  const { studentId, tutorId } = req.query;
  let list = db().bookings;
  if (studentId) list = list.filter((b) => b.studentId === studentId);
  if (tutorId) list = list.filter((b) => b.tutorId === tutorId);
  res.json(list.slice().sort((a, b) => b.createdAt - a.createdAt));
});

// Extend a session by 30 or 60 minutes (the student pays the extra amount).
app.post('/api/bookings/:id/extend', (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (b.status !== 'booked') return bad(res, 'Only upcoming sessions can be extended');
  const minutes = Number(req.body.minutes) === 60 ? 60 : 30;
  const tutor = findTutor(b.tutorId);
  const before = b.mode === 'group' ? b.perStudent : b.total;
  b.extraMinutes += minutes;
  Object.assign(b, priceBreakdown(tutor, b.mode, b.hours + b.extraMinutes / 60, b.groupSize));
  const after = b.mode === 'group' ? b.perStudent : b.total;
  b.extensions = b.extensions || [];
  b.extensions.push(receiptFor(b.payment && b.payment.method === 'cash' ? 'cash' : 'upi', after - before));
  b.extensions[b.extensions.length - 1].minutes = minutes;
  store.save();
  res.json(b);
});

// Tutor finishes a session and adds notes; the AI writes the summary.
app.post('/api/bookings/:id/complete', wrap(async (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  b.notes = String((req.body && req.body.notes) || '').slice(0, 1000);
  b.summary = await ai.summarizeSession({
    doubtText: b.doubtText, subject: b.subject, topic: b.topic, notes: b.notes, tutorName: b.tutorName, mode: b.mode,
  });
  b.status = 'completed';
  b.completedAt = Date.now();
  if (b.doubtId) {
    const d = db().doubts.find((x) => x.id === b.doubtId);
    if (d) d.resolved = true;
  }
  store.save();
  res.json(b);
}));

// Student rates a completed session. The tutor's rating is updated.
app.post('/api/bookings/:id/review', (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (b.studentId !== req.body.studentId) return bad(res, 'Only the student can review', 403);
  if (b.status !== 'completed') return bad(res, 'You can review after the session is completed');
  if (b.review) return bad(res, 'Already reviewed');
  const rating = Math.round(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) return bad(res, 'Choose 1 to 5 stars');
  b.review = { rating, comment: String(req.body.comment || '').trim().slice(0, 300), at: Date.now() };
  const t = findTutor(b.tutorId);
  if (t) {
    t.rating = Math.round(((t.rating * t.reviews + rating) / (t.reviews + 1)) * 100) / 100;
    t.reviews += 1;
  }
  store.save();
  res.json(b);
});

// The tutor confirms they received the cash after class.
app.post('/api/bookings/:id/cash-received', (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (req.body.tutorId !== b.tutorId) return bad(res, 'Only the tutor can confirm cash', 403);
  if (!b.payment || b.payment.method !== 'cash') return bad(res, 'This booking is not a cash booking');
  b.payment.status = 'paid'; b.payment.paidAt = Date.now();
  store.save();
  res.json(b);
});

/* ------------------------------------------------------------------ chat */

function canAccess(b, role, userId) {
  return (role === 'student' && b.studentId === userId) || (role === 'tutor' && b.tutorId === userId);
}
app.get('/api/bookings/:id/messages', (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (!canAccess(b, req.query.role, req.query.userId)) return bad(res, 'Not allowed', 403);
  res.json(b.messages || []);
});
app.post('/api/bookings/:id/messages', (req, res) => {
  const b = findBooking(req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  const { role, userId } = req.body || {};
  if (!canAccess(b, role, userId)) return bad(res, 'Not allowed', 403);
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return bad(res, 'Type a message first');
  b.messages = b.messages || [];
  b.messages.push({ from: role, name: role === 'tutor' ? b.tutorName : b.studentName, text, at: Date.now() });
  store.save();
  res.json(b.messages);
});

/* ------------------------------------------------------------------ parent confirmation (no login) */

function parentTarget(id, code) {
  const t = findBooking(id) || db().plans.find((p) => p.id === id);
  if (!t || !t.parent || t.parent.code !== code) return null;
  return t;
}
app.get('/api/parent/:id', (req, res) => {
  const t = parentTarget(req.params.id, req.query.code);
  if (!t) return bad(res, 'This confirmation link is not valid', 404);
  const student = findStudent(t.studentId);
  res.json({
    kind: t.days ? 'plan' : 'session', studentName: student ? student.name : '', tutorName: t.tutorName, subject: t.subject,
    when: t.days ? 'Every Saturday, 5:00 PM (home visit)' : t.slotLabel, mode: t.mode || 'offline',
    parentName: t.parent.name, status: t.parent.status,
  });
});
app.post('/api/parent/:id/confirm', (req, res) => {
  const t = parentTarget(req.params.id, req.body && req.body.code);
  if (!t) return bad(res, 'This confirmation link is not valid', 404);
  t.parent.status = 'confirmed';
  t.parent.confirmedAt = Date.now();
  store.save();
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ progress + weekly plan */

app.get('/api/insights', wrap(async (req, res) => {
  const student = findStudent(req.query.studentId);
  if (!student) return bad(res, 'Please log in first', 401);
  const map = {};
  db().doubts.filter((d) => d.studentId === student.id).forEach((d) => {
    const k = d.subject + '|' + d.topic;
    map[k] = map[k] || { subject: d.subject, topic: d.topic, count: 0, unresolved: 0 };
    map[k].count++;
    if (!d.resolved) map[k].unresolved++;
  });
  const weak = Object.values(map).map((x) => ({ ...x, score: x.count + x.unresolved })).sort((a, b) => b.score - a.score);
  const top = weak[0];
  const needsPlan = !!top && top.score >= 3;
  const tutors = top
    ? rankTutors({ subject: top.subject, mode: 'online', area: student.area, language: student.language }).slice(0, 3)
    : [];
  const advice = await ai.adviseStudent(weak);
  res.json({ weak, needsPlan, topSubject: top ? top.subject : null, advice, tutors, totalDoubts: db().doubts.filter((d) => d.studentId === student.id).length });
}));

app.post('/api/plans', (req, res) => {
  const { studentId, tutorId, subject, payment, parent } = req.body || {};
  const student = findStudent(studentId);
  const tutor = findTutor(tutorId);
  if (!student || !tutor) return bad(res, 'Student or tutor not found', 404);
  if (!tutor.offline) return bad(res, 'This tutor does not do home visits, which the weekly plan needs');
  if (!payment || !PAY_METHODS.includes(payment.method)) return bad(res, 'Choose a payment method');
  const safetyErr = checkSafety(req.body || {}, student, true);
  if (safetyErr) return bad(res, safetyErr);
  const p = parentFrom(parent, student);
  if (p.error) return bad(res, p.error);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => ({ day: d, mode: 'online', time: '6:00 PM' }));
  days.push({ day: 'Sat', mode: 'offline', time: '5:00 PM' });
  const full = 5 * tutor.rateOnline + tutor.rateOffline;
  const price = Math.round(full * 0.9); // 10% bundle discount
  const id = store.newId('p');
  const plan = {
    id, studentId, tutorId, tutorName: tutor.name, subject: subject || tutor.subjects[0],
    days, priceWeek: price, discount: full - price, status: 'active', createdAt: Date.now(),
    payment: receiptFor(payment.method, price), parent: p.parent, meetUrl: 'https://meet.jit.si/Doubtdoor-plan-' + id,
  };
  db().plans = db().plans.filter((x) => x.studentId !== studentId); // one active plan per student
  db().plans.push(plan);
  store.save();
  res.json(plan);
});

app.get('/api/plans', (req, res) => res.json(db().plans.filter((p) => p.studentId === req.query.studentId)));

/* ------------------------------------------------------------------ start */

app.listen(cfg.port, '0.0.0.0', () => {
  console.log('Doubtdoor is running: http://localhost:' + cfg.port);
  console.log(cfg.ai.enabled ? 'AI mode: LIVE (' + cfg.ai.provider + ', ' + cfg.ai.model + ')' : 'AI mode: DEMO (no AI key set, built-in answers)');
});
