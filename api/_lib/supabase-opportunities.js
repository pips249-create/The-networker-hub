/**
 * Business opportunity listings — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');
const { resolveOpportunityDisplayCover } = require('./opportunity-media');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const {
  effectiveReviewSubmittedAt,
  isOpportunitySubmittedForReview,
  mergeReviewSubmittedMeta,
  stampOpportunityReviewSubmission,
} = require('./opportunity-review-queue');
const {
  normalizeListingMonths,
  addMonths,
  listingPaymentCurrent,
} = require('./opportunity-listing-pricing');
const { ensureOpportunitySlug, publicOpportunitySlug, slugMatchesPublicRow, isUuidSlug } =
  require('./opportunity-slug');
const { scanOpportunityRedFlags, stripEarningsMeta, isNetworkMarketingType } = require('./opportunity-moderation');
const { assertExclusiveBrandAvailable } = require('./opportunity-brand-exclusivity');
const { isHubSeedOwnerEmail } = require('./opportunity-hub-seed');
const { parseOutcode, resolveRegionSlug } = require('./uk-outcode');

const HOST_COLORS = [
  '#7a5c0a',
  '#0d5a52',
  '#166534',
  '#1d4ed8',
  '#6b21a8',
  '#374151',
  '#9d174d',
  '#b45309',
  '#c2410c',
  '#0d1f3c',
];

const VALID_TYPES = new Set([
  'franchise',
  'side-hustle',
  'partnership',
  'affiliate',
  'networking',
  'distributorship',
  'business-opportunity',
  'network-marketing',
]);

function hostInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function hostColorFromName(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % HOST_COLORS.length;
  return HOST_COLORS[h];
}

function normalizeMeta(meta) {
  if (!Array.isArray(meta)) return [];
  return meta
    .map((m) => ({
      key: String(m.key || '').trim(),
      val: String(m.val || '').trim(),
    }))
    .filter((m) => m.key && m.val);
}

function normalizeListingMeta(meta) {
  return stripEarningsMeta(normalizeMeta(meta)).filter(function (m) {
    return m.key && !String(m.key).startsWith('__');
  });
}

function normalizeType(type) {
  const s = String(type || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  if (VALID_TYPES.has(s)) return s;
  if (s === 'sidehustle') return 'side-hustle';
  if (s === 'business') return 'business-opportunity';
  if (s === 'networkmarketing' || s === 'mlm') return 'network-marketing';
  if (s === 'affiliate-programme' || s === 'affiliate-program' || s === 'affiliates') return 'affiliate';
  return 'business-opportunity';
}

function metaValFromList(meta, keyRe) {
  for (let i = 0; i < (meta || []).length; i++) {
    if (keyRe.test(String(meta[i].key || ''))) return String(meta[i].val || '').trim();
  }
  return '';
}

function hasMeaningfulInvestmentMeta(meta) {
  const raw = metaValFromList(meta, /^investment$/i);
  if (!raw) return false;
  if (/^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable|on request)$/i.test(raw)) {
    return false;
  }
  const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return !Number.isNaN(num) && num > 0;
}

/** Legacy Partnership / Affiliate rows stored as partnership with commission only. */
function isLegacyAffiliatePartnership(listing) {
  const types = [];
  if (listing?.type) types.push(String(listing.type).toLowerCase());
  (Array.isArray(listing?.tags) ? listing.tags : []).forEach((tag) => {
    const t = String(tag || '').toLowerCase();
    if (t && types.indexOf(t) === -1) types.push(t);
  });
  if (types.indexOf('affiliate') !== -1) return false;
  if (types.indexOf('partnership') === -1) return false;
  const capitalOthers = [
    'franchise',
    'distributorship',
    'business-opportunity',
    'network-marketing',
  ];
  if (types.some((t) => capitalOthers.indexOf(t) !== -1)) return false;
  const meta = Array.isArray(listing?.meta) ? listing.meta : [];
  if (!metaValFromList(meta, /^commission$/i)) return false;
  return !hasMeaningfulInvestmentMeta(meta);
}

function coerceLegacyAffiliateListing(listing) {
  if (!listing || !isLegacyAffiliatePartnership(listing)) return listing;
  const tags = (Array.isArray(listing.tags) ? listing.tags : [])
    .map((t) => (String(t).toLowerCase() === 'partnership' ? 'affiliate' : t))
    .filter(Boolean);
  if (tags.indexOf('affiliate') === -1) tags.push('affiliate');
  return Object.assign({}, listing, { type: 'affiliate', tags });
}

/** Drop type pairs that must never share a listing (keeps earlier/primary type). */
function dropIncompatibleOpportunityTypes(types) {
  const incompatible = {
    franchise: ['network-marketing'],
    networking: ['network-marketing'],
    'network-marketing': ['franchise', 'networking'],
  };
  const list = Array.isArray(types) ? types.filter(Boolean) : [];
  if (list.length < 2) return list;
  const keep = [];
  list.forEach((type) => {
    const blocked = incompatible[type] || [];
    const conflicts = keep.some(
      (kept) => blocked.includes(kept) || (incompatible[kept] || []).includes(type)
    );
    if (!conflicts) keep.push(type);
  });
  return keep;
}

function normalizeTypes(payload) {
  const raw = Array.isArray(payload?.types)
    ? payload.types
    : payload?.type
      ? [payload.type]
      : Array.isArray(payload?.tags)
        ? payload.tags.filter((t) => VALID_TYPES.has(normalizeType(t)))
        : [];
  const out = [];
  raw.forEach((t) => {
    const norm = normalizeType(t);
    if (VALID_TYPES.has(norm) && !out.includes(norm)) out.push(norm);
  });
  // Affiliate is a separate track — never combine with other opportunity types.
  if (out.includes('affiliate') && out.length > 1) {
    const capital = [
      'franchise',
      'distributorship',
      'business-opportunity',
      'network-marketing',
      'partnership',
    ];
    if (out.some((t) => capital.includes(t))) {
      return dropIncompatibleOpportunityTypes(out.filter((t) => t !== 'affiliate'));
    }
    return ['affiliate'];
  }
  return dropIncompatibleOpportunityTypes(out);
}

function buildOpportunityTags(types, payload) {
  const tags = types.slice();
  const category = String(payload.category || '').trim();
  if (category && category !== 'general') tags.push('cat-' + category);
  if (Array.isArray(payload.tags)) {
    payload.tags.forEach((tag) => {
      const t = String(tag || '').trim();
      if (t && !tags.includes(t)) tags.push(t);
    });
  }
  return tags;
}

