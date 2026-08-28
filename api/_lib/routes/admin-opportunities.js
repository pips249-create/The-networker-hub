const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  normalizeType,
  normalizeMeta,
  rejectOpportunityListing,
  rejectPendingOpportunityChanges,
  applyApprovedPendingReviewChanges,
  rowToListing,
  deriveOpportunityGeo,
  writeOpportunityRow,
} = require('../supabase-opportunities');
const { stripEarningsMeta, isNetworkMarketingType, scanOpportunityRedFlags } = require('../opportunity-moderation');
const { sendOpportunityListingLiveEmail, sendOpportunityListingApprovedPayEmail } = require('../opportunity-emails');
const { ensureOpportunitySlug } = require('../opportunity-slug');
const { addMonths, listingPaymentCurrent } = require('../opportunity-listing-pricing');
const { resolveImageUrl } = require('../supabase-storage');
const { resolveOpportunityDisplayCover } = require('../opportunity-media');
const {
  effectiveReviewSubmittedAt,
  isOpportunitySubmittedForReview,
  hasPendingLiveListingUpdate,
  applyPendingOpportunitiesAdminFilter,
} = require('../opportunity-review-queue');

const { HUB_SEED_OWNER_EMAIL, isHubSeedOwnerEmail } = require('../opportunity-hub-seed');
const { applyIlikeSearch } = require('../search-match');
const {
  isOpportunityReviewQueueReady,
  applySubmittedReviewFilter,
} = require('../opportunity-review-queue');
const {
  findExclusiveBrandConflict,
  assertExclusiveBrandAvailable,
  sendExclusiveBrandConflict,
  exclusiveBrandConflictError,
} = require('../opportunity-brand-exclusivity');

const TEST_SAMPLE_LISTINGS = [
  {
    title: '[TEST] Café franchise — Yorkshire territory',
    host: 'Brew & Connect Co',
    type: 'franchise',
    description: 'Sample test listing for preview — safe to delete from Command Centre.',
    about: [
      'Run a neighbourhood coffee and networking lounge under an established brand.',
      'Includes barista training, launch marketing pack, and ongoing franchise support.',
    ],
    meta: [
      { key: 'Investment', val: '£25,000' },
      { key: 'Location', val: 'Yorkshire' },
      { key: 'Commitment', val: 'Full-time' },
    ],
    image_url: '/assets/opportunities/covers/bean-boost-coffee.svg',
    logo_url: '/assets/opportunities/logos/bean-boost-coffee.svg',
    featured: true,
  },
  {
    title: '[TEST] Side hustle — social media for local businesses',
    host: 'BrightPost Studio',
    type: 'side-hustle',
    description: 'Sample test listing for preview — safe to delete from Command Centre.',
    about: [
      'Offer done-for-you social content to salons, cafés, and trades in your area.',
      'Flexible hours — build a client roster alongside your day job.',
    ],
    meta: [
      { key: 'Investment', val: '£500' },
      { key: 'Location', val: 'Remote' },
      { key: 'Commitment', val: 'Part-time OK' },
    ],
    featured: false,
  },
  {
    title: '[TEST] Affiliate — marketing agency white-label',
    host: 'North Star Digital',
    type: 'affiliate',
    description: 'Sample test listing for preview — safe to delete from Command Centre.',
    about: [
      'Refer SME clients to a white-label web and SEO agency and earn recurring commission.',
      'Ideal for networkers who already introduce business owners.',
    ],
    meta: [
      { key: 'Commission', val: '20% recurring on referred clients' },
      { key: 'What you promote', val: 'White-label web & SEO for SMEs' },
      { key: 'Who it suits', val: 'Networkers who introduce business owners' },
      { key: 'Location', val: 'UK-wide' },
      { key: 'Commitment', val: 'Flexible' },
    ],
    image_url: '/assets/opportunities/covers/mindfuel-academy.svg',
    logo_url: '/assets/opportunities/logos/mindfuel-academy.svg',
    featured: false,
  },
];

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function queryFromRequest(req) {
  const q = { ...(req.query || {}) };
  if (req.url) {
    try {
      const url = new URL(req.url, 'https://internal.local');
      url.searchParams.forEach((value, key) => {
        if (q[key] == null || q[key] === '') q[key] = value;
      });
    } catch {
      /* ignore */
    }
  }
  return q;
}

function normalizeApprovalStatus(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (key === 'pending' || key === 'pending review') return 'Pending Review';
  if (key === 'approved') return 'Approved';
  if (key === 'rejected') return 'Rejected';
  return raw;
}

