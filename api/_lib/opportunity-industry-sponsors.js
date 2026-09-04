/**
 * Industry Sponsor — exclusive logo on Opportunities browse when that industry is filtered.
 * Slot prefix: opportunity_industry_sponsor_{category}
 * Inventory mirrors opportunity CATEGORY_OPTIONS (excludes mlm + general).
 */
const { applyPrepaidTermDiscount } = require('./sponsorship-term-discounts');
const { isPublishableSponsorBlock } = require('./cms-sponsor-fields');

const INDUSTRY_SPONSOR_SLOT_PREFIX = 'opportunity_industry_sponsor_';
const LAUNCH_END_ISO = '2026-12-01T00:00:00.000Z';
const INDUSTRY_SPONSOR_VAT_RATE = 0.2;
const INDUSTRY_SPONSOR_PREPAID_TERMS = [6, 12];
const INDUSTRY_SPONSOR_PREPAID_TERMS_LEGACY = [1, 3, 6, 12];

const LAUNCH_PRICING = {
  singleMonthlyPence: 4900,
  singleLabel: '£49',
};

const REGULAR_PRICING = {
  singleMonthlyPence: 9900,
  singleLabel: '£99',
};

/** Sellable industry categories — keep labels in sync with js/opportunities-catalog.js */
const INDUSTRY_SPONSOR_CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', shortLabel: 'Cleaning' },
  { slug: 'home-services', name: 'Home services & trades', shortLabel: 'Trades' },
  { slug: 'food', name: 'Food & Drink', shortLabel: 'Food' },
  { slug: 'retail', name: 'Retail & E-commerce', shortLabel: 'Retail' },
  { slug: 'tech', name: 'Tech & Digital', shortLabel: 'Tech' },
  { slug: 'health', name: 'Health & Fitness', shortLabel: 'Health' },
  { slug: 'medical', name: 'Medical & clinical', shortLabel: 'Medical' },
  { slug: 'beauty', name: 'Beauty & Wellness', shortLabel: 'Beauty' },
  { slug: 'property', name: 'Property', shortLabel: 'Property' },
  { slug: 'automotive', name: 'Automotive', shortLabel: 'Auto' },
  { slug: 'education', name: 'Education & Coaching', shortLabel: 'Education' },
  { slug: 'childcare', name: 'Childcare & Family', shortLabel: 'Childcare' },
  { slug: 'care', name: 'Care & support', shortLabel: 'Care' },
  { slug: 'finance', name: 'Finance, legal & admin', shortLabel: 'Finance' },
  { slug: 'recruitment', name: 'Recruitment & staffing', shortLabel: 'Recruitment' },
  { slug: 'pets', name: 'Pets & Animals', shortLabel: 'Pets' },
  { slug: 'leisure', name: 'Leisure, travel & hospitality', shortLabel: 'Leisure' },
  { slug: 'networking', name: 'Networking', shortLabel: 'Networking' },
];

const INDUSTRY_BY_SLUG = new Map(INDUSTRY_SPONSOR_CATEGORIES.map((c) => [c.slug, c]));

function normalizeIndustrySponsorTerm(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw || raw === 'monthly' || raw === 'month' || raw === 'rolling' || raw === '0') {
    return { billingMode: 'monthly', termMonths: null };
  }
  if (raw === 'yearly' || raw === 'year' || raw === 'annual' || raw === 'annually') {
    return { billingMode: 'prepaid', termMonths: 12 };
  }
  const n = parseInt(raw, 10);
  if (INDUSTRY_SPONSOR_PREPAID_TERMS_LEGACY.includes(n)) {
    return { billingMode: 'prepaid', termMonths: n };
  }
  return { billingMode: 'monthly', termMonths: null };
}

function isOfferedIndustrySponsorCheckoutTerm(term) {
  const normalized = normalizeIndustrySponsorTerm(term);
  if (normalized.billingMode === 'monthly') return true;
  return INDUSTRY_SPONSOR_PREPAID_TERMS.includes(normalized.termMonths);
}

