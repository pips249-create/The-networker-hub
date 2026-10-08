/**
 * Crawlable field payloads for event / organiser detail pages.
 * Consumed by middleware to fill the HTML shell before JavaScript hydrates.
 */
const { siteOrigin } = require('./hubert-seo');
const { publicEventSlug } = require('./event-slug');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trimText(text, max) {
  const raw = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  if (!max || raw.length <= max) return raw;
  return raw.slice(0, max - 1).trim() + '…';
}

function absoluteUrl(origin, path) {
  const base = siteOrigin(origin);
  const p = String(path || '');
  if (/^https?:\/\//i.test(p)) return p;
  return base + (p.startsWith('/') ? p : '/' + p);
}

function priceLabel(ev) {
  if (ev.priceKey === 'enquire') return 'Enquire for price';
  if (ev.priceKey === 'free' || ev.price === 'Free' || ev.hasFreeTickets) return 'Free';
  if (ev.price && String(ev.price).trim()) return String(ev.price).trim();
  if (ev.priceNum != null && Number(ev.priceNum) > 0) {
    return '£' + Number(ev.priceNum).toFixed(2);
  }
  return '';
}

function buildEventDetailSsr(ev, origin) {
  if (!ev || !ev.title) return null;
  const slug = ev.slug || publicEventSlug(ev);
  const organiserSlug = ev.organiserSlug || '';
  const about = trimText(ev.description, 600);
  const city = String(ev.city || '').trim();
  const venue = String(ev.venue || ev.venueName || '').trim();
  const address = String(ev.venueAddress || ev.address || '').trim();
  const locationLine =
    [venue, city, ev.postcode].filter(Boolean).join(', ') || String(ev.location || '').trim();
  const dateLine = String(ev.date || ev.dateLine || '').trim();
  const timeLine = String(ev.time || '').trim();
  const ended = Boolean(ev.isEventPast || ev.salesClosedReason === 'ended');
  const hostUrl = organiserSlug
    ? absoluteUrl(origin, '/organisers/' + encodeURIComponent(organiserSlug))
    : '';

  return {
    title: String(ev.title || '').trim(),
    trail: String(ev.title || '').trim(),
    date: dateLine,
    time: timeLine,
    city: city || String(ev.locationShort || '').trim(),
    venue: venue,
    address: address,
    locationLine: locationLine,
    price: priceLabel(ev),
    category: String(ev.category || ev.eventType || ev.typeTab || '').trim(),
    format: String(ev.format || ev.formatTab || ev.attendanceMode || '').trim(),
    about: about,
    hostName: String(ev.organiser || '').trim(),
    hostUrl: hostUrl,
    imageUrl: ev.photo
      ? ev.photo.startsWith('http')
        ? ev.photo
        : absoluteUrl(origin, ev.photo.startsWith('/') ? ev.photo : '/' + ev.photo)
      : '',
    ended: ended,
    endedTitle: ended ? 'This event has ended' : '',
    endedText: ended
      ? 'Tickets are no longer available. Browse upcoming events from this organiser or across The Networker UK.'
      : '',
    browseEventsUrl: absoluteUrl(origin, '/events/'),
    canonical: slug
      ? absoluteUrl(origin, '/events/' + encodeURIComponent(slug))
      : absoluteUrl(origin, '/events/'),
  };
}

function buildOrganiserDetailSsr(org, origin, upcomingEvents) {
  if (!org || !org.name) return null;
  const slug = org.slug || '';
  const description = trimText(org.description, 800);
  const events = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const upcomingHtml = events.length
    ? '<ul class="hub-ssr-upcoming">' +
      events
        .map(function (ev) {
          const evSlug = publicEventSlug(ev) || ev.slug;
          const href = evSlug ? '/events/' + encodeURIComponent(evSlug) : '/events/';
          const meta = [ev.date || ev.starts_at, ev.city || ev.venue || ev.location]
            .filter(Boolean)
            .join(' · ');
          return (
            '<li><a href="' +
            escapeHtml(href) +
            '">' +
            escapeHtml(ev.title || 'Upcoming event') +
            '</a>' +
            (meta ? ' — ' + escapeHtml(String(meta)) : '') +
            '</li>'
          );
        })
        .join('') +
      '</ul>'
    : '<p>No upcoming listings right now. <a href="/events/">Browse all events</a>.</p>';

  return {
    name: String(org.name || '').trim(),
    description: description,
    website: String(org.website || '').trim(),
    city: String(org.city || org.location || '').trim(),
    photoUrl: org.photoUrl || '',
    upcomingHtml: upcomingHtml,
    profileUrl: slug
      ? absoluteUrl(origin, '/organisers/' + encodeURIComponent(slug))
      : absoluteUrl(origin, '/events/?mode=organisers'),
  };
}

function setElementTextById(html, id, text) {
  if (!text) return html;
  const safeId = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '(<(?:h1|h2|h3|span|div|p|strong|a)[^>]*\\bid=["\']' +
      safeId +
      '["\'][^>]*>)([\\s\\S]*?)(</(?:h1|h2|h3|span|div|p|strong|a)>)',
    'i'
  );
  if (!re.test(html)) return html;
  return html.replace(re, '$1' + escapeHtml(text) + '$3');
}

function unhideElementById(html, id) {
  const safeId = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '(<[^>]*\\bid=["\']' + safeId + '["\'][^>]*?)\\s*\\bhidden\\b([^>]*>)',
    'i'
  );
  return html.replace(re, '$1$2');
}

