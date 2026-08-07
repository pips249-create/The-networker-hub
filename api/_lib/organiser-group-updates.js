/**
 * Organiser monthly group updates — modular email to Hub attendees.
 *
 * Limits:
 * - 1 free send per organiser group per calendar month
 * - Extra credits (organisers.group_update_extra_credits) after free used
 * - Hard cap 4 sends / group / month (deliverability)
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { publicSiteBase, unsubscribeUrl, logoNavUrl } = require('./hub-email-urls');
const { eventImageUrl } = require('./event-image');
const { organiserLogoUrlForEmail } = require('./organiser-member-roster');
const { normalizeHexColor } = require('./website-meta');
const { EVENT_TZ } = require('./event-timezone');

const SLUG = 'organiser_monthly_group_update';
const FREE_PER_MONTH = 1;
const HARD_CAP_PER_MONTH = 4;
const MAX_SUBJECT = 90;
const MAX_NOTE = 1200;
const MAX_RECAP = 800;
const MAX_SPOTLIGHT = 600;
const MAX_ASK = 400;
const MAX_VOLUNTEER = 300;
const MAX_EVENTS = 6;
const QUEUE_SPREAD_MS = 2 * 60 * 60 * 1000;
const QUEUE_MIN_GAP_MS = 5000;
const DEFAULT_ACCENT = '#0d6e7a';
const DEFAULT_CTA = '#4aa8f0';
const DEFAULT_INK = '#1c2040';

function brandColorsFromGroup(group) {
  const primary =
    normalizeHexColor(group && (group.brandPrimaryColor || group.brand_primary_color)) ||
    DEFAULT_ACCENT;
  const accent =
    normalizeHexColor(group && (group.brandAccentColor || group.brand_accent_color)) ||
    primary;
  const cta =
    normalizeHexColor(group && (group.brandSecondaryColor || group.brand_secondary_color)) ||
    DEFAULT_CTA;
  return { primary, accent, cta, ink: DEFAULT_INK };
}

function periodKey(d) {
  const date = d instanceof Date ? d : new Date(d || Date.now());
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

function periodLabel(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'This month';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function clampText(value, max) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtmlParagraphs(value) {
  const text = clampText(value, 5000);
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).replace(/\n/g, '<br>');
      return (
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0 0 12px;">' +
        lines +
        '</p>'
      );
    })
    .join('');
}

function sectionHtml(title, bodyHtml, accentColor) {
  if (!bodyHtml) return '';
  const accent = normalizeHexColor(accentColor) || DEFAULT_ACCENT;
  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 16px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:' +
    accent +
    ';text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">' +
    escapeHtml(title) +
    '</p>' +
    bodyHtml +
    '</td></tr>'
  );
}

function normalizeContent(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const eventIds = Array.isArray(c.eventIds)
    ? c.eventIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, MAX_EVENTS)
    : [];
  return {
    organiserNote: clampText(c.organiserNote, MAX_NOTE),
    monthRecap: clampText(c.monthRecap, MAX_RECAP),
    includeMonthStats: c.includeMonthStats !== false,
    includeGreeting: c.includeGreeting !== false,
    includeUpcomingEvents: c.includeUpcomingEvents !== false,
    eventIds,
    spotlightName: clampText(c.spotlightName, 80),
    spotlightCompany: clampText(c.spotlightCompany, 80),
    spotlightText: clampText(c.spotlightText, MAX_SPOTLIGHT),
    spotlightLinkedin: clampText(c.spotlightLinkedin, 200),
    memberAsk: clampText(c.memberAsk, MAX_ASK),
    volunteerCta: clampText(c.volunteerCta, MAX_VOLUNTEER),
    includeSocialLinks: c.includeSocialLinks !== false,
    audienceSlice: normalizeAudienceSlice(c.audienceSlice || c.audience_slice),
  };
}

const AUDIENCE_SLICES = {
  all: {
    id: 'all',
    label: 'Everyone who booked via the Hub',
    blurb: 'All Hub attendees for this organiser page',
  },
  once: {
    id: 'once',
    label: 'Came once — invite them back',
    blurb: 'People with exactly one booking',
  },
  recent: {
    id: 'recent',
    label: 'Booked in the last 30 days',
    blurb: 'Warm leads from the past month',
  },
  favourites: {
    id: 'favourites',
    label: 'Saved your page — never booked',
    blurb: 'Favourited the group but haven’t booked yet',
  },
};

function normalizeAudienceSlice(raw) {
  const id = String(raw || 'all').trim().toLowerCase();
  return AUDIENCE_SLICES[id] ? id : 'all';
}

function listAudienceSlices() {
  return Object.values(AUDIENCE_SLICES);
}

function defaultSubject(organiserName, key) {
  const name = String(organiserName || 'Our group').trim() || 'Our group';
  return clampText(name + ' — ' + periodLabel(key) + ' update', MAX_SUBJECT);
}

async function countSendsThisMonth(organiserId, key) {
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from('organiser_group_updates')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_id', organiserId)
    .eq('period_key', key || periodKey())
    .in('status', ['queued', 'sending', 'sent']);
  if (error) {
    if (isMissingGroupUpdatesTable(error)) return 0;
    throw new Error(error.message);
  }
  return Number(count) || 0;
}

function isMissingGroupUpdatesTable(error) {
  const msg = String((error && error.message) || error || '');
  return /organiser_group_updates|schema cache|does not exist/i.test(msg);
}

function throwGroupUpdatesDbError(error) {
  if (isMissingGroupUpdatesTable(error)) {
    const err = new Error(
      'Monthly updates are still being set up on our side. Please try again shortly — your draft isn’t lost on this page.'
    );
    err.status = 503;
    err.code = 'group_updates_not_ready';
    throw err;
  }
  throw new Error((error && error.message) || 'group_updates_failed');
}

async function listUpdatesForOrganiser(organiserId, limit) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_group_updates')
    .select('*')
    .eq('organiser_id', organiserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(40, Math.max(1, Number(limit) || 12)));
  if (error) {
    if (isMissingGroupUpdatesTable(error)) return [];
    throw new Error(error.message);
  }
  return data || [];
}

async function getAllowance(organiserId) {
  const sb = getSupabaseAdmin();
  const key = periodKey();
  let used = 0;
  try {
    used = await countSendsThisMonth(organiserId, key);
  } catch (e) {
    // Table may not exist yet if migration 212 is only partially applied.
    if (!/organiser_group_updates|does not exist/i.test(String(e.message || ''))) throw e;
  }

  let extras = 0;
  let orgName = '';
  const withCredits = await sb
    .from('organisers')
    .select('id, name, group_update_extra_credits')
    .eq('id', organiserId)
    .maybeSingle();
  if (withCredits.error && /group_update_extra_credits/i.test(String(withCredits.error.message || ''))) {
    const fallback = await sb
      .from('organisers')
      .select('id, name')
      .eq('id', organiserId)
      .maybeSingle();
    if (fallback.error) throw new Error(fallback.error.message);
    orgName = (fallback.data && fallback.data.name) || '';
  } else if (withCredits.error) {
    throw new Error(withCredits.error.message);
  } else {
    orgName = (withCredits.data && withCredits.data.name) || '';
    extras = Math.max(0, Number(withCredits.data && withCredits.data.group_update_extra_credits) || 0);
  }

  const freeLeft = Math.max(0, FREE_PER_MONTH - used);
  const hardLeft = Math.max(0, HARD_CAP_PER_MONTH - used);
  // Without extra-credits column, still allow the free monthly send.
  const canSend = hardLeft > 0 && (freeLeft > 0 || extras > 0);
  let nextBillable = 'none';
  if (canSend) nextBillable = freeLeft > 0 ? 'free' : 'extra';
  return {
    periodKey: key,
    periodLabel: periodLabel(key),
    freePerMonth: FREE_PER_MONTH,
    hardCapPerMonth: HARD_CAP_PER_MONTH,
    sentThisMonth: used,
    freeRemaining: freeLeft,
    extraCredits: extras,
    hardRemaining: hardLeft,
    canSend,
    nextBillable,
    blockedReason: !canSend
      ? used >= HARD_CAP_PER_MONTH
        ? 'hard_cap'
        : 'no_credits'
      : null,
    organiserName: orgName,
  };
}

async function getUpdate(updateId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_group_updates')
    .select('*')
    .eq('id', updateId)
    .maybeSingle();
  if (error) {
    if (isMissingGroupUpdatesTable(error)) return null;
    throwGroupUpdatesDbError(error);
  }
  return data || null;
}

async function listUpcomingEventsForOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const selectCols =
    'id, title, starts_at, slug, venue, city, location_label, status, approval_status, image_url, photo_url';
  // events use status + approval_status (listing_status is on organisers).
  const { data, error } = await sb
    .from('events')
    .select(selectCols)
    .eq('organiser_id', organiserId)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(12);
  if (error) {
    // Fallback if status filter shape differs in an older DB.
    if (/column events\.(status|approval_status|image_url|photo_url)/i.test(String(error.message || ''))) {
      const retry = await sb
        .from('events')
        .select('id, title, starts_at, slug, venue, city, location_label, image_url, photo_url')
        .eq('organiser_id', organiserId)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(12);
      if (retry.error) {
        const bare = await sb
          .from('events')
          .select('id, title, starts_at, slug, venue, city, location_label')
          .eq('organiser_id', organiserId)
          .gte('starts_at', now)
          .order('starts_at', { ascending: true })
          .limit(12);
        if (bare.error) throw new Error(bare.error.message);
        return (bare.data || []).map(mapEventRow);
      }
      return (retry.data || []).map(mapEventRow);
    }
    throw new Error(error.message);
  }
  return (data || []).map(mapEventRow);
}

function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    slug: row.slug,
    location: String(row.location_label || row.city || row.venue || '').trim(),
    imageUrl: eventImageUrl(row),
  };
}

/**
 * Auto Hub stats for the round-up period — events hosted + people who booked.
 * This is the mail-merge killer: DIY export can't assemble this cleanly.
 */
