/**
 * Public organiser browse API.
 *
 * GET /api/organisers
 * GET /api/organisers?slug=harbour-city-hosts
 * GET /api/organisers?id=uuid
 * POST /api/organisers { action: 'claim_request', ... }
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const {
  listPublicOrganisers,
  getPublicOrganiserBySlug,
  getPublicOrganiserById,
} = require('./_lib/supabase-organisers-browse');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    if (req.method === 'POST') {
      return json(res, 503, {
        ok: false,
        configured: false,
        error: 'not_configured',
        message: 'Claim requests are unavailable until Supabase is configured.',
      });
    }
    return res.status(200).json({
      configured: false,
      provider: 'supabase',
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      organisers: [],
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    const action = String(body.action || '').trim().toLowerCase();
    if (action !== 'claim_request') {
      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    const limited = enforceRateLimit(req, res, 'organiser_claim', { max: 5, windowMs: 600_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        ok: false,
        error: 'rate_limited',
        message: 'Too many claim requests. Please wait a while and try again.',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    try {
      const { createOrganiserClaimRequest } = require('./_lib/organiser-claim-request');
      const result = await createOrganiserClaimRequest(body);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_claimable') {
        return json(res, 400, {
          ok: false,
          error: 'not_claimable',
          message: 'This profile is not available to claim through the hub.',
        });
      }
      if (msg === 'invalid_email' || msg === 'missing_name' || msg === 'missing_organiser_id') {
        return json(res, 400, { ok: false, error: msg });
      }
      return json(res, 500, { ok: false, error: 'claim_request_failed', message: msg });
    }
  }

  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  res.setHeader('Cache-Control', 'public, max-age=60');

  try {
    const slug = req.query?.slug;
    const id = req.query?.id;

    if (slug || id) {
      const organiser = slug
        ? await getPublicOrganiserBySlug(slug)
        : await getPublicOrganiserById(id);
      if (!organiser) {
        return res.status(404).json({
          configured: true,
          provider: 'supabase',
          error: 'not_found',
          message: 'This organiser profile is not published.',
          organiser: null,
        });
      }
      return res.status(200).json({ configured: true, provider: 'supabase', organiser });
    }

    const organisers = await listPublicOrganisers();
    return res.status(200).json({ configured: true, provider: 'supabase', organisers });
  } catch (e) {
    return res.status(500).json({
      configured: true,
      provider: 'supabase',
      error: 'server_error',
      message: e.message,
      organisers: [],
    });
  }
};
