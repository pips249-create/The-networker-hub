/**
 * Upload images to Supabase Storage (organiser logos, event photos).
 */
const { getSupabaseAdmin, supabaseConfig } = require('./supabase');
const { assertUrlSafeForServerFetch, imageFetchHeadersForUrl } = require('./safe-url-fetch');

const BUCKET = 'organiser-assets';
const MAX_BYTES = 2 * 1024 * 1024;

function decodeUploadBuffer(base64) {
  const raw = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) return null;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > MAX_BYTES) {
    throw new Error('Image must be under 2MB');
  }
  return buffer;
}

function sanitiseFilename(filename) {
  return String(filename || 'image.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'image.jpg';
}

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return 'jpg';
}

function extFromContentType(contentType, fallbackFilename) {
  const ct = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  const fromName = String(fallbackFilename || '').match(/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i);
  if (fromName) return fromName[1].toLowerCase().replace('jpeg', 'jpg');
  return 'jpg';
}

async function ensureBucket(sb) {
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = (buckets || []).some((b) => b.id === BUCKET || b.name === BUCKET);
  if (!exists) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Storage bucket: ${error.message}. Run supabase/migrations/004_organiser_storage.sql`);
    }
  }
}

function publicObjectUrl(path) {
  const { url } = supabaseConfig();
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`;
}

function isHostedAssetUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return false;
  const { url: supaUrl } = supabaseConfig();
  const base = String(supaUrl || '').replace(/\/$/, '');
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
}

async function uploadBuffer(buffer, folder, logoMime, logoFilename) {
  const sb = getSupabaseAdmin();
  await ensureBucket(sb);

  const ext = extFromMime(logoMime || logoFilename);
  const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const type = logoMime || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const { error } = await sb.storage.from(BUCKET).upload(name, buffer, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(name);
  return (pub && pub.publicUrl) || publicObjectUrl(name);
}

async function mirrorRemoteImageUrl(rawUrl, folder, logoFilename) {
  const sourceUrl = String(rawUrl || '').trim();
  const { response } = await assertUrlSafeForServerFetch(sourceUrl, {
    preferHttps: true,
    maxRedirects: 5,
    headers: imageFetchHeadersForUrl(sourceUrl),
  });
  if (!response.ok) {
    throw new Error(`Could not fetch logo (${response.status})`);
  }

  const contentType = String(response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (contentType && !/^image\//i.test(contentType) && contentType !== 'application/octet-stream') {
    throw new Error('Logo URL must point to an image file (PNG, JPG, or WebP), not a web page');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('Logo file is empty');
  if (buffer.length > MAX_BYTES) throw new Error('Image must be under 2MB');

  const ext = extFromContentType(contentType, logoFilename);
  const mime = contentType && /^image\//i.test(contentType) ? contentType : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  return uploadBuffer(buffer, folder, mime, logoFilename || `logo.${ext}`);
}

/**
 * @returns {Promise<string|null>} public https URL
 */
async function resolveImageUrl({
  folder,
  logoUrl,
  logoBase64,
  logoMime,
  logoFilename,
  mirrorExternal = false,
}) {
  const url = String(logoUrl || '').trim();
  const base64Source =
    logoBase64 || (/^data:image\//i.test(url) ? url : '');
  const buffer = decodeUploadBuffer(base64Source);
  if (buffer) {
    return uploadBuffer(buffer, folder, logoMime, logoFilename);
  }

  if (!url) return null;
  if (isHostedAssetUrl(url)) return url;

  if (/^https?:\/\//i.test(url)) {
    if (mirrorExternal) {
      return mirrorRemoteImageUrl(url, folder, logoFilename);
    }
    return url;
  }

  return null;
}

module.exports = {
  BUCKET,
  resolveImageUrl,
  decodeUploadBuffer,
  isHostedAssetUrl,
  mirrorRemoteImageUrl,
};
