// Doubtdoor front end. One page, no framework. Screens are drawn by render().
const S = {
  user: null, view: 'ask', cfg: { subjects: [], languages: [], areas: [], aiEnabled: false },
  ask: { text: '', photo: null, loading: false, doubt: null, error: '', showTutors: false },
  mode: 'online', tutors: [], tutorsBusy: false, history: [],
  bookings: [], plans: [], insights: null, admin: null, tutorProfile: null,
  chatOpen: null, chats: {}, rev: {}, notes: {}, modal: null, pendingAsk: false,
};
try { S.user = JSON.parse(localStorage.getItem('dd_user') || 'null'); } catch (e) { /* ignore */ }

const saveUser = () => { try { S.user ? localStorage.setItem('dd_user', JSON.stringify(S.user)) : localStorage.removeItem('dd_user'); } catch (e) { /* ignore */ } };
const origin = () => location.origin;
const parentLink = (t) => `${origin()}/parent.html?id=${t.id}&code=${t.parent.code}`;

/* ------------------------------------------------------------------ pieces */

function topbar() {
  const u = S.user;
  const tabs = !u ? [] : u.role === 'student' ? [['ask', 'Ask'], ['sessions', 'My sessions'], ['progress', 'Progress and plan']]
    : u.role === 'tutor' ? [['tutor', 'My dashboard']] : [['admin', 'Applications']];
  return `<header class="top"><div class="wrap">
    <button class="brand" data-act="home" aria-label="Doubtdoor home">${LOGO}Doubtdoor</button>
    <nav class="tabs" aria-label="Main">${tabs.map(([k, l]) => `<button data-act="go" data-v="${k}" ${S.view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>
    <div class="who">${u
      ? `<span class="name">${esc(u.name)}</span><button class="btn quiet sm" data-act="logout">Log out</button>`
      : `<button class="btn quiet sm" data-act="apply">Become a tutor</button><button class="btn sm" data-act="login">Log in</button>`}</div>
  </div></header>`;
}

function askBox(heading, lede) {
  const a = S.ask;
  const subs = S.cfg.subjects;
  return `<section class="hero"><div class="wrap">
    <h1>${heading}</h1>
    <p class="lede">${lede}</p>
    <form class="paper" data-form="ask">
      <label class="sr" for="q">Your doubt</label>
      <textarea id="q" placeholder="Type your doubt here. For example: How do I solve x² − 5x + 6 = 0?" ${a.loading ? 'disabled' : ''}>${esc(a.text)}</textarea>
      <div class="bar">
        <label class="btn quiet sm" style="cursor:pointer">Add a photo<input type="file" id="photo" accept="image/*" class="sr"></label>
        <span class="photo-name">${a.photo ? esc(a.photo.name) + ' <button type="button" class="link" data-act="clearPhoto">remove</button>' : 'Optional: a picture of the question'}</span>
        <span class="grow"></span>
        <button class="btn" type="submit" ${a.loading ? 'disabled' : ''}>${a.loading ? '<span class="spin"></span> Thinking' : 'Get my answer'}</button>
      </div>
    </form>
    ${a.error ? `<p class="err" role="alert">${esc(a.error)}</p>` : ''}
    <p class="small muted" style="margin-top:12px">Works for ${subs.map(esc).join(', ')}. Free to ask.</p>
  </div></section>`;
}

function answerBlock() {
  const d = S.ask.doubt;
  if (!d) return '';
  const live = d.mode === 'live';
  return `<div class="wrap"><article class="answer" aria-live="polite">
    <header><span class="pill">${esc(d.subject)}</span><span class="pill grey">${esc(d.topic)}</span><span class="grow"></span>
      <span class="small muted">${live ? 'Answered by AI' : 'Demo answer (no AI key set)'}</span></header>
    <div class="body">${md(d.answer)}</div>
    <footer>
      ${d.resolved ? `<span class="pill">Marked as solved</span>` : `<span class="hand">Did that clear it up?</span>
      <button class="btn sm" data-act="solved" data-id="${d.id}">Yes, solved</button>
      <button class="btn ghost sm" data-act="needTutor">Not yet, find me a tutor</button>`}
      ${d.needsTutor && !d.resolved ? `<span class="pill warn">The AI suggests a tutor for this one</span>` : ''}
    </footer>
  </article>
  ${S.ask.showTutors || d.needsTutor ? tutorSection(d.subject) : ''}</div>`;
}

function tutorSection(subject) {
  const modes = [['online', 'Online now'], ['offline', 'Home visit'], ['group', 'Group of friends']];
  return `<div style="margin-top:34px">
    <h2>Tutors near ${esc(S.user ? S.user.area : S.cfg.areas[0])} for ${esc(subject)}</h2>
    <p class="muted" style="margin:6px 0 14px">Ranked by subject, rating, language, distance and price.</p>
    <div class="seg" role="group" aria-label="How do you want to learn">${modes.map(([k, l]) => `<button data-act="mode" data-m="${k}" aria-pressed="${S.mode === k}">${l}</button>`).join('')}</div>
    ${S.mode === 'group' ? `<p class="small muted" style="margin-top:8px">A group slot is 2 hours at a student's home. The price is shared between 2 to 6 friends, and you can extend it later.</p>` : ''}
    <div class="tutor-list">${S.tutorsBusy ? `<p class="empty"><span class="spin dark"></span> Finding tutors…</p>`
      : S.tutors.length ? S.tutors.map((t, i) => tutorRow(t, i === 0)).join('') : `<p class="empty">No tutors offer this mode right now. Try another one.</p>`}</div>
  </div>`;
}

function tutorRow(t, best) {
  const rate = S.mode === 'online' ? t.rateOnline : t.rateOffline;
  const sub = S.mode === 'group' ? ' / hour, shared' : ' / hour';
  return `<div class="trow">
    ${avatar(t.name)}
    <div><div>${best ? '<span class="best">Best match </span>' : ''}<b>${esc(t.name)}</b> <span class="verified">Verified</span></div>
      <div class="meta">${t.reviews ? stars(t.rating) + ' ' + t.rating.toFixed(1) + ' (' + t.reviews + ')' : 'New tutor'} &nbsp;${esc(t.subjects.join(', '))}</div>
      <div class="meta">${esc(t.reasons.join(', '))}</div></div>
    <div class="price"><b>${money(rate)}</b><span class="small muted">${sub}</span>
      <div class="acts"><button class="btn quiet sm" data-act="profile" data-id="${t.id}">Profile</button><button class="btn sm" data-act="book" data-id="${t.id}">Book</button></div></div>
  </div>`;
}

function historyBlock() {
  if (!S.user || S.user.role !== 'student') return '';
  const h = S.history.filter((d) => !S.ask.doubt || d.id !== S.ask.doubt.id);
  return `<div class="wrap" style="margin-top:40px"><h2>Your earlier doubts</h2>
    ${h.length ? `<div class="rows">${h.slice(0, 8).map((d) => `<div class="row"><div class="head"><b class="grow">${esc(d.text)}</b>
      <span class="pill grey">${esc(d.subject)}</span>${d.resolved ? '<span class="pill">Solved</span>' : '<span class="pill warn">Open</span>'}</div>
      <div class="small muted" style="margin-top:4px">${esc(d.topic)}, ${fmtDate(d.createdAt)}</div></div>`).join('')}</div>`
      : `<p class="empty"><span class="hand">Nothing here yet.</span>Ask your first doubt above and it will show up here.</p>`}</div>`;
}

/* ------------------------------------------------------------------ landing (guests) */

function landing() {
  const faq = [
    ['Is it really free to ask a doubt?', 'Yes. The AI answer is free. You only pay when you book a tutor, and you see the full price before you pay.'],
    ['How are tutors paid?', 'The tutor keeps 85% of every session and Doubtdoor keeps 15%. Tutors set their own hourly rate, so nobody is squeezed.'],
    ['Is a home visit safe?', 'Every tutor is approved by our team first. A parent or guardian must confirm each home visit with one tap, and the student and tutor can chat before the session.'],
    ['What if the AI answer is wrong?', 'It tells you how sure it is, and it suggests a tutor when the doubt is tricky. You can always book one with a tap.'],
    ['Can friends share one tutor?', 'Yes. A group slot is 2 hours at one student\'s home with up to 6 friends. The cost is split, and you can add 30 or 60 minutes from the website if you need more time.'],
  ];
  return `
  <section class="band"><div class="wrap">
    <div class="sec-head"><h2>Three ways to get unstuck</h2><p>Start with the AI. Move to a person whenever you need one.</p></div>
    <div class="scroll-x"><table class="ways"><thead><tr><th></th><th>Online</th><th>Home visit</th><th>Group of friends</th></tr></thead><tbody>
      <tr><th>How it works</th><td>Video call and chat with a local tutor, usually within the hour.</td><td>The tutor comes to your home. A parent confirms first.</td><td>2 hours at one home, up to 6 students, cost shared.</td></tr>
      <tr><th>Good for</th><td>Quick doubts and homework</td><td>Weak topics and exam prep</td><td>Revision before tests</td></tr>
      <tr><th>Price</th><td>From ${money(140)} per hour</td><td>From ${money(230)} per hour</td><td>From ${money(115)} per student</td></tr>
    </tbody></table></div>
  </div></section>

  <section class="band tint"><div class="wrap split">
    <div><h2>One tutor for the whole week</h2>
      <p class="muted" style="margin-top:10px">When the same topic keeps coming back, Doubtdoor spots it and offers a weekly plan: five online sessions and a home visit on Saturday, all with one tutor who knows where you are stuck. Taking the plan saves 10%.</p>
      <p class="hand" style="margin-top:14px">Same tutor, every day.</p></div>
    <div class="week" role="img" aria-label="Monday to Friday online, Saturday home visit">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<div><b>${d}</b><span>Online</span><span>6:00 PM</span></div>`).join('')}
      <div><b>Sat</b><span class="home">Home visit</span><span>5:00 PM</span></div>
    </div>
  </div></section>

  <section class="band"><div class="wrap split">
    <div><h2>Good pay for local tutors</h2>
      <p class="muted" style="margin-top:10px">College students, teachers and graduates near you can teach on their own schedule and keep 85% of what the student pays. No hunting for students, no chasing payments.</p>
      <p style="margin-top:16px"><button class="btn" data-act="apply">Become a tutor</button></p></div>
    <ul class="facts">
      <li><b>Set your own rate</b>Online and home visit rates are separate.</li>
      <li><b>Paid for every minute</b>Extensions are charged to the student and added to your earnings.</li>
      <li><b>Reviews build your name</b>Good sessions move you up the match list.</li>
    </ul>
  </div></section>

  <section class="band tint"><div class="wrap"><div class="sec-head"><h2>Questions people ask</h2></div>
    ${faq.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}
  </div></section>`;
}

function footer() {
  return `<footer class="foot"><div class="wrap"><span><b>Doubtdoor</b>, built for an AI-thon. Payments and tutors in this demo are made up and no real money moves.</span>
    <span>${S.cfg.aiEnabled ? 'AI answers are live' : 'AI is in demo mode'}</span></div></footer>`;
}

/* ------------------------------------------------------------------ student screens */

function askView() {
  const u = S.user;
  const first = u ? String(u.name).replace(/\(.*\)/, '').trim().split(' ')[0] : '';
  const heading = u ? `What are you stuck on, ${esc(first)}?` : `Stuck on a question? Get it solved today<svg class="tick" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 17l7 7L27 7" stroke="#0f8a4f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const lede = u ? 'Type it or snap it. You get an answer in seconds, and a tutor if you need one.'
    : 'Ask any school or college doubt and get an instant answer. If it is still not clear, a local tutor can help online or at your home.';
  return askBox(heading, lede) + answerBlock() + (u ? historyBlock() : landing());
}

function statusPill(b) {
  if (b.status === 'completed') return '<span class="pill">Completed</span>';
  return '<span class="pill warn">Upcoming</span>';
}
function parentPill(p) {
  if (!p) return '';
  return p.status === 'confirmed' ? '<span class="pill">Parent confirmed</span>' : '<span class="pill warn">Waiting for parent</span>';
}
function parentShare(t) {
  if (!t.parent || t.parent.status === 'confirmed') return '';
  const link = parentLink(t);
  const msg = `Hello ${t.parent.name}, please confirm the Doubtdoor home visit with ${t.tutorName}: ${link}`;
  return `<div class="note warn small">Send this link to ${esc(t.parent.name)}. The visit is confirmed when they open it and tap confirm.
    <div class="acts"><button class="btn quiet sm" data-act="copy" data-v="${esc(link)}">Copy link</button>
    <a class="btn quiet sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Share on WhatsApp</a>
    <a class="btn quiet sm" target="_blank" rel="noopener" href="${esc(link)}">Open as parent</a></div></div>`;
}

function chatBlock(b, role) {
  const msgs = S.chats[b.id] || [];
  return `<div class="chat"><div class="log" id="log-${b.id}" tabindex="0">${chatLog(msgs, role)}</div>
    <form data-form="chat" data-id="${b.id}"><label class="sr" for="msg-${b.id}">Message</label><input type="text" id="msg-${b.id}" placeholder="Write a message" maxlength="500" autocomplete="off"><button class="btn sm" type="submit">Send</button></form></div>`;
}
function chatLog(msgs, role) {
  if (!msgs.length) return `<p class="small muted">No messages yet. Say hello and share what you want to cover.</p>`;
  return msgs.map((m) => `<div class="bubble ${m.from === role ? 'me' : ''}"><small>${esc(m.name)}, ${fmtTime(m.at)}</small>${esc(m.text)}</div>`).join('');
}

function bookingRow(b, role) {
  const other = role === 'student' ? b.tutorName : b.studentName;
  const open = S.chatOpen === b.id;
  const amount = role === 'student' ? (b.mode === 'group' ? b.perStudent : b.total) : b.tutorEarning;
  const perHour = (b.mode === 'group' ? b.perStudent : b.total) / (b.hours + b.extraMinutes / 60);
  const rv = S.rev[b.id] || { rating: 0, comment: '' };
  const cash = b.payment && b.payment.method === 'cash', cashPaid = cash && b.payment.status === 'paid';
  return `<div class="row" id="b-${b.id}">
    <div class="head"><b class="grow">${esc(b.topic)}, ${esc(b.subject)}</b>${statusPill(b)}<span class="pill grey">${MODE_LABEL[b.mode]}</span>${parentPill(b.parent)}</div>
    <dl class="kv"><dt>${role === 'student' ? 'Tutor' : 'Student'}</dt><dd>${esc(other)}</dd>
      <dt>When</dt><dd>${esc(b.slotLabel)}, ${(b.hours * 60 + b.extraMinutes) / 60} hour${(b.hours * 60 + b.extraMinutes) === 60 ? '' : 's'}${b.mode === 'group' ? ', ' + b.groupSize + ' students' : ''}</dd>
      ${b.doubtText ? `<dt>Doubt</dt><dd>${esc(b.doubtText)}</dd>` : ''}
      <dt>${role === 'student' ? (cash ? 'You pay' : 'You paid') : 'You earn'}</dt><dd>${money(amount)} ${role === 'student' && b.payment && !cash ? `<span class="small muted">via ${esc(b.payment.method.toUpperCase())}, receipt ${esc(b.payment.receipt)} (demo)</span>` : ''}</dd>
      ${cash ? `<dt>Payment</dt><dd>${cashPaid ? '<span class="pill">Cash received by tutor</span>' : '<span class="pill bad">Cash due after class</span>'}</dd>` : ''}
      ${role === 'tutor' ? `<dt>About</dt><dd>${esc(b.studentAge ? b.studentAge + ' years, ' : '')}${esc(b.studentClass || '')}${b.studentInstitution ? ', ' + esc(b.studentInstitution) : ''}</dd>
        ${b.studentAddress ? `<dt>Home address</dt><dd>${esc(b.studentAddress)} <a target="_blank" rel="noopener" href="${esc(b.studentMapUrl)}">Open in Google Maps</a></dd>` : ''}` : ''}</dl>
    ${cash && !cashPaid && role === 'student' ? `<div style="margin-top:10px">${cashNote(amount)}</div>` : ''}
    ${cash && !cashPaid && role === 'tutor' ? `<div class="note warn small">Collect ${money(b.mode === 'group' ? b.perStudent : b.total)} in cash from the student after the class, then confirm below.</div>` : ''}
    ${b.studentAddress && role === 'tutor' && b.parent ? `<p class="small muted" style="margin-top:6px">Parent or guardian: ${esc(b.parent.name)}, ${esc(b.parent.phone)}. ${b.parent.status === 'confirmed' ? 'They have confirmed this visit.' : 'They have not confirmed yet.'}</p>` : ''}
    ${role === 'student' ? parentShare(b) : ''}
    ${b.status === 'booked' ? `<div class="acts">
      ${b.meetUrl ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(b.meetUrl)}">Join video call</a>` : ''}
      <button class="btn quiet sm" data-act="chat" data-id="${b.id}">${open ? 'Hide chat' : 'Chat'}</button>
      ${role === 'student' ? `<button class="btn quiet sm" data-act="extend" data-id="${b.id}" data-min="30">Add 30 min (${money(perHour / 2)})</button><button class="btn quiet sm" data-act="extend" data-id="${b.id}" data-min="60">Add 1 hour (${money(perHour)})</button>` : ''}
      ${role === 'tutor' ? '' : ''}
    </div>` : ''}
    ${open && b.status === 'booked' ? chatBlock(b, role) : ''}
    ${role === 'tutor' && b.status === 'booked' ? `<div style="margin-top:12px"><label class="f" for="n-${b.id}">What did you cover? The AI turns this into a summary for the student.</label>
      <textarea class="plain" id="n-${b.id}" data-note="${b.id}" rows="2" placeholder="Example: factorised x² − 5x + 6 and checked the roots">${esc(S.notes[b.id] || '')}</textarea>
      <div class="acts"><button class="btn sm" data-act="complete" data-id="${b.id}">Mark session complete</button></div></div>` : ''}
    ${role === 'tutor' && cash && !cashPaid && b.status === 'completed' ? `<div class="acts"><button class="btn sm" data-act="cashin" data-id="${b.id}">Confirm cash received</button></div>` : ''}
    ${b.status === 'completed' && b.summary ? `<div class="note"><b>Session summary</b><p style="margin-top:4px">${esc(b.summary.summary)}</p>
      ${b.summary.revise && b.summary.revise.length ? `<ul style="margin:8px 0 0;padding-left:20px">${b.summary.revise.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    ${role === 'student' && b.status === 'completed' ? (b.review
      ? `<p class="small" style="margin-top:10px">You rated this ${stars(b.review.rating)} ${b.review.comment ? '“' + esc(b.review.comment) + '”' : ''}</p>`
      : `<div style="margin-top:12px"><span class="hand">How was ${esc(b.tutorName.split(' ')[0])}?</span>
        <div class="chips" style="margin-top:6px" role="group" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-act="rate" data-id="${b.id}" data-n="${n}" aria-pressed="${rv.rating === n}">${n} ★</button>`).join('')}</div>
        <input type="text" style="margin-top:8px" placeholder="One line about the session (optional)" data-rev="${b.id}" value="${esc(rv.comment)}" maxlength="300">
        <div class="acts"><button class="btn sm" data-act="review" data-id="${b.id}">Submit review</button></div></div>`) : ''}
  </div>`;
}

function sessionsView() {
  const list = S.bookings;
  return `<div class="page"><div class="wrap"><h2>My sessions</h2>
    <p class="muted">Join your video call, chat with your tutor, add time, and rate sessions once they are done.</p>
    ${S.plans.length ? S.plans.map(planCard).join('') : ''}
    ${list.length ? `<div class="rows">${list.map((b) => bookingRow(b, 'student')).join('')}</div>`
      : `<p class="empty"><span class="hand">No sessions yet.</span>Ask a doubt and book a tutor when you want a person to explain it.</p><button class="btn" data-act="go" data-v="ask">Ask a doubt</button>`}
  </div></div>`;
}

function weekStrip(p) {
  return `<div class="week" style="margin-top:12px">${p.days.map((d) => `<div><b>${d.day}</b><span class="${d.mode === 'offline' ? 'home' : ''}">${d.mode === 'offline' ? 'Home visit' : 'Online'}</span><span>${d.time}</span></div>`).join('')}</div>`;
}
function planCard(p) {
  return `<div class="note" style="margin:18px 0"><div class="head" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><h3 style="flex:1">Weekly plan with ${esc(p.tutorName)}</h3>${parentPill(p.parent)}<span class="pill">${esc(p.subject)}</span></div>
    ${weekStrip(p)}
    <p class="small muted" style="margin-top:8px">${money(p.priceWeek)} a week, you saved ${money(p.discount)}. Paid via ${esc(p.payment.method.toUpperCase())}, receipt ${esc(p.payment.receipt)} (demo).</p>
    ${parentShare(p)}
    <div class="acts" style="display:flex;gap:8px;margin-top:10px"><a class="btn sm" target="_blank" rel="noopener" href="${esc(p.meetUrl)}">Join the weekly video room</a></div></div>`;
}

function progressView() {
  const i = S.insights;
  if (!i) return `<div class="page"><div class="wrap"><p class="empty"><span class="spin dark"></span> Loading…</p></div></div>`;
  const max = Math.max(1, ...i.weak.map((w) => w.score));
  const havePlan = S.plans.length > 0;
  const offlineTutors = i.tutors.filter((t) => t.offline);
  return `<div class="page"><div class="wrap"><h2>Progress and plan</h2>
    <p class="muted">Doubtdoor reads your doubts and shows where you keep getting stuck.</p>
    <div class="stats"><div><b>${i.totalDoubts}</b>doubts asked</div><div><b>${i.weak.filter((w) => w.unresolved).length}</b>topics still open</div><div><b>${S.bookings.filter((b) => b.status === 'completed').length}</b>tutor sessions done</div></div>
    ${i.weak.length ? `<h3>Weak topics</h3>${i.weak.slice(0, 6).map((w) => `<div class="bar-row"><span><b>${esc(w.topic)}</b> <span class="small muted">${esc(w.subject)}</span></span>
      <div class="meter"><i class="${w.unresolved ? 'hot' : ''}" style="width:${Math.round(w.score / max * 100)}%"></i></div><span class="small muted">${w.count} asked, ${w.unresolved} open</span></div>`).join('')}`
      : `<p class="empty"><span class="hand">No weak topics yet.</span>Ask a few doubts and they will show up here.</p>`}
    ${i.advice ? `<div class="note" style="margin-top:14px"><b>Advice</b><p style="margin-top:4px">${esc(i.advice)}</p></div>` : ''}
    ${havePlan ? S.plans.map(planCard).join('') : (i.needsPlan ? `
      <h2 style="margin-top:36px">A weekly plan for ${esc(i.topSubject)}</h2>
      <p class="muted" style="margin:6px 0 12px">Five online sessions at 6 PM and one home visit on Saturday, with the same tutor. 10% cheaper than booking each one.</p>
      <div class="week">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<div><b>${d}</b><span>Online</span><span>6:00 PM</span></div>`).join('')}<div><b>Sat</b><span class="home">Home visit</span><span>5:00 PM</span></div></div>
      <div class="tutor-list">${offlineTutors.map((t) => {
        const full = 5 * t.rateOnline + t.rateOffline;
        return `<div class="trow">${avatar(t.name)}<div><b>${esc(t.name)}</b> <span class="verified">Verified</span><div class="meta">${t.reviews ? stars(t.rating) + ' ' + t.rating.toFixed(1) : 'New tutor'} &nbsp;${esc(t.reasons.join(', '))}</div></div>
        <div class="price"><b>${money(full * 0.9)}</b><span class="small muted"> / week</span><div class="acts"><button class="btn sm" data-act="plan" data-id="${t.id}">Start plan</button></div></div></div>`;
      }).join('')}</div>`
      : `<div class="note" style="margin-top:20px">You need about 3 doubts on the same topic before Doubtdoor suggests a weekly plan. Keep asking, and it will appear here.</div>`)}
  </div></div>`;
}

