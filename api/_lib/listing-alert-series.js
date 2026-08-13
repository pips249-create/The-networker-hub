const { formatEventDateTime } = require('./favourite-sales-emails');
const { eventPublicUrl } = require('./hub-email-urls');
const { isEventPublishedForSale } = require('./ticket-sales');

const LISTING_ALERT_EVENT_COLUMNS =
  'id, title, slug, starts_at, status, approval_status, venue, city, location_label, meeting_type, organiser_id, published_at, created_at, series_group_id, attendance_mode';

function formatListingAlertLocation(anchor) {
  const meetingType = String(anchor?.meeting_type || '')
    .trim()
    .toLowerCase();
  if (meetingType === 'online' || (meetingType.includes('online') && !meetingType.includes('person'))) {
    return 'Online';
  }
  const raw = String(anchor?.location_label || anchor?.venue || anchor?.city || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) return 'See event page';
  // Collapse historic "Online, Online" / "online, online" labels from older saves.
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length && parts.every((part) => /^online$/i.test(part))) return 'Online';
  return raw;
}

function listingAlertAttendanceMode(eventRows) {
  const modes = (eventRows || []).map((row) =>
    String(row?.attendance_mode || row?.attendanceMode || '')
      .trim()
      .toLowerCase()
  );
  if (modes.some((m) => m === 'category_exclusivity' || m === 'osop')) {
    return 'category_exclusivity';
  }
  if (modes.some((m) => m === 'membership_meeting')) return 'membership_meeting';
  if (modes.some((m) => m === 'guest_programme')) return 'guest_programme';
  return 'tickets';
}

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

  return {
    event_name: String(anchor.title || 'Event').trim(),
    event_date: formatListingAlertDateList(rows),
    event_time: formatListingAlertTimeSuffix(rows),
    event_location: formatListingAlertLocation(anchor),
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
  attendanceMode = '',
}) {
  const count = Math.max(1, Number(dateCount) || 1);
  const isSeries = count > 1;
  const organiser = String(organiserName || 'Organiser').trim();
  const title = String(eventName || 'Event').trim();
  const name = String(userName || 'there').trim();
  const mode = String(attendanceMode || '')
    .trim()
    .toLowerCase();
  const isCategoryExclusivity = mode === 'category_exclusivity' || mode === 'osop';
  const isGuestProgramme = mode === 'guest_programme' || mode === 'membership_meeting';

  // Plain-text only — templates wrap organiser/event names in <strong>.
  // Never put HTML tags or &apos; entities in these strings (they get escaped).
  if (variant === 'member_roster') {
    // CE is application-based for guests — not a members-only event.
    if (isCategoryExclusivity) {
      if (isSeries) {
        return {
          event_date_count: String(count),
          listing_badge: 'Your membership',
          listing_headline: organiser + ' has ' + count + ' new dates',
          listing_follow_on:
            "They've just published " +
            count +
            ' new dates for ' +
            title +
            ' — sign in with this email to book as a member (no application needed).',
          listing_intro:
            'Hi ' +
            name +
            ", you're in the membership for " +
            organiser +
            ". They've just published " +
            count +
            ' new dates for ' +
            title +
            ' — sign in with this email to book as a member (no application needed).',
          listing_subject: organiser + ' — ' + count + ' new dates for ' + title,
          event_date_prefix: 'Dates: ',
          listing_cta_label: '',
        };
      }
      return {
        event_date_count: '1',
        listing_badge: 'Your membership',
        listing_headline: organiser + ' has a new event',
        listing_follow_on:
          "They've just published a Category Exclusivity event — sign in with this email to book as a member (no application needed).",
        listing_intro:
          'Hi ' +
          name +
          ", you're in the membership for " +
          organiser +
          ". They've just published a Category Exclusivity event — sign in with this email to book as a member (no application needed).",
        listing_subject: organiser + ' has a new event',
        event_date_prefix: '',
        listing_cta_label: '',
      };
    }

    const followOn = isGuestProgramme
      ? 'sign in with this email to see your member tickets.'
      : 'sign in with this email to view the event — public tickets stay on sale, and any member rates show when you are signed in.';
    if (isSeries) {
      return {
        event_date_count: String(count),
        listing_badge: 'Your membership',
        listing_headline: organiser + ' has ' + count + ' new dates',
        listing_follow_on:
          "They've just published " + count + ' new dates for ' + title + ' — ' + followOn,
        listing_intro:
          'Hi ' +
          name +
          ", you're in the membership for " +
          organiser +
          ". They've just published " +
          count +
          ' new dates for ' +
          title +
          ' — ' +
          followOn,
        listing_subject: organiser + ' — ' + count + ' new dates for ' + title,
        event_date_prefix: 'Dates: ',
        listing_cta_label: '',
      };
    }
    return {
      event_date_count: '1',
      listing_badge: 'Your membership',
      listing_headline: organiser + ' has a new event',
      listing_follow_on: "They've just published a new event — " + followOn,
      listing_intro:
        'Hi ' +
        name +
        ", you're in the membership for " +
        organiser +
        ". They've just published a new event — " +
        followOn,
      listing_subject: organiser + ' has a new event',
      event_date_prefix: '',
      listing_cta_label: '',
    };
  }

  if (isSeries) {
    return {
      event_date_count: String(count),
      listing_badge: 'New dates',
      listing_headline: organiser + ' has ' + count + ' new dates',
      listing_follow_on:
        'just published ' + count + ' new dates for ' + title + '.',
      listing_intro:
        'Hi ' +
        name +
        ', ' +
        organiser +
        ' just published ' +
        count +
        ' new dates for ' +
        title +
        '.',
      listing_subject: organiser + ' — ' + count + ' new dates for ' + title,
      event_date_prefix: 'Dates: ',
      listing_cta_label: 'View dates',
    };
  }

  return {
    event_date_count: '1',
    listing_badge: 'New listing',
    listing_headline: organiser + ' has a new event',
    listing_follow_on: 'just published a new listing you might like.',
    listing_intro:
      'Hi ' + name + ', ' + organiser + ' just published a new listing you might like.',
    listing_subject: organiser + ' has a new event',
    event_date_prefix: '',
    listing_cta_label: 'View event',
  };
}

function escapeListingAlertHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function formatListingNameList(names) {
  const parts = (names || []).map((name) => String(name || '').trim()).filter(Boolean);
  if (!parts.length) return 'new events';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] + ' & ' + parts[1];
  return parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
}

function buildSingleListingDetailHtml(eventRows, siteUrl) {
  const display = buildListingAlertEventDisplay(eventRows, siteUrl);
  const dateLine =
    (display.is_series_listing ? 'Dates: ' : '') +
    escapeListingAlertHtml(display.event_date) +
    escapeListingAlertHtml(display.event_time) +
    ' &middot; ' +
    escapeListingAlertHtml(display.event_location);
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#452d5c;border-radius:16px;margin:0 0 12px;">' +
    '<tr><td style="padding:24px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">' +
    escapeListingAlertHtml(display.event_name) +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);margin:0;">' +
    dateLine +
    '</p></td></tr></table>'
  );
}

function buildEventsDetailHtml(eventRows, siteUrl) {
  const groups = groupEventsForListingAlerts(eventRows);
  if (!groups.length) return '';
  return groups.map((group) => buildSingleListingDetailHtml(group.events, siteUrl)).join('');
}

function buildListingAlertRoundupCopy({
  variant = 'saved_organiser',
  organiserName,
  userName,
  listingNames,
  attendanceMode = '',
}) {
  const organiser = String(organiserName || 'Organiser').trim();
  const name = String(userName || 'there').trim();
  const names = (listingNames || []).map((n) => String(n || '').trim()).filter(Boolean);
  const count = Math.max(1, names.length);
  const list = formatListingNameList(names);
  const mode = String(attendanceMode || '')
    .trim()
    .toLowerCase();
  const isCategoryExclusivity = mode === 'category_exclusivity' || mode === 'osop';
  const isGuestProgramme = mode === 'guest_programme' || mode === 'membership_meeting';

  if (variant === 'member_roster') {
    const followOn = isCategoryExclusivity
      ? 'sign in with this email to book as a member (no application needed).'
      : isGuestProgramme
        ? 'sign in with this email to see your member tickets.'
        : 'sign in with this email to view them — public tickets stay on sale, and any member rates show when you are signed in.';
    return {
      event_date_count: String(count),
      listing_badge: 'Your membership',
      listing_headline:
        count === 1 ? organiser + ' has a new event' : organiser + ' has ' + count + ' new events',
      listing_follow_on:
        count === 1
          ? "They've just published " + list + ' — ' + followOn
          : "They've just added these events — " + list + ' — ' + followOn,
      listing_intro:
        'Hi ' +
        name +
        ", you're in the membership for " +
        organiser +
        '. ' +
        (count === 1
          ? "They've just published " + list + ' — ' + followOn
          : "They've just added these events — " + list + ' — ' + followOn),
      listing_subject:
        count === 1 ? organiser + ' has a new event' : organiser + ' has ' + count + ' new events',
      event_date_prefix: '',
      listing_cta_label: count === 1 ? 'View event' : 'View events',
    };
  }

  return {
    event_date_count: String(count),
    listing_badge: count === 1 ? 'New listing' : 'New listings',
    listing_headline:
      count === 1 ? organiser + ' has a new event' : organiser + ' has ' + count + ' new events',
    listing_follow_on:
      count === 1
        ? 'just published a new listing you might like.'
        : 'just added these events — ' + list + '.',
    listing_intro:
      count === 1
        ? 'Hi ' + name + ', ' + organiser + ' just published a new listing you might like.'
        : 'Hi ' + name + ', ' + organiser + ' just added these events — ' + list + '.',
    listing_subject:
      count === 1 ? organiser + ' has a new event' : organiser + ' has ' + count + ' new events',
    event_date_prefix: '',
    listing_cta_label: count === 1 ? 'View event' : 'View events',
  };
}

