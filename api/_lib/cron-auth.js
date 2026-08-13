const { json } = require('./auth');

/**
 * Authorize Vercel Cron (or manual) invocations.
 * Vercel sends Authorization: Bearer <CRON_SECRET>.
 *
 * Fail-closed on any Vercel deployment (production + preview). Local `vercel dev`
 * may omit the secret so crons stay testable without env gymnastics.
 */
function authorizeCron(req, res) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  const onVercel = Boolean(process.env.VERCEL);
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  const isHosted =
    onVercel || vercelEnv === 'production' || vercelEnv === 'preview';

  if (!secret) {
    if (isHosted) {
      json(res, 503, {
        ok: false,
        error: 'cron_secret_not_configured',
        message:
          'Set CRON_SECRET in Vercel → Project → Settings → Environment Variables (Production and Preview), then redeploy.',
      });
      return false;
    }
    return true;
  }

  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader !== 'Bearer ' + secret) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }

  return true;
}

function cronConfigStatus() {
  const hasCronSecret = Boolean(String(process.env.CRON_SECRET || '').trim());
  const onVercel = Boolean(process.env.VERCEL);
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  const isProduction = vercelEnv === 'production';
  const isPreview = vercelEnv === 'preview';
  return {
    hasCronSecret,
    isProduction,
    isPreview,
    // Hosted Vercel always needs the secret; local may run without it.
    cronReady: hasCronSecret || (!onVercel && !isProduction && !isPreview),
  };
}

module.exports = {
  authorizeCron,
  cronConfigStatus,
};
