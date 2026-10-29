const { getOrganiserApi } = require('../organiser-provider');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { connectedBookingAllowedForSession } = require('../connected-booking');
const {
  CONNECTED_BOOKING_PROVIDERS,
  isOrganiserPickerProvider,
  isLiveConnectedBookingProvider,
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
const {
  eventbritePrivateTokenFromConfig,
  eventbriteAuthMethodFromConfig,
} = require('../connected-booking-providers/adapters/eventbrite-api');
const { syncEventbriteAttendeesForConnection } = require('../eventbrite-attendee-sync');
const { syncEventbriteOrgEventsForAccount } = require('../eventbrite-org-event-sync');
const { ticketTailorApiKeyFromConfig } = require('../connected-booking-providers/adapters/ticket-tailor-api');
const {
  importEventbriteListingForEvent,
  listImportableEventbriteEvents,
  createEventFromEventbrite,
  findEventsByEventbriteExternalId,
  collapseEventbriteImportDuplicates,
} = require('../eventbrite-listing-import');
const { importTicketTailorListingForEvent } = require('../ticket-tailor-listing-import');
const { resolveOrganiserAccountId } = require('../organiser-account-resolve');
const {
  buildProviderWebhookPublicUrl,
  eventbriteWebhookNeedsTokenRotation,
  webhookPublicSite,
} = require('../provider-webhook-url');
const { validateProviderExternalEventId } = require('../connected-booking-util');
const {
  eventbriteOAuthConfigured,
  eventbriteOAuthRedirectUri,
  signEventbriteOAuthState,
  buildEventbriteAuthorizeUrl,
  safeReturnPath,
} = require('../eventbrite-oauth');

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
          eventbriteAuthMethod:
            p.id === 'eventbrite' && conn
              ? eventbriteAuthMethodFromConfig(conn.config) || null
              : undefined,
          eventbriteOAuthAvailable: p.id === 'eventbrite' ? eventbriteOAuthConfigured() : undefined,
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

      // Surface OAuth readiness once at the top level for the organiser UI.
      const eventbriteOAuth = {
        available: eventbriteOAuthConfigured(),
        redirectUri: eventbriteOAuthConfigured() ? eventbriteOAuthRedirectUri() : null,
      };

      let eventLink = null;
      if (eventId) {
        eventLink = (linksResult.links || []).find((l) => l.event_id === eventId) || null;
      }

      return json(res, 200, {
        ok: true,
        providers,
        eventLinks: linksResult.links,
        eventLink,
        eventbriteOAuth,
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
            message: 'That booking system is not available. Choose Eventbrite or your own website.',
          });
        }
        if (!isLiveConnectedBookingProvider(provider)) {
          return json(res, 400, {
            ok: false,
            error: 'provider_not_live',
            message: 'That booking system is not available yet. Choose Eventbrite or your own website.',
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
            message: 'That booking system is not available. Choose Eventbrite or your own website.',
          });
        }
        if (!isLiveConnectedBookingProvider(provider)) {
          return json(res, 400, {
            ok: false,
            error: 'provider_not_live',
            message: 'That booking system is not available yet. Choose Eventbrite or your own website.',
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

      if (action === 'start_eventbrite_oauth') {
        if (!eventbriteOAuthConfigured()) {
          return json(res, 503, {
            ok: false,
            error: 'eventbrite_oauth_not_configured',
            message:
              'Eventbrite OAuth is not configured yet. Ask an admin to set EVENTBRITE_CLIENT_ID and EVENTBRITE_CLIENT_SECRET, or paste a private token below.',
            redirectUri: eventbriteOAuthRedirectUri(),
          });
        }
        const groupId = String(body.groupId || body.organiserId || body.organiser_id || '').trim();
        const returnPath = safeReturnPath(
          body.returnPath || body.return_path || body.returnUrl,
          groupId
            ? '/organiser/group-edit?id=' + encodeURIComponent(groupId)
            : '/organiser/#connected-booking'
        );
        if (groupId) {
          const { resolveOrganiserAccess } = require('../supabase-organiser-access');
          const access = await resolveOrganiserAccess(auth.session);
          const allowed = new Set(access.groupIds || []);
          if (!allowed.has(groupId)) {
            return json(res, 403, {
              ok: false,
              error: 'not_allowed',
              message: 'You do not have access to that organiser page.',
            });
          }
        }
        const state = signEventbriteOAuthState({
          accountId: accountId,
          groupId: groupId || undefined,
          returnPath: returnPath,
          email: String(auth.session.email || '').trim().toLowerCase(),
          sub: String(auth.session.sub || '').trim(),
        });
        const authorizeUrl = buildEventbriteAuthorizeUrl(state);
        return json(res, 200, {
          ok: true,
          authorizeUrl: authorizeUrl,
          redirectUri: eventbriteOAuthRedirectUri(),
        });
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
        const {
          isConnectedPlanActive,
          connectedBookingFreeEnabled,
          connectedBookingFreeDefaultPlan,
          newWebhookSecret,
        } = require('../connected-booking-util');
        const { maybeAutoAssignSingleStarterSlot } = require('../connected-booking-slots');
        let { data: account } = await sb
          .from('organiser_accounts')
          .select(
            'id, email, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
          )
          .eq('id', accountId)
          .maybeSingle();
        if (account && !isConnectedPlanActive(account) && connectedBookingFreeEnabled()) {
          const patch = {
            connected_booking_plan: connectedBookingFreeDefaultPlan(),
            connected_booking_status: 'active',
          };
          if (!String(account.connected_booking_webhook_secret || '').trim()) {
            patch.connected_booking_webhook_secret = newWebhookSecret();
          }
          const { data: activated } = await sb
            .from('organiser_accounts')
            .update(patch)
            .eq('id', accountId)
            .select(
              'id, email, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
            )
            .maybeSingle();
          account = activated || Object.assign({}, account, patch);
          try {
            await maybeAutoAssignSingleStarterSlot(sb, account);
          } catch (_slotErr) {
            /* optional */
          }
        }
        await ensureProviderConnection(sb, accountId, 'eventbrite');
        const groupId = String(body.groupId || body.organiserId || body.organiser_id || '').trim();
        const configPatch = {
          eventbritePrivateToken: token,
          eventbriteAuthMethod: 'private_token',
        };
        if (groupId) configPatch.defaultImportGroupId = groupId;
        const conn = await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', configPatch);
        const endpointUrl = buildProviderWebhookPublicUrl(webhookSite, 'eventbrite', conn.webhook_token);
        let attendeeSync = null;
        try {
          attendeeSync = await syncEventbriteAttendeesForConnection({
            sb,
            connection: conn,
            endpointUrl,
            force: true,
          });
        } catch (e) {
          attendeeSync = { ok: false, reason: e.message || 'attendee_sync_failed' };
        }
        let orgSync = null;
        try {
          orgSync = await syncEventbriteOrgEventsForAccount(sb, {
            accountId: accountId,
            groupId: groupId,
            account: account,
            session: auth.session,
            source: 'private_token_connect',
            maxCreate: 25,
          });
        } catch (e) {
          orgSync = {
            ok: false,
            error: e.code || e.message || 'org_sync_failed',
            message: e.message,
          };
        }
        return json(res, 200, {
          ok: true,
          eventbriteApiTokenConfigured: Boolean(eventbritePrivateTokenFromConfig(conn.config)),
          eventbriteAuthMethod: eventbriteAuthMethodFromConfig(conn.config) || 'private_token',
          attendeeSync,
          orgSync,
          connectedActivated: Boolean(account && isConnectedPlanActive(account)),
        });
      }

      if (action === 'sync_eventbrite_org_events') {
        const groupId = String(body.groupId || body.organiserId || body.organiser_id || '').trim();
        if (groupId) {
          const { resolveOrganiserAccess } = require('../supabase-organiser-access');
          const access = await resolveOrganiserAccess(auth.session);
          const allowed = new Set(access.groupIds || []);
          if (!allowed.has(groupId)) {
            return json(res, 403, {
              ok: false,
              error: 'not_allowed',
              message: 'You do not have access to that organiser page.',
            });
          }
        }
        try {
          const orgSync = await syncEventbriteOrgEventsForAccount(sb, {
            accountId: accountId,
            groupId: groupId,
            session: auth.session,
            source: 'organiser_manual_sync',
            maxCreate: body.maxCreate || 25,
            externalEventId: body.externalEventId || body.external_event_id,
          });
          return json(res, 200, { ok: true, orgSync });
        } catch (syncErr) {
          return json(res, syncErr.status || 500, {
            ok: false,
            error: syncErr.code || syncErr.message || 'eventbrite_org_sync_failed',
            message: syncErr.message,
          });
        }
      }

      if (action === 'sync_eventbrite_attendees') {
        const listed = await listProviderConnections(sb, accountId);
        const conn = (listed.connections || []).find(function (row) {
          return row.provider === 'eventbrite';
        });
        if (!conn || !eventbritePrivateTokenFromConfig(conn.config)) {
          return json(res, 400, {
            ok: false,
            error: 'eventbrite_token_missing',
            message: 'Save an Eventbrite private token before syncing ticket holders.',
          });
        }
        const endpointUrl = buildProviderWebhookPublicUrl(webhookSite, 'eventbrite', conn.webhook_token);
        const attendeeSync = await syncEventbriteAttendeesForConnection({
          sb,
          connection: Object.assign({}, conn, { organiser_account_id: accountId }),
          endpointUrl,
          force: false,
        });
        return json(res, 200, { ok: true, attendeeSync });
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

      if (action === 'list_eventbrite_events') {
        try {
          const listed = await listImportableEventbriteEvents(sb, accountId, {
            status: body.status,
            pageSize: body.pageSize || body.page_size,
            maxPages: body.maxPages || body.max_pages,
          });
          return json(res, 200, {
            ok: true,
            organizationId: listed.organizationId,
            events: listed.events,
            tokenConfigured: listed.tokenConfigured,
          });
        } catch (listErr) {
          return json(res, listErr.status || 500, {
            ok: false,
            error: listErr.code || listErr.message || 'eventbrite_list_failed',
            message: listErr.message,
          });
        }
      }

      if (action === 'create_from_eventbrite') {
        const groupId = String(body.groupId || body.organiserId || body.organiser_id || '').trim();
        const externalEventId = String(
          body.externalEventId || body.eventbriteEventId || body.external_event_id || ''
        ).trim();
        try {
          if (!groupId) {
            return json(res, 400, {
              ok: false,
              error: 'missing_group_id',
              message: 'Choose an organiser page for this Eventbrite event.',
            });
          }
          const { resolveOrganiserAccess } = require('../supabase-organiser-access');
          const access = await resolveOrganiserAccess(auth.session);
          const allowed = new Set(access.groupIds || []);
          if (!allowed.has(groupId)) {
            return json(res, 403, {
              ok: false,
              error: 'not_allowed',
              message: 'You do not have access to that organiser page.',
            });
          }

          const {
            isConnectedPlanActive,
            connectedBookingFreeEnabled,
            connectedBookingFreeDefaultPlan,
            newWebhookSecret,
          } = require('../connected-booking-util');
          const { maybeAutoAssignSingleStarterSlot } = require('../connected-booking-slots');
          let { data: account } = await sb
            .from('organiser_accounts')
            .select(
              'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
            )
            .eq('id', accountId)
            .maybeSingle();
          if (account && !isConnectedPlanActive(account) && connectedBookingFreeEnabled()) {
            const patch = {
              connected_booking_plan: connectedBookingFreeDefaultPlan(),
              connected_booking_status: 'active',
            };
            if (!String(account.connected_booking_webhook_secret || '').trim()) {
              patch.connected_booking_webhook_secret = newWebhookSecret();
            }
            const { data: activated } = await sb
              .from('organiser_accounts')
              .update(patch)
              .eq('id', accountId)
              .select(
                'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
              )
              .maybeSingle();
            account = activated || Object.assign({}, account, patch);
            try {
              await maybeAutoAssignSingleStarterSlot(sb, account);
            } catch (_slotErr) {
              /* optional */
            }
          }

          await ensureProviderConnection(sb, accountId, 'eventbrite');

          const result = await createEventFromEventbrite(sb, auth.session, accountId, {
            groupId: groupId,
            externalEventId: externalEventId,
            publish: body.publish === true || body.listingStatus === 'published',
          });
          return json(res, 200, Object.assign({ ok: true }, result));
        } catch (createErr) {
          return json(res, createErr.status || 500, {
            ok: false,
            error: createErr.code || createErr.message || 'eventbrite_import_failed',
            message: createErr.message,
          });
        }
      }

      if (action === 'dedupe_eventbrite_imports') {
        try {
          const listed = await listImportableEventbriteEvents(sb, accountId, {});
          const events = Array.isArray(listed.events) ? listed.events : [];
          let unpublished = 0;
          let kept = 0;
          for (let i = 0; i < events.length; i += 1) {
            const eid = String(events[i] && events[i].id ? events[i].id : '').trim();
            if (!eid) continue;
            const matches = await findEventsByEventbriteExternalId(sb, accountId, eid);
            if (matches.length < 2) {
              if (matches.length === 1) kept += 1;
              continue;
            }
            const collapsed = await collapseEventbriteImportDuplicates(sb, accountId, eid, matches[0].id);
            kept += 1;
            unpublished += collapsed.unpublished.length;
            try {
              await upsertEventLink(sb, accountId, {
                eventId: collapsed.keepEventId || matches[0].id,
                provider: 'eventbrite',
                externalEventId: eid,
                externalEventUrl: String(matches[0].external_booking_url || '').trim() || null,
              });
            } catch (_linkErr) {
              /* optional */
            }
          }
          return json(res, 200, {
            ok: true,
            kept: kept,
            unpublished: unpublished,
            message: unpublished
              ? 'Unpublished ' + unpublished + ' duplicate Eventbrite listing' + (unpublished === 1 ? '' : 's') + '.'
              : 'No duplicate Eventbrite listings found.',
          });
        } catch (dedupeErr) {
          return json(res, dedupeErr.status || 500, {
            ok: false,
            error: dedupeErr.code || dedupeErr.message || 'eventbrite_dedupe_failed',
            message: dedupeErr.message,
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

      if (action === 'send_test_booking') {
        const eventId = String(body.eventId || body.event_id || '').trim();
        if (!eventId) {
          return json(res, 400, {
            ok: false,
            error: 'missing_event_id',
            message: 'Choose a Networker UK event to send the test booking to.',
          });
        }
        const { assertOrganiserOwnsEvent } = require('../supabase-organiser-alumni-invites');
        await assertOrganiserOwnsEvent(auth.session, eventId);

        const conn = await ensureProviderConnection(sb, accountId, 'own_site');
        if (!conn || !conn.webhook_token) {
          return json(res, 400, {
            ok: false,
            error: 'own_site_not_enabled',
            message: 'Enable Your own website on Booking providers first, then try again.',
          });
        }

        const { data: account, error: accErr } = await sb
          .from('organiser_accounts')
          .select(
            'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
          )
          .eq('id', accountId)
          .maybeSingle();
        if (accErr) {
          return json(res, 500, { ok: false, error: 'account_lookup_failed', message: accErr.message });
        }

        const sessionEmail =
          (auth.session &&
            (auth.session.email ||
              (auth.session.user && auth.session.user.email) ||
              (auth.session.organiser && auth.session.organiser.email))) ||
          '';
        const email = String(body.email || sessionEmail || 'test-booking@thenetworkeruk.com')
          .trim()
          .toLowerCase();
        const name = String(body.name || 'Test booking').trim() || 'Test booking';
        const orderId = String(body.orderId || body.order_id || '').trim() || 'test-' + Date.now();

        const { ingestConnectedBookingRegistration } = require('../connected-booking-ingest');
        try {
          const result = await ingestConnectedBookingRegistration({
            sb,
            account,
            eventId,
            body: {
              orderId,
              email,
              name,
              quantity: 1,
              amountPaid: 0,
              status: 'confirmed',
            },
            logPayload: {
              test: true,
              source: 'organiser_send_test_booking',
              email,
            },
            providerLabel: 'own_site',
          });
          return json(res, 200, {
            ok: true,
            result,
            orderId,
            email,
            message:
              result && result.action === 'duplicate'
                ? 'That test order was already synced (duplicate). Check Recent sync attempts and Attendees.'
                : 'Test booking accepted. Check Recent sync attempts for own_site:accepted, then open Attendees for this event.',
          });
        } catch (ingestErr) {
          const code = String(ingestErr.code || ingestErr.message || 'test_booking_failed');
          const status = ingestErr.status || 500;
          let message = ingestErr.message || 'Could not send test booking.';
          if (code === 'connected_booking_inactive') {
            message =
              'Connected booking is not active on this account yet. Choose a plan (or ask for pilot access), then try again.';
          } else if (code === 'connected_booking_disabled') {
            message = 'Connected booking is not enabled for this account.';
          } else if (code === 'event_not_on_account') {
            message = 'That event is not on this organiser account.';
          }
          return json(res, status, { ok: false, error: code, message });
        }
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
