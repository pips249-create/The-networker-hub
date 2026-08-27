const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');

module.exports = async function handler(req, res) {
  const startedAt = Date.now();
  const api = getOrganiserApi();
  const { json, setCors, getOrganiserWorkspaceStats } = api;
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const ws = await getOrganiserWorkspaceStats(req);
    if (!ws.ok && ws.error === 'not_authenticated') {
      return json(res, ws.status || 401, { error: ws.error });
    }
    if (!ws.ok && ws.error === 'missing_email') {
      return json(res, ws.status || 403, { error: ws.error });
    }
    if (!ws.ok) {
      return json(res, ws.status || 500, { error: ws.error, message: ws.message });
    }

    res.setHeader(
      'Server-Timing',
      'organiser-workspace-stats;dur=' + String(Date.now() - startedAt)
    );

    return json(res, 200, {
      ok: true,
      workspaceSummary: ws.workspaceSummary?.computed ? ws.workspaceSummary : null,
      stats: {
        ticketsSold: ws.workspaceSummary?.computed ? ws.workspaceSummary.totalTicketsSold : null,
        revenue: ws.workspaceSummary?.computed ? ws.workspaceSummary.totalRevenue : null,
      },
    });
  } catch (e) {
    return jsonPublicError(res, json, e, { code: 'server_error', logLabel: '[organiser-workspace-stats]' });
  }
};
