/**
 * Shared calendar links and social share URLs for events.
 */
(function (global) {
  function venueQuery(ev) {
    if (!ev) return '';
    return String(ev.venue || ev.location || ev.city || '').trim();
  }

  function parseEventStartEnd(ev) {
    let start = null;
    if (ev && ev.dateRaw) {
      const iso = String(ev.dateRaw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        let h = 12;
        let m = 0;
        const tm = String(ev.time || '').match(/(\d{1,2}):(\d{2})/);
        if (tm) {
          h = parseInt(tm[1], 10);
          m = parseInt(tm[2], 10);
        }
        start = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10), h, m, 0);
      }
    }
    if ((!start || Number.isNaN(start.getTime())) && ev && ev.starts_at) {
      start = new Date(ev.starts_at);
    }
    if (!start || Number.isNaN(start.getTime())) {
      start = new Date();
      start.setHours(12, 0, 0, 0);
    }
    let end = null;
    if (ev && ev.ends_at) {
      end = new Date(ev.ends_at);
    }
    if (!end || Number.isNaN(end.getTime())) {
      end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    }
    return { start, end };
  }

  function formatGCal(dt) {
    const pad = function (n) {
      return String(n).padStart(2, '0');
    };
    return (
      dt.getUTCFullYear() +
      pad(dt.getUTCMonth() + 1) +
      pad(dt.getUTCDate()) +
      'T' +
      pad(dt.getUTCHours()) +
      pad(dt.getUTCMinutes()) +
      pad(dt.getUTCSeconds()) +
      'Z'
    );
  }

  function formatOutlookIso(dt) {
    return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function formatIcsDate(dt) {
    return formatGCal(dt);
  }

  function eventPageUrl(ev) {
    const origin = global.location ? global.location.origin : 'https://the-networker-hub.vercel.app';
    if (ev && ev.slug) return origin + '/events/' + encodeURIComponent(ev.slug);
    if (ev && ev.id) return origin + '/events/event.html?id=' + encodeURIComponent(ev.id);
    return origin + '/events/';
  }

  function buildCalendarLinks(ev) {
    const { start, end } = parseEventStartEnd(ev);
    const title = (ev && ev.title) || 'Event';
    const loc = venueQuery(ev) || (ev && ev.location) || '';
    const details = String((ev && ev.description) || '').slice(0, 800);
    const dates = formatGCal(start) + '/' + formatGCal(end);

    return {
      google:
        'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
        encodeURIComponent(title) +
        '&dates=' +
        dates +
        '&details=' +
        encodeURIComponent(details) +
        '&location=' +
        encodeURIComponent(loc),
      outlook:
        'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=' +
        encodeURIComponent(title) +
        '&startdt=' +
        encodeURIComponent(formatOutlookIso(start)) +
        '&enddt=' +
        encodeURIComponent(formatOutlookIso(end)) +
        '&body=' +
        encodeURIComponent(details) +
        '&location=' +
        encodeURIComponent(loc),
      icsContent: [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//The Networker Hub//EN',
        'BEGIN:VEVENT',
        'UID:' + ((ev && ev.id) || 'event') + '@thenetworkerhub',
        'DTSTAMP:' + formatIcsDate(new Date()),
        'DTSTART:' + formatIcsDate(start),
        'DTEND:' + formatIcsDate(end),
        'SUMMARY:' + title.replace(/[,;\\]/g, '\\$&'),
        'DESCRIPTION:' + details.replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&'),
        'LOCATION:' + loc.replace(/[,;\\]/g, '\\$&'),
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
      icsFilename: title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics',
    };
  }

  function buildGoingShare(ev, qty) {
    const title = (ev && ev.title) || 'an event';
    const url = eventPageUrl(ev);
    const count = Math.max(1, parseInt(qty, 10) || 1);
    const goingText =
      count > 1
        ? "We're going to " + title + ' on The Networker Hub!'
        : "I'm going to " + title + ' on The Networker Hub!';

    return {
      url: url,
      title: title,
      text: goingText,
      linkedIn: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url),
      twitter:
        'https://twitter.com/intent/tweet?text=' +
        encodeURIComponent(goingText) +
        '&url=' +
        encodeURIComponent(url),
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
      whatsapp:
        'https://wa.me/?text=' + encodeURIComponent(goingText + ' ' + url),
    };
  }

  function downloadIcs(icsContent, filename) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const dl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dl;
    a.download = filename || 'event.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dl);
  }

  global.HubCalendarShare = {
    buildCalendarLinks: buildCalendarLinks,
    buildGoingShare: buildGoingShare,
    downloadIcs: downloadIcs,
    eventPageUrl: eventPageUrl,
  };
})(typeof window !== 'undefined' ? window : global);
