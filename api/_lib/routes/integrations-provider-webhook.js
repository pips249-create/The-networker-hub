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
const {
  isEventbriteConnectivityPing,
  isEventbriteOrderNotification,
  resolveEventbriteWebhookRegistrations,
} = require('../eventbrite-webhook-resolve');
const { eventbritePrivateTokenFromConfig, ensureEventbriteAttendeeWebhook } = require('../connected-booking-providers/adapters/eventbrite-api');
const { buildProviderWebhookPublicUrl, webhookPublicSite } = require('../provider-webhook-url');

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

async function ingestProviderRegistration({
  sb,
  provider,
  connection,
  normalized,
}) {
  let targetEventId = null;

  if (provider === 'own_site') {
    targetEventId = String(normalized.tnhEventId || normalized.externalEventId || '').trim();
    if (!isUuid(targetEventId)) {
      return { status: 400, body: { ok: false, error: 'invalid_event_id' } };
    }
  } else {
    const link = await findEventLinkByExternal(
      sb,
      provider,
      normalized.externalEventId,
      connection.organiser_account_id
    );
    if (!link?.event_id) {
      await logExternalSync(sb, {
        organiser_account_id: connection.organiser_account_id,
        outcome: 'rejected',
        http_status: 404,
        message: provider + ':event_not_linked',
        external_order_id: normalized.orderId,
        payload: { externalEventId: normalized.externalEventId },
      });
      return {
        status: 404,
        body: {
          ok: false,
          error: 'event_not_linked',
          message:
            'No TNH event is linked to this ' +
            provider +
            ' event id. Link the event in Connected booking → Booking providers.',
        },
      };
    }

    if (link.organiser_account_id !== connection.organiser_account_id) {
      return { status: 403, body: { ok: false, error: 'link_account_mismatch' } };
    }
    targetEventId = link.event_id;
  }

  const { data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select('id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret')
    .eq('id', connection.organiser_account_id)
    .maybeSingle();
  if (accErr) {
    return { status: 500, body: { ok: false, error: 'account_lookup_failed' } };
  }

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
    return {
      status: 200,
      body: { ok: true, provider, eventId: targetEventId, ...result },
    };
  } catch (e) {
    const errCode = e.code || e.message || 'registration_failed';
    await logExternalSync(sb, {
      organiser_account_id: connection.organiser_account_id,
      event_id: targetEventId,
      external_order_id: normalized.orderId,
      outcome: 'rejected',
      http_status: e.status || 500,
      message: provider + ':' + errCode,
      payload: {
        provider,
        email: normalized.email,
        externalEventId: normalized.externalEventId,
        detail: e.message || undefined,
      },
    });
    return {
      status: e.status || 500,
      body: {
        ok: false,
        error: errCode,
        message: e.message || undefined,
      },
    };
  }
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

  if (provider === 'eventbrite') {
    try {
      const resolved = await resolveEventbriteWebhookRegistrations(body, connection);
      if (!resolved.registrations.length) {
        const normalized = normalizeProviderWebhook(provider, body);
        if (isEventbriteConnectivityPing(body, normalized)) {
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
          });
        }
        const message = isEventbriteOrderNotification(body)
          ? resolved.source === 'eventbrite_api'
            ? 'Eventbrite order had no attendee email we could read.'
            : 'Could not read Eventbrite order from this webhook.'
          : 'Could not read attendee details from this Eventbrite webhook.';
        await logExternalSync(sb, {
          organiser_account_id: connection.organiser_account_id,
          outcome: 'rejected',
          http_status: 400,
          message: 'eventbrite:unrecognized_payload',
          payload: { api_url: body.api_url, source: resolved.source },
        });
        return json(res, 400, { ok: false, error: 'unrecognized_payload', message });
      }

      const outcomes = [];
      for (const row of resolved.registrations) {
        const ingested = await ingestProviderRegistration({
          sb,
          provider,
          connection,
          normalized: row,
        });
        outcomes.push(ingested);
        if (ingested.status >= 400) {
          return json(res, ingested.status, ingested.body);
        }
      }

      if (!outcomes.length) {
        await logExternalSync(sb, {
          organiser_account_id: connection.organiser_account_id,
          outcome: 'rejected',
          http_status: 400,
          message: 'eventbrite:unrecognized_payload',
          payload: body,
        });
        return json(res, 400, {
          ok: false,
          error: 'unrecognized_payload',
          message: 'Could not read attendee details from this Eventbrite webhook.',
        });
      }

      try {
        const site = webhookPublicSite(process.env.SITE_URL || 'https://www.thenetworkeruk.com');
        const endpointUrl = buildProviderWebhookPublicUrl(site, 'eventbrite', connection.webhook_token);
        await ensureEventbriteAttendeeWebhook(
          eventbritePrivateTokenFromConfig(connection.config),
          endpointUrl
        );
      } catch {
        /* Buyer sync already succeeded. Attendee-update subscription is best-effort. */
      }

      return json(res, 200, {
        ok: true,
        provider,
        source: resolved.source,
        registrations: outcomes.map(function (o) {
          return o.body;
        }),
      });
    } catch (e) {
      const status = e.status || 502;
      await logExternalSync(sb, {
        organiser_account_id: connection.organiser_account_id,
        outcome: 'rejected',
        http_status: status,
        message: 'eventbrite:' + (e.message || 'order_fetch_failed'),
        payload: { api_url: body.api_url },
      });
      const tokenMissing = e.message === 'eventbrite_private_token_missing';
      return json(res, status, {
        ok: false,
        error: e.message || 'eventbrite_order_fetch_failed',
        message: tokenMissing
          ? 'Add your Eventbrite private token on Connected event setup — webhooks only send an order link, not buyer email.'
          : status === 401
            ? 'Eventbrite rejected the private token — paste a fresh token from Eventbrite → Account settings → Developer links.'
            : e.message || 'Could not load order from Eventbrite.',
      });
    }
  }

  const normalized = normalizeProviderWebhook(provider, body);
  if (
    provider === 'ticket_tailor' &&
    normalized &&
    !normalized.partial &&
    normalized.status === 'pending'
  ) {
    await logExternalSync(sb, {
      organiser_account_id: connection.organiser_account_id,
      outcome: 'accepted',
      http_status: 200,
      message: 'ticket_tailor:pending_ignored',
      external_order_id: normalized.orderId,
      payload: { externalEventId: normalized.externalEventId, webhookEvent: normalized.webhookEvent },
    });
    return json(res, 200, {
      ok: true,
      provider,
      ignored: true,
      reason: 'pending_order',
    });
  }
  if (!normalized || normalized.partial) {
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

  const ingested = await ingestProviderRegistration({
    sb,
    provider,
    connection,
    normalized,
  });
  return json(res, ingested.status, ingested.body);
};
