const { setCors, json } = require('../auth');
const { listMemberOfferPreviews } = require('../member-offers');

/**
 * Public teaser for the sign-up page.
 * Live published offers only, without links, codes, or the full write-up.
 */
module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  const { isSupabaseConfigured } = require('../supabase');
  if (!isSupabaseConfigured()) {
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, { ok: true, offers: [] });
  }

  try {
    const offers = await listMemberOfferPreviews();
    res.setHeader('Cache-Control', 'public, max-age=60');
    return json(res, 200, { ok: true, offers });
  } catch (e) {
    if (e && e.code === 'not_ready') {
      res.setHeader('Cache-Control', 'no-store');
      return json(res, 200, { ok: true, offers: [] });
    }
    console.error('[member-offer-previews]', e && e.message ? e.message : e);
    return json(res, 500, { ok: false, error: 'member_offer_previews_failed', offers: [] });
  }
};
