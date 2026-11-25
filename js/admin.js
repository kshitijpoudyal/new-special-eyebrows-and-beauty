import { app, db, useEmulator } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, limit, runTransaction, serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const $ = (id) => document.getElementById(id);
const CATS = window.SERVICE_CATEGORIES;

// ---------- helpers ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => { n = Number(n) || 0; return '$' + (Number.isInteger(n) ? n : n.toFixed(2)); };
const round2 = (n) => Math.round(n * 100) / 100;

/** Normalizes a US phone number to 10 digits, or returns null if invalid. */
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 ? d : null;
}
const fmtPhone = (d) => (d && d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d || '');
const fmtDate = (ts, withTime) => {
  if (!ts?.toDate) return '—';
  const o = { month: 'short', day: 'numeric', year: 'numeric' };
  if (withTime) Object.assign(o, { hour: 'numeric', minute: '2-digit' });
  return ts.toDate().toLocaleString('en-US', o);
};
function slugify(s) {
  return String(s).toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'fixed bottom-6 left-1/2 z-[100] px-5 py-3 rounded-full text-sm font-semibold ambient-bloom pointer-events-none show ' +
    (isError ? 'bg-error-container text-on-error-container' : 'bg-tertiary text-on-tertiary');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function errMsg(e) {
  if (e?.code === 'permission-denied') return 'Permission denied — is this account listed as an admin in firestore.rules?';
  return e?.message || String(e);
}
async function busy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { console.error(e); toast(errMsg(e), true); } finally { btn.disabled = false; }
}

// ---------- boot ----------
if (!db) {
  $('setup-view').hidden = false;
  throw new Error('Firebase not configured');
}
const auth = getAuth(app);
if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

// ---------- state ----------
let members = [];
let services = [];
let rules = { ...window.DEFAULT_REWARDS };
let booking = { ...window.DEFAULT_BOOKING };
let appointments = [];
let apptFilter = 'pending';
let selectedId = null;
let historyItems = [];
let visitSel = [];            // service ids ticked in "record visit"
let unsubs = [];
let unsubHistory = null;

// ---------- auth ----------
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').hidden = true;
  const btn = $('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-pass').value);
  } catch (err) {
    $('login-error').textContent = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(err.code)
      ? 'Incorrect email or password.' : errMsg(err);
    $('login-error').hidden = false;
  } finally { btn.disabled = false; btn.textContent = 'Sign in'; }
});
$('forgot-btn').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  if (!email) { $('login-error').textContent = 'Enter your email above first.'; $('login-error').hidden = false; return; }
  try { await sendPasswordResetEmail(auth, email); toast('Password reset email sent.'); }
  catch (err) { toast(errMsg(err), true); }
});
$('signout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  unsubs.forEach((u) => u()); unsubs = [];
  if (unsubHistory) { unsubHistory(); unsubHistory = null; }
  $('login-view').hidden = !!user;
  $('app-view').hidden = !user;
  if (!user) { members = []; services = []; appointments = []; selectedId = null; return; }
  $('user-email').textContent = user.email;
  startListeners();
});

function startListeners() {
  const onErr = (e) => { console.error(e); toast(errMsg(e), true); };
  unsubs.push(onSnapshot(query(collection(db, 'members'), orderBy('name')), (snap) => {
    members = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMemberList(); renderDetail(); renderAppointments();
  }, onErr));
  unsubs.push(onSnapshot(collection(db, 'services'), (snap) => {
    services = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderServices(); renderDetail();
  }, onErr));
  unsubs.push(onSnapshot(query(collection(db, 'appointments'), orderBy('date')), (snap) => {
    appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startIdx - b.startIdx);
    renderAppointments();
  }, onErr));
  unsubs.push(onSnapshot(doc(db, 'settings', 'booking'), (snap) => {
    booking = { ...window.DEFAULT_BOOKING, ...(snap.exists() ? snap.data() : {}) };
    $('set-capacity').value = booking.capacity;
  }, onErr));
  unsubs.push(onSnapshot(doc(db, 'settings', 'rewards'), (snap) => {
    rules = { ...window.DEFAULT_REWARDS, ...(snap.exists() ? snap.data() : {}) };
    fillSettings(); renderDetail();
  }, onErr));
}

// ---------- tabs ----------
function showTab(name) {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
  ['appointments', 'rewards', 'services', 'settings'].forEach((n) => { $('tab-' + n).hidden = n !== name; });
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

// =====================================================================
// APPOINTMENTS
// =====================================================================
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const longDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); };
function ago(ts) {
  if (!ts?.toDate) return 'just now';
  const s = (Date.now() - ts.toDate().getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}
const STATUS_LABEL = { pending: 'Pending', accepted: 'Accepted', rejected: 'Declined', cancelled: 'Cancelled' };

$('appt-filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  apptFilter = b.dataset.filter;
  document.querySelectorAll('#appt-filters [data-filter]').forEach((x) => x.classList.toggle('on', x === b));
  renderAppointments();
});

