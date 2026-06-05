/**
 * Organiser account access — owners, team members, and group scope.
 */
const { getSupabaseAdmin } = require('./supabase');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function rowToTeamMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    organiserAccountId: row.organiser_account_id,
    email: String(row.email || '').toLowerCase(),
    supabaseUserId: row.supabase_user_id || null,
    role: row.role || 'editor',
    status: row.status || 'pending',
    invitedAt: row.invited_at || row.created_at || null,
    createdAt: row.created_at || null,
  };
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

async function getOrCreateOrganiserAccount(session) {
  const sb = getSupabaseAdmin();
  const uid = isUuid(session.sub) ? session.sub : null;
  const em = String(session.email || '').toLowerCase();
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

async function resolveOrganiserAccess(session) {
  const sb = getSupabaseAdmin();
  const uid = isUuid(session.sub) ? session.sub : null;
  const em = String(session.email || '').toLowerCase();

  const account = await getOrCreateOrganiserAccount(session);
  const accountId = account ? account.id : null;

  let role = 'owner';
  let membership = null;

  if (accountId) {
    const isAccountOwner =
      (uid && account.supabase_user_id === uid) ||
      (em && String(account.email || '').toLowerCase() === em);
    if (!isAccountOwner) {
      membership = await findTeamMembership(sb, uid, em);
      if (membership && membership.organiser_account_id === accountId && membership.status === 'active') {
        role = membership.role === 'owner' ? 'owner' : 'editor';
      } else if (membership && membership.organiser_account_id !== accountId) {
        role = membership.status === 'active' ? membership.role || 'editor' : null;
      } else {
        role = isAccountOwner ? 'owner' : null;
      }
    }
  } else {
    membership = await findTeamMembership(sb, uid, em);
    if (membership && membership.status === 'active') {
      role = membership.role === 'owner' ? 'owner' : 'editor';
    } else {
      role = null;
    }
  }

  const effectiveAccountId =
    membership && membership.organiser_account_id ? membership.organiser_account_id : accountId;

  const groupIds = new Set();

  if (effectiveAccountId) {
    const { data: byAccount } = await sb
      .from('organisers')
      .select('id')
      .eq('organiser_account_id', effectiveAccountId);
    (byAccount || []).forEach((r) => groupIds.add(r.id));
  }

  // Legacy ownership by user id / email
  let legacyQuery = sb.from('organisers').select('id');
  if (uid && em) legacyQuery = legacyQuery.or(`supabase_user_id.eq.${uid},email.eq.${em}`);
  else if (uid) legacyQuery = legacyQuery.eq('supabase_user_id', uid);
  else if (em) legacyQuery = legacyQuery.eq('email', em);
  if (uid || em) {
    const { data: legacy } = await legacyQuery;
    (legacy || []).forEach((r) => groupIds.add(r.id));
  }

  const isOwner = role === 'owner';
  const isEditor = role === 'editor';
  const hasAccess = isOwner || isEditor || groupIds.size > 0;

  return {
    accountId: effectiveAccountId,
    role: hasAccess ? (isOwner ? 'owner' : isEditor ? 'editor' : 'owner') : null,
    isOwner: isOwner || (!membership && !!accountId),
    isEditor,
    canManageTeam: isOwner || (!membership && !!accountId),
    canDeleteEvents: isOwner || (!membership && !!accountId),
    membership: membership ? rowToTeamMember(membership) : null,
    groupIds: [...groupIds],
  };
}

async function listTeamMembers(session) {
  const access = await resolveOrganiserAccess(session);
  if (!access.accountId) return { access, members: [] };
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

  const members = (data || []).map(rowToTeamMember);
  const ownerEmail = String(session.email || '').toLowerCase();
  const hasOwner = members.some((m) => m.role === 'owner');
  if (!hasOwner && access.isOwner) {
    members.unshift({
      id: 'account-owner',
      organiserAccountId: access.accountId,
      email: ownerEmail,
      supabaseUserId: session.sub || null,
      role: 'owner',
      status: 'active',
      invitedAt: null,
      createdAt: null,
      isAccountOwner: true,
    });
  }

  return { access, members };
}

async function inviteTeamMember(session, { email, role }) {
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
  const memberRole = role === 'owner' ? 'editor' : 'editor';

  const sb = getSupabaseAdmin();
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
  if (existing && existing.status === 'pending') {
    const e = new Error('An invite is already pending for this email');
    e.status = 400;
    throw e;
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
  return { member: rowToTeamMember(data), access };
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
  return { member: rowToTeamMember(data) };
}

module.exports = {
  resolveOrganiserAccess,
  getOrCreateOrganiserAccount,
  listTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvite,
  rowToTeamMember,
};
