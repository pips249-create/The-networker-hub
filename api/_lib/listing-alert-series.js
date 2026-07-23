const { formatEventDateTime } = require('./favourite-sales-emails');
const { eventPublicUrl } = require('./hub-email-urls');
const { isEventPublishedForSale } = require('./ticket-sales');

const LISTING_ALERT_EVENT_COLUMNS =
  'id, title, slug, starts_at, status, approval_status, venue, city, location_label, organiser_id, published_at, created_at, series_group_id';

function listingAlertSeriesKey(eventRow) {
  const seriesGroupId = String(eventRow?.series_group_id || eventRow?.seriesGroupId || '').trim();
  if (seriesGroupId) return 'sg:' + seriesGroupId;
  return 'ev:' + String(eventRow?.id || '').trim();
}

function sortEventsByStartsAt(events) {
  return [...(events || [])].sort(
    (a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0)
  );
}

function formatListingAlertDateList(eventRows) {
  const sorted = sortEventsByStartsAt(eventRows);
  const dateParts = sorted
    .map((row) => formatEventDateTime(row.starts_at).event_date)
    .filter((part) => part && part !== 'Date TBC');
  if (!dateParts.length) return 'Date TBC';
  if (dateParts.length === 1) return dateParts[0];
  const last = dateParts.pop();
  return dateParts.join(', ') + ' & ' + last;
}

function formatListingAlertTimeSuffix(eventRows) {
  const sorted = sortEventsByStartsAt(eventRows);
  const times = [
    ...new Set(
      sorted.map((row) => formatEventDateTime(row.starts_at).event_time).filter(Boolean)
    ),
  ];
  if (times.length !== 1) return '';
  return times[0] ? ' · ' + times[0] : '';
}

function pickListingAlertAnchorEvent(eventRows) {
  return sortEventsByStartsAt(eventRows)[0] || eventRows[0] || null;
}

