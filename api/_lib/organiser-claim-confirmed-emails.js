/**
 * Post-claim confirmation — logo/website CTA.
 * Founding perk row is included when the badge has already been unlocked (first published event).
 * One email per claim batch (after the last pending page is confirmed/rejected),
 * and again (force) when founding unlocks on publish.
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

const {
  foundingBadgePublicUrl,
  foundingBadgeEmailAttachment,
} = require('./founding-organiser-badge');

/** Email-safe badge chip — matches the Hub profile pill (fallback if image blocked). */
function foundingBadgeChipHtml({ size }) {
  const large = size === 'large';
  const pad = large ? '12px 22px' : '10px 18px';
  const fontSize = large ? '15px' : '13px';
  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="padding:' +
    pad +
    ';border-radius:999px;background:#f5ebd8;border:1px solid #c4a574;' +
    "font-family:'DM Sans',system-ui,sans-serif;font-size:" +
    fontSize +
    ';font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#452d5c;' +
    'line-height:1.2;white-space:nowrap;">' +
    '&#9733; Founding Organiser &middot; 2026' +
    '</td></tr></table>'
  );
}

function foundingBadgeImageHtml({ siteUrl, width }) {
  const w = width || 420;
  const src = foundingBadgePublicUrl(siteUrl);
  return (
    '<img src="' +
    src +
    '" alt="Founding Organiser · 2026 badge" width="' +
    w +
    '" style="display:block;margin:0 auto;border:0;max-width:100%;height:auto;width:' +
    w +
    'px;" />'
  );
}

function heroBadgeHtml({ founding, siteUrl }) {
  if (founding) {
    return (
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">' +
      '<tr><td style="text-align:center;">' +
      foundingBadgeImageHtml({ siteUrl, width: 420 }) +
      '</td></tr></table>'
    );
  }
  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">' +
    '<tr>' +
    '<td style="width:52px;height:52px;background:#fff4d6;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">&#9733;</td>' +
    '</tr></table>'
  );
}

function foundingPerkRowHtml({ foundingHomepage, siteUrl }) {
  const homepageLine = foundingHomepage
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:12px 0 0;">You\'re also in the first 50 for a homepage showcase through November.</p>'
    : '';
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:22px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Your badge</p>' +
    '<div style="background:#f5f0e8;border-radius:14px;padding:16px 12px;margin:0 auto 12px;max-width:460px;">' +
    foundingBadgeImageHtml({ siteUrl, width: 400 }) +
    '</div>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.78);margin:0;">This badge is also attached as a PNG so you can save or share it. It shows on your Hub organiser page too.</p>' +
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
    hero_badge_html: heroBadgeHtml({ founding, siteUrl: site }),
    intro_line: founding
      ? multi
        ? 'Thanks for listing before launch. Your Founding Organiser · 2026 badge is below (and attached as a PNG) — and on each confirmed Hub profile.'
        : 'Thanks for listing before launch. Your Founding Organiser · 2026 badge is below (and attached as a PNG) — and on your Hub profile.'
      : multi
        ? 'Thanks for confirming. Finish each page, then publish an event — that unlocks your Founding Organiser · 2026 badge (for pages claimed before 1 September).'
        : 'Thanks for confirming. Add your logo and publish an event to unlock your Founding Organiser · 2026 badge (if you claimed before 1 September).',
    founding_perk_row: founding
      ? foundingPerkRowHtml({ foundingHomepage, siteUrl: site })
      : '',
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
  const founding = allGroups.some((g) => g?.foundingOrganiser || g?.founding_organiser_at);
  const badgeAttachment = founding ? foundingBadgeEmailAttachment() : null;
  return sendTemplatedEmail({
    slug: 'organiser_claim_confirmed',
    to,
    variables,
    subject: claimConfirmedSubject(primary, allGroups),
    replyTo: CLAIM_CONFIRMED_REPLY_TO,
    idempotencyKey: force ? undefined : claimConfirmedIdempotencyKey(session, allGroups),
    attachments: badgeAttachment ? [badgeAttachment] : undefined,
    resendTags: [
      { name: 'email_type', value: 'organiser_claim_confirmed' },
      { name: 'group_id', value: String(primary.id).slice(0, 40) },
      { name: 'group_count', value: String(allGroups.length) },
      ...(founding ? [{ name: 'founding_badge', value: '1' }] : []),
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
