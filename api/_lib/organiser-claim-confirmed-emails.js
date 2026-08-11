/**
 * Post-claim confirmation — founding badge + logo/website CTA.
 * One email per claim batch (after the last pending page is confirmed/rejected).
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { emailGreetingName } = require('./email-display-name');
const {
  siteBase,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserGroupEditUrl,
} = require('./hub-email-urls');

const CLAIM_CONFIRMED_REPLY_TO = 'catherine@thenetworkerhub.com';

function foundingPerkRowHtml({ foundingHomepage }) {
  const homepageLine = foundingHomepage
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:12px 0 0;">You\'re also in the first 50 for a homepage showcase through November.</p>'
    : '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:22px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Founding perk</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;letter-spacing:-0.02em;line-height:1.2;">Founding Organiser · 2026</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:10px 0 0;">Your badge is live on your Hub page.</p>' +
    homepageLine +
    '</td></tr></table></td></tr>'
  );
}

function groupsListRowHtml(groups) {
  const list = (Array.isArray(groups) ? groups : []).filter((g) => g && g.name);
  if (list.length < 2) return '';
  const items = list
    .map(
      (g) =>
        '<li style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.6;color:#5c5557;margin:0 0 6px;">' +
        String(g.name).replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        '</li>'
    )
    .join('');
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">' +
    '<tr><td style="padding:16px 18px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Pages confirmed</p>' +
    '<ul style="margin:0;padding-left:18px;">' +
    items +
    '</ul></td></tr></table></td></tr>'
  );
}

function buildOrganiserClaimConfirmedVars({ group, groups, session, siteUrl }) {
  const site = siteBase(siteUrl);
  const allGroups = (Array.isArray(groups) && groups.length ? groups : [group]).filter(Boolean);
  const primary = group || allGroups[0] || {};
  const groupName = String(primary?.name || 'Your organiser page').trim() || 'Your organiser page';
  const founding = allGroups.some((g) => g?.foundingOrganiser || g?.founding_organiser_at);
  const foundingHomepage = allGroups.some((g) => g?.foundingHomepage || g?.founding_homepage);
  const userName = emailGreetingName(session?.name || session?.email, 'there');
  const multi = allGroups.length > 1;

  return {
    user_name: userName,
    group_name: multi ? allGroups.length + ' organiser pages' : groupName,
    eyebrow_label: founding ? 'Founding Organiser' : 'Page claimed',
    hero_title: founding ? "You're in — badge unlocked" : 'Your organiser page is confirmed',
    intro_line: founding
      ? multi
        ? 'Thanks for confirming before launch. Your Founding Organiser · 2026 badge is on each confirmed Hub profile.'
        : 'Thanks for confirming before launch. Your Founding Organiser · 2026 badge is on your Hub profile.'
      : multi
        ? 'Thanks for confirming. You can manage events, memberships, and your public pages from the organiser workspace.'
        : 'Thanks for confirming. You can manage events, memberships, and your public page from the organiser workspace.',
    founding_perk_row: founding ? foundingPerkRowHtml({ foundingHomepage }) : '',
    groups_list_row: groupsListRowHtml(allGroups),
    profile_url: organiserPublicUrl(primary, site),
    profile_edit_url: organiserGroupEditUrl(primary, site, { onboard: 'review' }),
    dashboard_url: organiserDashboardUrl(site),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    contact_url: contactUrl(site),
    support_email: supportEmail(),
  };
}

function claimConfirmedSubject(group, groups) {
  const allGroups = (Array.isArray(groups) && groups.length ? groups : [group]).filter(Boolean);
  const founding = allGroups.some((g) => g?.foundingOrganiser || g?.founding_organiser_at);
  if (allGroups.length > 1) {
    return founding
      ? "You're a Founding Organiser · 2026 — pages confirmed"
      : 'Your organiser pages are confirmed';
  }
  const groupName = String(group?.name || allGroups[0]?.name || 'Your organiser page').trim();
  if (founding) return "You're a Founding Organiser · 2026 — " + groupName;
  return groupName + ' is claimed — finish your Hub page';
}

function claimConfirmedIdempotencyKey(session, groups) {
  const uid = String(session?.sub || session?.email || '')
    .trim()
    .toLowerCase();
  if (!uid) return '';
  const ids = (Array.isArray(groups) ? groups : [])
    .map((g) => String(g?.id || '').trim())
    .filter(Boolean)
    .sort();
  const batch = ids.length ? ids.join('_').slice(0, 180) : 'none';
  return ('organiser-claim-confirmed/' + uid + '/' + batch).slice(0, 256);
}

async function sendOrganiserClaimConfirmedEmail({ group, groups, session, siteUrl, force }) {
  const to = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!to) return { ok: false, skipped: true, reason: 'missing_email' };
  const allGroups = (Array.isArray(groups) && groups.length ? groups : [group]).filter(
    (g) => g && g.id
  );
  if (!allGroups.length) return { ok: false, skipped: true, reason: 'missing_group' };

  const primary = group && group.id ? group : allGroups[0];
  const variables = buildOrganiserClaimConfirmedVars({
    group: primary,
    groups: allGroups,
    session,
    siteUrl,
  });
  return sendTemplatedEmail({
    slug: 'organiser_claim_confirmed',
    to,
    variables,
    subject: claimConfirmedSubject(primary, allGroups),
    replyTo: CLAIM_CONFIRMED_REPLY_TO,
    idempotencyKey: force ? undefined : claimConfirmedIdempotencyKey(session, allGroups),
    resendTags: [
      { name: 'email_type', value: 'organiser_claim_confirmed' },
      { name: 'group_id', value: String(primary.id).slice(0, 40) },
      { name: 'group_count', value: String(allGroups.length) },
    ],
  });
}

/**
 * After claim/reject: send at most one confirmation once no pending pages remain.
 */
