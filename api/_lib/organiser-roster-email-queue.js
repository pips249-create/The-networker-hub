/**
 * Staggered outbound emails for member lists (invites, new-event alerts, booking reminders).
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  emailSiteBase,
  hubAccountUrl,
  organiserPublicUrl,
  eventPublicUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  browseEventsUrl,
} = require('./hub-email-urls');
const { formatEventDateTime } = require('./favourite-sales-emails');
const { emailGreetingName } = require('./email-display-name');

function loginUrlWithNext(site, email, nextUrl) {
  return (
    site +
    '/login?email=' +
    encodeURIComponent(email) +
    '&next=' +
    encodeURIComponent(nextUrl)
  );
}

function rosterHelpers() {
  return require('./organiser-member-roster');
}

const QUEUE_KINDS = {
  INVITE: 'invite',
  NEW_EVENT: 'new_event',
  BOOKING_REMINDER: 'booking_reminder',
  PAY_INVITE: 'pay_invite',
};

const MAX_SPREAD_MS = 2 * 60 * 60 * 1000;
const MIN_GAP_MS = 5000;

/** Matches vercel.json cron `organiser-listing-alerts` (08:30 UTC). */
const NEW_EVENT_DIGEST_HOUR_UTC = 8;
const NEW_EVENT_DIGEST_MINUTE_UTC = 30;

/**
 * Next daily membership new-event digest window (UTC).
 * Same morning as saved-organiser listing alerts so roundups can bundle.
 */
