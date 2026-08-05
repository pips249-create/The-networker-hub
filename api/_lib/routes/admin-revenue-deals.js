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

function dealIdFromRequest(req, body) {
  const fromBody = String((body && (body.id || body.dealId)) || '').trim();
  if (fromBody) return fromBody;
  const fromQuery = String(req.query?.id || req.query?.dealId || '').trim();
  if (fromQuery) return fromQuery;
  try {
    const url = new URL(req.url || '', 'https://internal.local');
    return String(url.searchParams.get('id') || url.searchParams.get('dealId') || '').trim();
  } catch {
    return '';
  }
}

async function deleteManualDeal(sb, id) {
  const existing = await sb.from('hub_revenue_deals').select('source_type').eq('id', id).maybeSingle();
  if (existing.error) {
    const err = new Error(existing.error.message);
    err.status = 500;
    throw err;
  }
  if (!existing.data) {
    const err = new Error('not_found');
    err.status = 404;
    err.message = 'Deal not found.';
    throw err;
  }
  if (existing.data.source_type && existing.data.source_type !== 'manual') {
    const err = new Error('stripe_deal_readonly');
    err.status = 400;
    err.message = 'Stripe-synced revenue cannot be deleted here — void or credit the invoice in Stripe.';
    throw err;
  }
  const { error } = await sb.from('hub_revenue_deals').delete().eq('id', id);
  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }
  return { ok: true };
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
  const body = req.body || {};

  if (req.method === 'POST') {
    const action = String(body.action || '').trim().toLowerCase();
    if (action === 'delete' || action === 'remove') {
      try {
        const id = dealIdFromRequest(req, body);
        if (!id) return json(res, 400, { ok: false, error: 'missing_id', message: 'Missing deal id.' });
        await deleteManualDeal(sb, id);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, e.status || 400, {
          ok: false,
          error: e.message || 'delete_failed',
          message: e.message || 'Could not remove deal.',
        });
      }
    }

    try {
      const row = {
        ...parseDealBody(body),
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
    try {
      const id = dealIdFromRequest(req, body);
      if (!id) return json(res, 400, { ok: false, error: 'missing_id', message: 'Missing deal id.' });
      await deleteManualDeal(sb, id);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, e.status || 400, {
        ok: false,
        error: e.message || 'delete_failed',
        message: e.message || 'Could not remove deal.',
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
