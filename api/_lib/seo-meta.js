/**
 * Dynamic SEO / AEO meta for public event and organiser pages.
 */
const {
  siteOrigin,
  buildSchemaGraph,
  buildBreadcrumbListSchema,
  buildSchemaGraphFromParts,
} = require('./hubert-seo');
const { getStaticPageConfig } = require('./seo-static-pages');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { fetchPublishedEventBySlug, rowToEvent, isPublicEvent } = require('./supabase-events');
const { getPublicOrganiserBySlug } = require('./supabase-organisers-browse');
const { publicEventSlug } = require('./event-slug');
const { publicOrganiserSlug } = require('./organiser-slug');
const { publicOpportunitySlug } = require('./opportunity-slug');
const { eventImageUrl } = require('./event-image');

function trimText(text, max) {
  const raw = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 1).trim() + '…';
}

function absoluteUrl(origin, path) {
  const base = siteOrigin(origin);
  const p = String(path || '').startsWith('/') ? path : '/' + path;
  return base + p;
}

function buildOpenGraphTags(meta) {
  return {
    'og:type': meta.ogType || 'website',
    'og:site_name': 'The Networker Hub',
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.canonical,
    'og:image': meta.image || '',
    'twitter:card': meta.image ? 'summary_large_image' : 'summary',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.image || '',
  };
}

function isOnlineAttendance(ev) {
  const fmt = String(ev.meetingType || ev.format || '').toLowerCase();
  return fmt.includes('online') || fmt.includes('virtual');
}

function isHybridAttendance(ev) {
  const fmt = String(ev.meetingType || ev.format || '').toLowerCase();
  return fmt.includes('hybrid');
}

function isoDateValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString();
}

function buildEventPlaceLocation(ev) {
  const venueName = String(ev.venue || ev.venueName || '').trim();
  const city = String(ev.city || '').trim();
  const postcode = String(ev.postcode || '').trim();
  const street = String(ev.address || '').trim();
  const fallbackName = String(ev.location || '').trim();
  if (!venueName && !city && !postcode && !street && !fallbackName) return null;

  const address = {
    '@type': 'PostalAddress',
    addressCountry: 'GB',
  };
  if (street) address.streetAddress = street;
  if (city) address.addressLocality = city;
  if (postcode) address.postalCode = postcode;

  const place = {
    '@type': 'Place',
    name: venueName || fallbackName || [city, postcode].filter(Boolean).join(', ') || 'United Kingdom',
    address,
  };

  const lat = Number(ev.lat);
  const lng = Number(ev.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    };
  }

  return place;
}

function buildEventAvailability(ev, ticketSoldOut) {
  if (ticketSoldOut || ev.isSoldOut || ev.salesClosedReason === 'sold_out') {
    return 'https://schema.org/SoldOut';
  }
  if (ev.isTicketSalesScheduled || ev.salesClosedReason === 'scheduled') {
    return 'https://schema.org/PreOrder';
  }
  return 'https://schema.org/InStock';
}

function buildEventOffers(ev, url) {
  const validFrom = isoDateValue(ev.ticketSalesOpensAt);
  const publicTickets = Array.isArray(ev.tickets)
    ? ev.tickets.filter((t) => t && !t.isGuestVisit && !t.isAlumni)
    : [];

  if (publicTickets.length > 1) {
    return publicTickets.map((t) => {
      const offer = {
        '@type': 'Offer',
        name: t.name || t.label || 'Ticket',
        price: Number(t.priceNum) >= 0 ? Number(t.priceNum) : 0,
        priceCurrency: 'GBP',
        availability: buildEventAvailability(ev, Boolean(t.soldOut)),
        url,
      };
      if (validFrom) offer.validFrom = validFrom;
      return offer;
    });
  }

  if (publicTickets.length === 1) {
    const t = publicTickets[0];
    const offer = {
      '@type': 'Offer',
      name: t.name || t.label || 'Ticket',
      price: Number(t.priceNum) >= 0 ? Number(t.priceNum) : 0,
      priceCurrency: 'GBP',
      availability: buildEventAvailability(ev, Boolean(t.soldOut)),
      url,
    };
    if (validFrom) offer.validFrom = validFrom;
    return offer;
  }

  const isFree = ev.priceKey === 'free' || ev.hasFreeTickets;
  const isPaid = Number(ev.priceNum) > 0 || ev.hasPaidTickets;
  if (!isFree && !isPaid) return null;

  const offer = {
    '@type': 'Offer',
    price: isFree && !isPaid ? 0 : Number(ev.priceNum) || 0,
    priceCurrency: 'GBP',
    availability: buildEventAvailability(ev, false),
    url,
  };
  if (validFrom) offer.validFrom = validFrom;
  return offer;
}