async function getMonthStatsForOrganiser(organiserId, key) {
  const sb = getSupabaseAdmin();
  const match = String(key || periodKey()).match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return { eventsHosted: 0, bookings: 0, uniqueGuests: 0, rating: null, periodLabel: periodLabel(key) };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const startIso = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const endIso = new Date(Date.UTC(y, m, 1)).toISOString();
  const nowIso = new Date().toISOString();
  const until = endIso < nowIso ? endIso : nowIso;

  let events = [];
  const primary = await sb
    .from('events')
    .select('id, title, starts_at, average_rating')
    .eq('organiser_id', organiserId)
    .gte('starts_at', startIso)
    .lt('starts_at', until)
    .order('starts_at', { ascending: true })
    .limit(40);
  if (primary.error && /average_rating/i.test(String(primary.error.message || ''))) {
    const retry = await sb
      .from('events')
      .select('id, title, starts_at')
      .eq('organiser_id', organiserId)
      .gte('starts_at', startIso)
      .lt('starts_at', until)
      .order('starts_at', { ascending: true })
      .limit(40);
    if (retry.error) throw new Error(retry.error.message);
    events = retry.data || [];
  } else if (primary.error) {
    throw new Error(primary.error.message);
  } else {
    events = primary.data || [];
  }

  const eventIds = events.map((e) => e.id).filter(Boolean);
  let bookings = 0;
  let uniqueGuests = 0;
  if (eventIds.length) {
    const { data: regs, error } = await sb
      .from('registrations')
      .select('id, attendees ( email )')
      .in('event_id', eventIds)
      .is('cancelled_at', null)
      .limit(5000);
    if (!error && regs) {
      bookings = regs.length;
      const emails = new Set();
      regs.forEach((row) => {
        const email = String((row.attendees && row.attendees.email) || '')
          .trim()
          .toLowerCase();
        if (email) emails.add(email);
      });
      uniqueGuests = emails.size;
    }
  }

  let rating = null;
  const org = await sb
    .from('organisers')
    .select('average_rating')
    .eq('id', organiserId)
    .maybeSingle();
  if (!org.error && org.data && org.data.average_rating != null) {
    const n = Number(org.data.average_rating);
    if (Number.isFinite(n) && n > 0) rating = Math.round(n * 10) / 10;
  }

  return {
    eventsHosted: events.length,
    bookings,
    uniqueGuests,
    rating,
    periodLabel: periodLabel(key),
    eventTitles: events.slice(0, 3).map((e) => e.title).filter(Boolean),
  };
}

