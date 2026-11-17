/** Attendee-facing external booking URLs (mirrors api/_lib/connected-booking-util.js). */
(function (global) {
  function looksLikeEmailAddress(raw) {
    var email = String(raw || '').trim();
    // Reject protocol prefixes (mailto:foo@bar.com would otherwise match).
    if (!email || email.indexOf(':') !== -1 || /[\s<>]/.test(email)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isMailtoBookingUrl(raw) {
    return /^mailto:/i.test(String(raw || '').trim());
  }

  /** Accept https pages or email / mailto: for Link Out “email to book”. */
  function normalizeExternalBookingUrl(raw) {
    var url = String(raw || '').trim();
    if (!url) return '';
    if (looksLikeEmailAddress(url)) return 'mailto:' + url.toLowerCase();
    try {
      var parsed = new URL(url);
      if (parsed.protocol === 'mailto:') {
        var email = decodeURIComponent(
          String(parsed.pathname || '')
            .replace(/^\/*/, '')
            .split('?')[0] ||
            String(url)
              .replace(/^mailto:/i, '')
              .split('?')[0] ||
            ''
        ).trim();
        if (!looksLikeEmailAddress(email)) return '';
        return 'mailto:' + email.toLowerCase();
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return preferEventbriteCheckoutUrl(parsed.toString());
    } catch (e) {
      return '';
    }
  }

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
    var normalized = normalizeExternalBookingUrl(raw);
    if (!normalized) return '';
    if (isMailtoBookingUrl(normalized)) return normalized;
    return preferEventbriteCheckoutUrl(normalized);
  }

  function isTicketTailorWebhookEventId(raw) {
    return /^ev_/i.test(String(raw || '').trim());
  }

  /** URL slug from /events/my-show — not the id Ticket Tailor sends on webhooks. */
  function ticketTailorIdNeedsEvPrefix(raw) {
    var value = String(raw || '').trim();
    if (!value) return false;
    if (isTicketTailorWebhookEventId(value)) return false;
    if (/^https?:\/\//i.test(value)) return false;
    return true;
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
    normalizeExternalBookingUrl: normalizeExternalBookingUrl,
    toAttendeeBookingUrl: toAttendeeBookingUrl,
    isMailtoBookingUrl: isMailtoBookingUrl,
    looksLikeEmailAddress: looksLikeEmailAddress,
    guessProviderExternalEventId: guessProviderExternalEventId,
    isTicketTailorWebhookEventId: isTicketTailorWebhookEventId,
    ticketTailorIdNeedsEvPrefix: ticketTailorIdNeedsEvPrefix,
  };
})(typeof window !== 'undefined' ? window : globalThis);
