const { getSupabaseAdmin } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { resolveBookedListing } = require('./booking-snapshot');
const { formatBookingReference, formatBookedAt, formatTicketQuantity } = require('./booking-payment-summary');
const { formatDateTimeLong } = require('./event-timezone');
const { escapeHtml } = require('./event-refund-policy');
const { getOrganiserConnectForEvent } = require('./stripe-connect');
const { getStripeClient, isStripeCheckoutConfigured, retrieveCheckoutSession } = require('./stripe-checkout');
const {
  BOOKING_FEE_LABEL,
  registrationTicketRevenue,
  registrationBookingFee,
} = require('./booking-fees');
const { buildSimpleTextPdf } = require('./simple-pdf');

const REGISTRATION_SELECT = `
  id,
  attendee_id,
  event_id,
  ticket_id,
  payment_status,
  application_status,
  amount_paid,
  quantity,
  created_at,
  cancelled_at,
  booked_snapshot,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  attendees (
    name,
    email
  ),
  events (
    id,
    title,
    slug,
    starts_at,
    ends_at,
    venue,
    city,
    postcode,
    location_label,
    meeting_type,
    meeting_link,
    organiser_id,
    organisers (
      id,
      name
    )
  ),
  tickets (
    id,
    name,
    price
  )
`;

function requestError(message, status) {
  const err = new Error(message);
  err.status = status || 400;
  return err;
}

function formatDateTime(iso) {
  return formatDateTimeLong(iso);
}