function metaValue(meta, keyRe) {
  const list = normalizeMeta(meta);
  for (let i = 0; i < list.length; i++) {
    if (keyRe.test(list[i].key)) return list[i].val;
  }
  return '';
}

/** Derive outcode + region_slug from opportunity location fields / meta. */
function deriveOpportunityGeo(payload, meta) {
  const locationText =
    String(payload.location || payload.territory || '').trim() ||
    metaValue(meta, /^location$/i) ||
    metaValue(meta, /territor/i) ||
    '';
  const outcode = parseOutcode(locationText) || null;
  const regionSlug =
    resolveRegionSlug({
      location: locationText,
      city: locationText,
      outcode,
      postcode: locationText,
      regionSlug: payload.regionSlug || payload.region_slug,
    }) || null;
  return { locationText, outcode, regionSlug };
}

function stripOpportunityGeoFields(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  delete next.outcode;
  delete next.region_slug;
  return next;
}

function stripOpportunityReviewQueueFields(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  delete next.review_submitted_at;
  delete next.approved_at;
  delete next.approved_pay_reminder_sent_at;
  return next;
}

function stripOpportunityPendingReviewFields(row) {
  if (!row || typeof row !== 'object') return row;
  const next = { ...row };
  delete next.pending_review_payload;
  return next;
}

function isMissingOpportunityPendingReviewColumnError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (!msg.includes('pending_review_payload')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('unknown column')
  );
}

function pickPendingReviewRowFields(row) {
  if (!row || typeof row !== 'object') return {};
  const keys = [
    'type',
    'category',
    'title',
    'description',
    'about',
    'host',
    'host_initials',
    'host_color',
    'contact_email',
    'meta',
    'tags',
    'image_url',
    'logo_url',
    'outcode',
    'region_slug',
    'package_tier',
  ];
  const out = {};
  keys.forEach(function (key) {
    if (row[key] !== undefined) out[key] = row[key];
  });
  return out;
}

function applyPendingReviewOverlay(listing, pendingPayload) {
  if (!listing || !pendingPayload || !pendingPayload.row) return listing;
  const p = pendingPayload.row;
  const next = Object.assign({}, listing);
  if (p.type) next.type = p.type;
  if (p.category) next.category = p.category;
  if (p.title) next.title = String(p.title).trim();
  if (p.description != null) {
    next.desc = String(p.description).trim();
    next.description = next.desc;
  }
  if (Array.isArray(p.about)) next.about = p.about.slice();
  if (p.host) next.host = String(p.host).trim();
  if (p.host_initials) next.hostInitials = p.host_initials;
  if (p.host_color) next.hostColor = p.host_color;
  if (p.contact_email) next.contactEmail = String(p.contact_email).trim();
  if (Array.isArray(p.meta)) next.meta = normalizeListingMeta(p.meta);
  if (Array.isArray(p.tags)) next.tags = p.tags.slice();
  if (p.image_url != null) next.imageUrl = String(p.image_url || '').trim();
  if (p.logo_url != null) next.logoUrl = String(p.logo_url || '').trim();
  if (p.outcode != null) next.outcode = String(p.outcode || '').trim();
  if (p.region_slug != null) next.regionSlug = String(p.region_slug || '').trim();
  next.hasPendingChanges = true;
  next.pendingReviewSubmittedAt = pendingPayload.submittedAt || null;
  return coerceLegacyAffiliateListing(next);
}

/** True when PostgREST/Postgres rejects outcode/region_slug (migration 207 not applied). */
function isMissingOpportunityGeoColumnError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (!msg.includes('outcode') && !msg.includes('region_slug')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('unknown column')
  );
}

/** True when review-then-pay columns are missing (migration 266 not applied). */
function isMissingOpportunityReviewQueueColumnError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (
    !msg.includes('review_submitted_at') &&
    !msg.includes('approved_at') &&
    !msg.includes('approved_pay_reminder_sent_at')
  ) {
    return false;
  }
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('unknown column')
  );
}

/**
 * Insert/update with geo columns; if migration 207 is not applied yet, retry without them
 * so Command Centre / organiser creates still succeed.
 */
async function writeOpportunityRow(sb, mode, row, id) {
  const run = (payload) => {
    if (mode === 'insert') {
      return sb.from('business_opportunities').insert(payload).select('*').single();
    }
    return sb.from('business_opportunities').update(payload).eq('id', id).select('*').single();
  };

  let { data, error } = await run(row);
  if (error && isMissingOpportunityGeoColumnError(error)) {
    console.warn(
      '[opportunities] outcode/region_slug columns missing — apply migration 207_regional_index_captures.sql'
    );
    ({ data, error } = await run(stripOpportunityGeoFields(row)));
  }
  if (error && isMissingOpportunityReviewQueueColumnError(error)) {
    console.warn(
      '[opportunities] review queue columns missing — apply migration 266_opportunity_review_queue_and_pay_reminder.sql'
    );
    ({ data, error } = await run(stripOpportunityReviewQueueFields(row)));
  }
  if (error && isMissingOpportunityPendingReviewColumnError(error)) {
    console.warn(
      '[opportunities] pending_review_payload missing — apply migration 272_opportunity_pending_review_payload.sql'
    );
    ({ data, error } = await run(stripOpportunityPendingReviewFields(row)));
  }
  if (error) throw new Error(error.message);
  return data;
}

function normalizeStatus(input) {
  const s = String(input || '')
    .toLowerCase()
    .trim();
  if (s === 'publish' || s === 'published' || s === 'submit' || s === 'submitted') return 'published';
  if (s === 'unpublish' || s === 'unpublished') return 'unpublished';
  return 'draft';
}

