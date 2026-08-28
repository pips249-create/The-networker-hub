/**
 * Organiser account access — owners, team members, and group scope.
 */
const { getSupabaseAdmin } = require('./supabase');
const {
  ORGANISER_TEAM_MAX,
  countTeamInviteSlots,
  teamSlotsRemaining,
} = require('./organiser-team-limits');
const { emailMatchesProfile } = require('./supabase-organiser-profile-email');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function groupVisibleInOrganiserWorkspace(session, row) {
  if (!row || row.ownership_claim_status === 'disputed') return false;
  if (row.ownership_claim_status === 'claimed') return true;
  if (row.ownership_claim_status === 'pending') {
    const uid = isUuid(session?.sub) ? session.sub : '';
    const em = String(session?.email || '')
      .trim()
      .toLowerCase();
    if (uid && row.supabase_user_id === uid) return true;
    return emailMatchesProfile(em, row);
  }
  const uid = isUuid(session?.sub) ? session.sub : null;
  if (uid && row.supabase_user_id === uid) return true;
  return emailMatchesProfile(session?.email, row);
}

function rowToTeamMember(row, groupScope) {
  if (!row) return null;
  const scopedIds = groupScope === undefined ? null : groupScope;
  return {
    id: row.id,
    organiserAccountId: row.organiser_account_id,
    email: String(row.email || '').toLowerCase(),
    supabaseUserId: row.supabase_user_id || null,
    role: row.role || 'editor',
    status: row.status || 'pending',
    invitedAt: row.invited_at || row.created_at || null,
    createdAt: row.created_at || null,
    allGroups: scopedIds === null,
    groupIds: scopedIds === null ? [] : scopedIds,
  };
}

async function loadTeamMemberGroupScopes(sb, memberIds) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  const scopes = new Map();
  if (!ids.length) return scopes;

  const { data, error } = await sb
    .from('organiser_team_member_groups')
    .select('team_member_id, organiser_id')
    .in('team_member_id', ids);
  if (error) throw new Error(error.message);

  (data || []).forEach((row) => {
    const memberId = row.team_member_id;
    if (!scopes.has(memberId)) scopes.set(memberId, []);
    scopes.get(memberId).push(row.organiser_id);
  });
  ids.forEach((memberId) => {
    if (!scopes.has(memberId)) scopes.set(memberId, null);
  });
  return scopes;
}

async function loadScopedGroupIdsForMember(sb, memberId) {
  if (!memberId) return null;
  const scopes = await loadTeamMemberGroupScopes(sb, [memberId]);
  return scopes.get(memberId) ?? null;
}

/**
 * Accept pages already linked to this account only.
 * Never auto-claim unlinked organiser pages from client-supplied IDs —
 * ownership claims must go through the dedicated claim flow.
 */
