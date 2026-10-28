const {
  eventbritePrivateTokenFromConfig,
  fetchEventbriteEvent,
  listEventbriteOrganizationEvents,
  mapEventbriteEventToListingPatch,
} = require('./connected-booking-providers/adapters/eventbrite-api');
const {
  CHECKOUT_EXTERNAL,
  parseEventbriteEventIdFromUrl,
  preferEventbriteCheckoutUrl,
} = require('./connected-booking-util');
const {
  listProviderConnections,
  listEventLinksForAccount,
  findEventLinkByExternal,
  upsertEventLink,
} = require('./connected-booking-provider-store');
const { loadLockedOrActiveSaleEvents, lockEventOnFirstSale } = require('./event-sale-lock');
const { createEvent, updateEvent } = require('./supabase-organiser-events');

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

async function listImportableEventbriteEvents(sb, accountId, opts) {
  const connResult = await listProviderConnections(sb, accountId);
  const conn = (connResult.connections || []).find((c) => c.provider === 'eventbrite');
  const token = eventbritePrivateTokenFromConfig(conn?.config);
  if (!token) {
    const e = new Error('Save your Eventbrite private token before listing events.');
    e.status = 400;
    e.code = 'eventbrite_token_missing';
    throw e;
  }
  const listed = await listEventbriteOrganizationEvents(token, opts);
  const linksResult = await listEventLinksForAccount(sb, accountId);
  const linkedIds = new Set(
    (linksResult.links || [])
      .filter((l) => l && l.provider === 'eventbrite')
      .map((l) => String(l.external_event_id || '').trim())
      .filter(Boolean)
  );
  const events = (listed.events || []).map(function (evt) {
    const id = String(evt.id || '').trim();
    return Object.assign({}, evt, { alreadyLinked: linkedIds.has(id) });
  });
  return {
    organizationId: listed.organizationId,
    events: events,
    tokenConfigured: true,
  };
}

/**
 * Create a TNH draft event from an Eventbrite event id and link it for Connected sync.
 */
async function createEventFromEventbrite(sb, session, accountId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const groupId = String(options.groupId || options.organiserId || '').trim();
  const externalEventId = String(options.externalEventId || options.eventbriteEventId || '').trim();
  if (!groupId) {
    const e = new Error('Choose an organiser page for this Eventbrite event.');
    e.status = 400;
    e.code = 'missing_group_id';
    throw e;
  }
  if (!externalEventId) {
    const e = new Error('Choose an Eventbrite event to import.');
    e.status = 400;
    e.code = 'missing_external_event_id';
    throw e;
  }

  const existingLink = await findEventLinkByExternal(sb, 'eventbrite', externalEventId, accountId);
  if (existingLink && existingLink.event_id) {
    return {
      created: false,
      alreadyLinked: true,
      eventId: existingLink.event_id,
      externalEventId: externalEventId,
      message: 'That Eventbrite event is already linked on The Networker UK.',
    };
  }

  const connResult = await listProviderConnections(sb, accountId);
  const conn = (connResult.connections || []).find((c) => c.provider === 'eventbrite');
  const token = eventbritePrivateTokenFromConfig(conn?.config);
  if (!token) {
    const e = new Error('Save your Eventbrite private token before importing.');
    e.status = 400;
    e.code = 'eventbrite_token_missing';
    throw e;
  }

  const ebEvent = await fetchEventbriteEvent(externalEventId, token);
  const patch = mapEventbriteEventToListingPatch(ebEvent);
  const title = String(patch.title || 'Eventbrite event').trim() || 'Eventbrite event';
  const bookingUrl =
    String(patch.externalBookingUrl || '').trim() ||
    preferEventbriteCheckoutUrl(String(ebEvent.url || ebEvent.public_url || '').trim());

  const created = await createEvent({
    groupId: groupId,
    title: title,
    description: patch.description || '',
    date: patch.date || '',
    endDate: patch.endDate || '',
    venue: patch.venue || '',
    addressLine1: patch.addressLine1 || '',
    city: patch.city || '',
    postcode: patch.postcode || '',
    location: patch.location || '',
    eventFormat: patch.eventFormat || '',
    onlineLink: patch.onlineLink || '',
    photoUrl: patch.photoUrl || '',
    checkoutMode: CHECKOUT_EXTERNAL,
    externalBookingUrl: bookingUrl,
    listingStatus: options.publish ? 'published' : 'draft',
    _editorEmail: String(session.email || session.sub || '').trim(),
  });

  const eventId = String(created && created.id ? created.id : '').trim();
  if (!eventId) {
    const e = new Error('Could not create the Networker UK event.');
    e.status = 500;
    e.code = 'event_create_failed';
    throw e;
  }

  const link = await upsertEventLink(sb, accountId, {
    eventId: eventId,
    provider: 'eventbrite',
    externalEventId: String(ebEvent.id || externalEventId).trim(),
    externalEventUrl: bookingUrl,
  });

  return {
    created: true,
    alreadyLinked: false,
    event: created,
    eventId: eventId,
    eventLink: link,
    externalEventId: String(ebEvent.id || externalEventId).trim(),
    importedFields: Object.keys(patch),
  };
}

module.exports = {
  importEventbriteListingForEvent,
  resolveEventbriteExternalId,
  listImportableEventbriteEvents,
  createEventFromEventbrite,
};
