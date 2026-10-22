#!/usr/bin/env node
/**
 * Send a test Hubert weekly popular-events digest (with Meet Rosie / Catherine promo).
 *
 * Usage:
 *   node scripts/send-test-hubert-weekly-email.js catherine@thenetworkeruk.com
 *   node scripts/send-test-hubert-weekly-email.js catherine@thenetworkeruk.com --promo catherine
 *   node scripts/send-test-hubert-weekly-email.js catherine@thenetworkeruk.com --promo rosie
 *
 * Requires RESEND_API_KEY (and usually RESEND_FROM) in local.env or .env.
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
  pickCofounderPromo,
} = require('../api/_lib/hubert-event-concierge');

const args = process.argv.slice(2).filter((a) => a !== '--');
const promoIdx = args.indexOf('--promo');
const promoArg = promoIdx >= 0 ? String(args[promoIdx + 1] || '').trim().toLowerCase() : '';
const to = String(args.find((a, i) => i !== promoIdx && i !== promoIdx + 1) || '')
  .trim()
  .toLowerCase();

if (!to) {
  console.error(
    'Usage: node scripts/send-test-hubert-weekly-email.js you@example.com [--promo rosie|catherine]'
  );
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set. Add it to local.env (from Vercel) and retry.');
  process.exit(1);
}

const site = publicSiteBase(process.env.SITE_URL || process.env.PUBLIC_SITE_URL);
const now = new Date();
let promoNow = now;
if (promoArg === 'catherine' || promoArg === 'business' || promoArg === 'business-show') {
  // Force an odd ISO week so Catherine wins the alternation.
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    if (pickCofounderPromo(candidate)?.id === 'catherine_business_show') {
      promoNow = candidate;
      break;
    }
  }
} else if (promoArg === 'rosie' || promoArg === 'martech') {
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    if (pickCofounderPromo(candidate)?.id === 'rosie_martech') {
      promoNow = candidate;
      break;
    }
  }
}

const weekLabel = hubertConciergeWeekLabel(promoNow);
const meetHtml = buildMeetTeamSectionHtml(site, promoNow);
const promo = pickCofounderPromo(promoNow);

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
    console.log('Promo:', promo ? promo.id + ' — ' + promo.headline : '(none)');
    console.log('Template source:', result.template_source || 'n/a');
  })
  .catch(function (e) {
    console.error('Send failed:', e.message || e);
    process.exit(1);
  });