function rowToListing(row) {
  if (!row) return null;
  const meta = normalizeListingMeta(row.meta);
  return coerceLegacyAffiliateListing({
    id: row.id,
    slug: publicOpportunitySlug(row),
    type: row.type,
    tags: Array.isArray(row.tags) && row.tags.length ? row.tags.slice() : [row.type],
    featured: Boolean(row.featured),
    featuredUntil: row.featured_until || null,
    host: String(row.host || '').trim(),
    hostInitials: row.host_initials || hostInitials(row.host),
    hostColor: row.host_color || hostColorFromName(row.host),
    title: String(row.title || '').trim(),
    desc: String(row.description || '').trim(),
    about: Array.isArray(row.about) ? row.about.map(String) : [],
    meta,
    category: row.category || 'general',
    contactEmail: String(row.contact_email || '').trim(),
    imageUrl: String(row.image_url || '').trim(),
    logoUrl: String(row.logo_url || '').trim(),
    ...(() => {
      const cover = resolveOpportunityDisplayCover(row.image_url, row.logo_url);
      return {
        displayCoverUrl: cover.cover_url,
        coverIsLogoFallback: cover.cover_is_logo_fallback,
      };
    })(),
    status: row.status || 'draft',
    approvalStatus: row.approval_status || 'Pending Review',
    reviewSubmittedAt: effectiveReviewSubmittedAt(row),
    approvedAt: row.approved_at || null,
    organiserId: row.organiser_id || '',
    ownerEmail: String(row.owner_email || '').toLowerCase(),
    ownerUserId: row.supabase_user_id || '',
    ownershipClaimStatus: row.ownership_claim_status || null,
    claimable:
      isHubSeedOwnerEmail(row.owner_email) && row.ownership_claim_status !== 'pending',
    packageTier: row.package_tier || null,
    listingMonths: row.listing_months != null ? Number(row.listing_months) : null,
    listingPaidAt: row.listing_paid_at || null,
    listingExpiresAt: row.listing_expires_at || null,
    listingStripeSubscriptionId: row.listing_stripe_subscription_id || null,
    listingPaymentActive: listingPaymentCurrent(row),
    outcode: String(row.outcode || '').trim(),
    regionSlug: String(row.region_slug || '').trim(),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    rejectionNote: row.rejection_note || null,
    publishedAt: row.published_at || null,
    viewCount: Number(row.view_count) || 0,
    hasPendingChanges: Boolean(row.pending_review_payload && row.pending_review_payload.row),
    pendingReviewSubmittedAt:
      (row.pending_review_payload && row.pending_review_payload.submittedAt) || null,
  });
}

async function incrementOpportunityViewCount(opportunityId) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');
  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('business_opportunities')
    .select('id, status, approval_status, view_count')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error('not_found');
  if (String(existing.status || '').toLowerCase() !== 'published') throw new Error('not_found');
  if (String(existing.approval_status || '') !== 'Approved') throw new Error('not_found');

  const next = Math.max(0, Number(existing.view_count) || 0) + 1;
  const { error } = await sb.from('business_opportunities').update({ view_count: next }).eq('id', id);
  if (error) throw new Error(error.message);
  return next;
}

async function rejectOpportunityListing(opportunityId, rejectionNote, options) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');

  const note = String(rejectionNote || '').trim();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .update({
      approval_status: 'Rejected',
      status: 'unpublished',
      rejection_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  if (!options || options.sendEmail !== false) {
    try {
      const { sendOpportunityRejectedEmail } = require('./lifecycle-emails');
      await sendOpportunityRejectedEmail(data, note);
    } catch {
      /* email failure must not block rejection */
    }
  }

  return rowToListing(data);
}

async function maybeAutoRejectOpportunity(row) {
  if (!row) return { rejected: false };
  const scan = scanOpportunityRedFlags(row);
  if (!scan) return { rejected: false };
  const listing = await rejectOpportunityListing(row.id, scan.rejectionNote, { automated: true });
  return { rejected: true, listing, scan };
}

async function resolveOpportunityImage(payload, opportunityId) {
  if (payload.photoBase64) {
    const url = await resolveImageUrl({
      folder: `opportunities/${opportunityId || 'new'}/cover`,
      logoUrl: payload.photoUrl,
      logoBase64: payload.photoBase64,
      logoMime: payload.photoMime,
      logoFilename: payload.photoFilename,
    });
    if (url) return url;
    throw new Error('cover_upload_failed');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'photoUrl')) {
    const url = String(payload.photoUrl || '').trim();
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\//i.test(url)) {
      const uploaded = await resolveImageUrl({
        folder: `opportunities/${opportunityId || 'new'}/cover`,
        logoUrl: url,
        logoBase64: url,
        logoMime: payload.photoMime,
        logoFilename: payload.photoFilename,
      });
      if (uploaded) return uploaded;
    }
    return null;
  }
  return undefined;
}

async function resolveOpportunityLogo(payload, opportunityId) {
  if (payload.logoBase64) {
    const url = await resolveImageUrl({
      folder: `opportunities/${opportunityId || 'new'}/logo`,
      logoUrl: payload.logoUrl,
      logoBase64: payload.logoBase64,
      logoMime: payload.logoMime,
      logoFilename: payload.logoFilename,
    });
    if (url) return url;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'logoUrl')) {
    const url = String(payload.logoUrl || '').trim();
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    if (/^data:image\//i.test(url)) {
      const uploaded = await resolveImageUrl({
        folder: `opportunities/${opportunityId || 'new'}/logo`,
        logoUrl: url,
        logoBase64: url,
        logoMime: payload.logoMime,
        logoFilename: payload.logoFilename,
      });
      if (uploaded) return uploaded;
    }
    return null;
  }
  return undefined;
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function opportunityOwnedBySession(session, opportunity) {
  if (!session || !opportunity) return false;
  const email = String(session.email || '').toLowerCase();
  if (email && opportunity.ownerEmail && opportunity.ownerEmail === email) return true;
  const uid = isUuid(session.sub) ? session.sub : '';
  if (uid && opportunity.ownerUserId && opportunity.ownerUserId === uid) return true;
  return false;
}

