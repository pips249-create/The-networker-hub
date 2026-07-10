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
  reviewUrlForEvent,
  hubPaymentUrl,
  eventPublicUrl,
} = require('./lifecycle-emails');
const {
  siteBase,
  browseEventsUrl,
  opportunitiesBrowseUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
} = require('./hub-email-urls');
const {
  fetchNearbyEvents,
  fetchPopularEvents,
  nearbySectionHeading,
} = require('./nearby-events');
const REENGAGEMENT_INACTIVE_DAYS = 30;
const REENGAGEMENT_COOLDOWN_DAYS = 60;
const LOW_EVENTS_MAX_UPCOMING = 3;
const LOW_EVENTS_NUDGE_COOLDOWN_DAYS = 30;
const POST_EVENT_REVIEW_HOURS = 36;
const POST_EVENT_REVIEW_WINDOW_HOURS = 12;
const CATEGORY_EXCLUSIVITY_PAYMENT_REMINDER_HOURS = 48;
const STRIPE_NUDGE_COOLDOWN_DAYS = 14;
const SIGNUP_NUDGE_DELAY_DAYS = 3;
const SIGNUP_NUDGE_FOLLOWUP_DAYS = 10;
const SIGNUP_NUDGE_MAX_AGE_DAYS = 60;

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

function lightRecommendationCard(title, subtitle, url) {
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3ecfa;border:1px solid #e8dce8;border-radius:12px;margin:0 0 10px;">' +
    '<tr><td style="padding:16px 18px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#452d5c;margin:0 0 6px;line-height:1.35;">' +
    title +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:#635c5e;margin:0 0 12px;line-height:1.5;">' +
    subtitle +
    '</p>' +
    '<a href="' +
    url +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#5b2f99;text-decoration:none;">View event &rarr;</a>' +
    '</td></tr></table>'
  );
}

