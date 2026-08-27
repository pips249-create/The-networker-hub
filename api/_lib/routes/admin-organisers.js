const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { resolveImageUrl } = require('../supabase-storage');
const { publicOrganiserSlug } = require('../organiser-slug');
const sbAuth = require('../supabase-auth');
const { fetchWebsiteMeta } = require('../website-meta');
const { createGroup } = require('../supabase-organiser');
const { resolveOrganiserClaimUrl } = require('../organiser-claim-url');
const { resolveClaimDispute, clearDisputedProfileEmail, resolveOrganiserClaimRequest, approveOrganiserClaimRequest } = require('../admin-supabase-data');
const { applyIlikeSearch } = require('../search-match');

const INCOMPLETE_FILTER =
  'description.is.null,description.eq.,photo_url.is.null,photo_url.eq.,website.is.null,website.eq.,email.is.null,email.eq.,contact_email.is.null,contact_email.eq.';
const INCOMPLETE_COUNT_CACHE_MS = 60 * 1000;
let incompleteCountCache = { value: null, at: 0 };

function invalidateIncompleteOrganiserCount() {
  incompleteCountCache = { value: null, at: 0 };
}

async function getIncompleteOrganiserCount(sb) {
  const now = Date.now();
  if (incompleteCountCache.value != null && now - incompleteCountCache.at < INCOMPLETE_COUNT_CACHE_MS) {
    return incompleteCountCache.value;
  }
  const incompleteRes = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .or(INCOMPLETE_FILTER);
  if (incompleteRes.error) throw new Error(incompleteRes.error.message);
  const count = incompleteRes.count || 0;
  incompleteCountCache = { value: count, at: now };
  return count;
}

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

function parseListQuery(query) {
  const offset = Math.max(parseInt(String(query?.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query?.limit || ''), 10) || 30, 1), 100);
  const q = String(query?.q || '').trim();
  const incomplete = query?.incomplete === '1' || query?.incomplete === 'true';
  const excludeHidden = query?.exclude_hidden === '1' || query?.exclude_hidden === 'true';
  const visibilityRaw = String(query?.visibility || '').trim().toLowerCase();
  const visibility =
    visibilityRaw === 'browse' ||
    visibilityRaw === 'on_browse' ||
    visibilityRaw === 'draft' ||
    visibilityRaw === 'unpublished'
      ? visibilityRaw === 'on_browse'
        ? 'browse'
        : visibilityRaw
      : '';
  const organiserId = String(query?.id || query?.organiser || '').trim();
  const featuredOnly = query?.featured === '1' || query?.featured === 'true';
  return { offset, limit, q, incomplete, excludeHidden, visibility, organiserId, featuredOnly };
}

async function eventCountsForOrganisers(sb, organiserIds) {
  const counts = {};
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return counts;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await sb.from('events').select('organiser_id').in('organiser_id', chunk);
    if (res.error) throw new Error(res.error.message);
    (res.data || []).forEach((row) => {
      counts[row.organiser_id] = (counts[row.organiser_id] || 0) + 1;
    });
  }
  return counts;
}

function mapOrganiserRow(row, eventCount, loginMeta, moderation) {
  const description = String(row.description || '').trim();
  const photoUrl = String(row.photo_url || '').trim();
  const website = String(row.website || '').trim();
  const email = String(row.contact_email || row.email || '').trim().toLowerCase();
  const missing = [];
  if (!email) missing.push('email');
  if (!description) missing.push('description');
  if (!photoUrl) missing.push('logo');
  if (!website) missing.push('website');

  const userId = loginMeta?.userId || row.supabase_user_id || null;
  const hasLogin = loginMeta?.hasLogin != null ? loginMeta.hasLogin : Boolean(userId);
  const mod = moderation || {
    warning_count: 0,
    warning_limit: 3,
    hub_suspended: false,
    recent: [],
  };

  return {
    id: row.id,
    name: String(row.name || '').trim(),
    email,
    user_id: userId,
    has_login: hasLogin,
    emails_enabled: loginMeta?.emailsEnabled ?? null,
    description,
    photo_url: photoUrl,
    website,
    instagram_url: String(row.instagram_url || '').trim(),
    facebook_url: String(row.facebook_url || '').trim(),
    linkedin_url: String(row.linkedin_url || '').trim(),
    x_url: String(row.x_url || '').trim(),
    listing_status: row.listing_status || '',
    ownership_claim_status: String(row.ownership_claim_status || '').trim().toLowerCase(),
    claim_invite_sent_at: row.claim_invite_sent_at || null,
    featured: Boolean(row.featured),
    featured_until: row.featured_until || null,
    featuredUntil: row.featured_until || null,
    city: String(row.city || '').trim(),
    slug: publicOrganiserSlug(row) || '',
    event_count: eventCount || 0,
    missing,
    moderation: mod,
    warning_count: mod.warning_count,
    warning_limit: mod.warning_limit,
    hub_suspended: mod.hub_suspended,
  };
}

