#!/usr/bin/env node
/**
 * Smoke for Hubert “we're launching” member email.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { BRANDED_EMAIL_TEMPLATES } = require('../api/_lib/branded-email-templates');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');

const entry = BRANDED_EMAIL_TEMPLATES.hubert_matchmaker_launching;
assert.ok(entry, 'template registered');
assert.strictEqual(entry.file, 'hubert-matchmaker-launching.html');
assert.ok(/launching Hubert/i.test(entry.subject), 'subject is launching not launched');
assert.ok(!/have launched/i.test(entry.subject), 'subject not past-tense launched');

const html = fs.readFileSync(
  path.join(__dirname, '../email-templates/hubert-matchmaker-launching.html'),
  'utf8'
);
assert.ok(html.includes("We're launching Hubert") || html.includes('We&apos;re launching Hubert'), 'headline');
assert.ok(html.includes('{{hubert_profile_url}}'), 'CTA to Hubert profile');
assert.ok(html.includes('{{meet_people_url}}'), 'Meet people link');
assert.ok(html.includes('Include me'), 'asks for Include me');
assert.ok(html.includes('Before I open'), 'forthcoming / launching framing');
assert.ok(!/we have launched/i.test(html), 'not past-tense launched');

const vars = mergeEmailPreviewVariables(
  'hubert_matchmaker_launching',
  {},
  'https://www.thenetworkeruk.com'
);
assert.ok(vars.hubert_profile_url && vars.hubert_profile_url.indexOf('#as-hubert-matchmaker') !== -1, 'profile deep link');
assert.ok(
  /[?&]utm_campaign=matchmaker_launching#as-hubert-matchmaker/.test(vars.hubert_profile_url),
  'profile UTM before hash'
);
assert.ok(vars.meet_people_url && vars.meet_people_url.indexOf('#meet') !== -1, 'meet deep link');
assert.ok(
  /[?&]utm_campaign=matchmaker_launching#meet/.test(vars.meet_people_url),
  'meet UTM before hash'
);
assert.ok(vars.hubert_icon_url, 'hubert icon');

const admin = fs.readFileSync(path.join(__dirname, '../js/admin-app.js'), 'utf8');
assert.ok(admin.includes('hubert_matchmaker_launching'), 'campaign picker includes template');
assert.ok(/We\\?'re launching Hubert/.test(admin), 'campaign label uses launching');
assert.ok(admin.includes("slug === 'hubert_matchmaker_launching'"), 'hides claim URL for member blast');

const sendSrc = fs.readFileSync(path.join(__dirname, '../api/_lib/send-template-email.js'), 'utf8');
assert.ok(sendSrc.includes("slug === 'hubert_matchmaker_launching'"), 'send path handles launching');
assert.ok(sendSrc.includes('matchmaker_launching'), 'send path sets launch UTM');

const campaignSrc = fs.readFileSync(
  path.join(__dirname, '../api/_lib/routes/admin-campaigns.js'),
  'utf8'
);
assert.ok(campaignSrc.includes('HUBERT_MATCHMAKER_LAUNCHING_SLUG'), 'campaign bulk supports launching');
assert.ok(campaignSrc.includes('fetchMemberNamesByEmail'), 'campaign looks up member names');

console.log('ok — hubert matchmaker launching email');
