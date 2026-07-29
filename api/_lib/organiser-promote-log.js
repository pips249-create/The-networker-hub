/**
 * First-party organiser Promote / LinkedIn action logging.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const ALLOWED_ACTIONS = new Set(['download', 'copy_caption', 'open_linkedin', 'landing']);

function cleanText(value, max) {
  const s = String(value || '').trim();
  if (!s) return null;
  return s.slice(0, max || 120);
}

function cleanUuid(value) {
  const s = String(value || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return null;
  }
  return s;
}

async function recordPromoteAction(input) {
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, skipped: true };
  }

  const action = String(input.action || '')
    .trim()
    .toLowerCase();
  if (!ALLOWED_ACTIONS.has(action)) {
    return { ok: false, error: 'invalid_action' };
  }

  const row = {
    action,
    source: cleanText(input.source, 64) || 'post_builder',
    organiser_account_id: cleanUuid(input.organiserAccountId),
    organiser_id: cleanUuid(input.organiserId),
    event_id: cleanUuid(input.eventId),
    template_id: cleanText(input.templateId, 80),
    actor_email: cleanText(input.actorEmail, 200),
    metadata:
      input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? input.metadata
        : {},
  };

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('organiser_promote_actions').insert(row);
  if (error) {
    if (/organiser_promote_actions|schema cache|does not exist/i.test(String(error.message || ''))) {
      return {
        ok: false,
        error: 'table_missing',
        message:
          'Promote action log table is missing. Apply migration 221_organiser_promote_actions.sql.',
      };
    }
    throw new Error(error.message);
  }
  return { ok: true };
}

async function getPromoteActionStats(period) {
  if (!isSupabaseConfigured()) {
    return { configured: false, totals: {}, uniqueOrganisers: 0, landings: 0 };
  }

  const p = String(period || '30d').toLowerCase();
  const days = p === '7d' ? 7 : p === 'all' ? null : 30;
  const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

  const sb = getSupabaseAdmin();
  let query = sb
    .from('organiser_promote_actions')
    .select('action, organiser_id, organiser_account_id, event_id, created_at');
  if (since) query = query.gte('created_at', since);

  const { data, error } = await query.limit(5000);
  if (error) {
    if (/organiser_promote_actions|schema cache|does not exist/i.test(String(error.message || ''))) {
      return {
        configured: false,
        totals: {},
        uniqueOrganisers: 0,
        landings: 0,
        message: 'Apply migration 221_organiser_promote_actions.sql',
      };
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const totals = {
    download: 0,
    copy_caption: 0,
    open_linkedin: 0,
    landing: 0,
  };
  const organisers = new Set();
  rows.forEach(function (row) {
    const action = String(row.action || '');
    if (totals[action] != null) totals[action] += 1;
    if (row.organiser_id) organisers.add(String(row.organiser_id));
    else if (row.organiser_account_id) organisers.add('acct:' + String(row.organiser_account_id));
  });

  return {
    configured: true,
    period: p === '7d' || p === 'all' ? p : '30d',
    totals,
    uniqueOrganisers: organisers.size,
    landings: totals.landing || 0,
    toolUses: (totals.download || 0) + (totals.copy_caption || 0) + (totals.open_linkedin || 0),
    sampleSize: rows.length,
  };
}

module.exports = {
  recordPromoteAction,
  getPromoteActionStats,
  ALLOWED_ACTIONS,
};
