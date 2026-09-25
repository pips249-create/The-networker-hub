/**
 * Event intake API — organisers send details for staff to list (signed-in only).
 */
const {
  json,
  setCors,
  sessionFromRequest,
  sessionWithLiveAdminRole,
  organiserPersonalScopeFromRequest,
  isAdminRole,
} = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit, clientIp } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { submitEventIntake, pickOwnedOrganiser } = require('./_lib/event-intake');
const { listAccessibleGroupsForSession } = require('./_lib/supabase-organiser-access');
const { verifyTurnstileToken } = require('./_lib/turnstile');

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

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const session = sessionFromRequest(req);
  const sessionEmail = session?.email ? String(session.email).trim().toLowerCase() : '';
  if (!sessionEmail) {
    return json(res, 401, {
      ok: false,
      error: 'not_authenticated',
      message: 'Sign in or create a free account to send your event details.',
    });
  }

  const limited = enforceRateLimit(req, res, 'event_intake', {
    max: 8,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message: 'Too many submissions. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      ok: false,
      error: 'not_configured',
      message: 'Online submissions are not available yet — email hi@thenetworkeruk.com.',
    });
  }

  const body = parseBody(req);
  const captcha = await verifyTurnstileToken(
    body.turnstileToken || body['cf-turnstile-response'],
    clientIp(req)
  );
  if (!captcha.ok) {
    return json(res, 400, {
      ok: false,
      error: captcha.error || 'captcha_failed',
      message: 'Please complete the security check and try again.',
    });
  }

  // Prefer account identity so submissions stay tied to the signed-in user.
  const intakeBody = Object.assign({}, body, {
    email: sessionEmail,
    name:
      String(body.name || body.contactName || session.name || '').trim() ||
      sessionEmail.split('@')[0] ||
      'Organiser',
  });

  try {
    const liveSession = await sessionWithLiveAdminRole(session);
    const adminView = isAdminRole(liveSession.role) && !organiserPersonalScopeFromRequest(req);
    const { groups } = await listAccessibleGroupsForSession(liveSession, adminView);
    const owned = pickOwnedOrganiser(
      groups,
      body.organiserId || body.organiser_id
    );
    if (!owned) {
      const hasPages = Array.isArray(groups) && groups.length > 0;
      return json(res, 400, {
        ok: false,
        error: hasPages ? 'organiser_not_owned' : 'missing_organiser_page',
        message: hasPages
          ? 'Choose one of your organiser pages.'
          : 'Create your organiser page before sending event details. We add the event to that page.',
      });
    }
    intakeBody.organiserId = owned.id;
    intakeBody.group = String(owned.name || '').trim() || intakeBody.group;
    if (!String(intakeBody.organiserWebsiteUrl || intakeBody.organiser_website_url || '').trim() && owned.website) {
      intakeBody.organiserWebsiteUrl = owned.website;
    }

    const result = await submitEventIntake(intakeBody);
    if (!result.ok) {
      return json(res, 400, {
        ok: false,
        error: result.error,
        message: result.message,
      });
    }
    return json(res, 200, result);
  } catch (e) {
    const code = e.code || 'intake_failed';
    const status = code === 'not_configured' ? 503 : 500;
    return json(res, status, {
      ok: false,
      error: code,
      message: e.message || 'Could not send your event details.',
    });
  }
});