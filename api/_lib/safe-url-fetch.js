/**
 * Block SSRF to private/link-local/metadata addresses for server-side URL fetches.
 */
const dns = require('dns').promises;
const net = require('net');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
]);

function ipv4ToInt(ip) {
  const parts = String(ip).split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateOrReservedIp(ip) {
  const raw = String(ip || '').trim().toLowerCase();
  if (!raw) return true;

  if (raw.includes(':')) {
    // IPv6 — block loopback, link-local, ULA, IPv4-mapped private, and unspecified.
    if (raw === '::' || raw === '::1') return true;
    if (raw.startsWith('fe80:') || raw.startsWith('fc') || raw.startsWith('fd')) return true;
    if (raw.startsWith('::ffff:')) {
      const v4 = raw.slice('::ffff:'.length);
      return isPrivateOrReservedIp(v4);
    }
    return false;
  }

  const n = ipv4ToInt(raw);
  if (n == null) return true;

  // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10 (CGNAT),
  // 192.0.0.0/24, 192.0.2.0/24, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4
  if (n <= 0x00ffffff) return true;
  if (n >= 0x0a000000 && n <= 0x0affffff) return true;
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true;
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true;
  if (n >= 0xac100000 && n <= 0xac1fffff) return true;
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true;
  if (n >= 0x64400000 && n <= 0x647fffff) return true;
  if (n >= 0xc0000000 && n <= 0xc00000ff) return true;
  if (n >= 0xc0000200 && n <= 0xc00002ff) return true;
  if (n >= 0xc6120000 && n <= 0xc613ffff) return true;
  if (n >= 0xc6336400 && n <= 0xc63364ff) return true;
  if (n >= 0xcb007100 && n <= 0xcb0071ff) return true;
  if (n >= 0xe0000000) return true;
  return false;
}

function assertHostnameAllowed(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) {
    const err = new Error('missing_host');
    err.code = 'ssrf_blocked';
    throw err;
  }
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    const err = new Error('blocked_host');
    err.code = 'ssrf_blocked';
    throw err;
  }
  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    const err = new Error('blocked_ip');
    err.code = 'ssrf_blocked';
    throw err;
  }
  return host;
}

async function assertUrlSafeForServerFetch(rawUrl, options = {}) {
  const maxRedirects = Number(options.maxRedirects) > 0 ? Number(options.maxRedirects) : 3;
  let current = String(rawUrl || '').trim();
  if (!current) {
    const err = new Error('missing_url');
    err.code = 'invalid_url';
    throw err;
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let parsed;
    try {
      parsed = new URL(current);
    } catch {
      const err = new Error('invalid_url');
      err.code = 'invalid_url';
      throw err;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      const err = new Error('invalid_protocol');
      err.code = 'invalid_protocol';
      throw err;
    }
    if (parsed.username || parsed.password) {
      const err = new Error('credentials_not_allowed');
      err.code = 'ssrf_blocked';
      throw err;
    }

    const host = assertHostnameAllowed(parsed.hostname);
    if (!net.isIP(host)) {
      let records;
      try {
        records = await dns.lookup(host, { all: true, verbatim: true });
      } catch {
        const err = new Error('dns_lookup_failed');
        err.code = 'ssrf_blocked';
        throw err;
      }
      if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
        const err = new Error('blocked_resolved_ip');
        err.code = 'ssrf_blocked';
        throw err;
      }
    }

    // Prefer https when the caller upgraded http→https (image proxy).
    if (parsed.protocol === 'http:' && options.preferHttps) {
      parsed.protocol = 'https:';
    }

    const upstream = await fetch(parsed.toString(), {
      method: options.method || 'GET',
      redirect: 'manual',
      headers: options.headers || {},
      signal: options.signal,
    });

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (!location) {
        const err = new Error('redirect_without_location');
        err.code = 'fetch_failed';
        throw err;
      }
      current = new URL(location, parsed).toString();
      continue;
    }

    return { response: upstream, finalUrl: parsed.toString() };
  }

  const err = new Error('too_many_redirects');
  err.code = 'ssrf_blocked';
  throw err;
}

function imageFetchHeadersForUrl(rawUrl) {
  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const host = String(parsed.hostname || '').toLowerCase();
    if (/fbcdn\.net|facebook\.com|instagram\.com|cdninstagram\.com/i.test(host)) {
      headers.Referer = 'https://www.facebook.com/';
    } else {
      headers.Referer = parsed.origin + '/';
    }
  } catch {
    headers.Referer = 'https://www.thenetworkerhub.com/';
  }
  return headers;
}

module.exports = {
  isPrivateOrReservedIp,
  assertHostnameAllowed,
  assertUrlSafeForServerFetch,
  imageFetchHeadersForUrl,
};
