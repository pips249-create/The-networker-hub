/**
 * First-login group profile claim / dispute — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { rowToGroup } = require('./supabase-organiser');
const { sendViaResend } = require('./send-template-email');
const { profileEmail, emailMatchesProfile } = require('./supabase-organiser-profile-email');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function sessionMatchesPendingProfile(session, row) {
  if (!row || row.ownership_claim_status !== 'pending') return false;
  const uid = isUuid(session?.sub) ? session.sub : '';
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (uid && row.supabase_user_id === uid) return true;
  return emailMatchesProfile(em, row);
}

async function listPendingClaimGroupsForSession(session) {
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  const uid = isUuid(session?.sub) ? session.sub : '';
  if (!em && !uid) return [];

  const sb = getSupabaseAdmin();
  const rows = [];
  const seen = new Set();

  function addRows(data) {
    for (const row of data || []) {
      if (!row?.id || seen.has(row.id)) continue;
      if (!sessionMatchesPendingProfile(session, row)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  if (uid) {
    const byUser = await sb
      .from('organisers')
      .select('*')
      .eq('ownership_claim_status', 'pending')
      // Never allow internal/test profiles to be claimed by real users.
      .eq('is_internal', false)
      .eq('supabase_user_id', uid);
    if (byUser.error) throw new Error(byUser.error.message);
    addRows(byUser.data);
  }

  if (em) {
    const byEmail = await sb
      .from('organisers')
      .select('*')
      .eq('ownership_claim_status', 'pending')
      // Never allow internal/test profiles to be claimed by real users.
      .eq('is_internal', false)
      .or(`email.eq.${em},contact_email.eq.${em}`);
    if (byEmail.error) throw new Error(byEmail.error.message);
    addRows(byEmail.data);
  }

  return rows
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map((row) => {
      const group = rowToGroup(row);
      group.ownershipClaimStatus = 'pending';
      group.eventCount = null;
      return group;
    });
}

async function getPendingClaimGroupForSession(session, groupId) {
  const id = String(groupId || '').trim();
  if (!isUuid(id)) {
    const err = new Error('invalid_group_id');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organisers')
    .select('*')
    .eq('id', id)
    .eq('is_internal', false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !sessionMatchesPendingProfile(session, data)) {
    const err = new Error('claim_not_available');
    err.status = 404;
    throw err;
  }
  return data;
}

async function notifyAdminOfClaimDispute({ organiser, session, disputeId }) {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'pips249@gmail.com')
    .trim()
    .toLowerCase();
  const organiserName = String(organiser?.name || 'Group profile').trim();
  const profileEmailAddr = profileEmail(organiser);
  const reporterEmail = String(session?.email || '').trim();
  const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(
    /\/$/,
    ''
  );
  const adminLink = siteUrl + '/admin/#cleanup/groups';

  const subject = 'Group profile disputed — ' + organiserName;
  const html =
    '<p>A user signed in and said a pre-imported <strong>group profile</strong> is not theirs.</p>' +
    '<ul>' +
    '<li><strong>Group:</strong> ' +
    escapeHtml(organiserName) +
    '</li>' +
    '<li><strong>Profile email on file:</strong> ' +
    escapeHtml(profileEmailAddr || '—') +
    '</li>' +
    '<li><strong>Signed-in user:</strong> ' +
    escapeHtml(reporterEmail || '—') +
    '</li>' +
    '<li><strong>Dispute id:</strong> ' +
    escapeHtml(disputeId || '—') +
    '</li>' +
    '</ul>' +
    '<p>Review in Command Centre → Group profile cleanup, or open <a href="' +
    escapeHtml(adminLink) +
    '">admin groups</a>.</p>' +
    '<p>— The Networker UK</p>';

  try {
    await sendViaResend({ to: adminEmail, subject, html });
    return { ok: true, to: adminEmail };
  } catch (e) {
    return { ok: false, error: e.message || String(e), to: adminEmail };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sessionAlreadyOwnsClaimedGroup(session, row) {
  if (!row || row.ownership_claim_status !== 'claimed') return false;
  const uid = isUuid(session?.sub) ? session.sub : '';
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (uid && row.supabase_user_id === uid) return true;
  return emailMatchesProfile(em, row);
}

async function claimGroupForSession(session, groupId) {
  const sb = getSupabaseAdmin();
  const uid = isUuid(session.sub) ? session.sub : null;
  if (!uid) {
    const err = new Error('missing_user_id');
    err.status = 403;
    throw err;
  }

  let organiser;
  try {
    organiser = await getPendingClaimGroupForSession(session, groupId);
  } catch (e) {
    // Workspace load used to auto-claim email-matched pages before the invite
    // modal finished — treat "already mine" as success so Yes continues setup.
    if (e && e.message === 'claim_not_available') {
      const id = String(groupId || '').trim();
      const { data, error } = await sb.from('organisers').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (sessionAlreadyOwnsClaimedGroup(session, data)) {
        const group = rowToGroup(data);
        group.ownershipClaimStatus = 'claimed';
        return group;
      }
    }
    throw e;
  }

  const { getOrCreateOrganiserAccount } = require('./supabase-organiser-access');
  const account = await getOrCreateOrganiserAccount(session);
  const claimedAt = new Date();
  const now = claimedAt.toISOString();
  const patch = {
    supabase_user_id: uid,
    ownership_claim_status: 'claimed',
    ownership_claimed_at: now,
    ownership_disputed_at: null,
    ownership_disputed_by_email: null,
  };
  if (account?.id && !organiser.organiser_account_id) {
    patch.organiser_account_id = account.id;
  }
  // Founding Organiser · 2026 — badge (+ homepage slot if under cap) on claim before deadline.
  try {
    const { foundingFieldsForClaim } = require('./founding-organiser');
    Object.assign(patch, await foundingFieldsForClaim(sb, claimedAt, { session, row: organiser }));
  } catch (e) {
    console.warn('founding fields on claim failed:', e && e.message ? e.message : e);
  }

  const { data, error } = await sb
    .from('organisers')
    .update(patch)
    .eq('id', organiser.id)
    .eq('ownership_claim_status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    // Concurrent claim (double-click) — treat as already owned, never re-send mail.
    const existing = await sb.from('organisers').select('*').eq('id', organiser.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (sessionAlreadyOwnsClaimedGroup(session, existing.data)) {
      const group = rowToGroup(existing.data);
      group.ownershipClaimStatus = 'claimed';
      return group;
    }
    const err = new Error('claim_not_available');
    err.status = 404;
    throw err;
  }

  const group = rowToGroup(data);
  group.ownershipClaimStatus = 'claimed';

  try {
    const { maybeSendClaimConfirmedAfterOwnershipChange } = require('./organiser-claim-confirmed-emails');
    await maybeSendClaimConfirmedAfterOwnershipChange(session);
  } catch (e) {
    console.warn(
      'organiser claim confirmed email failed:',
      e && e.message ? e.message : e
    );
  }

  return group;
}

async function rejectGroupForSession(session, groupId, notes) {
  const organiser = await getPendingClaimGroupForSession(session, groupId);
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const reporterEmail = String(session?.email || '')
    .trim()
    .toLowerCase();

  const { data: dispute, error: disputeErr } = await sb
    .from('organiser_claim_disputes')
    .insert({
      organiser_id: organiser.id,
      organiser_name: organiser.name || null,
      profile_email: profileEmail(organiser) || null,
      reporter_email: reporterEmail,
      reporter_user_id: isUuid(session.sub) ? session.sub : null,
      status: 'open',
      notes: String(notes || '').trim().slice(0, 2000) || null,
    })
    .select('*')
    .single();
  if (disputeErr) throw new Error(disputeErr.message);

  const { error: updateErr } = await sb
    .from('organisers')
    .update({
      supabase_user_id: null,
      organiser_account_id: null,
      ownership_claim_status: 'disputed',
      ownership_disputed_at: now,
      ownership_disputed_by_email: reporterEmail,
    })
    .eq('id', organiser.id);
  if (updateErr) throw new Error(updateErr.message);

  const emailResult = await notifyAdminOfClaimDispute({
    organiser,
    session,
    disputeId: dispute.id,
  });

  try {
    const { maybeSendClaimConfirmedAfterOwnershipChange } = require('./organiser-claim-confirmed-emails');
    await maybeSendClaimConfirmedAfterOwnershipChange(session);
  } catch (e) {
    console.warn(
      'organiser claim confirmed email after reject failed:',
      e && e.message ? e.message : e
    );
  }

  return {
    disputeId: dispute.id,
    organiserId: organiser.id,
    emailResult,
  };
}

/**
 * When someone authenticates with the same email as a pending group profile,
 * skip separate organiser enable + email-verify steps — they proved ownership
 * by using the address the invite was sent to.
 */
