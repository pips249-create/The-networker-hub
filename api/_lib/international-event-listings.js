/**
 * Worldwide link-out event listings for The Networker International.
 * Submissions are moderated (pending → approved) before public browse.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendViaResend } = require('./send-template-email');
const { supportEmail } = require('./hub-email-urls');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNAVAILABLE_COUNTRY_CODES = new Set(['BY', 'IR', 'KP', 'RU', 'SY']);

const PUBLIC_SELECT =
  'id, title, starts_on, ends_on, city, country_code, country_name, organiser_name, organiser_website, external_url, created_at';

const ADMIN_SELECT =
  'id, title, starts_on, ends_on, city, country_code, country_name, organiser_name, organiser_website, external_url, contact_name, email, status, source, created_at, reviewed_at, reviewed_by';

function staffInbox() {
  const configured = String(process.env.EVENT_INTAKE_EMAIL || '').trim();
  if (configured) return configured.toLowerCase();
  return supportEmail();
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

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeCountryCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function normalizeDate(raw) {
  const value = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

function normalizeExternalUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeInput(payload) {
  payload = payload || {};
  const allowedSources = new Set([
    'international_map',
    'international_home_cta',
    'international_events_section',
    'international_country_ie',
    'international_country_us',
  ]);
  const sourceRaw = String(payload.source || '')
    .trim()
    .toLowerCase()
    .slice(0, 64);
  return {
    title: String(payload.title || payload.eventTitle || payload.event_title || '')
      .trim()
      .slice(0, 160),
    startsOn: normalizeDate(payload.startsOn || payload.starts_on || payload.date || payload.startDate),
    endsOn: normalizeDate(payload.endsOn || payload.ends_on || payload.endDate) || null,
    city: String(payload.city || payload.town || '')
      .trim()
      .slice(0, 120),
    countryCode: normalizeCountryCode(payload.countryCode || payload.country_code),
    countryName: String(payload.countryName || payload.country_name || '')
      .trim()
      .slice(0, 120),
    organiserName: String(
      payload.organiserName ||
        payload.organiser_name ||
        payload.groupName ||
        payload.group_name ||
        payload.organisation ||
        ''
    )
      .trim()
      .slice(0, 160),
    organiserWebsiteRaw: String(
      payload.organiserWebsite ||
        payload.organiser_website ||
        payload.groupWebsite ||
        payload.group_website ||
        ''
    ).trim(),
    organiserWebsite: normalizeExternalUrl(
      payload.organiserWebsite ||
        payload.organiser_website ||
        payload.groupWebsite ||
        payload.group_website
    ),
    externalUrl: normalizeExternalUrl(
      payload.externalUrl || payload.external_url || payload.url || payload.link || payload.bookingUrl
    ),
    contactName: String(payload.name || payload.contactName || payload.contact_name || '')
      .trim()
      .slice(0, 120),
    email: normalizeEmail(payload.email),
    website: String(payload.website_hp || '').trim(),
    source: allowedSources.has(sourceRaw) ? sourceRaw : 'international_map',
  };
}

function validateInput(input) {
  if (input.website) {
    return { ok: true, honeypot: true };
  }
  if (!input.title) {
    return { ok: false, error: 'missing_title', message: 'Enter the event title.' };
  }
  if (!input.startsOn) {
    return { ok: false, error: 'invalid_date', message: 'Enter a valid start date (YYYY-MM-DD).' };
  }
  if (input.endsOn && input.endsOn < input.startsOn) {
    return {
      ok: false,
      error: 'invalid_end_date',
      message: 'End date must be on or after the start date.',
    };
  }
  if (!input.city) {
    return { ok: false, error: 'missing_city', message: 'Enter the city.' };
  }
  if (!input.countryCode || input.countryCode.length !== 2 || !input.countryName) {
    return { ok: false, error: 'invalid_country', message: 'Choose a country.' };
  }
  if (input.countryCode === 'GB') {
    return {
      ok: false,
      error: 'use_uk_site',
      message:
        'For UK events, list on The Networker UK instead: https://www.thenetworkeruk.com/add-your-event',
    };
  }
  if (UNAVAILABLE_COUNTRY_CODES.has(input.countryCode)) {
    return {
      ok: false,
      error: 'country_unavailable',
      message: 'We cannot list events in this country.',
    };
  }
  if (!input.organiserName) {
    return {
      ok: false,
      error: 'missing_organiser',
      message: 'Enter the organiser or group name.',
    };
  }
  if (input.organiserWebsiteRaw && !input.organiserWebsite) {
    return {
      ok: false,
      error: 'invalid_organiser_website',
      message: 'Enter a valid organiser website (https://…), or leave it blank.',
    };
  }
  if (!input.externalUrl) {
    return {
      ok: false,
      error: 'invalid_url',
      message: 'Enter a valid booking or info URL (https://…).',
    };
  }
  if (!input.contactName) {
    return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  }
  if (!input.email || input.email.length > 254 || !EMAIL_RE.test(input.email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }
  return { ok: true };
}

function mapPublic(row) {
  return {
    id: row.id,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on || null,
    city: row.city,
    countryCode: row.country_code,
    countryName: row.country_name,
    organiserName: row.organiser_name || null,
    organiserWebsite: row.organiser_website || null,
    externalUrl: row.external_url,
    createdAt: row.created_at,
  };
}

function mapAdmin(row) {
  return {
    ...mapPublic(row),
    contactName: row.contact_name,
    email: row.email,
    status: row.status || 'pending',
    source: row.source || 'international_map',
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
  };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">International event to review</h2>' +
    '<p style="margin:0 0 16px;"><strong>' +
    escHtml(input.title) +
    '</strong> · ' +
    escHtml(input.city) +
    ', ' +
    escHtml(input.countryName) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:560px;">' +
    row('Starts', input.startsOn) +
    row('Ends', input.endsOn) +
    row('City', input.city) +
    row('Country', input.countryName + ' (' + input.countryCode + ')') +
    row('Organiser / group', input.organiserName) +
    row('Organiser website', input.organiserWebsite) +
    row('Link out', input.externalUrl) +
    row('Contact', input.contactName) +
    row('Email', input.email) +
    '</table>' +
    '<p style="margin:16px 0 0;color:#666;font-size:13px;">Approve in Admin → International leads before it appears on the public browse list.</p>' +
    '</div>'
  );
}

function buildConfirmationEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;">' +
    '<p style="margin:0 0 12px;">Hi ' +
    escHtml(input.contactName) +
    ',</p>' +
    '<p style="margin:0 0 12px;">Thanks — we received <strong>' +
    escHtml(input.title) +
    '</strong> for ' +
    escHtml(input.city) +
    ', ' +
    escHtml(input.countryName) +
    '.</p>' +
    '<p style="margin:0 0 12px;">We list international events as link-outs only (people book on your site). We&rsquo;ll review it shortly and email you if we need anything else.</p>' +
    '<p style="margin:0;">The Networker International</p>' +
    '</div>'
  );
}

async function submitInternationalEventListing(payload) {
  if (!isSupabaseConfigured()) {
    const err = new Error(
      'Event submissions are not configured yet — email hi@thenetworkeruk.com with your event details.'
    );
    err.code = 'not_configured';
    throw err;
  }

  const input = normalizeInput(payload);
  const validation = validateInput(input);
  if (!validation.ok) return validation;
  if (validation.honeypot) {
    return {
      ok: true,
      message: 'Thanks — we will review your event and publish it if it looks right.',
    };
  }

  const sb = getSupabaseAdmin();
  const insertRes = await sb
    .from('international_event_listings')
    .insert({
      title: input.title,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      city: input.city,
      country_code: input.countryCode,
      country_name: input.countryName,
      organiser_name: input.organiserName,
      organiser_website: input.organiserWebsite,
      external_url: input.externalUrl,
      contact_name: input.contactName,
      email: input.email,
      status: 'pending',
      source: input.source,
    })
    .select('id, created_at')
    .single();

  if (insertRes.error) {
    if (/international_event_listings/i.test(insertRes.error.message || '')) {
      const err = new Error(
        'Event submissions are not configured yet — email hi@thenetworkeruk.com with your event details.'
      );
      err.code = 'not_configured';
      throw err;
    }
    const err = new Error(insertRes.error.message || 'Could not save your event.');
    err.code = 'save_failed';
    throw err;
  }

  const to = staffInbox();
  const subject = 'International event — ' + input.title + ' (' + input.countryName + ')';

  try {
    await sendViaResend({
      to,
      subject,
      html: buildStaffEmailHtml(input),
      replyTo: input.email,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[international-event-listings-staff-email]', e.message || e);
  }

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your event — The Networker International',
      html: buildConfirmationEmailHtml(input),
      replyTo: to,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[international-event-listings-confirm-email]', e.message || e);
  }

  return {
    ok: true,
    id: insertRes.data && insertRes.data.id,
    message: 'Thanks — we will review your event and publish it if it looks right.',
  };
}

function normalizeCountryCodeList(raw) {
  const fromArray = Array.isArray(raw) ? raw : null;
  const fromString = String(raw || '')
    .split(/[\s,]+/)
    .map(function (part) {
      return normalizeCountryCode(part);
    })
    .filter(Boolean);
  const list = fromArray
    ? fromArray.map(normalizeCountryCode).filter(Boolean)
    : fromString;
  const unique = [];
  list.forEach(function (code) {
    if (code.length === 2 && unique.indexOf(code) === -1) unique.push(code);
  });
  return unique;
}

async function listPublicInternationalEventListings(options) {
  options = options || {};
  if (!isSupabaseConfigured()) {
    return { ok: true, configured: false, events: [], total: 0 };
  }

  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(options.limit) || 100, 1), 200);
  const countryCodes = normalizeCountryCodeList(
    options.countryCodes ||
      options.countries ||
      options.countryCode ||
      options.country_code
  );
  const today = new Date().toISOString().slice(0, 10);

  let query = sb
    .from('international_event_listings')
    .select(PUBLIC_SELECT)
    .eq('status', 'approved')
    .gte('starts_on', today)
    .order('starts_on', { ascending: true })
    .limit(max);

  if (countryCodes.length === 1) {
    query = query.eq('country_code', countryCodes[0]);
  } else if (countryCodes.length > 1) {
    query = query.in('country_code', countryCodes);
  }

  const res = await query;
  if (res.error) {
    if (/international_event_listings/i.test(res.error.message || '')) {
      return { ok: true, configured: false, events: [], total: 0 };
    }
    throw new Error(res.error.message || 'Could not load events.');
  }

  const events = (res.data || []).map(mapPublic);
  return { ok: true, configured: true, events: events, total: events.length };
}

async function listAdminInternationalEventListings(limit, status) {
  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const statusFilter = String(status || '').trim().toLowerCase();

  let query = sb
    .from('international_event_listings')
    .select(ADMIN_SELECT)
    .order('created_at', { ascending: false })
    .limit(max);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const res = await query;
  if (res.error) {
    if (/international_event_listings/i.test(res.error.message || '')) {
      const err = new Error('events_table_missing');
      err.code = 'events_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }

  const events = (res.data || []).map(mapAdmin);
  const pendingCount = events.filter(function (row) {
    return row.status === 'pending';
  }).length;

  return { events: events, pendingCount: pendingCount, total: events.length };
}

async function updateInternationalEventListingStatus(id, status, session) {
  const allowed = { pending: true, approved: true, rejected: true, spam: true };
  const next = String(status || '').trim().toLowerCase();
  if (!allowed[next]) {
    const err = new Error('invalid_status');
    err.code = 'invalid_status';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const patch = {
    status: next,
    reviewed_at: next === 'pending' ? null : new Date().toISOString(),
    reviewed_by:
      next === 'pending'
        ? null
        : String((session && (session.email || session.userEmail || session.sub)) || 'admin').trim(),
  };

  const { data, error } = await sb
    .from('international_event_listings')
    .update(patch)
    .eq('id', id)
    .select(ADMIN_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return { ok: true, event: mapAdmin(data) };
}

module.exports = {
  normalizeInput,
  validateInput,
  submitInternationalEventListing,
  listPublicInternationalEventListings,
  listAdminInternationalEventListings,
  updateInternationalEventListingStatus,
  UNAVAILABLE_COUNTRY_CODES,
};
