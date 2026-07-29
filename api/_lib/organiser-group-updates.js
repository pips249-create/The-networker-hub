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
const { publicSiteBase, unsubscribeUrl } = require('./hub-email-urls');
const { publicOrganiserSlug } = require('./organiser-slug');
const { eventImageUrl } = require('./event-image');

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

function sectionHtml(title, bodyHtml) {
  if (!bodyHtml) return '';
  return (
    '<tr><td class="mobile-pad" style="padding:8px 40px 16px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#0d6e7a;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">' +
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
    includeUpcomingEvents: c.includeUpcomingEvents !== false,
    eventIds,
    spotlightName: clampText(c.spotlightName, 80),
    spotlightCompany: clampText(c.spotlightCompany, 80),
    spotlightText: clampText(c.spotlightText, MAX_SPOTLIGHT),
    spotlightLinkedin: clampText(c.spotlightLinkedin, 200),
    memberAsk: clampText(c.memberAsk, MAX_ASK),
    volunteerCta: clampText(c.volunteerCta, MAX_VOLUNTEER),
    includeSocialLinks: c.includeSocialLinks !== false,
  };
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
  if (error) throw new Error(error.message);
  return Number(count) || 0;
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

async function listUpdatesForOrganiser(organiserId, limit) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_group_updates')
    .select('*')
    .eq('organiser_id', organiserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(40, Math.max(1, Number(limit) || 12)));
  if (error) throw new Error(error.message);
  return data || [];
}

async function getUpdate(updateId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_group_updates')
    .select('*')
    .eq('id', updateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function listUpcomingEventsForOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  // events use status + approval_status (listing_status is on organisers).
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at, slug, venue, city, location_label, status, approval_status')
    .eq('organiser_id', organiserId)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(12);
  if (error) {
    // Fallback if status filter shape differs in an older DB.
    if (/column events\.(status|approval_status)/i.test(String(error.message || ''))) {
      const retry = await sb
        .from('events')
        .select('id, title, starts_at, slug, venue, city, location_label')
        .eq('organiser_id', organiserId)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(12);
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.starts_at,
        slug: row.slug,
        location: String(row.location_label || row.city || row.venue || '').trim(),
        imageUrl: eventImageUrl(row),
      }));
    }
    throw new Error(error.message);
  }
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    slug: row.slug,
    location: String(row.location_label || row.city || row.venue || '').trim(),
    imageUrl: eventImageUrl(row),
  }));
}

async function listHubAttendeeRecipients(organiserId) {
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
    .select('id, attendees ( name, email )')
    .in('event_id', eventIds)
    .is('cancelled_at', null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const byEmail = new Map();
  (regs || []).forEach((row) => {
    const att = row.attendees || {};
    const email = String(att.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) return;
    if (byEmail.has(email)) return;
    byEmail.set(email, {
      email,
      name: String(att.name || '').trim(),
    });
  });
  return [...byEmail.values()];
}

function buildEventsHtml(events, siteUrl) {
  if (!events || !events.length) return '';
  const rows = events
    .map((ev) => {
      const when = ev.startsAt
        ? new Date(ev.startsAt).toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const url =
        siteUrl +
        (ev.slug && !/^[0-9a-f-]{36}$/i.test(ev.slug)
          ? '/events/' + encodeURIComponent(ev.slug)
          : '/events/event?id=' + encodeURIComponent(ev.id));
      return (
        '<tr><td style="padding:10px 0;border-top:1px solid #ece7df;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 4px;">' +
        escapeHtml(ev.title || 'Event') +
        '</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;color:#635c5e;margin:0 0 6px;">' +
        escapeHtml([when, ev.location].filter(Boolean).join(' · ')) +
        '</p>' +
        '<a href="' +
        escapeHtml(url) +
        '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:#0d6e7a;text-decoration:none;">Book / details →</a>' +
        '</td></tr>'
      );
    })
    .join('');
  return sectionHtml(
    'Coming up',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
      rows +
      '</table>'
  );
}

function buildSpotlightHtml(content) {
  if (!content.spotlightName && !content.spotlightText) return '';
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
      escapeHtml(content.spotlightLinkedin) +
      '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:#0d6e7a;text-decoration:none;">Connect on LinkedIn →</a></p>';
  }
  return sectionHtml('Member spotlight', body);
}

