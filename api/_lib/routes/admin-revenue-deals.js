const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

const VALID_CATEGORIES = new Set([
  'events',
  'opportunities',
  'ticket_sales',
  'browse_organisers',
  'awards',
]);

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseDealBody(body) {
  const category = String(body.category || '').trim();
  if (!VALID_CATEGORIES.has(category)) throw new Error('invalid_category');

  const amount = round2(body.amount_gbp ?? body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_amount');

  const sourceLabel = String(body.source_label || body.sourceLabel || '').trim();
  if (!sourceLabel) throw new Error('missing_source_label');

  const recordedAt = body.recorded_at || body.recordedAt;
  const recorded = recordedAt ? new Date(recordedAt) : new Date();
  if (Number.isNaN(recorded.getTime())) throw new Error('invalid_recorded_at');

  return {
    category,
    source_label: sourceLabel,
    amount_gbp: amount,
    recorded_at: recorded.toISOString(),
    notes: String(body.notes || '').trim(),
    cms_slot: String(body.cms_slot || body.cmsSlot || '').trim() || null,
    source_type: 'manual',
    updated_at: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, configured: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'POST') {
    try {
      const row = {
        ...parseDealBody(req.body || {}),
        created_by: String(session.email || session.userId || '').trim(),
      };
      const { data, error } = await sb.from('hub_revenue_deals').insert(row).select('*').single();
      if (error) throw new Error(error.message);
      return json(res, 201, { ok: true, deal: data });
    } catch (e) {
      return json(res, 400, { ok: false, error: e.message || 'create_failed' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || req.body?.id || '').trim();
    if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
    const existing = await sb.from('hub_revenue_deals').select('source_type').eq('id', id).maybeSingle();
    if (existing.error) return json(res, 500, { ok: false, error: existing.error.message });
    if (existing.data && existing.data.source_type && existing.data.source_type !== 'manual') {
      return json(res, 400, {
        ok: false,
        error: 'stripe_deal_readonly',
        message: 'Stripe-synced revenue cannot be deleted here — void or credit the invoice in Stripe.',
      });
    }
    const { error } = await sb.from('hub_revenue_deals').delete().eq('id', id);
    if (error) return json(res, 500, { ok: false, error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
