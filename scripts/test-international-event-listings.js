#!/usr/bin/env node
const assert = require('assert');
const {
  normalizeInput,
  validateInput,
  normalizeLocalTime,
  isMissingInternationalEventListingsTable,
  isOutdatedInternationalEventListingsSchema,
} = require('../api/_lib/international-event-listings');

const base = {
  title: 'Dublin Founders Breakfast',
  startsOn: '2026-11-12',
  city: 'Dublin',
  countryCode: 'IE',
  countryName: 'Ireland',
  organiserName: 'Dublin Business Network',
  organiserWebsite: 'https://example.com',
  externalUrl: 'https://example.com/book',
  email: 'alex@example.com',
};

assert.strictEqual(validateInput(normalizeInput(base)).ok, true);
assert.strictEqual(validateInput(normalizeInput({ ...base, name: '' })).ok, true);
assert.strictEqual(
  validateInput(normalizeInput({ ...base, startsAtLocal: '09:30', imageUrl: 'https://cdn.example.com/a.jpg' })).ok,
  true
);

assert.strictEqual(normalizeLocalTime('9:30'), '09:30:00');
assert.strictEqual(normalizeLocalTime('09:30:15'), '09:30:15');
assert.strictEqual(normalizeLocalTime('25:00'), null);

const honeypot = validateInput(normalizeInput({ ...base, website_hp: 'bot' }));
assert.strictEqual(honeypot.ok, true);
assert.strictEqual(honeypot.honeypot, true);

const uk = validateInput(normalizeInput({ ...base, countryCode: 'GB', countryName: 'United Kingdom' }));
assert.strictEqual(uk.ok, false);
assert.strictEqual(uk.error, 'use_uk_site');

const badUrl = validateInput(normalizeInput({ ...base, externalUrl: 'ftp://example.com' }));
assert.strictEqual(badUrl.ok, false);
assert.strictEqual(badUrl.error, 'invalid_url');

const missingOrg = validateInput(normalizeInput({ ...base, organiserName: '' }));
assert.strictEqual(missingOrg.ok, false);
assert.strictEqual(missingOrg.error, 'missing_organiser');

const badOrgSite = validateInput(
  normalizeInput({ ...base, organiserWebsite: 'not-a-url' })
);
assert.strictEqual(badOrgSite.ok, false);
assert.strictEqual(badOrgSite.error, 'invalid_organiser_website');

const badTime = validateInput(normalizeInput({ ...base, startsAtLocal: 'not-a-time' }));
assert.strictEqual(badTime.ok, false);
assert.strictEqual(badTime.error, 'invalid_time');

const badImage = validateInput(normalizeInput({ ...base, imageUrl: 'ftp://x.com/a.jpg' }));
assert.strictEqual(badImage.ok, false);
assert.strictEqual(badImage.error, 'invalid_image_url');

const noOrgSite = validateInput(normalizeInput({ ...base, organiserWebsite: '' }));
assert.strictEqual(noOrgSite.ok, true);

const endBeforeStart = validateInput(
  normalizeInput({ ...base, startsOn: '2026-11-12', endsOn: '2026-11-10' })
);
assert.strictEqual(endBeforeStart.ok, false);
assert.strictEqual(endBeforeStart.error, 'invalid_end_date');

const unavailable = validateInput(
  normalizeInput({ ...base, countryCode: 'RU', countryName: 'Russia' })
);
assert.strictEqual(unavailable.ok, false);
assert.strictEqual(unavailable.error, 'country_unavailable');

const staffSource = normalizeInput({ ...base, source: 'admin_staff' });
assert.strictEqual(staffSource.source, 'admin_staff');
assert.strictEqual(validateInput(staffSource).ok, true);

const withDesc = normalizeInput({
  ...base,
  description: '  Morning networking for founders.  ',
});
assert.strictEqual(withDesc.description, 'Morning networking for founders.');
assert.strictEqual(validateInput(withDesc).ok, true);
assert.strictEqual(normalizeInput({ ...base, description: '' }).description, null);

// Missing-table detection must be narrow — table name alone is not enough.
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message: "Could not find the table 'public.international_event_listings' in the schema cache",
    code: 'PGRST205',
  }),
  true
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message: 'relation "public.international_event_listings" does not exist',
    code: '42P01',
  }),
  true
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message:
      "Could not find the 'ends_on' column of 'international_event_listings' in the schema cache",
    code: 'PGRST204',
  }),
  false,
  'column-missing must not look like table-missing'
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message: 'permission denied for table international_event_listings',
  }),
  false
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message:
      'new row violates row-level security policy for table "international_event_listings"',
  }),
  false
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message: 'insert or update on table "international_event_listings" violates check constraint',
  }),
  false
);
assert.strictEqual(
  isMissingInternationalEventListingsTable({
    message: 'JWT expired',
  }),
  false
);

// Outdated schema: table exists, organiser columns from rewritten 324 are missing.
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message: 'column international_event_listings.organiser_name does not exist',
    code: '42703',
  }),
  true
);
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message:
      "Could not find the 'organiser_website' column of 'international_event_listings' in the schema cache",
    code: 'PGRST204',
  }),
  true
);
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message:
      "Could not find the 'starts_at_local' column of 'international_event_listings' in the schema cache",
    code: 'PGRST204',
  }),
  true
);
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message: "Could not find the table 'public.international_event_listings' in the schema cache",
    code: 'PGRST205',
  }),
  false,
  'table-missing must not look like schema-outdated'
);
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message:
      "Could not find the 'ends_on' column of 'international_event_listings' in the schema cache",
    code: 'PGRST204',
  }),
  false,
  'unrelated missing columns are not treated as organiser-schema outdated'
);
assert.strictEqual(
  isOutdatedInternationalEventListingsSchema({
    message: 'permission denied for table international_event_listings',
  }),
  false
);

console.log('test-international-event-listings: ok');
