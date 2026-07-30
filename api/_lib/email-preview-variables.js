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
  unsubscribeUrl,
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
const { buildListingAlertSeriesCopy } = require('./listing-alert-series');

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
    unsubscribe_url: unsubscribeUrl(site),
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
    badge_url: site + '/rankings/badge?id=' + encodeURIComponent(organiserRow.id || 'demo'),
    dashboard_url: site + '/organiser/#leaderboard',
    rankings_url: site + '/rankings',
    primary_cta_url: site + '/rankings/badge?id=' + encodeURIComponent(organiserRow.id || 'demo'),
    primary_cta_label: 'Get your website badge',
    secondary_cta_url: site + '/rankings',
    secondary_cta_label: 'See this month’s top groups',
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
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:14px;border:1px solid #d9c4e0;">' +
    '<tr><td style="padding:16px 20px;text-align:center;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#7a7274;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Powered by</p>' +
    '<a href="' +
    site +
    '/advertising" style="display:inline-block;text-decoration:none;">' +
    logoHtml +
    '</a></td></tr></table></td></tr>'
  );
}

function sampleOpportunitySponsorRow(site) {
  return sampleSponsorRow(site);
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
  const site = siteBase(siteUrl);
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
    vars.add_location_url = String(vars.site_url || '').replace(/\/$/, '') + '/account/settings/';
    vars.location_tip_html =
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;background:#f7f4fb;border:1px solid rgba(69,45,92,0.12);border-radius:10px;">' +
      '<tr><td style="padding:16px 18px;text-align:left;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#452d5c;margin:0 0 6px;">Add your city or postcode</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.55;color:#635c5e;margin:0 0 12px;">Tell us where you are so we can pick events near you next time — takes about 10 seconds.</p>' +
      '<a href="' +
      vars.add_location_url +
      '" style="display:inline-block;padding:10px 18px;background:#5b2f99;border-radius:8px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">Add location in Account settings &rarr;</a>' +
      '</td></tr></table>';
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
    vars.add_location_url = String(vars.site_url || '').replace(/\/$/, '') + '/account/settings/';
    vars.location_tip_html =
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;background:#f7f4fb;border:1px solid rgba(69,45,92,0.12);border-radius:10px;">' +
      '<tr><td style="padding:16px 18px;text-align:left;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:700;color:#452d5c;margin:0 0 6px;">Add your city or postcode</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.55;color:#635c5e;margin:0 0 12px;">Tell us where you are so we can pick events near you next time — takes about 10 seconds.</p>' +
      '<a href="' +
      vars.add_location_url +
      '" style="display:inline-block;padding:10px 18px;background:#5b2f99;border-radius:8px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">Add location in Account settings &rarr;</a>' +
      '</td></tr></table>';
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
    vars.event_time = ' · ' + (vars.event_time || '8:00 AM');
    Object.assign(
      vars,
      buildListingAlertSeriesCopy({
        dateCount: 1,
        variant: 'saved_organiser',
        organiserName: vars.organiser_name,
        userName: vars.user_name,
        eventName: vars.event_name,
      })
    );
  }

  if (slug === 'member_roster_new_event') {
    vars.event_time = ' · ' + (vars.event_time || '8:00 AM');
    vars.cta_url = vars.event_url;
    vars.cta_label = 'View member tickets';
    Object.assign(
      vars,
      buildListingAlertSeriesCopy({
        dateCount: 1,
        variant: 'member_roster',
        organiserName: vars.organiser_name,
        userName: vars.user_name,
        eventName: vars.event_name,
      })
    );
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

  if (slug === 'event_connections_list') {
    vars.event_date = 'Tuesday 14 July 2026';
    vars.event_date_clause = ' on Tuesday 14 July 2026';
    vars.attendee_count = '3';
    vars.organiser_note_html =
      '<tr><td class="mobile-pad" style="padding:8px 40px 16px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;">' +
      '<tr><td style="padding:18px 20px;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#0d6e7a;text-transform:uppercase;letter-spacing:0.4px;margin:0 0 8px;">A note from the organiser</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">Lovely to see you all — here are the people who came along so you can keep the conversations going.</p>' +
      '</td></tr></table></td></tr>';
    vars.connections_list_html =
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
      '<tr><td style="padding:14px 0;border-bottom:1px solid #ece7df;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 2px;">Alex Morgan</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0 0 4px;">Founder · Acme Coaching</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;margin:0;"><a href="mailto:alex@example.com" style="color:#0d6e7a;text-decoration:underline;">alex@example.com</a></p>' +
      '</td></tr>' +
      '<tr><td style="padding:14px 0;border-bottom:1px solid #ece7df;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 2px;">Sam Patel</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0 0 4px;">Marketing Director · Bright Labs</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;margin:0;"><a href="mailto:sam@example.com" style="color:#0d6e7a;text-decoration:underline;">sam@example.com</a></p>' +
      '</td></tr>' +
      '<tr><td style="padding:14px 0;border-bottom:1px solid #ece7df;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 2px;">Jordan Lee</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;margin:0;"><a href="mailto:jordan@example.com" style="color:#0d6e7a;text-decoration:underline;">jordan@example.com</a></p>' +
      '</td></tr></table>';
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

  if (slug && String(slug).startsWith('opportunity_')) {
    if (!String(vars.sponsor_row || '').trim()) {
      vars.sponsor_row = sampleOpportunitySponsorRow(site);
    }
    vars.sponsor_section = vars.sponsor_row;
    if (!String(vars.mini_sponsors_row || '').trim()) {
      vars.mini_sponsors_row = sampleMiniSponsorsRow();
    }
  } else if (slug && String(slug).startsWith('organiser_')) {
    if (!String(vars.sponsor_row || '').trim()) {
      vars.sponsor_row = sampleSponsorRow(site);
    }
    vars.sponsor_section = vars.sponsor_row;
    if (!String(vars.mini_sponsors_row || '').trim()) {
      vars.mini_sponsors_row = sampleMiniSponsorsRow();
    }
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
    slug === 'guest_visit_followup' ||
    slug === 'event_connections_list'
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
    vars.verify_url = site + '/organiser/verify-email';
    vars.verify_code = '482917';
  }

  if (slug === 'member_roster_invite' || slug === 'member_roster_existing' || slug === 'member_roster_pay_invite') {
    const {
      buildOrganiserInviteIntroSection,
      buildRosterUpcomingEventSection,
      organiserLogoUrlForEmail,
    } = require('./organiser-member-roster');
    const rosterSite = siteBase(siteUrl);
    const previewOrganiser = {
      id: '00000000-0000-4000-8000-000000000020',
      name: vars.organiser_name,
      slug: 'city-connectors',
      photo_url: 'https://placehold.co/144x144/png?text=CC',
    };
    vars.organiser_logo_url = organiserLogoUrlForEmail(previewOrganiser, rosterSite);
    vars.organiser_invite_intro_section = buildOrganiserInviteIntroSection(previewOrganiser, rosterSite, {
      userName: vars.user_name,
      variant:
        slug === 'member_roster_pay_invite'
          ? 'pay'
          : slug === 'member_roster_existing'
            ? 'existing'
            : 'invite',
    });
    if (slug === 'member_roster_pay_invite') {
      vars.price_summary =
        vars.price_summary || 'Membership is £25 / month or £250 / year — paid to the group.';
      vars.fee_note =
        vars.fee_note ||
        'A booking fee (4.5% + 20p) is added at checkout. The group receives 100% of the membership price.';
      vars.cta_label = vars.cta_label || 'Pay for membership';
      vars.cta_url =
        rosterSite +
        '/login?email=' +
        encodeURIComponent(vars.user_email) +
        '&next=' +
        encodeURIComponent('/organisers/city-connectors#org-membership-join');
    } else {
      vars.upcoming_event_section = buildRosterUpcomingEventSection({
        title: vars.event_name,
        starts_at: '2026-08-12T08:00:00.000Z',
        location_label: vars.event_location,
      });
      if (slug === 'member_roster_invite') {
        vars.register_url =
          rosterSite +
          '/register?email=' +
          encodeURIComponent(vars.user_email) +
          '&next=' +
          encodeURIComponent(vars.event_url);
      } else {
        vars.cta_url =
          rosterSite +
          '/login?email=' +
          encodeURIComponent(vars.user_email) +
          '&next=' +
          encodeURIComponent(vars.event_url);
        vars.cta_label = 'Book member tickets';
        vars.hub_groups_url = vars.hub_account_url + '#memberships';
      }
    }
  }

  if (
    slug === 'member_roster_payment_failed' ||
    slug === 'member_roster_payment_failed_organiser' ||
    slug === 'member_roster_renewal_receipt'
  ) {
    vars.organiser_name = vars.organiser_name || 'City Connectors';
    vars.member_name = vars.member_name || vars.user_name || 'Alex';
    vars.member_email = vars.member_email || vars.user_email;
    vars.expires_note =
      vars.expires_note ||
      'Your membership stays active until 2026-08-31 while Stripe retries the card.';
    vars.amount_paid = vars.amount_paid || '£25.75';
    vars.billing_interval = vars.billing_interval || 'monthly';
    vars.next_billing_date = vars.next_billing_date || '2026-08-29';
    vars.receipt_intro =
      vars.receipt_intro || 'Thanks — your membership renewal went through.';
    vars.period_note =
      vars.period_note || 'Your membership is current until 2026-08-29.';
    vars.cta_label =
      vars.cta_label ||
      (slug === 'member_roster_renewal_receipt'
        ? 'Manage membership'
        : slug === 'member_roster_payment_failed_organiser'
          ? 'Open membership'
          : 'Update payment details');
    vars.cta_url =
      vars.cta_url ||
      site +
        '/login?email=' +
        encodeURIComponent(vars.user_email) +
        '&next=' +
        encodeURIComponent('/account/#memberships');
  }

  return vars;
}

module.exports = {
  basePreviewVars,
  mergeEmailPreviewVariables,
};
