/**
 * POST /api/organiser/promote-action — log LinkedIn/Promote tool usage (authenticated).
 */
const { getOrganiserApi } = require('../organiser-provider');
const { recordPromoteAction } = require('../organiser-promote-log');
const { enforceRateLimit } = require('../rate-limit');
const { jsonPublicError } = require('../public-error');

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
  const { json, setCors, requireOrganiserSession } = getOrganiserApi();
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const limited = enforceRateLimit(req, res, 'organiser_promote_action', {
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

  const body = parseBody(req);
  const action = String(body.action || '')
    .trim()
    .toLowerCase();
  if (action === 'landing') {
    return json(res, 400, {
      ok: false,
      error: 'use_public_endpoint',
      message: 'Landing hits use /api/promote-analytics',
    });
  }

  try {
    const session = auth.session || {};
    const result = await recordPromoteAction({
      action,
      source: body.source || 'post_builder',
      organiserAccountId: session.organiserAccountId || session.accountId || session.sub || null,
      organiserId: body.organiserId || body.groupId || null,
      eventId: body.eventId || null,
      templateId: body.templateId || null,
      actorEmail: session.email || null,
      metadata: {
        templateGroup: body.templateGroup || null,
      },
    });
    if (!result.ok && result.error === 'invalid_action') {
      return json(res, 400, result);
    }
    return json(res, 200, result);
  } catch (e) {
    return jsonPublicError(res, json, e, { code: e.code || 'promote_action_failed', logLabel: '[organiser-promote-action]' });
  }
};
