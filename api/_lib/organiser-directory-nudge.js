/**
 * Follow-ups after the directory invitation, only while the page is unclaimed.
 * Day 3 is the short preview check-in. Day 7 is the social-proof note.
 */
const { DIRECTORY_INVITE_SLUG, DIRECTORY_NUDGE_SLUG, DIRECTORY_DAY7_SLUG, DIRECTORY_DAY21_SLUG, DIRECTORY_DAY35_SLUG } = require('./organiser-directory-invite');
const { isPublicOrganiser } = require('./supabase-organisers-browse');
const { isExcludedLaunchOrganiser } = require('../../scripts/launch-excluded-organisers');

const DAY_MS = 24 * 60 * 60 * 1000;
const NUDGE_AFTER_DAYS = 3;
const NUDGE_UNTIL_DAYS = 7;
const DAY7_AFTER_DAYS = 7;
const DAY7_UNTIL_DAYS = 15;
const DAY21_AFTER_DAYS = 21;
const DAY21_UNTIL_DAYS = 35;
const DAY35_AFTER_DAYS = 35;
const DAY35_UNTIL_DAYS = 49;
const NUDGE_BATCH = 40;
const ACTIVITY_LIMIT = 1000;

const STAFF_EMAILS = new Set([
  'pips249@gmail.com',
  'hi@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
]);

function organiserContactEmail(row) {
  return String((row && (row.contact_email || row.email)) || '')
    .trim()
    .toLowerCase();
}

function directoryNudgeSkipReason({ inviteAt, alreadyNudged, claimStatus, now }) {
  if (alreadyNudged) return 'already_nudged';
  const status = String(claimStatus || '').toLowerCase();
  if (status === 'claimed') return 'already_claimed';
  if (status === 'disputed') return 'disputed';
  const sent = Date.parse(inviteAt || '');
  if (!Number.isFinite(sent)) return 'missing_invite';
  const age = (now == null ? Date.now() : Number(now)) - sent;
  if (age < NUDGE_AFTER_DAYS * DAY_MS) return 'too_soon';
  if (age >= NUDGE_UNTIL_DAYS * DAY_MS) return 'too_old';
  return '';
}

function directoryDay7SkipReason({ inviteAt, alreadySent, claimStatus, now }) {
  if (alreadySent) return 'already_sent';
  const status = String(claimStatus || '').toLowerCase();
  if (status === 'claimed') return 'already_claimed';
  if (status === 'disputed') return 'disputed';
  const sent = Date.parse(inviteAt || '');
  if (!Number.isFinite(sent)) return 'missing_invite';
  const age = (now == null ? Date.now() : Number(now)) - sent;
  if (age < DAY7_AFTER_DAYS * DAY_MS) return 'too_soon';
  if (age >= DAY7_UNTIL_DAYS * DAY_MS) return 'too_old';
  return '';
}

function hostsLine(names) {
  const clean = (names || []).map((name) => String(name || '').trim()).filter(Boolean).slice(0, 2);
  if (clean.length >= 2) {
    return (
      "We've recently welcomed several networking hosts to The Networker UK, including groups like " +
      clean[0] +
      ' and ' +
      clean[1] +
      '.'
    );
  }
  return "We've recently welcomed several networking hosts to The Networker UK.";
}

function directoryDay35SkipReason({ inviteAt, alreadySent, claimStatus, now }) {
  if (alreadySent) return 'already_sent';
  const status = String(claimStatus || '').toLowerCase();
  if (status === 'claimed') return 'already_claimed';
  if (status === 'disputed') return 'disputed';
  const sent = Date.parse(inviteAt || '');
  if (!Number.isFinite(sent)) return 'missing_invite';
  const age = (now == null ? Date.now() : Number(now)) - sent;
  if (age < DAY35_AFTER_DAYS * DAY_MS) return 'too_soon';
  if (age >= DAY35_UNTIL_DAYS * DAY_MS) return 'too_old';
  return '';
}

function directoryDay21SkipReason({ inviteAt, alreadySent, claimStatus, now }) {
  if (alreadySent) return 'already_sent';
  const status = String(claimStatus || '').toLowerCase();
  if (status === 'claimed') return 'already_claimed';
  if (status === 'disputed') return 'disputed';
  const sent = Date.parse(inviteAt || '');
  if (!Number.isFinite(sent)) return 'missing_invite';
  const age = (now == null ? Date.now() : Number(now)) - sent;
  if (age < DAY21_AFTER_DAYS * DAY_MS) return 'too_soon';
  if (age >= DAY21_UNTIL_DAYS * DAY_MS) return 'too_old';
  return '';
}

