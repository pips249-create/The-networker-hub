const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId } = require('./supabase-favourites');
const { sendRegistrationEmails } = require('./registration-emails');

/**
 * Insert a registration after successful checkout.
 * Idempotent when stripePaymentIntentId or stripeCheckoutSessionId is supplied.
 */
async function createRegistrationFromPayment(input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const sb = getSupabaseAdmin();
  const eventId = String(input.eventId || input.event_id || '').trim();
  if (!eventId) throw new Error('missing_event_id');

  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('missing_email');

  const stripePaymentIntentId = input.stripePaymentIntentId || input.stripe_payment_intent_id || null;
  const stripeCheckoutSessionId =
    input.stripeCheckoutSessionId || input.stripe_checkout_session_id || null;

  if (stripeCheckoutSessionId) {
    const existingSession = await sb
      .from('registrations')
      .select('id, attendee_id, event_id, ticket_id, amount_paid, ticket_email_sent, meeting_link')
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle();
    if (existingSession.error) throw new Error(existingSession.error.message);
    if (existingSession.data?.id) {
      let emailResult = null;
      if (!existingSession.data.ticket_email_sent) {
        try {
          emailResult = await sendRegistrationEmails(sb, existingSession.data);
        } catch (e) {
          emailResult = { error: e.message || String(e) };
        }
      }
      return {
        action: 'exists',
        id: existingSession.data.id,
        registration: existingSession.data,
        emailResult,
      };
    }
  }

  if (stripePaymentIntentId) {
    const existing = await sb
      .from('registrations')
      .select('id, attendee_id, event_id, ticket_id, amount_paid, ticket_email_sent, meeting_link')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) {
      let emailResult = null;
      if (!existing.data.ticket_email_sent) {
        try {
          emailResult = await sendRegistrationEmails(sb, existing.data);
        } catch (e) {
          emailResult = { error: e.message || String(e) };
        }
      }
      return {
        action: 'exists',
        id: existing.data.id,
        registration: existing.data,
        emailResult,
      };
    }
  }

  const session = {
    email,
    name: input.name || input.customerName || null,
    sub: input.userId || input.supabase_user_id || null,
  };
  const attendeeId = await ensureAttendeeId(sb, session);

  let organiserId = input.organiserId || input.organiser_id || null;
  if (!organiserId) {
    const ev = await sb.from('events').select('organiser_id').eq('id', eventId).maybeSingle();
    if (ev.error) throw new Error(ev.error.message);
    organiserId = ev.data?.organiser_id || null;
  }

  const ticketId = input.ticketId || input.ticket_id || null;
  const amountPaid =
    input.amountPaid != null
      ? Number(input.amountPaid)
      : input.amount_paid != null
        ? Number(input.amount_paid)
        : 0;
  const paymentStatus = input.paymentStatus || input.payment_status || (amountPaid > 0 ? 'Paid' : 'Free');

  const row = {
    attendee_id: attendeeId,
    event_id: eventId,
    ticket_id: ticketId,
    organiser_id: organiserId,
    payment_status: paymentStatus,
    amount_paid: Number.isFinite(amountPaid) ? amountPaid : 0,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_checkout_session_id: stripeCheckoutSessionId,
    application_status: input.applicationStatus || input.application_status || 'Approved',
  };

  const ins = await sb.from('registrations').insert(row).select('*').single();
  if (ins.error) throw new Error(ins.error.message);

  let emailResult = null;
  try {
    emailResult = await sendRegistrationEmails(sb, ins.data);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return {
    action: 'created',
    id: ins.data.id,
    attendeeId,
    stripeCheckoutSessionId,
    registration: ins.data,
    emailResult,
  };
}

function parseStripeEventBody(rawBody) {
  if (!rawBody) return null;
  if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
    return rawBody;
  }
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseClientReferenceId(ref) {
  const raw = String(ref || '');
  const eventMatch = raw.match(/id([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  const ticketMatch = raw.match(/ticket-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  return {
    eventId: eventMatch ? eventMatch[1] : null,
    ticketId: ticketMatch ? ticketMatch[1] : null,
  };
}

/**
 * Handle Stripe checkout.session.completed — expects metadata.event_id (+ optional ticket_id),
 * or client_reference_id from the hub checkout URL (id<event-uuid>-ticket-<ticket-uuid>-...).
 */
async function handleCheckoutSessionCompleted(session) {
  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.attendee_email ||
    session.metadata?.email ||
    '';
  const metadata = session.metadata || {};
  let eventId = metadata.event_id || metadata.eventId;
  let ticketId = metadata.ticket_id || metadata.ticketId || null;

  if (!eventId && session.client_reference_id) {
    const parsed = parseClientReferenceId(session.client_reference_id);
    eventId = parsed.eventId;
    if (!ticketId) ticketId = parsed.ticketId;
  }

  if (!eventId) {
    return { skipped: true, reason: 'missing_event_id_metadata' };
  }

  const amountTotal = session.amount_total != null ? session.amount_total / 100 : 0;
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  return createRegistrationFromPayment({
    email: customerEmail,
    name: session.customer_details?.name || metadata.attendee_name || null,
    eventId,
    ticketId,
    amountPaid: amountTotal,
    paymentStatus: amountTotal > 0 ? 'Paid' : 'Free',
    stripePaymentIntentId: paymentIntentId,
    stripeCheckoutSessionId: session.id,
  });
}

module.exports = {
  createRegistrationFromPayment,
  handleCheckoutSessionCompleted,
  parseStripeEventBody,
};
