/**
 * London Business Show stand QR: mark the signed-in member as having attended
 * the show (free registration, no ticket-purchase framing / confirmation email).
 */
const { setCors, json, sessionFromRequest } = require('../auth');
const { createRegistrationFromPayment } = require('../supabase-registrations');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { bookingErrorResponse } = require('../booking-error-messages');

const EVENT_SLUG = 'the-business-show-london';

function isFreeTicket(row) {
  if (!row) return false;
  const price = Number(row.price ?? NaN);
  if (Number.isFinite(price)) return price <= 0;
  const key = String(row.price_key || row.priceKey || '')
    .trim()
    .toLowerCase();
  if (key === 'free') return true;
  const label = String(row.price || '').trim().toLowerCase();
  return label === 'free';
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const session = sessionFromRequest(req);
  if (!session) {
    return json(res, 401, { ok: false, error: 'not_authenticated' });
  }

  const email = String(session.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return json(res, 400, { ok: false, error: 'missing_email' });
  }

  let name = String(session.name || '').trim();
  if (!name) {
    const local = email.split('@')[0] || '';
    name = local.replace(/[._-]+/g, ' ').trim() || 'Guest';
  }

  try {
    const sb = getSupabaseAdmin();
    const evRes = await sb
      .from('events')
      .select('id, title, slug, status, organiser_id')
      .eq('slug', EVENT_SLUG)
      .maybeSingle();
    if (evRes.error) throw new Error(evRes.error.message);
    const event = evRes.data;
    if (!event?.id) {
      return json(res, 404, { ok: false, error: 'event_not_found' });
    }

    const ticketsRes = await sb.from('tickets').select('id, price, price_key, sold_out').eq('event_id', event.id);
    if (ticketsRes.error) throw new Error(ticketsRes.error.message);
    const freeTicket = (ticketsRes.data || []).find((t) => isFreeTicket(t) && !t.sold_out) || null;
    if (!freeTicket?.id) {
      return json(res, 409, {
        ok: false,
        error: 'no_free_ticket',
        message: 'Attendance check-in is not open for this show yet.',
      });
    }

    const result = await createRegistrationFromPayment({
      email,
      name,
      userId: session.sub || null,
      eventId: event.id,
      ticketId: freeTicket.id,
      quantity: 1,
      amountPaid: 0,
      paymentStatus: 'Free',
      registrationKind: 'standard',
      skipConfirmationEmail: true,
    });

    return json(res, 200, {
      ok: true,
      attended: true,
      already: result.action === 'exists',
      registrationId: result.id,
      eventSlug: EVENT_SLUG,
      eventTitle: event.title || 'The Business Show London',
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg === 'already_going') {
      return json(res, 200, {
        ok: true,
        attended: true,
        already: true,
        eventSlug: EVENT_SLUG,
      });
    }
    const mapped = bookingErrorResponse(msg);
    if (mapped) return json(res, mapped.status, mapped.body);
    return json(res, 500, {
      ok: false,
      error: 'attend_failed',
      message: msg,
    });
  }
};
