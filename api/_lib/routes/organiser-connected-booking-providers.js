const { getOrganiserApi } = require('../organiser-provider');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { connectedBookingAllowedForSession } = require('../connected-booking');
const { CONNECTED_BOOKING_PROVIDERS } = require('../connected-booking-providers');
const {
  ensureProviderConnection,
  listProviderConnections,
  upsertEventLink,
  listEventLinksForAccount,
  deleteEventLink,
} = require('../connected-booking-provider-store');
const { resolveOrganiserAccountId } = require('../organiser-account-resolve');
const { buildProviderWebhookPublicUrl } = require('../provider-webhook-url');

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

/** GET/PATCH /api/organiser/connected-booking-providers */
module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!connectedBookingAllowedForSession(auth.session)) {
    return json(res, 403, {
      ok: false,
      error: 'preview_restricted',
      message: 'Connected booking preview is limited to approved organiser accounts.',
    });
  }
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();
  const { adminViewFromSession } = require('../organiser-api-scope');
  const { adminView } = adminViewFromSession(auth.session, req);

  try {
    const accountId = await resolveOrganiserAccountId(sb, auth.session, adminView);
    if (!accountId) {
      return json(res, 404, { ok: false, error: 'organiser_account_not_found' });
    }

    const site = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');

    if (req.method === 'GET') {
      const connResult = await listProviderConnections(sb, accountId);
      const linksResult = await listEventLinksForAccount(sb, accountId);
      const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();

      const providers = CONNECTED_BOOKING_PROVIDERS.map((p) => {
        const conn = (connResult.connections || []).find((c) => c.provider === p.id);
        const webhookUrl =
          p.id === 'custom'
            ? site + '/api/integrations/booking'
            : conn?.webhook_token
              ? buildProviderWebhookPublicUrl(site, p.id, conn.webhook_token) ||
                site + p.webhookPath + '?token=' + encodeURIComponent(conn.webhook_token)
              : null;
        return {
          id: p.id,
          label: p.label,
          status: p.status,
          connectionStatus: conn?.status || (p.id === 'custom' ? 'active' : 'not_configured'),
          webhookUrl,
          docsHint: p.docsHint,
        };
      });

      let eventLink = null;
      if (eventId) {
        eventLink = (linksResult.links || []).find((l) => l.event_id === eventId) || null;
      }

      return json(res, 200, {
        ok: true,
        providers,
        eventLinks: linksResult.links,
        eventLink,
        schemaMissing: connResult.schemaMissing || linksResult.schemaMissing,
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const action = String(body.action || '').trim();

      if (action === 'enable_provider') {
        const provider = String(body.provider || '').trim().toLowerCase();
        let conn = await ensureProviderConnection(sb, accountId, provider);
        if (String(conn.webhook_token || '').length > 32) {
          conn = await ensureProviderConnection(sb, accountId, provider, { rotateToken: true });
        }
        const webhookUrl =
          buildProviderWebhookPublicUrl(site, provider, conn.webhook_token) ||
          site +
            '/api/integrations/providers/' +
            provider +
            '/webhook?token=' +
            encodeURIComponent(conn.webhook_token);
        return json(res, 200, {
          ok: true,
          connection: {
            provider: conn.provider,
            status: conn.status,
            webhookUrl,
          },
        });
      }

      if (action === 'link_event') {
        const link = await upsertEventLink(sb, accountId, {
          eventId: body.eventId || body.event_id,
          provider: body.provider,
          externalEventId: body.externalEventId || body.external_event_id,
          externalEventUrl: body.externalEventUrl || body.external_event_url,
        });
        return json(res, 200, { ok: true, eventLink: link });
      }

      if (action === 'unlink_event') {
        const eventId = String(body.eventId || body.event_id || '').trim();
        if (!eventId) {
          return json(res, 400, { ok: false, error: 'missing_event_id' });
        }
        await deleteEventLink(sb, accountId, eventId);
        return json(res, 200, { ok: true });
      }

      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'connected_booking_providers_failed',
      message: e.message || undefined,
    });
  }
};
