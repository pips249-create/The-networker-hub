#!/usr/bin/env node
/**
 * Email 3 — optional-help follow-up for Email 2 openers.
 *
 * Usage:
 *   node scripts/build-email3-call-followup.js
 *
 * Outputs:
 *   data/email3-brevo-ready.html
 *   data/email3-brevo-preview.html
 *   data/Segment-A-Email3-openers-Brevo-import.csv
 *   data/Segment-A-Email3-call-sheet.csv
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { previewClaimUrl } = require('../api/_lib/organiser-claim-url');
const { isExcludedLaunchOrganiser } = require('./launch-excluded-organisers');

const SITE = 'https://www.thenetworkerhub.com';
const LEGACY = 'https://the-networker.co.uk';
const BOOK_CALL = 'https://savvycal.com/TheNetworkerHub/website-preview';

/** Segment A Email 2 openers (Brevo, 19 Aug 2026). */
const SEGMENT_A_OPENERS = [
  'support@batleyentrepreneurshipclub.com',
  'info@dublcheckcleaning.co.uk',
  'info@agcc.co.uk',
  'enquiries@fieldtrainingservices.co.uk',
  'cassie@cfatax.co.uk',
  'brendan@ghostconsultancy.com',
  'alanacaresolutions@gmail.com',
  'jason@pocketbox.co.uk',
  'adam@advantageinvestment.co.uk',
  'dawnadlam@bni.com',
  'simon@bni.com',
  'paul.lawton@business-matching.co.uk',
  'charlie@bniglasgowsl.com',
  'shal@virtuallythere.co',
  'jim@printlord.co.uk',
  'website@birmingham-chamber.com',
  'support@1networking.biz',
  'president@asb-scotland.org',
  'natalie@whitcombehr.co.uk',
  'info@chamber-business.com',
  'info@brchamber.co.uk',
  'info@berkshiremummies.co.uk',
  'info@b4-business.com',
  'avbn@ambervalley-business-networking.co.uk',
  'support@afvbc.com',
  'brianmorrison.glasgow@gmail.com',
  'brian@bbnetworking.co.uk',
  'admin@bswn.org.uk',
  'info@berkshiregrowthhub.co.uk',
];

const LOOKUP_ALIASES = {
  'shal@virtuallythere.co': 'shai@virtuallythere.co',
};

/** Openers who are not on the latest Email 2 rebuild (e.g. marked claimed). */
const FALLBACK_ROWS = {
  'natalie@whitcombehr.co.uk': {
    name: 'BITA - Kent',
    otherNote: '',
    slug: 'bita-kent',
  },
};

function esc(v) {
  return '"' + String(v || '').replace(/"/g, '""') + '"';
}

function fillTemplate(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(v);
  }
  return out;
}

function parseEmail2Csv(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean).slice(1);
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^([^,]+),("([^"]*)"|[^,]*),("([^"]*)"|[^,]*),("([^"]*)"|.*)$/);
    if (!m) continue;
    const email = m[1].trim().toLowerCase();
    const name = (m[3] != null ? m[3] : m[2] || '').replace(/""/g, '"');
    const other = (m[5] != null ? m[5] : m[4] || '').replace(/""/g, '"');
    const claim = (m[7] != null ? m[7] : m[6] || '').replace(/""/g, '"');
    const slugMatch = String(claim).match(/\/organisers\/([^?]+)/);
    map.set(email, {
      email,
      name,
      otherNote: other,
      slug: slugMatch ? decodeURIComponent(slugMatch[1]) : '',
    });
  }
  return map;
}

function phoneIndex() {
  const p = path.join(root, 'data/networking-groups-organisers.csv');
  const map = new Map();
  if (!fs.existsSync(p)) return map;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).slice(1);
  for (const line of lines) {
    const cols = line.split(',');
    const email = String(cols[0] || '')
      .trim()
      .toLowerCase();
    const phone = String(cols[2] || '').trim();
    if (email.includes('@') && phone) map.set(email, phone);
  }
  return map;
}

