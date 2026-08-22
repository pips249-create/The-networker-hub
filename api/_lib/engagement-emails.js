/**
 * Engagement + nurture emails run on a daily cron.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { computeLiveRankingIndex } = require('./organiser-ranking-snapshot');
const { isEventPublishedForSale } = require('./ticket-sales');
const { formatEventDateTime } = require('./favourite-sales-emails');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const {
  baseEmailVars,
  buildPostEventReviewEmailVars,
  hubPaymentUrl,
  eventPublicUrl,
} = require('./lifecycle-emails');
const {
  siteBase,
  browseEventsUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
} = require('./hub-email-urls');
const {
  fetchNearbyEvents,
  fetchPopularEvents,
  nearbySectionHeading,
  nearbyLocationLabel,
} = require('./nearby-events');
const { escapeHtml } = require('./event-refund-policy');
const { claimRowTimestamp, releaseRowTimestamp } = require('./email-send-claim');

function accountSettingsUrl(siteUrl) {
  return String(siteUrl || siteBase()).replace(/\/$/, '') + '/account/settings/';
}

/** "near Manchester" when a profile location is set, otherwise "near you". */
function nearLocationPhrase(location) {
  const label = nearbyLocationLabel(location);
  if (!label) return 'near you';
  return 'near ' + label;
}

/** Soft CTA when the attendee has no city/postcode saved yet. */
function locationTipHtml(siteUrl, location) {
  if (String(location || '').trim()) return '';
  const href = accountSettingsUrl(siteUrl);
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;background:#f7f4fb;border:1px solid rgba(69,45,92,0.12);border-radius:10px;">' +
    '<tr><td style="padding:16px 18px;text-align:left;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#452d5c;margin:0 0 6px;">Add your city or postcode</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.55;color:#635c5e;margin:0 0 12px;">Tell us where you are so we can pick events near you next time — takes about 10 seconds.</p>' +
    '<a href="' +
    href +
    '" style="display:inline-block;padding:10px 18px;background:#5b2f99;border-radius:8px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">Add location in Account settings &rarr;</a>' +
    '</td></tr></table>'
  );
}

/** Hubert digest footer — acknowledge saved location instead of always asking for it. */
function hubertLocationFooterHtml(siteUrl, location) {
  const href = accountSettingsUrl(siteUrl);
  const label = nearbyLocationLabel(location);
  if (label) {
    return (
      'Picks based on <strong style="color:#635c5e;">' +
      escapeHtml(label) +
      '</strong>. Change your location in <a href="' +
      href +
      '" style="color:#5b2f99;font-weight:600;text-decoration:none;">account settings</a> anytime. You receive this digest because marketing emails are turned on.'
    );
  }
  return (
    'Update your location in <a href="' +
    href +
    '" style="color:#5b2f99;font-weight:600;text-decoration:none;">account settings</a> to refine nearby picks. You receive this digest because marketing emails are turned on.'
  );
}

const REENGAGEMENT_INACTIVE_DAYS = 30;
const REENGAGEMENT_COOLDOWN_DAYS = 60;
const LOW_EVENTS_MAX_UPCOMING = 3;
const LOW_EVENTS_NUDGE_COOLDOWN_DAYS = 30;
const POST_EVENT_REVIEW_HOURS = 24;
// Catch up missed sends (e.g. if cron skipped a day) up to this age.
const POST_EVENT_REVIEW_MAX_AGE_DAYS = 14;
const POST_EVENT_REVIEW_BATCH_LIMIT = 75;
/** Day after the ~24h review ask — avoids guest conversion + review landing minutes apart. */
const GUEST_VISIT_FOLLOWUP_HOURS = 48;
const GUEST_VISIT_FOLLOWUP_MAX_AGE_DAYS = 14;
const GUEST_VISIT_FOLLOWUP_BATCH_LIMIT = 50;
const CATEGORY_EXCLUSIVITY_PAYMENT_REMINDER_HOURS = 48;
const STRIPE_NUDGE_COOLDOWN_DAYS = 14;
const SIGNUP_NUDGE_DELAY_DAYS = 3;
const SIGNUP_NUDGE_MAX_AGE_DAYS = 60;
/** Second nurture ~10 days after signup (after the day-3 nudge). */
const SIGNUP_NUDGE_FOLLOWUP_DELAY_DAYS = 10;
const SIGNUP_NUDGE_FOLLOWUP_MAX_AGE_DAYS = 60;
/** Skip Hubert if a signup nurture email landed this recently (avoids same-day doubles). */
const HUBERT_AFTER_NURTURE_COOLDOWN_DAYS = 7;
const HUBERT_CONCIERGE_BATCH_LIMIT = 50;
const REENGAGEMENT_BATCH_LIMIT = 25;

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function recommendationCard(title, subtitle, url) {
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:14px;margin:0 0 12px;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0 0 6px;line-height:1.35;">' +
    title +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:rgba(255,255,255,0.7);margin:0 0 12px;line-height:1.5;">' +
    subtitle +
    '</p>' +
    '<a href="' +
    url +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-decoration:none;">View &rarr;</a>' +
    '</td></tr></table>'
  );
}

function sectionHeading(text) {
  return (
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">' +
    text +
    '</p>'
  );
}

function eventRecommendationSubtitle(ev) {
  const { event_date, event_time } = formatEventDateTime(ev.starts_at);
  const loc = String(ev.location_label || ev.venue || ev.city || '').trim() || 'See event page';
  const orgName = String(ev.organisers?.name || 'Organiser').trim();
  return (
    orgName +
    ' · ' +
    event_date +
    (event_time ? ' · ' + event_time : '') +
    ' · ' +
    loc
  );
}

async function buildSignupNudgeEventsHtml(sb, attendeeLocation) {
  const siteUrl = siteBase();
  const nearbyResult = await fetchNearbyEvents(sb, attendeeLocation, { limit: 5 });
  const nearbyIds = nearbyResult.events.map((ev) => ev.id);
  const popularResult = await fetchPopularEvents(sb, {
    limit: 3,
    excludeEventIds: nearbyIds,
  });

  const nearbyParts = [];
  if (nearbyResult.events.length) {
    nearbyParts.push(sectionHeading(nearbySectionHeading(nearbyResult)));
    for (const ev of nearbyResult.events) {
      nearbyParts.push(
        recommendationCard(
          String(ev.title || 'Event').trim(),
          eventRecommendationSubtitle(ev),
          eventPublicUrl(ev, siteUrl)
        )
      );
    }
  }

  const popularParts = [];
  if (popularResult.events.length) {
    popularParts.push(sectionHeading('Popular right now'));
    for (const ev of popularResult.events) {
      popularParts.push(
        recommendationCard(
          String(ev.title || 'Event').trim(),
          eventRecommendationSubtitle(ev),
          eventPublicUrl(ev, siteUrl)
        )
      );
    }
  }

  return {
    nearby_events_html: nearbyParts.join(''),
    popular_events_html: popularParts.join(''),
  };
}

