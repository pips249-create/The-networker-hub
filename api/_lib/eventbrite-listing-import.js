const {
  eventbritePrivateTokenFromConfig,
  fetchEventbriteEvent,
  mapEventbriteEventToListingPatch,
} = require('./connected-booking-providers/adapters/eventbrite-api');
const { parseEventbriteEventIdFromUrl } = require('./connected-booking-util');
const { listProviderConnections, listEventLinksForAccount } = require('./connected-booking-provider-store');
const { loadLockedOrActiveSaleEvents, lockEventOnFirstSale } = require('./event-sale-lock');
const { updateEvent } = require('./supabase-organiser-events');

async function resolveEventbriteExternalId(sb, accountId, eventId, overrideId) {
  let externalEventId = String(overrideId || '').trim();
  if (externalEventId) return externalEventId;

  const linksResult = await listEventLinksForAccount(sb, accountId);
  const link = (linksResult.links || []).find(
    (l) => l.event_id === eventId && l.provider === 'eventbrite'
  );
  externalEventId = String(link?.external_event_id || '').trim();
  if (!externalEventId && link?.external_event_url) {
    externalEventId = parseEventbriteEventIdFromUrl(link.external_event_url);
  }
  if (!externalEventId) {
    const evRow = await sb
      .from('events')
      .select('external_booking_url')
      .eq('id', eventId)
      .maybeSingle();
    if (evRow.error) throw new Error(evRow.error.message);
    externalEventId = parseEventbriteEventIdFromUrl(evRow.data?.external_booking_url);
  }
  return externalEventId;
}

async function importEventbriteListingForEvent(sb, session, accountId, eventId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const connResult = await listProviderConnections(sb, accountId);
  const conn = (connResult.connections || []).find((c) => c.provider === 'eventbrite');
  const token = eventbritePrivateTokenFromConfig(conn?.config);
  if (!token) {
    const e = new Error(
      'Save your Eventbrite private token before importing listing details.'
    );
    e.status = 400;
    e.code = 'eventbrite_token_missing';
    throw e;
  }

  const externalEventId = await resolveEventbriteExternalId(
    sb,
    accountId,
    eventId,
    options.externalEventId
  );
  if (!externalEventId) {
    const e = new Error(
      'Link this TNH event to an Eventbrite event id (or paste an Eventbrite booking URL) first.'
    );
    e.status = 400;
    e.code = 'missing_external_event_id';
    throw e;
  }

  const ebEvent = await fetchEventbriteEvent(externalEventId, token);
  const patch = mapEventbriteEventToListingPatch(ebEvent);

  const { data: existing } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  const saleLocked =
    existing &&
    (existing.locked ||
      (await loadLockedOrActiveSaleEvents(sb, [eventId])).some((row) => row.id === eventId));
  if (saleLocked && existing && !existing.locked) {
    await lockEventOnFirstSale(sb, eventId);
  }

  const skippedBecauseLocked = [];
  if (saleLocked) {
    for (const key of [
      'date',
      'endDate',
      'venue',
      'addressLine1',
      'city',
      'postcode',
      'location',
      'eventFormat',
      'onlineLink',
    ]) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        skippedBecauseLocked.push(key);
        delete patch[key];
      }
    }
  }

  const importedFields = Object.keys(patch);
  if (!importedFields.length) {
    return {
      event: null,
      importedFields: [],
      skippedBecauseLocked,
      externalEventId: String(ebEvent.id || externalEventId).trim(),
      empty: true,
      saleLocked: Boolean(saleLocked),
    };
  }

  patch._editorEmail = String(session.email || session.sub || '').trim();
  const updated = await updateEvent(eventId, patch);
  return {
    event: updated,
    importedFields,
    skippedBecauseLocked,
    externalEventId: String(ebEvent.id || externalEventId).trim(),
    empty: false,
    saleLocked: Boolean(saleLocked),
  };
}

module.exports = {
  importEventbriteListingForEvent,
  resolveEventbriteExternalId,
};
