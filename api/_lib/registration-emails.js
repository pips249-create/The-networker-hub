const { sendTemplatedEmail } = require('./send-template-email');
const { isOnlineEvent, escapeHtml } = require('./event-refund-policy');
const { resolveBookedListing } = require('./booking-snapshot');
const {
  formatBookingReference,
  formatBookedAt,
  formatTicketQuantity,
} = require('./booking-payment-summary');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl: buildEventPublicUrl,
  organiserDashboardUrl,
  logoNavUrl,
} = require('./hub-email-urls');
const { computeEventTicketStats } = require('./organiser-registration-stats');
const { sendEventAlmostFullEmail, buildMeetingLinkEmailSection } = require('./lifecycle-emails');
const { attendeeInitial } = require('./organiser-email-sections');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');

function formatAmount(amountPaid) {
  const n = Number(amountPaid);
  if (!Number.isFinite(n) || n <= 0) return 'Free';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function buildMeetingLinkSection(link) {
  const url = String(link || '').trim();
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  return (
    '<tr><td class="mobile-pad" style="padding:0 48px 8px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:20px 24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Online event</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.6;margin:0 0 14px;">Use the link below to join when the event starts.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
    '</td></tr></table></td></tr></table></td></tr>'
  );
}

function eventPublicUrl(eventRow) {
  return buildEventPublicUrl(eventRow);
}

function buildAttendeeEmailVars({
  registration,
  eventRow,
  attendee,
  ticketName,
  organiserName,
  amountPaid,
  ticketRow,
}) {
  const registrationId = registration.id;
  const attendeeName = String(attendee?.name || '').trim() || 'there';
  const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
  const booked = resolveBookedListing({
    registration,
    eventRow,
    ticketRow: ticketRow || { name: ticketName },
  });
  const ev = booked.eventRow || eventRow || {};
  const startsAt = ev.starts_at ? new Date(ev.starts_at) : null;
  const eventDate = startsAt
    ? startsAt.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date TBC';
  const eventTime = startsAt
    ? startsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const eventLocation =
    String(ev.location_label || ev.venue || ev.city || '').trim() ||
    'See event page';
  const siteUrl = siteBase();
  const meetingLink = String(registration.meeting_link || ev.meeting_link || '').trim();
  const online = isOnlineEvent(ev, meetingLink);
  const ticketQuantity = Math.max(1, parseInt(registration.quantity, 10) || booked.quantity || 1);
  const bookedAtIso = registration.created_at || new Date().toISOString();
  const resolvedTicketName = String(ticketName || booked.ticketName || 'Ticket').trim();
  const resolvedAmountPaid =
    amountPaid != null ? amountPaid : formatAmount(registration.amount_paid);

  return {
    user_name: attendeeName,
    user_email: attendeeEmail,
    event_name: String(ev.title || eventRow?.title || 'Event').trim(),
    event_date: eventDate,
    event_time: eventTime,
    event_location: eventLocation,
    event_url: eventPublicUrl(eventRow || ev, siteUrl),
    ticket_name: resolvedTicketName,
    amount_paid: resolvedAmountPaid,
    registration_id: registrationId,
    booking_reference: formatBookingReference(registrationId),
    booked_at: formatBookedAt(bookedAtIso),
    booked_at_iso: bookedAtIso,
    ticket_quantity: ticketQuantity,
    ticket_quantity_label: formatTicketQuantity(ticketQuantity, resolvedTicketName),
    payment_status: String(registration.payment_status || '').trim(),
    hub_account_url: hubAccountUrl(siteUrl),
    hub_payment_url: hubPaymentUrl(siteUrl, registrationId),
    browse_events_url: browseEventsUrl(siteUrl),
    contact_url: contactUrl(siteUrl),
    privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
    terms_url: legalPolicyUrl(siteUrl, 'terms'),
    refunds_url: legalPolicyUrl(siteUrl, 'refunds'),
    organiser_name: organiserName || 'The organiser',
    meeting_link: online ? meetingLink : '',
    meeting_type: ev.meeting_type || eventRow?.meeting_type || (online ? 'Online' : 'In person'),
    refund_policy: booked.refundPolicy || ev.refund_policy || eventRow?.refund_policy || null,
    refund_policy_details:
      booked.refundPolicyDetails || ev.refund_policy_details || eventRow?.refund_policy_details || null,
    refund_cutoff_days:
      booked.refundCutoffDays != null
        ? booked.refundCutoffDays
        : ev.refund_cutoff_days != null
          ? ev.refund_cutoff_days
          : eventRow?.refund_cutoff_days != null
            ? eventRow.refund_cutoff_days
            : null,
    site_url: siteUrl,
    logo_url: logoNavUrl(siteUrl),
    dashboard_url: organiserDashboardUrl(siteUrl),
  };
}

async function fetchEventRegistrationStats(sb, eventId) {
  const [regsRes, ticketsRes] = await Promise.all([
    sb
      .from('registrations')
      .select('payment_status, application_status, quantity, amount_paid')
      .eq('event_id', eventId),
    sb.from('tickets').select('id, quantity').eq('event_id', eventId),
  ]);

  if (regsRes.error) throw new Error(regsRes.error.message);
  if (ticketsRes.error) throw new Error(ticketsRes.error.message);

  return computeEventTicketStats(regsRes.data, ticketsRes.data);
}

function buildOrganiserEmailVars(attendeeVars, stats) {
  const attendeeName = String(attendeeVars.user_name || '').trim() || 'Guest';
  return {
    ...attendeeVars,
    ...stats,
    attendee_name: attendeeName,
    attendee_email: String(attendeeVars.user_email || '').trim(),
    attendee_initial: attendeeInitial(attendeeName),
    booking_time: String(attendeeVars.booked_at || '').trim(),
  };
}

function organiserAttendeesDashboardUrl(siteUrl, eventId) {
  return organiserDashboardUrl(siteUrl, {
    panel: 'events-attendees',
    eventId: eventId || '',
    applications: 'pending',
  });
}

/**
 * Send booking confirmation (+ organiser alert) after a registration is created.
 * Email failures are logged but do not fail checkout.
 */
async function sendRegistrationEmails(sb, registration) {
  const registrationId = registration.id;
  const attendeeId = registration.attendee_id;
  const eventId = registration.event_id;
  const ticketId = registration.ticket_id;
  if (!registrationId || !eventId) return { skipped: true, reason: 'missing_ids' };

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days, almost_full_email_sent_at'
      )
      .eq('id', eventId)
      .maybeSingle(),
    attendeeId
      ? sb.from('attendees').select('id, email, name').eq('id', attendeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticketId
      ? sb.from('tickets').select('id, name').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { skipped: true, reason: 'event_not_found' };

  const attendee = attendeeRes.data || {};
  const attendeeEmail = String(attendee.email || '').trim().toLowerCase();

  const organiserContact = eventRow.organiser_id
    ? await resolveOrganiserNotificationEmail(sb, eventRow.organiser_id)
    : { name: '', email: '' };
  const organiserName = organiserContact.name;
  const organiserEmail = organiserContact.email;

  const ticketName = String(ticketRes.data?.name || 'Ticket').trim();
  const amountPaid = formatAmount(registration.amount_paid);

  const vars = buildAttendeeEmailVars({
    registration,
    eventRow,
    attendee,
    ticketName,
    organiserName,
    amountPaid,
    ticketRow: ticketRes.data,
  });

  const sent = { attendee: false, organiser: false, errors: [] };

  const applicationStatus = String(registration.application_status || '').trim();
  if (applicationStatus === 'Pending') {
    return { skipped: true, reason: 'pending_application' };
  }

  if (attendeeEmail && !registration.ticket_email_sent) {
    try {
      await sendTemplatedEmail({
        slug: 'booking_confirmation',
        to: attendeeEmail,
        variables: vars,
      });
      sent.attendee = true;
    } catch (e) {
      sent.errors.push({ target: 'attendee', message: e.message || String(e) });
    }
  }

  if (organiserEmail) {
    try {
      const stats = await fetchEventRegistrationStats(sb, eventId);
      const organiserVars = buildOrganiserEmailVars(vars, stats);
      organiserVars.dashboard_url = organiserAttendeesDashboardUrl(siteBase(), eventId);
      await sendTemplatedEmail({
        slug: 'organiser_new_registration',
        to: organiserEmail,
        variables: organiserVars,
      });
      sent.organiser = true;

      const remaining = parseInt(stats.tickets_remaining, 10);
      if (
        Number.isFinite(remaining) &&
        remaining > 0 &&
        remaining <= 3 &&
        !eventRow.almost_full_email_sent_at
      ) {
        try {
          await sendEventAlmostFullEmail(sb, eventRow, stats);
        } catch (almostFullErr) {
          sent.errors.push({
            target: 'organiser_almost_full',
            message: almostFullErr.message || String(almostFullErr),
          });
        }
      }
    } catch (e) {
      sent.errors.push({ target: 'organiser', message: e.message || String(e) });
    }
  } else {
    sent.errors.push({ target: 'organiser', message: 'organiser_email_missing' });
  }

  if (sent.attendee) {
    await sb
      .from('registrations')
      .update({ ticket_email_sent: true })
      .eq('id', registrationId);
  }

  return sent;
}

/**
 * Send application-received (attendee) and new-application (organiser) emails.
 */
async function sendApplicationEmails(sb, registration) {
  const registrationId = registration.id;
  const attendeeId = registration.attendee_id;
  const eventId = registration.event_id;
  const ticketId = registration.ticket_id;
  if (!registrationId || !eventId) return { skipped: true, reason: 'missing_ids' };
  if (String(registration.application_status || '').trim() !== 'Pending') {
    return { skipped: true, reason: 'not_pending_application' };
  }

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days, almost_full_email_sent_at'
      )
      .eq('id', eventId)
      .maybeSingle(),
    attendeeId
      ? sb.from('attendees').select('id, email, name').eq('id', attendeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticketId
      ? sb.from('tickets').select('id, name, price').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { skipped: true, reason: 'event_not_found' };

  const attendee = attendeeRes.data || {};
  const attendeeEmail = String(attendee.email || '').trim().toLowerCase();

  const organiserContact = eventRow.organiser_id
    ? await resolveOrganiserNotificationEmail(sb, eventRow.organiser_id)
    : { name: '', email: '' };
  const organiserName = organiserContact.name;
  const organiserEmail = organiserContact.email;

  const ticketName = String(ticketRes.data?.name || 'Application').trim();
  const ticketPrice = ticketRes.data?.price != null ? Number(ticketRes.data.price) : 0;
  const priceIfApproved = formatAmount(ticketPrice);

  const vars = buildAttendeeEmailVars({
    registration,
    eventRow,
    attendee,
    ticketName,
    organiserName,
    amountPaid: priceIfApproved,
    ticketRow: ticketRes.data,
  });

  vars.screening_industry = String(registration.screening_answer_industry || '').trim();
  vars.screening_job_title = String(registration.screening_answer_job_title || '').trim();
  vars.price_if_approved = priceIfApproved;
  vars.application_status = 'Pending';
  vars.attendee_initial = attendeeInitial(String(attendee.name || vars.user_name || '').trim() || 'Guest');

  const sent = { attendee: false, organiser: false, errors: [] };

  if (attendeeEmail) {
    try {
      await sendTemplatedEmail({
        slug: 'application_received',
        to: attendeeEmail,
        variables: vars,
      });
      sent.attendee = true;
    } catch (e) {
      sent.errors.push({ target: 'attendee', message: e.message || String(e) });
    }
  }

  if (organiserEmail) {
    try {
      const stats = await fetchEventRegistrationStats(sb, eventId);
      const organiserVars = buildOrganiserEmailVars(vars, stats);
      organiserVars.screening_industry = vars.screening_industry;
      organiserVars.screening_job_title = vars.screening_job_title;
      organiserVars.price_if_approved = priceIfApproved;
      organiserVars.pending_applications = stats.pending_applications || '0';
      organiserVars.dashboard_url = organiserAttendeesDashboardUrl(siteBase(), eventId);
      await sendTemplatedEmail({
        slug: 'organiser_new_application',
        to: organiserEmail,
        variables: organiserVars,
      });
      sent.organiser = true;
    } catch (e) {
      sent.errors.push({ target: 'organiser', message: e.message || String(e) });
    }
  } else {
    sent.errors.push({ target: 'organiser', message: 'organiser_email_missing' });
  }

  return sent;
}

async function sendOrganiserApplicationAlertEmail(sb, registration, options = {}) {
  const registrationId = registration.id;
  const eventId = registration.event_id;
  const ticketId = registration.ticket_id;
  const attendeeId = registration.attendee_id;
  if (!registrationId || !eventId) return { skipped: true, reason: 'missing_ids' };
  if (String(registration.application_status || '').trim() !== 'Pending') {
    return { skipped: true, reason: 'not_pending_application' };
  }

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days, almost_full_email_sent_at'
      )
      .eq('id', eventId)
      .maybeSingle(),
    attendeeId
      ? sb.from('attendees').select('id, email, name').eq('id', attendeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticketId
      ? sb.from('tickets').select('id, name, price').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { skipped: true, reason: 'event_not_found' };

  const attendee = attendeeRes.data || {};
  const organiserContact = eventRow.organiser_id
    ? await resolveOrganiserNotificationEmail(sb, eventRow.organiser_id, options)
    : { name: '', email: '' };
  if (!organiserContact.email) {
    const err = new Error('organiser_email_missing');
    err.code = 'organiser_email_missing';
    throw err;
  }

  const ticketName = String(ticketRes.data?.name || 'Application').trim();
  const priceIfApproved = formatAmount(ticketRes.data?.price != null ? Number(ticketRes.data.price) : 0);
  const vars = buildAttendeeEmailVars({
    registration,
    eventRow,
    attendee,
    ticketName,
    organiserName: organiserContact.name,
    amountPaid: priceIfApproved,
    ticketRow: ticketRes.data,
  });
  vars.screening_industry = String(registration.screening_answer_industry || '').trim();
  vars.screening_job_title = String(registration.screening_answer_job_title || '').trim();
  vars.price_if_approved = priceIfApproved;

  const stats = await fetchEventRegistrationStats(sb, eventId);
  const organiserVars = buildOrganiserEmailVars(vars, stats);
  organiserVars.screening_industry = vars.screening_industry;
  organiserVars.screening_job_title = vars.screening_job_title;
  organiserVars.price_if_approved = priceIfApproved;
  organiserVars.pending_applications = stats.pending_applications || '0';
  organiserVars.dashboard_url = organiserAttendeesDashboardUrl(siteBase(), eventId);

  await sendTemplatedEmail({
    slug: 'organiser_new_application',
    to: organiserContact.email,
    variables: organiserVars,
  });

  return { organiser: true, to: organiserContact.email };
}

function buildDenialReasonBlock(reason) {
  const text = String(reason || '').trim();
  if (!text) return '';
  const safe = escapeHtml(text).replace(/\r?\n/g, '<br>');
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;">' +
    '<tr><td style="padding:16px 18px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;text-align:left;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Message from the organiser</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#475569;margin:0;">' +
    safe +
    '</p></td></tr></table>'
  );
}

