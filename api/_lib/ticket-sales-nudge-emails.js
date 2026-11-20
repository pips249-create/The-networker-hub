/**
 * Email organisers when a visitor wants to buy tickets but sales are not enabled yet,
 * and confirm to the visitor that they are on the wait list.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  browseEventsUrl,
  eventPublicUrl,
  logoNavUrl,
  logoFooterUrl,
  legalPolicyUrl,
  contactUrl,
} = require('./hub-email-urls');
const {
  resolveTicketSalesEnabled,
  eventHasTicketsOnSale,
  earliestTicketSaleStart,
  isEventPublishedForSale,
} = require('./ticket-sales');
const { arePublicTicketSalesOpen, publicTicketSalesClosedMessage } = require('./soft-launch');
const { formatEventDateTime } = require('./event-timezone');
const { countWaitingTicketInterestByEventIds } = require('./ticket-sales-nudge-followup');

function organiserRecipientEmail(organiser, account) {
  const candidates = [
    organiser?.contact_email,
    organiser?.email,
    account?.email,
  ];
  for (const raw of candidates) {
    const em = String(raw || '')
      .trim()
      .toLowerCase();
    if (em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return em;
  }
  return null;
}

function firstName(name, email) {
  const fromName = String(name || '')
    .trim()
    .split(/\s+/)[0];
  if (fromName) return fromName;
  const local = String(email || '').split('@')[0];
  return local || 'there';
}

function escapeEmailText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function interestCopy(waitingCount, intent) {
  const n = Math.max(1, Number(waitingCount) || 1);
  const isPrice = String(intent || '').toLowerCase() === 'price';
  if (isPrice) {
    return {
      interest_count: String(n),
      interest_count_label: n === 1 ? 'person asking about price' : 'people asking about price',
      interest_headline:
        n === 1
          ? 'Someone asked about the price for {{event_name}}'
          : n + ' people asked about the price for {{event_name}}',
      interest_summary:
        n === 1
          ? 'someone asked what it costs to attend your event.'
          : n +
            ' people have asked what it costs to attend your event (including this latest request).',
      interest_subject:
        n === 1
          ? 'Someone asked about the price for {{event_name}}'
          : n + ' people asked about the price for {{event_name}}',
      interest_next_step:
        'Reply to them directly using the contact below, or publish a price on your event so people can book.',
      interest_cta_label: 'Open event tickets →',
    };
  }
  if (n === 1) {
    return {
      interest_count: '1',
      interest_count_label: 'person waiting for tickets',
      interest_headline: 'Someone wants tickets for {{event_name}}',
      interest_summary:
        'someone tried to get tickets for your event and is waiting to hear that sales are open.',
      interest_subject: 'Someone wants tickets for {{event_name}}',
      interest_next_step:
        'Ticket sales are not enabled yet — turn them on so we can email waiting people a booking link. You can also reply to the person below.',
      interest_cta_label: 'Enable ticket sales →',
    };
  }
  return {
    interest_count: String(n),
    interest_count_label: 'people waiting for tickets',
    interest_headline: n + ' people want tickets for {{event_name}}',
    interest_summary:
      n +
      ' people have asked about tickets for your event (including this latest request) and are waiting for sales to open.',
    interest_subject: n + ' people want tickets for {{event_name}}',
    interest_next_step:
      'Ticket sales are not enabled yet — turn them on so we can email waiting people a booking link. You can also reply to the person below.',
    interest_cta_label: 'Enable ticket sales →',
  };
}

function requesterContactHtml({ nudgerName, nudgerEmail }) {
  const email = String(nudgerEmail || '')
    .trim()
    .toLowerCase();
  if (!email) return '';
  const name = String(nudgerName || '').trim() || email;
  const safeName = escapeEmailText(name);
  const safeEmail = escapeEmailText(email);
  return (
    '<tr><td class="mobile-pad" style="padding:0 40px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f4ec;border-radius:14px;border:1px solid #e8d9a8;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:#1c2040;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.04em;">Reply to this person</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.6;color:#635c5e;margin:0;">' +
    '<strong style="color:#1c2040;">' +
    safeName +
    '</strong><br>' +
    '<a href="mailto:' +
    safeEmail +
    '" style="color:#4aa8f0;text-decoration:none;">' +
    safeEmail +
    '</a></p>' +
    '</td></tr></table></td></tr>'
  );
}

async function loadNudgeContext(eventId) {
  const sb = getSupabaseAdmin();
  const { data: event, error } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, organiser_id, ticket_sales_enabled, status, approval_status, refund_terms_agreed, refund_terms_agreed_at, venue, city, location_label'
    )
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!event) {
    const err = new Error('event_not_found');
    err.status = 404;
    throw err;
  }
  if (!isEventPublishedForSale(event)) {
    const err = new Error('event_not_public');
    err.status = 400;
    throw err;
  }

  const { data: ticketRows, error: ticketsError } = await sb
    .from('tickets')
    .select('id, status, sale_starts_at, sale_ends_at')
    .eq('event_id', eventId);
  if (ticketsError) throw new Error(ticketsError.message);

  const tickets = ticketRows || [];
  const ticketsOnSale = tickets.length ? eventHasTicketsOnSale(tickets) : false;
  const isScheduled = tickets.length && !ticketsOnSale && Boolean(earliestTicketSaleStart(tickets));
  if (isScheduled) {
    const err = new Error('ticket_sales_scheduled');
    err.status = 400;
    throw err;
  }
  if (tickets.length && resolveTicketSalesEnabled(event, tickets)) {
    const err = new Error('ticket_sales_already_enabled');
    err.status = 400;
    throw err;
  }

  let organiser = null;
  let account = null;
  if (event.organiser_id) {
    const orgRes = await sb.from('organisers').select('*').eq('id', event.organiser_id).maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiser = orgRes.data;
    if (organiser?.organiser_account_id) {
      const accRes = await sb
        .from('organiser_accounts')
        .select('id, email')
        .eq('id', organiser.organiser_account_id)
        .maybeSingle();
      if (accRes.error) throw new Error(accRes.error.message);
      account = accRes.data;
    }
  }

  const to = organiserRecipientEmail(organiser, account);
  if (!to) {
    const err = new Error('organiser_email_missing');
    err.status = 503;
    throw err;
  }

  return { event, organiser, account, to };
}

async function recentNudgeExists(eventId, nudgerEmail, hours) {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('event_ticket_sales_nudges')
    .select('id')
    .eq('event_id', eventId)
    .eq('nudger_email', nudgerEmail)
    .gte('created_at', since)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}

async function sendOrganiserTicketSalesNudgeEmail({
  event,
  organiser,
  to,
  waitingCount,
  intent,
  nudgerEmail,
  nudgerName,
}) {
  const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const eventTitle = String(event.title || 'your event').trim();
  const organiserName = String(organiser?.name || 'there').trim();
  const ticketsUrl =
    siteBase(siteUrl) +
    '/organiser/event-tickets?eventId=' +
    encodeURIComponent(event.id) +
    '#ticket-interest';
  const dashboardUrl = siteBase(siteUrl) + '/organiser/#events-list';
  const isPrice = String(intent || '').toLowerCase() === 'price';
  const copy = interestCopy(waitingCount, intent);
  const headline =
    isPrice
      ? Number(waitingCount) > 1
        ? Number(waitingCount) + ' people asked about the price for ' + eventTitle
        : 'Someone asked about the price for ' + eventTitle
      : Number(waitingCount) > 1
        ? Number(waitingCount) + ' people want tickets for ' + eventTitle
        : 'Someone wants tickets for ' + eventTitle;

  return sendTemplatedEmail({
    slug: 'organiser_ticket_sales_nudge',
    to,
    replyTo: nudgerEmail || undefined,
    variables: {
      organiser_name: organiserName,
      event_name: eventTitle,
      tickets_url: ticketsUrl,
      dashboard_url: dashboardUrl,
      ...copy,
      interest_headline: headline,
      interest_subject: headline,
      requester_contact_html: requesterContactHtml({ nudgerName, nudgerEmail }),
    },
    skipEmailCheck: true,
  });
}

async function sendVisitorTicketInterestReceivedEmail({
  event,
  organiser,
  nudgerEmail,
  nudgerName,
  intent,
}) {
  const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const site = siteBase(siteUrl);
  const { event_date, event_time } = formatEventDateTime(event.starts_at);
  const eventWhen = [event_date, event_time].filter(Boolean).join(' · ') || 'See event page';
  const organiserName = String(organiser?.name || 'the organiser').trim();
  const isPrice = String(intent || '').toLowerCase() === 'price';
  const attendee = firstName(nudgerName, nudgerEmail);
  const eventName = String(event.title || 'Event').trim();
  const safeAttendee = escapeEmailText(attendee);
  const safeOrganiser = escapeEmailText(organiserName);
  const safeEvent = escapeEmailText(eventName);
  const safeWhen = escapeEmailText(eventWhen);

  return sendTemplatedEmail({
    slug: 'ticket_interest_received',
    to: nudgerEmail,
    skipEmailCheck: true,
    variables: {
      attendee_name: attendee,
      event_name: eventName,
      event_when: eventWhen,
      event_url: eventPublicUrl(event, site),
      events_url: browseEventsUrl(site),
      organiser_name: organiserName,
      site_url: site,
      logo_url: logoNavUrl(site),
      logo_footer_url: logoFooterUrl(site),
      privacy_url: legalPolicyUrl(site, 'privacy'),
      terms_url: legalPolicyUrl(site, 'terms'),
      contact_url: contactUrl(site),
      interest_kicker: isPrice ? 'Price enquiry' : 'Ticket interest',
      interest_title: isPrice ? 'We emailed the organiser' : "You're on the list",
      interest_body: isPrice
        ? 'Hi ' +
          safeAttendee +
          ', we\'ve emailed <strong style="color:#452d5c;">' +
          safeOrganiser +
          '</strong> about the price for <strong style="color:#452d5c;">' +
          safeEvent +
          '</strong> (' +
          safeWhen +
          '), including your contact details so they can reply to you directly.'
        : 'Hi ' +
          safeAttendee +
          ', we\'ve told <strong style="color:#452d5c;">' +
          safeOrganiser +
          '</strong> that you want tickets for <strong style="color:#452d5c;">' +
          safeEvent +
          '</strong> (' +
          safeWhen +
          '), and shared your contact details so they can reply. We\'ll also email you if Hub ticket sales open.',
      interest_next: isPrice
        ? 'If the organiser replies, it will come from their own email — keep an eye on your inbox (and spam folder). This is not a booking yet.'
        : 'The organiser can reply to you directly, or turn on Hub ticket sales from their dashboard. As soon as they do, we can send you a booking link — this is not a booking yet.',
    },
  });
}

async function recordTicketSalesNudge({ event, nudgerEmail, nudgerName, message }) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('event_ticket_sales_nudges')
    .insert({
      event_id: event.id,
      organiser_id: event.organiser_id || null,
      nudger_email: nudgerEmail,
      nudger_name: nudgerName || null,
      message: message || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function nudgeOrganiserForTicketSales({ eventId, nudgerEmail, nudgerName, message, intent }) {
  const email = String(nudgerEmail || '')
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error('invalid_email');
    err.status = 400;
    throw err;
  }

  // Soft launch: pause interest emails until public ticket buying opens (1 Sep 2026).
  if (!arePublicTicketSalesOpen()) {
    const err = new Error('ticket_sales_platform_closed');
    err.status = 403;
    err.publicMessage = publicTicketSalesClosedMessage();
    throw err;
  }

  const askIntent = String(intent || '').toLowerCase() === 'price' ? 'price' : 'tickets';

  const ctx = await loadNudgeContext(eventId);
  if (await recentNudgeExists(eventId, email, 24)) {
    const err = new Error('nudge_rate_limited');
    err.status = 429;
    throw err;
  }

  const note = String(message || '').trim().slice(0, 500);
  const name = String(nudgerName || '').trim().slice(0, 120);

  // Record first so the organiser workspace shows the lead even if email sending fails.
  const row = await recordTicketSalesNudge({
    event: ctx.event,
    nudgerEmail: email,
    nudgerName: name,
    message: note || (askIntent === 'price' ? 'Asked about the price' : null),
  });

  let waitingCount = 1;
  try {
    const counts = await countWaitingTicketInterestByEventIds([ctx.event.id]);
    waitingCount = Math.max(1, Number(counts.get(String(ctx.event.id))) || 1);
  } catch {
    waitingCount = 1;
  }

  const emailResult = await sendOrganiserTicketSalesNudgeEmail({
    event: ctx.event,
    organiser: ctx.organiser,
    to: ctx.to,
    waitingCount,
    intent: askIntent,
    nudgerEmail: email,
    nudgerName: name,
  });

  try {
    await sendVisitorTicketInterestReceivedEmail({
      event: ctx.event,
      organiser: ctx.organiser,
      nudgerEmail: email,
      nudgerName: name,
      intent: askIntent,
    });
  } catch (visitorErr) {
    console.warn(
      '[ticket-sales-nudge] visitor confirmation failed',
      visitorErr && visitorErr.message ? visitorErr.message : visitorErr
    );
  }

  return {
    nudgeId: row.id,
    emailResult,
    organiserEmail: ctx.to,
    waitingCount,
    intent: askIntent,
  };
}

module.exports = {
  nudgeOrganiserForTicketSales,
  loadNudgeContext,
};
