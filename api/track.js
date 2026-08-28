/**
 * Public open/click tracking for platform emails.
 * GET /api/track?kind=open&t=TOKEN
 * GET /api/track?kind=click&t=TOKEN&u=ENCODED_URL
 *
 * Looks up tokens on monthly group-update queue first, then attendee round-up recipients.
 */
const { getSupabaseAdmin, useSupabase } = require('./_lib/supabase');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimit } = require('./_lib/rate-limit');

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function getQuery(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams;
}

function safeRedirectUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const decoded = decodeURIComponent(value);
    const parsed = new URL(decoded);
    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'mailto:'
    ) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

async function recordOpenOnTable(sb, table, token) {
  const { data: row } = await sb
    .from(table)
    .select('id, open_count, opened_at')
    .eq('tracking_token', token)
    .maybeSingle();
  if (!row) return false;
  const patch = {
    open_count: Math.max(0, Number(row.open_count) || 0) + 1,
  };
  if (!row.opened_at) patch.opened_at = new Date().toISOString();
  await sb.from(table).update(patch).eq('id', row.id);
  return true;
}

async function recordOpen(sb, token) {
  if (await recordOpenOnTable(sb, 'organiser_group_update_queue', token)) return;
  await recordOpenOnTable(sb, 'event_connections_recipients', token);
}

async function recordClick(sb, token, targetUrl) {
  const { data: oguRow } = await sb
    .from('organiser_group_update_queue')
    .select('id, update_id, click_count, clicked_at')
    .eq('tracking_token', token)
    .maybeSingle();
  if (oguRow) {
    const patch = {
      click_count: Math.max(0, Number(oguRow.click_count) || 0) + 1,
    };
    if (!oguRow.clicked_at) patch.clicked_at = new Date().toISOString();
    await sb.from('organiser_group_update_queue').update(patch).eq('id', oguRow.id);

    if (oguRow.update_id && targetUrl && !/^mailto:/i.test(targetUrl)) {
      const { data: existing } = await sb
        .from('organiser_group_update_link_clicks')
        .select('id, click_count')
        .eq('update_id', oguRow.update_id)
        .eq('url', targetUrl)
        .maybeSingle();
      if (existing) {
        await sb
          .from('organiser_group_update_link_clicks')
          .update({
            click_count: Math.max(0, Number(existing.click_count) || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await sb.from('organiser_group_update_link_clicks').insert({
          update_id: oguRow.update_id,
          url: targetUrl.slice(0, 2000),
          click_count: 1,
        });
      }
    }
    return;
  }

  const { data: connRow } = await sb
    .from('event_connections_recipients')
    .select('id, click_count, clicked_at')
    .eq('tracking_token', token)
    .maybeSingle();
  if (!connRow) return;
  const patch = {
    click_count: Math.max(0, Number(connRow.click_count) || 0) + 1,
  };
  if (!connRow.clicked_at) patch.clicked_at = new Date().toISOString();
  await sb.from('event_connections_recipients').update(patch).eq('id', connRow.id);
}

module.exports = wrapHandler(async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('method_not_allowed');
  }

  const limited = enforceRateLimit(req, res, 'ogu_track', {
    max: 120,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    res.statusCode = 429;
    return res.end('rate_limited');
  }

  const q = getQuery(req);
  const kind = String(q.get('kind') || '').trim().toLowerCase();
  const token = String(q.get('t') || '').trim();
  const targetUrl = safeRedirectUrl(q.get('u'));

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    if (kind === 'click' && targetUrl) {
      res.statusCode = 302;
      res.setHeader('Location', targetUrl);
      return res.end();
    }
    res.statusCode = 204;
    return res.end();
  }

  if (useSupabase()) {
    try {
      const sb = getSupabaseAdmin();
      if (kind === 'open') await recordOpen(sb, token);
      else if (kind === 'click') await recordClick(sb, token, targetUrl);
    } catch (e) {
      /* never block the redirect/pixel */
    }
  }

  if (kind === 'click') {
    res.statusCode = 302;
    res.setHeader('Location', targetUrl || 'https://www.thenetworkeruk.com/');
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  return res.end(PIXEL_GIF);
});