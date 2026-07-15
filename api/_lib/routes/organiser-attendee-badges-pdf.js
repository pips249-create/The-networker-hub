const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { resolveOrganiserApiScope } = require('../organiser-api-scope');
const { buildNameBadgesPdf } = require('../organiser-name-badges-pdf');

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, listAttendeesForOrganiserEvents } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'private, no-store');

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
      });
    }

    const verified = await assertOrganiserEmailVerified(scope.session);
    if (!verified.ok) {
      return json(res, verified.status, {
        error: verified.error,
        message: verified.message,
      });
    }

    const url = new URL(req.url, 'http://localhost');
    const filterEventId = url.searchParams.get('eventId') || 'all';
    const eventIds = scope.eventIds || [];
    const attendees = await listAttendeesForOrganiserEvents(eventIds, filterEventId);
    const eventTitle =
      filterEventId && filterEventId !== 'all'
        ? String(
            attendees.find((a) => a.eventId === filterEventId)?.eventTitle || 'Event'
          ).trim()
        : 'All events';

    let pdf;
    try {
      pdf = buildNameBadgesPdf(attendees, { eventTitle });
    } catch (e) {
      return json(res, e.status || 400, {
        error: 'badges_unavailable',
        message: e.message || 'Could not build name badges',
      });
    }

    const suffix =
      filterEventId && filterEventId !== 'all'
        ? String(filterEventId).replace(/^rec/, '').slice(0, 8)
        : 'all-events';
    const filename = 'name-badges-' + suffix + '.pdf';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.end(pdf);
  } catch (e) {
    return json(res, 500, {
      error: 'badges_pdf_failed',
      message: e.message || String(e),
    });
  }
};
