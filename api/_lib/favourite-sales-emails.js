const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  eventPublicUrl,
  logoNavUrl,
  logoFooterUrl,
  organiserPublicUrl,
  toPublicAssetUrl,
} = require('./hub-email-urls');
const {
  eventHasTicketsOnSale,
  isEventPublishedForSale,
  groupTicketsByEventId,
} = require('./ticket-sales');
const { resolvePhotoUrl } = require('./supabase-organisers-browse');

const { formatDateOnly, formatTime } = require('./event-timezone');

function formatEventDateTime(startsAt) {
  const starts = startsAt ? new Date(startsAt) : null;
  if (!starts || Number.isNaN(starts.getTime())) {
    return { event_date: 'Date TBC', event_time: '' };
  }
  return {
    event_date: formatDateOnly(startsAt),
    event_time: formatTime(startsAt),
  };
}

function escapeEmailHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function organiserLogoUrlForEmail(organiserRow, siteUrl) {
  const raw = resolvePhotoUrl(organiserRow?.photo_url);
  if (!raw) return '';
  return toPublicAssetUrl(raw, siteUrl);
}

function buildOrganiserAvatarHtml(organiserRow, siteUrl) {
  const name = String(organiserRow?.name || 'Networking group').trim();
  const logoUrl = organiserLogoUrlForEmail(organiserRow, siteUrl);
  const organiserUrl = organiserPublicUrl(organiserRow, siteUrl);
  const initial = escapeEmailHtml(name.charAt(0).toUpperCase() || '?');

  if (logoUrl) {
    return (
      '<a href="' +
      escapeEmailHtml(organiserUrl) +
      '" style="text-decoration:none;display:inline-block;">' +
      '<img src="' +
      escapeEmailHtml(logoUrl) +
      '" alt="' +
      escapeEmailHtml(name) +
      '" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:cover;border:0;border-radius:50%;margin:0 auto;" />' +
      '</a>'
    );
  }

  return (
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
    '<tr><td style="width:72px;height:72px;background:#ebe0f0;border-radius:50%;text-align:center;vertical-align:middle;font-family:\'DM Sans\',system-ui,sans-serif;font-size:28px;font-weight:700;color:#9a7aa8;line-height:72px;">' +
    initial +
    '</td></tr></table>'
  );
}

function buildSavedEventTicketsOpenVars({ attendee, eventRow, organiserRow, siteUrl }) {
  const site = siteBase(siteUrl);
  const name = String(attendee?.name || '').trim() || 'there';
  const email = String(attendee?.email || '').trim().toLowerCase();
  const { event_date, event_time } = formatEventDateTime(eventRow.starts_at);
  const eventLocation =
    String(eventRow.location_label || eventRow.venue || eventRow.city || '').trim() ||
    'See event page';
  const organiser =
    organiserRow ||
    eventRow?.organisers ||
    (eventRow?.organiser_id
      ? { id: eventRow.organiser_id, name: eventRow.organiser_name, photo_url: eventRow.organiser_photo_url }
      : null);
  const organiserName = String(organiser?.name || '').trim();

  return {
    user_name: name,
    user_email: email,
    event_name: String(eventRow.title || 'Event').trim(),
    event_date,
    event_time,
    event_location: eventLocation,
    event_url: eventPublicUrl(eventRow, site),
    organiser_name: organiserName || 'Networking group',
    organiser_url: organiser ? organiserPublicUrl(organiser, site) : browseEventsUrl(site),
    organiser_logo_url: organiser ? organiserLogoUrlForEmail(organiser, site) : '',
    organiser_avatar_html: organiser
      ? buildOrganiserAvatarHtml(organiser, site)
      : '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td style="width:72px;height:72px;background:#ebe0f0;border-radius:50%;text-align:center;vertical-align:middle;font-size:28px;color:#9a7aa8;line-height:72px;">&#9733;</td></tr></table>',
    hub_account_url: hubAccountUrl(site),
    browse_events_url: browseEventsUrl(site),
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
  };
}

/**
 * Email favourited attendees when ticket sales open for a published event.
 */
async function sendDueFavouriteSalesEmails(sb) {
  const now = new Date();
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };

  const favRes = await sb
    .from('event_favourites')
    .select(
      'id, attendee_id, event_id, created_at, notify_email, reminded_at, attendees(id, email, name), events(id, title, slug, starts_at, status, approval_status, venue, city, location_label, meeting_type, meeting_link, organiser_id, organisers(id, name, slug, photo_url))'
    )
    .eq('notify_email', true)
    .is('reminded_at', null);

  if (favRes.error) throw new Error(favRes.error.message);
  const favourites = favRes.data || [];
  result.checked = favourites.length;
  if (!favourites.length) return result;

  const eventIds = [
    ...new Set(
      favourites
        .map((row) => String(row.event_id || '').trim())
        .filter(Boolean)
    ),
  ];

  const ticketsRes = await sb
    .from('tickets')
    .select('id, event_id, status, sale_starts_at, sale_ends_at')
    .in('event_id', eventIds);

  if (ticketsRes.error) throw new Error(ticketsRes.error.message);
  const ticketsByEvent = groupTicketsByEventId(ticketsRes.data || []);

  for (const favourite of favourites) {
    const eventRow = favourite.events;
    const attendee = favourite.attendees;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();

    if (!eventRow || !isEventPublishedForSale(eventRow)) {
      result.skipped += 1;
      continue;
    }

    const tickets = ticketsByEvent[String(favourite.event_id)] || [];
    if (!eventHasTicketsOnSale(tickets, now)) {
      result.skipped += 1;
      continue;
    }

    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    const vars = buildSavedEventTicketsOpenVars({
      attendee,
      eventRow,
      organiserRow: eventRow.organisers || null,
    });

    try {
      await sendTemplatedEmail({
        slug: 'saved_event_tickets_open',
        to: attendeeEmail,
        variables: vars,
      });
      await sb
        .from('event_favourites')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', favourite.id);
      result.sent += 1;
    } catch (e) {
      result.errors.push({
        favourite_id: favourite.id,
        email: attendeeEmail,
        message: e.message || String(e),
      });
    }
  }

  return result;
}

/**
 * If tickets are already on sale when someone saves an event, skip the alert.
 */
async function skipFavouriteSalesAlertIfAlreadyOnSale(sb, favouriteId, eventId) {
  const fid = String(favouriteId || '').trim();
  const eid = String(eventId || '').trim();
  if (!fid || !eid) return;

  const [eventRes, ticketsRes] = await Promise.all([
    sb
      .from('events')
      .select('id, status, approval_status')
      .eq('id', eid)
      .maybeSingle(),
    sb
      .from('tickets')
      .select('id, event_id, status, sale_starts_at, sale_ends_at')
      .eq('event_id', eid),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (ticketsRes.error) throw new Error(ticketsRes.error.message);
  if (!eventRes.data || !isEventPublishedForSale(eventRes.data)) return;
  if (!eventHasTicketsOnSale(ticketsRes.data || [], new Date())) return;

  await sb
    .from('event_favourites')
    .update({ reminded_at: new Date().toISOString() })
    .eq('id', fid);
}

module.exports = {
  formatEventDateTime,
  buildSavedEventTicketsOpenVars,
  sendDueFavouriteSalesEmails,
  skipFavouriteSalesAlertIfAlreadyOnSale,
};