function buildGreetingHtml(recipient, accentColor) {
  const name = String((recipient && recipient.name) || '').trim();
  const first = name.split(/\s+/)[0] || '';
  const label = first && !/^there$/i.test(first) ? first : 'there';
  const accent = normalizeHexColor(accentColor) || DEFAULT_ACCENT;
  return (
    '<tr><td class="mobile-pad" style="padding:4px 40px 4px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:#1c2040;margin:0 0 4px;">Hi ' +
    escapeHtml(label) +
    ',</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;color:#8a8386;margin:0 0 8px;border-bottom:2px solid ' +
    accent +
    ';padding-bottom:12px;">Your personalised update from the Hub</p>' +
    '</td></tr>'
  );
}

function buildMonthStatsHtml(stats, accentColor) {
  if (!stats) return '';
  const items = [];
  if (stats.eventsHosted > 0) {
    items.push({
      value: String(stats.eventsHosted),
      label: stats.eventsHosted === 1 ? 'event hosted' : 'events hosted',
    });
  }
  if (stats.uniqueGuests > 0) {
    items.push({
      value: String(stats.uniqueGuests),
      label: stats.uniqueGuests === 1 ? 'guest joined' : 'guests joined',
    });
  } else if (stats.bookings > 0) {
    items.push({
      value: String(stats.bookings),
      label: stats.bookings === 1 ? 'booking' : 'bookings',
    });
  }
  if (stats.rating != null) {
    items.push({ value: String(stats.rating), label: 'Hub rating' });
  }
  if (!items.length) return '';
  const accent = normalizeHexColor(accentColor) || DEFAULT_ACCENT;
  const cells = items
    .map(
      (item) =>
        '<td style="width:' +
        Math.floor(100 / items.length) +
        '%;padding:10px 8px;text-align:center;vertical-align:top;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:22px;font-weight:700;color:' +
        accent +
        ';margin:0 0 2px;line-height:1.2;">' +
        escapeHtml(item.value) +
        '</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;color:#635c5e;margin:0;line-height:1.35;">' +
        escapeHtml(item.label) +
        '</p></td>'
    )
    .join('');
  return sectionHtml(
    (stats.periodLabel || 'This month') + ' on the Hub',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafb;border-radius:14px;border:1px solid #e4eef0;">' +
      '<tr>' +
      cells +
      '</tr></table>',
    accent
  );
}

function trackBaseUrl() {
  return publicSiteBase() + '/api/track';
}

function wrapTrackedUrl(url, trackToken) {
  const target = String(url || '').trim();
  if (!trackToken || !target || !/^https?:\/\//i.test(target)) return target;
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

function buildReplyHintHtml(organiserName, replyTo) {
  const name = String(organiserName || 'your organiser').trim();
  const email = String(replyTo || '').trim();
  if (!email) {
    return (
      '<tr><td class="mobile-pad" style="padding:4px 40px 12px;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:#8a8386;margin:0;font-style:italic;">' +
      'Want to reply? Use the Hub contact details on their organiser page.' +
      '</p></td></tr>'
    );
  }
  return (
    '<tr><td class="mobile-pad" style="padding:4px 40px 12px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;color:#635c5e;margin:0;padding:12px 14px;background:#f7fafb;border-radius:12px;border:1px solid #e4eef0;">' +
    '<strong style="color:#1c2040;">Reply to this email</strong> to reach ' +
    escapeHtml(name) +
    ' directly — your message goes to their inbox, not a mail-merge black hole.' +
    '</p></td></tr>'
  );
}

function eventPublicUrl(ev, siteUrl) {
  return (
    siteUrl +
    (ev.slug && !/^[0-9a-f-]{36}$/i.test(ev.slug)
      ? '/events/' + encodeURIComponent(ev.slug)
      : '/events/event?id=' + encodeURIComponent(ev.id))
  );
}

function buildEventsHtml(events, siteUrl, brand, trackToken) {
  if (!events || !events.length) return '';
  const accent = (brand && brand.primary) || DEFAULT_ACCENT;
  const cta = (brand && brand.cta) || DEFAULT_CTA;
  const rows = events
    .map((ev) => {
      const when = ev.startsAt
        ? new Date(ev.startsAt).toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: EVENT_TZ,
          })
        : '';
      const url = wrapTrackedUrl(eventPublicUrl(ev, siteUrl), trackToken);
      const img = String(ev.imageUrl || '').trim();
      const imageCell = img
        ? '<td width="88" style="padding:12px 12px 12px 0;vertical-align:top;">' +
          '<a href="' +
          escapeHtml(url) +
          '" style="text-decoration:none;display:block;">' +
          '<img src="' +
          escapeHtml(img) +
          '" alt="" width="76" height="76" style="display:block;width:76px;height:76px;object-fit:cover;border-radius:12px;border:0;" />' +
          '</a></td>'
        : '';
      return (
        '<tr><td style="padding:4px 0;border-top:1px solid #ece7df;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
        imageCell +
        '<td style="padding:12px 0;vertical-align:middle;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 4px;">' +
        escapeHtml(ev.title || 'Event') +
        '</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;color:#635c5e;margin:0 0 8px;">' +
        escapeHtml([when, ev.location].filter(Boolean).join(' · ')) +
        '</p>' +
        '<a href="' +
        escapeHtml(url) +
        '" style="display:inline-block;padding:8px 14px;background:' +
        cta +
        ';border-radius:999px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;text-decoration:none;">Book your place →</a>' +
        '</td></tr></table></td></tr>'
      );
    })
    .join('');
  return sectionHtml(
    'Coming up — book on the Hub',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
      rows +
      '</table>',
    accent
  );
}