function renderAppointments() {
  const today = todayKey();
  const pending = appointments.filter((a) => a.status === 'pending');
  $('pending-badge').textContent = pending.length;
  $('pending-badge').hidden = !pending.length;
  const list = {
    pending: () => pending,
    upcoming: () => appointments.filter((a) => a.status === 'accepted' && a.date >= today),
    past: () => appointments.filter((a) => a.status === 'accepted' && a.date < today).reverse(),
    closed: () => appointments.filter((a) => a.status === 'rejected' || a.status === 'cancelled').reverse(),
  }[apptFilter]();
  const empty = { pending: 'No requests waiting — you’re all caught up.', upcoming: 'No upcoming accepted appointments.', past: 'No past appointments yet.', closed: 'No declined or cancelled appointments.' };
  if (!list.length) {
    $('appt-list').innerHTML = `<div class="${card} text-center py-16"><span class="material-symbols-outlined text-primary/40" style="font-size:48px">event_available</span><p class="text-tertiary mt-4">${empty[apptFilter]}</p></div>`;
    return;
  }
  const groups = [];
  list.forEach((a) => { const g = groups.at(-1); if (g && g.date === a.date) g.items.push(a); else groups.push({ date: a.date, items: [a] }); });
  $('appt-list').innerHTML = groups.map((g) => `
    <div>
      <p class="font-serif text-xl text-on-background mb-3">${esc(longDate(g.date))}${g.date === today ? ' <span class="text-secondary text-xs font-sans font-bold uppercase tracking-[0.2em] ml-2">Today</span>' : ''}</p>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${g.items.map(apptCard).join('')}</div>
    </div>`).join('');
}

function apptCard(a) {
  const digits = normPhone(a.phone);
  const member = digits && members.find((m) => m.id === digits);
  const passed = a.status === 'pending' && a.date < todayKey();
  return `<div class="${card} !p-6" data-appt="${esc(a.id)}">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-serif text-2xl text-primary leading-tight">${esc(a.timeLabel)}</p>
        <p class="text-xs text-tertiary/70 mt-1">${a.duration || 0} min · requested ${ago(a.createdAt)}${passed ? ' · <span class="text-error font-semibold">date has passed</span>' : ''}</p>
      </div>
      <span class="appt-chip st-${esc(a.status)}">${STATUS_LABEL[a.status] || esc(a.status)}</span>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="font-semibold text-on-background">${esc(a.name)}</p>
      ${member ? `<button class="appt-chip st-pending" data-member="${esc(member.id)}" title="Open rewards member"><span class="material-symbols-outlined" style="font-size:13px">loyalty</span>Rewards · ${member.points || 0} pts</button>` : ''}
    </div>
    <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <a class="text-tertiary hover:text-primary" href="tel:${esc(a.phone)}"><span class="material-symbols-outlined" style="font-size:16px">call</span> ${esc(digits ? fmtPhone(digits) : a.phone)}</a>
      <a class="text-tertiary hover:text-primary" href="sms:${esc(a.phone)}"><span class="material-symbols-outlined" style="font-size:16px">sms</span> Text</a>
      ${a.email ? `<a class="text-tertiary hover:text-primary break-all" href="mailto:${esc(a.email)}"><span class="material-symbols-outlined" style="font-size:16px">mail</span> ${esc(a.email)}</a>` : ''}
    </div>
    <div class="mt-4 space-y-1">
      ${(a.services || []).map((s) => `<div class="flex justify-between text-sm"><span class="text-tertiary">${esc(s.name)}</span><span class="font-serif font-semibold text-on-background">${money(s.price)}</span></div>`).join('')}
      <div class="flex justify-between text-sm pt-2 mt-2" style="border-top:1px solid rgba(221,191,196,.25)"><span class="font-bold uppercase tracking-wider text-xs text-secondary">Total</span><span class="font-serif font-bold text-primary">${money(a.total)}</span></div>
    </div>
    ${a.notes ? `<p class="mt-3 text-sm text-tertiary italic bg-surface-container-low rounded-xl px-3 py-2">“${esc(a.notes)}”</p>` : ''}
    ${a.reason ? `<p class="mt-3 text-xs text-tertiary">Reason: ${esc(a.reason)}</p>` : ''}
    ${a.status === 'pending' ? `<div class="mt-5 flex gap-3 justify-end">
        <button class="btn btn-soft" data-appt-act="reject">Decline</button>
        <button class="btn btn-primary" data-appt-act="accept"><span class="material-symbols-outlined" style="font-size:18px">check</span>Accept</button>
      </div>` : ''}
    ${a.status === 'accepted' && a.date >= todayKey() ? `<div class="mt-5 flex justify-end"><button class="btn-text btn-danger" data-appt-act="cancel">Cancel appointment</button></div>` : ''}
  </div>`;
}