function groupEventsForListingAlerts(events) {
  const groups = new Map();
  for (const row of events || []) {
    const key = listingAlertSeriesKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((groupEvents) => {
    const eventsSorted = sortEventsByStartsAt(groupEvents);
    return {
      key: listingAlertSeriesKey(eventsSorted[0]),
      events: eventsSorted,
      anchor: pickListingAlertAnchorEvent(eventsSorted),
    };
  });
}

function buildListingAlertEventDisplay(eventRows, siteUrl) {
  const rows = sortEventsByStartsAt(eventRows || []);
  const anchor = pickListingAlertAnchorEvent(rows) || {};
  const eventLocation =
    String(anchor.location_label || anchor.venue || anchor.city || '').trim() ||
    'See event page';

  return {
    event_name: String(anchor.title || 'Event').trim(),
    event_date: formatListingAlertDateList(rows),
    event_time: formatListingAlertTimeSuffix(rows),
    event_location: eventLocation,
    event_url: eventPublicUrl(anchor, siteUrl),
    anchorEvent: anchor,
    eventIds: rows.map((row) => row.id).filter(Boolean),
    is_series_listing: rows.length > 1,
  };
}

function buildListingAlertSeriesCopy({
  dateCount,
  variant = 'saved_organiser',
  organiserName,
  userName,
  eventName,
}) {
  const count = Math.max(1, Number(dateCount) || 1);
  const isSeries = count > 1;
  const organiser = String(organiserName || 'Organiser').trim();
  const title = String(eventName || 'Event').trim();
  const name = String(userName || 'there').trim();

  if (variant === 'member_roster') {
    if (isSeries) {
      return {
        event_date_count: String(count),
        listing_badge: 'For members',
        listing_headline: organiser + ' has ' + count + ' new member dates',
        listing_intro:
          'Hi ' +
          name +
          ', you&apos;re in the membership for <strong style="color:#1c2040;">' +
          organiser +
          '</strong>. They&apos;ve just published <strong style="color:#1c2040;">' +
          count +
          ' new dates</strong> for <strong style="color:#1c2040;">' +
          title +
          '</strong> — sign in with this email to see Members only tickets.',
        listing_subject: organiser + ' — ' + count + ' new member dates for ' + title,
        event_date_prefix: 'Dates: ',
        listing_cta_label: '',
      };
    }
    return {
      event_date_count: '1',
      listing_badge: 'For members',
      listing_headline: organiser + ' has a new event',
      listing_intro:
        'Hi ' +
        name +
        ', you&apos;re in the membership for <strong style="color:#1c2040;">' +
        organiser +
        '</strong>. They&apos;ve just published a new event — sign in with this email to see Members only tickets.',
      listing_subject: organiser + ' has a new event for members',
      event_date_prefix: '',
      listing_cta_label: '',
    };
  }

  if (isSeries) {
    return {
      event_date_count: String(count),
      listing_badge: 'New dates',
      listing_headline: organiser + ' has ' + count + ' new dates',
      listing_intro:
        'Hi ' +
        name +
        ', <strong style="color:#1c2040;">' +
        organiser +
        '</strong> just published <strong style="color:#1c2040;">' +
        count +
        ' new dates</strong> for <strong style="color:#1c2040;">' +
        title +
        '</strong>.',
      listing_subject: organiser + ' — ' + count + ' new dates for ' + title,
      event_date_prefix: 'Dates: ',
      listing_cta_label: 'View dates',
    };
  }

  return {
    event_date_count: '1',
    listing_badge: 'New listing',
    listing_headline: organiser + ' has a new event',
    listing_intro:
      'Hi ' +
      name +
      ', <strong style="color:#1c2040;">' +
      organiser +
      '</strong> just published a new listing you might like.',
    listing_subject: organiser + ' has a new event',
    event_date_prefix: '',
    listing_cta_label: 'View event',
  };
}

function buildListingAlertEmailFields(eventRows, siteUrl, copyOptions = {}) {
  const display = buildListingAlertEventDisplay(eventRows, siteUrl);
  const copy = buildListingAlertSeriesCopy({
    dateCount: (eventRows || []).length,
    ...copyOptions,
    eventName: display.event_name,
  });
  return { ...display, ...copy };
}

function eventPublishedAfterFavourite(eventRow, favouriteCreatedAt) {
  if (!favouriteCreatedAt) return true;
  const publishedAt = eventRow.published_at || eventRow.created_at;
  const publishedDate = publishedAt ? new Date(publishedAt) : null;
  if (!publishedDate || Number.isNaN(publishedDate.getTime())) return true;
  return publishedDate >= favouriteCreatedAt;
}

async function loadListingAlertSeriesPeers(sb, eventRow) {
  const seriesGroupId = String(eventRow?.series_group_id || '').trim();
  if (!seriesGroupId) return [eventRow];

  const peersRes = await sb
    .from('events')
    .select(LISTING_ALERT_EVENT_COLUMNS)
    .eq('series_group_id', seriesGroupId)
    .eq('status', 'published')
    .eq('approval_status', 'Approved');
  if (peersRes.error) throw new Error(peersRes.error.message);

  const peers = (peersRes.data || []).filter((row) => isEventPublishedForSale(row));
  const byId = new Map(peers.map((row) => [row.id, row]));
  if (eventRow?.id && !byId.has(eventRow.id)) byId.set(eventRow.id, eventRow);
  return sortEventsByStartsAt([...byId.values()]);
}

async function loadUnalertedEventsForRecipient(sb, {
  eventRows,
  alertTable,
  recipientColumn,
  recipientId,
}) {
  const rows = sortEventsByStartsAt(eventRows || []);
  const eventIds = rows.map((row) => row.id).filter(Boolean);
  if (!eventIds.length || !recipientId) return [];

  const alertedRes = await sb
    .from(alertTable)
    .select('event_id')
    .eq(recipientColumn, recipientId)
    .in('event_id', eventIds);
  if (alertedRes.error) throw new Error(alertedRes.error.message);

  const alertedIds = new Set((alertedRes.data || []).map((row) => String(row.event_id)));
  return rows.filter((row) => !alertedIds.has(String(row.id)));
}

module.exports = {
  LISTING_ALERT_EVENT_COLUMNS,
  listingAlertSeriesKey,
  sortEventsByStartsAt,
  formatListingAlertDateList,
  formatListingAlertTimeSuffix,
  pickListingAlertAnchorEvent,
  groupEventsForListingAlerts,
  buildListingAlertEventDisplay,
  buildListingAlertSeriesCopy,
  buildListingAlertEmailFields,
  eventPublishedAfterFavourite,
  loadListingAlertSeriesPeers,
  loadUnalertedEventsForRecipient,
};
