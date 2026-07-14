/**
 * Same-origin logo proxy so organiser page logos can be painted onto canvas
 * (remote storage hosts often omit CORS headers and taint the canvas).
 */
module.exports = async function handler(req, res) {
  const api = require('../organiser-provider').getOrganiserApi();
  const { json, setCors, getOrganiserWorkspace, groupOwnedBySession, listGroupsForSession } =
    api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'private, max-age=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const ws = await getOrganiserWorkspace(req);
    if (!ws.ok && ws.error === 'not_authenticated') {
      return json(res, ws.status || 401, { error: ws.error });
    }
    if (!ws.ok) {
      return json(res, ws.status || 500, {
        error: ws.error,
        message: ws.message,
      });
    }

    const url = new URL(req.url, 'http://localhost');
    const groupId = String(url.searchParams.get('groupId') || '').trim();
    if (!groupId) return json(res, 400, { error: 'group_id_required' });

    const groups =
      (ws.groups && ws.groups.length ? ws.groups : null) ||
      (listGroupsForSession ? await listGroupsForSession(ws.session) : []);
    if (!groupOwnedBySession || !groupOwnedBySession(ws.session, groups, groupId)) {
      return json(res, 403, { error: 'not_allowed' });
    }

    const group = (groups || []).find((g) => String(g.id) === groupId);
    const logoUrl = String((group && group.imageUrl) || '').trim();
    if (!logoUrl) return json(res, 404, { error: 'logo_not_found' });

    let parsed;
    try {
      parsed = new URL(logoUrl);
    } catch {
      return json(res, 400, { error: 'invalid_logo_url' });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json(res, 400, { error: 'invalid_logo_url' });
    }

    const upstream = await fetch(logoUrl, {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*' },
    });
    if (!upstream.ok) {
      return json(res, 502, { error: 'logo_fetch_failed', status: upstream.status });
    }

    const contentType = String(upstream.headers.get('content-type') || 'image/png').split(';')[0];
    if (!/^image\//i.test(contentType) && contentType !== 'application/octet-stream') {
      return json(res, 502, { error: 'not_an_image' });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!buf.length || buf.length > 2.5 * 1024 * 1024) {
      return json(res, 502, { error: 'logo_too_large' });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', /^image\//i.test(contentType) ? contentType : 'image/png');
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  } catch (err) {
    return json(res, 500, {
      error: 'logo_proxy_failed',
      message: err && err.message ? err.message : 'failed',
    });
  }
};