async function listHubAttendeeRecipients(organiserId) {
  const enriched = await listHubAttendeeRecipientsEnriched(organiserId);
  return enriched.map((r) => ({ email: r.email, name: r.name }));
}

async function listHubAttendeeRecipientsEnriched(organiserId) {
  const sb = getSupabaseAdmin();
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id')
    .eq('organiser_id', organiserId);
  if (evErr) throw new Error(evErr.message);
  const eventIds = (events || []).map((e) => e.id).filter(Boolean);
  if (!eventIds.length) return [];

  const { data: regs, error } = await sb
    .from('registrations')
    .select('id, created_at, attendees ( name, email )')
    .in('event_id', eventIds)
    .is('cancelled_at', null)
    .limit(8000);
  if (error) throw new Error(error.message);

  const byEmail = new Map();
  (regs || []).forEach((row) => {
    const att = row.attendees || {};
    const email = String(att.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) return;
    const created = row.created_at ? new Date(row.created_at).getTime() : 0;
    const prev = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, {
        email,
        name: String(att.name || '').trim(),
        bookingCount: 1,
        lastBookedAt: created || 0,
      });
      return;
    }
    prev.bookingCount += 1;
    if (created > prev.lastBookedAt) prev.lastBookedAt = created;
    if (!prev.name && att.name) prev.name = String(att.name || '').trim();
  });
  return [...byEmail.values()];
}

async function listFavouriteNeverBookedRecipients(organiserId) {
  const sb = getSupabaseAdmin();
  const booked = await listHubAttendeeRecipientsEnriched(organiserId);
  const bookedEmails = new Set(booked.map((r) => r.email));

  const { data: favs, error } = await sb
    .from('organiser_favourites')
    .select('attendees ( name, email )')
    .eq('organiser_id', organiserId)
    .limit(5000);
  if (error) {
    if (/organiser_favourites|schema cache|does not exist/i.test(String(error.message || ''))) {
      return [];
    }
    throw new Error(error.message);
  }

  const out = [];
  const seen = new Set();
  (favs || []).forEach((row) => {
    const att = row.attendees || {};
    const email = String(att.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@') || bookedEmails.has(email) || seen.has(email)) return;
    seen.add(email);
    out.push({ email, name: String(att.name || '').trim() });
  });
  return out;
}

async function listRecipientsForSlice(organiserId, slice) {
  const key = normalizeAudienceSlice(slice);
  if (key === 'favourites') return listFavouriteNeverBookedRecipients(organiserId);

  const all = await listHubAttendeeRecipientsEnriched(organiserId);
  if (key === 'once') return all.filter((r) => r.bookingCount === 1);
  if (key === 'recent') {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return all.filter((r) => r.lastBookedAt >= cutoff);
  }
  return all.map((r) => ({ email: r.email, name: r.name }));
}

async function estimateAudienceSlices(organiserId) {
  const [all, favs] = await Promise.all([
    listHubAttendeeRecipientsEnriched(organiserId),
    listFavouriteNeverBookedRecipients(organiserId),
  ]);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    all: all.length,
    once: all.filter((r) => r.bookingCount === 1).length,
    recent: all.filter((r) => r.lastBookedAt >= cutoff).length,
    favourites: favs.length,
  };
}

function buildSpotlightHtml(content, accentColor, trackToken) {
  if (!content.spotlightName && !content.spotlightText) return '';
  const accent = normalizeHexColor(accentColor) || DEFAULT_ACCENT;
  const head = [content.spotlightName, content.spotlightCompany].filter(Boolean).join(' · ');
  let body = '';
  if (head) {
    body +=
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#1c2040;margin:0 0 8px;">' +
      escapeHtml(head) +
      '</p>';
  }
  body += textToHtmlParagraphs(content.spotlightText);
  if (content.spotlightLinkedin) {
    body +=
      '<p style="margin:8px 0 0;"><a href="' +
      escapeHtml(wrapTrackedUrl(content.spotlightLinkedin, trackToken)) +
      '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:' +
      accent +
      ';text-decoration:none;">Connect on LinkedIn →</a></p>';
  }
  return sectionHtml('Member spotlight', body, accent);
}

function buildSocialHtml(group, accentColor, trackToken) {
  const links = [
    ['Website', group.website],
    ['Instagram', group.instagramUrl || group.instagram_url],
    ['Facebook', group.facebookUrl || group.facebook_url],
    ['LinkedIn', group.linkedinUrl || group.linkedin_url],
    ['X', group.xUrl || group.x_url],
  ].filter((pair) => pair[1]);
  if (!links.length) return '';
  const accent = normalizeHexColor(accentColor) || DEFAULT_ACCENT;
  const html = links
    .map(
      ([label, url]) =>
        '<a href="' +
        escapeHtml(wrapTrackedUrl(url, trackToken)) +
        '" style="display:inline-block;margin:0 10px 8px 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:' +
        accent +
        ';text-decoration:none;">' +
        escapeHtml(label) +
        '</a>'
    )
    .join('');
  return sectionHtml('Stay connected', html, accent);
}

