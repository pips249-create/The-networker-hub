/**
 * City Partner — availability and self-serve checkout.
 *
 * Mounted at GET/POST /api/city-partner via cms-block rewrite
 * (keeps serverless function count within Vercel Hobby limits).
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('../supabase');
const {
  getCityPartnerAvailability,
  validateCheckoutCities,
  calculateCityPartnerQuote,
  normalizeCitySlugs,
} = require('../networking-city-partners');
const {
  createCityPartnerCheckoutSession,
  isStripeCheckoutConfigured,
  retrieveCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const { joinCityPartnerWaitlist, cityPartnerWaitlistStatus } = require('../city-partner-waitlist');
const { isCityPartnerMetadata } = require('../city-partner-subscriptions');
const { enforceRateLimit } = require('../rate-limit');

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
      const action = String(req.query?.action || '').trim().toLowerCase();
      if (action === 'verify') {
        const sessionId = String(req.query?.session_id || req.query?.sessionId || '').trim();
        if (!sessionId) {
          return res.status(400).json({ ok: false, error: 'missing_session_id' });
        }
        if (!isStripeCheckoutConfigured()) {
          return res.status(503).json({ ok: false, error: 'stripe_not_configured' });
        }

        const session = await retrieveCheckoutSession(sessionId);
        const metadata = session?.metadata || {};
        if (!isCityPartnerMetadata(metadata)) {
          return res.status(400).json({ ok: false, error: 'invalid_checkout_session' });
        }
        if (String(session?.payment_status || '').toLowerCase() !== 'paid') {
          return res.status(409).json({ ok: false, error: 'payment_not_completed' });
        }

        const cities = normalizeCitySlugs(metadata.networking_cities || metadata.networkingCities || '');
        const email = String(
          session.customer_details?.email || session.customer_email || metadata.sponsor_email || ''
        )
          .trim()
          .toLowerCase();

        return res.status(200).json({
          ok: true,
          verified: true,
          cities,
          email,
          sessionId,
        });
      }

      const slugs = normalizeCitySlugs(req.query?.cities || req.query?.city || '');
      const quote =
        slugs.length > 0 ? calculateCityPartnerQuote(slugs.length) : null;
      const waitlistEmail = String(req.query?.waitlistEmail || req.query?.email || '')
        .trim()
        .toLowerCase();
      let waitlist = null;
      if (waitlistEmail) {
        waitlist = await cityPartnerWaitlistStatus(
          waitlistEmail,
          slugs.length ? slugs : (availability.bookedCities || []).map((c) => c.slug)
        );
      }
      return res.status(200).json({
        ok: true,
        configured: true,
        ...availability,
        quote,
        waitlist,
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || body.intent || 'checkout').trim().toLowerCase();

      if (action === 'waitlist') {
        const limited = enforceRateLimit(req, res, 'city_partner_waitlist', {
          max: 8,
          windowMs: 300_000,
        });
        if (!limited.allowed) {
          return res.status(429).json({
            ok: false,
            error: 'rate_limited',
            message: 'Too many waitlist attempts. Please try again shortly.',
            retryAfterSec: limited.retryAfterSec,
          });
        }

        const result = await joinCityPartnerWaitlist(body.email, body.cities || body.city, {
          companyName: body.companyName || body.company_name,
        });
        if (!result.ok) {
          return res.status(400).json(result);
        }
        return res.status(200).json(result);
      }

      if (!isStripeCheckoutConfigured()) {
        return res.status(503).json({
          ok: false,
          error: 'stripe_not_configured',
          message: 'Online checkout is not available yet — email rosie@thenetworkerhub.com',
        });
      }

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
