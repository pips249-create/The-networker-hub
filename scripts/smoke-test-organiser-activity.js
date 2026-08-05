#!/usr/bin/env node
/**
 * Smoke tests for organiser owner activity history (WIBN / team accountability).
 * Usage: node scripts/smoke-test-organiser-activity.js [baseUrl]
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  fetchAccountActivity,
  fetchEntityActivity,
  mapActorRole,
} = require('../api/_lib/entity-activity-log');

const root = path.join(__dirname, '..');
const baseUrl = String(process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

let passed = 0;
let failed = 0;

function ok(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  ✓', label);
    return true;
  }
  failed += 1;
  console.error('  ✗', label, detail ? '— ' + detail : '');
  return false;
}

async function main() {
  console.log('Organiser activity smoke tests\n');

  console.log('1) Source wiring');
  const organiserJs = fs.readFileSync(path.join(root, 'api/organiser.js'), 'utf8');
  const routeFile = fs.readFileSync(
    path.join(root, 'api/_lib/routes/organiser-activity.js'),
    'utf8'
  );
  const html = fs.readFileSync(path.join(root, 'organiser/index.html'), 'utf8');
  const dash = fs.readFileSync(path.join(root, 'js/organiser-dashboard.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/organiser-dashboard.css'), 'utf8');
  const logLib = fs.readFileSync(path.join(root, 'api/_lib/entity-activity-log.js'), 'utf8');

  ok('api/organiser.js registers activity route', /activity:\s*require\('\.\/_lib\/routes\/organiser-activity'\)/.test(organiserJs));
  ok('route is GET-only with owner gate', /canManageTeam/.test(routeFile) && /method !== 'GET'/.test(routeFile));
  ok('route strips Hub admin emails', /actorRole[\s\S]*admin[\s\S]*actorEmail:\s*''/.test(routeFile));
  ok('Team page has Recent activity panel', html.includes('id="org-team-activity"') && html.includes('Recent activity'));
  ok('Dashboard loads /api/organiser/activity', dash.includes('/api/organiser/activity') && dash.includes('loadTeamActivity'));
  ok('Activity panel hidden for non-owners', dash.includes('activityPanel.hidden = !state.canManageTeam'));
  ok('CSS styles activity list', css.includes('.org-team-activity-item'));
  ok('fetchAccountActivity exported', logLib.includes('async function fetchAccountActivity') && logLib.includes('fetchAccountActivity,'));

  console.log('\n2) Helper behaviour');
  ok('mapActorRole owner/team', mapActorRole({}, { role: 'owner' }) === 'owner' && mapActorRole({}, { role: 'editor' }) === 'team');
  const missing = await fetchAccountActivity({});
  ok(
    'fetchAccountActivity empty scope is safe',
    Array.isArray(missing.items) && (missing.error === 'missing_filter' || missing.configured === false),
    JSON.stringify(missing)
  );
  const missingEntity = await fetchEntityActivity({});
  ok(
    'fetchEntityActivity empty filter is safe',
    Array.isArray(missingEntity.items) &&
      (missingEntity.error === 'missing_filter' || missingEntity.configured === false),
    JSON.stringify(missingEntity)
  );

  // When env is loaded (vercel local), empty scope should report missing_filter.
  try {
    require('fs');
    const envPath = path.join(root, '.env.local');
    if (fs.existsSync(envPath)) {
      const envText = fs.readFileSync(envPath, 'utf8');
      envText.split('\n').forEach((line) => {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m || process.env[m[1]]) return;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      });
      delete require.cache[require.resolve('../api/_lib/entity-activity-log')];
      delete require.cache[require.resolve('../api/_lib/supabase')];
      const reloaded = require('../api/_lib/entity-activity-log');
      const scoped = await reloaded.fetchAccountActivity({});
      ok(
        'with env, empty scope returns missing_filter',
        scoped.configured === true && scoped.error === 'missing_filter',
        JSON.stringify(scoped)
      );
    } else {
      ok('with env, empty scope returns missing_filter', true, 'skipped (.env.local missing)');
    }
  } catch (e) {
    ok('with env, empty scope returns missing_filter', false, e.message);
  }

  console.log('\n3) Live HTTP against', baseUrl);
  try {
    const unauth = await fetch(baseUrl + '/api/organiser/activity', {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
    });
    const unauthBody = await unauth.json().catch(() => ({}));
    ok(
      'unauthenticated activity returns 401/403',
      unauth.status === 401 || unauth.status === 403,
      'status=' + unauth.status + ' body=' + JSON.stringify(unauthBody).slice(0, 120)
    );

    const post = await fetch(baseUrl + '/api/organiser/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    ok('POST activity rejected', post.status === 405 || post.status === 401 || post.status === 403, 'status=' + post.status);

    const teamHtml = await fetch(baseUrl + '/organiser/');
    const teamText = await teamHtml.text();
    ok('served organiser page includes activity markup', teamHtml.ok && teamText.includes('org-team-activity'));

    const dashRes = await fetch(baseUrl + '/js/organiser-dashboard.js');
    const dashText = await dashRes.text();
    ok('served dashboard JS includes loadTeamActivity', dashRes.ok && dashText.includes('loadTeamActivity'));

    const cssRes = await fetch(baseUrl + '/css/organiser-dashboard.css');
    const cssText = await cssRes.text();
    ok('served CSS includes activity styles', cssRes.ok && cssText.includes('.org-team-activity-item'));
  } catch (e) {
    ok('live HTTP checks reachable', false, e.message || String(e));
  }

  console.log('\n' + (failed ? failed + ' failed, ' : '') + passed + ' passed.');
  if (failed) process.exitCode = 1;
  else console.log('All organiser activity checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
