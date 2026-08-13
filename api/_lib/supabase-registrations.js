const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId } = require('./supabase-favourites');
const { sendRegistrationEmails } = require('./registration-emails');
const { UUID_PATTERN } = require('./uuid');
const { lockEventOnFirstSale } = require('./event-sale-lock');
const { buildBookingSnapshotForRegistration } = require('./booking-snapshot');
const {
  isGuestVisitTicket,
  assertGuestVisitBookingAllowed,
  assertPaidMemberBookingAllowed,
} = require('./guest-visits');
const {
  isAlumniTicket,
  assertAlumniBookingAllowed,
  markInviteRedeemed,
} = require('./alumni-invites');
const { isMembersOnlyTicket } = require('./ticket-visibility');
const {
  assertMembersOnlyBookingAllowed,
  getActiveRosterMembership,
} = require('./organiser-member-roster');
const { assertNotBlockedByOrganiser } = require('./organiser-attendee-blocks');
const { parseBundleMetadata, newBookingGroupId } = require('./series-bundle-checkout');
const { requiresApprovedApplication } = require('./category-exclusivity');
const {
  assertCeMemberBookingAllowed,
  markCeMemberInviteRedeemed,
  assertCeMemberSeatAvailable,
} = require('./ce-member-invites');
const { assertEventHasCapacity, rethrowIfCapacityExceeded } = require('./event-capacity');

/**
 * Insert a registration after successful checkout.
 * Idempotent when stripePaymentIntentId or stripeCheckoutSessionId is supplied.
 */