$('appt-list').addEventListener('click', async (e) => {
  const mb = e.target.closest('[data-member]');
  if (mb) { $('member-search').value = ''; showTab('rewards'); selectMember(mb.dataset.member); return; }
  const btn = e.target.closest('[data-appt-act]'); if (!btn) return;
  const a = appointments.find((x) => x.id === btn.closest('[data-appt]').dataset.appt); if (!a) return;
  const act = btn.dataset.apptAct;
  let reason = '';
  if (act === 'reject' || act === 'cancel') {
    const r = prompt(`${act === 'reject' ? 'Decline' : 'Cancel'} ${a.name}'s appointment on ${longDate(a.date)}, ${a.timeLabel}?\n\nOptional reason for the customer:`);
    if (r === null) return;
    reason = r.trim();
  }
  const status = { accept: 'accepted', reject: 'rejected', cancel: 'cancelled' }[act];
  await busy(btn, async () => {
    const b = writeBatch(db);
    b.update(doc(db, 'appointments', a.id), { status, decidedAt: serverTimestamp(), ...(reason ? { reason } : {}) });
    // Declined/cancelled bookings free up their time on the website.
    if (status !== 'accepted') (a.slotIds || []).forEach((id) => b.delete(doc(db, 'slots', id)));
    await b.commit();
    const sent = await notifyCustomer(a, status, reason);
    const what = { accepted: 'Accepted', rejected: 'Declined', cancelled: 'Cancelled' }[status];
    toast(sent === 'sent' ? `${what} — customer emailed.`
      : sent === 'failed' ? `${what}, but the email failed — please call or text ${a.name}.`
      : `${what}. ${a.email ? 'Email isn’t set up' : 'No email on file'} — call or text ${a.name}.`, sent === 'failed');
  });
});

let emailjsInit = false;
async function notifyCustomer(a, status, reason) {
  const C = window.EMAILJS_CFG;
  if (!a.email) return 'no-email';
  if (!window.EMAILJS_READY || !window.emailjs) return 'unconfigured';
  if (!emailjsInit) { window.emailjs.init({ publicKey: C.PUBLIC_KEY }); emailjsInit = true; }
  const when = `${longDate(a.date)}, ${a.timeLabel}`;
  const message = status === 'accepted'
    ? `Your appointment on ${when} is confirmed. We look forward to seeing you!`
    : `We're sorry — we can't keep your appointment on ${when}.${reason ? ' ' + reason : ''} Please book another time online or call us at 804-882-2942.`;
  try {
    await window.emailjs.send(C.SERVICE_ID, C.TEMPLATE_STATUS, {
      to_name: a.name, to_email: a.email,
      status: { accepted: 'confirmed', rejected: 'declined', cancelled: 'cancelled' }[status],
      booking_date: longDate(a.date), booking_time: a.timeLabel,
      services: (a.services || []).map((s) => s.name).join(', '), message,
    });
    return 'sent';
  } catch (e) { console.error('EmailJS error', e); return 'failed'; }
}

// =====================================================================
// REWARDS
// =====================================================================
$('member-search').addEventListener('input', renderMemberList);

function renderMemberList() {
  const q = $('member-search').value.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = members.filter((m) => !q ||
    (m.name || '').toLowerCase().includes(q) ||
    (qd && m.id.includes(qd)) ||
    (m.email || '').toLowerCase().includes(q));
  $('member-count').textContent = members.length + (members.length === 1 ? ' member' : ' members') +
    (q ? ` · ${list.length} shown` : '');
  $('member-list').innerHTML = list.length ? list.map((m) => `
    <button class="mrow${m.id === selectedId ? ' on' : ''}" data-id="${esc(m.id)}">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="font-semibold text-on-background truncate">${esc(m.name)}</p>
          <p class="text-xs text-tertiary">${esc(fmtPhone(m.id))}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-serif font-bold text-primary">${m.points || 0} <span class="text-[10px] font-sans font-bold uppercase tracking-wider text-tertiary/70">pts</span></p>
          ${m.visitRewardsAvailable > 0 ? '<p class="text-[10px] font-bold uppercase tracking-wider text-secondary">Reward ready</p>' : `<p class="text-[10px] text-tertiary/70">${m.visits || 0} visits</p>`}
        </div>
      </div>
    </button>`).join('')
    : `<p class="text-tertiary/60 text-sm italic px-2 py-6 text-center">${members.length ? 'No matching members.' : 'No members yet — tap “New” to sign someone up.'}</p>`;
}
$('member-list').addEventListener('click', (e) => {
  const b = e.target.closest('.mrow'); if (!b) return;
  selectMember(b.dataset.id);
});

