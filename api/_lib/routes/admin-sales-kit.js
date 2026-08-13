/**
 * Command Centre — Organiser sales kit helpers.
 * GET  /api/admin/sales-kit
 * POST /api/admin/sales-kit  { action, ... }
 */
const { json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicOrganiserSlug } = require('../organiser-slug');
const { applyIlikeSearch } = require('../search-match');

const SHOWN_BY = new Set(['Catherine', 'Rosie', 'Jamie', 'Other']);
const OUTCOMES = new Set(['interested', 'listed', 'follow_up', 'not_now', 'other']);

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

function mapOrganiser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: String(row.name || '').trim() || 'Untitled',
    slug: publicOrganiserSlug(row) || '',
    email: String(row.contact_email || row.email || '')
      .trim()
      .toLowerCase(),
    website: String(row.website || '').trim(),
    photoUrl: String(row.photo_url || '').trim(),
    isInternal: Boolean(row.is_internal),
    isWalkthroughDemo: Boolean(row.is_walkthrough_demo),
  };
}

function mapDemo(row) {
  return {
    id: row.id,
    shownAt: row.shown_at,
    shownBy: row.shown_by,
    organiserName: row.organiser_name,
    organiserEmail: row.organiser_email || '',
    organiserId: row.organiser_id || null,
    outcome: row.outcome || 'follow_up',
    notes: row.notes || '',
    source: row.source || 'manual',
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDemoOrganiser(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .eq('is_walkthrough_demo', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapOrganiser(data);
}

async function listInternalCandidates(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .eq('is_internal', true)
    .order('name', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrganiser);
}

async function searchOrganisers(sb, q) {
  let query = sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo')
    .order('name', { ascending: true })
    .limit(20);
  query = applyIlikeSearch(query, q, ['name', 'email', 'contact_email', 'slug']);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(mapOrganiser);
}

async function listDemos(sb) {
  let query = sb
    .from('organiser_sales_demos')
    .select(
      'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
    )
    .order('shown_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  let { data, error } = await query;
  if (error && /source/i.test(String(error.message || ''))) {
    const retry = await sb
      .from('organiser_sales_demos')
      .select(
        'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, created_by_email, created_at, updated_at'
      )
      .order('shown_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data || []).map(mapDemo);
}

function sessionEmail(req) {
  const session = sessionFromRequest(req);
  return String((session && session.email) || '')
    .trim()
    .toLowerCase();
}

module.exports = async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const q = String(req.query?.q || '').trim();
      const [demoOrganiser, internalCandidates, demos] = await Promise.all([
        getDemoOrganiser(sb),
        listInternalCandidates(sb),
        listDemos(sb),
      ]);
      const search = q ? await searchOrganisers(sb, q) : [];
      return json(res, 200, {
        ok: true,
        demoOrganiser,
        internalCandidates,
        demos,
        search,
        migrationHint:
          'If this page errors about missing columns/tables, run supabase/migrations/252_organiser_sales_kit.sql in Supabase.',
      });
    } catch (e) {
      console.error('admin-sales-kit GET', e);
      const msg = e && e.message ? String(e.message) : 'Could not load sales kit';
      const missing =
        /is_walkthrough_demo|organiser_sales_demos|does not exist|schema cache/i.test(msg);
      return json(res, missing ? 503 : 500, {
        ok: false,
        error: missing ? 'migration_required' : 'load_failed',
        message: missing
          ? 'Run migration 252_organiser_sales_kit.sql in Supabase, then refresh.'
          : msg,
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const action = String(body.action || '').trim();

  try {
    if (action === 'set_demo_organiser') {
      const organiserId = String(body.organiserId || body.organiser_id || '').trim();
      if (!organiserId) {
        return json(res, 400, { error: 'missing_organiser_id', message: 'Pick a group first.' });
      }
      const { data: existing, error: getErr } = await sb
        .from('organisers')
        .select('id')
        .eq('id', organiserId)
        .maybeSingle();
      if (getErr) throw new Error(getErr.message);
      if (!existing) {
        return json(res, 404, { error: 'not_found', message: 'Group not found.' });
      }
      const clearRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: false })
        .eq('is_walkthrough_demo', true);
      if (clearRes.error) throw new Error(clearRes.error.message);
      const setRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: true, is_internal: true })
        .eq('id', organiserId)
        .select(
          'id, name, slug, email, contact_email, website, photo_url, is_internal, is_walkthrough_demo'
        )
        .maybeSingle();
      if (setRes.error) throw new Error(setRes.error.message);
      return json(res, 200, { ok: true, demoOrganiser: mapOrganiser(setRes.data) });
    }

    if (action === 'clear_demo_organiser') {
      const clearRes = await sb
        .from('organisers')
        .update({ is_walkthrough_demo: false })
        .eq('is_walkthrough_demo', true);
      if (clearRes.error) throw new Error(clearRes.error.message);
      return json(res, 200, { ok: true, demoOrganiser: null });
    }

    if (action === 'add_demo') {
      const shownBy = String(body.shownBy || '').trim();
      const organiserName = String(body.organiserName || '').trim();
      const organiserEmail = String(body.organiserEmail || '')
        .trim()
        .toLowerCase();
      const organiserId = String(body.organiserId || '').trim() || null;
      const outcome = String(body.outcome || 'follow_up').trim();
      const notes = String(body.notes || '').trim();
      const shownAt = String(body.shownAt || '').trim() || new Date().toISOString().slice(0, 10);

      if (!SHOWN_BY.has(shownBy)) {
        return json(res, 400, {
          error: 'invalid_shown_by',
          message: 'Choose Catherine, Rosie, Jamie, or Other.',
        });
      }
      if (!organiserName) {
        return json(res, 400, { error: 'missing_name', message: 'Add the group or contact name.' });
      }
      if (!OUTCOMES.has(outcome)) {
        return json(res, 400, { error: 'invalid_outcome', message: 'Pick a valid outcome.' });
      }

      const insertRes = await sb
        .from('organiser_sales_demos')
        .insert({
          shown_at: shownAt,
          shown_by: shownBy,
          organiser_name: organiserName,
          organiser_email: organiserEmail || null,
          organiser_id: organiserId,
          outcome,
          notes: notes || null,
          source: 'manual',
          created_by_email: sessionEmail(req) || null,
        })
        .select(
          'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
        )
        .maybeSingle();
      if (insertRes.error) throw new Error(insertRes.error.message);
      return json(res, 200, { ok: true, demo: mapDemo(insertRes.data) });
    }

    if (action === 'update_demo') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'missing_id' });
      const patch = { updated_at: new Date().toISOString() };
      if (body.shownBy != null) {
        const shownBy = String(body.shownBy).trim();
        if (!SHOWN_BY.has(shownBy)) {
          return json(res, 400, { error: 'invalid_shown_by' });
        }
        patch.shown_by = shownBy;
      }
      if (body.organiserName != null) {
        const name = String(body.organiserName).trim();
        if (!name) return json(res, 400, { error: 'missing_name' });
        patch.organiser_name = name;
      }
      if (body.organiserEmail != null) {
        patch.organiser_email = String(body.organiserEmail).trim().toLowerCase() || null;
      }
      if (body.outcome != null) {
        const outcome = String(body.outcome).trim();
        if (!OUTCOMES.has(outcome)) return json(res, 400, { error: 'invalid_outcome' });
        patch.outcome = outcome;
      }
      if (body.notes != null) patch.notes = String(body.notes).trim() || null;
      if (body.shownAt != null) patch.shown_at = String(body.shownAt).trim();

      const upd = await sb
        .from('organiser_sales_demos')
        .update(patch)
        .eq('id', id)
        .select(
          'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, source, created_by_email, created_at, updated_at'
        )
        .maybeSingle();
      if (upd.error) throw new Error(upd.error.message);
      if (!upd.data) return json(res, 404, { error: 'not_found' });
      return json(res, 200, { ok: true, demo: mapDemo(upd.data) });
    }

    if (action === 'delete_demo') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'missing_id' });
      const del = await sb.from('organiser_sales_demos').delete().eq('id', id);
      if (del.error) throw new Error(del.error.message);
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: 'unknown_action', message: 'Unknown sales-kit action.' });
  } catch (e) {
    console.error('admin-sales-kit POST', e);
    const msg = e && e.message ? String(e.message) : 'Could not save';
    const missing =
      /is_walkthrough_demo|organiser_sales_demos|does not exist|schema cache/i.test(msg);
    return json(res, missing ? 503 : 500, {
      ok: false,
      error: missing ? 'migration_required' : 'save_failed',
      message: missing
        ? 'Run migration 252_organiser_sales_kit.sql in Supabase, then refresh.'
        : msg,
    });
  }
};