async function validateAccountGroupIds(sb, accountId, groupIds) {
  const ids = [...new Set((groupIds || []).filter(Boolean))];
  if (!ids.length) return [];
  if (!accountId) {
    const e = new Error('One or more groups are not on this account');
    e.status = 400;
    throw e;
  }

  const { data, error } = await sb
    .from('organisers')
    .select('id, organiser_account_id, ownership_claim_status')
    .in('id', ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data || []).map((row) => [row.id, row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    const e = new Error('One or more groups are not on this account');
    e.status = 400;
    throw e;
  }

  for (const id of ids) {
    const row = byId.get(id);
    const linked = row.organiser_account_id;
    if (!linked || linked !== accountId) {
      const e = new Error('One or more groups are not on this account');
      e.status = 400;
      throw e;
    }
    if (row.ownership_claim_status === 'disputed') {
      const e = new Error('One or more groups are not on this account');
      e.status = 400;
      throw e;
    }
  }

  return ids;
}

async function setTeamMemberGroupAccess(sb, memberId, accountId, { allGroups, groupIds }) {
  if (allGroups) {
    const { error: delErr } = await sb
      .from('organiser_team_member_groups')
      .delete()
      .eq('team_member_id', memberId);
    if (delErr) throw new Error(delErr.message);
    return;
  }

  const ids = await validateAccountGroupIds(sb, accountId, groupIds);
  if (!ids.length) {
    const e = new Error('Select at least one group, or choose All groups');
    e.status = 400;
    throw e;
  }

  const { error: delErr } = await sb
    .from('organiser_team_member_groups')
    .delete()
    .eq('team_member_id', memberId);
  if (delErr) throw new Error(delErr.message);

  const { error: insErr } = await sb.from('organiser_team_member_groups').insert(
    ids.map((organiserId) => ({
      team_member_id: memberId,
      organiser_id: organiserId,
    }))
  );
  if (insErr) throw new Error(insErr.message);
}

async function findTeamMembership(sb, userId, email) {
  const em = String(email || '').toLowerCase();
  const uid = isUuid(userId) ? userId : null;
  let query = sb.from('organiser_team_members').select('*');
  if (uid && em) {
    query = query.or(`supabase_user_id.eq.${uid},email.eq.${em}`);
  } else if (uid) {
    query = query.eq('supabase_user_id', uid);
  } else if (em) {
    query = query.eq('email', em);
  } else {
    return null;
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(5);
  if (error) throw new Error(error.message);
  const active = (data || []).find((r) => r.status === 'active');
  return active || (data || [])[0] || null;
}

async function activatePendingTeamMembership(sb, userId, email) {
  const em = String(email || '').toLowerCase();
  const uid = isUuid(userId) ? userId : null;
  if (!em) return null;

  const { data: pending, error } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('email', em)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pending) return null;

  const patch = { status: 'active' };
  if (uid) patch.supabase_user_id = uid;

  const { data: updated, error: upErr } = await sb
    .from('organiser_team_members')
    .update(patch)
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (upErr) throw new Error(upErr.message);

  try {
    const { logEntityActivity } = require('./entity-activity-log');
    await logEntityActivity({
      actor_user_id: uid,
      actor_email: em,
      actor_role: 'team',
      entity_type: 'team_member',
      entity_id: updated.id,
      organiser_id: updated.organiser_account_id || null,
      action: 'team_invite_accepted',
      summary: 'Team member activated access: ' + em,
      metadata: {
        invitedBy: updated.invited_by || null,
        accountId: updated.organiser_account_id || null,
      },
    });
  } catch {
    /* ignore */
  }

  return updated;
}

async function countClaimedGroupsOnAccount(sb, accountId) {
  const id = String(accountId || '').trim();
  if (!id) return 0;
  const { count, error } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_account_id', id)
    .eq('ownership_claim_status', 'claimed');
  if (error) throw new Error(error.message);
  return Number(count) || 0;
}

async function getAccountOwnerEmail(sb, accountId) {
  const { data, error } = await sb
    .from('organiser_accounts')
    .select('email')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.email || '')
    .trim()
    .toLowerCase();
}

async function resolveOrganiserAccountLabel(sb, accountId, fallbackEmail) {
  const { data, error } = await sb
    .from('organisers')
    .select('name')
    .eq('organiser_account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);
  const names = (data || []).map((row) => String(row.name || '').trim()).filter(Boolean);
  if (names.length === 1) return names[0];
  if (names.length > 1) return names[0] + ' and ' + (names.length - 1) + ' more';
  return String(fallbackEmail || '').trim() || 'your organiser account';
}

async function getOrCreateOrganiserAccount(session) {
  const sb = getSupabaseAdmin();
  const uid = isUuid(session?.sub) ? session.sub : null;
  const em = String(session?.email || '').toLowerCase();
  if (!uid && !em) return null;

  let account = null;
  if (uid) {
    const { data } = await sb
      .from('organiser_accounts')
      .select('*')
      .eq('supabase_user_id', uid)
      .maybeSingle();
    account = data;
  }
  if (!account && em) {
    const { data } = await sb.from('organiser_accounts').select('*').eq('email', em).maybeSingle();
    account = data;
  }

  if (!account) {
    const insert = {
      email: em || null,
      supabase_user_id: uid,
    };
    const { data: created, error } = await sb
      .from('organiser_accounts')
      .insert(insert)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    account = created;
  } else if (uid && !account.supabase_user_id) {
    await sb.from('organiser_accounts').update({ supabase_user_id: uid }).eq('id', account.id);
    account.supabase_user_id = uid;
  }

  return account;
}

/** Profiles tied to this login always belong in the workspace (even in team mode). */
async function emailMatchedOrganiserIdsForSession(session) {
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!em) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('id')
    .or(`email.eq.${em},contact_email.eq.${em}`)
    .neq('ownership_claim_status', 'disputed');
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id).filter(Boolean);
}