async function buildRecommendationsHtml(sb, attendeeLocation) {
  const siteUrl = siteBase();
  const now = new Date().toISOString();
  const parts = [];

  const rankingIndex = await computeLiveRankingIndex(sb);
  const topOrganisers = [...rankingIndex.values()]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  const organiserIds = topOrganisers.map((row) => row.organiserId).filter(Boolean);
  let eventsByOrganiser = new Map();

  if (organiserIds.length) {
    const { data: events, error } = await sb
      .from('events')
      .select(
        'id, title, slug, starts_at, city, venue, location_label, organiser_id, status, approval_status, published_at'
      )
      .in('organiser_id', organiserIds)
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .gt('starts_at', now)
      .order('starts_at', { ascending: true });
    if (error) throw new Error(error.message);

    (events || []).filter(isEventPublishedForSale).forEach((eventRow) => {
      const oid = String(eventRow.organiser_id || '');
      if (!eventsByOrganiser.has(oid)) eventsByOrganiser.set(oid, []);
      const list = eventsByOrganiser.get(oid);
      if (list.length < 2) list.push(eventRow);
    });
  }

  if (topOrganisers.length) {
    parts.push(sectionHeading('Popular organisers'));
    for (const entry of topOrganisers) {
      const org = entry.organiserRow;
      const orgName = String(org?.name || 'Organiser').trim();
      const orgUrl = organiserPublicUrl(org, siteUrl);
      const upcoming = eventsByOrganiser.get(String(entry.organiserId)) || [];
      if (upcoming.length) {
        for (const ev of upcoming) {
          const { event_date, event_time } = formatEventDateTime(ev.starts_at);
          const loc =
            String(ev.location_label || ev.venue || ev.city || '').trim() || 'See event page';
          const subtitle =
            orgName +
            ' · ' +
            event_date +
            (event_time ? ' · ' + event_time : '') +
            ' · ' +
            loc;
          parts.push(recommendationCard(String(ev.title || 'Event').trim(), subtitle, eventPublicUrl(ev, siteUrl)));
        }
      } else {
        parts.push(
          recommendationCard(
            orgName,
            'Top-rated networking group on the Hub',
            orgUrl
          )
        );
      }
    }
  }

  const nearby = await fetchNearbyEvents(sb, attendeeLocation, { limit: 4 });
  if (nearby.events.length) {
    parts.push(sectionHeading(nearbySectionHeading(nearby)));
    for (const ev of nearby.events) {
      const { event_date, event_time } = formatEventDateTime(ev.starts_at);
      const loc =
        String(ev.location_label || ev.venue || ev.city || '').trim() || 'See event page';
      const orgName = String(ev.organisers?.name || 'Organiser').trim();
      const subtitle =
        orgName +
        ' · ' +
        event_date +
        (event_time ? ' · ' + event_time : '') +
        ' · ' +
        loc;
      parts.push(recommendationCard(String(ev.title || 'Event').trim(), subtitle, eventPublicUrl(ev, siteUrl)));
    }
  }

  if (!parts.length) {
    parts.push(
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#635c5e;margin:0;">Browse upcoming networking events across the UK.</p>'
    );
  }

  return parts.join('');
}

async function sendDueAttendeeReengagementEmails(sb) {
  const inactiveBefore = daysAgo(REENGAGEMENT_INACTIVE_DAYS);
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select('attendee_id, created_at')
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .not('attendee_id', 'is', null);
  if (regErr) throw new Error(regErr.message);

  const lastBookingByAttendee = new Map();
  (registrations || []).forEach((row) => {
    const id = String(row.attendee_id || '');
    if (!id) return;
    const created = row.created_at || '';
    const prev = lastBookingByAttendee.get(id);
    if (!prev || created > prev) lastBookingByAttendee.set(id, created);
  });

  const eligibleIds = [...lastBookingByAttendee.entries()]
    .filter(([, lastAt]) => lastAt < inactiveBefore)
    .map(([id]) => id);

  if (!eligibleIds.length) return result;

  const { data: attendees, error: attErr } = await sb
    .from('attendees')
    .select('id, email, name, location, reengagement_email_sent_at')
    .in('id', eligibleIds);
  if (attErr) throw new Error(attErr.message);

  const siteUrl = siteBase();
  const cooldownBefore = daysAgo(REENGAGEMENT_COOLDOWN_DAYS);

  for (const attendee of attendees || []) {
    if (result.sent >= REENGAGEMENT_BATCH_LIMIT) break;

    const email = String(attendee.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    const lastBooking = lastBookingByAttendee.get(attendee.id);
    const sentAt = attendee.reengagement_email_sent_at;
    if (sentAt && sentAt >= lastBooking) {
      result.skipped += 1;
      continue;
    }
    if (sentAt && sentAt > cooldownBefore) {
      result.skipped += 1;
      continue;
    }

    try {
      const recommendationsHtml = await buildRecommendationsHtml(sb, attendee.location);
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'attendees',
        id: attendee.id,
        column: 'reengagement_email_sent_at',
        claimedAt,
        previousValue: sentAt || null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'attendee_reengagement',
          to: email,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee.name || '').trim() || 'there',
            recommendations_html: recommendationsHtml,
            browse_events_url: browseEventsUrl(siteUrl),
          },
          subject: 'Ready to network again?',
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'attendees',
          id: attendee.id,
          column: 'reengagement_email_sent_at',
          claimedAt,
        });
        // Restore prior timestamp if we overwrote a cooldown-eligible value.
        if (sentAt) {
          await sb
            .from('attendees')
            .update({ reengagement_email_sent_at: sentAt })
            .eq('id', attendee.id)
            .is('reengagement_email_sent_at', null);
        }
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ attendee_id: attendee.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendDueSignupEventsNudgeEmails(sb) {
  const eligibleAfter = daysAgo(SIGNUP_NUDGE_DELAY_DAYS);
  const eligibleBefore = daysAgo(SIGNUP_NUDGE_MAX_AGE_DAYS);
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select('attendee_id')
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .not('attendee_id', 'is', null);
  if (regErr) throw new Error(regErr.message);

  const bookedAttendeeIds = new Set(
    (registrations || []).map((row) => String(row.attendee_id || '')).filter(Boolean)
  );

  const { data: attendees, error: attErr } = await sb
    .from('attendees')
    .select('id, email, name, location, created_at, signup_events_nudge_sent_at')
    .lte('created_at', eligibleAfter)
    .gte('created_at', eligibleBefore)
    .is('signup_events_nudge_sent_at', null);
  if (attErr) throw new Error(attErr.message);

  const siteUrl = siteBase();

  for (const attendee of attendees || []) {
    if (bookedAttendeeIds.has(String(attendee.id))) {
      result.skipped += 1;
      continue;
    }

    const email = String(attendee.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    try {
      const eventSections = await buildSignupNudgeEventsHtml(sb, attendee.location);
      if (!eventSections.nearby_events_html && !eventSections.popular_events_html) {
        result.skipped += 1;
        continue;
      }

      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'attendees',
        id: attendee.id,
        column: 'signup_events_nudge_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'attendee_signup_events_nudge',
          to: email,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee.name || '').trim() || 'there',
            near_location_phrase: nearLocationPhrase(attendee.location),
            nearby_events_html: eventSections.nearby_events_html,
            popular_events_html: eventSections.popular_events_html,
            browse_events_url: browseEventsUrl(siteUrl),
            location_tip_html: locationTipHtml(siteUrl, attendee.location),
            add_location_url: accountSettingsUrl(siteUrl),
          },
          subject: 'Events picked for you on The Networker Hub',
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'attendees',
          id: attendee.id,
          column: 'signup_events_nudge_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ attendee_id: attendee.id, error: e.message || String(e) });
    }
  }

  return result;
}

