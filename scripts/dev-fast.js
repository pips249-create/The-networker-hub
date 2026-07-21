#!/usr/bin/env node
/**
 * Fast local dev: serve static files instantly on :3000, proxy dynamic routes to vercel dev on :3001.
 *
 * Usage:
 *   Terminal 1: npm run dev:api
 *   Terminal 2: npm run dev:fast
 *
 * Or one command:
 *   npm run dev:all
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const staticPort = Number(process.env.DEV_FAST_PORT || 3000);
const apiPort = Number(process.env.DEV_API_PORT || 3001);
const apiOrigin = String(process.env.DEV_API_ORIGIN || 'http://127.0.0.1:' + apiPort).replace(/\/$/, '');
const withApi = process.argv.includes('--with-api');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

function resolveFilePath(urlPath) {
  let pathname = decodeURIComponent(String(urlPath || '/').split('?')[0].split('#')[0]);
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (pathname !== '/' && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const candidates = [];
  if (pathname === '/') {
    candidates.push('index.html');
  } else {
    const rel = pathname.replace(/^\//, '');
    candidates.push(rel);
    candidates.push(rel + '.html');
    candidates.push(path.join(rel, 'index.html'));
  }

  for (const rel of candidates) {
    const abs = path.normalize(path.join(root, rel));
    if (!abs.startsWith(root)) continue;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return '';
}

function shouldProxy(urlPath) {
  const pathname = String(urlPath || '/').split('?')[0];
  if (pathname.startsWith('/api/') || pathname === '/api') return true;
  if (pathname === '/sitemap.xml') return true;
  return !resolveFilePath(pathname);
}

function proxyRequest(req, res) {
  const target = new URL(req.url || '/', apiOrigin);
  const headers = { ...req.headers, host: target.host };

  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    function (proxyRes) {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  upstream.on('error', function () {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end(
      'API backend unavailable at ' +
        apiOrigin +
        ' — run npm run dev:api in another terminal, or use npm run dev:all to start both.'
    );
  });

  req.pipe(upstream);
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

function startStaticServer() {
  const server = http.createServer(function (req, res) {
    const urlPath = req.url || '/';
    if (shouldProxy(urlPath)) {
      proxyRequest(req, res);
      return;
    }
    const filePath = resolveFilePath(urlPath.split('?')[0]);
    if (!filePath) {
      proxyRequest(req, res);
      return;
    }
    serveFile(req, res, filePath);
  });

  server.listen(staticPort, function () {
    console.log('dev:fast  http://localhost:' + staticPort + '  (static files + proxy)');
    console.log('dev:api   ' + apiOrigin + '  (vercel dev backend)');
  });

  return server;
}

function waitForApi(callback) {
  const deadline = Date.now() + 120000;
  (function poll() {
    const req = http.get(apiOrigin + '/api/hub-listings', function (res) {
      res.resume();
      callback();
    });
    req.on('error', function () {
      if (Date.now() > deadline) {
        console.warn('API backend slow to start — opening static server anyway.');
        callback();
        return;
      }
      setTimeout(poll, 1500);
    });
    req.setTimeout(2000, function () {
      req.destroy();
    });
  })();
}

function startApiServer() {
  const env = {
    ...process.env,
    DISABLE_SITE_ACCESS_GATE: process.env.DISABLE_SITE_ACCESS_GATE || 'true',
  };
  const child = spawn('npx', ['vercel', 'dev', '--listen', String(apiPort)], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', function (code) {
    process.exit(typeof code === 'number' ? code : 1);
  });

  return child;
}

if (withApi) {
  startApiServer();
  waitForApi(startStaticServer);
} else {
  startStaticServer();
}
