// Default service menu (duration in minutes). Used as a fallback on the public site when Firebase
// isn't configured or can't be reached, and by admin.html → "Seed default services".
window.DEFAULT_SERVICES = [
  {id:'eyebrows',    name:'Eyebrows',    cat:'threading',  price:12, duration:15},
  {id:'upper-lip',   name:'Upper Lip',   cat:'threading',  price:8,  duration:15},
  {id:'lower-lip',   name:'Lower Lip',   cat:'threading',  price:8,  duration:15},
  {id:'chin',        name:'Chin',        cat:'threading',  price:8,  duration:15},
  {id:'neck',        name:'Neck',        cat:'threading',  price:10, duration:15},
  {id:'full-face',   name:'Full Face',   cat:'threading',  price:36, duration:30},
  {id:'brow-tint',   name:'Brow Tint',   cat:'tinting',    price:20, duration:30},
  {id:'luxe-facial', name:'Luxe Facial', cat:'treatments', price:60, duration:60},
  {id:'basic-henna', name:'Basic Henna', cat:'treatments', price:10, duration:30},
];

window.SERVICE_CATEGORIES = {
  threading:  'Threading',
  tinting:    'Tinting & Color',
  treatments: 'Treatments',
};

window.DEFAULT_REWARDS = {
  pointsPerDollar: 1,      // points earned per $1 spent
  redeemPoints:    100,    // points needed to redeem
  redeemValue:     10,     // $ off when points are redeemed
  visitsForReward: 10,     // punch-card size
  visitRewardText: 'Free eyebrow threading',
};

window.DEFAULT_BOOKING = {
  capacity: 1,             // customers that can be booked at the same time
};

// Booking calendar: 30-minute slots from 9:00 AM; the last start is 6:00 PM
// and the studio closes at 6:30 PM. Slot index 0 = 9:00 AM.
window.SLOT_MINUTES = 30;
window.SLOT_LABELS = (() => {
  const s = [];
  for (let h = 9; h < 19; h++) [0, 30].forEach((m) => {
    if (h === 18 && m === 30) return;
    const h12 = h > 12 ? h - 12 : h;
    s.push(h12 + ':' + (m === 0 ? '00' : '30') + ' ' + (h >= 12 ? 'PM' : 'AM'));
  });
  return s;
})();
/** Label for the end of a booking: index of the first slot after it (19 = 6:30 PM). */
window.slotEndLabel = (endIdx) => {
  const mins = 9 * 60 + endIdx * 30, h = Math.floor(mins / 60), m = mins % 60;
  return (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
};
/** Number of 30-min slots needed for a total duration in minutes (min 1). */
window.slotsFor = (minutes) => Math.max(1, Math.ceil((Number(minutes) || 0) / 30));
