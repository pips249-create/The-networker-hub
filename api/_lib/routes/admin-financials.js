const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminFinancials } = require('../admin-supabase-data');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { sendPayoutStatusEmail } = require('../lifecycle-emails');

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
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method === 'GET') {
    try {
      const report = await getAdminFinancials();
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'financials_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim();

    if (!id || !status) {
      return json(res, 400, { ok: false, error: 'missing_id_or_status' });
    }
    if (!['pending_review', 'approved', 'paid', 'held'].includes(status)) {
      return json(res, 400, { ok: false, error: 'invalid_status' });
    }

    try {
      const sb = getSupabaseAdmin();
      const { data: existing, error: fetchErr } = await sb
        .from('organiser_payouts')
        .select('id, status, event_id, amount_net, amount')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing) return json(res, 404, { ok: false, error: 'not_found' });

      const { data, error } = await sb
        .from('organiser_payouts')
        .update({ status })
        .eq('id', id)
        .select('id, status, event_id, amount_net, amount')
        .single();
      if (error) throw new Error(error.message);

      if (existing.status !== status && (status === 'approved' || status === 'paid')) {
        try {
          const { data: eventRow } = await sb
            .from('events')
            .select('id, title, organiser_id')
            .eq('id', data.event_id)
            .maybeSingle();
          if (eventRow?.organiser_id) {
            await sendPayoutStatusEmail(sb, {
              payout: data,
              eventRow,
              organiserId: eventRow.organiser_id,
              status,
            });
          }
        } catch (emailErr) {
          console.warn('[payout] status email failed:', emailErr.message || emailErr);
        }
      }

      return json(res, 200, { ok: true, payout: data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'payout_update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
