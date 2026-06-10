/**
 * Business opportunity listings — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');

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
  'networking',
  'distributorship',
  'business-opportunity',
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

function normalizeType(type) {
  const s = String(type || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  if (VALID_TYPES.has(s)) return s;
  if (s === 'sidehustle') return 'side-hustle';
  if (s === 'business') return 'business-opportunity';
  return 'business-opportunity';
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
  return out;
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
  const meta = normalizeMeta(row.meta);
  return {
    id: row.id,
    type: row.type,
    tags: Array.isArray(row.tags) && row.tags.length ? row.tags.slice() : [row.type],
    featured: Boolean(row.featured),
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
    status: row.status || 'draft',
    approvalStatus: row.approval_status || 'Pending Review',
    organiserId: row.organiser_id || '',
    ownerEmail: String(row.owner_email || '').toLowerCase(),
    ownerUserId: row.supabase_user_id || '',
    packageTier: row.package_tier || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    publishedAt: row.published_at || null,
  };
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
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'photoUrl')) {
    const url = String(payload.photoUrl || '').trim();
    if (url && /^https?:\/\//i.test(url)) return url;
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
    if (url && /^https?:\/\//i.test(url)) return url;
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
    meta: normalizeMeta(payload.meta),
    tags: buildOpportunityTags(types, payload),
    package_tier: String(payload.packageTier || '').trim() || null,
    updated_at: new Date().toISOString(),
  };

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
      row.approval_status = 'Approved';
      row.published_at = new Date().toISOString();
    }
  }

  return row;
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
  return (data || []).map(rowToListing);
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
  return rowToListing(data);
}

async function getOpportunityById(id) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('business_opportunities').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToListing(data);
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

async function createOpportunity(payload) {
  const sb = getSupabaseAdmin();
  const row = await buildOpportunityRow(payload, 'new', 'create');
  if (!row.owner_email && !row.supabase_user_id) throw new Error('missing_owner');
  if (!row.title) throw new Error('missing_title');
  if (!row.host) row.host = 'Draft listing';
  if (!row.type) row.type = 'business-opportunity';
  const { data, error } = await sb.from('business_opportunities').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

async function updateOpportunity(id, payload) {
  const sb = getSupabaseAdmin();
  const row = await buildOpportunityRow(payload, id, 'update');
  const { data, error } = await sb.from('business_opportunities').update(row).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
}

async function activateOpportunityPremium(opportunityId) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('business_opportunities')
    .update({
      featured: true,
      package_tier: 'premium',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToListing(data);
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

async function createOpportunityEnquiry(input) {
  const opportunityId = String(input.opportunityId || '').trim();
  const name = String(input.name || input.enquirerName || '').trim();
  const email = String(input.email || input.enquirerEmail || '').trim();
  const message = String(input.message || '').trim();
  if (!isUuid(opportunityId)) throw new Error('invalid_opportunity_id');
  if (!name) throw new Error('missing_name');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  if (!message) throw new Error('missing_message');

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
  return enquiryRowToDto(data, opportunity);
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

  const opportunity = await activateOpportunityPremium(opportunityId);
  return { ok: true, opportunityId, featured: opportunity.featured };
}

module.exports = {
  rowToListing,
  listPublishedOpportunities,
  getPublishedOpportunityById,
  getOpportunityById,
  listOpportunitiesForSession,
  opportunityOwnedBySession,
  createOpportunity,
  updateOpportunity,
  activateOpportunityPremium,
  handleOpportunityPremiumCheckout,
  createOpportunityEnquiry,
  listOpportunityEnquiriesForSession,
  updateOpportunityEnquiryStatus,
  normalizeType,
  normalizeTypes,
  normalizeMeta,
};
