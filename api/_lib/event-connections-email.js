/**
 * Event-level connections email — send each confirmed attendee a list of
 * who else attended the same event (name, company, job title, email).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { publicSiteBase, unsubscribeUrl, logoNavUrl, logoFooterUrl } = require('./hub-email-urls');
const { formatDateOnly } = require('./event-timezone');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');

const SLUG = 'event_connections_list';
const MAX_ATTENDEES = 200;
const MAX_NOTE = 800;
const MAX_SUBJECT = 90;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clampText(value, max) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isEligibleRegistration(row) {
  if (row.cancelled_at) return false;
  const applicationStatus = String(row.application_status || 'Approved').trim();
  if (applicationStatus === 'Pending' || applicationStatus === 'Denied') return false;
  const paymentStatus = String(row.payment_status || '').trim();
  if (paymentStatus === 'Refunded') return false;
  const ticket = row.tickets || {};
  const ticketPrice =
    ticket.price != null && ticket.price !== ''
      ? Number(String(ticket.price).replace(/[£,\s]/g, ''))
      : 0;
  const needsPayment =
    applicationStatus === 'Approved' &&
    paymentStatus === 'Pending' &&
    Number.isFinite(ticketPrice) &&
    ticketPrice > 0;
  if (needsPayment) return false;
  return true;
}

function mapAttendeeRow(row) {
  const attendee = row.attendees || {};
  const email = normalizeEmail(attendee.email);
  const name =
    String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Attendee');
  const guestNames = Array.isArray(row.guest_names)
    ? row.guest_names.map((n) => String(n || '').trim()).filter(Boolean)
    : [];
  return {
    registrationId: row.id,
    email,
    name,
    company: String(attendee.company || '').trim(),
    jobTitle: String(attendee.job_title || '').trim(),
    guestNames,
  };
}

async function assertEventOwned(sb, session, eventId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.role) {
    const err = new Error('not_authenticated');
    err.status = 401;
    err.code = 'not_authenticated';
    throw err;
  }
  const groupIds = access.groupIds || [];

  let result = await sb
    .from('events')
    .select(
      'id, title, starts_at, ends_at, organiser_id, connections_email_sent_at, connections_email_sent_count, organisers ( id, name, contact_email, email, slug )'
    )
    .eq('id', eventId)
    .maybeSingle();
  if (
    result.error &&
    /connections_email_sent|column/.test(String(result.error.message || ''))
  ) {
    result = await sb
      .from('events')
      .select(
        'id, title, starts_at, ends_at, organiser_id, organisers ( id, name, contact_email, email, slug )'
      )
      .eq('id', eventId)
      .maybeSingle();
  }
  if (result.error) throw new Error(result.error.message);
  const row = result.data;
  if (!row) {
    const err = new Error('Event not found');
    err.status = 404;
    err.code = 'event_not_found';
    throw err;
  }
  if (!groupIds.includes(row.organiser_id)) {
    const err = new Error('Event not found');
    err.status = 403;
    err.code = 'event_not_owned';
    throw err;
  }
  return row;
}

async function loadEligibleAttendees(sb, eventId) {
  const baseSelect = `
    id,
    cancelled_at,
    application_status,
    payment_status,
    guest_names,
    attendees ( name, email, company, job_title ),
    tickets ( price )
  `;

  async function fetch(profileMode) {
    let select = baseSelect;
    if (profileMode === 'basic') {
      select = select.replace(
        'attendees ( name, email, company, job_title )',
        'attendees ( name, email )'
      );
    } else if (profileMode === 'legacy') {
      select = select.replace(
        'attendees ( name, email, company, job_title )',
        'attendees ( name, email, company )'
      );
    }
    return sb.from('registrations').select(select).eq('event_id', eventId).is('cancelled_at', null);
  }

  let result = await fetch('full');
  if (result.error && /job_title|column/.test(String(result.error.message || ''))) {
    result = await fetch('legacy');
  }
  if (
    result.error &&
    /company|job_title|column/.test(String(result.error.message || ''))
  ) {
    result = await fetch('basic');
  }
  if (result.error) throw new Error(result.error.message);

  const byEmail = new Map();
  (result.data || []).forEach((row) => {
    if (!isEligibleRegistration(row)) return;
    const mapped = mapAttendeeRow(row);
    if (!mapped.email || !mapped.email.includes('@')) return;
    if (!byEmail.has(mapped.email)) byEmail.set(mapped.email, mapped);
  });

  return [...byEmail.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .slice(0, MAX_ATTENDEES);
}

function buildConnectionsListHtml(attendees, recipientEmail) {
  const rows = attendees
    .filter((a) => a.email !== recipientEmail)
    .map((a) => {
      const meta = [a.jobTitle, a.company].filter(Boolean).join(' · ');
      const guests =
        a.guestNames && a.guestNames.length
          ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;color:#8a8284;margin:4px 0 0;">Also with: ' +
            escapeHtml(a.guestNames.join(', ')) +
            '</p>'
          : '';
      return (
        '<tr><td style="padding:14px 0;border-bottom:1px solid #ece7df;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 2px;">' +
        escapeHtml(a.name) +
        '</p>' +
        (meta
          ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0 0 4px;">' +
            escapeHtml(meta) +
            '</p>'
          : '') +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;margin:0;">' +
        '<a href="mailto:' +
        escapeHtml(a.email) +
        '" style="color:#0d6e7a;text-decoration:underline;">' +
        escapeHtml(a.email) +
        '</a></p>' +
        guests +
        '</td></tr>'
      );
    })
    .join('');

  if (!rows) {
    return (
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">' +
      'No other confirmed attendees to share for this event yet.' +
      '</p>'
    );
  }

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    rows +
    '</table>'
  );
}

function buildOrganiserNoteHtml(note) {
  const text = clampText(note, MAX_NOTE);
  if (!text) return '';
  const body = escapeHtml(text).replace(/\n/g, '<br>');
  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#0d6e7a;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">A note from the organiser</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">' +
    body +
    '</p></td></tr></table></td></tr>'
  );
}

function defaultSubject(eventTitle) {
  const title = String(eventTitle || 'your event').trim() || 'your event';
  return clampText('Your connections from ' + title, MAX_SUBJECT);
}

async function getConnectionsPreview(session, eventId) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const event = await assertEventOwned(sb, session, eventId);
  const attendees = await loadEligibleAttendees(sb, eventId);
  const organiser = event.organisers || {};

  return {
    eventId: event.id,
    eventTitle: String(event.title || 'Event').trim(),
    eventDate: event.starts_at ? formatDateOnly(event.starts_at) : '',
    organiserName: String(organiser.name || 'Your organiser').trim(),
    attendeeCount: attendees.length,
    attendees: attendees.map((a) => ({
      name: a.name,
      email: a.email,
      company: a.company,
      jobTitle: a.jobTitle,
      guestNames: a.guestNames,
    })),
    lastSentAt: event.connections_email_sent_at || null,
    lastSentCount: Number(event.connections_email_sent_count) || 0,
    defaultSubject: defaultSubject(event.title),
    tooLarge: attendees.length >= MAX_ATTENDEES,
    maxAttendees: MAX_ATTENDEES,
  };
}

async function sendConnectionsEmail(session, { eventId, organiserNote, subject, force }) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const event = await assertEventOwned(sb, session, eventId);
  const attendees = await loadEligibleAttendees(sb, eventId);

  if (attendees.length < 2) {
    const err = new Error(
      'You need at least two confirmed attendees before you can share a connections list.'
    );
    err.status = 400;
    err.code = 'not_enough_attendees';
    throw err;
  }

  if (event.connections_email_sent_at && !force) {
    const err = new Error(
      'A connections email was already sent for this event. Confirm to send again.'
    );
    err.status = 409;
    err.code = 'already_sent';
    err.lastSentAt = event.connections_email_sent_at;
    throw err;
  }

  const organiser = event.organisers || {};
  const organiserName = String(organiser.name || 'Your organiser').trim();
  const replyTo =
    String(organiser.contact_email || organiser.email || '')
      .trim() || undefined;
  const note = clampText(organiserNote, MAX_NOTE);
  const emailSubject = clampText(subject, MAX_SUBJECT) || defaultSubject(event.title);
  const site = publicSiteBase();
  const eventDate = event.starts_at ? formatDateOnly(event.starts_at) : '';

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const CONCURRENCY = 5;

  async function sendOne(recipient) {
    const listHtml = buildConnectionsListHtml(attendees, recipient.email);
    const otherCount = attendees.filter((a) => a.email !== recipient.email).length;
    try {
      await sendTemplatedEmail({
        slug: SLUG,
        to: recipient.email,
        subject: emailSubject,
        replyTo,
        variables: {
          user_name: recipient.name.split(/\s+/)[0] || recipient.name,
          event_name: String(event.title || 'Event').trim(),
          event_date: eventDate,
          event_date_clause: eventDate ? ' on ' + eventDate : '',
          organiser_name: organiserName,
          attendee_count: String(otherCount),
          connections_list_html: listHtml,
          organiser_note_html: buildOrganiserNoteHtml(note),
          site_url: site,
          logo_url: logoNavUrl(site),
          logo_footer_url: logoFooterUrl(site),
          privacy_url: site + '/privacy',
          unsubscribe_url: unsubscribeUrl(site),
          sponsor_row: '',
          mini_sponsors_row: '',
        },
        resendTags: [
          { name: 'email_type', value: SLUG },
          { name: 'event_id', value: String(event.id).slice(0, 36) },
        ],
      });
      sent++;
    } catch (e) {
      if (e && e.code === 'emails_disabled') {
        skipped++;
      } else {
        failed++;
        if (errors.length < 5) {
          errors.push(String((e && e.message) || 'send_failed').slice(0, 120));
        }
      }
    }
  }

  for (let i = 0; i < attendees.length; i += CONCURRENCY) {
    const batch = attendees.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((recipient) => sendOne(recipient)));
  }

  const patch = {
    connections_email_sent_at: new Date().toISOString(),
    connections_email_sent_count: sent,
  };
  const { error: updErr } = await sb.from('events').update(patch).eq('id', event.id);
  if (updErr && !/connections_email_sent/i.test(String(updErr.message || ''))) {
    throw new Error(updErr.message);
  }

  return {
    ok: true,
    eventId: event.id,
    eventTitle: String(event.title || 'Event').trim(),
    recipientCount: attendees.length,
    sent,
    skipped,
    failed,
    errors,
    message:
      sent > 0
        ? 'Sent the connections list to ' +
          sent +
          ' attendee' +
          (sent === 1 ? '' : 's') +
          (skipped ? ' (' + skipped + ' opted out)' : '') +
          (failed ? '. ' + failed + ' failed.' : '.')
        : failed
          ? 'Could not send the connections email.'
          : 'No emails were sent — recipients may have email turned off.',
  };
}

module.exports = {
  SLUG,
  MAX_ATTENDEES,
  getConnectionsPreview,
  sendConnectionsEmail,
  defaultSubject,
};