/* ------------------------------------------------------------------ tutor + admin screens */

function tutorView() {
  const t = S.tutorProfile;
  const list = S.bookings;
  const done = list.filter((b) => b.status === 'completed');
  const up = list.filter((b) => b.status === 'booked');
  const earned = done.reduce((s, b) => s + b.tutorEarning, 0);
  const pending = up.reduce((s, b) => s + b.tutorEarning, 0);
  return `<div class="page"><div class="wrap"><h2>Hello, ${esc(S.user.name.split(' ')[0])}</h2>
    <p class="muted">${t ? esc(t.subjects.join(', ')) + ', ' + esc(t.area) : ''}</p>
    <div class="stats"><div><b>${money(earned)}</b>earned (85% of each session)</div><div><b>${money(pending)}</b>coming up</div><div><b>${done.length}</b>sessions done</div><div><b>${t && t.reviews ? t.rating.toFixed(1) : 'New'}</b>rating</div></div>
    <h3>Upcoming sessions</h3>
    ${up.length ? `<div class="rows">${up.map((b) => bookingRow(b, 'tutor')).join('')}</div>` : `<p class="empty"><span class="hand">Nothing booked yet.</span>New bookings from students show up here.</p>`}
    ${done.some((b) => b.payment && b.payment.method === 'cash' && b.payment.status !== 'paid') ? `<h3 style="margin-top:34px">Cash to confirm</h3><div class="rows">${done.filter((b) => b.payment && b.payment.method === 'cash' && b.payment.status !== 'paid').map((b) => bookingRow(b, 'tutor')).join('')}</div>` : ''}
    <h3 style="margin-top:34px">Earnings</h3>
    ${done.length ? `<table class="ledger"><thead><tr><th>Date</th><th>Student</th><th>Type</th><th class="r">Student paid</th><th class="r">Platform 15%</th><th class="r">You earn</th></tr></thead><tbody>
      ${done.map((b) => `<tr><td>${fmtDate(b.completedAt || b.createdAt)}</td><td>${esc(b.studentName)}</td><td>${MODE_LABEL[b.mode]}</td><td class="r">${money(b.total)}</td><td class="r">${money(b.platformFee)}</td><td class="r">${money(b.tutorEarning)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Total</td><td class="r">${money(earned)}</td></tr></tfoot></table>` : `<p class="empty">Completed sessions and what you earned from each appear here.</p>`}
    ${done.some((b) => b.review) ? `<h3 style="margin-top:34px">What students said</h3><div class="rows">${done.filter((b) => b.review).map((b) => `<div class="row">${stars(b.review.rating)} <b>${esc(b.studentName)}</b><p>${esc(b.review.comment || '')}</p></div>`).join('')}</div>` : ''}
  </div></div>`;
}

function adminView() {
  const a = S.admin;
  if (!a) return `<div class="page"><div class="wrap"><p class="empty"><span class="spin dark"></span> Loading…</p></div></div>`;
  return `<div class="page"><div class="wrap"><h2>Tutor applications</h2>
    <p class="muted">Approve only tutors you would send to a student's home. Approved tutors appear in matches straight away.</p>
    <div class="stats"><div><b>${a.pending.length}</b>waiting</div><div><b>${a.approved}</b>approved tutors</div><div><b>${a.students}</b>students</div><div><b>${a.bookings}</b>bookings</div></div>
    ${a.pending.length ? `<div class="rows">${a.pending.map((t) => `<div class="row"><div class="head">${avatar(t.name)}<div class="grow"><b>${esc(t.name)}</b><div class="small muted">${esc(t.subjects.join(', '))}, ${esc(t.area)}, speaks ${esc(t.languages.join(', '))}</div></div></div>
      <dl class="kv"><dt>Rates</dt><dd>${money(t.rateOnline)} online${t.offline ? ', ' + money(t.rateOffline) + ' home visit' : ', no home visits'}</dd><dt>Experience</dt><dd>${t.experience} years, ${esc(t.levels)}</dd><dt>About</dt><dd>${esc(t.bio)}</dd></dl>
      <div class="acts"><button class="btn sm" data-act="approve" data-id="${t.id}">Approve</button><button class="btn danger sm" data-act="reject" data-id="${t.id}">Reject</button></div></div>`).join('')}</div>`
      : `<p class="empty"><span class="hand">All caught up.</span>New tutor applications will appear here.</p>`}
  </div></div>`;
}

/* ------------------------------------------------------------------ modals */

function modalShell(title, body) {
  return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button data-act="close" aria-label="Close">×</button></header><div class="mbody">${body}</div></div></div>`;
}

function loginModal() {
  const m = S.modal;
  const tabs = [['student', 'Student'], ['tutor', 'Tutor'], ['admin', 'Admin']];
  let body = '';
  if (m.tab === 'student') {
    const f = m.f || {};
    const v = (k) => esc(f[k] != null ? f[k] : '');
    body = `<form data-form="login-student">
      ${S.pendingAsk ? `<p class="note">Log in to see your answer. Your question is saved.</p>` : ''}
      <label class="f" for="ln">Your name</label><input type="text" id="ln" value="${v('name')}" placeholder="For example: Meera" maxlength="40" autocomplete="name" required>
      <div class="two"><div><label class="f" for="lage">Your age</label><input type="number" id="lage" value="${v('age')}" min="5" max="60" required></div>
      <div><label class="f" for="lcls">Class or year</label><input type="text" id="lcls" value="${v('classLevel')}" placeholder="Class 10, or B.Tech 1st year" maxlength="40" required></div></div>
      <label class="f" for="linst">School or college</label><input type="text" id="linst" value="${v('institution')}" maxlength="80" required>
      <div class="two"><div><label class="f" for="la">Your area</label><select id="la" required><option value="">Choose your area</option>${S.cfg.areas.map((a) => `<option ${f.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      <div><label class="f" for="ll">Language</label><select id="ll">${S.cfg.languages.map((a) => `<option ${f.language === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div></div>
      <label class="f" for="ladd">Full address</label>
      <textarea class="plain" id="ladd" rows="2" placeholder="House number, street, colony, landmark" maxlength="200" required>${v('address')}</textarea>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">
        <button type="button" class="btn quiet sm" data-act="locate">${m.lat != null ? 'Location pinned. Pin again' : 'Pin my location on the map'}</button>
        <a class="btn quiet sm" target="_blank" rel="noopener" href="${m.lat != null ? 'https://www.google.com/maps?q=' + m.lat + ',' + m.lng : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((f.address || '') + ' ' + (f.area || ''))}">Check on Google Maps</a>
      </div>
      <p class="small muted" style="margin-top:6px">${m.lat != null ? 'Your exact location is saved, so a tutor can find your home.' : 'Tap "Pin my location" while you are at home for the most exact spot. The tutor sees this only after you book a home visit.'}</p>
      ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
      <div class="acts" style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn" type="submit">Continue</button><button class="btn ghost" type="button" data-act="demo-student">Try the demo student</button></div></form>`;
  } else if (m.tab === 'tutor') {
    body = `<form data-form="login-tutor"><label class="f" for="lt">Choose your tutor profile</label>
      <select id="lt">${(m.tutors || []).map((t) => `<option value="${t.id}">${esc(t.name)}, ${esc(t.subjects.join(' and '))}</option>`).join('')}</select>
      ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
      <div style="margin-top:16px"><button class="btn" type="submit">Open my dashboard</button></div>
      <p class="small muted" style="margin-top:12px">New here? <button type="button" class="link" data-act="apply">Apply to become a tutor</button>. An admin approves new tutors before they can log in.</p></form>`;
  } else {
    body = `<form data-form="login-admin"><label class="f" for="lp">Admin passcode</label><input type="password" id="lp" autocomplete="off" required>
      ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
      <div style="margin-top:16px"><button class="btn" type="submit">Open admin</button></div></form>`;
  }
  return modalShell('Log in', `<div class="tabs2" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="ltab" data-t="${k}" aria-selected="${m.tab === k}">${l}</button>`).join('')}</div>${body}`);
}

function applyModal() {
  const m = S.modal;
  if (m.done) return modalShell('Application received', `<div style="text-align:center">${TICK('done-mark')}<h3 style="margin-top:8px">Thank you, ${esc(m.done.name)}</h3>
    <p class="muted" style="margin-top:8px">An admin will review your application. After approval you can log in from the Tutor tab and start taking sessions.</p>
    <p style="margin-top:16px"><button class="btn" data-act="close">Done</button></p></div>`);
  return modalShell('Become a tutor', `<form data-form="apply">
    <label class="f" for="an">Full name</label><input type="text" id="an" maxlength="40" required>
    <label class="f">Subjects you teach (up to 3)</label><div>${S.cfg.subjects.map((s) => `<label class="chk"><input type="checkbox" name="sub" value="${esc(s)}">${esc(s)}</label>`).join('')}</div>
    <label class="f">Languages</label><div>${S.cfg.languages.map((s) => `<label class="chk"><input type="checkbox" name="lang" value="${esc(s)}">${esc(s)}</label>`).join('')}</div>
    <div class="two"><div><label class="f" for="aa">Your area</label><select id="aa">${S.cfg.areas.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
    <div><label class="f" for="ae">Years of experience</label><input type="number" id="ae" min="0" max="40" value="1"></div></div>
    <div class="two"><div><label class="f" for="ar">Online rate, ₹ per hour</label><input type="number" id="ar" min="50" max="1000" value="150" required></div>
    <div><label class="f" for="ah">Home visit rate, ₹ per hour</label><input type="number" id="ah" min="50" max="1500" value="250"></div></div>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="ao" checked>I can do home visits</label>
    <label class="f" for="al">Classes you teach</label><input type="text" id="al" placeholder="Class 8 to 12" maxlength="60">
    <label class="f" for="ab">A line about how you teach</label><input type="text" id="ab" maxlength="200">
    ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
    <p class="small muted" style="margin-top:10px">You keep 85% of every session.</p>
    <div style="margin-top:14px"><button class="btn" type="submit">Send application</button></div></form>`);
}

function profileModal() {
  const t = S.modal.tutor;
  return modalShell(t.name, `<div style="display:flex;gap:16px;align-items:center">${avatar(t.name, true)}
    <div><span class="verified">Verified tutor</span><div>${t.reviews ? stars(t.rating) + ' <b>' + t.rating.toFixed(1) + '</b> (' + t.reviews + ' reviews)' : 'New tutor, no reviews yet'}</div>
    <div class="small muted">${t.experience} years teaching, ${t.sessionsDone} sessions on Doubtdoor</div></div></div>
    <p style="margin-top:14px">${esc(t.bio)}</p>
    <dl class="kv"><dt>Subjects</dt><dd>${esc(t.subjects.join(', '))}</dd><dt>Classes</dt><dd>${esc(t.levels)}</dd><dt>Languages</dt><dd>${esc(t.languages.join(', '))}</dd>
      <dt>Area</dt><dd>${esc(t.area)}</dd><dt>Rates</dt><dd>${money(t.rateOnline)} online${t.offline ? ', ' + money(t.rateOffline) + ' home visit' : ', online only'} per hour</dd></dl>
    <h4 style="margin-top:18px">Reviews</h4>
    ${t.reviewsList.length ? t.reviewsList.map((r) => `<div class="row" style="padding:10px 0">${stars(r.rating)} <b>${esc(r.student)}</b> <span class="small muted">${esc(r.subject)}, ${fmtDate(r.at)}</span><p>${esc(r.comment || '')}</p></div>`).join('')
      : `<p class="small muted" style="margin-top:6px">Reviews from students appear here after their sessions.</p>`}
    <div style="margin-top:14px"><button class="btn" data-act="book" data-id="${t.id}">Book ${esc(t.name.split(' ')[0])}</button></div>`);
}

// Step 1 of a home visit: safety note, tick box and parent details.
function safetyFields(m) {
  const u = S.user, minor = u.age < 18;
  return `<div class="note warn" style="margin-top:16px"><b>${minor ? 'You are under 18. A parent or guardian must be at home.' : 'Please be at home with the tutor.'}</b>
    <p style="margin-top:4px">${minor ? 'For your safety, a parent or guardian must be present at the house for the whole session. This is compulsory for every home visit. The tutor may cancel the visit if no adult is at home.' : 'A parent or guardian will also be asked to confirm this visit. Tutors visit only the address on your profile.'}</p>
    <p class="small" style="margin-top:6px">Tutor will come to: <b>${esc(u.address || '')}</b>, ${esc(u.area)} <a target="_blank" rel="noopener" href="${esc(u.mapUrl || '#')}">View on Google Maps</a></p></div>
    <label class="chk" style="margin-top:12px;align-items:flex-start"><input type="checkbox" id="ack" ${m.ack ? 'checked' : ''} style="margin-top:4px"><span>${minor ? 'I confirm that my parent or guardian will be present at home during the whole session.' : 'I confirm that an adult will be present at home during the session and that the address above is correct.'}</span></label>
    <h4 style="margin-top:16px">Parent or guardian</h4>
    <p class="small muted">We give you a link to send them. They confirm the visit with one tap.</p>
    <div class="two"><div><label class="f" for="pn">Name</label><input type="text" id="pn" value="${esc(m.parentName != null ? m.parentName : (u.parentName || ''))}" maxlength="60"></div>
    <div><label class="f" for="pp">Phone</label><input type="tel" id="pp" value="${esc(m.parentPhone != null ? m.parentPhone : (u.parentPhone || ''))}" maxlength="15"></div></div>`;
}
function cashNote(amount) {
  return `<div class="note warn" role="alert" style="border-left-color:#b42318;background:#fdecea"><b>Pay ${money(amount)} in cash to the tutor right after the class.</b>
    <p style="margin-top:4px">This is compulsory. If you do not pay the tutor directly after the class, strict action will be taken against you, which can include blocking your account.</p></div>`;
}
function payStep(m, amount) {
  const methods = [['upi', 'UPI'], ['card', 'Debit or credit card'], ['netbanking', 'Net banking'], ['cash', 'Cash after class (pay the tutor directly)']];
  return `<h4 style="margin-top:18px">How do you want to pay?</h4>
    <div class="pay" role="radiogroup">${methods.map(([k, l]) => `<label><input type="radio" name="pm" value="${k}" ${m.pay === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    ${m.pay === 'cash' ? cashNote(amount) + `<label class="chk" style="margin-top:10px;align-items:flex-start"><input type="checkbox" id="cashagree" ${m.cashAgree ? 'checked' : ''} style="margin-top:4px"><span>I agree to pay ${money(amount)} in cash directly to the tutor after the class.</span></label>`
      : `<p class="small muted" style="margin-top:6px">Demo payment. No real money moves.</p>`}`;
}
function stepper(n) {
  return `<p class="small muted" style="margin:12px 0 0"><b>${n === 1 ? 'Step 1 of 2: details' : 'Step 2 of 2: payment'}</b></p>`;
}

function bookModal() {
  const m = S.modal, t = m.tutor, mode = S.mode;
  if (m.done) return doneModal(m.done);
  const rate = mode === 'online' ? t.rateOnline : t.rateOffline;
  const hours = mode === 'group' ? 2 : 1;
  const total = rate * hours;
  const per = mode === 'group' ? Math.round(total / m.size) : total;
  const home = mode !== 'online';
  const head = `<div style="display:flex;gap:12px;align-items:center">${avatar(t.name)}<div><b>${esc(t.name)}</b><div class="small muted">${MODE_LABEL[mode]}, ${hours} hour${hours > 1 ? 's' : ''}, ${esc(S.ask.doubt ? S.ask.doubt.topic : 'General doubt')}</div></div></div>`;
  const price = `<div style="margin-top:14px"><div class="line"><span>${money(rate)} per hour x ${hours}</span><span>${money(total)}</span></div>
      ${mode === 'group' ? `<div class="line"><span>Shared by ${m.size} students</span><span></span></div>` : ''}
      <div class="total"><span>You pay</span><span>${money(per)}</span></div></div>`;
  const err = m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : '';
  if (m.step !== 2) {
    return modalShell('Book ' + t.name, `<form data-form="book">${head}${stepper(1)}
      <label class="f">Pick a time</label>
      <div class="slots">${t.slots.length ? t.slots.slice(0, 9).map((s) => `<button type="button" class="chip" data-act="slot" data-k="${esc(s.key)}" aria-pressed="${m.slotKey === s.key}">${esc(s.label)}</button>`).join('') : '<span class="muted">No free slots for the next 3 days.</span>'}</div>
      ${mode === 'group' ? `<label class="f" for="gs">Students in the group</label><select id="gs">${[2, 3, 4, 5, 6].map((n) => `<option ${m.size === n ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}
      ${home ? safetyFields(m) : ''}${price}${err}
      <div style="margin-top:16px"><button class="btn lg" type="submit">Continue to payment</button></div></form>`);
  }
  return modalShell('Pay for ' + t.name, `<form data-form="book">${head}${stepper(2)}
    <p class="small muted" style="margin-top:6px">${esc(m.slotLabel)}${home ? ', at your home' : ', video call'}</p>
    ${payStep(m, per)}${price}${err}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn quiet" type="button" data-act="back">Back</button>
    <button class="btn lg" type="submit" ${m.busy ? 'disabled' : ''}>${m.busy ? '<span class="spin"></span> Booking' : (m.pay === 'cash' ? 'Confirm booking, pay cash after class' : 'Pay ' + money(per) + ' and book')}</button></div></form>`);
}

function planModal() {
  const m = S.modal, t = m.tutor;
  if (m.done) return doneModal(m.done);
  const full = 5 * t.rateOnline + t.rateOffline, price = Math.round(full * 0.9);
  const err = m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : '';
  const sum = `<div style="margin-top:14px"><div class="line"><span>5 online x ${money(t.rateOnline)} + 1 home visit x ${money(t.rateOffline)}</span><span>${money(full)}</span></div>
      <div class="line"><span>Plan discount (10%)</span><span>− ${money(full - price)}</span></div>
      <div class="total"><span>You pay each week</span><span>${money(price)}</span></div></div>`;
  if (m.step !== 2) {
    return modalShell('Weekly plan with ' + t.name, `<form data-form="plan">${stepper(1)}
      <p style="margin-top:8px">Five online sessions (Mon to Fri, 6 PM) and one home visit (Saturday, 5 PM) in ${esc(m.subject)}.</p>
      ${safetyFields(m)}${sum}${err}<div style="margin-top:16px"><button class="btn lg" type="submit">Continue to payment</button></div></form>`);
  }
  return modalShell('Pay for the weekly plan', `<form data-form="plan">${stepper(2)}${payStep(m, price)}${sum}${err}
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn quiet" type="button" data-act="back">Back</button>
    <button class="btn lg" type="submit" ${m.busy ? 'disabled' : ''}>${m.busy ? '<span class="spin"></span> Starting' : (m.pay === 'cash' ? 'Confirm plan, pay cash after class' : 'Pay ' + money(price) + ' and start')}</button></div></form>`);
}

function doneModal(b) {
  const isPlan = !!b.days;
  const cash = b.payment.method === 'cash';
  const amt = isPlan ? b.priceWeek : (b.mode === 'group' ? b.perStudent : b.total);
  return modalShell('You are booked', `<div style="text-align:center;color:var(--green)">${TICK('done-mark')}</div>
    <h3 style="text-align:center;margin-top:6px">${isPlan ? 'Your weekly plan has started' : esc(b.slotLabel) + ' with ' + esc(b.tutorName)}</h3>
    ${cash ? `<div style="margin-top:12px">${cashNote(amt)}</div>` : `<p class="muted" style="text-align:center;margin-top:6px">Receipt ${esc(b.payment.receipt)}, ${money(b.payment.amount)} paid (demo)</p>`}
    ${b.meetUrl ? `<p class="note" style="margin-top:14px">Your video room is ready: <a target="_blank" rel="noopener" href="${esc(b.meetUrl)}">${esc(b.meetUrl.replace('https://', ''))}</a>. Open it at your session time.</p>` : ''}
    ${parentShare(b)}
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:center"><button class="btn" data-act="close-go" data-v="sessions">See my sessions</button><button class="btn quiet" data-act="close">Close</button></div>`);
}

/* ------------------------------------------------------------------ render */

function render() {
  const keepScroll = window.scrollY;
  let main = '';
  const u = S.user;
  if (!u || (u.role === 'student' && S.view === 'ask')) main = askView();
  else if (u.role === 'student' && S.view === 'sessions') main = sessionsView();
  else if (u.role === 'student' && S.view === 'progress') main = progressView();
  else if (u.role === 'tutor') main = tutorView();
  else if (u.role === 'admin') main = adminView();
  $('#app').innerHTML = topbar() + '<main>' + main + '</main>' + footer();
  renderModal();
  window.scrollTo(0, keepScroll);
}
function renderModal() {
  const m = S.modal;
  const root = $('#modal-root');
  if (!m) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
  const f = { login: loginModal, apply: applyModal, profile: profileModal, book: bookModal, plan: planModal }[m.type];
  const keep = root.querySelector('.scrim');
  const top = keep ? keep.scrollTop : 0;
  root.innerHTML = f();
  const sc = root.querySelector('.scrim'); if (sc) sc.scrollTop = top;
  document.body.style.overflow = 'hidden';
}

/* ------------------------------------------------------------------ data loading */

async function loadHistory() { if (S.user && S.user.role === 'student') S.history = await api('/api/doubts?studentId=' + S.user.id); }
async function loadBookings() {
  if (!S.user) return;
  const q = S.user.role === 'tutor' ? 'tutorId=' : 'studentId=';
  S.bookings = await api('/api/bookings?' + q + S.user.id);
  if (S.user.role === 'student') S.plans = await api('/api/plans?studentId=' + S.user.id);
}
async function loadTutors() {
  const d = S.ask.doubt;
  if (!d) return;
  S.tutorsBusy = true; render();
  try {
    const q = new URLSearchParams({ subject: d.subject, mode: S.mode, area: S.user ? S.user.area : S.cfg.areas[0], language: S.user ? S.user.language : 'English' });
    S.tutors = await api('/api/match?' + q);
  } catch (e) { S.tutors = []; toast(e.message); }
  S.tutorsBusy = false; render();
}
async function enter(view) {
  S.view = view; stopPoll(); S.chatOpen = null;
  try {
    if (!S.user) {/* nothing */}
    else if (S.user.role === 'student') {
      if (view === 'ask') await loadHistory();
      if (view === 'sessions') await loadBookings();
      if (view === 'progress') { S.insights = null; render(); await loadBookings(); S.insights = await api('/api/insights?studentId=' + S.user.id); }
    } else if (S.user.role === 'tutor') { await loadBookings(); S.tutorProfile = await api('/api/tutors/' + S.user.id); }
    else if (S.user.role === 'admin') { S.admin = await api('/api/admin/overview', undefined, { 'x-admin-passcode': S.user.passcode }); }
  } catch (e) { toast(e.message); }
  render(); window.scrollTo(0, 0);
}

/* chat polling */
let pollTimer = null;
function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
async function refreshChat(id, scroll) {
  const role = S.user.role;
  try {
    const msgs = await api(`/api/bookings/${id}/messages?role=${role}&userId=${encodeURIComponent(S.user.id)}`);
    const changed = JSON.stringify(msgs) !== JSON.stringify(S.chats[id] || []);
    S.chats[id] = msgs;
    const log = $('#log-' + id);
    if (log && (changed || scroll)) { log.innerHTML = chatLog(msgs, role); log.scrollTop = log.scrollHeight; }
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ actions */

function setUser(u) { S.user = u; saveUser(); S.view = u.role === 'student' ? 'ask' : u.role === 'tutor' ? 'tutor' : 'admin'; }

async function submitAsk() {
  const a = S.ask;
  a.error = '';
  if (!a.text.trim() && !a.photo) { a.error = 'Type your doubt or add a photo first.'; render(); return; }
  if (!S.user) { S.pendingAsk = true; S.modal = { type: 'login', tab: 'student' }; render(); return; }
  if (S.user.role !== 'student') { a.error = 'Log in as a student to ask doubts.'; render(); return; }
  a.loading = true; a.doubt = null; a.showTutors = false; S.tutors = []; render();
  try {
    const d = await api('/api/doubts', { studentId: S.user.id, text: a.text, image: a.photo ? { mime: a.photo.mime, data: a.photo.data } : null });
    a.doubt = d; a.text = ''; a.photo = null; a.loading = false;
    await loadHistory();
    render();
    if (d.needsTutor) loadTutors();
    setTimeout(() => { const el = $('.answer'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  } catch (e) { a.loading = false; a.error = e.message; render(); }
}

function openBook(tutorId) {
  const t = S.tutors.find((x) => x.id === tutorId) || (S.modal && S.modal.tutor && S.modal.tutor.id === tutorId ? S.modal.tutor : null);
  if (!S.user) { S.modal = { type: 'login', tab: 'student' }; render(); return; }
  if (!t) return;
  S.modal = { type: 'book', tutor: t, step: 1, ack: false, cashAgree: false, slotKey: '', slotLabel: '', size: 2, pay: 'upi', error: '', busy: false };
  render();
}

const ACTIONS = {
  home() { S.user ? enter(S.user.role === 'student' ? 'ask' : S.view) : (S.view = 'ask', render(), window.scrollTo(0, 0)); },
  go(el) { enter(el.dataset.v); },
  login() { S.modal = { type: 'login', tab: 'student' }; render(); },
  logout() { S.user = null; saveUser(); S.view = 'ask'; S.ask = { text: '', photo: null, loading: false, doubt: null, error: '', showTutors: false }; S.history = []; S.bookings = []; S.plans = []; S.insights = null; stopPoll(); render(); window.scrollTo(0, 0); },
  apply() { S.modal = { type: 'apply', error: '' }; render(); },
  close() { S.modal = null; S.pendingAsk = false; render(); },
  'close-go'(el) { S.modal = null; enter(el.dataset.v); },
  scrim(el, ev) { if (ev.target === el) ACTIONS.close(); },
  async ltab(el) {
    S.modal.tab = el.dataset.t; S.modal.error = '';
    if (S.modal.tab === 'tutor' && !S.modal.tutors) { try { S.modal.tutors = await api('/api/tutors'); } catch (e) { S.modal.error = e.message; } }
    render();
  },
  async 'demo-student'() { await doLogin({ role: 'student', name: 'Aarav (demo)' }); },
  clearPhoto() { S.ask.photo = null; render(); },
  async solved(el) { try { await api(`/api/doubts/${el.dataset.id}/resolve`, {}); S.ask.doubt.resolved = true; await loadHistory(); render(); toast('Nice. Marked as solved.'); } catch (e) { toast(e.message); } },
  needTutor() { S.ask.showTutors = true; loadTutors(); },
  mode(el) { S.mode = el.dataset.m; loadTutors(); },
  async profile(el) {
    try { const t = await api('/api/tutors/' + el.dataset.id); S.modal = { type: 'profile', tutor: t }; render(); } catch (e) { toast(e.message); }
  },
  book(el) { openBook(el.dataset.id); },
  slot(el) { const s = S.modal.tutor.slots.find((x) => x.key === el.dataset.k); S.modal.slotKey = s.key; S.modal.slotLabel = s.label; render(); },
  back() { S.modal.step = 1; S.modal.error = ''; render(); },
  locate() {
    captureLogin();
    if (!navigator.geolocation) { S.modal.error = 'Your browser cannot share location. Type your full address instead.'; return render(); }
    toast('Asking for your location…');
    navigator.geolocation.getCurrentPosition(
      (p) => { S.modal.lat = Math.round(p.coords.latitude * 1e6) / 1e6; S.modal.lng = Math.round(p.coords.longitude * 1e6) / 1e6; S.modal.error = ''; render(); toast('Location pinned'); },
      () => { S.modal.error = 'Could not get your location. Allow location access, or just type your full address.'; render(); },
      { enableHighAccuracy: true, timeout: 10000 });
  },
  async cashin(el) { try { await api(`/api/bookings/${el.dataset.id}/cash-received`, { tutorId: S.user.id }); await loadBookings(); render(); toast('Cash payment recorded'); } catch (e) { toast(e.message); } },
  copy(el) { copyText(el.dataset.v); },
  async chat(el) {
    const id = el.dataset.id;
    S.chatOpen = S.chatOpen === id ? null : id; stopPoll(); render();
    if (S.chatOpen) { await refreshChat(id, true); pollTimer = setInterval(() => refreshChat(id), 4000); }
  },
  async extend(el) {
    try { const b = await api(`/api/bookings/${el.dataset.id}/extend`, { minutes: Number(el.dataset.min) }); const ex = b.extensions[b.extensions.length - 1]; await loadBookings(); render(); toast('Added ' + el.dataset.min + ' minutes. Paid ' + money(ex.amount) + ' (demo).'); }
    catch (e) { toast(e.message); }
  },
  rate(el) { S.rev[el.dataset.id] = { ...(S.rev[el.dataset.id] || { comment: '' }), rating: Number(el.dataset.n) }; render(); },
  async review(el) {
    const r = S.rev[el.dataset.id];
    if (!r || !r.rating) return toast('Tap a star rating first');
    try { await api(`/api/bookings/${el.dataset.id}/review`, { studentId: S.user.id, rating: r.rating, comment: r.comment || '' }); await loadBookings(); render(); toast('Thanks for your review'); }
    catch (e) { toast(e.message); }
  },
  async complete(el) {
    const id = el.dataset.id; el.disabled = true; el.innerHTML = '<span class="spin"></span> Writing summary';
    try { await api(`/api/bookings/${id}/complete`, { notes: S.notes[id] || '' }); delete S.notes[id]; S.chatOpen = null; stopPoll(); await loadBookings(); S.tutorProfile = await api('/api/tutors/' + S.user.id); render(); toast('Session completed'); }
    catch (e) { toast(e.message); render(); }
  },
  plan(el) {
    const t = S.insights.tutors.find((x) => x.id === el.dataset.id);
    S.modal = { type: 'plan', tutor: t, step: 1, ack: false, cashAgree: false, subject: S.insights.topSubject, pay: 'upi', error: '', busy: false }; render();
  },
  async approve(el) { await adminAct(el.dataset.id, 'approve'); },
  async reject(el) { await adminAct(el.dataset.id, 'reject'); },
};
function captureLogin() {
  const g = (id) => { const e = $('#' + id); return e ? e.value : ''; };
  if (!S.modal || S.modal.type !== 'login') return;
  S.modal.f = { name: g('ln'), age: g('lage'), classLevel: g('lcls'), institution: g('linst'), area: g('la'), language: g('ll'), address: g('ladd') };
}
async function adminAct(id, what) {
  try { await api(`/api/admin/tutors/${id}/${what}`, {}, { 'x-admin-passcode': S.user.passcode }); S.admin = await api('/api/admin/overview', undefined, { 'x-admin-passcode': S.user.passcode }); render(); toast(what === 'approve' ? 'Tutor approved' : 'Application rejected'); }
  catch (e) { toast(e.message); }
}
async function doLogin(body) {
  try {
    const u = await api('/api/login', body);
    setUser(u); S.modal = null;
    const resume = S.pendingAsk; S.pendingAsk = false;
    await enter(S.view);
    if (resume && u.role === 'student') submitAsk();
  } catch (e) { if (S.modal) { S.modal.error = e.message; render(); } else toast(e.message); }
}

/* events */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { if (el.tagName === 'A') return; fn(el, ev); }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'q') S.ask.text = t.value;
  else if (t.dataset && t.dataset.note) S.notes[t.dataset.note] = t.value;
  else if (t.dataset && t.dataset.rev) S.rev[t.dataset.rev] = { ...(S.rev[t.dataset.rev] || { rating: 0 }), comment: t.value };
  else if (t.id === 'pn' && S.modal) S.modal.parentName = t.value;
  else if (t.id === 'pp' && S.modal) S.modal.parentPhone = t.value;
  else if (t.name === 'pm' && S.modal) { S.modal.pay = t.value; render(); }
  else if (t.id === 'ack' && S.modal) S.modal.ack = t.checked;
  else if (t.id === 'cashagree' && S.modal) S.modal.cashAgree = t.checked;
  else if (t.id === 'gs' && S.modal) { S.modal.size = Number(t.value); render(); }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id !== 'photo') return;
  const f = ev.target.files[0];
  if (!f) return;
  if (f.size > 4 * 1024 * 1024) { S.ask.error = 'That photo is too big. Choose one under 4 MB.'; render(); return; }
  const rd = new FileReader();
  rd.onload = () => { S.ask.photo = { name: f.name, mime: f.type, data: String(rd.result).split(',')[1] }; S.ask.error = ''; render(); };
  rd.readAsDataURL(f);
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.modal) ACTIONS.close(); });
document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const kind = form.dataset.form;
  if (kind === 'ask') return submitAsk();
  if (kind === 'login-student') {
    captureLogin(); const f = S.modal.f;
    return doLogin({ role: 'student', name: f.name, age: f.age, classLevel: f.classLevel, institution: f.institution, area: f.area, language: f.language, address: f.address, lat: S.modal.lat, lng: S.modal.lng });
  }
  if (kind === 'login-tutor') return doLogin({ role: 'tutor', tutorId: $('#lt').value });
  if (kind === 'login-admin') return doLogin({ role: 'admin', passcode: $('#lp').value });
  if (kind === 'chat') {
    const id = form.dataset.id, input = form.querySelector('input'), text = input.value.trim();
    if (!text) return;
    input.value = '';
    try { S.chats[id] = await api(`/api/bookings/${id}/messages`, { role: S.user.role, userId: S.user.id, text }); const log = $('#log-' + id); log.innerHTML = chatLog(S.chats[id], S.user.role); log.scrollTop = log.scrollHeight; }
    catch (e) { toast(e.message); }
    return;
  }
  if (kind === 'apply') {
    const m = S.modal; m.error = '';
    const checked = (n) => $$(`input[name=${n}]:checked`).map((x) => x.value);
    const body = { name: $('#an').value, subjects: checked('sub'), languages: checked('lang'), area: $('#aa').value, experience: $('#ae').value,
      rateOnline: $('#ar').value, rateOffline: $('#ah').value, offline: $('#ao').checked, levels: $('#al').value, bio: $('#ab').value };
    try { await api('/api/tutor-applications', body); m.done = { name: body.name.trim().split(' ')[0] }; }
    catch (e) { m.error = e.message; }
    return render();
  }
  if (kind === 'book' || kind === 'plan') {
    const m = S.modal; m.error = '';
    const home = kind === 'plan' || S.mode !== 'online';
    if (m.step !== 2) {
      if (kind === 'book' && !m.slotKey) { m.error = 'Pick a time first.'; return render(); }
      if (home) {
        m.parentName = $('#pn').value; m.parentPhone = $('#pp').value;
        if (!m.ack) { m.error = S.user.age < 18 ? 'Please tick the box to confirm a parent or guardian will be at home.' : 'Please tick the box to confirm an adult will be at home.'; return render(); }
        if (!m.parentName.trim() || !/^[0-9+\-\s]{8,15}$/.test(m.parentPhone.trim())) { m.error = 'Enter your parent or guardian name and a valid phone number.'; return render(); }
      }
      m.step = 2; return render();
    }
    const pay = $$('input[name=pm]').find((x) => x.checked);
    if (m.pay === 'cash' && !m.cashAgree) { m.error = 'Please tick the box agreeing to pay the tutor in cash after the class.'; return render(); }
    const parent = home ? { name: m.parentName, phone: m.parentPhone } : undefined;
    const common = { studentId: S.user.id, tutorId: m.tutor.id, payment: { method: pay ? pay.value : m.pay }, parent, guardianAck: home ? !!m.ack : undefined, cashAgree: !!m.cashAgree };
    m.busy = true; render();
    try {
      const res = kind === 'book'
        ? await api('/api/bookings', { ...common, mode: S.mode, slotKey: m.slotKey, slotLabel: m.slotLabel, groupSize: m.size, doubtId: S.ask.doubt ? S.ask.doubt.id : undefined, subject: S.ask.doubt ? S.ask.doubt.subject : undefined })
        : await api('/api/plans', { ...common, subject: m.subject });
      if (parent) { S.user.parentName = parent.name; S.user.parentPhone = parent.phone; saveUser(); }
      m.done = res; m.busy = false;
    } catch (e) { m.busy = false; m.error = e.message; if (/slot/i.test(e.message) && kind === 'book') { try { const t = await api('/api/tutors/' + m.tutor.id); m.tutor.slots = t.slots; m.slotKey = ''; m.step = 1; } catch (x) { /* ignore */ } } }
    return render();
  }
});

/* start */
(async function start() {
  try { S.cfg = await api('/api/config'); } catch (e) { /* server offline */ }
  if (S.user) {
    try { await api('/api/login', S.user.role === 'student' ? { role: 'student', name: S.user.name } : S.user.role === 'tutor' ? { role: 'tutor', tutorId: S.user.id } : { role: 'admin', passcode: S.user.passcode }); }
    catch (e) { S.user = null; saveUser(); }
  }
  if (S.user) { S.view = S.user.role === 'student' ? 'ask' : S.user.role === 'tutor' ? 'tutor' : 'admin'; await enter(S.view); } else render();
})();
