/**
 * Business opportunity listings — Supabase.
 */
const { getSupabaseAdmin } = require('./supabase');
const { resolveImageUrl } = require('./supabase-storage');

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
      folder: `opportunities/${opportunityId || 'new'}`,
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
  const row = {
    organiser_id: null,
    type: normalizeType(payload.type),
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
    tags: Array.isArray(payload.tags) && payload.tags.length ? payload.tags.slice() : [normalizeType(payload.type)],
    package_tier: String(payload.packageTier || '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const imageUrl = await resolveOpportunityImage(payload, opportunityId);
  if (imageUrl !== undefined) row.image_url = imageUrl;

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

async function listOpportunitiesForSession(session) {
  const sb = getSupabaseAdmin();
  const email = String(session?.email || '').toLowerCase();
  const uid = isUuid(session?.sub) ? session.sub : '';
  let query = sb.from('business_opportunities').select('*');
  if (uid && email) {
    query = query.or(`owner_email.eq.${email},supabase_user_id.eq.${uid}`);
  } else if (email) {
    query = query.eq('owner_email', email);
  } else if (uid) {
    query = query.eq('supabase_user_id', uid);
  } else {
    return [];
  }
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToListing);
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

module.exports = {
  rowToListing,
  listPublishedOpportunities,
  getPublishedOpportunityById,
  getOpportunityById,
  listOpportunitiesForSession,
  opportunityOwnedBySession,
  createOpportunity,
  updateOpportunity,
  normalizeType,
  normalizeMeta,
};
