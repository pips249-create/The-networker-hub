/**
 * GET click-through for email / Brevo sponsor logos.
 * Records into sponsor_clicks (Command Centre packs), then 302s to the destination.
 *
 *   /api/sponsor-out?u=<https dest>&p=<placement>&c=<company>
 */
const { setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { recordSponsorClick } = require('./_lib/sponsor-clicks');

const FALLBACK = 'https://www.thenetworkeruk.com/advertising';

function safeDest(raw) {
  const url = String(raw || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    // Avoid open-redirect loops back into this endpoint
    if (/\/api\/sponsor-out(?:\?|$)/i.test(parsed.pathname + parsed.search)) return '';
    return parsed.toString().slice(0, 500);
  } catch {
    return '';
  }
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', location);
  return res.end();
}

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  const limited = enforceRateLimit(req, res, 'sponsor_out_click', {
    max: 120,
    windowMs: 300_000,
  });
  if (!limited.allowed) {
    return redirect(res, FALLBACK);
  }

  const q = req.query || {};
  const dest = safeDest(q.u || q.url || q.to);
  const placement = String(q.p || q.placement || q.slot || 'email_sponsor').trim();
  const company = String(q.c || q.company || q.brand || '').trim();

  if (!dest) return redirect(res, FALLBACK);

  if (useSupabase()) {
    try {
      await recordSponsorClick({
        placement,
        company,
        url: dest,
        path: '/email',
      });
    } catch {
      /* still send the click through */
    }
  }

  return redirect(res, dest);
});