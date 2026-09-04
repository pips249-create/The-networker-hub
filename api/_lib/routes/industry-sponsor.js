/**
 * Industry Sponsor — availability and self-serve checkout.
 * Mounted at GET/POST /api/industry-sponsor via cms-block rewrite.
 */
const { getSupabaseAdmin, isSupabaseConfigured, supabaseConfig } = require('../supabase');
const {
  getIndustrySponsorAvailability,
  validateCheckoutIndustries,
  calculateIndustrySponsorQuote,
  normalizeIndustrySlugs,
} = require('../opportunity-industry-sponsors');
const {
  createIndustrySponsorCheckoutSession,
  isStripeCheckoutConfigured,
  retrieveCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const {
  isIndustrySponsorMetadata,
  ensureIndustrySponsorSlotRows,
  handleIndustrySponsorCheckoutCompleted,
} = require('../industry-sponsor-subscriptions');

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
    const availability = await getIndustrySponsorAvailability(sb);

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
        if (!isIndustrySponsorMetadata(metadata)) {
          return res.status(400).json({ ok: false, error: 'invalid_checkout_session' });
        }
        if (String(session?.payment_status || '').toLowerCase() !== 'paid') {
          return res.status(409).json({ ok: false, error: 'payment_not_completed' });
        }

        const finalized = await handleIndustrySponsorCheckoutCompleted(session);
        const industries =
          Array.isArray(finalized?.industries) && finalized.industries.length
            ? finalized.industries
            : normalizeIndustrySlugs(
                metadata.opportunity_industries || metadata.opportunityIndustries || ''
              );
        const email = String(
          session.customer_details?.email || session.customer_email || metadata.sponsor_email || ''
        )
          .trim()
          .toLowerCase();

        return res.status(200).json({
          ok: true,
          verified: true,
          finalized: Boolean(finalized?.ok),
          alreadyFinalized: Boolean(finalized?.alreadyFinalized),
          industries,
          email,
          sessionId,
        });
      }

      const slugs = normalizeIndustrySlugs(
        req.query?.industries || req.query?.industry || req.query?.categories || ''
      );
      const quote = slugs.length > 0 ? calculateIndustrySponsorQuote(slugs.length) : null;
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
          message: 'Online checkout is not available yet — email rosie@thenetworkeruk.com',
        });
      }

      const body = parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const industries = normalizeIndustrySlugs(body.industries || body.categories || body.industry);
      const term = body.termMonths != null ? body.termMonths : body.term;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'invalid_email' });
      }

      const validation = validateCheckoutIndustries(industries, availability, term);
      if (!validation.ok) {
        return res.status(409).json({
          ok: false,
          error: validation.error,
          unavailable: validation.unavailable || [],
          message: validation.message || 'Selected industries are not available',
        });
      }

      await ensureIndustrySponsorSlotRows(sb, validation.industries);

      const base = siteBaseUrl();
      const session = await createIndustrySponsorCheckoutSession({
        email,
        industries: validation.industries,
        termMonths: term,
        successUrl:
          base + '/advertising?industry-sponsor=success&session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: base + '/advertising?industry-sponsor=cancelled',
      });

      return res.status(200).json({
        ok: true,
        checkoutUrl: session.url,
        quote: validation.quote,
        industries: validation.industries,
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
