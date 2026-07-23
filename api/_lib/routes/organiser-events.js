const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified, isPublishIntent } = require('../organiser-access-guard');
const { assertDescriptionLimit } = require('../text-limits');

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

function normalizeOccurrences(body) {
  if (Array.isArray(body.occurrences) && body.occurrences.length) {
    return body.occurrences
      .map((o) => ({
        date: o.date || o.start || o.dateTime || '',
        endDate: o.endDate || o.end || '',
      }))
      .filter((o) => o.date);
  }
  const dates = Array.isArray(body.dates) ? body.dates.filter(Boolean) : [];
  if (dates.length) {
    return dates.map((date) => ({ date, endDate: body.endDate || '' }));
  }
  const single = body.date || body.dateTime || '';
  return single ? [{ date: single, endDate: body.endDate || '' }] : [];
}

function eventPayloadFromBody(body, email) {
  const payload = {
    email,
    groupId: String(body.organiserGroupId || body.groupId || '').trim(),
    title: String(body.title || '').trim(),
    type: String(body.type || body.format || 'Meeting').trim(),
    location: String(body.location || '').trim(),
    venue: String(body.venue || '').trim(),
    addressLine1: String(body.addressLine1 || '').trim(),
    city: String(body.city || '').trim(),
    postcode: String(body.postcode || '').trim(),
    fullAddress: String(body.fullAddress || '').trim(),
    eventFormat: String(body.eventFormat || '').trim(),
    onlinePlatform: String(body.onlinePlatform || '').trim(),
    onlineLink: String(body.onlineLink || '').trim(),
    attendeeExtras: body.attendeeExtras || null,
    industry: String(body.industry || '').trim(),
    maxAttendees: body.maxAttendees,
    recurrencePattern: body.recurrencePattern || body.recurrence || null,
    recurrenceEndDate: body.recurrenceEndDate || null,
    photoBase64: body.photoBase64 || body.imageBase64 || null,
    photoMime: body.photoMime || body.imageMime || null,
    photoFilename: body.photoFilename || body.imageFilename || null,
  };
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    payload.description = String(body.description || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'photoUrl') || Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    payload.photoUrl = String(body.photoUrl || body.imageUrl || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'imagePosition')) {
    payload.imagePosition = String(body.imagePosition || '').trim();
  }
  if (body.listingStatus != null) {
    payload.listingStatus = body.listingStatus;
  } else if (body.publish === true || body.publish === 'true') {
    payload.listingStatus = 'published';
  }
  return payload;
}

