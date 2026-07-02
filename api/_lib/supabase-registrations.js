const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId } = require('./supabase-favourites');
const { sendRegistrationEmails } = require('./registration-emails');
const { UUID_PATTERN } = require('./uuid');

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

  const linkedRegistrationId = String(
    input.registrationId || input.registration_id || ''
  ).trim();
  if (linkedRegistrationId) {
    const linkedRes = await sb
      .from('registrations')
      .select('*')
      .eq('id', linkedRegistrationId)
      .maybeSingle();
    if (linkedRes.error) throw new Error(linkedRes.error.message);
    const linked = linkedRes.data;
    if (!linked?.id) throw new Error('registration_not_found');
    if (String(linked.event_id || '') !== eventId) throw new Error('registration_event_mismatch');
    if (String(linked.application_status || '').trim() !== 'Approved') {
      throw new Error('registration_not_approved');
    }
    if (String(linked.payment_status || '').trim() === 'Paid') {
      return { action: 'exists', id: linked.id, registration: linked };
    }

    const amountPaid =
      input.amountPaid != null
        ? Number(input.amountPaid)
        : input.amount_paid != null
          ? Number(input.amount_paid)
          : 0;
    const paymentStatus =
      input.paymentStatus ||
      input.payment_status ||
      (amountPaid > 0 ? 'Paid' : String(linked.payment_status || 'Pending'));

    const patch = {
      payment_status: paymentStatus,
      amount_paid: Number.isFinite(amountPaid) ? amountPaid : 0,
      stripe_payment_intent_id: stripePaymentIntentId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
    };
    const dietaryRequirements = normalizeAttendeeExtraText(
      input.dietaryRequirements ?? input.dietary_requirements
    );
    const accessibilityRequirements = normalizeAttendeeExtraText(
      input.accessibilityRequirements ?? input.accessibility_requirements
    );
    if (dietaryRequirements) patch.dietary_requirements = dietaryRequirements;
    if (accessibilityRequirements) patch.accessibility_requirements = accessibilityRequirements;
    const upd = await sb.from('registrations').update(patch).eq('id', linked.id).select('*').single();
    if (upd.error) throw new Error(upd.error.message);

    let emailResult = null;
    try {
      emailResult = await sendRegistrationEmails(sb, upd.data);
    } catch (e) {
      emailResult = { error: e.message || String(e) };
    }

    return {
      action: 'updated',
      id: linked.id,
      attendeeId: linked.attendee_id,
      registration: upd.data,
      emailResult,
    };
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
  const quantity = parseQuantity(input.quantity ?? input.qty, 1);
  const guestNames = normalizeGuestNames(input.guestNames || input.guest_names, quantity);
  if (quantity > 1 && guestNames.length < quantity - 1) {
    throw new Error('missing_guest_names');
  }
  const dietaryRequirements = normalizeAttendeeExtraText(
    input.dietaryRequirements ?? input.dietary_requirements
  );
  const accessibilityRequirements = normalizeAttendeeExtraText(
    input.accessibilityRequirements ?? input.accessibility_requirements
  );
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
    quantity,
    guest_names: guestNames.length ? guestNames : null,
    dietary_requirements: dietaryRequirements || null,
    accessibility_requirements: accessibilityRequirements || null,
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
  const eventMatch = raw.match(new RegExp('id(' + UUID_PATTERN + ')', 'i'));
  const ticketMatch = raw.match(new RegExp('ticket-(' + UUID_PATTERN + ')', 'i'));
  const qtyMatch = raw.match(/qty-(\d+)/i);
  const parsedQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  return {
    eventId: eventMatch ? eventMatch[1] : null,
    ticketId: ticketMatch ? ticketMatch[1] : null,
    quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
  };
}

function parseQuantity(input, fallback) {
  const n = parseInt(input, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 99);
  const fb = parseInt(fallback, 10);
  return Number.isFinite(fb) && fb > 0 ? Math.min(fb, 99) : 1;
}

function normalizeGuestNames(input, quantity) {
  let names = input;
  if (typeof names === 'string') {
    try {
      names = JSON.parse(names);
    } catch {
      names = [];
    }
  }
  if (!Array.isArray(names)) return [];
  const maxExtra = Math.max(0, parseQuantity(quantity, 1) - 1);
  return names
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .slice(0, maxExtra);
}

function normalizeAttendeeExtraText(input) {
  const text = String(input || '').trim();
  return text ? text.slice(0, 500) : '';
}

/**
 * Handle Stripe checkout.session.completed — expects metadata.event_id (+ optional ticket_id),
 * or client_reference_id from the hub checkout URL (id<event-uuid>-ticket-<ticket-uuid>-...).
 */
async function handleCheckoutSessionCompleted(session) {
  const metadata = session.metadata || {};
  if (metadata.checkout_type === 'event_featured' || metadata.checkout_type === 'opportunity_premium' || metadata.checkout_type === 'opportunity_listing') {
    return { skipped: true, reason: 'not_ticket_checkout' };
  }

  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.attendee_email ||
    session.metadata?.email ||
    '';
  let eventId = metadata.event_id || metadata.eventId;
  let ticketId = metadata.ticket_id || metadata.ticketId || null;
  let quantity = parseQuantity(metadata.quantity, 1);

  if (!eventId && session.client_reference_id) {
    const parsed = parseClientReferenceId(session.client_reference_id);
    eventId = parsed.eventId;
    if (!ticketId) ticketId = parsed.ticketId;
    quantity = parsed.quantity;
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
    quantity,
    guestNames: metadata.guest_names || metadata.guestNames || null,
    dietaryRequirements: metadata.dietary_requirements || metadata.dietaryRequirements || null,
    accessibilityRequirements:
      metadata.accessibility_requirements || metadata.accessibilityRequirements || null,
    amountPaid: amountTotal,
    paymentStatus: amountTotal > 0 ? 'Paid' : 'Free',
    stripePaymentIntentId: paymentIntentId,
    stripeCheckoutSessionId: session.id,
    registrationId: metadata.registration_id || metadata.registrationId || null,
  });
}

module.exports = {
  createRegistrationFromPayment,
  handleCheckoutSessionCompleted,
  parseStripeEventBody,
  parseClientReferenceId,
  normalizeGuestNames,
  normalizeAttendeeExtraText,
  parseQuantity,
};
