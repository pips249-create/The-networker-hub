/**
 * Email organisers when a visitor wants to buy tickets but sales are not enabled yet.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');
const {
  resolveTicketSalesEnabled,
  eventHasTicketsOnSale,
  earliestTicketSaleStart,
  isEventPublishedForSale,
} = require('./ticket-sales');
const { arePublicTicketSalesOpen, publicTicketSalesClosedMessage } = require('./soft-launch');

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

async function loadNudgeContext(eventId) {
  const sb = getSupabaseAdmin();
  const { data: event, error } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, organiser_id, ticket_sales_enabled, status, approval_status, refund_terms_agreed, refund_terms_agreed_at'
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

async function sendOrganiserTicketSalesNudgeEmail({ event, organiser, to }) {
  const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const eventTitle = String(event.title || 'your event').trim();
  const organiserName = String(organiser?.name || 'there').trim();
  const ticketsUrl =
    siteUrl +
    '/organiser/event-tickets?eventId=' +
    encodeURIComponent(event.id);
  const dashboardUrl = siteBase(siteUrl) + '/organiser/';

  // Keep the requester anonymous in the email so organisers enable Hub sales
  // rather than contacting the visitor off-platform. Name/email stay in DB.
  return sendTemplatedEmail({
    slug: 'organiser_ticket_sales_nudge',
    to,
    variables: {
      organiser_name: organiserName,
      event_name: eventTitle,
      tickets_url: ticketsUrl,
      dashboard_url: dashboardUrl,
    },
    skipEmailCheck: true,
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

async function nudgeOrganiserForTicketSales({ eventId, nudgerEmail, nudgerName, message }) {
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

  const ctx = await loadNudgeContext(eventId);
  if (await recentNudgeExists(eventId, email, 24)) {
    const err = new Error('nudge_rate_limited');
    err.status = 429;
    throw err;
  }

  const note = String(message || '').trim().slice(0, 500);
  const name = String(nudgerName || '').trim().slice(0, 120);

  const emailResult = await sendOrganiserTicketSalesNudgeEmail({
    event: ctx.event,
    organiser: ctx.organiser,
    to: ctx.to,
  });

  const row = await recordTicketSalesNudge({
    event: ctx.event,
    nudgerEmail: email,
    nudgerName: name,
    message: note,
  });

  return { nudgeId: row.id, emailResult, organiserEmail: ctx.to };
}

module.exports = {
  nudgeOrganiserForTicketSales,
  loadNudgeContext,
};
