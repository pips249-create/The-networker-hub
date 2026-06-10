const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendRefundProcessedEmail } = require('./cancellation-emails');

async function handleChargeRefunded(charge) {
  if (!isSupabaseConfigured()) {
    return { skipped: true, reason: 'supabase_not_configured' };
  }

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id || null;
  if (!paymentIntentId) {
    return { skipped: true, reason: 'missing_payment_intent' };
  }

  const sb = getSupabaseAdmin();
  const { data: registration, error } = await sb
    .from('registrations')
    .select('id, refund_email_sent_at')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!registration?.id) {
    return { skipped: true, reason: 'registration_not_found' };
  }

  const refundAmount =
    charge.amount_refunded != null ? Number(charge.amount_refunded) / 100 : null;
  const result = await sendRefundProcessedEmail(sb, registration.id, refundAmount);
  return { registrationId: registration.id, ...result };
}

module.exports = {
  handleChargeRefunded,
};
