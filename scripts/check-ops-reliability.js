#!/usr/bin/env node
/**
 * Ops reliability checklist — health probe + manual gate reminders.
 * Run: npm run check:ops
 *      npm run check:ops -- https://www.thenetworkeruk.com
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const baseUrl = (process.argv[2] || 'https://www.thenetworkeruk.com').replace(/\/$/, '');

const MANUAL_GATES = [
  {
    id: 'uptimerobot',
    label: 'UptimeRobot monitor on /api/health (5 min, alert hi@thenetworkeruk.com)',
    doc: 'docs/OPS-RELIABILITY.md §1',
  },
  {
    id: 'supabase_pro',
    label: 'Supabase Pro upgrade (Free tier today — no automated daily backups until Pro)',
    doc: 'docs/OPS-RELIABILITY.md §2',
  },
  {
    id: 'supabase_backups',
    label: 'After Pro: note backup retention + last backup time in Dashboard → Database → Backups',
    doc: 'docs/OPS-RELIABILITY.md §2',
  },
  {
    id: 'vercel_deploy_alerts',
    label: 'Vercel deployment failure notifications enabled for the team',
    doc: 'docs/OPS-RELIABILITY.md §1',
  },
  {
    id: 'restore_drill',
    label: 'Quarterly restore drill logged (or scheduled)',
    doc: 'docs/OPS-RELIABILITY.md §3',
  },
];

async function probeHealth() {
  const url = baseUrl + '/api/health';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, url };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, url };
  }
}

(async function main() {
  console.log('Ops reliability check\n');
  console.log('Target:', baseUrl);

  const health = await probeHealth();
  if (health.ok && health.data && health.data.ok === true) {
    console.log('  ✓ Health probe', health.url);
    console.log('      supabaseConfigured:', health.data.supabaseConfigured);
    console.log('      vercelEnv:', health.data.vercelEnv || '(n/a)');
  } else {
    console.log('  ✗ Health probe failed', health.url);
    if (health.status) console.log('      HTTP', health.status);
    if (health.error) console.log('      ', health.error);
    if (health.data) console.log('      ', JSON.stringify(health.data));
  }

  const opsDoc = path.join(root, 'docs/OPS-RELIABILITY.md');
  console.log('\nManual gates (confirm in Supabase / UptimeRobot / Vercel dashboards):');
  for (const gate of MANUAL_GATES) {
    console.log('  ☐', gate.label);
    console.log('      →', gate.doc);
  }

  if (fs.existsSync(opsDoc)) {
    console.log('\nFull runbook:', 'docs/OPS-RELIABILITY.md');
  }

  console.log('\nTip: after UptimeRobot is live, note monitor ID + date in docs/OPS-RELIABILITY.md change log.');

  process.exit(health.ok ? 0 : 1);
})();
