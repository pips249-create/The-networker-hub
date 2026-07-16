/**
 * Public business opportunities API — published listings only.
 */
const { json, setCors, sessionFromRequest } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/rate-limit');
const { useSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!useSupabase()) {
    return json(res, 200, { ok: true, opportunities: [] });
  }

  const {
    listPublishedOpportunities,
    getPublishedOpportunityById,
    getPublishedOpportunityBySlug,
    createOpportunityEnquiry,
    incrementOpportunityViewCount,
  } = require('./_lib/supabase-opportunities');

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

    if (action === 'record_view') {
      const limited = enforceRateLimit(req, res, 'opportunity_view', { max: 30, windowMs: 300_000 });
      if (!limited.allowed) {
        return json(res, 429, { ok: false, error: 'rate_limited', retryAfterSec: limited.retryAfterSec });
      }
      const opportunityId = String(body.opportunityId || body.id || '').trim();
      try {
        const viewCount = await incrementOpportunityViewCount(opportunityId);
        return json(res, 200, { ok: true, viewCount });
      } catch (e) {
        const msg = e.message || String(e);
        if (msg === 'not_found') return json(res, 404, { ok: false, error: 'not_found' });
        if (msg === 'invalid_opportunity_id') return json(res, 400, { ok: false, error: msg });
        return json(res, 500, { ok: false, error: 'view_record_failed', message: msg });
      }
    }

    if (action === 'claim_request') {
      const limited = enforceRateLimit(req, res, 'opportunity_claim', { max: 5, windowMs: 600_000 });
      if (!limited.allowed) {
        return json(res, 429, {
          ok: false,
          error: 'rate_limited',
          message: 'Too many claim requests. Please wait a while and try again.',
          retryAfterSec: limited.retryAfterSec,
        });
      }

      try {
        const { createOpportunityClaimRequest } = require('./_lib/opportunity-claim-request');
        const result = await createOpportunityClaimRequest(body);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        const msg = e.message || String(e);
        if (msg === 'not_found') return json(res, 404, { ok: false, error: 'not_found' });
        if (msg === 'not_claimable') {
          return json(res, 400, {
            ok: false,
            error: 'not_claimable',
            message: 'This listing is not available to claim through the hub.',
          });
        }
        if (
          msg === 'invalid_email' ||
          msg === 'missing_name' ||
          msg === 'missing_company' ||
          msg === 'missing_opportunity_id'
        ) {
          return json(res, 400, { ok: false, error: msg });
        }
        return json(res, 500, { ok: false, error: 'claim_request_failed', message: msg });
      }
    }

    const limited = enforceRateLimit(req, res, 'opportunity_enquiry', { max: 10, windowMs: 300_000 });
    if (!limited.allowed) {
      return json(res, 429, {
        ok: false,
        error: 'rate_limited',
        message: 'Too many enquiries. Please wait a few minutes and try again.',
        retryAfterSec: limited.retryAfterSec,
      });
    }

    const session = sessionFromRequest(req);
    if (!session || !session.email) {
      return json(res, 401, {
        ok: false,
        error: 'not_authenticated',
        message: 'Sign in or create a free account to send an enquiry.',
      });
    }

    try {
      const enquiry = await createOpportunityEnquiry(
        {
          opportunityId: body.opportunityId || body.opportunity_id || body.id,
          name: body.name || body.enquirerName,
          email: body.email || body.enquirerEmail,
          message: body.message,
        },
        session
      );
      return json(res, 200, { ok: true, enquiry });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_found') return json(res, 404, { ok: false, error: 'not_found' });
      if (msg === 'not_authenticated') {
        return json(res, 401, {
          ok: false,
          error: 'not_authenticated',
          message: 'Sign in or create a free account to send an enquiry.',
        });
      }
      if (msg === 'invalid_email' || msg === 'missing_name' || msg === 'missing_message') {
        return json(res, 400, { ok: false, error: msg });
      }
      return json(res, 500, { ok: false, error: 'enquiry_failed', message: msg });
    }
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const meta = String(req.query?.meta || '').trim();

  if (meta === 'premium-slots') {
    try {
      const { getPremiumSpotlightSlotStatus } = require('./_lib/opportunity-premium-slots');
      const premiumSlots = await getPremiumSpotlightSlotStatus();
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
      return json(res, 200, { ok: true, premiumSlots });
    } catch (e) {
      return json(res, 500, { error: 'premium_slots_failed', message: e.message });
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  const id = String(req.query?.id || '').trim();
  const slug = String(req.query?.slug || req.query?.page || '').trim();

  try {
    if (slug || id) {
      const opportunity = slug
        ? await getPublishedOpportunityBySlug(slug)
        : await getPublishedOpportunityById(id);
      if (!opportunity) return json(res, 404, { error: 'not_found' });
      return json(res, 200, { ok: true, opportunity });
    }
    const opportunities = await listPublishedOpportunities();
    return json(res, 200, { ok: true, opportunities });
  } catch (e) {
    return json(res, 500, { error: 'opportunities_fetch_failed', message: e.message });
  }
};
