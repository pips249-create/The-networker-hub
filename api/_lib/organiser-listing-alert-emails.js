const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
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
  groupEventsForListingAlerts,
  buildListingAlertEmailFields,
  eventPublishedAfterFavourite,
} = require('./listing-alert-series');

function buildSavedOrganiserNewListingVars({ attendee, organiser, eventRow, eventRows, siteUrl }) {
  const site = siteBase(siteUrl);
  const name = String(attendee?.name || '').trim() || 'there';
  const email = String(attendee?.email || '').trim().toLowerCase();
  const rows = eventRows && eventRows.length ? eventRows : eventRow ? [eventRow] : [];
  const fields = buildListingAlertEmailFields(rows, site, {
    variant: 'saved_organiser',
    organiserName: organiser?.name,
    userName: name,
  });

  return {
    user_name: name,
    user_email: email,
    organiser_name: String(organiser?.name || 'Organiser').trim(),
    organiser_url: organiserPublicUrl(organiser, site),
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
    listing_cta_label: fields.listing_cta_label,
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

/**
 * Email favourited attendees when a saved organiser publishes a new listing.
 */
async function sendDueOrganiserListingAlertEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };

  const favRes = await sb
    .from('organiser_favourites')
    .select(
      'id, created_at, organiser_id, notify_email, attendees(id, email, name), organisers(id, name, slug)'
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

  const eventsRes = await sb
    .from('events')
    .select(LISTING_ALERT_EVENT_COLUMNS)
    .in('organiser_id', organiserIds)
    .eq('status', 'published')
    .eq('approval_status', 'Approved');

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
    const eventGroups = groupEventsForListingAlerts(organiserEvents);

    for (const group of eventGroups) {
      const unalertedEvents = group.events.filter((eventRow) => {
        const alertKey = String(favourite.id) + ':' + String(eventRow.id);
        if (alerted.has(alertKey)) return false;
        return eventPublishedAfterFavourite(eventRow, favouriteCreated);
      });

      if (!unalertedEvents.length) {
        result.skipped += group.events.length;
        continue;
      }

      const vars = buildSavedOrganiserNewListingVars({
        attendee,
        organiser,
        eventRows: unalertedEvents,
      });

      try {
        await sendTemplatedEmail({
          slug: 'saved_organiser_new_listing',
          to: attendeeEmail,
          variables: vars,
        });
        for (const eventRow of unalertedEvents) {
          await sb.from('organiser_favourite_listing_alerts').insert({
            organiser_favourite_id: favourite.id,
            event_id: eventRow.id,
          });
          alerted.add(String(favourite.id) + ':' + String(eventRow.id));
        }
        result.sent += 1;
      } catch (e) {
        result.errors.push({
          favourite_id: favourite.id,
          event_ids: unalertedEvents.map((row) => row.id),
          email: attendeeEmail,
          message: e.message || String(e),
        });
      }
    }
  }

  return result;
}

/**
 * Safety net for member-list new-event emails (covers publish races and
 * roster members who never got an organiser_favourites row).
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
    .limit(80);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const events = (eventsRes.data || []).filter((row) => isEventPublishedForSale(row));
  result.checked = events.length;
  if (!events.length) return result;

  const { notifyRosterMembersOfPublishedEvent } = require('./organiser-member-roster');
  const eventGroups = groupEventsForListingAlerts(events);
  for (const group of eventGroups) {
    try {
      const r = await notifyRosterMembersOfPublishedEvent(group.anchor);
      result.sent += r.sent || 0;
      result.skipped += r.skipped || 0;
      if (r.errors && r.errors.length) result.errors.push(...r.errors);
    } catch (e) {
      result.errors.push({ event_id: group.anchor?.id, message: e.message || String(e) });
    }
  }
  return result;
}

module.exports = {
  buildSavedOrganiserNewListingVars,
  sendDueOrganiserListingAlertEmails,
  sendDueMemberRosterListingAlertEmails,
};