function selectMember(id) {
  if (selectedId !== id) visitSel = [];
  selectedId = id;
  historyItems = [];
  if (unsubHistory) unsubHistory();
  unsubHistory = id ? onSnapshot(query(collection(db, 'members', id, 'history'), orderBy('at', 'desc'), limit(25)), (snap) => {
    historyItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHistory();
  }, (e) => console.error(e)) : null;
  renderMemberList(); renderDetail();
  if (id && window.innerWidth < 1024) $('member-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const card = 'bg-surface-container-lowest rounded-[2rem] p-6 md:p-8 ambient-bloom';

function renderDetail() {
  const el = $('member-detail');
  const m = members.find((x) => x.id === selectedId);
  if (!m) {
    el.innerHTML = `<div class="${card} text-center py-16">
      <span class="material-symbols-outlined text-primary/40" style="font-size:48px">loyalty</span>
      <p class="font-serif text-xl text-on-background mt-4">Select a member</p>
      <p class="text-tertiary text-sm mt-2">Search by phone number or name, or sign up a new member.</p></div>`;
    return;
  }
  const N = Math.max(1, Number(rules.visitsForReward) || 10);
  const punches = Math.min(m.punches || 0, N);
  const pts = m.points || 0;
  const rp = Number(rules.redeemPoints) || 100;
  const canRedeem = pts >= rp;
  const activeSvcs = services.filter((s) => s.active !== false);
  // Keep anything typed into "Record a visit" when live data re-renders the panel.
  const keep = $('visit-form')?.dataset.member === m.id
    ? { amount: $('visit-amount').value, note: $('visit-note').value } : null;

  el.innerHTML = `
  <div class="space-y-6">
    <div class="${card}">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="min-w-0">
          <span class="text-secondary font-bold tracking-[0.3em] uppercase text-[10px] block mb-1">Rewards member</span>
          <h2 class="font-serif text-3xl text-on-background break-words">${esc(m.name)}</h2>
          <p class="text-tertiary mt-1">${esc(fmtPhone(m.id))}${m.email ? ' · ' + esc(m.email) : ''}</p>
          <p class="text-tertiary/60 text-xs mt-2">Member since ${fmtDate(m.createdAt)} · Last visit ${fmtDate(m.lastVisit)} · ${m.visits || 0} total visits · ${money(m.totalSpent || 0)} spent</p>
        </div>
        <div class="flex gap-4 shrink-0">
          <button class="btn-text" data-act="edit">Edit</button>
          <button class="btn-text btn-danger" data-act="delete">Delete</button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div class="${card}">
        <div class="flex items-center justify-between mb-4">
          <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em]">Punch card</p>
          <p class="text-xs text-tertiary">${punches} / ${N}</p>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          ${Array.from({ length: N }, (_, i) => `<span class="punch${i < punches ? ' on' : ''}"><span class="material-symbols-outlined" style="font-size:16px">check</span></span>`).join('')}
        </div>
        <p class="text-tertiary text-sm">${N - punches} more visit${N - punches === 1 ? '' : 's'} until: <span class="font-semibold text-on-background">${esc(rules.visitRewardText)}</span></p>
        ${m.visitRewardsAvailable > 0 ? `
          <div class="mt-5 bg-secondary-fixed rounded-2xl p-4 flex items-center justify-between gap-3">
            <p class="text-on-secondary-fixed text-sm font-semibold">${m.visitRewardsAvailable} reward${m.visitRewardsAvailable > 1 ? 's' : ''} ready</p>
            <button class="btn btn-primary" data-act="redeem-visit">Redeem</button>
          </div>` : ''}
      </div>
      <div class="${card}">
        <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-3">Points</p>
        <p class="font-serif text-5xl text-primary font-bold">${pts}</p>
        <p class="text-tertiary text-sm mt-3">${canRedeem
          ? `${rp} points = <span class="font-semibold text-on-background">${money(rules.redeemValue)} off</span>`
          : `${rp - pts} more points until ${money(rules.redeemValue)} off`}</p>
        <div class="mt-5 flex flex-wrap gap-3 items-center">
          <button class="btn btn-gold" data-act="redeem-points" ${canRedeem ? '' : 'disabled'}>Redeem ${rp} pts</button>
          <button class="btn-text" data-act="adjust">Adjust</button>
        </div>
      </div>
    </div>

    <form id="visit-form" data-member="${esc(m.id)}" class="${card}" novalidate>
      <div class="flex items-center gap-3 mb-5"><span class="material-symbols-outlined text-primary">add_task</span><h3 class="font-serif text-xl">Record a visit</h3></div>
      ${activeSvcs.length ? `<p class="e-label mb-2">Services (optional — fills in the total)</p>
      <div id="visit-chips" class="flex flex-wrap gap-2 mb-5">${activeSvcs.map((s) =>
        `<span class="schip${visitSel.includes(s.id) ? ' on' : ''}" data-id="${esc(s.id)}">${esc(s.name)} · ${money(s.price)}</span>`).join('')}</div>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div class="e-group"><label class="e-label mb-1" for="visit-amount">Amount spent ($)</label><input id="visit-amount" class="e-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" required/></div>
        <div class="e-group"><label class="e-label mb-1" for="visit-note">Note <span style="opacity:.5;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input id="visit-note" class="e-input" autocomplete="off"/></div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-4 mt-6">
        <p id="visit-preview" class="text-tertiary text-sm"></p>
        <button class="btn btn-primary" id="visit-btn">Record visit</button>
      </div>
    </form>

    <div class="${card}">
      <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-4">Recent activity</p>
      <div id="history-list"></div>
    </div>
  </div>`;

  if (keep) { $('visit-amount').value = keep.amount; $('visit-note').value = keep.note; }
  updateVisitPreview();
  renderHistory();
}

function updateVisitPreview() {
  const inp = $('visit-amount'); if (!inp) return;
  const amt = Number(inp.value) || 0;
  const earned = Math.floor(amt * (Number(rules.pointsPerDollar) || 0));
  $('visit-preview').textContent = `+1 punch · +${earned} point${earned === 1 ? '' : 's'}`;
}

function renderHistory() {
  const el = $('history-list'); if (!el) return;
  const label = {
    visit: (h) => `Visit${h.amount ? ' · ' + money(h.amount) : ''}`,
    redeem_points: () => 'Redeemed points',
    redeem_visit: () => 'Redeemed punch-card reward',
    adjust: () => 'Points adjusted',
    signup: () => 'Joined rewards',
  };
  el.innerHTML = historyItems.length ? `<div class="space-y-3">${historyItems.map((h) => `
    <div class="flex items-start justify-between gap-4 pb-3" style="border-bottom:1px solid rgba(221,191,196,.2)">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-on-background">${esc((label[h.type] || (() => h.type))(h))}</p>
        ${h.services?.length ? `<p class="text-xs text-tertiary">${esc(h.services.join(', '))}</p>` : ''}
        ${h.note ? `<p class="text-xs text-tertiary italic">${esc(h.note)}</p>` : ''}
        <p class="text-[11px] text-tertiary/60">${fmtDate(h.at, true)}</p>
      </div>
      ${h.pointsDelta ? `<span class="font-serif font-bold shrink-0 ${h.pointsDelta > 0 ? 'text-primary' : 'text-tertiary'}">${h.pointsDelta > 0 ? '+' : ''}${h.pointsDelta} pts</span>` : ''}
    </div>`).join('')}</div>` : '<p class="text-tertiary/60 text-sm italic">No activity yet.</p>';
}

// Delegated events inside the detail panel
$('member-detail').addEventListener('input', (e) => { if (e.target.id === 'visit-amount') updateVisitPreview(); });
$('member-detail').addEventListener('click', async (e) => {
  const chip = e.target.closest('#visit-chips .schip');
  if (chip) {
    const id = chip.dataset.id;
    visitSel = visitSel.includes(id) ? visitSel.filter((x) => x !== id) : [...visitSel, id];
    chip.classList.toggle('on', visitSel.includes(id));
    $('visit-amount').value = visitSel.length
      ? round2(visitSel.reduce((t, sid) => t + (Number(services.find((s) => s.id === sid)?.price) || 0), 0)) : '';
    updateVisitPreview();
    return;
  }
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const m = members.find((x) => x.id === selectedId); if (!m) return;
  const act = btn.dataset.act;
  if (act === 'edit') openMemberDialog(m);
  if (act === 'delete') {
    if (!confirm(`Delete ${m.name} and all of their rewards history? This can't be undone.`)) return;
    await busy(btn, async () => { await deleteMember(m.id); selectMember(null); toast('Member deleted.'); });
  }
  if (act === 'redeem-points') {
    if (!confirm(`Redeem ${rules.redeemPoints} points for ${money(rules.redeemValue)} off?`)) return;
    await busy(btn, async () => { await redeemPoints(m.id); toast(`Redeemed — ${money(rules.redeemValue)} off.`); });
  }
  if (act === 'redeem-visit') {
    if (!confirm(`Redeem reward: ${rules.visitRewardText}?`)) return;
    await busy(btn, async () => { await redeemVisitReward(m.id); toast('Punch-card reward redeemed.'); });
  }
  if (act === 'adjust') {
    const v = prompt('Add or remove points (e.g. 25 or -10):');
    if (v === null) return;
    const delta = Math.trunc(Number(v));
    if (!delta) { toast('Enter a whole number other than 0.', true); return; }
    const note = prompt('Reason (optional):') || '';
    await busy(btn, async () => { await adjustPoints(m.id, delta, note); toast('Points updated.'); });
  }
});
$('member-detail').addEventListener('submit', async (e) => {
  if (e.target.id !== 'visit-form') return;
  e.preventDefault();
  const amount = round2(Number($('visit-amount').value));
  if (!(amount >= 0) || $('visit-amount').value === '') { toast('Enter the amount spent (0 is fine).', true); return; }
  const note = $('visit-note').value.trim();
  const svcNames = visitSel.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean);
  await busy($('visit-btn'), async () => {
    const r = await recordVisit(selectedId, amount, note, svcNames);
    visitSel = [];
    $('visit-amount').value = ''; $('visit-note').value = '';
    document.querySelectorAll('#visit-chips .schip.on').forEach((c) => c.classList.remove('on'));
    updateVisitPreview();
    toast(r.rewardEarned ? `Reward earned! ${rules.visitRewardText} 🎉` : `Visit recorded · +${r.earned} points`);
  });
});

