/**
 * Public business opportunities API — published listings only.
 */
const { json, setCors } = require('./_lib/auth');
const { useSupabase } = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  if (!useSupabase()) {
    return json(res, 200, { ok: true, opportunities: [] });
  }

  const {
    listPublishedOpportunities,
    getPublishedOpportunityById,
  } = require('./_lib/supabase-opportunities');

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