async function recentClaimedHostNames(sb) {
  const { data, error } = await sb
    .from('organisers')
    .select('name, listing_status, verification_status, is_internal, ownership_claimed_at')
    .eq('ownership_claim_status', 'claimed')
    .order('ownership_claimed_at', { ascending: false })
    .limit(12);
  if (error) return [];
  return (data || [])
    .filter((row) => {
      if (row.is_internal === true || row.is_internal === 'true') return false;
      return isPublicOrganiser(row);
    })
    .map((row) => String(row.name || '').trim())
    .filter(Boolean);
}

function activitySlug(row) {
  const meta = row && row.metadata;
  if (!meta || typeof meta !== 'object') return '';
  return String(meta.slug || '').trim();
}

/** Newest matching activity row per organiser. Rows should be newest first. */
function latestActivityByOrganiser(rows, slug) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (activitySlug(row) !== slug) return;
    const id = String((row && row.organiser_id) || '').trim();
    if (!id || map.has(id)) return;
    map.set(id, row);
  });
  return map;
}

async function fetchRecentClaimActivity(sb, oldestIso, newestIso) {
  const { data, error } = await sb
    .from('entity_activity_log')
    .select('organiser_id, created_at, metadata')
    .eq('action', 'admin_claim_invite')
    .gte('created_at', oldestIso)
    .lte('created_at', newestIso)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);
  if (error) throw new Error(error.message);
  return data || [];
}

async function sendDueDirectoryStage(sb, options, stage) {
  const now = options && options.now != null ? Number(options.now) : Date.now();
  const oldest = new Date(now - stage.lookbackDays * DAY_MS).toISOString();
  const newest = new Date(now).toISOString();
  const activity = await fetchRecentClaimActivity(sb, oldest, newest);
  const invites = latestActivityByOrganiser(activity, DIRECTORY_INVITE_SLUG);
  const already = latestActivityByOrganiser(activity, stage.slug);
  const dueIds = [];
  invites.forEach((row, id) => {
    const reason = stage.skip({
      inviteAt: row.created_at,
      alreadyNudged: already.has(id),
      alreadySent: already.has(id),
      now,
    });
    if (!reason) dueIds.push(id);
  });
  if (!dueIds.length) return { sent: 0, skipped: 0, failed: 0, checked: invites.size };

  const organisers = [];
  for (let i = 0; i < dueIds.length; i += 100) {
    const { data, error } = await sb
      .from('organisers')
      .select('id, name, slug, email, contact_email, listing_status, verification_status, ownership_claim_status, is_internal')
      .in('id', dueIds.slice(i, i + 100));
    if (error) throw new Error(error.message);
    organisers.push(...(data || []));
  }

  let hostNames = [];
  if (stage.includeHosts) {
    try {
      hostNames = await recentClaimedHostNames(sb);
    } catch {
      hostNames = [];
    }
  }

  const { resolveOrganiserClaimUrl } = require('./organiser-claim-url');
  const { organiserPublicUrl } = require('./hub-email-urls');
  const { publicOrganiserSlug } = require('./organiser-slug');
  const { groupedGroupName, directoryGroupsHtml } = require('./organiser-directory-invite');
  const host = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const eligible = [];

  for (const row of organisers) {
    const id = String(row.id || '');
    const invite = invites.get(id);
    const email = organiserContactEmail(row);
    const reason =
      stage.skip({
        inviteAt: invite && invite.created_at,
        alreadyNudged: already.has(id),
        alreadySent: already.has(id),
        claimStatus: row.ownership_claim_status,
        now,
      }) ||
      (row.is_internal === true || row.is_internal === 'true' ? 'internal' : '') ||
      (!isPublicOrganiser(row) ? 'not_on_browse' : '') ||
      (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'missing_email' : '') ||
      (STAFF_EMAILS.has(email) || isExcludedLaunchOrganiser({ email, slug: row.slug, name: row.name })
        ? 'opted_out'
        : '');
    if (reason) {
      skipped += 1;
      continue;
    }
    eligible.push({ row, email });
  }

  const byEmail = new Map();
  eligible.forEach((item) => {
    const list = byEmail.get(item.email) || [];
    list.push(item);
    byEmail.set(item.email, list);
  });
  const batches = [...byEmail.values()]
    .map((group) =>
      group.slice().sort((a, b) => {
        const byName = String(a.row.name || '').localeCompare(String(b.row.name || ''), 'en-GB', {
          sensitivity: 'base',
        });
        if (byName) return byName;
        return String(a.row.id || '').localeCompare(String(b.row.id || ''));
      })
    )
    .slice(0, NUDGE_BATCH);

  for (const group of batches) {
    const row = group[0].row;
    const email = group[0].email;
    const siblings = group.slice(1).map((item) => item.row);
    let claimUrl = '';
    try {
      claimUrl = await resolveOrganiserClaimUrl(email, host, publicOrganiserSlug(row) || '');
    } catch {
      claimUrl = organiserPublicUrl(row, host);
    }
    const names = group.map((item) => item.row.name);
    const label = groupedGroupName(names);
    const pages = group.map((item) => ({
      name: item.row.name,
      url: organiserPublicUrl(item.row, host),
    }));
    const picked = hostNames
      .filter((name) => !names.some((groupName) => groupName.toLowerCase() === String(name || '').trim().toLowerCase()))
      .slice(0, 2);
    const extraVariables = {
      group_name: label,
      organiser_name: label,
      groups_html: directoryGroupsHtml(pages),
    };
    if (stage.includeHosts) extraVariables.hosts_line = hostsLine(picked);
    const result = await stage.send({
      to: email,
      host,
      organiser: row,
      claimUrl,
      actorEmail: 'system@thenetworkeruk.com',
      extraVariables,
      siblingOrganisers: siblings,
    });
    if (result && result.sent) sent += 1;
    else if (result && result.error === 'emails_disabled') skipped += 1;
    else failed += 1;
  }

  return { sent, skipped, failed, checked: invites.size, due: dueIds.length };
}