// ---------- member data operations ----------
const memberRef = (id) => doc(db, 'members', id);
const newHistoryRef = (id) => doc(collection(db, 'members', id, 'history'));

async function recordVisit(id, amount, note, svcNames) {
  const N = Math.max(1, Number(rules.visitsForReward) || 10);
  const earned = Math.floor(amount * (Number(rules.pointsPerDollar) || 0));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(memberRef(id));
    if (!snap.exists()) throw new Error('Member not found.');
    const m = snap.data();
    let punches = (m.punches || 0) + 1;
    let rewards = m.visitRewardsAvailable || 0;
    const rewardEarned = punches >= N;
    if (rewardEarned) { punches = 0; rewards += 1; }
    tx.update(memberRef(id), {
      visits: (m.visits || 0) + 1,
      punches,
      visitRewardsAvailable: rewards,
      points: (m.points || 0) + earned,
      totalSpent: round2((m.totalSpent || 0) + amount),
      lastVisit: serverTimestamp(),
    });
    tx.set(newHistoryRef(id), { type: 'visit', amount, pointsDelta: earned, services: svcNames, note, at: serverTimestamp() });
    return { earned, rewardEarned };
  });
}

async function redeemPoints(id) {
  const rp = Number(rules.redeemPoints) || 100;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(memberRef(id));
    const pts = snap.data()?.points || 0;
    if (pts < rp) throw new Error(`Not enough points (needs ${rp}).`);
    tx.update(memberRef(id), { points: pts - rp });
    tx.set(newHistoryRef(id), { type: 'redeem_points', pointsDelta: -rp, amount: Number(rules.redeemValue) || 0, note: `${money(rules.redeemValue)} off`, at: serverTimestamp() });
  });
}

