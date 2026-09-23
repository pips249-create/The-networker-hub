const { json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  connectedBookingOperationsEnabled,
  connectedBookingAllowedForOrganiserAccountId,
  verifyWebhookSignature,
  loadOrganiserAccountForOrganiserId,
  isConnectedPlanActive,
  logExternalSync,
} = require('../connected-booking');
const { createRegistrationFromExternalBooking } = require('../external-booking-registrations');

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body), 'utf8');
  return Buffer.from('', 'utf8');
}

function parseJsonBody(req) {
  const raw = readRawBody(req);
  try {
    return { raw, body: JSON.parse(raw.toString('utf8') || '{}') };
  } catch {
    return { raw, body: null };
  }
}

/** POST /api/integrations/booking — real-time external registration sync (HMAC). */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Networker-Signature, X-Organiser-Account-Id');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!connectedBookingOperationsEnabled()) {
    return json(res, 503, { ok: false, error: 'connected_booking_disabled' });
  }
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const { raw, body } = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }

  const accountId = String(
    req.headers['x-organiser-account-id'] || body.organiserAccountId || body.organiser_account_id || ''
  ).trim();
  const eventId = String(body.eventId || body.event_id || '').trim();
  const signature = req.headers['x-networker-signature'] || body.signature || '';

  const sb = getSupabaseAdmin();
  let account = null;
  if (accountId && isUuid(accountId)) {
    const accRes = await sb
      .from('organiser_accounts')
      .select(
        'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
      )
      .eq('id', accountId)
      .maybeSingle();
    if (accRes.error) return json(res, 500, { ok: false, error: 'account_lookup_failed' });
    account = accRes.data;
  }

  if (!account && eventId && isUuid(eventId)) {
    const evRes = await sb.from('events').select('organiser_id').eq('id', eventId).maybeSingle();
    if (evRes.error) return json(res, 500, { ok: false, error: 'event_lookup_failed' });
    if (evRes.data?.organiser_id) {
      account = await loadOrganiserAccountForOrganiserId(sb, evRes.data.organiser_id);
    }
  }

  if (!account?.id) {
    await logExternalSync(sb, {
      outcome: 'rejected',
      http_status: 401,
      message: 'unknown_account',
      event_id: eventId || null,
      external_order_id: String(body.orderId || body.order_id || ''),
      payload: { eventId },
    });
    return json(res, 401, { ok: false, error: 'unknown_account' });
  }

  const accountAllowed = await connectedBookingAllowedForOrganiserAccountId(sb, account.id);
  if (!accountAllowed) {
    await logExternalSync(sb, {
      organiser_account_id: account.id,
      event_id: eventId || null,
      outcome: 'rejected',
      http_status: 403,
      message: 'preview_not_allowed',
      external_order_id: String(body.orderId || body.order_id || ''),
      payload: { eventId },
    });
    return json(res, 403, { ok: false, error: 'connected_booking_disabled' });
  }

  if (!isConnectedPlanActive(account)) {
    await logExternalSync(sb, {
      organiser_account_id: account.id,
      event_id: eventId || null,
      outcome: 'rejected',
      http_status: 403,
      message: 'plan_inactive',
      external_order_id: String(body.orderId || body.order_id || ''),
      payload: { eventId },
    });
    return json(res, 403, { ok: false, error: 'connected_booking_inactive' });
  }

  const secret = String(account.connected_booking_webhook_secret || '').trim();
  if (!secret || !verifyWebhookSignature(secret, raw, signature)) {
    await logExternalSync(sb, {
      organiser_account_id: account.id,
      event_id: eventId || null,
      outcome: 'rejected',
      http_status: 401,
      message: 'invalid_signature',
      external_order_id: String(body.orderId || body.order_id || ''),
      payload: { eventId },
    });
    return json(res, 401, { ok: false, error: 'invalid_signature' });
  }

  if (!isUuid(eventId)) {
    return json(res, 400, { ok: false, error: 'invalid_event_id' });
  }

  const evOwn = await sb.from('events').select('organiser_id').eq('id', eventId).maybeSingle();
  if (evOwn.error) return json(res, 500, { ok: false, error: 'event_lookup_failed' });
  const ownerAccount = await loadOrganiserAccountForOrganiserId(sb, evOwn.data?.organiser_id);
  if (!ownerAccount || ownerAccount.id !== account.id) {
    await logExternalSync(sb, {
      organiser_account_id: account.id,
      organiser_id: evOwn.data?.organiser_id || null,
      event_id: eventId,
      outcome: 'rejected',
      http_status: 403,
      message: 'event_not_on_account',
      external_order_id: String(body.orderId || body.order_id || ''),
      payload: body,
    });
    return json(res, 403, { ok: false, error: 'event_not_on_account' });
  }

  try {
    const result = await createRegistrationFromExternalBooking({
      eventId,
      orderId: body.orderId || body.order_id,
      email: body.email,
      name: body.name,
      quantity: body.quantity ?? body.qty,
      amountPaid: body.amountPaid ?? body.amount_paid,
      paymentStatus: body.paymentStatus || body.payment_status,
      status: body.status,
    });

    await logExternalSync(sb, {
      organiser_account_id: account.id,
      organiser_id: evOwn.data?.organiser_id || null,
      event_id: eventId,
      external_order_id: String(body.orderId || body.order_id || ''),
      outcome: result.action === 'duplicate' ? 'duplicate' : 'accepted',
      http_status: 200,
      message: result.action,
      payload: { email: body.email, status: body.status },
    });

    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    await logExternalSync(sb, {
      organiser_account_id: account.id,
      organiser_id: evOwn.data?.organiser_id || null,
      event_id: eventId,
      external_order_id: String(body.orderId || body.order_id || ''),
      outcome: 'error',
      http_status: e.status || 500,
      message: e.message || String(e),
      payload: body,
    });
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'registration_failed',
      message: e.message || undefined,
    });
  }
};
