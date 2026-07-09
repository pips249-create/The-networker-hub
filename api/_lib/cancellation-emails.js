const { sendTemplatedEmail } = require('./send-template-email');
const {
  buildAttendeeEmailVars,
  buildOrganiserEmailVars,
  formatAmount,
} = require('./registration-emails');
const { isRefundEligibleForCancellation } = require('./cancellation-email-sections');

function formatRefundDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function loadRegistrationContext(sb, registrationId) {
  const regRes = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, quantity, created_at, cancelled_at, cancellation_email_sent_at, event_cancelled_email_sent_at, refund_email_sent_at'
    )
    .eq('id', registrationId)
    .maybeSingle();
  if (regRes.error) throw new Error(regRes.error.message);
  const registration = regRes.data;
  if (!registration) return null;

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, refund_policy, refund_policy_details, refund_cutoff_days'
      )
      .eq('id', registration.event_id)
      .maybeSingle(),
    registration.attendee_id
      ? sb.from('attendees').select('id, email, name').eq('id', registration.attendee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    registration.ticket_id
      ? sb.from('tickets').select('id, name').eq('id', registration.ticket_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (attendeeRes.error) throw new Error(attendeeRes.error.message);
  if (ticketRes.error) throw new Error(ticketRes.error.message);

  let organiserName = '';
  if (eventRes.data?.organiser_id) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name')
      .eq('id', eventRes.data.organiser_id)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiserName = String(orgRes.data?.name || '').trim();
  }

  return {
    registration,
    eventRow: eventRes.data,
    attendee: attendeeRes.data || {},
    ticketName: String(ticketRes.data?.name || 'Ticket').trim(),
    organiserName,
  };
}

function buildCancellationEmailVars(ctx, extra) {
  const base = buildAttendeeEmailVars({
    registration: ctx.registration,
    eventRow: ctx.eventRow,
    attendee: ctx.attendee,
    ticketName: ctx.ticketName,
    organiserName: ctx.organiserName,
    amountPaid: formatAmount(ctx.registration.amount_paid),
  });
  return {
    ...base,
    ...extra,
    _registration: ctx.registration,
    _event_row: ctx.eventRow,
  };
}

function formatCancellationTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function sendOrganiserBookingCancelledEmail(sb, registrationId, options = {}) {
  const ctx = await loadRegistrationContext(sb, registrationId);
  if (!ctx || !ctx.eventRow) return { skipped: true, reason: 'registration_not_found' };

  const { data: eventRowFull } = await sb
    .from('events')
    .select('id, organiser_id, refund_policy, refund_policy_details, refund_cutoff_days, starts_at')
    .eq('id', ctx.eventRow.id)
    .maybeSingle();

  let organiserEmail = '';
  let organiserName = ctx.organiserName;
  let stripeExpressUrl = '';
  if (eventRowFull?.organiser_id) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name, email, contact_email, stripe_account_id')
      .eq('id', eventRowFull.organiser_id)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiserName = String(orgRes.data?.name || organiserName).trim();
    organiserEmail = String(orgRes.data?.email || orgRes.data?.contact_email || '')
      .trim()
      .toLowerCase();

    const paid =
      Number(ctx.registration?.amount_paid) > 0 &&
      ['Paid', 'Refunded'].includes(String(ctx.registration?.payment_status || '').trim());
    const refundEligible =
      paid &&
      eventRowFull &&
      isRefundEligibleForCancellation(eventRowFull, ctx.registration, ctx.registration?.cancelled_at);
    const refundAutoIssued =
      Boolean(options.refundIssued) ||
      (refundEligible && String(ctx.registration?.payment_status || '').trim() === 'Refunded');

    if (refundEligible && !refundAutoIssued && orgRes.data?.stripe_account_id) {
      try {
        const { createExpressDashboardLink } = require('./stripe-connect');
        const link = await createExpressDashboardLink(orgRes.data.stripe_account_id);
        stripeExpressUrl = String(link?.url || '').trim();
      } catch {
        /* non-fatal — email still sends with dashboard instructions */
      }
    }
  }
  if (!organiserEmail) return { skipped: true, reason: 'missing_organiser_email' };

  const attendeeVars = buildAttendeeEmailVars({
    registration: ctx.registration,
    eventRow: ctx.eventRow,
    attendee: ctx.attendee,
    ticketName: ctx.ticketName,
    organiserName,
    amountPaid: formatAmount(ctx.registration.amount_paid),
  });
  const vars = buildOrganiserEmailVars(attendeeVars, {});
  vars.cancellation_time = formatCancellationTime(ctx.registration.cancelled_at);
  vars.stripe_express_url = stripeExpressUrl;
  vars.refund_issued = Boolean(options.refundIssued);
  vars._registration = ctx.registration;
  vars._event_row = eventRowFull || ctx.eventRow;

  try {
    await sendTemplatedEmail({
      slug: 'organiser_booking_cancelled',
      to: organiserEmail,
      variables: vars,
    });
    return { sent: true, to: organiserEmail };
  } catch (e) {
    return { sent: false, error: e.message || String(e), code: e.code || null };
  }
}