function buildDenialEmailVars(registration) {
  const reason = String(registration.application_denial_reason || '').trim();
  if (reason) {
    return {
      denial_closing: '',
      denial_reason_block: buildDenialReasonBlock(reason),
    };
  }
  return {
    denial_closing: ' On this occasion the organiser is unable to offer you a place.',
    denial_reason_block: '',
  };
}

/**
 * Email attendee when an organiser approves (paid) or denies a Category Exclusivity application.
 */
async function sendApplicationDecisionEmails(sb, registration, { decision, ticketPrice } = {}) {
  const registrationId = registration.id;
  const attendeeId = registration.attendee_id;
  const eventId = registration.event_id;
  const ticketId = registration.ticket_id;
  if (!registrationId || !eventId) return { skipped: true, reason: 'missing_ids' };

  const outcome = String(decision || '').trim().toLowerCase();
  if (outcome !== 'approved' && outcome !== 'denied') {
    return { skipped: true, reason: 'invalid_decision' };
  }

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days, almost_full_email_sent_at'
      )
      .eq('id', eventId)
      .maybeSingle(),
    attendeeId
      ? sb.from('attendees').select('id, email, name').eq('id', attendeeId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    ticketId
      ? sb.from('tickets').select('id, name, price').eq('id', ticketId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { skipped: true, reason: 'event_not_found' };

  const attendee = attendeeRes.data || {};
  const attendeeEmail = String(attendee.email || '').trim().toLowerCase();
  if (!attendeeEmail) return { skipped: true, reason: 'missing_attendee_email' };

  let organiserName = '';
  if (eventRow.organiser_id) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name')
      .eq('id', eventRow.organiser_id)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiserName = String(orgRes.data?.name || '').trim();
  }

  const ticketName = String(ticketRes.data?.name || 'Ticket').trim();
  const priceNum =
    ticketPrice != null ? Number(ticketPrice) : Number(ticketRes.data?.price) || 0;
  const priceIfApproved = formatAmount(priceNum);

  const vars = buildAttendeeEmailVars({
    registration,
    eventRow,
    attendee,
    ticketName,
    organiserName,
    amountPaid: priceIfApproved,
    ticketRow: ticketRes.data,
  });
  vars.price_if_approved = priceIfApproved;
  if (outcome === 'denied') {
    Object.assign(vars, buildDenialEmailVars(registration));
  }

  const slug = outcome === 'approved' ? 'application_approved' : 'application_denied';
  const subject =
    outcome === 'approved'
      ? "You're approved — complete your booking for " + vars.event_name
      : 'Update on your application for ' + vars.event_name;

  await sendTemplatedEmail({
    slug,
    to: attendeeEmail,
    variables: vars,
    subject,
  });

  return { attendee: true, decision: outcome };
}

