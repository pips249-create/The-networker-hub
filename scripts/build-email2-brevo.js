#!/usr/bin/env node
/**
 * Build Email 2 HTML for Brevo + personal claim-link import CSV from Segment A.
 *
 * Usage:
 *   node scripts/build-email2-brevo.js
 *
 * Outputs:
 *   data/email2-brevo-ready.html
 *   data/email2-brevo-preview.html
 *   data/Segment-A-Email2-Brevo-import.csv  (Email, Organiser name, CLAIM_URL)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin } = require('../api/_lib/supabase');
const { resolveOrganiserClaimUrl, previewClaimUrl } = require('../api/_lib/organiser-claim-url');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');
const { publicOrganiserSlug } = require('../api/_lib/organiser-slug');
const { buildEmail2SponsorRowHtml } = require('../api/_lib/email2-sponsor');

const SITE = 'https://www.thenetworkeruk.com';
const LEGACY = 'https://the-networker.co.uk';

/** Email 2 uses My Medical Cover — Barnsgate declined sponsorship. */
async function buildEmail2SponsorRow() {
  const html = await buildEmail2SponsorRowHtml(SITE);
  if (!html) {
    console.warn('Sponsor banner: My Medical Cover markup empty');
    return '';
  }
  console.log('Sponsor banner: My Medical Cover');
  return html;
}

const { isExcludedLaunchOrganiser } = require('./launch-excluded-organisers');

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hello@thenetworkeruk.com',
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
]);

function isInternalTest(name, email) {
  if (SKIP_EMAILS.has(email)) return true;
  if (isExcludedLaunchOrganiser({ email, name })) return true;
  if (/pip'?s test|testing category|rosie posy|the networker hub$/i.test(name || '')) return true;
  return false;
}

function isExhibition(name) {
  return /exhibition|trade show|\bsummit\b|\bexpo\b|festival|awards night/i.test(name || '');
}

function esc(v) {
  return '"' + String(v || '').replace(/"/g, '""') + '"';
}

function check(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'TNH-email2-link-check' } }, (res) => {
        resolve({ status: res.statusCode, loc: res.headers.location || '' });
        res.resume();
      })
      .on('error', (e) => resolve({ status: 'ERR', error: e.message }));
  });
}

async function fetchAllOrganisers(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, contact_email, email, listing_status, verification_status, ownership_claim_status'
      )
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Emails that have actually signed in (know their password). Silent imports do not count. */
async function signedInAccountEmails(sb) {
  const emails = new Set();
  let page = 1;
  const perPage = 1000;
  while (page <= 50) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('auth.admin.listUsers failed — will resolve claim URLs individually:', error.message);
      return null;
    }
    (list.users || []).forEach((u) => {
      const e = String(u.email || '')
        .trim()
        .toLowerCase();
      if (e && u.last_sign_in_at) emails.add(e);
    });
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

function claimUrlFor(email, hasAccount, slug) {
  // Email 2 always opens sign-up first; existing users use “Already have an account?” on register.
  return previewClaimUrl(SITE, email, 'register', slug);
}

function otherGroupsNote(extraGroups) {
  if (!extraGroups.length) return '';
  if (extraGroups.length === 1) return ', plus ' + extraGroups[0];
  if (extraGroups.length === 2) return ', plus ' + extraGroups[0] + ' and ' + extraGroups[1];
  return (
    ', plus ' +
    extraGroups.slice(0, -1).join(', ') +
    ', and ' +
    extraGroups[extraGroups.length - 1]
  );
}

function fillTemplate(template, vars) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(v);
  }
  return out;
}

