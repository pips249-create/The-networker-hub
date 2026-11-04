#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-as-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 112, '112 contacts');
const emails = new Set();
let withCountry = 0;
let withWebsite = 0;
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
  if (c.country) withCountry += 1;
  if (c.websiteUrl) withWebsite += 1;
});
assert(emails.has('adam@nexusmarketing.co.uk'), 'Adam Guttridge');
assert(emails.has('azimiqbal84@gmail.com'), 'Azim Iqbal');
const renwick = batch.contacts.find((c) => /renwick/i.test(c.fullName));
assert(renwick && renwick.country === 'Switzerland', 'Renwick Switzerland');
assert(withCountry === 112, 'all have country');
assert(withWebsite >= 80, 'most have company page');
console.log('ok — tina seed as batch (' + batch.contacts.length + ', country ' + withCountry + ', website ' + withWebsite + ')');
