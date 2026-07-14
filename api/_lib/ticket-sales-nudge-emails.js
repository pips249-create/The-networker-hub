/**
 * Email organisers when a visitor wants to buy tickets but sales are not enabled yet.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendViaResend } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');
const {
  resolveTicketSalesEnabled,
  eventHasTicketsOnSale,
  earliestTicketSaleStart,
  isEventPublishedForSale,
} = require('./ticket-sales');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  if (!tickets.length) {
    const err = new Error('no_tickets');
    err.status = 400;
    throw err;
  }

  const ticketsOnSale = eventHasTicketsOnSale(tickets);
  const isScheduled = !ticketsOnSale && Boolean(earliestTicketSaleStart(tickets));
  if (isScheduled) {
    const err = new Error('ticket_sales_scheduled');
    err.status = 400;
    throw err;
  }
  if (resolveTicketSalesEnabled(event, tickets)) {
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

async function sendOrganiserTicketSalesNudgeEmail({ event, organiser, to, nudgerEmail, nudgerName, message }) {
  const siteUrl = String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const eventTitle = String(event.title || 'your event').trim();
  const organiserName = String(organiser?.name || 'there').trim();
  const ticketsUrl =
    siteUrl +
    '/organiser/event-tickets?eventId=' +
    encodeURIComponent(event.id);
  const dashboardUrl = siteBase(siteUrl) + '/organiser/';

  const subject = 'Someone wants tickets for ' + eventTitle;
  const html =
    '<p>Hi ' +
    escapeHtml(organiserName) +
    ',</p>' +
    '<p><strong>' +
    escapeHtml(nudgerName || nudgerEmail || 'A visitor') +
    '</strong> tried to get tickets for <strong>' +
    escapeHtml(eventTitle) +
    '</strong> on The Networker Hub.</p>' +
    '<p>Your event is listed publicly, but <strong>ticket sales are not enabled yet</strong>. Turn sales on so you do not miss bookings.</p>' +
    (message
      ? '<p><strong>Message from them:</strong><br>' + escapeHtml(message).replace(/\n/g, '<br>') + '</p>'
      : '') +
    '<p style="margin:24px 0;">' +
    '<a href="' +
    escapeHtml(ticketsUrl) +
    '" style="display:inline-block;padding:12px 20px;background:#bd932e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Enable ticket sales</a>' +
    '</p>' +
    '<p>Or open your <a href="' +
    escapeHtml(dashboardUrl) +
    '">organiser dashboard</a>, review tickets for this event, and switch on sales when you are ready.</p>' +
    '<p style="color:#635c5e;font-size:15px;">If you are not the organiser for this group, sign in and use the organiser page claim flow, or contact hello@thenetworkerhub.com.</p>' +
    '<p>— The Networker Hub</p>';

  return sendViaResend({ to, subject, html });
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
    nudgerEmail: email,
    nudgerName: name,
    message: note,
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
