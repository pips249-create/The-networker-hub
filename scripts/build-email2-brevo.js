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
const { resolveOrganiserClaimUrl } = require('../api/_lib/organiser-claim-url');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');

const SITE = 'https://www.thenetworkerhub.com';
const LEGACY = 'https://the-networker.co.uk';

const SKIP_EMAILS = new Set([
  'pips249@gmail.com',
  'hello@thenetworkerhub.com',
  'catherine@thenetworkerhub.com',
  'rosie@thenetworkerhub.com',
]);

function isInternalTest(name, email) {
  if (SKIP_EMAILS.has(email)) return true;
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
      .select('id, name, slug, contact_email, email, listing_status, verification_status')
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

async function existingAccountEmails(sb) {
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
      if (e) emails.add(e);
    });
    if (!list.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

function claimUrlFor(email, hasAccount) {
  const em = encodeURIComponent(email);
  const next = encodeURIComponent('/organiser/?onboard=claim');
  const intent = 'organiser-claim';
  if (hasAccount) {
    return SITE + '/login?email=' + em + '&next=' + next + '&intent=' + intent;
  }
  return SITE + '/register?email=' + em + '&next=' + next + '&intent=' + intent;
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

  const shared = {
    site_url: SITE,
    legacy_site_url: LEGACY,
    logo_url: SITE + '/assets/logo-nav-transparent.png?v=20260729a',
    logo_footer_url: SITE + '/assets/logo-email-footer.png',
    for_organisers_url: SITE + '/for-organisers',
    claim_url: SITE + '/register?intent=organiser-claim&next=' + encodeURIComponent('/organiser/?onboard=claim'),
    company_name: 'The Networker Group Ltd',
    company_number: '15252227',
    support_email: 'catherine@thenetworkerhub.com',
    privacy_url: SITE + '/legal-policies#privacy',
    terms_url: SITE + '/legal-policies#terms',
    refunds_url: SITE + '/legal-policies#refunds',
    contact_url: SITE + '/contact',
    unsubscribe_url: '{{ unsubscribe }}',
    sponsor_row: '',
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
    claim_url: '{{ contact.CLAIM_URL | default: "' + shared.claim_url + '" }}',
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
  const accountEmails = await existingAccountEmails(sb);

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
    if (!byEmail.has(email)) {
      byEmail.set(email, { email, groups: [] });
    }
    if (name) byEmail.get(email).groups.push(name);
  }

  const rows = [];
  for (const r of byEmail.values()) {
    const groups = [...new Set(r.groups)].sort((a, b) =>
      a.localeCompare(b, 'en-GB', { sensitivity: 'base' })
    );
    let url;
    if (accountEmails) {
      url = claimUrlFor(r.email, accountEmails.has(r.email));
    } else {
      url = await resolveOrganiserClaimUrl(r.email, SITE);
    }
    rows.push({
      email: r.email,
      name: groups[0] || r.email,
      otherNote: otherGroupsNote(groups.slice(1)),
      claimUrl: url,
      hasAccount: accountEmails ? accountEmails.has(r.email) : null,
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
  if (accountEmails) {
    console.log('Already have Hub accounts:', rows.filter((r) => r.hasAccount).length);
    console.log('Need register link:', rows.filter((r) => !r.hasAccount).length);
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
