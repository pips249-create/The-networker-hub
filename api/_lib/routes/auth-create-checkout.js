const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { calculateCheckoutTotals } = require('../booking-fees');
const { isStripeCheckoutConfigured, createPaidCheckoutSession } = require('../stripe-checkout');
const {
  connectRequiredForPaidCheckout,
  getOrganiserConnectForEvent,
  buildConnectCheckoutParams,
} = require('../stripe-connect');
const { normalizeGuestNames, createRegistrationFromPayment } = require('../supabase-registrations');
const { resolveTicketSalesEnabled } = require('../ticket-sales');
const { assertRefundPolicyForPaidCheckout } = require('../event-refund-policy');
const { isUuid } = require('../uuid');
const {
  isGuestVisitTicket,
  assertGuestVisitBookingAllowed,
  assertPaidMemberBookingAllowed,
} = require('../guest-visits');
const {
  isAlumniTicket,
  assertAlumniBookingAllowed,
} = require('../alumni-invites');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function availableTicketQty(sb, ticketId) {
  const tRes = await sb.from('tickets').select('id, quantity').eq('id', ticketId).maybeSingle();
  if (tRes.error) throw new Error(tRes.error.message);
  if (!tRes.data) return 0;
  if (tRes.data.quantity == null) return 99;

  const cap = Math.max(0, Number(tRes.data.quantity) || 0);
  const regRes = await sb
    .from('registrations')
    .select('quantity')
    .eq('ticket_id', ticketId)
    .neq('payment_status', 'Refunded')
    .neq('application_status', 'Denied');
  if (regRes.error) throw new Error(regRes.error.message);
  const sold = (regRes.data || []).reduce(
    (sum, row) => sum + Math.max(1, Number(row.quantity) || 1),
    0
  );
  return Math.max(0, cap - sold);
}

function buildClientReferenceId(eventId, ticketId, qty, label) {
  const ref =
    'id' +
    eventId +
    '-' +
    (ticketId ? 'ticket-' + ticketId + '-' : '') +
    'qty-' +
    String(qty) +
    '-' +
    String(label || 'ticket')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  return ref.slice(0, 200);
}

