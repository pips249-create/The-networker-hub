/**
 * Admin same-origin image proxy for Command Centre canvas graphics.
 * Remote logo hosts often omit CORS headers, so browser canvas load fails.
 *
 * GET /api/admin/image-proxy?url=
 */
const { json } = require('../auth');

const MAX_BYTES = 2.5 * 1024 * 1024;

function parseUrlParam(req) {
  try {
    const base = 'http://localhost';
    const full = new URL(req.url || '/', base);
    return String(full.searchParams.get('url') || '').trim();
  } catch {
    return String(req.query?.url || '').trim();
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const raw = parseUrlParam(req);
  if (!raw) return json(res, 400, { error: 'missing_url' });

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return json(res, 400, { error: 'invalid_url' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json(res, 400, { error: 'invalid_protocol' });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'TheNetworkerHubAdminImageProxy/1.0',
      },
    });
    if (!upstream.ok) {
      return json(res, 502, { error: 'fetch_failed', status: upstream.status });
    }

    const contentType = String(upstream.headers.get('content-type') || 'image/png')
      .split(';')[0]
      .trim();
    if (!/^image\//i.test(contentType) && contentType !== 'application/octet-stream') {
      return json(res, 502, { error: 'not_an_image', contentType });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!buf.length) return json(res, 502, { error: 'empty_image' });
    if (buf.length > MAX_BYTES) return json(res, 502, { error: 'too_large' });

    res.statusCode = 200;
    res.setHeader('Content-Type', /^image\//i.test(contentType) ? contentType : 'image/png');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (err) {
    return json(res, 500, {
      error: 'image_proxy_failed',
      message: err && err.message ? err.message : 'failed',
    });
  }
};
