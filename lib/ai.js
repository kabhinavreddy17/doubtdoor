// The AI layer.
// 1) If an AI key is set, it asks a real AI model (Gemini by default, or Claude).
// 2) If there is no key (or the AI call fails), it falls back to a built-in DEMO mode
//    so the app never breaks during your demo.
const cfg = require('./config');

const SUBJECT_LIST = ['Maths', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English', 'Other'];

/* ---------------------------------------------------------------- real AI calls */

async function callModel(prompt, image) {
  const { provider, key, model, baseUrl } = cfg.ai;
  const signal = AbortSignal.timeout(30000);

  if (provider === 'anthropic') {
    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.data } });
    content.push({ type: 'text', text: prompt });
    const res = await fetch((baseUrl || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) throw new Error('AI error ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    return (data.content || []).map((p) => p.text || '').join('');
  }

  // Gemini
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  const url = (baseUrl || 'https://generativelanguage.googleapis.com') + '/v1beta/models/' + model + ':generateContent';
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  if (!res.ok) throw new Error('AI error ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  const ps = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return ps.filter((p) => !p.thought).map((p) => p.text || '').join('');
}

function parseJson(text) {
  const clean = String(text).replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI did not return JSON');
  return JSON.parse(clean.slice(start, end + 1));
}

/* ---------------------------------------------------------------- demo mode (no key) */

const TOPICS = [
  { subject: 'Maths', topic: 'Quadratic equations', re: /quadratic|x\s*\^?\s*2|x²|discriminant|\broots?\b/i },
  { subject: 'Maths', topic: 'Trigonometry', re: /\b(sin|cos|tan)\b|trigon/i },
  { subject: 'Maths', topic: 'Calculus', re: /deriv|integral|integrat|differentiat|\blimit/i },
  { subject: 'Maths', topic: 'Algebra', re: /equation|simplify|factor|algebra|polynomial|\bsolve\b/i },
  { subject: 'Physics', topic: "Newton's laws", re: /newton|\bforce\b|inertia|acceleration|momentum/i },
  { subject: 'Physics', topic: 'Electricity', re: /current|voltage|resistance|\bohm|circuit/i },
  { subject: 'Chemistry', topic: 'Mole concept', re: /\bmoles?\b|molar|avogadro|stoichiometr/i },
  { subject: 'Chemistry', topic: 'Chemical bonding', re: /\bbond|ionic|covalent|electronegativ/i },
  { subject: 'Biology', topic: 'Photosynthesis', re: /photosynth|chlorophyll|chloroplast/i },
  { subject: 'Biology', topic: 'Cell biology', re: /\bcells?\b|mitochondria|nucleus|\bdna\b/i },
  { subject: 'Computer Science', topic: 'Algorithms', re: /algorithm|binary search|sorting|complexity|big o/i },
  { subject: 'Computer Science', topic: 'Programming', re: /python|java|\bloop|function|array|\bcode\b|recursion/i },
  { subject: 'English', topic: 'Grammar', re: /grammar|\btense|essay|\bverb|\bnoun|sentence/i },
];

const CANNED = {
  'Quadratic equations': 'A quadratic equation looks like ax² + bx + c = 0.\n1) Try factorising: find two numbers that multiply to c and add to b.\n2) If that is hard, use the formula x = (-b ± √(b² - 4ac)) / 2a.\n3) The part b² - 4ac is the discriminant. Positive means 2 real roots, zero means 1 root, negative means no real roots.',
  Trigonometry: 'Remember the core ratios: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.\nStart by drawing the right triangle and labelling the sides, then pick the ratio that uses the two sides you know.',
  Calculus: 'For derivatives, use the power rule: d/dx (xⁿ) = n·xⁿ⁻¹.\nBreak the expression into terms, differentiate each one, then add the results. For integrals, do the reverse and add + C.',
  Algebra: 'Treat an equation like a balance: whatever you do to one side, do to the other.\n1) Expand brackets. 2) Collect like terms. 3) Move the unknown to one side. 4) Divide to get the answer, then substitute back to check.',
  "Newton's laws": '1st law: an object stays at rest or moves steadily unless a force acts on it.\n2nd law: F = m × a (more force means more acceleration, more mass means less).\n3rd law: every action has an equal and opposite reaction, for example a rocket pushes gas down and the gas pushes the rocket up.',
  Electricity: 'Ohm\'s law: V = I × R (voltage = current × resistance).\nFor a circuit, first decide if components are in series (same current) or parallel (same voltage), then apply V = IR to each part.',
  'Mole concept': 'Moles = given mass ÷ molar mass.\nFor example water (H₂O) has molar mass 18 g/mol, so 36 g of water is 36 ÷ 18 = 2 moles. One mole contains 6.022 × 10²³ particles.',
  'Chemical bonding': 'Ionic bonds form when one atom gives electrons to another (metal + non-metal). Covalent bonds form when atoms share electrons (non-metal + non-metal).\nCheck the electronegativity difference to decide which one you have.',
  Photosynthesis: 'Plants make food using light: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.\nIt happens in chloroplasts. The light reaction makes energy carriers (ATP, NADPH) and the Calvin cycle uses them to build glucose.',
  'Cell biology': 'The cell is the basic unit of life. The nucleus holds DNA and controls the cell, mitochondria release energy, and the cell membrane controls what goes in and out.\nPlant cells also have a cell wall and chloroplasts.',
  Algorithms: 'Binary search works on a sorted list: check the middle element, then discard the half that cannot contain your target, and repeat.\nIt takes O(log n) steps, which is far faster than checking every element (O(n)).',
  Programming: 'Break the problem into small steps and write each step as a line of code.\nFor loops repeat work, functions package a task you can reuse, and arrays store many values. Test with a small input first and print values to see what is happening.',
  Grammar: 'First find the subject and the verb of your sentence, then make sure the verb matches the subject and the tense matches the time you mean.\nRead the sentence aloud, since mistakes are often easy to hear.',
};

function solveQuadratic(text) {
  const t = text.replace(/²/g, '^2').replace(/\s+/g, '').replace(/−/g, '-');
  const m = t.match(/([+-]?\d*\.?\d*)x\^2([+-]\d*\.?\d*)?x?([+-]\d+\.?\d*)?=0/i);
  if (!m) return null;
  const num = (s, dflt) => (s === undefined || s === '' ? dflt : s === '+' ? 1 : s === '-' ? -1 : parseFloat(s));
  const a = num(m[1], 1);
  const hasX = /x(?!\^)/i.test(t.replace(/x\^2/gi, ''));
  const b = hasX ? num(m[2], 0) : 0;
  const c = m[3] ? parseFloat(m[3]) : 0;
  if (!a) return null;
  const D = b * b - 4 * a * c;
  const fmt = (n) => (Math.round(n * 1000) / 1000).toString();
  let roots;
  if (D > 0) roots = 'x = ' + fmt((-b + Math.sqrt(D)) / (2 * a)) + ' or x = ' + fmt((-b - Math.sqrt(D)) / (2 * a));
  else if (D === 0) roots = 'x = ' + fmt(-b / (2 * a)) + ' (one repeated root)';
  else roots = 'No real roots, because the discriminant is negative.';
  return 'Here a = ' + a + ', b = ' + b + ', c = ' + c + '.\nDiscriminant D = b² - 4ac = ' + fmt(D) + '.\n' + roots;
}

function demoSolve(text, hasImage) {
  const found = TOPICS.find((t) => t.re.test(text));
  if (!found) {
    return {
      subject: 'Other', topic: 'General',
      answer: hasImage && !text.trim()
        ? 'Demo mode cannot read photos. Add a short description of the question, or connect an AI key to read photos directly.'
        : 'Demo mode only knows a few common topics. Connect an AI key for answers to any question, or book a tutor for a quick explanation.',
      confidence: 0.3, needsTutor: true,
    };
  }
  let answer = CANNED[found.topic];
  if (found.topic === 'Quadratic equations') {
    const solved = solveQuadratic(text);
    if (solved) answer = 'Let us solve it.\n' + solved + '\n\nMethod: ' + answer;
  }
  return { subject: found.subject, topic: found.topic, answer, confidence: 0.6, needsTutor: false };
}

/* ---------------------------------------------------------------- public functions */

async function solveDoubt({ text, image }) {
  if (cfg.ai.enabled) {
    try {
      const prompt =
        'You are Doubtdoor\'s study assistant for school and college students in India. ' +
        'Answer the student\'s doubt clearly, step by step, in simple English, in under 180 words. ' +
        'If a photo is attached, read the question from it.\n' +
        'Respond ONLY with JSON in exactly this shape: ' +
        '{"subject": one of ' + JSON.stringify(SUBJECT_LIST) + ', "topic": "short topic name", "answer": "the step by step answer", ' +
        '"confidence": number between 0 and 1, "needs_tutor": true if the doubt is complex, unclear or you are not confident}.\n\n' +
        'Student\'s doubt: ' + (text || '(see the photo)');
      const out = parseJson(await callModel(prompt, image));
      const subject = SUBJECT_LIST.includes(out.subject) ? out.subject : 'Other';
      return {
        subject, topic: String(out.topic || 'General').slice(0, 60), answer: String(out.answer || ''),
        confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0.7)),
        needsTutor: !!out.needs_tutor, mode: 'live',
      };
    } catch (e) {
      console.error('[ai] falling back to demo mode:', e.message);
      return { ...demoSolve(text || '', !!image), mode: 'demo-fallback' };
    }
  }
  return { ...demoSolve(text || '', !!image), mode: 'demo' };
}

