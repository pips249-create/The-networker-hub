/**
 * One note after a page is claimed, when the group still has no event.
 * The directory invite sequence stops at claim, and the confirmation email
 * asks for a logo. This is the missing ask to list a meeting.
 */
const { isPublicOrganiser } = require('./supabase-organisers-browse');
const { isExcludedLaunchOrganiser } = require('../../scripts/launch-excluded-organisers');

const CLAIMED_NO_EVENT_SLUG = 'organiser_claimed_no_event';
const DAY_MS = 24 * 60 * 60 * 1000;
const AFTER_DAYS = 3;
const UNTIL_DAYS = 21;
const BATCH = 40;

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

function claimedNoEventSkipReason({ claimedAt, alreadySent, claimStatus, hasEvents, now }) {
  if (alreadySent) return 'already_sent';
  const status = String(claimStatus || '').toLowerCase();
  if (status && status !== 'claimed') return 'not_claimed';
  if (hasEvents) return 'has_events';
  const claimed = Date.parse(claimedAt || '');
  if (!Number.isFinite(claimed)) return 'missing_claim';
  const age = (now == null ? Date.now() : Number(now)) - claimed;
  if (age < AFTER_DAYS * DAY_MS) return 'too_soon';
  if (age >= UNTIL_DAYS * DAY_MS) return 'too_old';
  return '';
}

async function organiserIdsWithEvents(sb, ids) {
  const found = new Set();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from('events')
        .select('organiser_id')
        .in('organiser_id', chunk)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      (data || []).forEach((row) => {
        const id = String(row.organiser_id || '').trim();
        if (id) found.add(id);
      });
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }
  return found;
}

async function alreadySentOrganiserIds(sb, oldestIso) {
  const sent = new Set();
  const { data, error } = await sb
    .from('entity_activity_log')
    .select('organiser_id, metadata')
    .eq('action', 'admin_claim_invite')
    .gte('created_at', oldestIso)
    .contains('metadata', { slug: CLAIMED_NO_EVENT_SLUG })
    .limit(1000);
  if (error) throw new Error(error.message);
  (data || []).forEach((row) => {
    const id = String(row.organiser_id || '').trim();
    if (id) sent.add(id);
  });
  return sent;
}

async function sendDueClaimedNoEventNotes(sb, options) {
  const now = options && options.now != null ? Number(options.now) : Date.now();
  const oldest = new Date(now - UNTIL_DAYS * DAY_MS).toISOString();
  const newest = new Date(now - AFTER_DAYS * DAY_MS).toISOString();
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, email, contact_email, listing_status, verification_status, ownership_claim_status, ownership_claimed_at, is_internal'
    )
    .eq('ownership_claim_status', 'claimed')
    .gte('ownership_claimed_at', oldest)
    .lte('ownership_claimed_at', newest)
    .order('ownership_claimed_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = data || [];
  const ids = rows.map((row) => String(row.id || '').trim()).filter(Boolean);
  if (!ids.length) return { sent: 0, skipped: 0, failed: 0, checked: 0, due: 0 };
  const [withEvents, alreadySent] = await Promise.all([
    organiserIdsWithEvents(sb, ids),
    alreadySentOrganiserIds(sb, oldest),
  ]);

  const { resolveOrganiserClaimUrl } = require('./organiser-claim-url');
  const { organiserPublicUrl } = require('./hub-email-urls');
  const { publicOrganiserSlug } = require('./organiser-slug');
  const { groupedGroupName, directoryGroupsHtml, sendOrganiserClaimedNoEvent } = require('./organiser-directory-invite');
  const host = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const eligible = [];
  let skipped = 0;

  for (const row of rows) {
    const id = String(row.id || '');
    const email = organiserContactEmail(row);
    const reason =
      claimedNoEventSkipReason({
        claimedAt: row.ownership_claimed_at,
        alreadySent: alreadySent.has(id),
        claimStatus: row.ownership_claim_status,
        hasEvents: withEvents.has(id),
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
    .slice(0, BATCH);

  let sent = 0;
  let failed = 0;
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
    const result = await sendOrganiserClaimedNoEvent({
      to: email,
      host,
      organiser: row,
      claimUrl,
      actorEmail: 'system@thenetworkeruk.com',
      extraVariables: {
        group_name: label,
        organiser_name: label,
        groups_html: directoryGroupsHtml(pages),
        list_event_url: host + '/organiser/event-format',
      },
      siblingOrganisers: siblings,
    });
    if (result && result.sent) sent += 1;
    else if (result && result.error === 'emails_disabled') skipped += 1;
    else failed += 1;
  }

  return { sent, skipped, failed, checked: rows.length, due: eligible.length };
}

module.exports = {
  CLAIMED_NO_EVENT_SLUG,
  AFTER_DAYS,
  UNTIL_DAYS,
  claimedNoEventSkipReason,
  sendDueClaimedNoEventNotes,
};
