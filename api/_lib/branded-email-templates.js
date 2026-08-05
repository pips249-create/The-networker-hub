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
    subject: 'Claim your page & finish setup — The Networker Hub',
  },
  organiser_launch_invite: {
    file: 'organiser-launch-invite.html',
    marker: 'hub-email-layout-v2',
    subject: 'Confirm your page & finish setup — The Networker Hub',
  },
  organiser_rebrand_announcement: {
    file: 'organiser-rebrand-announcement.html',
    marker: 'hub-email-layout-v2-legacy',
    subject: "The Networker's new chapter",
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
  city_partner_payment_welcome: {
    file: 'city-partner-payment-welcome.html',
    marker: 'hub-email-layout-v2',
    subject: 'City Partner confirmed — send your logo & link',
  },
  city_partner_slot_open: {
    file: 'city-partner-slot-open.html',
    marker: 'hub-email-layout-v2',
    subject: '{{city_name}} City Partner — slot now available',
  },
  city_partner_opening_soon: {
    file: 'city-partner-opening-soon.html',
    marker: 'hub-email-layout-v2',
    subject: '{{city_name}} City Partner — opens {{available_from}}',
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
    marker: 'hub-email-layout-v3-purple',
    subject: 'Join link for {{event_name}}',
  },
  event_details_updated: {
    file: 'event-details-updated.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Update for {{event_name}}',
  },
  online_join_reminder: {
    file: 'online-join-reminder.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Join online in 1 hour — {{event_name}}',
  },
  post_event_review_request: {
    file: 'post-event-review-request.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'How was {{event_name}}?',
  },
  post_event_review_reminder: {
    file: 'post-event-review-reminder.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Quick reminder — how was {{event_name}}?',
  },
  event_saved_search_match: {
    file: 'event-saved-search-match.html',
    subject: 'New event matching your saved search',
  },
  saved_event_tickets_open: {
    file: 'saved-event-tickets-open.html',
    marker: 'hub-email-layout-v2-saved-event',
    subject: 'Tickets are on sale for {{event_name}}',
  },
  saved_opportunity_closing_soon: {
    file: 'saved-opportunity-closing-soon.html',
    subject: 'An opportunity you saved is closing soon — {{opportunity_title}}',
  },
  opportunity_saved_search_match: {
    file: 'opportunity-saved-search-match.html',
    marker: 'hub-email-layout-v2-opp-search',
    subject: 'New opportunity matching your saved search',
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
  ce_member_invite: {
    file: 'ce-member-invite.html',
    marker: 'hub-email-layout-v2',
    subject: "You're invited to book {{event_name}}",
  },
  member_roster_invite: {
    file: 'member-roster-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{organiser_name}} added you to their membership on The Networker Hub',
  },
  member_roster_existing: {
    file: 'member-roster-existing.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{organiser_name}} added you to their membership',
  },
  member_roster_pay_invite: {
    file: 'member-roster-pay-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Pay for your {{organiser_name}} membership',
  },
  member_roster_payment_failed: {
    file: 'member-roster-payment-failed.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Update your card for {{organiser_name}} membership',
  },
  member_roster_payment_failed_organiser: {
    file: 'member-roster-payment-failed-organiser.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Membership payment failed — {{member_name}}',
  },
  member_roster_renewal_receipt: {
    file: 'member-roster-renewal-receipt.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Membership receipt — {{organiser_name}}',
  },
  category_exclusivity_payment_reminder: {
    file: 'category-exclusivity-payment-reminder.html',
    marker: 'hub-email-layout-v3-purple',
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
    marker: 'hub-email-layout-v2-loc',
    subject: 'Events picked for you on The Networker Hub',
  },
  attendee_hubert_event_concierge: {
    file: 'attendee-hubert-event-concierge.html',
    marker: 'hub-email-layout-v2-hubert-icon',
    subject: "Hubert's event picks for {{month_label}}",
  },
  organiser_low_upcoming_events: {
    file: 'organiser-low-upcoming-events.html',
    marker: 'hub-email-layout-v2',
    subject: 'Only {{upcoming_count}} events left on your calendar',
  },
  event_removed_by_hub: {
    file: 'event-removed-by-hub.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Your event {{event_name}} has been removed from The Networker Hub',
  },
  event_unpublished_by_hub: {
    file: 'event-unpublished-by-hub.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Your event {{event_name}} has been unpublished on The Networker Hub',
  },
  organiser_listing_unpublished_by_hub: {
    file: 'organiser-listing-unpublished-by-hub.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Your organiser page has been unpublished on The Networker Hub',
  },
  listing_report_upheld_reporter: {
    file: 'listing-report-upheld-reporter.html',
    marker: 'hub-email-layout-v2',
    subject: 'We reviewed your report — thank you',
  },
  organiser_hub_warning: {
    file: 'organiser-hub-warning.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Warning {{warning_count}} of {{warning_limit}} — The Networker Hub',
  },
  organiser_hub_suspended: {
    file: 'organiser-hub-suspended.html',
    marker: 'organiser-email-layout-v2',
    subject: 'Your organiser account has been suspended — The Networker Hub',
  },
  saved_organiser_new_listing: {
    file: 'saved-organiser-new-listing.html',
    marker: 'hub-email-layout-v3-purple-listing-follow',
    subject: '{{listing_subject}}',
  },
  member_roster_new_event: {
    file: 'member-roster-new-event.html',
    marker: 'hub-email-layout-v3-purple-listing-follow',
    subject: '{{listing_subject}}',
  },
  organiser_monthly_group_update: {
    file: 'organiser-monthly-group-update.html',
    marker: 'hub-email-layout-v2',
    subject: '{{email_subject}}',
  },
  event_connections_list: {
    file: 'event-connections-list.html',
    marker: 'hub-email-layout-v2',
    subject: 'Who attended — {{event_name}}',
  },
  member_roster_booking_reminder: {
    file: 'member-roster-booking-reminder.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Reminder — book {{event_name}} with {{organiser_name}}',
  },
  password_reset: {
    file: 'password-reset.html',
    marker: 'hub-email-layout-v3-purple',
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