function buildSocialHtml(group) {
  const links = [
    ['Website', group.website],
    ['Instagram', group.instagramUrl || group.instagram_url],
    ['Facebook', group.facebookUrl || group.facebook_url],
    ['LinkedIn', group.linkedinUrl || group.linkedin_url],
    ['X', group.xUrl || group.x_url],
  ].filter((pair) => pair[1]);
  if (!links.length) return '';
  const html = links
    .map(
      ([label, url]) =>
        '<a href="' +
        escapeHtml(url) +
        '" style="display:inline-block;margin:0 10px 8px 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;color:#0d6e7a;text-decoration:none;">' +
        escapeHtml(label) +
        '</a>'
    )
    .join('');
  return sectionHtml('Stay connected', html);
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

async function buildTemplateVariables({ group, update, content, events, recipient }) {
  const siteUrl = publicSiteBase();
  const slug = publicOrganiserSlug(group) || group.id;
  const organiserUrl = siteUrl + '/events/organiser?id=' + encodeURIComponent(group.id);
  const subject =
    clampText(update.subject, MAX_SUBJECT) || defaultSubject(group.name, update.period_key);

  return {
    user_name: recipient.name || 'there',
    user_email: recipient.email,
    email_subject: subject,
    organiser_name: group.name || 'Our group',
    organiser_url: organiserUrl,
    period_label: periodLabel(update.period_key),
    organiser_note_html: sectionHtml('A note from us', textToHtmlParagraphs(content.organiserNote)),
    month_recap_html: sectionHtml('Month in brief', textToHtmlParagraphs(content.monthRecap)),
    events_html: buildEventsHtml(events, siteUrl),
    spotlight_html: buildSpotlightHtml(content),
    ask_html: content.memberAsk
      ? sectionHtml('Member ask', textToHtmlParagraphs(content.memberAsk))
      : '',
    volunteer_html: content.volunteerCta
      ? sectionHtml('Get involved', textToHtmlParagraphs(content.volunteerCta))
      : '',
    social_html: content.includeSocialLinks ? buildSocialHtml(group) : '',
    cta_url: siteUrl + '/events',
    cta_label: 'Browse events on the Hub',
    hub_account_url: siteUrl + '/account',
    browse_events_url: siteUrl + '/events',
    contact_url: siteUrl + '/contact',
    privacy_url: siteUrl + '/privacy',
    terms_url: siteUrl + '/terms',
    site_url: siteUrl,
    unsubscribe_url: unsubscribeUrl(siteUrl),
  };
}

/** Inbox-style HTML for the organiser workspace preview pane. */
function buildPreviewDocument(variables) {
  const v = variables || {};
  const logo = String(v.site_url || '').replace(/\/$/, '') + '/images/logo-nav.png';
  const sections = [
    v.organiser_note_html,
    v.month_recap_html,
    v.events_html,
    v.spotlight_html,
    v.ask_html,
    v.volunteer_html,
    v.social_html,
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
    '<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0d6e7a;">' +
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
    '" style="display:inline-block;padding:11px 22px;background:#4aa8f0;border-radius:999px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">' +
    escapeHtml(v.cta_label || 'Browse events') +
    ' →</a>' +
    '</div>' +
    '<div style="background:#1c2040;padding:18px 20px 22px;text-align:center;color:rgba(255,255,255,0.65);font-size:11px;line-height:1.5;">' +
    '<p style="margin:0 0 6px;">Sent via The Networker Hub</p>' +
    '<p style="margin:0;opacity:0.75;">You received this because you booked with ' +
    escapeHtml(v.organiser_name || 'this group') +
    '.</p>' +
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
    if (findErr) throw new Error(findErr.message);
    if (existingDrafts && existingDrafts[0]) targetId = existingDrafts[0].id;
  }

  if (targetId) {
    const { data, error } = await sb
      .from('organiser_group_updates')
      .update(payload)
      .eq('id', targetId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await sb
    .from('organiser_group_updates')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function queueUpdateSend({ organiserId, updateId }) {
  const sb = getSupabaseAdmin();
  const allowance = await getAllowance(organiserId);
  if (!allowance.canSend) {
    const err = new Error(
      allowance.blockedReason === 'hard_cap'
        ? 'Monthly send limit reached (max ' + HARD_CAP_PER_MONTH + ').'
        : 'No free sends left this month. Extra credits coming soon — or wait until next month.'
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

  const recipients = await listHubAttendeeRecipients(organiserId);
  if (!recipients.length) {
    const err = new Error('No Hub attendees found for this group yet.');
    err.status = 400;
    throw err;
  }

  const useExtra = allowance.nextBillable === 'extra';
  const now = Date.now();
  const gap = Math.max(
    QUEUE_MIN_GAP_MS,
    Math.floor(QUEUE_SPREAD_MS / Math.max(1, recipients.length))
  );
  const rows = recipients.map((r, idx) => ({
    update_id: updateId,
    organiser_id: organiserId,
    email: r.email,
    recipient_name: r.name || '',
    scheduled_for: new Date(now + idx * gap).toISOString(),
  }));

  const { error: qErr } = await sb.from('organiser_group_update_queue').insert(rows);
  if (qErr) throw new Error(qErr.message);

  if (useExtra) {
    try {
      const { data: org, error: creditErr } = await sb
        .from('organisers')
        .select('group_update_extra_credits')
        .eq('id', organiserId)
        .maybeSingle();
      if (creditErr && /group_update_extra_credits/i.test(String(creditErr.message || ''))) {
        const err = new Error(
          'Extra credits are not available yet — run migration 212 (group_update_extra_credits).'
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
          'Extra credits are not available yet — run migration 212 (group_update_extra_credits).'
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
  if (error) throw new Error(error.message);
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
      const variables = await buildTemplateVariables({
        group: {
          ...group,
          website: group.website,
          instagramUrl: group.instagram_url,
          facebookUrl: group.facebook_url,
          linkedinUrl: group.linkedin_url,
          xUrl: group.x_url,
        },
        update,
        content,
        events,
        recipient: { email: row.email, name: row.recipient_name },
      });

      await sendTemplatedEmail({
        slug: SLUG,
        to: row.email,
        subject: variables.email_subject,
        variables,
        replyTo: group.contact_email || group.email || undefined,
        resendTags: [
          { name: 'email_type', value: 'organiser_monthly_group_update' },
          { name: 'organiser_id', value: String(row.organiser_id).slice(0, 36) },
        ],
      });

      await sb
        .from('organiser_group_update_queue')
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id);
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
  saveDraft,
  queueUpdateSend,
  processDueGroupUpdateEmails,
  drainDueGroupUpdateEmails,
  buildTemplateVariables,
  buildPreviewDocument,
  resolveSelectedEvents,
};
