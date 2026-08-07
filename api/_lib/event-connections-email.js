/**
 * Event-level connections email — send each confirmed attendee a list of
 * who else attended (or is going to) the same event (name, company, job title, email).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { publicSiteBase, unsubscribeUrl, logoNavUrl, logoFooterUrl } = require('./hub-email-urls');
const { formatDateOnly } = require('./event-timezone');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { organiserLogoUrlForEmail } = require('./organiser-member-roster');
const crypto = require('crypto');

const SLUG = 'event_connections_list';
const MAX_ATTENDEES = 200;
const MAX_NOTE = 800;
const MAX_SUBJECT = 90;
const MAX_FROM = 80;

function trackBaseUrl() {
  return publicSiteBase() + '/api/track';
}

function wrapTrackedUrl(url, trackToken) {
  const target = String(url || '').trim();
  if (!trackToken || !target) return target;
  if (!/^(https?:|mailto:)/i.test(target)) return target;
  return (
    trackBaseUrl() +
    '?kind=click&t=' +
    encodeURIComponent(trackToken) +
    '&u=' +
    encodeURIComponent(target)
  );
}

function trackingPixelHtml(trackToken) {
  if (!trackToken) return '';
  const src = trackBaseUrl() + '?kind=open&t=' + encodeURIComponent(trackToken);
  return (
    '<img src="' +
    escapeHtml(src) +
    '" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />'
  );
}

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

function normalizeListKind(value) {
  return String(value || '').trim().toLowerCase() === 'going' ? 'going' : 'attended';
}

function eventHasStarted(event, nowMs) {
  const startMs = event && event.starts_at ? new Date(event.starts_at).getTime() : NaN;
  if (!Number.isFinite(startMs)) return false;
  return startMs <= (nowMs != null ? nowMs : Date.now());
}

function assertListKindAllowed(event, listKind) {
  const kind = normalizeListKind(listKind);
  const started = eventHasStarted(event);
  if (kind === 'attended' && !started) {
    const err = new Error(
      '“Who attended” can only be sent after the event has started. Use “Who’s going” to share confirmed bookings beforehand.'
    );
    err.status = 400;
    err.code = 'event_not_started';
    throw err;
  }
  if (kind === 'going' && started) {
    const err = new Error(
      '“Who’s going” is for upcoming events. After the event has started, send “Who attended” instead.'
    );
    err.status = 400;
    err.code = 'event_already_started';
    throw err;
  }
  return kind;
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
      'id, title, starts_at, ends_at, organiser_id, connections_email_sent_at, connections_email_sent_count, organisers ( id, name, contact_email, email, slug, photo_url )'
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
        'id, title, starts_at, ends_at, organiser_id, organisers ( id, name, contact_email, email, slug, photo_url )'
      )
      .eq('id', eventId)
      .maybeSingle();
  }
  if (result.error && /photo_url|column/.test(String(result.error.message || ''))) {
    result = await sb
      .from('events')
      .select(
        'id, title, starts_at, ends_at, organiser_id, connections_email_sent_at, connections_email_sent_count, organisers ( id, name, contact_email, email, slug )'
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

function buildConnectionsListHtml(attendees, recipientEmail, trackToken) {
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
      const mailHref = wrapTrackedUrl('mailto:' + a.email, trackToken);
      return (
        '<tr><td style="padding:8px 0;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f8fc;border:1px solid #ece7df;border-radius:12px;">' +
        '<tr><td style="padding:14px 16px;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 2px;">' +
        escapeHtml(a.name) +
        '</p>' +
        (meta
          ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0 0 4px;">' +
            escapeHtml(meta) +
            '</p>'
          : '') +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;margin:0;">' +
        '<a href="' +
        escapeHtml(mailHref) +
        '" style="color:#0d6e7a;text-decoration:underline;">' +
        escapeHtml(a.email) +
        '</a></p>' +
        guests +
        '</td></tr></table></td></tr>'
      );
    })
    .join('');

  if (!rows) {
    return (
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">' +
      'No other confirmed guests to share for this event yet.' +
      '</p>'
    );
  }

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    rows +
    '</table>'
  );
}

function buildOrganiserNoteHtml(note, { fromName, organiserName, logoUrl } = {}) {
  const text = clampText(note, MAX_NOTE);
  const from = clampText(fromName, MAX_FROM) || clampText(organiserName, MAX_FROM);
  if (!text && !from && !logoUrl) return '';

  const logoHtml = logoUrl
    ? '<img src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      escapeHtml(organiserName || 'Organiser') +
      '" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border:0;border-radius:50%;margin:0 0 12px;" />'
    : '';
  const fromHtml = from
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#0d6e7a;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">From ' +
      escapeHtml(from) +
      '</p>'
    : '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#0d6e7a;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">A note from the organiser</p>';
  const bodyHtml = text
    ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">' +
      escapeHtml(text).replace(/\n/g, '<br>') +
      '</p>'
    : from
      ? '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">Shared so you can keep networking with the people on this list.</p>'
      : '';

  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 16px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;">' +
    '<tr><td style="padding:18px 20px;">' +
    logoHtml +
    fromHtml +
    bodyHtml +
    '</td></tr></table></td></tr>'
  );
}

function defaultSubject(eventTitle, listKind) {
  const title = String(eventTitle || 'your event').trim() || 'your event';
  const prefix = normalizeListKind(listKind) === 'going' ? 'Who’s going — ' : 'Who attended — ';
  return clampText(prefix + title, MAX_SUBJECT);
}

function normalizeExcludeEmails(input) {
  const list = Array.isArray(input) ? input : [];
  const out = new Set();
  list.forEach((value) => {
    const email = normalizeEmail(value);
    if (email && email.includes('@')) out.add(email);
  });
  return out;
}

async function loadGroupFreeAllowance(sb, organiserId) {
  if (!organiserId) {
    return { freeAllowanceUsed: false, lastSentAt: null, lastSentCount: 0, lastSentEventId: null };
  }
  let result = await sb
    .from('events')
    .select('id, connections_email_sent_at, connections_email_sent_count')
    .eq('organiser_id', organiserId)
    .not('connections_email_sent_at', 'is', null)
    .order('connections_email_sent_at', { ascending: false })
    .limit(1);
  if (result.error && /connections_email_sent|column/.test(String(result.error.message || ''))) {
    return { freeAllowanceUsed: false, lastSentAt: null, lastSentCount: 0, lastSentEventId: null };
  }
  if (result.error) throw new Error(result.error.message);
  const row = (result.data || [])[0];
  if (!row) {
    return { freeAllowanceUsed: false, lastSentAt: null, lastSentCount: 0, lastSentEventId: null };
  }
  return {
    freeAllowanceUsed: true,
    lastSentAt: row.connections_email_sent_at || null,
    lastSentCount: Number(row.connections_email_sent_count) || 0,
    lastSentEventId: row.id || null,
  };
}

function copyForListKind(listKind, eventTitle) {
  const kind = normalizeListKind(listKind);
  const name = String(eventTitle || 'Event').trim() || 'Event';
  if (kind === 'going') {
    return {
      kicker: 'Who’s going',
      headline: 'Who’s going to ' + name,
      lede:
        'here are the confirmed guests for <strong style="color:#1c2040;">' +
        escapeHtml(name) +
        '</strong>{{event_date_clause}} — say hello before you meet.',
      listLabel: 'confirmed guests',
      footerReason: 'You received this because you are booked for',
    };
  }
  return {
    kicker: 'Attendee round-up',
    headline: 'Who attended ' + name,
    lede:
      'here are the confirmed attendees from <strong style="color:#1c2040;">' +
      escapeHtml(name) +
      '</strong>{{event_date_clause}} — reach out while the conversations are fresh.',
    listLabel: 'attendees',
    footerReason: 'You received this because you attended',
  };
}

async function getConnectionsPreview(session, eventId, listKindInput) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const event = await assertEventOwned(sb, session, eventId);
  const started = eventHasStarted(event);
  const preferredKind = normalizeListKind(listKindInput || (started ? 'attended' : 'going'));
  let listKind = preferredKind;
  let timingError = null;
  try {
    listKind = assertListKindAllowed(event, preferredKind);
  } catch (e) {
    // Preview auto-corrects to the valid mode; send still enforces strictly.
    listKind = started ? 'attended' : 'going';
    timingError = null;
  }
  const attendees = await loadEligibleAttendees(sb, eventId);
  const organiser = event.organisers || {};
  const site = publicSiteBase();
  const organiserLogoUrl = organiserLogoUrlForEmail(organiser, site) || '';
  const copy = copyForListKind(listKind, event.title);
  const free = await loadGroupFreeAllowance(sb, event.organiser_id);
  const engagement = await loadEngagementForEvent(sb, event.id);

  return {
    eventId: event.id,
    eventTitle: String(event.title || 'Event').trim(),
    eventDate: event.starts_at ? formatDateOnly(event.starts_at) : '',
    eventStarted: started,
    listKind,
    allowedListKinds: started ? ['attended'] : ['going'],
    timingError,
    organiserId: event.organiser_id || null,
    organiserName: String(organiser.name || 'Your organiser').trim(),
    organiserLogoUrl,
    attendeeCount: attendees.length,
    attendees: attendees.map((a) => ({
      name: a.name,
      email: a.email,
      company: a.company,
      jobTitle: a.jobTitle,
      guestNames: a.guestNames,
    })),
    lastSentAt: free.lastSentAt,
    lastSentCount: free.lastSentCount,
    lastSentEventId: free.lastSentEventId,
    freeAllowanceUsed: free.freeAllowanceUsed,
    freeAllowanceScope: 'group',
    defaultSubject: defaultSubject(event.title, listKind),
    copyKicker: copy.kicker,
    copyHeadline: copy.headline,
    tooLarge: attendees.length >= MAX_ATTENDEES,
    maxAttendees: MAX_ATTENDEES,
    engagement,
  };
}

async function sendConnectionsEmail(
  session,
  { eventId, organiserNote, subject, fromName, listKind: listKindInput, excludeEmails, force }
) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const event = await assertEventOwned(sb, session, eventId);
  const listKind = assertListKindAllowed(event, listKindInput);
  const allAttendees = await loadEligibleAttendees(sb, eventId);
  const excluded = normalizeExcludeEmails(excludeEmails);
  const attendees = allAttendees.filter((a) => !excluded.has(a.email));

  if (attendees.length < 2) {
    const err = new Error(
      'You need at least two guests included in the round-up. Untick fewer people, or wait for more confirmed bookings.'
    );
    err.status = 400;
    err.code = 'not_enough_attendees';
    throw err;
  }

  const free = await loadGroupFreeAllowance(sb, event.organiser_id);
  if (free.freeAllowanceUsed && !force) {
    const err = new Error(
      'Your free round-up for this organiser page was already used. Extra sends will be a paid add-on soon — confirm only if you need to send again now.'
    );
    err.status = 409;
    err.code = 'already_sent';
    err.lastSentAt = free.lastSentAt;
    throw err;
  }

  const organiser = event.organisers || {};
  const organiserName = String(organiser.name || 'Your organiser').trim();
  const senderName = clampText(fromName, MAX_FROM) || organiserName;
  const replyTo =
    String(organiser.contact_email || organiser.email || '')
      .trim() || undefined;
  const note = clampText(organiserNote, MAX_NOTE);
  const emailSubject = clampText(subject, MAX_SUBJECT) || defaultSubject(event.title, listKind);
  const site = publicSiteBase();
  const eventDate = event.starts_at ? formatDateOnly(event.starts_at) : '';
  const organiserLogoUrl = organiserLogoUrlForEmail(organiser, site) || '';
  const copy = copyForListKind(listKind, event.title);
  const noteHtml = buildOrganiserNoteHtml(note, {
    fromName: senderName,
    organiserName,
    logoUrl: organiserLogoUrl,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  const CONCURRENCY = 5;
  let sendId = null;
  const recipientRows = [];

  try {
    const { data: sendRow, error: sendErr } = await sb
      .from('event_connections_sends')
      .insert({
        event_id: event.id,
        organiser_id: event.organiser_id,
        list_kind: listKind,
        subject: emailSubject,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
      })
      .select('id')
      .single();
    if (!sendErr && sendRow && sendRow.id) sendId = sendRow.id;
  } catch (e) {
    sendId = null;
  }

  async function sendOne(recipient) {
    const trackToken = crypto.randomUUID();
    const listHtml = buildConnectionsListHtml(attendees, recipient.email, trackToken);
    const otherCount = attendees.filter((a) => a.email !== recipient.email).length;
    const firstName = recipient.name.split(/\s+/)[0] || recipient.name;
    const dateClause = eventDate ? ' on ' + eventDate : '';
    const ledeBody =
      listKind === 'going'
        ? 'here are the confirmed guests for <strong style="color:#1c2040;">' +
          escapeHtml(String(event.title || 'Event').trim()) +
          '</strong>' +
          dateClause +
          ' — say hello before you meet.'
        : 'here are the confirmed attendees from <strong style="color:#1c2040;">' +
          escapeHtml(String(event.title || 'Event').trim()) +
          '</strong>' +
          dateClause +
          ' — reach out while the conversations are fresh.';
    try {
      await sendTemplatedEmail({
        slug: SLUG,
        to: recipient.email,
        subject: emailSubject,
        replyTo,
        variables: {
          user_name: firstName,
          event_name: String(event.title || 'Event').trim(),
          event_date: eventDate,
          event_date_clause: dateClause,
          organiser_name: organiserName,
          from_name: senderName,
          list_kicker: copy.kicker,
          list_headline: copy.headline,
          list_lede: 'Hi ' + escapeHtml(firstName) + ', ' + ledeBody,
          list_count_label: String(otherCount) + ' ' + copy.listLabel,
          footer_reason: copy.footerReason,
          attendee_count: String(otherCount),
          connections_list_html: listHtml + trackingPixelHtml(trackToken),
          organiser_note_html: noteHtml,
          organiser_logo_url: organiserLogoUrl,
          tracking_pixel_html: trackingPixelHtml(trackToken),
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
          { name: 'list_kind', value: listKind },
        ],
      });
      sent++;
      if (sendId) {
        recipientRows.push({
          send_id: sendId,
          event_id: event.id,
          organiser_id: event.organiser_id,
          email: recipient.email,
          tracking_token: trackToken,
          sent_at: new Date().toISOString(),
        });
      }
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

  if (sendId && recipientRows.length) {
    const { error: recErr } = await sb.from('event_connections_recipients').insert(recipientRows);
    if (recErr && !/event_connections_recipients|schema cache|does not exist/i.test(String(recErr.message || ''))) {
      /* non-fatal — email already sent */
    }
    await sb
      .from('event_connections_sends')
      .update({
        sent_count: sent,
        failed_count: failed,
        skipped_count: skipped,
      })
      .eq('id', sendId);
  }

  const patch = {
    connections_email_sent_at: new Date().toISOString(),
    connections_email_sent_count: sent,
  };
  const { error: updErr } = await sb.from('events').update(patch).eq('id', event.id);
  if (updErr && !/connections_email_sent/i.test(String(updErr.message || ''))) {
    throw new Error(updErr.message);
  }

  const label = listKind === 'going' ? 'who’s going list' : 'attendee round-up';
  const omitted = allAttendees.length - attendees.length;
  return {
    ok: true,
    eventId: event.id,
    eventTitle: String(event.title || 'Event').trim(),
    listKind,
    sendId,
    recipientCount: attendees.length,
    omittedCount: omitted,
    sent,
    skipped,
    failed,
    errors,
    message:
      sent > 0
        ? 'Sent the ' +
          label +
          ' to ' +
          sent +
          ' guest' +
          (sent === 1 ? '' : 's') +
          (omitted ? ' (' + omitted + ' omitted)' : '') +
          (skipped ? ' (' + skipped + ' opted out)' : '') +
          (failed ? '. ' + failed + ' failed.' : '.')
        : failed
          ? 'Could not send the email.'
          : 'No emails were sent — recipients may have email turned off.',
  };
}