function sendDueDirectoryNudges(sb, options) {
  const { sendOrganiserDirectoryNudge } = require('./organiser-directory-invite');
  return sendDueDirectoryStage(sb, options, {
    slug: DIRECTORY_NUDGE_SLUG,
    lookbackDays: NUDGE_UNTIL_DAYS,
    skip: directoryNudgeSkipReason,
    send: sendOrganiserDirectoryNudge,
  });
}

function sendDueDirectoryDay7(sb, options) {
  const { sendOrganiserDirectoryDay7 } = require('./organiser-directory-invite');
  return sendDueDirectoryStage(sb, options, {
    slug: DIRECTORY_DAY7_SLUG,
    lookbackDays: DAY7_UNTIL_DAYS,
    skip: directoryDay7SkipReason,
    send: sendOrganiserDirectoryDay7,
  });
}

function sendDueDirectoryDay35(sb, options) {
  const { sendOrganiserDirectoryDay35 } = require('./organiser-directory-invite');
  return sendDueDirectoryStage(sb, options, {
    slug: DIRECTORY_DAY35_SLUG,
    lookbackDays: DAY35_UNTIL_DAYS,
    skip: directoryDay35SkipReason,
    send: sendOrganiserDirectoryDay35,
  });
}

function sendDueDirectoryDay21(sb, options) {
  const { sendOrganiserDirectoryDay21 } = require('./organiser-directory-invite');
  return sendDueDirectoryStage(sb, options, {
    slug: DIRECTORY_DAY21_SLUG,
    lookbackDays: DAY21_UNTIL_DAYS,
    skip: directoryDay21SkipReason,
    send: sendOrganiserDirectoryDay21,
    includeHosts: true,
  });
}

module.exports = {
  DIRECTORY_NUDGE_SLUG,
  DIRECTORY_DAY7_SLUG,
  DIRECTORY_DAY21_SLUG,
  DIRECTORY_DAY35_SLUG,
  NUDGE_AFTER_DAYS,
  NUDGE_UNTIL_DAYS,
  DAY7_AFTER_DAYS,
  DAY7_UNTIL_DAYS,
  directoryNudgeSkipReason,
  directoryDay7SkipReason,
  directoryDay21SkipReason,
  directoryDay35SkipReason,
  hostsLine,
  latestActivityByOrganiser,
  sendDueDirectoryNudges,
  sendDueDirectoryDay7,
  sendDueDirectoryDay21,
  sendDueDirectoryDay35,
};
