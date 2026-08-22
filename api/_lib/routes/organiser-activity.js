/**
 * GET /api/organiser/activity — owner-only recent activity for this account.
 */
const { getOrganiserApi } = require('../organiser-provider');
const { resolveOrganiserAccess } = require('../supabase-organiser-access');
const { fetchAccountActivity } = require('../entity-activity-log');
const { enforceRateLimit } = require('../rate-limit');

module.exports = async function handler(req, res) {
  const { json, setCors, requireOrganiserSession } = getOrganiserApi();
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const limited = enforceRateLimit(req, res, 'organiser_activity', {
    max: 60,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  let limit = 40;
  if (req.url) {
    try {
      const params = new URL(req.url, 'https://internal.local').searchParams;
      limit = params.get('limit') || 40;
    } catch {
      /* keep default */
    }
  }

  try {
    const access = await resolveOrganiserAccess(auth.session);
    if (!access?.canManageTeam) {
      return json(res, 403, {
        ok: false,
        error: 'owner_only',
        message: 'Only the account owner can view team activity history.',
      });
    }

    const report = await fetchAccountActivity({
      groupIds: access.groupIds || [],
      accountId: access.accountId || null,
      limit,
    });

    return json(res, 200, {
      ok: true,
      ...report,
      items: (report.items || []).map((item) => {
        const role = String(item.actorRole || '').toLowerCase();
        if (role === 'admin') {
          return { ...item, actorEmail: '' };
        }
        return item;
      }),
    });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || 'activity_failed',
      message: e.message || 'Could not load activity.',
    });
  }
};