/**
 * Hub accounts with organiser workspace enabled, plus emails linked to an
 * organiser profile — used to keep attendee nurture mail off organiser inboxes.
 */
async function loadOrganiserRecipientKeys(sb, attendees) {
  const userIds = [
    ...new Set(
      (attendees || [])
        .map((row) => String(row.supabase_user_id || '').trim())
        .filter(Boolean)
    ),
  ];
  const emails = [
    ...new Set(
      (attendees || [])
        .map((row) => String(row.email || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const organiserUserIds = new Set();
  const organiserEmails = new Set();

  if (userIds.length) {
    const { data: hubs, error: hubErr } = await sb
      .from('hub_accounts')
      .select('user_id')
      .in('user_id', userIds)
      .not('organiser_access_at', 'is', null);
    if (hubErr) throw new Error(hubErr.message);
    (hubs || []).forEach((row) => {
      const uid = String(row.user_id || '').trim();
      if (uid) organiserUserIds.add(uid);
    });

    const { data: linkedOrgs, error: orgErr } = await sb
      .from('organisers')
      .select('supabase_user_id')
      .in('supabase_user_id', userIds);
    if (orgErr) throw new Error(orgErr.message);
    (linkedOrgs || []).forEach((row) => {
      const uid = String(row.supabase_user_id || '').trim();
      if (uid) organiserUserIds.add(uid);
    });
  }

  if (emails.length) {
    const { data: orgAccounts, error: accErr } = await sb
      .from('organiser_accounts')
      .select('email')
      .in('email', emails);
    if (accErr && !/organiser_accounts|column|relation/i.test(String(accErr.message || ''))) {
      throw new Error(accErr.message);
    }
    (orgAccounts || []).forEach((row) => {
      const em = String(row.email || '').trim().toLowerCase();
      if (em) organiserEmails.add(em);
    });
  }

  return { organiserUserIds, organiserEmails };
}

function isOrganiserAttendee(attendee, organiserKeys) {
  const uid = String(attendee?.supabase_user_id || '').trim();
  const email = String(attendee?.email || '').trim().toLowerCase();
  if (uid && organiserKeys.organiserUserIds.has(uid)) return true;
  if (email && organiserKeys.organiserEmails.has(email)) return true;
  return false;
}

async function sendDueSignupEventsNudgeFollowupEmails(sb) {
  const eligibleAfter = daysAgo(SIGNUP_NUDGE_FOLLOWUP_DELAY_DAYS);
  const eligibleBefore = daysAgo(SIGNUP_NUDGE_FOLLOWUP_MAX_AGE_DAYS);
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select('attendee_id')
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .not('attendee_id', 'is', null);
  if (regErr) throw new Error(regErr.message);

  const bookedAttendeeIds = new Set(
    (registrations || []).map((row) => String(row.attendee_id || '')).filter(Boolean)
  );

  const { data: attendees, error: attErr } = await sb
    .from('attendees')
    .select(
      'id, email, name, location, created_at, supabase_user_id, signup_events_nudge_sent_at, signup_events_nudge_followup_sent_at'
    )
    .lte('created_at', eligibleAfter)
    .gte('created_at', eligibleBefore)
    .not('signup_events_nudge_sent_at', 'is', null)
    .is('signup_events_nudge_followup_sent_at', null);
  if (attErr) {
    if (/signup_events_nudge_followup_sent_at|column/.test(String(attErr.message || ''))) {
      return { sent: 0, skipped: 0, errors: [], unavailable: true };
    }
    throw new Error(attErr.message);
  }

  const candidates = (attendees || []).filter((attendee) => {
    if (bookedAttendeeIds.has(String(attendee.id))) return false;
    return Boolean(String(attendee.email || '').trim());
  });

  let organiserKeys = { organiserUserIds: new Set(), organiserEmails: new Set() };
  try {
    organiserKeys = await loadOrganiserRecipientKeys(sb, candidates);
  } catch (e) {
    result.errors.push({ error: 'organiser_lookup_failed', message: e.message || String(e) });
  }

  const siteUrl = siteBase();

  for (const attendee of attendees || []) {
    if (bookedAttendeeIds.has(String(attendee.id))) {
      result.skipped += 1;
      continue;
    }

    const email = String(attendee.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    if (isOrganiserAttendee(attendee, organiserKeys)) {
      result.skipped += 1;
      continue;
    }

    try {
      const eventSections = await buildSignupNudgeEventsHtml(sb, attendee.location);
      if (!eventSections.nearby_events_html && !eventSections.popular_events_html) {
        result.skipped += 1;
        continue;
      }

      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'attendees',
        id: attendee.id,
        column: 'signup_events_nudge_followup_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'attendee_signup_events_nudge_followup',
          to: email,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee.name || '').trim() || 'there',
            near_location_phrase: nearLocationPhrase(attendee.location),
            nearby_events_html: eventSections.nearby_events_html,
            popular_events_html: eventSections.popular_events_html,
            browse_events_url: browseEventsUrl(siteUrl),
            location_tip_html: locationTipHtml(siteUrl, attendee.location),
            add_location_url: accountSettingsUrl(siteUrl),
          },
          subject: 'Still looking for your first event?',
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'attendees',
          id: attendee.id,
          column: 'signup_events_nudge_followup_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ attendee_id: attendee.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendOrganiserLowUpcomingEventsNudges(sb) {
  const now = new Date().toISOString();
  const cooldownBefore = daysAgo(LOW_EVENTS_NUDGE_COOLDOWN_DAYS);
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: events, error } = await sb
    .from('events')
    .select('id, organiser_id, starts_at, status, approval_status, published_at')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now);
  if (error) throw new Error(error.message);

  const counts = new Map();
  (events || []).filter(isEventPublishedForSale).forEach((row) => {
    const oid = String(row.organiser_id || '').trim();
    if (!oid) return;
    counts.set(oid, (counts.get(oid) || 0) + 1);
  });

  const eligibleOrganiserIds = [...counts.entries()]
    .filter(([, count]) => count > 0 && count <= LOW_EVENTS_MAX_UPCOMING)
    .map(([id]) => id);

  if (!eligibleOrganiserIds.length) return result;

  const { data: organisers, error: orgErr } = await sb
    .from('organisers')
    .select('id, low_upcoming_events_nudge_sent_at')
    .in('id', eligibleOrganiserIds);
  if (orgErr) throw new Error(orgErr.message);

  const siteUrl = siteBase();

  for (const organiser of organisers || []) {
    const upcomingCount = counts.get(organiser.id) || 0;
    if (!upcomingCount) {
      result.skipped += 1;
      continue;
    }

    const sentAt = organiser.low_upcoming_events_nudge_sent_at;
    if (sentAt && sentAt > cooldownBefore) {
      result.skipped += 1;
      continue;
    }

    const contact = await resolveOrganiserNotificationEmail(sb, organiser.id);
    if (!contact.email) {
      result.skipped += 1;
      continue;
    }

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'organisers',
        id: organiser.id,
        column: 'low_upcoming_events_nudge_sent_at',
        claimedAt,
        previousValue: sentAt || null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'organiser_low_upcoming_events',
          to: contact.email,
          variables: {
            ...baseEmailVars(siteUrl),
            organiser_name: contact.name || 'there',
            upcoming_count: String(upcomingCount),
            create_event_url: siteUrl + '/organiser/event-format',
            dashboard_url: organiserDashboardUrl(siteUrl),
          },
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'organisers',
          id: organiser.id,
          column: 'low_upcoming_events_nudge_sent_at',
          claimedAt,
        });
        if (sentAt) {
          await sb
            .from('organisers')
            .update({ low_upcoming_events_nudge_sent_at: sentAt })
            .eq('id', organiser.id)
            .is('low_upcoming_events_nudge_sent_at', null);
        }
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ organiser_id: organiser.id, error: e.message || String(e) });
    }
  }

  return result;
}