function parseAbout(input) {
  if (Array.isArray(input)) {
    return input.map((p) => String(p).trim()).filter(Boolean);
  }
  return String(input || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function aboutToText(about) {
  if (Array.isArray(about)) return about.map((p) => String(p || '').trim()).filter(Boolean).join('\n\n');
  return String(about || '').trim();
}

function metaVal(meta, keyRe) {
  for (const m of meta || []) {
    if (keyRe.test(String(m.key || ''))) return String(m.val || '').trim();
  }
  return '';
}

async function resolveAdminOpportunityImage(body, opportunityId) {
  if (body.photo_base64 || body.photoBase64) {
    const url = await resolveImageUrl({
      folder: `opportunities/${opportunityId || 'new'}/cover`,
      logoUrl: body.image_url || body.photo_url || body.photoUrl || null,
      logoBase64: body.photo_base64 || body.photoBase64,
      logoMime: body.photo_mime || body.photoMime,
      logoFilename: body.photo_filename || body.photoFilename,
    });
    if (url) return url;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'image_url') || Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    const url = String(body.image_url || body.photo_url || '').trim();
    if (!url) return undefined;
    return url || null;
  }
  return undefined;
}

async function resolveAdminOpportunityLogo(body, opportunityId) {
  if (body.logo_base64 || body.logoBase64) {
    const url = await resolveImageUrl({
      folder: `opportunities/${opportunityId || 'new'}/logo`,
      logoUrl: body.logo_url || body.logoUrl || null,
      logoBase64: body.logo_base64 || body.logoBase64,
      logoMime: body.logo_mime || body.logoMime,
      logoFilename: body.logo_filename || body.logoFilename,
    });
    if (url) return url;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'logo_url') || Object.prototype.hasOwnProperty.call(body, 'logoUrl')) {
    const url = String(body.logo_url || body.logoUrl || '').trim();
    if (!url) return undefined;
    return url || null;
  }
  return undefined;
}

function moderationFlagsForAdminRow(mapped) {
  try {
    const scan = scanOpportunityRedFlags({
      title: mapped.title,
      description: mapped.description,
      about: mapped.about,
      meta: mapped.meta,
      type: mapped.type,
      host: mapped.host,
      category: mapped.category,
    });
    if (!scan || !Array.isArray(scan.reasons)) return [];
    return scan.reasons.map(function (reason) {
      return {
        id: reason.id || 'flag',
        label: String(reason.label || '').trim(),
      };
    }).filter(function (reason) {
      return reason.label;
    });
  } catch {
    return [];
  }
}

function mapOpportunityRow(row) {
  const meta = normalizeMeta(row.meta);
  const mapped = {
    id: row.id,
    slug: row.slug || '',
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    about: Array.isArray(row.about) ? row.about.map(String) : [],
    about_text: aboutToText(row.about),
    meta,
    investment: metaVal(meta, /^investment$/i),
    investment_includes: metaVal(meta, /^investment includes$/i),
    commission: metaVal(meta, /^commission$/i),
    promote: metaVal(meta, /^what you promote$/i) || metaVal(meta, /^promotes?$/i),
    suits: metaVal(meta, /^who it suits$/i),
    location: metaVal(meta, /^location$/i) || metaVal(meta, /territor/i),
    commitment: metaVal(meta, /^commitment$/i),
    cookie_window: metaVal(meta, /^cookie window$/i),
    region_slug: String(row.region_slug || '').trim(),
    regionSlug: String(row.region_slug || '').trim(),
    host: String(row.host || '').trim(),
    type: row.type || '',
    category: row.category || '',
    contact_email: String(row.contact_email || '').trim(),
    status: row.status || 'draft',
    approval_status: row.approval_status || 'Pending Review',
    review_submitted_at: effectiveReviewSubmittedAt(row),
    approved_at: row.approved_at || null,
    listing_payment_active: listingPaymentCurrent(row),
    featured: Boolean(row.featured),
    featured_until: row.featured_until || null,
    featuredUntil: row.featured_until || null,
    owner_email: String(row.owner_email || '').toLowerCase(),
    ownership_claim_status: row.ownership_claim_status || null,
    organiser_id: row.organiser_id || '',
    image_url: row.image_url || '',
    logo_url: row.logo_url || '',
    ...resolveOpportunityDisplayCover(row.image_url, row.logo_url),
    package_tier: row.package_tier || '',
    listing_expires_at: row.listing_expires_at || '',
    listing_paid_at: row.listing_paid_at || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    published_at: row.published_at || '',
    rejection_note: row.rejection_note || null,
    has_pending_live_update: hasPendingLiveListingUpdate(row),
    pending_review_payload: row.pending_review_payload || null,
  };
  mapped.moderation_flags = moderationFlagsForAdminRow(mapped);
  return mapped;
}

function isAffiliateStyleAdminType(type, meta) {
  const t = String(type || '')
    .trim()
    .toLowerCase();
  if (t === 'affiliate') return true;
  if (t !== 'partnership') return false;
  const list = Array.isArray(meta) ? meta : [];
  const commission = list.some(function (m) {
    return /^commission$/i.test(String(m.key || '')) && String(m.val || '').trim();
  });
  if (!commission) return false;
  const invest = list.find(function (m) {
    return /^investment$/i.test(String(m.key || ''));
  });
  const investRaw = invest ? String(invest.val || '').trim() : '';
  if (!investRaw) return true;
  if (/^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable|on request)$/i.test(investRaw)) {
    return true;
  }
  const num = parseInt(investRaw.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) || num <= 0;
}

