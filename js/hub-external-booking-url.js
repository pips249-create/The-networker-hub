/** Attendee-facing external booking URLs (mirrors api/_lib/connected-booking-util.js). */
(function (global) {
  function parseEventbriteEventIdFromUrl(raw) {
    var url = String(raw || '').trim();
    if (!url || !/eventbrite/i.test(url)) return '';
    try {
      var parsed = new URL(url);
      var eidParam = String(parsed.searchParams.get('eid') || '').trim();
      if (/^\d+$/.test(eidParam)) return eidParam;
      var numericPath = parsed.pathname.match(/\/e\/(\d{6,})(?:\/|$)/i);
      if (numericPath) return numericPath[1];
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

  function guessProviderExternalEventId(provider, raw) {
    var platform = String(provider || '').trim().toLowerCase();
    var url = String(raw || '').trim();
    if (!platform || !url) return '';
    if (platform === 'eventbrite') return parseEventbriteEventIdFromUrl(url);
    try {
      var parsed = new URL(url);
      if (platform === 'luma' && /lu\.ma|luma\.com/i.test(parsed.hostname)) {
        var slug = parsed.pathname.replace(/^\/+/, '').split('/')[0];
        if (slug && !/^event$/i.test(slug)) return slug;
      }
      if (platform === 'ticket_tailor' && /tickettailor|ticket-tailor/i.test(url)) {
        var tt = parsed.pathname.match(/\/events\/([^/?#]+)/i);
        if (tt) return tt[1];
      }
      if (platform === 'trybooking' && /trybooking/i.test(url)) {
        var tb = parsed.pathname.match(/\/(\d{5,})(?:\/|$)/);
        if (tb) return tb[1];
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  global.HubExternalBookingUrl = {
    parseEventbriteEventIdFromUrl: parseEventbriteEventIdFromUrl,
    preferEventbriteCheckoutUrl: preferEventbriteCheckoutUrl,
    toAttendeeBookingUrl: toAttendeeBookingUrl,
    guessProviderExternalEventId: guessProviderExternalEventId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
