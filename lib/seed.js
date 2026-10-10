// Starter (demo) data. It is created the first time the server starts.
// All tutors and the demo student are made-up examples.

const AREAS = ['Hanamkonda', 'Warangal', 'Kazipet'];

function seed() {
  const now = Date.now();
  const base = { status: 'approved', verified: true };
  const tutors = [
    { ...base, id: 't1', name: 'Ravi Teja', subjects: ['Maths', 'Physics'], languages: ['English', 'Telugu'], rating: 4.8, reviews: 112, area: 'Hanamkonda', rateOnline: 150, rateOffline: 250, online: true, offline: true, experience: 4, levels: 'Class 8 to 12, JEE basics', bio: 'Makes tough maths feel easy. Works from the concept first, then practice.' },
    { ...base, id: 't2', name: 'Ananya Sharma', subjects: ['Chemistry', 'Biology'], languages: ['English', 'Hindi'], rating: 4.9, reviews: 87, area: 'Warangal', rateOnline: 180, rateOffline: 300, online: true, offline: true, experience: 5, levels: 'Class 9 to 12, NEET basics', bio: 'Explains reactions and body systems with real-life examples.' },
    { ...base, id: 't3', name: 'Karthik Reddy', subjects: ['Computer Science', 'Maths'], languages: ['English', 'Telugu'], rating: 4.7, reviews: 64, area: 'Kazipet', rateOnline: 200, rateOffline: 320, online: true, offline: true, experience: 3, levels: 'Class 11 to B.Tech year 2', bio: 'Helps with programming, algorithms and logic, with plenty of worked examples.' },
    { ...base, id: 't4', name: 'Priya Nair', subjects: ['English', 'Maths'], languages: ['English', 'Hindi'], rating: 4.6, reviews: 53, area: 'Hanamkonda', rateOnline: 140, rateOffline: 230, online: true, offline: true, experience: 6, levels: 'Class 6 to 12', bio: 'Patient and clear. Great for grammar, essays and building confidence.' },
    { ...base, id: 't5', name: 'Imran Khan', subjects: ['Physics', 'Chemistry'], languages: ['English', 'Hindi'], rating: 4.5, reviews: 41, area: 'Warangal', rateOnline: 160, rateOffline: 260, online: true, offline: true, experience: 4, levels: 'Class 9 to 12', bio: 'Concept-first teaching with exam-style practice.' },
    { ...base, id: 't6', name: 'Sneha Rao', subjects: ['Biology', 'Chemistry'], languages: ['Telugu', 'English'], rating: 4.8, reviews: 95, area: 'Kazipet', rateOnline: 170, rateOffline: 280, online: true, offline: true, experience: 5, levels: 'Class 8 to 12', bio: 'Diagrams, mnemonics and short revision notes that actually stick.' },
    { ...base, id: 't7', name: 'Arjun Mehta', subjects: ['Computer Science', 'Physics'], languages: ['English', 'Hindi'], rating: 4.4, reviews: 30, area: 'Warangal', rateOnline: 190, rateOffline: 0, online: true, offline: false, experience: 2, levels: 'Class 11 to B.Tech year 1', bio: 'Online only. Coding doubts, projects and debugging help.' },
    { ...base, id: 't8', name: 'Divya Lakshmi', subjects: ['Maths', 'Computer Science'], languages: ['Telugu', 'English'], rating: 4.9, reviews: 120, area: 'Hanamkonda', rateOnline: 165, rateOffline: 270, online: true, offline: true, experience: 7, levels: 'Class 8 to B.Sc year 1', bio: 'Top rated for weak-topic revision plans and exam strategy.' },
  ];

  const students = [{ id: 's_demo', name: 'Aarav (demo)', area: 'Hanamkonda', language: 'English', age: 16, institution: 'Demo High School', classLevel: 'Class 10', address: 'Plot 12, Demo Colony, Hanamkonda', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hanamkonda', parentName: 'Mr. Sharma (demo)', parentPhone: '9876543210' }];

  const d = (n, text, subject, topic, resolved) => ({
    id: 'd_demo' + n, studentId: 's_demo', text, subject, topic,
    answer: 'Sample answer saved from an earlier session.', confidence: 0.8, mode: 'demo',
    resolved, needsTutor: !resolved, createdAt: now - n * 86400000,
  });
  const doubts = [
    d(1, 'How do I solve x^2 - 5x + 6 = 0?', 'Maths', 'Quadratic equations', false),
    d(2, 'Why is the discriminant negative sometimes?', 'Maths', 'Quadratic equations', false),
    d(3, 'Completing the square, I get stuck at the middle step', 'Maths', 'Quadratic equations', true),
    d(4, 'What is Newton third law with an example?', 'Physics', "Newton's laws", true),
    d(5, 'How many moles are in 36 g of water?', 'Chemistry', 'Mole concept', false),
  ];

  return { tutors, students, doubts, bookings: [], plans: [] };
}

module.exports = { seed, AREAS };
