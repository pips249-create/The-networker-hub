const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { resolveOrganiserApiScope } = require('../organiser-api-scope');

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    listAttendeesForOrganiserEvents,
    listBookingCancellationsForOrganiserEvents,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (!listAttendeesForOrganiserEvents) {
    return json(res, 501, { error: 'attendees_not_supported' });
  }

  try {
    const scope = await resolveOrganiserApiScope(req);
    if (!scope.ok && scope.error === 'not_authenticated') {
      return json(res, scope.status || 401, { error: scope.error });
    }
    if (!scope.ok) {
      return json(res, scope.status || 500, {
        error: scope.error,
        message: scope.message,
        attendees: [],
      });
    }

    const verified = await assertOrganiserEmailVerified(scope.session);
    if (!verified.ok) {
      return json(res, verified.status, {
        error: verified.error,
        message: verified.message,
        attendees: [],
      });
    }

    const url = new URL(req.url, 'http://localhost');
    const filterEventId = url.searchParams.get('eventId') || 'all';
    const view = String(url.searchParams.get('view') || 'active').toLowerCase();
    const eventIds = scope.eventIds || [];
    let attendees = [];
    let cancellations = [];
    try {
      if (view === 'cancellations' && listBookingCancellationsForOrganiserEvents) {
        cancellations = await listBookingCancellationsForOrganiserEvents(
          scope.groupIds,
          filterEventId,
          scope.adminView,
          eventIds
        );
      } else {
        attendees = await listAttendeesForOrganiserEvents(eventIds, filterEventId);
      }
    } catch (e) {
      return json(res, 500, {
        error: view === 'cancellations' ? 'cancellations_fetch_failed' : 'attendees_fetch_failed',
        message: e.message,
        attendees: [],
        cancellations: [],
      });
    }

    return json(res, 200, {
      ok: true,
      attendees,
      cancellations,
      view,
      eventCount: eventIds.length,
      airtable: airtableSetupHint && airtableSetupHint('events'),
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message, attendees: [] });
  }
};
