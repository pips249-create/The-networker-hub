const fs = require('fs');
const path = require('path');

const BRANDED_EMAIL_TEMPLATES = {
  organiser_featured_expiry_reminder: {
    file: 'organiser-featured-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your featured listing for {{event_name}} expires soon',
  },
  organiser_claim_invite: {
    file: 'organiser-claim-invite.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your group is on The Networker Hub — claim your profile',
  },
  organiser_launch_invite: {
    file: 'organiser-launch-invite.html',
    marker: 'hub-email-layout-v2',
    subject: 'Confirm your organiser page — The Networker Hub',
  },
  organiser_rebrand_announcement: {
    file: 'organiser-rebrand-announcement.html',
    marker: 'hub-email-layout-v2-legacy',
    subject: "We're upgrading The Networker — your group listing is ready",
  },
  organiser_team_invite: {
    file: 'organiser-team-invite.html',
    marker: 'hub-email-layout-v2',
    subject: '{{inviter_name}} invited you to help manage {{account_name}}',
  },
  organiser_ticket_sales_nudge: {
    file: 'organiser-ticket-sales-nudge.html',
    marker: 'hub-email-layout-v2',
    subject: 'Someone wants tickets for {{event_name}}',
  },
  opportunity_listing_live: {
    file: 'opportunity-listing-live.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your opportunity is live — {{opportunity_title}}',
  },
  opportunity_listing_expiry_reminder: {
    file: 'opportunity-listing-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your opportunity listing expires on {{expiry_date}}',
  },
  opportunity_premium_expiry_reminder: {
    file: 'opportunity-premium-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your premium placement expires on {{expiry_date}}',
  },
  opportunity_premium_live: {
    file: 'opportunity-premium-live.html',
    marker: 'hub-email-layout-v2',
    subject: 'Premium placement active — {{opportunity_title}}',
  },
  opportunity_enquiry_received: {
    file: 'opportunity-enquiry-received.html',
    marker: 'hub-email-layout-v2',
    subject: 'New enquiry: {{enquirer_name}} — {{opportunity_title}}',
  },
  opportunity_enquiry_sent: {
    file: 'opportunity-enquiry-sent.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your enquiry was sent — {{opportunity_title}}',
  },
  opportunity_listing_expired: {
    file: 'opportunity-listing-expired.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your listing has expired — {{opportunity_title}}',
  },
  opportunity_premium_expired: {
    file: 'opportunity-premium-expired.html',
    marker: 'hub-email-layout-v2',
    subject: 'Premium placement ended — {{opportunity_title}}',
  },
  opportunity_listing_rejected: {
    file: 'opportunity-listing-rejected.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your listing was not approved — {{opportunity_title}}',
  },
  payout_requested: {
    file: 'payout-requested.html',
    marker: 'hub-email-layout-v2',
    subject: 'Payout request received — {{event_name}}',
  },
  payout_approved: {
    file: 'payout-approved.html',
    marker: 'hub-email-layout-v2',
    subject: 'Payout approved — {{event_name}}',
  },
  payout_paid: {
    file: 'payout-paid.html',
    marker: 'hub-email-layout-v2',
    subject: 'Payout sent — {{event_name}}',
  },
  stripe_connect_nudge: {
    file: 'stripe-connect-nudge.html',
    marker: 'hub-email-layout-v2',
    subject: 'Add your bank details to receive payouts',
  },
  meeting_link_added: {
    file: 'meeting-link-added.html',
    marker: 'hub-email-layout-v2',
    subject: 'Join link for {{event_name}}',
  },
  event_details_updated: {
    file: 'event-details-updated.html',
    marker: 'hub-email-layout-v2',
    subject: 'Update for {{event_name}}',
  },
  online_join_reminder: {
    file: 'online-join-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Join online in 1 hour — {{event_name}}',
  },
  post_event_review_request: {
    file: 'post-event-review-request.html',
    marker: 'hub-email-layout-v2',
    subject: 'How was {{event_name}}?',
  },
  guest_visit_followup: {
    file: 'guest-visit-followup.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your guest visit with {{organiser_name}}',
  },
  alumni_fast_pass_invite: {
    file: 'alumni-fast-pass-invite.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your previous attendee rate for {{event_name}}',
  },
  category_exclusivity_payment_reminder: {
    file: 'category-exclusivity-payment-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Complete your booking — {{event_name}}',
  },
  event_almost_full: {
    file: 'event-almost-full.html',
    marker: 'hub-email-layout-v2',
    subject: 'Almost full — {{event_name}}',
  },
  attendee_reengagement: {
    file: 'attendee-reengagement.html',
    marker: 'hub-email-layout-v2',
    subject: 'Ready to network again?',
  },
  attendee_signup_events_nudge: {
    file: 'attendee-signup-events-nudge.html',
    marker: 'hub-email-layout-v2',
    subject: 'Events picked for you on The Networker Hub',
  },
  attendee_signup_events_nudge_followup: {
    file: 'attendee-signup-events-nudge-followup.html',
    marker: 'hub-email-layout-v2-followup',
    subject: 'Still looking for your first event?',
  },
  attendee_hubert_event_concierge: {
    file: 'attendee-hubert-event-concierge.html',
    marker: 'hub-email-layout-v2',
    subject: "Hubert's event picks for {{month_label}}",
  },
  organiser_low_upcoming_events: {
    file: 'organiser-low-upcoming-events.html',
    marker: 'hub-email-layout-v2',
    subject: 'Only {{upcoming_count}} events left on your calendar',
  },
  saved_organiser_new_listing: {
    file: 'saved-organiser-new-listing.html',
    marker: 'hub-email-layout-v2',
    subject: '{{organiser_name}} has a new event',
  },
  password_reset: {
    file: 'password-reset.html',
    marker: 'hub-email-layout-v2',
    subject: 'Reset your Networker Hub password',
  },
  organiser_email_verify: {
    file: 'organiser-email-verify.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Confirm your email for organiser access',
  },
};

const cache = new Map();

function readTemplateFile(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const filePath = path.join(__dirname, '../../email-templates', filename);
  const html = fs.readFileSync(filePath, 'utf8');
  cache.set(filename, html);
  return html;
}

function resolveBrandedEmailBody(slug, dbBodyHtml) {
  const cfg = BRANDED_EMAIL_TEMPLATES[slug];
  if (!cfg) {
    return { bodyHtml: String(dbBodyHtml || ''), source: 'database' };
  }
  const body = String(dbBodyHtml || '');
  if (!body.includes(cfg.marker)) {
    return { bodyHtml: readTemplateFile(cfg.file), source: 'file' };
  }
  return { bodyHtml: body, source: 'database' };
}

function getBrandedEmailSubject(slug) {
  return BRANDED_EMAIL_TEMPLATES[slug]?.subject || '';
}

function isBrandedEmailSlug(slug) {
  return Object.prototype.hasOwnProperty.call(BRANDED_EMAIL_TEMPLATES, slug);
}

module.exports = {
  BRANDED_EMAIL_TEMPLATES,
  resolveBrandedEmailBody,
  getBrandedEmailSubject,
  isBrandedEmailSlug,
};