async function redeemVisitReward(id) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(memberRef(id));
    const n = snap.data()?.visitRewardsAvailable || 0;
    if (n < 1) throw new Error('No punch-card reward available.');
    tx.update(memberRef(id), { visitRewardsAvailable: n - 1 });
    tx.set(newHistoryRef(id), { type: 'redeem_visit', note: rules.visitRewardText, at: serverTimestamp() });
  });
}

async function adjustPoints(id, delta, note) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(memberRef(id));
    const pts = snap.data()?.points || 0;
    tx.update(memberRef(id), { points: Math.max(0, pts + delta) });
    tx.set(newHistoryRef(id), { type: 'adjust', pointsDelta: Math.max(-pts, delta), note, at: serverTimestamp() });
  });
}

async function deleteDocsInChunks(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const b = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}
async function deleteMember(id) {
  const hist = await getDocs(collection(db, 'members', id, 'history'));
  await deleteDocsInChunks(hist.docs.map((d) => d.ref));
  await deleteDoc(memberRef(id));
}

// ---------- new / edit member dialog ----------
let editingId = null;
$('new-member-btn').addEventListener('click', () => openMemberDialog(null));
$('member-cancel').addEventListener('click', () => $('member-dialog').close());

function openMemberDialog(m) {
  editingId = m ? m.id : null;
  $('member-dialog-title').textContent = m ? 'Edit member' : 'New rewards member';
  $('member-save').textContent = m ? 'Save' : 'Sign up';
  $('m-name').value = m?.name || '';
  // Pre-fill phone from search box when it looks like a number
  const q = $('member-search').value.replace(/\D/g, '');
  $('m-phone').value = m ? fmtPhone(m.id) : (q.length >= 7 ? q : '');
  $('m-email').value = m?.email || '';
  $('member-error').hidden = true;
  $('member-dialog').showModal();
  $('m-name').focus();
}

$('member-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('m-name').value.trim().replace(/\s+/g, ' ');
  const phone = normPhone($('m-phone').value);
  const email = $('m-email').value.trim().toLowerCase();
  const showErr = (t) => { $('member-error').textContent = t; $('member-error').hidden = false; };
  if (!name) return showErr('Please enter a name.');
  if (!phone) return showErr('Please enter a valid 10-digit phone number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('That email address doesn’t look right.');

  const btn = $('member-save');
  btn.disabled = true;
  try {
    if (!editingId) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(memberRef(phone));
        if (snap.exists()) throw new Error(`${fmtPhone(phone)} is already a member (${snap.data().name}).`);
        tx.set(memberRef(phone), {
          name, phone, email: email || null,
          visits: 0, punches: 0, visitRewardsAvailable: 0, points: 0, totalSpent: 0,
          createdAt: serverTimestamp(), lastVisit: null,
        });
        tx.set(newHistoryRef(phone), { type: 'signup', at: serverTimestamp() });
      });
      toast(`${name} joined rewards!`);
    } else if (phone === editingId) {
      await updateDoc(memberRef(editingId), { name, email: email || null });
      toast('Member updated.');
    } else {
      await changeMemberPhone(editingId, phone, { name, email: email || null });
      toast('Member updated.');
    }
    $('member-dialog').close();
    $('member-search').value = '';
    selectMember(phone);
  } catch (err) {
    console.error(err); showErr(errMsg(err));
  } finally { btn.disabled = false; }
});

