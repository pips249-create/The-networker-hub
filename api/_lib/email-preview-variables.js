/**
 * Sample placeholder values for admin email preview and test sends.
 */
const {
  siteBase,
  browseEventsUrl,
  hubAccountUrl,
  hubPaymentUrl,
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
} = require('./hub-email-urls');
const { buildDenialEmailVars } = require('./registration-emails');
const { buildMeetingLinkEmailSection } = require('./lifecycle-emails');
const { buildMiniSponsorsRow } = require('./email-sponsor-sections');
const {
  EMAIL_SPONSOR_LOGO_BAND_FALLBACK,
  buildSponsorLogoMarkup,
} = require('./email-booking-defaults');

function sampleRecommendationCard(title, subtitle, url) {
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:14px;margin:0 0 12px;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0 0 6px;line-height:1.35;">' +
    title +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;color:rgba(255,255,255,0.7);margin:0 0 12px;line-height:1.5;">' +
    subtitle +
    '</p>' +
    '<a href="' +
    url +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-decoration:none;">View &rarr;</a>' +
    '</td></tr></table>'
  );
}

function basePreviewVars(siteUrl) {
  const site = siteBase(siteUrl);
  const eventSlug = 'london-founders-breakfast';
  const eventRow = { slug: eventSlug, id: '00000000-0000-4000-8000-000000000010' };
  const organiserRow = { slug: 'city-connectors', id: '00000000-0000-4000-8000-000000000020' };
  const opportunityId = '00000000-0000-4000-8000-000000000030';
  const registrationId = '00000000-0000-4000-8000-000000000001';

  return {
    user_name: 'Alex Morgan',
    user_email: 'alex@example.com',
    event_name: 'London Founders Breakfast',
    event_date: 'Tuesday 12 August 2026',
    event_time: '8:00 AM',
    event_location: 'The Shard, London SE1',
    event_url: eventPublicUrl(eventRow, site),
    ticket_name: 'General admission',
    amount_paid: '£25.00',
    payment_status: 'Paid',
    registration_id: registrationId,
    booking_reference: 'HUB-00000000',
    booked_at: 'Tuesday 10 June 2026 at 2:30 pm',
    ticket_quantity: 1,
    ticket_quantity_label: '1 × General admission',
    hub_account_url: hubAccountUrl(site) + '#saved',
    hub_payment_url: hubPaymentUrl(site, registrationId),
    browse_events_url: browseEventsUrl(site),
    opportunities_url: site + '/opportunities/',
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    organiser_name: 'City Connectors',
    organiser_url: organiserPublicUrl(organiserRow, site),
    meeting_link: 'https://meet.example.com/london-founders',
    meeting_type: 'Online',
    refund_policy: 'full_refund',
    refund_policy_details: '',
    refund_cutoff_days: 7,
    attendee_name: 'Alex Morgan',
    attendee_email: 'alex@example.com',
    attendee_initial: 'A',
    booking_time: 'Tuesday 10 June 2026 at 2:30 pm',
    tickets_sold: '24',
    tickets_remaining: '3',
    total_revenue: '£600.00',
    pending_applications: '2',
    welcome_url: site + '/welcome',
    dashboard_url: organiserDashboardUrl(site),
    create_event_url: site + '/organiser/event-format',
    connect_url: organiserDashboardUrl(site, { panel: 'revenue' }),
    review_url:
      hubAccountUrl(site) +
      '?review=' +
      encodeURIComponent(eventRow.id) +
      '#review/' +
      encodeURIComponent(eventRow.id),
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    support_email: supportEmail(),
    owner_name: 'Jordan',
    opportunity_title: 'Marketing agency partnership',
    opportunity_url: opportunityPublicUrl({ id: opportunityId }, site),
    renew_url: site + '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunityId),
    edit_url: site + '/organiser/opportunity-edit?id=' + encodeURIComponent(opportunityId),
    expiry_date: 'Tuesday 12 August 2026',
    expiry_note: 'Your listing is paid until Tuesday 12 August 2026.',
    rejection_note:
      'We could not approve this listing at this time. You can edit your listing and resubmit when you are ready.',
    enquirer_name: 'Sam Taylor',
    lister_name: 'Jordan Lee',
    message_preview: 'Hi, I would like to find out more about this opportunity.',
    amount_net: '£240.00',
    group_name: 'City Connectors',
    badge_label: 'Top 10 networking group on the Hub',
    period_label: 'June 2026',
    rank: '8',
    total_ranked: '42',
    average_rating: '4.8',
    review_count: '27',
    profile_url: organiserPublicUrl(organiserRow, site),
    social_share_text:
      'City Connectors is a Top 10 networking group on The Networker Hub for June 2026.',
    screening_industry: 'Financial services',
    screening_job_title: 'Business development manager',
    price_if_approved: '£25.00',
    application_status: 'Pending',
    upcoming_count: '3',
    payment_summary_row: '',
    event_meta_rows: '',
    meeting_link_row: '',
    refund_policy_row: '',
    sponsor_row: '',
    denial_closing: '',
    denial_reason_block: '',
    meeting_link_section: '',
    recommendations_html: '',
    mini_sponsors_row: '',
  };
}