async function resolveSelectedEvents(organiserId, content) {
  const upcoming = await listUpcomingEventsForOrganiser(organiserId);
  if (!content.includeUpcomingEvents) return [];
  if (content.eventIds.length) {
    const wanted = new Set(content.eventIds);
    const picked = upcoming.filter((e) => wanted.has(e.id));
    return picked.length ? picked : upcoming.slice(0, 3);
  }
  return upcoming.slice(0, 3);
}

async function buildTemplateVariables({
  group,
  update,
  content,
  events,
  recipient,
  monthStats,
  trackToken,
  replyTo,
}) {
  const siteUrl = publicSiteBase();
  const organiserUrlRaw = siteUrl + '/events/organiser?id=' + encodeURIComponent(group.id);
  const organiserUrl = wrapTrackedUrl(organiserUrlRaw, trackToken);
  const subject =
    clampText(update.subject, MAX_SUBJECT) || defaultSubject(group.name, update.period_key);
  const brand = brandColorsFromGroup(group);
  const organiserLogo = organiserLogoUrlForEmail(
    {
      photo_url: group.photo_url || group.photoUrl || group.imageUrl,
      name: group.name,
    },
    siteUrl
  );
  const stats =
    monthStats ||
    (content.includeMonthStats
      ? await getMonthStatsForOrganiser(group.id, update.period_key)
      : null);
  const replyAddress =
    replyTo || group.contact_email || group.contactEmail || group.email || '';

  return {
    user_name: recipient.name || 'there',
    user_email: recipient.email,
    email_subject: subject,
    organiser_name: group.name || 'Our group',
    organiser_url: organiserUrl,
    organiser_logo_url: organiserLogo,
    organiser_logo_html: buildOrganiserLogoHtml({
      name: group.name || 'Our group',
      logoUrl: organiserLogo,
      organiserUrl,
    }),
    brand_primary: brand.primary,
    brand_cta: brand.cta,
    period_label: periodLabel(update.period_key),
    greeting_html: content.includeGreeting ? buildGreetingHtml(recipient, brand.primary) : '',
    month_stats_html: content.includeMonthStats ? buildMonthStatsHtml(stats, brand.primary) : '',
    organiser_note_html: sectionHtml(
      'A note from us',
      textToHtmlParagraphs(content.organiserNote),
      brand.primary
    ),
    month_recap_html: sectionHtml(
      'Month in brief',
      textToHtmlParagraphs(content.monthRecap),
      brand.primary
    ),
    events_html: buildEventsHtml(events, siteUrl, brand, trackToken),
    spotlight_html: buildSpotlightHtml(content, brand.primary, trackToken),
    ask_html: content.memberAsk
      ? sectionHtml('Member ask', textToHtmlParagraphs(content.memberAsk), brand.primary)
      : '',
    volunteer_html: content.volunteerCta
      ? sectionHtml('Get involved', textToHtmlParagraphs(content.volunteerCta), brand.primary)
      : '',
    social_html: content.includeSocialLinks
      ? buildSocialHtml(group, brand.primary, trackToken)
      : '',
    reply_hint_html: buildReplyHintHtml(group.name || 'your organiser', replyAddress),
    tracking_pixel_html: trackingPixelHtml(trackToken),
    cta_url: organiserUrl,
    cta_label: 'Visit our Hub page',
    hub_account_url: wrapTrackedUrl(siteUrl + '/account', trackToken),
    browse_events_url: wrapTrackedUrl(siteUrl + '/events', trackToken),
    contact_url: siteUrl + '/contact',
    privacy_url: siteUrl + '/privacy',
    terms_url: siteUrl + '/terms',
    site_url: siteUrl,
    unsubscribe_url: unsubscribeUrl(siteUrl),
  };
}

function buildOrganiserLogoHtml({ name, logoUrl, organiserUrl }) {
  const safeName = escapeHtml(name || 'Your group');
  const href = escapeHtml(organiserUrl || '#');
  if (logoUrl) {
    return (
      '<a href="' +
      href +
      '" style="text-decoration:none;display:inline-block;margin:0 0 14px;">' +
      '<img src="' +
      escapeHtml(logoUrl) +
      '" alt="' +
      safeName +
      '" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border:0;border-radius:50%;margin:0 auto;box-shadow:0 4px 14px rgba(28,32,64,0.12);" />' +
      '</a>'
    );
  }
  const initial = escapeHtml(String(name || '?').trim().charAt(0).toUpperCase() || '?');
  return (
    '<a href="' +
    href +
    '" style="text-decoration:none;display:inline-block;margin:0 0 14px;">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr>' +
    '<td style="width:72px;height:72px;background:#d9eef1;border-radius:50%;text-align:center;vertical-align:middle;' +
    'font-family:\'DM Sans\',system-ui,sans-serif;font-size:28px;font-weight:700;color:#0d6e7a;line-height:72px;">' +
    initial +
    '</td></tr></table></a>'
  );
}

