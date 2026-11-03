#!/usr/bin/env node
/**
 * Validates the Us–Zs TINA seed batch JSON (no DB).
 */
const fs = require('fs');
const path = require('path');
const { normalizeSeedInput } = require('../api/_lib/hubert-match-seed');

const file = path.join(__dirname, '../data/tina-seed-us-to-zs-batch-2026-11.json');
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(Array.isArray(batch.contacts) && batch.contacts.length === 27, '27 contacts');

const emails = new Set();
let withBlurb = 0;
let withLinkedIn = 0;
let withWebsite = 0;
let withLocation = 0;
let withCountry = 0;
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
  assert(n.ok, 'valid row: ' + c.fullName + ' ' + JSON.stringify(n.errors || {}));
  assert(n.fields.email, 'email required: ' + c.fullName);
  assert(!emails.has(n.fields.email), 'unique email: ' + n.fields.email);
  emails.add(n.fields.email);
  if (c.blurb) withBlurb += 1;
  if (c.linkedinUrl) withLinkedIn += 1;
  if (c.websiteUrl) withWebsite += 1;
  if (c.location) withLocation += 1;
  if (c.country) withCountry += 1;
});

assert(emails.has('usman@ansar.london'), 'Usman present');
assert(emails.has('tim@professionalpointer.com'), 'Tim present');
const tim = batch.contacts.find((c) => c.email === 'tim@professionalpointer.com');
assert(tim && tim.country === 'South Africa', 'Tim country SA');
assert(withBlurb >= 20, 'most rows have blurbs');
assert(withLocation >= 15, 'most rows have location');
assert(withCountry === 27, 'all rows have country');
assert(withWebsite >= 15, 'most rows have company page');

console.log(
  'ok — tina seed us-to-zs batch (' +
    batch.contacts.length +
    ', blurbs ' +
    withBlurb +
    ', linkedin ' +
    withLinkedIn +
    ', website ' +
    withWebsite +
    ', location ' +
    withLocation +
    ', country ' +
    withCountry +
    ')'
);
