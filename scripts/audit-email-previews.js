#!/usr/bin/env node
/**
 * Audit all email templates: preview build, unresolved placeholders, sponsor slots.
 * Run: node scripts/audit-email-previews.js
 */
const fs = require('fs');
const path = require('path');
const { BRANDED_EMAIL_TEMPLATES, getBrandedEmailSubject } = require('../api/_lib/branded-email-templates');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const {
  EVENT_MAIN_SPONSOR_SLUGS,
  EVENT_MINI_SPONSOR_SLUGS,
  ORGANISER_EMAIL_SLUGS,
  OPPORTUNITY_EMAIL_SLUGS,
  ORGANISER_MINI_SPONSOR_SLUGS,
  OPPORTUNITY_MINI_SPONSOR_SLUGS,
  HUB_PARTNER_SPONSOR_SLUGS,
} = require('../api/_lib/email-sponsor-sections');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Removed in later migrations — not active templates. */
const RETIRED_EMAIL_SLUGS = new Set(['hub_newsletter']);

function collectSlugsFromMigrations() {
  const dir = path.join(__dirname, '../supabase/migrations');
  const slugs = new Set();
  const insertRe = /insert into public\.email_templates[\s\S]*?values\s*\(\s*'([a-z0-9_]+)'/gi;
  const deleteRe = /delete from public\.email_templates[\s\S]*?where slug = '([a-z0-9_]+)'/gi;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.sql')) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    let m;
    while ((m = insertRe.exec(text))) {
      slugs.add(m[1]);
    }
    while ((m = deleteRe.exec(text))) {
      slugs.delete(m[1]);
      RETIRED_EMAIL_SLUGS.add(m[1]);
    }
  }
  Object.keys(BRANDED_EMAIL_TEMPLATES).forEach((s) => slugs.add(s));
  [
    'booking_confirmation',
    'booking_reminder',
    'organiser_new_registration',
    'organiser_new_application',
    'application_received',
    'application_approved',
    'application_denied',
    'organiser_booking_cancelled',
    'booking_cancelled',
    'event_cancelled',
    'refund_processed',
    'organiser_ranking_badge',
    'organiser_monthly_group_update',
    'event_connections_list',
  ].forEach((s) => slugs.add(s));
  RETIRED_EMAIL_SLUGS.forEach((s) => slugs.delete(s));
  return [...slugs].sort();
}

function sponsorExpectation(slug) {
  const main =
    EVENT_MAIN_SPONSOR_SLUGS.has(slug) ||
    ORGANISER_EMAIL_SLUGS.has(slug) ||
    OPPORTUNITY_EMAIL_SLUGS.has(slug);
  const mini =
    EVENT_MINI_SPONSOR_SLUGS.has(slug) ||
    ORGANISER_MINI_SPONSOR_SLUGS.has(slug) ||
    OPPORTUNITY_MINI_SPONSOR_SLUGS.has(slug) ||
    HUB_PARTNER_SPONSOR_SLUGS.has(slug);
  return { main, mini, any: main || mini };
}

const emailTplModule = require('../api/_lib/supabase-email-templates');

/** Offline audit: stub DB rows so branded/file templates resolve without Supabase. */
emailTplModule.getEmailTemplateBySlug = async function mockGetEmailTemplateBySlug(slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  let subject = '{{event_name}}';
  try {
    const branded = getBrandedEmailSubject(key);
    if (branded) subject = branded;
  } catch {
    /* ignore */
  }
  return {
    id: 'audit',
    slug: key,
    name: key,
    description: '',
    category: 'events',
    subject,
    body_html: '<p>stub — file template</p>',
    placeholders: [],
  };
};

const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');

async function auditSlug(slug) {
  const vars = mergeEmailPreviewVariables(slug, {});
  try {
    const built = await buildEmailFromTemplate(slug, vars);
    const unresolved = new Set();
    let m;
    PLACEHOLDER_RE.lastIndex = 0;
    while ((m = PLACEHOLDER_RE.exec(built.html))) unresolved.add(m[1]);
    PLACEHOLDER_RE.lastIndex = 0;
    while ((m = PLACEHOLDER_RE.exec(built.subject))) unresolved.add(m[1]);

    const html = built.html;
    const hasMainSponsor =
      /Powered by/i.test(html) ||
      (EVENT_MAIN_SPONSOR_SLUGS.has(slug) === false &&
        ORGANISER_EMAIL_SLUGS.has(slug) === false &&
        OPPORTUNITY_EMAIL_SLUGS.has(slug) === false);
    const hasMiniSponsor =
      html.includes('mini-sponsor-cell') ||
      (EVENT_MINI_SPONSOR_SLUGS.has(slug) === false &&
        ORGANISER_MINI_SPONSOR_SLUGS.has(slug) === false &&
        OPPORTUNITY_MINI_SPONSOR_SLUGS.has(slug) === false &&
        HUB_PARTNER_SPONSOR_SLUGS.has(slug) === false);

    const expect = sponsorExpectation(slug);
    const sponsorIssues = [];
    if (expect.main && !hasMainSponsor && /Powered by/i.test(html) === false) {
      sponsorIssues.push('expected_main_sponsor');
    }
    if (expect.mini && !hasMiniSponsor) {
      sponsorIssues.push('expected_mini_sponsor');
    }

    return {
      slug,
      ok: unresolved.size === 0,
      unresolved: [...unresolved],
      source: built.templateSource,
      sponsorIssues,
      expect,
    };
  } catch (e) {
    return {
      slug,
      ok: false,
      error: e.code || e.message,
      message: e.message,
    };
  }
}

async function main() {
  const slugs = collectSlugsFromMigrations();
  const results = [];
  for (const slug of slugs) {
    results.push(await auditSlug(slug));
  }

  const failed = results.filter((r) => !r.ok);
  const sponsorWarn = results.filter((r) => r.sponsorIssues && r.sponsorIssues.length);

  console.log('Email preview audit — ' + slugs.length + ' templates\n');
  if (failed.length) {
    console.log('FAILED (' + failed.length + '):');
    failed.forEach((r) => {
      console.log(
        '  - ' +
          r.slug +
          ': ' +
          (r.error || 'unresolved') +
          (r.unresolved?.length ? ' [' + r.unresolved.join(', ') + ']' : '')
      );
      if (r.message && r.message !== r.error) console.log('      ' + r.message);
    });
    console.log('');
  } else {
    console.log('All previews built without unresolved placeholders.\n');
  }

  if (sponsorWarn.length) {
    console.log('Sponsor preview gaps (' + sponsorWarn.length + '):');
    sponsorWarn.forEach((r) => {
      console.log('  - ' + r.slug + ': ' + r.sponsorIssues.join(', '));
    });
    console.log('');
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