function eventLocationLabel(eventRow) {
  return (
    String(eventRow?.location_label || eventRow?.venue || eventRow?.city || '').trim() ||
    'See event page'
  );
}

function buildGuestVisitNextEventSection(nextEvent) {
  if (!nextEvent) {
    return (
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#635c5e;margin:0;text-align:center;">' +
      'Keep an eye on this group for their next meeting — new dates are added regularly.</p>'
    );
  }

  const { event_date, event_time } = formatEventDateTime(nextEvent.starts_at);
  const timeSuffix = event_time ? ' · ' + event_time : '';
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
    '<tr><td style="padding:24px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Next meeting</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">' +
    String(nextEvent.title || 'Upcoming event').trim() +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);margin:0;">' +
    event_date +
    timeSuffix +
    ' &middot; ' +
    eventLocationLabel(nextEvent) +
    '</p></td></tr></table>'
  );
}

function buildGuestVisitMembershipCtaSection(membershipJoinUrl, organiserName) {
  const url = String(membershipJoinUrl || '').trim();
  if (!url) return '';
  const name = String(organiserName || 'this group').trim();
  return (
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.6;color:#635c5e;margin:16px 0 0;text-align:center;">' +
    'When you are ready to join ' +
    escapeHtml(name) +
    ' as a member, you can also ' +
    '<a href="' +
    escapeHtml(url) +
    '" style="color:#1c2040;font-weight:700;text-decoration:underline;">view membership options</a>' +
    ' on their organiser page.</p>'
  );
}

async function fetchMembershipOfferByOrganiser(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = new Map(ids.map((id) => [id, false]));
  if (!ids.length) return map;

  const { data, error } = await sb
    .from('organiser_membership_plans')
    .select('organiser_id, active, monthly_amount_pence, annual_amount_pence')
    .in('organiser_id', ids);
  if (error) throw new Error(error.message);

  for (const row of data || []) {
    const organiserId = String(row.organiser_id || '').trim();
    if (!organiserId) continue;
    const active = row.active !== false;
    const offered =
      active &&
      ((row.monthly_amount_pence != null && Number(row.monthly_amount_pence) > 0) ||
        (row.annual_amount_pence != null && Number(row.annual_amount_pence) > 0));
    map.set(organiserId, offered);
  }
  return map;
}

async function fetchActiveRosterEmailKeys(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const keys = new Set();
  if (!ids.length) return keys;

  const { data, error } = await sb
    .from('organiser_member_roster')
    .select('organiser_id, email, status, expires_at')
    .in('organiser_id', ids)
    .eq('status', 'active');
  if (error) {
    if (/column|status|expires_at/i.test(String(error.message || ''))) {
      const fallback = await sb
        .from('organiser_member_roster')
        .select('organiser_id, email')
        .in('organiser_id', ids);
      if (fallback.error) throw new Error(fallback.error.message);
      for (const row of fallback.data || []) {
        const organiserId = String(row.organiser_id || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        if (organiserId && email) keys.add(organiserId + '\0' + email);
      }
      return keys;
    }
    throw new Error(error.message);
  }

  const now = Date.now();
  for (const row of data || []) {
    const organiserId = String(row.organiser_id || '').trim();
    const email = String(row.email || '').trim().toLowerCase();
    if (!organiserId || !email) continue;
    if (row.expires_at) {
      const exp = new Date(row.expires_at).getTime();
      if (Number.isFinite(exp) && exp < now) continue;
    }
    keys.add(organiserId + '\0' + email);
  }
  return keys;
}

async function fetchNextOrganiserEvents(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const map = new Map(ids.map((id) => [id, null]));
  if (!ids.length) return map;

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('events')
    .select('id, title, slug, starts_at, location_label, venue, city, status, approval_status, organiser_id')
    .in('organiser_id', ids)
    .gte('starts_at', now)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);

  for (const row of data || []) {
    if (!isEventPublishedForSale(row)) continue;
    const organiserId = String(row.organiser_id || '').trim();
    if (!organiserId || map.get(organiserId)) continue;
    map.set(organiserId, row);
  }

  return map;
}