async function summarizeSession({ doubtText, subject, topic, notes, tutorName, mode }) {
  const fallback = () => ({
    summary:
      'Session with ' + tutorName + ' (' + mode + ') on ' + (topic || subject || 'the doubt') + '. ' +
      (notes ? 'Tutor notes: ' + notes : 'The tutor went through the doubt step by step.'),
    revise: [
      'Re-attempt 5 practice questions on ' + (topic || subject || 'this topic'),
      'Write the key formula or steps in your own words',
      'Note any new doubts for the next session',
    ],
    mode: 'demo',
  });
  if (!cfg.ai.enabled) return fallback();
  try {
    const prompt =
      'Write a short, friendly study summary for a student and their parent after a tutoring session.\n' +
      'Subject: ' + subject + '. Topic: ' + topic + '. Student\'s doubt: ' + (doubtText || 'n/a') + '. Tutor: ' + tutorName + '. Mode: ' + mode + '.\n' +
      'Tutor\'s notes: ' + (notes || 'none') + '.\n' +
      'Respond ONLY with JSON: {"summary": "2-3 sentences on what was covered", "revise": ["3 short revision tasks"]}.';
    const out = parseJson(await callModel(prompt));
    return { summary: String(out.summary || ''), revise: (out.revise || []).slice(0, 4).map(String), mode: 'live' };
  } catch (e) {
    console.error('[ai] summary fallback:', e.message);
    return fallback();
  }
}

async function adviseStudent(weak) {
  const top = weak[0];
  const fallback = top
    ? 'You keep getting stuck on ' + top.topic + ' (' + top.subject + '). A short weekly plan with one tutor, five online sessions and one home visit, will help you fix the basics.'
    : 'Ask a few doubts to see your weak topics here.';
  if (!cfg.ai.enabled || !top) return fallback;
  try {
    const list = weak.slice(0, 4).map((w) => w.topic + ' (' + w.subject + ', ' + w.count + ' doubts, ' + w.unresolved + ' unresolved)').join('; ');
    const prompt = 'A student has these weak topics: ' + list + '. In 2 friendly sentences, tell them what to focus on and why a weekly plan with one tutor helps. Respond ONLY with JSON: {"advice": "..."}';
    const out = parseJson(await callModel(prompt));
    return String(out.advice || fallback);
  } catch (e) {
    return fallback;
  }
}

module.exports = { solveDoubt, summarizeSession, adviseStudent };
