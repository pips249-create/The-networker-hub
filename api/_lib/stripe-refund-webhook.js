const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendRefundProcessedEmail } = require('./cancellation-emails');

async function handleChargeRefunded(charge) {
  if (!isSupabaseConfigured()) {
    return { skipped: true, reason: 'supabase_not_configured' };
  }

  let listingResult = null;
  try {
    const { handleOpportunityListingChargeRefunded } = require('./opportunity-listing-refunds');
    listingResult = await handleOpportunityListingChargeRefunded(charge);
  } catch (listingErr) {
    console.warn(
      '[stripe-refund] opportunity listing refund handler failed:',
      listingErr && listingErr.message ? listingErr.message : listingErr
    );
    listingResult = {
      skipped: true,
      reason: 'listing_refund_failed',
      error: listingErr && listingErr.message ? listingErr.message : String(listingErr),
    };
  }

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id || null;
  if (!paymentIntentId) {
    return { skipped: true, reason: 'missing_payment_intent', listingResult };
  }

  const sb = getSupabaseAdmin();
  const { data: registration, error } = await sb
    .from('registrations')
    .select('id, refund_email_sent_at, cancelled_at, payment_status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!registration?.id) {
    return { skipped: true, reason: 'registration_not_found', listingResult };
  }

  const now = new Date().toISOString();
  if (
    !registration.cancelled_at ||
    String(registration.payment_status || '').trim() !== 'Refunded'
  ) {
    await sb
      .from('registrations')
      .update({
        cancelled_at: registration.cancelled_at || now,
        payment_status: 'Refunded',
      })
      .eq('id', registration.id);
  }

  const refundAmount =
    charge.amount_refunded != null ? Number(charge.amount_refunded) / 100 : null;
  const result = await sendRefundProcessedEmail(sb, registration.id, refundAmount);
  return { registrationId: registration.id, ...result, listingResult };
}

module.exports = {
  handleChargeRefunded,
};
