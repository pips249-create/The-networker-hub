#!/usr/bin/env node
/**
 * Free local ports and clear orphaned `vercel dev` Node workers.
 * Long sessions spawn many @vercel/node workers (~1GB+) and make localhost crawl.
 *
 * Usage: node scripts/clean-local-dev.js
 * Wired from npm prestart so every `npm start` begins clean.
 */
const { execSync } = require('child_process');

const PORTS = [3000, 3001];

function sh(cmd) {
  try {
    return String(
      execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || ''
    ).trim();
  } catch (e) {
    return '';
  }
}

function killPids(pids) {
  const list = [...new Set(pids.map(Number).filter((n) => n > 1))];
  if (!list.length) return 0;
  try {
    execSync('kill ' + list.join(' '), { stdio: 'ignore' });
  } catch (e) {
    /* already gone */
  }
  return list.length;
}

function pidsOnPort(port) {
  const out = sh('lsof -tiTCP:' + port + ' -sTCP:LISTEN');
  if (!out) return [];
  return out.split(/\s+/).filter(Boolean);
}

function orphanWorkerPids() {
  // Match Vercel CLI builder workers only — not unrelated node apps.
  const out = sh(
    "ps ax -o pid= -o command= | grep -E 'builders-vlt/.*/@vercel/node|.*/vercel.*dev-server\\.mjs|[nv]ercel dev' | grep -v grep"
  );
  if (!out) return [];
  return out
    .split('\n')
    .map(function (line) {
      return String(line || '')
        .trim()
        .split(/\s+/)[0];
    })
    .filter(Boolean);
}

let killed = 0;
PORTS.forEach(function (port) {
  killed += killPids(pidsOnPort(port));
});
killed += killPids(orphanWorkerPids());

// Second pass after a brief settle (TIME_WAIT / respawned children).
sh('sleep 1');
PORTS.forEach(function (port) {
  killed += killPids(pidsOnPort(port));
});
killed += killPids(orphanWorkerPids());

if (killed) {
  console.log('clean-local-dev: stopped ' + killed + ' local process' + (killed === 1 ? '' : 'es'));
} else {
  console.log('clean-local-dev: ports ' + PORTS.join('/') + ' already free');
}
