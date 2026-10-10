// Tutor matching: ranks tutors for a student, and creates bookable time slots.
const store = require('./store');
const { AREAS } = require('./seed');

const SUBJECTS = ['Maths', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English'];
const LANGUAGES = ['English', 'Telugu', 'Hindi'];
const COMMISSION = 0.15; // the platform keeps 15%, the tutor gets 85%

// Distance between two areas in km (made-up demo values).
const DIST = { 'Hanamkonda|Warangal': 3, 'Hanamkonda|Kazipet': 6, 'Warangal|Kazipet': 8 };
function distanceKm(a, b) {
  if (a === b) return 0.5;
  return DIST[a + '|' + b] || DIST[b + '|' + a] || 4;
}

function hourlyRate(tutor, mode) {
  return mode === 'online' ? tutor.rateOnline : tutor.rateOffline;
}

// mode: "online" | "offline" | "group"
function rankTutors({ subject, mode, area, language }) {
  const db = store.get();
  const needsHome = mode === 'offline' || mode === 'group';
  const list = db.tutors
    .filter((t) => t.status !== 'pending' && t.status !== 'rejected') // only verified tutors are matched
    .filter((t) => (needsHome ? t.offline : t.online))
    .map((t) => {
      const reasons = [];
      let score = 0;

      if (subject && t.subjects.includes(subject)) { score += 40; reasons.push('Teaches ' + subject); }
      else if (!subject) { score += 20; }

      const stars = t.reviews > 0 ? t.rating : 4.0; // new tutors start at a neutral score
      score += (stars / 5) * 25;
      reasons.push(t.reviews > 0 ? 'Rated ' + t.rating.toFixed(1) : 'New tutor');

      if (language && t.languages.includes(language)) { score += 10; reasons.push('Speaks ' + language); }

      if (needsHome) {
        const km = distanceKm(area, t.area);
        score += Math.max(0, 15 - km * 3);
        reasons.push(km + ' km away');
      } else {
        score += 15;
        reasons.push('Available online now');
      }

      const rate = hourlyRate(t, needsHome ? 'offline' : 'online');
      score += Math.max(0, 10 * (1 - rate / 400));

      return { ...t, score: Math.round(score), reasons, rate, distanceKm: needsHome ? distanceKm(area, t.area) : null };
    })
    .sort((a, b) => b.score - a.score);
  // Show only tutors who teach the subject. If there are too few, show the rest below them.
  if (subject) {
    const teaches = list.filter((t) => t.subjects.includes(subject));
    if (teaches.length >= 3) return teaches;
  }
  return list;
}

// Next 3 days, three slots a day, minus slots that are already booked.
function slotsFor(tutorId) {
  const db = store.get();
  const taken = new Set(db.bookings.filter((b) => b.tutorId === tutorId && b.status === 'booked').map((b) => b.slotKey));
  const out = [];
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 3; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    [16, 18, 20].forEach((h) => {
      const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
      if (when <= now) return;
      const key = when.toISOString();
      if (taken.has(key)) return;
      const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayNames[day.getDay()];
      const hh = h > 12 ? h - 12 : h;
      out.push({ key, label: name + ', ' + hh + ':00 PM' });
    });
  }
  return out;
}

function priceBreakdown(tutor, mode, hours, groupSize) {
  const rate = hourlyRate(tutor, mode === 'online' ? 'online' : 'offline');
  const total = Math.round(rate * hours);
  const people = mode === 'group' ? Math.max(1, groupSize || 1) : 1;
  return {
    total,
    perStudent: Math.round(total / people),
    platformFee: Math.round(total * COMMISSION),
    tutorEarning: Math.round(total * (1 - COMMISSION)),
  };
}

module.exports = { rankTutors, slotsFor, priceBreakdown, hourlyRate, distanceKm, SUBJECTS, LANGUAGES, AREAS, COMMISSION };