async function buildOpportunityRow(payload, opportunityId, mode) {
  const host = String(payload.host || payload.company || '').trim();
  const status = normalizeStatus(payload.listingStatus || payload.status);
  const types = normalizeTypes(payload);
  const row = {
    organiser_id: null,
    type: types[0] || normalizeType(payload.type),
    category: String(payload.category || '').trim() || null,
    title: String(payload.title || '').trim(),
    description: String(payload.description || payload.desc || '').trim() || null,
    about: Array.isArray(payload.about)
      ? payload.about.map((p) => String(p).trim()).filter(Boolean)
      : String(payload.aboutText || '')
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
    host,
    host_initials: payload.hostInitials || hostInitials(host),
    host_color: payload.hostColor || hostColorFromName(host),
    contact_email: String(payload.contactEmail || '').trim() || null,
    meta: normalizeListingMeta(payload.meta),
    tags: buildOpportunityTags(types, payload),
    package_tier: String(payload.packageTier || '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const geo = deriveOpportunityGeo(payload, row.meta);
  row.outcode = geo.outcode;
  row.region_slug = geo.regionSlug;

  const imageUrl = await resolveOpportunityImage(payload, opportunityId);
  if (imageUrl !== undefined) row.image_url = imageUrl;

  const logoUrl = await resolveOpportunityLogo(payload, opportunityId);
  if (logoUrl !== undefined) row.logo_url = logoUrl;

  if (mode === 'create') {
    const ownerEmail = String(payload.ownerEmail || payload.email || '').toLowerCase();
    const ownerUserId = isUuid(payload.ownerUserId) ? payload.ownerUserId : null;
    if (ownerEmail) row.owner_email = ownerEmail;
    if (ownerUserId) row.supabase_user_id = ownerUserId;
  }

  if (mode === 'create' || payload.listingStatus != null || payload.status != null) {
    row.status = status;
    if (status === 'published') {
      row.published_at = new Date().toISOString();
      if (mode === 'create') {
        row.approval_status = 'Pending Review';
      }
    }
  }

  return row;
}

async function activateOpportunityListingPayment(opportunityId, monthsOrOpts, sessionIdMaybe) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');

  let opts = {};
  if (monthsOrOpts && typeof monthsOrOpts === 'object' && !Array.isArray(monthsOrOpts)) {
    opts = monthsOrOpts;
  } else {
    opts = {
      months: monthsOrOpts,
      sessionId: sessionIdMaybe,
    };
  }

  const sid = opts.sessionId ? String(opts.sessionId).trim() : '';
  let subscriptionId = opts.subscriptionId ? String(opts.subscriptionId).trim() : '';
  const periodEnd = opts.periodEndIso ? new Date(opts.periodEndIso) : null;
  const termMonths = normalizeListingMonths(opts.months != null ? opts.months : 1);

  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error('not_found');

  let resolvedSessionId = sid;
  if (!resolvedSessionId && subscriptionId) {
    const { getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
    const { resolveListingCheckoutSessionId } = require('./opportunity-listing-subscriptions');
    if (isStripeCheckoutConfigured()) {
      try {
        resolvedSessionId = await resolveListingCheckoutSessionId(
          getStripeClient(),
          subscriptionId,
          id
        );
      } catch {
        /* ignore */
      }
    }
  }

  // Stripe retries must not re-activate for the same checkout session.
  if (resolvedSessionId && String(existing.listing_stripe_session_id || '').trim() === resolvedSessionId) {
    if (
      listingPaymentCurrent(existing) &&
      String(existing.status || '').toLowerCase() === 'published'
    ) {
      return rowToListing(existing);
    }
  }

  const now = new Date();
  let expiresAt;
  if (periodEnd && !Number.isNaN(periodEnd.getTime())) {
    expiresAt = periodEnd;
  } else {
    let base = now;
    if (existing.listing_expires_at && new Date(existing.listing_expires_at) > base) {
      base = new Date(existing.listing_expires_at);
    }
    expiresAt = addMonths(base, termMonths);
  }

  const slug = await ensureOpportunitySlug(sb, {
    title: existing.title,
    opportunityId: id,
    currentSlug: existing.slug,
  });

  const wasLive =
    String(existing.approval_status || '') === 'Approved' &&
    String(existing.status || '').toLowerCase() === 'published' &&
    listingPaymentCurrent(existing);

  const patch = {
    status: 'published',
    approval_status: existing.approval_status === 'Approved' ? 'Approved' : 'Pending Review',
    slug,
    published_at: existing.published_at || now.toISOString(),
    listing_months: termMonths,
    listing_paid_at: existing.listing_paid_at || now.toISOString(),
    listing_expires_at: expiresAt.toISOString(),
    listing_stripe_session_id: resolvedSessionId || existing.listing_stripe_session_id || null,
    listing_expiry_reminder_sent_at: null,
    package_tier: 'standard',
    updated_at: now.toISOString(),
  };
  if (subscriptionId) {
    patch.listing_stripe_subscription_id = subscriptionId;
  }

  let data;
  let error;
  ({ data, error } = await sb.from('business_opportunities').update(patch).eq('id', id).select('*').single());
  if (error && patch.listing_stripe_subscription_id && /listing_stripe_subscription_id/i.test(error.message || '')) {
    delete patch.listing_stripe_subscription_id;
    ({ data, error } = await sb.from('business_opportunities').update(patch).eq('id', id).select('*').single());
  }
  if (error && patch.listing_expiry_reminder_sent_at != null && /listing_expiry_reminder_sent_at/i.test(error.message || '')) {
    delete patch.listing_expiry_reminder_sent_at;
    ({ data, error } = await sb.from('business_opportunities').update(patch).eq('id', id).select('*').single());
  }
  if (error) throw new Error(error.message);

  const autoReject = await maybeAutoRejectOpportunity(data);
  if (autoReject.rejected) {
    return autoReject.listing;
  }

  const listing = rowToListing(data);
  // Pay-after-approve: go live email fires when payment activates an Approved listing.
  if (!wasLive && listing.approvalStatus === 'Approved') {
    try {
      const { sendOpportunityListingLiveEmail } = require('./opportunity-emails');
      await sendOpportunityListingLiveEmail(listing);
    } catch (emailErr) {
      console.warn(
        '[opportunity] listing live email failed:',
        emailErr && emailErr.message ? emailErr.message : emailErr
      );
    }
  }

  return listing;
}

async function listPublishedOpportunities() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).filter(listingPaymentCurrent).map(rowToListing);
}

async function getPublishedOpportunityById(id) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !listingPaymentCurrent(data)) return null;
  return rowToListing(data);
}

async function getPublishedOpportunityBySlug(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;

  if (isUuidSlug(s)) {
    return getPublishedOpportunityById(s);
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  // Match browse page rules: only payment-active listings, then resolve slug/title.
  const hit = (data || [])
    .filter(listingPaymentCurrent)
    .find((row) => slugMatchesPublicRow(row, s));
  if (!hit) return null;
  return rowToListing(hit);
}

async function getOpportunityRowById(id) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('business_opportunities').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function getOpportunityById(id) {
  return rowToListing(await getOpportunityRowById(id));
}

async function getOpportunityForOrganiserEdit(id) {
  const row = await getOpportunityRowById(id);
  if (!row) return null;
  const listing = rowToListing(row);
  return applyPendingReviewOverlay(listing, row.pending_review_payload);
}

async function submitLiveListingPendingReview(sb, id, existingRow, payload) {
  const row = await buildOpportunityRow(payload, id, 'update');
  await assertExclusiveBrandAvailable(
    sb,
    {
      title: row.title || existingRow?.title,
      host: row.host || existingRow?.host,
      description:
        row.description != null && String(row.description).trim()
          ? row.description
          : existingRow?.description,
      about:
        Array.isArray(row.about) && row.about.length
          ? row.about
          : Array.isArray(existingRow?.about)
            ? existingRow.about
            : [],
    },
    id
  );

  const scan = scanOpportunityRedFlags(Object.assign({}, existingRow, row));
  if (scan) {
    const err = new Error('listing_content_rejected');
    err.rejectionNote = scan.rejectionNote;
    throw err;
  }

  const at = new Date().toISOString();
  const patch = {
    pending_review_payload: {
      submittedAt: at,
      row: pickPendingReviewRowFields(row),
    },
    review_submitted_at: at,
    meta: mergeReviewSubmittedMeta(Array.isArray(existingRow?.meta) ? existingRow.meta : [], at),
    updated_at: at,
  };

  const data = await writeOpportunityRow(sb, 'update', patch, id);
  return rowToListing(data);
}

async function rejectPendingOpportunityChanges(opportunityId, rejectionNote) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');
  const note = String(rejectionNote || '').trim();
  const sb = getSupabaseAdmin();
  const patch = {
    pending_review_payload: null,
    review_submitted_at: null,
    rejection_note: note || null,
    updated_at: new Date().toISOString(),
  };
  const data = await writeOpportunityRow(sb, 'update', patch, id);
  return rowToListing(data);
}

