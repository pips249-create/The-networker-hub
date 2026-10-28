#!/usr/bin/env node
/**
 * Send a test Hubert weekly popular-events digest (Meet Rosie + Meet Catherine promos).
 *
 * Usage:
 *   node scripts/send-test-hubert-weekly-email.js catherine@thenetworkeruk.com
 *
 * Requires RESEND_API_KEY (and usually RESEND_FROM) in local.env or .env.
 * Does not touch production attendee send timestamps — safe test-only send.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local') });

const { sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { publicSiteBase } = require('../api/_lib/hub-email-urls');
const {
  buildMeetTeamSectionHtml,
  hubertConciergeWeekLabel,
  listTeamEventPromos,
} = require('../api/_lib/hubert-event-concierge');

const to = String(process.argv[2] || '')
  .trim()
  .toLowerCase();

if (!to || to.startsWith('--')) {
  console.error('Usage: node scripts/send-test-hubert-weekly-email.js you@example.com');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set. Add it to local.env (from Vercel) and retry.');
  process.exit(1);
}

const site = publicSiteBase(process.env.SITE_URL || process.env.PUBLIC_SITE_URL);
const now = new Date();
const weekLabel = hubertConciergeWeekLabel(now);
const meetHtml = buildMeetTeamSectionHtml(site, now);
const promoIds = listTeamEventPromos(now)
  .map((p) => p.id)
  .join(', ');

const vars = mergeEmailPreviewVariables(
  'attendee_hubert_event_concierge',
  {
    user_name: 'Catherine',
    user_email: to,
    week_label: weekLabel,
    month_label: weekLabel,
    meet_rosie_html: meetHtml,
  },
  site
);
vars.meet_rosie_html = meetHtml;
vars.week_label = weekLabel;

sendTemplatedEmail({
  slug: 'attendee_hubert_event_concierge',
  to,
  variables: vars,
  skipEmailCheck: true,
  subject: "[Test] Hubert's weekly event picks — week of " + weekLabel,
})
  .then(function (result) {
    console.log('Sent Hubert weekly digest test to', to);
    console.log('Resend id:', result.id || 'n/a');
    console.log('Subject:', result.subject || 'n/a');
    console.log('Promos:', promoIds || '(none)');
    console.log('Template source:', result.template_source || 'n/a');
  })
  .catch(function (e) {
    console.error('Send failed:', e.message || e);
    process.exit(1);
  });
