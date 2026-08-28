#!/usr/bin/env node
/**
 * Smoke checks for organiser Marketing team role.
 *   node scripts/smoke-test-organiser-marketing-role.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const accessFile = read('api/_lib/supabase-organiser-access.js');
const dashFile = read('js/organiser-dashboard.js');
const htmlFile = read('organiser/index.html');
const migration = read('supabase/migrations/268_organiser_team_marketing_role.sql');

assert.ok(/marketing/.test(migration), 'migration includes marketing role');
assert.ok(/isMarketing/.test(accessFile), 'access layer exposes isMarketing');
assert.ok(/canManageEvents/.test(accessFile), 'access layer exposes canManageEvents');
assert.ok(/memberRole = requestedRole === 'marketing' \? 'marketing' : 'editor'/.test(accessFile));
assert.ok(/function isMarketingWorkspace/.test(dashFile), 'dashboard detects marketing workspace');
assert.ok(/team-invite-role/.test(htmlFile), 'invite modal includes role selector');
assert.ok(/Marketing access can/.test(htmlFile), 'permissions copy mentions marketing');

const guard = require('../api/_lib/organiser-role-guard');
const marketing = require('../api/_lib/organiser-marketing-workspace');
const blocked = { role: 'marketing', isMarketing: true, canManageEvents: false, canViewRegistrations: false, canAccessCommunicate: false };
assert.strictEqual(guard.assertCanManageEvents(blocked).ok, false);
assert.strictEqual(guard.assertCanViewRegistrations(blocked).ok, false);
assert.strictEqual(guard.assertCanAccessCommunicate(blocked).ok, false);
const sanitized = marketing.sanitizeWorkspaceForMarketing({
  workspaceSummary: { computed: true, totalRevenue: 10 },
  stats: { revenue: 10 },
});
assert.strictEqual(sanitized.workspaceSummary, null);
assert.strictEqual(sanitized.stats.revenue, null);

console.log('smoke-test-organiser-marketing-role: ok');