async function applyApprovedPendingReviewChanges(sb, id, current) {
  const pending = current && current.pending_review_payload;
  const pendingRow = pending && pending.row ? pending.row : null;
  if (!pendingRow) return null;

  const slug = await ensureOpportunitySlug(sb, {
    title: pendingRow.title || current.title,
    opportunityId: id,
    currentSlug: current.slug,
  });

  const patch = Object.assign({}, pendingRow, {
    slug,
    pending_review_payload: null,
    review_submitted_at: null,
    rejection_note: null,
    updated_at: new Date().toISOString(),
  });
  return writeOpportunityRow(sb, 'update', patch, id);
}

async function persistOpportunityReviewSubmission(sb, id, opts) {
  const existing = opts && opts.existing ? opts.existing : null;
  const saved = opts && opts.saved ? opts.saved : null;
  const at = new Date().toISOString();
  const baseMeta = Array.isArray(saved && saved.meta)
    ? saved.meta
    : Array.isArray(existing && existing.meta)
      ? existing.meta
      : [];
  const patch = {
    review_submitted_at: at,
    approval_status: 'Pending Review',
    status: existing && existing.listingPaymentActive ? 'published' : 'draft',
    meta: mergeReviewSubmittedMeta(baseMeta, at),
    updated_at: at,
  };
  const written = await writeOpportunityRow(sb, 'update', patch, id);
  // When migration 266 is missing, the column is stripped but meta stamp must remain.
  if (!effectiveReviewSubmittedAt(written)) {
    const metaOnly = {
      approval_status: 'Pending Review',
      status: patch.status,
      meta: mergeReviewSubmittedMeta(
        Array.isArray(written && written.meta) ? written.meta : baseMeta,
        at
      ),
      updated_at: at,
    };
    return writeOpportunityRow(sb, 'update', metaOnly, id);
  }
  return written;
}

async function listOwnedOpportunityRowsForSession(session, select) {
  const email = String(session?.email || '').toLowerCase();
  const uid = isUuid(session?.sub) ? session.sub : '';
  if (!email && !uid) return [];

  const sb = getSupabaseAdmin();
  const access = await resolveOrganiserAccess(session);
  const organiserIds = access.groupIds || [];
  const rows = [];
  const seen = new Set();

  function addRows(data) {
    for (const row of data || []) {
      if (row?.id && !seen.has(row.id)) {
        if (String(row.ownership_claim_status || '').toLowerCase() === 'pending') continue;
        seen.add(row.id);
        rows.push(row);
      }
    }
  }

  if (email) {
    const res = await sb.from('business_opportunities').select(select).eq('owner_email', email);
    if (res.error) throw new Error(res.error.message);
    addRows(res.data);
  }
  if (uid) {
    const res = await sb.from('business_opportunities').select(select).eq('supabase_user_id', uid);
    if (res.error) throw new Error(res.error.message);
    addRows(res.data);
  }
  if (organiserIds.length) {
    const res = await sb.from('business_opportunities').select(select).in('organiser_id', organiserIds);
    if (res.error) throw new Error(res.error.message);
    addRows(res.data);
  }

  return rows;
}

async function listOpportunitiesForSession(session) {
  const data = await listOwnedOpportunityRowsForSession(session, '*');
  return data
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .map(rowToListing);
}

async function countOwnedOpportunitiesForSession(session) {
  const rows = await listOwnedOpportunityRowsForSession(session, 'id');
  return rows.length;
}

function assertOpportunityListingCompliance() {
  // Earnings / return fields were removed from listing forms.
}

async function sendPendingReviewEmailSafe(listing) {
  try {
    const { sendOpportunityListingPendingReviewEmail } = require('./opportunity-emails');
    await sendOpportunityListingPendingReviewEmail(listing);
  } catch (emailErr) {
    console.warn(
      '[opportunity] pending review email failed:',
      emailErr && emailErr.message ? emailErr.message : emailErr
    );
  }
}

async function createOpportunity(payload) {
  const sb = getSupabaseAdmin();
  const submitForReview = Boolean(payload.submitForReview);
  const status = normalizeStatus(payload.listingStatus || payload.status);
  if (status === 'published' || submitForReview) assertOpportunityListingCompliance(payload);
  const row = await buildOpportunityRow(payload, 'new', 'create');
  if (!row.owner_email && !row.supabase_user_id) throw new Error('missing_owner');
  if (!row.title) throw new Error('missing_title');
  if (!row.host) row.host = 'Draft listing';
  if (!row.type) row.type = 'business-opportunity';
  if (submitForReview) {
    row.status = 'draft';
    row.approval_status = 'Pending Review';
    stampOpportunityReviewSubmission(row);
  } else {
    row.review_submitted_at = null;
  }
  row.slug = await ensureOpportunitySlug(sb, {
    title: row.title,
    opportunityId: null,
    currentSlug: null,
  });
  await assertExclusiveBrandAvailable(
    sb,
    {
      title: row.title,
      host: row.host,
      description: row.description,
      about: row.about,
    },
    null
  );
  const data = await writeOpportunityRow(sb, 'insert', row);
  let saved = data;
  if (submitForReview) {
    saved = await persistOpportunityReviewSubmission(sb, data.id, { saved: data });
  }
  const listing = rowToListing(saved);
  if (submitForReview) await sendPendingReviewEmailSafe(listing);
  return listing;
}

