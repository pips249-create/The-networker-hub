/**
 * Append-only entity activity log (organiser / event / team changes).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

function cleanText(raw, max) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max || 500);
}

function mapActorRole(session, access) {
  try {
    const { isPlatformAdmin } = require('./organiser');
    if (session && isPlatformAdmin(session)) return 'admin';
  } catch {
    /* ignore */
  }
  const role = String(access?.role || '').toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'editor' || role === 'team') return 'team';
  return 'unknown';
}

function actorFromSession(session, access) {
  return {
    actor_user_id: session?.sub || session?.userId || null,
    actor_email: cleanText(session?.email || '', 200) || null,
    actor_role: mapActorRole(session, access),
  };
}

/**
 * Fire-and-forget safe insert. Never throws to callers (logging must not break saves).
 */
async function logEntityActivity(entry) {
  if (!isSupabaseConfigured()) return null;
  try {
    const entityType = String(entry.entity_type || entry.entityType || '').trim();
    const entityId = String(entry.entity_id || entry.entityId || '').trim();
    const action = cleanText(entry.action || '', 80);
    if (!entityType || !entityId || !action) return null;

    const row = {
      actor_user_id: entry.actor_user_id || entry.actorUserId || null,
      actor_email: cleanText(entry.actor_email || entry.actorEmail || '', 200) || null,
      actor_role: String(entry.actor_role || entry.actorRole || 'unknown').trim() || 'unknown',
      entity_type: entityType,
      entity_id: entityId,
      organiser_id: entry.organiser_id || entry.organiserId || null,
      action,
      summary: cleanText(entry.summary || action, 400) || action,
      metadata:
        entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
          ? entry.metadata
          : {},
    };

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('entity_activity_log').insert(row).select('id, created_at').single();
    if (error) {
      if (/entity_activity_log|does not exist|schema cache/i.test(error.message)) return null;
      console.warn('[entity-activity-log]', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[entity-activity-log]', e?.message || e);
    return null;
  }
}

async function logFromSession(session, access, entry) {
  const actor = actorFromSession(session, access);
  return logEntityActivity({ ...entry, ...actor });
}

function mapActivityRow(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email || '',
    actorRole: r.actor_role || 'unknown',
    entityType: r.entity_type,
    entityId: r.entity_id,
    organiserId: r.organiser_id,
    action: r.action,
    summary: r.summary || '',
    metadata: r.metadata || {},
  };
}

function activityUnavailablePayload(error) {
  if (error && /entity_activity_log|does not exist|schema cache/i.test(error.message)) {
    return {
      configured: true,
      items: [],
      unavailable: true,
      message: 'Run migration 206_entity_activity_log.sql to enable activity history.',
    };
  }
  return null;
}

async function fetchEntityActivity(options = {}) {
  if (!isSupabaseConfigured()) return { configured: false, items: [] };
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(parseInt(String(options.limit || 40), 10) || 40, 1), 100);
  let query = sb
    .from('entity_activity_log')
    .select(
      'id, created_at, actor_user_id, actor_email, actor_role, entity_type, entity_id, organiser_id, action, summary, metadata'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  const entityType = String(options.entityType || options.entity_type || '').trim();
  const entityId = String(options.entityId || options.entity_id || '').trim();
  const organiserId = String(options.organiserId || options.organiser_id || '').trim();

  if (entityType && entityId) {
    query = query.eq('entity_type', entityType).eq('entity_id', entityId);
  } else if (organiserId) {
    query = query.or(`organiser_id.eq.${organiserId},and(entity_type.eq.organiser,entity_id.eq.${organiserId})`);
  } else {
    return { configured: true, items: [], error: 'missing_filter' };
  }

  const { data, error } = await query;
  if (error) {
    const unavailable = activityUnavailablePayload(error);
    if (unavailable) return unavailable;
    throw new Error(error.message);
  }

  return {
    configured: true,
    items: (data || []).map(mapActivityRow),
  };
}

/**
 * Account-scoped activity for organiser owners (all pages + team actions on the account).
 * organiser_id on rows is usually a group/page id; team_invite_accepted may use account id.
 */
async function fetchAccountActivity(options = {}) {
  if (!isSupabaseConfigured()) return { configured: false, items: [] };
  const groupIds = Array.isArray(options.groupIds) ? options.groupIds : [];
  const accountId = String(options.accountId || options.account_id || '').trim();
  const scopeIds = [
    ...new Set(
      [...groupIds, accountId]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];
  if (!scopeIds.length) {
    return { configured: true, items: [], error: 'missing_filter' };
  }

  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(parseInt(String(options.limit || 40), 10) || 40, 1), 100);
  const idList = scopeIds.join(',');
  const orParts = [`organiser_id.in.(${idList})`, `and(entity_type.eq.organiser,entity_id.in.(${idList}))`];
  if (accountId) {
    orParts.push(`and(entity_type.eq.team_member,metadata->>accountId.eq.${accountId})`);
  }

  const { data, error } = await sb
    .from('entity_activity_log')
    .select(
      'id, created_at, actor_user_id, actor_email, actor_role, entity_type, entity_id, organiser_id, action, summary, metadata'
    )
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    const unavailable = activityUnavailablePayload(error);
    if (unavailable) return unavailable;
    throw new Error(error.message);
  }

  const seen = new Set();
  const items = [];
  (data || []).forEach((r) => {
    if (!r?.id || seen.has(r.id)) return;
    seen.add(r.id);
    items.push(mapActivityRow(r));
  });

  return { configured: true, items };
}

function changedKeys(before, after, keys) {
  const out = [];
  (keys || []).forEach((key) => {
    const a = before?.[key];
    const b = after?.[key];
    if (String(a ?? '') !== String(b ?? '')) out.push(key);
  });
  return out;
}

module.exports = {
  logEntityActivity,
  logFromSession,
  fetchEntityActivity,
  fetchAccountActivity,
  actorFromSession,
  mapActorRole,
  changedKeys,
};