function formatAmount(amount, paymentStatus) {
  const status = String(paymentStatus || '').trim();
  if (status === 'Free') return 'Free';
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function bookingIsComplete(registration, booked) {
  const applicationStatus = String(registration.application_status || 'Approved').trim();
  if (applicationStatus === 'Denied' || applicationStatus === 'Pending') return false;
  const paymentStatus = String(registration.payment_status || 'Pending').trim();
  const amountPaid = Number(booked.amountPaid);
  if (paymentStatus === 'Paid' || paymentStatus === 'Free' || amountPaid > 0) return true;
  return false;
}

function invoiceAvailable(registration, booked) {
  const applicationStatus = String(registration.application_status || 'Approved').trim();
  if (applicationStatus === 'Denied') return false;
  const paymentStatus = String(registration.payment_status || '').trim();
  if (paymentStatus === 'Free') return true;
  const amount = Number(booked.amountPaid);
  return paymentStatus === 'Paid' || (Number.isFinite(amount) && amount > 0);
}

function buildDocumentContext(registration) {
  const ev = registration.events || {};
  const organiser = ev.organisers || {};
  const ticket = registration.tickets || {};
  const attendee = registration.attendees || {};
  const booked = resolveBookedListing({ registration, eventRow: ev, ticketRow: ticket });
  const bookingReference = formatBookingReference(registration.id);
  const siteUrl = String(process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const eventUrl = booked.eventRow.slug
    ? siteUrl + '/events/' + encodeURIComponent(booked.eventRow.slug)
    : siteUrl + '/events/event?id=' + encodeURIComponent(registration.event_id || '');

  let location = '—';
  if (booked.isOnline) {
    location = 'Online';
  } else {
    location =
      String(booked.eventRow.location_label || '').trim() ||
      [booked.eventRow.venue, booked.eventRow.city, booked.eventRow.postcode].filter(Boolean).join(', ').trim() ||
      String(booked.eventRow.city || '').trim() ||
      '—';
  }

  const ticketRevenue = registrationTicketRevenue(registration);
  const bookingFee = registrationBookingFee(registration);
  const amountPaidNum = Number(booked.amountPaid) || 0;

  return {
    registration,
    booked,
    bookingReference,
    siteUrl,
    eventUrl,
    attendeeName: String(attendee.name || '').trim() || 'Attendee',
    attendeeEmail: String(attendee.email || registration.attendee_email || '').trim(),
    eventTitle: booked.title,
    organiserName: String(organiser.name || '').trim() || 'Event organiser',
    eventDate: formatDateTime(booked.date),
    eventEndDate: booked.endDate ? formatDateTime(booked.endDate) : '',
    location,
    ticketLabel: formatTicketQuantity(booked.quantity, booked.ticketName),
    bookedAt: formatBookedAt(registration.created_at),
    amountPaid: formatAmount(booked.amountPaid, registration.payment_status),
    amountPaidNum,
    ticketRevenue,
    ticketRevenueDisplay: formatAmount(ticketRevenue, registration.payment_status),
    bookingFee,
    bookingFeeDisplay: formatAmount(bookingFee, registration.payment_status),
    bookingFeeLabel: BOOKING_FEE_LABEL,
    paymentStatus: String(registration.payment_status || 'Pending').trim(),
    applicationStatus: String(registration.application_status || 'Approved').trim(),
    isOnline: booked.isOnline,
    meetingLink: booked.isOnline ? booked.meetingLink : '',
  };
}

async function loadRegistrationForAttendee(session, registrationId) {
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) throw requestError('Not signed in', 401);

  const id = String(registrationId || '').trim();
  if (!id) throw requestError('Missing registration id', 400);

  const { data: registration, error } = await sb
    .from('registrations')
    .select(REGISTRATION_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!registration || registration.attendee_id !== attendeeId) {
    throw requestError('Booking not found', 404);
  }
  if (registration.cancelled_at) {
    throw requestError('This booking has been cancelled', 400);
  }

  return { sb, registration, context: buildDocumentContext(registration) };
}

function buildTicketPdf(context) {
  const lines = [
    'THE NETWORKER HUB — EVENT TICKET',
    '',
    'Booking reference: ' + context.bookingReference,
    'Attendee: ' + context.attendeeName,
    context.attendeeEmail ? 'Email: ' + context.attendeeEmail : '',
    '',
    'Event: ' + context.eventTitle,
    'Organiser: ' + context.organiserName,
    'When: ' + context.eventDate,
    context.eventEndDate ? 'Ends: ' + context.eventEndDate : '',
    'Where: ' + context.location,
    'Tickets: ' + context.ticketLabel,
    'Booked: ' + context.bookedAt,
    'Total paid: ' + context.amountPaid,
    '',
    context.isOnline && context.meetingLink
      ? 'Join online: ' + context.meetingLink
      : context.isOnline
        ? 'Online joining details will be emailed before the event.'
        : 'Present this ticket at the event.',
    '',
    'Event page: ' + context.eventUrl,
    '',
    'Issued by The Networker Hub on behalf of the event organiser.',
  ].filter(Boolean);
  return buildSimpleTextPdf(lines);
}

function buildTaxInvoicePdf(context) {
  const lines = [
    'THE NETWORKER HUB — BOOKING TAX INVOICE / RECEIPT',
    '',
    'Booking reference: ' + context.bookingReference,
    'Issued: ' + formatBookedAt(new Date().toISOString()),
    'Bill to: ' + context.attendeeName,
    context.attendeeEmail ? 'Email: ' + context.attendeeEmail : '',
    '',
    'Event: ' + context.eventTitle,
    'Organiser (ticket seller): ' + context.organiserName,
    'When: ' + context.eventDate,
    'Tickets: ' + context.ticketLabel,
    'Booked: ' + context.bookedAt,
    'Payment status: ' + context.paymentStatus,
    '',
    'LINE ITEMS',
    'Ticket(s) payable to organiser: ' + context.ticketRevenueDisplay,
    context.bookingFee > 0
      ? context.bookingFeeLabel + ': ' + context.bookingFeeDisplay
      : '',
    'Total paid: ' + context.amountPaid,
    '',
    'NOTES',
    'Ticket supply: event organiser. Platform booking fee: The Networker Group Ltd',
    '(Company No. 15252227, VAT No. 454 4092 94).',
    'Ticket VAT treatment is the organiser\'s responsibility.',
    'This Hub document is for expense / accounts; keep with your bank statement.',
    '',
    'Event page: ' + context.eventUrl,
  ].filter((line) => line !== '');
  return buildSimpleTextPdf(lines, { fontSize: 10, lineHeight: 13, marginTop: 36 });
}

function buildHubInvoiceHtml(context, options) {
  const opts = options || {};
  const issuedAt = formatBookedAt(new Date().toISOString());
  const pdfHref =
    '/api/auth/registration-invoice?registrationId=' +
    encodeURIComponent(context.registration.id || '') +
    '&format=pdf';
  const stripeLink = opts.stripeReceiptUrl
    ? '<a class="btn btn-secondary" href="' +
      escapeHtml(opts.stripeReceiptUrl) +
      '" target="_blank" rel="noopener noreferrer">Card receipt (Stripe)</a>'
    : '';
  const feeRows =
    context.amountPaidNum > 0
      ? '<tr><td>Ticket(s) — payable to organiser</td><td>' +
        escapeHtml(context.ticketRevenueDisplay) +
        '</td></tr>' +
        (context.bookingFee > 0
          ? '<tr><td>' +
            escapeHtml(context.bookingFeeLabel) +
            ' — The Networker Hub</td><td>' +
            escapeHtml(context.bookingFeeDisplay) +
            '</td></tr>'
          : '')
      : '';

  return (
    '<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    '<title>Tax invoice ' +
    escapeHtml(context.bookingReference) +
    '</title>' +
    '<style>body{font-family:"DM Sans",system-ui,sans-serif;background:#faf6ee;color:#4a4446;margin:0;padding:24px}' +
    '.card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e8dfd0;border-radius:14px;padding:28px}' +
    'h1{font-size:22px;color:#1c2040;margin:0 0 6px}.kicker{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9a7aa8;margin:0 0 10px}' +
    'table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:8px 0;border-bottom:1px solid #f0ebe3;vertical-align:top;font-size:14px}' +
    'td:first-child{color:#635c5e;width:55%}td:last-child{font-weight:600;color:#1c2040;text-align:right}.total td:last-child{font-size:18px}' +
    '.note{margin-top:18px;font-size:13px;line-height:1.5;color:#635c5e}.actions{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px}' +
    'a.btn{display:inline-block;padding:10px 18px;border-radius:999px;background:#4a4446;color:#fff;text-decoration:none;font-weight:600;font-size:14px}' +
    'a.btn-secondary{background:#fff;color:#4a4446;border:1px solid #d9c4e0}' +
    '@media print{body{background:#fff;padding:0}.actions{display:none}.card{border:none;box-shadow:none;padding:0}}</style></head><body>' +
    '<div class="card"><p class="kicker">Tax invoice / booking receipt</p><h1>' +
    escapeHtml(context.bookingReference) +
    '</h1><p class="note">Issued ' +
    escapeHtml(issuedAt) +
    ' · The Networker Hub<br>Bill to: ' +
    escapeHtml(context.attendeeName) +
    (context.attendeeEmail ? ' · ' + escapeHtml(context.attendeeEmail) : '') +
    '</p>' +
    '<table><tbody>' +
    '<tr><td>Event</td><td>' +
    escapeHtml(context.eventTitle) +
    '</td></tr>' +
    '<tr><td>Organiser (ticket seller)</td><td>' +
    escapeHtml(context.organiserName) +
    '</td></tr>' +
    '<tr><td>Booked on</td><td>' +
    escapeHtml(context.bookedAt) +
    '</td></tr>' +
    '<tr><td>Event date</td><td>' +
    escapeHtml(context.eventDate) +
    '</td></tr>' +
    '<tr><td>Tickets</td><td>' +
    escapeHtml(context.ticketLabel) +
    '</td></tr>' +
    '<tr><td>Payment status</td><td>' +
    escapeHtml(context.paymentStatus) +
    '</td></tr>' +
    feeRows +
    '<tr class="total"><td>Total paid</td><td>' +
    escapeHtml(context.amountPaid) +
    '</td></tr>' +
    '</tbody></table>' +
    '<p class="note">Ticket supply is from the event organiser. The Hub booking fee is charged by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94). Ticket VAT treatment is the organiser&rsquo;s responsibility. Use this document for expense claims; print or save the PDF for your accounts team.</p>' +
    '<div class="actions"><a class="btn" href="' +
    escapeHtml(pdfHref) +
    '">Download PDF</a><a class="btn btn-secondary" href="#" onclick="window.print();return false;">Print</a>' +
    stripeLink +
    '<a class="btn btn-secondary" href="' +
    escapeHtml(context.eventUrl) +
    '">View event</a></div></div></body></html>'
  );
}

async function retrieveStripeReceiptUrl(sb, registration) {
  if (!isStripeCheckoutConfigured()) return null;

  const sessionId = String(registration.stripe_checkout_session_id || '').trim();
  const paymentIntentId = String(registration.stripe_payment_intent_id || '').trim();
  if (!sessionId && !paymentIntentId) return null;

  const connect = await getOrganiserConnectForEvent(sb, registration.event_id);
  const stripeAccountId = connect?.stripeAccountId || null;
  const stripe = getStripeClient();
  const requestOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

  async function receiptFromPaymentIntent(piId) {
    if (!piId) return null;
    const pi = await stripe.paymentIntents.retrieve(
      piId,
      { expand: ['latest_charge'] },
      requestOpts
    );
    const charge = pi.latest_charge;
    if (charge && typeof charge === 'object' && charge.receipt_url) {
      return String(charge.receipt_url).trim() || null;
    }
    return null;
  }

  if (sessionId) {
    const session = await retrieveCheckoutSession(sessionId, { stripeAccountId });
    const piRef = session.payment_intent;
    const piId = typeof piRef === 'string' ? piRef : piRef?.id || '';
    const receiptUrl = await receiptFromPaymentIntent(piId);
    if (receiptUrl) return receiptUrl;
  }

  return receiptFromPaymentIntent(paymentIntentId);
}

module.exports = {
  loadRegistrationForAttendee,
  buildDocumentContext,
  bookingIsComplete,
  invoiceAvailable,
  buildTicketPdf,
  buildTaxInvoicePdf,
  buildHubInvoiceHtml,
  retrieveStripeReceiptUrl,
};
