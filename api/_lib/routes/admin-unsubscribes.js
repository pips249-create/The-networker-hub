const { json, setCors } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { unsubscribeReasonLabel, unsubscribeSourceLabel } = require('../email-unsubscribe');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'not_configured', message: 'Supabase is not configured.' });
  }

  const sb = getSupabaseAdmin();
  let result = await sb
    .from('email_suppressions')
    .select('email, unsubscribed_at, source, reason, reason_note')
    .order('unsubscribed_at', { ascending: false })
    .limit(500);

  if (result.error && /reason/i.test(String(result.error.message || ''))) {
    result = await sb
      .from('email_suppressions')
      .select('email, unsubscribed_at, source')
      .order('unsubscribed_at', { ascending: false })
      .limit(500);
  }

  if (result.error) {
    return json(res, 500, { error: 'unsubscribes_failed', message: result.error.message });
  }

  const rows = (result.data || []).map(function (row) {
    return {
      email: row.email,
      unsubscribedAt: row.unsubscribed_at,
      source: row.source || '',
      sourceLabel: unsubscribeSourceLabel(row.source),
      reason: row.reason || '',
      reasonLabel: unsubscribeReasonLabel(row.reason) || 'No reason given',
      note: row.reason_note || '',
    };
  });

  return json(res, 200, { ok: true, rows: rows });
};
