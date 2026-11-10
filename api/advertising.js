/**
 * Public advertising API — enquiry submission, slot availability, directory carousel checkout.
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit, clientIp } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { submitAdvertisingEnquiry } = require('./_lib/advertising-enquiries');
const { getAdvertisingAvailability } = require('./_lib/advertising-availability');
const { verifyTurnstileToken } = require('./_lib/turnstile');
const { resolveImageUrl } = require('./_lib/supabase-storage');
const {
  isStripeCheckoutConfigured,
  createDirectoryCarouselCheckoutSession,
  siteBaseUrl,
} = require('./_lib/stripe-checkout');
const {
  countLiveDirectoryCarouselSlots,
  directoryCarouselQuote,
} = require('./_lib/directory-carousel-subscriptions');
const { EVENTS_BROWSE_CAROUSEL_SLOT } = require('./_lib/event-page-carousel');
const { affiliateCodeFromBody } = require('./_lib/affiliate-programme');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = String(req.query?.route || '').trim().toLowerCase();

  if (req.method === 'GET' && route === 'availability') {
    if (!useSupabase()) {
      return json(res, 200, {
        ok: true,
        configured: false,
        availability: null,
      });
    }

    try {
      const availability = await getAdvertisingAvailability();
      const directoryCarousel = await countLiveDirectoryCarouselSlots();
      return json(res, 200, {
        ok: true,
        configured: true,
        availability: Object.assign({}, availability, { directoryCarousel }),
        directoryCarousel,
        quote: directoryCarouselQuote(),
      });
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: 'availability_failed',
        message: e.message || 'Could not load slot availability.',
      });
    }
  }

  if (req.method === 'POST' && route === 'directory-carousel-checkout') {
    const limited = enforceRateLimit(req, res, 'directory_carousel_checkout', {
      max: 6,
      windowMs: 300_000,
    });
    if (!limited.allowed) {
      return json(res, 429, {
        ok: false,
        error: 'rate_limited',
        message: 'Too many checkout attempts. Please wait a few minutes and try again.',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    if (!isStripeCheckoutConfigured()) {
      return json(res, 503, {
        ok: false,
        error: 'stripe_not_configured',
        message: 'Checkout is not available yet — email rosie@thenetworkeruk.com.',
      });
    }

    if (!useSupabase()) {
      return json(res, 503, {
        ok: false,
        error: 'not_configured',
        message: 'Checkout is not available yet — email rosie@thenetworkeruk.com.',
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

    try {
      const slots = await countLiveDirectoryCarouselSlots();
      if (slots.available < 1) {
        return json(res, 409, {
          ok: false,
          error: 'carousel_full',
          message: 'All 24 directory carousel slots are taken. Email rosie@thenetworkeruk.com to join the waitlist.',
        });
      }

      const companyName = String(body.companyName || body.company_name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const ctaUrl = String(body.ctaUrl || body.cta_url || '').trim();
      const ctaLabel = String(body.ctaLabel || body.cta_label || 'Find out more').trim();
      const logoBase64 = String(body.logoBase64 || body.logo_base64 || '').trim();
      const logoMime = String(body.logoMime || body.logo_mime || 'image/png').trim();
      const logoFilename = String(body.logoFilename || body.logo_filename || 'logo.png').trim();

      if (!companyName) {
        return json(res, 400, { ok: false, error: 'missing_company', message: 'Add your company name.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok: false, error: 'missing_email', message: 'Add a valid work email.' });
      }
      if (!/^https?:\/\//i.test(ctaUrl)) {
        return json(res, 400, {
          ok: false,
          error: 'missing_cta_url',
          message: 'Add a website link starting with https://',
        });
      }
      if (!logoBase64 || !/^data:image\//i.test(logoBase64)) {
        return json(res, 400, {
          ok: false,
          error: 'missing_logo',
          message: 'Upload a logo image (PNG or JPG under 2MB).',
        });
      }

      const logoUrl = await resolveImageUrl({
        folder: 'sponsor-logos/' + EVENTS_BROWSE_CAROUSEL_SLOT + '/selfserve',
        logoBase64,
        logoMime,
        logoFilename,
      });
      if (!logoUrl) {
        return json(res, 400, {
          ok: false,
          error: 'logo_upload_failed',
          message: 'Could not upload that logo. Try a PNG or JPG under 2MB.',
        });
      }

      const session = await createDirectoryCarouselCheckoutSession({
        companyName,
        email,
        ctaUrl,
        ctaLabel,
        logoUrl,
        affiliateCode: affiliateCodeFromBody(body),
        successUrl: siteBaseUrl() + '/advertising?directory_carousel=success#ad-pkg-events-directory-carousel',
        cancelUrl: siteBaseUrl() + '/advertising?directory_carousel=cancel#ad-pkg-events-directory-carousel',
      });

      return json(res, 200, {
        ok: true,
        url: session.url,
        sessionId: session.id,
        quote: directoryCarouselQuote(),
      });
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: e.code || e.message || 'checkout_failed',
        message: e.message || 'Could not start checkout.',
      });
    }
  }

  if (req.method === 'POST') {
    const limited = enforceRateLimit(req, res, 'advertising_enquiry', {
      max: 8,
      windowMs: 300_000,
    });
    if (!limited.allowed) {
      return json(res, 429, {
        ok: false,
        error: 'rate_limited',
        message: 'Too many enquiries. Please wait a few minutes and try again.',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    if (!useSupabase()) {
      return json(res, 503, {
        ok: false,
        error: 'not_configured',
        message: 'Online enquiries are not available yet — email rosie@thenetworkeruk.com.',
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

    try {
      const result = await submitAdvertisingEnquiry(body);
      if (!result.ok) {
        return json(res, 400, {
          ok: false,
          error: result.error,
          message: result.message,
        });
      }
      return json(res, 200, result);
    } catch (e) {
      const code = e.code || 'enquiry_failed';
      const status = code === 'not_configured' ? 503 : 500;
      return json(res, status, {
        ok: false,
        error: code,
        message: e.message || 'Could not send your enquiry.',
      });
    }
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
});