async function loginMetaForOrganisers(sb, rows) {
  const meta = new Map();
  const userIds = [...new Set((rows || []).map((r) => r.supabase_user_id).filter(Boolean))];
  const hubByUser = new Map();

  if (userIds.length) {
    for (let i = 0; i < userIds.length; i += 80) {
      const chunk = userIds.slice(i, i + 80);
      const { data, error } = await sb
        .from('hub_accounts')
        .select('user_id, emails_enabled')
        .in('user_id', chunk);
      if (error) throw new Error(error.message);
      (data || []).forEach((h) => hubByUser.set(h.user_id, h));
    }
  }

  const emailsNeedingLookup = new Set();
  for (const row of rows || []) {
    if (row.supabase_user_id) continue;
    const em = String(row.contact_email || row.email || '')
      .trim()
      .toLowerCase();
    if (em) emailsNeedingLookup.add(em);
  }

  const authByEmail = new Map();
  await Promise.all(
    [...emailsNeedingLookup].map(async (em) => {
      try {
        const user = await sbAuth.findUserByEmail(em);
        if (user?.id) authByEmail.set(em, user.id);
      } catch {
        /* ignore per-email lookup failures */
      }
    })
  );

  const resolvedUserIds = [...new Set([...authByEmail.values()].filter(Boolean))].filter(
    (id) => !hubByUser.has(id)
  );
  if (resolvedUserIds.length) {
    for (let i = 0; i < resolvedUserIds.length; i += 80) {
      const chunk = resolvedUserIds.slice(i, i + 80);
      const { data, error } = await sb
        .from('hub_accounts')
        .select('user_id, emails_enabled')
        .in('user_id', chunk);
      if (error) throw new Error(error.message);
      (data || []).forEach((h) => hubByUser.set(h.user_id, h));
    }
  }

  for (const row of rows || []) {
    const em = String(row.contact_email || row.email || '')
      .trim()
      .toLowerCase();
    let userId = row.supabase_user_id || null;
    if (!userId && em) userId = authByEmail.get(em) || null;

    if (!userId) {
      meta.set(row.id, { userId: null, hasLogin: false, emailsEnabled: null });
      continue;
    }

    const hub = hubByUser.get(userId);
    meta.set(row.id, {
      userId,
      hasLogin: true,
      emailsEnabled: hub ? hub.emails_enabled !== false : true,
    });
  }

  return meta;
}

async function claimInviteSentAtForOrganisers(sb, ids) {
  const map = new Map();
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return map;
  try {
    const { data, error } = await sb
      .from('entity_activity_log')
      .select('organiser_id, created_at, action')
      .in('action', ['admin_claim_invite', 'admin_claim_url'])
      .in('organiser_id', unique)
      .order('created_at', { ascending: false })
      .limit(Math.min(unique.length * 5, 200));
    if (error) throw error;
    (data || []).forEach((row) => {
      const id = String(row.organiser_id || '').trim();
      if (!id || map.has(id)) return;
      map.set(id, row.created_at || null);
    });
  } catch {
    /* activity log optional */
  }
  return map;
}

async function resolveOrganiserPhotoUrl(body, folder) {
  let photo_url;
  if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    photo_url = String(body.photo_url || '').trim() || null;
  }
  if (body.logoBase64) {
    const uploaded = await resolveImageUrl({
      folder,
      logoUrl: body.photo_url || body.logoUrl,
      logoBase64: body.logoBase64,
      logoMime: body.logoMime,
      logoFilename: body.logoFilename,
    });
    if (uploaded) photo_url = uploaded;
  }
  return photo_url;
}

function normalizeContactEmail(body) {
  if (
    !Object.prototype.hasOwnProperty.call(body, 'contact_email') &&
    !Object.prototype.hasOwnProperty.call(body, 'email')
  ) {
    return undefined;
  }
  const email = String(body.contact_email ?? body.email ?? '')
    .trim()
    .toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('invalid_email');
    err.status = 400;
    err.message = 'Enter a valid contact email.';
    throw err;
  }
  return email || null;
}

async function applyOrganiserContactEmail(organiserId, email) {
  const id = String(organiserId || '').trim();
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!id) {
    const err = new Error('missing_id');
    err.status = 400;
    throw err;
  }
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    const err = new Error('invalid_email');
    err.status = 400;
    err.message = 'Enter a valid contact email.';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('organisers')
    .select('id, ownership_claim_status')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }

  const patch = { email: em, contact_email: em };
  if (existing.ownership_claim_status !== 'claimed' && existing.ownership_claim_status !== 'disputed') {
    patch.ownership_claim_status = 'pending';
  }

  const { data, error } = await sb.from('organisers').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  invalidateIncompleteOrganiserCount();
  return data;
}

