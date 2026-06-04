/**
 * Organiser groups API — Supabase organisers table + Storage uploads.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');
const { isAdminRole } = require('./auth');

function rowToGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: String(row.name || 'Untitled organiser').trim(),
    ownerEmail: String(row.email || '').toLowerCase(),
    description: String(row.description || '').trim(),
    userIds: row.supabase_user_id ? [row.supabase_user_id] : [],
    imageUrl: String(row.photo_url || '').trim(),
    website: String(row.website || '').trim(),
    location: Array.isArray(row.industries) ? row.industries.join(', ') : '',
    statusRaw: row.listing_status || 'draft',
    rating: row.average_rating != null ? Number(row.average_rating) : null,
    revenueNum: 0,
    createdAt: row.created_at || null,
  };
}

function normalizeListingStatus(input) {
  const s = String(input || '').toLowerCase().trim();
  if (s === 'publish' || s === 'published' || s === 'live') return 'published';
  if (s === 'unpublish' || s === 'unpublished') return 'unpublished';
  return 'draft';
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

async function listGroupsForUser(userId, email) {
  const sb = getSupabaseAdmin();
  const em = String(email || '').toLowerCase();
  const uid = isUuid(userId) ? userId : null;
  let query = sb.from('organisers').select('*');
  if (uid && em) {
    query = query.or(`supabase_user_id.eq.${uid},email.eq.${em}`);
  } else if (uid) {
    query = query.eq('supabase_user_id', uid);
  } else if (em) {
    query = query.eq('email', em);
  } else {
    return [];
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToGroup);
}

async function listAllGroups() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('organisers').select('*').order('name');
  if (error) throw new Error(error.message);
  return (data || []).map(rowToGroup);
}

/** Admin overview: groups you own + groups that have events (not all 1000+ imports). */
async function listGroupsForAdminOverview(session) {
  const sb = getSupabaseAdmin();
  const mine = await listGroupsForUser(session.sub || '', session.email);
  const byId = new Map(mine.map((g) => [g.id, g]));

  const { data: eventRows, error } = await sb
    .from('events')
    .select('organiser_id')
    .not('organiser_id', 'is', null);
  if (error) throw new Error(error.message);

  const orgIds = [...new Set((eventRows || []).map((r) => r.organiser_id).filter(Boolean))].slice(0, 150);
  if (orgIds.length) {
    const { data: orgs, error: orgErr } = await sb.from('organisers').select('*').in('id', orgIds);
    if (orgErr) throw new Error(orgErr.message);
    (orgs || []).forEach((row) => {
      const g = rowToGroup(row);
      if (!byId.has(g.id)) byId.set(g.id, g);
    });
  }

  return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function listGroupsForSession(session, adminView) {
  if (adminView) return listGroupsForAdminOverview(session);
  return listGroupsForUser(session.sub || '', session.email);
}

function groupOwnedBySession(session, groups, groupId) {
  if (isAdminRole(session.role)) return true;
  return groups.some((g) => g.id === groupId);
}

async function getGroupById(groupId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('organisers').select('*').eq('id', groupId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const e = new Error('Group not found');
    e.status = 404;
    throw e;
  }
  return rowToGroup(data);
}

async function resolveLogo(payload, organiserId) {
  try {
    const url = await resolveImageUrl({
      folder: `organisers/${organiserId || 'new'}`,
      logoUrl: payload.logoUrl,
      logoBase64: payload.logoBase64,
      logoMime: payload.logoMime,
      logoFilename: payload.logoFilename,
    });
    return { url, warning: null };
  } catch (e) {
    const warning =
      e.message === 'Image must be under 2MB'
        ? e.message
        : 'Could not upload image. Use a URL below, or run 004_organiser_storage.sql in Supabase.';
    return { url: null, warning };
  }
}

async function createGroup(payload) {
  const sb = getSupabaseAdmin();
  const listing = normalizeListingStatus(payload.listingStatus || 'draft');
  const insert = {
    name: payload.name,
    email: payload.email?.toLowerCase(),
    description: payload.description || null,
    website: payload.website || null,
    organiser_type: 'Events',
    verification_status: 'Verified',
    listing_status: listing,
    supabase_user_id: payload.userId || null,
  };

  const { data: created, error } = await sb.from('organisers').insert(insert).select('*').single();
  if (error) throw new Error(error.message);

  let logoWarning = null;
  const hasLogo =
    payload.logoUrl || payload.logoBase64 || payload.logoMime || payload.logoFilename;
  if (hasLogo) {
    const { url, warning } = await resolveLogo(payload, created.id);
    if (warning) logoWarning = warning;
    if (url) {
      const { data: updated, error: upErr } = await sb
        .from('organisers')
        .update({ photo_url: url })
        .eq('id', created.id)
        .select('*')
        .single();
      if (upErr) throw new Error(upErr.message);
      const group = rowToGroup(updated);
      if (logoWarning) group.logoWarning = logoWarning;
      return group;
    }
  }

  const group = rowToGroup(created);
  if (logoWarning) group.logoWarning = logoWarning;
  return group;
}

async function updateGroup(groupId, payload) {
  const sb = getSupabaseAdmin();
  const patch = {};

  if (payload.name) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description || null;
  if (payload.website !== undefined) patch.website = payload.website || null;
  if (payload.listingStatus != null) {
    patch.listing_status = normalizeListingStatus(payload.listingStatus);
  }

  const hasLogo =
    payload.logoUrl || payload.logoBase64 || payload.logoMime || payload.logoFilename;
  let logoWarning = null;
  if (hasLogo) {
    const { url, warning } = await resolveLogo(payload, groupId);
    if (warning) logoWarning = warning;
    if (url) patch.photo_url = url;
    else if (payload.logoUrl && /^https?:\/\//i.test(payload.logoUrl)) {
      patch.photo_url = payload.logoUrl.trim();
    }
  }

  if (!Object.keys(patch).length) {
    const e = new Error('Nothing to update');
    e.status = 400;
    throw e;
  }

  const { data, error } = await sb
    .from('organisers')
    .update(patch)
    .eq('id', groupId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const group = rowToGroup(data);
  if (logoWarning) group.logoWarning = logoWarning;
  return group;
}

async function unpublishGroup(groupId) {
  return updateGroup(groupId, { listingStatus: 'unpublished' });
}

async function listEventsForOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, approval_status, starts_at, featured, photo_url, average_rating')
    .eq('organiser_id', organiserId);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    statusRaw: row.approval_status,
    date: row.starts_at,
    rating: row.average_rating,
    groupIds: [organiserId],
    imageUrl: row.photo_url,
    ticketsSold: 0,
    revenueNum: 0,
  }));
}

async function enrichGroupForDashboard(group, session, adminView) {
  const eventsApi = require('./supabase-organiser-events');
  return eventsApi.enrichGroupForDashboard(group, session, adminView);
}

function isPlatformAdmin(session) {
  return isAdminRole(session.role);
}

function airtableSetupHint() {
  return null;
}

module.exports = {
  listGroupsForSession,
  listGroupsForUser,
  createGroup,
  updateGroup,
  getGroupById,
  unpublishGroup,
  enrichGroupForDashboard,
  groupOwnedBySession,
  isPlatformAdmin,
  airtableSetupHint,
  rowToGroup,
};