(async () => {
  const template = fs.readFileSync(
    path.join(root, 'email-templates/organiser-launch-invite.html'),
    'utf8'
  );

  const sponsorRow = await buildEmail2SponsorRow();

  const previewClaim =
    SITE +
    '/organisers/121-business-links?email=chris%40121businesslinks.co.uk&intent=organiser-claim&auth=register&next=' +
    encodeURIComponent('/organiser/?onboard=claim');

  const shared = {
    site_url: SITE,
    legacy_site_url: LEGACY,
    logo_url: SITE + '/assets/logo-nav-transparent.png?v=20260823ukpng',
    logo_footer_url: SITE + '/assets/logo-nav-transparent.png?v=20260823ukpng',
    for_organisers_url: SITE + '/for-organisers',
    claim_url: previewClaim,
    company_name: 'The Networker Group Ltd',
    company_number: '15252227',
    support_email: 'catherine@thenetworkeruk.com',
    privacy_url: SITE + '/legal-policies#privacy',
    terms_url: SITE + '/legal-policies#terms',
    refunds_url: SITE + '/legal-policies#refunds',
    contact_url: SITE + '/contact',
    add_event_url: SITE + '/add-your-event',
    unsubscribe_url: '{{ unsubscribe }}',
    sponsor_row: sponsorRow,
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
    // Single quotes inside default so nested " in href="…" don't break Brevo / HTML parsing.
    claim_url: "{{ contact.CLAIM_URL | default: '" + shared.claim_url + "' }}",
  });

  fs.writeFileSync(path.join(root, 'data/email2-brevo-ready.html'), ready);
  fs.writeFileSync(path.join(root, 'data/email2-brevo-preview.html'), html);
  console.log('Wrote data/email2-brevo-ready.html');
  console.log('Wrote data/email2-brevo-preview.html');

  const leftover = ready.match(/\{\{[a-z_]+\}\}/g);
  console.log('Leftover {{token}} (should be none):', leftover || 'none');

  // Build Segment A claim CSV
  const sb = getSupabaseAdmin();
  const organisers = await fetchAllOrganisers(sb);
  const accountEmails = await signedInAccountEmails(sb);

  const byEmail = new Map();
  for (const r of organisers) {
    const email = String(r.contact_email || r.email || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) continue;
    if (isExhibition(r.name)) continue;
    if (isInternalTest(r.name, email)) continue;
    if (!isPublicOrganiser(r)) continue;
    const name = String(r.name || '').trim();
    const slug = publicOrganiserSlug(r) || '';
    if (isExcludedLaunchOrganiser({ email, slug, name })) continue;
    if (String(r.ownership_claim_status || '').toLowerCase() === 'claimed') continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, groups: [] });
    }
    if (name) byEmail.get(email).groups.push({ name, slug });
  }

  const rows = [];
  for (const r of byEmail.values()) {
    const groups = [...r.groups]
      .filter((g, i, arr) => arr.findIndex((x) => x.name === g.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));
    const primarySlug = (groups.find((g) => g.slug) || {}).slug || '';
    let url;
    if (accountEmails) {
      url = claimUrlFor(r.email, accountEmails.has(r.email), primarySlug);
    } else {
      url = await resolveOrganiserClaimUrl(r.email, SITE, primarySlug);
    }
    rows.push({
      email: r.email,
      name: (groups[0] && groups[0].name) || r.email,
      otherNote: otherGroupsNote(groups.slice(1).map((g) => g.name)),
      claimUrl: url,
      hasAccount: accountEmails ? accountEmails.has(r.email) : null,
      slug: primarySlug,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }));

  const bom = '\uFEFF';
  const csv =
    bom +
    'Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL\n' +
    rows
      .map(
        (r) =>
          r.email + ',' + esc(r.name) + ',' + esc(r.otherNote) + ',' + esc(r.claimUrl)
      )
      .join('\n') +
    '\n';
  fs.writeFileSync(path.join(root, 'data/Segment-A-Email2-Brevo-import.csv'), csv);
  console.log('Wrote data/Segment-A-Email2-Brevo-import.csv');
  console.log('Recipients:', rows.length);
  console.log('With extra group pages:', rows.filter((r) => r.otherNote).length);
  console.log('Path B (organiser slug URL):', rows.filter((r) => r.slug).length);
  console.log('Soft path A fallback (no slug):', rows.filter((r) => !r.slug).length);
  if (accountEmails) {
    console.log('Already signed in (login link):', rows.filter((r) => r.hasAccount).length);
    console.log('Need register / set-password link:', rows.filter((r) => !r.hasAccount).length);
  }

  function emailsFromCsv(file) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) return [];
    return fs
      .readFileSync(p, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .slice(1)
      .map((line) => String(line.split(',')[0] || '').trim().toLowerCase())
      .filter((e) => e.includes('@'));
  }

  const sent = new Set([
    ...emailsFromCsv('data/Segment-A-Email2-1st-100-Brevo-import.csv'),
    ...emailsFromCsv('data/Segment-A-Email2-2nd-100-Brevo-import.csv'),
    ...emailsFromCsv('data/Segment-C-Email2-100-Brevo-import.csv'),
    ...emailsFromCsv('data/Segment-D-Email2-100-Brevo-import.csv'),
  ]);
  const remaining = rows.filter((r) => !sent.has(r.email));
  const remainingCsv =
    bom +
    'Email,Organiser name,OTHER_GROUPS_NOTE,CLAIM_URL\n' +
    remaining
      .map(
        (r) =>
          r.email + ',' + esc(r.name) + ',' + esc(r.otherNote) + ',' + esc(r.claimUrl)
      )
      .join('\n') +
    '\n';
  fs.writeFileSync(path.join(root, 'data/Segment-E-Email2-Brevo-import.csv'), remainingCsv);
  console.log('Wrote data/Segment-E-Email2-Brevo-import.csv');
  console.log('Already sent (batches 1–4):', sent.size);
  console.log('Remaining recipients:', remaining.length);
  const leftoverUnsubs = remaining.filter((r) =>
    [
      'suzy@uniqueladies.co.uk',
      'ian@shoutnetwork.co.uk',
      'admin@thinklikeatree.co.uk',
      'p.heathcote@theyorkshiresociety.og',
      'sarah@thinklikeatree.co.uk',
    ].includes(r.email)
  );
  if (leftoverUnsubs.length) {
    console.warn('UNSUB STILL IN REMAINING:', leftoverUnsubs.map((r) => r.email).join(', '));
  }

  const hrefs = [
    ...new Set([...html.matchAll(/href="(https:[^"]+)"/g)].map((m) => m[1])),
  ].filter((u) => !u.includes('{{'));
  console.log('\nLink check:');
  for (const u of hrefs) {
    const r = await check(u);
    const gated = r.status === 302 && String(r.loc).includes('site-access');
    const ok = (r.status === 200 || r.status === 302) && !gated;
    console.log((ok ? 'OK' : '!!'), String(r.status).padEnd(4), u, gated ? '(GATED)' : '');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