async function updateOpportunity(id, payload) {
  const sb = getSupabaseAdmin();
  const existingRow = await getOpportunityRowById(id);
  const existing = rowToListing(existingRow);
  const submitForReview = Boolean(payload.submitForReview || payload.action === 'submit_for_review');
  const isLiveListing =
    Boolean(existing?.listingPaymentActive) &&
    String(existing?.approvalStatus || '').trim() === 'Approved' &&
    ['published', 'live'].includes(String(existing?.status || '').toLowerCase());
  if (isLiveListing && !submitForReview) {
    throw new Error('live_listing_resubmit_required');
  }
  const nextStatus = normalizeStatus(payload.listingStatus || payload.status || existing?.status);
  if (nextStatus === 'published' || submitForReview) assertOpportunityListingCompliance(payload);

  if (isLiveListing && submitForReview) {
    const hadPending = Boolean(existingRow?.pending_review_payload);
    const listing = await submitLiveListingPendingReview(sb, id, existingRow, payload);
    if (!hadPending) await sendPendingReviewEmailSafe(listing);
    return listing;
  }

  const row = await buildOpportunityRow(payload, id, 'update');
  row.slug = await ensureOpportunitySlug(sb, {
    title: row.title || existing?.title,
    opportunityId: id,
    currentSlug: existing?.slug,
  });
  await assertExclusiveBrandAvailable(
    sb,
    {
      title: row.title || existing?.title,
      host: row.host || existing?.host,
      description:
        row.description != null && String(row.description).trim()
          ? row.description
          : existingRow?.description,
      about:
        Array.isArray(row.about) && row.about.length
          ? row.about
          : Array.isArray(existingRow?.about)
            ? existingRow.about
            : [],
    },
    id
  );
  if (submitForReview) {
    row.status = existing?.listingPaymentActive ? 'published' : 'draft';
    row.approval_status = 'Pending Review';
    stampOpportunityReviewSubmission(row);
  } else if (row.status === 'published') {
    if (existing?.approvalStatus === 'Approved') {
      delete row.approval_status;
    } else {
      row.approval_status = 'Pending Review';
      if (!effectiveReviewSubmittedAt(existingRow)) {
        stampOpportunityReviewSubmission(row);
      }
    }
  }
  if (effectiveReviewSubmittedAt(existingRow) && !submitForReview) {
    stampOpportunityReviewSubmission(row, effectiveReviewSubmittedAt(existingRow));
  }
  const wasAlreadyQueued =
    String(existing?.approvalStatus || '') === 'Pending Review' &&
    isOpportunitySubmittedForReview(existingRow);
  let data = await writeOpportunityRow(sb, 'update', row, id);

  if (submitForReview) {
    data = await persistOpportunityReviewSubmission(sb, id, { existing, saved: data });
    if (!effectiveReviewSubmittedAt(data)) {
      throw new Error('review_submission_failed');
    }
  }

  if (data.status === 'published') {
    const autoReject = await maybeAutoRejectOpportunity(data);
    if (autoReject.rejected) return autoReject.listing;
  }

  const listing = rowToListing(data);
  if (submitForReview && !wasAlreadyQueued) await sendPendingReviewEmailSafe(listing);
  return listing;
}

function canOrganiserUnpublishOpportunityRow(row) {
  if (!row) return false;
  const status = String(row.status || '').toLowerCase();
  if (status === 'unpublished') return false;
  if (listingPaymentCurrent(row)) return true;
  const approval = String(row.approval_status || '').trim();
  if (approval === 'Approved') return true;
  return status === 'published' || status === 'live';
}

function canOrganiserDeleteOpportunityDraftRow(row) {
  if (!row) return false;
  if (listingPaymentCurrent(row)) return false;
  if (row.listing_paid_at) return false;
  if (String(row.listing_stripe_subscription_id || '').trim()) return false;
  return true;
}