async function createRegistrationFromPayment(input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const sb = getSupabaseAdmin();
  let eventId = String(input.eventId || input.event_id || '').trim();
  const linkedRegistrationIdEarly = String(
    input.registrationId || input.registration_id || ''
  ).trim();

  const stripePaymentIntentId = input.stripePaymentIntentId || input.stripe_payment_intent_id || null;
  const stripeCheckoutSessionId =
    input.stripeCheckoutSessionId || input.stripe_checkout_session_id || null;

  if (!eventId && linkedRegistrationIdEarly) {
    const linkedEventRes = await sb
      .from('registrations')
      .select('event_id')
      .eq('id', linkedRegistrationIdEarly)
      .maybeSingle();
    if (linkedEventRes.error) throw new Error(linkedEventRes.error.message);
    eventId = String(linkedEventRes.data?.event_id || '').trim();
  }

  if (!eventId) throw new Error('missing_event_id');

  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('missing_email');

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

    await assertNotBlockedByOrganiser(sb, {
      organiserId: linked.organiser_id,
      email,
      attendeeId: linked.attendee_id,
    });

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
    const completingBooking =
      paymentStatus === 'Paid' || paymentStatus === 'Free' || Number(patch.amount_paid) > 0;
    if (completingBooking || !linked.booked_snapshot) {
      const bookedSnapshot = await buildBookingSnapshotForRegistration(sb, {
        eventId,
        ticketId: linked.ticket_id,
        quantity: linked.quantity,
        amountPaid: patch.amount_paid,
        paymentStatus: patch.payment_status,
      });
      if (bookedSnapshot) patch.booked_snapshot = bookedSnapshot;
    }
    const upd = await sb.from('registrations').update(patch).eq('id', linked.id).select('*').single();
    if (upd.error) throw new Error(upd.error.message);

    let emailResult = null;
    try {
      emailResult = await sendRegistrationEmails(sb, upd.data);
    } catch (e) {
      emailResult = { error: e.message || String(e) };
    }

    await lockEventOnFirstSale(sb, eventId);

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

  const existingReg = await sb
    .from('registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .is('cancelled_at', null)
    .neq('application_status', 'Denied')
    .limit(1)
    .maybeSingle();
  if (existingReg.error) throw new Error(existingReg.error.message);
  if (existingReg.data?.id) {
    const err = new Error('already_going');
    err.status = 400;
    throw err;
  }

  let organiserId = input.organiserId || input.organiser_id || null;
  if (!organiserId) {
    const ev = await sb.from('events').select('organiser_id').eq('id', eventId).maybeSingle();
    if (ev.error) throw new Error(ev.error.message);
    organiserId = ev.data?.organiser_id || null;
  }

  const ticketId = input.ticketId || input.ticket_id || null;
  const quantity = parseQuantity(input.quantity ?? input.qty, 1);

  await assertEventHasCapacity(sb, eventId, quantity);

  let eventAttendanceMode = 'tickets';
  const evMetaRes = await sb
    .from('events')
    .select('attendance_mode, organiser_id, guest_passes_disabled')
    .eq('id', eventId)
    .maybeSingle();
  if (evMetaRes.error) throw new Error(evMetaRes.error.message);
  if (evMetaRes.data) {
    eventAttendanceMode = evMetaRes.data.attendance_mode || 'tickets';
    if (!organiserId) organiserId = evMetaRes.data.organiser_id || null;
  }
  if (!organiserId) {
    const err = new Error('missing_organiser');
    err.status = 400;
    err.code = 'missing_organiser';
    throw err;
  }
  await assertNotBlockedByOrganiser(sb, {
    organiserId,
    email,
    attendeeId: null,
  });
  const guestPassesDisabled = Boolean(evMetaRes.data?.guest_passes_disabled);

  let ticketRow = null;
  if (ticketId) {
    const ticketRes = await sb.from('tickets').select('*').eq('id', ticketId).maybeSingle();
    if (ticketRes.error) throw new Error(ticketRes.error.message);
    ticketRow = ticketRes.data || null;
  }

  let registrationKind = String(input.registrationKind || input.registration_kind || '').trim();
  if (!registrationKind) {
    if (ticketRow && isGuestVisitTicket(ticketRow)) registrationKind = 'guest_visit';
    else if (ticketRow && isAlumniTicket(ticketRow)) registrationKind = 'alumni';
    else if (ticketRow && String(ticketRow.ticket_type || '').includes('Application')) {
      registrationKind = 'application';
    } else {
      registrationKind = 'standard';
    }
  }

  const ceMemberToken = String(input.ceMemberToken || input.ce_member_token || '').trim();
  const ceMemberDirectBook = Boolean(
    input.ceMemberDirectBook || input.ce_member_direct_book
  );
  let ceMemberEligibility = null;
  const needsApplication =
    requiresApprovedApplication({ attendance_mode: eventAttendanceMode }, ticketRow) ||
    registrationKind === 'application';

  if (needsApplication) {
    try {
      ceMemberEligibility = await assertCeMemberBookingAllowed(sb, {
        event: { id: eventId, attendance_mode: eventAttendanceMode, organiser_id: organiserId },
        organiserId,
        email,
        attendeeId,
        userId: attendeeId,
        token: ceMemberToken || null,
      });
      if (ticketRow) await assertCeMemberSeatAvailable(sb, ticketRow);
      registrationKind = 'application';
    } catch (ceErr) {
      const soft =
        ceErr.code === 'not_member' ||
        ceErr.message === 'not_member' ||
        ceErr.code === 'not_ce_event' ||
        ceErr.message === 'not_ce_event' ||
        ceErr.code === 'membership_inactive' ||
        ceErr.message === 'membership_inactive';
      if (soft) {
        const err = new Error('application_required');
        err.status = 400;
        throw err;
      }
      throw ceErr;
    }
  }

  const alumniInviteToken = String(input.alumniInviteToken || input.alumni_invite_token || '').trim();
  let alumniEligibility = null;

  const amountPaid =
    input.amountPaid != null
      ? Number(input.amountPaid)
      : input.amount_paid != null
        ? Number(input.amount_paid)
        : 0;
  const paymentStatus = input.paymentStatus || input.payment_status || (amountPaid > 0 ? 'Paid' : 'Free');

  if (registrationKind === 'guest_visit') {
    if (guestPassesDisabled) throw new Error('guest_passes_disabled');
    if (quantity !== 1) throw new Error('guest_visit_single_seat_only');
    if (amountPaid > 0) throw new Error('guest_visit_must_be_free');
    await assertGuestVisitBookingAllowed(sb, {
      organiserId,
      attendeeId,
      email,
      guestPassesDisabled,
    });
  } else if (registrationKind === 'alumni') {
    if (quantity !== 1) throw new Error('alumni_single_seat_only');
    alumniEligibility = await assertAlumniBookingAllowed(sb, {
      eventId,
      email,
      attendeeId,
      inviteToken: alumniInviteToken,
    });
  } else if (ticketRow && isMembersOnlyTicket(ticketRow)) {
    await assertMembersOnlyBookingAllowed(sb, { organiserId, email, attendeeId, userId: attendeeId });
  } else if (amountPaid > 0 || String(paymentStatus).trim() === 'Paid') {
    const rosterMembership = await getActiveRosterMembership(sb, {
      organiserId,
      email,
      attendeeId,
      userId: attendeeId,
    });
    if (!rosterMembership.active) {
      await assertPaidMemberBookingAllowed(sb, {
        organiserId,
        attendeeId,
        email,
        attendanceMode: eventAttendanceMode,
        guestPassesDisabled,
      });
    }
  }

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

  const bookedSnapshot = await buildBookingSnapshotForRegistration(sb, {
    eventId,
    ticketId,
    quantity,
    amountPaid,
    paymentStatus,
  });

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
    registration_kind: registrationKind,
    booked_snapshot: bookedSnapshot,
  };
  const bookingGroupId = String(input.bookingGroupId || input.booking_group_id || '').trim();
  if (bookingGroupId) row.booking_group_id = bookingGroupId;

  const ins = await sb.from('registrations').insert(row).select('*').single();
  if (ins.error) {
    rethrowIfCapacityExceeded(ins.error);
    throw new Error(ins.error.message);
  }

  if (registrationKind === 'alumni' && alumniEligibility?.invite?.id) {
    await markInviteRedeemed(sb, {
      inviteId: alumniEligibility.invite.id,
      registrationId: ins.data.id,
    });
  }

  if (ceMemberEligibility?.invite?.id) {
    try {
      await markCeMemberInviteRedeemed(sb, {
        inviteId: ceMemberEligibility.invite.id,
        registrationId: ins.data.id,
      });
    } catch (_) {
      /* non-fatal */
    }
  }

  await lockEventOnFirstSale(sb, eventId);

  let emailResult = null;
  if (!input.skipConfirmationEmail && !input.skip_confirmation_email) {
    try {
      emailResult = await sendRegistrationEmails(sb, ins.data);
    } catch (e) {
      emailResult = { error: e.message || String(e) };
    }
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

/**
 * One checkout → registrations on each date in a series bundle.
 */
async function createSeriesBundleFromPayment(input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const sb = getSupabaseAdmin();
  const stripeCheckoutSessionId =
    input.stripeCheckoutSessionId || input.stripe_checkout_session_id || null;
  const bundleItems = Array.isArray(input.bundleItems) ? input.bundleItems : [];
  if (!bundleItems.length) throw new Error('missing_bundle_items');

  if (stripeCheckoutSessionId) {
    const existingSession = await sb
      .from('registrations')
      .select('id, booking_group_id')
      .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
      .maybeSingle();
    if (existingSession.error) throw new Error(existingSession.error.message);
    if (existingSession.data?.id) {
      const groupId = existingSession.data.booking_group_id;
      let siblings = [existingSession.data];
      if (groupId) {
        const groupRes = await sb
          .from('registrations')
          .select('id, event_id, ticket_id, amount_paid, ticket_email_sent')
          .eq('booking_group_id', groupId);
        if (groupRes.error) throw new Error(groupRes.error.message);
        siblings = groupRes.data || siblings;
      }
      return {
        action: 'exists',
        id: existingSession.data.id,
        registrationIds: siblings.map((row) => row.id),
        bundleCount: siblings.length,
      };
    }
  }

  const bookingGroupId = String(input.bookingGroupId || input.booking_group_id || '').trim() || newBookingGroupId();
  const amountTotal =
    input.amountPaid != null
      ? Number(input.amountPaid)
      : input.amount_paid != null
        ? Number(input.amount_paid)
        : 0;
  const paymentStatus = input.paymentStatus || input.payment_status || (amountTotal > 0 ? 'Paid' : 'Free');

  const registrationKind =
    String(input.registrationKind || input.registration_kind || 'series_bundle').trim() ||
    'series_bundle';

  const created = [];
  for (let i = 0; i < bundleItems.length; i++) {
    const item = bundleItems[i];
    const isPrimary = i === 0;
    const result = await createRegistrationFromPayment({
      email: input.email,
      name: input.name,
      userId: input.userId,
      eventId: item.eventId,
      ticketId: item.ticketId,
      quantity: 1,
      guestNames: input.guestNames,
      dietaryRequirements: input.dietaryRequirements,
      accessibilityRequirements: input.accessibilityRequirements,
      amountPaid: isPrimary ? amountTotal : 0,
      paymentStatus,
      stripePaymentIntentId: isPrimary ? input.stripePaymentIntentId || input.stripe_payment_intent_id : null,
      stripeCheckoutSessionId: isPrimary ? stripeCheckoutSessionId : null,
      registrationKind,
      bookingGroupId,
      skipConfirmationEmail: true,
    });
    created.push(result.registration || { id: result.id });
  }

  let emailResult = null;
  try {
    const { sendSeriesBundleConfirmation } = require('./registration-emails');
    emailResult = await sendSeriesBundleConfirmation(sb, {
      primaryRegistration: created[0],
      bundleRegistrations: created,
    });
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return {
    action: 'created',
    id: created[0]?.id,
    registrationIds: created.map((row) => row.id).filter(Boolean),
    bundleCount: created.length,
    bookingGroupId,
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
  if (
    metadata.checkout_type === 'event_featured' ||
    metadata.checkout_type === 'opportunity_premium' ||
    metadata.checkout_type === 'opportunity_listing' ||
    metadata.checkout_type === 'group_update_credits'
  ) {
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

  if (String(metadata.checkout_type || '').trim() === 'series_pass') {
    const bundleItems = parseBundleMetadata(metadata);
    if (!bundleItems.length) {
      return { skipped: true, reason: 'missing_bundle_metadata' };
    }
    return createSeriesBundleFromPayment({
      email: customerEmail,
      name: session.customer_details?.name || metadata.attendee_name || null,
      bundleItems,
      guestNames: metadata.guest_names || metadata.guestNames || null,
      dietaryRequirements: metadata.dietary_requirements || metadata.dietaryRequirements || null,
      accessibilityRequirements:
        metadata.accessibility_requirements || metadata.accessibilityRequirements || null,
      amountPaid: amountTotal,
      paymentStatus: amountTotal > 0 ? 'Paid' : 'Free',
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
      registrationKind: 'series_pass',
    });
  }

  if (String(metadata.checkout_type || '').trim() === 'series_bundle') {
    const bundleItems = parseBundleMetadata(metadata);
    if (!bundleItems.length) {
      return { skipped: true, reason: 'missing_bundle_metadata' };
    }
    return createSeriesBundleFromPayment({
      email: customerEmail,
      name: session.customer_details?.name || metadata.attendee_name || null,
      bundleItems,
      guestNames: metadata.guest_names || metadata.guestNames || null,
      dietaryRequirements: metadata.dietary_requirements || metadata.dietaryRequirements || null,
      accessibilityRequirements:
        metadata.accessibility_requirements || metadata.accessibilityRequirements || null,
      amountPaid: amountTotal,
      paymentStatus: amountTotal > 0 ? 'Paid' : 'Free',
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: session.id,
    });
  }

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
    alumniInviteToken: metadata.alumni_invite_token || metadata.alumniInviteToken || null,
    ceMemberToken: metadata.ce_member_token || metadata.ceMemberToken || null,
    ceMemberDirectBook:
      metadata.ce_member_direct_book === '1' || metadata.ceMemberDirectBook === '1',
  });
}

module.exports = {
  createRegistrationFromPayment,
  createSeriesBundleFromPayment,
  handleCheckoutSessionCompleted,
  parseStripeEventBody,
  parseClientReferenceId,
  normalizeGuestNames,
  normalizeAttendeeExtraText,
  parseQuantity,
};
