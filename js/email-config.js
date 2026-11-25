// ====================================================
// EMAIL CONFIGURATION (free, sent from your Gmail via Google Apps Script)
// Paste the Web app URL from your Apps Script deployment below.
// Setup steps: README.md → "Emails (free, via Gmail)". Script: email-script/Code.gs
// ====================================================
window.EMAIL_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL'; // https://script.google.com/macros/s/…/exec

/**
 * Asks the email script to send the emails for a booking.
 *   type 'new'    → alert to the salon + "request received" to the customer
 *   type 'status' → "confirmed" / "declined" / "cancelled" to the customer
 * Resolves to 'sent' | 'no-email' | 'unconfigured' | 'failed'. Never throws.
 */
window.sendBookingEmail = async function (type, id) {
  const url = window.EMAIL_SCRIPT_URL;
  if (!url || url.startsWith('YOUR_')) return 'unconfigured';
  try {
    // text/plain keeps this a "simple" request (no CORS preflight, which Apps Script can't answer).
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type, id }) });
    const r = await res.json();
    if (r.ok && r.sent) return 'sent';
    if (r.ok && r.reason === 'no-email') return 'no-email';
    if (r.ok && r.reason === 'already-sent') return 'sent';
    console.warn('Email script:', r);
    return 'failed';
  } catch (err) {
    console.error('Email script error:', err);
    return 'failed';
  }
};