/**
 * When an organiser adds a join link for the first time, email existing ticket holders.
 */
async function sendMeetingLinkAddedEmails(sb, eventId, { previousLink, newLink } = {}) {
  const prev = String(previousLink || '').trim();
  const next = String(newLink || '').trim();
  if (prev || !next || !eventId) {
    return { sent: 0, skipped: true, reason: 'not_first_link' };
  }

  const { data: registrations, error: regsError } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at'
    )
    .eq('event_id', eventId)
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);

  if (regsError) throw new Error(regsError.message);
  const rows = registrations || [];
  if (!rows.length) return { sent: 0, skipped: true, reason: 'no_registrations' };

  const [eventRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days, almost_full_email_sent_at'
      )
      .eq('id', eventId)
      .maybeSingle(),
    sb.from('tickets').select('id, name').eq('event_id', eventId),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);
  const eventRow = eventRes.data;
  if (!eventRow) return { sent: 0, skipped: true, reason: 'event_not_found' };

  const ticketsById = new Map((ticketRes.data || []).map((t) => [t.id, t]));

  let organiserName = '';
  if (eventRow.organiser_id) {
    const orgRes = await sb
      .from('organisers')
      .select('id, name')
      .eq('id', eventRow.organiser_id)
      .maybeSingle();
    if (orgRes.error) throw new Error(orgRes.error.message);
    organiserName = String(orgRes.data?.name || '').trim();
  }

  await sb.from('registrations').update({ meeting_link: next }).eq('event_id', eventId);

  const result = { sent: 0, skipped: 0, errors: [] };
  const eventName = String(eventRow.title || 'your event').trim();

  for (const registration of rows) {
    let attendee = null;
    if (registration.attendee_id) {
      const attendeeRes = await sb
        .from('attendees')
        .select('id, email, name')
        .eq('id', registration.attendee_id)
        .maybeSingle();
      if (attendeeRes.error) throw new Error(attendeeRes.error.message);
      attendee = attendeeRes.data;
    }

    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    const ticketName = String(ticketsById.get(registration.ticket_id)?.name || 'Ticket').trim();
    const vars = buildAttendeeEmailVars({
      registration,
      eventRow,
      attendee,
      ticketName,
      organiserName,
      amountPaid: formatAmount(registration.amount_paid),
      ticketRow: ticketsById.get(registration.ticket_id) || null,
    });
    vars.meeting_link_section = buildMeetingLinkEmailSection(next);

    try {
      await sendTemplatedEmail({
        slug: 'meeting_link_added',
        to: attendeeEmail,
        variables: vars,
        subject: 'Join link for ' + eventName,
      });
      result.sent += 1;
    } catch (e) {
      result.errors.push({
        registrationId: registration.id,
        message: e.message || String(e),
      });
    }
  }

  return result;
}

