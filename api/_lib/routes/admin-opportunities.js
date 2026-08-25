const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  normalizeType,
  normalizeMeta,
  rejectOpportunityListing,
  rowToListing,
  deriveOpportunityGeo,
  writeOpportunityRow,
} = require('../supabase-opportunities');
const { stripEarningsMeta, isNetworkMarketingType } = require('../opportunity-moderation');
const { sendOpportunityListingLiveEmail } = require('../opportunity-emails');
const { ensureOpportunitySlug } = require('../opportunity-slug');
const { addMonths } = require('../opportunity-listing-pricing');
const { resolveImageUrl } = require('../supabase-storage');

const { HUB_SEED_OWNER_EMAIL, isHubSeedOwnerEmail } = require('../opportunity-hub-seed');
const { applyIlikeSearch } = require('../search-match');

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
    title: '[TEST] Partnership — marketing agency white-label',
    host: 'North Star Digital',
    type: 'partnership',
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
    return url || null;
  }
  return undefined;
}

function mapOpportunityRow(row) {
  const meta = normalizeMeta(row.meta);
  return {
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
    host: String(row.host || '').trim(),
    type: row.type || '',
    category: row.category || '',
    status: row.status || 'draft',
    approval_status: row.approval_status || 'Pending Review',
    featured: Boolean(row.featured),
    featured_until: row.featured_until || null,
    featuredUntil: row.featured_until || null,
    owner_email: String(row.owner_email || '').toLowerCase(),
    ownership_claim_status: row.ownership_claim_status || null,
    organiser_id: row.organiser_id || '',
    image_url: row.image_url || '',
    logo_url: row.logo_url || '',
    package_tier: row.package_tier || '',
    listing_expires_at: row.listing_expires_at || '',
    listing_paid_at: row.listing_paid_at || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
    published_at: row.published_at || '',
  };
}

function isAffiliateStyleAdminType(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase();
  return t === 'partnership';
}

function buildMetaFromAdminInput(input) {
  if (Array.isArray(input.meta)) return stripEarningsMeta(normalizeMeta(input.meta));
  const meta = [];
  const affiliate = isAffiliateStyleAdminType(input.type);
  const investment = String(input.investment || '').trim();
  const includes = String(input.investment_includes || input.investmentIncludes || '').trim();
  const commission = String(input.commission || '').trim();
  const promote = String(input.promote || input.what_you_promote || '').trim();
  const suits = String(input.suits || input.who_it_suits || '').trim();
  const location = String(input.location || '').trim();
  const commitment = String(input.commitment || '').trim();
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
  return stripEarningsMeta(normalizeMeta(meta));
}

async function listOpportunitiesForAdmin(query) {
  const sb = getSupabaseAdmin();
  const status = String(query.status || '').trim();
  const approvalStatus = normalizeApprovalStatus(query.approval_status || query.approval);
  const type = String(query.type || '').trim();
  const search = String(query.q || '').trim();
  const sort = String(query.sort || 'recent').trim().toLowerCase();
  const featuredOnly = query.featured === '1' || query.featured === 'true';
  const noImage = query.no_image === '1' || query.no_image === 'true';
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
  if (approvalStatus) dbQuery = dbQuery.eq('approval_status', approvalStatus);
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

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const res = await dbQuery;
  if (res.error) throw new Error(res.error.message);

  const rows = res.data || [];
  const total = res.count != null ? res.count : rows.length;

  const pendingCountRes = await sb
    .from('business_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'Pending Review');
  if (pendingCountRes.error) throw new Error(pendingCountRes.error.message);

  return {
    opportunities: rows.map(mapOpportunityRow),
    count: rows.length,
    total,
    offset,
    limit,
    hasMore: offset + rows.length < total,
    pending_count: pendingCountRes.count || 0,
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

  const row = {
    organiser_id: null,
    owner_email: ownerEmail,
    ownership_claim_status: isHubSeedOwnerEmail(ownerEmail) ? null : 'pending',
    ownership_claimed_at: null,
    ownership_disputed_at: null,
    ownership_disputed_by_email: null,
    supabase_user_id: null,
    type,
    category: String(input.category || 'general').trim() || 'general',
    title,
    description: String(input.description || '').trim() || null,
    about,
    host,
    host_initials: hostInitials(host),
    host_color: input.host_color || '#374151',
    meta,
    outcode: geo.outcode,
    region_slug: geo.regionSlug,
    tags: isTest ? ['admin-test', type] : [type],
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
      const data = await listOpportunitiesForAdmin(queryFromRequest(req));
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
          status: body.status,
          description: body.description,
          about: body.about,
          about_text: body.about_text || body.aboutText,
          featured: body.featured,
          image_url: body.image_url || body.photo_url,
          logo_url: body.logo_url,
          owner_email: body.owner_email || body.ownerEmail,
          investment: body.investment,
          investment_includes: body.investment_includes || body.investmentIncludes,
          commission: body.commission,
          promote: body.promote || body.what_you_promote,
          suits: body.suits || body.who_it_suits,
          location: body.location,
          commitment: body.commitment,
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

    if (body.action === 'approve') {
      try {
        const sb = getSupabaseAdmin();
        const now = new Date();
        const patch = {
          approval_status: 'Approved',
          rejection_note: null,
          updated_at: now.toISOString(),
        };
        const { data: current } = await sb
          .from('business_opportunities')
          .select('status, published_at, listing_expires_at, listing_paid_at')
          .eq('id', id)
          .maybeSingle();
        // Browse requires status=published + Approved. Organiser submits already
        // published; Command Centre drafts need status flipped on Approve.
        if (String(current?.status || '').toLowerCase() !== 'published') {
          patch.status = 'published';
        }
        if (!current?.published_at) {
          patch.published_at = now.toISOString();
        }
        applyPublishedListingPayment(patch, { ...(current || {}), status: 'published' }, now);
        const { data, error } = await sb
          .from('business_opportunities')
          .update(patch)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);

        try {
          await sendOpportunityListingLiveEmail(rowToListing(data));
        } catch (emailErr) {
          console.warn('[opportunity] approve live email failed:', emailErr.message || emailErr);
        }

        return json(res, 200, { ok: true, opportunity: mapOpportunityRow(data) });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'approve_failed', message: e.message });
      }
    }

    if (body.action === 'reject') {
      const rejectionNote = String(body.rejection_note || body.note || '').trim();
      if (!rejectionNote) {
        return json(res, 400, { ok: false, error: 'missing_rejection_note' });
      }
      try {
        await rejectOpportunityListing(id, rejectionNote);
        const sb = getSupabaseAdmin();
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
            subject: 'Claim your listing — ' + String(data.title || 'Business opportunity'),
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
      Object.prototype.hasOwnProperty.call(body, 'commitment') ||
      Object.prototype.hasOwnProperty.call(body, 'investment_includes') ||
      Object.prototype.hasOwnProperty.call(body, 'commission') ||
      Object.prototype.hasOwnProperty.call(body, 'promote') ||
      Object.prototype.hasOwnProperty.call(body, 'suits') ||
      Object.prototype.hasOwnProperty.call(body, 'type')
    ) {
      patch.meta = buildMetaFromAdminInput(body);
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
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
