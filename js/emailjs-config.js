// ====================================================
// EMAIL CONFIGURATION (EmailJS) — fill these in after signing up
// at https://www.emailjs.com (free, no backend needed).
// Used by the booking form (index.html) and the admin page (accept/reject).
// ====================================================
window.EMAILJS_CFG = {
  PUBLIC_KEY:      'YOUR_PUBLIC_KEY',          // Account → API Keys
  SERVICE_ID:      'YOUR_SERVICE_ID',          // Email Services tab
  TEMPLATE_BIZ:    'YOUR_BIZ_TEMPLATE_ID',     // new request → salon owner
  TEMPLATE_CLIENT: 'YOUR_CLIENT_TEMPLATE_ID',  // "request received" → customer
  TEMPLATE_STATUS: 'YOUR_STATUS_TEMPLATE_ID',  // accepted / declined → customer
  BIZ_EMAIL:       'owner@specialeyebrows.com', // your inbox
};
// Template variables:
//   BIZ / CLIENT: {{client_name}}, {{client_phone}}, {{client_email}}, {{booking_date}},
//                 {{booking_time}}, {{services}}, {{total}}, {{notes}}, {{to_email}}, {{to_name}}
//   STATUS:       {{to_name}}, {{to_email}}, {{status}} ("confirmed" / "declined" / "cancelled"),
//                 {{booking_date}}, {{booking_time}}, {{services}}, {{message}}
window.EMAILJS_READY = !Object.values(window.EMAILJS_CFG).some((v) => String(v).startsWith('YOUR_'));
