const { json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  connectedBookingOperationsEnabled,
  loadOrganiserAccountForOrganiserId,
  logExternalSync,
} = require('../connected-booking');
const {
  isConnectedBookingProviderId,
  normalizeProviderWebhook,
} = require('../connected-booking-providers');
const {
  findEventLinkByExternal,
  resolveConnectionByToken,
} = require('../connected-booking-provider-store');
const { ingestConnectedBookingRegistration } = require('../connected-booking-ingest');
const { isUuid } = require('../uuid');

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

function tokenFromRequest(req) {
  let q = req.query || {};
  if (!q.token && req.url) {
    try {
      q = Object.fromEntries(new URL(req.url, 'https://internal.local').searchParams);
    } catch {
      /* ignore */
    }
  }
  return String(
    q.token ||
      q.webhook_token ||
      req.headers['x-networker-provider-token'] ||
      req.headers['x-webhook-token'] ||
      ''
  ).trim();
}

/** POST /api/integrations/providers/:provider/webhook?token=... */
module.exports = async function handler(req, res, providerId) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Networker-Provider-Token, X-Webhook-Token'
  );
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const provider = String(providerId || '').trim().toLowerCase();
  if (!isConnectedBookingProviderId(provider) || provider === 'custom') {
    return json(res, 404, { ok: false, error: 'unknown_provider' });
  }

  if (!connectedBookingOperationsEnabled()) {
    return json(res, 503, { ok: false, error: 'connected_booking_disabled' });
  }
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const { body } = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }

  const sb = getSupabaseAdmin();
  const token = tokenFromRequest(req);
  const connection = await resolveConnectionByToken(sb, provider, token);
  if (!connection?.organiser_account_id) {
    await logExternalSync(sb, {
      outcome: 'rejected',
      http_status: 401,
      message: provider + ':invalid_webhook_token',
      payload: { provider },
    });
    return json(res, 401, { ok: false, error: 'invalid_webhook_token' });
  }

  const normalized = normalizeProviderWebhook(provider, body);
  if (!normalized || normalized.partial) {
    if (
      provider === 'eventbrite' &&
      body.api_url &&
      body.config &&
      typeof body.config === 'object'
    ) {
      await logExternalSync(sb, {
        organiser_account_id: connection.organiser_account_id,
        outcome: 'accepted',
        http_status: 200,
        message: 'eventbrite:webhook_ping',
        payload: { api_url: body.api_url, action: body.config.action || null },
      });
      return json(res, 200, {
        ok: true,
        provider,
        eventbrite_ping: true,
        message:
          'Webhook URL and token accepted. Real ticket orders still need your Eventbrite event id linked on The Networker UK.',
      });
    }
    await logExternalSync(sb, {
      organiser_account_id: connection.organiser_account_id,
      outcome: 'rejected',
      http_status: 400,
      message: provider + ':unrecognized_payload',
      payload: normalized || body,
    });
    return json(res, 400, {
      ok: false,
      error: 'unrecognized_payload',
      message: 'Could not read event id, order id, and email from provider payload.',
    });
  }

  let targetEventId = null;

  if (provider === 'own_site') {
    targetEventId = String(normalized.tnhEventId || normalized.externalEventId || '').trim();
    if (!isUuid(targetEventId)) {
      return json(res, 400, { ok: false, error: 'invalid_event_id' });
    }
  } else {
    const link = await findEventLinkByExternal(sb, provider, normalized.externalEventId);
    if (!link?.event_id) {
      await logExternalSync(sb, {
        organiser_account_id: connection.organiser_account_id,
        outcome: 'rejected',
        http_status: 404,
        message: provider + ':event_not_linked',
        external_order_id: normalized.orderId,
        payload: { externalEventId: normalized.externalEventId },
      });
      return json(res, 404, {
        ok: false,
        error: 'event_not_linked',
        message:
          'No TNH event is linked to this ' +
          provider +
          ' event id. Link the event in Connected booking → Booking providers.',
      });
    }

    if (link.organiser_account_id !== connection.organiser_account_id) {
      return json(res, 403, { ok: false, error: 'link_account_mismatch' });
    }
    targetEventId = link.event_id;
  }

  const { data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select('id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret')
    .eq('id', connection.organiser_account_id)
    .maybeSingle();
  if (accErr) return json(res, 500, { ok: false, error: 'account_lookup_failed' });

  try {
    const result = await ingestConnectedBookingRegistration({
      sb,
      account,
      eventId: targetEventId,
      body: normalized,
      logPayload: {
        provider,
        externalEventId: normalized.externalEventId,
        email: normalized.email,
      },
      providerLabel: provider,
    });
    return json(res, 200, { ok: true, provider, eventId: targetEventId, ...result });
  } catch (e) {
    await logExternalSync(sb, {
      organiser_account_id: connection.organiser_account_id,
      event_id: targetEventId,
      external_order_id: normalized.orderId,
      outcome: 'error',
      http_status: e.status || 500,
      message: provider + ':' + (e.message || String(e)),
      payload: normalized,
    });
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'registration_failed',
      message: e.message || undefined,
    });
  }
};