function workspaceGroupIds(groups, access) {
  const ids = new Set((groups || []).map((g) => g.id).filter(Boolean));
  ((access && access.groupIds) || []).forEach((id) => {
    if (id) ids.add(id);
  });
  return [...ids];
}

/** Include email-matched profiles that bootstrap already shows in the workspace. */
async function mergeEmailMatchedGroups(session, groups, access) {
  const merged = [...(groups || [])];
  const have = new Set(merged.map((g) => g.id));
  const missingIds = workspaceGroupIds(groups, access).filter((id) => !have.has(id));
  (await emailMatchedOrganiserIdsForSession(session)).forEach((id) => {
    if (!have.has(id)) missingIds.push(id);
  });
  const uniqueMissing = [...new Set(missingIds.filter(Boolean))].filter((id) => !have.has(id));
  if (!uniqueMissing.length) return merged;

  const sb = getSupabaseAdmin();
  const { rowToGroup } = require('./supabase-organiser');
  const { data, error } = await sb.from('organisers').select('*').in('id', uniqueMissing);
  if (error) throw new Error(error.message);
  (data || []).forEach((row) => {
    if (!groupVisibleInOrganiserWorkspace(session, row)) return;
    merged.push(rowToGroup(row));
    have.add(row.id);
  });
  return merged;
}

async function listAccessibleGroupsForSession(session, adminView) {
  const { syncEmailMatchedOrganiserClaims } = require('./supabase-organiser-claims');
  if (!adminView) {
    await syncEmailMatchedOrganiserClaims(session).catch(() => {});
  }
  const access = await resolveOrganiserAccess(session);
  const { listGroupsForSession } = require('./supabase-organiser');
  let groups = await listGroupsForSession(session, adminView, access);
  if (!adminView) {
    groups = await mergeEmailMatchedGroups(session, groups, access);
  }
  return { groups, access };
}

