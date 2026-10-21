const { listEventLinksForAccount, mergeProviderConnectionConfig } = require('./connected-booking-provider-store');
const { ingestConnectedBookingRegistration } = require('./connected-booking-ingest');
const {
  eventbritePrivateTokenFromConfig,
  ensureEventbriteAttendeeWebhook,
  fetchEventbriteEventAttendees,
  registrationsFromEventbriteEventAttendees,
} = require('./connected-booking-providers/adapters/eventbrite-api');

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const MAX_EVENTS = 5;

async function syncEventbriteAttendeesForConnection({ sb, connection, endpointUrl, force }) {
  const token = eventbritePrivateTokenFromConfig(connection && connection.config);
  const accountId = connection && connection.organiser_account_id;
  if (!token || !accountId) return { ok: false, reason: 'missing_token' };

  const config = connection.config && typeof connection.config === 'object' ? connection.config : {};
  const last = Date.parse(config.eventbriteAttendeeSyncAt || '');
  if (!force && Number.isFinite(last) && Date.now() - last < SYNC_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }

  const webhook = await ensureEventbriteAttendeeWebhook(token, endpointUrl);
  const linksResult = await listEventLinksForAccount(sb, accountId);
  const links = (linksResult.links || [])
    .filter(function (link) {
      return link && link.provider === 'eventbrite' && String(link.external_event_id || '').trim();
    })
    .slice(0, MAX_EVENTS);

  const { data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select('id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret')
    .eq('id', accountId)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const link of links) {
    let rows = [];
    try {
      const attendees = await fetchEventbriteEventAttendees(link.external_event_id, token, 100);
      rows = registrationsFromEventbriteEventAttendees(link.external_event_id, attendees);
    } catch {
      failed += 1;
      continue;
    }
    for (const row of rows) {
      if (!row.externalEventId) row.externalEventId = String(link.external_event_id);
      try {
        const result = await ingestConnectedBookingRegistration({
          sb,
          account,
          eventId: link.event_id,
          body: row,
          logPayload: {
            provider: 'eventbrite',
            externalEventId: row.externalEventId,
            email: row.email,
            backfill: true,
          },
          providerLabel: 'eventbrite',
        });
        if (result.action === 'created') created += 1;
        else if (result.action === 'updated') updated += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', {
    eventbriteAttendeeSyncAt: new Date().toISOString(),
  });

  return { ok: true, webhook, created, updated, failed, events: links.length };
}

module.exports = {
  ensureEventbriteAttendeeWebhook,
  syncEventbriteAttendeesForConnection,
};
