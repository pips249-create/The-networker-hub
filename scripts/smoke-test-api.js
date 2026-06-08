#!/usr/bin/env node
/**
 * Smoke test event listings API. Usage:
 *   node scripts/smoke-test-api.js                    # localhost
 *   node scripts/smoke-test-api.js https://the-networker-hub.vercel.app
 */
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const paths = ['/api/hub-listings', '/api/events'];

async function probe(path) {
  const url = base + path;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { path, ok: false, message: 'HTTP ' + res.status + ' — not JSON' };
    }
    const count = Array.isArray(data.events) ? data.events.length : 0;
    if (!res.ok) return { path, ok: false, message: 'HTTP ' + res.status + ': ' + (data.message || data.error) };
    if (data.error) return { path, ok: false, message: data.message || data.error };
    if (!data.configured) return { path, ok: false, message: 'API not configured' };
    return { path, ok: true, message: count + ' events' };
  } catch (e) {
    return { path, ok: false, message: e.message || 'fetch failed' };
  }
}

(async function main() {
  console.log('Checking', base);
  for (const path of paths) {
    const r = await probe(path);
    console.log(r.ok ? '  OK  ' : '  FAIL', path + ' —', r.message);
    if (r.ok) {
      console.log('\nEvents API is healthy.');
      process.exit(0);
    }
  }
  console.log('\nEvents API check failed. See LOCAL-DEV.md');
  process.exit(1);
})();