function buildMetaFromAdminInput(input, existingMeta) {
  if (Array.isArray(input.meta)) return stripEarningsMeta(normalizeMeta(input.meta));
  const meta = [];
  const affiliate = isAffiliateStyleAdminType(input.type, [
    { key: 'Commission', val: String(input.commission || '').trim() },
    { key: 'Investment', val: String(input.investment || '').trim() },
  ]);
  const investment = String(input.investment || '').trim();
  const includes = String(input.investment_includes || input.investmentIncludes || '').trim();
  const commission = String(input.commission || '').trim();
  const promote = String(input.promote || input.what_you_promote || '').trim();
  const suits = String(input.suits || input.who_it_suits || '').trim();
  const location = String(input.location || '').trim();
  const commitment = String(input.commitment || '').trim();
  const cookieWindow = String(input.cookie_window || input.cookieWindow || '').trim();
  const extraKey = String(input.extra_key || input.extraKey || '').trim();
  const extraVal = String(input.extra_val || input.extraVal || '').trim();
  if (affiliate) {
    if (commission) meta.push({ key: 'Commission', val: commission });
    if (promote) meta.push({ key: 'What you promote', val: promote });
    if (suits) meta.push({ key: 'Who it suits', val: suits });
  } else {
    if (investment) meta.push({ key: 'Investment', val: investment });
    if (includes) meta.push({ key: 'Investment includes', val: includes });
  }
  if (location) meta.push({ key: 'Location', val: location });
  if (commitment) meta.push({ key: 'Commitment', val: commitment });
  if (cookieWindow) meta.push({ key: 'Cookie window', val: cookieWindow });
  if (
    extraKey &&
    extraVal &&
    !/^(return|earnings|revenue|income|profit)/i.test(extraKey) &&
    !/^(commission|what you promote|who it suits|investment)/i.test(extraKey)
  ) {
    meta.push({ key: extraKey, val: extraVal });
  }

  const managed =
    /^(investment|investment includes|commission|what you promote|who it suits|location|commitment|cookie window)$/i;
  const standardKeys =
    /^(investment|investment includes|commission|what you promote|who it suits|location|commitment|cookie window|companies house)$/i;
  const hasExtraInput =
    Object.prototype.hasOwnProperty.call(input, 'extra_key') ||
    Object.prototype.hasOwnProperty.call(input, 'extraKey') ||
    Object.prototype.hasOwnProperty.call(input, 'extra_val') ||
    Object.prototype.hasOwnProperty.call(input, 'extraVal');
  const preserved = normalizeMeta(existingMeta).filter(function (m) {
    if (!m || !m.key) return false;
    if (managed.test(String(m.key))) return false;
    if (hasExtraInput && !standardKeys.test(String(m.key))) return false;
    return true;
  });
  return stripEarningsMeta(normalizeMeta(meta.concat(preserved)));
}

function buildAdminOpportunityTags(type, category, existingTags, isTest) {
  const tags = [];
  const typeNorm = normalizeType(type || 'business-opportunity');
  if (typeNorm) tags.push(typeNorm);
  const cat = String(category || '').trim();
  if (cat && cat !== 'general') tags.push('cat-' + cat);
  if (isTest || (Array.isArray(existingTags) && existingTags.includes('admin-test'))) {
    if (!tags.includes('admin-test')) tags.push('admin-test');
  }
  (Array.isArray(existingTags) ? existingTags : []).forEach(function (tag) {
    const t = String(tag || '').trim();
    if (!t) return;
    if (t === typeNorm || /^cat-/.test(t) || t === 'admin-test') return;
    if (!tags.includes(t)) tags.push(t);
  });
  return tags;
}

