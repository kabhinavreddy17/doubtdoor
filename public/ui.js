// Small helper functions used by app.js
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const initials = (name) => String(name || '?').replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const avatar = (name, big) => `<div class="avatar${big ? ' lg' : ''}" aria-hidden="true">${esc(initials(name))}</div>`;
const stars = (r) => {
  const n = Math.round(r);
  return `<span class="stars" aria-label="${r} out of 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
};
const TICK = (cls) => `<svg class="${cls || ''}" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 17l7 7L27 7" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0f8a4f"/><path d="M8 17l6 6 11-13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Very small markdown: **bold**, `code`, numbered and bullet lists, paragraphs.
function md(text) {
  const lines = esc(text).split('\n');
  let out = '', list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  lines.forEach((l) => {
    const num = l.match(/^\s*\d+[.)]\s+(.*)/), bul = l.match(/^\s*[-*•]\s+(.*)/);
    if (num) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(num[1])}</li>`; }
    else if (bul) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(bul[1])}</li>`; }
    else if (l.trim()) { close(); out += `<p>${inline(l)}</p>`; }
    else close();
  });
  close();
  return out;
}

const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

async function api(path, body, headers) {
  const opts = body === undefined ? { headers: headers || {} } : { method: 'POST', headers: { 'content-type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body) };
  let r;
  try { r = await fetch(path, opts); } catch (e) { throw new Error('Cannot reach the server. Check that it is running.'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) { window.prompt('Copy this link:', text); }
}
const MODE_LABEL = { online: 'Online', offline: 'Home visit', group: 'Group at home' };
