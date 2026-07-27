/**
 * Organiser groups API — Supabase organisers table + Storage uploads.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl, decodeUploadBuffer } = require('./supabase-storage');
const { imageDimensionsFromBuffer, imageDimensionsFromUrl } = require('./image-dimensions');
const { logoResolutionWarning } = require('./logo-quality');
const { isAdminRole } = require('./auth');
const { resolveOrganiserAccess, getOrCreateOrganiserAccount, groupVisibleInOrganiserWorkspace } = require('./supabase-organiser-access');
const { eventImageUrl } = require('./event-image');
const {
  clampComplimentaryVisitsAllowed,
  normalizeComplimentaryVisitsScope,
  syncSiblingGuestVisitSettings,
  GUEST_VISIT_SCOPE_ACROSS_GROUPS,
} = require('./guest-visits');
const { publicOrganiserSlug } = require('./organiser-slug');

function rowToGroup(row) {
  if (!row) return null;
  const industries = Array.isArray(row.industries) ? row.industries : [];
  const meetingFormats = Array.isArray(row.meeting_formats) ? row.meeting_formats : [];
  return {
    id: row.id,
    name: String(row.name || 'Untitled organiser').trim(),
    slug: publicOrganiserSlug(row) || '',
    ownerEmail: String(row.email || row.contact_email || '').toLowerCase(),
    contactEmail: String(row.contact_email || row.email || '').toLowerCase(),
    description: String(row.description || '').trim(),
    userIds: row.supabase_user_id ? [row.supabase_user_id] : [],
    organiserAccountId: row.organiser_account_id || null,
    imageUrl: String(row.photo_url || '').trim(),
    website: String(row.website || '').trim(),
    instagramUrl: String(row.instagram_url || '').trim(),
    facebookUrl: String(row.facebook_url || '').trim(),
    linkedinUrl: String(row.linkedin_url || '').trim(),
    xUrl: String(row.x_url || '').trim(),
    industries,
    meetingFormats,
    location: industries.join(', '),
    statusRaw: row.listing_status || 'draft',
    verificationStatus: row.verification_status || 'Pending',
    rating: row.average_rating != null ? Number(row.average_rating) : null,
    revenueNum: 0,
    createdAt: row.created_at || null,
    stripeAccountId: row.stripe_account_id || null,
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
    stripeConnectDetailsSubmitted: Boolean(row.stripe_connect_details_submitted),
    stripeConnectReady:
      Boolean(row.stripe_account_id) &&
      Boolean(row.stripe_charges_enabled) &&
      Boolean(row.stripe_connect_details_submitted),
    stripeConnectOnboardedAt: row.stripe_connect_onboarded_at || null,
    ownershipClaimStatus: row.ownership_claim_status || null,
    ownershipClaimedAt: row.ownership_claimed_at || null,
    complimentaryVisitsAllowed: clampComplimentaryVisitsAllowed(row.complimentary_visits_allowed),
    complimentaryVisitsScope: normalizeComplimentaryVisitsScope(row.complimentary_visits_scope),
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
  const uid = isUuid(userId) ? userId : null;
  if (!uid) return [];

  const { data, error } = await sb
    .from('organisers')
    .select('*')
    .eq('supabase_user_id', uid)
    .neq('ownership_claim_status', 'disputed')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return (data || [])
    .filter((row) => groupVisibleInOrganiserWorkspace({ sub: userId, email }, row))
    .map(rowToGroup);
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

async function listGroupsForAccount(session, resolvedAccess) {
  const access = resolvedAccess || (await resolveOrganiserAccess(session));
  if (!access.groupIds.length) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('*')
    .in('id', access.groupIds)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((row) => groupVisibleInOrganiserWorkspace(session, row))
    .map(rowToGroup);
}

function dedupeGroupsById(groups) {
  const byId = new Map();
  (groups || []).forEach((g) => {
    if (g && g.id && !byId.has(g.id)) byId.set(g.id, g);
  });
  return [...byId.values()];
}

async function listGroupsForSession(session, adminView, resolvedAccess) {
  if (adminView) return dedupeGroupsById(await listGroupsForAdminOverview(session));
  const accountGroups = await listGroupsForAccount(session, resolvedAccess);
  if (accountGroups.length) return dedupeGroupsById(accountGroups);
  return dedupeGroupsById(await listGroupsForUser(session.sub || '', session.email));
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

async function resolutionWarningFromPayload(payload) {
  if (payload.logoBase64) {
    const buffer = decodeUploadBuffer(payload.logoBase64);
    if (buffer) {
      const dims = imageDimensionsFromBuffer(buffer);
      if (dims) return logoResolutionWarning(dims.width, dims.height);
    }
  }

  const url = String(payload.logoUrl || '').trim();
  if (url && /^https?:\/\//i.test(url) && !payload.logoBase64) {
    const dims = await imageDimensionsFromUrl(url);
    if (dims) return logoResolutionWarning(dims.width, dims.height);
  }

  return null;
}

async function resolveLogo(payload, organiserId) {
  const resolutionWarning = await resolutionWarningFromPayload(payload);
  try {
    const url = await resolveImageUrl({
      folder: `organisers/${organiserId || 'new'}`,
      logoUrl: payload.logoUrl,
      logoBase64: payload.logoBase64,
      logoMime: payload.logoMime,
      logoFilename: payload.logoFilename,
    });
    return { url, warning: null, resolutionWarning };
  } catch (e) {
    const warning =
      e.message === 'Image must be under 2MB'
        ? e.message
        : 'Could not upload image. Use a URL below, or run 004_organiser_storage.sql in Supabase.';
    return { url: null, warning, resolutionWarning };
  }
}

async function createGroup(payload) {
  const sb = getSupabaseAdmin();
  const listing = normalizeListingStatus(payload.listingStatus || 'draft');
  let organiserAccountId = payload.organiserAccountId || null;
  if (!organiserAccountId && payload.session) {
    const account = await getOrCreateOrganiserAccount(payload.session);
    organiserAccountId = account ? account.id : null;
  }
  const userCreated = Boolean(payload.session);
  const claimedAt = userCreated ? new Date().toISOString() : null;
  const insert = {
    name: payload.name,
    email: (payload.contactEmail || payload.email || '').toLowerCase() || null,
    contact_email: (payload.contactEmail || payload.email || '').toLowerCase() || null,
    description: payload.description || null,
    website: payload.website || null,
    instagram_url: payload.instagramUrl || payload.instagram_url || null,
    facebook_url: payload.facebookUrl || payload.facebook_url || null,
    linkedin_url: payload.linkedinUrl || payload.linkedin_url || null,
    x_url: payload.xUrl || payload.x_url || null,
    industries: Array.isArray(payload.industries) ? payload.industries : [],
    meeting_formats: Array.isArray(payload.meetingFormats) ? payload.meetingFormats : [],
    organiser_type: 'Events',
    verification_status: payload.verificationStatus || 'Pending',
    listing_status: listing,
    supabase_user_id: userCreated ? payload.userId || payload.session?.sub || null : payload.userId || null,
    organiser_account_id: organiserAccountId,
    ownership_claim_status: userCreated ? 'claimed' : 'pending',
    ownership_claimed_at: claimedAt,
  };

  if (
    payload.complimentaryVisitsAllowed !== undefined ||
    payload.complimentary_visits_allowed !== undefined
  ) {
    insert.complimentary_visits_allowed = clampComplimentaryVisitsAllowed(
      payload.complimentaryVisitsAllowed ?? payload.complimentary_visits_allowed
    );
  }
  if (
    payload.complimentaryVisitsScope !== undefined ||
    payload.complimentary_visits_scope !== undefined
  ) {
    insert.complimentary_visits_scope = normalizeComplimentaryVisitsScope(
      payload.complimentaryVisitsScope ?? payload.complimentary_visits_scope
    );
  }

  let created = null;
  let error = null;
  ({ data: created, error } = await sb.from('organisers').insert(insert).select('*').single());
  if (
    error &&
    insert.complimentary_visits_scope !== undefined &&
    /complimentary_visits_scope/i.test(String(error.message || ''))
  ) {
    const retryInsert = { ...insert };
    delete retryInsert.complimentary_visits_scope;
    ({ data: created, error } = await sb.from('organisers').insert(retryInsert).select('*').single());
  }
  if (error) throw new Error(error.message);

  if (
    normalizeComplimentaryVisitsScope(created.complimentary_visits_scope) ===
    GUEST_VISIT_SCOPE_ACROSS_GROUPS
  ) {
    await syncSiblingGuestVisitSettings(sb, created.id, {
      scope: GUEST_VISIT_SCOPE_ACROSS_GROUPS,
      allowed: created.complimentary_visits_allowed,
    }).catch(() => {});
  }

  let logoWarning = null;
  let logoResolutionWarning = null;
  const hasLogo =
    payload.logoUrl || payload.logoBase64 || payload.logoMime || payload.logoFilename;
  if (hasLogo) {
    const { url, warning, resolutionWarning } = await resolveLogo(payload, created.id);
    if (warning) logoWarning = warning;
    if (resolutionWarning) logoResolutionWarning = resolutionWarning;
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
      if (logoResolutionWarning) group.logoResolutionWarning = logoResolutionWarning;
      return group;
    }
  }

  const group = rowToGroup(created);
  if (logoWarning) group.logoWarning = logoWarning;
  if (logoResolutionWarning) group.logoResolutionWarning = logoResolutionWarning;
  return group;
}

async function updateGroup(groupId, payload) {
  const sb = getSupabaseAdmin();
  const patch = {};

  if (payload.name) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description || null;
  if (payload.website !== undefined) patch.website = payload.website || null;
  if (payload.instagramUrl !== undefined || payload.instagram_url !== undefined) {
    patch.instagram_url = String(payload.instagramUrl ?? payload.instagram_url ?? '').trim() || null;
  }
  if (payload.facebookUrl !== undefined || payload.facebook_url !== undefined) {
    patch.facebook_url = String(payload.facebookUrl ?? payload.facebook_url ?? '').trim() || null;
  }
  if (payload.linkedinUrl !== undefined || payload.linkedin_url !== undefined) {
    patch.linkedin_url = String(payload.linkedinUrl ?? payload.linkedin_url ?? '').trim() || null;
  }
  if (payload.xUrl !== undefined || payload.x_url !== undefined) {
    patch.x_url = String(payload.xUrl ?? payload.x_url ?? '').trim() || null;
  }
  if (payload.contactEmail !== undefined) {
    patch.contact_email = payload.contactEmail || null;
    patch.email = payload.contactEmail || null;
  }
  if (payload.industries !== undefined) {
    patch.industries = Array.isArray(payload.industries) ? payload.industries : [];
  }
  if (payload.meetingFormats !== undefined) {
    patch.meeting_formats = Array.isArray(payload.meetingFormats) ? payload.meetingFormats : [];
  }
  if (
    payload.complimentaryVisitsAllowed !== undefined ||
    payload.complimentary_visits_allowed !== undefined
  ) {
    patch.complimentary_visits_allowed = clampComplimentaryVisitsAllowed(
      payload.complimentaryVisitsAllowed ?? payload.complimentary_visits_allowed
    );
  }
  if (
    payload.complimentaryVisitsScope !== undefined ||
    payload.complimentary_visits_scope !== undefined
  ) {
    patch.complimentary_visits_scope = normalizeComplimentaryVisitsScope(
      payload.complimentaryVisitsScope ?? payload.complimentary_visits_scope
    );
  }
  if (payload.listingStatus != null) {
    patch.listing_status = normalizeListingStatus(payload.listingStatus);
  }

  const hasLogo =
    payload.logoUrl || payload.logoBase64 || payload.logoMime || payload.logoFilename;
  let logoWarning = null;
  let logoResolutionWarning = null;
  if (hasLogo) {
    const { url, warning, resolutionWarning } = await resolveLogo(payload, groupId);
    if (warning) logoWarning = warning;
    if (resolutionWarning) logoResolutionWarning = resolutionWarning;
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

  let { data, error } = await sb
    .from('organisers')
    .update(patch)
    .eq('id', groupId)
    .select('*')
    .single();
  if (
    error &&
    patch.complimentary_visits_scope !== undefined &&
    /complimentary_visits_scope/i.test(String(error.message || ''))
  ) {
    const retryPatch = { ...patch };
    delete retryPatch.complimentary_visits_scope;
    if (!Object.keys(retryPatch).length) {
      const existing = await sb.from('organisers').select('*').eq('id', groupId).maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      data = existing.data;
      error = null;
    } else {
      ({ data, error } = await sb
        .from('organisers')
        .update(retryPatch)
        .eq('id', groupId)
        .select('*')
        .single());
    }
  }
  if (error) throw new Error(error.message);

  const guestVisitFieldsTouched =
    patch.complimentary_visits_allowed !== undefined ||
    patch.complimentary_visits_scope !== undefined;
  if (guestVisitFieldsTouched && data) {
    const scope = normalizeComplimentaryVisitsScope(data.complimentary_visits_scope);
    if (scope === GUEST_VISIT_SCOPE_ACROSS_GROUPS) {
      await syncSiblingGuestVisitSettings(sb, groupId, {
        scope,
        allowed: data.complimentary_visits_allowed,
      }).catch(() => {});
    } else if (patch.complimentary_visits_scope !== undefined) {
      // Switched back to per-group — align siblings' scope only, keep their own allowances.
      await syncSiblingGuestVisitSettings(sb, groupId, { scope }).catch(() => {});
    }
  }

  const group = rowToGroup(data);
  if (logoWarning) group.logoWarning = logoWarning;
  if (logoResolutionWarning) group.logoResolutionWarning = logoResolutionWarning;
  return group;
}

async function unpublishGroup(groupId) {
  return updateGroup(groupId, { listingStatus: 'unpublished' });
}

async function listEventsForOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, approval_status, starts_at, featured, image_url, photo_url, average_rating')
    .eq('organiser_id', organiserId);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    statusRaw: row.approval_status,
    date: row.starts_at,
    rating: row.average_rating,
    groupIds: [organiserId],
    imageUrl: eventImageUrl(row),
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
  listGroupsForAccount,
  createGroup,
  updateGroup,
  getGroupById,
  unpublishGroup,
  enrichGroupForDashboard,
  groupOwnedBySession,
  isPlatformAdmin,
  airtableSetupHint,
  rowToGroup,
  resolveOrganiserAccess,
};
