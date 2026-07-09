#!/usr/bin/env node
/**
 * Send a test booking confirmation email (mobile layout + refund policy).
 *
 * Usage:
 *   node scripts/send-test-booking-confirmation.js hancher249@gmail.com
 *
 * Requires RESEND_API_KEY and RESEND_FROM in local.env (copy from Vercel).
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { sendTemplatedEmail } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { publicSiteBase } = require('../api/_lib/hub-email-urls');

const to = String(process.argv[2] || '').trim().toLowerCase();
if (!to) {
  console.error('Usage: node scripts/send-test-booking-confirmation.js you@example.com');
  process.exit(1);
}

const site = publicSiteBase(process.env.SITE_URL);

const vars = mergeEmailPreviewVariables(
  'booking_confirmation',
  {
    user_name: 'Catherine',
    user_email: to,
    event_name: 'The Networker Hub',
    event_date: 'Thursday 17 July 2026',
    event_time: '18:30',
    event_location: 'Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, PE28 4YF',
    ticket_name: 'General admission',
    amount_paid: '£1.25',
    payment_status: 'Paid',
    organiser_name: 'The Networker Hub',
    meeting_type: 'In person',
    meeting_link: '',
    refund_policy: 'full_refund',
    refund_policy_details: '',
    refund_cutoff_days: 7,
    sponsor_row: '',
    sponsor_section: '',
    mini_sponsors_row: '',
  },
  site
);

sendTemplatedEmail({
  slug: 'booking_confirmation',
  to,
  variables: vars,
  skipEmailCheck: true,
  subject: "[Test] You're booked for The Networker Hub",
})
  .then(function (result) {
    console.log('Sent booking confirmation test to', to);
    console.log('Resend id:', result.id || 'n/a');
    console.log('Subject:', result.subject);
    console.log('Template source:', result.template_source || 'n/a');
  })
  .catch(function (e) {
    console.error('Send failed:', e.message || e);
    process.exit(1);
  });
