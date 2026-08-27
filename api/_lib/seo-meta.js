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
const { getNetworkingRegion } = require('./networking-regions');
const { buildNetworkingRegionSsr } = require('./networking-region-ssr');
const { getPublicRankingLeaderboard } = require('./organiser-ranking-snapshot');
const { rankingBadgeImageUrl } = require('./ranking-badge-svg');

function buildRankingBadgeImageUrl(origin, opts) {
  const o = opts || {};
  return rankingBadgeImageUrl(origin, o.tier, o.period, {
    name: o.name || o.groupName || o.organiserName,
    organiserId: o.organiserId,
  });
}

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
  const image = meta.image || '';
  const tags = {
    'og:type': meta.ogType || 'website',
    'og:site_name': 'The Networker UK',
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.canonical,
    'og:image': image,
    'twitter:card': image ? 'summary_large_image' : 'summary',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': image || '',
  };
  if (image) {
    tags['og:image:secure_url'] = image;
    tags['og:image:alt'] = meta.title || 'The Networker UK';
  }
  return tags;
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
  if (ev.isEventPast || ev.salesClosedReason === 'ended') {
    return 'https://schema.org/SoldOut';
  }
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

  const isFree = ev.priceKey === 'free' || ev.hasFreeTickets || Number(ev.priceNum) === 0;
  const isPaid = Number(ev.priceNum) > 0 || ev.hasPaidTickets;

  // Google Event rich results expect an Offer — default to free when price is unknown.
  const offer = {
    '@type': 'Offer',
    price: isPaid ? Number(ev.priceNum) || 0 : 0,
    priceCurrency: 'GBP',
    availability: buildEventAvailability(ev, false),
    url,
  };
  if (isFree && !isPaid) offer.name = 'Free entry';
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
  const statusRaw = String(ev.status || ev.listingStatus || '').toLowerCase();

  let eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode';
  if (hybrid) eventAttendanceMode = 'https://schema.org/MixedEventAttendanceMode';
  else if (online) eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';

  let eventStatus = 'https://schema.org/EventScheduled';
  if (statusRaw === 'cancelled' || statusRaw === 'canceled') {
    eventStatus = 'https://schema.org/EventCancelled';
  } else if (statusRaw === 'postponed') {
    eventStatus = 'https://schema.org/EventPostponed';
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': url + '#event',
    name: ev.title,
    description: trimText(ev.description, 500),
    url,
    eventAttendanceMode,
    eventStatus,
  };

  const startDate = isoDateValue(ev.dateRaw || ev.nextDate || ev.dateFieldRaw);
  const endDate = isoDateValue(ev.endDateRaw);
  if (startDate) schema.startDate = startDate;
  if (endDate) schema.endDate = endDate;

  if (hybrid && place) {
    schema.location = [place, { '@type': 'VirtualLocation', url }];
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
      bestRating: '5',
      worstRating: '1',
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

  const title = `${ev.title} – The Networker UK`;
  const bits = [
    ev.dateLine || ev.date,
    ev.location || ev.city,
    ev.organiser ? `by ${ev.organiser}` : '',
    ev.price && ev.price !== 'Free' ? ev.price : ev.priceKey === 'free' ? 'Free' : '',
  ].filter(Boolean);
  const description =
    trimText(ev.description, 120) ||
    `Book ${ev.title} on The Networker UK. ${bits.join(' · ')}`.trim();

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
  affiliate: 'Affiliate',
  networking: 'Networking group / Ambassador',
  'network-marketing': 'Network marketing',
  'business-opportunity': 'Business opportunity',
  distributorship: 'Distributorship / Reseller',
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
  const title = `${item.title} – ${typeLabel} – The Networker UK`;
  const description =
    trimText(item.desc, 160) ||
    `${item.title} — ${typeLabel} listed by ${item.host || 'The Networker UK'}. Enquire on The Networker UK.`;

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

  const title = `${org.name} – Networking organiser – The Networker UK`;
  const description =
    trimText(org.description, 160) ||
    `${org.name} on The Networker UK — browse upcoming networking events and book tickets.`;

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

async function buildNetworkingRegionMeta(slug, origin) {
  const region = getNetworkingRegion(slug);
  if (!region) return null;

  const year = new Date().getFullYear();
  const canonical = absoluteUrl(origin, region.path);
  const image = absoluteUrl(origin, '/assets/logo.png');
  const ssr = await buildNetworkingRegionSsr(slug, origin);
  const eventCount = Number(ssr.total) || 0;
  let description = trimText(
    `Find business networking events, meetings and organiser groups in ${region.name}. Browse upcoming local listings and book your next event on The Networker UK.`,
    160
  );
  if (eventCount > 0) {
    description = trimText(
      `Browse ${eventCount} upcoming business networking events in ${region.name}. Find meetings, workshops and conferences — book on The Networker UK.`,
      160
    );
  }
  const title = `Business Networking Events in ${region.name} ${year} – The Networker UK`;
  const meta = { title, description, canonical, image, ogType: 'website' };
  const pageName = `The best business networking events and groups in ${region.name} ${year}`;
  const about =
    region.areaType === 'county'
      ? {
          '@type': 'Place',
          name: region.name,
          address: {
            '@type': 'PostalAddress',
            addressRegion: region.name,
            addressCountry: 'GB',
          },
        }
      : {
          '@type': 'Place',
          name: region.name,
          address: {
            '@type': 'PostalAddress',
            addressLocality: region.name,
            addressCountry: 'GB',
          },
        };
  const collectionPage = {
    '@type': 'CollectionPage',
    '@id': canonical + '#directory',
    url: canonical,
    name: pageName,
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: 'The Networker UK',
      url: absoluteUrl(origin, '/'),
    },
    about,
  };
  const breadcrumbs = buildBreadcrumbListSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Networking', path: '/events/' },
      { name: region.name, path: region.path },
    ],
    origin
  );

  const schemaParts = [collectionPage, breadcrumbs];
  if (ssr.itemList) schemaParts.push(ssr.itemList);

  return {
    ok: true,
    type: 'networking-region',
    slug: region.slug,
    region: {
      slug: region.slug,
      name: region.name,
      location: region.location,
      path: region.path,
      areaType: region.areaType || 'city',
      year,
    },
    listingsHtml: ssr.listingsHtml,
    listingsTotal: eventCount,
    ...meta,
    openGraph: buildOpenGraphTags(meta),
    schema: buildSchemaGraphFromParts(schemaParts, origin),
    breadcrumbs: breadcrumbs.itemListElement,
  };
}

