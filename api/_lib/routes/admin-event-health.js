const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { scanEventHealth } = require('../admin-event-health');
const {
  logEventHealthCompletion,
  fetchRecentHealthCompletions,
} = require('../admin-event-health-log');

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method === 'POST') {
    const body = parseBody(req);
    const eventId = body.event_id || body.eventId;
    const title = body.title || body.event_title;
    if (!eventId || !title) {
      return json(res, 400, { ok: false, error: 'missing_fields' });
    }
    try {
      const logged = await logEventHealthCompletion(
        {
          eventId,
          title,
          slug: body.slug || body.event_slug || '',
          fixedIssues: body.fixed_issues || body.fixedIssues || [],
        },
        session.email
      );
      return json(res, 200, { ok: true, log: logged });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'log_failed', message: e.message });
    }
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const [report, recentCompletions] = await Promise.all([
      scanEventHealth(),
      fetchRecentHealthCompletions(15),
    ]);
    return json(res, 200, {
      ok: true,
      ...report,
      recentCompletions,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: 'health_scan_failed', message: e.message });
  }
};