/** Inbox-style HTML for the organiser workspace preview pane. */
function buildPreviewDocument(variables) {
  const v = variables || {};
  const logo = logoNavUrl(v.site_url || publicSiteBase());
  const accent = normalizeHexColor(v.brand_primary) || DEFAULT_ACCENT;
  const cta = normalizeHexColor(v.brand_cta) || DEFAULT_CTA;
  const sections = [
    v.greeting_html,
    v.month_stats_html,
    v.organiser_note_html,
    v.month_recap_html,
    v.events_html,
    v.spotlight_html,
    v.ask_html,
    v.volunteer_html,
    v.social_html,
    v.reply_hint_html,
  ]
    .filter(Boolean)
    .join('');

  return (
    '<div class="ogu-mail" style="font-family:\'DM Sans\',system-ui,sans-serif;background:#e8ecf5;padding:16px 12px 20px;border-radius:12px;">' +
    '<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(28,32,64,0.12);">' +
    '<div style="background:#f5f0e8;padding:20px 22px 8px;text-align:center;">' +
    '<img src="' +
    escapeHtml(logo) +
    '" alt="The Networker Hub" width="160" style="height:auto;max-width:160px;margin:0 auto;display:block;" onerror="this.style.display=\'none\'" />' +
    '</div>' +
    '<div style="background:#f5f0e8;height:18px;border-radius:0 0 50% 50% / 0 0 100% 100%;"></div>' +
    '<div style="padding:18px 22px 8px;text-align:center;">' +
    (v.organiser_logo_html || '') +
    '<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' +
    accent +
    ';">' +
    escapeHtml(v.period_label || 'This month') +
    '</p>' +
    '<h2 style="margin:0 0 4px;font-size:20px;line-height:1.25;font-weight:600;color:#1c2040;">Update from ' +
    escapeHtml(v.organiser_name || 'Your group') +
    '</h2>' +
    '<p style="margin:0 0 12px;font-size:12px;color:#8a8386;">Subject: ' +
    escapeHtml(v.email_subject || '') +
    '</p>' +
    '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">' +
    sections +
    '</table>' +
    '<div style="padding:8px 22px 22px;text-align:center;">' +
    '<a href="' +
    escapeHtml(v.cta_url || '#') +
    '" style="display:inline-block;padding:11px 22px;background:' +
    cta +
    ';border-radius:999px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">' +
    escapeHtml(v.cta_label || 'Visit our Hub page') +
    ' →</a>' +
    '</div>' +
    '<div style="background:#1c2040;padding:18px 20px 22px;text-align:center;color:rgba(255,255,255,0.65);font-size:11px;line-height:1.5;">' +
    '<p style="margin:0 0 6px;">Sent via The Networker Hub</p>' +
    '<p style="margin:0 0 8px;opacity:0.75;">You received this because you booked with ' +
    escapeHtml(v.organiser_name || 'this group') +
    '.</p>' +
    '<p style="margin:0;opacity:0.85;"><a href="' +
    escapeHtml(v.unsubscribe_url || '#') +
    '" style="color:rgba(255,255,255,0.85);">Manage email preferences</a></p>' +
    '</div>' +
    '</div>' +
    '</div>'
  );
}

async function saveDraft({ organiserId, updateId, subject, content, audience }) {
  const sb = getSupabaseAdmin();
  const key = periodKey();
  const normalized = normalizeContent(content);
  const { data: group, error: gErr } = await sb
    .from('organisers')
    .select('*')
    .eq('id', organiserId)
    .maybeSingle();
  if (gErr) throw new Error(gErr.message);
  if (!group) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }

  const payload = {
    organiser_id: organiserId,
    status: 'draft',
    period_key: key,
    subject: clampText(subject, MAX_SUBJECT) || defaultSubject(group.name, key),
    content: normalized,
    audience: ['hub_attendees', 'roster', 'both'].includes(audience) ? audience : 'hub_attendees',
    updated_at: new Date().toISOString(),
  };

  let targetId = updateId || null;
  if (targetId) {
    const existing = await getUpdate(targetId);
    if (!existing || existing.organiser_id !== organiserId || existing.status !== 'draft') {
      targetId = null;
    }
  }

  // One working draft per organiser per month — reuse it if the client lost the id.
  if (!targetId) {
    const { data: existingDrafts, error: findErr } = await sb
      .from('organiser_group_updates')
      .select('id')
      .eq('organiser_id', organiserId)
      .eq('period_key', key)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (findErr) throwGroupUpdatesDbError(findErr);
    if (existingDrafts && existingDrafts[0]) targetId = existingDrafts[0].id;
  }

  if (targetId) {
    const { data, error } = await sb
      .from('organiser_group_updates')
      .update(payload)
      .eq('id', targetId)
      .select('*')
      .single();
    if (error) throwGroupUpdatesDbError(error);
    return data;
  }

  const { data, error } = await sb
    .from('organiser_group_updates')
    .insert(payload)
    .select('*')
    .single();
  if (error) throwGroupUpdatesDbError(error);
  return data;
}

