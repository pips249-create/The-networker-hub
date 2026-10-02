/**
 * Attendee dashboard member offers.
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
  promoCode: 40,
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

function cleanDate(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: 'invalid_date' };
  const parsed = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) {
    return { error: 'invalid_date' };
  }
  return s;
}

function londonToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Published, and still on or before its end date. */
function memberOfferIsLive(offer, today) {
  if (!offer || offer.published !== true) return false;
  const end = String(offer.endsOn || offer.ends_on || '').slice(0, 10);
  if (!end) return true;
  return end >= String(today || londonToday());
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

  if (!partial || anyPresent(src, ['promoCode', 'promo_code', 'code'])) {
    fields.promo_code = cleanText(firstPresent(src, ['promoCode', 'promo_code', 'code']), LIMITS.promoCode);
  }

  if (!partial || anyPresent(src, ['endsOn', 'ends_on'])) {
    const endsOn = cleanDate(firstPresent(src, ['endsOn', 'ends_on']));
    if (endsOn && endsOn.error) errors.push('endsOn');
    else fields.ends_on = endsOn || '';
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

  if (!partial && fields.published === true) {
    if (!fields.href && errors.indexOf('href') === -1) errors.push('href');
    if (!fields.image_url && errors.indexOf('imageUrl') === -1) errors.push('imageUrl');
  }

  return { ok: errors.length === 0, errors, fields };
}

function isMemberOfferId(id) {
  return UUID_RE.test(String(id || '').trim());
}

/** A published card needs a real offer link and a picture. */
function publishGaps(offer) {
  if (!offer || offer.published !== true) return [];
  const gaps = [];
  if (!offer.href) gaps.push('href');
  if (!offer.imageUrl && !offer.image_url) gaps.push('imageUrl');
  return gaps;
}

function rejectUnpublishable(published, href, imageUrl) {
  const gaps = publishGaps({ published: published === true, href: href || '', imageUrl: imageUrl || '' });
  if (!gaps.length) return;
  const err = new Error('Add a link and a picture before publishing this offer.');
  err.code = 'publish_incomplete';
  err.fields = gaps;
  throw err;
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
    promoCode: row.promo_code || '',
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : '',
    published: row.published === true,
    sortOrder: Number(row.sort_order) || 0,
    updatedAt: row.updated_at || null,
  };
}

const OFFER_COLUMNS =
  'id, title, provider, category, highlight, summary, details, href, image_url, promo_code, ends_on, published, sort_order, updated_at';
const OFFER_COLUMNS_LEGACY =
  'id, title, provider, category, highlight, summary, details, href, image_url, published, sort_order, updated_at';

function isMissingTable(error) {
  const code = String(error && error.code ? error.code : '');
  const msg = String((error && (error.message || error.details)) || '');
  return code === '42P01' || /does not exist/i.test(msg);
}

function errorText(error) {
  return String((error && (error.message || error.details || error.hint)) || '');
}

/** Code and end date columns are not on the live table until migration 303. */
function missingOfferExtras(error) {
  return /promo_code|ends_on/i.test(errorText(error));
}

function adminClient() {
  return require('./supabase').getSupabaseAdmin();
}

async function listMemberOffers(options) {
  const includeUnpublished = Boolean(options && options.includeUnpublished);
  const sb = adminClient();
  async function load(columns) {
    let query = sb
      .from('member_offers')
      .select(columns)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });
    if (!includeUnpublished) query = query.eq('published', true);
    return query;
  }
  let { data, error } = await load(OFFER_COLUMNS);
  if (error && missingOfferExtras(error)) {
    ({ data, error } = await load(OFFER_COLUMNS_LEGACY));
  }
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw error;
  }
  const today = londonToday();
  return (data || []).map(memberOfferFromRow).filter(function (offer) {
    return includeUnpublished || memberOfferIsLive(offer, today);
  });
}