async function maybeSendClaimConfirmedAfterOwnershipChange(session) {
  const { listPendingClaimGroupsForSession } = require('./supabase-organiser-claims');
  const pending = await listPendingClaimGroupsForSession(session).catch(() => []);
  if ((pending || []).length > 0) {
    return { ok: false, skipped: true, reason: 'pending_remaining', pending: pending.length };
  }

  const { getSupabaseAdmin } = require('./supabase');
  const { rowToGroup } = require('./supabase-organiser');
  const { emailMatchesProfile } = require('./supabase-organiser-profile-email');
  const sb = getSupabaseAdmin();
  const uid = String(session?.sub || '').trim();
  const em = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!uid && !em) return { ok: false, skipped: true, reason: 'missing_session' };

  let query = sb
    .from('organisers')
    .select('*')
    .eq('ownership_claim_status', 'claimed')
    .order('ownership_claimed_at', { ascending: false })
    .limit(20);
  if (uid && em) {
    query = query.or(`supabase_user_id.eq.${uid},email.eq.${em},contact_email.eq.${em}`);
  } else if (uid) {
    query = query.eq('supabase_user_id', uid);
  } else {
    query = query.or(`email.eq.${em},contact_email.eq.${em}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const groups = (data || [])
    .filter((row) => {
      if (uid && row.supabase_user_id === uid) return true;
      return emailMatchesProfile(em, row);
    })
    .map((row) => {
      const group = rowToGroup(row);
      group.ownershipClaimStatus = 'claimed';
      return group;
    });

  if (!groups.length) return { ok: false, skipped: true, reason: 'no_claimed_groups' };

  // Prefer recently claimed pages (this invite batch) — last 2 hours.
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const recent = groups.filter((g) => {
    const t = Date.parse(g.ownershipClaimedAt || g.ownership_claimed_at || '') || 0;
    return t >= cutoff;
  });
  const batch = recent.length ? recent : [groups[0]];

  return sendOrganiserClaimConfirmedEmail({
    group: batch[0],
    groups: batch,
    session,
  });
}

module.exports = {
  CLAIM_CONFIRMED_REPLY_TO,
  buildOrganiserClaimConfirmedVars,
  claimConfirmedSubject,
  claimConfirmedIdempotencyKey,
  sendOrganiserClaimConfirmedEmail,
  maybeSendClaimConfirmedAfterOwnershipChange,
};