function buildEventSchema(ev, origin) {
  const base = siteOrigin(origin);
  const slug = ev.slug || publicEventSlug({ slug: ev.slug, title: ev.title });
  const url = absoluteUrl(origin, '/events/' + encodeURIComponent(slug));
  const online = isOnlineAttendance(ev);
  const hybrid = isHybridAttendance(ev);
  const place = buildEventPlaceLocation(ev);

  let eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode';
  if (hybrid) eventAttendanceMode = 'https://schema.org/MixedEventAttendanceMode';
  else if (online) eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': url + '#event',
    name: ev.title,
    description: trimText(ev.description, 500),
    url,
    eventAttendanceMode,
    eventStatus: 'https://schema.org/EventScheduled',
  };

  const startDate = isoDateValue(ev.dateRaw || ev.nextDate || ev.dateFieldRaw);
  const endDate = isoDateValue(ev.endDateRaw);
  if (startDate) schema.startDate = startDate;
  if (endDate) schema.endDate = endDate;

  if (hybrid && place) {
    schema.location = [
      place,
      { '@type': 'VirtualLocation', url },
    ];
  } else if (online && !place) {
    schema.location = { '@type': 'VirtualLocation', url };
  } else if (place) {
    schema.location = place;
  } else if (online) {
    schema.location = { '@type': 'VirtualLocation', url };
  }

  if (ev.photo) {
    const imageUrl = ev.photo.startsWith('http') ? ev.photo : base + ev.photo;
    schema.image = [imageUrl];
  }

  if (ev.organiser) {
    const organizer = {
      '@type': 'Organization',
      name: ev.organiser,
    };
    if (ev.organiserSlug) {
      organizer.url = absoluteUrl(origin, '/organisers/' + encodeURIComponent(ev.organiserSlug));
    }
    if (ev.organiserLogo) {
      organizer.logo = ev.organiserLogo.startsWith('http')
        ? ev.organiserLogo
        : base + (ev.organiserLogo.startsWith('/') ? ev.organiserLogo : '/' + ev.organiserLogo);
    }
    schema.organizer = organizer;
  }

  const offers = buildEventOffers(ev, url);
  if (offers) schema.offers = offers;

  return schema;
}

function buildOrganiserSchema(org, origin) {
  const slug = org.slug || publicOrganiserSlug(org);
  const url = absoluteUrl(origin, '/organisers/' + encodeURIComponent(slug));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    description: trimText(org.description, 500),
    url,
  };

  if (org.photoUrl) schema.image = org.photoUrl;
  if (org.website) schema.sameAs = [org.website];

  if (org.rating > 0 && org.reviews > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(org.rating),
      reviewCount: String(org.reviews),
    };
  }

  return schema;
}

async function buildEventMeta(slug, origin) {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  const row = await fetchPublishedEventBySlug(sb, slug);
  if (!row) return null;

  let organiser = null;
  if (row.organiser_id) {
    const { data: org } = await sb.from('organisers').select('*').eq('id', row.organiser_id).maybeSingle();
    organiser = org;
    if (organiser && !isPublicEvent(row, organiser)) return null;
  }

  const { data: ticketsRaw } = await sb.from('tickets').select('*').eq('event_id', row.id);
  const tickets = (ticketsRaw || []).map((t) => ({ ...t, _registrationCount: 0 }));
  const ev = rowToEvent(row, organiser, tickets);
  const eventSlug = ev.slug || publicEventSlug({ slug: row.slug, title: row.title });
  if (!eventSlug) return null;

  const title = `${ev.title} – The Networker Hub`;
  const bits = [
    ev.dateLine || ev.date,
    ev.location || ev.city,
    ev.organiser ? `by ${ev.organiser}` : '',
    ev.price && ev.price !== 'Free' ? ev.price : ev.priceKey === 'free' ? 'Free' : '',
  ].filter(Boolean);
  const description =
    trimText(ev.description, 120) ||
    `Book ${ev.title} on The Networker Hub. ${bits.join(' · ')}`.trim();

  const canonical = absoluteUrl(origin, '/events/' + encodeURIComponent(eventSlug));
  const image = ev.photo
    ? ev.photo.startsWith('http')
      ? ev.photo
      : absoluteUrl(origin, ev.photo.startsWith('/') ? ev.photo : '/' + ev.photo)
    : absoluteUrl(origin, '/assets/logo.png');

  const meta = {
    title,
    description: trimText(description, 160),
    canonical,
    image,
    ogType: 'article',
  };

  const eventSchema = buildEventSchema(ev, origin);
  const breadcrumbs = buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events/' },
      { name: ev.title, path: '/events/' + encodeURIComponent(eventSlug) },
    ],
    origin
  );

  return {
    ok: true,
    type: 'event',
    slug: eventSlug,
    ...meta,
    openGraph: buildOpenGraphTags(meta),
    schema: buildSchemaGraphFromParts([eventSchema, breadcrumbs], origin),
    breadcrumbs: breadcrumbs.itemListElement,
  };
}

const OPPORTUNITY_TYPE_LABELS = {
  franchise: 'Franchise',
  'side-hustle': 'Side hustle',
  partnership: 'Partnership',
  networking: 'Networking',
  distributorship: 'Distributorship',
  'business-opportunity': 'Business opportunity',
};