function setImgSrcById(html, id, src, alt) {
  if (!src) return html;
  const safeId = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(<img[^>]*\\bid=["\']' + safeId + '["\'][^>]*)(>)', 'i');
  if (!re.test(html)) return html;
  return html.replace(re, function (_m, before, close) {
    let tag = before;
    if (/\bsrc=["'][^"']*["']/i.test(tag)) {
      tag = tag.replace(/\bsrc=["'][^"']*["']/i, 'src="' + escapeHtml(src) + '"');
    } else {
      tag += ' src="' + escapeHtml(src) + '"';
    }
    if (alt) {
      if (/\balt=["'][^"']*["']/i.test(tag)) {
        tag = tag.replace(/\balt=["'][^"']*["']/i, 'alt="' + escapeHtml(alt) + '"');
      } else {
        tag += ' alt="' + escapeHtml(alt) + '"';
      }
    }
    return tag + close;
  });
}

/** Keep in sync with middleware.js injectEventDetailContent. */
function injectEventDetailContent(html, meta) {
  const ssr = meta && meta.detailSsr;
  if (!ssr || !ssr.title) return html;

  let out = String(html || '');
  out = setElementTextById(out, 'ev-title', ssr.title);
  out = setElementTextById(out, 'ev-trail-current', ssr.trail || ssr.title);
  out = setElementTextById(out, 'ev-meta-starts', ssr.date);
  if (ssr.time) {
    out = unhideElementById(out, 'ev-meta-time-row');
    out = setElementTextById(out, 'ev-meta-time', ssr.time);
  }
  out = setElementTextById(out, 'ev-meta-city', ssr.city || ssr.locationLine);
  out = setElementTextById(out, 'ev-about-lead', ssr.about || meta.description || '');
  out = setElementTextById(out, 'ev-host-name', ssr.hostName);
  out = setElementTextById(out, 'ev-venue-name', ssr.venue || ssr.locationLine);
  out = setElementTextById(out, 'ev-venue-addr', ssr.address || ssr.locationLine);
  out = setElementTextById(out, 'ev-price', ssr.price);
  out = setElementTextById(out, 'ev-category', ssr.category);
  out = setElementTextById(out, 'ev-format', ssr.format);
  if (ssr.imageUrl) {
    out = setImgSrcById(out, 'ev-hero-img', ssr.imageUrl, ssr.title);
  }
  if (ssr.hostUrl) {
    out = out.replace(
      /(<a[^>]*\bid=["']ev-host-profile-link["'][^>]*)(>)/i,
      function (_m, before, close) {
        let tag = before.replace(/\bhidden\b/i, '');
        if (/\bhref=["'][^"']*["']/i.test(tag)) {
          tag = tag.replace(/\bhref=["'][^"']*["']/i, 'href="' + escapeHtml(ssr.hostUrl) + '"');
        } else {
          tag += ' href="' + escapeHtml(ssr.hostUrl) + '"';
        }
        return tag + close;
      }
    );
    out = setElementTextById(out, 'ev-host-profile-link', 'View organiser page →');
  }
  if (ssr.ended) {
    out = unhideElementById(out, 'ev-ended-banner');
    out = setElementTextById(out, 'ev-ended-banner-title', ssr.endedTitle || 'This event has ended');
    out = setElementTextById(out, 'ev-ended-banner-text', ssr.endedText || '');
  }

  // Strip any legacy crawl-only facts block from older deploys / cached HTML.
  out = out.replace(
    /<section[^>]*id=["']hub-ssr-event-facts["'][^>]*>[\s\S]*?<\/section>\s*/i,
    ''
  );

  return out;
}

/** Keep in sync with middleware.js injectOrganiserDetailContent. */
function injectOrganiserDetailContent(html, meta) {
  const ssr = meta && meta.detailSsr;
  if (!ssr || !ssr.name) return html;

  let out = String(html || '');
  // Remove legacy duplicate SSR header (name/description shown twice).
  out = out.replace(
    /<section[^>]*id=["']hub-ssr-organiser["'][^>]*>[\s\S]*?<\/section>\s*/i,
    ''
  );

  out = setElementTextById(out, 'org-name', ssr.name);
  out = setElementTextById(out, 'org-description', ssr.description || meta.description || '');
  if (ssr.website) {
    out = out.replace(
      /(<a[^>]*\bid=["']org-website["'][^>]*)(>)/i,
      function (_m, before, close) {
        let tag = before.replace(/\bhidden\b/i, '');
        if (/\bhref=["'][^"']*["']/i.test(tag)) {
          tag = tag.replace(/\bhref=["'][^"']*["']/i, 'href="' + escapeHtml(ssr.website) + '"');
        } else {
          tag += ' href="' + escapeHtml(ssr.website) + '"';
        }
        return tag + close;
      }
    );
  }

  // Upcoming links go into the existing list slot; JS replaces this on hydrate.
  if (ssr.upcomingHtml) {
    const upcoming = String(ssr.upcomingHtml);
    if (/id=["']org-events["']/i.test(out)) {
      out = out.replace(
        /(<div class="org-events-list" id="org-events">)([\s\S]*?)(<\/div>)/i,
        '$1' + upcoming + '$3'
      );
    }
  }

  out = unhideElementById(out, 'org-profile-content');

  return out;
}

module.exports = {
  escapeHtml,
  buildEventDetailSsr,
  buildOrganiserDetailSsr,
  injectEventDetailContent,
  injectOrganiserDetailContent,
};
