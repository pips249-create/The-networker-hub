const {
  eventbritePrivateTokenFromConfig,
  fetchEventbriteEvent,
  listEventbriteOrganizationEvents,
  mapEventbriteEventToListingPatch,
} = require('./connected-booking-providers/adapters/eventbrite-api');
const {
  CHECKOUT_EXTERNAL,
  eventbriteImportAutoPublishEnabled,
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

/**
 * Trusted Connected imports go live when date + booking URL + price are present.
 * Incomplete / risky listings stay drafts. Explicit publish:false forces draft.
 */
function shouldAutoPublishEventbriteImport(patch, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  if (options.publish === false || options.listingStatus === 'draft') return false;
  if (options.publish === true || options.listingStatus === 'published') return true;
  if (!eventbriteImportAutoPublishEnabled()) return false;
  const date = String(patch && patch.date ? patch.date : '').trim();
  const url = String(patch && patch.externalBookingUrl ? patch.externalBookingUrl : '').trim();
  const price = String(patch && patch.externalPriceLabel ? patch.externalPriceLabel : '').trim();
  return Boolean(date && url && price);
}

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
 * Create a TNH event from an Eventbrite event id and link it for Connected sync.
 * Complete trusted imports publish + auto-approve; incomplete ones stay drafts.
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
  if (bookingUrl && !patch.externalBookingUrl) patch.externalBookingUrl = bookingUrl;

  const wantPublish = shouldAutoPublishEventbriteImport(patch, options);
  const editorEmail = String(session.email || session.sub || '').trim();
  const basePayload = {
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
    externalPriceLabel: patch.externalPriceLabel || '',
    _editorEmail: editorEmail,
  };

  let created = null;
  let published = false;
  let publishBlockedReason = '';

  if (wantPublish) {
    try {
      created = await createEvent(
        Object.assign({}, basePayload, { listingStatus: 'published' })
      );
      published = true;
    } catch (publishErr) {
      const code = String(publishErr && publishErr.code ? publishErr.code : '').trim();
      const softFail =
        code === 'missing_date' ||
        code === 'missing_organiser' ||
        code === 'missing_external_booking_url' ||
        code === 'missing_external_price_label' ||
        code === 'connected_booking_inactive' ||
        code === 'connected_booking_slot_not_assigned' ||
        code === 'connected_booking_no_account' ||
        code === 'connected_booking_group_limit';
      if (!softFail) throw publishErr;
      publishBlockedReason = String(publishErr.message || code || 'publish_blocked').trim();
    }
  }

  if (!created) {
    created = await createEvent(Object.assign({}, basePayload, { listingStatus: 'draft' }));
    published = false;
  }

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

  const live =
    published &&
    String(created.status || '').toLowerCase() === 'published' &&
    String(created.approval_status || '').trim() === 'Approved';

  return {
    created: true,
    alreadyLinked: false,
    event: created,
    eventId: eventId,
    eventLink: link,
    externalEventId: String(ebEvent.id || externalEventId).trim(),
    importedFields: Object.keys(patch),
    published: live,
    listingStatus: live ? 'published' : 'draft',
    autoPublishAttempted: wantPublish,
    publishBlockedReason: live ? '' : publishBlockedReason,
    message: live
      ? 'Imported and published on The Networker UK.'
      : publishBlockedReason
        ? 'Imported as a draft (' + publishBlockedReason + ').'
        : 'Imported as a draft on The Networker UK.',
  };
}

module.exports = {
  importEventbriteListingForEvent,
  resolveEventbriteExternalId,
  listImportableEventbriteEvents,
  createEventFromEventbrite,
  shouldAutoPublishEventbriteImport,
};