function sampleSponsorRow(site) {
  const logoHtml = buildSponsorLogoMarkup(
    '',
    'Sample sponsor',
    EMAIL_SPONSOR_LOGO_BAND_FALLBACK
  );
  return (
    '<tr><td class="mobile-pad" style="padding:12px 40px 10px;text-align:center;background:#f5f0e8;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:16px 20px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#7a7274;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Our event directory is proudly powered by</p>' +
    '<a href="' +
    site +
    '/advertising" style="display:inline-block;text-decoration:none;">' +
    logoHtml +
    '</a></td></tr></table></td></tr>'
  );
}

function sampleOpportunitySponsorRow(site) {
  return sampleSponsorRow(site).replace(
    'Our event directory is proudly powered by',
    'Our business opportunities directory is proudly powered by'
  );
}

function sampleMiniSponsorsRow() {
  return buildMiniSponsorsRow([
    {
      logo_url: 'https://placehold.co/80x40/png',
      cta_url: 'https://example.com/a',
      company_name: 'Sponsor A',
    },
    {
      logo_url: 'https://placehold.co/80x40/png',
      cta_url: 'https://example.com/b',
      company_name: 'Sponsor B',
    },
    {
      logo_url: 'https://placehold.co/80x40/png',
      cta_url: 'https://example.com/c',
      company_name: 'Sponsor C',
    },
  ]);
}

