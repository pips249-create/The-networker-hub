const { json } = require('./auth');

/**
 * Authorize Vercel Cron (or manual) invocations.
 * Production requires CRON_SECRET; Vercel sends Authorization: Bearer <CRON_SECRET>.
 */
function authorizeCron(req, res) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      json(res, 503, {
        ok: false,
        error: 'cron_secret_not_configured',
        message:
          'Set CRON_SECRET in Vercel → Project → Settings → Environment Variables (Production), then redeploy.',
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
  const isProduction = process.env.VERCEL_ENV === 'production';
  return {
    hasCronSecret,
    isProduction,
    cronReady: !isProduction || hasCronSecret,
  };
}

module.exports = {
  authorizeCron,
  cronConfigStatus,
};