function lightSectionHeading(text) {
  return (
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">' +
    text +
    '</p>'
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

async function buildSignupNudgeFollowupEventsHtml(sb, attendeeLocation) {
  const siteUrl = siteBase();
  const popularResult = await fetchPopularEvents(sb, { limit: 3 });
  const popularIds = popularResult.events.map((ev) => ev.id);
  const nearbyResult = await fetchNearbyEvents(sb, attendeeLocation, {
    limit: 5,
    excludeEventIds: popularIds,
  });

  const popularParts = [];
  if (popularResult.events.length) {
    popularParts.push(lightSectionHeading('Popular right now'));
    for (const ev of popularResult.events) {
      popularParts.push(
        lightRecommendationCard(
          String(ev.title || 'Event').trim(),
          eventRecommendationSubtitle(ev),
          eventPublicUrl(ev, siteUrl)
        )
      );
    }
  }

  const nearbyParts = [];
  if (nearbyResult.events.length) {
    nearbyParts.push(lightSectionHeading(nearbySectionHeading(nearbyResult)));
    for (const ev of nearbyResult.events) {
      nearbyParts.push(
        lightRecommendationCard(
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

      await sb
        .from('attendees')
        .update({ reengagement_email_sent_at: new Date().toISOString() })
        .eq('id', attendee.id);
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

      await sendTemplatedEmail({
        slug: 'attendee_signup_events_nudge',
        to: email,
        variables: {
          ...baseEmailVars(siteUrl),
          user_name: String(attendee.name || '').trim() || 'there',
          nearby_events_html: eventSections.nearby_events_html,
          popular_events_html: eventSections.popular_events_html,
          browse_events_url: browseEventsUrl(siteUrl),
        },
        subject: 'Events picked for you on The Networker Hub',
      });

      await sb
        .from('attendees')
        .update({ signup_events_nudge_sent_at: new Date().toISOString() })
        .eq('id', attendee.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ attendee_id: attendee.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendDueSignupEventsNudgeFollowupEmails(sb) {
  const eligibleAfter = daysAgo(SIGNUP_NUDGE_FOLLOWUP_DAYS);
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
    .select(
      'id, email, name, location, created_at, signup_events_nudge_sent_at, signup_events_nudge_followup_sent_at'
    )
    .lte('created_at', eligibleAfter)
    .gte('created_at', eligibleBefore)
    .not('signup_events_nudge_sent_at', 'is', null)
    .is('signup_events_nudge_followup_sent_at', null);
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
      const eventSections = await buildSignupNudgeFollowupEventsHtml(sb, attendee.location);
      if (!eventSections.nearby_events_html && !eventSections.popular_events_html) {
        result.skipped += 1;
        continue;
      }

      await sendTemplatedEmail({
        slug: 'attendee_signup_events_nudge_followup',
        to: email,
        variables: {
          ...baseEmailVars(siteUrl),
          user_name: String(attendee.name || '').trim() || 'there',
          nearby_events_html: eventSections.nearby_events_html,
          popular_events_html: eventSections.popular_events_html,
          browse_events_url: browseEventsUrl(siteUrl),
          opportunities_url: opportunitiesBrowseUrl(siteUrl),
        },
        subject: 'Still looking for your first event?',
      });

      await sb
        .from('attendees')
        .update({ signup_events_nudge_followup_sent_at: new Date().toISOString() })
        .eq('id', attendee.id);
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
      await sendTemplatedEmail({
        slug: 'organiser_low_upcoming_events',
        to: contact.email,
        variables: {
          ...baseEmailVars(siteUrl),
          organiser_name: contact.name || 'there',
          upcoming_count: String(upcomingCount),
          create_event_url: siteUrl + '/organiser/event-format.html',
          dashboard_url: organiserDashboardUrl(siteUrl),
        },
      });

      await sb
        .from('organisers')
        .update({ low_upcoming_events_nudge_sent_at: new Date().toISOString() })
        .eq('id', organiser.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ organiser_id: organiser.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendDuePostEventReviewEmails(sb, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const dryRun = opts.dryRun === true;
  const windowStart = hoursAgo(POST_EVENT_REVIEW_HOURS + POST_EVENT_REVIEW_WINDOW_HOURS / 2);
  const windowEnd = hoursAgo(POST_EVENT_REVIEW_HOURS - POST_EVENT_REVIEW_WINDOW_HOURS / 2);
  const result = { sent: 0, skipped: 0, errors: [], candidates: [] };

  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, title, slug, ends_at, starts_at, organiser_id')
    .gte('ends_at', windowStart)
    .lte('ends_at', windowEnd)
    .neq('status', 'cancelled');
  if (evErr) throw new Error(evErr.message);
  if (!events?.length) return result;

  const eventById = Object.fromEntries(events.map((e) => [e.id, e]));
  const eventIds = events.map((e) => e.id);

  const { data: registrations, error: regErr } = await sb
    .from('registrations')
    .select(
      'id, attendee_id, event_id, ticket_id, amount_paid, payment_status, application_status, quantity, created_at, post_event_review_sent_at'
    )
    .in('event_id', eventIds)
    .is('post_event_review_sent_at', null)
    .in('payment_status', ['Paid', 'Free'])
    .neq('application_status', 'Denied')
    .is('cancelled_at', null);
  if (regErr) throw new Error(regErr.message);

  const siteUrl = siteBase();

  for (const registration of registrations || []) {
    const eventRow = eventById[registration.event_id];
    if (!eventRow) {
      result.skipped += 1;
      continue;
    }

    if (registration.attendee_id) {
      const { data: existingReview } = await sb
        .from('reviews')
        .select('id')
        .eq('attendee_id', registration.attendee_id)
        .eq('event_id', registration.event_id)
        .maybeSingle();
      if (existingReview) {
        result.skipped += 1;
        continue;
      }
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
      const reviewUrl = reviewUrlForEvent(eventRow, siteUrl);
      if (dryRun) {
        result.candidates.push({
          registration_id: registration.id,
          attendee_email: attendeeEmail,
          event_id: eventRow.id,
          event_title: eventRow.title,
          review_url: reviewUrl,
        });
        result.sent += 1;
        continue;
      }

      await sendTemplatedEmail({
        slug: 'post_event_review_request',
        to: attendeeEmail,
        variables: {
          ...baseEmailVars(siteUrl),
          user_name: String(attendee?.name || '').trim() || 'there',
          event_name: String(eventRow.title || 'your event').trim(),
          review_url: reviewUrl,
        },
        skipEmailCheck: true,
      });

      await sb
        .from('registrations')
        .update({ post_event_review_sent_at: new Date().toISOString() })
        .eq('id', registration.id);
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

      await sb
        .from('registrations')
        .update({ category_exclusivity_payment_reminder_sent_at: new Date().toISOString() })
        .eq('id', registration.id);
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

      await sb
        .from('organisers')
        .update({ stripe_connect_nudge_sent_at: new Date().toISOString() })
        .eq('id', organiser.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ organiser_id: organiser.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function runEngagementEmailMaintenance(sb) {
  const reengagement = await sendDueAttendeeReengagementEmails(sb);
  const signupEventsNudge = await sendDueSignupEventsNudgeEmails(sb);
  const signupEventsNudgeFollowup = await sendDueSignupEventsNudgeFollowupEmails(sb);
  const lowEvents = await sendOrganiserLowUpcomingEventsNudges(sb);
  const postReview = await sendDuePostEventReviewEmails(sb);
  const categoryExclusivityPayment = await sendDueCategoryExclusivityPaymentReminders(sb);
  const stripeConnect = await sendDueStripeConnectNudges(sb);
  return {
    reengagement,
    signupEventsNudge,
    signupEventsNudgeFollowup,
    lowEvents,
    postReview,
    categoryExclusivityPayment,
    stripeConnect,
  };
}

module.exports = {
  sendDueAttendeeReengagementEmails,
  sendDueSignupEventsNudgeEmails,
  sendDueSignupEventsNudgeFollowupEmails,
  sendOrganiserLowUpcomingEventsNudges,
  sendDuePostEventReviewEmails,
  sendDueCategoryExclusivityPaymentReminders,
  sendDueStripeConnectNudges,
  runEngagementEmailMaintenance,
  buildRecommendationsHtml,
  buildSignupNudgeEventsHtml,
  buildSignupNudgeFollowupEventsHtml,
};