async function sendDueGuestVisitFollowupEmails(sb, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const dryRun = opts.dryRun === true;
  const followupDueBefore = hoursAgo(GUEST_VISIT_FOLLOWUP_HOURS);
  const followupDueAfter = daysAgo(GUEST_VISIT_FOLLOWUP_MAX_AGE_DAYS);
  const result = { sent: 0, skipped: 0, errors: [], candidates: [] };

  const eventSelect = 'id, title, slug, ends_at, starts_at, organiser_id';
  const [endedWithEndRes, endedWithoutEndRes] = await Promise.all([
    sb
      .from('events')
      .select(eventSelect)
      .lte('ends_at', followupDueBefore)
      .gte('ends_at', followupDueAfter)
      .neq('status', 'cancelled'),
    sb
      .from('events')
      .select(eventSelect)
      .is('ends_at', null)
      .lte('starts_at', followupDueBefore)
      .gte('starts_at', followupDueAfter)
      .neq('status', 'cancelled'),
  ]);
  if (endedWithEndRes.error) throw new Error(endedWithEndRes.error.message);
  if (endedWithoutEndRes.error) throw new Error(endedWithoutEndRes.error.message);

  const eventById = {};
  for (const row of [...(endedWithEndRes.data || []), ...(endedWithoutEndRes.data || [])]) {
    if (row?.id) eventById[row.id] = row;
  }
  const events = Object.values(eventById);
  if (!events.length) return result;
  const eventIds = events.map((e) => e.id);
  const organiserIds = [...new Set(events.map((e) => e.organiser_id).filter(Boolean))];

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, guest_visit_followup_sent_at, registration_kind, cancelled_at, application_status'
    )
    .in('event_id', eventIds)
    .eq('registration_kind', 'guest_visit')
    .is('guest_visit_followup_sent_at', null)
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (regErr) throw new Error(regErr.message);
  if (!registrations?.length) return result;

  const nextEventByOrganiser = await fetchNextOrganiserEvents(sb, organiserIds);
  const membershipOfferByOrganiser = await fetchMembershipOfferByOrganiser(sb, organiserIds);
  const activeRosterKeys = await fetchActiveRosterEmailKeys(sb, organiserIds);

  const { data: organisers, error: orgErr } = await sb
    .from('organisers')
    .select('id, name, slug')
    .in('id', organiserIds);
  if (orgErr) throw new Error(orgErr.message);
  const organiserById = Object.fromEntries((organisers || []).map((o) => [o.id, o]));

  const siteUrl = siteBase();

  const guestAttendeeIds = [
    ...new Set((registrations || []).map((row) => row.attendee_id).filter(Boolean)),
  ];
  const guestAttendeeById = {};
  if (guestAttendeeIds.length) {
    const { data: guestAttendees, error: guestAttErr } = await sb
      .from('attendees')
      .select('id, email, name')
      .in('id', guestAttendeeIds);
    if (guestAttErr) throw new Error(guestAttErr.message);
    (guestAttendees || []).forEach((row) => {
      guestAttendeeById[row.id] = row;
    });
  }

  for (const registration of registrations) {
    if (result.sent >= GUEST_VISIT_FOLLOWUP_BATCH_LIMIT) break;

    const eventRow = eventById[registration.event_id];
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }

    const attendee = registration.attendee_id ? guestAttendeeById[registration.attendee_id] : null;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    const organiserId = String(eventRow.organiser_id || '').trim();
    if (organiserId && activeRosterKeys.has(organiserId + '\0' + attendeeEmail)) {
      // Already a member — mark sent so we do not keep retrying a guest CTA.
      if (!dryRun) {
        await sb
          .from('registrations')
          .update({ guest_visit_followup_sent_at: new Date().toISOString() })
          .eq('id', registration.id);
      }
      result.skipped += 1;
      continue;
    }

    const organiser = organiserById[eventRow.organiser_id] || null;
    const organiserName = String(organiser?.name || 'the organiser').trim();
    const organiserUrl = organiserPublicUrl(organiser, siteUrl);
    const membershipJoinUrl = organiserUrl + '#org-membership-join';
    const membershipOffered = Boolean(membershipOfferByOrganiser.get(organiserId));
    const nextEvent =
      nextEventByOrganiser.get(String(eventRow.organiser_id || '').trim()) || null;
    const nextEventUrl = nextEvent ? eventPublicUrl(nextEvent, siteUrl) : organiserUrl;

    let ctaUrl = nextEventUrl;
    let ctaLabel = nextEvent ? 'Book the next event' : 'View ' + organiserName;
    // Near-term conversion is the next booking. Hub membership dues are a slower path (~months).
    let followupNextStep =
      'If you liked the group, the easiest next step is to book a member ticket for an upcoming date — your organiser page and events are on The Networker Hub.';
    let membershipCtaSection = '';

    if (membershipOffered) {
      followupNextStep =
        'If you liked the group, book their next meeting first. Membership (monthly or annual through the Hub) can wait until you are ready to join properly.';
      membershipCtaSection = buildGuestVisitMembershipCtaSection(membershipJoinUrl, organiserName);
    }

    try {
      if (dryRun) {
        result.candidates.push({
          registration_id: registration.id,
          attendee_email: attendeeEmail,
          event_id: eventRow.id,
          event_title: eventRow.title,
          next_event_url: nextEventUrl,
          membership_offered: membershipOffered,
          cta_url: ctaUrl,
          cta_label: ctaLabel,
        });
        result.sent += 1;
        continue;
      }

      const nextEventDateTime = nextEvent ? formatEventDateTime(nextEvent.starts_at) : null;

      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'registrations',
        id: registration.id,
        column: 'guest_visit_followup_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'guest_visit_followup',
          to: attendeeEmail,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee?.name || '').trim() || 'there',
            event_name: String(eventRow.title || 'your event').trim(),
            organiser_name: organiserName,
            organiser_url: organiserUrl,
            followup_next_step: followupNextStep,
            next_event_name: nextEvent ? String(nextEvent.title || '').trim() : '',
            next_event_date: nextEventDateTime?.event_date || '',
            next_event_time: nextEventDateTime?.event_time || '',
            next_event_location: nextEvent ? eventLocationLabel(nextEvent) : '',
            next_event_url: nextEventUrl,
            next_event_section: buildGuestVisitNextEventSection(nextEvent),
            membership_cta_section: membershipCtaSection,
            cta_url: ctaUrl,
            cta_label: ctaLabel,
          },
          skipEmailCheck: true,
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'registrations',
          id: registration.id,
          column: 'guest_visit_followup_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else
        result.errors.push({
          registration_id: registration.id,
          error: e.message || String(e),
        });
    }
  }

  return result;
}

