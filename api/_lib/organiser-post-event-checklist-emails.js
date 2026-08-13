/**
 * Shortly after an event ends, email the organiser a two-step checklist:
 * mark no-shows before review emails go out, then send the attendee round-up.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const { formatDateTimeLong } = require('./event-timezone');
const { siteBase, organiserDashboardUrl } = require('./hub-email-urls');
const { baseEmailVars } = require('./lifecycle-emails');
const { claimRowTimestamp, releaseRowTimestamp } = require('./email-send-claim');

const CHECKLIST_MAX_AGE_HOURS = 48;
const CHECKLIST_START_FALLBACK_HOURS = 2;
const CHECKLIST_BATCH_LIMIT = 20;

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function eventEndIso(eventRow) {
  if (eventRow?.ends_at) return eventRow.ends_at;
  if (!eventRow?.starts_at) return null;
  const startMs = new Date(eventRow.starts_at).getTime();
  if (Number.isNaN(startMs)) return null;
  return new Date(startMs + CHECKLIST_START_FALLBACK_HOURS * 60 * 60 * 1000).toISOString();
}

function eventIsDueForChecklist(eventRow, nowMs, minEndIso) {
  if (String(eventRow.status || '').toLowerCase() === 'cancelled') return false;
  const endIso = eventEndIso(eventRow);
  if (!endIso) return false;
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(endMs)) return false;
  if (endMs > nowMs) return false;
  if (endIso < minEndIso) return false;
  return true;
}

async function countEligibleAttendees(sb, eventId) {
  const { count, error } = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);
  return Number(count) || 0;
}

async function sendDueOrganiserPostEventChecklistEmails(sb, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const dryRun = opts.dryRun === true;
  const result = { sent: 0, skipped: 0, errors: [] };
  const nowMs = Date.now();
  const minEndIso = hoursAgo(CHECKLIST_MAX_AGE_HOURS);
  const lookbackIso = hoursAgo(CHECKLIST_MAX_AGE_HOURS + CHECKLIST_START_FALLBACK_HOURS);

  const eventSelect =
    'id, title, slug, starts_at, ends_at, organiser_id, status, post_event_organiser_checklist_sent_at';
  const [endedWithEndRes, endedWithoutEndRes] = await Promise.all([
    sb
      .from('events')
      .select(eventSelect)
      .is('post_event_organiser_checklist_sent_at', null)
      .lte('ends_at', new Date(nowMs).toISOString())
      .gte('ends_at', minEndIso)
      .not('organiser_id', 'is', null)
      .neq('status', 'cancelled'),
    sb
      .from('events')
      .select(eventSelect)
      .is('post_event_organiser_checklist_sent_at', null)
      .is('ends_at', null)
      .lte('starts_at', new Date(nowMs).toISOString())
      .gte('starts_at', lookbackIso)
      .not('organiser_id', 'is', null)
      .neq('status', 'cancelled'),
  ]);
  if (endedWithEndRes.error) {
    if (/post_event_organiser_checklist_sent_at|column/i.test(endedWithEndRes.error.message || '')) {
      return result;
    }
    throw new Error(endedWithEndRes.error.message);
  }
  if (endedWithoutEndRes.error) throw new Error(endedWithoutEndRes.error.message);

  const eventById = {};
  for (const row of [...(endedWithEndRes.data || []), ...(endedWithoutEndRes.data || [])]) {
    if (row?.id && eventIsDueForChecklist(row, nowMs, minEndIso)) {
      eventById[row.id] = row;
    }
  }
  const events = Object.values(eventById);
  const siteUrl = siteBase();

  for (const eventRow of events) {
    if (result.sent >= CHECKLIST_BATCH_LIMIT) break;
    try {
      const attendeeCount = await countEligibleAttendees(sb, eventRow.id);
      if (attendeeCount < 1) {
        result.skipped += 1;
        continue;
      }

      const notify = await resolveOrganiserNotificationEmail(sb, eventRow.organiser_id);
      const to = String(notify.email || '').trim().toLowerCase();
      if (!to) {
        result.skipped += 1;
        continue;
      }

      if (dryRun) {
        result.sent += 1;
        continue;
      }

      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'events',
        id: eventRow.id,
        column: 'post_event_organiser_checklist_sent_at',
        claimedAt,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'organiser_post_event_checklist',
          to,
          variables: {
            ...baseEmailVars(siteUrl),
            organiser_name: String(notify.name || '').trim() || 'there',
            event_name: String(eventRow.title || 'your event').trim(),
            event_date: formatDateTimeLong(eventRow.starts_at) || '',
            attendee_count: String(attendeeCount),
            attendees_url: organiserDashboardUrl(siteUrl, {
              panel: 'events-attendees',
              eventId: eventRow.id,
            }),
            roundup_url: organiserDashboardUrl(siteUrl, {
              panel: 'communicate',
              eventId: eventRow.id,
            }),
          },
          skipEmailCheck: true,
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'events',
          id: eventRow.id,
          column: 'post_event_organiser_checklist_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else {
        result.errors.push({
          event_id: eventRow.id,
          error: e.message || String(e),
        });
      }
    }
  }

  return result;
}

module.exports = {
  sendDueOrganiserPostEventChecklistEmails,
};
