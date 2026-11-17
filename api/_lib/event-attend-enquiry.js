/**
 * "I'd like to attend" — hub-mediated enquiry for Link Out / email-to-book events.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { profileEmail } = require('./supabase-organiser-profile-email');
const { publicEventSlug } = require('./event-slug');
const {
  isMailtoBookingUrl,
  normalizeExternalBookingUrl,
} = require('./connected-booking-util');
const {
  emailSiteBase,
  organiserDashboardUrl,
  browseEventsUrl,
} = require('./hub-email-urls');
const { escapeHtml } = require('./event-refund-policy');

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailFromMailtoUrl(raw) {
  const normalized = normalizeExternalBookingUrl(raw);
  if (!normalized || !isMailtoBookingUrl(normalized)) return '';
  try {
    const parsed = new URL(normalized);
    const email = decodeURIComponent(
      String(parsed.pathname || '')
        .replace(/^\/*/, '')
        .split('?')[0] ||
        String(normalized)
          .replace(/^mailto:/i, '')
          .split('?')[0] ||
        ''
    ).trim();
    return isValidEmail(email) ? normalizeEmail(email) : '';
  } catch {
    return '';
  }
}

function firstName(name) {
  const part = String(name || '')
    .trim()
    .split(/\s+/)[0];
  return part || 'there';
}

function formatEventWhen(startsAt) {
  const raw = String(startsAt || '').trim();
  if (!raw) return 'Date TBC';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Date TBC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toUTCString();
  }
}

function eventPublicUrl(row, siteUrl) {
  const slug = publicEventSlug({ slug: row.slug, title: row.title });
  const base = emailSiteBase(siteUrl);
  return slug ? base + '/events/' + encodeURIComponent(slug) : base + '/events/';
}

function resolveOrganiserInbox(eventRow, organiserRow) {
  const fromMailto = emailFromMailtoUrl(eventRow && eventRow.external_booking_url);
  if (fromMailto) return fromMailto;
  const fromProfile = normalizeEmail(profileEmail(organiserRow || {}));
  if (fromProfile) return fromProfile;
  return '';
}

function isLinkOutEmailEvent(row) {
  if (!row) return false;
  const mode = String(row.checkout_mode || '').trim();
  if (mode && mode !== 'external_link' && mode !== 'external_connected') {
    // Still allow mailto booking URLs even if mode drifted.
  }
  return Boolean(emailFromMailtoUrl(row.external_booking_url));
}

async function loadPublishedAttendEvent(eventId) {
  const id = String(eventId || '').trim();
  if (!id) {
    const err = new Error('missing_event_id');
    err.code = 'missing_event_id';
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    const err = new Error('event_not_found');
    err.code = 'event_not_found';
    throw err;
  }
  const status = String(row.status || '').toLowerCase();
  const approval = String(row.approval_status || '').trim();
  if (status !== 'published' || approval !== 'Approved') {
    const err = new Error('event_not_public');
    err.code = 'event_not_public';
    throw err;
  }
  if (!isLinkOutEmailEvent(row)) {
    const err = new Error('attend_enquiry_not_available');
    err.code = 'attend_enquiry_not_available';
    err.message = 'This event takes bookings on the organiser’s own site.';
    throw err;
  }

  let organiser = null;
  if (row.organiser_id) {
    const { data: org } = await sb
      .from('organisers')
      .select('id, name, email, contact_email, ownership_claim_status, slug')
      .eq('id', row.organiser_id)
      .maybeSingle();
    organiser = org || null;
  }

  const organiserEmail = resolveOrganiserInbox(row, organiser);
  if (!organiserEmail) {
    const err = new Error('organiser_email_missing');
    err.code = 'organiser_email_missing';
    err.message = 'We could not find an email for this organiser.';
    throw err;
  }

  return { row, organiser, organiserEmail };
}

