const fs = require('fs');
const path = require('path');

const BRANDED_EMAIL_TEMPLATES = {
  organiser_featured_expiry_reminder: {
    file: 'organiser-featured-expiry-reminder.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your featured listing for {{event_name}} expires soon',
  },
  organiser_claim_invite: {
    file: 'organiser-claim-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "It's FREE to claim {{organiser_name}} — The Networker UK",
  },
  opportunity_claim_invite: {
    file: 'opportunity-claim-invite.html',
    marker: 'hub-email-layout-v3-navy-gold-details-bo-invite',
    subject: 'Business Opportunity Listing Invitation',
  },
  affiliate_claim_invite: {
    file: 'affiliate-claim-invite.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: '{{opportunity_title}} — claim your affiliate programme listing',
  },
  franchise_claim_invite: {
    file: 'franchise-claim-invite.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: 'Franchise Listing Invitation',
  },
  distributorship_claim_invite: {
    file: 'distributorship-claim-invite.html',
    marker: 'hub-email-layout-v3-navy-gold-details-dist-invite',
    subject: 'Distributorship Listing Invitation',
  },
  organiser_claim_confirmed: {
    file: 'organiser-claim-confirmed.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "You're a Founding Organiser · 2026 — {{group_name}}",
  },
  organiser_launch_invite: {
    file: 'organiser-launch-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your free organiser page is ready — The Networker UK',
  },
  organiser_call_followup: {
    file: 'organiser-call-followup.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Do you need a hand with {{group_name}}?',
  },
  organiser_rebrand_announcement: {
    file: 'organiser-rebrand-announcement.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "The Networker's new chapter",
  },
  organiser_team_invite: {
    file: 'organiser-team-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{inviter_name}} invited you to help manage {{account_name}}',
  },
  organiser_ticket_sales_nudge: {
    file: 'organiser-ticket-sales-nudge.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Someone wants tickets for {{event_name}}',
  },
  opportunity_listing_live: {
    file: 'opportunity-listing-live.html',
    marker: 'hub-email-layout-v3-navy-gold-details-openday',
    subject: 'Your opportunity is live — {{opportunity_title}}',
  },
  opportunity_listing_pending_review: {
    file: 'opportunity-listing-pending-review.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: 'Your listing is pending review — {{opportunity_title}}',
  },
  opportunity_listing_approved_pay: {
    file: 'opportunity-listing-approved-pay.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: "You're Approved! — {{opportunity_title}}",
  },
  opportunity_listing_approved_pay_reminder: {
    file: 'opportunity-listing-approved-pay-reminder.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: "Reminder: You're Approved! — {{opportunity_title}}",
  },
  opportunity_listing_expiry_reminder: {
    file: 'opportunity-listing-expiry-reminder.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Your opportunity listing expires on {{expiry_date}}',
  },
  opportunity_premium_expiry_reminder: {
    file: 'opportunity-premium-expiry-reminder.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Your premium placement expires on {{expiry_date}}',
  },
  opportunity_premium_live: {
    file: 'opportunity-premium-live.html',
    marker: 'hub-email-layout-v3-navy-gold-details',
    subject: 'Premium placement active — {{opportunity_title}}',
  },
  opportunity_enquiry_received: {
    file: 'opportunity-enquiry-received.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'New enquiry: {{enquirer_name}} — {{opportunity_title}}',
  },
  opportunity_enquiry_sent: {
    file: 'opportunity-enquiry-sent.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Your enquiry was sent — {{opportunity_title}}',
  },
  opportunity_open_day_interest_received: {
    file: 'opportunity-open-day-interest-received.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Someone wants your open day — {{opportunity_title}}',
  },
  opportunity_open_day_interest_sent: {
    file: 'opportunity-open-day-interest-sent.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Thanks — open day interest received — {{opportunity_title}}',
  },
  opportunity_listing_expired: {
    file: 'opportunity-listing-expired.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Your listing has expired — {{opportunity_title}}',
  },
  opportunity_premium_expired: {
    file: 'opportunity-premium-expired.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Premium placement ended — {{opportunity_title}}',
  },
  opportunity_listing_rejected: {
    file: 'opportunity-listing-rejected.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'Your listing was not approved — {{opportunity_title}}',
  },
  city_partner_payment_welcome: {
    file: 'city-partner-payment-welcome.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'City Partner confirmed — send your logo & link',
  },
  county_partner_payment_welcome: {
    file: 'county-partner-payment-welcome.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'County Sponsor confirmed — send your logo & link',
  },
  city_partner_slot_open: {
    file: 'city-partner-slot-open.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{city_name}} City Partner — slot now available',
  },
  city_partner_opening_soon: {
    file: 'city-partner-opening-soon.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{city_name}} City Partner — opens {{available_from}}',
  },
  payout_requested: {
    file: 'payout-requested.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Payout request received — {{event_name}}',
  },
  payout_approved: {
    file: 'payout-approved.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Payout approved — {{event_name}}',
  },
  payout_paid: {
    file: 'payout-paid.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Payout sent — {{event_name}}',
  },
  stripe_connect_nudge: {
    file: 'stripe-connect-nudge.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Add your bank details to receive payouts',
  },
  meeting_link_added: {
    file: 'meeting-link-added.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Join link for {{event_name}}',
  },
  event_details_updated: {
    file: 'event-details-updated.html',
    marker: 'hub-email-layout-v3-purple-accents',
    subject: 'Update for {{event_name}}',
  },
  online_join_reminder: {
    file: 'online-join-reminder.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Join online in 1 hour — {{event_name}}',
  },
  post_event_review_request: {
    file: 'post-event-review-request.html',
    marker: 'hub-email-layout-v3-purple-review-v2',
    subject: 'How was {{event_name}}?',
  },
  post_event_review_reminder: {
    file: 'post-event-review-reminder.html',
    marker: 'hub-email-layout-v3-purple-review-v2',
    subject: 'Still time to review {{event_name}}',
  },
  account_welcome: {
    file: 'account-welcome.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Welcome to The Networker UK',
  },
  refund_processed: {
    file: 'refund-processed.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your refund is on its way – {{event_name}}',
  },
  category_exclusivity_payment_reminder: {
    file: 'category-exclusivity-payment-reminder.html',
    marker: 'hub-email-layout-v3-purple-accents',
    subject: 'Complete your booking — {{event_name}}',
  },
  event_saved_search_match: {
    file: 'event-saved-search-match.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'New event matching your saved search',
  },
  saved_event_tickets_open: {
    file: 'saved-event-tickets-open.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Tickets are on sale for {{event_name}}',
  },
  saved_opportunity_closing_soon: {
    file: 'saved-opportunity-closing-soon.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'An opportunity you saved is closing soon — {{opportunity_title}}',
  },
  opportunity_saved_search_match: {
    file: 'opportunity-saved-search-match.html',
    marker: 'hub-email-layout-v3-navy-gold',
    subject: 'New opportunity matching your saved search',
  },
  guest_visit_followup: {
    file: 'guest-visit-followup.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your guest visit with {{organiser_name}}',
  },
  alumni_fast_pass_invite: {
    file: 'alumni-fast-pass-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your previous attendee rate for {{event_name}}',
  },
  ce_member_invite: {
    file: 'ce-member-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "You're invited to book {{event_name}}",
  },
  member_roster_invite: {
    file: 'member-roster-invite.html',
    marker: 'hub-email-layout-v3-purple',
    subject: '{{organiser_name}} added you to their membership on The Networker UK',
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
    marker: 'hub-email-layout-v3-purple',
    subject: 'Membership payment failed — {{member_name}}',
  },
  member_roster_renewal_receipt: {
    file: 'member-roster-renewal-receipt.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Membership receipt — {{organiser_name}}',
  },
  event_almost_full: {
    file: 'event-almost-full.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Almost full — {{event_name}}',
  },
  attendee_reengagement: {
    file: 'attendee-reengagement.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Ready to network again?',
  },
  attendee_signup_events_nudge: {
    file: 'attendee-signup-events-nudge.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Events picked for you on The Networker UK',
  },
  attendee_signup_events_nudge_followup: {
    file: 'attendee-signup-events-nudge-followup.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Still looking for your first event?',
  },
  attendee_hubert_event_concierge: {
    file: 'attendee-hubert-event-concierge.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "Hubert's event picks for {{month_label}}",
  },
  organiser_low_upcoming_events: {
    file: 'organiser-low-upcoming-events.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "It's been a while — add your next event",
  },
  organiser_post_event_checklist: {
    file: 'organiser-post-event-checklist.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'After {{event_name}} — two quick steps',
  },
  event_removed_by_hub: {
    file: 'event-removed-by-hub.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your event {{event_name}} has been removed from The Networker UK',
  },
  event_unpublished_by_hub: {
    file: 'event-unpublished-by-hub.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your event {{event_name}} has been unpublished on The Networker UK',
  },
  organiser_listing_unpublished_by_hub: {
    file: 'organiser-listing-unpublished-by-hub.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your organiser page has been unpublished on The Networker UK',
  },
  organiser_listing_updated_by_hub: {
    file: 'organiser-listing-updated-by-hub.html',
    marker: 'hub-email-layout-v3-purple',
    subject: "We've updated {{listing_label}} on The Networker UK",
  },
  listing_report_upheld_reporter: {
    file: 'listing-report-upheld-reporter.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'We reviewed your report — thank you',
  },
  organiser_hub_warning: {
    file: 'organiser-hub-warning.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Warning {{warning_count}} of {{warning_limit}} — The Networker UK',
  },
  organiser_hub_suspended: {
    file: 'organiser-hub-suspended.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your organiser account has been suspended — The Networker UK',
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
    marker: 'hub-email-layout-v3-purple',
    subject: '{{email_subject}}',
  },
  event_connections_list: {
    file: 'event-connections-list.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Who attended — {{event_name}}',
  },
  member_roster_booking_reminder: {
    file: 'member-roster-booking-reminder.html',
    marker: 'hub-email-layout-v3-purple-accents',
    subject: 'Reminder — book {{event_name}} with {{organiser_name}}',
  },
  password_reset: {
    file: 'password-reset.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Reset your Networker UK password',
  },
  organiser_email_verify: {
    file: 'organiser-email-verify.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Confirm your email for organiser access',
  },
  event_intake_received: {
    file: 'event-intake-received.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'We received your event details — The Networker UK',
  },
  event_intake_listed: {
    file: 'event-intake-listed.html',
    marker: 'hub-email-layout-v3-purple',
    subject: 'Your event is listed — please review it — The Networker UK',
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
