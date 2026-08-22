const { getOrganiserApi } = require('../organiser-provider');

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
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listOpportunityEnquiriesForSession,
    updateOpportunityEnquiryStatus,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!listOpportunityEnquiriesForSession) {
    return json(res, 503, {
      error: 'opportunities_unavailable',
      message: 'Opportunity enquiries require Supabase.',
    });
  }

  if (req.method === 'GET') {
    try {
      const enquiries = await listOpportunityEnquiriesForSession(auth.session);
      const newCount = enquiries.filter((e) => e.status === 'new').length;
      return json(res, 200, { ok: true, enquiries, newCount });
    } catch (e) {
      return json(res, 500, {
        error: 'enquiries_fetch_failed',
        message: e.message,
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const enquiryId = String(body.id || req.query?.id || '').trim();
    const status = String(body.status || '').trim();
    if (!enquiryId) return json(res, 400, { error: 'missing_enquiry_id' });
    if (!status) return json(res, 400, { error: 'missing_status' });

    try {
      const enquiry = await updateOpportunityEnquiryStatus(enquiryId, auth.session, status);
      return json(res, 200, { ok: true, enquiry });
    } catch (e) {
      const msg = e.message || String(e);
      if (msg === 'not_found') return json(res, 404, { error: 'not_found' });
      return json(res, 500, { error: 'enquiry_update_failed', message: msg });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
