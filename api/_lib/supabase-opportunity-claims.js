/**
 * First-login business opportunity claim / dispute — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { rowToListing } = require('./supabase-opportunities');
const { isHubSeedOwnerEmail } = require('./opportunity-hub-seed');
const { sendViaResend } = require('./send-template-email');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function profileEmail(row) {
  return String(row?.owner_email || row?.contact_email || '')
    .trim()
    .toLowerCase();
}

function emailMatchesProfile(sessionEmail, rowEmail) {
  const em = String(sessionEmail || '')
    .trim()
    .toLowerCase();
  const profile = String(rowEmail || '')
    .trim()
    .toLowerCase();
  if (!em || !profile) return false;
  return profile === em;
}

function sessionMatchesPendingOpportunity(session, row) {
  if (!row || row.ownership_claim_status !== 'pending') return false;
  if (isHubSeedOwnerEmail(row.owner_email)) return false;
  const uid = isUuid(session?.sub) ? session.sub : '';
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (uid && row.supabase_user_id === uid) return true;
  return emailMatchesProfile(em, row.owner_email);
}

async function listPendingClaimOpportunitiesForSession(session) {
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
      if (!sessionMatchesPendingOpportunity(session, row)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  if (uid) {
    const byUser = await sb
      .from('business_opportunities')
      .select('*')
      .eq('ownership_claim_status', 'pending')
      .eq('supabase_user_id', uid);
    if (byUser.error) throw new Error(byUser.error.message);
    addRows(byUser.data);
  }

  if (em) {
    const byEmail = await sb
      .from('business_opportunities')
      .select('*')
      .eq('ownership_claim_status', 'pending')
      .eq('owner_email', em);
    if (byEmail.error) throw new Error(byEmail.error.message);
    addRows(byEmail.data);
  }

  return rows
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
    .map((row) => {
      const listing = rowToListing(row);
      listing.ownershipClaimStatus = 'pending';
      return listing;
    });
}

async function getPendingClaimOpportunityForSession(session, opportunityId) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) {
    const err = new Error('invalid_opportunity_id');
    err.status = 400;
    throw err;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('business_opportunities').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !sessionMatchesPendingOpportunity(session, data)) {
    const err = new Error('claim_not_available');
    err.status = 404;
    throw err;
  }
  return data;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function notifyAdminOfOpportunityClaimDispute({ opportunity, session, disputeId }) {
  const adminEmail = String(process.env.ADMIN_EMAIL || 'pips249@gmail.com')
    .trim()
    .toLowerCase();
  const title = String(opportunity?.title || 'Business opportunity').trim();
  const profileEmailAddr = profileEmail(opportunity);
  const reporterEmail = String(session?.email || '').trim();
  const siteUrl = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const adminLink = siteUrl + '/admin/#opportunities';

  const subject = 'Business opportunity disputed — ' + title;
  const html =
    '<p>A user signed in and said a pre-assigned <strong>business opportunity listing</strong> is not theirs.</p>' +
    '<ul>' +
    '<li><strong>Listing:</strong> ' +
    escapeHtml(title) +
    '</li>' +
    '<li><strong>Owner email on file:</strong> ' +
    escapeHtml(profileEmailAddr || '—') +
    '</li>' +
    '<li><strong>Signed-in user:</strong> ' +
    escapeHtml(reporterEmail || '—') +
    '</li>' +
    '<li><strong>Dispute id:</strong> ' +
    escapeHtml(disputeId || '—') +
    '</li>' +
    '</ul>' +
    '<p>Review in Command Centre → Opportunities, or open <a href="' +
    escapeHtml(adminLink) +
    '">admin opportunities</a>.</p>' +
    '<p>— The Networker UK</p>';

  try {
    await sendViaResend({ to: adminEmail, subject, html });
    return { ok: true, to: adminEmail };
  } catch (e) {
    return { ok: false, error: e.message || String(e), to: adminEmail };
  }
}

async function claimOpportunityForSession(session, opportunityId) {
  const opportunity = await getPendingClaimOpportunityForSession(session, opportunityId);
  const sb = getSupabaseAdmin();
  const uid = isUuid(session.sub) ? session.sub : null;
  if (!uid) {
    const err = new Error('missing_user_id');
    err.status = 403;
    throw err;
  }

  const now = new Date().toISOString();
  const patch = {
    supabase_user_id: uid,
    owner_email: String(session?.email || opportunity.owner_email || '')
      .trim()
      .toLowerCase(),
    ownership_claim_status: 'claimed',
    ownership_claimed_at: now,
    ownership_disputed_at: null,
    ownership_disputed_by_email: null,
    updated_at: now,
  };

  const { data, error } = await sb
    .from('business_opportunities')
    .update(patch)
    .eq('id', opportunity.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const listing = rowToListing(data);
  listing.ownershipClaimStatus = 'claimed';
  return listing;
}

async function rejectOpportunityForSession(session, opportunityId, notes) {
  const opportunity = await getPendingClaimOpportunityForSession(session, opportunityId);
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const reporterEmail = String(session?.email || '')
    .trim()
    .toLowerCase();

  const { data: dispute, error: disputeErr } = await sb
    .from('opportunity_claim_disputes')
    .insert({
      opportunity_id: opportunity.id,
      opportunity_title: opportunity.title || null,
      profile_email: profileEmail(opportunity) || null,
      reporter_email: reporterEmail,
      reporter_user_id: isUuid(session.sub) ? session.sub : null,
      status: 'open',
      notes: String(notes || '').trim().slice(0, 2000) || null,
    })
    .select('*')
    .single();
  if (disputeErr) throw new Error(disputeErr.message);

  const { error: updateErr } = await sb
    .from('business_opportunities')
    .update({
      supabase_user_id: null,
      ownership_claim_status: 'disputed',
      ownership_disputed_at: now,
      ownership_disputed_by_email: reporterEmail,
      updated_at: now,
    })
    .eq('id', opportunity.id);
  if (updateErr) throw new Error(updateErr.message);

  const emailResult = await notifyAdminOfOpportunityClaimDispute({
    opportunity,
    session,
    disputeId: dispute.id,
  });

  return {
    disputeId: dispute.id,
    opportunityId: opportunity.id,
    emailResult,
  };
}

module.exports = {
  listPendingClaimOpportunitiesForSession,
  claimOpportunityForSession,
  rejectOpportunityForSession,
};