async function queueUpdateSend({ organiserId, updateId }) {
  const sb = getSupabaseAdmin();
  const allowance = await getAllowance(organiserId);
  if (!allowance.canSend) {
    const err = new Error(
      allowance.blockedReason === 'hard_cap'
        ? 'Monthly send limit reached (max ' + HARD_CAP_PER_MONTH + ').'
        : 'No free sends left this month. Buy an extra credit below, or wait until next month.'
    );
    err.status = 402;
    err.code = allowance.blockedReason || 'allowance_exhausted';
    throw err;
  }

  const update = await getUpdate(updateId);
  if (!update || update.organiser_id !== organiserId) {
    const err = new Error('update_not_found');
    err.status = 404;
    throw err;
  }
  if (update.status !== 'draft') {
    const err = new Error('already_sent_or_queued');
    err.status = 400;
    throw err;
  }

  const content = normalizeContent(update.content);
  if (!content.organiserNote && !content.monthRecap && !content.includeUpcomingEvents) {
    const err = new Error('Add a short organiser note, a month recap, or upcoming events before sending.');
    err.status = 400;
    throw err;
  }

  const recipients = await listRecipientsForSlice(organiserId, content.audienceSlice);
  if (!recipients.length) {
    const err = new Error(
      content.audienceSlice === 'favourites'
        ? 'No favourited-but-never-booked people found for this slice yet.'
        : content.audienceSlice === 'once'
          ? 'No one-time bookers found for this slice yet.'
          : content.audienceSlice === 'recent'
            ? 'No recent bookers (last 30 days) found for this slice yet.'
            : 'No Hub attendees found for this group yet.'
    );
    err.status = 400;
    throw err;
  }

  const useExtra = allowance.nextBillable === 'extra';
  const now = Date.now();
  const gap = Math.max(
    QUEUE_MIN_GAP_MS,
    Math.floor(QUEUE_SPREAD_MS / Math.max(1, recipients.length))
  );
  const crypto = require('crypto');
  const rows = recipients.map((r, idx) => ({
    update_id: updateId,
    organiser_id: organiserId,
    email: r.email,
    recipient_name: r.name || '',
    scheduled_for: new Date(now + idx * gap).toISOString(),
    tracking_token: crypto.randomUUID(),
  }));

  let qErr;
  ({ error: qErr } = await sb.from('organiser_group_update_queue').insert(rows));
  if (qErr && /tracking_token/i.test(String(qErr.message || ''))) {
    // Migration 218 not applied yet — queue without tracking tokens.
    ({ error: qErr } = await sb.from('organiser_group_update_queue').insert(
      rows.map(({ tracking_token, ...rest }) => rest)
    ));
  }
  if (qErr) throwGroupUpdatesDbError(qErr);

  if (useExtra) {
    try {
      const { data: org, error: creditErr } = await sb
        .from('organisers')
        .select('group_update_extra_credits')
        .eq('id', organiserId)
        .maybeSingle();
      if (creditErr && /group_update_extra_credits/i.test(String(creditErr.message || ''))) {
        const err = new Error(
          'No free sends left this month. Extra credits aren’t available yet — try again next month.'
        );
        err.status = 402;
        err.code = 'no_credits';
        throw err;
      }
      if (creditErr) throw new Error(creditErr.message);
      const next = Math.max(0, (Number(org && org.group_update_extra_credits) || 0) - 1);
      const { error: upErr } = await sb
        .from('organisers')
        .update({ group_update_extra_credits: next })
        .eq('id', organiserId);
      if (upErr && /group_update_extra_credits/i.test(String(upErr.message || ''))) {
        const err = new Error(
          'No free sends left this month. Extra credits aren’t available yet — try again next month.'
        );
        err.status = 402;
        err.code = 'no_credits';
        throw err;
      }
      if (upErr) throw new Error(upErr.message);
    } catch (e) {
      if (e.status) throw e;
      throw e;
    }
  }

  const { data: updated, error } = await sb
    .from('organiser_group_updates')
    .update({
      status: 'queued',
      recipient_count: recipients.length,
      used_free_allowance: !useExtra,
      used_extra_credit: useExtra,
      queued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', updateId)
    .select('*')
    .single();
  if (error) throwGroupUpdatesDbError(error);
  return { update: updated, recipientCount: recipients.length, allowance: await getAllowance(organiserId) };
}

async function processDueGroupUpdateEmails(sb, { batchSize } = {}) {
  const limit = Math.min(80, Math.max(1, Number(batchSize) || 40));
  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from('organiser_group_update_queue')
    .select('*')
    .is('sent_at', null)
    .is('failed_at', null)
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!due || !due.length) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const updateCache = new Map();
  const groupCache = new Map();

  for (const row of due) {
    try {
      let update = updateCache.get(row.update_id);
      if (!update) {
        update = await getUpdate(row.update_id);
        updateCache.set(row.update_id, update);
      }
      if (!update || update.status === 'cancelled') {
        await sb
          .from('organiser_group_update_queue')
          .update({ failed_at: nowIso, last_error: 'update_cancelled' })
          .eq('id', row.id);
        failed++;
        continue;
      }

      let group = groupCache.get(row.organiser_id);
      if (!group) {
        const { data: g } = await sb.from('organisers').select('*').eq('id', row.organiser_id).maybeSingle();
        group = g;
        groupCache.set(row.organiser_id, group);
      }
      if (!group) {
        await sb
          .from('organiser_group_update_queue')
          .update({ failed_at: nowIso, last_error: 'organiser_missing' })
          .eq('id', row.id);
        failed++;
        continue;
      }

      const content = normalizeContent(update.content);
      const events = await resolveSelectedEvents(row.organiser_id, content);
      const replyTo = group.contact_email || group.email || undefined;
      const trackToken = row.tracking_token || null;
      const variables = await buildTemplateVariables({
        group: {
          ...group,
          website: group.website,
          instagramUrl: group.instagram_url,
          facebookUrl: group.facebook_url,
          linkedinUrl: group.linkedin_url,
          xUrl: group.x_url,
          brandPrimaryColor: group.brand_primary_color,
          brandSecondaryColor: group.brand_secondary_color,
          brandAccentColor: group.brand_accent_color,
          photo_url: group.photo_url,
        },
        update,
        content,
        events,
        recipient: { email: row.email, name: row.recipient_name },
        trackToken,
        replyTo,
      });

      const sendResult = await sendTemplatedEmail({
        slug: SLUG,
        to: row.email,
        subject: variables.email_subject,
        variables,
        replyTo,
        resendTags: [
          { name: 'email_type', value: 'organiser_monthly_group_update' },
          { name: 'organiser_id', value: String(row.organiser_id).slice(0, 36) },
          { name: 'update_id', value: String(row.update_id).slice(0, 36) },
        ],
      });

      const sentPatch = {
        sent_at: new Date().toISOString(),
        last_error: null,
      };
      if (sendResult && sendResult.id) sentPatch.resend_email_id = String(sendResult.id);
      await sb.from('organiser_group_update_queue').update(sentPatch).eq('id', row.id);
      sent++;
    } catch (e) {
      const code = e && e.code;
      const msg = String((e && e.message) || 'send_failed').slice(0, 240);
      if (code === 'emails_disabled') {
        await sb
          .from('organiser_group_update_queue')
          .update({ failed_at: new Date().toISOString(), last_error: 'emails_disabled' })
          .eq('id', row.id);
      } else {
        await sb
          .from('organiser_group_update_queue')
          .update({ failed_at: new Date().toISOString(), last_error: msg })
          .eq('id', row.id);
      }
      failed++;
    }
  }

  const touched = [...new Set(due.map((r) => r.update_id))];
  for (const updateId of touched) {
    const { count: sentCount } = await sb
      .from('organiser_group_update_queue')
      .select('id', { count: 'exact', head: true })
      .eq('update_id', updateId)
      .not('sent_at', 'is', null);
    const { count: failedCount } = await sb
      .from('organiser_group_update_queue')
      .select('id', { count: 'exact', head: true })
      .eq('update_id', updateId)
      .not('failed_at', 'is', null);
    const { count: pendingCount } = await sb
      .from('organiser_group_update_queue')
      .select('id', { count: 'exact', head: true })
      .eq('update_id', updateId)
      .is('sent_at', null)
      .is('failed_at', null);

    const patch = {
      sent_count: Number(sentCount) || 0,
      failed_count: Number(failedCount) || 0,
      skipped_count: 0,
      updated_at: new Date().toISOString(),
    };
    if (!(Number(pendingCount) > 0)) {
      patch.status = 'sent';
      patch.sent_at = new Date().toISOString();
    } else {
      patch.status = 'sending';
    }
    await sb.from('organiser_group_updates').update(patch).eq('id', updateId);
  }

  return { processed: due.length, sent, failed };
}

async function drainDueGroupUpdateEmails(sb, opts) {
  const maxBatches = Math.min(12, Math.max(1, Number(opts && opts.maxBatches) || 6));
  const maxRuntimeMs = Math.min(50000, Math.max(5000, Number(opts && opts.maxRuntimeMs) || 25000));
  const started = Date.now();
  let batches = 0;
  let sent = 0;
  let failed = 0;
  while (batches < maxBatches && Date.now() - started < maxRuntimeMs) {
    const result = await processDueGroupUpdateEmails(sb, opts);
    batches++;
    sent += result.sent;
    failed += result.failed;
    if (!result.processed) break;
  }
  return { batches, sent, failed };
}

async function getEngagementReport(updateId, organiserId) {
  const sb = getSupabaseAdmin();
  const update = await getUpdate(updateId);
  if (!update || String(update.organiser_id) !== String(organiserId)) {
    const err = new Error('update_not_found');
    err.status = 404;
    throw err;
  }

  const { data: queueRows, error } = await sb
    .from('organiser_group_update_queue')
    .select('email, sent_at, failed_at, opened_at, open_count, clicked_at, click_count')
    .eq('update_id', updateId);
  if (error && !/opened_at|schema cache|does not exist/i.test(String(error.message || ''))) {
    throw new Error(error.message);
  }
  const rows = queueRows || [];
  const sentRows = rows.filter((r) => r.sent_at);
  const opened = sentRows.filter((r) => r.opened_at).length;
  const clicked = sentRows.filter((r) => r.clicked_at).length;
  const failed = rows.filter((r) => r.failed_at).length;
  const pending = rows.filter((r) => !r.sent_at && !r.failed_at).length;

  let topLinks = [];
  const linksRes = await sb
    .from('organiser_group_update_link_clicks')
    .select('url, click_count')
    .eq('update_id', updateId)
    .order('click_count', { ascending: false })
    .limit(8);
  if (!linksRes.error) topLinks = linksRes.data || [];

  let bookingsAfter = 0;
  const queuedAt = update.queued_at || update.sent_at || update.created_at;
  if (queuedAt && sentRows.length) {
    const emails = sentRows.map((r) => String(r.email || '').toLowerCase()).filter(Boolean);
    const { data: events } = await sb.from('events').select('id').eq('organiser_id', organiserId);
    const eventIds = (events || []).map((e) => e.id).filter(Boolean);
    if (eventIds.length && emails.length) {
      const { data: regs } = await sb
        .from('registrations')
        .select('id, created_at, attendees ( email )')
        .in('event_id', eventIds)
        .is('cancelled_at', null)
        .gte('created_at', queuedAt)
        .limit(5000);
      const emailSet = new Set(emails);
      const seen = new Set();
      (regs || []).forEach((row) => {
        const email = String((row.attendees && row.attendees.email) || '')
          .trim()
          .toLowerCase();
        if (!email || !emailSet.has(email) || seen.has(email)) return;
        seen.add(email);
        bookingsAfter += 1;
      });
    }
  }

  const sentCount = sentRows.length;
  return {
    updateId,
    status: update.status,
    subject: update.subject,
    queuedAt,
    sentAt: update.sent_at,
    audienceSlice: normalizeAudienceSlice(
      (update.content && (update.content.audienceSlice || update.content.audience_slice)) || 'all'
    ),
    recipientCount: Number(update.recipient_count) || rows.length,
    sent: sentCount,
    pending,
    failed,
    opened,
    clicked,
    openRate: sentCount ? Math.round((opened / sentCount) * 1000) / 10 : 0,
    clickRate: sentCount ? Math.round((clicked / sentCount) * 1000) / 10 : 0,
    bookingsAfter,
    topLinks: topLinks.map((l) => ({
      url: l.url,
      clicks: Number(l.click_count) || 0,
    })),
  };
}

module.exports = {
  SLUG,
  FREE_PER_MONTH,
  HARD_CAP_PER_MONTH,
  periodKey,
  periodLabel,
  normalizeContent,
  defaultSubject,
  getAllowance,
  listUpdatesForOrganiser,
  getUpdate,
  listUpcomingEventsForOrganiser,
  listHubAttendeeRecipients,
  listRecipientsForSlice,
  estimateAudienceSlices,
  listAudienceSlices,
  saveDraft,
  queueUpdateSend,
  processDueGroupUpdateEmails,
  drainDueGroupUpdateEmails,
  buildTemplateVariables,
  buildPreviewDocument,
  resolveSelectedEvents,
  getMonthStatsForOrganiser,
  getEngagementReport,
};
