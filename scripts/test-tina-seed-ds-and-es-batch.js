#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-ds-and-es-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/362_tina_seed_ds_and_es_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 95, '95 contacts');
assert(!/Ds and Es.*\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(JSON.stringify(batch)), 'json has no Book.xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/file:\/\//i.test(JSON.stringify(batch)), 'json has no outlook file links');
assert(!/Ds and Es.*\.xlsx/i.test(sql), 'sql has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(sql), 'sql has no Book.xlsx junk');
assert(!/Excel\]/.test(sql), 'sql has no Excel] junk');
assert(!/file:\/\//i.test(sql), 'sql has no outlook file links');
assert(!/garryanderson@andrewbull\.co\.uk/i.test(sql), 'sql has no leftover mailto');

const emails = new Set();
batch.contacts.forEach((c) => {
  const n = normalizeSeedInput(
    {
      fullName: c.fullName,
      email: c.email,
      company: c.company,
      jobTitle: c.jobTitle,
      professionalRole: c.professionalRole,
      linkedinUrl: c.linkedinUrl || '',
      websiteUrl: c.websiteUrl || '',
      location: c.location || '',
      country: c.country || '',
      blurb: c.blurb || '',
      notes: c.notes || '',
      source: 'rosie',
      status: 'active',
    },
    { partial: false }
  );
  assert(n.ok, 'valid: ' + c.fullName + ' ' + JSON.stringify(n.errors || {}));
  assert(!emails.has(n.fields.email), 'unique ' + n.fields.email);
  emails.add(n.fields.email);
  assert(!/https?:\/\//i.test(c.location || ''), 'no url in location ' + c.fullName);
  assert(!/\[[^\]]+\]/.test(c.location || ''), 'no bracket junk in location ' + c.fullName);
  assert(!/\.xlsx/i.test((c.location || '') + (c.blurb || '') + (c.company || '')), 'no xlsx junk ' + c.fullName);
  assert(c.country, 'country ' + c.fullName);
  assert(!/linkedin\.com/i.test(c.websiteUrl || ''), 'linkedin not stored as website ' + c.fullName);
});

assert(emails.has('daisym@tlmew.org.uk'), 'Daisy Mansfield');
assert(emails.has('eve@mhfc.co.uk'), 'Eve Wallbank');
const daisy = batch.contacts.find((c) => c.fullName === 'Daisy Mansfield');
assert(daisy && daisy.jobTitle === 'Community Partnerships Manager', 'Daisy job title healed');
assert(daisy && daisy.location === 'Peterborough', 'Daisy location cleaned');
const dale = batch.contacts.find((c) => c.fullName === 'Dale Waring');
assert(dale && /linkedin\.com\/in\/dale-waring/i.test(dale.linkedinUrl), 'Dale linkedin from company domain');
assert(dale && !dale.websiteUrl, 'Dale has no website when only LinkedIn was supplied');
const damien = batch.contacts.find((c) => c.fullName === 'Damien Gould');
assert(damien && damien.location === 'Solihull, West Midlands', 'Damien location cleaned');
const wilson = batch.contacts.find((c) => c.fullName === 'Damien Wilson');
assert(wilson && wilson.location === '' && wilson.country === 'United Kingdom', 'blank location keeps country');
const wickens = batch.contacts.find((c) => c.fullName === 'Daniel Wickens');
assert(wickens && wickens.phone === '0330 174 3181 / 07519 328384', 'both phone numbers kept');
const evolve = batch.contacts.find((c) => c.fullName === 'David Krushell');
assert(evolve && evolve.company === 'Evolve Your Digital', 'company typo healed');
const mau = batch.contacts.find((c) => c.fullName === 'Dennis Mau');
assert(mau && mau.company === 'Mau Investments' && /Mau Investments/.test(mau.blurb), 'Mau company healed');
const dhruv = batch.contacts.find((c) => c.fullName === 'Dhruv Naker');
assert(dhruv && /manufacturing\.$/.test(dhruv.blurb), 'truncated blurb completed');
const eleri = batch.contacts.find((c) => c.fullName === 'Eleri Haf Cosslett');
assert(eleri && eleri.location === 'Wales', 'Wales kept as location');
const eve = batch.contacts.find((c) => c.fullName === 'Eve Wallbank');
assert(eve && eve.email === 'eve@mhfc.co.uk', 'Eve email from cell not stale hyperlink');
console.log('ok — tina seed ds-and-es batch (' + batch.contacts.length + ')');
