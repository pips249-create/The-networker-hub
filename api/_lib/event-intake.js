/**
 * Submit event details from /add-your-event — store + email staff.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendViaResend, sendTemplatedEmail } = require('./send-template-email');
const { supportEmail, emailSiteBase } = require('./hub-email-urls');

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

function normalizeAttendanceDoor(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'category_exclusivity' || value === 'application' || /exclusiv|approv|ce\b/.test(value)) {
    return 'category_exclusivity';
  }
  return 'general';
}

function normalizePayHow(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'both' || value === 'tickets_and_membership') return 'both';
  if (value === 'membership' || value === 'monthly' || value === 'annual') return 'membership';
  if (value === 'paid_tickets' || value === 'paid' || value === 'tickets') return 'paid_tickets';
  if (value === 'free_tickets' || value === 'free') return 'free_tickets';
  // Legacy Free/Paid radios
  if (/paid|ticket/.test(value) && !/free/.test(value)) return 'paid_tickets';
  return 'free_tickets';
}

function pricingFromPayHow(payHow) {
  if (payHow === 'paid_tickets' || payHow === 'both') return 'Paid';
  if (payHow === 'membership') return 'Membership';
  return 'Free';
}

function attendanceDoorLabel(door) {
  return door === 'category_exclusivity' ? 'Application based' : 'General ticketing';
}

function normalizeMaxPlaces(raw) {
  const digits = String(raw == null ? '' : raw).trim();
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > 100000) return null;
  return n;
}

function payHowLabel(payHow) {
  if (payHow === 'both') return 'Tickets + membership';
  if (payHow === 'membership') return 'Membership';
  if (payHow === 'paid_tickets') return 'Paid tickets';
  return 'Free tickets';
}

function normalizeIntakeInput(body) {
  body = body || {};
  const formatRaw = String(body.format || body.meeting_type || '').trim();
  const format = /online|virtual|zoom|teams/i.test(formatRaw) ? 'Online' : 'In person';
  const attendanceDoor = normalizeAttendanceDoor(
    body.attendanceDoor || body.attendance_door || body.door || body.mode
  );
  const payHow = normalizePayHow(
    body.payHow || body.pay_how || body.pricing || body.ticket_type || 'free_tickets'
  );
  const trialRaw = String(body.freeTrialVisits || body.free_trial_visits || '').trim().toLowerCase();
  const freeTrialVisits = trialRaw === 'yes' || trialRaw === 'true' || trialRaw === '1' ? 'yes' : 'no';
  const maxPlacesRaw = String(body.maxPlaces || body.max_places || body.capacity || '').trim();

  return {
    contactName: String(body.name || body.contactName || body.contact_name || '').trim(),
    email: normalizeEmail(body.email),
    phone: normalizePhone(body.phone || body.telephone || body.mobile || body.tel),
    organiserWebsiteUrl: String(
      body.organiserWebsiteUrl ||
        body.organiser_website_url ||
        body.organiser_website ||
        body.organiserUrl ||
        body.organizerWebsiteUrl ||
        body.websiteUrl ||
        ''
    )
      .trim() || null,
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
    attendanceDoor,
    payHow,
    maxPlaces: normalizeMaxPlaces(maxPlacesRaw),
    maxPlacesRaw,
    pricing: pricingFromPayHow(payHow),
    freeTrialVisits,
    freeTrialDetails:
      freeTrialVisits === 'yes'
        ? String(body.freeTrialDetails || body.free_trial_details || '').trim() || null
        : null,
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
  if (input.phone && !isValidPhone(input.phone)) {
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
  if (input.organiserWebsiteUrl) {
    try {
      const url = new URL(input.organiserWebsiteUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          ok: false,
          error: 'invalid_organiser_website_url',
          message: 'Enter a valid organiser website URL (https://…).',
        };
      }
    } catch {
      return {
        ok: false,
        error: 'invalid_organiser_website_url',
        message: 'Enter a valid organiser website URL (https://…).',
      };
    }
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
  const needsDetails =
    input.payHow === 'paid_tickets' || input.payHow === 'membership' || input.payHow === 'both';
  if (needsDetails && !input.ticketDetails) {
    return {
      ok: false,
      error: 'missing_tickets',
      message: 'Add ticket and/or membership details (prices or membership term).',
    };
  }
  if (input.maxPlacesRaw && input.maxPlaces == null) {
    return {
      ok: false,
      error: 'invalid_max_places',
      message: 'Enter a whole number for max places, or leave it blank.',
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
    row('Organiser website', input.organiserWebsiteUrl) +
    row('How people get in', attendanceDoorLabel(input.attendanceDoor)) +
    row('Pay / access', payHowLabel(input.payHow)) +
    row('Max places', input.maxPlaces) +
    row('Free trial visits', input.freeTrialVisits === 'yes' ? 'Yes' : 'No') +
    row('Trial details', input.freeTrialDetails) +
    row('Ticket / membership details', input.ticketDetails) +
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

function locationLineFromInput(input) {
  if (String(input.format || '').toLowerCase() === 'online') {
    return 'Online';
  }
  const parts = [input.venue, input.city, input.postcode]
    .map(function (v) {
      return String(v || '').trim();
    })
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'To be confirmed';
}

function confirmationVariables(input) {
  const site = emailSiteBase(process.env.SITE_URL);
  return {
    contact_name: String(input.contactName || '').trim() || 'there',
    event_title: String(input.eventTitle || '').trim() || 'your event',
    group_name: String(input.groupName || '').trim() || 'Your group',
    event_dates: String(input.eventDates || '').trim() || 'Date to be confirmed',
    location_line: locationLineFromInput(input),
    events_url: site + '/events/',
  };
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
    organiser_website_url: input.organiserWebsiteUrl,
    venue: input.venue,
    address_line1: input.addressLine1,
    city: input.city,
    postcode: input.postcode,
    meeting_link: input.meetingLink,
    attendance_door: input.attendanceDoor,
    pay_how: input.payHow,
    max_places: input.maxPlaces,
    free_trial_visits: input.freeTrialVisits,
    free_trial_details: input.freeTrialDetails,
    pricing: input.pricing,
    ticket_details: input.ticketDetails,
    description: input.description,
    photo_url: input.photoUrl,
    notes: input.notes,
    status: 'open',
    source: 'add_your_event',
  };

  let { data, error } = await sb
    .from('event_intake_submissions')
    .insert(insertPayload)
    .select('id, created_at')
    .single();

  if (error && /max_places/i.test(error.message || '')) {
    const fallback = Object.assign({}, insertPayload);
    delete fallback.max_places;
    if (input.maxPlaces) {
      fallback.ticket_details = ['Max places: ' + input.maxPlaces, fallback.ticket_details]
        .filter(Boolean)
        .join('\n');
    }
    const retry = await sb
      .from('event_intake_submissions')
      .insert(fallback)
      .select('id, created_at')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (/event_intake_submissions/i.test(error.message || '')) {
      const err = new Error(
        'Event intake is not configured yet — email hi@thenetworkeruk.com with your event details.'
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
    await sendTemplatedEmail({
      slug: 'event_intake_received',
      to: input.email,
      variables: confirmationVariables(input),
      replyTo: to,
      skipEmailCheck: true,
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
