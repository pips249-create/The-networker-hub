const { getOrganiserApi } = require('../organiser-provider');
const { jsonPublicError } = require('../public-error');
const {
  listOpenDaysForOpportunity,
  replaceOpenDaysForOpportunity,
  listOpenDayInterestsForSession,
  updateOpenDayInterestStatus,
} = require('../opportunity-open-days');

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    getOpportunityById,
    opportunityOwnedBySession,
  } = api;
  const { isPlatformAdmin } = require('../organiser');

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'GET') {
    const opportunityId = String(req.query?.opportunityId || req.query?.id || '').trim();
    const interestsOnly =
      String(req.query?.interests || '').trim() === '1' ||
      String(req.query?.view || '').trim() === 'interests';

    try {
      if (interestsOnly || !opportunityId) {
        const interests = await listOpenDayInterestsForSession(auth.session);
        const newCount = interests.filter((i) => i.status === 'new').length;
        return json(res, 200, { ok: true, interests, newCount });
      }

      if (!isUuid(opportunityId)) {
        return json(res, 400, { ok: false, error: 'invalid_opportunity_id' });
      }
      const opportunity = await getOpportunityById(opportunityId);
      if (!opportunity) return json(res, 404, { ok: false, error: 'not_found' });
      if (
        !isPlatformAdmin(auth.session) &&
        !opportunityOwnedBySession(auth.session, opportunity)
      ) {
        return json(res, 403, { ok: false, error: 'opportunity_not_owned' });
      }
      const openDays = await listOpenDaysForOpportunity(opportunityId, {
        includeInterestCounts: true,
      });
      return json(res, 200, { ok: true, openDays });
    } catch (e) {
      return jsonPublicError(res, json, e, {
        code: 'open_days_fetch_failed',
        logLabel: '[organiser-opportunity-open-days]',
      });
    }
  }

  if (req.method === 'PUT') {
    const body = parseBody(req);
    const opportunityId = String(body.opportunityId || body.id || '').trim();
    if (!isUuid(opportunityId)) {
      return json(res, 400, { ok: false, error: 'invalid_opportunity_id' });
    }
    try {
      const openDays = await replaceOpenDaysForOpportunity(
        opportunityId,
        body.openDays || body.days || [],
        auth.session
      );
      return json(res, 200, { ok: true, openDays });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_found') return json(res, 404, { ok: false, error: 'not_found' });
      if (msg === 'opportunity_not_owned') {
        return json(res, 403, { ok: false, error: 'opportunity_not_owned' });
      }
      if (
        msg === 'missing_open_day_starts_at' ||
        msg === 'invalid_open_day_starts_at' ||
        msg === 'missing_open_day_address' ||
        msg === 'invalid_open_day_ends_at' ||
        msg === 'open_day_ends_before_start' ||
        msg === 'too_many_open_days' ||
        msg === 'open_days_unavailable'
      ) {
        return json(res, 400, {
          ok: false,
          error: msg,
          message:
            msg === 'open_days_unavailable'
              ? 'Open days are not available yet — ask the Hub team to apply the open days database migration.'
              : undefined,
        });
      }
      return jsonPublicError(res, json, e, {
        code: 'open_days_save_failed',
        logLabel: '[organiser-opportunity-open-days]',
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const interestId = String(body.interestId || body.id || '').trim();
    const status = String(body.status || '').trim();
    if (!interestId) return json(res, 400, { error: 'missing_interest_id' });
    if (!status) return json(res, 400, { error: 'missing_status' });
    try {
      const interest = await updateOpenDayInterestStatus(interestId, auth.session, status);
      return json(res, 200, { ok: true, interest });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_found') return json(res, 404, { error: 'not_found' });
      if (msg === 'invalid_status') return json(res, 400, { error: 'invalid_status' });
      return json(res, 500, { error: 'interest_update_failed', message: msg });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
