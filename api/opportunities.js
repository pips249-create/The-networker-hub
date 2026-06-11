/**
 * Public business opportunities API — published listings only.
 */
const { json, setCors } = require('./_lib/auth');
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
    createOpportunityEnquiry,
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
    try {
      const enquiry = await createOpportunityEnquiry({
        opportunityId: body.opportunityId || body.opportunity_id || body.id,
        name: body.name || body.enquirerName,
        email: body.email || body.enquirerEmail,
        message: body.message,
      });
      return json(res, 200, { ok: true, enquiry });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_found') return json(res, 404, { ok: false, error: 'not_found' });
      if (msg === 'invalid_email' || msg === 'missing_name' || msg === 'missing_message') {
        return json(res, 400, { ok: false, error: msg });
      }
      return json(res, 500, { ok: false, error: 'enquiry_failed', message: msg });
    }
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');

  const id = String(req.query?.id || '').trim();

  try {
    if (id) {
      const opportunity = await getPublishedOpportunityById(id);
      if (!opportunity) return json(res, 404, { error: 'not_found' });
      return json(res, 200, { ok: true, opportunity });
    }
    const opportunities = await listPublishedOpportunities();
    return json(res, 200, { ok: true, opportunities });
  } catch (e) {
    return json(res, 500, { error: 'opportunities_fetch_failed', message: e.message });
  }
};