function formatSeriesBundleDateLine(startsAt) {
  if (!startsAt) return '';
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

/**
 * One attendee confirmation listing every date in a series bundle checkout.
 */
async function sendSeriesBundleConfirmation(sb, { primaryRegistration, bundleRegistrations }) {
  const primary = primaryRegistration;
  if (!primary?.id || !primary.event_id) return { skipped: true, reason: 'missing_primary' };

  const registrationIds = (bundleRegistrations || []).map((row) => row.id).filter(Boolean);
  const eventIds = [...new Set((bundleRegistrations || []).map((row) => row.event_id).filter(Boolean))];
  if (!eventIds.length) return { skipped: true, reason: 'missing_events' };

  const [eventRes, attendeeRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select(
        'id, title, slug, starts_at, ends_at, city, venue, location_label, organiser_id, meeting_link, meeting_type, postcode, refund_policy, refund_policy_details, refund_cutoff_days'
      )
      .in('id', eventIds),
    primary.attendee_id
      ? sb.from('attendees').select('id, email, name').eq('id', primary.attendee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    primary.ticket_id
      ? sb.from('tickets').select('id, name').eq('id', primary.ticket_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventRes.error) throw new Error(eventRes.error.message);

  const eventsById = new Map((eventRes.data || []).map((row) => [row.id, row]));
  const sortedEvents = eventIds
    .map((id) => eventsById.get(id))
    .filter(Boolean)
    .sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));

  const dateLines = sortedEvents.map((row) => formatSeriesBundleDateLine(row.starts_at)).filter(Boolean);
  let eventDate = dateLines.join(', ');
  if (dateLines.length > 1) {
    const last = dateLines.pop();
    eventDate = dateLines.join(', ') + ' & ' + last;
  }

  const anchorEvent = eventsById.get(primary.event_id) || sortedEvents[0];
  const attendee = attendeeRes.data || {};
  const attendeeEmail = String(attendee.email || '').trim().toLowerCase();
  const organiserContact = anchorEvent?.organiser_id
    ? await resolveOrganiserNotificationEmail(sb, anchorEvent.organiser_id)
    : { name: '', email: '' };

  const vars = buildAttendeeEmailVars({
    registration: primary,
    eventRow: anchorEvent,
    attendee,
    ticketName: String(ticketRes.data?.name || 'Ticket').trim(),
    organiserName: organiserContact.name,
    amountPaid: formatAmount(primary.amount_paid),
    ticketRow: ticketRes.data,
  });
  vars.event_date = eventDate || vars.event_date;
  vars.ticket_quantity = registrationIds.length;
  vars.ticket_quantity_label = formatTicketQuantity(registrationIds.length, vars.ticket_name);

  const sent = { attendee: false, organiser: false, errors: [] };

  if (attendeeEmail && !primary.ticket_email_sent) {
    try {
      await sendTemplatedEmail({
        slug: 'booking_confirmation',
        to: attendeeEmail,
        variables: vars,
      });
      await sb
        .from('registrations')
        .update({ ticket_email_sent: true })
        .eq('id', primary.id);
      sent.attendee = true;
    } catch (e) {
      sent.errors.push({ target: 'attendee', message: e.message || String(e) });
    }
  }

  if (organiserContact.email) {
    for (const reg of bundleRegistrations || []) {
      const eventRow = eventsById.get(reg.event_id);
      if (!eventRow) continue;
      try {
        const stats = await fetchEventRegistrationStats(sb, reg.event_id);
        const organiserVars = buildOrganiserEmailVars(
          buildAttendeeEmailVars({
            registration: reg,
            eventRow,
            attendee,
            ticketName: String(ticketRes.data?.name || 'Ticket').trim(),
            organiserName: organiserContact.name,
            amountPaid: formatAmount(reg.amount_paid),
            ticketRow: ticketRes.data,
          }),
          stats
        );
        organiserVars.dashboard_url = organiserAttendeesDashboardUrl(siteBase(), reg.event_id);
        await sendTemplatedEmail({
          slug: 'organiser_new_registration',
          to: organiserContact.email,
          variables: organiserVars,
        });
        sent.organiser = true;
      } catch (e) {
        sent.errors.push({ target: 'organiser', eventId: reg.event_id, message: e.message || String(e) });
      }
    }
  }

  return sent;
}

module.exports = {
  sendRegistrationEmails,
  sendSeriesBundleConfirmation,
  sendApplicationEmails,
  sendOrganiserApplicationAlertEmail,
  sendApplicationDecisionEmails,
  sendMeetingLinkAddedEmails,
  buildAttendeeEmailVars,
  buildOrganiserEmailVars,
  buildDenialEmailVars,
  fetchEventRegistrationStats,
  formatAmount,
  eventPublicUrl,
  buildMeetingLinkSection,
  isOnlineEvent,
};
