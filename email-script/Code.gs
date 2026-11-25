/**
 * Free booking emails for New Special Eyebrows & Beauty (Google Apps Script).
 *
 * Sends from the Gmail account that deploys this script. No paid service needed.
 * The website only sends { type, id }; this script reads the booking itself from
 * Firestore (using your Google account's access to the Firebase project), so
 * nobody can use it to send arbitrary emails. Each email is sent at most once.
 *
 * Setup: see README.md → "Emails (free, via Gmail)".
 */

// ===================== SETTINGS =====================
const PROJECT_ID  = 'new-special-eyebrows';           // Firebase project id
const OWNER_EMAIL = 'YOUR_SALON_EMAIL@gmail.com';     // where new-request alerts go
const BUSINESS    = 'New Special Eyebrows & Beauty';
const PHONE       = '804-882-2942';
const ADMIN_URL   = '';                               // optional, e.g. https://yoursite.com/admin.html
// ====================================================

const DOC_URL = (id) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/appointments/${id}`;

function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = handle(body.type, body.id);
  } catch (err) {
    console.error(err);
    out = { ok: false, error: 'server-error' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Lets you check the deployment by opening the web app URL in a browser. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'booking-emails' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle(type, id) {
  if (!/^[A-Za-z0-9]{1,40}$/.test(String(id || ''))) return { ok: false, error: 'bad-id' };
  const a = getAppointment(id);
  if (!a) return { ok: false, error: 'not-found' };

  if (type === 'new') {
    if (a.status !== 'pending') return { ok: false, error: 'not-pending' };
    if (a.notifiedNew) return { ok: true, sent: false, reason: 'already-sent' };
    sendNewRequest(a);
    setFields(id, { notifiedNew: true });
    return { ok: true, sent: true };
  }

  if (type === 'status') {
    if (['accepted', 'rejected', 'cancelled'].indexOf(a.status) < 0) return { ok: false, error: 'no-decision' };
    if (a.notifiedStatus === a.status) return { ok: true, sent: false, reason: 'already-sent' };
    if (!a.email) return { ok: true, sent: false, reason: 'no-email' };
    sendStatus(a);
    setFields(id, { notifiedStatus: a.status });
    return { ok: true, sent: true };
  }

  return { ok: false, error: 'bad-type' };
}

// ---------------- emails ----------------

function sendNewRequest(a) {
  const when = longDate(a.date) + ', ' + a.timeLabel;
  const rows = [
    ['When', when],
    ['Client', a.name],
    ['Phone', a.phone],
    ['Email', a.email || 'Not provided'],
    ['Services', (a.services || []).map((s) => s.name + ' ($' + s.price + ')').join(', ')],
    ['Total', '$' + a.total],
    ['Notes', a.notes || 'None'],
  ];
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: 'New booking request: ' + a.name + ' — ' + when,
    htmlBody: layout('New booking request',
      table(rows) + '<p>Open the admin page to accept or decline.' +
      (ADMIN_URL ? ' <a href="' + esc(ADMIN_URL) + '">Go to admin</a>' : '') + '</p>'),
    name: BUSINESS,
    replyTo: a.email || OWNER_EMAIL,
  });
  if (a.email) {
    MailApp.sendEmail({
      to: a.email,
      subject: 'We received your booking request — ' + BUSINESS,
      htmlBody: layout('Thank you, ' + esc(a.name) + '!',
        '<p>We received your request for <b>' + esc(when) + '</b>.</p>' +
        table([['Services', (a.services || []).map((s) => s.name).join(', ')], ['Total', '$' + a.total]]) +
        '<p>We\'ll email you as soon as it\'s confirmed. Questions? Call us at ' + PHONE + '.</p>'),
      name: BUSINESS,
      replyTo: OWNER_EMAIL,
    });
  }
}

function sendStatus(a) {
  const when = longDate(a.date) + ', ' + a.timeLabel;
  const confirmed = a.status === 'accepted';
  const title = confirmed ? 'Your appointment is confirmed' : a.status === 'cancelled' ? 'Your appointment was cancelled' : 'We couldn\'t take your booking';
  const msg = confirmed
    ? '<p>See you on <b>' + esc(when) + '</b>!</p>' + table([['Services', (a.services || []).map((s) => s.name).join(', ')], ['Total', '$' + a.total]]) +
      '<p>Need to change it? Call us at ' + PHONE + '.</p>'
    : '<p>We\'re sorry — we can\'t keep your appointment on <b>' + esc(when) + '</b>.</p>' +
      (a.reason ? '<p>' + esc(a.reason) + '</p>' : '') +
      '<p>Please book another time online or call us at ' + PHONE + '.</p>';
  MailApp.sendEmail({
    to: a.email,
    subject: title + ' — ' + BUSINESS,
    htmlBody: layout(title, msg),
    name: BUSINESS,
    replyTo: OWNER_EMAIL,
  });
}

function layout(title, inner) {
  return '<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;color:#1b1c1b">' +
    '<p style="font-family:Georgia,serif;font-style:italic;color:#775a19;font-size:18px;margin:0 0 16px">' + BUSINESS + '</p>' +
    '<h2 style="font-family:Georgia,serif;font-weight:normal;color:#a82a55;margin:0 0 16px">' + title + '</h2>' +
    inner + '</div>';
}
function table(rows) {
  return '<table style="border-collapse:collapse;margin:12px 0">' + rows.map((r) =>
    '<tr><td style="padding:4px 16px 4px 0;color:#7d4c6f;font-size:13px;vertical-align:top">' + esc(r[0]) +
    '</td><td style="padding:4px 0;font-size:14px">' + esc(r[1]) + '</td></tr>').join('') + '</table>';
}
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function longDate(key) {
  const p = String(key).split('-').map(Number);
  return Utilities.formatDate(new Date(p[0], p[1] - 1, p[2], 12), Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
}

// ---------------- Firestore REST ----------------

function authHeaders() {
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
}

function getAppointment(id) {
  const res = UrlFetchApp.fetch(DOC_URL(id), { headers: authHeaders(), muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('Firestore read failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  return fromFields(JSON.parse(res.getContentText()).fields || {});
}

function setFields(id, obj) {
  const mask = Object.keys(obj).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const fields = {};
  Object.keys(obj).forEach((k) => { fields[k] = toValue(obj[k]); });
  const res = UrlFetchApp.fetch(DOC_URL(id) + '?' + mask + '&currentDocument.exists=true', {
    method: 'patch', contentType: 'application/json', headers: authHeaders(),
    payload: JSON.stringify({ fields }), muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Firestore update failed: ' + res.getResponseCode() + ' ' + res.getContentText());
}

function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(f) {
  const o = {};
  Object.keys(f).forEach((k) => { o[k] = fromValue(f[k]); });
  return o;
}
function toValue(x) {
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (x == null) return { nullValue: null };
  return { stringValue: String(x) };
}

/** Run once from the editor (▶ Run → authorize) to check Firestore access. */
function testSetup() {
  const res = UrlFetchApp.fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings`,
    { headers: authHeaders(), muteHttpExceptions: true });
  console.log('Firestore access:', res.getResponseCode() === 200 ? 'OK' : res.getResponseCode() + ' ' + res.getContentText());
  console.log('Emails left today:', MailApp.getRemainingDailyQuota());
}
