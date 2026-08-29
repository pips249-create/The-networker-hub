const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified, isPublishIntent } = require('../organiser-access-guard');
const { assertDescriptionLimit } = require('../text-limits');
const { adminViewFromSession, resolveOrganiserGroupScope } = require('../organiser-api-scope');
const { jsonPublicError } = require('../public-error');
const { coerceUuid, hasIdInput } = require('../uuid');

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

const INVALID_EVENT_ID = {
  error: 'invalid_event_id',
  message: 'That event id is not valid.',
};

/** Read an event id from query/body, recovering glued "?id=" suffixes. */
function readEventId(raw, opts) {
  const required = Boolean(opts && opts.required);
  if (!hasIdInput(raw)) {
    return required ? { error: 'missing_event_id' } : { eventId: '' };
  }
  const eventId = coerceUuid(raw);
  if (!eventId) return { error: 'invalid_event_id', body: INVALID_EVENT_ID };
  return { eventId };
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listEventsForSession,
    listEventsForSeriesGroup,
    groupOwnedBySession,
    filterOwnedEventIds,
    createEvent,
    createEventsForOccurrences,
    updateEvent,
    syncSeriesOccurrencesForEvent,
    deleteEventForSession,
    duplicateEventForSession,
    getEventById,
    republishEvent,
    resolveSeriesGroupId,
    isPlatformAdmin,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const EVENT_NOT_OWNED = {
    error: 'event_not_owned',
    message:
      'This event is not on the organiser pages for this account. If you are impersonating, impersonate the group that owns the listing, then open it from My Events.',
  };

  function sessionOwnsGroup(session, groups, groupIds, groupId) {
    if (groupOwnedBySession(session, groups, groupId)) return true;
    const id = String(groupId || '').trim();
    return Boolean(id && (groupIds || []).includes(id));
  }

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

  /** Prefer id+group checks — listing the full catalogue can miss drafts (row caps). */
  async function sessionGroups() {
    const { adminView } = adminViewFromSession(auth.session, req);
    const scope = await resolveOrganiserGroupScope(auth.session, adminView);
    return {
      groups: scope.groups,
      groupIds: scope.groupIds,
      adminView,
      access: scope.access,
    };
  }

  function stripEventsForAccess(events, access) {
    const { isMarketingAccess, stripEventSalesFields } = require('../organiser-marketing-workspace');
    if (!isMarketingAccess(access) || !Array.isArray(events)) return events;
    return events.map(stripEventSalesFields);
  }

  async function requireManageEventsAccess() {
    const { resolveOrganiserRoleAccess, assertCanManageEvents } = require('../organiser-role-guard');
    const roleAccess = await resolveOrganiserRoleAccess(auth.session);
    if (!roleAccess.ok) return roleAccess;
    return assertCanManageEvents(roleAccess.access);
  }

  async function assertOwnsEventId(eventId) {
    const { groups, groupIds, adminView, access } = await sessionGroups();
    if (adminView) return { ok: true, groups, groupIds, adminView, access };
    const owned = await filterOwnedEventIds([eventId], groupIds, false);
    if (!owned.length) return { ok: false, groups, groupIds, adminView, access };
    return { ok: true, groups, groupIds, adminView, access };
  }

  if (req.method === 'GET') {
    const parsedEventId = readEventId(req.query?.id || req.query?.eventId);
    const parsedSeriesId = readEventId(req.query?.seriesGroupId || req.query?.series_group_id);
    if (parsedEventId.error === 'invalid_event_id') return json(res, 400, parsedEventId.body);
    if (parsedSeriesId.error === 'invalid_event_id') {
      return json(res, 400, { error: 'invalid_series_group_id', message: INVALID_EVENT_ID.message });
    }
    const eventId = parsedEventId.eventId;
    const seriesGroupId = parsedSeriesId.eventId;
    try {
      if (seriesGroupId) {
        const { groupIds, access } = await sessionGroups();
        const events = stripEventsForAccess(
          await listEventsForSeriesGroup(groupIds, seriesGroupId),
          access
        );
        return json(res, 200, { ok: true, events });
      }
      if (eventId) {
        const ownership = await assertOwnsEventId(eventId);
        if (!ownership.ok) return json(res, 403, EVENT_NOT_OWNED);
        const event = await getEventById(eventId);
        let enriched = event;
        if (!require('../organiser-marketing-workspace').isMarketingAccess(ownership.access)) {
          try {
            const { enrichEventsWithRegistrationSales } = require('../supabase-organiser-payouts');
            const [withSales] = await enrichEventsWithRegistrationSales([event]);
            enriched = withSales || event;
          } catch {
            /* sales enrichment optional */
          }
        } else {
          enriched = require('../organiser-marketing-workspace').stripEventSalesFields(event);
        }
        return json(res, 200, { ok: true, event: enriched });
      }
      const { groups, groupIds, access } = await sessionGroups();
      const events = stripEventsForAccess(
        await listEventsForSession(auth.session, groupIds, []),
        access
      );
      return json(res, 200, { ok: true, events, groups });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: 'events_fetch_failed', logLabel: '[organiser-events]', extra: { airtable: airtableSetupHint('events') } });
    }
  }

  if (req.method === 'PATCH') {
    const manageGate = await requireManageEventsAccess();
    if (!manageGate.ok) {
      return json(res, manageGate.status, { error: manageGate.error, message: manageGate.message });
    }
    const body = parseBody(req);
    const publishBlocked = await requireVerifiedForPublish(body);
    if (publishBlocked) return publishBlocked;
    const parsedId = readEventId(body.id || body.eventId || req.query?.id, { required: true });
    if (parsedId.error) return json(res, 400, parsedId.body || { error: parsedId.error });
    const eventId = parsedId.eventId;

    try {
      const access = await assertOwnsEventId(eventId);
      if (!access.ok) return json(res, 403, EVENT_NOT_OWNED);
      const { groups } = access;
      validateEventDescription(body);
      const occ = normalizeOccurrences(body);
      const base = eventPayloadFromBody(body, auth.session.email);
      if (!base.title) return json(res, 400, { error: 'missing_title' });
      if (!base.groupId) return json(res, 400, { error: 'missing_group' });
      if (!sessionOwnsGroup(auth.session, groups, access.groupIds, base.groupId)) {
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

      try {
        const { resolveOrganiserAccess } = require('../supabase-organiser-access');
        const { logFromSession, changedKeys } = require('../entity-activity-log');
        const access = await resolveOrganiserAccess(auth.session);
        const updated = synced.event || synced.events[0] || {};
        const keys = changedKeys(existing, updated, [
          'title',
          'listingStatus',
          'status',
          'date',
          'startsAt',
          'location',
          'venue',
          'city',
          'description',
          'eventFormat',
          'onlineLink',
        ]);
        const statusChanged =
          String(existing?.listingStatus || existing?.status || '') !==
          String(updated?.listingStatus || updated?.status || base.listingStatus || '');
        await logFromSession(auth.session, access, {
          entity_type: 'event',
          entity_id: eventId,
          organiser_id: base.groupId || existing?.groupId || existing?.organiserId || null,
          action: statusChanged ? 'event_status_updated' : 'event_updated',
          summary:
            (statusChanged ? 'Updated event status' : 'Updated event') +
            (updated?.title ? ': ' + String(updated.title).slice(0, 80) : '') +
            (keys.length ? ' (' + keys.slice(0, 6).join(', ') + ')' : ''),
          metadata: { changedFields: keys, listingStatus: base.listingStatus || null },
        });
      } catch {
        /* activity log must not block saves */
      }

      return json(res, 200, {
        ok: true,
        event: synced.event || synced.events[0],
        events: synced.events,
        eventIds: synced.eventIds,
        needsTickets: synced.eventIds.length > 0,
      });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: e.code || 'event_update_failed', logLabel: '[organiser-events]', extra: { airtable: airtableSetupHint('events') } });
    }
  }

  if (req.method === 'POST') {
    const manageGate = await requireManageEventsAccess();
    if (!manageGate.ok) {
      return json(res, manageGate.status, { error: manageGate.error, message: manageGate.message });
    }
    const body = parseBody(req);
    const publishBlocked = await requireVerifiedForPublish(body);
    if (publishBlocked) return publishBlocked;

    if (String(body.action || '').trim() === 'duplicate') {
      const parsedId = readEventId(body.id || body.eventId, { required: true });
      if (parsedId.error) return json(res, 400, parsedId.body || { error: parsedId.error });
      const eventId = parsedId.eventId;
      try {
        const access = await assertOwnsEventId(eventId);
        if (!access.ok) return json(res, 403, EVENT_NOT_OWNED);
        const result = await duplicateEventForSession(
          auth.session,
          eventId,
          access.groupIds
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
        return jsonPublicError(res, json, e, { code: e.code || 'event_duplicate_failed', logLabel: '[organiser-events]' });
      }
    }

    if (String(body.action || '').trim() === 'unpublish') {
      const parsedId = readEventId(body.id || body.eventId, { required: true });
      if (parsedId.error) return json(res, 400, parsedId.body || { error: parsedId.error });
      const eventId = parsedId.eventId;
      try {
        const access = await assertOwnsEventId(eventId);
        if (!access.ok) return json(res, 403, EVENT_NOT_OWNED);
        const updated = await updateEvent(eventId, { listingStatus: 'unpublished' });
        try {
          const { resolveOrganiserAccess } = require('../supabase-organiser-access');
          const { logFromSession } = require('../entity-activity-log');
          const access = await resolveOrganiserAccess(auth.session);
          await logFromSession(auth.session, access, {
            entity_type: 'event',
            entity_id: eventId,
            organiser_id: updated?.groupId || updated?.organiserId || null,
            action: 'event_unpublished',
            summary: 'Unpublished event' + (updated?.title ? ': ' + String(updated.title).slice(0, 80) : ''),
          });
        } catch {
          /* ignore */
        }
        return json(res, 200, {
          ok: true,
          event: updated,
          message: 'Event unpublished — it is hidden from Browse events.',
        });
      } catch (e) {
        return jsonPublicError(res, json, e, { code: e.code || 'event_unpublish_failed', logLabel: '[organiser-events]' });
      }
    }

    if (String(body.action || '').trim() === 'republish') {
      const parsedId = readEventId(body.id || body.eventId, { required: true });
      if (parsedId.error) return json(res, 400, parsedId.body || { error: parsedId.error });
      const eventId = parsedId.eventId;
      try {
        const access = await assertOwnsEventId(eventId);
        if (!access.ok) return json(res, 403, EVENT_NOT_OWNED);
        const updated = await republishEvent(eventId);
        try {
          const { resolveOrganiserAccess } = require('../supabase-organiser-access');
          const { logFromSession } = require('../entity-activity-log');
          const access = await resolveOrganiserAccess(auth.session);
          await logFromSession(auth.session, access, {
            entity_type: 'event',
            entity_id: eventId,
            organiser_id: updated?.groupId || updated?.organiserId || null,
            action: 'event_republished',
            summary: 'Republished event' + (updated?.title ? ': ' + String(updated.title).slice(0, 80) : ''),
          });
        } catch {
          /* ignore */
        }
        return json(res, 200, {
          ok: true,
          event: updated,
          message: 'Event republished — it is live on Browse events again.',
        });
      } catch (e) {
        return jsonPublicError(res, json, e, { code: e.code || 'event_republish_failed', logLabel: '[organiser-events]' });
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
      const { groups, groupIds } = await sessionGroups();
      if (!sessionOwnsGroup(auth.session, groups, groupIds, groupId)) {
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
      if (auth.session && auth.session.impersonator && auth.session.impersonator.email) {
        try {
          const { logOutreachFromEventCreate } = require('../organiser-sales-outreach');
          await logOutreachFromEventCreate({
            adminEmail: auth.session.impersonator.email,
            organiserId: groupId,
            eventTitle: title,
          });
        } catch (logErr) {
          console.warn('[organiser-events] outreach log', logErr && logErr.message ? logErr.message : logErr);
        }
      }
      return json(res, 201, {
        ok: true,
        event: events[0],
        events,
        eventIds,
        needsTickets: eventIds.length > 0,
      });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: e.code || 'event_create_failed', logLabel: '[organiser-events]', extra: { airtable: airtableSetupHint('events') } });
    }
  }

  if (req.method === 'DELETE') {
    const manageGate = await requireManageEventsAccess();
    if (!manageGate.ok) {
      return json(res, manageGate.status, { error: manageGate.error, message: manageGate.message });
    }
    const body = parseBody(req);
    const parsedId = readEventId(body.id || body.eventId || req.query?.id, { required: true });
    if (parsedId.error) return json(res, 400, parsedId.body || { error: parsedId.error });
    const eventId = parsedId.eventId;

    try {
      const eventAccess = await assertOwnsEventId(eventId);
      if (!eventAccess.ok) return json(res, 403, EVENT_NOT_OWNED);
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
        eventAccess.groupIds
      );
      try {
        const { logFromSession } = require('../entity-activity-log');
        await logFromSession(auth.session, access, {
          entity_type: 'event',
          entity_id: eventId,
          organiser_id: deleted?.groupId || deleted?.organiserId || null,
          action: 'event_deleted',
          summary: 'Deleted event' + (deleted?.title ? ': ' + String(deleted.title).slice(0, 80) : ''),
        });
      } catch {
        /* ignore */
      }
      return json(res, 200, { ok: true, event: deleted, message: 'Event deleted.' });
    } catch (e) {
      return jsonPublicError(res, json, e, { code: e.code || 'event_delete_failed', logLabel: '[organiser-events]' });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
