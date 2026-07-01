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
  eventPublicUrl,
  organiserPublicUrl,
  organiserDashboardUrl,
  organiserBusinessDashboardUrl,
  opportunityPublicUrl,
} = require('./hub-email-urls');
const { buildDenialEmailVars } = require('./registration-emails');
const { buildMeetingLinkEmailSection } = require('./lifecycle-emails');
const { buildMiniSponsorsRow } = require('./email-sponsor-sections');

function sampleRecommendationCard(title, subtitle, url) {
  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:14px;margin:0 0 12px;">' +
    '<tr><td style="padding:18px 20px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#ffffff;margin:0 0 6px;line-height:1.35;">' +
    title +
    '</p>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);margin:0 0 12px;line-height:1.5;">' +
    subtitle +
    '</p>' +
    '<a href="' +
    url +
    '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;color:#4aa8f0;text-decoration:none;">View &rarr;</a>' +
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
    welcome_url: site + '/welcome.html',
    dashboard_url: organiserDashboardUrl(site),
    create_event_url: site + '/organiser/event-format.html',
    connect_url: organiserDashboardUrl(site, { panel: 'revenue' }),
    review_url: hubAccountUrl(site) + '?review=' + encodeURIComponent(eventRow.id) + '#reviews',
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    owner_name: 'Jordan',
    opportunity_title: 'Marketing agency partnership',
    opportunity_url: opportunityPublicUrl({ id: opportunityId }, site),
    renew_url: site + '/organiser/opportunity-edit.html?id=' + encodeURIComponent(opportunityId),
    edit_url: site + '/organiser/opportunity-edit.html?id=' + encodeURIComponent(opportunityId),
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
  return (
    '<tr><td style="padding:0 48px 18px;text-align:center;background:#f5f0e8;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:600;color:#9a9092;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Our event directory is proudly powered by</p>' +
    '<a href="' +
    site +
    '/advertising.html" style="display:inline-block;text-decoration:none;">' +
    '<span style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#9a7aa8;">Sample sponsor</span>' +
    '</a></td></tr>'
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

  if (slug === 'saved_organiser_new_listing') {
    vars.event_time = ' · 8:00 AM';
  }

  if (slug === 'opportunity_listing_rejected') {
    vars.rejection_note =
      'Please add more detail about the opportunity type and expected commitment before resubmitting.';
  }

  const site = siteBase(siteUrl);
  if (slug && String(slug).startsWith('opportunity_')) {
    vars.sponsor_row = sampleOpportunitySponsorRow(site);
    vars.sponsor_section = vars.sponsor_row;
  } else if (
    slug === 'hub_newsletter' ||
    slug === 'booking_confirmation' ||
    slug === 'booking_reminder' ||
    slug === 'account_welcome' ||
    slug === 'attendee_reengagement' ||
    slug === 'application_received' ||
    slug === 'application_approved' ||
    slug === 'application_denied'
  ) {
    vars.sponsor_row = sampleSponsorRow(site);
    vars.sponsor_section = vars.sponsor_row;
    vars.mini_sponsors_row = sampleMiniSponsorsRow();
  }

  if (slug === 'password_reset') {
    vars.reset_url = site + '/reset-password.html?token=sample';
  }

  if (slug === 'hub_newsletter') {
    vars.edition_label = 'June 2026 edition';
    vars.newsletter_subject = 'Networking highlights for members';
    vars.newsletter_layout = String(extraVars?.newsletter_layout || extraVars?.layout || 'magazine');
    vars.preheader = 'Featured events, organisers and opportunities on the Hub';
    vars.intro_html =
      'Hi Alex, welcome to <strong style="color:#452d5c;">June 2026 edition</strong> — your roundup of networking on The Networker Hub.';
    vars.article_hero_image_html =
      vars.newsletter_layout === 'editorial'
        ? '<tr><td class="mobile-pad" style="padding:8px 44px 0;"><img src="https://placehold.co/512x240/f3ecfa/452d5c?text=Editorial" alt="" width="512" style="width:100%;max-width:512px;height:auto;border-radius:16px;display:block;"></td></tr>'
        : '';
    vars.article_section_html =
      '<tr><td class="mobile-pad" style="padding:20px 40px 4px;text-align:left;"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Editorial</p></td></tr>' +
      '<tr><td class="mobile-pad" style="padding:0 40px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#452d5c;border-radius:14px;"><tr><td style="padding:20px 22px;"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 12px;">Why consistency beats intensity in networking</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.82);margin:0;">Showing up regularly to the same groups builds trust faster than chasing every new event.</p></td></tr></table></td></tr>';
    vars.featured_events_section_html =
      '<tr><td class="mobile-pad" style="padding:20px 40px 4px;text-align:left;"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Featured events</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:#452d5c;margin:0 0 14px;">Coming up on the Hub</p></td></tr>' +
      '<tr><td class="mobile-pad" style="padding:0 40px 8px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:12px;margin:0 0 12px;border:1px solid #e8dce8;">' +
      '<tr><td style="padding:16px 18px 14px;">' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:600;color:#5b2f99;margin:0 0 6px;line-height:1.4;">City Connectors</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#452d5c;margin:0 0 6px;line-height:1.35;">London Founders Breakfast</p>' +
      '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;color:#736b6e;margin:0 0 12px;line-height:1.5;">Tuesday 12 August 2026 · 8:00 AM · The Shard, London</p>' +
      '<a href="' +
      vars.event_url +
      '" style="display:inline-block;padding:8px 16px;background:#5b2f99;border-radius:999px;color:#ffffff;font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;text-decoration:none;">Book tickets →</a>' +
      '</td></tr></table></td></tr>';
    if (vars.newsletter_layout === 'magazine') {
      vars.top_ranked_organisers_section_html =
        '<tr><td class="mobile-pad" style="padding:20px 40px 4px;text-align:left;"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Hub rankings</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:#452d5c;margin:0 0 14px;">Top 10 networking groups · June 2026</p></td></tr>' +
        '<tr><td class="mobile-pad" style="padding:0 40px 8px;background:#f3ecfa;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;border:1px solid #e8dce8;border-radius:10px;background:#ffffff;"><tr><td style="padding:12px 14px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="40" valign="top" style="width:40px;padding-right:10px;"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background:#5b2f99;color:#ffffff;font-size:12px;font-weight:700;">1</span></td><td valign="top"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:600;color:#452d5c;margin:0 0 4px;">City Connectors</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;color:#736b6e;margin:0;">★ 4.9 · 28 reviews</p></td><td valign="middle" align="right"><a href="' +
        vars.organiser_url +
        '" style="font-size:11px;font-weight:700;color:#5b2f99;text-decoration:none;">View →</a></td></tr></table></td></tr></table>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;margin:12px 0 0;text-align:center;"><a href="' +
        site +
        '/events/#organisers" style="color:#5b2f99;font-weight:700;text-decoration:none;">Browse all networking groups →</a></p></td></tr>';
      vars.featured_organisers_section_html = '';
    } else {
      vars.top_ranked_organisers_section_html = '';
      vars.featured_organisers_section_html =
        '<tr><td class="mobile-pad" style="padding:20px 40px 4px;text-align:left;"><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 6px;">Featured organisers</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:18px;font-weight:600;color:#452d5c;margin:0 0 14px;">Groups members love</p></td></tr>' +
        sampleRecommendationCard('City Connectors', '4.9 average · 28 reviews', vars.organiser_url)
          .replace(/background:#1c2040/g, 'background:#f5f0e8')
          .replace(/color:#ffffff/g, 'color:#452d5c')
          .replace(/color:rgba\(255,255,255,0\.7\)/g, 'color:#736b6e')
          .replace(/color:#4aa8f0/g, 'color:#5b2f99');
    }
    vars.opportunities_url = site + '/opportunities/';
    vars.unsubscribe_url = site + '/account/settings.html';
  }

  return vars;
}

module.exports = {
  basePreviewVars,
  mergeEmailPreviewVariables,
};