function addMonthsUtc(baseDate, months) {
  const d = new Date(baseDate);
  d.setUTCMonth(d.getUTCMonth() + Math.max(0, Math.floor(Number(months) || 0)));
  return d;
}

function isPrepaidIndustrySponsorHoldId(subscriptionId) {
  return String(subscriptionId || '')
    .trim()
    .toLowerCase()
    .startsWith('prepaid:');
}

function industrySponsorSlotKey(slug) {
  return INDUSTRY_SPONSOR_SLOT_PREFIX + String(slug || '').trim().toLowerCase();
}

function parseIndustrySponsorSlot(slot) {
  const key = String(slot || '').trim();
  if (!key.startsWith(INDUSTRY_SPONSOR_SLOT_PREFIX)) return null;
  const slug = key.slice(INDUSTRY_SPONSOR_SLOT_PREFIX.length);
  const category = INDUSTRY_BY_SLUG.get(slug);
  if (!category) return null;
  return { slug, slot: key, category };
}

function isIndustrySponsorSlot(slot) {
  return Boolean(parseIndustrySponsorSlot(slot));
}

function listIndustrySponsorCategories() {
  return INDUSTRY_SPONSOR_CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    shortLabel: c.shortLabel,
    slot: industrySponsorSlotKey(c.slug),
    path: '/opportunities/?category=' + encodeURIComponent(c.slug),
  })).sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
}