function mergeEmailPreviewVariables(slug, extraVars, siteUrl) {
  const vars = { ...basePreviewVars(siteUrl), ...(extraVars || {}) };

  if (slug === 'application_denied') {
    Object.assign(
      vars,
      buildDenialEmailVars({
        application_denial_reason:
          'This session is focused on early-stage founders. We hope to see you at a future event.',
      })
    );
  }

  if (slug === 'meeting_link_added') {
    vars.meeting_link_section = buildMeetingLinkEmailSection(vars.meeting_link);
    vars.meeting_type = 'Online';
  }

  if (slug === 'online_join_reminder') {
    vars.meeting_link_section = buildMeetingLinkEmailSection(vars.meeting_link);
    vars.meeting_type = 'Online';
    vars.event_time = vars.event_time || '2:00 PM';
  }

  if (slug === 'attendee_reengagement') {
    vars.recommendations_html =
      sampleRecommendationCard(
        'London Founders Breakfast',
        'City Connectors · Tuesday 12 August 2026 · 8:00 AM · The Shard, London',
        vars.event_url
      ) +
      sampleRecommendationCard(
        'Tech Leaders Lunch',
        'Northbridge Network · Thursday 14 August 2026 · 12:30 PM · Manchester',
        vars.browse_events_url
      );
  }

  if (slug === 'attendee_signup_events_nudge') {
    vars.nearby_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Events near London</p>' +
      sampleRecommendationCard(
        'London Founders Breakfast',
        'City Connectors · Tuesday 12 August 2026 · 8:00 AM · The Shard, London',
        vars.event_url
      ) +
      sampleRecommendationCard(
        'West End Networking Lunch',
        'Capital Connect · Wednesday 13 August 2026 · 12:30 PM · Covent Garden',
        vars.event_url
      );
    vars.popular_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Popular right now</p>' +
      sampleRecommendationCard(
        'Tech Leaders Roundtable',
        'Northbridge Network · Thursday 14 August 2026 · 6:00 PM · Manchester',
        vars.browse_events_url
      );
  }

  if (slug === 'attendee_signup_events_nudge_followup') {
    vars.opportunities_url = vars.opportunities_url || site + '/opportunities/';
    vars.popular_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Popular right now</p>' +
      sampleRecommendationCard(
        'Tech Leaders Roundtable',
        'Northbridge Network · Thursday 14 August 2026 · 6:00 PM · Manchester',
        vars.browse_events_url
      );
    vars.nearby_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Events near London</p>' +
      sampleRecommendationCard(
        'London Founders Breakfast',
        'City Connectors · Tuesday 12 August 2026 · 8:00 AM · The Shard, London',
        vars.event_url
      );
  }

  if (slug === 'attendee_hubert_event_concierge') {
    vars.month_label = 'July 2026';
    vars.account_settings_url = site + '/account/settings';
    vars.nearby_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Events within 25 miles of York</p>' +
      sampleRecommendationCard(
        'York Business Breakfast',
        'York Connectors · Tuesday 19 August 2026 · 8:00 AM · York city centre',
        vars.event_url
      );
    vars.popular_events_html =
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Popular right now</p>' +
      sampleRecommendationCard(
        'Tech Leaders Roundtable',
        'Northbridge Network · Thursday 14 August 2026 · 6:00 PM · Manchester',
        vars.browse_events_url
      );
  }

  if (slug === 'saved_organiser_new_listing') {
    vars.event_time = ' · 8:00 AM';
  }

  if (slug === 'guest_visit_followup') {
    vars.next_event_name = 'London Founders Breakfast';
    vars.next_event_date = 'Tuesday 19 August 2026';
    vars.next_event_time = '8:00 AM';
    vars.next_event_location = 'The Shard, London SE1';
    vars.next_event_url = vars.event_url;
    vars.next_event_section =
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">' +
      '<tr><td style="padding:24px;text-align:center;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Next meeting</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">' +
      vars.next_event_name +
      '</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);margin:0;">' +
      vars.next_event_date +
      ' · ' +
      vars.next_event_time +
      ' · ' +
      vars.next_event_location +
      '</p></td></tr></table>';
    vars.cta_url = vars.next_event_url;
    vars.cta_label = 'Book the next event';
  }

  if (slug === 'alumni_fast_pass_invite') {
    vars.source_event_name = 'Annual Conference 2025';
    vars.alumni_price = '£49.00';
    vars.invite_url = vars.event_url + '&alumni_token=preview-token';
  }

  if (slug === 'organiser_ticket_sales_nudge') {
    vars.nudger_name = 'Alex Morgan';
    vars.tickets_url = site + '/organiser/event-tickets?eventId=preview-event';
    vars.visitor_message_row =
      '<tr><td class="mobile-pad" style="padding:0 40px 20px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
      '<tr><td style="padding:20px 22px;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#1c2040;margin:0 0 6px;">Message from the visitor</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:#635c5e;margin:0;">Please let me know when tickets are available.</p>' +
      '</td></tr></table></td></tr>';
  }

  if (slug === 'opportunity_listing_rejected') {
    vars.rejection_note =
      'Please add more detail about the opportunity type and expected commitment before resubmitting.';
  }

  const site = siteBase(siteUrl);
  if (slug && String(slug).startsWith('opportunity_')) {
    if (!String(vars.sponsor_row || '').trim()) {
      vars.sponsor_row = sampleOpportunitySponsorRow(site);
    }
    vars.sponsor_section = vars.sponsor_row;
  } else if (
    slug === 'booking_confirmation' ||
    slug === 'booking_reminder' ||
    slug === 'online_join_reminder' ||
    slug === 'account_welcome' ||
    slug === 'attendee_reengagement' ||
    slug === 'attendee_signup_events_nudge' ||
    slug === 'attendee_signup_events_nudge_followup' ||
    slug === 'attendee_hubert_event_concierge' ||
    slug === 'application_received' ||
    slug === 'application_approved' ||
    slug === 'application_denied' ||
    slug === 'post_event_review_request' ||
    slug === 'guest_visit_followup'
  ) {
    if (!String(vars.sponsor_row || '').trim()) {
      vars.sponsor_row = sampleSponsorRow(site);
    }
    vars.sponsor_section = vars.sponsor_row;
    if (!String(vars.mini_sponsors_row || '').trim()) {
      vars.mini_sponsors_row = sampleMiniSponsorsRow();
    }
  }

  if (slug === 'password_reset') {
    vars.reset_url = site + '/reset-password?token=sample';
  }

  if (slug === 'organiser_email_verify') {
    vars.verify_url = site + '/organiser/verify-email?token=sample';
  }

  return vars;
}

module.exports = {
  basePreviewVars,
  mergeEmailPreviewVariables,
};
