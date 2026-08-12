/**
 * Submit event details from /add-your-event — store + email staff.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendViaResend } = require('./send-template-email');
const { supportEmail } = require('./hub-email-urls');

function staffInbox() {
  const configured = String(process.env.EVENT_INTAKE_EMAIL || '').trim();
  if (configured) return configured.toLowerCase();
  return supportEmail();
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function isValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return (
    '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">' +
    escHtml(label) +
    '</td><td style="padding:4px 0;vertical-align:top;">' +
    escHtml(v).replace(/\n/g, '<br>') +
    '</td></tr>'
  );
}

function normalizeIntakeInput(body) {
  body = body || {};
  const formatRaw = String(body.format || body.meeting_type || '').trim();
  const format = /online|virtual|zoom|teams/i.test(formatRaw) ? 'Online' : 'In person';
  const pricingRaw = String(body.pricing || body.ticket_type || '').trim();
  const pricing = /paid|ticket/i.test(pricingRaw) ? 'Paid' : 'Free';

  return {
    contactName: String(body.name || body.contactName || body.contact_name || '').trim(),
    email: normalizeEmail(body.email),
    phone: normalizePhone(body.phone || body.telephone || body.mobile || body.tel),
    groupName: String(body.group || body.groupName || body.group_name || body.organiser || '').trim(),
    eventTitle: String(body.title || body.eventTitle || body.event_title || '').trim(),
    eventDates: String(body.dates || body.eventDates || body.event_dates || '').trim(),
    startTime: String(body.startTime || body.start_time || '').trim() || null,
    endTime: String(body.endTime || body.end_time || '').trim() || null,
    format,
    venue: String(body.venue || '').trim() || null,
    addressLine1: String(body.address || body.addressLine1 || body.address_line1 || '').trim() || null,
    city: String(body.city || '').trim() || null,
    postcode: String(body.postcode || '').trim() || null,
    meetingLink: String(body.meetingLink || body.meeting_link || body.joinLink || '').trim() || null,
    pricing,
    ticketDetails: String(body.ticketDetails || body.ticket_details || body.tickets || '').trim() || null,
    description: String(body.description || '').trim() || null,
    photoUrl: String(body.photoUrl || body.photo_url || body.image || '').trim() || null,
    notes: String(body.notes || body.message || '').trim() || null,
    website: String(body.website || '').trim(),
  };
}

function validateIntake(input) {
  if (input.website) {
    return { ok: true, honeypot: true };
  }
  if (!input.contactName) return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  if (!isValidEmail(input.email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }
  if (!isValidPhone(input.phone)) {
    return { ok: false, error: 'invalid_phone', message: 'Enter a valid phone number.' };
  }
  if (!input.groupName) {
    return { ok: false, error: 'missing_group', message: 'Enter your group or organiser name.' };
  }
  if (!input.eventTitle) {
    return { ok: false, error: 'missing_title', message: 'Enter the event title.' };
  }
  if (!input.eventDates) {
    return { ok: false, error: 'missing_dates', message: 'Enter the event date(s).' };
  }
  if (input.format === 'In person') {
    if (!input.city && !input.venue && !input.postcode) {
      return {
        ok: false,
        error: 'missing_location',
        message: 'Add a venue, city, or postcode for in-person events.',
      };
    }
  }
  if (input.pricing === 'Paid' && !input.ticketDetails) {
    return {
      ok: false,
      error: 'missing_tickets',
      message: 'For paid events, tell us the ticket name(s), price(s), and capacity if limited.',
    };
  }
  return { ok: true };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">Event details to list</h2>' +
    '<p style="margin:0 0 16px;"><strong>' +
    escHtml(input.eventTitle) +
    '</strong> · ' +
    escHtml(input.groupName) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:560px;">' +
    row('Contact', input.contactName) +
    row('Email', input.email) +
    row('Phone', input.phone) +
    row('Group', input.groupName) +
    row('Title', input.eventTitle) +
    row('Date(s)', input.eventDates) +
    row('Start', input.startTime) +
    row('End', input.endTime) +
    row('Format', input.format) +
    row('Venue', input.venue) +
    row('Address', input.addressLine1) +
    row('City', input.city) +
    row('Postcode', input.postcode) +
    row('Join link', input.meetingLink) +
    row('Pricing', input.pricing) +
    row('Tickets', input.ticketDetails) +
    row('Photo URL', input.photoUrl) +
    '</table>' +
    (input.description
      ? '<p style="margin:16px 0 0;"><strong>Description</strong><br>' +
        escHtml(input.description).replace(/\n/g, '<br>') +
        '</p>'
      : '') +
    (input.notes
      ? '<p style="margin:16px 0 0;"><strong>Notes</strong><br>' +
        escHtml(input.notes).replace(/\n/g, '<br>') +
        '</p>'
      : '') +
    '<p style="margin:20px 0 0;color:#666;font-size:13px;">Create this in Command Centre → Fix listings → Events (or Impersonate for full tickets).</p>' +
    '</div>'
  );
}

function buildConfirmationEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;">' +
    '<p style="margin:0 0 12px;">Hi ' +
    escHtml(input.contactName) +
    ',</p>' +
    '<p style="margin:0 0 12px;">Thanks — we have your details for <strong>' +
    escHtml(input.eventTitle) +
    '</strong>.</p>' +
    '<p style="margin:0 0 12px;">Catherine or Jamie will list it on The Networker Hub and email you when it&rsquo;s live (usually within one business day).</p>' +
    '<p style="margin:0;">The Networker Hub<br><a href="https://www.thenetworkerhub.com/add-your-event">thenetworkerhub.com/add-your-event</a></p>' +
    '</div>'
  );
}

async function submitEventIntake(body) {
  const input = normalizeIntakeInput(body);
  const validation = validateIntake(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.honeypot) {
    return {
      ok: true,
      message: 'Thanks — we will list your event and email you when it is live.',
    };
  }

  const sb = getSupabaseAdmin();
  const insertPayload = {
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone,
    group_name: input.groupName,
    event_title: input.eventTitle,
    event_dates: input.eventDates,
    start_time: input.startTime,
    end_time: input.endTime,
    format: input.format,
    venue: input.venue,
    address_line1: input.addressLine1,
    city: input.city,
    postcode: input.postcode,
    meeting_link: input.meetingLink,
    pricing: input.pricing,
    ticket_details: input.ticketDetails,
    description: input.description,
    photo_url: input.photoUrl,
    notes: input.notes,
    status: 'open',
    source: 'add_your_event',
  };

  const { data, error } = await sb
    .from('event_intake_submissions')
    .insert(insertPayload)
    .select('id, created_at')
    .single();

  if (error) {
    if (/event_intake_submissions/i.test(error.message || '')) {
      const err = new Error(
        'Event intake is not configured yet — email hello@thenetworkerhub.com with your event details.'
      );
      err.code = 'not_configured';
      throw err;
    }
    throw new Error(error.message || 'Could not save event details');
  }

  const to = staffInbox();
  const subject = 'Event to list — ' + input.eventTitle + ' (' + input.groupName + ')';

  try {
    await sendViaResend({
      to,
      subject,
      html: buildStaffEmailHtml(input),
      replyTo: input.email,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[event-intake-staff-email]', e.message || e);
  }

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your event details — The Networker Hub',
      html: buildConfirmationEmailHtml(input),
      replyTo: to,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[event-intake-confirm-email]', e.message || e);
  }

  return {
    ok: true,
    id: data && data.id,
    message: 'Thanks — we will list your event and email you when it is live.',
  };
}

module.exports = {
  submitEventIntake,
  normalizeIntakeInput,
  validateIntake,
  staffInbox,
};