async function sendDuePostEventReviewEmails(sb, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const dryRun = opts.dryRun === true;
  const reviewDueBefore = hoursAgo(POST_EVENT_REVIEW_HOURS);
  const reviewDueAfter = daysAgo(POST_EVENT_REVIEW_MAX_AGE_DAYS);
  const result = { sent: 0, skipped: 0, errors: [], candidates: [] };

  const eventSelect = 'id, title, slug, ends_at, starts_at, organiser_id';
  const [endedWithEndRes, endedWithoutEndRes] = await Promise.all([
    sb
      .from('events')
      .select(eventSelect)
      .lte('ends_at', reviewDueBefore)
      .gte('ends_at', reviewDueAfter)
      .not('organiser_id', 'is', null)
      .neq('status', 'cancelled'),
    sb
      .from('events')
      .select(eventSelect)
      .is('ends_at', null)
      .lte('starts_at', reviewDueBefore)
      .gte('starts_at', reviewDueAfter)
      .not('organiser_id', 'is', null)
      .neq('status', 'cancelled'),
  ]);
  if (endedWithEndRes.error) throw new Error(endedWithEndRes.error.message);
  if (endedWithoutEndRes.error) throw new Error(endedWithoutEndRes.error.message);

  const eventById = {};
  for (const row of [...(endedWithEndRes.data || []), ...(endedWithoutEndRes.data || [])]) {
    if (row?.id) eventById[row.id] = row;
  }
  const events = Object.values(eventById);
  if (!events.length) return result;
  const eventIds = events.map((e) => e.id);

  let { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at, post_event_review_sent_at'
    )
    .in('event_id', eventIds)
    .is('post_event_review_sent_at', null)
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .is('no_show_at', null);
  if (regErr && /no_show_at|column/i.test(regErr.message || '')) {
    const retry = await sb
      .from('registrations')
      .select(
        'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at, post_event_review_sent_at'
      )
      .in('event_id', eventIds)
      .is('post_event_review_sent_at', null)
      .in('payment_status', ['Paid', 'Free'])
      .neq('application_status', 'Denied')
      .is('cancelled_at', null);
    registrations = retry.data;
    regErr = retry.error;
  }
  if (regErr) throw new Error(regErr.message);

  const siteUrl = siteBase();
  const attendeeIds = [
    ...new Set((registrations || []).map((row) => row.attendee_id).filter(Boolean)),
  ];
  const attendeeById = {};
  if (attendeeIds.length) {
    const { data: attendees, error: attErr } = await sb
      .from('attendees')
      .select('id, email, name')
      .in('id', attendeeIds);
    if (attErr) throw new Error(attErr.message);
    (attendees || []).forEach((row) => {
      attendeeById[row.id] = row;
    });
  }

  const organiserIds = [
    ...new Set(events.map((row) => row.organiser_id).filter(Boolean)),
  ];
  const organiserById = {};
  if (organiserIds.length) {
    const { data: organisers, error: orgErr } = await sb
      .from('organisers')
      .select('id, name')
      .in('id', organiserIds);
    if (orgErr) throw new Error(orgErr.message);
    (organisers || []).forEach((row) => {
      organiserById[row.id] = row;
    });
  }

  const { data: existingReviews, error: reviewErr } = await sb
    .from('reviews')
    .select('attendee_id, event_id')
    .in('event_id', eventIds);
  if (reviewErr) throw new Error(reviewErr.message);
  const reviewedPairs = new Set(
    (existingReviews || []).map((row) => String(row.attendee_id) + ':' + String(row.event_id))
  );

  for (const registration of registrations || []) {
    if (result.sent >= POST_EVENT_REVIEW_BATCH_LIMIT) break;

    const eventRow = eventById[registration.event_id];
    if (!eventRow || !eventRow.organiser_id) {
      result.skipped += 1;
      continue;
    }

    if (
      registration.attendee_id &&
      reviewedPairs.has(String(registration.attendee_id) + ':' + String(registration.event_id))
    ) {
      result.skipped += 1;
      continue;
    }

    const attendee = registration.attendee_id ? attendeeById[registration.attendee_id] : null;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    try {
      const organiser = organiserById[eventRow.organiser_id] || null;
      const emailVars = buildPostEventReviewEmailVars(eventRow, attendee, organiser, siteUrl);
      if (dryRun) {
        result.candidates.push({
          registration_id: registration.id,
          attendee_email: attendeeEmail,
          event_id: eventRow.id,
          event_title: eventRow.title,
          review_url: emailVars.review_url,
        });
        result.sent += 1;
        continue;
      }

      // Claim before send so overlapping cron workers cannot double-send.
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimErr } = await sb
        .from('registrations')
        .update({ post_event_review_sent_at: claimedAt })
        .eq('id', registration.id)
        .is('post_event_review_sent_at', null)
        .select('id');
      if (claimErr) throw new Error(claimErr.message);
      if (!claimed?.length) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'post_event_review_request',
          to: attendeeEmail,
          variables: emailVars,
          skipEmailCheck: true,
        });
      } catch (sendErr) {
        await sb
          .from('registrations')
          .update({ post_event_review_sent_at: null })
          .eq('id', registration.id)
          .eq('post_event_review_sent_at', claimedAt);
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else
        result.errors.push({
          registration_id: registration.id,
          error: e.message || String(e),
        });
    }
  }

  return result;
}

const POST_EVENT_REVIEW_REMINDER_DAYS = 5;
const POST_EVENT_REVIEW_REMINDER_BATCH_LIMIT = 75;

