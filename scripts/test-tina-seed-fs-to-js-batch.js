#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-fs-to-js-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/358_tina_seed_fs_to_js_batch.sql'),
  'utf8'
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 208, '208 contacts');
assert(!/Fs to Js\.xlsx/i.test(JSON.stringify(batch)), 'json has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(JSON.stringify(batch)), 'json has no Book.xlsx junk');
assert(!/Excel\]/.test(JSON.stringify(batch)), 'json has no Excel] junk');
assert(!/Fs to Js\.xlsx/i.test(sql), 'sql has no xlsx junk');
assert(!/Book\d*\.xlsx/i.test(sql), 'sql has no Book.xlsx junk');
assert(!/Excel\]/.test(sql), 'sql has no Excel] junk');

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
});

assert(emails.has('faith.mills@learnmoreuk.com'), 'Faith Mills');
assert(emails.has('heatherjbartsch@gmail.com'), 'Heather Bartsch');
const heather = batch.contacts.find((c) => c.fullName === 'Heather Bartsch');
assert(heather && heather.jobTitle === 'Celebrant', 'Heather job healed from misaligned row');
assert(heather && heather.location === 'United Kingdom', 'Heather location cleaned');
assert(heather && heather.company === 'Your Choice Ceremonies', 'Heather company clean');
const fatima = batch.contacts.find((c) => c.fullName === 'Fatima Mirzai');
assert(fatima && !/Book1|Excel\]/.test(fatima.blurb || ''), 'Fatima blurb stripped');
console.log('ok — tina seed fs-to-js batch (' + batch.contacts.length + ', hyperlinks/xlsx junk stripped)');
