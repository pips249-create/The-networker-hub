const { getOrganiserApi } = require('../organiser-provider');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { connectedBookingAllowedForSession } = require('../connected-booking');
const {
  CONNECTED_BOOKING_PROVIDERS,
  isOrganiserPickerProvider,
  listOrganiserPickerProviders,
} = require('../connected-booking-providers');
const {
  ensureProviderConnection,
  listProviderConnections,
  upsertEventLink,
  listEventLinksForAccount,
  deleteEventLink,
  mergeProviderConnectionConfig,
} = require('../connected-booking-provider-store');
const { eventbritePrivateTokenFromConfig } = require('../connected-booking-providers/adapters/eventbrite-api');
const { ticketTailorApiKeyFromConfig } = require('../connected-booking-providers/adapters/ticket-tailor-api');
const { importEventbriteListingForEvent } = require('../eventbrite-listing-import');
const { importTicketTailorListingForEvent } = require('../ticket-tailor-listing-import');
const { resolveOrganiserAccountId } = require('../organiser-account-resolve');
const {
  buildProviderWebhookPublicUrl,
  eventbriteWebhookNeedsTokenRotation,
  webhookPublicSite,
} = require('../provider-webhook-url');
const { validateProviderExternalEventId } = require('../connected-booking-util');

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
    const webhookSite = webhookPublicSite(site);

    if (req.method === 'GET') {
      const connResult = await listProviderConnections(sb, accountId);
      const linksResult = await listEventLinksForAccount(sb, accountId);
      const eventId = String(req.query?.eventId || req.query?.event_id || '').trim();

      const providers = await Promise.all(
        listOrganiserPickerProviders().map(async (p) => {
        const conn = (connResult.connections || []).find((c) => c.provider === p.id);
        const webhookUrl =
          p.id === 'custom'
            ? site + '/api/integrations/booking'
            : conn?.webhook_token
              ? buildProviderWebhookPublicUrl(webhookSite, p.id, conn.webhook_token) ||
                site + p.webhookPath + '?token=' + encodeURIComponent(conn.webhook_token)
              : null;
        return {
          id: p.id,
          label: p.label,
          status: p.status,
          connectionStatus: conn?.status || (p.id === 'custom' ? 'active' : 'not_configured'),
          webhookUrl,
          docsHint: p.docsHint,
          eventbriteApiTokenConfigured:
            p.id === 'eventbrite' && conn
              ? Boolean(eventbritePrivateTokenFromConfig(conn.config))
              : undefined,
          ticketTailorApiKeyConfigured:
            p.id === 'ticket_tailor' && conn
              ? Boolean(ticketTailorApiKeyFromConfig(conn.config))
              : undefined,
          eventbriteWebhookNeedsFix:
            p.id === 'eventbrite' && conn?.webhook_token
              ? eventbriteWebhookNeedsTokenRotation(site, conn.webhook_token)
              : undefined,
        };
      })
      );

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
        if (!isOrganiserPickerProvider(provider)) {
          return json(res, 400, {
            ok: false,
            error: 'provider_not_available',
            message: 'That booking provider is not available. Use Eventbrite, Ticket Tailor, or your own website.',
          });
        }
        let conn = await ensureProviderConnection(sb, accountId, provider);
        if (eventbriteWebhookNeedsTokenRotation(site, conn.webhook_token)) {
          conn = await ensureProviderConnection(sb, accountId, provider, { rotateToken: true });
        }
        const webhookUrl =
          buildProviderWebhookPublicUrl(webhookSite, provider, conn.webhook_token) ||
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
        const eventId = String(body.eventId || body.event_id || '').trim();
        const provider = String(body.provider || '').trim().toLowerCase();
        if (!isOrganiserPickerProvider(provider)) {
          return json(res, 400, {
            ok: false,
            error: 'provider_not_available',
            message: 'That booking provider is not available. Use Eventbrite, Ticket Tailor, or your own website.',
          });
        }
        const externalEventId = String(body.externalEventId || body.external_event_id || '').trim();
        const idCheck = validateProviderExternalEventId(provider, externalEventId);
        if (!idCheck.ok) {
          return json(res, 400, {
            ok: false,
            error: idCheck.error || 'invalid_external_event_id',
            message: idCheck.message,
          });
        }
        const link = await upsertEventLink(sb, accountId, {
          eventId,
          provider,
          externalEventId,
          externalEventUrl: body.externalEventUrl || body.external_event_url,
        });
        const importListing =
          body.importListing === true ||
          body.import_listing === true ||
          body.syncListingFromEventbrite === true ||
          body.syncListingFromTicketTailor === true;
        if (importListing && (provider === 'eventbrite' || provider === 'ticket_tailor') && eventId) {
          const { assertOrganiserOwnsEvent } = require('../supabase-organiser-alumni-invites');
          await assertOrganiserOwnsEvent(auth.session, eventId);
          try {
            const listing =
              provider === 'ticket_tailor'
                ? await importTicketTailorListingForEvent(sb, auth.session, accountId, eventId, {
                    externalEventId: body.externalEventId || body.external_event_id,
                    bookingUrl: body.externalEventUrl || body.external_event_url || body.bookingUrl,
                  })
                : await importEventbriteListingForEvent(sb, auth.session, accountId, eventId, {
                    externalEventId: body.externalEventId || body.external_event_id,
                  });
            return json(res, 200, {
              ok: true,
              eventLink: link,
              listingImport: listing,
            });
          } catch (importErr) {
            return json(res, importErr.status || 500, {
              ok: false,
              error: importErr.code || importErr.message || 'listing_import_failed',
              message: importErr.message,
              eventLink: link,
            });
          }
        }
        return json(res, 200, { ok: true, eventLink: link });
      }

      if (action === 'save_eventbrite_private_token') {
        const token = String(body.token || body.eventbritePrivateToken || '').trim();
        if (!token) {
          return json(res, 400, {
            ok: false,
            error: 'missing_token',
            message: 'Paste your Eventbrite private token (Developer links in Eventbrite account settings).',
          });
        }
        const conn = await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', {
          eventbritePrivateToken: token,
        });
        return json(res, 200, {
          ok: true,
          eventbriteApiTokenConfigured: Boolean(eventbritePrivateTokenFromConfig(conn.config)),
        });
      }

      if (action === 'unlink_event') {
        const eventId = String(body.eventId || body.event_id || '').trim();
        if (!eventId) {
          return json(res, 400, { ok: false, error: 'missing_event_id' });
        }
        await deleteEventLink(sb, accountId, eventId);
        return json(res, 200, { ok: true });
      }

      if (action === 'import_eventbrite_listing' || action === 'import_ticket_tailor_listing') {
        const eventId = String(body.eventId || body.event_id || '').trim();
        if (!eventId) {
          return json(res, 400, { ok: false, error: 'missing_event_id' });
        }
        const { assertOrganiserOwnsEvent } = require('../supabase-organiser-alumni-invites');
        await assertOrganiserOwnsEvent(auth.session, eventId);

        const provider =
          action === 'import_ticket_tailor_listing' ? 'ticket_tailor' : 'eventbrite';
        const providerLabel = provider === 'ticket_tailor' ? 'Ticket Tailor' : 'Eventbrite';

        try {
          const listing =
            provider === 'ticket_tailor'
              ? await importTicketTailorListingForEvent(sb, auth.session, accountId, eventId, {
                  externalEventId: body.externalEventId || body.external_event_id,
                  bookingUrl: body.bookingUrl || body.externalEventUrl || body.external_event_url,
                })
              : await importEventbriteListingForEvent(sb, auth.session, accountId, eventId, {
                  externalEventId: body.externalEventId || body.external_event_id,
                });
          if (listing.empty) {
            return json(res, 200, {
              ok: true,
              event: null,
              importedFields: [],
              skippedBecauseLocked: listing.skippedBecauseLocked,
              externalEventId: listing.externalEventId,
              message: listing.saleLocked
                ? 'This event has ticket sales — date and venue stay locked. Nothing else was available to import.'
                : 'Nothing to import from ' + providerLabel + ' for this event.',
            });
          }
          return json(res, 200, {
            ok: true,
            event: listing.event,
            importedFields: listing.importedFields,
            skippedBecauseLocked: listing.skippedBecauseLocked,
            externalEventId: listing.externalEventId,
          });
        } catch (importErr) {
          return json(res, importErr.status || 500, {
            ok: false,
            error: importErr.code || importErr.message || 'listing_import_failed',
            message: importErr.message,
          });
        }
      }

      if (action === 'save_ticket_tailor_api_key') {
        const token = String(
          body.token || body.apiKey || body.ticketTailorApiKey || body.ticket_tailor_api_key || ''
        ).trim();
        if (!token) {
          return json(res, 400, {
            ok: false,
            error: 'missing_token',
            message: 'Paste your Ticket Tailor API key (Box office → Settings → API).',
          });
        }
        const conn = await mergeProviderConnectionConfig(sb, accountId, 'ticket_tailor', {
          ticketTailorApiKey: token,
        });
        return json(res, 200, {
          ok: true,
          ticketTailorApiKeyConfigured: Boolean(ticketTailorApiKeyFromConfig(conn.config)),
        });
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
