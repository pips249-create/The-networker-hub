/**
 * Attendee dashboard member offers (My services).
 * Members read published rows. Platform admins create and edit them.
 */
const LIMITS = {
  title: 120,
  provider: 80,
  category: 40,
  highlight: 48,
  summary: 280,
  details: 4000,
  href: 500,
  imageUrl: 500,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value, max) {
  const s = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.slice(0, max);
}

function cleanMultiline(value, max) {
  const s = String(value == null ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!s) return '';
  return s.slice(0, max);
}

function cleanHttpUrl(value, max) {
  const s = cleanText(value, max);
  if (!s) return '';
  let url;
  try {
    url = new URL(s);
  } catch {
    return { error: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'invalid_url' };
  }
  if (url.username || url.password) return { error: 'invalid_url' };
  return url.toString();
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function firstPresent(src, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    if (hasOwn(src, keys[i])) return src[keys[i]];
  }
  return undefined;
}

function anyPresent(src, keys) {
  return keys.some((key) => hasOwn(src, key));
}

/**
 * @param {object} input
 * @param {{ partial?: boolean }} [options]
 */
function normalizeMemberOfferInput(input, options) {
  const partial = Boolean(options && options.partial);
  const src = input && typeof input === 'object' ? input : {};
  const fields = {};
  const errors = [];

  if (!partial || anyPresent(src, ['title'])) {
    const title = cleanText(firstPresent(src, ['title']), LIMITS.title);
    if (!title) errors.push('title');
    else fields.title = title;
  }

  if (!partial || anyPresent(src, ['provider'])) {
    fields.provider = cleanText(firstPresent(src, ['provider']), LIMITS.provider);
  }

  if (!partial || anyPresent(src, ['category'])) {
    fields.category = cleanText(firstPresent(src, ['category']), LIMITS.category);
  }

  if (!partial || anyPresent(src, ['highlight'])) {
    fields.highlight = cleanText(firstPresent(src, ['highlight']), LIMITS.highlight);
  }

  if (!partial || anyPresent(src, ['summary', 'description'])) {
    fields.summary = cleanText(firstPresent(src, ['summary', 'description']), LIMITS.summary);
  }

  if (!partial || anyPresent(src, ['details', 'body'])) {
    fields.details = cleanMultiline(firstPresent(src, ['details', 'body']), LIMITS.details);
  }

  if (!partial || anyPresent(src, ['href', 'link', 'url'])) {
    const href = cleanHttpUrl(firstPresent(src, ['href', 'link', 'url']), LIMITS.href);
    if (href && href.error) errors.push('href');
    else fields.href = href || '';
  }

  if (!partial || anyPresent(src, ['imageUrl', 'image_url'])) {
    const imageUrl = cleanHttpUrl(firstPresent(src, ['imageUrl', 'image_url']), LIMITS.imageUrl);
    if (imageUrl && imageUrl.error) errors.push('imageUrl');
    else fields.image_url = imageUrl || '';
  }

  if (!partial || anyPresent(src, ['published'])) {
    const raw = firstPresent(src, ['published']);
    if (!partial && raw == null) fields.published = true;
    else fields.published = raw === true || raw === 'true' || raw === 1 || raw === '1';
  }

  if (!partial || anyPresent(src, ['sortOrder', 'sort_order'])) {
    const raw = firstPresent(src, ['sortOrder', 'sort_order']);
    const n = Number(raw);
    fields.sort_order = Number.isFinite(n) ? Math.max(0, Math.min(9999, Math.round(n))) : 0;
  }

  return { ok: errors.length === 0, errors, fields };
}

function isMemberOfferId(id) {
  return UUID_RE.test(String(id || '').trim());
}

function memberOfferFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || '',
    provider: row.provider || '',
    category: row.category || '',
    highlight: row.highlight || '',
    summary: row.summary || '',
    details: row.details || '',
    href: row.href || '',
    imageUrl: row.image_url || '',
    published: row.published === true,
    sortOrder: Number(row.sort_order) || 0,
    updatedAt: row.updated_at || null,
  };
}

function isMissingTable(error) {
  const code = String(error && error.code ? error.code : '');
  const msg = String((error && (error.message || error.details)) || '');
  return code === '42P01' || /does not exist/i.test(msg);
}

function adminClient() {
  return require('./supabase').getSupabaseAdmin();
}

async function listMemberOffers(options) {
  const includeUnpublished = Boolean(options && options.includeUnpublished);
  const sb = adminClient();
  let query = sb
    .from('member_offers')
    .select(
      'id, title, provider, category, highlight, summary, details, href, image_url, published, sort_order, updated_at'
    )
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (!includeUnpublished) query = query.eq('published', true);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw error;
  }
  return (data || []).map(memberOfferFromRow);
}

async function createMemberOffer(fields, createdBy) {
  const sb = adminClient();
  const row = {
    title: fields.title,
    provider: fields.provider || '',
    category: fields.category || '',
    highlight: fields.highlight || '',
    summary: fields.summary || '',
    details: fields.details || '',
    href: fields.href || '',
    image_url: fields.image_url || '',
    published: fields.published !== false,
    sort_order: Number.isFinite(fields.sort_order) ? fields.sort_order : 0,
    updated_at: new Date().toISOString(),
  };
  if (isMemberOfferId(createdBy)) row.created_by = createdBy;
  const { data, error } = await sb.from('member_offers').insert(row).select('*').single();
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw error;
  }
  return memberOfferFromRow(data);
}

async function updateMemberOffer(id, fields) {
  const sb = adminClient();
  const patch = { updated_at: new Date().toISOString() };
  if (hasOwn(fields, 'title')) patch.title = fields.title;
  if (hasOwn(fields, 'provider')) patch.provider = fields.provider;
  if (hasOwn(fields, 'category')) patch.category = fields.category;
  if (hasOwn(fields, 'highlight')) patch.highlight = fields.highlight;
  if (hasOwn(fields, 'summary')) patch.summary = fields.summary;
  if (hasOwn(fields, 'details')) patch.details = fields.details;
  if (hasOwn(fields, 'href')) patch.href = fields.href;
  if (hasOwn(fields, 'image_url')) patch.image_url = fields.image_url;
  if (hasOwn(fields, 'published')) patch.published = fields.published;
  if (hasOwn(fields, 'sort_order')) patch.sort_order = fields.sort_order;
  const { data, error } = await sb
    .from('member_offers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw error;
  }
  return memberOfferFromRow(data);
}

async function deleteMemberOffer(id) {
  const sb = adminClient();
  const { data, error } = await sb.from('member_offers').delete().eq('id', id).select('id').maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw error;
  }
  return Boolean(data && data.id);
}

module.exports = {
  LIMITS,
  normalizeMemberOfferInput,
  isMemberOfferId,
  memberOfferFromRow,
  listMemberOffers,
  createMemberOffer,
  updateMemberOffer,
  deleteMemberOffer,
};