async function appendSessionOwnedOrganiserIds(sb, session, groupIds) {
  const uid = isUuid(session?.sub) ? session.sub : null;
  const em = String(session?.email || '').toLowerCase();
  if (!uid && !em) return;

  let query = sb.from('organisers').select('id, email, contact_email, supabase_user_id, ownership_claim_status');
  if (uid && em) {
    query = query.or(`supabase_user_id.eq.${uid},email.eq.${em},contact_email.eq.${em}`);
  } else if (uid) {
    query = query.eq('supabase_user_id', uid);
  } else {
    query = query.or(`email.eq.${em},contact_email.eq.${em}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  (data || []).forEach((row) => {
    if (!row?.id || row.ownership_claim_status === 'disputed') return;
    if (groupVisibleInOrganiserWorkspace(session, row)) groupIds.add(row.id);
  });
}

async function resolveOrganiserAccess(session) {
  const sb = getSupabaseAdmin();
  const uid = isUuid(session.sub) ? session.sub : null;
  const em = String(session.email || '').toLowerCase();

  await activatePendingTeamMembership(sb, uid, em);

  const account = await getOrCreateOrganiserAccount(session);
  const accountId = account ? account.id : null;

  const isPersonalAccountOwner =
    accountId &&
    ((uid && account.supabase_user_id === uid) ||
      (em && String(account.email || '').toLowerCase() === em));

  const personalGroupCount = accountId ? await countClaimedGroupsOnAccount(sb, accountId) : 0;

  const membership = await findTeamMembership(sb, uid, em);
  const activeMembership =
    membership && membership.status === 'active' ? membership : null;

  const useTeamWorkspace =
    activeMembership &&
    activeMembership.organiser_account_id &&
    (!isPersonalAccountOwner || personalGroupCount === 0);

  let effectiveAccountId = accountId;
  if (useTeamWorkspace) {
    effectiveAccountId = activeMembership.organiser_account_id;
  }

  const legacyGroupIds = new Set();
  if (!useTeamWorkspace && (uid || em)) {
    let legacyQuery = sb
      .from('organisers')
      .select('id, email, contact_email, supabase_user_id, ownership_claim_status');
    if (uid && em) {
      legacyQuery = legacyQuery.or(
        `supabase_user_id.eq.${uid},email.eq.${em},contact_email.eq.${em}`
      );
    } else if (uid) legacyQuery = legacyQuery.eq('supabase_user_id', uid);
    else legacyQuery = legacyQuery.or(`email.eq.${em},contact_email.eq.${em}`);
    const { data: legacy } = await legacyQuery;
    (legacy || []).forEach((r) => {
      if (!r || r.ownership_claim_status === 'disputed') return;
      if (r.ownership_claim_status === 'claimed') {
        legacyGroupIds.add(r.id);
        return;
      }
      if (r.ownership_claim_status === 'pending') {
        if (emailMatchesProfile(em, r) || (uid && r.supabase_user_id === uid)) {
          legacyGroupIds.add(r.id);
        }
        return;
      }
      if ((uid && r.supabase_user_id === uid) || emailMatchesProfile(em, r)) {
        legacyGroupIds.add(r.id);
      }
    });
  }
  const isLegacyOwner = legacyGroupIds.size > 0;

  function normalizeTeamRole(rawRole) {
    const r = String(rawRole || 'editor').toLowerCase();
    if (r === 'owner') return 'owner';
    if (r === 'marketing') return 'marketing';
    return 'editor';
  }

  let role = null;
  if (useTeamWorkspace) {
    role = normalizeTeamRole(activeMembership.role);
  } else if (isPersonalAccountOwner) {
    role = 'owner';
  } else if (activeMembership) {
    role = normalizeTeamRole(activeMembership.role);
  } else if (isLegacyOwner) {
    role = 'owner';
  }

  const isOwner = role === 'owner';
  const isEditor = role === 'editor';
  const isMarketing = role === 'marketing';
  const hasAccess = isOwner || isEditor || isMarketing;

  const groupIds = new Set();
  legacyGroupIds.forEach((id) => groupIds.add(id));
  if (hasAccess && effectiveAccountId) {
    const { data: byAccount } = await sb
      .from('organisers')
      .select('id')
      .eq('organiser_account_id', effectiveAccountId);
    (byAccount || []).forEach((r) => groupIds.add(r.id));
  }

  let editorScopedGroupIds = null;
  if ((isEditor || isMarketing) && useTeamWorkspace && activeMembership) {
    editorScopedGroupIds = await loadScopedGroupIdsForMember(sb, activeMembership.id);
    if (editorScopedGroupIds !== null) {
      // Ensure assigned pages are present even if account linkage was delayed.
      editorScopedGroupIds.forEach((id) => {
        if (id) groupIds.add(id);
      });
      const allowed = new Set(editorScopedGroupIds);
      [...groupIds].forEach((id) => {
        if (!allowed.has(id)) groupIds.delete(id);
      });
    }
  }

  await appendSessionOwnedOrganiserIds(sb, session, groupIds);

  // Email-matched profiles must not bypass an owner's explicit page assignment.
  if (editorScopedGroupIds !== null) {
    const allowed = new Set(editorScopedGroupIds);
    [...groupIds].forEach((id) => {
      if (!allowed.has(id)) groupIds.delete(id);
    });
  }

  return {
    accountId: effectiveAccountId,
    personalAccountId: accountId,
    role: hasAccess ? role : null,
    isOwner,
    isEditor,
    isMarketing,
    useTeamWorkspace: Boolean(useTeamWorkspace),
    canManageTeam: isOwner && !isEditor && !isMarketing,
    canDeleteEvents: isOwner && !isEditor && !isMarketing,
    canManagePayments: isOwner && !isEditor && !isMarketing,
    canCreateGroups: isOwner && !isEditor && !isMarketing,
    canManageEvents: isOwner || isEditor,
    canViewRevenue: isOwner || isEditor,
    canViewRegistrations: isOwner || isEditor,
    canAccessPromote: isOwner || isEditor || isMarketing,
    canAccessCommunicate: isOwner || isEditor,
    membership: membership ? rowToTeamMember(membership) : null,
    groupIds: [...groupIds],
    teamMax: ORGANISER_TEAM_MAX,
  };
}

async function listTeamMembers(session) {
  const access = await resolveOrganiserAccess(session);
  if (!access.accountId) return { access, members: [], teamMax: ORGANISER_TEAM_MAX, teamCount: 0 };
  if (!access.canManageTeam && !access.isEditor) {
    const e = new Error('Not allowed to view team');
    e.status = 403;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('organiser_account_id', access.accountId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const memberRows = data || [];
  const scopes = await loadTeamMemberGroupScopes(
    sb,
    memberRows.map((row) => row.id)
  );
  const members = memberRows.map((row) => rowToTeamMember(row, scopes.get(row.id) ?? null));
  const hasOwnerRow = members.some((m) => m.role === 'owner' || m.isAccountOwner);
  if (!hasOwnerRow) {
    const ownerEmail = await getAccountOwnerEmail(sb, access.accountId);
    if (ownerEmail) {
      members.unshift({
        id: 'account-owner',
        organiserAccountId: access.accountId,
        email: ownerEmail,
        supabaseUserId: null,
        role: 'owner',
        status: 'active',
        invitedAt: null,
        createdAt: null,
        isAccountOwner: true,
        allGroups: true,
        groupIds: [],
      });
    }
  }

  const teamCount = await countTeamInviteSlots(sb, access.accountId);

  return {
    access,
    members,
    teamMax: ORGANISER_TEAM_MAX,
    teamCount,
    teamSlotsRemaining: teamSlotsRemaining(teamCount),
  };
}

async function sendTeamInviteEmail(session, member, access) {
  const sb = getSupabaseAdmin();
  const inviterName = String(session.name || session.email || 'Your organiser').trim();
  const ownerEmail = await getAccountOwnerEmail(sb, access.accountId);
  const accountName = await resolveOrganiserAccountLabel(sb, access.accountId, ownerEmail);
  return sendOrganiserTeamInviteEmail({
    to: member.email,
    inviterName,
    accountName,
  });
}

async function inviteTeamMember(session, { email, role, allGroups, groupIds }) {
  const access = await resolveOrganiserAccess(session);
  if (!access.canManageTeam) {
    const e = new Error('Only owners can invite team members');
    e.status = 403;
    throw e;
  }
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    const e = new Error('Enter a valid email address');
    e.status = 400;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const ownerEmail = await getAccountOwnerEmail(sb, access.accountId);
  if (ownerEmail && ownerEmail === em) {
    const e = new Error('The account owner is already on the team');
    e.status = 400;
    throw e;
  }

  const teamCount = await countTeamInviteSlots(sb, access.accountId);
  if (teamCount >= ORGANISER_TEAM_MAX) {
    const e = new Error(
      'You can invite up to ' + ORGANISER_TEAM_MAX + ' editors. Remove someone to invite another.'
    );
    e.status = 400;
    e.code = 'team_limit_reached';
    throw e;
  }

  const requestedRole = String(role || 'editor').toLowerCase();
  const memberRole = requestedRole === 'marketing' ? 'marketing' : 'editor';
  const grantAllGroups = allGroups !== false && !(Array.isArray(groupIds) && groupIds.length);
  const resolvedGroupIds = grantAllGroups ? [] : [...new Set((groupIds || []).filter(Boolean))];

  const { data: existing } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('organiser_account_id', access.accountId)
    .eq('email', em)
    .maybeSingle();
  if (existing && existing.status === 'active') {
    const e = new Error('This person is already on your team');
    e.status = 400;
    throw e;
  }

  // Validate / link pages before creating or updating the invite so a failed
  // scope assignment cannot leave a pending member with implicit All access.
  if (!grantAllGroups) {
    await validateAccountGroupIds(sb, access.accountId, resolvedGroupIds);
    if (!resolvedGroupIds.length) {
      const e = new Error('Select at least one group, or choose All groups');
      e.status = 400;
      throw e;
    }
  }

  if (existing && existing.status === 'pending') {
    await setTeamMemberGroupAccess(sb, existing.id, access.accountId, {
      allGroups: grantAllGroups,
      groupIds: resolvedGroupIds,
    });
    const { data: refreshed, error: refreshErr } = await sb
      .from('organiser_team_members')
      .update({ invited_at: new Date().toISOString(), role: memberRole })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (refreshErr) throw new Error(refreshErr.message);
    const member = rowToTeamMember(
      refreshed,
      grantAllGroups ? null : await loadScopedGroupIdsForMember(sb, refreshed.id)
    );
    let emailSent = false;
    try {
      await sendTeamInviteEmail(session, member, access);
      emailSent = true;
    } catch (inviteErr) {
      console.error('[organiser-team-invite]', inviteErr.message || inviteErr);
    }
    return { member, access, emailSent };
  }

  const { data, error } = await sb
    .from('organiser_team_members')
    .insert({
      organiser_account_id: access.accountId,
      email: em,
      role: memberRole,
      status: 'pending',
      invited_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const memberRow = data;
  try {
    await setTeamMemberGroupAccess(sb, memberRow.id, access.accountId, {
      allGroups: grantAllGroups,
      groupIds: resolvedGroupIds,
    });
  } catch (scopeErr) {
    await sb.from('organiser_team_members').delete().eq('id', memberRow.id);
    throw scopeErr;
  }

  const member = rowToTeamMember(
    memberRow,
    grantAllGroups ? null : await loadScopedGroupIdsForMember(sb, memberRow.id)
  );
  let emailSent = false;
  try {
    await sendTeamInviteEmail(session, member, access);
    emailSent = true;
  } catch (inviteErr) {
    console.error('[organiser-team-invite]', inviteErr.message || inviteErr);
  }

  return { member, access, emailSent };
}

async function removeTeamMember(session, memberId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.canManageTeam) {
    const e = new Error('Only owners can remove team members');
    e.status = 403;
    throw e;
  }
  if (!memberId || memberId === 'account-owner') {
    const e = new Error('Cannot remove the account owner');
    e.status = 400;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();
  if (!row || row.organiser_account_id !== access.accountId) {
    const e = new Error('Team member not found');
    e.status = 404;
    throw e;
  }
  if (row.role === 'owner') {
    const e = new Error('Cannot remove the owner');
    e.status = 400;
    throw e;
  }

  const { error } = await sb.from('organiser_team_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function resendTeamInvite(session, memberId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.canManageTeam) {
    const e = new Error('Only owners can resend invites');
    e.status = 403;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();
  if (!row || row.organiser_account_id !== access.accountId) {
    const e = new Error('Invite not found');
    e.status = 404;
    throw e;
  }
  if (row.status !== 'pending') {
    const e = new Error('Only pending invites can be resent');
    e.status = 400;
    throw e;
  }

  const { data, error } = await sb
    .from('organiser_team_members')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', memberId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const member = rowToTeamMember(
    data,
    await loadScopedGroupIdsForMember(sb, data.id)
  );
  let emailSent = false;
  try {
    await sendTeamInviteEmail(session, member, access);
    emailSent = true;
  } catch (inviteErr) {
    console.error('[organiser-team-invite-resend]', inviteErr.message || inviteErr);
  }

  return { member, emailSent };
}

async function updateTeamMemberGroups(session, memberId, { allGroups, groupIds }) {
  const access = await resolveOrganiserAccess(session);
  if (!access.canManageTeam) {
    const e = new Error('Only owners can change team member group access');
    e.status = 403;
    throw e;
  }
  if (!memberId || memberId === 'account-owner') {
    const e = new Error('Cannot change group access for the account owner');
    e.status = 400;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from('organiser_team_members')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();
  if (!row || row.organiser_account_id !== access.accountId) {
    const e = new Error('Team member not found');
    e.status = 404;
    throw e;
  }
  if (row.role === 'owner') {
    const e = new Error('Cannot change group access for the owner');
    e.status = 400;
    throw e;
  }

  const grantAllGroups = allGroups === true || (allGroups !== false && !(Array.isArray(groupIds) && groupIds.length));
  await setTeamMemberGroupAccess(sb, memberId, access.accountId, {
    allGroups: grantAllGroups,
    groupIds: grantAllGroups ? [] : groupIds,
  });

  const member = rowToTeamMember(
    row,
    grantAllGroups ? null : await loadScopedGroupIdsForMember(sb, memberId)
  );
  return { member };
}

module.exports = {
  resolveOrganiserAccess,
  getOrCreateOrganiserAccount,
  groupVisibleInOrganiserWorkspace,
  emailMatchedOrganiserIdsForSession,
  mergeEmailMatchedGroups,
  listAccessibleGroupsForSession,
  listTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvite,
  updateTeamMemberGroups,
  rowToTeamMember,
  ORGANISER_TEAM_MAX,
};