async function sendDuePostEventReviewReminderEmails(sb) {
  const reminderBefore = daysAgo(POST_EVENT_REVIEW_REMINDER_DAYS);
  const result = { sent: 0, skipped: 0, errors: [], candidates: [] };

  let { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, payment_status, application_status, post_event_review_sent_at, post_event_review_reminder_sent_at'
    )
    .not('post_event_review_sent_at', 'is', null)
    .is('post_event_review_reminder_sent_at', null)
    .lte('post_event_review_sent_at', reminderBefore)
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null)
    .is('no_show_at', null)
    .limit(200);
  if (regErr && /no_show_at|column/i.test(regErr.message || '')) {
    const retry = await sb
      .from('registrations')
      .select(
        'id, attendee_id, event_id, payment_status, application_status, post_event_review_sent_at, post_event_review_reminder_sent_at'
      )
      .not('post_event_review_sent_at', 'is', null)
      .is('post_event_review_reminder_sent_at', null)
      .lte('post_event_review_sent_at', reminderBefore)
      .in('payment_status', ['Paid', 'Free'])
      .neq('application_status', 'Denied')
      .is('cancelled_at', null)
      .limit(200);
    registrations = retry.data;
    regErr = retry.error;
  }
  if (regErr) throw new Error(regErr.message);
  if (!(registrations || []).length) return result;

  const eventIds = [...new Set(registrations.map((r) => r.event_id).filter(Boolean))];
  const { data: events, error: eventErr } = await sb
    .from('events')
    .select('id, title, slug, ends_at, starts_at, organiser_id')
    .in('id', eventIds);
  if (eventErr) throw new Error(eventErr.message);
  const eventById = {};
  (events || []).forEach((row) => {
    if (row?.id) eventById[row.id] = row;
  });

  const attendeeIds = [...new Set(registrations.map((r) => r.attendee_id).filter(Boolean))];
  const attendeeById = {};
  if (attendeeIds.length) {
    const { data: attendees, error: attErr } = await sb
      .from('attendees')
      .select('id, email, name')
      .in('id', attendeeIds);
    if (attErr) throw new Error(attErr.message);
    (attendees || []).forEach((row) => {
      attendeeById[row.id] = row;
    });
  }

  const organiserIds = [
    ...new Set((events || []).map((row) => row.organiser_id).filter(Boolean)),
  ];
  const organiserById = {};
  if (organiserIds.length) {
    const { data: organisers, error: orgErr } = await sb
      .from('organisers')
      .select('id, name')
      .in('id', organiserIds);
    if (orgErr) throw new Error(orgErr.message);
    (organisers || []).forEach((row) => {
      organiserById[row.id] = row;
    });
  }

  const { data: existingReviews, error: reviewErr } = await sb
    .from('reviews')
    .select('attendee_id, event_id')
    .in('event_id', eventIds);
  if (reviewErr) throw new Error(reviewErr.message);
  const reviewedPairs = new Set(
    (existingReviews || []).map((row) => String(row.attendee_id) + ':' + String(row.event_id))
  );

  const siteUrl = siteBase();
  for (const registration of registrations || []) {
    if (result.sent >= POST_EVENT_REVIEW_REMINDER_BATCH_LIMIT) break;
    const eventRow = eventById[registration.event_id];
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }
    if (
      registration.attendee_id &&
      reviewedPairs.has(String(registration.attendee_id) + ':' + String(registration.event_id))
    ) {
      result.skipped += 1;
      continue;
    }
    const attendee = registration.attendee_id ? attendeeById[registration.attendee_id] : null;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    try {
      const organiser = eventRow.organiser_id
        ? organiserById[eventRow.organiser_id] || null
        : null;
      const emailVars = buildPostEventReviewEmailVars(eventRow, attendee, organiser, siteUrl);
      // Claim before send so overlapping cron workers cannot double-send.
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimErr } = await sb
        .from('registrations')
        .update({ post_event_review_reminder_sent_at: claimedAt })
        .eq('id', registration.id)
        .is('post_event_review_reminder_sent_at', null)
        .select('id');
      if (claimErr) throw new Error(claimErr.message);
      if (!claimed?.length) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'post_event_review_reminder',
          to: attendeeEmail,
          variables: emailVars,
          skipEmailCheck: true,
        });
      } catch (sendErr) {
        await sb
          .from('registrations')
          .update({ post_event_review_reminder_sent_at: null })
          .eq('id', registration.id)
          .eq('post_event_review_reminder_sent_at', claimedAt);
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else
        result.errors.push({
          registration_id: registration.id,
          error: e.message || String(e),
        });
    }
  }

  return result;
}

async function sendDueCategoryExclusivityPaymentReminders(sb) {
  const reminderBefore = hoursAgo(CATEGORY_EXCLUSIVITY_PAYMENT_REMINDER_HOURS);
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: registrations, error } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at, application_decided_at, category_exclusivity_payment_reminder_sent_at'
    )
    .eq('application_status', 'Approved')
    .eq('payment_status', 'Pending')
    .is('category_exclusivity_payment_reminder_sent_at', null)
    .is('cancelled_at', null)
    .not('application_decided_at', 'is', null)
    .lte('application_decided_at', reminderBefore);
  if (error) throw new Error(error.message);

  const siteUrl = siteBase();

  for (const registration of registrations || []) {
    const eventRes = await sb
      .from('events')
      .select('id, title, slug')
      .eq('id', registration.event_id)
      .maybeSingle();
    if (eventRes.error) throw new Error(eventRes.error.message);
    const eventRow = eventRes.data;
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }

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

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'registrations',
        id: registration.id,
        column: 'category_exclusivity_payment_reminder_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'category_exclusivity_payment_reminder',
          to: attendeeEmail,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee?.name || '').trim() || 'there',
            event_name: String(eventRow.title || 'your event').trim(),
            hub_payment_url: hubPaymentUrl(siteUrl, registration.id),
          },
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'registrations',
          id: registration.id,
          column: 'category_exclusivity_payment_reminder_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else
        result.errors.push({
          registration_id: registration.id,
          error: e.message || String(e),
        });
    }
  }

  return result;
}

async function sendDueStripeConnectNudges(sb) {
  const cooldownBefore = daysAgo(STRIPE_NUDGE_COOLDOWN_DAYS);
  const now = new Date().toISOString();
  const result = { sent: 0, skipped: 0, errors: [] };

  const { data: organisers, error: orgErr } = await sb
    .from('organisers')
    .select('id, name, stripe_charges_enabled, stripe_connect_details_submitted, stripe_connect_nudge_sent_at')
    .or('stripe_charges_enabled.is.false,stripe_connect_details_submitted.is.false');
  if (orgErr) throw new Error(orgErr.message);

  const siteUrl = siteBase();

  for (const organiser of organisers || []) {
    if (organiser.stripe_charges_enabled && organiser.stripe_connect_details_submitted) {
      result.skipped += 1;
      continue;
    }

    const sentAt = organiser.stripe_connect_nudge_sent_at;
    if (sentAt && sentAt > cooldownBefore) {
      result.skipped += 1;
      continue;
    }

    const { data: events, error: evErr } = await sb
      .from('events')
      .select('id, organiser_id, starts_at, status, approval_status, published_at')
      .eq('organiser_id', organiser.id)
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .gt('starts_at', now);
    if (evErr) throw new Error(evErr.message);

    const upcoming = (events || []).filter(isEventPublishedForSale);
    if (!upcoming.length) {
      result.skipped += 1;
      continue;
    }

    const eventIds = upcoming.map((e) => e.id);
    const { data: tickets, error: ticketErr } = await sb
      .from('tickets')
      .select('id, event_id, price, status')
      .in('event_id', eventIds);
    if (ticketErr) throw new Error(ticketErr.message);

    const hasPaidTicket = (tickets || []).some((t) => {
      const price = Number(String(t.price || '').replace(/[£,\s]/g, ''));
      return String(t.status || 'Active') === 'Active' && Number.isFinite(price) && price > 0;
    });
    if (!hasPaidTicket) {
      result.skipped += 1;
      continue;
    }

    const contact = await resolveOrganiserNotificationEmail(sb, organiser.id);
    if (!contact.email) {
      result.skipped += 1;
      continue;
    }

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'organisers',
        id: organiser.id,
        column: 'stripe_connect_nudge_sent_at',
        claimedAt,
        previousValue: sentAt || null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'stripe_connect_nudge',
          to: contact.email,
          variables: {
            ...baseEmailVars(siteUrl),
            organiser_name: contact.name || 'there',
            connect_url: organiserDashboardUrl(siteUrl, { panel: 'revenue' }),
            dashboard_url: organiserDashboardUrl(siteUrl),
          },
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'organisers',
          id: organiser.id,
          column: 'stripe_connect_nudge_sent_at',
          claimedAt,
        });
        if (sentAt) {
          await sb
            .from('organisers')
            .update({ stripe_connect_nudge_sent_at: sentAt })
            .eq('id', organiser.id)
            .is('stripe_connect_nudge_sent_at', null);
        }
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ organiser_id: organiser.id, error: e.message || String(e) });
    }
  }

  return result;
}