async function bootstrapOrganiserFromPendingClaims(session) {
  const pendingGroups = await listPendingClaimGroupsForSession(session);
  let pendingOpportunities = [];
  try {
    const { listPendingClaimOpportunitiesForSession } = require('./supabase-opportunity-claims');
    pendingOpportunities = await listPendingClaimOpportunitiesForSession(session);
  } catch {
    pendingOpportunities = [];
  }
  const pendingCount = pendingGroups.length + pendingOpportunities.length;
  if (!pendingCount || !session?.sub) {
    return { bootstrapped: false, pendingCount };
  }

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: hub } = await sb
    .from('hub_accounts')
    .select('organiser_access_at, organiser_email_verified_at, hub_view, role')
    .eq('user_id', session.sub)
    .maybeSingle();

  // Only enable organiser access / view — never rewrite platform role (login was demoting admins).
  const patch = {
    user_id: session.sub,
    hub_view: 'organiser',
    organiser_access_at: hub?.organiser_access_at || now,
    organiser_email_verified_at: hub?.organiser_email_verified_at || now,
  };
  if (!hub) {
    patch.role = 'client';
  }

  const { error } = await sb.from('hub_accounts').upsert(patch, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);

  return { bootstrapped: true, pendingCount };
}

/**
 * When Command Centre creates events / impersonates a group, ensure a login exists
 * for the contact email so staff can open the workspace.
 *
 * Does NOT set ownership_claim_status to claimed — that is reserved for the
 * personalised claim-URL flow. Admin work used to false-claim pages
 * and hide "Copy claim link".
 */