async function buildRankingBadgeMeta(lookup, origin) {
  const key = String(lookup || '').trim();
  const base = siteOrigin(origin);
  const report = await getPublicRankingLeaderboard().catch(() => null);
  const entries = (report && report.entries) || [];
  let entry = null;
  if (key && key !== 'default') {
    const keyLower = key.toLowerCase();
    entry =
      entries.find((row) => String(row.organiser?.id || '') === key) ||
      entries.find((row) => String(row.organiser?.slug || '').toLowerCase() === keyLower) ||
      null;
  }

  if (!entry) {
    const title = 'Ranking badge – The Networker UK';
    const description =
      'Share your Top 10, Top 25 or Top 50 networking group ranking badge from The Networker UK.';
    const canonical = absoluteUrl(origin, '/rankings/badge');
    const meta = {
      ok: true,
      type: 'ranking-badge',
      title,
      description,
      canonical,
      image: absoluteUrl(origin, '/assets/logo.png'),
      ogType: 'website',
    };
    return { ...meta, openGraph: buildOpenGraphTags(meta) };
  }

  const org = entry.organiser || {};
  const badgeLabel = entry.cardLabel || entry.displayLabel || entry.label || 'Top ranking';
  const name = org.name || 'Networking group';
  const title = `${name} — ${badgeLabel} | The Networker UK`;
  const description = `${name} is recognised as a ${badgeLabel} on The Networker UK — ranked by attendee ratings, then review rate.`;
  const qs = new URLSearchParams();
  if (org.id) qs.set('id', org.id);
  else if (org.slug) qs.set('slug', org.slug);
  const canonical = absoluteUrl(origin, '/rankings/badge' + (qs.toString() ? '?' + qs.toString() : ''));
  const image = buildRankingBadgeImageUrl(base, {
    tier: entry.tier,
    period: entry.periodLabel,
    organiserId: org.id,
    name,
  });
  const meta = {
    ok: true,
    type: 'ranking-badge',
    title,
    description,
    canonical,
    image,
    ogType: 'website',
    ranking: {
      tier: entry.tier,
      rank: entry.rank,
      periodLabel: entry.periodLabel,
      cardLabel: badgeLabel,
      organiserName: name,
    },
  };
  return { ...meta, openGraph: buildOpenGraphTags(meta) };
}

async function buildSeoMeta(type, slug, origin) {
  const t = String(type || '').toLowerCase();
  const s = String(slug || '').trim();
  if (t === 'page') return buildStaticPageMeta(s, origin);
  if (t === 'ranking-badge') return buildRankingBadgeMeta(s || 'default', origin);
  if (!s) return null;
  if (t === 'event') return buildEventMeta(s, origin);
  if (t === 'organiser') return buildOrganiserMeta(s, origin);
  if (t === 'opportunity') return buildOpportunityMeta(s, origin);
  if (t === 'networking-region') return await buildNetworkingRegionMeta(s, origin);
  return null;
}

module.exports = {
  buildSeoMeta,
  buildEventMeta,
  buildEventSchema,
  buildOrganiserMeta,
  buildOpportunityMeta,
  buildStaticPageMeta,
  buildNetworkingRegionMeta,
  buildRankingBadgeMeta,
  absoluteUrl,
  trimText,
};