async function unpublishOpportunityForOrganiser(id) {
  const oppId = String(id || '').trim();
  if (!isUuid(oppId)) throw new Error('invalid_opportunity_id');
  const existingRow = await getOpportunityRowById(oppId);
  if (!existingRow) throw new Error('not_found');
  const status = String(existingRow.status || '').toLowerCase();
  if (status === 'unpublished') {
    return rowToListing(existingRow);
  }
  if (!canOrganiserUnpublishOpportunityRow(existingRow)) {
    const err = new Error('cannot_unpublish_draft');
    err.code = 'cannot_unpublish_draft';
    throw err;
  }
  const now = new Date().toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .update({
      status: 'unpublished',
      featured: false,
      updated_at: now,
    })
    .eq('id', oppId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

async function deleteOpportunityDraftForOrganiser(id) {
  const oppId = String(id || '').trim();
  if (!isUuid(oppId)) throw new Error('invalid_opportunity_id');
  const existingRow = await getOpportunityRowById(oppId);
  if (!existingRow) throw new Error('not_found');
  if (!canOrganiserDeleteOpportunityDraftRow(existingRow)) {
    const err = new Error('cannot_delete_listing');
    err.code = 'cannot_delete_listing';
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('business_opportunities').delete().eq('id', oppId);
  if (error) throw new Error(error.message);
  return { id: oppId, title: String(existingRow.title || '').trim() };
}

async function activateOpportunityPremium(opportunityId, sessionId) {
  const id = String(opportunityId || '').trim();
  const sid = sessionId ? String(sessionId).trim() : '';
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');
  const sb = getSupabaseAdmin();

  const { data: existing, error: loadErr } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error('not_found');
  if (isNetworkMarketingType(existing)) {
    const err = new Error('network_marketing_not_spotlight');
    err.code = 'network_marketing_not_spotlight';
    throw err;
  }

  // One-time boost: up to ~30 days from now (or extend from remaining featured_until).
  if (sid && String(existing.premium_stripe_session_id || '').trim() === sid) {
    return rowToListing(existing);
  }

  const now = new Date();
  let base = now;
  if (existing.featured_until && new Date(existing.featured_until) > base) {
    base = new Date(existing.featured_until);
  }
  const featuredUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await sb
    .from('business_opportunities')
    .update({
      featured: true,
      package_tier: 'premium',
      featured_until: featuredUntil.toISOString(),
      featured_expiry_reminder_sent_at: null,
      premium_stripe_session_id: sid || null,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const listing = rowToListing(data);

  try {
    const { sendOpportunityPremiumLiveEmail } = require('./opportunity-emails');
    await sendOpportunityPremiumLiveEmail(listing);
  } catch {
    /* email failure must not block activation */
  }

  return listing;
}

function enquiryRowToDto(row, opportunity) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunityTitle: opportunity?.title || row.opportunity_title || '',
    ownerEmail: String(row.owner_email || '').toLowerCase(),
    enquirerName: String(row.enquirer_name || '').trim(),
    enquirerEmail: String(row.enquirer_email || '').trim(),
    message: String(row.message || '').trim(),
    status: String(row.status || '').trim().toLowerCase(),
    createdAt: row.created_at || null,
    readAt: row.read_at || null,
    respondedAt: row.responded_at || null,
  };
}

async function createOpportunityEnquiry(input, session) {
  const { arePublicEnquiriesOpen } = require('./soft-launch');
  if (!arePublicEnquiriesOpen()) {
    const err = new Error('enquiries_closed');
    err.code = 'enquiries_closed';
    throw err;
  }

  const opportunityId = String(input.opportunityId || '').trim();
  const message = String(input.message || '').trim();
  if (!isUuid(opportunityId)) throw new Error('invalid_opportunity_id');
  if (!message) throw new Error('missing_message');

  const sessionEmail = session?.email ? String(session.email).trim().toLowerCase() : '';
  if (!sessionEmail) throw new Error('not_authenticated');

  const email = sessionEmail;
  const name =
    String(input.name || input.enquirerName || session?.name || '').trim() ||
    sessionEmail.split('@')[0] ||
    'Enquirer';
  if (!name) throw new Error('missing_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');

  const opportunity = await getPublishedOpportunityById(opportunityId);
  if (!opportunity) throw new Error('not_found');

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_enquiries')
    .insert({
      opportunity_id: opportunityId,
      owner_email: String(opportunity.ownerEmail || opportunity.contactEmail || '').toLowerCase() || null,
      enquirer_name: name,
      enquirer_email: email,
      message,
      status: 'new',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const dto = enquiryRowToDto(data, opportunity);

  try {
    const { sendOpportunityEnquiryEmails } = require('./opportunity-emails');
    await sendOpportunityEnquiryEmails(opportunity, dto);
  } catch {
    /* email failure must not block enquiry */
  }

  return dto;
}

async function listOpportunityEnquiriesSentBySession(session) {
  const em = String(session?.email || '').trim();
  if (!em) return [];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_enquiries')
    .select('*, business_opportunities(id, title)')
    .ilike('enquirer_email', em)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => {
    const opp = row.business_opportunities || null;
    return enquiryRowToDto(row, opp ? { id: opp.id, title: opp.title } : null);
  });
}

async function listOpportunityEnquiriesForSession(session) {
  const opportunities = await listOwnedOpportunityRowsForSession(
    session,
    'id, title, owner_email, supabase_user_id, organiser_id'
  );
  const oppIds = opportunities.map((o) => o.id);
  const oppById = {};
  opportunities.forEach((o) => {
    oppById[o.id] = o;
  });
  if (!oppIds.length) return [];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_enquiries')
    .select('*')
    .in('opportunity_id', oppIds)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => enquiryRowToDto(row, oppById[row.opportunity_id]));
}

async function updateOpportunityEnquiryStatus(enquiryId, session, status) {
  const id = String(enquiryId || '').trim();
  const nextStatus = String(status || '').toLowerCase();
  if (!isUuid(id)) throw new Error('invalid_enquiry_id');
  if (!['read', 'responded'].includes(nextStatus)) throw new Error('invalid_status');

  const enquiries = await listOpportunityEnquiriesForSession(session);
  const enquiry = enquiries.find((e) => e.id === id);
  if (!enquiry) throw new Error('not_found');

  const patch = { status: nextStatus };
  const now = new Date().toISOString();
  if (nextStatus === 'read' && enquiry.status === 'new') patch.read_at = now;
  if (nextStatus === 'responded') {
    patch.responded_at = now;
    if (!enquiry.readAt) patch.read_at = now;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_enquiries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const opportunity = await getOpportunityById(data.opportunity_id);
  return enquiryRowToDto(data, opportunity);
}

async function handleOpportunityPremiumCheckout(session) {
  const metadata = session?.metadata || {};
  if (metadata.checkout_type !== 'opportunity_premium') {
    return { skipped: true, reason: 'not_opportunity_premium' };
  }

  const opportunityId = String(metadata.opportunity_id || '').trim();
  if (!opportunityId) return { skipped: true, reason: 'missing_opportunity_id' };

  const paid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete';
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  const opportunity = await activateOpportunityPremium(opportunityId, session.id);
  return { ok: true, opportunityId, featured: opportunity.featured };
}

async function resolveListingCheckoutMetadata(session) {
  const meta = Object.assign({}, session?.metadata || {});
  if (
    String(meta.checkout_type || '').trim() === 'opportunity_listing' &&
    String(meta.opportunity_id || '').trim()
  ) {
    return meta;
  }

  const {
    subscriptionIdFromSession,
    isOpportunityListingMetadata,
  } = require('./opportunity-listing-subscriptions');
  const { retrieveCheckoutSession, getStripeClient } = require('./stripe-checkout');

  let subId = subscriptionIdFromSession(session);
  let fullSession = session;

  if (!subId && session?.id) {
    try {
      fullSession = await retrieveCheckoutSession(session.id);
      Object.assign(meta, fullSession.metadata || {});
      subId = subscriptionIdFromSession(fullSession);
    } catch {
      /* keep partial meta */
    }
  }

  if (subId && !isOpportunityListingMetadata(meta)) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subId);
      Object.assign(meta, subscription.metadata || {});
    } catch {
      /* ignore */
    }
  }

  return meta;
}

async function isListingCheckoutSessionPaid(session) {
  if (!session) return false;
  if (
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete'
  ) {
    return true;
  }

  if (String(session.mode || '').trim() === 'subscription') {
    const { subscriptionIdFromSession } = require('./opportunity-listing-subscriptions');
    const { getStripeClient, retrieveCheckoutSession } = require('./stripe-checkout');
    let subId = subscriptionIdFromSession(session);
    if (!subId && session.id) {
      try {
        const full = await retrieveCheckoutSession(session.id);
        subId = subscriptionIdFromSession(full);
      } catch {
        subId = '';
      }
    }
    if (!subId) return session.status === 'complete';
    try {
      const subscription = await getStripeClient().subscriptions.retrieve(subId);
      const st = String(subscription.status || '').toLowerCase();
      return st === 'active' || st === 'trialing' || st === 'past_due';
    } catch {
      return session.status === 'complete';
    }
  }

  return false;
}

function opportunityListingStripeIdsMissing(row) {
  return (
    !String(row?.listing_stripe_session_id || '').trim() &&
    !String(row?.listing_stripe_subscription_id || '').trim()
  );
}

async function syncOpportunityListingPayment(opportunityId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');

  const sb = getSupabaseAdmin();
  const { data: row, error: loadErr } = await sb
    .from('business_opportunities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!row) throw new Error('not_found');

  if (listingPaymentCurrent(row) && !opportunityListingStripeIdsMissing(row)) {
    return { ok: true, alreadyPaid: true, opportunity: rowToListing(row) };
  }

  const { retrieveCheckoutSession, getStripeClient, isStripeCheckoutConfigured } = require('./stripe-checkout');
  const { syncListingFromSubscription } = require('./opportunity-listing-subscriptions');

  const sessionId = String(options.sessionId || row.listing_stripe_session_id || '').trim();
  const subscriptionId = String(
    options.subscriptionId || row.listing_stripe_subscription_id || ''
  ).trim();

  if (subscriptionId && isStripeCheckoutConfigured()) {
    try {
      const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
      const result = await syncListingFromSubscription(subscription, {
        sessionId: sessionId || null,
        opportunityId: id,
      });
      if (result.ok) {
        const refreshed = await getOpportunityById(id);
        return { ok: true, source: 'subscription', result, opportunity: refreshed };
      }
    } catch (e) {
      if (!sessionId && !options.allowSearch) throw e;
    }
  }

  if (sessionId && isStripeCheckoutConfigured()) {
    const session = await retrieveCheckoutSession(sessionId);
    const result = await handleOpportunityListingCheckout(session);
    if (result.ok) {
      const refreshed = await getOpportunityById(id);
      return { ok: true, source: 'session', result, opportunity: refreshed };
    }
    if (!result.skipped) throw new Error(result.reason || 'checkout_sync_failed');
  }

  if (isStripeCheckoutConfigured() && options.allowSearch !== false) {
    const ownerEmail = String(row.owner_email || row.contact_email || '')
      .trim()
      .toLowerCase();
    if (ownerEmail) {
      try {
        const stripe = getStripeClient();
        const customers = await stripe.customers.search({
          query: "email:'" + ownerEmail.replace(/'/g, '') + "'",
          limit: 3,
        });
        for (const customer of customers.data || []) {
          const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            limit: 10,
          });
          for (const session of sessions.data || []) {
            if (String(session.metadata?.opportunity_id || '').trim() !== id) continue;
            if (String(session.metadata?.checkout_type || '').trim() !== 'opportunity_listing') continue;
            if (String(session.status || '').trim() !== 'complete') continue;
            const result = await handleOpportunityListingCheckout(session);
            if (result.ok) {
              const refreshed = await getOpportunityById(id);
              return { ok: true, source: 'customer_checkout', result, opportunity: refreshed };
            }
          }
        }
      } catch (searchErr) {
        console.warn(
          '[opportunity] listing payment customer checkout lookup failed:',
          searchErr.message || searchErr
        );
      }
    }
  }

  const ownerEmail = String(row.owner_email || row.contact_email || '')
    .trim()
    .toLowerCase();
  if (ownerEmail && isStripeCheckoutConfigured()) {
    try {
      const stripe = getStripeClient();
      const customers = await stripe.customers.search({
        query: "email:'" + ownerEmail.replace(/'/g, '') + "'",
        limit: 3,
      });
      for (const customer of customers.data || []) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'all',
          limit: 10,
        });
        for (const subscription of subs.data || []) {
          const meta = subscription.metadata || {};
          if (String(meta.opportunity_id || '').trim() !== id) continue;
          if (String(meta.checkout_type || '').trim() !== 'opportunity_listing') continue;
          if (!['active', 'trialing', 'past_due'].includes(String(subscription.status || '').toLowerCase())) {
            continue;
          }
          const result = await syncListingFromSubscription(subscription, {
            sessionId: sessionId || null,
            opportunityId: id,
          });
          if (result.ok) {
            const refreshed = await getOpportunityById(id);
            return { ok: true, source: 'customer_subscription', result, opportunity: refreshed };
          }
        }
      }
    } catch (customerErr) {
      console.warn(
        '[opportunity] listing payment customer subscription lookup failed:',
        customerErr.message || customerErr
      );
    }
  }

  const err = new Error('no_stripe_payment_found');
  err.code = 'no_stripe_payment_found';
  throw err;
}