async function listOpportunitiesForAdmin(query) {
  const sb = getSupabaseAdmin();
  const reviewQueueReady = await isOpportunityReviewQueueReady(sb);
  const status = String(query.status || '').trim();
  const approvalStatus = normalizeApprovalStatus(query.approval_status || query.approval);
  const type = String(query.type || '').trim();
  const search = String(query.q || '').trim();
  const sort = String(query.sort || 'recent').trim().toLowerCase();
  const featuredOnly = query.featured === '1' || query.featured === 'true';
  const noImage = query.no_image === '1' || query.no_image === 'true';
  const awaitingPayment =
    query.awaiting_payment === '1' || query.awaiting_payment === 'true';
  const offset = Math.max(parseInt(String(query.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query.limit || ''), 10) || 40, 1), 100);

  let dbQuery = sb.from('business_opportunities').select('*', { count: 'exact' });

  dbQuery = dbQuery.order('featured', { ascending: false });

  if (sort === 'title') {
    dbQuery = dbQuery.order('title', { ascending: true });
  } else if (sort === 'host') {
    dbQuery = dbQuery.order('host', { ascending: true });
  } else if (sort === 'published') {
    dbQuery = dbQuery.order('published_at', { ascending: false, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('updated_at', { ascending: false });
  }

  if (status) dbQuery = dbQuery.eq('status', status);
  if (awaitingPayment) {
    dbQuery = dbQuery.eq('approval_status', 'Approved').is('listing_paid_at', null);
  } else if (approvalStatus) {
    if (approvalStatus === 'Pending Review') {
      dbQuery = applyPendingOpportunitiesAdminFilter(dbQuery, reviewQueueReady);
    } else {
      dbQuery = dbQuery.eq('approval_status', approvalStatus);
    }
  }
  if (type) dbQuery = dbQuery.eq('type', normalizeType(type));
  if (featuredOnly) dbQuery = dbQuery.eq('featured', true);
  if (noImage) dbQuery = dbQuery.or('image_url.is.null,image_url.eq.');

  if (search) {
    if (search.includes('@')) {
      const term = `%${search.toLowerCase()}%`;
      dbQuery = dbQuery.or(`owner_email.ilike.${term}`);
    } else {
      dbQuery = applyIlikeSearch(dbQuery, search, ['title', 'host', 'owner_email']);
    }
  }

  let rows = [];
  let total = 0;

  if (awaitingPayment) {
    const awaitingRes = await dbQuery.limit(200);
    if (awaitingRes.error) throw new Error(awaitingRes.error.message);
    const filtered = (awaitingRes.data || []).filter(function (row) {
      return !listingPaymentCurrent(row);
    });
    total = filtered.length;
    rows = filtered.slice(offset, offset + limit);
  } else {
    dbQuery = dbQuery.range(offset, offset + limit - 1);
    const res = await dbQuery;
    if (res.error) throw new Error(res.error.message);
    rows = res.data || [];
    total = res.count != null ? res.count : rows.length;
  }

  const pendingCountRes = await applyPendingOpportunitiesAdminFilter(
    sb.from('business_opportunities').select('id', { count: 'exact', head: true }),
    reviewQueueReady
  );
  const pendingCountResult = await pendingCountRes;
  if (pendingCountResult.error) throw new Error(pendingCountResult.error.message);

  return {
    opportunities: rows.map(mapOpportunityRow),
    count: rows.length,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    pending_count: pendingCountResult.count || 0,
    review_queue_ready: reviewQueueReady,
  };
}

function hostInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function listingPaymentActive(row, now) {
  if (!row) return false;
  if (row.listing_expires_at) {
    return new Date(row.listing_expires_at).getTime() > now.getTime();
  }
  return String(row.status || '').toLowerCase() === 'published' && Boolean(row.published_at);
}

function applyPublishedListingPayment(patch, row, now) {
  if (!row || String(row.status || '').toLowerCase() !== 'published') return;
  if (!row.published_at) {
    patch.published_at = now.toISOString();
  }
  if (!listingPaymentActive(row, now)) {
    patch.listing_paid_at = row.listing_paid_at || now.toISOString();
    patch.listing_expires_at = addMonths(now, 12).toISOString();
  }
}

async function createAdminOpportunity(input) {
  const sb = getSupabaseAdmin();
  const title = String(input.title || '').trim();
  const host = String(input.host || '').trim() || 'platform listing';
  if (!title) throw new Error('missing_title');

  const status = String(input.status || 'published').trim().toLowerCase();
  const published = status === 'published';
  const now = new Date();
  const listingExpiresAt = addMonths(now, 12);
  const ownerEmail = String(input.owner_email || input.ownerEmail || HUB_SEED_OWNER_EMAIL)
    .trim()
    .toLowerCase() || HUB_SEED_OWNER_EMAIL;
  const isTest = Boolean(input.is_test) || /^\[TEST\]/i.test(title);
  const type = normalizeType(input.type || 'business-opportunity');
  const about = parseAbout(input.about != null ? input.about : input.about_text || input.aboutText);
  const meta = buildMetaFromAdminInput(input);
  const geo = deriveOpportunityGeo(input, meta);
  const { parseAdminBool } = require('../admin-bool');
  const featured = parseAdminBool(input.featured);
  if (featured && isNetworkMarketingType(type)) {
    throw new Error('network_marketing_not_spotlight');
  }
  const category = String(input.category || 'general').trim() || 'general';
  const contactEmail = String(input.contact_email || input.contactEmail || '')
    .trim()
    .toLowerCase();

  await assertExclusiveBrandAvailable(
    sb,
    {
      title,
      host,
      description: input.description,
      about,
    },
    null
  );

  const row = {
    organiser_id: null,
    owner_email: ownerEmail,
    ownership_claim_status: isHubSeedOwnerEmail(ownerEmail) ? null : 'pending',
    ownership_claimed_at: null,
    ownership_disputed_at: null,
    ownership_disputed_by_email: null,
    supabase_user_id: null,
    type,
    category,
    contact_email: contactEmail || null,
    title,
    description: String(input.description || '').trim() || null,
    about,
    host,
    host_initials: hostInitials(host),
    host_color: input.host_color || '#374151',
    meta,
    outcode: geo.outcode,
    region_slug: geo.regionSlug,
    tags: buildAdminOpportunityTags(type, category, isTest ? ['admin-test'] : [], isTest),
    image_url: String(input.image_url || input.photo_url || '').trim() || null,
    logo_url: String(input.logo_url || '').trim() || null,
    status: published ? 'published' : 'draft',
    approval_status: published ? 'Approved' : 'Pending Review',
    featured,
    listing_expires_at: listingExpiresAt.toISOString(),
    listing_paid_at: now.toISOString(),
    published_at: published ? now.toISOString() : null,
    updated_at: now.toISOString(),
  };

  row.slug = await ensureOpportunitySlug(sb, {
    title: row.title,
    opportunityId: null,
    currentSlug: null,
  });

  const data = await writeOpportunityRow(sb, 'insert', row);

  const imagePatch = {};
  const imageUrl = await resolveAdminOpportunityImage(input, data.id);
  if (imageUrl !== undefined) imagePatch.image_url = imageUrl;
  const logoUrl = await resolveAdminOpportunityLogo(input, data.id);
  if (logoUrl !== undefined) imagePatch.logo_url = logoUrl;

  if (Object.keys(imagePatch).length) {
    imagePatch.updated_at = now.toISOString();
    const updated = await writeOpportunityRow(sb, 'update', imagePatch, data.id);
    return mapOpportunityRow(updated);
  }

  return mapOpportunityRow(data);
}

async function createAdminTestSamples() {
  const created = [];
  for (const sample of TEST_SAMPLE_LISTINGS) {
    created.push(await createAdminOpportunity(sample));
  }
  return created;
}

async function deleteOpportunities(ids) {
  const sb = getSupabaseAdmin();
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return { deleted: 0, skipped: [], titles: [] };

  const { data, error } = await sb
    .from('business_opportunities')
    .delete()
    .in('id', unique)
    .select('id, title');
  if (error) throw new Error(error.message);

  const deleted = data || [];
  const deletedIds = new Set(deleted.map((row) => String(row.id)));
  const skipped = unique
    .filter((id) => !deletedIds.has(String(id)))
    .map((id) => ({ id, reason: 'not_found' }));

  return {
    deleted: deleted.length,
    skipped,
    titles: deleted.map((row) => String(row.title || '').trim()).filter(Boolean),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const q = queryFromRequest(req);
      const openDaysFor = String(q.open_days_for || q.openDaysFor || '').trim();
      if (openDaysFor || String(q.open_days || '') === '1') {
        const opportunityId = openDaysFor || String(q.id || '').trim();
        if (!opportunityId) {
          return json(res, 400, { ok: false, error: 'missing_id' });
        }
        const { listOpenDaysForOpportunity } = require('../opportunity-open-days');
        const openDays = await listOpenDaysForOpportunity(opportunityId, {
          includeInterestCounts: true,
        });
        return json(res, 200, { ok: true, openDays });
      }
      if (String(q.exclusive_brand_check || '') === '1') {
        const sb = getSupabaseAdmin();
        const excludeId = String(q.exclude_id || q.excludeId || '').trim() || null;
        const conflict = await findExclusiveBrandConflict(
          sb,
          {
            title: q.title,
            host: q.host,
            description: q.description,
            about_text: q.about_text || q.aboutText,
          },
          excludeId
        );
        return json(res, 200, {
          ok: true,
          conflict,
          message: conflict ? exclusiveBrandConflictError(conflict) : null,
        });
      }
      const data = await listOpportunitiesForAdmin(q);
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = parseBody(req);

    if (body.action === 'bulk_delete') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((rowId) => String(rowId || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await deleteOpportunities(ids);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'bulk_delete_failed', message: e.message });
      }
    }

    if (body.action === 'create') {
      const title = String(body.title || '').trim();
      if (!title) return json(res, 400, { error: 'missing_title' });
      try {
        const opportunity = await createAdminOpportunity({
          title,
          host: body.host,
          type: body.type,
          category: body.category,
          status: body.status,
          description: body.description,
          about: body.about,
          about_text: body.about_text || body.aboutText,
          featured: body.featured,
          image_url: body.image_url || body.photo_url,
          logo_url: body.logo_url,
          owner_email: body.owner_email || body.ownerEmail,
          contact_email: body.contact_email || body.contactEmail,
          investment: body.investment,
          investment_includes: body.investment_includes || body.investmentIncludes,
          commission: body.commission,
          promote: body.promote || body.what_you_promote,
          suits: body.suits || body.who_it_suits,
          location: body.location,
          region_slug: body.region_slug || body.regionSlug,
          commitment: body.commitment,
          cookie_window: body.cookie_window || body.cookieWindow,
          extra_key: body.extra_key || body.extraKey,
          extra_val: body.extra_val || body.extraVal,
          meta: body.meta,
          photo_base64: body.photo_base64 || body.photoBase64,
          photo_mime: body.photo_mime || body.photoMime,
          photo_filename: body.photo_filename || body.photoFilename,
          logo_base64: body.logo_base64 || body.logoBase64,
          logo_mime: body.logo_mime || body.logoMime,
          logo_filename: body.logo_filename || body.logoFilename,
          is_test: body.is_test,
        });
        return json(res, 201, { ok: true, opportunity });
      } catch (e) {
        if (e.code === 'exclusive_brand_conflict') {
          return sendExclusiveBrandConflict(res, json, e.conflict);
        }
        return json(res, 500, { ok: false, error: 'create_failed', message: e.message });
      }
    }

    if (body.action === 'create_test_samples') {
      try {
        const opportunities = await createAdminTestSamples();
        return json(res, 201, {
          ok: true,
          created: opportunities.length,
          opportunities,
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'create_test_samples_failed', message: e.message });
      }
    }

    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    if (body.action === 'save_open_days') {
      try {
        const { replaceOpenDaysForOpportunity } = require('../opportunity-open-days');
        const openDays = await replaceOpenDaysForOpportunity(
          id,
          body.openDays || body.days || [],
          null
        );
        return json(res, 200, { ok: true, openDays });
      } catch (e) {
        const msg = e.message || String(e);
        if (msg === 'not_found') {
          return json(res, 404, { ok: false, error: 'not_found', message: 'Listing not found.' });
        }
        if (
          msg === 'missing_open_day_starts_at' ||
          msg === 'invalid_open_day_starts_at' ||
          msg === 'missing_open_day_address' ||
          msg === 'invalid_open_day_ends_at' ||
          msg === 'open_day_ends_before_start' ||
          msg === 'too_many_open_days' ||
          msg === 'open_days_unavailable'
        ) {
          return json(res, 400, {
            ok: false,
            error: msg,
            message:
              msg === 'open_days_unavailable'
                ? 'Open days are not available yet — apply migration 269_opportunity_open_days.sql.'
                : msg === 'missing_open_day_address'
                  ? 'Each open day needs an address.'
                  : msg === 'missing_open_day_starts_at' || msg === 'invalid_open_day_starts_at'
                    ? 'Each open day needs a valid date and start time.'
                    : msg === 'open_day_ends_before_start'
                      ? 'End time must be after the start time.'
                      : msg === 'too_many_open_days'
                        ? 'Too many open days on this listing.'
                        : undefined,
          });
        }
        return json(res, 500, {
          ok: false,
          error: 'save_open_days_failed',
          message: msg,
        });
      }
    }

    if (body.action === 'approve') {
      try {
        const sb = getSupabaseAdmin();
        const now = new Date();
        const { data: current, error: loadErr } = await sb
          .from('business_opportunities')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);
        if (!current) {
          return json(res, 404, { ok: false, error: 'not_found', message: 'Listing not found.' });
        }

        const approveConflict = await findExclusiveBrandConflict(sb, current, id);
        if (approveConflict) {
          return sendExclusiveBrandConflict(res, json, approveConflict);
        }

        const alreadyLive =
          Boolean(current.listing_paid_at) &&
          listingPaymentCurrent(current) &&
          String(current.approval_status || '') === 'Approved' &&
          ['published', 'live'].includes(String(current.status || '').toLowerCase());

        if (hasPendingLiveListingUpdate(current) && alreadyLive) {
          const pendingRow = current.pending_review_payload.row;
          const pendingConflict = await findExclusiveBrandConflict(
            sb,
            Object.assign({}, current, pendingRow),
            id
          );
          if (pendingConflict) {
            return sendExclusiveBrandConflict(res, json, pendingConflict);
          }
          const data = await applyApprovedPendingReviewChanges(sb, id, current);
          if (!data) {
            throw new Error('Approve pending update returned no row');
          }
          return json(res, 200, {
            ok: true,
            opportunity: mapOpportunityRow(data),
            went_live: false,
            applied_pending_update: true,
          });
        }

        // Paid = Stripe listing_paid_at with a current term. Do not treat a bare
        // listing_expires_at (without payment) as already paid — that blocked the
        // review-then-pay path and confused Approve.
        const alreadyPaid = Boolean(current.listing_paid_at) && listingPaymentCurrent(current);

        const patch = {
          approval_status: 'Approved',
          rejection_note: null,
          approved_at: now.toISOString(),
          approved_pay_reminder_sent_at: null,
          updated_at: now.toISOString(),
        };

        if (alreadyPaid) {
          // Legacy / paid-while-pending: Approve goes live immediately.
          if (String(current.status || '').toLowerCase() !== 'published') {
            patch.status = 'published';
          }
          if (!current.published_at) {
            patch.published_at = now.toISOString();
          }
        } else {
          // Review-then-pay: stay off the public directory until Stripe payment.
          // Avoid published + published_at without expiry (legacy gate treats that as live).
          if (String(current.status || '').toLowerCase() === 'published') {
            patch.status = 'draft';
          }
          // Clear a stale expiry left without payment so listingPaymentCurrent
          // does not treat the listing as live before checkout.
          if (current.listing_expires_at && !current.listing_paid_at) {
            patch.listing_expires_at = null;
          }
        }

        if (!effectiveReviewSubmittedAt(current)) {
          patch.review_submitted_at = now.toISOString();
        }

        const data = await writeOpportunityRow(sb, 'update', patch, id);
        if (!data) {
          throw new Error('Approve update returned no row');
        }

        const listing = rowToListing(data);
        try {
          if (alreadyPaid) {
            await sendOpportunityListingLiveEmail(listing);
          } else {
            await sendOpportunityListingApprovedPayEmail(listing);
          }
        } catch (emailErr) {
          console.warn('[opportunity] approve email failed:', emailErr.message || emailErr);
        }

        return json(res, 200, {
          ok: true,
          opportunity: mapOpportunityRow(data),
          went_live: alreadyPaid,
        });
      } catch (e) {
        return json(res, 500, {
          ok: false,
          error: 'approve_failed',
          message: e.message || 'Could not approve listing.',
        });
      }
    }

    if (body.action === 'resend_pay_email') {
      try {
        const sb = getSupabaseAdmin();
        const { data, error } = await sb
          .from('business_opportunities')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return json(res, 404, { ok: false, error: 'not_found' });
        if (String(data.approval_status || '') !== 'Approved') {
          return json(res, 400, {
            ok: false,
            error: 'not_approved',
            message: 'Only approved listings awaiting payment can receive this email.',
          });
        }
        if (listingPaymentCurrent(data)) {
          return json(res, 400, {
            ok: false,
            error: 'already_paid',
            message: 'This listing already has an active subscription.',
          });
        }
        await sendOpportunityListingApprovedPayEmail(rowToListing(data));
        return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'resend_pay_email_failed', message: e.message });
      }
    }

    if (body.action === 'reject') {
      const rejectionNote = String(body.rejection_note || body.note || '').trim();
      if (!rejectionNote) {
        return json(res, 400, { ok: false, error: 'missing_rejection_note' });
      }
      try {
        const sb = getSupabaseAdmin();
        const { data: current, error: loadErr } = await sb
          .from('business_opportunities')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);

        const alreadyLive =
          current &&
          Boolean(current.listing_paid_at) &&
          listingPaymentCurrent(current) &&
          String(current.approval_status || '') === 'Approved' &&
          ['published', 'live'].includes(String(current.status || '').toLowerCase());

        if (current && hasPendingLiveListingUpdate(current) && alreadyLive) {
          await rejectPendingOpportunityChanges(id, rejectionNote);
        } else {
          await rejectOpportunityListing(id, rejectionNote);
        }

        const { data, error } = await sb
          .from('business_opportunities')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'reject_failed', message: e.message });
      }
    }

    if (body.action === 'delete') {
      try {
        const result = await deleteOpportunities([id]);
        if (!result.deleted) {
          return json(res, 404, { ok: false, error: 'not_found' });
        }
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'delete_failed', message: e.message });
      }
    }

    if (body.action === 'assign_owner') {
      const ownerEmail = String(body.owner_email || body.ownerEmail || '').trim().toLowerCase();
      if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        return json(res, 400, { error: 'invalid_owner_email' });
      }
      try {
        const sb = getSupabaseAdmin();
        const now = new Date().toISOString();
        const patch = {
          owner_email: ownerEmail,
          supabase_user_id: null,
          ownership_claim_status: isHubSeedOwnerEmail(ownerEmail) ? null : 'pending',
          ownership_claimed_at: null,
          ownership_disputed_at: null,
          ownership_disputed_by_email: null,
          updated_at: now,
        };
        const { data, error } = await sb
          .from('business_opportunities')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);

        let claimUrl = null;
        let emailSent = false;
        if (!isHubSeedOwnerEmail(ownerEmail) && patch.ownership_claim_status === 'pending') {
          const siteHost = String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(
            /\/$/,
            ''
          );
          const { resolveOpportunityClaimUrl } = require('../opportunity-claim-url');
          const { sendTemplatedEmail } = require('../send-template-email');
          const { campaignSiteVars } = require('../organiser-campaign-defaults');
          const slugOrId = String(data.slug || data.id || '').trim();
          claimUrl = await resolveOpportunityClaimUrl(ownerEmail, siteHost, slugOrId);
          const ownerName =
            String(data.host || '').trim() ||
            ownerEmail.split('@')[0] ||
            'there';
          await sendTemplatedEmail({
            slug: 'opportunity_claim_invite',
            to: ownerEmail,
            subject:
              'Congratulations: ' +
              String(data.title || 'your opportunity') +
              ' is ready — claim your listing',
            variables: {
              ...campaignSiteVars(siteHost),
              owner_name: ownerName,
              opportunity_title: String(data.title || 'your business opportunity'),
              claim_url: claimUrl,
            },
            skipEmailCheck: true,
          });
          emailSent = true;
        }

        return json(res, 200, {
          ok: true,
          opportunity: mapOpportunityRow(data),
          claimUrl,
          emailSent,
          message: emailSent
            ? 'Owner assigned and claim invite emailed to ' + ownerEmail + '.'
            : 'Owner assigned.',
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'assign_owner_failed', message: e.message });
      }
    }

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      patch.title = String(body.title || '').trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      patch.description = String(body.description || '').trim() || null;
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'about') ||
      Object.prototype.hasOwnProperty.call(body, 'about_text') ||
      Object.prototype.hasOwnProperty.call(body, 'aboutText')
    ) {
      patch.about = parseAbout(body.about != null ? body.about : body.about_text || body.aboutText);
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'meta') ||
      Object.prototype.hasOwnProperty.call(body, 'investment') ||
      Object.prototype.hasOwnProperty.call(body, 'location') ||
      Object.prototype.hasOwnProperty.call(body, 'region_slug') ||
      Object.prototype.hasOwnProperty.call(body, 'regionSlug') ||
      Object.prototype.hasOwnProperty.call(body, 'commitment') ||
      Object.prototype.hasOwnProperty.call(body, 'cookie_window') ||
      Object.prototype.hasOwnProperty.call(body, 'cookieWindow') ||
      Object.prototype.hasOwnProperty.call(body, 'extra_key') ||
      Object.prototype.hasOwnProperty.call(body, 'extraKey') ||
      Object.prototype.hasOwnProperty.call(body, 'extra_val') ||
      Object.prototype.hasOwnProperty.call(body, 'extraVal') ||
      Object.prototype.hasOwnProperty.call(body, 'investment_includes') ||
      Object.prototype.hasOwnProperty.call(body, 'commission') ||
      Object.prototype.hasOwnProperty.call(body, 'promote') ||
      Object.prototype.hasOwnProperty.call(body, 'suits') ||
      Object.prototype.hasOwnProperty.call(body, 'type')
    ) {
      const sbMeta = getSupabaseAdmin();
      const { data: currentMetaRow } = await sbMeta
        .from('business_opportunities')
        .select('meta, type')
        .eq('id', id)
        .maybeSingle();
      const metaInput = Object.assign({}, body, {
        type: body.type || (currentMetaRow && currentMetaRow.type) || '',
      });
      patch.meta = buildMetaFromAdminInput(metaInput, currentMetaRow && currentMetaRow.meta);
      const geo = deriveOpportunityGeo(body, patch.meta);
      patch.outcode = geo.outcode;
      patch.region_slug = geo.regionSlug;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'host')) {
      patch.host = String(body.host || '').trim() || null;
      if (patch.host) patch.host_initials = hostInitials(patch.host);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'type')) {
      patch.type = normalizeType(body.type);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'category')) {
      patch.category = String(body.category || 'general').trim() || 'general';
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'contact_email') ||
      Object.prototype.hasOwnProperty.call(body, 'contactEmail')
    ) {
      const contactEmail = String(body.contact_email || body.contactEmail || '')
        .trim()
        .toLowerCase();
      patch.contact_email = contactEmail || null;
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'type') ||
      Object.prototype.hasOwnProperty.call(body, 'category')
    ) {
      const sbTags = getSupabaseAdmin();
      const { data: currentTagRow } = await sbTags
        .from('business_opportunities')
        .select('type, category, tags')
        .eq('id', id)
        .maybeSingle();
      const nextType = patch.type || (currentTagRow && currentTagRow.type) || 'business-opportunity';
      const nextCategory =
        Object.prototype.hasOwnProperty.call(patch, 'category')
          ? patch.category
          : (currentTagRow && currentTagRow.category) || 'general';
      patch.tags = buildAdminOpportunityTags(
        nextType,
        nextCategory,
        currentTagRow && currentTagRow.tags,
        false
      );
    }
    const imageUrl = await resolveAdminOpportunityImage(body, id);
    if (imageUrl !== undefined) patch.image_url = imageUrl;
    const logoUrl = await resolveAdminOpportunityLogo(body, id);
    if (logoUrl !== undefined) patch.logo_url = logoUrl;
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '').trim();
      if (status && !['draft', 'published', 'unpublished', 'archived'].includes(status)) {
        return json(res, 400, { error: 'invalid_status' });
      }
      patch.status = status || null;
      if (status === 'published') {
        patch.approval_status = 'Approved';
        patch.published_at = new Date().toISOString();
      } else if (status === 'draft') {
        patch.approval_status = 'Pending Review';
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'approval_status')) {
      const approval = String(body.approval_status || '').trim();
      if (approval && !['Pending Review', 'Approved', 'Rejected'].includes(approval)) {
        return json(res, 400, { error: 'invalid_approval_status' });
      }
      patch.approval_status = approval || null;
    }
    if (
      Object.prototype.hasOwnProperty.call(body, 'featured') ||
      Object.prototype.hasOwnProperty.call(body, 'featured_until') ||
      Object.prototype.hasOwnProperty.call(body, 'featuredUntil')
    ) {
      try {
        const { applyAdminFeaturedPatch } = require('../admin-featured-until');
        applyAdminFeaturedPatch(patch, body, { clearReminderKey: 'featured_expiry_reminder_sent_at' });
      } catch (featErr) {
        return json(res, featErr.status || 400, {
          ok: false,
          error: featErr.message || 'invalid_featured_until',
          message: featErr.message || 'Invalid featured end date.',
        });
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'featured') && !patch.featured) {
        patch.package_tier = 'standard';
      }
    }

    if (!Object.keys(patch).length) {
      return json(res, 400, { error: 'no_fields' });
    }

    patch.updated_at = new Date().toISOString();

    try {
      const sb = getSupabaseAdmin();
      if (
        Object.prototype.hasOwnProperty.call(patch, 'title') ||
        Object.prototype.hasOwnProperty.call(patch, 'host') ||
        Object.prototype.hasOwnProperty.call(patch, 'description') ||
        Object.prototype.hasOwnProperty.call(patch, 'about')
      ) {
        const { data: currentExclusiveRow, error: exclusiveLoadErr } = await sb
          .from('business_opportunities')
          .select('title, host, description, about')
          .eq('id', id)
          .maybeSingle();
        if (exclusiveLoadErr) throw new Error(exclusiveLoadErr.message);
        if (!currentExclusiveRow) {
          return json(res, 404, { ok: false, error: 'not_found', message: 'Listing not found.' });
        }
        await assertExclusiveBrandAvailable(
          sb,
          {
            title: Object.prototype.hasOwnProperty.call(patch, 'title')
              ? patch.title
              : currentExclusiveRow.title,
            host: Object.prototype.hasOwnProperty.call(patch, 'host')
              ? patch.host
              : currentExclusiveRow.host,
            description: Object.prototype.hasOwnProperty.call(patch, 'description')
              ? patch.description
              : currentExclusiveRow.description,
            about: Object.prototype.hasOwnProperty.call(patch, 'about')
              ? patch.about
              : currentExclusiveRow.about,
          },
          id
        );
      }
      const now = new Date();
      if (patch.featured) {
        const { data: currentFeatured } = await sb
          .from('business_opportunities')
          .select('type, tags')
          .eq('id', id)
          .maybeSingle();
        const nextType = patch.type || (currentFeatured && currentFeatured.type);
        const nextTags = currentFeatured && currentFeatured.tags;
        if (isNetworkMarketingType({ type: nextType, tags: nextTags })) {
          return json(res, 400, {
            ok: false,
            error: 'network_marketing_not_spotlight',
            message: 'Network marketing listings cannot be featured in Premium Spotlight.',
          });
        }
      }
      if (patch.status === 'published') {
        const { data: current } = await sb
          .from('business_opportunities')
          .select('status, published_at, listing_expires_at, listing_paid_at')
          .eq('id', id)
          .maybeSingle();
        applyPublishedListingPayment(patch, { ...current, status: 'published' }, now);
      }
      const data = await writeOpportunityRow(sb, 'update', patch, id);
      return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
    } catch (e) {
      if (e.code === 'exclusive_brand_conflict') {
        return sendExclusiveBrandConflict(res, json, e.conflict);
      }
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