/** Create a Stripe Checkout session with ticket price + booking fee line items. */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const bodyEarly = parseBody(req);
  const checkoutEmail = String(bodyEarly.email || session?.email || '')
    .trim()
    .toLowerCase();
  const checkoutName = String(bodyEarly.name || session?.name || '').trim();

  if (!checkoutEmail) {
    return json(res, 400, { ok: false, error: 'missing_email' });
  }
  if (!checkoutName) {
    return json(res, 400, { ok: false, error: 'missing_name' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  try {
    const body = bodyEarly;
    const eventId = String(body.eventId || body.event_id || '').trim();
    if (!isUuid(eventId)) {
      return json(res, 400, { ok: false, error: 'invalid_event_id' });
    }

    const ticketIdRaw = body.ticketId || body.ticket_id || null;
    let ticketId = ticketIdRaw && isUuid(ticketIdRaw) ? String(ticketIdRaw) : null;
    const registrationIdRaw = body.registrationId || body.registration_id || null;
    const registrationId =
      registrationIdRaw && isUuid(registrationIdRaw) ? String(registrationIdRaw) : null;
    let requestedQty = parseInt(body.qty, 10);
    if (!Number.isFinite(requestedQty) || requestedQty < 1) requestedQty = 1;

    const sb = getSupabaseAdmin();
    const evRes = await sb
      .from('events')
      .select(
        'id, title, slug, status, approval_status, ticket_sales_enabled, organiser_id, attendance_mode, guest_passes_disabled, refund_policy, refund_policy_details, refund_terms_agreed, refund_terms_agreed_at, collect_dietary, collect_accessibility'
      )
      .eq('id', eventId)
      .maybeSingle();
    if (evRes.error) throw new Error(evRes.error.message);
    if (!evRes.data) return json(res, 404, { ok: false, error: 'event_not_found' });
    if (String(evRes.data.status || '').toLowerCase() !== 'published') {
      return json(res, 400, { ok: false, error: 'event_not_published' });
    }

    const { data: eventTickets, error: ticketsErr } = await sb
      .from('tickets')
      .select('*')
      .eq('event_id', eventId);
    if (ticketsErr) throw new Error(ticketsErr.message);

    if (!resolveTicketSalesEnabled(evRes.data, eventTickets || [])) {
      return json(res, 400, {
        ok: false,
        error: 'ticket_sales_disabled',
        message:
          'Ticket sales are not open for this event yet. Save the event to get notified when sales begin.',
      });
    }

    if (registrationId) {
      const regRes = await sb
        .from('registrations')
        .select('id, event_id, ticket_id, application_status, payment_status, attendee_id, attendees(email)')
        .eq('id', registrationId)
        .maybeSingle();
      if (regRes.error) throw new Error(regRes.error.message);
      const reg = regRes.data;
      if (!reg || reg.event_id !== eventId) {
        return json(res, 404, { ok: false, error: 'registration_not_found' });
      }
      const regEmail = String(reg.attendees?.email || '').trim().toLowerCase();
      if (regEmail && regEmail !== checkoutEmail) {
        return json(res, 403, { ok: false, error: 'registration_email_mismatch' });
      }
      if (String(reg.application_status || '').trim() !== 'Approved') {
        return json(res, 400, { ok: false, error: 'registration_not_approved' });
      }
      if (String(reg.payment_status || '').trim() === 'Paid') {
        return json(res, 400, { ok: false, error: 'registration_already_paid' });
      }
      if (!ticketId && reg.ticket_id) ticketId = reg.ticket_id;
      requestedQty = 1;
    }

    let ticketName = 'Ticket';
    let unitPrice = 0;
    let ticketRow = null;

    if (ticketId) {
      const tRes = await sb
        .from('tickets')
        .select('id, name, price, event_id, ticket_type')
        .eq('id', ticketId)
        .maybeSingle();
      if (tRes.error) throw new Error(tRes.error.message);
      if (!tRes.data || tRes.data.event_id !== eventId) {
        return json(res, 404, { ok: false, error: 'ticket_not_found' });
      }
      ticketRow = tRes.data;
      ticketName = String(tRes.data.name || ticketName).trim() || ticketName;
      unitPrice = parsePriceNum(tRes.data.price);
    } else {
      const tRes = await sb
        .from('tickets')
        .select('id, name, price, ticket_type')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (tRes.error) throw new Error(tRes.error.message);
      const paid = (tRes.data || []).find((t) => parsePriceNum(t.price) > 0);
      if (paid) {
        ticketId = paid.id;
        ticketRow = paid;
        ticketName = String(paid.name || ticketName).trim() || ticketName;
        unitPrice = parsePriceNum(paid.price);
      }
    }

    const isGuestVisit = Boolean(ticketRow && isGuestVisitTicket(ticketRow));
    const isAlumni = Boolean(ticketRow && isAlumniTicket(ticketRow));
    const alumniInviteToken = String(body.alumniInviteToken || body.alumni_invite_token || '').trim();
    if (isAlumni) {
      requestedQty = 1;
    }
    if (isGuestVisit) {
      unitPrice = 0;
      requestedQty = 1;
    }

    const dietaryRequirements = String(body.dietaryRequirements || body.dietary_requirements || '')
      .trim()
      .slice(0, 500);
    const accessibilityRequirements = String(
      body.accessibilityRequirements || body.accessibility_requirements || ''
    )
      .trim()
      .slice(0, 500);

    if (unitPrice <= 0) {
      if (isGuestVisit || isAlumni || registrationId) {
        const qty = isGuestVisit || isAlumni ? 1 : requestedQty;
        const guestNames = normalizeGuestNames(body.guestNames || body.guest_names, qty);
        if (isGuestVisit) {
          if (evRes.data.guest_passes_disabled) {
            return json(res, 400, {
              ok: false,
              error: 'guest_passes_disabled',
              message: 'Guest passes are not available for this event.',
            });
          }
          try {
            await assertGuestVisitBookingAllowed(sb, {
              organiserId: evRes.data.organiser_id,
              attendeeId: session?.sub || null,
              email: checkoutEmail,
              guestPassesDisabled: evRes.data.guest_passes_disabled,
            });
          } catch (guestErr) {
            const code = guestErr.message || 'guest_visit_not_allowed';
            const messages = {
              guest_visits_not_enabled: 'Guest visits are not available for this organiser.',
              guest_visits_exhausted:
                'You have used all complimentary visits with this organiser. Book a member ticket instead.',
              guest_passes_disabled: 'Guest passes are not available for this event.',
            };
            return json(res, guestErr.status || 400, {
              ok: false,
              error: code,
              message: messages[code] || guestErr.message,
            });
          }
        }
        if (isAlumni) {
          try {
            await assertAlumniBookingAllowed(sb, {
              eventId,
              attendeeId: session?.sub || null,
              email: checkoutEmail,
              inviteToken: alumniInviteToken,
            });
          } catch (alumniErr) {
            const code = alumniErr.message || 'alumni_not_eligible';
            const messages = {
              alumni_not_eligible: 'This alumni ticket is invite-only. Use the link from your email.',
              not_invited: 'This alumni ticket is invite-only. Use the link from your email.',
              email_mismatch: 'Sign in with the email address that received the alumni invite.',
            };
            return json(res, alumniErr.status || 403, {
              ok: false,
              error: code,
              message: messages[code] || alumniErr.message,
            });
          }
        }
        const result = await createRegistrationFromPayment({
          email: checkoutEmail,
          name: checkoutName,
          userId: session?.sub || null,
          eventId,
          ticketId,
          registrationId,
          quantity: qty,
          guestNames,
          dietaryRequirements,
          accessibilityRequirements,
          amountPaid: 0,
          paymentStatus: 'Free',
          registrationKind: isGuestVisit ? 'guest_visit' : isAlumni ? 'alumni' : undefined,
          alumniInviteToken: isAlumni ? alumniInviteToken : undefined,
        });
        return json(res, 200, {
          ok: true,
          completed: true,
          registrationId: result.id,
          action: result.action,
        });
      }
      return json(res, 400, {
        ok: false,
        error: 'free_ticket_use_complete_booking',
        message: 'This is a free ticket — no payment is required.',
      });
    }

    if (!isAlumni) {
      try {
        await assertPaidMemberBookingAllowed(sb, {
          organiserId: evRes.data.organiser_id,
          attendeeId: session?.sub || null,
          email: checkoutEmail,
          attendanceMode: evRes.data.attendance_mode,
          guestPassesDisabled: evRes.data.guest_passes_disabled,
        });
      } catch (guestErr) {
        const code = guestErr.message || 'guest_visits_remaining';
        return json(res, guestErr.status || 400, {
          ok: false,
          error: code,
          message:
            'Use your complimentary guest visit before booking a paid member ticket with this organiser.',
          eligibility: guestErr.eligibility || null,
        });
      }
    }

    try {
      assertRefundPolicyForPaidCheckout(evRes.data);
    } catch (refundErr) {
      return json(res, refundErr.status || 400, {
        ok: false,
        error: refundErr.code || 'refund_policy_required',
        message: refundErr.message,
      });
    }

    if (isAlumni) {
      try {
        await assertAlumniBookingAllowed(sb, {
          eventId,
          attendeeId: session?.sub || null,
          email: checkoutEmail,
          inviteToken: alumniInviteToken,
        });
      } catch (alumniErr) {
        const code = alumniErr.message || 'alumni_not_eligible';
        return json(res, alumniErr.status || 403, {
          ok: false,
          error: code,
          message:
            code === 'email_mismatch'
              ? 'Sign in with the email address that received the alumni invite.'
              : 'This alumni ticket is invite-only. Use the link from your email.',
        });
      }
      requestedQty = 1;
    }

    let maxQty = 99;
    if (ticketId) {
      maxQty = await availableTicketQty(sb, ticketId);
      if (maxQty < 1) {
        return json(res, 400, { ok: false, error: 'ticket_sold_out' });
      }
    }

    const totals = calculateCheckoutTotals(unitPrice, requestedQty, maxQty);
    const qty = totals.qty;
    const guestNames = normalizeGuestNames(body.guestNames || body.guest_names, qty);
    if (qty > 1 && guestNames.length < qty - 1) {
      return json(res, 400, { ok: false, error: 'missing_guest_names' });
    }
    const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(
      /\/$/,
      ''
    );
    const slug = String(evRes.data.slug || '').trim();
    const cancelPath = slug ? `/events/${encodeURIComponent(slug)}` : `/events/event.html?id=${eventId}`;

    let paymentIntentData = null;
    if (connectRequiredForPaidCheckout()) {
      const connect = await getOrganiserConnectForEvent(sb, eventId);
      if (!connect?.ready) {
        return json(res, 400, {
          ok: false,
          error: 'stripe_connect_required',
          message:
            'This organiser has not finished Stripe Connect setup. Ticket sales are temporarily unavailable.',
        });
      }
      const ticketSubtotalPence = Math.round(unitPrice * 100) * qty;
      const bookingFeePence = Math.round(totals.fee * 100);
      const connectParams = buildConnectCheckoutParams({
        connect,
        ticketSubtotalPence,
        bookingFeePence,
      });
      paymentIntentData = connectParams?.paymentIntentData || null;
    }

    const checkoutSession = await createPaidCheckoutSession({
      email: checkoutEmail,
      name: checkoutName,
      guestNames,
      dietaryRequirements,
      accessibilityRequirements,
      alumniInviteToken: isAlumni ? alumniInviteToken : '',
      eventId,
      ticketId,
      registrationId,
      qty,
      eventTitle: evRes.data.title,
      ticketName,
      unitPricePounds: unitPrice,
      bookingFeePounds: totals.fee,
      successUrl: `${siteUrl}/events/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}${cancelPath}`,
      clientReferenceId: buildClientReferenceId(eventId, ticketId, qty, ticketName),
      paymentIntentData,
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      totals,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'checkout_failed',
      message: e.message || String(e),
    });
  }
};