async function handleOpportunityListingCheckout(session) {
  const metadata = await resolveListingCheckoutMetadata(session);
  if (metadata.checkout_type !== 'opportunity_listing') {
    return { skipped: true, reason: 'not_opportunity_listing' };
  }

  const opportunityId = String(metadata.opportunity_id || '').trim();
  if (!opportunityId) return { skipped: true, reason: 'missing_opportunity_id' };

  const paid = await isListingCheckoutSessionPaid(session);
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  const {
    subscriptionIdFromSession,
    periodEndIso,
  } = require('./opportunity-listing-subscriptions');
  const { retrieveCheckoutSession, getStripeClient } = require('./stripe-checkout');

  let subscriptionId = subscriptionIdFromSession(session);
  let periodEnd = null;

  if (subscriptionId) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      periodEnd = periodEndIso(subscription);
    } catch {
      /* fall through — activate with 1 month from now */
    }
  } else if (session.id) {
    try {
      const full = await retrieveCheckoutSession(session.id);
      subscriptionId = subscriptionIdFromSession(full);
      if (subscriptionId) {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        periodEnd = periodEndIso(subscription);
      }
    } catch {
      /* ignore */
    }
  }

  const opportunity = await activateOpportunityListingPayment(opportunityId, {
    months: 1,
    sessionId: session.id,
    subscriptionId,
    periodEndIso: periodEnd,
  });
  return {
    ok: true,
    opportunityId,
    listingExpiresAt: opportunity.listingExpiresAt,
    listingMonths: opportunity.listingMonths,
    subscriptionId: subscriptionId || null,
  };
}

module.exports = {
  rowToListing,
  listPublishedOpportunities,
  getPublishedOpportunityById,
  getPublishedOpportunityBySlug,
  getOpportunityById,
  getOpportunityForOrganiserEdit,
  applyPendingReviewOverlay,
  listOpportunitiesForSession,
  countOwnedOpportunitiesForSession,
  opportunityOwnedBySession,
  createOpportunity,
  updateOpportunity,
  unpublishOpportunityForOrganiser,
  deleteOpportunityDraftForOrganiser,
  rejectOpportunityListing,
  rejectPendingOpportunityChanges,
  applyApprovedPendingReviewChanges,
  maybeAutoRejectOpportunity,
  activateOpportunityPremium,
  activateOpportunityListingPayment,
  handleOpportunityPremiumCheckout,
  handleOpportunityListingCheckout,
  syncOpportunityListingPayment,
  createOpportunityEnquiry,
  listOpportunityEnquiriesForSession,
  listOpportunityEnquiriesSentBySession,
  updateOpportunityEnquiryStatus,
  incrementOpportunityViewCount,
  normalizeType,
  normalizeTypes,
  normalizeMeta,
  deriveOpportunityGeo,
  writeOpportunityRow,
  isMissingOpportunityGeoColumnError,
  stripOpportunityGeoFields,
};