async function submitEventAttendEnquiry(body) {
  const eventId = String(body.eventId || body.event_id || body.id || '').trim();
  const name = String(body.name || body.attendeeName || '').trim();
  const email = normalizeEmail(body.email || body.attendeeEmail);
  const message = String(body.message || body.note || '').trim();
  const website = String(body.website || body.company_url || '').trim();

  if (website) {
    return { ok: true, message: 'Thanks — we have passed your request to the organiser.' };
  }
  if (!name) {
    return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }
  if (message.length > 2000) {
    return { ok: false, error: 'message_too_long', message: 'Keep your note under 2000 characters.' };
  }

  const { row, organiser, organiserEmail } = await loadPublishedAttendEvent(eventId);
  const sb = getSupabaseAdmin();

  // Soft dedupe: same person + event within 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from('event_attend_enquiries')
    .select('id')
    .eq('event_id', row.id)
    .ilike('attendee_email', email)
    .gte('created_at', since)
    .limit(1);
  if (recent && recent.length) {
    return {
      ok: true,
      duplicate: true,
      message: 'We already sent your request for this event. The organiser has your details.',
    };
  }

  const note =
    message ||
    'Hi — I found this event on The Networker UK and would like to attend. Please let me know how to book.';

  const { data: inserted, error: insertErr } = await sb
    .from('event_attend_enquiries')
    .insert({
      event_id: row.id,
      organiser_id: row.organiser_id || null,
      organiser_email: organiserEmail,
      attendee_name: name,
      attendee_email: email,
      message: note,
      source: 'link_out_email',
    })
    .select('id')
    .maybeSingle();
  if (insertErr) throw new Error(insertErr.message);

  const siteUrl = emailSiteBase(process.env.SITE_URL);
  const eventName = String(row.title || 'your event').trim();
  const organiserName = String((organiser && organiser.name) || 'the organiser').trim();
  const claimed =
    String((organiser && organiser.ownership_claim_status) || '')
      .trim()
      .toLowerCase() === 'claimed';
  const eventUrl = eventPublicUrl(row, siteUrl);
  const eventWhen = formatEventWhen(row.starts_at);
  const replySubject = encodeURIComponent('Re: Attending ' + eventName);
  const replyBody = encodeURIComponent(
    'Hi ' + firstName(name) + ',\n\nThanks for getting in touch about "' + eventName + '".\n\n'
  );
  const replyMailto =
    'mailto:' + encodeURIComponent(email) + '?subject=' + replySubject + '&body=' + replyBody;

  const claimUrl = claimed
    ? organiserDashboardUrl(siteUrl, { eventId: row.id })
    : siteUrl +
      '/register?intent=organiser-claim&next=' +
      encodeURIComponent('/organiser/?onboard=claim');
  const claimCtaLabel = claimed ? 'Open organiser dashboard' : 'Claim your free profile';
  const claimPromptHtml = claimed
    ? 'Manage this listing and reply to guests from your organiser workspace.'
    : 'This listing was added for your group. <strong style="color:#452d5c;">Claim your free Networker UK profile</strong> to edit events, collect reviews, and reply to people like ' +
      escapeHtml(firstName(name)) +
      '.';

  const safeMessageHtml = escapeHtml(note).replace(/\r?\n/g, '<br>');

  try {
    await sendTemplatedEmail({
      slug: 'event_attend_enquiry_received',
      to: organiserEmail,
      replyTo: email,
      skipEmailCheck: true,
      variables: {
        organiser_greeting: firstName(organiserName),
        organiser_name: organiserName,
        event_name: eventName,
        event_when: eventWhen,
        event_url: eventUrl,
        attendee_name: name,
        attendee_first_name: firstName(name),
        attendee_email: email,
        enquiry_message_html: safeMessageHtml,
        reply_mailto_url: replyMailto,
        claim_url: claimUrl,
        claim_cta_label: claimCtaLabel,
        claim_prompt_html: claimPromptHtml,
      },
    });
  } catch (e) {
    console.error('[event-attend-enquiry-organiser]', e && e.message ? e.message : e);
    const err = new Error('Could not email the organiser. Please try again.');
    err.code = 'organiser_email_failed';
    throw err;
  }

  try {
    await sendTemplatedEmail({
      slug: 'event_attend_enquiry_sent',
      to: email,
      skipEmailCheck: true,
      variables: {
        attendee_name: firstName(name),
        event_name: eventName,
        event_when: eventWhen,
        event_url: eventUrl,
        events_url: browseEventsUrl(siteUrl),
        organiser_name: organiserName,
      },
    });
  } catch (e) {
    console.error('[event-attend-enquiry-attendee]', e && e.message ? e.message : e);
  }

  return {
    ok: true,
    id: inserted && inserted.id,
    message: 'Thanks — we have emailed the organiser. They will reply to you directly.',
  };
}

module.exports = {
  submitEventAttendEnquiry,
  isLinkOutEmailEvent,
  emailFromMailtoUrl,
  resolveOrganiserInbox,
};
