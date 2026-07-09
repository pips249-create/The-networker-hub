const { deriveRefundStatusForCancelledRegistration } = require('./cancellation-email-sections');
const { verifyRegistrationRefunded, issueRefundForRegistration } = require('./stripe-refunds');
const { sendRefundProcessedEmail } = require('./cancellation-emails');

/**
 * Issue or confirm Stripe refunds for cancelled registrations that are still marked Paid.
 * Returns an updated registration row when payment_status changes.
 */
async function reconcileCancelledRegistrationRefund(sb, registration, eventRow) {
  if (!registration?.id || !registration?.cancelled_at) return registration;

  const paymentStatus = String(registration.payment_status || '').trim();
  if (paymentStatus === 'Refunded' || paymentStatus === 'Free') return registration;

  const refundStatus = deriveRefundStatusForCancelledRegistration(eventRow, registration);
  if (refundStatus !== 'pending') return registration;

  const verify = await verifyRegistrationRefunded(registration);
  if (verify.refunded) {
    await sb.from('registrations').update({ payment_status: 'Refunded' }).eq('id', registration.id);
    const updated = { ...registration, payment_status: 'Refunded' };
    if (!registration.refund_email_sent_at) {
      try {
        await sendRefundProcessedEmail(sb, registration.id, registration.amount_paid);
      } catch {
        /* non-fatal — dashboard can still show Refunded */
      }
    }
    return updated;
  }

  const result = await issueRefundForRegistration(registration);
  if (!result.issued) return registration;

  await sb.from('registrations').update({ payment_status: 'Refunded' }).eq('id', registration.id);
  const updated = { ...registration, payment_status: 'Refunded' };
  if (!registration.refund_email_sent_at) {
    try {
      await sendRefundProcessedEmail(sb, registration.id, registration.amount_paid);
    } catch {
      /* non-fatal */
    }
  }
  return updated;
}

async function reconcileCancelledRegistrationRefunds(sb, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return list;

  const reconciled = [];
  for (const row of list) {
    const eventRow = row.events || {};
    try {
      reconciled.push(await reconcileCancelledRegistrationRefund(sb, row, eventRow));
    } catch {
      reconciled.push(row);
    }
  }
  return reconciled;
}

module.exports = {
  reconcileCancelledRegistrationRefund,
  reconcileCancelledRegistrationRefunds,
};