function nextNewEventDigestUtc(from) {
  const d = from instanceof Date ? from : new Date();
  const target = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      NEW_EVENT_DIGEST_HOUR_UTC,
      NEW_EVENT_DIGEST_MINUTE_UTC,
      0,
      0
    )
  );
  if (d.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

function staggerScheduledFor(index, total, baseTime) {
  const base = baseTime instanceof Date ? baseTime : new Date();
  if (total <= 1) return base.toISOString();
  const span = Math.min(MAX_SPREAD_MS, Math.max(MIN_GAP_MS * (total - 1), MIN_GAP_MS));
  const gap = span / (total - 1);
  return new Date(base.getTime() + index * gap).toISOString();
}

function scheduledForQueueRow(index, total, baseTime, options) {
  if (options?.immediate) {
    const base = baseTime instanceof Date ? baseTime : new Date();
    return base.toISOString();
  }
  return staggerScheduledFor(index, total, baseTime);
}

async function enqueueRosterEmailQueue(rows) {
  const items = (rows || []).filter((row) => row && row.roster_member_id && row.organiser_id && row.kind);
  if (!items.length) return { queued: 0 };

  const sb = getSupabaseAdmin();
  let queued = 0;
  for (const row of items) {
    const { error } = await sb.from('organiser_roster_email_queue').insert(row);
    if (error) {
      if (/duplicate key|unique constraint|23505/i.test(error.message || '')) continue;
      throw new Error(error.message);
    }
    queued += 1;
  }
  return { queued };
}

async function queueMemberRosterInvites(organiserId, memberRows, options) {
  const orgId = String(organiserId || '').trim();
  const members = (memberRows || []).filter((m) => m && m.id && m.email);
  if (!orgId || !members.length) return { queued: 0 };

  const base = options?.baseTime || new Date();
  const rows = members.map((member, index) => ({
    kind: QUEUE_KINDS.INVITE,
    organiser_id: orgId,
    roster_member_id: member.id,
    event_id: null,
    scheduled_for: scheduledForQueueRow(index, members.length, base, options),
  }));

  return enqueueRosterEmailQueue(rows);
}

async function queueNewEventAlerts(eventRow, members, options) {
  const eventId = String(eventRow?.id || '').trim();
  const organiserId = String(eventRow?.organiser_id || eventRow?.organiserId || '').trim();
  const list = (members || []).filter((m) => m && m.id && m.email && m.membershipActive !== false);
  if (!eventId || !organiserId || !list.length) return { queued: 0 };

  // Default: daily digest (not publish-time blast). Callers may pass immediate/baseTime.
  const digest = options?.digest !== false && !options?.immediate && !options?.baseTime;
  const base = options?.baseTime || (digest ? nextNewEventDigestUtc() : new Date());
  const rows = list.map((member, index) => ({
    kind: QUEUE_KINDS.NEW_EVENT,
    organiser_id: organiserId,
    roster_member_id: member.id,
    event_id: eventId,
    scheduled_for: scheduledForQueueRow(index, list.length, base, {
      ...options,
      immediate: digest ? false : options?.immediate,
    }),
  }));

  return enqueueRosterEmailQueue(rows);
}

async function queueBookingReminders(organiserId, eventId, members, options) {
  const orgId = String(organiserId || '').trim();
  const evId = String(eventId || '').trim();
  const list = (members || []).filter((m) => m && m.id && m.email);
  if (!orgId || !evId || !list.length) return { queued: 0 };

  const base = options?.baseTime || new Date();
  const rows = list.map((member, index) => ({
    kind: QUEUE_KINDS.BOOKING_REMINDER,
    organiser_id: orgId,
    roster_member_id: member.id,
    event_id: evId,
    scheduled_for: scheduledForQueueRow(index, list.length, base, options),
  }));

  return enqueueRosterEmailQueue(rows);
}

async function queueMembershipPayInviteEmails(organiserId, memberRows, options) {
  const orgId = String(organiserId || '').trim();
  const members = (memberRows || []).filter((m) => m && m.id && m.email);
  if (!orgId || !members.length) return { queued: 0 };

  const base = options?.baseTime || new Date();
  const rows = members.map((member, index) => ({
    kind: QUEUE_KINDS.PAY_INVITE,
    organiser_id: orgId,
    roster_member_id: member.id,
    event_id: null,
    scheduled_for: scheduledForQueueRow(index, members.length, base, options),
  }));

  return enqueueRosterEmailQueue(rows);
}

async function sendQueuedBookingReminder(sb, { eventRow, organiser, member }) {
  const { normalizeRosterEmail } = rosterHelpers();
  const email = normalizeRosterEmail(member.email);
  if (!email) return 'skipped';

  const site = emailSiteBase();
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const eventLocation =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const eventTimeSuffix = event_time ? ' · ' + event_time : '';
  const eventUrl = eventPublicUrl(eventRow, site);
  const organiserUrl = organiserPublicUrl(organiser, site);
  const organiserName = String(organiser.name || 'your networking group').trim();
  const hasAccount = Boolean(member.attendee_id || member.claimed_at);
  const ctaUrl = hasAccount
    ? loginUrlWithNext(site, email, eventUrl)
    : site + '/register?email=' + encodeURIComponent(email) + '&next=' + encodeURIComponent(eventUrl);
  const ctaLabel = hasAccount ? 'Book member tickets' : 'Create account & book';

  await sendTemplatedEmail({
    slug: 'member_roster_booking_reminder',
    to: email,
    variables: {
      user_name: emailGreetingName(member.name, email),
      user_email: email,
      organiser_name: organiserName,
      organiser_url: organiserUrl,
      event_name: String(eventRow.title || 'Event').trim(),
      event_date: event_date || '',
      event_time: eventTimeSuffix,
      event_location: eventLocation,
      event_url: eventUrl,
      cta_url: ctaUrl,
      cta_label: ctaLabel,
      hub_account_url: hubAccountUrl(site),
      browse_events_url: browseEventsUrl(site),
      contact_url: contactUrl(site),
      privacy_url: legalPolicyUrl(site, 'privacy'),
      terms_url: legalPolicyUrl(site, 'terms'),
      site_url: site,
      logo_url: logoNavUrl(site),
      logo_footer_url: logoFooterUrl(site),
    },
  });
  return 'sent';
}

async function claimDueRosterEmailRow(sb, rowId, claimedAt) {
  const id = String(rowId || '').trim();
  if (!id) return null;
  const { data, error } = await sb
    .from('organiser_roster_email_queue')
    .update({ sent_at: claimedAt })
    .eq('id', id)
    .is('sent_at', null)
    .is('failed_at', null)
    .select('id, kind, organiser_id, roster_member_id, event_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function processDueRosterEmails(sb, options) {
  const batchSize = Math.min(Math.max(Number(options?.batchSize) || 40, 1), 80);
  const now = new Date().toISOString();
  const result = { sent: 0, skipped: 0, failed: 0, errors: [] };

  const { data: due, error: dueErr } = await sb
    .from('organiser_roster_email_queue')
    .select('id, kind, organiser_id, roster_member_id, event_id')
    .is('sent_at', null)
    .is('failed_at', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(batchSize);
  if (dueErr) throw new Error(dueErr.message);
  if (!(due || []).length) return result;

  const {
    rosterRowToClient,
    sendMemberRosterInviteEmail,
    sendMemberRosterPayInviteEmail,
    sendMemberRosterNewEventAlert,
  } = rosterHelpers();

  for (const candidate of due) {
    let claimedAt = null;
    let row = null;
    try {
      claimedAt = new Date().toISOString();
      row = await claimDueRosterEmailRow(sb, candidate.id, claimedAt);
      if (!row) {
        result.skipped += 1;
        continue;
      }

      const memberRes = await sb
        .from('organiser_member_roster')
        .select('*')
        .eq('id', row.roster_member_id)
        .eq('organiser_id', row.organiser_id)
        .maybeSingle();
      if (memberRes.error) throw new Error(memberRes.error.message);
      const memberRow = memberRes.data;
      if (!memberRow || memberRow.status !== 'active') {
        await sb
          .from('organiser_roster_email_queue')
          .update({ last_error: 'member_inactive' })
          .eq('id', row.id)
          .eq('sent_at', claimedAt);
        result.skipped += 1;
        continue;
      }

      const organiserRes = await sb
        .from('organisers')
        .select('id, name, slug, photo_url')
        .eq('id', row.organiser_id)
        .maybeSingle();
      if (organiserRes.error) throw new Error(organiserRes.error.message);
      if (!organiserRes.data) throw new Error('organiser_not_found');

      let outcome = 'skipped';
      if (row.kind === QUEUE_KINDS.INVITE) {
        const client = rosterRowToClient(memberRow);
        const invite = await sendMemberRosterInviteEmail({
          organiserRow: organiserRes.data,
          memberEmail: client.email,
          memberName: client.name,
          rosterRowId: client.id,
          attendeeId: client.attendeeId,
        });
        outcome = invite.sent ? 'sent' : 'skipped';
      } else if (row.kind === QUEUE_KINDS.PAY_INVITE) {
        const client = rosterRowToClient(memberRow);
        const invite = await sendMemberRosterPayInviteEmail({
          organiserRow: organiserRes.data,
          memberEmail: client.email,
          memberName: client.name,
          rosterRowId: client.id,
        });
        outcome = invite.sent ? 'sent' : 'skipped';
      } else if (row.kind === QUEUE_KINDS.NEW_EVENT) {
        const eventRes = await sb
          .from('events')
          .select(
            'id, title, slug, starts_at, status, approval_status, venue, city, location_label, organiser_id, published_at, series_group_id, attendance_mode'
          )
          .eq('id', row.event_id)
          .maybeSingle();
        if (eventRes.error) throw new Error(eventRes.error.message);
        if (!eventRes.data) throw new Error('event_not_found');
        if (String(eventRes.data.organiser_id || '') !== String(row.organiser_id || '')) {
          throw new Error('event_organiser_mismatch');
        }
        outcome = await sendMemberRosterNewEventAlert(sb, {
          eventRow: eventRes.data,
          organiser: organiserRes.data,
          member: rosterRowToClient(memberRow),
        });
      } else if (row.kind === QUEUE_KINDS.BOOKING_REMINDER) {
        const eventRes = await sb
          .from('events')
          .select(
            'id, title, slug, starts_at, status, approval_status, venue, city, location_label, organiser_id'
          )
          .eq('id', row.event_id)
          .maybeSingle();
        if (eventRes.error) throw new Error(eventRes.error.message);
        if (!eventRes.data) throw new Error('event_not_found');
        if (String(eventRes.data.organiser_id || '') !== String(row.organiser_id || '')) {
          throw new Error('event_organiser_mismatch');
        }
        outcome = await sendQueuedBookingReminder(sb, {
          eventRow: eventRes.data,
          organiser: organiserRes.data,
          member: memberRow,
        });
      }

      await sb
        .from('organiser_roster_email_queue')
        .update({ last_error: outcome === 'skipped' ? 'skipped' : null })
        .eq('id', row.id)
        .eq('sent_at', claimedAt);

      if (outcome === 'sent') result.sent += 1;
      else result.skipped += 1;
    } catch (e) {
      if (row?.id && claimedAt) {
        if (e.code === 'emails_disabled' || /emails_disabled/i.test(String(e.message || ''))) {
          await sb
            .from('organiser_roster_email_queue')
            .update({ last_error: 'emails_disabled' })
            .eq('id', row.id)
            .eq('sent_at', claimedAt);
          result.skipped += 1;
          continue;
        }
        await sb
          .from('organiser_roster_email_queue')
          .update({
            sent_at: null,
            failed_at: new Date().toISOString(),
            last_error: String(e.message || e).slice(0, 500),
          })
          .eq('id', row.id)
          .eq('sent_at', claimedAt);
      } else if (e.code === 'emails_disabled' || /emails_disabled/i.test(String(e.message || ''))) {
        result.skipped += 1;
        continue;
      }
      result.failed += 1;
      if (result.errors.length < 20) {
        result.errors.push({ queueId: candidate.id, message: e.message || String(e) });
      }
    }
  }

  return result;
}

/** Process due queue rows in a loop — used by hourly cron and invite/import drains. */
async function drainDueRosterEmails(sb, options) {
  const maxRuntimeMs = Math.min(Math.max(Number(options?.maxRuntimeMs) || 50000, 5000), 280000);
  const maxBatches = Math.min(Math.max(Number(options?.maxBatches) || 12, 1), 30);
  const batchSize = Math.min(Math.max(Number(options?.batchSize) || 80, 1), 80);
  const startedAt = Date.now();
  const aggregate = { sent: 0, skipped: 0, failed: 0, batches: 0, errors: [] };

  for (let i = 0; i < maxBatches; i += 1) {
    if (Date.now() - startedAt > maxRuntimeMs) break;
    const result = await processDueRosterEmails(sb, { batchSize });
    aggregate.batches += 1;
    aggregate.sent += result.sent || 0;
    aggregate.skipped += result.skipped || 0;
    aggregate.failed += result.failed || 0;
    if (Array.isArray(result.errors) && result.errors.length) {
      aggregate.errors.push(...result.errors.slice(0, Math.max(0, 20 - aggregate.errors.length)));
    }
    const processed = (result.sent || 0) + (result.skipped || 0) + (result.failed || 0);
    if (!processed) break;
  }

  return aggregate;
}

module.exports = {
  QUEUE_KINDS,
  staggerScheduledFor,
  scheduledForQueueRow,
  enqueueRosterEmailQueue,
  queueMemberRosterInvites,
  queueNewEventAlerts,
  queueBookingReminders,
  queueMembershipPayInviteEmails,
  processDueRosterEmails,
  drainDueRosterEmails,
  nextNewEventDigestUtc,
};
