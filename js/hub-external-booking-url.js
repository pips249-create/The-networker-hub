/** Attendee-facing external booking URLs (mirrors api/_lib/connected-booking-util.js). */
(function (global) {
  function parseEventbriteEventIdFromUrl(raw) {
    var url = String(raw || '').trim();
    if (!url || !/eventbrite/i.test(url)) return '';
    try {
      var parsed = new URL(url);
      var eidParam = String(parsed.searchParams.get('eid') || '').trim();
      if (/^\d+$/.test(eidParam)) return eidParam;
      var pathId = parsed.pathname.match(/-(\d{8,})(?:\/|$)/);
      if (pathId) return pathId[1];
    } catch (e) {
      return '';
    }
    return '';
  }

  function preferEventbriteCheckoutUrl(raw) {
    var url = String(raw || '').trim();
    if (!url || !/eventbrite/i.test(url)) return url;
    if (/checkout-external|orderstart/i.test(url)) return url;
    var eid = parseEventbriteEventIdFromUrl(url);
    if (!eid) return url;
    try {
      var parsed = new URL(url);
      var host = /\.co\.uk/i.test(parsed.hostname) ? 'www.eventbrite.co.uk' : 'www.eventbrite.com';
      return 'https://' + host + '/checkout-external?eid=' + eid;
    } catch (e2) {
      return url;
    }
  }

  function toAttendeeBookingUrl(raw) {
    return preferEventbriteCheckoutUrl(String(raw || '').trim());
  }

  global.HubExternalBookingUrl = {
    parseEventbriteEventIdFromUrl: parseEventbriteEventIdFromUrl,
    preferEventbriteCheckoutUrl: preferEventbriteCheckoutUrl,
    toAttendeeBookingUrl: toAttendeeBookingUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
