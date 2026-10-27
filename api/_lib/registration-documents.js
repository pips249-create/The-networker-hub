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
const {
  buildSimpleTextPdf,
  buildPositionedPdf,
  wrapText,
  truncateToWidth,
  fitImageInBox,
} = require('./simple-pdf');
const { loadTicketPdfLogos } = require('./ticket-pdf-logos');

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
      name,
      photo_url
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
  const siteUrl = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
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

  const ticketRevenue = registrationTicketRevenue({
    ...registration,
    event_vat_treatment: booked.eventRow?.vat_treatment || booked.eventRow?.vatTreatment || null,
    ticket_unit_price:
      booked.ticketRow?.price != null
        ? Number(String(booked.ticketRow.price).replace(/[£,\s]/g, ''))
        : null,
  });
  const bookingFee = registrationBookingFee({
    ...registration,
    event_vat_treatment: booked.eventRow?.vat_treatment || booked.eventRow?.vatTreatment || null,
    ticket_unit_price:
      booked.ticketRow?.price != null
        ? Number(String(booked.ticketRow.price).replace(/[£,\s]/g, ''))
        : null,
  });
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
    organiserLogoUrl: String(organiser.photo_url || '').trim(),
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

function approxPaidWidth(text) {
  return Math.max(24, String(text || '').length * 7);
}

function formatWhenForTicket(startLabel, endLabel) {
  const start = String(startLabel || '').trim();
  const end = String(endLabel || '').trim();
  if (!start) return '—';
  if (!end) return start;
  const startParts = start.split(' at ');
  const endParts = end.split(' at ');
  if (startParts.length === 2 && endParts.length === 2 && startParts[0] === endParts[0]) {
    // Same day: date on first line, times on second — avoids "10:00 –" wrapping alone.
    return startParts[0] + '\n' + startParts[1] + ' – ' + endParts[1];
  }
  return start + '\nEnds ' + end;
}