(async () => {
  const template = fs.readFileSync(
    path.join(root, 'email-templates/organiser-call-followup.html'),
    'utf8'
  );

  const previewClaim =
    SITE +
    '/organisers/121-business-links?email=chris%40121businesslinks.co.uk&intent=organiser-claim&auth=register&next=' +
    encodeURIComponent('/organiser/?onboard=claim');

  const shared = {
    site_url: SITE,
    legacy_site_url: LEGACY,
    logo_url: SITE + '/assets/logo-nav-transparent.png?v=20260729a',
    logo_footer_url: SITE + '/assets/logo-email-footer.png',
    for_organisers_url: SITE + '/for-organisers',
    claim_url: previewClaim,
    book_call_url: BOOK_CALL,
    company_name: 'The Networker Group Ltd',
    company_number: '15252227',
    support_email: 'catherine@thenetworkerhub.com',
    privacy_url: SITE + '/legal-policies#privacy',
    terms_url: SITE + '/legal-policies#terms',
    refunds_url: SITE + '/legal-policies#refunds',
    contact_url: SITE + '/contact',
    add_event_url: SITE + '/add-your-event',
    unsubscribe_url: SITE + '/account/settings#email-preferences',
  };

  const html = fillTemplate(template, {
    ...shared,
    group_name: '121 Business Links',
    other_groups_note: '',
  });

  const ready = fillTemplate(template, {
    ...shared,
    group_name: '{{ contact.ORGANISER_NAME | default: "your organiser page" }}',
    other_groups_note: '{{ contact.OTHER_GROUPS_NOTE | default: "" }}',
    claim_url: "{{ contact.CLAIM_URL | default: '" + shared.claim_url + "' }}",
  });

  fs.writeFileSync(path.join(root, 'data/email3-brevo-ready.html'), ready);
  fs.writeFileSync(path.join(root, 'data/email3-brevo-preview.html'), html);
  console.log('Wrote data/email3-brevo-ready.html');
  console.log('Wrote data/email3-brevo-preview.html');

  const byEmail = parseEmail2Csv('data/Segment-A-Email2-Brevo-import.csv');
  const phones = phoneIndex();
  const skipped = [];
  const rows = [];

  for (const raw of SEGMENT_A_OPENERS) {
    const email = raw.trim().toLowerCase();
    const lookupEmail = LOOKUP_ALIASES[email] || email;
    const rec =
      byEmail.get(lookupEmail) || byEmail.get(email) || FALLBACK_ROWS[email] || null;
    if (!rec) {
      skipped.push({ email, reason: 'not on Segment A import' });
      continue;
    }
    if (isExcludedLaunchOrganiser({ email, slug: rec.slug, name: rec.name })) {
      skipped.push({ email, reason: 'excluded (unsub / do-not-mail)', name: rec.name });
      continue;
    }
    const claimUrl = previewClaimUrl(SITE, email, 'register', rec.slug);
    rows.push({
      email,
      name: rec.name,
      otherNote: rec.otherNote,
      claimUrl,
      phone: phones.get(email) || phones.get(lookupEmail) || '',
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));

  const bom = '\uFEFF';
  const csv =
    bom +
    'Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL\n' +
    rows
      .map((r) => r.email + ',' + esc(r.name) + ',' + esc(r.otherNote) + ',' + esc(r.claimUrl))
      .join('\n') +
    '\n';
  fs.writeFileSync(path.join(root, 'data/Segment-A-Email3-openers-Brevo-import.csv'), csv);

  const sheet =
    bom +
    'Organiser name,Email,Phone,CLAIM_URL,Notes\n' +
    rows
      .map(
        (r) =>
          esc(r.name) +
          ',' +
          r.email +
          ',' +
          esc(r.phone) +
          ',' +
          esc(r.claimUrl) +
          ',' +
          esc(r.otherNote)
      )
      .join('\n') +
    '\n';
  fs.writeFileSync(path.join(root, 'data/Segment-A-Email3-call-sheet.csv'), sheet);

  console.log('Wrote data/Segment-A-Email3-openers-Brevo-import.csv');
  console.log('Wrote data/Segment-A-Email3-call-sheet.csv');
  console.log('Openers on screenshot:', SEGMENT_A_OPENERS.length);
  console.log('To mail / call:', rows.length);
  if (skipped.length) {
    console.log('Skipped:');
    skipped.forEach((s) => console.log('  -', s.email, s.reason, s.name || ''));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
