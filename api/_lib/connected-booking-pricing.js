/** Connected booking monthly plans — prices ex VAT (GBP). */

const CONNECTED_BOOKING_VAT_RATE = 0.2;

const CONNECTED_BOOKING_PLAN_AMOUNTS_EX_VAT_PENCE = {
  starter: 3900,
  growth: 9900,
  scale: 19900,
};

const CONNECTED_BOOKING_PLAN_LABELS = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale',
};

function isSelfServeConnectedPlan(plan) {
  const key = String(plan || '').trim().toLowerCase();
  return key in CONNECTED_BOOKING_PLAN_AMOUNTS_EX_VAT_PENCE;
}

function connectedBookingPlanTotals(plan) {
  const key = String(plan || '').trim().toLowerCase();
  const monthlyExVatPence = CONNECTED_BOOKING_PLAN_AMOUNTS_EX_VAT_PENCE[key];
  if (monthlyExVatPence == null) {
    const err = new Error('invalid_connected_booking_plan');
    err.code = 'invalid_connected_booking_plan';
    throw err;
  }
  const vatPence = Math.round(monthlyExVatPence * CONNECTED_BOOKING_VAT_RATE);
  return {
    plan: key,
    label: CONNECTED_BOOKING_PLAN_LABELS[key] || key,
    monthlyExVatPence,
    monthlyVatPence: vatPence,
    totalPence: monthlyExVatPence + vatPence,
  };
}

module.exports = {
  CONNECTED_BOOKING_VAT_RATE,
  CONNECTED_BOOKING_PLAN_AMOUNTS_EX_VAT_PENCE,
  CONNECTED_BOOKING_PLAN_LABELS,
  isSelfServeConnectedPlan,
  connectedBookingPlanTotals,
};