async function ensureOrganiserClaimedForAdminEvent(organiserId) {
  const sb = getSupabaseAdmin();
  const oid = String(organiserId || '').trim();
  if (!oid) return { claimed: false, reason: 'missing_id' };

  const { data: organiser, error } = await sb.from('organisers').select('*').eq('id', oid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!organiser) return { claimed: false, reason: 'not_found' };
  if (organiser.ownership_claim_status === 'disputed') return { claimed: false, reason: 'disputed' };

  const em = profileEmail(organiser);
  if (!em) return { claimed: false, reason: 'missing_email' };

  const alreadyClaimed = organiser.ownership_claim_status === 'claimed';
  const { provisionOrganiserLogin } = require('./supabase-auth');
  let userId = organiser.supabase_user_id || null;
  if (!userId) {
    const provisioned = await provisionOrganiserLogin(oid);
    userId = provisioned.userId;
  }

  const { getOrCreateOrganiserAccount } = require('./supabase-organiser-access');
  const account = await getOrCreateOrganiserAccount({ sub: userId, email: em });
  const patch = {
    supabase_user_id: userId,
  };
  if (!alreadyClaimed) {
    patch.ownership_claim_status = 'pending';
    patch.ownership_claimed_at = null;
  }
  if (account?.id && !organiser.organiser_account_id) {
    patch.organiser_account_id = account.id;
  }

  const { error: upErr } = await sb.from('organisers').update(patch).eq('id', oid);
  if (upErr) throw new Error(upErr.message);
  return { claimed: alreadyClaimed, provisioned: true, already: alreadyClaimed };
}

/**
 * Link email-matched profiles into the workspace without flipping claim status.
 * Auto-claiming here raced the "Is this your organiser page?" invite modal and
 * made Yes fail with "not available to claim". Confirmation stays in claimGroupForSession.
 */
async function syncEmailMatchedOrganiserClaims() {
  return { synced: 0 };
}

module.exports = {
  listPendingClaimGroupsForSession,
  claimGroupForSession,
  rejectGroupForSession,
  notifyAdminOfClaimDispute,
  bootstrapOrganiserFromPendingClaims,
  ensureOrganiserClaimedForAdminEvent,
  syncEmailMatchedOrganiserClaims,
  emailMatchesProfile,
};