function normalizeIndustrySlugs(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || '')
        .split(/[,|]/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const slug = String(item || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!INDUSTRY_BY_SLUG.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function isLaunchPricingActive(now = new Date()) {
  return now.getTime() < new Date(LAUNCH_END_ISO).getTime();
}

function activePricing(now = new Date()) {
  return isLaunchPricingActive(now) ? LAUNCH_PRICING : REGULAR_PRICING;
}

function calculateIndustrySponsorQuote(industryCount, now = new Date(), term = null) {
  const count = Math.max(0, Math.floor(Number(industryCount) || 0));
  const pricing = activePricing(now);
  const monthlyPence = count * pricing.singleMonthlyPence;
  const { billingMode, termMonths } = normalizeIndustrySponsorTerm(term);
  const billableMonths = billingMode === 'prepaid' ? termMonths : 1;
  const listSubtotalExVatPence = monthlyPence * billableMonths;
  const discounted =
    billingMode === 'prepaid'
      ? applyPrepaidTermDiscount(listSubtotalExVatPence, termMonths)
      : {
          listPence: listSubtotalExVatPence,
          discountPercent: 0,
          discountPence: 0,
          netPence: listSubtotalExVatPence,
        };
  const subtotalExVatPence = discounted.netPence;
  const vatPence = Math.round(subtotalExVatPence * INDUSTRY_SPONSOR_VAT_RATE);
  return {
    industryCount: count,
    billingMode,
    termMonths,
    monthlyPence,
    monthlyGbp: monthlyPence / 100,
    listSubtotalExVatPence: discounted.listPence,
    discountPercent: discounted.discountPercent,
    discountPence: discounted.discountPence,
    subtotalExVatPence,
    vatPence,
    totalPence: subtotalExVatPence + vatPence,
    isLaunch: isLaunchPricingActive(now),
    launchEnds: LAUNCH_END_ISO,
    singleLabel: pricing.singleLabel,
  };
}

function industryPartnerStatus(row, now = new Date()) {
  if (!row) return { status: 'open', availableFrom: null };
  const subscriptionId = String(row.sponsor_subscription_id || '').trim();
  const availableFromRaw = row.sponsor_available_from || null;
  let availableFrom = null;
  if (availableFromRaw) {
    const d = new Date(availableFromRaw);
    if (!Number.isNaN(d.getTime())) availableFrom = d.toISOString();
  }

  if (subscriptionId) {
    if (availableFrom && new Date(availableFrom).getTime() <= now.getTime()) {
      return { status: 'open', availableFrom: null };
    }
    if (availableFrom) {
      return { status: 'held_until', availableFrom };
    }
    return { status: 'claimed', availableFrom: null };
  }

  if (isPublishableSponsorBlock(row, row.slot)) {
    return { status: 'claimed', availableFrom: null };
  }
  return { status: 'open', availableFrom: null };
}

async function getIndustrySponsorAvailability(sb) {
  const categories = listIndustrySponsorCategories();
  const slots = categories.map((c) => c.slot);
  const { data: rows, error } = await sb.from('cms_blocks').select('*').in('slot', slots);
  if (error) throw new Error(error.message);

  const bySlot = new Map((rows || []).map((row) => [row.slot, row]));
  const industries = categories.map((cat) => {
    const row = bySlot.get(cat.slot) || null;
    const status = industryPartnerStatus(row);
    return {
      ...cat,
      available: status.status === 'open',
      booked: status.status !== 'open',
      status: status.status,
      availableFrom: status.availableFrom,
      companyName: row?.company_name || null,
    };
  });

  const available = industries.filter((i) => i.available);
  const booked = industries.filter((i) => !i.available);
  const pricing = activePricing();

  return {
    ok: true,
    isLaunch: isLaunchPricingActive(),
    launchEnds: LAUNCH_END_ISO,
    pricing: {
      singleMonthlyGbp: pricing.singleMonthlyPence / 100,
      singleLabel: pricing.singleLabel,
      vatRate: INDUSTRY_SPONSOR_VAT_RATE,
      prepaidTerms: INDUSTRY_SPONSOR_PREPAID_TERMS.slice(),
      prepaidDiscounts: { 6: 10, 12: 15 },
      termNote:
        'Pay monthly and cancel any time, or prepay 6 or 12 months — 10% / 15% off prepaid terms.',
    },
    industries,
    available,
    booked,
    availableCount: available.length,
    totalCount: industries.length,
  };
}

function validateCheckoutIndustries(industries, availability, term = null) {
  const slugs = normalizeIndustrySlugs(industries);
  if (!slugs.length) {
    return { ok: false, error: 'missing_industries', message: 'Select at least one industry.' };
  }
  if (!isOfferedIndustrySponsorCheckoutTerm(term)) {
    return {
      ok: false,
      error: 'invalid_term',
      message: 'Choose monthly, 6 months, or yearly.',
    };
  }
  const open = new Set((availability?.available || []).map((i) => i.slug));
  const unavailable = slugs.filter((slug) => !open.has(slug));
  if (unavailable.length) {
    return {
      ok: false,
      error: 'industries_unavailable',
      unavailable,
      message: 'One or more selected industries are already reserved.',
    };
  }
  return {
    ok: true,
    industries: slugs,
    quote: calculateIndustrySponsorQuote(slugs.length, new Date(), term),
  };
}

module.exports = {
  INDUSTRY_SPONSOR_SLOT_PREFIX,
  INDUSTRY_SPONSOR_VAT_RATE,
  INDUSTRY_SPONSOR_PREPAID_TERMS,
  INDUSTRY_SPONSOR_CATEGORIES,
  LAUNCH_END_ISO,
  normalizeIndustrySponsorTerm,
  isOfferedIndustrySponsorCheckoutTerm,
  addMonthsUtc,
  isPrepaidIndustrySponsorHoldId,
  industrySponsorSlotKey,
  parseIndustrySponsorSlot,
  isIndustrySponsorSlot,
  listIndustrySponsorCategories,
  normalizeIndustrySlugs,
  isLaunchPricingActive,
  activePricing,
  calculateIndustrySponsorQuote,
  industryPartnerStatus,
  getIndustrySponsorAvailability,
  validateCheckoutIndustries,
};