function buildOpportunitySchema(item, origin) {
  const oppSlug = item.slug || publicOpportunitySlug(item);
  const url = absoluteUrl(origin, '/opportunities/' + encodeURIComponent(oppSlug));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.title,
    description: trimText(item.desc || item.description, 500),
    url,
    category: OPPORTUNITY_TYPE_LABELS[item.type] || item.type || 'Business opportunity',
  };
  if (item.imageUrl) {
    schema.image = item.imageUrl.startsWith('http')
      ? item.imageUrl
      : absoluteUrl(origin, item.imageUrl.startsWith('/') ? item.imageUrl : '/' + item.imageUrl);
  }
  if (item.host) {
    schema.brand = { '@type': 'Organization', name: item.host };
  }
  schema.offers = {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
    availability: 'https://schema.org/InStock',
    url,
    description: 'Enquire for investment details',
  };
  return schema;
}

async function buildOpportunityMeta(slug, origin) {
  if (!isSupabaseConfigured()) return null;
  const { getPublishedOpportunityBySlug } = require('./supabase-opportunities');
  const item = await getPublishedOpportunityBySlug(slug);
  if (!item) return null;

  const oppSlug = item.slug || publicOpportunitySlug(item);
  if (!oppSlug) return null;

  const typeLabel = OPPORTUNITY_TYPE_LABELS[item.type] || 'Business opportunity';
  const title = `${item.title} – ${typeLabel} – The Networker Hub`;
  const description =
    trimText(item.desc, 160) ||
    `${item.title} — ${typeLabel} listed by ${item.host || 'The Networker Hub'}. Enquire on The Networker Hub.`;

  const canonical = absoluteUrl(origin, '/opportunities/' + encodeURIComponent(oppSlug));
  const image = item.imageUrl
    ? item.imageUrl.startsWith('http')
      ? item.imageUrl
      : absoluteUrl(origin, item.imageUrl.startsWith('/') ? item.imageUrl : '/' + item.imageUrl)
    : absoluteUrl(origin, '/assets/logo.png');

  const meta = {
    title,
    description: trimText(description, 160),
    canonical,
    image,
    ogType: 'article',
  };

  const opportunitySchema = buildOpportunitySchema(item, origin);
  const breadcrumbs = buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Opportunities', path: '/opportunities/' },
      { name: item.title, path: '/opportunities/' + encodeURIComponent(oppSlug) },
    ],
    origin
  );

  return {
    ok: true,
    type: 'opportunity',
    slug: oppSlug,
    ...meta,
    openGraph: buildOpenGraphTags(meta),
    schema: buildSchemaGraphFromParts([opportunitySchema, breadcrumbs], origin),
    breadcrumbs: breadcrumbs.itemListElement,
  };
}

async function buildOrganiserMeta(slug, origin) {
  const org = await getPublicOrganiserBySlug(slug);
  if (!org || !org.slug) return null;

  const title = `${org.name} – Networking organiser – The Networker Hub`;
  const description =
    trimText(org.description, 160) ||
    `${org.name} on The Networker Hub — browse upcoming networking events and book tickets.`;

  const canonical = absoluteUrl(origin, '/organisers/' + encodeURIComponent(org.slug));
  const image = org.photoUrl || absoluteUrl(origin, '/assets/logo.png');

  const meta = {
    title,
    description,
    canonical,
    image,
    ogType: 'profile',
  };

  const organiserSchema = buildOrganiserSchema(org, origin);
  const breadcrumbs = buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events/' },
      { name: org.name, path: '/organisers/' + encodeURIComponent(org.slug) },
    ],
    origin
  );

  return {
    ok: true,
    type: 'organiser',
    slug: org.slug,
    ...meta,
    openGraph: buildOpenGraphTags(meta),
    schema: buildSchemaGraphFromParts([organiserSchema, breadcrumbs], origin),
    breadcrumbs: breadcrumbs.itemListElement,
  };
}

function buildStaticPageMeta(pageKey, origin) {
  const cfg = getStaticPageConfig(pageKey);
  if (!cfg) return null;

  const canonical = absoluteUrl(origin, cfg.path);
  const image = absoluteUrl(origin, cfg.image || '/assets/logo.png');
  const meta = {
    title: cfg.title,
    description: trimText(cfg.description, 160),
    canonical,
    image,
    ogType: cfg.ogType || 'website',
  };

  return {
    ok: true,
    type: 'page',
    page: String(pageKey || '').toLowerCase(),
    ...meta,
    openGraph: buildOpenGraphTags(meta),
    schema: buildSchemaGraph(String(pageKey || '').toLowerCase(), origin),
  };
}

async function buildSeoMeta(type, slug, origin) {
  const t = String(type || '').toLowerCase();
  const s = String(slug || '').trim();
  if (t === 'page') return buildStaticPageMeta(s, origin);
  if (!s) return null;
  if (t === 'event') return buildEventMeta(s, origin);
  if (t === 'organiser') return buildOrganiserMeta(s, origin);
  if (t === 'opportunity') return buildOpportunityMeta(s, origin);
  return null;
}

module.exports = {
  buildSeoMeta,
  buildEventMeta,
  buildEventSchema,
  buildOrganiserMeta,
  buildOpportunityMeta,
  buildStaticPageMeta,
  absoluteUrl,
  trimText,
};
