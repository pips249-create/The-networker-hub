/**
 * When an organiser enables Hub ticket sales, email people who nudged for tickets
 * and expose interest leads in the organiser tickets workspace.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { getSupabaseAdmin } = require('./supabase');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl,
  logoNavUrl,
  logoFooterUrl,
  organiserPublicUrl,
} = require('./hub-email-urls');
const { formatEventDateTime } = require('./event-timezone');
const { buildOrganiserAvatarHtml } = require('./favourite-sales-emails');

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function firstName(name, email) {
  const fromName = String(name || '')
    .trim()
    .split(/\s+/)[0];
  if (fromName) return fromName;
  const local = String(email || '').split('@')[0];
  return local || 'there';
}

async function listTicketInterestNudgesForEventIds(eventIds) {
  const ids = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('event_ticket_sales_nudges')
    .select('id, event_id, nudger_email, nudger_name, message, created_at, notified_at')
    .in('event_id', ids)
    .order('created_at', { ascending: false });
  if (error) {
    // Column may be missing before migration 365 — retry without notified_at.
    if (/notified_at/i.test(String(error.message || ''))) {
      const retry = await sb
        .from('event_ticket_sales_nudges')
        .select('id, event_id, nudger_email, nudger_name, message, created_at')
        .in('event_id', ids)
        .order('created_at', { ascending: false });
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data || []).map((row) => ({ ...row, notified_at: null }));
    }
    throw new Error(error.message);
  }
  return data || [];
}

function mapNudgeLead(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: String(row.nudger_name || '').trim() || null,
    email: normalizeEmail(row.nudger_email),
    message: String(row.message || '').trim() || null,
    createdAt: row.created_at || null,
    notifiedAt: row.notified_at || null,
  };
}

/**
 * Distinct waiting nudger emails per event (notified_at is null).
 * @returns {Promise<Map<string, number>>}
 */
async function countWaitingTicketInterestByEventIds(eventIds) {
  const ids = [...new Set((eventIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const counts = new Map();
  if (!ids.length) return counts;
  const sb = getSupabaseAdmin();
  let rows = [];
  const { data, error } = await sb
    .from('event_ticket_sales_nudges')
    .select('event_id, nudger_email, notified_at')
    .in('event_id', ids)
    .is('notified_at', null);
  if (error) {
    if (/notified_at/i.test(String(error.message || ''))) {
      const retry = await sb
        .from('event_ticket_sales_nudges')
        .select('event_id, nudger_email')
        .in('event_id', ids);
      if (retry.error) throw new Error(retry.error.message);
      rows = retry.data || [];
    } else {
      throw new Error(error.message);
    }
  } else {
    rows = data || [];
  }

  const seen = new Map();
  for (const row of rows) {
    const eventId = String(row.event_id || '').trim();
    const email = normalizeEmail(row.nudger_email);
    if (!eventId || !email) continue;
    if (!seen.has(eventId)) seen.set(eventId, new Set());
    seen.get(eventId).add(email);
  }
  seen.forEach((emails, eventId) => {
    counts.set(eventId, emails.size);
  });
  return counts;
}

function attachTicketInterestWaitingCounts(events, countsByEventId) {
  const counts = countsByEventId || new Map();
  return (events || []).map((ev) => {
    if (!ev || !ev.id) return ev;
    const n = Number(counts.get(String(ev.id))) || 0;
    return { ...ev, ticketInterestWaiting: n };
  });
}

async function loadEventAndOrganiserForNotify(eventId) {
  const sb = getSupabaseAdmin();
  const id = String(eventId || '').trim();
  const { data: event, error } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, venue, city, location_label, meeting_type, meeting_link, organiser_id, ticket_sales_enabled, status, approval_status'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) return null;

  let organiser = null;
  if (event.organiser_id) {
    const { data: org } = await sb
      .from('organisers')
      .select('id, name, slug, photo_url')
      .eq('id', event.organiser_id)
      .maybeSingle();
    organiser = org || null;
  }
  return { event, organiser };
}

async function notifyTicketInterestNudgersSalesOpen(eventId) {
  const result = { sent: 0, skipped: 0, errors: [] };
  const ctx = await loadEventAndOrganiserForNotify(eventId);
  if (!ctx || !ctx.event) return result;
  if (ctx.event.ticket_sales_enabled !== true) return result;

  const nudges = await listTicketInterestNudgesForEventIds([ctx.event.id]);
  const pending = nudges.filter((row) => !row.notified_at);
  if (!pending.length) return result;

  const site = siteBase(process.env.SITE_URL);
  const { event_date, event_time } = formatEventDateTime(ctx.event.starts_at);
  const eventLocation =
    String(ctx.event.location_label || ctx.event.venue || ctx.event.city || '').trim() ||
    'See event page';
  const organiserName = String((ctx.organiser && ctx.organiser.name) || 'Networking group').trim();
  const sb = getSupabaseAdmin();
  const seen = new Set();

  for (const row of pending) {
    const email = normalizeEmail(row.nudger_email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.skipped += 1;
      continue;
    }
    if (seen.has(email)) {
      // Mark duplicate rows notified without a second email.
      try {
        await sb
          .from('event_ticket_sales_nudges')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', row.id)
          .is('notified_at', null);
      } catch {
        /* ignore */
      }
      result.skipped += 1;
      continue;
    }
    seen.add(email);

    try {
      await sendTemplatedEmail({
        slug: 'ticket_interest_sales_open',
        to: email,
        skipEmailCheck: true,
        variables: {
          user_name: firstName(row.nudger_name, email),
          user_email: email,
          event_name: String(ctx.event.title || 'Event').trim(),
          event_date,
          event_time,
          event_location: eventLocation,
          event_url: eventPublicUrl(ctx.event, site),
          organiser_name: organiserName,
          organiser_url: ctx.organiser
            ? organiserPublicUrl(ctx.organiser, site)
            : browseEventsUrl(site),
          organiser_avatar_html: ctx.organiser
            ? buildOrganiserAvatarHtml(ctx.organiser, site)
            : '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td style="width:72px;height:72px;background:#ebe0f0;border-radius:50%;text-align:center;vertical-align:middle;font-size:28px;color:#9a7aa8;line-height:72px;">&#9733;</td></tr></table>',
          hub_account_url: hubAccountUrl(site),
          browse_events_url: browseEventsUrl(site),
          contact_url: contactUrl(site),
          privacy_url: legalPolicyUrl(site, 'privacy'),
          terms_url: legalPolicyUrl(site, 'terms'),
          refunds_url: legalPolicyUrl(site, 'refunds'),
          site_url: site,
          logo_url: logoNavUrl(site),
          logo_footer_url: logoFooterUrl(site),
        },
      });
      await sb
        .from('event_ticket_sales_nudges')
        .update({ notified_at: new Date().toISOString() })
        .eq('event_id', ctx.event.id)
        .eq('nudger_email', email)
        .is('notified_at', null);
      result.sent += 1;
    } catch (e) {
      result.errors.push({ email, error: e.message || String(e) });
    }
  }

  return result;
}

module.exports = {
  listTicketInterestNudgesForEventIds,
  mapNudgeLead,
  countWaitingTicketInterestByEventIds,
  attachTicketInterestWaitingCounts,
  notifyTicketInterestNudgersSalesOpen,
};