function buildOrganiserPatch(body, photo_url) {
  const patch = {};
  const contactEmail = normalizeContactEmail(body);
  if (contactEmail !== undefined) {
    patch.email = contactEmail;
    patch.contact_email = contactEmail;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.name = String(body.name || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = String(body.description || '').trim() || null;
  }
  if (photo_url !== undefined) patch.photo_url = photo_url;
  if (Object.prototype.hasOwnProperty.call(body, 'website')) {
    patch.website = String(body.website || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'instagram_url')) {
    patch.instagram_url = String(body.instagram_url || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'facebook_url')) {
    patch.facebook_url = String(body.facebook_url || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'linkedin_url')) {
    patch.linkedin_url = String(body.linkedin_url || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'x_url')) {
    patch.x_url = String(body.x_url || '').trim() || null;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'featured') ||
    Object.prototype.hasOwnProperty.call(body, 'featured_until') ||
    Object.prototype.hasOwnProperty.call(body, 'featuredUntil')
  ) {
    const { applyAdminFeaturedPatch } = require('../admin-featured-until');
    applyAdminFeaturedPatch(patch, body);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'hide_from_browse')) {
    patch.listing_status = body.hide_from_browse ? 'unpublished' : 'published';
  } else if (Object.prototype.hasOwnProperty.call(body, 'listing_status')) {
    const status = String(body.listing_status || '').trim().toLowerCase();
    if (status === 'draft' || status === 'published' || status === 'unpublished') {
      patch.listing_status = status;
    }
  }
  return patch;
}

async function listOrganisersForAdmin(query) {
  const sb = getSupabaseAdmin();
  const { applyPublicOrganiserBrowseFilter } = require('../supabase-organisers-browse');
  const { offset, limit, q, incomplete, excludeHidden, visibility, organiserId, featuredOnly } =
    parseListQuery(query);

  let dbQuery = sb
    .from('organisers')
    .select(
      'id, name, email, contact_email, supabase_user_id, description, photo_url, website, instagram_url, facebook_url, linkedin_url, x_url, listing_status, ownership_claim_status, slug, featured, featured_until, created_at',
      { count: 'exact' }
    )
    .order('featured', { ascending: false })
    .order('name', { ascending: true });

  if (organiserId) dbQuery = dbQuery.eq('id', organiserId);
  else {
    if (featuredOnly) dbQuery = dbQuery.eq('featured', true);
    if (q) {
      // Name or contact email — word-split, &/and synonym, light typo tolerance.
      dbQuery = applyIlikeSearch(dbQuery, q, ['name', 'email', 'contact_email']);
    }
    if (incomplete) dbQuery = dbQuery.or(INCOMPLETE_FILTER);
    if (visibility === 'browse') {
      dbQuery = applyPublicOrganiserBrowseFilter(dbQuery);
    } else if (visibility === 'draft') {
      dbQuery = dbQuery.or('listing_status.eq.draft,listing_status.is.null');
    } else if (visibility === 'unpublished') {
      dbQuery = dbQuery.eq('listing_status', 'unpublished');
    } else if (excludeHidden) {
      dbQuery = dbQuery.neq('listing_status', 'unpublished');
    }
  }

  const res = organiserId ? await dbQuery.limit(1) : await dbQuery.range(offset, offset + limit - 1);
  if (res.error) throw new Error(res.error.message);

  const rows = res.data || [];
  const { moderationSummariesForOrganisers } = require('../organiser-moderation');
  const [counts, loginMeta, moderationById, claimInviteSentAt] = await Promise.all([
    eventCountsForOrganisers(
      sb,
      rows.map((r) => r.id)
    ),
    loginMetaForOrganisers(sb, rows),
    moderationSummariesForOrganisers(
      sb,
      rows.map((r) => r.id)
    ),
    claimInviteSentAtForOrganisers(
      sb,
      rows.map((r) => r.id)
    ),
  ]);
  const total = organiserId ? rows.length : res.count != null ? res.count : rows.length;

  const incompleteCount = await getIncompleteOrganiserCount(sb);

  return {
    organisers: rows.map((row) =>
      mapOrganiserRow(
        { ...row, claim_invite_sent_at: claimInviteSentAt.get(row.id) || null },
        counts[row.id] || 0,
        loginMeta.get(row.id),
        moderationById.get(row.id)
      )
    ),
    count: rows.length,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    incomplete: incompleteCount,
  };
}

async function ensureOrganiserAccountId(sb, organiser) {
  if (organiser.organiser_account_id) return organiser.organiser_account_id;

  const em = String(organiser.contact_email || organiser.email || '')
    .trim()
    .toLowerCase();
  const uid = organiser.supabase_user_id || null;

  let account = null;
  if (uid) {
    const { data } = await sb.from('organiser_accounts').select('*').eq('supabase_user_id', uid).maybeSingle();
    account = data;
  }
  if (!account && em) {
    const { data } = await sb.from('organiser_accounts').select('*').eq('email', em).maybeSingle();
    account = data;
  }
  if (!account) {
    const { data: created, error } = await sb
      .from('organiser_accounts')
      .insert({ email: em || null, supabase_user_id: uid })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    account = created;
  } else if (uid && !account.supabase_user_id) {
    await sb.from('organiser_accounts').update({ supabase_user_id: uid }).eq('id', account.id);
  }

  const { error: linkErr } = await sb
    .from('organisers')
    .update({ organiser_account_id: account.id })
    .eq('id', organiser.id);
  if (linkErr) throw new Error(linkErr.message);

  return account.id;
}

