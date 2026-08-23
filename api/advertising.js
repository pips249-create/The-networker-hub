/**
 * Public advertising API — enquiry submission and slot availability.
 */
const { json, setCors } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');
const { submitAdvertisingEnquiry } = require('./_lib/advertising-enquiries');
const { getAdvertisingAvailability } = require('./_lib/advertising-availability');

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
      return json(res, 200, {
        ok: true,
        configured: true,
        availability,
      });
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: 'availability_failed',
        message: e.message || 'Could not load slot availability.',
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

    try {
      const result = await submitAdvertisingEnquiry(parseBody(req));
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
};
