const { getOrganiserApi } = require('../organiser-provider');

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
    type: String(body.type || body.format || 'Networking Event').trim(),
    description: String(body.description || '').trim(),
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
    photoUrl: String(body.photoUrl || body.imageUrl || '').trim(),
    photoBase64: body.photoBase64 || body.imageBase64 || null,
    photoMime: body.photoMime || body.imageMime || null,
    photoFilename: body.photoFilename || body.imageFilename || null,
  };
  if (body.listingStatus != null) {
    payload.listingStatus = body.listingStatus;
  } else if (body.publish === true || body.publish === 'true') {
    payload.listingStatus = 'published';
  }
  return payload;
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listGroupsForSession,
    listEventsForSession,
    groupOwnedBySession,
    createEvent,
    updateEvent,
    getEventById,
    isPlatformAdmin,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

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
    try {
      if (eventId) {
        const { groups, allowed } = await ownedEventIds();
        if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
          return json(res, 403, { error: 'event_not_owned' });
        }
        const event = await getEventById(eventId);
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
        return json(res, 200, { ok: true, event });
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
    const eventId = String(body.id || body.eventId || req.query?.id || '').trim();
    if (!eventId) return json(res, 400, { error: 'missing_event_id' });

    try {
      const { groups, allowed } = await ownedEventIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
        return json(res, 403, { error: 'event_not_owned' });
      }
      const occ = normalizeOccurrences(body);
      const base = eventPayloadFromBody(body, auth.session.email);
      if (!base.title) return json(res, 400, { error: 'missing_title' });
      if (!base.groupId) return json(res, 400, { error: 'missing_group' });
      if (!groupOwnedBySession(auth.session, groups, base.groupId)) {
        return json(res, 403, { error: 'group_not_owned' });
      }

      const isDraft =
        base.listingStatus != null && String(base.listingStatus).toLowerCase() === 'draft';
      const primary = occ[0] || {};
      const event = await updateEvent(eventId, {
        ...base,
        date: primary.date || (isDraft ? '' : primary.date),
        endDate: primary.endDate || '',
      });

      const extra = [];
      for (const o of occ.slice(1)) {
        extra.push(
          await createEvent({
            ...base,
            date: o.date,
            endDate: o.endDate,
          })
        );
      }

      const allIds = [event.id, ...extra.map((e) => e.id)];
      return json(res, 200, {
        ok: true,
        event,
        events: [event, ...extra],
        eventIds: allIds,
        needsTickets: allIds.length > 0,
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'event_update_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
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

      let events;
      if (!occ.length && isDraft) {
        const one = await createEvent({ ...base, date: '', endDate: '' });
        events = [one];
      } else if (occ.length === 1) {
        const one = await createEvent({
          ...base,
          date: occ[0].date,
          endDate: occ[0].endDate,
        });
        events = [one];
      } else {
        const created = [];
        for (const o of occ) {
          const ev = await createEvent({
            ...base,
            date: o.date,
            endDate: o.endDate,
          });
          created.push(ev);
        }
        events = created;
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
        error: 'event_create_failed',
        message: e.message,
        airtable: airtableSetupHint('events'),
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
