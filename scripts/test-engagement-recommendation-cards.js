/**
 * Partner spotlight prepend + organiser logo on nurture recommendation cards.
 * Run: node scripts/test-engagement-recommendation-cards.js
 */
const {
  prependPartnerSpotlightEvents,
  fetchPartnerSpotlightEvents,
  shouldPrependPartnersToNearbySection,
  shouldPinPartnersIntoPopularSection,
  nearbyResultIsOnlineFallback,
  nearbySectionHeading,
} = require('../api/_lib/nearby-events');
const {
  recommendationCard,
  eventRecommendationCard,
} = require('../api/_lib/engagement-recommendation-cards');
const {
  PARTNER_EMAIL_SPOTLIGHT_SLUGS,
  MARTECH_SUMMIT_EVENT_SLUG,
  BUSINESS_SHOW_LONDON_EVENT_SLUG,
  COFOUNDER_EVENT_PROMO_UNTIL_MS,
} = require('../api/_lib/hubert-event-concierge');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  console.log('ok:', msg);
}

assert(
  PARTNER_EMAIL_SPOTLIGHT_SLUGS[0] === MARTECH_SUMMIT_EVENT_SLUG,
  'MarTech is first partner spotlight slug'
);
assert(
  PARTNER_EMAIL_SPOTLIGHT_SLUGS.includes(BUSINESS_SHOW_LONDON_EVENT_SLUG),
  'Business Show is a partner spotlight slug'
);

const partners = [
  {
    id: 'martech-1',
    slug: MARTECH_SUMMIT_EVENT_SLUG,
    title: 'The MarTech Summit London 2026',
    starts_at: '2026-11-10T09:00:00.000Z',
    organisers: {
      name: 'The MarTech Summit',
      photo_url: 'https://cdn.example.com/martech-logo.png',
    },
  },
  {
    id: 'biz-1',
    slug: BUSINESS_SHOW_LONDON_EVENT_SLUG,
    title: 'The Business Show London',
    starts_at: '2026-11-11T10:00:00.000Z',
    organisers: { name: 'The Business Show – London', photo_url: '' },
  },
];

const existing = [
  {
    id: 'biz-1',
    slug: BUSINESS_SHOW_LONDON_EVENT_SLUG,
    title: 'The Business Show London',
    starts_at: '2026-11-12T10:00:00.000Z',
  },
  {
    id: 'pdn-1',
    title: 'Property Deal Network Stoke-on-Trent',
    starts_at: '2029-03-28T18:00:00.000Z',
    organisers: { name: 'Property Deal Network UK' },
  },
];

const merged = prependPartnerSpotlightEvents(existing, partners, 3);
assert(merged.length === 3, 'merged list capped at limit');
assert(merged[0].id === 'martech-1', 'MarTech pinned first');
assert(merged[1].id === 'biz-1', 'Business Show second (deduped)');
assert(merged[2].id === 'pdn-1', 'remaining pick kept third');
assert(
  !merged.some((row, i) => merged.findIndex((other) => other.id === row.id) !== i),
  'no duplicate ids after prepend'
);

assert(
  nearbyResultIsOnlineFallback({ source: 'popular_online' }),
  'popular_online is an online fallback'
);
assert(
  nearbyResultIsOnlineFallback({ outsideUk: true, source: null }),
  'outside UK uses online fallback'
);
assert(
  !nearbyResultIsOnlineFallback({ source: 'nearby' }),
  'real nearby is not an online fallback'
);
assert(
  !shouldPrependPartnersToNearbySection({ source: 'popular_online', events: [{ id: 'o1' }] }),
  'do not prepend in-person partners under Popular online events'
);
assert(
  shouldPinPartnersIntoPopularSection({ source: 'popular_online', events: [{ id: 'o1' }] }),
  'pin partners into Popular when nearby is online-only'
);
assert(
  !shouldPrependPartnersToNearbySection({
    source: 'nearby',
    events: [{ id: 'n1' }],
  }),
  'do not prepend partners when real nearby hits exist'
);
assert(
  shouldPrependPartnersToNearbySection({
    source: 'upcoming',
    events: [{ id: 'u1' }],
  }),
  'upcoming fallback may still pin partners into that section'
);
assert(
  nearbySectionHeading({ source: 'popular_online' }) === 'Popular online events',
  'online fallback keeps Popular online events heading'
);
assert(
  !/Business Show/i.test(
    nearbySectionHeading({ source: 'popular_online' })
  ),
  'heading itself stays online-only copy'
);