async function createMemberOffer(fields, createdBy) {
  const published = fields.published !== false;
  rejectUnpublishable(published, fields.href, fields.image_url);
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
    promo_code: fields.promo_code || '',
    ends_on: fields.ends_on || null,
    published: fields.published !== false,
    sort_order: Number.isFinite(fields.sort_order) ? fields.sort_order : 0,
    updated_at: new Date().toISOString(),
  };
  if (isMemberOfferId(createdBy)) row.created_by = createdBy;
  let { data, error } = await sb.from('member_offers').insert(row).select('*').single();
  if (error && missingOfferExtras(error)) {
    const legacy = Object.assign({}, row);
    delete legacy.promo_code;
    delete legacy.ends_on;
    ({ data, error } = await sb.from('member_offers').insert(legacy).select('*').single());
  }
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
  const existingRes = await sb
    .from('member_offers')
    .select('href, image_url, published')
    .eq('id', id)
    .maybeSingle();
  if (existingRes.error) {
    if (isMissingTable(existingRes.error)) {
      const err = new Error('member_offers_not_ready');
      err.code = 'not_ready';
      throw err;
    }
    throw existingRes.error;
  }
  if (!existingRes.data) return null;
  const existing = existingRes.data;
  const published = hasOwn(fields, 'published') ? fields.published === true : existing.published === true;
  const href = hasOwn(fields, 'href') ? fields.href : existing.href || '';
  const imageUrl = hasOwn(fields, 'image_url') ? fields.image_url : existing.image_url || '';
  rejectUnpublishable(published, href, imageUrl);
  const patch = { updated_at: new Date().toISOString() };
  if (hasOwn(fields, 'title')) patch.title = fields.title;
  if (hasOwn(fields, 'provider')) patch.provider = fields.provider;
  if (hasOwn(fields, 'category')) patch.category = fields.category;
  if (hasOwn(fields, 'highlight')) patch.highlight = fields.highlight;
  if (hasOwn(fields, 'summary')) patch.summary = fields.summary;
  if (hasOwn(fields, 'details')) patch.details = fields.details;
  if (hasOwn(fields, 'href')) patch.href = fields.href;
  if (hasOwn(fields, 'image_url')) patch.image_url = fields.image_url;
  if (hasOwn(fields, 'promo_code')) patch.promo_code = fields.promo_code;
  if (hasOwn(fields, 'ends_on')) patch.ends_on = fields.ends_on || null;
  if (hasOwn(fields, 'published')) patch.published = fields.published;
  if (hasOwn(fields, 'sort_order')) patch.sort_order = fields.sort_order;
  let { data, error } = await sb
    .from('member_offers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error && missingOfferExtras(error)) {
    delete patch.promo_code;
    delete patch.ends_on;
    ({ data, error } = await sb
      .from('member_offers')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle());
  }
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

async function applyOfferImage(body) {
  const src = body && typeof body === 'object' ? body : {};
  const encoded = String(src.imageBase64 || src.image_base64 || '');
  if (!encoded) return src;
  const { resolveImageUrl } = require('./supabase-storage');
  let url = '';
  try {
    url = await resolveImageUrl({
      folder: 'member-offers',
      logoBase64: encoded,
      logoMime: src.imageMime || src.image_mime || '',
      logoFilename: src.imageFilename || src.image_filename || 'offer.jpg',
    });
  } catch (e) {
    const err = new Error(e && e.message ? e.message : 'Could not save that image.');
    err.code = 'image_upload_failed';
    throw err;
  }
  if (!url) {
    const err = new Error('Could not save that image.');
    err.code = 'image_upload_failed';
    throw err;
  }
  src.imageUrl = url;
  return src;
}

module.exports = {
  LIMITS,
  normalizeMemberOfferInput,
  isMemberOfferId,
  publishGaps,
  memberOfferIsLive,
  missingOfferExtras,
  londonToday,
  memberOfferFromRow,
  applyOfferImage,
  listMemberOffers,
  createMemberOffer,
  updateMemberOffer,
  deleteMemberOffer,
};