/** Phone number is the document id, so changing it moves the member + history to a new doc. */
async function changeMemberPhone(oldId, newId, fields) {
  const existing = await getDoc(memberRef(newId));
  if (existing.exists()) throw new Error(`${fmtPhone(newId)} already belongs to ${existing.data().name}.`);
  const old = await getDoc(memberRef(oldId));
  const hist = await getDocs(collection(db, 'members', oldId, 'history'));
  const b = writeBatch(db);
  b.set(memberRef(newId), { ...old.data(), ...fields, phone: newId });
  hist.docs.slice(0, 450).forEach((d) => b.set(doc(db, 'members', newId, 'history', d.id), d.data()));
  await b.commit();
  await deleteMember(oldId);
}

// =====================================================================
// SERVICES
// =====================================================================
$('svc-cat').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
const DURATIONS = [15, 30, 45, 60, 75, 90, 120];
const durOptions = (cur) => [...new Set([...DURATIONS, cur])].sort((a, b) => a - b)
  .map((d) => `<option value="${d}"${d === cur ? ' selected' : ''}>${d} min</option>`).join('');
$('svc-dur').innerHTML = durOptions(30);

function renderServices() {
  $('seed-box').hidden = services.length > 0;
  $('svc-list').innerHTML = Object.entries(CATS).map(([cat, label]) => {
    const list = services.filter((s) => s.cat === cat);
    return `<div class="${card}">
      <p class="text-secondary font-bold text-xs uppercase tracking-[0.2em] mb-4">${esc(label)}</p>
      ${list.length ? `<div class="space-y-4">${list.map((s, i) => `
        <div class="svc-row grid grid-cols-12 gap-3 sm:gap-4 items-end pb-4" data-id="${esc(s.id)}" style="border-bottom:1px solid rgba(221,191,196,.2)">
          <div class="e-group col-span-12 sm:col-span-4"><label class="e-label mb-1">Name</label><input class="e-input f-name" value="${esc(s.name)}"/></div>
          <div class="e-group col-span-4 sm:col-span-2"><label class="e-label mb-1">Category</label><select class="e-input f-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}"${k === s.cat ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div class="e-group col-span-4 sm:col-span-2"><label class="e-label mb-1">Price ($)</label><input class="e-input f-price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.price)}"/></div>
          <div class="e-group col-span-4 sm:col-span-2"><label class="e-label mb-1">Duration</label><select class="e-input f-dur">${durOptions(Number(s.duration) || 30)}</select></div>
          <div class="col-span-12 sm:col-span-2 flex items-center justify-end gap-1">
            <label class="flex items-center gap-1.5 text-xs text-tertiary mr-auto sm:mr-1 cursor-pointer" title="Show on website"><input type="checkbox" class="f-active rounded text-primary focus:ring-primary/30" ${s.active !== false ? 'checked' : ''}/>Live</label>
            <button class="p-1.5 rounded-full hover:bg-surface-container disabled:opacity-30" data-svc="up" ${i === 0 ? 'disabled' : ''} title="Move up"><span class="material-symbols-outlined" style="font-size:18px">arrow_upward</span></button>
            <button class="p-1.5 rounded-full hover:bg-surface-container disabled:opacity-30" data-svc="down" ${i === list.length - 1 ? 'disabled' : ''} title="Move down"><span class="material-symbols-outlined" style="font-size:18px">arrow_downward</span></button>
            <button class="p-1.5 rounded-full hover:bg-error-container text-error" data-svc="delete" title="Delete"><span class="material-symbols-outlined" style="font-size:18px">delete</span></button>
          </div>
          <div class="col-span-12 flex justify-end -mt-1" hidden data-save-wrap>
            <button class="btn btn-primary" data-svc="save">Save changes</button>
          </div>
        </div>`).join('')}</div>`
        : '<p class="text-tertiary/60 text-sm italic">No services in this category.</p>'}
    </div>`;
  }).join('');
}

// Show "Save" when a row is edited
$('svc-list').addEventListener('input', (e) => {
  const row = e.target.closest('.svc-row'); if (!row || e.target.classList.contains('f-active')) return;
  row.querySelector('[data-save-wrap]').hidden = false;
});
$('svc-list').addEventListener('change', async (e) => {
  const row = e.target.closest('.svc-row'); if (!row) return;
  if (e.target.classList.contains('f-active')) {
    try { await updateDoc(doc(db, 'services', row.dataset.id), { active: e.target.checked }); toast(e.target.checked ? 'Shown on website.' : 'Hidden from website.'); }
    catch (err) { toast(errMsg(err), true); }
  } else {
    row.querySelector('[data-save-wrap]').hidden = false;
  }
});
$('svc-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-svc]'); if (!btn) return;
  const row = btn.closest('.svc-row');
  const s = services.find((x) => x.id === row.dataset.id); if (!s) return;
  const act = btn.dataset.svc;
  if (act === 'save') {
    const name = row.querySelector('.f-name').value.trim();
    const price = round2(Number(row.querySelector('.f-price').value));
    const cat = row.querySelector('.f-cat').value;
    if (!name) return toast('Service name can’t be empty.', true);
    if (!(price >= 0) || row.querySelector('.f-price').value === '') return toast('Enter a valid price.', true);
    const patch = { name, price, cat, duration: Number(row.querySelector('.f-dur').value) || 30 };
    if (cat !== s.cat) patch.order = nextOrder(cat);
    await busy(btn, async () => { await updateDoc(doc(db, 'services', s.id), patch); toast(`${name} saved.`); });
  }
  if (act === 'delete') {
    if (!confirm(`Delete “${s.name}” from the menu?`)) return;
    await busy(btn, async () => { await deleteDoc(doc(db, 'services', s.id)); toast('Service deleted.'); });
  }
  if (act === 'up' || act === 'down') {
    const list = services.filter((x) => x.cat === s.cat);
    const i = list.indexOf(s), j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    // Re-number the whole category so orders are always distinct
    [list[i], list[j]] = [list[j], list[i]];
    const base = Math.min(...list.map((x) => x.order ?? 0));
    const b = writeBatch(db);
    list.forEach((x, k) => b.update(doc(db, 'services', x.id), { order: base + k }));
    await busy(btn, () => b.commit());
  }
});

