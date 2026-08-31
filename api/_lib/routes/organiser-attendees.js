const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { resolveOrganiserApiScope } = require('../organiser-api-scope');
const { jsonPublicError } = require('../public-error');
const {
  listBlocksForOrganiserIds,
  normalizeBlockEmail,
} = require('../organiser-attendee-blocks');

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    listAttendeesForOrganiserEvents,
    listBookingCancellationsForOrganiserEvents,
    summarizePendingApplicationsForEventIds,
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

    const { assertCanViewRegistrations } = require('../organiser-role-guard');
    const registrationGate = assertCanViewRegistrations(scope.access);
    if (!registrationGate.ok) {
      return json(res, registrationGate.status, {
        error: registrationGate.error,
        message: registrationGate.message,
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
    if (view === 'pending-summary' && summarizePendingApplicationsForEventIds) {
      const pendingApplications = await summarizePendingApplicationsForEventIds(eventIds);
      return json(res, 200, {
        ok: true,
        pendingApplications,
        view,
        eventCount: eventIds.length,
      });
    }
    let attendees = [];
    let cancellations = [];
    let blocks = [];
    try {
      if (view === 'cancellations' && listBookingCancellationsForOrganiserEvents) {
        cancellations = await listBookingCancellationsForOrganiserEvents(
          scope.groupIds,
          filterEventId,
          scope.adminView,
          eventIds
        );
      } else if (view === 'blocks') {
        blocks = await listBlocksForOrganiserIds(scope.groupIds || [], { status: 'active' });
      } else {
        attendees = await listAttendeesForOrganiserEvents(eventIds, filterEventId);
        blocks = await listBlocksForOrganiserIds(scope.groupIds || [], { status: 'active' });
        const blockKeys = new Set(
          (blocks || []).map((b) => String(b.organiserId || '') + '\0' + normalizeBlockEmail(b.email))
        );
        attendees = (attendees || []).map((a) => {
          const key = String(a.organiserId || '') + '\0' + normalizeBlockEmail(a.email);
          return { ...a, isBlocked: blockKeys.has(key) };
        });
      }
    } catch (e) {
      const code =
        view === 'cancellations'
          ? 'cancellations_fetch_failed'
          : view === 'blocks'
            ? 'blocks_fetch_failed'
            : 'attendees_fetch_failed';
      return jsonPublicError(res, json, e, {
        code,
        logLabel: '[organiser-attendees]',
        extra: { attendees: [], cancellations: [], blocks: [] },
      });
    }

    return json(res, 200, {
      ok: true,
      attendees,
      cancellations,
      blocks,
      view,
      eventCount: eventIds.length,
    });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: 'server_error', logLabel: '[organiser-attendees]', extra: { attendees: [] } });
  }
};
