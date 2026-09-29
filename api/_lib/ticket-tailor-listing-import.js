const {
  ticketTailorApiKeyFromConfig,
  fetchTicketTailorEvent,
  findTicketTailorEventIdByBookingUrl,
  mapTicketTailorEventToListingPatch,
} = require('./connected-booking-providers/adapters/ticket-tailor-api');
const { isTicketTailorWebhookEventId } = require('./connected-booking-util');
const { listProviderConnections, listEventLinksForAccount } = require('./connected-booking-provider-store');
const { loadLockedOrActiveSaleEvents, lockEventOnFirstSale } = require('./event-sale-lock');
const { updateEvent } = require('./supabase-organiser-events');

async function resolveTicketTailorExternalId(sb, accountId, eventId, overrideId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  let externalEventId = String(overrideId || '').trim();
  if (externalEventId && isTicketTailorWebhookEventId(externalEventId)) return externalEventId;

  const linksResult = await listEventLinksForAccount(sb, accountId);
  const link = (linksResult.links || []).find(
    (l) => l.event_id === eventId && l.provider === 'ticket_tailor'
  );
  externalEventId = String(link?.external_event_id || '').trim();
  if (isTicketTailorWebhookEventId(externalEventId)) return externalEventId;

  let bookingUrl = String(options.bookingUrl || link?.external_event_url || '').trim();
  if (!bookingUrl) {
    const evRow = await sb
      .from('events')
      .select('external_booking_url')
      .eq('id', eventId)
      .maybeSingle();
    if (evRow.error) throw new Error(evRow.error.message);
    bookingUrl = String(evRow.data?.external_booking_url || '').trim();
  }

  if (options.apiKey && bookingUrl) {
    const fromUrl = await findTicketTailorEventIdByBookingUrl(options.apiKey, bookingUrl);
    if (fromUrl) return fromUrl;
  }

  return '';
}

async function importTicketTailorListingForEvent(sb, session, accountId, eventId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const connResult = await listProviderConnections(sb, accountId);
  const conn = (connResult.connections || []).find((c) => c.provider === 'ticket_tailor');
  const apiKey = ticketTailorApiKeyFromConfig(conn?.config);
  if (!apiKey) {
    const e = new Error(
      'Save your Ticket Tailor API key before importing listing details (Box office → Settings → API).'
    );
    e.status = 400;
    e.code = 'ticket_tailor_api_key_missing';
    throw e;
  }

  const externalEventId = await resolveTicketTailorExternalId(sb, accountId, eventId, options.externalEventId, {
    apiKey,
    bookingUrl: options.bookingUrl,
  });
  if (!externalEventId) {
    const e = new Error(
      'Link this TNH event to a Ticket Tailor ev_… event id (Box office), or paste a Ticket Tailor booking URL we can match.'
    );
    e.status = 400;
    e.code = 'missing_external_event_id';
    throw e;
  }

  const ttEvent = await fetchTicketTailorEvent(externalEventId, apiKey);
  const patch = mapTicketTailorEventToListingPatch(ttEvent);

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
      externalEventId: String(ttEvent.id || externalEventId).trim(),
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
    externalEventId: String(ttEvent.id || externalEventId).trim(),
    empty: false,
    saleLocked: Boolean(saleLocked),
  };
}

module.exports = {
  importTicketTailorListingForEvent,
  resolveTicketTailorExternalId,
};
