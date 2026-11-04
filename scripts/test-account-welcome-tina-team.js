#!/usr/bin/env node
/**
 * Account welcome: TINA naming + Meet Rosie / Catherine team promos.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { resolveBrandedEmailBody } = require('../api/_lib/branded-email-templates');
const { enrichAccountWelcomeVars } = require('../api/_lib/booking-email-sections');

const html = resolveBrandedEmailBody('account_welcome', '<p>stub</p>').bodyHtml;
assert.ok(/\bTINA\b/.test(html), 'welcome body names TINA');
assert.ok(/The Intelligent Networking Assistant/.test(html), 'TINA spelled out');
assert.ok(!/\bHubert\b/.test(html), 'welcome body no longer says Hubert');
assert.ok(/\{\{\s*meet_team_section\s*\}\}/.test(html), 'meet_team_section placeholder present');

const site = 'https://www.thenetworkeruk.com';
const now = new Date('2026-11-04T12:00:00Z');
const { buildMeetTeamSectionHtml } = require('../api/_lib/hubert-event-concierge');
const teamHtml = buildMeetTeamSectionHtml(site, now);
assert.ok(/Meet Rosie/.test(teamHtml), 'Rosie promo while MarTech upcoming');
assert.ok(/the-martech-summit-london-2026/.test(teamHtml), 'Rosie links MarTech');
assert.ok(/Meet Catherine/.test(teamHtml), 'Catherine promo while Business Show upcoming');
assert.ok(/the-business-show-london/.test(teamHtml), 'Catherine links Business Show');

const enriched = enrichAccountWelcomeVars({ site_url: site }, '');
assert.ok(enriched.meet_team_section.includes('Meet Rosie'), 'welcome enrich includes Rosie');
assert.ok(enriched.meet_team_section.includes('Meet Catherine'), 'welcome enrich includes Catherine');
assert.ok(
  enriched.meet_team_section.includes('Meet the team this month'),
  'welcome wraps team promos with a section heading'
);

const afterShowsInner = buildMeetTeamSectionHtml(site, new Date('2026-11-20T12:00:00Z'));
assert.strictEqual(afterShowsInner, '', 'team promo helper empty after November shows');
const afterShows = enrichAccountWelcomeVars(
  { site_url: site, meet_team_section: afterShowsInner },
  ''
);
assert.strictEqual(afterShows.meet_team_section, '', 'welcome enrich keeps empty override');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/355_account_welcome_tina_team_events.sql'),
  'utf8'
);
assert.ok(migration.includes('TINA'), 'migration ships TINA copy');
assert.ok(migration.includes('meet_team_section'), 'migration lists meet_team_section');

console.log('OK  account welcome TINA + Meet Rosie/Catherine');
