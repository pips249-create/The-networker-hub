/**
 * Hub advertising & listing prices — single source of truth for Stripe sync.
 * Run `npm run sync-stripe` to create/update Products, Prices, and Payment Links.
 */
const HUB_PLATFORM_META = 'networker_hub';

/** @typedef {'one_time' | 'recurring'} BillingType */

/**
 * @typedef {object} HubStripeCatalogItem
 * @property {string} key
 * @property {string} priceEnvVar
 * @property {string} [paymentLinkEnvVar]
 * @property {string} productName
 * @property {string} [description]
 * @property {number} amountPence
 * @property {BillingType} billing
 * @property {'month' | 'year'} [interval]
 * @property {boolean} createPaymentLink
 * @property {Record<string, string>} productMetadata
 * @property {Record<string, string>} [paymentLinkMetadata]
 */

/** @type {HubStripeCatalogItem[]} */
const HUB_STRIPE_CATALOG = [
  {
    key: 'events_main_sponsor',
    priceEnvVar: 'STRIPE_EVENTS_MAIN_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_EVENTS_MAIN_SPONSOR_PAYMENT_LINK',
    productName: 'Main Events Directory Sponsor',
    description: 'Hero Sponsor Hub on /events/ — exclusive monthly placement',
    amountPence: 200000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'events',
      placement: 'events_main_sponsor',
      cms_slot: 'events_sponsor_hub',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'events',
      placement: 'events_main_sponsor',
      cms_slot: 'events_sponsor_hub',
      package_name: 'Main Events Directory Sponsor',
    },
  },
  {
    key: 'events_mini_sponsor',
    priceEnvVar: 'STRIPE_EVENTS_MINI_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_EVENTS_MINI_SPONSOR_PAYMENT_LINK',
    productName: 'Events Mini Sponsor',
    description: 'Sidebar mini sponsor slot on event and organiser pages',
    amountPence: 60000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'events',
      placement: 'events_mini_sponsor',
      cms_slot: 'event_page_carousel_ads',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'events',
      placement: 'events_mini_sponsor',
      cms_slot: 'event_page_carousel_ads',
      package_name: 'Events Mini Sponsor',
    },
  },
  {
    key: 'organisers_main_sponsor',
    priceEnvVar: 'STRIPE_ORGANISERS_MAIN_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_ORGANISERS_MAIN_SPONSOR_PAYMENT_LINK',
    productName: 'Organisers Directory Sponsor',
    description: 'Hero Sponsor Hub on /events/ Organisers tab',
    amountPence: 100000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'browse_organisers',
      placement: 'organisers_main_sponsor',
      cms_slot: 'organisers_sponsor_hub',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'browse_organisers',
      placement: 'organisers_main_sponsor',
      cms_slot: 'organisers_sponsor_hub',
      package_name: 'Organisers Directory Sponsor',
    },
  },
  {
    key: 'organisers_mini_sponsor',
    priceEnvVar: 'STRIPE_ORGANISERS_MINI_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_ORGANISERS_MINI_SPONSOR_PAYMENT_LINK',
    productName: 'Organisers Mini Sponsor',
    description: 'Sidebar mini sponsor slot on organiser profile pages',
    amountPence: 30000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'browse_organisers',
      placement: 'organisers_mini_sponsor',
      cms_slot: 'organiser_page_sidebar_ad',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'browse_organisers',
      placement: 'organisers_mini_sponsor',
      cms_slot: 'organiser_page_sidebar_ad',
      package_name: 'Organisers Mini Sponsor',
    },
  },
  {
    key: 'opportunities_main_sponsor',
    priceEnvVar: 'STRIPE_OPPORTUNITIES_MAIN_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_OPPORTUNITIES_MAIN_SPONSOR_PAYMENT_LINK',
    productName: 'Opportunities Directory Sponsor',
    description: 'Hero Sponsor Hub on /opportunities/',
    amountPence: 200000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'opportunities',
      placement: 'opportunities_main_sponsor',
      cms_slot: 'opportunities_sponsor_hub',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'opportunities',
      placement: 'opportunities_main_sponsor',
      cms_slot: 'opportunities_sponsor_hub',
      package_name: 'Opportunities Directory Sponsor',
    },
  },
  {
    key: 'opportunities_mini_sponsor',
    priceEnvVar: 'STRIPE_OPPORTUNITIES_MINI_SPONSOR_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_OPPORTUNITIES_MINI_SPONSOR_PAYMENT_LINK',
    productName: 'Opportunities Mini Sponsor',
    description: 'Sidebar mini sponsor slot on opportunity detail pages',
    amountPence: 60000,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'opportunities',
      placement: 'opportunities_mini_sponsor',
      cms_slot: 'opportunity_page_sidebar_ad',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'opportunities',
      placement: 'opportunities_mini_sponsor',
      cms_slot: 'opportunity_page_sidebar_ad',
      package_name: 'Opportunities Mini Sponsor',
    },
  },
  {
    key: 'event_featured_1month',
    priceEnvVar: 'STRIPE_EVENT_FEATURED_1MONTH_PRICE_ID',
    productName: 'Featured event listing — 1 month',
    description: 'Premium Spotlight carousel placement for one month',
    amountPence: 5500,
    billing: 'one_time',
    createPaymentLink: false,
    productMetadata: {
      checkout_type: 'event_featured',
      featured_plan: '1month',
    },
  },
  {
    key: 'opportunity_premium',
    priceEnvVar: 'STRIPE_OPPORTUNITY_PREMIUM_PRICE_ID',
    productName: 'Premium business opportunity listing',
    description: 'Featured placement in the opportunities directory',
    amountPence: 5500,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: false,
    productMetadata: {
      checkout_type: 'opportunity_premium',
    },
  },
  {
    key: 'organiser_featured',
    priceEnvVar: 'STRIPE_ORGANISER_FEATURED_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_ORGANISER_FEATURED_PAYMENT_LINK',
    productName: 'Featured organiser profile',
    description: 'Premium Spotlight carousel on the organisers browse page',
    amountPence: 2750,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: true,
    productMetadata: {
      revenue_category: 'browse_organisers',
      placement: 'organisers_featured',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'browse_organisers',
      placement: 'organisers_featured',
      package_name: 'Featured organiser profile',
    },
  },
  {
    key: 'city_partner_single',
    priceEnvVar: 'STRIPE_CITY_PARTNER_SINGLE_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_CITY_PARTNER_SINGLE_PAYMENT_LINK',
    productName: 'City Partner — single city (launch rate)',
    description:
      'Logo + CTA on one /networking/:city page. Launch rate until 1 Dec 2026. Website only — not in hub emails.',
    amountPence: 4900,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: false,
    productMetadata: {
      revenue_category: 'events',
      placement: 'city_partner_single',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'events',
      placement: 'city_partner_single',
      package_name: 'City Partner — single city',
    },
  },
  {
    key: 'city_partner_bundle_3',
    priceEnvVar: 'STRIPE_CITY_PARTNER_BUNDLE_3_PRICE_ID',
    paymentLinkEnvVar: 'STRIPE_CITY_PARTNER_BUNDLE_3_PAYMENT_LINK',
    productName: 'City Partner — 3-city pack (launch rate)',
    description:
      'Logo + CTA on three /networking/:city pages. Launch rate until 1 Dec 2026. Website only — not in hub emails.',
    amountPence: 12900,
    billing: 'recurring',
    interval: 'month',
    createPaymentLink: false,
    productMetadata: {
      revenue_category: 'events',
      placement: 'city_partner_bundle_3',
    },
    paymentLinkMetadata: {
      checkout_type: 'hub_sponsorship',
      revenue_category: 'events',
      placement: 'city_partner_bundle_3',
      package_name: 'City Partner — 3-city pack',
    },
  },
];

function getCatalogItem(key) {
  return HUB_STRIPE_CATALOG.find((item) => item.key === key) || null;
}

function getCatalogPriceId(key) {
  const item = getCatalogItem(key);
  if (!item) return '';
  return String(process.env[item.priceEnvVar] || '').trim();
}

function formatGbp(pence) {
  return '£' + (pence / 100).toFixed(2).replace(/\.00$/, '');
}

module.exports = {
  HUB_PLATFORM_META,
  HUB_STRIPE_CATALOG,
  getCatalogItem,
  getCatalogPriceId,
  formatGbp,
};