async function loadEngagementForEvent(sb, eventId) {
  const empty = {
    hasSend: false,
    sent: 0,
    opened: 0,
    openRate: 0,
    clicked: 0,
    clickRate: 0,
    sentAt: null,
    listKind: null,
  };
  if (!eventId) return empty;
  const { data: latest, error: latestErr } = await sb
    .from('event_connections_sends')
    .select('id, list_kind, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr && /event_connections_sends|schema cache|does not exist/i.test(String(latestErr.message || ''))) {
    return empty;
  }
  if (latestErr || !latest) return empty;

  const { data: rows, error } = await sb
    .from('event_connections_recipients')
    .select('sent_at, opened_at, clicked_at')
    .eq('send_id', latest.id);
  if (error) return empty;

  const delivered = (rows || []).filter((r) => r.sent_at);
  const opened = delivered.filter((r) => r.opened_at).length;
  const clicked = delivered.filter((r) => r.clicked_at).length;
  const sentCount = delivered.length;
  return {
    hasSend: true,
    sendId: latest.id,
    listKind: latest.list_kind || null,
    sentAt: latest.created_at || null,
    sent: sentCount,
    opened,
    openRate: sentCount ? Math.round((opened / sentCount) * 1000) / 10 : 0,
    clicked,
    clickRate: sentCount ? Math.round((clicked / sentCount) * 1000) / 10 : 0,
  };
}

async function getConnectionsEngagement(session, eventId) {
  if (!isSupabaseConfigured()) {
    const err = new Error('Database not configured');
    err.status = 503;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const event = await assertEventOwned(sb, session, eventId);
  const engagement = await loadEngagementForEvent(sb, event.id);
  return {
    ...engagement,
    eventId: event.id,
    eventTitle: String(event.title || 'Event').trim(),
  };
}

module.exports = {
  SLUG,
  MAX_ATTENDEES,
  getConnectionsPreview,
  sendConnectionsEmail,
  getConnectionsEngagement,
  defaultSubject,
  normalizeListKind,
};
