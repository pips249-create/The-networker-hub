/**
 * Shared "who we spoke to" log for organiser walkthroughs.
 * Auto-records when Catherine / Rosie / Jamie impersonate a group or list an event.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const TEAM_BY_EMAIL = {
  'catherine@thenetworkerhub.com': 'Catherine',
  'catherine@the-networker.co.uk': 'Catherine',
  'rosie@thenetworkerhub.com': 'Rosie',
  'rosie@the-networker.co.uk': 'Rosie',
  'jamie@thenetworkerhub.com': 'Jamie',
  'jamie.trickett01@gmail.com': 'Jamie',
};

const SOURCE_LABEL = {
  impersonate: 'Impersonated workspace',
  event_create: 'Listed an event',
  manual: 'Logged manually',
};

const OUTCOME_RANK = { not_now: 0, other: 1, follow_up: 2, interested: 3, listed: 4 };
const RECENT_DAYS = 45;

function shownByFromEmail(email) {
  const key = String(email || '')
    .trim()
    .toLowerCase();
  if (TEAM_BY_EMAIL[key]) return TEAM_BY_EMAIL[key];
  if (key.startsWith('catherine@')) return 'Catherine';
  if (key.startsWith('rosie@')) return 'Rosie';
  if (key.startsWith('jamie@') || key.startsWith('jamie.')) return 'Jamie';
  return 'Other';
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function noteLine(source, extra) {
  const label = SOURCE_LABEL[source] || source;
  const bit = extra ? ' — ' + String(extra).replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  return todayUtc() + ': ' + label + bit;
}

function strongerOutcome(current, next) {
  const a = OUTCOME_RANK[current] != null ? OUTCOME_RANK[current] : 0;
  const b = OUTCOME_RANK[next] != null ? OUTCOME_RANK[next] : 0;
  return b > a ? next : current;
}

async function loadOrganiser(sb, organiserId) {
  if (!organiserId) return null;
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, email, contact_email, is_internal, is_walkthrough_demo')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

function shouldSkipOrganiser(row) {
  if (!row) return true;
  return Boolean(row.is_walkthrough_demo) || Boolean(row.is_internal);
}

const LOG_SELECT =
  'id, shown_at, shown_by, organiser_name, organiser_email, organiser_id, outcome, notes, created_by_email';

async function latestMatch(sb, apply) {
  let query = sb
    .from('organiser_sales_demos')
    .select(LOG_SELECT)
    .gte('shown_at', new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order('shown_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  query = apply(query);
  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return data || null;
}

async function findRecentLog(sb, { organiserId, organiserEmail, organiserName }) {
  if (organiserId) {
    const row = await latestMatch(sb, (q) => q.eq('organiser_id', organiserId));
    if (row) return row;
  }
  const email = String(organiserEmail || '')
    .trim()
    .toLowerCase();
  if (email) {
    const row = await latestMatch(sb, (q) => q.ilike('organiser_email', email));
    if (row) return row;
  }
  const name = String(organiserName || '').trim();
  if (name) {
    const row = await latestMatch(sb, (q) => q.ilike('organiser_name', name));
    if (row) return row;
  }
  return null;
}

async function insertLog(sb, row) {
  const withSource = await sb.from('organiser_sales_demos').insert(row).select('id').maybeSingle();
  if (!withSource.error) return withSource.data;
  if (!/source|schema cache|does not exist/i.test(String(withSource.error.message || ''))) {
    throw new Error(withSource.error.message);
  }
  const fallback = { ...row };
  delete fallback.source;
  const retry = await sb.from('organiser_sales_demos').insert(fallback).select('id').maybeSingle();
  if (retry.error) throw new Error(retry.error.message);
  return retry.data;
}

/**
 * Record or refresh outreach. Never throws to callers — log and continue.
 */
async function logOrganiserOutreach(opts) {
  const options = opts || {};
  try {
    if (!isSupabaseConfigured()) return { ok: false, skipped: 'no_supabase' };
    const adminEmail = String(options.adminEmail || '')
      .trim()
      .toLowerCase();
    if (!adminEmail) return { ok: false, skipped: 'no_admin' };

    const sb = options.sb || getSupabaseAdmin();
    let organiser = null;
    if (options.organiserId) {
      organiser = await loadOrganiser(sb, options.organiserId);
      if (shouldSkipOrganiser(organiser)) return { ok: false, skipped: 'internal_or_demo' };
    }

    const organiserName =
      String(options.organiserName || (organiser && organiser.name) || '').trim() || 'Untitled group';
    const organiserEmail = String(
      options.organiserEmail || (organiser && (organiser.contact_email || organiser.email)) || ''
    )
      .trim()
      .toLowerCase();
    const organiserId = (organiser && organiser.id) || options.organiserId || null;
    const source = options.source || 'manual';
    const outcome = options.outcome || (source === 'event_create' ? 'listed' : 'follow_up');
    const shownBy = shownByFromEmail(adminEmail);
    const line = noteLine(source, options.detail);

    const existing = await findRecentLog(sb, { organiserId, organiserEmail, organiserName });
    if (existing) {
      const notes = [existing.notes, line].filter(Boolean).join('\n');
      const patch = {
        notes: notes.slice(0, 2000),
        updated_at: new Date().toISOString(),
        outcome: strongerOutcome(existing.outcome, outcome),
        shown_at: todayUtc(),
        shown_by: shownBy,
        created_by_email: adminEmail,
      };
      if (organiserId && !existing.organiser_id) patch.organiser_id = organiserId;
      if (organiserEmail && !existing.organiser_email) patch.organiser_email = organiserEmail;
      const upd = await sb.from('organiser_sales_demos').update(patch).eq('id', existing.id);
      if (upd.error) throw new Error(upd.error.message);
      return { ok: true, updated: true, id: existing.id };
    }

    await insertLog(sb, {
      shown_at: todayUtc(),
      shown_by: shownBy,
      organiser_name: organiserName,
      organiser_email: organiserEmail || null,
      organiser_id: organiserId,
      outcome,
      notes: line,
      source,
      created_by_email: adminEmail,
    });
    return { ok: true, created: true };
  } catch (e) {
    console.warn('[sales-outreach]', e && e.message ? e.message : e);
    return { ok: false, error: e && e.message ? e.message : 'log_failed' };
  }
}

async function logOutreachFromImpersonate({ adminEmail, organiserId, organiserName, organiserEmail }) {
  return logOrganiserOutreach({
    adminEmail,
    organiserId,
    organiserName,
    organiserEmail,
    source: 'impersonate',
    outcome: 'follow_up',
  });
}

async function logOutreachFromEventCreate({ adminEmail, organiserId, eventTitle }) {
  return logOrganiserOutreach({
    adminEmail,
    organiserId,
    source: 'event_create',
    outcome: 'listed',
    detail: eventTitle ? '“' + String(eventTitle).slice(0, 80) + '”' : '',
  });
}

module.exports = {
  shownByFromEmail,
  logOrganiserOutreach,
  logOutreachFromImpersonate,
  logOutreachFromEventCreate,
};
