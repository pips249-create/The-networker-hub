/**
 * Reminder audience: groups on the public browse page that have not claimed
 * and have had no house contact in the last 7 days.
 * Claimed, disputed, hidden, off-browse, and known opt-outs are left out.
 */
const { assignUniqueOrganiserSlug, publicOrganiserSlug } = require('./organiser-slug');
const { resolveOrganiserClaimUrl } = require('./organiser-claim-url');
const { sendOrganiserUnclaimedFollowup } = require('./organiser-directory-invite');
const { isPublicOrganiser } = require('./supabase-organisers-browse');
const {
  buildLastCommunicationIndex,
  resolveLastCommunication,
  matchesLastContactFilter,
} = require('./organiser-last-communication');
const { isExcludedLaunchOrganiser } = require('../../scripts/launch-excluded-organisers');

const STALE_FILTER = 'stale_7';
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

function staleUnclaimedReminderReason(row, contact) {
  if (!row) return 'not_found';
  const status = String(row.ownership_claim_status || '').toLowerCase();
  if (status === 'claimed') return 'already_claimed';
  if (status === 'disputed') return 'disputed';
  if (String(row.listing_status || '').toLowerCase() === 'unpublished') return 'hidden';
  if (!isPublicOrganiser(row)) return 'not_on_browse';
  if (row.is_internal === true || row.is_internal === 'true') return 'internal';
  const name = String(row.name || '').trim();
  if (!name) return 'missing_name';
  const email = organiserContactEmail(row);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'missing_email';
  if (STAFF_EMAILS.has(email) || isExcludedLaunchOrganiser({ email, slug: row.slug, name })) {
    return 'opted_out';
  }
  if (!matchesLastContactFilter(contact, STALE_FILTER)) return 'recent_contact';
  return '';
}

async function fetchOrganisersForReminders(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  const columns =
    'id, name, slug, email, contact_email, listing_status, verification_status, ownership_claim_status, is_internal';
  for (;;) {
    const { data, error } = await sb.from('organisers').select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function listStaleUnclaimedReminders(sb) {
  const rows = await fetchOrganisersForReminders(sb);
  const index = await buildLastCommunicationIndex(sb, {
    organisers: rows,
    organiserIds: rows.map((row) => row.id),
  });
  const ids = [];
  const groups = [];
  const summary = {
    eligible: 0,
    already_claimed: 0,
    disputed: 0,
    hidden: 0,
    not_on_browse: 0,
    internal: 0,
    missing_name: 0,
    missing_email: 0,
    opted_out: 0,
    recent_contact: 0,
  };
  rows.forEach((row) => {
    const reason = staleUnclaimedReminderReason(row, resolveLastCommunication(row, index));
    if (!reason) {
      ids.push(String(row.id));
      groups.push({
        id: String(row.id),
        name: String(row.name || '').trim(),
        email: organiserContactEmail(row),
      });
      summary.eligible += 1;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(summary, reason)) summary[reason] += 1;
  });
  groups.sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
  return { ids: groups.map((group) => group.id), groups, summary };
}

function describeUnclaimedFollowup({ sent, skipped, failed }) {
  const sentRows = Array.isArray(sent) ? sent : [];
  const skippedRows = Array.isArray(skipped) ? skipped : [];
  const failedRows = Array.isArray(failed) ? failed : [];
  const claimed = skippedRows.filter((row) => row.reason === 'already_claimed').length;
  const missing = skippedRows.filter((row) => row.reason === 'missing_email').length;
  const hidden = sentRows.filter((row) => row.hidden).length;
  const parts = [
    sentRows.length === 1
      ? 'Reminder emailed to 1 group.'
      : 'Reminder emailed to ' + sentRows.length + ' groups.',
  ];
  if (claimed) parts.push(claimed === 1 ? '1 already claimed.' : claimed + ' already claimed.');
  if (missing) parts.push(missing === 1 ? '1 is missing an email.' : missing + ' are missing an email.');
  if (hidden) {
    parts.push(
      hidden === 1
        ? '1 is hidden from browse, so their public page stays off.'
        : hidden + ' are hidden from browse, so their public pages stay off.'
    );
  }
  if (failedRows.length) parts.push(failedRows.length === 1 ? '1 failed.' : failedRows.length + ' failed.');
  return parts.join(' ');
}

async function sendUnclaimedFollowups(ids, session) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) {
    const err = new Error('missing_ids');
    err.status = 400;
    throw err;
  }
  if (unique.length > 50) {
    const err = new Error('too_many');
    err.status = 400;
    throw err;
  }

  const { getSupabaseAdmin } = require('./supabase');
  const sb = getSupabaseAdmin();
  const host = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const { organiserPublicUrl } = require('./hub-email-urls');
  const sent = [];
  const skipped = [];
  const failed = [];

  for (const id of unique) {
    const { data: row, error } = await sb.from('organisers').select('*').eq('id', id).maybeSingle();
    if (error) {
      failed.push({ id, error: error.message });
      continue;
    }
    if (!row) {
      skipped.push({ id, reason: 'not_found' });
      continue;
    }
    const name = String(row.name || '').trim();
    if (String(row.ownership_claim_status || '').toLowerCase() === 'claimed') {
      skipped.push({ id, name, reason: 'already_claimed' });
      continue;
    }
    const email = organiserContactEmail(row);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ id, name, reason: 'missing_email' });
      continue;
    }

    const listing = String(row.listing_status || '').toLowerCase();
    const hidden = listing === 'unpublished';
    if (!hidden && listing !== 'published') {
      const { error: pubErr } = await sb.from('organisers').update({ listing_status: 'published' }).eq('id', id);
      if (pubErr) {
        failed.push({ id, name, error: pubErr.message });
        continue;
      }
      row.listing_status = 'published';
    }

    try {
      await assignUniqueOrganiserSlug(sb, id, name);
    } catch (slugErr) {
      console.error('[unclaimed-followup-slug]', slugErr.message || slugErr);
    }

    const { data: fresh } = await sb.from('organisers').select('*').eq('id', id).maybeSingle();
    const organiser = fresh || row;
    let claimUrl = '';
    try {
      claimUrl = await resolveOrganiserClaimUrl(email, host, publicOrganiserSlug(organiser) || '');
    } catch (claimErr) {
      console.error('[unclaimed-followup-claim-url]', claimErr.message || claimErr);
      claimUrl = organiserPublicUrl(organiser, host);
    }

    const result = await sendOrganiserUnclaimedFollowup({
      to: email,
      host,
      organiser,
      claimUrl,
      actorEmail: session && session.email,
    });
    if (result && result.sent) sent.push({ id, email, name: organiser.name || name, hidden });
    else failed.push({ id, email, name: organiser.name || name, error: (result && result.error) || 'send_failed' });
  }

  return { sent, skipped, failed };
}

module.exports = {
  STALE_FILTER,
  organiserContactEmail,
  staleUnclaimedReminderReason,
  listStaleUnclaimedReminders,
  describeUnclaimedFollowup,
  sendUnclaimedFollowups,
};