function isDueForHubertConcierge(sentAt) {
  if (!sentAt) return true;
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return true;
  const now = new Date();
  return (
    sent.getUTCFullYear() < now.getUTCFullYear() || sent.getUTCMonth() < now.getUTCMonth()
  );
}

function recentlyReceivedSignupNurture(attendee, withinDays) {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  for (const key of ['signup_events_nudge_sent_at', 'signup_events_nudge_followup_sent_at']) {
    const raw = attendee?.[key];
    if (!raw) continue;
    const sent = new Date(raw).getTime();
    if (!Number.isNaN(sent) && sent >= cutoff) return true;
  }
  return false;
}

function hubertConciergeMonthLabel(date) {
  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

async function sendDueHubertEventConciergeEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [] };
  const now = new Date();
  const monthLabel = hubertConciergeMonthLabel(now);
  const siteUrl = siteBase();

  const { data: attendees, error } = await sb
    .from('attendees')
    .select(
      'id, email, name, location, hubert_event_concierge_sent_at, signup_events_nudge_sent_at, signup_events_nudge_followup_sent_at'
    )
    .not('email', 'is', null)
    .order('hubert_event_concierge_sent_at', { ascending: true, nullsFirst: true })
    .limit(250);
  if (error) {
    if (/hubert_event_concierge_sent_at|column/.test(String(error.message || ''))) {
      return { sent: 0, skipped: 0, errors: [], unavailable: true };
    }
    throw new Error(error.message);
  }

  for (const attendee of attendees || []) {
    if (result.sent >= HUBERT_CONCIERGE_BATCH_LIMIT) break;

    if (!isDueForHubertConcierge(attendee.hubert_event_concierge_sent_at)) {
      result.skipped += 1;
      continue;
    }

    if (recentlyReceivedSignupNurture(attendee, HUBERT_AFTER_NURTURE_COOLDOWN_DAYS)) {
      result.skipped += 1;
      continue;
    }

    const email = String(attendee.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    try {
      const eventSections = await buildSignupNudgeEventsHtml(sb, attendee.location);
      if (!eventSections.nearby_events_html && !eventSections.popular_events_html) {
        result.skipped += 1;
        continue;
      }

      const claimedAt = now.toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'attendees',
        id: attendee.id,
        column: 'hubert_event_concierge_sent_at',
        claimedAt,
        previousValue: attendee.hubert_event_concierge_sent_at || null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendTemplatedEmail({
          slug: 'attendee_hubert_event_concierge',
          to: email,
          variables: {
            ...baseEmailVars(siteUrl),
            user_name: String(attendee.name || '').trim() || 'there',
            month_label: monthLabel,
            near_location_phrase: nearLocationPhrase(attendee.location),
            nearby_events_html: eventSections.nearby_events_html,
            popular_events_html: eventSections.popular_events_html,
            browse_events_url: browseEventsUrl(siteUrl),
            account_settings_url: accountSettingsUrl(siteUrl),
            location_footer_html: hubertLocationFooterHtml(siteUrl, attendee.location),
          },
          subject: "Hubert's event picks for " + monthLabel,
        });
      } catch (sendErr) {
        await releaseRowTimestamp(sb, {
          table: 'attendees',
          id: attendee.id,
          column: 'hubert_event_concierge_sent_at',
          claimedAt,
        });
        if (attendee.hubert_event_concierge_sent_at) {
          await sb
            .from('attendees')
            .update({ hubert_event_concierge_sent_at: attendee.hubert_event_concierge_sent_at })
            .eq('id', attendee.id)
            .is('hubert_event_concierge_sent_at', null);
        }
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ attendee_id: attendee.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function runEngagementEmailMaintenance(sb) {
  // Post-event reviews are owned solely by /api/cron/post-event-reviews (10:05)
  // so they are not double-run by this 10:00 engagement job.
  const guestVisitFollowup = await sendDueGuestVisitFollowupEmails(sb);
  const categoryExclusivityPayment = await sendDueCategoryExclusivityPaymentReminders(sb);
  const reengagement = await sendDueAttendeeReengagementEmails(sb);
  const signupEventsNudge = await sendDueSignupEventsNudgeEmails(sb);
  const signupEventsNudgeFollowup = await sendDueSignupEventsNudgeFollowupEmails(sb);
  const hubertConcierge = await sendDueHubertEventConciergeEmails(sb);
  const lowEvents = await sendOrganiserLowUpcomingEventsNudges(sb);
  const stripeConnect = await sendDueStripeConnectNudges(sb);
  return {
    guestVisitFollowup,
    categoryExclusivityPayment,
    reengagement,
    signupEventsNudge,
    signupEventsNudgeFollowup,
    hubertConcierge,
    lowEvents,
    stripeConnect,
  };
}

module.exports = {
  sendDueAttendeeReengagementEmails,
  sendDueSignupEventsNudgeEmails,
  sendDueSignupEventsNudgeFollowupEmails,
  sendDueHubertEventConciergeEmails,
  sendOrganiserLowUpcomingEventsNudges,
  sendDueGuestVisitFollowupEmails,
  sendDuePostEventReviewEmails,
  sendDuePostEventReviewReminderEmails,
  sendDueCategoryExclusivityPaymentReminders,
  sendDueStripeConnectNudges,
  runEngagementEmailMaintenance,
  buildRecommendationsHtml,
  buildSignupNudgeEventsHtml,
};
