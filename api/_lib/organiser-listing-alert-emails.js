const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  eventPublicUrl,
  organiserPublicUrl,
} = require('./hub-email-urls');
const { isEventPublishedForSale } = require('./ticket-sales');
const { formatEventDateTime } = require('./favourite-sales-emails');

function buildSavedOrganiserNewListingVars({ attendee, organiser, eventRow, siteUrl }) {
  const site = siteBase(siteUrl);
  const name = String(attendee?.name || '').trim() || 'there';
  const email = String(attendee?.email || '').trim().toLowerCase();
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const eventLocation =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const eventTimeSuffix = event_time ? ' · ' + event_time : '';

  return {
    user_name: name,
    user_email: email,
    organiser_name: String(organiser?.name || 'Organiser').trim(),
    organiser_url: organiserPublicUrl(organiser, site),
    event_name: String(eventRow.title || 'Event').trim(),
    event_date,
    event_time: eventTimeSuffix,
    event_location: eventLocation,
    event_url: eventPublicUrl(eventRow, site),
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
    .select(
      'id, title, slug, starts_at, status, approval_status, venue, city, location_label, organiser_id, published_at, created_at'
    )
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
    for (const eventRow of organiserEvents) {
      const alertKey = String(favourite.id) + ':' + String(eventRow.id);
      if (alerted.has(alertKey)) {
        result.skipped += 1;
        continue;
      }

      const publishedAt = eventRow.published_at || eventRow.created_at;
      const publishedDate = publishedAt ? new Date(publishedAt) : null;
      if (
        favouriteCreated &&
        publishedDate &&
        !Number.isNaN(publishedDate.getTime()) &&
        publishedDate < favouriteCreated
      ) {
        result.skipped += 1;
        continue;
      }

      const vars = buildSavedOrganiserNewListingVars({
        attendee,
        organiser,
        eventRow,
      });

      try {
        await sendTemplatedEmail({
          slug: 'saved_organiser_new_listing',
          to: attendeeEmail,
          variables: vars,
        });
        await sb.from('organiser_favourite_listing_alerts').insert({
          organiser_favourite_id: favourite.id,
          event_id: eventRow.id,
        });
        alerted.add(alertKey);
        result.sent += 1;
      } catch (e) {
        result.errors.push({
          favourite_id: favourite.id,
          event_id: eventRow.id,
          email: attendeeEmail,
          message: e.message || String(e),
        });
      }
    }
  }

  return result;
}

module.exports = {
  buildSavedOrganiserNewListingVars,
  sendDueOrganiserListingAlertEmails,
};
