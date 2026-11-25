// Default service menu. Used as a fallback on the public site when Firebase
// isn't configured or can't be reached, and by admin.html → "Seed default services".
window.DEFAULT_SERVICES = [
  {id:'eyebrows',    name:'Eyebrows',    cat:'threading',  price:12},
  {id:'upper-lip',   name:'Upper Lip',   cat:'threading',  price:8},
  {id:'lower-lip',   name:'Lower Lip',   cat:'threading',  price:8},
  {id:'chin',        name:'Chin',        cat:'threading',  price:8},
  {id:'neck',        name:'Neck',        cat:'threading',  price:10},
  {id:'full-face',   name:'Full Face',   cat:'threading',  price:36},
  {id:'brow-tint',   name:'Brow Tint',   cat:'tinting',    price:20},
  {id:'luxe-facial', name:'Luxe Facial', cat:'treatments', price:60},
  {id:'basic-henna', name:'Basic Henna', cat:'treatments', price:10},
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
