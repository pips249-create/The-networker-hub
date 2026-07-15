/**
 * City Partner — availability and self-serve checkout.
 *
 * GET  /api/city-partner
 * POST /api/city-partner  { email, cities: ['manchester', 'leeds'] }
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('./_lib/supabase');
const {
  getCityPartnerAvailability,
  validateCheckoutCities,
  calculateCityPartnerQuote,
  normalizeCitySlugs,
} = require('./_lib/networking-city-partners');
const {
  createCityPartnerCheckoutSession,
  isStripeCheckoutConfigured,
  siteBaseUrl,
} = require('./_lib/stripe-checkout');

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const cfg = supabaseConfig();
  if (!isSupabaseConfigured()) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message:
        'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, set DATA_PROVIDER=supabase, then Redeploy.',
      envCheck: {
        hasSupabaseUrl: Boolean(cfg.url),
        hasSupabaseServiceKey: Boolean(cfg.serviceKey),
      },
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const availability = await getCityPartnerAvailability(sb);

    if (req.method === 'GET') {
      const slugs = normalizeCitySlugs(req.query?.cities || req.query?.city || '');
      const quote =
        slugs.length > 0 ? calculateCityPartnerQuote(slugs.length) : null;
      return res.status(200).json({
        ok: true,
        configured: true,
        ...availability,
        quote,
      });
    }

    if (req.method === 'POST') {
      if (!isStripeCheckoutConfigured()) {
        return res.status(503).json({
          ok: false,
          error: 'stripe_not_configured',
          message: 'Online checkout is not available yet — email rosie@thenetworkerhub.com',
        });
      }

      const body = parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const cities = normalizeCitySlugs(body.cities);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'invalid_email' });
      }

      const validation = validateCheckoutCities(cities, availability);
      if (!validation.ok) {
        return res.status(409).json({
          ok: false,
          error: validation.error,
          unavailable: validation.unavailable || [],
          message: validation.message || 'Selected cities are not available',
        });
      }

      const base = siteBaseUrl();
      const session = await createCityPartnerCheckoutSession({
        email,
        cities: validation.cities,
        successUrl:
          base +
          '/advertising?city-partner=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: base + '/advertising?city-partner=cancelled',
      });

      return res.status(200).json({
        ok: true,
        checkoutUrl: session.url,
        quote: validation.quote,
        cities: validation.cities,
      });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: e.message,
    });
  }
};
