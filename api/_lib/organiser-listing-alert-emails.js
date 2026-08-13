/**
 * Email favourites / member-list people when an organiser publishes listings.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const {
  emailSiteBase,
  browseEventsUrl,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  organiserPublicUrl,
} = require('./hub-email-urls');
const { isEventPublishedForSale } = require('./ticket-sales');
const {
  LISTING_ALERT_EVENT_COLUMNS,
  buildListingAlertEmailFields,
  eventPublishedAfterFavourite,
  sortEventsByStartsAt,
} = require('./listing-alert-series');

function buildSavedOrganiserNewListingVars({ attendee, organiser, eventRow, eventRows, siteUrl }) {
  const site = emailSiteBase(siteUrl);
  const name = String(attendee?.name || '').trim() || 'there';
  const email = String(attendee?.email || '').trim().toLowerCase();
  const rows = eventRows && eventRows.length ? eventRows : eventRow ? [eventRow] : [];
  const organiserUrl = organiserPublicUrl(organiser, site);
  const fields = buildListingAlertEmailFields(rows, site, {
    variant: 'saved_organiser',
    organiserName: organiser?.name,
    userName: name,
    organiserUrl,
  });
  const { buildOrganiserAvatarMarkup, organiserLogoUrlForEmail } = require('./organiser-member-roster');
  const ctaUrl = fields.is_roundup ? organiserUrl : fields.event_url;

  return {
    user_name: name,
    user_email: email,
    organiser_name: String(organiser?.name || 'Organiser').trim(),
    organiser_url: organiserUrl,
    organiser_logo_url: organiserLogoUrlForEmail(organiser, site),
    organiser_avatar_html: buildOrganiserAvatarMarkup(organiser, site),
    event_name: fields.event_name,
    event_date: fields.event_date,
    event_time: fields.event_time,
    event_location: fields.event_location,
    event_url: fields.event_url,
    event_date_count: fields.event_date_count,
    listing_badge: fields.listing_badge,
    listing_headline: fields.listing_headline,
    listing_intro: fields.listing_intro,
    listing_follow_on: fields.listing_follow_on,
    listing_subject: fields.listing_subject,
    event_date_prefix: fields.event_date_prefix,
    listing_cta_label: fields.listing_cta_label || (fields.is_roundup ? 'View events' : 'View event'),
    events_detail_html: fields.events_detail_html || '',
    cta_url: ctaUrl,
    hub_account_url: hubAccountUrl(site) + '#saved',
    browse_events_url: browseEventsUrl(site),
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
  };
}

async function claimFavouriteListingAlertEvents(sb, favouriteId, eventRows) {
  const favId = String(favouriteId || '').trim();
  const rows = (eventRows || []).filter((row) => row?.id);
  if (!favId || !rows.length) return [];

  const claimed = [];
  for (const row of rows) {
    const eventId = String(row.id).trim();
    if (!eventId) continue;
    const insertRes = await sb
      .from('organiser_favourite_listing_alerts')
      .insert({ organiser_favourite_id: favId, event_id: eventId })
      .select('event_id')
      .maybeSingle();
    if (insertRes.error) {
      if (/duplicate key|unique constraint|23505/i.test(insertRes.error.message || '')) continue;
      throw new Error(insertRes.error.message);
    }
    if (insertRes.data?.event_id) claimed.push(row);
  }
  return claimed;
}

async function releaseFavouriteListingAlertEvents(sb, favouriteId, eventRows) {
  const favId = String(favouriteId || '').trim();
  const ids = [...new Set((eventRows || []).map((row) => String(row?.id || '').trim()).filter(Boolean))];
  if (!favId || !ids.length) return;
  await sb
    .from('organiser_favourite_listing_alerts')
    .delete()
    .eq('organiser_favourite_id', favId)
    .in('event_id', ids);
}

/**
 * Email favourited attendees when a saved organiser publishes new listing(s).
 * One roundup email per saved group (X, Y & Z) — not one email per event.
 * Cron runs daily but only sends when there is something new to claim.
 */
async function sendDueOrganiserListingAlertEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };

  const favRes = await sb
    .from('organiser_favourites')
    .select(
      'id, created_at, organiser_id, notify_email, attendees(id, email, name), organisers(id, name, slug, photo_url)'
    )
    .eq('notify_email', true);

  if (favRes.error) throw new Error(favRes.error.message);
  const favourites = favRes.data || [];
  result.checked = favourites.length;
  if (!favourites.length) return result;

  const organiserIds = [
    ...new Set(favourites.map((row) => String(row.organiser_id || '').trim()).filter(Boolean)),
  ];
  if (!organiserIds.length) return result;

  // Only recent publishes — daily cron is a catch-up window, not a full catalogue dump.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const eventsRes = await sb
    .from('events')
    .select(LISTING_ALERT_EVENT_COLUMNS)
    .in('organiser_id', organiserIds)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('published_at', since);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const events = (eventsRes.data || []).filter((row) => isEventPublishedForSale(row));
  if (!events.length) return result;

  const eventIds = events.map((row) => row.id);
  const alertsRes = await sb
    .from('organiser_favourite_listing_alerts')
    .select('organiser_favourite_id, event_id')
    .in('event_id', eventIds);

  if (alertsRes.error) throw new Error(alertsRes.error.message);
  const alerted = new Set(
    (alertsRes.data || []).map(
      (row) => String(row.organiser_favourite_id) + ':' + String(row.event_id)
    )
  );

  const eventsByOrganiser = new Map();
  events.forEach((row) => {
    const oid = String(row.organiser_id || '').trim();
    if (!oid) return;
    if (!eventsByOrganiser.has(oid)) eventsByOrganiser.set(oid, []);
    eventsByOrganiser.get(oid).push(row);
  });

  for (const favourite of favourites) {
    const organiserId = String(favourite.organiser_id || '').trim();
    const attendee = favourite.attendees;
    const organiser = favourite.organisers;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();
    const favouriteCreated = favourite.created_at ? new Date(favourite.created_at) : null;

    if (!organiserId || !attendeeEmail || !organiser) {
      result.skipped += 1;
      continue;
    }

    const organiserEvents = eventsByOrganiser.get(organiserId) || [];
    let unalertedEvents = sortEventsByStartsAt(
      organiserEvents.filter((eventRow) => {
        const alertKey = String(favourite.id) + ':' + String(eventRow.id);
        if (alerted.has(alertKey)) return false;
        return eventPublishedAfterFavourite(eventRow, favouriteCreated);
      })
    );

    // Same inbox may already have the member-list email — do not send a second listing alert.
    if (unalertedEvents.length) {
      try {
        const {
          loadEventIdsAlreadyRosterAlertedForEmail,
        } = require('./organiser-member-roster');
        const rosterAlerted = await loadEventIdsAlreadyRosterAlertedForEmail(sb, {
          email: attendeeEmail,
          organiserId,
          eventIds: unalertedEvents.map((row) => row.id),
        });
        if (rosterAlerted.size) {
          const stillNeeded = [];
          for (const eventRow of unalertedEvents) {
            if (rosterAlerted.has(String(eventRow.id))) {
              // Claim favourite row so we do not keep re-checking forever.
              try {
                await claimFavouriteListingAlertEvents(sb, favourite.id, [eventRow]);
                alerted.add(String(favourite.id) + ':' + String(eventRow.id));
              } catch {
                /* best-effort */
              }
              continue;
            }
            stillNeeded.push(eventRow);
          }
          unalertedEvents = stillNeeded;
        }
      } catch {
        /* non-fatal — proceed with favourite-only dedupe */
      }
    }

    if (!unalertedEvents.length) {
      result.skipped += 1;
      continue;
    }

    let claimedEvents = [];
    try {
      // Claim before send so overlapping cron workers cannot double-email.
      claimedEvents = await claimFavouriteListingAlertEvents(sb, favourite.id, unalertedEvents);
      if (!claimedEvents.length) {
        result.skipped += 1;
        continue;
      }
      claimedEvents.forEach((eventRow) => {
        alerted.add(String(favourite.id) + ':' + String(eventRow.id));
      });

      const vars = buildSavedOrganiserNewListingVars({
        attendee,
        organiser,
        eventRows: claimedEvents,
      });

      await sendTemplatedEmail({
        slug: 'saved_organiser_new_listing',
        to: attendeeEmail,
        variables: vars,
      });
      result.sent += 1;
    } catch (e) {
      if (claimedEvents.length) {
        try {
          await releaseFavouriteListingAlertEvents(sb, favourite.id, claimedEvents);
          claimedEvents.forEach((eventRow) => {
            alerted.delete(String(favourite.id) + ':' + String(eventRow.id));
          });
        } catch {
          /* best-effort */
        }
      }
      result.errors.push({
        favourite_id: favourite.id,
        event_ids: unalertedEvents.map((row) => row.id),
        email: attendeeEmail,
        message: e.message || String(e),
      });
    }
  }

  return result;
}

/**
 * Safety net for member-list new-event emails (covers publish races and
 * roster members who never got an organiser_favourites row).
 * Groups by organiser so catch-up can round up several new listings into one send.
 */
async function sendDueMemberRosterListingAlertEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const eventsRes = await sb
    .from('events')
    .select(LISTING_ALERT_EVENT_COLUMNS)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(120);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const events = (eventsRes.data || []).filter((row) => isEventPublishedForSale(row));
  result.checked = events.length;
  if (!events.length) return result;

  const { notifyRosterMembersOfPublishedEvent } = require('./organiser-member-roster');
  // One catch-up notify per organiser (anchor = most recently published).
  // The send path rounds up other recent unalerted listings for the same group.
  const byOrganiser = new Map();
  for (const row of events) {
    const oid = String(row.organiser_id || '').trim();
    if (!oid) continue;
    const existing = byOrganiser.get(oid);
    if (!existing) {
      byOrganiser.set(oid, row);
      continue;
    }
    const existingPublished = new Date(existing.published_at || existing.created_at || 0).getTime();
    const nextPublished = new Date(row.published_at || row.created_at || 0).getTime();
    if (nextPublished >= existingPublished) byOrganiser.set(oid, row);
  }

  for (const row of byOrganiser.values()) {
    try {
      const r = await notifyRosterMembersOfPublishedEvent(row);
      result.sent += r.sent || 0;
      result.skipped += r.skipped || 0;
      if (r.errors && r.errors.length) result.errors.push(...r.errors);
    } catch (e) {
      result.errors.push({ event_id: row?.id, message: e.message || String(e) });
    }
  }
  return result;
}

module.exports = {
  buildSavedOrganiserNewListingVars,
  sendDueOrganiserListingAlertEmails,
  sendDueMemberRosterListingAlertEmails,
};