async function addTeamMemberIfNeeded(sb, accountId, owner, primaryOwnerEmails) {
  const em = String(owner.email || '')
    .trim()
    .toLowerCase();
  if (!em || primaryOwnerEmails.has(em)) return false;

  const { data: existing } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('organiser_account_id', accountId)
    .eq('email', em)
    .maybeSingle();

  if (existing && existing.status === 'active') return false;

  if (existing) {
    const { error } = await sb
      .from('organiser_team_members')
      .update({
        status: 'active',
        role: 'editor',
        supabase_user_id: owner.supabase_user_id || existing.supabase_user_id || null,
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return true;
  }

  const { error } = await sb.from('organiser_team_members').insert({
    organiser_account_id: accountId,
    email: em,
    supabase_user_id: owner.supabase_user_id || null,
    role: 'editor',
    status: 'active',
    invited_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return true;
}

async function collectOwnersFromOrganiser(sb, organiser, accountId, primaryOwnerEmails, ownersToAdd) {
  const dupEmail = String(organiser.contact_email || organiser.email || '')
    .trim()
    .toLowerCase();
  if (dupEmail && !primaryOwnerEmails.has(dupEmail) && !ownersToAdd.some((o) => o.email === dupEmail)) {
    ownersToAdd.push({ email: dupEmail, supabase_user_id: organiser.supabase_user_id || null });
  }

  if (!organiser.organiser_account_id || organiser.organiser_account_id === accountId) return;

  const { data: dupAccount } = await sb
    .from('organiser_accounts')
    .select('*')
    .eq('id', organiser.organiser_account_id)
    .maybeSingle();
  if (dupAccount) {
    const accountEmail = String(dupAccount.email || '')
      .trim()
      .toLowerCase();
    if (
      accountEmail &&
      !primaryOwnerEmails.has(accountEmail) &&
      !ownersToAdd.some((o) => o.email === accountEmail)
    ) {
      ownersToAdd.push({
        email: accountEmail,
        supabase_user_id: dupAccount.supabase_user_id || null,
      });
    }
  }

  const { data: dupTeam } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('organiser_account_id', organiser.organiser_account_id)
    .in('status', ['active', 'pending']);
  for (const tm of dupTeam || []) {
    const tmEmail = String(tm.email || '')
      .trim()
      .toLowerCase();
    if (tmEmail && !primaryOwnerEmails.has(tmEmail) && !ownersToAdd.some((o) => o.email === tmEmail)) {
      ownersToAdd.push({ email: tmEmail, supabase_user_id: tm.supabase_user_id || null });
    }
  }
}

const ORGANISER_REF_TABLES = [
  'events',
  'registrations',
  'reviews',
  'workshops',
  'business_opportunities',
  'listing_reports',
];

async function unlinkOrganiserRefs(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return { eventsUnlinked: 0 };

  let eventsUnlinked = 0;
  for (const id of ids) {
    for (const table of ORGANISER_REF_TABLES) {
      const { data, error } = await sb
        .from(table)
        .update({ organiser_id: null })
        .eq('organiser_id', id)
        .select('id');
      if (error) throw new Error(error.message);
      if (table === 'events') eventsUnlinked += (data || []).length;
    }
  }

  return { eventsUnlinked };
}

async function deleteOrganisers(body) {
  const ids = [
    ...new Set(
      (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    const err = new Error('missing_ids');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data: rows, error: fetchErr } = await sb
    .from('organisers')
    .select('id, name')
    .in('id', ids);
  if (fetchErr) throw new Error(fetchErr.message);

  const foundIds = (rows || []).map((r) => r.id);
  const missingIds = ids.filter((id) => !foundIds.includes(id));

  if (!foundIds.length) {
    const { eventsUnlinked } = await unlinkOrganiserRefs(sb, missingIds);
    return {
      deleted: 0,
      alreadyGone: missingIds.length,
      eventsUnlinked,
      names: [],
      message:
        eventsUnlinked > 0
          ? 'Group profile was already removed — cleared ' +
            eventsUnlinked +
            ' broken event link' +
            (eventsUnlinked === 1 ? '' : 's') +
            '.'
          : 'Group profile was already removed.',
    };
  }

  const { assertGroupCanBeRemoved } = require('../group-removal-guard');
  await assertGroupCanBeRemoved(foundIds, { action: 'delete' });

  const eventCounts = await eventCountsForOrganisers(sb, foundIds);
  const eventsUnlinked = foundIds.reduce((sum, id) => sum + (eventCounts[id] || 0), 0);

  await unlinkOrganiserRefs(sb, foundIds);

  const { error: delErr } = await sb.from('organisers').delete().in('id', foundIds);
  if (delErr) throw new Error(delErr.message);
  invalidateIncompleteOrganiserCount();

  let orphanEventsUnlinked = 0;
  if (missingIds.length) {
    const purged = await unlinkOrganiserRefs(sb, missingIds);
    orphanEventsUnlinked = purged.eventsUnlinked;
  }

  return {
    deleted: foundIds.length,
    alreadyGone: missingIds.length,
    eventsUnlinked: eventsUnlinked + orphanEventsUnlinked,
    names: (rows || []).map((r) => String(r.name || '').trim()).filter(Boolean),
  };
}

async function mergeOrganisers(body) {
  const primaryId = String(body.primaryId || '').trim();
  const ids = [
    ...new Set(
      (Array.isArray(body.ids) ? body.ids : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];

  if (!primaryId) {
    const err = new Error('missing_primary_id');
    err.status = 400;
    throw err;
  }
  if (!ids.includes(primaryId)) ids.unshift(primaryId);
  if (ids.length < 2) {
    const err = new Error('need_at_least_two_groups');
    err.status = 400;
    throw err;
  }

  const duplicateIds = ids.filter((id) => id !== primaryId);
  if (!duplicateIds.length) {
    const err = new Error('no_duplicates_to_merge');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data: rows, error: fetchErr } = await sb.from('organisers').select('*').in('id', ids);
  if (fetchErr) throw new Error(fetchErr.message);

  const primary = (rows || []).find((r) => r.id === primaryId);
  if (!primary) {
    const err = new Error('primary_not_found');
    err.status = 404;
    throw err;
  }

  const accountId = await ensureOrganiserAccountId(sb, primary);
  const primaryOwnerEmails = new Set();
  const primaryEmail = String(primary.contact_email || primary.email || '')
    .trim()
    .toLowerCase();
  if (primaryEmail) primaryOwnerEmails.add(primaryEmail);

  const { data: primaryAccount } = await sb
    .from('organiser_accounts')
    .select('email')
    .eq('id', accountId)
    .maybeSingle();
  if (primaryAccount?.email) {
    primaryOwnerEmails.add(String(primaryAccount.email).toLowerCase());
  }

  const result = { merged: 0, teamAdded: 0, eventsMoved: 0, primaryId, primaryName: primary.name };

  for (const dupId of duplicateIds) {
    const dup = (rows || []).find((r) => r.id === dupId);
    if (!dup) continue;

    const { data: movedEvents, error: evErr } = await sb
      .from('events')
      .update({ organiser_id: primaryId })
      .eq('organiser_id', dupId)
      .select('id');
    if (evErr) throw new Error(evErr.message);
    result.eventsMoved += (movedEvents || []).length;

    for (const table of ['registrations', 'reviews', 'workshops']) {
      const { error } = await sb.from(table).update({ organiser_id: primaryId }).eq('organiser_id', dupId);
      if (error) throw new Error(error.message);
    }

    const ownersToAdd = [];
    await collectOwnersFromOrganiser(sb, dup, accountId, primaryOwnerEmails, ownersToAdd);
    for (const owner of ownersToAdd) {
      const added = await addTeamMemberIfNeeded(sb, accountId, owner, primaryOwnerEmails);
      if (added) result.teamAdded += 1;
    }

    const { error: delErr } = await sb.from('organisers').delete().eq('id', dupId);
    if (delErr) throw new Error(delErr.message);
    result.merged += 1;
  }

  invalidateIncompleteOrganiserCount();
  return result;
}

async function createOrganiserGroupFromAdmin(body) {
  const name = String(body.name || '').trim();
  const email = String(body.contact_email || body.email || '')
    .trim()
    .toLowerCase();
  if (!name) {
    const err = new Error('missing_name');
    err.status = 400;
    err.message = 'Enter a group name.';
    throw err;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('missing_email');
    err.status = 400;
    err.message = 'Enter a valid contact email.';
    throw err;
  }

  const created = await createGroup({
    name,
    contactEmail: email,
    email,
    description: String(body.description || '').trim() || null,
    website: String(body.website || '').trim() || null,
    listingStatus: 'draft',
    verificationStatus: 'Pending',
  });

  let provision = null;
  const shouldProvision = body.provision_login !== false && body.provision_login !== 'false';
  if (shouldProvision) {
    provision = await sbAuth.provisionOrganiserLogin(created.id);
  }

  invalidateIncompleteOrganiserCount();

  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from('organisers').select('*').eq('id', created.id).single();
  if (error) throw new Error(error.message);
  const counts = await eventCountsForOrganisers(sb, [created.id]);
  const loginMeta = await loginMetaForOrganisers(sb, [row]);
  const host = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const claimUrl = await resolveOrganiserClaimUrl(email, host);

  return {
    organiser: mapOrganiserRow(row, counts[created.id] || 0, loginMeta.get(created.id)),
    provision,
    claimUrl,
  };
}

async function bulkUpdateOrganisers(body) {
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
  if (!ids.length) {
    const err = new Error('missing_ids');
    err.status = 400;
    throw err;
  }

  const photo_url = await resolveOrganiserPhotoUrl(body, 'organisers/bulk');
  const patch = buildOrganiserPatch(body, photo_url);
  if (!Object.keys(patch).length) {
    const err = new Error('no_fields');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('organisers').update(patch).in('id', ids).select('*');
  if (error) throw new Error(error.message);
  invalidateIncompleteOrganiserCount();

  return {
    updated: (data || []).length,
    organisers: (data || []).map((row) => mapOrganiserRow(row, undefined)),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const data = await listOrganisersForAdmin(req.query || {});
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);

  if (body.action === 'fetch_website_meta') {
    const url = String(body.url || body.website || '').trim();
    try {
      const meta = await fetchWebsiteMeta(url);
      return json(res, 200, {
        ok: true,
        ...meta,
        message:
          meta.message ||
          (meta.logo_url && meta.description
            ? 'Found logo and description on the website.'
            : meta.logo_url
              ? 'Found logo on the website.'
              : 'Found description on the website.'),
      });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.message || 'fetch_website_meta_failed',
        message: e.message || 'Could not read that website.',
      });
    }
  }

  if (body.action === 'create_group') {
    try {
      const result = await createOrganiserGroupFromAdmin(body);
      const provision = result.provision;
      let message = 'Networking group created as a draft.';
      if (provision) {
        message = provision.createdAuth
          ? 'Group created and login added for ' + provision.email + ' (no email sent).'
          : 'Group created and linked to existing login for ' + provision.email + ' (no email sent).';
      }
      return json(res, 201, { ok: true, ...result, message });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_name: 'Enter a group name.',
        missing_email: 'Enter a valid contact email.',
        organiser_missing_email: 'Enter a valid contact email.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'create_group_failed',
        message: messages[e.message] || e.message || 'Could not create group.',
      });
    }
  }

  if (body.action === 'get_claim_url' || body.action === 'send_claim_invite') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    if (!organiserId) {
      return json(res, 400, { ok: false, error: 'missing_id', message: 'Group id is required.' });
    }
    try {
      const sb = getSupabaseAdmin();
      const { data: organiser, error } = await sb
        .from('organisers')
        .select('id, name, email, contact_email, supabase_user_id, ownership_claim_status')
        .eq('id', organiserId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!organiser) {
        return json(res, 404, { ok: false, error: 'organiser_not_found', message: 'Group profile not found.' });
      }
      const email = String(organiser.contact_email || organiser.email || '')
        .trim()
        .toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, {
          ok: false,
          error: 'organiser_missing_email',
          message: 'Add a valid contact email before getting the claim link.',
        });
      }
      if (String(organiser.ownership_claim_status || '').toLowerCase() === 'claimed') {
        return json(res, 400, {
          ok: false,
          error: 'already_claimed',
          message: 'This group has already claimed their page, so the claim link is not needed.',
        });
      }

      const host = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
      const claimUrl = await resolveOrganiserClaimUrl(email, host);

      try {
        const { logFromSession } = require('../entity-activity-log');
        await logFromSession(session, null, {
          entity_type: 'organiser',
          entity_id: organiser.id,
          organiser_id: organiser.id,
          action: 'admin_claim_url',
          summary: 'platform admin copied claim link for ' + email,
          metadata: { to: email, claimUrl, source: 'admin' },
        });
      } catch {
        /* ignore */
      }

      return json(res, 200, {
        ok: true,
        email,
        claimUrl,
        message: 'Claim link ready for ' + email + '.',
      });
    } catch (e) {
      return json(res, e.status || 500, {
        ok: false,
        error: e.message || 'get_claim_url_failed',
        message: e.message || 'Could not resolve the claim link.',
      });
    }
  }

  if (body.action === 'bulk_update') {
    try {
      const result = await bulkUpdateOrganisers(body);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, { ok: false, error: e.message || 'bulk_update_failed', message: e.message });
    }
  }

  if (body.action === 'provision_user') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    if (!organiserId) {
      return json(res, 400, { ok: false, error: 'missing_id', message: 'Organiser id is required.' });
    }
    try {
      const result = await sbAuth.provisionOrganiserLogin(organiserId);
      return json(res, 200, {
        ok: true,
        ...result,
        message: result.createdAuth
          ? 'Login created (no email sent). You can impersonate this group now.'
          : 'Login linked to this group profile.',
      });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        organiser_not_found: 'Group profile not found.',
        organiser_missing_email: 'Add an email to this group before creating a login.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'provision_failed',
        message: messages[e.message] || e.message || 'Could not create login.',
      });
    }
  }

  if (body.action === 'set_emails_enabled') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    const userId = String(body.userId || body.user_id || '').trim();
    const enabled = Boolean(body.emails_enabled ?? body.emailsEnabled);

    try {
      let targetUserId = userId;
      if (!targetUserId && organiserId) {
        const sb = getSupabaseAdmin();
        const { data: organiser } = await sb
          .from('organisers')
          .select('supabase_user_id, email, contact_email')
          .eq('id', organiserId)
          .maybeSingle();
        targetUserId = organiser?.supabase_user_id || '';
        if (!targetUserId) {
          const em = String(organiser?.contact_email || organiser?.email || '')
            .trim()
            .toLowerCase();
          if (em) {
            const user = await sbAuth.findUserByEmail(em);
            targetUserId = user?.id || '';
          }
        }
      }

      if (!targetUserId) {
        return json(res, 400, {
          ok: false,
          error: 'no_login',
          message: 'Create a login for this group first.',
        });
      }

      const hub = await sbAuth.setEmailsEnabled(targetUserId, enabled);
      return json(res, 200, {
        ok: true,
        userId: hub.user_id,
        emails_enabled: hub.emails_enabled,
        message: enabled ? 'Emails enabled for this account.' : 'Emails blocked for this account.',
      });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.message || 'update_failed',
        message: e.message || 'Could not update email setting.',
      });
    }
  }

  if (body.action === 'merge_groups') {
    try {
      const result = await mergeOrganisers(body);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_primary_id: 'Choose which group to keep as the primary profile.',
        need_at_least_two_groups: 'Select at least two groups to merge.',
        no_duplicates_to_merge: 'Select at least one duplicate to merge into the primary.',
        primary_not_found: 'Primary group not found.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'merge_failed',
        message: messages[e.message] || e.message || 'Merge failed',
      });
    }
  }

  if (body.action === 'message_organiser') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    const eventId = String(body.eventId || body.event_id || '').trim();
    const reason = String(body.reason || '').trim();
    const message = String(body.message || body.details || '').trim();
    if (!organiserId) {
      return json(res, 400, { ok: false, error: 'missing_id', message: 'Organiser id is required.' });
    }
    if (!message) {
      return json(res, 400, { ok: false, error: 'missing_message', message: 'Write a short note for the organiser.' });
    }
    try {
      const sb = getSupabaseAdmin();
      const { sendOrganiserListingUpdatedEmail } = require('../admin-organiser-message-emails');
      const result = await sendOrganiserListingUpdatedEmail(sb, {
        organiserId,
        eventId,
        reason,
        message,
      });
      if (result.skipped) {
        const skippedMessages = {
          missing_organiser: 'Choose a networking group first.',
          organiser_not_found: 'That networking group was not found.',
          missing_organiser_email: 'This group has no contact email — add one on the profile, then try again.',
          missing_message: 'Write a short note for the organiser.',
        };
        return json(res, 400, {
          ok: false,
          error: result.reason || 'message_skipped',
          message: skippedMessages[result.reason] || 'Could not send the message.',
        });
      }
      if (!result.sent) {
        return json(res, 500, {
          ok: false,
          error: result.code || 'send_failed',
          message: result.error || 'Could not send the email.',
        });
      }
      try {
        const { logFromSession } = require('../entity-activity-log');
        await logFromSession(session, null, {
          entity_type: eventId ? 'event' : 'organiser',
          entity_id: eventId || organiserId,
          organiser_id: organiserId,
          action: 'admin_listing_message',
          summary:
            'platform admin emailed organiser about a listing change' +
            (result.listingLabel ? ': ' + String(result.listingLabel).slice(0, 80) : '') +
            (reason ? ' (' + reason + ')' : ''),
          metadata: { reason, to: result.to, eventId: eventId || null, source: 'admin' },
        });
      } catch {
        /* ignore */
      }
      return json(res, 200, {
        ok: true,
        ...result,
        message: 'Email sent to ' + result.to + '.',
      });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.message || 'message_failed',
        message: e.message || 'Could not email the organiser.',
      });
    }
  }

  if (body.action === 'issue_warning') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    if (!organiserId) {
      return json(res, 400, { ok: false, error: 'missing_id', message: 'Organiser id is required.' });
    }
    try {
      const sb = getSupabaseAdmin();
      const { issueManualConductWarning, MANUAL_WARNING_REASONS } = require('../organiser-moderation');
      const result = await issueManualConductWarning(sb, {
        organiserId,
        reason: body.reason,
        details: body.details,
        adminUserId: session.sub,
      });
      let message = 'Warning ' + result.warningCount + ' of ' + result.warningLimit + ' recorded.';
      if (result.hubSuspended) {
        message += ' Organiser profile suspended and live events unpublished.';
      }
      const emailResult = result.warningEmailResult;
      if (emailResult?.sent) {
        message += ' Warning email sent.';
      } else if (emailResult?.skipped) {
        message +=
          ' Warning email not sent (' +
          (emailResult.reason === 'missing_organiser_email'
            ? 'no organiser email on file'
            : emailResult.reason || 'skipped') +
          ').';
      } else if (emailResult && emailResult.sent === false) {
        message += ' Warning email failed: ' + (emailResult.error || 'unknown error') + '.';
      }
      return json(res, 200, { ok: true, ...result, message });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.message || 'issue_warning_failed',
        message: e.message || 'Could not issue warning.',
      });
    }
  }

  if (body.action === 'reinstate_organiser') {
    const organiserId = String(body.id || body.organiserId || body.organiser_id || '').trim();
    if (!organiserId) {
      return json(res, 400, { ok: false, error: 'missing_id', message: 'Organiser id is required.' });
    }
    try {
      const sb = getSupabaseAdmin();
      const { reinstateOrganiser } = require('../organiser-moderation');
      const result = await reinstateOrganiser(sb, {
        organiserId,
        details: body.details,
        adminUserId: session.sub,
      });
      return json(res, 200, {
        ok: true,
        ...result,
        message:
          'Organiser profile reinstated (published). They must republish events manually. Warning history remains on record.',
      });
    } catch (e) {
      const status = e.status || 500;
      return json(res, status, {
        ok: false,
        error: e.message || 'reinstate_failed',
        message: e.message || 'Could not reinstate organiser.',
      });
    }
  }

  if (body.action === 'delete_groups') {
    try {
      const result = await deleteOrganisers(body);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_ids: 'Select at least one group to delete.',
      };
      return json(res, status, {
        ok: false,
        error: e.code || e.message || 'delete_failed',
        message: messages[e.message] || e.message || 'Delete failed',
        eventCount: e.eventCount || undefined,
      });
    }
  }

  if (body.action === 'resolve_claim_dispute') {
    try {
      const dispute = await resolveClaimDispute(body.disputeId || body.id);
      invalidateIncompleteOrganiserCount();
      return json(res, 200, {
        ok: true,
        dispute,
        message: 'Dispute marked resolved. The alert will clear on the next refresh.',
      });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_dispute_id: 'Missing dispute id.',
        dispute_not_found: 'This dispute is already resolved or could not be found.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'resolve_dispute_failed',
        message: messages[e.message] || e.message || 'Could not resolve dispute.',
      });
    }
  }

  if (body.action === 'clear_disputed_profile_email') {
    try {
      const dispute = await clearDisputedProfileEmail(body.disputeId || body.id);
      invalidateIncompleteOrganiserCount();
      return json(res, 200, {
        ok: true,
        dispute,
        message: 'Profile email cleared and dispute resolved. The reporter will no longer be matched to this listing.',
      });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_dispute_id: 'Missing dispute id.',
        dispute_not_found: 'This dispute is already resolved or could not be found.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'clear_dispute_email_failed',
        message: messages[e.message] || e.message || 'Could not clear profile email.',
      });
    }
  }

  if (body.action === 'resolve_organiser_claim_request') {
    try {
      const request = await resolveOrganiserClaimRequest(body.requestId || body.id);
      return json(res, 200, {
        ok: true,
        request,
        message: 'Claim request marked resolved.',
      });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_request_id: 'Missing request id.',
        request_not_found: 'This claim request is already resolved or could not be found.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'resolve_claim_request_failed',
        message: messages[e.message] || e.message || 'Could not resolve claim request.',
      });
    }
  }

  if (body.action === 'approve_organiser_claim_request') {
    try {
      const result = await approveOrganiserClaimRequest(body.requestId || body.id);
      invalidateIncompleteOrganiserCount();
      return json(res, 200, {
        ok: true,
        ...result,
        message:
          'Contact email updated and claim invite sent to ' +
          String(result.claimantEmail || 'the claimant') +
          '.',
      });
    } catch (e) {
      const status = e.status || 500;
      const messages = {
        missing_request_id: 'Missing request id.',
        request_not_found: 'This claim request is already resolved or could not be found.',
        organiser_not_found: 'The linked group profile could not be found.',
        already_claimed: 'This profile is already claimed — no invite was sent.',
        invalid_claimant_email: 'The claim request is missing a valid claimant email.',
      };
      return json(res, status, {
        ok: false,
        error: e.message || 'approve_claim_request_failed',
        message: messages[e.message] || e.message || 'Could not approve claim request.',
      });
    }
  }

  const id = String(body.id || '').trim();
  if (!id) return json(res, 400, { error: 'missing_id' });

  try {
    const photo_url = await resolveOrganiserPhotoUrl(body, `organisers/${id}`);
    let patch;
    try {
      patch = buildOrganiserPatch(body, photo_url);
    } catch (patchErr) {
      return json(res, patchErr.status || 400, {
        ok: false,
        error: patchErr.message || 'invalid_patch',
        message: patchErr.message || 'Invalid update.',
      });
    }
    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    const sb = getSupabaseAdmin();
    // Saving contact email must NOT auto-claim. Claimed means the organiser
    // completed the claim flow (or Impersonate/events explicitly claimed).
    // Staff edits previously flipped new pages to "Claimed" and blocked Email 2.
    if (Object.prototype.hasOwnProperty.call(patch, 'contact_email')) {
      const { data: existing, error: existingErr } = await sb
        .from('organisers')
        .select('id, ownership_claim_status')
        .eq('id', id)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      if (!existing) {
        return json(res, 404, { ok: false, error: 'organiser_not_found', message: 'Group not found.' });
      }
      const status = String(existing.ownership_claim_status || '').toLowerCase();
      if (status !== 'claimed' && status !== 'disputed') {
        patch.ownership_claim_status = 'pending';
      }
    }
    const { data, error } = await sb.from('organisers').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    invalidateIncompleteOrganiserCount();
    try {
      const { logFromSession } = require('../entity-activity-log');
      await logFromSession(session, null, {
        entity_type: 'organiser',
        entity_id: id,
        organiser_id: id,
        action: 'admin_organiser_updated',
        summary:
          'platform admin updated group profile' +
          (data?.name ? ': ' + String(data.name).slice(0, 80) : '') +
          ' (' +
          Object.keys(patch).slice(0, 8).join(', ') +
          ')',
        metadata: { changedFields: Object.keys(patch), source: 'admin' },
      });
    } catch {
      /* ignore */
    }
    return json(res, 200, { ok: true, organiser: mapOrganiserRow(data, undefined) });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, { ok: false, error: e.message || 'update_failed', message: e.message });
  }
};

module.exports.applyOrganiserContactEmail = applyOrganiserContactEmail;
