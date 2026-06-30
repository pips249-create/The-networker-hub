const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const {
  getRankingAdminReport,
  runMonthlyOrganiserRankingSnapshot,
} = require('../organiser-ranking-snapshot');

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

  if (req.method === 'GET') {
    try {
      const snapshotId = String(req.query?.snapshot_id || '').trim();
      const report = await getRankingAdminReport(snapshotId ? { snapshotId } : {});
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'rankings_report_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const action = String(body.action || 'run_snapshot').trim();

    if (action === 'run_snapshot') {
      try {
        const result = await runMonthlyOrganiserRankingSnapshot({
          triggeredBy: 'admin',
          sendEmails: body.sendEmails !== false,
          periodKey: body.periodKey || undefined,
          periodLabel: body.periodLabel || undefined,
        });
        return json(res, 200, result);
      } catch (e) {
        return json(res, 500, {
          ok: false,
          error: 'ranking_snapshot_failed',
          message: e.message,
        });
      }
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
