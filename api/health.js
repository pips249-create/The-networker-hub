/**
 * GET /api/health — lightweight uptime probe (no secrets).
 * Safe to poll from UptimeRobot / Better Stack while the site gate is on.
 */
const { isSupabaseConfigured } = require('./_lib/supabase');
const { wrapHandler } = require('./_lib/sentry');

module.exports = wrapHandler(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const body = {
    ok: true,
    service: 'the-networker-hub',
    ts: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV || null,
    supabaseConfigured: isSupabaseConfigured(),
  };

  res.statusCode = 200;
  if (req.method === 'HEAD') return res.end();
  return res.end(JSON.stringify(body));
});