/**
 * Upload images to Supabase Storage (organiser logos, event photos).
 */
const { getSupabaseAdmin, supabaseConfig } = require('./supabase');

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

/**
 * @returns {Promise<string|null>} public https URL
 */
async function resolveImageUrl({ folder, logoUrl, logoBase64, logoMime, logoFilename }) {
  const url = String(logoUrl || '').trim();
  if (url && /^https?:\/\//i.test(url)) return url;

  const buffer = decodeUploadBuffer(logoBase64);
  if (!buffer) return null;

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

  return publicObjectUrl(name);
}

module.exports = {
  BUCKET,
  resolveImageUrl,
  decodeUploadBuffer,
};