async function sendBookingCancelledEmail(sb, registrationId, options = {}) {
  const ctx = await loadRegistrationContext(sb, registrationId);
  if (!ctx || !ctx.eventRow) return { skipped: true, reason: 'registration_not_found' };
  if (ctx.registration.cancellation_email_sent_at) {
    return { skipped: true, reason: 'already_sent' };
  }

  let attendeeEmail = String(ctx.attendee.email || options.sessionEmail || '')
    .trim()
    .toLowerCase();
  if (!attendeeEmail) return { skipped: true, reason: 'missing_email' };

  const vars = buildCancellationEmailVars(ctx, {
    refund_issued: Boolean(options.refundIssued),
  });
  try {
    await sendTemplatedEmail({
      slug: 'booking_cancelled',
      to: attendeeEmail,
      variables: vars,
    });
    await sb
      .from('registrations')
      .update({ cancellation_email_sent_at: new Date().toISOString() })
      .eq('id', registrationId);
    return { sent: true, to: attendeeEmail };
  } catch (e) {
    return { sent: false, error: e.message || String(e), code: e.code || null };
  }
}

async function sendEventCancelledEmail(sb, registrationId, organiserMessage) {
  const ctx = await loadRegistrationContext(sb, registrationId);
  if (!ctx || !ctx.eventRow) return { skipped: true, reason: 'registration_not_found' };
  if (ctx.registration.event_cancelled_email_sent_at) {
    return { skipped: true, reason: 'already_sent' };
  }

  const attendeeEmail = String(ctx.attendee.email || '').trim().toLowerCase();
  if (!attendeeEmail) return { skipped: true, reason: 'missing_email' };

  const vars = buildCancellationEmailVars(ctx, {
    organiser_message: String(organiserMessage || '').trim(),
  });

  try {
    await sendTemplatedEmail({
      slug: 'event_cancelled',
      to: attendeeEmail,
      variables: vars,
    });
    await sb
      .from('registrations')
      .update({
        event_cancelled_email_sent_at: new Date().toISOString(),
        cancelled_at: ctx.registration.cancelled_at || new Date().toISOString(),
      })
      .eq('id', registrationId);
    return { sent: true, to: attendeeEmail };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

async function sendRefundProcessedEmail(sb, registrationId, refundAmount) {
  const ctx = await loadRegistrationContext(sb, registrationId);
  if (!ctx || !ctx.eventRow) return { skipped: true, reason: 'registration_not_found' };
  if (ctx.registration.refund_email_sent_at) {
    return { skipped: true, reason: 'already_sent' };
  }

  const attendeeEmail = String(ctx.attendee.email || '').trim().toLowerCase();
  if (!attendeeEmail) return { skipped: true, reason: 'missing_email' };

  const amount =
    refundAmount != null ? formatAmount(refundAmount) : formatAmount(ctx.registration.amount_paid);
  const vars = buildCancellationEmailVars(ctx, {
    refund_amount: amount,
    refund_date: formatRefundDate(new Date().toISOString()),
  });

  try {
    await sendTemplatedEmail({
      slug: 'refund_processed',
      to: attendeeEmail,
      variables: vars,
    });
    const now = new Date().toISOString();
    await sb
      .from('registrations')
      .update({
        refund_email_sent_at: now,
        payment_status: 'Refunded',
        cancelled_at: ctx.registration.cancelled_at || now,
      })
      .eq('id', registrationId);
    return { sent: true, to: attendeeEmail, amount };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

async function sendEventCancelledEmailsForEvent(sb, eventId, cancellation) {
  const { data: registrations, error } = await sb
    .from('registrations')
    .select('id')
    .eq('event_id', eventId)
    .in('payment_status', ['Paid', 'Free', 'Pending'])
    .neq('application_status', 'Denied')
    .is('event_cancelled_email_sent_at', null);

  if (error) throw new Error(error.message);

  const message = cancellation?.details || '';
  const result = { sent: 0, skipped: 0, errors: [] };

  for (const row of registrations || []) {
    const outcome = await sendEventCancelledEmail(sb, row.id, message);
    if (outcome.sent) result.sent += 1;
    else if (outcome.skipped) result.skipped += 1;
    else if (outcome.error) {
      result.errors.push({ registration_id: row.id, message: outcome.error });
    }
  }

  return result;
}

async function sendRefundProcessedEmailsForEvent(sb, eventId) {
  const { data: registrations, error } = await sb
    .from('registrations')
    .select('id, amount_paid')
    .eq('event_id', eventId)
    .eq('payment_status', 'Paid')
    .is('refund_email_sent_at', null);

  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };
  for (const row of registrations || []) {
    const outcome = await sendRefundProcessedEmail(sb, row.id, row.amount_paid);
    if (outcome.sent) result.sent += 1;
    else if (outcome.skipped) result.skipped += 1;
    else if (outcome.error) {
      result.errors.push({ registration_id: row.id, message: outcome.error });
    }
  }
  return result;
}

module.exports = {
  sendBookingCancelledEmail,
  sendOrganiserBookingCancelledEmail,
  sendEventCancelledEmail,
  sendRefundProcessedEmail,
  sendEventCancelledEmailsForEvent,
  sendRefundProcessedEmailsForEvent,
  loadRegistrationContext,
};