async function buildTicketPdf(context) {
  const logos = await loadTicketPdfLogos(context);
  const organiserLogo = logos.organiserLogo;
  const hubLogo = logos.hubLogo;

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;
  const cardX = margin;
  const cardW = pageW - margin * 2;
  const cardTop = pageH - 48;
  const headerH = organiserLogo ? 78 : 64;
  const accent = '#452d5c';
  const accentSoft = '#f3eef5';
  const coral = '#bd932e';
  const textDark = '#2d1b3d';
  const textMid = '#5a4a62';
  const textSoft = '#7a6688';
  const border = '#e8dbea';
  const colGap = 18;
  const colW = (cardW - 48 - colGap) / 2;
  const contentPad = 24;

  const instruction =
    context.isOnline && context.meetingLink
      ? 'Join online: ' + context.meetingLink
      : context.isOnline
        ? 'Online joining details will be emailed before the event.'
        : 'Present this ticket at the event.';

  const eventLines = wrapText(context.eventTitle || 'Event', 16, cardW - 48, 2);
  const organiserLine = truncateToWidth(
    'Organised by ' + (context.organiserName || 'Event organiser'),
    10,
    cardW - 48
  );
  const instructionLines = wrapText(instruction, 10, cardW - 48, 3);
  const ticketsLabel = String(context.ticketLabel || '1 × Ticket');
  const whenLines = String(formatWhenForTicket(context.eventDate, context.eventEndDate))
    .split('\n')
    .filter(Boolean);
  const whereLines = wrapText(context.location || '—', 11, colW, 3);
  const attendeeName = context.attendeeName || 'Attendee';
  const attendeeEmail = context.attendeeEmail
    ? truncateToWidth(context.attendeeEmail, 9, colW)
    : '';
  const ticketLines = wrapText(ticketsLabel, 11, colW, 2);

  const images = [];
  const contentItems = [
    {
      type: 'rect',
      x: cardX,
      y: cardTop - headerH,
      w: cardW,
      h: headerH,
      fill: accent,
    },
    {
      type: 'rect',
      x: cardX,
      y: cardTop - headerH,
      w: 6,
      h: headerH,
      fill: coral,
    },
  ];

  if (organiserLogo) {
    images.push({
      name: 'OrgLogo',
      jpeg: organiserLogo.jpeg,
      width: organiserLogo.width,
      height: organiserLogo.height,
    });
    const logoPad = 8;
    const logoBox = {
      x: cardX + 18,
      y: cardTop - headerH + 12,
      w: 108,
      h: headerH - 24,
    };
    contentItems.push({
      type: 'rect',
      x: logoBox.x,
      y: logoBox.y,
      w: logoBox.w,
      h: logoBox.h,
      fill: '#ffffff',
    });
    const fitted = fitImageInBox(organiserLogo, {
      x: logoBox.x + logoPad,
      y: logoBox.y + logoPad,
      w: logoBox.w - logoPad * 2,
      h: logoBox.h - logoPad * 2,
    });
    contentItems.push({
      type: 'image',
      name: 'OrgLogo',
      x: fitted.x,
      y: fitted.y,
      w: fitted.w,
      h: fitted.h,
    });
    contentItems.push({
      x: logoBox.x + logoBox.w + 14,
      y: cardTop - 28,
      size: 9,
      font: 'F2',
      color: '#e8dbea',
      text: 'EVENT TICKET',
    });
    contentItems.push({
      x: logoBox.x + logoBox.w + 14,
      y: cardTop - 48,
      size: 16,
      font: 'F2',
      color: '#ffffff',
      text: truncateToWidth(context.organiserName || 'Event organiser', 16, cardW - 160),
    });
  } else {
    contentItems.push({
      x: cardX + 22,
      y: cardTop - 26,
      size: 9,
      font: 'F2',
      color: '#e8dbea',
      text: 'THE NETWORKER UK',
    });
    contentItems.push({
      x: cardX + 22,
      y: cardTop - 46,
      size: 18,
      font: 'F2',
      color: '#ffffff',
      text: 'Event ticket',
    });
  }

  const refBlockH = 44;
  let cursorY = cardTop - headerH - 20;
  contentItems.push({
    type: 'rect',
    x: cardX + 18,
    y: cursorY - 30,
    w: cardW - 36,
    h: 36,
    fill: accentSoft,
  });
  contentItems.push({
    x: cardX + 28,
    y: cursorY - 6,
    size: 8,
    font: 'F2',
    color: textSoft,
    text: 'BOOKING REFERENCE',
  });
  contentItems.push({
    x: cardX + 28,
    y: cursorY - 22,
    size: 16,
    font: 'F2',
    color: accent,
    text: String(context.bookingReference || ''),
  });
  contentItems.push({
    x: cardX + cardW - 28 - approxPaidWidth(context.amountPaid),
    y: cursorY - 18,
    size: 12,
    font: 'F2',
    color: coral,
    text: String(context.amountPaid || ''),
  });

  cursorY -= refBlockH + 10;
  eventLines.forEach((line, index) => {
    contentItems.push({
      x: cardX + contentPad,
      y: cursorY - index * 20,
      size: 16,
      font: 'F2',
      color: textDark,
      text: line,
    });
  });
  cursorY -= eventLines.length * 20 + 4;
  // Keep organiser line when logo is absent; with logo the header already names them.
  if (!organiserLogo) {
    contentItems.push({
      x: cardX + contentPad,
      y: cursorY,
      size: 10,
      font: 'F1',
      color: textMid,
      text: organiserLine,
    });
    cursorY -= 16;
  } else {
    cursorY -= 8;
  }

  contentItems.push({
    type: 'line',
    x1: cardX + contentPad,
    y1: cursorY,
    x2: cardX + cardW - contentPad,
    y2: cursorY,
    stroke: border,
    lineWidth: 1,
  });

  cursorY -= 18;
  contentItems.push({
    x: cardX + contentPad,
    y: cursorY,
    size: 8,
    font: 'F2',
    color: textSoft,
    text: 'WHEN',
  });
  contentItems.push({
    x: cardX + contentPad + colW + colGap,
    y: cursorY,
    size: 8,
    font: 'F2',
    color: textSoft,
    text: 'WHERE',
  });
  whenLines.forEach((line, index) => {
    contentItems.push({
      x: cardX + contentPad,
      y: cursorY - 14 - index * 14,
      size: 11,
      font: 'F1',
      color: textDark,
      text: line,
    });
  });
  whereLines.forEach((line, index) => {
    contentItems.push({
      x: cardX + contentPad + colW + colGap,
      y: cursorY - 14 - index * 14,
      size: 11,
      font: 'F1',
      color: textDark,
      text: line,
    });
  });

  cursorY -= 14 + Math.max(whenLines.length, whereLines.length) * 14 + 12;
  contentItems.push({
    type: 'line',
    x1: cardX + contentPad,
    y1: cursorY,
    x2: cardX + cardW - contentPad,
    y2: cursorY,
    stroke: border,
    lineWidth: 1,
  });

  cursorY -= 18;
  contentItems.push({
    x: cardX + contentPad,
    y: cursorY,
    size: 8,
    font: 'F2',
    color: textSoft,
    text: 'ATTENDEE',
  });
  contentItems.push({
    x: cardX + contentPad + colW + colGap,
    y: cursorY,
    size: 8,
    font: 'F2',
    color: textSoft,
    text: 'TICKETS',
  });
  contentItems.push({
    x: cardX + contentPad,
    y: cursorY - 14,
    size: 11,
    font: 'F2',
    color: textDark,
    text: truncateToWidth(attendeeName, 11, colW),
  });
  let attendeeExtra = 0;
  if (attendeeEmail) {
    attendeeExtra = 1;
    contentItems.push({
      x: cardX + contentPad,
      y: cursorY - 28,
      size: 9,
      font: 'F1',
      color: textMid,
      text: attendeeEmail,
    });
  }
  ticketLines.forEach((line, index) => {
    contentItems.push({
      x: cardX + contentPad + colW + colGap,
      y: cursorY - 14 - index * 14,
      size: 11,
      font: 'F2',
      color: textDark,
      text: line,
    });
  });
  contentItems.push({
    x: cardX + contentPad + colW + colGap,
    y: cursorY - 14 - ticketLines.length * 14,
    size: 9,
    font: 'F1',
    color: textMid,
    text: 'Total paid: ' + String(context.amountPaid || 'Free'),
  });

  cursorY -= 14 + Math.max(1 + attendeeExtra, ticketLines.length + 1) * 14 + 14;

  const footerTop = cursorY;
  const hubLogoBoxH = hubLogo ? 28 : 0;
  const footerH =
    16 +
    instructionLines.length * 13 +
    hubLogoBoxH +
    (context.bookedAt ? 16 : 8) +
    12;
  const footerBottom = footerTop - footerH;
  const cardY = footerBottom - 18;
  const cardH = cardTop - cardY;

  contentItems.push({
    type: 'rect',
    x: cardX + 18,
    y: footerBottom,
    w: cardW - 36,
    h: footerH,
    fill: accentSoft,
  });
  instructionLines.forEach((line, index) => {
    contentItems.push({
      x: cardX + 28,
      y: footerTop - 14 - index * 13,
      size: 10,
      font: 'F1',
      color: textDark,
      text: line,
    });
  });

  let issuerY = footerTop - 14 - instructionLines.length * 13 - 10;
  if (hubLogo) {
    images.push({
      name: 'HubLogo',
      jpeg: hubLogo.jpeg,
      width: hubLogo.width,
      height: hubLogo.height,
    });
    const fittedHub = fitImageInBox(hubLogo, {
      x: cardX + 28,
      y: issuerY - 22,
      w: 92,
      h: 24,
    });
    contentItems.push({
      type: 'image',
      name: 'HubLogo',
      x: fittedHub.x,
      y: fittedHub.y,
      w: fittedHub.w,
      h: fittedHub.h,
    });
    contentItems.push({
      x: cardX + 28 + 100,
      y: issuerY - 8,
      size: 8,
      font: 'F1',
      color: textSoft,
      text: 'Issued via The Networker UK',
    });
    issuerY -= 28;
  } else {
    contentItems.push({
      x: cardX + 28,
      y: issuerY - 4,
      size: 8,
      font: 'F1',
      color: textSoft,
      text: 'Issued via The Networker UK',
    });
    issuerY -= 16;
  }

  if (context.bookedAt) {
    contentItems.push({
      x: cardX + 28,
      y: footerBottom + 10,
      size: 8,
      font: 'F1',
      color: textSoft,
      text: 'Booked ' + context.bookedAt,
    });
  }

  const pageChrome = [
    { type: 'rect', x: 0, y: 0, w: pageW, h: pageH, fill: '#f0ecf7' },
    {
      type: 'rect',
      x: cardX,
      y: cardY,
      w: cardW,
      h: cardH,
      fill: '#ffffff',
      stroke: border,
      lineWidth: 1,
    },
  ];
  const footerNotes = [];
  if (context.eventUrl) {
    footerNotes.push({
      x: cardX,
      y: cardY - 22,
      size: 8,
      font: 'F1',
      color: textSoft,
      text: truncateToWidth(context.eventUrl, 8, cardW),
    });
  }

  return buildPositionedPdf([
    {
      width: pageW,
      height: pageH,
      images,
      items: pageChrome.concat(contentItems, footerNotes),
    },
  ]);
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
            ' — The Networker UK</td><td>' +
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
    ' · The Networker UK<br>Bill to: ' +
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
    '<p class="note">Ticket supply is from the event organiser. The booking fee is charged by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94). Ticket VAT treatment is the organiser&rsquo;s responsibility. Use this document for expense claims; print or save the PDF for your accounts team.</p>' +
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