function buildListingAlertEmailFields(eventRows, siteUrl, copyOptions = {}) {
  const groups = groupEventsForListingAlerts(eventRows);
  const allRows = sortEventsByStartsAt(eventRows || []);
  const eventsDetailHtml = buildEventsDetailHtml(allRows, siteUrl);

  // One series / one listing — keep the existing single-card copy.
  if (groups.length <= 1) {
    const display = buildListingAlertEventDisplay(allRows, siteUrl);
    const copy = buildListingAlertSeriesCopy({
      dateCount: allRows.length,
      ...copyOptions,
      attendanceMode:
        copyOptions.attendanceMode || listingAlertAttendanceMode(allRows),
      eventName: display.event_name,
    });
    return {
      ...display,
      ...copy,
      events_detail_html: eventsDetailHtml,
      is_roundup: false,
    };
  }

  // Several distinct listings — one roundup email (X, Y & Z).
  const listingNames = groups.map((group) =>
    String(pickListingAlertAnchorEvent(group.events)?.title || 'Event').trim()
  );
  const anchor = pickListingAlertAnchorEvent(allRows) || {};
  const organiserUrlFallback = copyOptions.organiserUrl || '';
  const copy = buildListingAlertRoundupCopy({
    variant: copyOptions.variant || 'saved_organiser',
    organiserName: copyOptions.organiserName,
    userName: copyOptions.userName,
    listingNames,
    attendanceMode:
      copyOptions.attendanceMode || listingAlertAttendanceMode(allRows),
  });

  return {
    event_name: formatListingNameList(listingNames),
    event_date: '',
    event_time: '',
    event_location: '',
    event_url: organiserUrlFallback || eventPublicUrl(anchor, siteUrl),
    anchorEvent: anchor,
    eventIds: allRows.map((row) => row.id).filter(Boolean),
    is_series_listing: false,
    is_roundup: true,
    events_detail_html: eventsDetailHtml,
    ...copy,
  };
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
  formatListingAlertLocation,
  formatListingNameList,
  pickListingAlertAnchorEvent,
  groupEventsForListingAlerts,
  buildListingAlertEventDisplay,
  buildEventsDetailHtml,
  listingAlertAttendanceMode,
  buildListingAlertSeriesCopy,
  buildListingAlertRoundupCopy,
  buildListingAlertEmailFields,
  eventPublishedAfterFavourite,
  loadListingAlertSeriesPeers,
  loadUnalertedEventsForRecipient,
};