function nextOrder(cat) {
  // Categories are spaced by 1000 so the public site's single sort keeps them grouped.
  const catIdx = Object.keys(CATS).indexOf(cat);
  const inCat = services.filter((s) => s.cat === cat).map((s) => s.order ?? 0);
  return inCat.length ? Math.max(...inCat) + 1 : catIdx * 1000;
}

$('add-svc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('svc-name').value.trim().replace(/\s+/g, ' ');
  const cat = $('svc-cat').value;
  const priceRaw = $('svc-price').value;
  const price = round2(Number(priceRaw));
  if (!name) return toast('Enter a service name.', true);
  if (priceRaw === '' || !(price >= 0)) return toast('Enter a valid price.', true);
  let id = slugify(name), n = 2;
  while (services.some((s) => s.id === id)) id = `${slugify(name)}-${n++}`;
  await busy(e.submitter || $('add-svc-form').querySelector('button'), async () => {
    await setDoc(doc(db, 'services', id), { name, cat, price, duration: Number($('svc-dur').value) || 30, order: nextOrder(cat), active: true });
    $('svc-name').value = ''; $('svc-price').value = '';
    toast(`${name} added.`);
  });
});

$('seed-btn').addEventListener('click', async (e) => {
  await busy(e.currentTarget, async () => {
    const b = writeBatch(db);
    const counters = {};
    window.DEFAULT_SERVICES.forEach((s) => {
      const base = Object.keys(CATS).indexOf(s.cat) * 1000;
      counters[s.cat] = (counters[s.cat] ?? -1) + 1;
      b.set(doc(db, 'services', s.id), { name: s.name, cat: s.cat, price: s.price, duration: s.duration, order: base + counters[s.cat], active: true });
    });
    const [rs, bs] = await Promise.all([getDoc(doc(db, 'settings', 'rewards')), getDoc(doc(db, 'settings', 'booking'))]);
    if (!rs.exists()) b.set(doc(db, 'settings', 'rewards'), { ...window.DEFAULT_REWARDS });
    if (!bs.exists()) b.set(doc(db, 'settings', 'booking'), { ...window.DEFAULT_BOOKING });
    await b.commit();
    toast('Default services loaded.');
  });
});

// =====================================================================
// SETTINGS
// =====================================================================
function fillSettings() {
  $('set-visits').value = rules.visitsForReward;
  $('set-visit-text').value = rules.visitRewardText;
  $('set-ppd').value = rules.pointsPerDollar;
  $('set-rp').value = rules.redeemPoints;
  $('set-rv').value = rules.redeemValue;
  $('settings-summary').textContent =
    `Every ${rules.visitsForReward} visits → ${rules.visitRewardText}. ${rules.pointsPerDollar} pt per $1; ${rules.redeemPoints} pts = ${money(rules.redeemValue)} off.`;
}
$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = {
    visitsForReward: Math.trunc(Number($('set-visits').value)),
    visitRewardText: $('set-visit-text').value.trim(),
    pointsPerDollar: Number($('set-ppd').value),
    redeemPoints: Math.trunc(Number($('set-rp').value)),
    redeemValue: round2(Number($('set-rv').value)),
  };
  if (!(v.visitsForReward >= 1) || !v.visitRewardText || !(v.pointsPerDollar >= 0) || !(v.redeemPoints >= 1) || !(v.redeemValue >= 0)) {
    return toast('Please check the values — all fields are required.', true);
  }
  await busy(e.submitter || $('settings-form').querySelector('button'), async () => {
    await setDoc(doc(db, 'settings', 'rewards'), v);
    toast('Reward rules saved.');
  });
});

$('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const capacity = Math.trunc(Number($('set-capacity').value));
  if (!(capacity >= 1 && capacity <= 20)) return toast('Enter a number from 1 to 20.', true);
  await busy(e.submitter || $('booking-form').querySelector('button'), async () => {
    await setDoc(doc(db, 'settings', 'booking'), { capacity });
    toast(`Saved — up to ${capacity} customer${capacity > 1 ? 's' : ''} at the same time.`);
  });
});