const withLogo = recommendationCard(
  'The MarTech Summit London 2026',
  'The MarTech Summit · Tuesday 10 November 2026 · London',
  'https://www.thenetworkeruk.com/events/the-martech-summit-london-2026',
  {
    logoUrl: 'https://cdn.example.com/martech-logo.png',
    logoAlt: 'The MarTech Summit',
  }
);
assert(/martech-logo\.png/.test(withLogo), 'card includes organiser logo img');
assert(/alt="The MarTech Summit"/.test(withLogo), 'logo alt text set');
assert(/background:#ffffff/.test(withLogo), 'logo sits on light plate for navy card');
assert(/View &rarr;/.test(withLogo), 'View CTA preserved');

const withoutLogo = recommendationCard(
  'Property Deal Network',
  'Property Deal Network UK · Wednesday 28 March 2029 · Stoke-on-Trent',
  'https://www.thenetworkeruk.com/events/pdn'
);
assert(!/<img /.test(withoutLogo), 'card without logo has no img');

const fromEvent = eventRecommendationCard(
  {
    title: 'The MarTech Summit London 2026',
    slug: MARTECH_SUMMIT_EVENT_SLUG,
    starts_at: '2026-11-10T09:00:00.000Z',
    city: 'London',
    organisers: {
      name: 'The MarTech Summit',
      photo_url: 'https://cdn.example.com/martech-logo.png',
    },
  },
  'https://www.thenetworkeruk.com'
);
assert(/The MarTech Summit London 2026/.test(fromEvent), 'event card title');
assert(/The MarTech Summit/.test(fromEvent), 'event card organiser name');
assert(/martech-logo\.png/.test(fromEvent), 'event card uses organiser photo_url');

const mockRows = [
  {
    id: 'm1',
    slug: MARTECH_SUMMIT_EVENT_SLUG,
    title: 'The MarTech Summit London 2026',
    starts_at: '2026-11-10T09:00:00.000Z',
    status: 'published',
    approval_status: 'Approved',
  },
  {
    id: 'm2',
    slug: MARTECH_SUMMIT_EVENT_SLUG,
    title: 'The MarTech Summit London 2026',
    starts_at: '2026-11-11T09:00:00.000Z',
    status: 'published',
    approval_status: 'Approved',
  },
  {
    id: 'b1',
    slug: BUSINESS_SHOW_LONDON_EVENT_SLUG,
    title: 'The Business Show London',
    starts_at: '2026-11-11T10:00:00.000Z',
    status: 'published',
    approval_status: 'Approved',
  },
];

const mockSb = {
  from() {
    return {
      select() {
        return this;
      },
      in() {
        return this;
      },
      eq() {
        return this;
      },
      gt() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return Promise.resolve({ data: mockRows, error: null });
      },
    };
  },
};

(async () => {
  const spotlight = await fetchPartnerSpotlightEvents(mockSb, {
    now: new Date('2026-10-20T12:00:00Z'),
  });
  assert(spotlight.length === 2, 'fetches one row per partner slug');
  assert(spotlight[0].id === 'm1', 'keeps earliest MarTech date');
  assert(spotlight[1].id === 'b1', 'includes Business Show');

  const afterShows = await fetchPartnerSpotlightEvents(mockSb, {
    now: new Date(COFOUNDER_EVENT_PROMO_UNTIL_MS + 1000),
  });
  assert(afterShows.length === 0, 'partner spotlight empty after November shows');

  console.log('All engagement recommendation card checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
