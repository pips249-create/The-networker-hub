#!/usr/bin/env node
/** Inject {{sponsor_row}} and {{mini_sponsors_row}} into hub-email-layout-v2 templates. */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../email-templates');

const OPPORTUNITY_FILES = [
  'opportunity-listing-live.html',
  'opportunity-listing-expiry-reminder.html',
  'opportunity-premium-expiry-reminder.html',
  'opportunity-premium-live.html',
  'opportunity-enquiry-received.html',
  'opportunity-enquiry-sent.html',
  'opportunity-listing-expired.html',
  'opportunity-premium-expired.html',
  'opportunity-listing-rejected.html',
];

const EVENT_MINI_FILES = [
  'meeting-link-added.html',
  'post-event-review-request.html',
  'category-exclusivity-payment-reminder.html',
  'online-join-reminder.html',
  'attendee-reengagement.html',
  'attendee-signup-events-nudge.html',
  'attendee-signup-events-nudge-followup.html',
  'saved-organiser-new-listing.html',
  'application-approved.html',
  'application-denied.html',
];

const EVENT_MAIN_ONLY_FILES = [
  'event-almost-full.html',
  'organiser-low-upcoming-events.html',
  'organiser-featured-expiry-reminder.html',
  'organiser-claim-invite.html',
  'organiser-ranking-badge.html',
  'stripe-connect-nudge.html',
  'payout-requested.html',
  'payout-approved.html',
  'payout-paid.html',
];

const LEGACY_MINI_FILES = [
  'booking-confirmation.html',
  'booking-reminder-24hr.html',
  'account-welcome.html',
  'saved-event-tickets-open.html',
  'application-received.html',
  'organiser-new-booking.html',
  'organiser-new-application.html',
  'organiser-booking-cancelled.html',
  'booking-cancelled.html',
  'event-cancelled.html',
  'refund-processed.html',
];

const WAVE_END =
  /<\/tr>\s*<tr>\s*<td class="mobile-pad" style="padding:28px 40px 16px;text-align:center;">/;
const FOOTER_START =
  /<tr>\s*<td class="mobile-pad" style="background:#1c2040;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;">/;
const LEGACY_FOOTER_START =
  /<tr>\s*<td style="background:#(?:f5f0e8|1c2040);padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px[^"]*">/;

function inject(file, { main, mini }) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  if (main && !html.includes('{{sponsor_row}}') && WAVE_END.test(html)) {
    html = html.replace(
      WAVE_END,
      '</tr>\n        {{sponsor_row}}\n        <tr>\n          <td class="mobile-pad" style="padding:28px 40px 16px;text-align:center;">'
    );
  }

  if (mini && !html.includes('{{mini_sponsors_row}}')) {
    if (FOOTER_START.test(html)) {
      html = html.replace(FOOTER_START, '{{mini_sponsors_row}}\n        $&');
    } else if (LEGACY_FOOTER_START.test(html)) {
      html = html.replace(LEGACY_FOOTER_START, '{{mini_sponsors_row}}\n        $&');
    }
  }

  fs.writeFileSync(filePath, html);
  console.log('patched', file, main ? '+main' : '', mini ? '+mini' : '');
}

OPPORTUNITY_FILES.forEach((f) => inject(f, { main: true, mini: false }));
EVENT_MINI_FILES.forEach((f) => inject(f, { main: true, mini: true }));
EVENT_MAIN_ONLY_FILES.forEach((f) => inject(f, { main: true, mini: false }));
LEGACY_MINI_FILES.forEach((f) => inject(f, { main: false, mini: true }));