function validateEventDescription(body) {
  if (body.description !== undefined) {
    assertDescriptionLimit(body.description, 'Event description');
  }
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listGroupsForSession,
    listEventsForSession,
    listEventsForSeriesGroup,
    groupOwnedBySession,
    createEvent,
    createEventsForOccurrences,
    updateEvent,
    syncSeriesOccurrencesForEvent,
    deleteEventForSession,
    duplicateEventForSession,
    getEventById,
    resolveSeriesGroupId,
    isPlatformAdmin,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  async function requireVerifiedForPublish(body) {
    if (!isPublishIntent(body)) return null;
    const verified = await assertOrganiserEmailVerified(auth.session);
    if (!verified.ok) {
      return json(res, verified.status, {
        error: verified.error,
        message: verified.message,
      });
    }
    return null;
  }

  async function ownedEventIds() {
    const groups = await listGroupsForSession(auth.session);
    const events = await listEventsForSession(
      auth.session,
      groups.map((g) => g.id),
      []
    );
    return { groups, events, allowed: new Set(events.map((e) => e.id)) };
  }

  if (req.method === 'GET') {
    const eventId = String(req.query?.id || req.query?.eventId || '').trim();
    const seriesGroupId = String(req.query?.seriesGroupId || req.query?.series_group_id || '').trim();
    try {
      if (seriesGroupId) {
        const groups = await listGroupsForSession(auth.session);
        const groupIds = groups.map((g) => g.id);
        const { organiserPersonalScopeFromRequest } = require('../auth');
        const adminView =
          isPlatformAdmin(auth.session) && !organiserPersonalScopeFromRequest(req);
        const events = await listEventsForSeriesGroup(groupIds, seriesGroupId);
        return json(res, 200, { ok: true, events });
      }
      if (eventId) {
        const { groups, allowed } = await ownedEventIds();
        if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
          return json(res, 403, { error: 'event_not_owned' });
        }
        const event = await getEventById(eventId);
        let enriched = event;
        try {
          const { enrichEventsWithRegistrationSales } = require('../supabase-organiser-payouts');
          const [withSales] = await enrichEventsWithRegistrationSales([event]);
          enriched = withSales || event;
        } catch {
          /* sales enrichment optional */
        }
        if (
          !isPlatformAdmin(auth.session) &&
          event.organiserGroupId &&
          !groupOwnedBySession(auth.session, groups, event.organiserGroupId)
        ) {
          const emailMatch =
            event.ownerEmail && event.ownerEmail === auth.session.email.toLowerCase();
          if (!emailMatch && !allowed.has(eventId)) {
            return json(res, 403, { error: 'event_not_owned' });
          }
        }
        return json(res, 200, { ok: true, event: enriched });
      }
      const groups = await listGroupsForSession(auth.session);
      const groupIds = groups.map((g) => g.id);
      const events = await listEventsForSession(auth.session, groupIds, []);
      return json(res, 200, { ok: true, events, groups });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'events_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const publishBlocked = await requireVerifiedForPublish(body);
    if (publishBlocked) return publishBlocked;
    const eventId = String(body.id || body.eventId || req.query?.id || '').trim();
    if (!eventId) return json(res, 400, { error: 'missing_event_id' });

    try {
      const { groups, allowed } = await ownedEventIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
        return json(res, 403, { error: 'event_not_owned' });
      }
      validateEventDescription(body);
      const occ = normalizeOccurrences(body);
      const base = eventPayloadFromBody(body, auth.session.email);
      if (!base.title) return json(res, 400, { error: 'missing_title' });
      if (!base.groupId) return json(res, 400, { error: 'missing_group' });
      if (!groupOwnedBySession(auth.session, groups, base.groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }

      const listingStatus = String(base.listingStatus || 'draft').toLowerCase();
      const isDraft = listingStatus === 'draft';
      if (!occ.length && !isDraft) {
        return json(res, 400, { error: 'missing_dates', message: 'Select at least one date before publishing.' });
      }
      const existing = await getEventById(eventId);
      const seriesGroupId = resolveSeriesGroupId(existing.seriesGroupId, occ.length);
      const synced = await syncSeriesOccurrencesForEvent(eventId, {
        base,
        occurrences: occ,
        seriesGroupId,
      });

      return json(res, 200, {
        ok: true,
        event: synced.event || synced.events[0],
        events: synced.events,
        eventIds: synced.eventIds,
        needsTickets: synced.eventIds.length > 0,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'event_update_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const publishBlocked = await requireVerifiedForPublish(body);
    if (publishBlocked) return publishBlocked;

    if (String(body.action || '').trim() === 'duplicate') {
      const eventId = String(body.id || body.eventId || '').trim();
      if (!eventId) return json(res, 400, { error: 'missing_event_id' });
      try {
        const { groups, allowed } = await ownedEventIds();
        if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
          return json(res, 403, { error: 'event_not_owned' });
        }
        const result = await duplicateEventForSession(
          auth.session,
          eventId,
          groups.map((g) => g.id)
        );
        return json(res, 201, {
          ok: true,
          event: result.event,
          eventIds: [result.event.id],
          ticketCount: result.ticketCount,
          message:
            'Event duplicated as a draft — add new dates, review ticket types, then publish.',
        });
      } catch (e) {
        return json(res, e.status || 500, {
          error: e.code || 'event_duplicate_failed',
          message: e.message,
        });
      }
    }

    const title = String(body.title || '').trim();
    const groupId = String(body.organiserGroupId || body.groupId || '').trim();
    const occ = normalizeOccurrences(body);

    if (!title) return json(res, 400, { error: 'missing_title' });
    if (!groupId) return json(res, 400, { error: 'missing_group' });
    const base = eventPayloadFromBody(body, auth.session.email);
    if (base.listingStatus == null) base.listingStatus = 'draft';
    const isDraft = String(base.listingStatus || '').toLowerCase() === 'draft';
    if (!occ.length && !isDraft) return json(res, 400, { error: 'missing_dates' });

    try {
      const groups = await listGroupsForSession(auth.session);
      if (!groupOwnedBySession(auth.session, groups, groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }
      validateEventDescription(body);

      const seriesGroupId = resolveSeriesGroupId(null, occ.length);

      let events;
      if (!occ.length && isDraft) {
        const one = await createEvent({ ...base, date: '', endDate: '' });
        events = [one];
      } else if (occ.length === 1) {
        const one = await createEvent({
          ...base,
          seriesGroupId,
          date: occ[0].date,
          endDate: occ[0].endDate,
        });
        events = [one];
      } else {
        const result = await createEventsForOccurrences(
          { ...base, seriesGroupId },
          occ,
          seriesGroupId,
          null
        );
        events = result.events;
      }

      const eventIds = events.map((e) => e.id);
      return json(res, 201, {
        ok: true,
        event: events[0],
        events,
        eventIds,
        needsTickets: eventIds.length > 0,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'event_create_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const eventId = String(body.id || body.eventId || req.query?.id || '').trim();
    if (!eventId) return json(res, 400, { error: 'missing_event_id' });

    try {
      const { groups, allowed } = await ownedEventIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
        return json(res, 403, { error: 'event_not_owned' });
      }
      const { resolveOrganiserAccess } = require('../supabase-organiser-access');
      const access = await resolveOrganiserAccess(auth.session);
      if (!isPlatformAdmin(auth.session) && access && !access.canDeleteEvents) {
        return json(res, 403, {
          error: 'forbidden',
          message: 'Only the account owner can delete events. Editors can edit events instead.',
        });
      }
      const deleted = await deleteEventForSession(
        auth.session,
        eventId,
        groups.map((g) => g.id)
      );
      return json(res, 200, { ok: true, event: deleted, message: 'Event deleted.' });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'event_delete_failed',
        message: e.message,
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
