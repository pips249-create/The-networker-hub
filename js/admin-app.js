/**
 * The Networker — unified admin panel (SPA, hash routing).
 */
(function () {
  var liveUsers = [];
  var liveUsersComplete = false;
  var liveListings = [];
  var liveReviews = [];

  var VERCEL_ANALYTICS_URL =
    'https://vercel.com/pips249-create/the-networker-hub/analytics';

  /** Scheduled ops reminders shown on Command Centre Home. */
  var PLATFORM_SCHEDULED_REMINDERS = [
    {
      id: 'marketing-stats-review',
      dueDate: '2026-11-23',
      title: 'Review marketing page stats',
      detail:
        'Check whether 27,000+ Events listed and 17,000+ networkers last year still match Google Analytics and platform data. Update for-networkers, for-organisers, about, advertising, list-an-opportunity, events browse, login, and register if needed.',
      href: '#analytics',
    },
  ];

  function scheduledReminderDue(reminder) {
    if (!reminder || !reminder.dueDate) return false;
    var due = new Date(String(reminder.dueDate) + 'T23:59:59');
    if (isNaN(due.getTime())) return false;
    return due.getTime() <= Date.now();
  }

  function formatScheduledReminderDue(dueDate) {
    var d = new Date(String(dueDate) + 'T12:00:00');
    if (isNaN(d.getTime())) return String(dueDate || '');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderScheduledReminderHtml(reminder) {
    return (
      '<div class="admin-scheduled-reminder">' +
      '<p class="admin-scheduled-reminder-title">' +
      esc(reminder.title) +
      '</p>' +
      '<p class="admin-scheduled-reminder-meta"><strong>Due ' +
      esc(formatScheduledReminderDue(reminder.dueDate)) +
      '</strong></p>' +
      '<p class="admin-scheduled-reminder-detail">' +
      esc(reminder.detail) +
      '</p>' +
      (reminder.href
        ? '<a href="' +
          attrEsc(reminder.href) +
          '" class="admin-scheduled-reminder-link">View details</a>'
        : '') +
      '</div>'
    );
  }

  function marketingStatsReviewQueueAlert() {
    var reminder = PLATFORM_SCHEDULED_REMINDERS.find(function (r) {
      return r.id === 'marketing-stats-review';
    });
    if (!reminder || !scheduledReminderDue(reminder)) return null;
    return {
      id: reminder.id,
      severity: 'low',
      title: reminder.title,
      detail: reminder.detail,
      href: reminder.href || '#dashboard',
      time: reminder.dueDate,
    };
  }

  function syncScheduledRemindersSection() {
    var section = document.getElementById('dashboard-scheduled-reminders-section');
    var el = document.getElementById('dashboard-scheduled-reminders');
    if (!el) return;
    var upcoming = PLATFORM_SCHEDULED_REMINDERS.filter(function (r) {
      return r && r.dueDate && !scheduledReminderDue(r);
    });
    if (section) section.hidden = !upcoming.length;
    if (!upcoming.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = upcoming.map(renderScheduledReminderHtml).join('');
  }

  function isLocalDevHost() {
    var host = String(window.location.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  }

  function hubEmailActionMessage(code, fallback) {
    var messages = {
      recipient_not_allowed:
        'This address is not on the safe test list. Add it under Email → Safe test recipients first.',
      resend_not_configured: isLocalDevHost()
        ? 'Email is not configured for local dev. Copy RESEND_API_KEY and RESEND_FROM from Vercel into local.env, then run npm run sync-env and restart npm start.'
        : 'Email sending is not configured yet. Add RESEND_API_KEY and RESEND_FROM in Vercel, then redeploy.',
      test_recipients_table_missing:
        'Safe test list is not set up yet. Run migrations 051 and 052 in Supabase.',
      template_not_found:
        'Email template not found. Run the latest Supabase email migrations (including 091 for password reset).',
      resend_send_failed:
        'Resend rejected the email. Check RESEND_FROM uses a verified domain and see Resend logs.',
      recipient_not_allowlisted:
        'That address is not on the pre-launch email allowlist. Only team test addresses receive mail until launch.',
    };
    return messages[code] || fallback || code || 'Something went wrong.';
  }

  var PAGE_META = {
    dashboard: {
      title: 'Home',
      subtitle: 'Your to-do list, key numbers, and recent activity',
    },
    analytics: {
      title: 'Website visitors',
      subtitle: 'Traffic overview, demand signals, and platform insights',
    },
    'event-health': {
      title: 'Event data issues',
      subtitle: 'Fix published events missing dates, organisers, VAT, or profile data',
    },
    cleanup: {
      title: 'Fix listings',
      subtitle: 'Edit group pages, events, and business opportunities',
    },
    'group-cleanup': {
      title: 'Fix listings',
      subtitle: 'Click a row to add a photo, description, or website',
    },
    'event-cleanup': {
      title: 'Fix listings',
      subtitle: 'Search events, then click a row to edit details',
    },
    'opportunity-cleanup': {
      title: 'Fix listings',
      subtitle: 'Review and approve business opportunity listings',
    },
    accounts: {
      title: 'User accounts',
      subtitle: 'View accounts and manage featured organisers',
    },
    email: {
      title: 'Send emails',
      subtitle: 'Email campaigns and template wording',
    },
    impersonate: {
      title: 'Impersonate user',
      subtitle: 'Browse Supabase accounts and sign in as any non-admin user to debug on the Hub',
    },
    users: {
      title: 'Users & accounts',
      subtitle: 'Manage featured organiser status and open account details',
    },
    system: {
      title: 'Site settings',
      subtitle: 'Check the site is running correctly before go-live',
    },
    rankings: {
      title: 'Top performers',
      subtitle: 'Monthly top groups and congratulation emails',
    },
    featured: {
      title: 'Premium Spotlight',
      subtitle: 'Choose which approved events appear in the Premium Spotlight carousel',
    },
    spotlight: {
      title: 'Premium Spotlight',
      subtitle: 'Manage featured events, organisers, and opportunities for the public browse carousels',
    },
    support: {
      title: 'Help requests',
      subtitle: 'Look up bookings and log complaints from hello@thenetworkerhub.com',
    },
    campaigns: {
      title: 'Email campaigns',
      subtitle: 'Legacy bulk send for organiser claim-profile invites',
    },
    import: {
      title: 'Data import',
      subtitle: 'Upload CSV to add organisers or attendee records (no automatic emails)',
    },
    moderation: {
      title: 'Reported items',
      subtitle: 'Reports, listing overview, reviews, and CSV import',
    },
    financials: {
      title: 'Payments',
      subtitle: 'Revenue overview, organiser Connect status, payouts, and activity',
    },
    'revenue-targets': {
      title: 'Sales targets',
      subtitle: 'Track progress towards your revenue goal',
    },
    sponsorship: {
      title: 'Ads & sponsors',
      subtitle: 'Manage sponsor logos and advert placements',
    },
    emails: {
      title: 'Email templates',
      subtitle: 'Edit transactional copy in Supabase · test sends need Resend configured',
    },
    social: {
      title: 'Social posts',
      subtitle: 'Draft captions from Hub listings — copy or open share links for LinkedIn, Facebook, and X',
    },
  };

  var ADMIN_GUIDES = {
    dashboard: {
      title: 'How to use Home',
      steps: [
        'Glance at the numbers at the top — Hub booking fees, events, organisers, and member accounts.',
        'Use Quick links if you already know where you want to go.',
        'If Things to do appears, start with Urgent items and click Go there on each row.',
        'Recent activity shows new sign-ups, events, and reviews.',
        'At a glance lists the same key counts in more detail.',
      ],
    },
    system: {
      title: 'How to check site settings',
      steps: [
        'Review each checklist item — green means OK, amber or red needs attention.',
        'Open any failed check to see what is missing (usually an environment variable).',
        'Fix issues in Vercel or Supabase, then refresh this page.',
      ],
    },
    analytics: {
      title: 'How to view website visitors',
      steps: [
        'Use the Overview, Demand, and Insights tabs — each page loads only what you need.',
        'Overview links out to Vercel for visitor charts and shows live Hub counts.',
        'Demand shows searches, favourites, opportunity enquiries, and guest visits.',
        'Insights opens with tickets bought on the Hub (paid vs free), then ranks top groups and events. Change 7 / 30 / all days on Demand or Insights.',
      ],
    },
    rankings: {
      title: 'How to manage top performers',
      steps: [
        'Current shows this month\'s ranked groups — search or filter by badge tier.',
        'Run a snapshot when you want to refresh badges; preview emails if unsure.',
        'History keeps past snapshots and congratulation emails.',
      ],
    },
    users: {
      title: 'How to manage user accounts',
      steps: [
        'Search or filter by role to find an account — results are paginated.',
        'Click Details to open featured status, email preferences, and dates.',
        'Toggle featured organiser only when you have agreed it with the group.',
      ],
    },
    impersonate: {
      title: 'How to sign in as another user',
      steps: [
        'Search for the account you need to debug.',
        'Click Impersonate — you will be signed in as that user on the public Hub.',
        'When finished, stop impersonating from the banner at the top of the site.',
        'Never impersonate without a clear support reason.',
      ],
    },
    support: {
      title: 'How to look up bookings',
      steps: [
        'Search by attendee email, name, or booking reference.',
        'Open a booking to see tickets, payment status, and event details.',
        'Use this when someone emails asking about their registration.',
      ],
    },
    'support-complaints': {
      title: 'How to log a complaint',
      steps: [
        'Click Log complaint and enter details from the email to hello@thenetworkerhub.com.',
        'Note the date received — you have 14 days to respond.',
        'Update status as you work on it: acknowledged, in progress, resolved.',
        'Add notes so someone else can pick it up if needed.',
      ],
    },
    'group-cleanup': {
      title: 'How to fix group pages',
      steps: [
        'Find the group — search by name or filter to incomplete profiles.',
        'Click the row to expand it.',
        'Add a logo URL, description, and website, then Save.',
        'Use Fill from website if the group already has a site listed.',
      ],
    },
    'event-cleanup': {
      title: 'How to edit events',
      steps: [
        'Search or filter to find the event.',
        'Click the row to expand the editor.',
        'Update details, organiser, or dates, then Save.',
        'Open the public event page link to check it looks right.',
      ],
    },
    'event-health': {
      title: 'How to fix event data issues',
      steps: [
        'Each row is a published event missing something important.',
        'Expand the event and fill in the highlighted fields.',
        'Click Save fixes when done — the event drops off this list.',
        'For many events with the same issue, tick several and use bulk fix at the top.',
      ],
    },
    'opportunity-cleanup': {
      title: 'How to review business opportunities',
      steps: [
        'Filter to Pending review to see new listings.',
        'Open a row to read the full details.',
        'Approve to publish on the site, or reject if it does not meet standards.',
        'Toggle Featured to show it in the opportunities carousel.',
      ],
    },
    moderation: {
      title: 'How to handle reported items',
      steps: [
        'Use the Reports tab for open listing and review reports — decide first here.',
        'Unpublish upholds a listing report (emails poster and reporter); dismiss if it looks fine.',
        'Listings and Reviews tabs are overviews with search — edit via Fix listings.',
        'Import is for CSV data loads, separate from day-to-day moderation.',
      ],
    },
    import: {
      title: 'How to import data from CSV',
      steps: [
        'Choose organiser or attendee import.',
        'Download the template CSV if you need the correct column layout.',
        'Upload your file and review the preview row count.',
        'Confirm import — no automatic emails are sent.',
      ],
    },
    financials: {
      title: 'How to manage payments',
      steps: [
        'Use Overview for totals, Organisers for Stripe status, Payouts for the queue, and Activity for recent bookings.',
        'On Payouts: approve when ready to pay, then mark paid after bank transfer.',
        'On Organisers: amber Stripe status means the group cannot sell paid tickets yet.',
        'Search and filter the organiser and payout tables when the lists get long.',
      ],
    },
    'revenue-targets': {
      title: 'How to track sales targets',
      steps: [
        'Overview shows progress bars and category cards against your goals.',
        'Chart compares forecast vs actual — switch category or monthly/cumulative.',
        'Deals is for offline sponsorship entries not invoiced through Stripe — you can log and remove manual entries so totals stay accurate.',
      ],
    },
    spotlight: {
      title: 'How to feature events',
      steps: [
        'Browse approved upcoming events.',
        'Toggle Featured and set an end date (or leave with no end date).',
        'Paid placements and admin grants both show under Expires — change the date any time.',
      ],
    },
    'spotlight-organisers': {
      title: 'How to feature organisers',
      steps: [
        'Find the networking group you want to highlight.',
        'Toggle Featured and set how long they stay in the carousel.',
        'Change or clear the end date under Expires, or untick Featured to remove them.',
      ],
    },
    'spotlight-opportunities': {
      title: 'How to feature opportunities',
      steps: [
        'Only approved opportunities can be featured.',
        'Toggle Featured and set an end date for the /opportunities/ carousel.',
        'Edit Expires to extend or shorten the placement.',
      ],
    },
    sponsorship: {
      title: 'How to manage ads and sponsors',
      steps: [
        'Pick a placement — browse heroes, Page Partner mini sponsors, city partners, or home partners.',
        'Browse heroes (events / organisers / opportunities): logo + website link only. Set Placement ends for manual deal terms. Opportunity sidebar and city/county partners are also logo + link. Mini carousels need logo + link per slot (each can have its own end date).',
        'Page Partner mini sponsors: logo + click-through link per slot — same logos appear on detail pages and selected emails. Tick Active, set Placement ends if needed, then Save.',
        'Check Ad active (or Mini sponsors active), save, and confirm on the live page.',
        'Use Report for monthly sponsor packs — filter by brand (e.g. Barnsgate) and date range, then export CSV.',
      ],
    },
    campaigns: {
      title: 'How to send email campaigns',
      steps: [
        'Choose a campaign type (e.g. organiser claim invites).',
        'Review the recipient list carefully before sending.',
        'Send a test to yourself first if the list is large.',
      ],
    },
    emails: {
      title: 'How to edit email templates',
      steps: [
        'Pick the template you want to change.',
        'Edit the subject and body — use the variable names shown in the help text.',
        'Send a test email to check formatting before relying on it in production.',
      ],
    },
    social: {
      title: 'How to draft social posts',
      steps: [
        'Pick an event, organiser, or opportunity as the source.',
        'Review the generated caption and edit if needed.',
        'Copy the text or open the share link for LinkedIn, Facebook, or X.',
      ],
    },
  };

  var EVENT_TYPES = [
    'Meeting',
    'Conference',
    'Events',
    'Exhibition',
    'Awards',
    'Webinar',
    'Workshop',
    'Seminar',
    'Masterclass',
  ];
  var MEETING_FORMATS = ['In person', 'Online'];
  var healthCache = null;
  var healthCacheFetchedAt = 0;
  var adminMetricsCache = null;
  var adminMetricsInflight = null;
  var ADMIN_METRICS_CACHE_KEY = 'tnh_admin_metrics_v2';
  var ADMIN_NAV_SECTIONS_KEY = 'tnh_admin_nav_sections_v1';
  var ADMIN_HUB_TABS_KEY = 'tnh_admin_hub_tabs_v1';
  var NAV_SECTION_ROUTES = {
    platform: ['system', 'analytics', 'rankings', 'accounts', 'support'],
    listings: ['cleanup', 'moderation'],
    revenue: ['financials', 'revenue-targets', 'spotlight', 'sponsorship'],
    comms: ['email', 'social'],
  };
  var HEALTH_STALE_MS = 5 * 60 * 1000;
  var METRICS_POLL_MS = 90000;
  var adminNotificationsTimer = null;
  var groupCleanupCache = null;
  var eventCleanupCache = null;
  var analyticsState = { period: '30d', demandCache: null };
  var financialsState = {
    organisersPage: 0,
    organisersQ: '',
    organisersStatus: '',
    payoutsPage: 0,
    payoutsStatus: '',
    cache: null,
  };
  var usersPageState = { page: 0, q: '', role: '', total: 0, loading: false };
  var rankingsState = { q: '', tier: '', page: 0 };
  var moderationListingsState = { q: '', status: '', page: 0 };
  var USERS_PAGE_SIZE = 30;
  var FINANCIALS_PAGE_SIZE = 30;
  var RANKINGS_PAGE_SIZE = 25;
  var MODERATION_LISTINGS_PAGE_SIZE = 30;
  var revenueTargetsChartsCache = null;
  var revenueTargetsChartInstance = null;
  var revenueTargetsChartView = 'overall';
  var revenueTargetsChartMode = 'monthly';
  var eventHealthState = { issueFilter: 'all', selected: {} };
  var groupCleanupState = {
    page: 0,
    q: '',
    incomplete: false,
    excludeHidden: false,
    visibility: '',
    total: 0,
    loading: false,
    selected: {},
    expanded: {},
    createOpen: false,
    focusOrganiserId: '',
  };
  var eventCleanupState = {
    organiserId: '',
    unlinked: false,
    noDate: false,
    when: '',
    status: '',
    approval: '',
    sort: 'recent',
    page: 0,
    q: '',
    total: 0,
    items: [],
    loading: false,
    selected: {},
    expanded: {},
  };
  var opportunityCleanupState = {
    status: '',
    approval: '',
    type: '',
    featured: false,
    noImage: false,
    sort: 'recent',
    page: 0,
    q: '',
    total: 0,
    loading: false,
    fetchToken: 0,
    expanded: {},
    selected: {},
  };
  var GROUP_PAGE_SIZE = 30;
  var EVENT_PAGE_SIZE = 30;
  var OPPORTUNITY_PAGE_SIZE = 30;
  var eventOrganiserOptionsCache = null;
  var eventCreateOrganiserDocClickBound = false;
  var eventBulkOrganiserDocClickBound = false;
  var opportunityCleanupCache = null;
  var featuredSpotlightEvents = [];
  var featuredSpotlightState = {
    q: '',
    featured: '',
    eventType: '',
    when: '',
  };
  var featuredSpotlightLoadGen = 0;
  var featuredSpotlightSearchTimer = null;
  var featuredSpotlightOrganisers = [];
  var featuredSpotlightOpportunities = [];
  var spotlightSlotsCache = null;
  var spotlightOrganiserState = { q: '', featured: '' };
  var spotlightOpportunityState = { q: '', featured: '' };
  var spotlightOrganiserSearchTimer = null;
  var spotlightOpportunitySearchTimer = null;
  var bookingsSearchState = { q: '' };
  var complaintsState = { filter: 'open', expanded: {}, items: [] };
  var adminLogoPending = {};
  var groupSearchTimer = null;
  var eventSearchTimer = null;
  var opportunitySearchTimer = null;

  var NETWORKING_CITY_PARTNER_SLUGS = [
    { slug: 'central-london', name: 'Central London' },
    { slug: 'north-london', name: 'North London' },
    { slug: 'south-london', name: 'South London' },
    { slug: 'east-london', name: 'East London' },
    { slug: 'west-london', name: 'West London' },
    { slug: 'manchester', name: 'Manchester' },
    { slug: 'birmingham', name: 'Birmingham' },
    { slug: 'glasgow', name: 'Glasgow' },
    { slug: 'edinburgh', name: 'Edinburgh' },
    { slug: 'leeds', name: 'Leeds' },
    { slug: 'liverpool', name: 'Liverpool' },
    { slug: 'newcastle', name: 'Newcastle' },
    { slug: 'bristol', name: 'Bristol' },
    { slug: 'sheffield', name: 'Sheffield' },
    { slug: 'nottingham', name: 'Nottingham' },
    { slug: 'cardiff', name: 'Cardiff' },
    { slug: 'brighton', name: 'Brighton' },
    { slug: 'cambridge', name: 'Cambridge' },
    { slug: 'oxford', name: 'Oxford' },
    { slug: 'chester', name: 'Chester' },
  ];

  /** Launch County Sponsor inventory — enquiry + manual logo placement. */
  var NETWORKING_COUNTY_PARTNER_SLUGS = [
    { slug: 'berkshire', name: 'Berkshire' },
    { slug: 'cheshire', name: 'Cheshire' },
    { slug: 'essex', name: 'Essex' },
    { slug: 'hampshire', name: 'Hampshire' },
    { slug: 'hertfordshire', name: 'Hertfordshire' },
    { slug: 'kent', name: 'Kent' },
    { slug: 'lancashire', name: 'Lancashire' },
    { slug: 'surrey', name: 'Surrey' },
  ];

  function isCityPartnerSlotKey(key) {
    return String(key || '').indexOf('networking_city_partner_') === 0;
  }

  function isCountyPartnerSlotKey(key) {
    return String(key || '').indexOf('networking_county_partner_') === 0;
  }

  function isRegionPartnerSlotKey(key) {
    return isCityPartnerSlotKey(key) || isCountyPartnerSlotKey(key);
  }

  function cityPartnerSlugFromSlot(slotKey) {
    return String(slotKey || '').replace(/^networking_city_partner_/, '');
  }

  function countyPartnerSlugFromSlot(slotKey) {
    return String(slotKey || '').replace(/^networking_county_partner_/, '');
  }

  function cityPartnerSlotFromSlug(slug) {
    return 'networking_city_partner_' + String(slug || '').trim();
  }

  function countyPartnerSlotFromSlug(slug) {
    return 'networking_county_partner_' + String(slug || '').trim();
  }

  function cityPartnerPlacementPaths(slug) {
    return '/networking/' + slug + ' and /opportunities/networking/' + slug;
  }

  function countyPartnerPlacementPaths(slug) {
    return '/networking/' + slug + ' and /opportunities/networking/' + slug;
  }

  /** CMS ad placements — each maps to a cms_blocks.slot row. */
  var CMS_AD_SLOTS = [
    {
      key: 'events_sponsor_hub',
      group: 'Browse pages',
      label: 'Events browse — Powered by hero',
      preview: 'hero',
      help: 'Powered by hero on the Events browse page (/events/). Large clickable logo only when a logo is uploaded.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'organisers_sponsor_hub',
      group: 'Browse pages',
      label: 'Organisers browse — Powered by hero',
      preview: 'hero',
      help: 'Powered by hero when visitors switch to Organisers on /events/. Separate from the Events browse ad.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'opportunities_sponsor_hub',
      group: 'Browse pages',
      label: 'Opportunities browse — Powered by hero',
      preview: 'hero',
      help: 'Powered by hero on the Business opportunities browse page.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'event_page_carousel_ads',
      group: 'Detail pages',
      label: 'Event Page Partner — Mini Sponsors (3 slots)',
      preview: 'carousel',
      help: 'Up to three rotating Mini Sponsor logos on event detail pages and selected event/attendee emails. One inventory for both.',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'organiser_page_carousel_ads',
      group: 'Detail pages',
      label: 'Organiser Page Partner — Mini Sponsors (3 slots)',
      preview: 'carousel',
      help: 'Up to three rotating Mini Sponsor logos on organiser profile pages and selected organiser emails. One inventory for both; separate from Event Page Partner.',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'opportunity_page_carousel_ads',
      group: 'Detail pages',
      label: 'Opportunity Page Partner — Mini Sponsors (3 slots)',
      preview: 'carousel',
      help: 'Up to three rotating Mini Sponsor logos on opportunity detail pages and selected opportunity emails. One inventory for both; separate from Event and Organiser Page Partner.',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
  ];

  /** Old email-only carousel hashes → matching Page Partner inventory. */
  var EMAIL_MINI_TO_PAGE_CAROUSEL = {
    event_email_mini_sponsors: 'event_page_carousel_ads',
    organiser_email_mini_sponsors: 'organiser_page_carousel_ads',
    opportunity_email_mini_sponsors: 'opportunity_page_carousel_ads',
  };

  function cmsSlotByKey(key) {
    if (isCityPartnerSlotKey(key)) {
      var slug = cityPartnerSlugFromSlot(key);
      var region = null;
      for (var i = 0; i < NETWORKING_CITY_PARTNER_SLUGS.length; i++) {
        if (NETWORKING_CITY_PARTNER_SLUGS[i].slug === slug) {
          region = NETWORKING_CITY_PARTNER_SLUGS[i];
          break;
        }
      }
      return {
        key: key,
        group: 'City pages',
        label: 'City Partner — ' + (region ? region.name : slug),
        preview: 'city_partner',
        help: 'Logo + link on ' + cityPartnerPlacementPaths(slug) + ' — website only, not in emails.',
        tagline: '',
        ctaLabel: 'Find out more',
        ctaUrl: 'https://',
        ctaColor: '#2d2636',
      };
    }
    if (isCountyPartnerSlotKey(key)) {
      var countySlug = countyPartnerSlugFromSlot(key);
      var county = null;
      for (var c = 0; c < NETWORKING_COUNTY_PARTNER_SLUGS.length; c++) {
        if (NETWORKING_COUNTY_PARTNER_SLUGS[c].slug === countySlug) {
          county = NETWORKING_COUNTY_PARTNER_SLUGS[c];
          break;
        }
      }
      return {
        key: key,
        group: 'County pages',
        label: 'County Partner — ' + (county ? county.name : countySlug),
        preview: 'city_partner',
        help:
          'Logo + link on ' +
          countyPartnerPlacementPaths(countySlug) +
          ' — website only, not in emails. Manual placement from enquiry for launch counties.',
        tagline: '',
        ctaLabel: 'Find out more',
        ctaUrl: 'https://',
        ctaColor: '#2d2636',
      };
    }
    for (var j = 0; j < CMS_AD_SLOTS.length; j++) {
      if (CMS_AD_SLOTS[j].key === key) return CMS_AD_SLOTS[j];
    }
    return CMS_AD_SLOTS[0];
  }

  function cmsSlotExists(key) {
    if (isRegionPartnerSlotKey(key)) return true;
    for (var i = 0; i < CMS_AD_SLOTS.length; i++) {
      if (CMS_AD_SLOTS[i].key === key && CMS_AD_SLOTS[i].preview !== 'carousel') return true;
    }
    return false;
  }

  function sponsorshipBackLinkHtml() {
    return (
      '<a href="#sponsorship/placements" class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900 mb-4">' +
      '<span aria-hidden="true">←</span> All ad placements</a>'
    );
  }

  var shell = document.getElementById('admin-shell');
  var gate = document.getElementById('admin-gate');
  var main = document.getElementById('admin-main');
  var currentUser = null;
  var selectedUser = null;
  var adminLayoutResizeBound = false;

  function syncAdminLayoutOffset() {
    var nav = document.querySelector('.site-nav');
    var banner = document.getElementById('hub-impersonation-banner');
    var h = 0;
    if (nav) h += nav.offsetHeight;
    if (banner) h += banner.offsetHeight;
    if (h < 1) h = 76;
    document.documentElement.style.setProperty('--admin-nav-offset', Math.round(h) + 'px');
  }

  function bindAdminLayoutSync() {
    syncAdminLayoutOffset();
    if (adminLayoutResizeBound) return;
    adminLayoutResizeBound = true;
    window.addEventListener('resize', syncAdminLayoutOffset);
  }

  function fmtMoney(n) {
    return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function attrEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function formField(form, name) {
    if (!form || !form.elements) return null;
    return form.elements.namedItem(name);
  }

  function formFieldVal(form, name) {
    var el = formField(form, name);
    return el ? String(el.value || '').trim() : '';
  }

  function parseAdminHashQuery(fullHash) {
    var parts = String(fullHash || '').split('?');
    try {
      return new URLSearchParams(parts[1] || '');
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function groupCleanupHref(organiserId) {
    return organiserId ? '#cleanup/groups?organiser=' + encodeURIComponent(organiserId) : '#cleanup/groups';
  }

  function focusOrganiserInGroupCleanup(organiserId) {
    var id = String(organiserId || '').trim();
    if (!id) return;
    groupCleanupState.focusOrganiserId = id;
    groupCleanupState.expanded[id] = true;
    var row = document.querySelector('[data-organiser-id-row="' + id + '"]');
    if (row && row.scrollIntoView) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function normalizeAdminHash(hash) {
    var h = String(hash || 'dashboard').replace(/^#/, '');
    var legacy = {
      'group-cleanup': 'cleanup/groups',
      'event-cleanup': 'cleanup/events',
      'opportunity-cleanup': 'cleanup/opportunities',
      'event-health': 'cleanup/issues',
      campaigns: 'email/campaigns',
      emails: 'email/templates',
      impersonate: 'accounts/impersonate',
      users: 'accounts/users',
      import: 'moderation/import',
      featured: 'spotlight/events',
    };
    return legacy[h] || h;
  }

  function navRouteKey(hash) {
    var key = String(hash || '').split('/')[0];
    var parents = {
      'group-cleanup': 'cleanup',
      'event-cleanup': 'cleanup',
      'opportunity-cleanup': 'cleanup',
      'event-health': 'cleanup',
      campaigns: 'email',
      emails: 'email',
      impersonate: 'accounts',
      users: 'accounts',
      import: 'moderation',
      featured: 'spotlight',
    };
    return parents[key] || key;
  }

  function hubSubtitle(route, fullHash) {
    var hash = String(fullHash || '');
    if (route === 'cleanup') {
      if (hash.indexOf('issues') !== -1 || hash === 'event-health') {
        return PAGE_META['event-health'].subtitle;
      }
      if (hash.indexOf('events') !== -1 || hash === 'event-cleanup') {
        return PAGE_META['event-cleanup'].subtitle;
      }
      if (hash.indexOf('opportunities') !== -1 || hash === 'opportunity-cleanup') {
        return PAGE_META['opportunity-cleanup'].subtitle;
      }
      return PAGE_META['group-cleanup'].subtitle;
    }
    if (route === 'accounts') {
      return hash.indexOf('impersonate') !== -1
        ? PAGE_META.impersonate.subtitle
        : PAGE_META.users.subtitle;
    }
    if (route === 'email') {
      return hash.indexOf('templates') !== -1 ? PAGE_META.emails.subtitle : PAGE_META.campaigns.subtitle;
    }
    if (route === 'social') {
      return PAGE_META.social.subtitle;
    }
    if (route === 'moderation' && hash.indexOf('import') !== -1) {
      return PAGE_META.import.subtitle;
    }
    if (route === 'spotlight') {
      if (hash.indexOf('organisers') !== -1) return 'Featured networking groups on the Events browse page.';
      if (hash.indexOf('opportunities') !== -1) return 'Featured business opportunities on /opportunities/.';
      return PAGE_META.spotlight.subtitle;
    }
    if (route === 'support') {
      if (hash.indexOf('complaints') !== -1) {
        return 'Log complaints from hello@thenetworkerhub.com and track acknowledgement and 14-day response deadlines.';
      }
      return PAGE_META.support.subtitle;
    }
    if (route === 'analytics') {
      if (hash.indexOf('demand') !== -1) {
        return 'Searches, favourites, opportunity enquiries, and guest visits.';
      }
      if (hash.indexOf('insights') !== -1) {
        return 'Top performers, growth, locations, and quality signals.';
      }
      return 'Visitor traffic, Hub activity, and a recent activity feed.';
    }
    if (route === 'financials') {
      if (hash.indexOf('organisers') !== -1) {
        return 'Ticket revenue and Stripe Connect status by organiser.';
      }
      if (hash.indexOf('payouts') !== -1) {
        return 'Payout queue and refunds that need attention.';
      }
      if (hash.indexOf('activity') !== -1) {
        return 'Recent registration and payment activity.';
      }
      return 'Ticket revenue, booking fees, and payout health at a glance.';
    }
    if (route === 'moderation') {
      if (hash.indexOf('import') !== -1) return PAGE_META.import.subtitle;
      if (hash.indexOf('listings') !== -1) return 'Browse Hub events — jump to cleanup to edit.';
      if (hash.indexOf('reviews') !== -1) return 'Review spam-like or reported reviews.';
      return 'Open listing and review reports waiting for a decision.';
    }
    if (route === 'rankings') {
      if (hash.indexOf('history') !== -1) return 'Past monthly snapshots and congratulation emails.';
      return 'Current monthly top-performer snapshot and badge actions.';
    }
    if (route === 'revenue-targets') {
      if (hash.indexOf('chart') !== -1) return 'Forecast vs actual by month and category.';
      if (hash.indexOf('deals') !== -1) return 'Log offline sponsorship and advertising revenue.';
      return 'Progress against your sales targets.';
    }
    if (route === 'sponsorship') {
      if (hash.indexOf('partners') !== -1 || hash.indexOf('home-partners') !== -1 || hash.indexOf('city-partners') !== -1 || hash.indexOf('county-partners') !== -1) {
        return 'Home, city, and county partner placements.';
      }
      if (hash.indexOf('enquir') !== -1) return 'Advertising enquiries from the public form.';
      if (hash.indexOf('clicks') !== -1 || hash.indexOf('report') !== -1) {
        return 'Outbound sponsor clicks by brand and placement — for monthly packs.';
      }
      return 'Choose an ad placement to edit creatives and booking windows.';
    }
    return null;
  }

  function adminHubTabsHtml(tabs, activeKey) {
    return (
      '<nav class="admin-hub-tabs" aria-label="Section tabs">' +
      tabs
        .map(function (t) {
          var on = t.key === activeKey;
          return (
            '<a href="' +
            attrEsc(t.href) +
            '" class="admin-hub-tab' +
            (on ? ' is-active' : '') +
            '"' +
            (on ? ' aria-current="page"' : '') +
            (t.badgeKey ? ' data-hub-badge-key="' + attrEsc(t.badgeKey) + '"' : '') +
            '>' +
            esc(t.label) +
            (t.badgeHtml || '') +
            '</a>'
          );
        })
        .join('') +
      '</nav>'
    );
  }

  function withHubTabs(tabsHtml, renderFn) {
    var rootMain = main;
    rootMain.innerHTML = tabsHtml;
    var panel = document.createElement('div');
    panel.className = 'admin-hub-panel min-w-0';
    rootMain.appendChild(panel);
    main = panel;
    try {
      renderFn();
    } finally {
      main = rootMain;
    }
  }

  function setActiveNav(route, fullHash) {
    var navKey = navRouteKey(fullHash || route);
    document.querySelectorAll('.admin-nav-link').forEach(function (a) {
      var on = a.getAttribute('data-route') === navKey;
      a.classList.toggle('bg-white/15', on);
      a.classList.toggle('text-white', on);
      a.classList.toggle('text-white/80', !on);
    });
    var meta = PAGE_META[navKey] || PAGE_META[route] || PAGE_META.dashboard;
    var title = meta.title;
    var subtitle = hubSubtitle(navKey, fullHash) || meta.subtitle;
    if (route === 'sponsorship' && fullHash) {
      if (fullHash === 'sponsorship/home-partners') {
        title = 'Home page — Partners & sponsors';
        subtitle =
          'Logo strip on the home page. Add companies with logo, name, and website link — clickable logos only (no CTA button).';
      } else if (fullHash === 'sponsorship/city-partners') {
        title = 'City Partner placements';
        subtitle =
          'Logo + link on /networking/:city and /opportunities/networking/:city — website only, not in hub emails.';
      } else if (fullHash === 'sponsorship/county-partners') {
        title = 'County Partner placements';
        subtitle =
          'Logo + link on launch county pages — website only. Place manually from advertising enquiries.';
      } else if (fullHash === 'sponsorship/advertising-enquiries') {
        title = 'Advertising enquiries';
        subtitle =
          'Sponsorship form submissions from /advertising. Rosie is emailed automatically; use this list for follow-up.';
      } else if (fullHash === 'sponsorship/clicks-report' || fullHash === 'sponsorship/report') {
        title = 'Sponsor click report';
        subtitle =
          'Outbound clicks from Hub placements (heroes, partners, mini sponsors). Filter by brand and month for sponsor packs.';
      } else if (fullHash === 'sponsorship/event-page-carousel') {
        title = 'Event & organiser pages — Sponsor carousel (3 ads)';
        subtitle =
          'Manage up to three rotating sidebar logos on individual event and organiser profile pages. Each slot needs a logo and click-through link.';
      } else if (fullHash.indexOf('sponsorship/') === 0) {
        var slotKey = fullHash.slice('sponsorship/'.length);
        if (cmsSlotExists(slotKey)) {
          var slot = cmsSlotByKey(slotKey);
          title = slot.label;
          subtitle = slot.help;
        }
      }
    }
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;
    expandNavSectionForRoute(navKey);
    syncAdminPageGuide(route, fullHash || route);
    syncAdminLayoutOffset();
  }

  function adminGuideKey(route, fullHash) {
    var hash = String(fullHash || route || 'dashboard');
    if (route === 'cleanup' || hash.indexOf('cleanup/') === 0) {
      if (hash.indexOf('issues') !== -1 || hash === 'event-health') return 'event-health';
      if (hash.indexOf('events') !== -1 || hash === 'event-cleanup') return 'event-cleanup';
      if (hash.indexOf('opportunities') !== -1 || hash === 'opportunity-cleanup') return 'opportunity-cleanup';
      return 'group-cleanup';
    }
    if (route === 'accounts') {
      return hash.indexOf('impersonate') !== -1 ? 'impersonate' : 'users';
    }
    if (route === 'email') {
      return hash.indexOf('templates') !== -1 ? 'emails' : 'campaigns';
    }
    if (route === 'moderation' && hash.indexOf('import') !== -1) return 'import';
    if (route === 'support') {
      return hash.indexOf('complaints') !== -1 ? 'support-complaints' : 'support';
    }
    if (route === 'spotlight') {
      if (hash.indexOf('organisers') !== -1) return 'spotlight-organisers';
      if (hash.indexOf('opportunities') !== -1) return 'spotlight-opportunities';
      return 'spotlight';
    }
    return route || 'dashboard';
  }

  function setAdminGuideOpen(open) {
    var wrap = document.getElementById('admin-page-guide-wrap');
    var toggle = document.getElementById('admin-guide-toggle');
    if (!wrap || !toggle) return;
    var show = !!open;
    wrap.classList.toggle('hidden', !show);
    wrap.hidden = !show;
    toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
    toggle.textContent = show ? 'Hide guide' : 'How to use this page';
  }

  function syncAdminPageGuide(route, fullHash) {
    var guideKey = adminGuideKey(route, fullHash);
    var guide = ADMIN_GUIDES[guideKey];
    var toggle = document.getElementById('admin-guide-toggle');
    var titleEl = document.getElementById('admin-page-guide-title');
    var stepsEl = document.getElementById('admin-page-guide-steps');
    if (!toggle || !titleEl || !stepsEl) return;

    setAdminGuideOpen(false);

    if (!guide || !guide.steps || !guide.steps.length) {
      toggle.classList.add('hidden');
      toggle.hidden = true;
      stepsEl.innerHTML = '';
      return;
    }

    toggle.classList.remove('hidden');
    toggle.hidden = false;
    titleEl.textContent = guide.title || 'How to use this page';
    stepsEl.innerHTML = guide.steps
      .map(function (step) {
        return '<li>' + esc(step) + '</li>';
      })
      .join('');
  }

  function bindAdminPageGuides() {
    if (document.body.dataset.adminGuidesBound) return;
    document.body.dataset.adminGuidesBound = '1';
    var toggle = document.getElementById('admin-guide-toggle');
    var closeBtn = document.getElementById('admin-page-guide-close');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var wrap = document.getElementById('admin-page-guide-wrap');
        var isOpen = wrap && !wrap.hidden;
        setAdminGuideOpen(!isOpen);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        setAdminGuideOpen(false);
      });
    }
  }

  function readNavSectionState() {
    try {
      var raw = localStorage.getItem(ADMIN_NAV_SECTIONS_KEY);
      var state = raw ? JSON.parse(raw) : {};
      return state && typeof state === 'object' ? state : {};
    } catch (e) {
      return {};
    }
  }

  function writeNavSectionState(state) {
    try {
      localStorage.setItem(ADMIN_NAV_SECTIONS_KEY, JSON.stringify(state));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function readHubTabState() {
    try {
      var raw = localStorage.getItem(ADMIN_HUB_TABS_KEY);
      var state = raw ? JSON.parse(raw) : {};
      return state && typeof state === 'object' ? state : {};
    } catch (e) {
      return {};
    }
  }

  function rememberHubTab(hub, tab) {
    var key = String(hub || '').trim();
    var value = String(tab || '').trim();
    if (!key || !value) return;
    try {
      var state = readHubTabState();
      state[key] = value;
      localStorage.setItem(ADMIN_HUB_TABS_KEY, JSON.stringify(state));
    } catch (e) {
      /* ignore */
    }
  }

  function recalledHubTab(hub, fallback) {
    var state = readHubTabState();
    var value = state[String(hub || '')];
    return value ? String(value) : fallback;
  }

  /**
   * Resolve hub tab from hash. Bare `#hub` restores the last tab (redirect).
   * Returns null when a redirect was issued (hashchange will re-render).
   * options.pathFor(tab) maps tab keys to hash paths when they differ from hub/tab.
   */
  function resolveHubTab(fullHash, hub, allowedTabs, defaultTab, options) {
    var opts = options || {};
    var allowed = allowedTabs || [];
    var fallback = defaultTab || allowed[0] || 'overview';
    function pathForTab(tab) {
      if (typeof opts.pathFor === 'function') return opts.pathFor(tab);
      return hub + '/' + tab;
    }
    var explicit = hubHashTab(fullHash, '');
    if (explicit && allowed.indexOf(explicit) !== -1) {
      rememberHubTab(hub, explicit);
      return explicit;
    }
    // Sponsorship uses advertising-enquiries as the real path for the enquiries tab
    if (hub === 'sponsorship' && String(fullHash || '').indexOf('advertising-enquiries') !== -1) {
      rememberHubTab(hub, 'enquiries');
      return 'enquiries';
    }
    var bare = !explicit;
    if (bare) {
      var recalled = recalledHubTab(hub, fallback);
      if (allowed.indexOf(recalled) === -1) recalled = fallback;
      rememberHubTab(hub, recalled);
      if (recalled !== fallback) {
        location.replace('#' + pathForTab(recalled));
        return null;
      }
    }
    rememberHubTab(hub, fallback);
    return fallback;
  }

  function hubTabBadge(count) {
    var n = Number(count) || 0;
    if (n <= 0) return '';
    var label = n > 99 ? '99+' : String(n);
    return (
      '<span class="admin-hub-tab-badge" aria-label="' +
      attrEsc(label + ' needing attention') +
      '">' +
      esc(label) +
      '</span>'
    );
  }

  function hubBadgeCountForKey(key, counts) {
    var c = counts || {};
    if (key === 'openReports') {
      return (Number(c.openListingReports) || 0) + (Number(c.openReviewReports) || 0);
    }
    return Number(c[key]) || 0;
  }

  function syncLiveHubTabBadges(data) {
    var counts = (data && data.actionCounts) || {};
    document.querySelectorAll('a.admin-hub-tab[data-hub-badge-key]').forEach(function (tab) {
      var key = tab.getAttribute('data-hub-badge-key');
      if (!key) return;
      var n = hubBadgeCountForKey(key, counts);
      var badge = tab.querySelector('.admin-hub-tab-badge');
      if (n <= 0) {
        if (badge) badge.remove();
        return;
      }
      var label = n > 99 ? '99+' : String(n);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'admin-hub-tab-badge';
        tab.appendChild(badge);
      }
      badge.setAttribute('aria-label', label + ' needing attention');
      badge.textContent = label;
    });
  }

  function actionCountValue(key) {
    var cached = adminMetricsCache || readCachedAdminMetrics() || {};
    var counts = cached.actionCounts || {};
    return Number(counts[key]) || 0;
  }

  function navSectionForRoute(routeKey) {
    var key = String(routeKey || '');
    var sectionId;
    for (sectionId in NAV_SECTION_ROUTES) {
      if (NAV_SECTION_ROUTES[sectionId].indexOf(key) !== -1) return sectionId;
    }
    return null;
  }

  function setNavSectionExpanded(sectionId, expanded, persist) {
    var section = document.querySelector('[data-nav-section="' + sectionId + '"]');
    if (!section) return;
    var toggle = section.querySelector('.admin-nav-group-toggle');
    var links = section.querySelector('.admin-nav-section-links');
    if (!toggle || !links) return;
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    section.classList.toggle('is-collapsed', !expanded);
    if (persist !== false) {
      var state = readNavSectionState();
      state[sectionId] = expanded;
      writeNavSectionState(state);
    }
  }

  function expandNavSectionForRoute(routeKey) {
    var sectionId = navSectionForRoute(routeKey);
    if (sectionId) setNavSectionExpanded(sectionId, true);
  }

  function bindAdminSidebarGroups() {
    if (document.body.dataset.adminNavGroupsBound) return;
    document.body.dataset.adminNavGroupsBound = '1';
    var state = readNavSectionState();
    document.querySelectorAll('[data-nav-section]').forEach(function (section) {
      var id = section.getAttribute('data-nav-section');
      var expanded = state[id] !== false;
      setNavSectionExpanded(id, expanded, false);
      var toggle = section.querySelector('.admin-nav-group-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', function () {
        var isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        setNavSectionExpanded(id, !isExpanded);
      });
    });
  }

  function sumActionNotificationCounts(data) {
    var counts = data && data.actionCounts;
    if (counts) {
      return (
        (Number(counts.openListingReports) || 0) +
        (Number(counts.openReviewReports) || 0) +
        (Number(counts.spamReviews) || 0) +
        (Number(counts.pendingOpportunities) || 0) +
        (Number(counts.openClaimDisputes) || 0) +
        (Number(counts.openOrganiserClaimRequests) || 0)
      );
    }
    return Number(data && data.notificationCount) || 0;
  }

  function sidebarNotificationTotal(data) {
    var actionCount = sumActionNotificationCounts(data);
    var healthCount = healthCache && Number(healthCache.count) > 0 ? Number(healthCache.count) : 0;
    return actionCount + healthCount;
  }

  function updateHealthBadge(count) {
    var badge = document.getElementById('admin-health-badge');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.remove('hidden');
      badge.setAttribute('aria-label', n + ' items need attention');
    } else {
      badge.classList.add('hidden');
      badge.setAttribute('aria-label', 'No open admin alerts');
    }
  }

  function updateAdminDataBadge(updatedAt) {
    var badge = document.getElementById('admin-data-badge');
    if (!badge) return;
    badge.textContent = updatedAt ? 'Last updated ' + fmtTime(updatedAt) : 'Last updated';
    badge.title = updatedAt
      ? 'Numbers last refreshed at ' + fmtTime(updatedAt) + '. Click to refresh.'
      : 'Click to refresh the numbers below';
  }

  function actionPriorityLabel(severity) {
    if (severity === 'high') return 'Urgent';
    if (severity === 'medium') return 'Soon';
    return 'Later';
  }

  function actionPriorityClass(severity) {
    if (severity === 'high') return 'admin-action-priority--high';
    if (severity === 'medium') return 'admin-action-priority--medium';
    return 'admin-action-priority--low';
  }

  function actionQueueRow(a) {
    var priority =
      '<span class="admin-action-priority ' +
      actionPriorityClass(a.severity) +
      '">' +
      esc(actionPriorityLabel(a.severity)) +
      '</span>';
    var body =
      '<span class="admin-action-body"><span class="admin-action-title">' +
      esc(a.title) +
      '</span>' +
      (a.detail ? '<span class="admin-action-detail">' + esc(a.detail) + '</span>' : '') +
      '</span>';
    var go = a.href ? '<span class="admin-action-btn">Go there</span>' : '';
    if (a.href) {
      return (
        '<a href="' +
        esc(a.href) +
        '" class="admin-action-row">' +
        priority +
        body +
        go +
        '</a>'
      );
    }
    return (
      '<div class="admin-action-row admin-action-row--static">' + priority + body + go + '</div>'
    );
  }

  function collectDashboardAlerts(data) {
    var alerts = data && data.alerts ? data.alerts.slice() : [];
    var healthCount = healthCache && Number(healthCache.count) > 0 ? Number(healthCache.count) : 0;
    if (healthCount > 0 && !alerts.some(function (a) {
      return a.id === 'event-health';
    })) {
      alerts.unshift({
        id: 'event-health',
        severity: 'high',
        title:
          healthCount +
          ' event' +
          (healthCount === 1 ? '' : 's') +
          ' missing important details',
        detail: 'Add the date, organiser, VAT, or profile details.',
        href: '#cleanup/issues',
        time: new Date().toISOString(),
      });
    }
    var statsReminder = marketingStatsReviewQueueAlert();
    if (statsReminder && !alerts.some(function (a) {
      return a.id === statsReminder.id;
    })) {
      alerts.push(statsReminder);
    }
    var severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort(function (a, b) {
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
    return alerts;
  }

  function renderActionQueueHtml(data) {
    return collectDashboardAlerts(data).map(actionQueueRow).join('');
  }

  function syncDashboardActionSection(data) {
    var actionSection = document.getElementById('dashboard-action-section');
    var queueEl = document.getElementById('dashboard-action-queue');
    if (!actionSection || !queueEl) return;
    if (!data || data.error || data.configured === false) return;

    var alerts = collectDashboardAlerts(data);
    var hasActions = alerts.length > 0;
    actionSection.hidden = !hasActions;
    if (hasActions) {
      queueEl.innerHTML = alerts.map(actionQueueRow).join('');
    }
  }

  function dashboardAlertsHtml(data) {
    return renderActionQueueHtml(data);
  }

  function shouldRefreshHealth() {
    if (document.getElementById('event-health-list')) return true;
    if (!healthCacheFetchedAt) return true;
    return Date.now() - healthCacheFetchedAt > HEALTH_STALE_MS;
  }

  function readCachedAdminMetrics() {
    try {
      var raw = localStorage.getItem(ADMIN_METRICS_CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.error || data.configured === false || data.light) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeCachedAdminMetrics(data) {
    if (!data || data.error || data.configured === false || data.light) return;
    try {
      localStorage.setItem(ADMIN_METRICS_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      /* quota / private mode */
    }
  }

  function fetchAdminMetrics(force, light) {
    var useLight = !!light;
    if (!force && !useLight && adminMetricsInflight) return adminMetricsInflight;
    var url = '/api/admin/metrics' + (useLight ? '?light=1' : '');
    var req = adminGet(url).then(function (data) {
      if (!useLight && adminMetricsInflight === req) adminMetricsInflight = null;
      if (data && !data.error && data.configured !== false) {
        if (!data.light) {
          adminMetricsCache = data;
          writeCachedAdminMetrics(data);
        } else if (!adminMetricsCache) {
          adminMetricsCache = data;
        } else {
          adminMetricsCache = Object.assign({}, adminMetricsCache, {
            alerts: data.alerts,
            attention: data.attention,
            actionCounts: data.actionCounts,
            notificationCount: data.notificationCount,
            updatedAt: data.updatedAt,
          });
        }
      }
      return data;
    });
    if (!useLight) adminMetricsInflight = req;
    return req;
  }

  function applyDashboardNotifications(data) {
    if (!data || data.error || data.configured === false) return;
    if (!data.light) {
      adminMetricsCache = data;
      writeCachedAdminMetrics(data);
    }
    updateAdminDataBadge(data.updatedAt);

    var queueEl = document.getElementById('dashboard-action-queue');
    if (queueEl) {
      syncDashboardActionSection(data);
    }

    var alertsEl = document.getElementById('dashboard-alerts');
    if (alertsEl) {
      alertsEl.innerHTML = renderActionQueueHtml(data);
    }

    var attentionEl = document.getElementById('dashboard-attention');
    if (attentionEl) {
      applyAttentionQueue(data.attention);
    }

    var activityEl = document.getElementById('dashboard-activity');
    if (activityEl && !data.light) {
      activityEl.innerHTML = renderActivityList(data.activity, 12);
    }

    var disputesEl = document.getElementById('group-claim-disputes') || document.getElementById('dashboard-disputes');
    if (disputesEl) {
      disputesEl.innerHTML = renderClaimDisputesPanel(data.attention);
      if (disputesEl.id === 'dashboard-disputes') {
        var disputesSection = document.getElementById('dashboard-disputes-section');
        if (disputesSection) {
          var hasDisputes = data.attention && data.attention.openClaimDisputes && data.attention.openClaimDisputes.length;
          disputesSection.hidden = !hasDisputes;
        }
      }
    }

    var claimRequestsEl =
      document.getElementById('group-claim-requests') || document.getElementById('dashboard-claim-requests');
    if (claimRequestsEl) {
      claimRequestsEl.innerHTML = renderClaimRequestsPanel(data.attention);
      if (claimRequestsEl.id === 'dashboard-claim-requests') {
        var claimRequestsSection = document.getElementById('dashboard-claim-requests-section');
        if (claimRequestsSection) {
          var hasClaimRequests =
            data.attention &&
            data.attention.openOrganiserClaimRequests &&
            data.attention.openOrganiserClaimRequests.length;
          claimRequestsSection.hidden = !hasClaimRequests;
        }
      }
    }

    updateHealthBadge(sidebarNotificationTotal(data));
    syncScheduledRemindersSection();
    syncLiveHubTabBadges(data);
    syncNeedsAttentionStrip(data);
  }

  function refreshEventHealthQuietly(force) {
    if (!force && !shouldRefreshHealth()) {
      if (adminMetricsCache) updateHealthBadge(sidebarNotificationTotal(adminMetricsCache));
      return Promise.resolve(healthCache);
    }
    return fetchEventHealth().then(function (data) {
      if (data && !data.error && data.configured !== false) {
        healthCache = data;
        healthCacheFetchedAt = Date.now();
      }
      if (adminMetricsCache) {
        applyDashboardNotifications(adminMetricsCache);
      } else {
        updateHealthBadge(sidebarNotificationTotal({ notificationCount: 0 }));
      }
      return data;
    });
  }

  function refreshAdminNotifications(options) {
    var opts = options || {};
    var force = !!opts.forceHealth;
    var lightPromise = fetchAdminMetrics(force, true).then(function (data) {
      applyDashboardNotifications(data);
      return data;
    });
    fetchAdminMetrics(force, false).then(function (data) {
      applyDashboardNotifications(data);
      applyDashboardMetrics(data);
    });
    refreshEventHealthQuietly(force);
    return lightPromise;
  }

  function startAdminNotificationsPolling() {
    if (adminNotificationsTimer) clearInterval(adminNotificationsTimer);
    adminNotificationsTimer = setInterval(function () {
      refreshAdminNotifications();
    }, METRICS_POLL_MS);
  }

  function parseAdminFetchResponse(r, text) {
    var data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_parseErr) {
        var snippet = String(text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160);
        return {
          ok: false,
          error: 'invalid_response',
          message: snippet
            ? 'Server returned an unexpected response (HTTP ' + r.status + '): ' + snippet
            : 'Server returned an unexpected empty response (HTTP ' + r.status + ').',
        };
      }
    }
    data = data || {};
    if (r.ok && data.ok == null) data.ok = true;
    if (!r.ok) {
      data.error = data.error || data.message || 'request_failed';
      data.ok = false;
    }
    return data;
  }

  function adminGet(url) {
    return fetch(url, { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (text) {
          return parseAdminFetchResponse(r, text);
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: 'network_error',
          message: (err && err.message) || 'Request failed',
        };
      });
  }

  function adminPost(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return parseAdminFetchResponse(r, text);
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: 'network_error',
          message: (err && err.message) || 'Request failed',
        };
      });
  }

  function adminDelete(url, body) {
    return fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return parseAdminFetchResponse(r, text);
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: 'network_error',
          message: (err && err.message) || 'Request failed',
        };
      });
  }

  function adminPatch(url, body) {
    return fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return parseAdminFetchResponse(r, text);
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: 'network_error',
          message: (err && err.message) || 'Request failed',
        };
      });
  }

  function renderClaimDisputesPanel(attention) {
    var disputes = (attention && attention.openClaimDisputes) || [];
    if (!disputes.length) {
      return '<p class="text-sm text-emerald-700">No open group profile disputes.</p>';
    }
    return (
      '<div class="space-y-3">' +
      disputes
        .map(function (d) {
          var profileEmail = d.profileEmail || '—';
          var reporterEmail = d.reporterEmail || '—';
          var emailsMatch =
            profileEmail !== '—' &&
            reporterEmail !== '—' &&
            String(profileEmail).toLowerCase() === String(reporterEmail).toLowerCase();
          return (
            '<div class="rounded-lg border border-red-200 bg-red-50 p-4">' +
            '<p class="font-semibold text-sm text-red-900">' +
            esc(d.organiserName || 'Group profile') +
            '</p>' +
            '<dl class="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-red-900/90">' +
            '<div><dt class="font-semibold">Profile email on file</dt><dd>' +
            esc(profileEmail) +
            '</dd></div>' +
            '<div><dt class="font-semibold">Signed-in user who disputed</dt><dd>' +
            esc(reporterEmail) +
            '</dd></div></dl>' +
            (emailsMatch
              ? '<p class="text-xs text-red-800/85 mt-2">This user was matched because their login email matches the profile. Clear the profile email so they are not prompted again, or delete the listing if it is wrong.</p>'
              : '<p class="text-xs text-red-800/85 mt-2">Review the profile — update the contact email, delete the listing if it is wrong, or mark resolved once handled.</p>') +
            (d.notes
              ? '<p class="text-xs text-red-800/80 mt-2 italic">“' + esc(d.notes) + '”</p>'
              : '') +
            '<div class="flex flex-wrap gap-2 mt-3">' +
            (d.organiserId
              ? '<a href="' +
                attrEsc(groupCleanupHref(d.organiserId)) +
                '" class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">Edit profile</a>'
              : '') +
            (d.organiserId
              ? '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-red-200 px-2.5 py-1 text-red-800 hover:bg-red-100" data-clear-dispute-email="' +
                attrEsc(d.id) +
                '" data-dispute-organiser-name="' +
                attrEsc(d.organiserName || 'this group') +
                '">Clear profile email</button>'
              : '') +
            (d.organiserId
              ? '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-red-300 px-2.5 py-1 text-red-900 hover:bg-red-100" data-dispute-delete-profile="' +
                attrEsc(d.id) +
                '" data-dispute-organiser-id="' +
                attrEsc(d.organiserId) +
                '" data-dispute-organiser-name="' +
                attrEsc(d.organiserName || 'this group') +
                '">Delete profile</button>'
              : '') +
            '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-100" data-resolve-claim-dispute="' +
            esc(d.id) +
            '">Mark resolved</button></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderClaimRequestsPanel(attention) {
    var requests = (attention && attention.openOrganiserClaimRequests) || [];
    if (!requests.length) {
      return '<p class="text-sm text-emerald-700">No open organiser claim requests.</p>';
    }
    return (
      '<div class="space-y-3">' +
      requests
        .map(function (r) {
          var profileEmail = r.profileEmail || '—';
          return (
            '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
            '<p class="font-semibold text-sm text-amber-950">' +
            esc(r.organiserName || 'Group profile') +
            '</p>' +
            '<dl class="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-950/90">' +
            '<div><dt class="font-semibold">Claimant</dt><dd>' +
            esc(r.claimantName || '—') +
            ' · ' +
            esc(r.claimantEmail || '—') +
            '</dd></div>' +
            '<div><dt class="font-semibold">Profile email on file</dt><dd>' +
            esc(profileEmail) +
            '</dd></div>' +
            (r.claimantRole
              ? '<div class="sm:col-span-2"><dt class="font-semibold">Role</dt><dd>' +
                esc(r.claimantRole) +
                '</dd></div>'
              : '') +
            '</dl>' +
            (r.message
              ? '<p class="text-xs text-amber-900/85 mt-2 italic">“' + esc(r.message) + '”</p>'
              : '') +
            '<p class="text-xs text-amber-900/85 mt-2">Verify the claimant, then approve to update the profile email and send the claim invite.</p>' +
            '<div class="flex flex-wrap gap-2 mt-3">' +
            (r.organiserId
              ? '<a href="' +
                attrEsc(groupCleanupHref(r.organiserId)) +
                '" class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">Edit profile</a>'
              : '') +
            '<button type="button" class="text-xs font-semibold rounded-lg bg-amber-700 text-white px-2.5 py-1 hover:bg-amber-800" data-approve-organiser-claim-request="' +
            attrEsc(r.id) +
            '" data-claim-organiser-name="' +
            attrEsc(r.organiserName || 'this group') +
            '">Approve &amp; send claim link</button>' +
            '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-100" data-resolve-organiser-claim-request="' +
            esc(r.id) +
            '">Mark resolved</button></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderAttentionExtras(attention) {
    if (!attention) return '';
    var parts = [];

    if (attention.pendingPayouts > 0) {
      parts.push(
        '<div class="rounded-lg border border-red-200 bg-red-50 p-4">' +
          '<p class="font-semibold text-sm text-red-900">' +
          attention.pendingPayouts +
          ' payout request' +
          (attention.pendingPayouts === 1 ? '' : 's') +
          ' awaiting review</p>' +
          '<a href="#financials/payouts" class="text-xs font-semibold text-red-900 mt-2 inline-block hover:underline">Open Financials →</a></div>'
      );
    }

    if (attention.stripeOnboarding > 0) {
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="font-semibold text-sm text-amber-900">' +
          attention.stripeOnboarding +
          ' organiser' +
          (attention.stripeOnboarding === 1 ? '' : 's') +
          ' stuck in Stripe Connect onboarding</p>' +
          '<a href="#financials/organisers" class="text-xs font-semibold text-amber-900 mt-2 inline-block hover:underline">Check Stripe status →</a></div>'
      );
    }

    if (attention.openListingReports > 0) {
      var reportItems = attention.openListingReportItems || [];
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="font-semibold text-sm text-amber-900">' +
          attention.openListingReports +
          ' open listing report' +
          (attention.openListingReports === 1 ? '' : 's') +
          '</p>'
      );
      if (reportItems.length) {
        parts.push('<div class="mt-3 space-y-2">');
        reportItems.forEach(function (r) {
          var reasonLabels = {
            misleading: 'Misleading',
            spam: 'Spam',
            wrong_details: 'Wrong details',
            offensive: 'Offensive',
            duplicate: 'Duplicate',
            other: 'Other',
          };
          parts.push(
            '<div class="rounded-md border border-amber-200/80 bg-white/80 p-3 text-sm">' +
              '<p class="font-semibold text-brand-900">' +
              esc(r.title) +
              ' <span class="text-xs font-normal text-slate-500">(' +
              esc(r.listingType === 'organiser' ? 'Group' : 'Event') +
              ')</span></p>' +
              '<p class="text-xs text-amber-900 mt-1">' +
              esc(reasonLabels[r.reason] || r.reason) +
              (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '') +
              '</p>' +
              (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
              '</div>'
          );
        });
        parts.push('</div>');
      }
      parts.push(
        '<a href="#moderation/reports" class="text-xs font-semibold text-amber-900 mt-3 inline-block hover:underline">Dismiss on moderation page →</a></div>'
      );
    }

    if (attention.openReviewReports > 0) {
      var reviewReportItems = attention.openReviewReportItems || [];
      parts.push(
        '<div class="rounded-lg border border-violet-200 bg-violet-50 p-4">' +
          '<p class="font-semibold text-sm text-violet-900">' +
          attention.openReviewReports +
          ' open review report' +
          (attention.openReviewReports === 1 ? '' : 's') +
          '</p>'
      );
      if (reviewReportItems.length) {
        parts.push('<div class="mt-3 space-y-2">');
        reviewReportItems.forEach(function (r) {
          parts.push(
            '<div class="rounded-md border border-violet-200/80 bg-white/80 p-3 text-sm">' +
              '<p class="text-xs text-violet-900">' +
              esc(r.snippet || 'Review report') +
              (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '') +
              '</p>' +
              (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
              '</div>'
          );
        });
        parts.push('</div>');
      }
      parts.push(
        '<a href="#moderation/reports" class="text-xs font-semibold text-violet-900 mt-3 inline-block hover:underline">Dismiss on moderation page →</a></div>'
      );
    }

    var pendingOpps = attention.pendingOpportunities || [];
    var pendingOppsTotal = attention.pendingOpportunitiesTotal || pendingOpps.length;
    if (pendingOppsTotal > 0) {
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="text-xs font-semibold uppercase tracking-wide text-amber-800/80">Business opportunities pending review (' +
          pendingOppsTotal +
          ')</p>' +
          '<ul class="mt-2 space-y-1.5">'
      );
      pendingOpps.slice(0, 6).forEach(function (o) {
        parts.push(
          '<li class="text-sm text-amber-900"><span class="font-medium">' +
            esc(o.title) +
            '</span> <span class="text-xs text-amber-800/80">· ' +
            esc(o.host) +
            '</span></li>'
        );
      });
      parts.push(
        '</ul><a href="#cleanup/opportunities?approval=pending" class="text-xs font-semibold text-amber-900 mt-3 inline-block hover:underline">Review opportunities →</a></div>'
      );
    }

    var links = [];
    if (attention.incompleteOrganisers > 0) {
      links.push(
        '<a href="#cleanup/groups" class="text-sm font-semibold text-brand-700 hover:underline">' +
          attention.incompleteOrganisers +
          ' organiser profile' +
          (attention.incompleteOrganisers === 1 ? '' : 's') +
          ' missing data</a>'
      );
    }
    if (attention.spamReviews > 0) {
      links.push(
        '<a href="#moderation/reviews" class="text-sm font-semibold text-brand-700 hover:underline">' +
          attention.spamReviews +
          ' spam-like review' +
          (attention.spamReviews === 1 ? '' : 's') +
          '</a>'
      );
    }
    if (links.length) {
      parts.push('<div class="flex flex-wrap gap-x-4 gap-y-2 mt-3">' + links.join('') + '</div>');
    }

    return parts.join('');
  }

  function applyAttentionQueue(attention) {
    var ownership = document.getElementById('attention-ownership');
    var title = document.getElementById('attention-ownership-title');
    var extra = document.getElementById('attention-extra');
    var container = document.getElementById('dashboard-attention');

    if (!attention) {
      if (container && !ownership) {
        container.innerHTML = '<p class="text-sm text-slate-500">Loading…</p>';
      }
      return;
    }

    var claims = Number(attention.pendingOwnershipClaims) || 0;
    var extrasHtml = renderAttentionExtras(attention);
    var hasAnything = claims > 0 || !!extrasHtml;

    if (ownership && title) {
      if (claims > 0) {
        ownership.hidden = false;
        title.textContent =
          claims +
          ' group profile' +
          (claims === 1 ? '' : 's') +
          ' awaiting organiser claim on first login';
      } else {
        ownership.hidden = true;
      }
      if (extra) extra.innerHTML = extrasHtml;
      if (!hasAnything && extra) {
        extra.innerHTML = '<p class="text-sm text-emerald-700">Nothing needs immediate action right now.</p>';
      }
      return;
    }

    if (container) {
      container.innerHTML = renderAttentionQueue(attention);
    }
  }

  function needsAttentionChips(data) {
    var counts = (data && data.actionCounts) || {};
    var healthCount = healthCache && Number(healthCache.count) > 0 ? Number(healthCache.count) : 0;
    var chips = [];
    function push(n, label, href, tone) {
      var count = Number(n) || 0;
      if (count <= 0) return;
      chips.push({
        count: count,
        label: label,
        href: href,
        tone: tone || 'amber',
      });
    }
    push(counts.pendingPayouts, 'Payouts to process', '#financials/payouts', 'rose');
    push(
      (Number(counts.openListingReports) || 0) + (Number(counts.openReviewReports) || 0),
      'Open reports',
      '#moderation/reports',
      'amber'
    );
    push(counts.openComplaints, 'Complaints', '#support/complaints', 'amber');
    push(counts.incompleteOrganisers, 'Incomplete groups', '#cleanup/groups', 'slate');
    push(counts.pendingOpportunities, 'Opportunity reviews', '#cleanup/opportunities', 'slate');
    push(healthCount, 'Event data issues', '#cleanup/issues', 'slate');
    return chips;
  }

  function syncNeedsAttentionStrip(data) {
    var section = document.getElementById('dashboard-needs-attention');
    var body = document.getElementById('dashboard-needs-attention-body');
    if (!section || !body) return;
    if (!data || data.error || data.configured === false) return;
    var chips = needsAttentionChips(data);
    if (!chips.length) {
      section.hidden = true;
      body.innerHTML = '';
      return;
    }
    section.hidden = false;
    body.innerHTML = chips
      .map(function (chip) {
        return (
          '<a href="' +
          attrEsc(chip.href) +
          '" class="admin-needs-chip admin-needs-chip--' +
          attrEsc(chip.tone) +
          '">' +
          '<span class="admin-needs-chip-count">' +
          esc(String(chip.count > 99 ? '99+' : chip.count)) +
          '</span>' +
          '<span class="admin-needs-chip-label">' +
          esc(chip.label) +
          '</span></a>'
        );
      })
      .join('');
  }

  function renderAttentionQueue(attention) {
    if (!attention) {
      return '<p class="text-sm text-slate-500">Loading…</p>';
    }
    var parts = [];
    var claims = Number(attention.pendingOwnershipClaims) || 0;

    if (claims > 0) {
      parts.push(
        '<div id="attention-ownership" class="rounded-lg border border-brand-200 bg-brand-50 p-4">' +
          '<p id="attention-ownership-title" class="font-semibold text-sm text-brand-900">' +
          claims +
          ' group profile' +
          (claims === 1 ? '' : 's') +
          ' awaiting organiser claim on first login</p>' +
          '<p id="attention-ownership-lcp" class="text-xs text-brand-800/90 mt-1">Organisers will confirm ownership when they sign in — disputes appear here if they reject a match.</p></div>'
      );
    }

    var extras = renderAttentionExtras(attention);
    if (extras) {
      parts.push('<div id="attention-extra" class="space-y-3">' + extras + '</div>');
    } else if (!parts.length) {
      return '<p class="text-sm text-emerald-700">Nothing needs immediate action right now.</p>';
    } else {
      parts.push('<div id="attention-extra" class="space-y-3"></div>');
    }
    return parts.join('');
  }

  function fetchEventHealth() {
    return fetch('/api/admin/event-health', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) {
            data = data || {};
            data.error = data.error || 'request_failed';
            return data;
          }
          if (data && data.configured !== false) {
            healthCache = data;
          }
          return data;
        });
      })
      .catch(function () {
        return { error: 'network_error' };
      });
  }

  function issueBadge(issue) {
    var cls =
      issue.severity === 'high'
        ? 'bg-red-100 text-red-800'
        : issue.severity === 'medium'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';
    return (
      '<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 ' +
      cls +
      '">' +
      esc(issue.label) +
      '</span>'
    );
  }

  function toDatetimeLocalValue(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var pad = function (n) {
        return String(n).padStart(2, '0');
      };
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch (e) {
      return '';
    }
  }

  var HEALTH_SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
  var EVENT_HEALTH_HISTORY_KEY = 'tnh_event_health_completed_v1';
  var EVENT_HEALTH_HISTORY_MAX = 15;

  function loadEventHealthHistory() {
    try {
      var raw = localStorage.getItem(EVENT_HEALTH_HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function pushEventHealthCompletion(entry) {
    var list = loadEventHealthHistory().filter(function (x) {
      return x.eventId !== entry.eventId;
    });
    list.unshift(entry);
    if (list.length > EVENT_HEALTH_HISTORY_MAX) {
      list = list.slice(0, EVENT_HEALTH_HISTORY_MAX);
    }
    try {
      localStorage.setItem(EVENT_HEALTH_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  function recordEventHealthCompletion(beforeEv, afterData) {
    if (!beforeEv || !beforeEv.id) return;
    var stillFlagged = (afterData.events || []).some(function (e) {
      return e.id === beforeEv.id;
    });
    if (stillFlagged) return;
    pushEventHealthCompletion({
      eventId: beforeEv.id,
      title: beforeEv.title || 'Untitled',
      slug: beforeEv.slug || '',
      fixedIssues: (beforeEv.issues || []).map(function (i) {
        return i.label;
      }),
      completedAt: new Date().toISOString(),
    });
  }

  function eventSeverityRank(ev) {
    var rank = 9;
    (ev.issues || []).forEach(function (i) {
      var order = HEALTH_SEVERITY_ORDER[i.severity];
      if (order != null && order < rank) rank = order;
    });
    return rank;
  }

  function mergeHealthCompletions(serverList) {
    var merged = [];
    var seen = {};
    (serverList || []).forEach(function (item) {
      var key = item.eventId || item.title;
      if (seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });
    loadEventHealthHistory().forEach(function (item) {
      var key = item.eventId || item.title;
      if (seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });
    return merged.slice(0, 15);
  }

  function renderEventHealthCompletedHtml(serverList) {
    var list = mergeHealthCompletions(serverList);
    if (!list.length) {
      return (
        '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">' +
        '<h3 class="font-bold text-brand-900 text-sm">Recently completed</h3>' +
        '<p class="text-sm text-slate-500 mt-2">Fixes you save here will appear in this list (synced to Supabase when available).</p></section>'
      );
    }
    return (
      '<section class="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">' +
      '<h3 class="font-bold text-emerald-900 text-sm">Recently completed</h3>' +
      '<p class="text-xs text-emerald-800/80 mt-0.5">Events that passed the health scan after your last save.</p></div>' +
      '<ul class="divide-y divide-slate-100">' +
      list
        .map(function (item) {
          var issues =
            item.fixedIssues && item.fixedIssues.length
              ? item.fixedIssues.join(', ')
              : 'All issues cleared';
          var eventHref = item.slug
            ? '../events/' + encodeURIComponent(item.slug)
            : '';
          return (
            '<li class="px-4 py-3 flex flex-wrap items-start justify-between gap-3">' +
            '<div class="min-w-0">' +
            '<p class="font-medium text-brand-900">' +
            esc(item.title) +
            '</p>' +
            '<p class="text-xs text-slate-500 mt-0.5">' +
            esc(issues) +
            '</p>' +
            '<time class="text-xs text-slate-400 mt-1 block">' +
            esc(fmtTime(item.completedAt)) +
            '</time></div>' +
            (eventHref
              ? '<a href="' +
                attrEsc(eventHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline shrink-0">View event</a>'
              : '') +
            '</li>'
          );
        })
        .join('') +
      '</ul></section>'
    );
  }

  function paintEventHealthCompleted(serverList) {
    var slot = document.getElementById('event-health-completed');
    if (slot) slot.innerHTML = renderEventHealthCompletedHtml(serverList);
  }

  function eventMatchesIssueFilter(ev, filter) {
    if (!filter || filter === 'all') return true;
    return issueCodes(ev).indexOf(filter) >= 0;
  }

  function logEventHealthCompletionRemote(beforeEv) {
    if (!beforeEv || !beforeEv.id) return Promise.resolve();
    return fetch('/api/admin/event-health', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: beforeEv.id,
        title: beforeEv.title || 'Untitled',
        slug: beforeEv.slug || '',
        fixed_issues: (beforeEv.issues || []).map(function (i) {
          return i.label;
        }),
      }),
    }).catch(function () {
      return null;
    });
  }

  function bulkAssignFirstOrganiser(events, organisers) {
    var sorted = organisers.slice().sort(function (a, b) {
      var aPub = a.listingStatus === 'published' ? 0 : 1;
      var bPub = b.listingStatus === 'published' ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    var firstId = sorted.length ? sorted[0].id : '';
    if (!firstId) {
      window.alert('No organisers available — create one first.');
      return;
    }
    var targets = (events || []).filter(function (ev) {
      var codes = issueCodes(ev);
      return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
    });
    if (!targets.length) return;
    if (
      !window.confirm(
        'Assign "' +
          (sorted[0].name || 'first organiser') +
          '" to ' +
          targets.length +
          ' event' +
          (targets.length === 1 ? '' : 's') +
          ' missing an organiser?'
      )
    ) {
      return;
    }
    var chain = Promise.resolve();
    targets.forEach(function (ev) {
      chain = chain.then(function () {
        return fetch('/api/admin/events', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ev.id, organiser_id: firstId }),
        }).then(function (r) {
          return r.json();
        });
      });
    });
    chain
      .then(function () {
        return fetchEventHealth();
      })
      .then(function () {
        renderEventHealth();
      })
      .catch(function (err) {
        window.alert(err.message || 'Bulk assign failed.');
      });
  }

  function summarizeEventCommerceRows(rows) {
    var summary = {
      count: (rows || []).length,
      withBookings: 0,
      totalRegistrations: 0,
      totalPaidBookings: 0,
      pastOrArchived: 0,
      deletable: 0,
    };
    (rows || []).forEach(function (ev) {
      var regCount = Math.max(0, Number(ev.registration_count) || 0);
      var paid = Math.max(0, Number(ev.paid_booking_count) || 0);
      var locked = Boolean(ev.locked);
      if (regCount > 0 || locked) summary.withBookings += 1;
      else summary.deletable += 1;
      summary.totalRegistrations += regCount;
      summary.totalPaidBookings += paid;
      var status = String(ev.status || '').toLowerCase();
      var anchor = ev.ends_at || ev.starts_at;
      var ended = anchor && !Number.isNaN(new Date(anchor).getTime()) && new Date(anchor) < new Date();
      if (status === 'archived' || ended) summary.pastOrArchived += 1;
    });
    return summary;
  }

  function applyEventModerationButtonStates(prefix, rows) {
    var summary = summarizeEventCommerceRows(rows);
    var unpublishBtn = document.getElementById(prefix + '-unpublish-btn');
    var deleteBtn = document.getElementById(prefix + '-delete-btn');
    var cancelBtn = document.getElementById(prefix + '-force-delete-btn');
    if (unpublishBtn) {
      unpublishBtn.disabled = summary.count === 0;
      unpublishBtn.title = 'Hide from browse and stop ticket sales — bookings and revenue stay intact';
    }
    if (deleteBtn) {
      deleteBtn.disabled = summary.withBookings > 0;
      deleteBtn.title =
        summary.withBookings > 0
          ? 'Only available when no selected events have registrations or ticket sales'
          : 'Permanently delete draft events with no registrations';
    }
    if (cancelBtn) {
      cancelBtn.disabled = summary.withBookings === 0;
      cancelBtn.title =
        summary.withBookings === 0
          ? 'Only needed when selected events have registrations or ticket sales'
          : 'Cancel the event, refund every paid attendee, and email the organiser';
    }
  }

  function unpublishSelectedEvents(options) {
    var getIds = options && options.getIds;
    var clearSelection = options && options.clearSelection;
    var refresh = options && options.refresh;
    var msgEl = document.getElementById((options && options.msgId) || 'event-unpublish-msg');
    var btn = document.getElementById((options && options.btnId) || 'event-unpublish-btn');
    var ids = getIds ? getIds() : [];
    if (!ids.length) return;

    promptAdminUnpublish(ids.length)
      .then(function (payload) {
        if (btn) btn.disabled = true;
        if (msgEl) {
          msgEl.textContent = 'Unpublishing…';
          msgEl.className = 'text-xs text-slate-500';
        }
        return adminPost('/api/admin/events', {
          action: 'bulk_unpublish',
          ids: ids,
          reason: payload.reason,
          details: payload.details,
          notify_organiser: payload.notifyOrganiser !== false,
        }).then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Unpublish failed');
          if (clearSelection) clearSelection();
          var parts = [
            'Unpublished ' +
              (data.unpublished || 0) +
              ' event' +
              ((data.unpublished || 0) === 1 ? '' : 's') +
              '.',
          ];
          if (data.skipped && data.skipped.length) {
            parts.push('Skipped ' + data.skipped.length + '.');
          }
          if (msgEl) {
            msgEl.textContent = parts.join(' ');
            msgEl.className = 'text-xs text-emerald-700 font-semibold';
          }
          return refresh ? refresh() : null;
        });
      })
      .catch(function (err) {
        if (err && err.message === 'cancelled') return;
        if (msgEl) {
          msgEl.textContent = (err && err.message) || 'Could not unpublish events';
          msgEl.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function reinstateSelectedEvent(eventId, targetStatus, msgEl, btn) {
    if (!eventId) return;
    var statusLabel = targetStatus === 'published' ? 'republish' : 'restore as unpublished';
    if (
      !window.confirm(
        'Reinstate this event and ' +
          statusLabel +
          '?\n\nOnly available when refunds have not been confirmed. Existing bookings will be restored.'
      )
    ) {
      return;
    }
    if (btn) btn.disabled = true;
    if (msgEl) {
      msgEl.textContent = 'Reinstating…';
      msgEl.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/events', {
      action: 'reinstate_event',
      event_id: eventId,
      status: targetStatus,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Reinstate failed');
        if (msgEl) {
          msgEl.textContent = 'Event reinstated.';
          msgEl.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshEventCleanupData();
      })
      .then(function () {
        updateEventBulkBar();
      })
      .catch(function (err) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Could not reinstate event';
          msgEl.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function retryEventRefunds(eventId, btn) {
    if (!eventId) return;
    if (
      !window.confirm(
        'Retry automatic Stripe refunds for this cancelled event?\n\nUse this when refunds failed or are still processing.'
      )
    ) {
      return;
    }
    if (btn) btn.disabled = true;
    adminPost('/api/admin/events', { action: 'retry_event_refunds', event_id: eventId })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Refund retry failed');
        var msg = data.refundsConfirmed
          ? 'Refunds confirmed in Stripe.'
          : 'Refund attempt sent — check Stripe and retry if needed.';
        window.alert(msg);
        if (typeof refreshFinancialsView === 'function') refreshFinancialsView();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not retry refunds');
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }

  function rememberSelectedHealthEvent(ev) {
    if (!ev || ev.id == null) return;
    eventHealthState.selected[String(ev.id)] = {
      id: ev.id,
      title: ev.title || 'Untitled',
      organiser_name: ev.organiser_name || '',
      status: ev.status || '',
      starts_at: ev.starts_at || '',
      ends_at: ev.ends_at || '',
      locked: Boolean(ev.locked),
      registration_count: Math.max(0, Number(ev.registration_count) || 0),
      paid_booking_count: Math.max(0, Number(ev.paid_booking_count) || 0),
    };
  }

  function forgetSelectedHealthEvent(id) {
    delete eventHealthState.selected[String(id)];
  }

  function clearSelectedHealthEvents() {
    eventHealthState.selected = {};
  }

  function getSelectedHealthEventIds() {
    return Object.keys(eventHealthState.selected);
  }

  function selectedHealthRows() {
    return getSelectedHealthEventIds().map(function (id) {
      return eventHealthState.selected[id];
    });
  }

  function updateHealthBulkBar() {
    var bar = document.getElementById('event-health-bulk');
    var countEl = document.getElementById('health-bulk-count');
    var chipsEl = document.getElementById('health-selected-chips');
    var deleteSection = document.getElementById('health-delete-section');
    var moderationSection = document.getElementById('health-moderation-section');
    var ids = getSelectedHealthEventIds();
    var rows = selectedHealthRows();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
    if (deleteSection) deleteSection.classList.toggle('hidden', ids.length === 0);
    if (moderationSection) moderationSection.classList.toggle('hidden', ids.length === 0);
    if (chipsEl) {
      chipsEl.innerHTML = rows
        .map(function (ev) {
          var label = ev.title || 'Untitled';
          if (ev.organiser_name) label += ' · ' + ev.organiser_name;
          return (
            '<span class="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-900">' +
            '<span class="truncate max-w-[14rem]" title="' +
            attrEsc(label) +
            '">' +
            esc(label) +
            '</span>' +
            '<button type="button" class="health-unselect shrink-0 text-slate-400 hover:text-red-700 font-bold leading-none" data-unselect-health-event="' +
            attrEsc(ev.id) +
            '" aria-label="Remove ' +
            attrEsc(ev.title || 'event') +
            ' from selection">×</button></span>'
          );
        })
        .join('');
    }
    if (main) {
      var selectPage = document.getElementById('event-health-select-page');
      var pageCbs = main.querySelectorAll('.health-select-checkbox');
      var allPageChecked = pageCbs.length > 0;
      pageCbs.forEach(function (cb) {
        if (!eventHealthState.selected[cb.value]) allPageChecked = false;
      });
      if (selectPage) selectPage.checked = allPageChecked;
    }
    applyEventModerationButtonStates('health', rows);
  }

  function deleteSelectedHealthEvents(force) {
    var ids = getSelectedHealthEventIds();
    if (!ids.length) return;
    var msg = document.getElementById('health-delete-msg');
    var btn = force
      ? document.getElementById('health-force-delete-btn')
      : document.getElementById('health-delete-btn');

    function runDelete(extra) {
      if (btn) btn.disabled = true;
      if (msg) {
        msg.textContent = force ? 'Cancelling & refunding…' : 'Deleting…';
        msg.className = 'text-xs text-slate-500';
      }
      postAdminEventBulkDelete(ids, {
        force: !!force,
        reason: extra && extra.reason,
        details: extra && extra.details,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
          clearSelectedHealthEvents();
          if (msg) {
            msg.textContent = formatEventBulkDeleteResult(data) || 'Done.';
            msg.className = 'text-xs text-emerald-700 font-semibold';
          }
          return fetchEventHealth();
        })
        .then(function () {
          renderEventHealth();
        })
        .catch(function (err) {
          if (msg) {
            msg.textContent = err.message || 'Could not delete events';
            msg.className = 'text-xs text-red-700 font-semibold';
          }
          if (btn) btn.disabled = false;
        });
    }

    if (force) {
      promptAdminForceRemove(selectedHealthRows())
        .then(function (payload) {
          runDelete(payload);
        })
        .catch(function () {
          /* cancelled */
        });
      return;
    }
    if (!window.confirm(eventDeleteConfirmMsg(ids.length, false))) return;
    runDelete(null);
  }

  function deleteSingleHealthEvent(eventId, title, triggerBtn) {
    if (!eventId) return;
    if (
      !window.confirm(
        'Permanently delete “' +
          (title || 'this event') +
          '”?\n\nOnly empty events with no registrations can be deleted. If it has bookings, unpublish the listing or use Cancel & refund bookings from the bulk bar.'
      )
    ) {
      return;
    }
    if (triggerBtn) triggerBtn.disabled = true;
    adminPost('/api/admin/events', { action: 'bulk_delete', ids: [eventId] })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
        if (data.deleted) {
          forgetSelectedHealthEvent(eventId);
          return fetchEventHealth();
        }
        if (data.skipped && data.skipped.length) {
          throw new Error(formatEventBulkSkipped(data.skipped) || 'Could not delete this event');
        }
        throw new Error('Could not delete this event');
      })
      .then(function () {
        renderEventHealth();
      })
      .catch(function (err) {
        if (triggerBtn) triggerBtn.disabled = false;
        window.alert(err.message || 'Could not delete event');
      });
  }

  function saveHealthBulkForm(form) {
    var ids = getSelectedHealthEventIds();
    var msg = document.getElementById('health-bulk-msg');
    var btn = form.querySelector('[type="submit"]');
    if (!ids.length) return;
    var payload = { action: 'bulk_update', ids: ids };
    var organiserVal = formFieldVal(form, 'bulk_organiser_id');
    if (organiserVal === '__unlink__') payload.unlink_organiser = true;
    else if (organiserVal) payload.organiser_id = organiserVal;
    var startsAt = formFieldVal(form, 'bulk_starts_at');
    if (startsAt) payload.starts_at = startsAt;
    var eventType = formFieldVal(form, 'bulk_event_type');
    if (eventType) payload.event_type = eventType;
    var meetingType = formFieldVal(form, 'bulk_meeting_type');
    if (meetingType) payload.meeting_type = meetingType;
    var vat = formFieldVal(form, 'bulk_vat_treatment');
    if (vat) payload.vat_treatment = vat;
    if (
      !payload.organiser_id &&
      !payload.unlink_organiser &&
      !payload.starts_at &&
      !payload.event_type &&
      !payload.meeting_type &&
      !payload.vat_treatment
    ) {
      if (msg) {
        msg.textContent = 'Choose at least one field to apply.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Applying…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/events', payload)
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Bulk update failed');
        var parts = ['Updated ' + (data.updated || 0) + ' event' + ((data.updated || 0) === 1 ? '' : 's') + '.'];
        if (data.skipped && data.skipped.length) {
          parts.push('Skipped ' + data.skipped.length + '.');
        }
        if (msg) {
          msg.textContent = parts.join(' ');
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return fetchEventHealth();
      })
      .then(function () {
        renderEventHealth();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not apply fixes';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function issueCodes(ev) {
    return (ev.issues || []).map(function (i) {
      return i.code;
    });
  }

  function healthFieldVisibility(ev) {
    var codes = issueCodes(ev);
    return {
      showDate:
        codes.indexOf('missing_date') >= 0 || codes.indexOf('stale_past_date') >= 0,
      showOrganiser:
        codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0,
      showInvalidOrganiser: codes.indexOf('invalid_organiser') >= 0,
      showOrganiserNotPublished: codes.indexOf('organiser_not_published') >= 0,
      showEventType: codes.indexOf('missing_event_type') >= 0,
      showFormat: codes.indexOf('missing_meeting_type') >= 0,
      showVat: codes.indexOf('missing_vat') >= 0,
      showOrgLogo: codes.indexOf('missing_organiser_logo') >= 0,
      showOrgBio: codes.indexOf('missing_organiser_profile') >= 0,
    };
  }

  function mergeOrganisersForSelect(allOrganisers, ev) {
    var list = (allOrganisers || []).slice();
    if (
      ev.organiser_id &&
      !list.some(function (o) {
        return String(o.id) === String(ev.organiser_id);
      })
    ) {
      list.unshift({
        id: ev.organiser_id,
        name: ev.organiser_name || ev.organiser_id,
        listingStatus: '',
        slug: ev.organiser_slug || '',
      });
    }
    return list;
  }

  function organiserOptionsHtml(organisers, selectedId) {
    var selected = String(selectedId || '');
    var sorted = (organisers || []).slice().sort(function (a, b) {
      var aPub = a.listingStatus === 'published' ? 0 : 1;
      var bPub = b.listingStatus === 'published' ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return (
      '<option value="">— Choose organiser —</option>' +
      sorted
        .map(function (o) {
          var label = o.name || o.id;
          if (o.email) label += ' · ' + o.email;
          if (o.listingStatus && o.listingStatus !== 'published') {
            label += ' (' + o.listingStatus + ')';
          }
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (selected && selected === String(o.id) ? ' selected' : '') +
            '>' +
            esc(label) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function saveEventHealthForm(form) {
    var article = form.closest('[data-event-id]');
    var id = article && article.getAttribute('data-event-id');
    var organiserId = article && article.getAttribute('data-organiser-id');
    var msg = form.querySelector('.event-health-msg');
    var btn = form.querySelector('button[type="submit"]');
    if (!id) return;

    var eventPayload = { id: id };
    var hasEventPatch = false;
    if (formField(form, 'starts_at')) {
      var starts = formFieldVal(form, 'starts_at');
      eventPayload.starts_at = starts ? new Date(starts).toISOString() : null;
      hasEventPatch = true;
    }
    if (formField(form, 'organiser_id')) {
      eventPayload.organiser_id = formFieldVal(form, 'organiser_id') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'event_type')) {
      eventPayload.event_type = formFieldVal(form, 'event_type') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'meeting_type')) {
      eventPayload.meeting_type = formFieldVal(form, 'meeting_type') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'vat_treatment')) {
      eventPayload.vat_treatment = formFieldVal(form, 'vat_treatment') || null;
      hasEventPatch = true;
    }

    var organiserPayload = null;
    var organiserFieldId =
      (formField(form, 'organiser_id') && formFieldVal(form, 'organiser_id')) ||
      organiserId ||
      '';
    if (
      organiserFieldId &&
      (formField(form, 'organiser_photo_url') || formField(form, 'organiser_description'))
    ) {
      organiserPayload = { id: organiserFieldId };
      if (formField(form, 'organiser_photo_url')) {
        organiserPayload.photo_url = formFieldVal(form, 'organiser_photo_url');
      }
      if (formField(form, 'organiser_description')) {
        organiserPayload.description = formFieldVal(form, 'organiser_description');
      }
    }

    if (!hasEventPatch && !organiserPayload) return;

    var beforeFix = null;
    if (healthCache && healthCache.events) {
      beforeFix = healthCache.events.find(function (e) {
        return e.id === id;
      });
    }

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'event-health-msg text-xs text-slate-500';
    }

    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Save failed (' + r.status + ')');
          }
          return body;
        });
      });
    }

    var chain = Promise.resolve();
    if (hasEventPatch) {
      chain = chain.then(function () {
        return postJson('/api/admin/events', eventPayload);
      });
    }
    if (organiserPayload) {
      chain = chain.then(function () {
        return postJson('/api/admin/organisers', organiserPayload);
      });
    }

    chain
      .then(function () {
        if (msg) {
          msg.textContent = 'Saved — rescanning…';
          msg.className = 'event-health-msg text-xs text-emerald-700 font-semibold';
        }
        return fetchEventHealth();
      })
      .then(function (data) {
        if (beforeFix && data) {
          recordEventHealthCompletion(beforeFix, data);
          logEventHealthCompletionRemote(beforeFix);
        }
        renderEventHealth();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'event-health-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function bindEventHealthForms() {
    if (!main || main.dataset.healthBound) return;
    main.dataset.healthBound = '1';
    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList) return;
      if (form.classList.contains('event-health-form')) {
        e.preventDefault();
        saveEventHealthForm(form);
      } else if (form.id === 'event-health-bulk-form') {
        e.preventDefault();
        saveHealthBulkForm(form);
      }
    });
    main.addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('health-select-checkbox')) {
        var eid = e.target.value;
        if (e.target.checked) {
          var ev = (healthCache && healthCache.events) || [];
          var row = ev.find(function (x) {
            return String(x.id) === String(eid);
          });
          if (row) rememberSelectedHealthEvent(row);
        } else forgetSelectedHealthEvent(eid);
        updateHealthBulkBar();
        return;
      }
      if (e.target.id === 'event-health-select-page') {
        var visible = (healthCache && healthCache.events) || [];
        if (eventHealthState.issueFilter && eventHealthState.issueFilter !== 'all') {
          visible = visible.filter(function (ev) {
            return eventMatchesIssueFilter(ev, eventHealthState.issueFilter);
          });
        }
        visible.forEach(function (ev) {
          if (e.target.checked) rememberSelectedHealthEvent(ev);
          else forgetSelectedHealthEvent(ev.id);
        });
        main.querySelectorAll('.health-select-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
        });
        updateHealthBulkBar();
      }
    });
    main.addEventListener('click', function (e) {
      if (e.target.closest('#health-bulk-clear')) {
        clearSelectedHealthEvents();
        main.querySelectorAll('.health-select-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
        var selectPage = document.getElementById('event-health-select-page');
        if (selectPage) selectPage.checked = false;
        updateHealthBulkBar();
        return;
      }
      var unselectBtn = e.target.closest('[data-unselect-health-event]');
      if (unselectBtn) {
        var unselectId = unselectBtn.getAttribute('data-unselect-health-event');
        forgetSelectedHealthEvent(unselectId);
        main.querySelectorAll('.health-select-checkbox').forEach(function (cb) {
          if (String(cb.value) === String(unselectId)) cb.checked = false;
        });
        updateHealthBulkBar();
        return;
      }
      if (e.target.closest('#health-unpublish-btn')) {
        unpublishSelectedEvents({
          getIds: getSelectedHealthEventIds,
          clearSelection: clearSelectedHealthEvents,
          refresh: function () {
            return fetchEventHealth().then(function () {
              renderEventHealth();
            });
          },
          msgId: 'health-unpublish-msg',
          btnId: 'health-unpublish-btn',
        });
        return;
      }
      var unpublishHealthBtn = e.target.closest('[data-unpublish-health-event]');
      if (unpublishHealthBtn) {
        var unpublishHealthId = unpublishHealthBtn.getAttribute('data-unpublish-health-event');
        promptAdminUnpublish(1)
          .then(function (payload) {
            unpublishHealthBtn.disabled = true;
            return adminPost('/api/admin/events', {
              action: 'bulk_unpublish',
              ids: [unpublishHealthId],
              reason: payload.reason,
              details: payload.details,
              notify_organiser: payload.notifyOrganiser !== false,
            });
          })
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Unpublish failed');
            return fetchEventHealth();
          })
          .then(function () {
            renderEventHealth();
          })
          .catch(function (err) {
            if (err && err.message === 'cancelled') return;
            window.alert(err.message || 'Could not unpublish event');
            unpublishHealthBtn.disabled = false;
          });
        return;
      }
      if (e.target.closest('#health-delete-btn')) {
        deleteSelectedHealthEvents(false);
        return;
      }
      if (e.target.closest('#health-force-delete-btn')) {
        deleteSelectedHealthEvents(true);
        return;
      }
      var deleteBtn = e.target.closest('[data-delete-health-event]');
      if (deleteBtn) {
        deleteSingleHealthEvent(
          deleteBtn.getAttribute('data-delete-health-event'),
          deleteBtn.getAttribute('data-event-title'),
          deleteBtn
        );
        return;
      }

      var clearBtn = e.target.closest('[data-clear-broken-organiser]');
      if (clearBtn) {
        var eventId = clearBtn.getAttribute('data-clear-broken-organiser');
        if (!eventId) return;
        clearBtn.disabled = true;
        fetch('/api/admin/events', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: eventId, organiser_id: null }),
        })
          .then(function (r) {
            return r.json().then(function (body) {
              if (!r.ok || body.ok === false) {
                throw new Error(body.message || body.error || 'Could not unlink organiser');
              }
              return fetchEventHealth();
            });
          })
          .then(function () {
            renderEventHealth();
          })
          .catch(function (err) {
            clearBtn.disabled = false;
            window.alert(err.message || 'Could not unlink organiser');
          });
        return;
      }

      var purgeBtn = e.target.closest('[data-purge-gone-organiser]');
      if (purgeBtn) {
        var organiserId = purgeBtn.getAttribute('data-purge-gone-organiser');
        if (!organiserId) return;
        if (
          !window.confirm(
            'Clean up references to this deleted group profile?\n\nLinked events will be unlinked. This is safe if the networking group no longer exists on the Hub.'
          )
        ) {
          return;
        }
        purgeBtn.disabled = true;
        adminPost('/api/admin/organisers', { action: 'delete_groups', ids: [organiserId] })
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Cleanup failed');
            return fetchEventHealth();
          })
          .then(function () {
            renderEventHealth();
          })
          .catch(function (err) {
            purgeBtn.disabled = false;
            window.alert(err.message || 'Could not clean up profile references');
          });
        return;
      }

      var btn = e.target.closest('[data-use-first-organiser]');
      if (!btn) return;
      var article = btn.closest('[data-event-id]');
      var form = article && article.querySelector('.event-health-form');
      var select = form && formField(form, 'organiser_id');
      var firstId = btn.getAttribute('data-use-first-organiser');
      if (select && firstId) {
        select.value = firstId;
        select.focus();
      }
    });
  }

  function bindModerationActions() {
    if (!main || main.dataset.moderationBound) return;
    main.dataset.moderationBound = '1';
    main.addEventListener('click', function (e) {
      var dismissBtn = e.target.closest('.moderation-dismiss-report-btn');
      if (dismissBtn) {
        var reportId = dismissBtn.getAttribute('data-report-id');
        if (!reportId) return;
        dismissBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'dismiss_report', id: reportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Dismiss failed');
            refreshModerationView();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            dismissBtn.disabled = false;
            window.alert(err.message || 'Could not dismiss report.');
          });
        return;
      }
      var unpublishBtn = e.target.closest('.moderation-unpublish-report-btn');
      if (unpublishBtn) {
        var unpublishReportId = unpublishBtn.getAttribute('data-report-id');
        if (!unpublishReportId) return;
        if (
          !window.confirm(
            'Unpublish this listing on the Hub? The poster and reporter will be emailed, a conduct warning may apply, and the report will be marked upheld.'
          )
        ) {
          return;
        }
        unpublishBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'unpublish_from_report', id: unpublishReportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Unpublish failed');
            var notes = [];
            if (data.listingMissing) {
              notes.push('The listing was already removed from Supabase.');
            }
            var uphold = data.upholdResult || {};
            if (uphold.moderation && uphold.moderation.hubSuspended) {
              notes.push('Organiser account suspended after repeated conduct warnings.');
            } else if (uphold.moderation && uphold.moderation.warningCount) {
              notes.push(
                'Conduct warning ' +
                  uphold.moderation.warningCount +
                  ' of ' +
                  (uphold.moderation.warningLimit || 3) +
                  ' recorded.'
              );
            }
            if (notes.length) {
              window.alert('Report upheld. ' + notes.join(' '));
            }
            refreshModerationView();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            unpublishBtn.disabled = false;
            window.alert(err.message || 'Could not unpublish listing.');
          });
        return;
      }
      var dismissReviewReportBtn = e.target.closest('.moderation-dismiss-review-report-btn');
      if (dismissReviewReportBtn) {
        var reviewReportId = dismissReviewReportBtn.getAttribute('data-review-report-id');
        if (!reviewReportId) return;
        dismissReviewReportBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'dismiss_review_report', id: reviewReportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Dismiss failed');
            refreshModerationView();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            dismissReviewReportBtn.disabled = false;
            window.alert(err.message || 'Could not dismiss report.');
          });
        return;
      }
      var deleteReviewReportBtn = e.target.closest('.moderation-delete-review-report-btn');
      if (deleteReviewReportBtn) {
        var deleteReportId = deleteReviewReportBtn.getAttribute('data-review-report-id');
        if (!deleteReportId) return;
        if (!window.confirm('Remove the reported review from the site and close this report?')) return;
        deleteReviewReportBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'delete_review_from_report', id: deleteReportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Remove failed');
            refreshModerationView();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            deleteReviewReportBtn.disabled = false;
            window.alert(err.message || 'Could not remove review.');
          });
        return;
      }
      var deleteReviewBtn = e.target.closest('.moderation-delete-review-btn');
      if (deleteReviewBtn) {
        var reviewId = deleteReviewBtn.getAttribute('data-review-id');
        if (!reviewId) return;
        if (!window.confirm('Permanently delete this review?')) return;
        deleteReviewBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'delete_review', id: reviewId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Delete failed');
            refreshModerationView();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            deleteReviewBtn.disabled = false;
            window.alert(err.message || 'Could not delete review.');
          });
      }
    });
  }

  function renderEventHealth() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Checks <strong>published</strong> events only. Draft events still being built by organisers are not included.</p>' +
      '<div id="event-health-status" class="text-sm text-slate-500">Scanning published events…</div>' +
      '<div id="event-health-summary" class="hidden admin-metric-grid admin-metric-grid--4"></div>' +
      '<div id="event-health-toolbar" class="hidden flex flex-wrap items-center gap-3"></div>' +
      '<div id="event-health-bulk" class="hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<form id="event-health-bulk-form" class="space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="health-bulk-count">0</span> events selected</p>' +
      '<button type="button" id="health-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Tick events below, then apply the same fix to all selected — or delete unwanted listings.</p>' +
      '<div id="health-selected-chips" class="flex flex-wrap gap-1.5"></div>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
      '<select name="bulk_organiser_id" id="health-bulk-organiser" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      '<option value="__unlink__">— Unlink from organiser —</option></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date & time</label>' +
      '<input type="datetime-local" name="bulk_starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
      '<select name="bulk_event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      eventTypeOptions('') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
      '<select name="bulk_meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      meetingFormatOptions('') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">VAT (paid tickets)</label>' +
      '<select name="bulk_vat_treatment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      '<option value="included">VAT included</option>' +
      '<option value="added">VAT added at checkout</option>' +
      '<option value="none">Not VAT registered</option></select></div></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Apply fixes to selected</button>' +
      '<span id="health-bulk-msg" class="text-xs"></span></div></form>' +
      '<div id="health-moderation-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Hide listing (default for moderation)</p>' +
      '<p class="text-xs text-slate-600">Unpublish removes the event from browse and stops ticket sales. Bookings, revenue, and organiser payouts are kept.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="health-unpublish-btn" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Unpublish listing</button>' +
      '<span id="health-unpublish-msg" class="text-xs"></span></div></div>' +
      '<div id="health-delete-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Danger zone</p>' +
      '<p class="text-xs text-slate-600">Only use when the event is genuinely off. Cancel &amp; refund unwinds every paid booking. Delete permanently removes empty drafts with no registrations.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="health-force-delete-btn" class="rounded-lg border border-red-300 bg-white text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">Cancel event &amp; refund bookings</button>' +
      '<button type="button" id="health-delete-btn" class="rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Delete empty events</button>' +
      '<span id="health-delete-msg" class="text-xs"></span></div></div></div>' +
      '<div id="event-health-list" class="space-y-3"></div>' +
      '<div id="event-health-completed"></div></div>';

    fetchEventHealth().then(function (data) {
      var status = document.getElementById('event-health-status');
      var summary = document.getElementById('event-health-summary');
      var toolbar = document.getElementById('event-health-toolbar');
      var list = document.getElementById('event-health-list');
      if (!status || !summary || !list) return;

      paintEventHealthCompleted(data.recentCompletions || []);

      if (!data || data.error) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load event health (' +
          esc(data && data.error ? data.error : 'unknown') +
          '). Try signing in again.</span>';
        return;
      }

      if (data.configured === false) {
        status.textContent = 'Supabase is not configured — event health checks are unavailable.';
        return;
      }

      if (!data.count) {
        status.innerHTML =
          '<span class="text-emerald-700 font-semibold">All ' +
          (data.totalPublished || 0) +
          ' published events look complete.</span>';
        summary.classList.add('hidden');
        list.innerHTML = '';
        if (toolbar) {
          toolbar.classList.add('hidden');
          toolbar.innerHTML = '';
        }
        return;
      }

      var organisers = data.organisers || [];
      var needsOrganiserLink = (data.events || []).some(function (ev) {
        var codes = issueCodes(ev);
        return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
      });
      var statusHint = needsOrganiserLink
        ? organisers.length
          ? ' <span class="text-slate-500">Choose an organiser for each event below.</span>'
          : ' <span class="text-red-700 font-semibold">No organisers found — create one in the Organiser dashboard first.</span>'
        : ' <span class="text-slate-500">Only the flagged fields are shown — fill them in and save.</span>';
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        data.count +
        ' of ' +
        (data.totalPublished || data.count) +
        ' published event' +
        (data.totalPublished === 1 ? '' : 's') +
        (data.count === 1 ? ' needs' : ' need') +
        ' attention.</span>' +
        statusHint;

      var issueCards = Object.keys(data.issuesByCode || {})
        .map(function (code) {
          var sample = { label: code, severity: 'low' };
          (data.events || []).some(function (ev) {
            var hit = (ev.issues || []).find(function (i) {
              return i.code === code;
            });
            if (hit) sample = hit;
            return !!hit;
          });
          return { code: code, sample: sample, count: data.issuesByCode[code] };
        })
        .sort(function (a, b) {
          var sa = HEALTH_SEVERITY_ORDER[a.sample.severity] != null ? HEALTH_SEVERITY_ORDER[a.sample.severity] : 9;
          var sb = HEALTH_SEVERITY_ORDER[b.sample.severity] != null ? HEALTH_SEVERITY_ORDER[b.sample.severity] : 9;
          if (sa !== sb) return sa - sb;
          return String(a.sample.label).localeCompare(String(b.sample.label));
        })
        .map(function (row) {
          return (
            '<div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">' +
            '<p class="text-xs text-slate-500 uppercase font-semibold">' +
            esc(row.sample.label) +
            '</p>' +
            '<p class="text-xl font-bold text-brand-900 mt-1">' +
            row.count +
            '</p></div>'
          );
        })
        .join('');
      summary.innerHTML = issueCards;
      summary.classList.remove('hidden');

      var issueFilterOptions = Object.keys(data.issuesByCode || {})
        .map(function (code) {
          var sample = { label: code, severity: 'low' };
          (data.events || []).some(function (ev) {
            var hit = (ev.issues || []).find(function (i) {
              return i.code === code;
            });
            if (hit) sample = hit;
            return !!hit;
          });
          return { code: code, label: sample.label };
        })
        .sort(function (a, b) {
          return String(a.label).localeCompare(String(b.label));
        });

      var needsOrganiserBulk = (data.events || []).filter(function (ev) {
        var codes = issueCodes(ev);
        return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
      }).length;

      var sortedOrganisers = organisers.slice().sort(function (a, b) {
        var aPub = a.listingStatus === 'published' ? 0 : 1;
        var bPub = b.listingStatus === 'published' ? 0 : 1;
        if (aPub !== bPub) return aPub - bPub;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      var firstOrganiserId = sortedOrganisers.length ? sortedOrganisers[0].id : '';

      if (toolbar) {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML =
          '<label class="text-xs font-semibold text-slate-500">Filter by issue ' +
          '<select id="event-health-filter" class="ml-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white">' +
          '<option value="all">All issues</option>' +
          issueFilterOptions
            .map(function (opt) {
              return (
                '<option value="' +
                attrEsc(opt.code) +
                '"' +
                (eventHealthState.issueFilter === opt.code ? ' selected' : '') +
                '>' +
                esc(opt.label) +
                '</option>'
              );
            })
            .join('') +
          '</select></label>' +
          '<label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer">' +
          '<input type="checkbox" id="event-health-select-page" class="rounded border-slate-300"> Select all on page</label>' +
          (needsOrganiserBulk > 1
            ? '<button type="button" id="event-health-bulk-organiser" class="rounded-lg border border-brand-200 bg-brand-50 text-brand-800 px-3 py-1.5 text-xs font-semibold hover:bg-brand-100">Assign first organiser to ' +
              needsOrganiserBulk +
              ' events</button>'
            : '');
        var filterEl = document.getElementById('event-health-filter');
        if (filterEl) {
          filterEl.addEventListener('change', function () {
            eventHealthState.issueFilter = filterEl.value || 'all';
            renderEventHealth();
          });
        }
        var bulkBtn = document.getElementById('event-health-bulk-organiser');
        if (bulkBtn) {
          bulkBtn.addEventListener('click', function () {
            bulkAssignFirstOrganiser(data.events || [], organisers);
          });
        }
        var bulkOrganiser = document.getElementById('health-bulk-organiser');
        if (bulkOrganiser) {
          bulkOrganiser.innerHTML =
            '<option value="">— Leave unchanged —</option>' +
            '<option value="__unlink__">— Unlink from organiser —</option>' +
            sortedOrganisers
              .map(function (o) {
                return (
                  '<option value="' +
                  attrEsc(o.id) +
                  '">' +
                  esc(o.name) +
                  (o.listingStatus === 'published' ? '' : ' (draft profile)') +
                  '</option>'
                );
              })
              .join('');
        }
      }

      var sortedEvents = (data.events || [])
        .filter(function (ev) {
          return eventMatchesIssueFilter(ev, eventHealthState.issueFilter);
        })
        .slice()
        .sort(function (a, b) {
          var ra = eventSeverityRank(a);
          var rb = eventSeverityRank(b);
          if (ra !== rb) return ra - rb;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

      if (!sortedEvents.length) {
        list.innerHTML =
          '<p class="text-sm text-slate-500 rounded-lg border border-slate-200 bg-white p-4">No events match this filter.</p>';
        paintEventHealthCompleted(data.recentCompletions || []);
        updateHealthBulkBar();
        return;
      }

      list.innerHTML = sortedEvents
        .map(function (ev) {
          if (eventHealthState.selected[ev.id]) rememberSelectedHealthEvent(ev);
          var checked = eventHealthState.selected[ev.id] ? ' checked' : '';
          var fields = healthFieldVisibility(ev);
          var issueHtml = (ev.issues || []).map(issueBadge).join('');
          var needsOrganiser = fields.showOrganiser;
          var hasEventFields =
            fields.showDate ||
            fields.showOrganiser ||
            fields.showEventType ||
            fields.showFormat ||
            fields.showVat;
          var hasOrgFields = fields.showOrgLogo || fields.showOrgBio || fields.showOrganiserNotPublished;
          var organiserSelectList = mergeOrganisersForSelect(organisers, ev);
          var typeOptions = EVENT_TYPES.map(function (t) {
            return (
              '<option value="' +
              attrEsc(t) +
              '"' +
              (ev.event_type === t ? ' selected' : '') +
              '>' +
              esc(t) +
              '</option>'
            );
          }).join('');
          var formatOptions = MEETING_FORMATS.map(function (f) {
            return (
              '<option value="' +
              attrEsc(f) +
              '"' +
              (ev.meeting_type === f ? ' selected' : '') +
              '>' +
              esc(f) +
              '</option>'
            );
          }).join('');
          var vatVal = ev.vat_treatment || '';
          var orgEditHref =
            '../organiser/group-edit?id=' + encodeURIComponent(ev.organiser_id || '');
          var orgPublicHref = ev.organiser_slug
            ? '../organisers/' + encodeURIComponent(ev.organiser_slug)
            : '';
          var saveLabel = hasOrgFields && !hasEventFields ? 'Save organiser profile' : 'Save fixes';
          var canSave = hasEventFields || fields.showOrgLogo || fields.showOrgBio;

          var eventFieldsHtml = '';
          if (fields.showDate) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date & time</label>' +
              '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value="' +
              attrEsc(toDatetimeLocalValue(ev.starts_at)) +
              '"></div>';
          }
          if (fields.showOrganiser) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser</label>' +
              (fields.showInvalidOrganiser
                ? '<p class="text-xs text-amber-800 mb-2">This event points at a networking group profile that no longer exists. Unlink it here or assign a different group.</p>'
                : '') +
              '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white ring-2 ring-red-200">' +
              organiserOptionsHtml(organiserSelectList, ev.organiser_id) +
              '</select>' +
              (fields.showInvalidOrganiser
                ? '<button type="button" class="mt-2 mr-3 text-xs font-semibold text-red-700 hover:underline" data-clear-broken-organiser="' +
                  attrEsc(ev.id) +
                  '">Remove broken organiser link</button>' +
                  (ev.organiser_id
                    ? '<button type="button" class="mt-2 text-xs font-semibold text-red-700 hover:underline" data-purge-gone-organiser="' +
                      attrEsc(ev.organiser_id) +
                      '">Clean up deleted profile references</button>'
                    : '')
                : firstOrganiserId
                  ? '<button type="button" class="mt-2 text-xs font-semibold text-brand-700 hover:underline" data-use-first-organiser="' +
                    attrEsc(firstOrganiserId) +
                    '">Use first available organiser</button>'
                  : '') +
              '</div>';
          }
          if (fields.showEventType) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
              '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              typeOptions +
              '</select></div>';
          }
          if (fields.showFormat) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
              '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              formatOptions +
              '</select></div>';
          }
          if (fields.showVat) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">VAT (paid tickets)</label>' +
              '<select name="vat_treatment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              '<option value="included"' +
              (vatVal === 'included' ? ' selected' : '') +
              '>Prices include VAT</option>' +
              '<option value="added"' +
              (vatVal === 'added' ? ' selected' : '') +
              '>VAT added at checkout</option>' +
              '<option value="none"' +
              (vatVal === 'none' ? ' selected' : '') +
              '>Not VAT registered</option>' +
              '</select></div>';
          }

          var orgFieldsHtml = '';
          if (hasOrgFields) {
            orgFieldsHtml +=
              '<div class="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">';
            if (fields.showOrganiserNotPublished) {
              orgFieldsHtml +=
                '<div class="rounded-lg border border-amber-300 bg-white/80 p-3">' +
                '<p class="text-sm font-semibold text-brand-900">Organiser profile is not published</p>' +
                '<p class="text-xs text-slate-600 mt-1">This event is published but the linked organiser is still <strong>' +
                esc(ev.organiser_listing_status || 'draft') +
                '</strong>. Complete and publish the group in ' +
                '<a href="#cleanup/groups" class="text-brand-700 font-semibold hover:underline">Listing cleanup</a>.</p></div>';
            }
            if (fields.showOrgLogo || fields.showOrgBio) {
              orgFieldsHtml +=
                '<div class="flex flex-wrap items-start justify-between gap-2">' +
                '<div>' +
                '<p class="text-sm font-semibold text-brand-900">Organiser: ' +
                esc(ev.organiser_name || 'Unknown') +
                '</p>' +
                '<p class="text-xs text-slate-600 mt-1">Add the missing logo or bio here, or open the full profile editor.</p>' +
                '</div>' +
                '<div class="flex flex-wrap gap-2 shrink-0">' +
                '<a href="' +
                attrEsc(orgEditHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">Full profile editor</a>' +
                (orgPublicHref
                  ? '<a href="' +
                    attrEsc(orgPublicHref) +
                    '" target="_blank" rel="noopener" class="text-xs font-semibold text-slate-600 hover:underline">View public profile</a>'
                  : '') +
                '</div></div>';
            }
            if (fields.showOrgLogo) {
              orgFieldsHtml +=
                '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Logo image URL</label>' +
                '<input type="url" name="organiser_photo_url" placeholder="https://…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value="' +
                attrEsc(ev.organiser_photo_url || '') +
                '">' +
                '<p class="text-[11px] text-slate-500 mt-1">Paste a direct link to the organiser logo image.</p></div>';
            }
            if (fields.showOrgBio) {
              orgFieldsHtml +=
                '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser bio</label>' +
                '<textarea name="organiser_description" rows="4" placeholder="A short description of this organiser…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
                esc(ev.organiser_description || '') +
                '</textarea></div>';
            }
            orgFieldsHtml += '</div>';
          }

          return (
            '<article class="bg-white rounded-xl border border-slate-200 shadow-sm" data-event-id="' +
            attrEsc(ev.id) +
            '"' +
            (ev.organiser_id ? ' data-organiser-id="' + attrEsc(ev.organiser_id) + '"' : '') +
            '>' +
            '<div class="p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">' +
            '<div class="flex gap-3 min-w-0 flex-1">' +
            '<input type="checkbox" class="health-select-checkbox mt-1 rounded border-slate-300 shrink-0" value="' +
            attrEsc(ev.id) +
            '"' +
            checked +
            ' aria-label="Select ' +
            attrEsc(ev.title || 'event') +
            '">' +
            '<div class="min-w-0 flex-1">' +
            '<h3 class="font-bold text-brand-900">' +
            esc(ev.title || 'Untitled') +
            '</h3>' +
            '<p class="text-xs text-slate-500 mt-1">/' +
            esc(ev.slug || '') +
            '</p>' +
            (ev.organiser_name
              ? '<p class="text-xs text-slate-600 mt-1">Organiser: <span class="font-medium">' +
                esc(ev.organiser_name) +
                '</span></p>'
              : '') +
            '<div class="mt-2">' +
            issueHtml +
            '</div>' +
            (needsOrganiser
              ? '<p class="text-xs text-red-800 mt-2">Select an organiser below, then click <strong>Save fixes</strong>.</p>'
              : '') +
            '</div></div>' +
            '<div class="flex flex-wrap gap-2 shrink-0">' +
            '<a href="../events/' +
            esc(ev.slug || '') +
            '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View event page</a>' +
            (eventHasCommerce(ev)
              ? '<button type="button" class="text-xs font-semibold text-amber-800 hover:underline" data-unpublish-health-event="' +
                attrEsc(ev.id) +
                '" data-event-title="' +
                attrEsc(ev.title || 'Untitled') +
                '">Unpublish</button>'
              : '<button type="button" class="text-xs font-semibold text-red-700 hover:underline" data-delete-health-event="' +
                attrEsc(ev.id) +
                '" data-event-title="' +
                attrEsc(ev.title || 'Untitled') +
                '">Delete</button>') +
            '</div></div>' +
            '<form class="event-health-form p-4 grid sm:grid-cols-2 gap-4 text-sm">' +
            eventFieldsHtml +
            orgFieldsHtml +
            '<div class="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">' +
            (canSave
              ? '<button type="submit" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900 disabled:opacity-50">' +
                esc(saveLabel) +
                '</button>' +
                '<span class="event-health-msg text-xs text-slate-500"></span>'
              : '') +
            '</div></form></article>'
          );
        })
        .join('');
      updateHealthBulkBar();
      paintEventHealthCompleted(data.recentCompletions || []);
    });
  }

  function analyticsTrackingActive() {
    return (
      !!document.querySelector('script[src*="insights/script.js"]') ||
      typeof window.va === 'function'
    );
  }

  function renderActivityList(activity, limit) {
    var items = (activity || []).slice(0, limit || 6);
    if (!items.length) {
      return '<li class="text-sm text-slate-500">No recent genuine activity yet.</li>';
    }
    return items
      .map(function (item) {
        return (
          '<li class="relative pl-5 pb-4 border-l-2 border-brand-200 last:pb-0">' +
          '<span class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-500"></span>' +
          '<time class="text-xs text-slate-400 block">' +
          fmtTime(item.time) +
          '</time>' +
          '<p class="text-sm text-slate-700 mt-0.5 break-words">' +
          esc(item.text) +
          '</p></li>'
        );
      })
      .join('');
  }

  function analyticsPeriodLabel(period) {
    if (period === '7d') return 'Last 7 days';
    if (period === 'all') return 'All time';
    return 'Last 30 days';
  }

  function analyticsPeriodBtn(period, label) {
    var active = analyticsState.period === period;
    return (
      '<button type="button" data-analytics-period="' +
      esc(period) +
      '" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
      (active
        ? 'bg-brand-700 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200') +
      '">' +
      esc(label) +
      '</button>'
    );
  }

  function fmtPctChange(n) {
    if (n == null || n === '') return '—';
    var num = Number(n);
    if (Number.isNaN(num)) return '—';
    return (num > 0 ? '+' : '') + num + '%';
  }

  function fmtRating(n) {
    if (n == null || n === '') return '—';
    return String(n) + '★';
  }

  function insightsEmptyRow(colspan, message) {
    return (
      '<tr><td colspan="' +
      colspan +
      '" class="px-3 py-4 text-sm text-slate-500">' +
      esc(message) +
      '</td></tr>'
    );
  }

  function insightsTableScroll(html) {
    return '<div class="admin-insights-table-scroll">' + html + '</div>';
  }

  function insightsListScroll(html) {
    return '<div class="admin-insights-list-scroll">' + html + '</div>';
  }

  function renderInsightsTopOrganisers(rows) {
    if (!rows.length) {
      return insightsEmptyRow(5, 'No organiser activity in this period yet.');
    }
    return rows
      .map(function (o, i) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-2.5 py-1.5 text-slate-400 text-xs tabular-nums">' +
          (i + 1) +
          '</td>' +
          '<td class="px-2.5 py-1.5 font-medium text-brand-900 min-w-0">' +
          '<span class="block truncate" title="' +
          attrEsc(o.name) +
          '">' +
          esc(o.name) +
          '</span></td>' +
          '<td class="px-2.5 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">' +
          esc(fmtMoney(o.revenue || 0)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right tabular-nums">' +
          esc(String(o.registrations || 0)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right text-slate-600 whitespace-nowrap">' +
          esc(fmtRating(o.avgRating)) +
          (o.reviewCount ? ' <span class="text-slate-400">(' + o.reviewCount + ')</span>' : '') +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsTopEvents(rows) {
    if (!rows.length) {
      return insightsEmptyRow(6, 'No event activity in this period yet.');
    }
    return rows
      .map(function (e, i) {
        var fill =
          e.fillRatePct != null
            ? e.fillRatePct + '%' + (e.capacity ? ' of ' + e.capacity : '')
            : '—';
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-2.5 py-1.5 text-slate-400 text-xs tabular-nums">' +
          (i + 1) +
          '</td>' +
          '<td class="px-2.5 py-1.5 min-w-0"><span class="font-medium text-brand-900 block truncate" title="' +
          attrEsc(e.title) +
          '">' +
          esc(e.title) +
          '</span><span class="block text-xs text-slate-500 truncate">' +
          esc(e.organiser) +
          (e.city ? ' · ' + esc(e.city) : '') +
          '</span></td>' +
          '<td class="px-2.5 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">' +
          esc(fmtMoney(e.revenue || 0)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right tabular-nums">' +
          esc(String(e.registrations || 0)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right text-slate-600 whitespace-nowrap">' +
          esc(fmtRating(e.avgRating)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right text-xs text-slate-500 whitespace-nowrap">' +
          esc(fill) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsTopAttendees(rows) {
    if (!rows.length) {
      return insightsEmptyRow(4, 'No paid attendee activity in this period yet.');
    }
    return rows
      .map(function (a, i) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-2.5 py-1.5 text-slate-400 text-xs tabular-nums">' +
          (i + 1) +
          '</td>' +
          '<td class="px-2.5 py-1.5 min-w-0"><span class="font-medium text-brand-900 block truncate">' +
          esc(a.name) +
          '</span>' +
          (a.email
            ? '<span class="block text-xs text-slate-500 truncate">' + esc(a.email) + '</span>'
            : '') +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right font-semibold whitespace-nowrap tabular-nums">' +
          esc(fmtMoney(a.spend || 0)) +
          '</td>' +
          '<td class="px-2.5 py-1.5 text-right tabular-nums">' +
          esc(String(a.eventsAttended || 0)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsCities(rows) {
    if (!rows.length) {
      return '<p class="text-sm text-slate-500">No city data in this period yet.</p>';
    }
    return insightsListScroll(
      '<ul class="space-y-1.5">' +
        rows
          .map(function (c) {
            return (
              '<li class="flex items-center justify-between text-sm gap-3">' +
              '<span class="font-medium text-brand-900 truncate min-w-0">' +
              esc(c.city) +
              '</span>' +
              '<span class="text-slate-500 shrink-0 tabular-nums">' +
              esc(String(c.registrations || 0)) +
              ' regs · ' +
              esc(fmtMoney(c.revenue || 0)) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul>'
    );
  }

  function renderInsightsUserLocations(locationData) {
    var data = locationData || {};
    var rows = data.areas || [];
    if (!rows.length) {
      return '<p class="text-sm text-slate-500">No members have added a location yet.</p>';
    }
    return (
      '<p class="text-xs text-slate-500 mb-2">' +
      esc(String(data.provided || 0)) +
      ' of ' +
      esc(String(data.total || 0)) +
      ' profiles provided a location · ' +
      esc(String(data.missing || 0)) +
      ' not provided</p>' +
      insightsListScroll(
        '<ul class="space-y-1.5">' +
          rows
            .map(function (row) {
              return (
                '<li class="flex items-center justify-between text-sm gap-3">' +
                '<span class="font-medium text-brand-900 min-w-0 truncate">' +
                esc(row.area) +
                '</span><span class="text-slate-500 shrink-0 tabular-nums">' +
                esc(String(row.users || 0)) +
                (Number(row.users || 0) === 1 ? ' member' : ' members') +
                '</span></li>'
              );
            })
            .join('') +
          '</ul>'
      )
    );
  }

  function renderInsightsTypeMix(rows) {
    if (!rows.length) {
      return '<p class="text-sm text-slate-500">No registrations in this period yet.</p>';
    }
    return insightsListScroll(
      '<ul class="space-y-1.5">' +
        rows
          .map(function (t) {
            return (
              '<li class="flex items-center justify-between text-sm gap-3">' +
              '<span class="font-medium text-brand-900 capitalize truncate min-w-0">' +
              esc(t.type) +
              '</span>' +
              '<span class="text-slate-500 shrink-0 tabular-nums">' +
              esc(String(t.count || 0)) +
              ' · ' +
              esc(fmtMoney(t.revenue || 0)) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul>'
    );
  }

  function renderInsightsRated(rows, kind) {
    if (!rows.length) {
      return (
        '<p class="text-sm text-slate-500">No ' +
        esc(kind) +
        ' with 3+ reviews yet.</p>'
      );
    }
    return insightsListScroll(
      '<ul class="space-y-1.5">' +
        rows
          .map(function (r) {
            return (
              '<li class="flex items-center justify-between text-sm gap-3">' +
              '<span class="font-medium text-brand-900 min-w-0 truncate">' +
              esc(r.title || r.name) +
              '</span>' +
              '<span class="text-slate-600 shrink-0 font-semibold">' +
              esc(fmtRating(r.avgRating)) +
              ' <span class="text-slate-400 font-normal">(' +
              esc(String(r.reviewCount || 0)) +
              ')</span></span></li>'
            );
          })
          .join('') +
        '</ul>'
    );
  }

  function renderInsightsPanel(data) {
    if (!data || data.error || data.configured === false) {
      return '<p class="text-sm text-red-700">Could not load platform insights. Check Supabase env vars on Vercel.</p>';
    }

    var rev = data.revenueComparison || {};
    var repeat = data.repeatAttendees || {};
    var growth = data.growthPulse || {};
    var funnel = data.applicationFunnel || {};
    var promote = data.promoteRoi || {};
    var promoteTotals = promote.totals || {};
    var tickets = data.ticketVolume || {};
    var periodLabel = analyticsPeriodLabel(data.period || analyticsState.period);
    var orgCount = (data.topOrganisers || []).length;
    var eventCount = (data.topEvents || []).length;
    var attendeeCount = (data.topAttendees || []).length;

    return (
      '<div class="admin-insights space-y-4">' +
      '<nav class="admin-insights-jump" aria-label="Insights sections">' +
      '<a href="#insights-tickets" class="admin-insights-jump-link">Tickets</a>' +
      '<a href="#insights-performers" class="admin-insights-jump-link">Performers</a>' +
      '<a href="#insights-growth" class="admin-insights-jump-link">Growth</a>' +
      '<a href="#insights-promote" class="admin-insights-jump-link">Promote ROI</a>' +
      '<a href="#insights-places" class="admin-insights-jump-link">Places &amp; ratings</a>' +
      '</nav>' +
      '<section id="insights-tickets" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 scroll-mt-24">' +
      '<div><h3 class="font-bold text-brand-900">Tickets bought on the Hub</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Confirmed bookings in ' +
      esc(periodLabel.toLowerCase()) +
      ' — paid and free tickets (cancelled and pending applications excluded). Quantity counts multi-ticket checkouts.</p></div>' +
      '<div class="admin-metric-grid admin-metric-grid--4">' +
      card(
        'Tickets bought',
        String(tickets.tickets != null ? tickets.tickets : 0),
        String(tickets.bookings || 0) +
          ' booking' +
          (tickets.bookings === 1 ? '' : 's') +
          ' · ' +
          esc(periodLabel),
        'brand'
      ) +
      card(
        'Paid tickets',
        String(tickets.paidTickets != null ? tickets.paidTickets : 0),
        String(tickets.paidBookings || 0) + ' paid booking' + (tickets.paidBookings === 1 ? '' : 's'),
        'emerald'
      ) +
      card(
        'Free tickets',
        String(tickets.freeTickets != null ? tickets.freeTickets : 0),
        String(tickets.freeBookings || 0) + ' free booking' + (tickets.freeBookings === 1 ? '' : 's'),
        'blue'
      ) +
      card(
        'Paid ticket spend',
        fmtMoney(tickets.paidSpend || 0),
        'Gross amount attendees paid in ' + esc(periodLabel.toLowerCase()),
        'violet'
      ) +
      '</div></section>' +
      '<section id="insights-performers" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 scroll-mt-24">' +
      '<div class="flex flex-wrap items-end justify-between gap-2">' +
      '<div><h3 class="font-bold text-brand-900">Top performers</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Ranked from registrations — ' +
      esc(periodLabel) +
      '. Tables scroll when long.</p></div>' +
      '<p class="text-xs text-slate-400">' +
      esc(String(orgCount)) +
      ' groups · ' +
      esc(String(eventCount)) +
      ' events · ' +
      esc(String(attendeeCount)) +
      ' attendees</p></div>' +
      '<div class="grid gap-3 lg:grid-cols-2">' +
      '<div class="min-w-0 rounded-xl border border-slate-200 overflow-hidden flex flex-col">' +
      '<div class="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">' +
      '<h4 class="text-sm font-bold text-brand-900">Best groups</h4>' +
      '<span class="text-[11px] text-slate-400">Top 10</span></div>' +
      insightsTableScroll(
        '<table class="w-full text-sm admin-insights-table"><thead class="text-[11px] uppercase tracking-wide text-slate-500">' +
          '<tr><th class="px-2.5 py-2 w-7"></th><th class="px-2.5 py-2 text-left">Organiser</th><th class="px-2.5 py-2 text-right">Revenue</th><th class="px-2.5 py-2 text-right">Regs</th><th class="px-2.5 py-2 text-right">Rating</th></tr></thead>' +
          '<tbody>' +
          renderInsightsTopOrganisers(data.topOrganisers || []) +
          '</tbody></table>'
      ) +
      '</div>' +
      '<div class="min-w-0 rounded-xl border border-slate-200 overflow-hidden flex flex-col">' +
      '<div class="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">' +
      '<h4 class="text-sm font-bold text-brand-900">Best events</h4>' +
      '<span class="text-[11px] text-slate-400">Top 10</span></div>' +
      insightsTableScroll(
        '<table class="w-full text-sm admin-insights-table"><thead class="text-[11px] uppercase tracking-wide text-slate-500">' +
          '<tr><th class="px-2.5 py-2 w-7"></th><th class="px-2.5 py-2 text-left">Event</th><th class="px-2.5 py-2 text-right">Revenue</th><th class="px-2.5 py-2 text-right">Sold</th><th class="px-2.5 py-2 text-right">Rating</th><th class="px-2.5 py-2 text-right">Fill</th></tr></thead>' +
          '<tbody>' +
          renderInsightsTopEvents(data.topEvents || []) +
          '</tbody></table>'
      ) +
      '</div></div>' +
      '<div class="min-w-0 rounded-xl border border-slate-200 overflow-hidden">' +
      '<div class="px-3 py-2 border-b border-slate-100 bg-slate-50">' +
      '<h4 class="text-sm font-bold text-brand-900">Highest spending attendees</h4>' +
      '<p class="text-xs text-slate-500 mt-0.5">Top 10 by paid ticket spend (test/E2E excluded).</p></div>' +
      insightsTableScroll(
        '<table class="w-full text-sm admin-insights-table admin-insights-table--attendees"><thead class="text-[11px] uppercase tracking-wide text-slate-500">' +
          '<tr><th class="px-2.5 py-2 w-7"></th><th class="px-2.5 py-2 text-left">Attendee</th><th class="px-2.5 py-2 text-right">Spend</th><th class="px-2.5 py-2 text-right">Events</th></tr></thead>' +
          '<tbody>' +
          renderInsightsTopAttendees(data.topAttendees || []) +
          '</tbody></table>'
      ) +
      '</div></section>' +
      '<section id="insights-growth" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 scroll-mt-24">' +
      '<div><h3 class="font-bold text-brand-900">Growth &amp; quality</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Pulse metrics — always visible above the longer lists.</p></div>' +
      '<div class="admin-metric-grid admin-metric-grid--4">' +
      card(
        'Revenue (30 days)',
        fmtMoney(rev.current30d || 0),
        'Prior 30d: ' + fmtMoney(rev.prior30d || 0) + ' · ' + fmtPctChange(rev.changePct),
        'emerald'
      ) +
      card(
        'Repeat attendees',
        String(repeat.ratePct != null ? repeat.ratePct + '%' : '—'),
        String(repeat.repeat || 0) + ' of ' + String(repeat.total || 0) + ' attendees (all time)',
        'blue'
      ) +
      card(
        'New this week',
        String(growth.registrations7d || 0) + ' regs',
        String(growth.newOrganisers7d || 0) + ' organisers · ' + String(growth.newAccounts7d || 0) + ' accounts',
        'violet'
      ) +
      card(
        'Applications',
        String(funnel.pending || 0) + ' pending',
        String(funnel.approved || 0) + ' approved · ' + String(funnel.denied || 0) + ' denied',
        'brand'
      ) +
      '</div></section>' +
      '<section id="insights-promote" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 scroll-mt-24">' +
      '<div><h3 class="font-bold text-brand-900">Promote ROI</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">First-party LinkedIn/Promote tool usage and UTM landings — works without cookie consent. ' +
      esc(periodLabel) +
      '.</p></div>' +
      (promote.configured === false
        ? '<p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">' +
          esc(
            promote.message ||
              'Apply migration 221_organiser_promote_actions.sql in Supabase to start collecting Promote ROI.'
          ) +
          '</p>'
        : '<div class="admin-metric-grid admin-metric-grid--4">' +
          card(
            'Tool uses',
            String(promote.toolUses || 0),
            String(promoteTotals.download || 0) +
              ' downloads · ' +
              String(promoteTotals.copy_caption || 0) +
              ' captions · ' +
              String(promoteTotals.open_linkedin || 0) +
              ' LinkedIn opens'
          ) +
          card(
            'Landings from posts',
            String(promote.landings || 0),
            'Event page hits with utm_campaign=organiser_share'
          ) +
          card(
            'Active organisers',
            String(promote.uniqueOrganisers || 0),
            'Distinct groups that used Promote tools'
          ) +
          card(
            'Landing rate',
            promote.toolUses
              ? Math.round(((promote.landings || 0) / promote.toolUses) * 100) + '%'
              : '—',
            'Landings ÷ tool uses (rough conversion)'
          ) +
          '</div>') +
      '</section>' +
      '<section id="insights-places" class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 scroll-mt-24">' +
      '<div><h3 class="font-bold text-brand-900">Places &amp; ratings</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Longer lists stay in a fixed-height scroll so the page does not grow forever.</p></div>' +
      '<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">' +
      '<div class="rounded-xl border border-slate-200 p-3 flex flex-col min-h-0"><h4 class="text-sm font-bold text-brand-900">Member locations</h4>' +
      '<p class="text-xs text-slate-500 mt-0.5 mb-2">Grouped from the location members entered.</p>' +
      renderInsightsUserLocations(data.userLocations || {}) +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-3 flex flex-col min-h-0"><h4 class="text-sm font-bold text-brand-900 mb-2">Event cities</h4>' +
      renderInsightsCities(data.topCities || []) +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-3 flex flex-col min-h-0"><h4 class="text-sm font-bold text-brand-900 mb-2">Event type mix</h4>' +
      renderInsightsTypeMix(data.eventTypeMix || []) +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-3 flex flex-col min-h-0"><h4 class="text-sm font-bold text-brand-900">Highest rated groups</h4><p class="text-xs text-slate-500 mb-2">Min. 3 reviews</p>' +
      renderInsightsRated(data.topRatedOrganisers || [], 'groups') +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-3 flex flex-col min-h-0 md:col-span-2 xl:col-span-1"><h4 class="text-sm font-bold text-brand-900">Highest rated events</h4><p class="text-xs text-slate-500 mb-2">Min. 3 reviews</p>' +
      renderInsightsRated(data.topRatedEvents || [], 'events') +
      '</div></div></section></div>'
    );
  }

  function renderDemandRankList(rows, labelKey, countKey, emptyMessage) {
    if (!rows || !rows.length) {
      return '<p class="text-sm text-slate-500">' + esc(emptyMessage) + '</p>';
    }
    return (
      '<ul class="space-y-2">' +
      rows
        .map(function (row) {
          var label = row[labelKey] || row.title || row.name || row.query || row.location || row.type || '—';
          var count = row[countKey] != null ? row[countKey] : row.count;
          var extra = row.city ? ' · ' + esc(row.city) : '';
          var zeroNote =
            row.zeroCount != null && Number(row.zeroCount) > 0
              ? ' · ' + esc(String(row.zeroCount)) + ' zero'
              : '';
          var avgNote =
            row.avgResults != null ? ' · avg ' + esc(String(row.avgResults)) + ' results' : '';
          return (
            '<li class="flex items-start justify-between text-sm gap-3">' +
            '<span class="font-medium text-brand-900 min-w-0 break-words">' +
            esc(label) +
            (extra || '') +
            '</span>' +
            '<span class="text-slate-500 shrink-0">' +
            esc(String(count || 0)) +
            zeroNote +
            avgNote +
            '</span></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderDemandPanel(data) {
    if (!data || data.error || data.configured === false) {
      return '<p class="text-sm text-red-700">Could not load demand insights. Check Supabase env vars on Vercel.</p>';
    }

    var browse = data.browseSearches || {};
    var favs = data.favourites || {};
    var opps = data.opportunities || {};
    var guests = data.guestVisits || {};
    var searchNote = browse.unavailable
      ? '<p class="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">' +
        esc(browse.message || 'Search logging table is not available yet.') +
        '</p>'
      : '<p class="text-xs text-slate-500">Logged when visitors accept analytics cookies and use search or filters on Events, Organisers, or Opportunities.</p>';

    var regionRows = browse.topRegions || [];
    var sourceRows = browse.bySource || [];
    var regionBlock =
      regionRows.length || sourceRows.length
        ? '<div class="grid sm:grid-cols-2 gap-4">' +
          '<div><h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Top regions</h4>' +
          (regionRows.length
            ? '<ul class="text-sm space-y-1">' +
              regionRows
                .map(
                  (r) =>
                    '<li class="flex justify-between gap-2"><span>' +
                    esc(r.region) +
                    '</span><span class="text-slate-500">' +
                    esc(String(r.count)) +
                    '</span></li>'
                )
                .join('') +
              '</ul>'
            : '<p class="text-sm text-slate-400">No region-matched searches yet.</p>') +
          '</div><div><h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">By browse page</h4>' +
          (sourceRows.length
            ? '<ul class="text-sm space-y-1">' +
              sourceRows
                .map(
                  (r) =>
                    '<li class="flex justify-between gap-2"><span>' +
                    esc(String(r.source || '').replace(/_/g, ' ')) +
                    '</span><span class="text-slate-500">' +
                    esc(String(r.count)) +
                    '</span></li>'
                )
                .join('') +
              '</ul>'
            : '<p class="text-sm text-slate-400">No source breakdown yet.</p>') +
          '</div></div>'
        : '';

    return (
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm space-y-4">' +
      '<div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-bold text-brand-900">Demand &amp; intent</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">What people search, save, and enquire about — ' +
      esc(analyticsPeriodLabel(data.period || analyticsState.period)) +
      '.</p></div>' +
      '<button type="button" id="demand-export-csv" class="rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-3 py-2 hover:bg-slate-50">Export searches CSV</button></div>' +
      '<div class="admin-metric-grid admin-metric-grid--4">' +
      card(
        'Browse searches logged',
        String(browse.totalLogged || 0),
        String(browse.withQuery || 0) + ' with text · ' + String(browse.zeroResults || 0) + ' zero results',
        'brand'
      ) +
      card(
        'Favourites saved',
        String((favs.eventsSaved || 0) + (favs.organisersSaved || 0) + (favs.opportunitiesSaved || 0)),
        String(favs.eventsSaved || 0) +
          ' events · ' +
          String(favs.organisersSaved || 0) +
          ' groups · ' +
          String(favs.opportunitiesSaved || 0) +
          ' opps',
        'violet'
      ) +
      card(
        'Opportunity enquiries',
        String(opps.enquiriesTotal || 0),
        String(opps.enquiriesNew || 0) + ' still marked new',
        'emerald'
      ) +
      card(
        'Guest visits',
        String(guests.total || 0),
        String(guests.uniqueAttendees || 0) + ' unique attendees',
        'blue'
      ) +
      '</div>' +
      searchNote +
      regionBlock +
      '<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Top event searches</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Free-text queries on /events</p>' +
      renderDemandRankList(browse.topQueries || [], 'query', 'count', 'No search terms logged in this period yet.') +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Zero-result searches</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Demand with no matching inventory — seed an organiser or event here next</p>' +
      renderDemandRankList(
        browse.zeroResultQueries || [],
        'query',
        'count',
        'No zero-result searches in this period.'
      ) +
      (browse.zeroResultQueries && browse.zeroResultQueries.length
        ? '<div class="mt-3 flex flex-wrap gap-2">' +
          '<a class="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-slate-50" href="#organisers">Invite organiser for top city</a>' +
          '<a class="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-slate-50" href="#events">Create seeded event</a>' +
          '<button type="button" class="inline-flex items-center rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white" id="demand-copy-zero-queries">Copy zero-result terms</button>' +
          '</div>'
        : '') +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Locations searched</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Postcode / area filter text</p>' +
      renderDemandRankList(
        browse.topLocations || [],
        'location',
        'count',
        'No location filters logged in this period yet.'
      ) +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Most saved events</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Attendee favourites</p>' +
      renderDemandRankList(favs.topEvents || [], 'title', 'saves', 'No event favourites in this period yet.') +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Most saved groups</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Organiser favourites</p>' +
      renderDemandRankList(
        favs.topOrganisers || [],
        'name',
        'saves',
        'No organiser favourites in this period yet.'
      ) +
      '</div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-1">Opportunity demand</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Views, enquiries, and saved-search terms</p>' +
      '<div class="space-y-4">' +
      '<div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Most viewed</p>' +
      renderDemandRankList(opps.topViewed || [], 'title', 'viewCount', 'No opportunity views yet.') +
      '</div>' +
      '<div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Most enquired</p>' +
      renderDemandRankList(opps.topEnquired || [], 'title', 'enquiries', 'No enquiries in this period yet.') +
      '</div>' +
      '<div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Saved search terms</p>' +
      renderDemandRankList(
        opps.savedSearchTerms || [],
        'query',
        'count',
        'No opportunity saved-search terms in this period.'
      ) +
      '</div></div></div></div></section>'
    );
  }

  function csvEscapeCell(value) {
    var s = String(value == null ? '' : value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadAdminCsv(filename, rows) {
    var csv = rows
      .map(function (row) {
        return row.map(csvEscapeCell).join(',');
      })
      .join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(a.href);
      } catch (_e) {
        /* ignore */
      }
    }, 1000);
  }

  function exportDemandSearchesCsv(data) {
    var browse = (data && data.browseSearches) || {};
    var rows = [['type', 'term', 'count']];
    (browse.topQueries || []).forEach(function (row) {
      rows.push(['top_search', row.query || '', row.count || 0]);
    });
    (browse.zeroResultQueries || []).forEach(function (row) {
      rows.push(['zero_result', row.query || '', row.count || 0]);
    });
    (browse.topLocations || []).forEach(function (row) {
      rows.push(['location', row.location || '', row.count || 0]);
    });
    if (rows.length === 1) {
      window.alert('No search terms to export for this period yet.');
      return;
    }
    var period = String((data && data.period) || analyticsState.period || 'period');
    downloadAdminCsv('demand-searches-' + period + '.csv', rows);
  }

  function analyticsPeriodToolbarHtml() {
    return (
      '<div class="flex flex-wrap gap-2" id="analytics-period-controls">' +
        analyticsPeriodBtn('7d', '7 days') +
        analyticsPeriodBtn('30d', '30 days') +
      analyticsPeriodBtn('all', 'All time') +
      '</div>'
    );
  }

  function loadAnalyticsDemandPanel() {
    var demandPanel = document.getElementById('analytics-demand');
    if (!demandPanel) return;
    demandPanel.innerHTML = '<p class="text-sm text-slate-500">Loading demand insights…</p>';
    adminGet('/api/admin/demand?period=' + encodeURIComponent(analyticsState.period)).then(function (data) {
      analyticsState.demandCache = data;
      if (demandPanel) demandPanel.innerHTML = renderDemandPanel(data);
      var copyBtn = document.getElementById('demand-copy-zero-queries');
      if (copyBtn && data && data.browseSearches && data.browseSearches.zeroResultQueries) {
        copyBtn.addEventListener('click', function () {
          var lines = (data.browseSearches.zeroResultQueries || [])
            .map(function (row) {
              return String(row.query || '') + '\t' + String(row.count || 0);
            })
            .join('\n');
          if (!lines) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(lines).then(function () {
              copyBtn.textContent = 'Copied';
            });
          }
        });
      }
    });
  }

  function loadAnalyticsInsightsPanel() {
    var panel = document.getElementById('analytics-insights');
    if (!panel) return;
    panel.innerHTML = '<p class="text-sm text-slate-500">Loading platform insights…</p>';
    adminGet('/api/admin/insights?period=' + encodeURIComponent(analyticsState.period)).then(function (data) {
      if (panel) panel.innerHTML = renderInsightsPanel(data);
    });
  }

  function reloadCurrentAnalyticsPeriod() {
    if (document.getElementById('analytics-demand')) loadAnalyticsDemandPanel();
    if (document.getElementById('analytics-insights')) loadAnalyticsInsightsPanel();
  }

  function bindAnalyticsControls() {
    if (document.body.dataset.analyticsPeriodBound) return;
    document.body.dataset.analyticsPeriodBound = '1';
    document.body.addEventListener('click', function (e) {
      if (e.target.closest('#demand-export-csv')) {
        exportDemandSearchesCsv(analyticsState.demandCache);
        return;
      }
      var btn = e.target.closest('[data-analytics-period]');
      if (!btn) return;
      var period = btn.getAttribute('data-analytics-period');
      if (!period || period === analyticsState.period) return;
      analyticsState.period = period;
      reloadCurrentAnalyticsPeriod();
      document.querySelectorAll('[data-analytics-period]').forEach(function (el) {
        var on = el.getAttribute('data-analytics-period') === analyticsState.period;
        el.className =
          'rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
          (on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200');
      });
    });
  }

  function paintAnalyticsOverviewMetrics() {
    fetchAdminMetrics(false).then(function (data) {
      var metricsEl = document.getElementById('analytics-platform-metrics');
      var activityEl = document.getElementById('analytics-activity');
      if (!data || data.error || data.configured === false) {
        if (metricsEl) {
          metricsEl.innerHTML =
            '<p class="sm:col-span-2 text-sm text-red-700">Could not load platform metrics. Check Supabase env vars on Vercel.</p>';
        }
        if (activityEl) {
          activityEl.innerHTML =
            '<li class="text-sm text-red-700">Activity feed unavailable.</li>';
        }
        return;
      }
      var m = data.metrics || {};
      var listings = m.listings || {};
      if (metricsEl) {
        metricsEl.innerHTML =
          card('Hub accounts', String(m.attendees || 0), 'hub_accounts and attendee profiles', 'blue') +
          card(
            'On events browse',
            String(m.liveEvents || 0),
            (listings.total || 0) +
              ' approved all-time · Meetings ' +
              (listings.meetings || 0) +
              ' · Exhibitions ' +
              (listings.exhibitions || 0),
            'brand'
          ) +
          card(
            'On organiser browse',
            String(m.browseOrganisers != null ? m.browseOrganisers : m.organisers || 0),
            (m.organisers || 0) + ' group profiles all-time',
            'violet'
          ) +
          card(
            'Hub booking fees',
            fmtMoney(m.fees || 0),
            'After Stripe · ticket volume ' + fmtMoney(m.revenue || 0) + ' (organiser · E2E excluded)',
            'emerald'
          );
      }
      if (activityEl) {
        activityEl.innerHTML = renderActivityList(data.activity, 8);
      }
    });
  }

  function renderAnalyticsOverview() {
    var trackingOn = analyticsTrackingActive();
    main.innerHTML =
      '<div class="space-y-5 min-w-0">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm">' +
      '<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">' +
      '<div class="flex items-start gap-3 min-w-0">' +
      '<span class="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-700 text-lg" aria-hidden="true">▤</span>' +
      '<div class="min-w-0">' +
      '<h3 class="font-bold text-brand-900">Visitor traffic on Vercel</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Charts live in Vercel — visitors, pages, referrers, countries, and devices.</p>' +
      '</div></div>' +
      '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
      '<span class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ' +
      (trackingOn ? 'text-emerald-700 bg-emerald-50' : 'text-amber-800 bg-amber-50') +
      '">' +
      '<span class="w-2 h-2 rounded-full ' +
      (trackingOn ? 'bg-emerald-500' : 'bg-amber-500') +
      '"></span>' +
      (trackingOn ? 'Tracking active' : 'Tracking not detected') +
      '</span>' +
      '<a href="' +
      attrEsc(VERCEL_ANALYTICS_URL) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-brand-900 transition">Open analytics <span aria-hidden="true">↗</span></a>' +
      '</div></div></section>' +
      '<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm min-w-0">' +
      '<h3 class="font-bold text-brand-900">Hub platform activity</h3>' +
      '<p class="text-sm text-slate-500 mt-1 mb-4">Live Supabase counts — separate from anonymous visitor traffic.</p>' +
      '<div class="admin-metric-grid admin-metric-grid--4" id="analytics-platform-metrics">' +
      card('Hub accounts', '…', 'Loading…', 'blue') +
      card('On events browse', '…', 'Loading…', 'brand') +
      card('On organiser browse', '…', 'Loading…', 'violet') +
      card('Hub booking fees', '…', 'Loading…', 'emerald') +
      '</div></section>' +
      '<aside class="admin-panel-sticky bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm min-w-0 flex flex-col">' +
      '<h3 class="font-bold text-brand-900 text-sm shrink-0">Recent genuine activity</h3>' +
      '<p class="text-xs text-slate-500 mt-1 mb-3 shrink-0">Excludes E2E and test seed data.</p>' +
      '<ul id="analytics-activity" class="admin-activity-feed space-y-0 min-h-0 pr-1 -mr-1">' +
      '<li class="text-sm text-slate-500">Loading…</li></ul>' +
      '</aside></div>' +
      '<p class="text-sm text-slate-500">Need deeper signals? Open <a href="#analytics/demand" class="font-semibold text-brand-700 hover:underline">Demand</a> or <a href="#analytics/insights" class="font-semibold text-brand-700 hover:underline">Insights</a>.</p>' +
      '</div>';
    paintAnalyticsOverviewMetrics();
  }

  function renderAnalyticsDemand() {
    main.innerHTML =
      '<div class="space-y-4 min-w-0">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">' +
      '<p class="text-sm text-slate-500">Consent-gated browse searches plus favourites, enquiries, and guest visits.</p>' +
      analyticsPeriodToolbarHtml() +
      '</div>' +
      '<div id="analytics-demand"><p class="text-sm text-slate-500">Loading demand insights…</p></div></div>';
    loadAnalyticsDemandPanel();
  }

  function renderAnalyticsInsights() {
    main.innerHTML =
      '<div class="space-y-4 min-w-0">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">' +
      '<p class="text-sm text-slate-500">Top performers and growth quality from Supabase registrations.</p>' +
      analyticsPeriodToolbarHtml() +
      '</div>' +
      '<div id="analytics-insights"><p class="text-sm text-slate-500">Loading platform insights…</p></div></div>';
    loadAnalyticsInsightsPanel();
  }

  function renderAnalyticsHub(fullHash) {
    bindAnalyticsControls();
    var tab = resolveHubTab(fullHash, 'analytics', ['overview', 'demand', 'insights'], 'overview');
    if (!tab) return;
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'overview', label: 'Overview', href: '#analytics/overview' },
        { key: 'demand', label: 'Demand', href: '#analytics/demand' },
        { key: 'insights', label: 'Insights', href: '#analytics/insights' },
      ],
      tab
    );
    if (tab === 'demand') withHubTabs(tabsHtml, renderAnalyticsDemand);
    else if (tab === 'insights') withHubTabs(tabsHtml, renderAnalyticsInsights);
    else withHubTabs(tabsHtml, renderAnalyticsOverview);
  }

  function renderAnalytics() {
    renderAnalyticsHub(currentAdminHash());
  }

  function applyDashboardMetrics(data) {
    var metricsEl = document.getElementById('dashboard-metrics');
    var preEl = document.getElementById('live-metrics');
    if (!metricsEl && !preEl) return;

    if (!data || data.error || data.configured === false) {
      if (preEl) {
        preEl.innerHTML =
          '<p class="text-sm text-red-700">Snapshot unavailable. Check Supabase env vars on Vercel.</p>';
      }
      return;
    }

    if (data.light || !data.metrics) return;

    var m = data.metrics || {};
    var listings = m.listings || {};

    if (metricsEl) {
      metricsEl.innerHTML =
        card(
          'Hub booking fees',
          fmtMoney(m.fees || 0),
          'Your cut after Stripe (E2E/test excluded) · organiser ticket volume ' +
          fmtMoney(m.revenue || 0)
        ) +
        card(
          'On events browse',
          String(m.liveEvents || 0),
          (listings.total || 0) +
            ' approved all-time · Meetings ' +
            (listings.meetings || 0) +
            ' · Exhibitions ' +
            (listings.exhibitions || 0)
        ) +
        card(
          'On organiser browse',
          String(m.browseOrganisers != null ? m.browseOrganisers : m.organisers || 0),
          (m.organisers || 0) + ' group profiles all-time'
        ) +
        card('Member accounts', String(m.attendees || 0), 'People signed up on the Hub');
    }

    if (preEl) preEl.innerHTML = renderMetricsSummary(data);
  }

  function revenueTargetStatusClass(status) {
    if (status === 'achieved' || status === 'on_track') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'at_risk') return 'text-amber-800 bg-amber-50 border-amber-200';
    return 'text-red-800 bg-red-50 border-red-200';
  }

  function revenueTargetBarColor(status) {
    if (status === 'achieved' || status === 'on_track') return 'bg-emerald-500';
    if (status === 'at_risk') return 'bg-amber-500';
    return 'bg-red-500';
  }

  function renderRevenueTargetsPanel(targets, section) {
    if (!targets || targets.error) {
      return (
        '<p class="text-sm text-red-700">Could not load revenue targets' +
        (targets && targets.error ? ': ' + esc(targets.error) : '.') +
        '</p>'
      );
    }

    var period = targets.period || {};
    var totals = targets.totals || {};
    var categories = targets.categories || [];
    var assessment = targets.assessment || {};

    var summary =
      '<div class="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 sm:p-5">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><p class="text-xs font-semibold uppercase tracking-wide text-brand-700">Revenue targets</p>' +
      '<p class="text-lg font-bold text-brand-900 mt-1">' +
      esc(period.label || 'Target period') +
      '</p>' +
      '<p class="text-sm text-slate-600 mt-1">' +
      esc(String(period.daysElapsed || 0)) +
      ' of ' +
      esc(String(period.daysTotal || 0)) +
      ' days elapsed · ' +
      esc(String(period.daysRemaining || 0)) +
      ' days remaining</p></div>' +
      '<div class="text-right"><p class="text-2xl font-bold text-brand-900">' +
      esc(fmtMoney(totals.actual || 0)) +
      '</p>' +
      '<p class="text-xs text-slate-500">of ' +
      esc(fmtMoney(totals.target || 0)) +
      ' target</p>' +
      '<span class="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full border ' +
      revenueTargetStatusClass(totals.status) +
      '">' +
      esc(totals.statusLabel || '') +
      '</span></div></div>' +
      '<div class="mt-4"><div class="h-2.5 rounded-full bg-white/80 border border-brand-100 overflow-hidden">' +
      '<div class="h-full ' +
      revenueTargetBarColor(totals.status) +
      ' transition-all" style="width:' +
      Math.min(100, Number(totals.progressPct) || 0) +
      '%"></div></div>' +
      '<div class="flex flex-wrap justify-between gap-2 mt-2 text-xs text-slate-600">' +
      '<span>' +
      esc(String(totals.progressPct || 0)) +
      '% achieved</span>' +
      '<span>Forecast: ' +
      esc(fmtMoney(totals.forecast || 0)) +
      ' (' +
      esc(String(totals.forecastPct || 0)) +
      '%)</span></div></div></div>';

    var assessmentHtml =
      '<div class="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">' +
      '<p class="font-semibold text-brand-900">Are these targets achievable?</p>' +
      '<p class="mt-2">' +
      esc(assessment.headline || '') +
      '</p>' +
      (assessment.notes && assessment.notes.length
        ? '<ul class="mt-3 space-y-1.5 text-xs text-slate-600 list-disc pl-4">' +
          assessment.notes
            .map(function (note) {
              return '<li>' + esc(note) + '</li>';
            })
            .join('') +
          '</ul>'
        : '') +
      '</div>';

    var chartTabs =
      '<div class="flex flex-wrap gap-1.5" id="revenue-chart-tabs" role="tablist" aria-label="Revenue chart category">' +
      '<button type="button" class="revenue-chart-tab is-active" data-revenue-chart-view="overall" role="tab" aria-selected="true">All revenue</button>' +
      categories
        .map(function (cat) {
          return (
            '<button type="button" class="revenue-chart-tab" data-revenue-chart-view="' +
            attrEsc(cat.id) +
            '" role="tab" aria-selected="false">' +
            esc(cat.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>';

    var chartSection =
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">Revenue trend</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Monthly actuals, current-month forecast, and target pace — switch category to compare streams.</p></div>' +
      '<div class="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Chart mode">' +
      '<button type="button" class="revenue-chart-mode px-3 py-1.5 rounded-md font-semibold is-active" data-revenue-chart-mode="monthly">Monthly</button>' +
      '<button type="button" class="revenue-chart-mode px-3 py-1.5 rounded-md font-semibold" data-revenue-chart-mode="cumulative">Cumulative</button>' +
      '</div></div>' +
      chartTabs +
      '<div class="relative h-72 sm:h-80"><canvas id="revenue-targets-chart" aria-label="Revenue line chart"></canvas></div>' +
      '<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">' +
      '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-3 h-0.5 bg-brand-700 rounded"></span> Actual</span>' +
      '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-3 h-0.5 bg-violet-500 rounded border-b border-dashed border-violet-500"></span> Current month forecast</span>' +
      '<span class="inline-flex items-center gap-1.5"><span class="inline-block w-3 h-0.5 bg-slate-400 rounded opacity-70"></span> Target pace</span>' +
      '</div></section>';

    var categoryCards = categories
      .map(function (cat) {
        var progress = Math.min(100, Number(cat.progressPct) || 0);
        return (
          '<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">' +
          '<div class="flex items-start justify-between gap-2">' +
          '<div><h4 class="font-bold text-brand-900 text-sm">' +
          esc(cat.label) +
          '</h4>' +
          '<p class="text-xs text-slate-500 mt-0.5">' +
          esc(cat.description || '') +
          '</p></div>' +
          '<span class="text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ' +
          revenueTargetStatusClass(cat.status) +
          '">' +
          esc(cat.statusLabel || '') +
          '</span></div>' +
          '<div class="mt-3 flex items-end justify-between gap-2">' +
          '<div><p class="text-xl font-bold text-brand-900">' +
          esc(fmtMoney(cat.actual || 0)) +
          '</p>' +
          '<p class="text-xs text-slate-500">Target ' +
          esc(fmtMoney(cat.target || 0)) +
          '</p></div>' +
          '<div class="text-right text-xs text-slate-500">' +
          '<p>Forecast ' +
          esc(fmtMoney(cat.forecast || 0)) +
          '</p>' +
          '<p>Need ' +
          esc(fmtMoney(cat.monthlyNeeded || 0)) +
          '/mo</p></div></div>' +
          '<div class="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">' +
          '<div class="h-full ' +
          revenueTargetBarColor(cat.status) +
          '" style="width:' +
          progress +
          '%"></div></div>' +
          (cat.breakdown && cat.breakdown.length
            ? '<details class="mt-3 text-xs"><summary class="cursor-pointer text-brand-700 font-semibold">' +
              esc(String(cat.breakdown.length)) +
              ' revenue item' +
              (cat.breakdown.length === 1 ? '' : 's') +
              '</summary><ul class="mt-2 space-y-1 text-slate-600">' +
              cat.breakdown
                .slice(0, 12)
                .map(function (item) {
                  var canRemove = item.type === 'manual' && item.id;
                  return (
                    '<li class="flex justify-between gap-2 items-start">' +
                    '<span>' +
                    esc(item.source) +
                    (item.type === 'manual'
                      ? ' <span class="text-slate-400">(manual)</span>'
                      : item.type === 'stripe'
                        ? ' <span class="text-slate-400">(Stripe)</span>'
                        : '') +
                    '</span><span class="font-medium shrink-0 text-right">' +
                    esc(fmtMoney(item.amount || 0)) +
                    (canRemove
                      ? '<button type="button" class="block text-[11px] text-red-700 hover:underline mt-0.5 ml-auto" data-delete-revenue-deal="' +
                        attrEsc(item.id) +
                        '">Remove</button>'
                      : '') +
                    '</span></li>'
                  );
                })
                .join('') +
              (cat.breakdown.length > 12
                ? '<li class="text-slate-400">+' + (cat.breakdown.length - 12) + ' more</li>'
                : '') +
              '</ul></details>'
            : '<p class="mt-3 text-xs text-slate-400">No revenue recorded yet in this category.</p>') +
          '</article>'
        );
      })
      .join('');

    var dealsMissing =
      targets.dealsTableMissing
        ? '<p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Run migration <code class="text-[11px]">105_hub_revenue_deals.sql</code> in Supabase to log sponsorship revenue manually.</p>'
        : '';

    var stripeHelp =
      '<div class="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700 mb-4">' +
      '<p class="font-semibold text-brand-900">Stripe invoices (recommended)</p>' +
      '<p class="mt-1 text-xs text-slate-600">Create sponsorship invoices in Stripe and add metadata <code class="text-[11px] bg-white px-1 rounded">revenue_category</code> ' +
      '(e.g. <code class="text-[11px] bg-white px-1 rounded">events</code>, <code class="text-[11px] bg-white px-1 rounded">browse_organisers</code>). ' +
      'When the invoice is paid, revenue appears here automatically. See <code class="text-[11px]">docs/STRIPE-SPONSORSHIP-INVOICES.md</code>.</p></div>';

    var manualForm =
      '<form id="revenue-deal-form" class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">' +
      '<label class="block text-xs"><span class="font-semibold text-slate-600">Category</span>' +
      '<select name="category" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" required>' +
      categories
        .map(function (cat) {
          return (
            '<option value="' +
            attrEsc(cat.id) +
            '">' +
            esc(cat.label) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="block text-xs sm:col-span-2"><span class="font-semibold text-slate-600">Source / sponsor</span>' +
      '<input name="source_label" type="text" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="e.g. Main Events Directory Sponsor — Acme Ltd" required /></label>' +
      '<label class="block text-xs"><span class="font-semibold text-slate-600">Amount (£)</span>' +
      '<input name="amount_gbp" type="number" min="0.01" step="0.01" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" required /></label>' +
      '<label class="block text-xs"><span class="font-semibold text-slate-600">Paid on</span>' +
      '<input name="recorded_at" type="date" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" /></label>' +
      '<div class="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-3">' +
      '<label class="block text-xs flex-1 min-w-[12rem]"><span class="font-semibold text-slate-600">Notes (optional)</span>' +
      '<input name="notes" type="text" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Invoice ref, months covered, etc." /></label>' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Log revenue</button>' +
      '<p id="revenue-deal-form-status" class="text-xs text-slate-500" role="status"></p></div></form>';

    var manualDeals = targets.manualDeals || [];
    var removableDeals = manualDeals.filter(function (deal) {
      return !deal.source_type || deal.source_type === 'manual';
    });
    var syncedDeals = manualDeals.filter(function (deal) {
      return deal.source_type && deal.source_type !== 'manual';
    });

    function dealRowHtml(deal, canRemove) {
      var recorded = deal.recorded_at
        ? new Date(deal.recorded_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '—';
      return (
        '<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2.5">' +
        '<div class="min-w-0">' +
        '<p class="font-medium text-brand-900 truncate">' +
        esc(deal.source_label || '—') +
        '</p>' +
        '<p class="text-xs text-slate-500 mt-0.5">' +
        esc(deal.category || '') +
        ' · ' +
        esc(recorded) +
        (deal.notes ? ' · ' + esc(deal.notes) : '') +
        (!canRemove ? ' · Stripe (edit in Stripe)' : '') +
        '</p></div>' +
        '<div class="flex items-center gap-3 shrink-0">' +
        '<span class="font-semibold">' +
        esc(fmtMoney(deal.amount_gbp || 0)) +
        '</span>' +
        (canRemove
          ? '<button type="button" class="rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs font-semibold px-2.5 py-1.5 hover:bg-red-100" data-delete-revenue-deal="' +
            attrEsc(deal.id) +
            '">Remove</button>'
          : '') +
        '</div></li>'
      );
    }

    var manualList =
      '<div class="mt-6 border-t border-slate-100 pt-5 space-y-4">' +
      '<div><h4 class="text-sm font-bold text-brand-900">Logged deals</h4>' +
      '<p class="text-xs text-slate-500 mt-0.5">Remove a manual entry anytime. Stripe-synced rows stay until the invoice is voided or credited in Stripe.</p></div>' +
      (removableDeals.length
        ? '<div><h5 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Manual entries (' +
          removableDeals.length +
          ')</h5><ul class="space-y-2 text-sm">' +
          removableDeals.map(function (deal) {
            return dealRowHtml(deal, true);
          }).join('') +
          '</ul></div>'
        : '<p class="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-3 py-4">No manual deals yet — use the form above to add one.</p>') +
      (syncedDeals.length
        ? '<div><h5 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Stripe-synced (' +
          syncedDeals.length +
          ')</h5><ul class="space-y-2 text-sm">' +
          syncedDeals.map(function (deal) {
            return dealRowHtml(deal, false);
          }).join('') +
          '</ul></div>'
        : '') +
      '</div>';

    var overviewHtml =
      '<div class="space-y-4">' +
      summary +
      assessmentHtml +
      '<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">' +
      categoryCards +
      '</div></div>';

    var dealsHtml =
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Log sponsorship &amp; advertising revenue</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Stripe invoices with the correct metadata are logged automatically when paid. Use the form for offline payments, then <span class="font-semibold">Remove</span> if you need to correct a manual entry.</p>' +
      dealsMissing +
      stripeHelp +
      '<div class="mt-4">' +
      manualForm +
      manualList +
      '</div></section>';

    if (section === 'overview') return overviewHtml;
    if (section === 'chart') return '<div class="space-y-4">' + chartSection + '</div>';
    if (section === 'deals') return '<div class="space-y-4">' + dealsHtml + '</div>';

    return (
      '<div class="space-y-4">' +
      summary +
      chartSection +
      assessmentHtml +
      '<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">' +
      categoryCards +
      '</div>' +
      dealsHtml +
      '</div>'
    );
  }

  function ensureChartJs() {
    if (window.Chart) return Promise.resolve(window.Chart);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-revenue-chartjs]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (window.Chart) resolve(window.Chart);
          else reject(new Error('chart_unavailable'));
        });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      // Must use unpkg — site CSP allows unpkg.com, not cdn.jsdelivr.net.
      script.src = 'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js';
      script.async = true;
      script.setAttribute('data-revenue-chartjs', '1');
      script.onload = function () {
        if (window.Chart) resolve(window.Chart);
        else reject(new Error('chart_unavailable'));
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function revenueChartSeriesData(chartData, mode) {
    var months = (chartData && chartData.months) || [];
    var labels = months.map(function (m) {
      return m.isCurrent ? m.label + ' (current)' : m.label;
    });

    if (mode === 'cumulative') {
      return {
        labels: labels,
        actual: months.map(function (m) {
          return m.cumulativeActual;
        }),
        forecast: months.map(function (m) {
          return m.isCurrent ? m.cumulativeForecast : null;
        }),
        target: months.map(function (m) {
          return m.cumulativeTarget;
        }),
      };
    }

    return {
      labels: labels,
      actual: months.map(function (m) {
        return m.actual;
      }),
      forecast: months.map(function (m) {
        return m.isCurrent ? m.forecast : null;
      }),
      target: months.map(function (m) {
        return m.targetMonthly;
      }),
    };
  }

  function destroyRevenueTargetsChart() {
    if (revenueTargetsChartInstance) {
      revenueTargetsChartInstance.destroy();
      revenueTargetsChartInstance = null;
    }
  }

  function renderRevenueTargetsChart() {
    var canvas = document.getElementById('revenue-targets-chart');
    if (!canvas || !revenueTargetsChartsCache) return;

    var chartData =
      revenueTargetsChartView === 'overall'
        ? revenueTargetsChartsCache.overall
        : revenueTargetsChartsCache.byCategory[revenueTargetsChartView];
    if (!chartData) return;

    ensureChartJs()
      .then(function (Chart) {
        destroyRevenueTargetsChart();
        var series = revenueChartSeriesData(chartData, revenueTargetsChartMode);
        var yTitle = revenueTargetsChartMode === 'cumulative' ? 'Cumulative £' : 'Monthly £';

        revenueTargetsChartInstance = new Chart(canvas, {
          type: 'line',
          data: {
            labels: series.labels,
            datasets: [
              {
                label: 'Actual',
                data: series.actual,
                borderColor: '#5b2f99',
                backgroundColor: 'rgba(91, 47, 153, 0.08)',
                borderWidth: 2.5,
                pointRadius: 4,
                pointHoverRadius: 5,
                tension: 0.25,
                spanGaps: false,
                fill: false,
              },
              {
                label: 'Current month forecast',
                data: series.forecast,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 5,
                pointStyle: 'rectRot',
                tension: 0.15,
                spanGaps: false,
                fill: false,
              },
              {
                label: 'Target pace',
                data: series.target,
                borderColor: '#94a3b8',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 0,
                tension: 0,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var value = ctx.parsed.y;
                    if (value == null) return null;
                    return ctx.dataset.label + ': £' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  },
                },
              },
              title: {
                display: true,
                text:
                  (chartData.label || 'Revenue') +
                  ' — ' +
                  (revenueTargetsChartMode === 'cumulative' ? 'cumulative' : 'monthly'),
                color: '#2d1b4e',
                font: { size: 13, weight: '600' },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } },
              },
              y: {
                title: { display: true, text: yTitle, font: { size: 11 } },
                ticks: {
                  callback: function (value) {
                    return '£' + Number(value).toLocaleString('en-GB');
                  },
                },
              },
            },
          },
        });
      })
      .catch(function () {
        var wrap = canvas.parentElement;
        if (wrap) {
          wrap.innerHTML =
            '<p class="text-sm text-red-700">Could not load chart library. Check your connection and refresh.</p>';
        }
      });
  }

  function syncRevenueChartTabs() {
    document.querySelectorAll('[data-revenue-chart-view]').forEach(function (btn) {
      var active = btn.getAttribute('data-revenue-chart-view') === revenueTargetsChartView;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-revenue-chart-mode]').forEach(function (btn) {
      var active = btn.getAttribute('data-revenue-chart-mode') === revenueTargetsChartMode;
      btn.classList.toggle('is-active', active);
    });
  }

  function loadRevenueTargets(section) {
    var panel = document.getElementById('revenue-targets-panel');
    if (!panel) return Promise.resolve();
    var view = section || 'overview';
    panel.innerHTML = '<p class="text-sm text-slate-500">Loading revenue targets…</p>';
    return adminGet('/api/admin/revenue-targets').then(function (data) {
      if (!data || data.ok === false || data.error || data.configured === false) {
        panel.innerHTML =
          '<p class="text-sm text-red-700">' +
          esc((data && (data.message || data.error)) || 'Could not load revenue targets.') +
          '</p>';
        return;
      }
      panel.innerHTML = renderRevenueTargetsPanel(data.revenueTargets, view);
      revenueTargetsChartsCache = data.revenueTargets.charts || null;
      if (view === 'chart') {
      revenueTargetsChartView = 'overall';
      revenueTargetsChartMode = 'monthly';
      syncRevenueChartTabs();
      renderRevenueTargetsChart();
      } else {
        destroyRevenueTargetsChart();
      }
    });
  }

  function bindRevenueTargetsEvents() {
    var mainEl = document.getElementById('admin-main') || main;
    if (!mainEl || mainEl._revenueTargetsBound) return;
    mainEl._revenueTargetsBound = true;

    mainEl.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.id !== 'revenue-deal-form') return;
      e.preventDefault();
      var status = document.getElementById('revenue-deal-form-status');
      if (status) status.textContent = 'Saving…';

      var body = {
        category: form.category.value,
        source_label: form.source_label.value,
        amount_gbp: form.amount_gbp.value,
        notes: form.notes.value,
      };
      if (form.recorded_at && form.recorded_at.value) {
        body.recorded_at = form.recorded_at.value;
      }

      adminPost('/api/admin/revenue-deals', body).then(function (data) {
        if (!data || data.ok === false || data.error) {
          if (status) status.textContent = data.message || data.error || 'Could not save.';
          return;
        }
        if (status) status.textContent = 'Saved.';
        form.reset();
        loadRevenueTargets(recalledHubTab('revenue-targets', 'deals'));
      });
    });

    mainEl.addEventListener('click', function (e) {
      var chartTab = e.target.closest('[data-revenue-chart-view]');
      if (chartTab) {
        revenueTargetsChartView = chartTab.getAttribute('data-revenue-chart-view') || 'overall';
        syncRevenueChartTabs();
        renderRevenueTargetsChart();
        return;
      }

      var chartMode = e.target.closest('[data-revenue-chart-mode]');
      if (chartMode) {
        revenueTargetsChartMode = chartMode.getAttribute('data-revenue-chart-mode') || 'monthly';
        syncRevenueChartTabs();
        renderRevenueTargetsChart();
        return;
      }

      var btn = e.target.closest('[data-delete-revenue-deal]');
      if (!btn) return;
      var id = btn.getAttribute('data-delete-revenue-deal');
      if (!id || !window.confirm('Remove this manual revenue entry? This cannot be undone.')) return;
      btn.disabled = true;
      var stayOn = recalledHubTab('revenue-targets', 'overview');
      adminPost('/api/admin/revenue-deals', { action: 'delete', id: id })
        .then(function (data) {
          if (!data || data.ok === false || data.error) {
            window.alert((data && (data.message || data.error)) || 'Could not remove deal.');
            btn.disabled = false;
            return;
          }
          loadRevenueTargets(stayOn);
        })
        .catch(function (err) {
          window.alert((err && err.message) || 'Could not remove deal.');
          btn.disabled = false;
        });
    });
  }

  function renderRevenueTargetsSection(section) {
    destroyRevenueTargetsChart();
    main.innerHTML =
      '<div class="space-y-6">' +
      '<div id="revenue-targets-panel"><p class="text-sm text-slate-500">Loading revenue targets…</p></div></div>';
    bindRevenueTargetsEvents();
    loadRevenueTargets(section);
  }

  function renderRevenueTargetsHub(fullHash) {
    var tab = resolveHubTab(fullHash, 'revenue-targets', ['overview', 'chart', 'deals'], 'overview');
    if (!tab) return;
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'overview', label: 'Overview', href: '#revenue-targets/overview' },
        { key: 'chart', label: 'Chart', href: '#revenue-targets/chart' },
        { key: 'deals', label: 'Deals', href: '#revenue-targets/deals' },
      ],
      tab
    );
    withHubTabs(tabsHtml, function () {
      renderRevenueTargetsSection(tab);
    });
  }

  function renderRevenueTargets() {
    renderRevenueTargetsHub(currentAdminHash());
  }

  function renderDashboard() {
    if (!document.getElementById('dashboard-action-queue') && !document.getElementById('dashboard-alerts')) {
      main.innerHTML =
        '<div class="space-y-5">' +
        '<section class="admin-stat-grid admin-stat-grid--4" id="dashboard-metrics">' +
        card('Hub booking fees', '…', 'Loading…') +
        card('On events browse', '…', 'Loading…') +
        card('On organiser browse', '…', 'Loading…') +
        card('Member accounts', '…', 'Loading…') +
        '</section>' +
        '<section class="admin-dash-section">' +
        '<div class="admin-dash-section-head"><h3>Quick links</h3>' +
        '<p>Jump straight to the pages you use most often.</p></div>' +
        '<div class="admin-dash-section-body"><div class="admin-shortcut-grid">' +
        '<a href="#cleanup/groups" class="admin-shortcut"><span class="admin-shortcut-label">Fix listings</span><span class="admin-shortcut-desc">Group pages and events</span></a>' +
        '<a href="#financials/payouts" class="admin-shortcut"><span class="admin-shortcut-label">Payouts</span><span class="admin-shortcut-desc">Approve and mark paid</span></a>' +
        '<a href="#moderation/reports" class="admin-shortcut"><span class="admin-shortcut-label">Open reports</span><span class="admin-shortcut-desc">Listing and review reports</span></a>' +
        '<a href="#analytics/demand" class="admin-shortcut"><span class="admin-shortcut-label">Demand signals</span><span class="admin-shortcut-desc">Searches, saves, enquiries</span></a>' +
        '</div></div></section>' +
        '<section class="admin-dash-section" id="dashboard-scheduled-reminders-section">' +
        '<div class="admin-dash-section-head"><h3>Scheduled reminders</h3>' +
        '<p>Future tasks — these move into Things to do when due.</p></div>' +
        '<div class="admin-dash-section-body" id="dashboard-scheduled-reminders"></div></section>' +
        '<section class="admin-needs-attention" id="dashboard-needs-attention" hidden>' +
        '<div class="admin-needs-attention-head"><h3>Needs attention</h3>' +
        '<p>Live counts — tap to jump straight in.</p></div>' +
        '<div class="admin-needs-attention-body" id="dashboard-needs-attention-body"></div></section>' +
        '<section class="admin-dash-section" id="dashboard-action-section">' +
        '<div class="admin-dash-section-head"><h3>Things to do</h3>' +
        '<p>Work through these in order — urgent items are listed first.</p></div>' +
        '<div class="admin-dash-section-body">' +
        '<div class="admin-action-queue min-h-[6rem]" id="dashboard-action-queue">' +
        '<div class="admin-action-row admin-action-row--static" aria-hidden="true">' +
        '<span class="admin-action-priority admin-action-priority--low">—</span>' +
        '<span class="admin-action-body"><span class="admin-action-title">Loading queue…</span></span>' +
        '</div></div></div></section>' +
        '<section class="admin-dash-section" id="dashboard-disputes-section" hidden>' +
        '<div class="admin-dash-section-head"><h3>Group profile disputes</h3>' +
        '<p>An organiser signed in and said a pre-imported profile is not theirs.</p></div>' +
        '<div class="admin-dash-section-body" id="dashboard-disputes"><p class="text-sm text-slate-500">Loading…</p></div></section>' +
        '<section class="admin-dash-section" id="dashboard-claim-requests-section" hidden>' +
        '<div class="admin-dash-section-head"><h3>Organiser claim requests</h3>' +
        '<p>Someone asked to claim a public group profile — verify the claimant, then approve.</p></div>' +
        '<div class="admin-dash-section-body" id="dashboard-claim-requests"><p class="text-sm text-slate-500">Loading…</p></div></section>' +
        '<section class="grid lg:grid-cols-2 gap-5">' +
        '<div class="admin-dash-section min-w-0">' +
        '<div class="admin-dash-section-head"><h3>Recent activity</h3>' +
        '<p>New sign-ups, events, and reviews.</p></div>' +
        '<div class="admin-dash-section-body pt-0">' +
        '<ul id="dashboard-activity" class="admin-activity-feed min-h-[12rem]"><li class="text-base text-slate-500">Loading…</li></ul></div></div>' +
        '<div class="admin-dash-section min-w-0">' +
        '<div class="admin-dash-section-head"><h3>At a glance</h3>' +
        '<p>Key numbers from the database.</p></div>' +
        '<div class="admin-dash-section-body pt-0">' +
        '<div id="live-metrics" class="text-base text-slate-600 min-h-[10rem]">Loading…</div></div></div></section>' +
        '<a href="#analytics/demand" class="admin-quick-link group">' +
        '<div><p class="admin-quick-link-title">Demand &amp; visitor insights</p>' +
        '<p class="admin-quick-link-desc">See what people search for, what they save, and how the Hub is growing.</p></div>' +
        '<span class="admin-action-btn">Open Demand</span></a></div>';
    }

    var cached = adminMetricsCache || readCachedAdminMetrics();
    if (cached && !cached.error && cached.configured !== false) {
      adminMetricsCache = cached;
      applyDashboardMetrics(cached);
      applyDashboardNotifications(cached);
    }

    syncScheduledRemindersSection();

    refreshAdminNotifications({ forceHealth: !healthCacheFetchedAt }).then(function (data) {
      applyDashboardMetrics(data);
    });
  }

  function adminTableScroll(html) {
    return '<div class="admin-table-scroll">' + html + '</div>';
  }

  function renderMetricsSummary(data) {
    var m = data.metrics || {};
    var listings = m.listings || {};
    var updated = data.updatedAt ? fmtTime(data.updatedAt) : '—';
    return (
      '<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">' +
      '<div><dt>On events browse</dt><dd>' +
      esc(String(m.liveEvents || 0)) +
      '</dd></div>' +
      '<div><dt>Approved all-time</dt><dd>' +
      esc(String(listings.total || 0)) +
      '</dd></div>' +
      '<div><dt>On organiser browse</dt><dd>' +
      esc(String(m.browseOrganisers != null ? m.browseOrganisers : m.organisers || 0)) +
      '</dd></div>' +
      '<div><dt>Group profiles all-time</dt><dd>' +
      esc(String(m.organisers || 0)) +
      '</dd></div>' +
      '<div><dt>Workshops listed</dt><dd>' +
      esc(String(m.providers || 0)) +
      '</dd></div>' +
      '<div><dt>Member accounts</dt><dd>' +
      esc(String(m.attendees || 0)) +
      '</dd></div>' +
      '<div><dt>Hub booking fees</dt><dd>' +
      esc(fmtMoney(m.fees || 0)) +
      '</dd></div>' +
      '<div><dt>Organiser ticket volume</dt><dd>' +
      esc(fmtMoney(m.revenue || 0)) +
      '</dd></div>' +
      '<div class="sm:col-span-2 text-sm text-slate-500 pt-1">Last updated ' +
      esc(updated) +
      ' · <details class="inline"><summary class="cursor-pointer text-brand-700">Raw JSON</summary>' +
      '<pre class="mt-2 text-[11px] bg-slate-50 p-3 rounded-lg overflow-auto max-h-40 text-slate-600">' +
      esc(JSON.stringify(data, null, 2)) +
      '</pre></details></div></dl>'
    );
  }

  function card(title, value, sub) {
    return (
      '<article class="admin-stat-card min-w-0">' +
      '<p class="admin-stat-card-label">' +
      esc(title) +
      '</p>' +
      '<p class="admin-stat-card-value">' +
      esc(value) +
      '</p>' +
      '<p class="admin-stat-card-sub">' +
      esc(sub) +
      '</p></article>'
    );
  }

  function sortUsersAlphabetically(rows) {
    return rows.slice().sort(function (a, b) {
      var nameA = String(a.name || '').trim().toLowerCase();
      var nameB = String(b.name || '').trim().toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
      return String(a.email || '').localeCompare(String(b.email || ''), 'en', { sensitivity: 'base' });
    });
  }

  function formatAccountDate(iso) {
    if (!iso) return '—';
    try {
      return fmtTime(iso);
    } catch (e) {
      return '—';
    }
  }

  function hubViewLabel(view) {
    return String(view || 'attendee') === 'organiser' ? 'Organiser' : 'Attendee';
  }

  function emailPrefRow(label, on) {
    return (
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">' +
      esc(label) +
      '</dt><dd class="font-medium text-right">' +
      (on ? 'On' : 'Off') +
      '</dd></div>'
    );
  }

  function loadUsersDirectory(callback) {
    if (liveUsersComplete && liveUsers.length) {
      callback(liveUsers);
      return;
    }
    adminGet('/api/admin/users').then(function (data) {
      if (data && !data.error && data.configured !== false) {
        liveUsers = data.users || [];
        liveUsersComplete = true;
      }
      callback(liveUsers);
    });
  }

  function submitImpersonation(email, view) {
    var btn = document.getElementById('impersonate-submit');
    if (btn) btn.disabled = true;
    adminPost('/api/admin/impersonate', { email: email, view: view || 'account', provision: true })
      .then(function (data) {
        if (!data.ok) {
          window.alert(data.message || data.error || 'Could not impersonate user.');
          if (btn) btn.disabled = false;
          return;
        }
        try {
          sessionStorage.removeItem('hub_nav_session_v1');
        } catch (e) {
          /* ignore */
        }
        window.location.href = (String(data.redirect || '/account/').charAt(0) === '/' ? String(data.redirect || '/account/') : ('../' + String(data.redirect || '/account/')));
      })
      .catch(function () {
        window.alert('Request failed. Try again.');
        if (btn) btn.disabled = false;
      });
  }

  function renderImpersonate() {
    var roleOpts = ['All', 'Admin', 'Organiser', 'Attendee'];
    main.innerHTML =
      '<div class="space-y-6 max-w-4xl">' +
      '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">' +
      '<p class="font-semibold">Support &amp; debugging only</p>' +
      '<p class="mt-1 opacity-90">You will be signed in as the chosen user across the Hub. A banner lets you return to your admin account at any time. Admin accounts cannot be impersonated. Networking group profiles get a silent login if needed (no email sent). Choose <strong>Organiser dashboard</strong> to add events on that group&apos;s profile.</p>' +
      '</div>' +
      '<form id="impersonate-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase" for="impersonate-email">User email</label>' +
      '<input type="email" id="impersonate-email" list="impersonate-email-list" required placeholder="user@company.com" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500">' +
      '<datalist id="impersonate-email-list"></datalist>' +
      '<p id="impersonate-user-hint" class="text-xs text-slate-500 mt-2">Enter a networking group email or any user email. Group profiles are linked automatically so new events attach to that organiser page.</p></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase" for="impersonate-view">Open as them in</label>' +
      '<select id="impersonate-view" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">' +
      '<option value="account">Attendee account</option>' +
      '<option value="organiser">Organiser dashboard</option>' +
      '<option value="events">Events browse</option>' +
      '</select></div>' +
      '<div id="impersonate-message" class="hidden text-sm rounded-lg px-3 py-2"></div>' +
      '<button type="submit" class="w-full rounded-lg bg-brand-700 text-white py-3 text-sm font-semibold hover:bg-brand-900 disabled:opacity-60" id="impersonate-submit">Impersonate user</button>' +
      '</form>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">' +
      '<div><h3 class="text-sm font-bold text-slate-700">Networking groups</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Search ~1,000+ group profiles by name or email — opens the organiser dashboard so you can add events.</p></div>' +
      '<p id="impersonate-groups-status" class="text-xs text-slate-500">Search to find a group</p></div>' +
      '<div class="px-4 py-3 border-b border-slate-100">' +
      '<label class="text-xs font-semibold text-slate-500 uppercase">Search groups</label>' +
      '<input type="search" id="impersonate-groups-search" placeholder="Group name or email…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></div>' +
      adminTableScroll(
        '<table class="w-full text-sm text-left"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3">Group</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Events</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="impersonate-groups-body"><tr><td colspan="4" class="px-4 py-6 text-slate-500">Type a group name or email to search.</td></tr></tbody></table>'
      ) +
      '</div>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">' +
      '<div><h3 class="text-sm font-bold text-slate-700">Browse login accounts</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">People with Hub sign-ins — not every networking group profile.</p></div>' +
      '<p id="impersonate-directory-status" class="text-xs text-slate-500">Loading…</p></div>' +
      '<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[200px]"><label class="text-xs font-semibold text-slate-500 uppercase">Search</label>' +
      '<input type="search" id="impersonate-directory-search" placeholder="Name or email…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase">Role</label>' +
      '<select id="impersonate-directory-role" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">' +
      roleOpts.map(function (r) {
        return '<option>' + esc(r) + '</option>';
      }).join('') +
      '</select></div></div>' +
      adminTableScroll(
        '<table class="w-full text-sm text-left"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">City</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="impersonate-directory-body"><tr><td colspan="5" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div></div>';

    var form = document.getElementById('impersonate-form');
    var emailInput = document.getElementById('impersonate-email');
    var datalist = document.getElementById('impersonate-email-list');
    var directoryBody = document.getElementById('impersonate-directory-body');
    var directoryStatus = document.getElementById('impersonate-directory-status');
    var directorySearch = document.getElementById('impersonate-directory-search');
    var directoryRole = document.getElementById('impersonate-directory-role');
    var messageEl = document.getElementById('impersonate-message');
    var hintEl = document.getElementById('impersonate-user-hint');
    var impersonateView = document.getElementById('impersonate-view');
    var groupsBody = document.getElementById('impersonate-groups-body');
    var groupsStatus = document.getElementById('impersonate-groups-status');
    var groupsSearch = document.getElementById('impersonate-groups-search');
    var groupsSearchTimer = null;

    function showImpersonateMessage(text, isError) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.classList.remove('hidden', 'bg-red-50', 'text-red-800', 'bg-emerald-50', 'text-emerald-800');
      messageEl.classList.add(isError ? 'bg-red-50' : 'bg-emerald-50', isError ? 'text-red-800' : 'text-emerald-800');
    }

    function impersonateFromForm(email, view) {
      var btn = document.getElementById('impersonate-submit');
      if (btn) btn.disabled = true;
      showImpersonateMessage('Switching session…', false);
      adminPost('/api/admin/impersonate', { email: email, view: view, provision: true })
        .then(function (data) {
          if (!data.ok) {
            showImpersonateMessage(data.message || data.error || 'Could not impersonate user.', true);
            if (btn) btn.disabled = false;
            return;
          }
          try {
            sessionStorage.removeItem('hub_nav_session_v1');
          } catch (e) {
            /* ignore */
          }
          window.location.href = (String(data.redirect || '/account/').charAt(0) === '/' ? String(data.redirect || '/account/') : ('../' + String(data.redirect || '/account/')));
        })
        .catch(function () {
          showImpersonateMessage('Request failed. Try again.', true);
          if (btn) btn.disabled = false;
        });
    }

    function paintGroupsRows(groups) {
      if (!groupsBody) return;
      if (!groups.length) {
        groupsBody.innerHTML =
          '<tr><td colspan="4" class="px-4 py-6 text-slate-500">No networking groups match that search.</td></tr>';
        return;
      }
      groupsBody.innerHTML = groups
        .map(function (o) {
          var canImpersonate = Boolean(o.email);
          return (
            '<tr class="border-t border-slate-100">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(o.name || 'Untitled') +
            '</td>' +
            '<td class="px-4 py-3 text-slate-600">' +
            (o.email ? esc(o.email) : '<span class="text-slate-400">No email</span>') +
            '</td>' +
            '<td class="px-4 py-3">' +
            String(o.event_count || 0) +
            '</td>' +
            '<td class="px-4 py-3 text-right">' +
            (canImpersonate
              ? '<button type="button" class="impersonate-group-btn text-xs font-semibold text-brand-700 hover:underline" data-organiser-id="' +
                attrEsc(o.id) +
                '" data-email="' +
                attrEsc(o.email) +
                '">Impersonate</button>'
              : '<span class="text-xs text-slate-400">Add email first</span>') +
            '</td></tr>'
          );
        })
        .join('');
      groupsBody.querySelectorAll('.impersonate-group-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          impersonateOrganiserGroup(
            btn.getAttribute('data-organiser-id'),
            btn.getAttribute('data-email')
          );
        });
      });
    }

    function loadImpersonateGroups(query) {
      var q = String(query || '').trim();
      if (!q) {
        if (groupsStatus) groupsStatus.textContent = 'Search to find a group';
        paintGroupsRows([]);
        if (groupsBody) {
          groupsBody.innerHTML =
            '<tr><td colspan="4" class="px-4 py-6 text-slate-500">Type a group name or email to search.</td></tr>';
        }
        return;
      }
      if (groupsStatus) groupsStatus.textContent = 'Searching…';
      adminGet('/api/admin/organisers?q=' + encodeURIComponent(q) + '&limit=50')
        .then(function (data) {
          var groups = (data && data.organisers) || [];
          if (groupsStatus) {
            groupsStatus.textContent =
              groups.length + ' group' + (groups.length === 1 ? '' : 's') + ' shown';
          }
          paintGroupsRows(groups);
        })
        .catch(function () {
          if (groupsStatus) groupsStatus.textContent = 'Search failed';
          if (groupsBody) {
            groupsBody.innerHTML =
              '<tr><td colspan="4" class="px-4 py-6 text-red-600">Could not load groups. Try again.</td></tr>';
          }
        });
    }

    function filterDirectoryUsers() {
      var q = (directorySearch && directorySearch.value || '').toLowerCase();
      var role = directoryRole ? directoryRole.value : 'All';
      return liveUsers.filter(function (u) {
        if (role !== 'All' && u.role !== role) return false;
        if (q && (u.name + u.email).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function paintDirectory() {
      if (!directoryBody) return;
      var rows = sortUsersAlphabetically(filterDirectoryUsers());
      if (!rows.length) {
        directoryBody.innerHTML =
          '<tr><td colspan="5" class="px-4 py-6 text-slate-500">No accounts match your filters.</td></tr>';
        return;
      }
      directoryBody.innerHTML = rows
        .map(function (u) {
          var canImpersonate = u.role !== 'Admin';
          return (
            '<tr class="border-t border-slate-100">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(u.name) +
            '</td>' +
            '<td class="px-4 py-3 text-slate-600">' +
            esc(u.email) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.role) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.city) +
            '</td>' +
            '<td class="px-4 py-3 text-right">' +
            (canImpersonate
              ? '<button type="button" class="impersonate-directory-btn text-xs font-semibold text-brand-700 hover:underline" data-email="' +
                attrEsc(u.email) +
                '">Impersonate</button>'
              : '<span class="text-xs text-slate-400">Admin</span>') +
            '</td></tr>'
          );
        })
        .join('');
      directoryBody.querySelectorAll('.impersonate-directory-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var email = btn.getAttribute('data-email');
          if (emailInput) emailInput.value = email;
          if (email) submitImpersonation(email, impersonateView ? impersonateView.value : 'account');
        });
      });
    }

    loadUsersDirectory(function (users) {
      if (datalist) {
        datalist.innerHTML = users
          .map(function (u) {
            return '<option value="' + attrEsc(u.email) + '">' + attrEsc(u.name || u.email) + '</option>';
          })
          .join('');
      }
      if (hintEl) {
        hintEl.textContent =
          users.length +
          ' login account' +
          (users.length === 1 ? '' : 's') +
          ' loaded. Search networking groups below, or enter any group email above.';
      }
      if (directoryStatus) {
        directoryStatus.textContent =
          users.length + ' account' + (users.length === 1 ? '' : 's') + ' loaded';
      }
      paintDirectory();
    });

    if (directorySearch) directorySearch.addEventListener('input', paintDirectory);
    if (directoryRole) directoryRole.addEventListener('change', paintDirectory);
    if (groupsSearch) {
      groupsSearch.addEventListener('input', function () {
        clearTimeout(groupsSearchTimer);
        groupsSearchTimer = setTimeout(function () {
          loadImpersonateGroups(groupsSearch.value);
        }, 280);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (emailInput && emailInput.value || '').trim();
        var view = document.getElementById('impersonate-view').value;
        if (!email) {
          showImpersonateMessage('Enter an email address.', true);
          return;
        }
        impersonateFromForm(email, view);
      });
    }
  }

  function openUserDrawer(u) {
    selectedUser = u;
    document.getElementById('drawer-name').textContent = u.name;
    document.getElementById('drawer-email').textContent = u.email;
    var impersonateAction =
      u.role === 'Admin'
        ? ''
        : '<button type="button" class="w-full rounded-lg border border-brand-200 text-brand-800 py-2.5 text-sm font-semibold hover:bg-brand-50 mb-4" id="drawer-impersonate">Impersonate this user</button>';
    document.getElementById('drawer-body').innerHTML =
      impersonateAction +
      '<dl class="space-y-3 text-sm border-t border-slate-100 pt-4">' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Role</dt><dd class="font-medium text-right">' +
      esc(u.role) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Hub view</dt><dd class="font-medium text-right">' +
      esc(hubViewLabel(u.hubView)) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Location</dt><dd class="font-medium text-right">' +
      esc(u.location || u.city || '—') +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Last sign-in</dt><dd class="font-medium text-right text-xs">' +
      esc(formatAccountDate(u.lastSignInAt)) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Account created</dt><dd class="font-medium text-right text-xs">' +
      esc(formatAccountDate(u.accountCreatedAt || u.authCreatedAt)) +
      '</dd></div>' +
      (u.organiserListingStatus
        ? '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Organiser page</dt><dd class="font-medium text-right">' +
          esc(u.organiserListingStatus) +
          '</dd></div>'
        : '') +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Featured organiser</dt><dd class="font-medium text-right">' +
      (u.featured ? 'Yes' : 'No') +
      '</dd></div></dl>' +
      '<div class="border-t border-slate-100 pt-4 mt-4">' +
      '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Account settings (as user sees)</p>' +
      '<dl class="space-y-3 text-sm">' +
      emailPrefRow('Hub marketing', u.emailsEnabled === true) +
      emailPrefRow('Event reminders', u.emailPrefEventReminders !== false) +
      emailPrefRow('Organiser alerts', u.emailPrefOrganiserAlerts !== false) +
      (u.organiserTermsAcceptedAt
        ? '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Organiser terms</dt><dd class="font-medium text-right text-xs">' +
          esc(formatAccountDate(u.organiserTermsAcceptedAt)) +
          '</dd></div>'
        : '') +
      '</dl>' +
      '<a href="../account/settings" target="_blank" rel="noopener" class="inline-block mt-3 text-xs font-semibold text-brand-700 hover:underline">Open account settings page ↗</a>' +
      '</div>' +
      (u.organiserId
        ? '<label class="flex items-center gap-2 text-sm mt-4 pt-4 border-t border-slate-100">' +
          '<input type="checkbox" id="drawer-featured-toggle" ' +
          (u.featured ? 'checked' : '') +
          ' /> Featured organiser (Spotlight)</label>'
        : '<p class="text-xs text-slate-500 border-t border-slate-100 pt-4 mt-4">No organiser profile — featured status applies to group profiles only.</p>') +
      (u.role !== 'Admin'
        ? '<div class="border-t border-slate-100 pt-4 mt-4 space-y-2">' +
          '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email delivery</p>' +
          '<button type="button" class="w-full rounded-lg border border-slate-200 text-slate-800 py-2 text-sm font-semibold hover:bg-slate-50" id="drawer-toggle-emails">' +
          (u.emailsEnabled === false ? 'Enable emails for this user' : 'Block emails for this user') +
          '</button>' +
          '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Password support</p>' +
          '<button type="button" class="w-full rounded-lg border border-brand-200 text-brand-800 py-2 text-sm font-semibold hover:bg-brand-50" id="drawer-reset-link">Send password reset email</button>' +
          '<button type="button" class="w-full rounded-lg border border-slate-200 text-slate-800 py-2 text-sm font-semibold hover:bg-slate-50" id="drawer-temp-password">Set temporary password</button>' +
          '<p class="text-xs text-slate-500 hidden" id="drawer-password-result"></p></div>'
        : '');
    document.getElementById('user-drawer').classList.remove('hidden');
    var featuredToggle = document.getElementById('drawer-featured-toggle');
    if (featuredToggle && u.organiserId) {
      featuredToggle.addEventListener('change', function () {
        var wantFeatured = !!featuredToggle.checked;
        function revert() {
          featuredToggle.checked = !wantFeatured;
        }
        function save(until) {
          featuredToggle.disabled = true;
          return adminPatch('/api/admin/users', {
            organiserId: u.organiserId,
            userId: u.id,
            featured: wantFeatured,
            featured_until: wantFeatured ? until : null,
          })
            .then(function (data) {
              if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
              u.featured = wantFeatured;
              var idx = liveUsers.findIndex(function (x) {
                return x.id === u.id;
              });
              if (idx >= 0) liveUsers[idx].featured = u.featured;
            })
            .catch(function (err) {
              revert();
              window.alert(err.message || 'Could not update featured status.');
            })
            .finally(function () {
              featuredToggle.disabled = false;
            });
        }
        if (!wantFeatured) {
          save(null);
          return;
        }
        featuredToggle.checked = false;
        promptSpotlightFeaturedUntil({
          title: 'Feature organiser until',
          subtitle: 'Choose when this group leaves the Premium Spotlight carousel.',
        })
          .then(function (choice) {
            featuredToggle.checked = true;
            return save(choice.featured_until);
          })
          .catch(function (err) {
            if (!err || err.message !== 'cancelled') {
              window.alert((err && err.message) || 'Could not update featured status.');
            }
          });
      });
    }
    var pwdResult = document.getElementById('drawer-password-result');
    function showPwdResult(text, isError) {
      if (!pwdResult) return;
      pwdResult.textContent = text;
      pwdResult.classList.remove('hidden', 'text-red-700', 'text-emerald-700');
      pwdResult.classList.add(isError ? 'text-red-700' : 'text-emerald-700');
    }
    var resetBtn = document.getElementById('drawer-reset-link');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetBtn.disabled = true;
        adminPost('/api/admin/users', { action: 'send_password_reset', email: u.email, userId: u.id })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Could not send reset email');
            if (data.emailSent) {
              showPwdResult(data.message || 'Password reset email sent.', false);
            } else if (data.resetUrl) {
              showPwdResult('Email not sent — copy reset link: ' + data.resetUrl, false);
            } else {
              showPwdResult(data.message || 'Reset link generated.', false);
            }
          })
          .catch(function (err) {
            showPwdResult(err.message || 'Failed.', true);
          })
          .finally(function () {
            resetBtn.disabled = false;
          });
      });
    }
    var tempBtn = document.getElementById('drawer-temp-password');
    if (tempBtn) {
      tempBtn.addEventListener('click', function () {
        if (!window.confirm('Generate a new temporary password for ' + u.email + '?')) return;
        tempBtn.disabled = true;
        adminPost('/api/admin/users', { action: 'generate_temp_password', email: u.email, userId: u.id })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Failed');
            showPwdResult('Temporary password: ' + data.tempPassword + ' — share securely.', false);
          })
          .catch(function (err) {
            showPwdResult(err.message || 'Failed.', true);
          })
          .finally(function () {
            tempBtn.disabled = false;
          });
      });
    }
    var emailsBtn = document.getElementById('drawer-toggle-emails');
    if (emailsBtn) {
      emailsBtn.addEventListener('click', function () {
        var enable = u.emailsEnabled === false;
        if (
          !enable &&
          !window.confirm('Block emails for ' + u.email + '? They will not receive transactional mail until you enable it again.')
        ) {
          return;
        }
        emailsBtn.disabled = true;
        adminPost('/api/admin/users', {
          action: 'set_emails_enabled',
          userId: u.id,
          email: u.email,
          emails_enabled: enable,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            u.emailsEnabled = enable;
            var idx = liveUsers.findIndex(function (x) {
              return x.id === u.id;
            });
            if (idx >= 0) liveUsers[idx].emailsEnabled = enable;
            openUserDrawer(u);
          })
          .catch(function (err) {
            window.alert(err.message || 'Could not update email setting.');
          })
          .finally(function () {
            emailsBtn.disabled = false;
          });
      });
    }
    var impersonateBtn = document.getElementById('drawer-impersonate');
    if (impersonateBtn) {
      impersonateBtn.addEventListener('click', function () {
        adminPost('/api/admin/impersonate', {
          email: u.email,
          view: u.role === 'Organiser' ? 'organiser' : 'account',
          provision: true,
        }).then(function (data) {
          if (!data.ok) {
            alert(data.message || data.error || 'Could not impersonate user.');
            return;
          }
          try {
            sessionStorage.removeItem('hub_nav_session_v1');
          } catch (e) {
            /* ignore */
          }
          window.location.href = (String(data.redirect || '/account/').charAt(0) === '/' ? String(data.redirect || '/account/') : ('../' + String(data.redirect || '/account/')));
        });
      });
    }
  }

  function listingActionCell(l) {
    if (l.status === 'Live') {
      return (
        '<td class="px-4 py-3"><a href="#cleanup/issues" class="text-brand-700 font-semibold text-xs hover:underline">Review data</a></td>'
      );
    }
    return '<td class="px-4 py-3"><span class="text-xs text-slate-400">—</span></td>';
  }

  function listingsTableHtml(listings, emptyMessage) {
    if (!listings.length) {
      return (
        '<tr><td colspan="7" class="px-4 py-6 text-slate-500">' +
        esc(emptyMessage || 'No events in Supabase yet.') +
        '</td></tr>'
      );
    }
    return listings
      .map(function (l) {
        var soldLabel = l.capacity ? l.sold + '/' + l.capacity : String(l.sold || 0) + ' sold';
        var pct = l.capacity ? Math.round((l.sold / l.capacity) * 100) : 0;
        var isDraft = l.status === 'Draft';
        var rowClass = 'border-t border-slate-100';
        var statusClass = isDraft
          ? 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700'
          : l.status === 'Live'
            ? 'text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900'
            : 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100';
        return (
          '<tr class="' +
          rowClass +
          '">' +
          '<td class="px-4 py-3 font-medium">' +
          esc(l.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.type) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.organiser) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.city) +
          '</td>' +
          '<td class="px-4 py-3"><span class="' +
          statusClass +
          '">' +
          esc(l.status) +
          '</span></td>' +
          '<td class="px-4 py-3 min-w-[120px]">' +
          (l.capacity
            ? '<div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:' +
              pct +
              '%"></div></div>'
            : '') +
          '<span class="text-xs text-slate-500">' +
          esc(soldLabel) +
          '</span></td>' +
          listingActionCell(l) +
          '</tr>'
        );
      })
      .join('');
  }

  function moderationActionBtn(className, label, attrs) {
    return (
      '<button type="button" class="' +
      className +
      ' rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50" ' +
      (attrs || '') +
      '>' +
      esc(label) +
      '</button>'
    );
  }

  function listingReportActionsHtml(r) {
    var parts = [];
    if (r.viewUrl) {
      parts.push(
        '<a href="' +
          attrEsc(r.viewUrl) +
          '" target="_blank" rel="noopener" class="rounded-lg border border-brand-200 bg-white text-brand-800 px-2.5 py-1 text-xs font-semibold hover:bg-brand-50">View on Hub</a>'
      );
    }
    if (r.adminUrl) {
      parts.push(
        '<a href="' +
          attrEsc(r.adminUrl) +
          '" class="rounded-lg border border-slate-200 bg-white text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">Edit listing</a>'
      );
    }
    if (r.canUnpublish) {
      parts.push(
        moderationActionBtn(
          'moderation-unpublish-report-btn border border-red-200 text-red-700 hover:bg-red-50',
          'Unpublish listing',
          'data-report-id="' + attrEsc(r.id) + '"'
        )
      );
    }
    parts.push(
      moderationActionBtn(
        'moderation-dismiss-report-btn border border-slate-200 text-slate-700 hover:bg-slate-50',
        'Dismiss report',
        'data-report-id="' + attrEsc(r.id) + '"'
      )
    );
    return '<div class="mt-3 flex flex-wrap gap-2">' + parts.join('') + '</div>';
  }

  function reviewReportsHtml(reports) {
    if (!reports.length) {
      return '<p class="text-sm text-slate-500">No open review reports.</p>';
    }
    var reasonLabels = {
      fake_or_paid: 'Fake or paid',
      not_attendee: 'Not an attendee',
      misleading: 'Misleading',
      offensive: 'Offensive',
      spam: 'Spam',
      other: 'Other',
    };
    return reports
      .map(function (r) {
        return (
          '<div class="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<p class="font-semibold text-brand-900">Review report</p>' +
          '<time class="text-xs text-slate-400 shrink-0">' +
          esc(fmtTime(r.time)) +
          '</time></div>' +
          (r.snippet ? '<p class="text-xs text-slate-600 mt-1 italic">“' + esc(r.snippet) + '”</p>' : '') +
          '<p class="text-xs text-violet-900 mt-1">' +
          esc(reasonLabels[r.reason] || r.reason) +
          (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '') +
          '</p>' +
          (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
          '<div class="mt-3 flex flex-wrap gap-2">' +
          (r.reviewId
            ? moderationActionBtn(
                'moderation-delete-review-report-btn border border-red-200 text-red-700 hover:bg-red-50',
                'Remove review',
                'data-review-report-id="' + attrEsc(r.id) + '"'
              )
            : '') +
          moderationActionBtn(
            'moderation-dismiss-review-report-btn border border-slate-200 text-slate-700 hover:bg-slate-50',
            'Dismiss report',
            'data-review-report-id="' + attrEsc(r.id) + '"'
          ) +
          '</div></div>'
        );
      })
      .join('');
  }

  function listingReportsHtml(reports, options) {
    options = options || {};
    var readOnly = Boolean(options.readOnly);
    var emptyMessage =
      options.emptyMessage ||
      (readOnly ? 'No upheld listing reports yet.' : 'No open listing reports.');
    if (!reports.length) {
      return '<p class="text-sm text-slate-500">' + esc(emptyMessage) + '</p>';
    }
    var reasonLabels = {
      misleading: 'Misleading',
      spam: 'Spam',
      wrong_details: 'Wrong details',
      offensive: 'Offensive',
      duplicate: 'Duplicate',
      other: 'Other',
    };
    var borderClass = readOnly ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50';
    var reasonClass = readOnly ? 'text-emerald-900' : 'text-amber-900';
    return reports
      .map(function (r) {
        var typeLabel =
          r.listingType === 'organiser'
            ? 'Group'
            : r.listingType === 'opportunity'
              ? 'Opportunity'
              : 'Event';
        var meta =
          esc(reasonLabels[r.reason] || r.reason) +
          (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '');
        var upheldMeta = '';
        if (readOnly) {
          upheldMeta =
            '<p class="text-xs text-emerald-800 mt-1 font-semibold">Uphold' +
            (r.reviewedAt ? ' · ' + esc(fmtTime(r.reviewedAt)) : '') +
            '</p>';
          if (r.conductWarning && r.conductWarning.warningCount != null) {
            upheldMeta +=
              '<p class="text-xs text-slate-600 mt-1">Conduct warning ' +
              esc(String(r.conductWarning.warningCount)) +
              ' of ' +
              esc(String(r.conductWarning.warningLimit || 3)) +
              (r.hubSuspended ? ' · organiser suspended' : '') +
              '</p>';
          } else if (r.hubSuspended) {
            upheldMeta += '<p class="text-xs text-red-700 mt-1 font-semibold">Organiser suspended</p>';
          }
        }
        return (
          '<div class="rounded-lg border ' +
          borderClass +
          ' p-3 text-sm">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<p class="font-semibold text-brand-900">' +
          esc(r.title) +
          ' <span class="text-xs font-normal text-slate-500">(' +
          esc(typeLabel) +
          ')</span></p>' +
          '<time class="text-xs text-slate-400 shrink-0">' +
          esc(fmtTime(readOnly && r.reviewedAt ? r.reviewedAt : r.time)) +
          '</time></div>' +
          upheldMeta +
          '<p class="text-xs ' +
          reasonClass +
          ' mt-1">' +
          meta +
          '</p>' +
          (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
          (readOnly ? listingReportReadOnlyActionsHtml(r) : listingReportActionsHtml(r)) +
          '</div>'
        );
      })
      .join('');
  }

  function listingReportReadOnlyActionsHtml(r) {
    var parts = [];
    if (r.adminUrl) {
      parts.push(
        '<a href="' +
          attrEsc(r.adminUrl) +
          '" class="rounded-lg border border-slate-200 bg-white text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">Edit listing</a>'
      );
    }
    if (r.organiserId) {
      parts.push(
        '<a href="#cleanup/groups?organiser=' +
          attrEsc(r.organiserId) +
          '" class="rounded-lg border border-slate-200 bg-white text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">View organiser</a>'
      );
    }
    return parts.length
      ? '<div class="mt-3 flex flex-wrap gap-2">' + parts.join('') + '</div>'
      : '';
  }

  function reviewsHtml(reviews) {
    if (!reviews.length) {
      return '<p class="text-sm text-slate-500">No reviews yet.</p>';
    }
    return reviews
      .map(function (r) {
        return (
          '<article class="border border-slate-200 rounded-lg p-4 ' +
          (r.spam ? 'bg-red-50/50' : 'bg-white') +
          '">' +
          '<div class="flex justify-between gap-2"><div><p class="font-semibold text-sm">' +
          esc(r.user) +
          ' · ' +
          esc(r.event) +
          '</p><p class="text-amber-500 text-sm">' +
          '★'.repeat(Math.max(0, Math.min(5, r.rating))) +
          '</p></div><time class="text-xs text-slate-400">' +
          fmtTime(r.time) +
          '</time></div>' +
          '<p class="text-sm text-slate-600 mt-2">' +
          esc(r.text) +
          '</p>' +
          (r.spam
            ? '<p class="mt-2 text-xs font-semibold text-red-700">Flagged as possible spam</p>'
            : '') +
          '<button type="button" class="moderation-delete-review-btn mt-3 rounded-lg border border-red-200 text-red-700 px-2.5 py-1 text-xs font-semibold hover:bg-red-50 disabled:opacity-50" data-review-id="' +
          attrEsc(r.id) +
          '">Delete review</button></article>'
        );
      })
      .join('');
  }

  function loadFinancialsData(force) {
    if (!force && financialsState.cache) return Promise.resolve(financialsState.cache);
    return adminGet('/api/admin/financials').then(function (data) {
      financialsState.cache = data;
      return data;
    });
  }

  function financialsMoney(n) {
    var v = Number(n) || 0;
    return '£' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  }

  function financialsStatusLine(data) {
      if (!data || data.ok === false || data.error || data.configured === false) {
      return (data && (data.message || data.error)) || 'Could not load financial data from Supabase.';
    }
      var summary = data.summary || {};
    var queue = data.payoutQueue || [];
    var stripe = data.stripeAccounts || [];
    var statusLine =
      financialsMoney(summary.totalTicketRevenue) +
      ' ticket revenue · ' +
      queue.length +
      ' payout row' +
      (queue.length === 1 ? '' : 's') +
      ' · ' +
      stripe.length +
      ' organiser' +
      (stripe.length === 1 ? '' : 's');
    if (summary.refundsPendingCount) {
      statusLine =
        summary.refundsPendingCount +
        ' refund' +
        (summary.refundsPendingCount === 1 ? '' : 's') +
        ' pending · ' +
        statusLine;
    }
    return statusLine;
  }

  function paintFinancialsSummary(data, summaryEl, statusEl) {
    if (!data || data.ok === false || data.error || data.configured === false) {
      if (statusEl) statusEl.textContent = financialsStatusLine(data);
      return false;
    }
    var summary = data.summary || {};
      if (summaryEl) {
        summaryEl.innerHTML =
          '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs text-slate-500 uppercase tracking-wide">Ticket revenue</p><p class="text-xl font-bold text-brand-900 mt-1">' +
        financialsMoney(summary.totalTicketRevenue) +
          '</p></div>' +
          '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs text-slate-500 uppercase tracking-wide">Hub fees (after Stripe)</p><p class="text-xl font-bold text-brand-900 mt-1">' +
        financialsMoney(summary.totalBookingFees) +
          '</p></div>' +
          '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs text-slate-500 uppercase tracking-wide">Paid bookings</p><p class="text-xl font-bold text-brand-900 mt-1">' +
          String(summary.paidRegistrationCount || 0) +
          '</p></div>' +
          '<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p class="text-xs text-slate-500 uppercase tracking-wide">Payouts pending</p><p class="text-xl font-bold text-brand-900 mt-1">' +
          String(summary.pendingPayoutCount || 0) +
          '</p></div>' +
          (summary.refundsPendingCount
            ? '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p class="text-xs text-amber-900/80 uppercase tracking-wide">Refunds pending</p><p class="text-xl font-bold text-amber-950 mt-1">' +
              String(summary.refundsPendingCount) +
              '</p></div>'
            : '');
      }
    if (statusEl) {
      var statusLine = financialsStatusLine(data);
        if (data.payoutWarning || data.refundsPendingWarning) {
        statusEl.innerHTML =
            (data.refundsPendingWarning
              ? '<span class="text-red-700 font-medium">' +
                esc(data.refundsPendingWarning) +
                '</span><br>'
              : '') +
            (data.payoutWarning
              ? '<span class="text-amber-800 font-medium">' +
                esc(data.payoutWarning) +
                '</span><br>'
              : '') +
            '<span class="text-slate-500">' +
            esc(statusLine) +
            '</span>';
        } else {
        statusEl.textContent = statusLine;
      }
    }
    return true;
  }

  function financialsOrganiserRowsHtml(rows) {
    if (!rows.length) {
      return '<tr><td colspan="4" class="px-4 py-6 text-slate-500">No matching organisers.</td></tr>';
    }
    return rows
      .map(function (s) {
        var statusCls =
          s.status === 'Connected'
            ? 'text-emerald-600'
            : s.status === 'Onboarding'
              ? 'text-amber-700'
              : 'text-slate-500';
                return (
          '<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium">' +
          esc(s.organiser) +
          '</td><td class="px-4 py-3">' +
          esc(s.balance) +
          '</td><td class="px-4 py-3">' +
          esc(s.lastPayout) +
          '</td><td class="px-4 py-3 font-medium ' +
          statusCls +
          '">' +
          esc(s.status) +
                  '</td></tr>'
                );
              })
      .join('');
  }

  function financialsPayoutRowsHtml(queue, payoutWarning) {
    if (!queue.length) {
      return (
        '<tr><td colspan="6" class="px-4 py-6 text-slate-500">' +
        (payoutWarning
          ? 'Payout queue unavailable until migration 120 is applied in Supabase.'
          : 'No matching payout requests.') +
        '</td></tr>'
      );
    }
    return queue
              .map(function (p) {
                var statusCls =
                  p.status === 'paid'
                    ? 'text-emerald-700 bg-emerald-50'
                    : p.status === 'pending_review'
                      ? 'text-amber-800 bg-amber-50'
                      : 'text-slate-700 bg-slate-100';
                var actions = '';
                if (p.status === 'pending_review') {
                  actions =
                    '<button type="button" class="payout-status-btn rounded-lg bg-brand-700 text-white px-2 py-1 text-xs font-semibold" data-payout-id="' +
                    attrEsc(p.id) +
                    '" data-payout-status="approved">Approve</button>';
                } else if (p.status === 'approved') {
                  actions =
                    '<button type="button" class="payout-status-btn rounded-lg bg-emerald-700 text-white px-2 py-1 text-xs font-semibold" data-payout-id="' +
                    attrEsc(p.id) +
                    '" data-payout-status="paid">Mark paid</button>';
                } else {
                  actions = '<span class="text-xs text-slate-400">—</span>';
                }
                return (
                  '<tr class="border-t border-slate-100">' +
                  '<td class="px-4 py-3 font-medium">' +
                  esc(p.eventTitle) +
                  '</td>' +
                  '<td class="px-4 py-3">' +
                  esc(p.organiser) +
                  '</td>' +
                  '<td class="px-4 py-3">' +
                  esc(p.amount) +
                  '</td>' +
                  '<td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded ' +
                  statusCls +
                  '">' +
                  esc(p.statusLabel) +
                  '</span></td>' +
                  '<td class="px-4 py-3 text-xs text-slate-500">' +
                  esc(fmtTime(p.requestedAt)) +
                  '</td>' +
                  '<td class="px-4 py-3 whitespace-nowrap">' +
                  actions +
                  '</td></tr>'
                );
              })
      .join('');
  }

  function financialsRefundRowsHtml(refundsPending, refundsPendingWarning) {
    if (!refundsPending.length) {
                return (
        '<tr><td colspan="6" class="px-4 py-6 text-slate-500">' +
        (refundsPendingWarning
          ? 'Could not load refunds pending: ' + esc(refundsPendingWarning)
          : 'No pending refunds.') +
        '</td></tr>'
      );
    }
    return refundsPending
      .map(function (row) {
        return (
          '<tr class="border-t border-amber-100">' +
          '<td class="px-4 py-3 font-medium">' +
          esc(row.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(row.organiserName || '—') +
          '</td>' +
          '<td class="px-4 py-3">' +
          String(row.paidBookings || 0) +
          '</td>' +
          '<td class="px-4 py-3 text-xs text-slate-500">' +
          esc(fmtTime(row.cancelledAt)) +
          '</td>' +
          '<td class="px-4 py-3 text-xs">' +
          esc(row.reason || '—') +
          '</td>' +
          '<td class="px-4 py-3 whitespace-nowrap">' +
          '<button type="button" class="retry-refunds-btn rounded-lg bg-amber-800 text-white px-2 py-1 text-xs font-semibold hover:bg-amber-900" data-retry-refunds-event="' +
          attrEsc(row.eventId) +
          '">Retry refunds</button>' +
                  '</td></tr>'
                );
              })
      .join('');
  }

  function paintFinancialsOrganisersTable(data) {
    var stripeEl = document.getElementById('financials-stripe');
    var pagerEl = document.getElementById('financials-organisers-pager');
    var statusEl = document.getElementById('financials-status');
    if (!stripeEl) return;
    if (!paintFinancialsSummary(data, null, statusEl)) {
      stripeEl.innerHTML =
        '<tr><td colspan="4" class="px-4 py-6 text-slate-500">Could not load organisers.</td></tr>';
      return;
    }
    var stripe = data.stripeAccounts || [];
    var q = String(financialsState.organisersQ || '')
      .trim()
      .toLowerCase();
    var statusFilter = String(financialsState.organisersStatus || '').trim();
    var filtered = stripe.filter(function (s) {
      if (statusFilter && String(s.status || '') !== statusFilter) return false;
      if (!q) return true;
      return String(s.organiser || '')
        .toLowerCase()
        .indexOf(q) >= 0;
    });
    var pageData = paginateRows(filtered, financialsState.organisersPage, FINANCIALS_PAGE_SIZE);
    financialsState.organisersPage = pageData.page;
    stripeEl.innerHTML = financialsOrganiserRowsHtml(pageData.rows);
    if (pagerEl) {
      pagerEl.innerHTML =
        '<p class="text-xs text-slate-500 mb-2">' +
        esc(String(pageData.total)) +
        ' organiser' +
        (pageData.total === 1 ? '' : 's') +
        (q || statusFilter ? ' matching filters' : '') +
        '</p>' +
        adminPaginationHtml(pageData.page, pageData.total, FINANCIALS_PAGE_SIZE, 'data-fin-org-page');
    }
  }

  function paintFinancialsPayoutsTable(data) {
    var queueEl = document.getElementById('financials-queue');
    var pagerEl = document.getElementById('financials-payouts-pager');
    var refundsSectionEl = document.getElementById('financials-refunds-section');
    var refundsEl = document.getElementById('financials-refunds-pending');
    var statusEl = document.getElementById('financials-status');
    if (!paintFinancialsSummary(data, null, statusEl)) return;
    var queue = data.payoutQueue || [];
    var refundsPending = data.refundsPending || [];
    var statusFilter = String(financialsState.payoutsStatus || '').trim();
    var filtered = queue.filter(function (p) {
      if (!statusFilter) return true;
      return String(p.status || '') === statusFilter;
    });
    var pageData = paginateRows(filtered, financialsState.payoutsPage, FINANCIALS_PAGE_SIZE);
    financialsState.payoutsPage = pageData.page;
    if (queueEl) queueEl.innerHTML = financialsPayoutRowsHtml(pageData.rows, data.payoutWarning);
    if (pagerEl) {
      pagerEl.innerHTML =
        '<p class="text-xs text-slate-500 mb-2">' +
        esc(String(pageData.total)) +
        ' payout request' +
        (pageData.total === 1 ? '' : 's') +
        '</p>' +
        adminPaginationHtml(pageData.page, pageData.total, FINANCIALS_PAGE_SIZE, 'data-fin-pay-page');
    }
    if (refundsSectionEl) {
      refundsSectionEl.classList.toggle('hidden', !refundsPending.length && !data.refundsPendingWarning);
    }
    if (refundsEl) {
      refundsEl.innerHTML = financialsRefundRowsHtml(refundsPending, data.refundsPendingWarning);
    }
  }

  function renderFinancialsOverview() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading financial data from Supabase…</p>' +
      '<div id="financials-summary" class="grid grid-cols-2 lg:grid-cols-4 gap-3"></div>' +
      '<div class="grid gap-3 sm:grid-cols-3">' +
      '<a href="#financials/organisers" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">Organisers</p><p class="text-xs text-slate-500 mt-1">Revenue and Stripe Connect</p></a>' +
      '<a href="#financials/payouts" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">Payouts</p><p class="text-xs text-slate-500 mt-1">Queue and refunds pending</p></a>' +
      '<a href="#financials/activity" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">Activity</p><p class="text-xs text-slate-500 mt-1">Recent registrations</p></a>' +
      '</div></div>';
    loadFinancialsData().then(function (data) {
      paintFinancialsSummary(
        data,
        document.getElementById('financials-summary'),
        document.getElementById('financials-status')
      );
    });
  }

  function bindFinancialsOrganisersFilters() {
    var searchEl = document.getElementById('financials-org-search');
    var statusEl = document.getElementById('financials-org-status');
    if (searchEl) {
      searchEl.value = financialsState.organisersQ || '';
      searchEl.addEventListener('input', function () {
        financialsState.organisersQ = searchEl.value || '';
        financialsState.organisersPage = 0;
        if (financialsState.cache) paintFinancialsOrganisersTable(financialsState.cache);
      });
    }
    if (statusEl) {
      statusEl.value = financialsState.organisersStatus || '';
      statusEl.addEventListener('change', function () {
        financialsState.organisersStatus = statusEl.value || '';
        financialsState.organisersPage = 0;
        if (financialsState.cache) paintFinancialsOrganisersTable(financialsState.cache);
      });
    }
    var pager = document.getElementById('financials-organisers-pager');
    if (pager && !pager.dataset.bound) {
      pager.dataset.bound = '1';
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-fin-org-page]');
        if (!btn) return;
        financialsState.organisersPage = Number(btn.getAttribute('data-fin-org-page')) || 0;
        if (financialsState.cache) paintFinancialsOrganisersTable(financialsState.cache);
      });
    }
  }

  function renderFinancialsOrganisers() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading…</p>' +
      '<div class="admin-filter-bar flex flex-wrap gap-3 items-center">' +
      '<input type="search" id="financials-org-search" class="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]" placeholder="Search organiser" />' +
      '<select id="financials-org-status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All Stripe statuses</option>' +
      '<option value="Connected">Connected</option>' +
      '<option value="Onboarding">Onboarding</option>' +
      '<option value="Not started">Not started</option>' +
      '</select></div>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">Organiser ticket revenue</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Total paid ticket revenue per organiser (all time).</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Organiser</th><th class="px-4 py-3">Ticket revenue</th><th class="px-4 py-3">Last payout</th><th class="px-4 py-3">Stripe Connect</th></tr></thead>' +
          '<tbody id="financials-stripe"><tr><td colspan="4" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</section>' +
      '<div id="financials-organisers-pager"></div></div>';
    bindFinancialsOrganisersFilters();
    loadFinancialsData().then(paintFinancialsOrganisersTable);
  }

  function bindFinancialsPayoutsFilters() {
    var statusEl = document.getElementById('financials-pay-status');
    if (statusEl) {
      statusEl.value = financialsState.payoutsStatus || '';
      statusEl.addEventListener('change', function () {
        financialsState.payoutsStatus = statusEl.value || '';
        financialsState.payoutsPage = 0;
        if (financialsState.cache) paintFinancialsPayoutsTable(financialsState.cache);
      });
    }
    var pager = document.getElementById('financials-payouts-pager');
    if (pager && !pager.dataset.bound) {
      pager.dataset.bound = '1';
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-fin-pay-page]');
        if (!btn) return;
        financialsState.payoutsPage = Number(btn.getAttribute('data-fin-pay-page')) || 0;
        if (financialsState.cache) paintFinancialsPayoutsTable(financialsState.cache);
      });
    }
  }

  function renderFinancialsPayouts() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading…</p>' +
      '<div class="admin-filter-bar flex flex-wrap gap-3 items-center">' +
      '<select id="financials-pay-status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All payout statuses</option>' +
      '<option value="pending_review">Pending review</option>' +
      '<option value="approved">Approved</option>' +
      '<option value="paid">Paid</option>' +
      '</select></div>' +
      '<section id="financials-refunds-section" class="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden hidden">' +
      '<div class="px-4 py-3 border-b border-amber-100 bg-amber-50"><h3 class="font-bold text-amber-950">Refunds pending</h3>' +
      '<p class="text-xs text-amber-900/80 mt-0.5">Cancelled events where Stripe refunds were not confirmed.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-amber-50/80 text-xs uppercase text-amber-900/70">' +
          '<tr><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">Paid bookings</th><th class="px-4 py-3">Cancelled</th><th class="px-4 py-3">Reason</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="financials-refunds-pending"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</section>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">Payout queue</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Approve then mark paid after transfer.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">Net</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Requested</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="financials-queue"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</section>' +
      '<div id="financials-payouts-pager"></div></div>';
    bindFinancialsPayoutsFilters();
    loadFinancialsData().then(paintFinancialsPayoutsTable);
  }

  function renderFinancialsActivity() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading…</p>' +
      '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
      '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-1">Recent registrations</h3>' +
      '<p class="text-xs text-brand-100/70 mb-4">Latest registration rows from Supabase (payment status and amount).</p>' +
      '<div id="financials-log" class="max-h-[32rem] overflow-y-auto">Loading…</div></section></div>';
    loadFinancialsData().then(function (data) {
      var statusEl = document.getElementById('financials-status');
      var logEl = document.getElementById('financials-log');
      if (!paintFinancialsSummary(data, null, statusEl)) {
        if (logEl) logEl.innerHTML = '<p class="text-sm text-slate-400">Unavailable.</p>';
        return;
      }
      var log = data.automationLog || [];
        var genuineLog = log.filter(function (l) {
          return !/\be2e\b/i.test(String(l.line || ''));
        });
      if (logEl) {
        logEl.innerHTML = genuineLog.length
          ? genuineLog
              .map(function (l) {
                var cls =
                  l.status === 'error'
                    ? 'text-red-300 bg-red-950/30'
                    : l.status === 'ok'
                      ? 'text-emerald-300'
                      : 'text-slate-300';
                return (
                  '<div class="font-mono text-xs py-2 border-b border-white/10 ' +
                  cls +
                  '"><span class="text-slate-500">[' +
                  fmtTime(l.ts) +
                  ']</span> — ' +
                  esc(l.line) +
                  '</div>'
                );
              })
              .join('')
          : '<p class="text-sm text-slate-400">No registrations logged yet.</p>';
      }
    });
  }

  function renderFinancialsHub(fullHash) {
    var tab = resolveHubTab(
      fullHash,
      'financials',
      ['overview', 'organisers', 'payouts', 'activity'],
      'overview'
    );
    if (!tab) return;
    var payoutBadge = hubTabBadge(actionCountValue('pendingPayouts'));
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'overview', label: 'Overview', href: '#financials/overview' },
        { key: 'organisers', label: 'Organisers', href: '#financials/organisers' },
        { key: 'payouts', label: 'Payouts', href: '#financials/payouts', badgeHtml: payoutBadge, badgeKey: 'pendingPayouts' },
        { key: 'activity', label: 'Activity', href: '#financials/activity' },
      ],
      tab
    );
    if (tab === 'organisers') withHubTabs(tabsHtml, renderFinancialsOrganisers);
    else if (tab === 'payouts') withHubTabs(tabsHtml, renderFinancialsPayouts);
    else if (tab === 'activity') withHubTabs(tabsHtml, renderFinancialsActivity);
    else withHubTabs(tabsHtml, renderFinancialsOverview);
  }

  function renderFinancials() {
    renderFinancialsHub(currentAdminHash());
  }

  function loadModerationData() {
    return adminGet('/api/admin/moderation');
  }

  function renderModerationReports() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="moderation-status" class="text-sm text-slate-500">Loading reports…</p>' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">For reports: view the listing, edit it in cleanup, unpublish to uphold (emails the poster and reporter), or dismiss if it looks fine. Three upheld listing breaches on the same organiser profile trigger automatic suspension.</p>' +
      '<div class="bg-white rounded-xl border border-amber-200 p-5 shadow-sm" id="moderation-reports-panel">' +
      '<h3 class="font-bold text-amber-900 mb-1">Open listing reports</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Submitted from event, group, and opportunity pages.</p>' +
      '<div class="space-y-3" id="moderation-reports">Loading…</div></div>' +
      '<div class="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm" id="moderation-validated-reports-panel">' +
      '<h3 class="font-bold text-emerald-900 mb-1">Uphold history</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Reports validated by unpublishing — includes conduct warnings and suspensions.</p>' +
      '<div class="space-y-3" id="moderation-validated-reports">Loading…</div></div>' +
      '<div class="bg-white rounded-xl border border-violet-200 p-5 shadow-sm" id="moderation-review-reports-panel">' +
      '<h3 class="font-bold text-violet-900 mb-1">Review reports</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Submitted from organiser profiles — remove the review or dismiss when reviewed.</p>' +
      '<div class="space-y-3" id="moderation-review-reports">Loading…</div></div></div>';

    loadModerationData().then(function (data) {
      var status = document.getElementById('moderation-status');
      var reportsEl = document.getElementById('moderation-reports');
      var validatedReportsEl = document.getElementById('moderation-validated-reports');
      var reviewReportsEl = document.getElementById('moderation-review-reports');
      if (!data || data.error || data.configured === false) {
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        if (reportsEl) reportsEl.innerHTML = listingReportsHtml([]);
        if (validatedReportsEl) validatedReportsEl.innerHTML = listingReportsHtml([], { readOnly: true });
        if (reviewReportsEl) reviewReportsEl.innerHTML = reviewReportsHtml([]);
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      var listingReports = data.listingReports || [];
      var validatedListingReports = data.validatedListingReports || [];
      var reviewReports = data.reviewReports || [];
      if (status) {
        status.textContent =
          listingReports.length +
          ' open listing reports · ' +
          validatedListingReports.length +
          ' upheld · ' +
          reviewReports.length +
          ' review reports';
      }
      if (reportsEl) reportsEl.innerHTML = listingReportsHtml(listingReports);
      if (validatedReportsEl) {
        validatedReportsEl.innerHTML = listingReportsHtml(validatedListingReports, { readOnly: true });
      }
      if (reviewReportsEl) reviewReportsEl.innerHTML = reviewReportsHtml(reviewReports);
      var reportsPanel = document.getElementById('moderation-reports-panel');
      var reviewReportsPanel = document.getElementById('moderation-review-reports-panel');
      if (reportsPanel) {
        reportsPanel.classList.toggle('ring-2', listingReports.length > 0);
        reportsPanel.classList.toggle('ring-amber-300', listingReports.length > 0);
      }
      if (reviewReportsPanel) {
        reviewReportsPanel.classList.toggle('ring-2', reviewReports.length > 0);
        reviewReportsPanel.classList.toggle('ring-violet-300', reviewReports.length > 0);
      }
    });
  }

  function paintModerationListingsTable() {
    var listingsEl = document.getElementById('moderation-listings');
    var pagerEl = document.getElementById('moderation-listings-pager');
    var statusEl = document.getElementById('moderation-status');
    if (!listingsEl) return;
    var q = String(moderationListingsState.q || '')
      .trim()
      .toLowerCase();
    var statusFilter = String(moderationListingsState.status || '').trim();
    var filtered = (liveListings || []).filter(function (l) {
      if (statusFilter && String(l.status || '') !== statusFilter) return false;
      if (!q) return true;
      return (
        String(l.title || '')
          .toLowerCase()
          .indexOf(q) >= 0 ||
        String(l.organiser || '')
          .toLowerCase()
          .indexOf(q) >= 0 ||
        String(l.city || '')
          .toLowerCase()
          .indexOf(q) >= 0
      );
    });
    var pageData = paginateRows(filtered, moderationListingsState.page, MODERATION_LISTINGS_PAGE_SIZE);
    moderationListingsState.page = pageData.page;
    listingsEl.innerHTML = listingsTableHtml(pageData.rows, 'No matching events.');
    if (statusEl) {
      statusEl.textContent =
        pageData.total +
        ' event' +
        (pageData.total === 1 ? '' : 's') +
        (q || statusFilter ? ' matching filters' : ' loaded');
    }
    if (pagerEl) {
      pagerEl.innerHTML = adminPaginationHtml(
        pageData.page,
        pageData.total,
        MODERATION_LISTINGS_PAGE_SIZE,
        'data-mod-list-page'
      );
    }
  }

  function renderModerationListings() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="moderation-status" class="text-sm text-slate-500">Loading listings…</p>' +
      '<div class="admin-filter-bar flex flex-wrap gap-3 items-center">' +
      '<input type="search" id="moderation-listings-search" class="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]" placeholder="Search title, organiser, city" />' +
      '<select id="moderation-listings-status" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All statuses</option>' +
      '<option value="Live">Live</option>' +
      '<option value="Draft">Draft</option>' +
      '</select></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">All events</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Read-only overview — organisers publish events themselves. Edit via Fix listings.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tickets</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="moderation-listings"><tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>' +
      '<div id="moderation-listings-pager"></div></div>';

    var searchEl = document.getElementById('moderation-listings-search');
    var statusEl = document.getElementById('moderation-listings-status');
    var pager = document.getElementById('moderation-listings-pager');
    if (searchEl) {
      searchEl.value = moderationListingsState.q || '';
      searchEl.addEventListener('input', function () {
        moderationListingsState.q = searchEl.value || '';
        moderationListingsState.page = 0;
        paintModerationListingsTable();
      });
    }
    if (statusEl) {
      statusEl.value = moderationListingsState.status || '';
      statusEl.addEventListener('change', function () {
        moderationListingsState.status = statusEl.value || '';
        moderationListingsState.page = 0;
        paintModerationListingsTable();
      });
    }
    if (pager && !pager.dataset.bound) {
      pager.dataset.bound = '1';
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-mod-list-page]');
        if (!btn) return;
        moderationListingsState.page = Number(btn.getAttribute('data-mod-list-page')) || 0;
        paintModerationListingsTable();
      });
    }

    loadModerationData().then(function (data) {
      if (!data || data.error || data.configured === false) {
        liveListings = [];
        paintModerationListingsTable();
        var status = document.getElementById('moderation-status');
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      paintModerationListingsTable();
    });
  }

  function renderModerationReviews() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="moderation-status" class="text-sm text-slate-500">Loading reviews…</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-1">Reviews</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Spam-like reviews are highlighted — delete to remove from the site.</p>' +
      '<div class="space-y-3" id="moderation-reviews">Loading…</div></div></div>';
    loadModerationData().then(function (data) {
      var status = document.getElementById('moderation-status');
      var reviewsEl = document.getElementById('moderation-reviews');
      if (!data || data.error || data.configured === false) {
        liveReviews = [];
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        if (reviewsEl) reviewsEl.innerHTML = reviewsHtml([]);
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      if (status) {
        status.textContent = liveReviews.length + ' review' + (liveReviews.length === 1 ? '' : 's');
      }
      if (reviewsEl) reviewsEl.innerHTML = reviewsHtml(liveReviews);
    });
  }

  function renderModeration() {
    renderModerationHub(currentAdminHash());
  }

  function sponsorHeadlineHtml(headline) {
    var safe = esc(String(headline || '').trim());
    if (!safe) return '';
    if (safe.indexOf(':') !== -1) {
      var parts = safe.split(':');
      return '<em>' + parts[0].trim() + ':</em> ' + parts.slice(1).join(':').trim();
    }
    return safe;
  }

  function sponsorTaglineFromBlock(block) {
    if (window.CmsSponsorFields) return window.CmsSponsorFields.tagline(block);
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub' && title.toLowerCase() !== 'powered by') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function sponsorPreviewLogoHtml(logoUrl, compact, forceDark) {
    var bandClass =
      'sponsor-preview-logo-band' +
      (compact ? ' sponsor-preview-logo-band--compact' : ' sponsor-preview-logo-band--hero mb-3');
    var darkAttr = forceDark ? ' data-logo-band-dark="true"' : '';
    if (logoUrl && /^(https?:|\/|data:image\/)/i.test(logoUrl)) {
      return (
        '<div class="' +
        bandClass +
        '" data-sponsor-preview-band' +
        darkAttr +
        '>' +
        '<img src="' +
        esc(logoUrl) +
        '" alt="" class="sponsor-preview-logo-img" ' +
        'onload="window.CmsSponsorFields&&window.CmsSponsorFields.applyLogoBand(this.parentElement,this,true)">' +
        '</div>'
      );
    }
    return (
      '<div class="' +
      bandClass +
      ' sponsor-preview-logo-band--empty">' +
      '<span class="text-[10px] font-semibold text-slate-500">Your logo here</span></div>'
    );
  }

  function applySponsorBlockToForm(block) {
    if (!block) return;
    var company = document.getElementById('sponsor-company');
    var logoUrl = document.getElementById('sponsor-logo-url');
    var tagline = document.getElementById('sponsor-tagline');
    var ctaLabel = document.getElementById('sponsor-cta-label');
    var ctaUrl = document.getElementById('sponsor-cta-url');
    var active = document.getElementById('sponsor-active');
    var includeInEmails = document.getElementById('sponsor-include-emails');
    var logoBandDark = document.getElementById('sponsor-logo-band-dark');
    var savedColor =
      window.CmsSponsorFields && window.CmsSponsorFields.ctaColor
        ? window.CmsSponsorFields.ctaColor(block)
        : String(block.cta_color || '').trim();

    if (company) company.value = String(block.company_name || '').trim();
    if (logoUrl) {
      logoUrl.value = String(block.logo_url || block.image_url || '').trim();
    }
    if (tagline) tagline.value = sponsorTaglineFromBlock(block);
    if (ctaLabel && block.cta_label) ctaLabel.value = block.cta_label;
    if (ctaUrl && block.cta_url) ctaUrl.value = block.cta_url;
    if (active) active.checked = block.active !== false;
    if (includeInEmails) includeInEmails.checked = block.include_in_emails !== false;
    if (logoBandDark) {
      logoBandDark.checked =
        window.CmsSponsorFields && window.CmsSponsorFields.logoBandDark
          ? window.CmsSponsorFields.logoBandDark(block)
          : block.logo_band_dark === true;
    }
    var slotEmail = document.getElementById('sponsor-slot-email');
    var slotOpens = document.getElementById('sponsor-slot-available-from');
    if (slotEmail) slotEmail.value = String(block.sponsor_email || '').trim();
    if (slotOpens) slotOpens.value = isoToDatetimeLocalUtc(block.sponsor_available_from);
    sponsorCtaColorManual = false;
    setSponsorCtaColorFields(savedColor);
    if (!sanitizeSponsorCtaColor(savedColor)) {
      var savedLogo = String(block.logo_url || block.image_url || '').trim();
      if (/^(https?:|\/|data:image\/)/i.test(savedLogo)) {
        autoFillSponsorCtaColorFromLogo(savedLogo);
      }
    }
  }

  /** Prefer Tailwind .hidden — HTML [hidden] loses to utility classes like .grid. */
  function setAdminElHidden(el, hide) {
    if (!el) return;
    el.classList.toggle('hidden', Boolean(hide));
    if (hide) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }

  function sponsorHasValidWebsiteUrl(url) {
    var u = String(url || '').trim();
    if (/^mailto:/i.test(u)) return u.length > 7;
    if (!/^https?:\/\//i.test(u)) return false;
    return u.replace(/^https?:\/\//i, '').trim().length > 0;
  }

  function defaultSponsorCtaColor() {
    if (window.CmsSponsorFields && window.CmsSponsorFields.DEFAULT_CTA_COLOR) {
      return window.CmsSponsorFields.DEFAULT_CTA_COLOR;
    }
    return '#2d2636';
  }

  // True once the admin has typed their own Hex (or a saved colour was loaded),
  // so a logo change no longer overwrites the CTA colour automatically.
  var sponsorCtaColorManual = false;
  var sponsorPreviewRerender = null;

  function sanitizeSponsorCtaColor(color) {
    if (window.CmsSponsorFields && window.CmsSponsorFields.sanitizeCtaColor) {
      return window.CmsSponsorFields.sanitizeCtaColor(color);
    }
    return '';
  }

  function updateSponsorCtaColorSwatch(color) {
    var swatch = document.getElementById('sponsor-cta-color-swatch');
    if (swatch) swatch.style.background = color || defaultSponsorCtaColor();
  }

  function setSponsorCtaColorFields(color) {
    var hex = document.getElementById('sponsor-cta-color-hex');
    var safe = sanitizeSponsorCtaColor(color);
    if (!safe) safe = defaultSponsorCtaColor();
    if (hex) hex.value = safe;
    updateSponsorCtaColorSwatch(safe);
  }

  function readSponsorCtaColor() {
    var hex = document.getElementById('sponsor-cta-color-hex');
    var raw = hex ? hex.value.trim() : '';
    return sanitizeSponsorCtaColor(raw) || defaultSponsorCtaColor();
  }

  function autoFillSponsorCtaColorFromLogo(src) {
    var logoSrc = String(src || '').trim();
    if (!logoSrc || sponsorCtaColorManual) return;
    if (!window.CmsSponsorFields || !window.CmsSponsorFields.sampleLogoColorHex) return;
    var img = new Image();
    if (!/^data:/i.test(logoSrc)) img.crossOrigin = 'anonymous';
    img.onload = function () {
      if (sponsorCtaColorManual) return;
      var hex = window.CmsSponsorFields.sampleLogoColorHex(img);
      if (!hex) return;
      setSponsorCtaColorFields(hex);
      if (typeof sponsorPreviewRerender === 'function') sponsorPreviewRerender();
    };
    img.src = logoSrc;
  }

  function renderSponsorshipHub(fullHash) {
    var hash = String(fullHash || 'sponsorship');
    var topTabs = ['placements', 'partners', 'enquiries', 'report'];
    var sponsorshipPaths = {
      pathFor: function (t) {
        if (t === 'enquiries') return 'sponsorship/advertising-enquiries';
        if (t === 'partners') return 'sponsorship/partners';
        if (t === 'report') return 'sponsorship/clicks-report';
        return 'sponsorship/placements';
      },
    };
    var tab = 'placements';

    if (hash === 'sponsorship' || hash === 'sponsorship/placements') {
      tab = resolveHubTab(hash, 'sponsorship', topTabs, 'placements', sponsorshipPaths);
      if (!tab) return;
    } else if (
      hash === 'sponsorship/partners' ||
      hash.indexOf('home-partners') !== -1 ||
      hash.indexOf('city-partners') !== -1 ||
      hash.indexOf('county-partners') !== -1
    ) {
      tab = 'partners';
      rememberHubTab('sponsorship', 'partners');
    } else if (hash.indexOf('advertising-enquiries') !== -1) {
      tab = 'enquiries';
      rememberHubTab('sponsorship', 'enquiries');
    } else if (hash.indexOf('clicks-report') !== -1 || hash === 'sponsorship/report') {
      tab = 'report';
      rememberHubTab('sponsorship', 'report');
    } else {
      tab = 'placements';
      rememberHubTab('sponsorship', 'placements');
    }

    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'placements', label: 'Placements', href: '#sponsorship/placements' },
        { key: 'partners', label: 'Partners', href: '#sponsorship/partners' },
        { key: 'enquiries', label: 'Enquiries', href: '#sponsorship/advertising-enquiries' },
        { key: 'report', label: 'Report', href: '#sponsorship/clicks-report' },
      ],
      tab
    );

    if (tab === 'enquiries') {
      withHubTabs(tabsHtml, renderAdvertisingEnquiriesPage);
      return;
    }

    if (tab === 'report') {
      withHubTabs(tabsHtml, renderSponsorClicksReportPage);
      return;
    }

    if (tab === 'partners') {
      if (hash.indexOf('home-partners') !== -1) {
        withHubTabs(tabsHtml, renderHomePartnersPage);
        return;
      }
      if (hash.indexOf('city-partners') !== -1) {
        withHubTabs(tabsHtml, renderCityPartnersPage);
        return;
      }
      if (hash.indexOf('county-partners') !== -1) {
        withHubTabs(tabsHtml, renderCountyPartnersPage);
        return;
      }
      withHubTabs(tabsHtml, function () {
        main.innerHTML =
          '<div class="space-y-4">' +
          '<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">' +
          '<a href="#sponsorship/home-partners" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">Home partners</p><p class="text-xs text-slate-500 mt-1">Extra logos — live Powered by heroes are included automatically</p></a>' +
          '<a href="#sponsorship/city-partners" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">City partners</p><p class="text-xs text-slate-500 mt-1">City exclusivity waitlist and slots</p></a>' +
          '<a href="#sponsorship/county-partners" class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-300 transition"><p class="font-bold text-brand-900">County partners</p><p class="text-xs text-slate-500 mt-1">Eight launch counties — enquiry + manual logo</p></a>' +
          '</div></div>';
      });
      return;
    }

    withHubTabs(tabsHtml, function () {
      if (hash === 'sponsorship' || hash === 'sponsorship/placements') {
        renderSponsorshipPicker();
        return;
      }
      renderSponsorship(hash);
    });
  }

  function renderSponsorship(fullHash) {
    var hash = String(fullHash || 'sponsorship');
    if (hash === 'sponsorship/home-partners') {
      renderHomePartnersPage();
      return;
    }
    if (hash === 'sponsorship/city-partners') {
      renderCityPartnersPage();
      return;
    }
    if (hash === 'sponsorship/county-partners') {
      renderCountyPartnersPage();
      return;
    }
    if (hash === 'sponsorship/advertising-enquiries') {
      renderAdvertisingEnquiriesPage();
      return;
    }
    if (hash === 'sponsorship/clicks-report' || hash === 'sponsorship/report') {
      renderSponsorClicksReportPage();
      return;
    }
    if (hash === 'sponsorship/event-page-carousel') {
      renderEventCarouselPage('event_page_carousel_ads');
      return;
    }
    if (hash.indexOf('sponsorship/') === 0) {
      var slotKey = hash.slice('sponsorship/'.length);
      if (EMAIL_MINI_TO_PAGE_CAROUSEL[slotKey]) {
        slotKey = EMAIL_MINI_TO_PAGE_CAROUSEL[slotKey];
        if (window.location.hash !== '#sponsorship/' + slotKey) {
          window.location.hash = 'sponsorship/' + slotKey;
          return;
        }
      }
      if (slotKey === 'event_page_carousel_ads') {
        renderEventCarouselPage(slotKey);
        return;
      }
      var requestedSlot = cmsSlotByKey(slotKey);
      if (requestedSlot && requestedSlot.key === slotKey && requestedSlot.preview === 'carousel') {
        renderEventCarouselPage(slotKey);
        return;
      }
      if (cmsSlotExists(slotKey)) {
        renderSponsorshipSlot(slotKey);
        return;
      }
    }
    renderSponsorshipPicker();
  }

  function sponsorSlotStatusBadge(block) {
    if (!block) {
      return '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
    }
    if (block.active === false) {
      return '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
    }
    return '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">Live</span>';
  }

  function renderSponsorshipPicker() {
    var groups = [];
    var groupMap = {};
    CMS_AD_SLOTS.forEach(function (slot) {
      var groupName = slot.group || 'Other placements';
      if (!groupMap[groupName]) {
        groupMap[groupName] = [];
        groups.push(groupName);
      }
      groupMap[groupName].push(slot);
    });

    var groupsHtml = groups
      .map(function (groupName) {
        return (
          '<section class="admin-ad-picker-group">' +
          '<h3 class="admin-ad-picker-group-title">' +
          esc(groupName) +
          '</h3>' +
          '<div class="admin-ad-picker-grid">' +
          groupMap[groupName]
            .map(function (slot) {
              if (slot.preview === 'carousel') {
                return (
                  '<a href="#sponsorship/' +
                  attrEsc(slot.key) +
                  '" class="admin-ad-picker-card admin-ad-picker-card--carousel">' +
                  '<div class="admin-ad-picker-card-head">' +
                  '<span class="admin-ad-picker-type">Carousel</span>' +
                  '<span class="admin-ad-picker-status" data-carousel-status="' +
                  attrEsc(slot.key) +
                  '">…</span>' +
                  '</div>' +
                  '<p class="admin-ad-picker-label">' +
                  esc(slot.label) +
                  '</p>' +
                  '<p class="admin-ad-picker-help">' +
                  esc(slot.help) +
                  '</p>' +
                  '<span class="admin-ad-picker-action">Edit carousel →</span>' +
                  '</a>'
                );
              }
              var typeLabel =
                slot.preview === 'compact'
                  ? 'Sidebar ad'
                  : 'Powered by hero';
              return (
                '<a href="#sponsorship/' +
                esc(slot.key) +
                '" class="admin-ad-picker-card" data-ad-slot="' +
                attrEsc(slot.key) +
                '">' +
                '<div class="admin-ad-picker-card-head">' +
                '<span class="admin-ad-picker-type">' +
                esc(typeLabel) +
                '</span>' +
                '<span class="admin-ad-picker-status" data-ad-status="' +
                attrEsc(slot.key) +
                '">…</span>' +
                '</div>' +
                '<p class="admin-ad-picker-label">' +
                esc(slot.label) +
                '</p>' +
                '<p class="admin-ad-picker-help">' +
                esc(slot.help) +
                '</p>' +
                '<span class="admin-ad-picker-action">Edit placement →</span>' +
                '</a>'
              );
            })
            .join('') +
          '</div></section>'
        );
      })
      .join('');

    main.innerHTML =
      '<div class="space-y-8">' +
      '<p id="sponsor-picker-status" class="text-sm text-slate-500">Loading ad statuses…</p>' +
      groupsHtml +
      '<section class="admin-ad-picker-group">' +
      '<h3 class="admin-ad-picker-group-title">Inbound leads</h3>' +
      '<div class="admin-ad-picker-grid admin-ad-picker-grid--single">' +
      '<a href="#sponsorship/advertising-enquiries" class="admin-ad-picker-card admin-ad-picker-card--enquiries">' +
      '<div class="admin-ad-picker-card-head">' +
      '<span class="admin-ad-picker-type">Form</span>' +
      '<span class="admin-ad-picker-status" id="advertising-enquiries-picker-status">…</span>' +
      '</div>' +
      '<p class="admin-ad-picker-label">Advertising enquiries</p>' +
      '<p class="admin-ad-picker-help">Submissions from /advertising — package, budget, and contact details.</p>' +
      '<span class="admin-ad-picker-action">View enquiries →</span>' +
      '</a></div></section>' +
      '<section class="admin-ad-picker-group">' +
      '<h3 class="admin-ad-picker-group-title">City pages</h3>' +
      '<div class="admin-ad-picker-grid admin-ad-picker-grid--single">' +
      '<a href="#sponsorship/city-partners" class="admin-ad-picker-card admin-ad-picker-card--city-partners">' +
      '<div class="admin-ad-picker-card-head">' +
      '<span class="admin-ad-picker-type">Regional</span>' +
      '<span class="admin-ad-picker-status" id="city-partners-picker-status">…</span>' +
      '</div>' +
      '<p class="admin-ad-picker-label">City Partner placements</p>' +
      '<p class="admin-ad-picker-help">Logo + link on /networking/:city and /opportunities/networking/:city — website only, not in emails.</p>' +
      '<span class="admin-ad-picker-action">Manage cities →</span>' +
      '</a></div></section>' +
      '<section class="admin-ad-picker-group">' +
      '<h3 class="admin-ad-picker-group-title">County pages</h3>' +
      '<div class="admin-ad-picker-grid admin-ad-picker-grid--single">' +
      '<a href="#sponsorship/county-partners" class="admin-ad-picker-card admin-ad-picker-card--county-partners">' +
      '<div class="admin-ad-picker-card-head">' +
      '<span class="admin-ad-picker-type">Regional</span>' +
      '<span class="admin-ad-picker-status" id="county-partners-picker-status">…</span>' +
      '</div>' +
      '<p class="admin-ad-picker-label">County Partner placements</p>' +
      '<p class="admin-ad-picker-help">Eight launch counties — logo + link on county networking pages. Place from enquiries.</p>' +
      '<span class="admin-ad-picker-action">Manage counties →</span>' +
      '</a></div></section>' +
      '<section class="admin-ad-picker-group">' +
      '<h3 class="admin-ad-picker-group-title">Home page</h3>' +
      '<div class="admin-ad-picker-grid admin-ad-picker-grid--single">' +
      '<a href="#sponsorship/home-partners" class="admin-ad-picker-card admin-ad-picker-card--partners">' +
      '<div class="admin-ad-picker-card-head">' +
      '<span class="admin-ad-picker-type">Logo strip</span>' +
      '<span class="admin-ad-picker-status" id="home-partners-picker-status">…</span>' +
      '</div>' +
      '<p class="admin-ad-picker-label">Home page — Partners &amp; sponsors</p>' +
      '<p class="admin-ad-picker-help">Extra logos for the home strip. Live Powered by heroes are included automatically.</p>' +
      '<span class="admin-ad-picker-action">Edit extras →</span>' +
      '</a></div></section></div>';

    var statusEl = document.getElementById('sponsor-picker-status');
    function setPickerStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    var slotLoads = CMS_AD_SLOTS.filter(function (slot) {
      return slot.preview !== 'carousel';
    }).map(function (slot) {
      return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slot.key))
        .then(function (data) {
          return { slot: slot.key, data: data };
        })
        .catch(function () {
          return { slot: slot.key, data: null };
        });
    });

    Promise.all(slotLoads)
      .then(function (results) {
        results.forEach(function (row) {
          var el = document.querySelector('[data-ad-status="' + row.slot + '"]');
          if (!el) return;
          if (!row.data || row.data.error) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
            return;
          }
          el.innerHTML = sponsorSlotStatusBadge(row.data.block);
        });
        setPickerStatus('Select a placement below to edit its creative.', 'ok');
      })
      .catch(function () {
        setPickerStatus('Could not load ad statuses — you can still open a placement to edit.', 'error');
      });

    adminGet('/api/admin/home-partners')
      .then(function (data) {
        var el = document.getElementById('home-partners-picker-status');
        if (!el) return;
        if (!data || data.error || data.configured === false) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          return;
        }
        var partners = Array.isArray(data.partners) ? data.partners : [];
        var activeCount = partners.filter(function (p) {
          return p.active !== false;
        }).length;
        if (data.active === false) {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
        } else if (activeCount) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
            activeCount +
            ' live</span>';
        } else {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
        }
      })
      .catch(function () {
        var el = document.getElementById('home-partners-picker-status');
        if (el) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
        }
      });

    adminGet('/api/admin/advertising-enquiries?limit=100')
      .then(function (data) {
        var el = document.getElementById('advertising-enquiries-picker-status');
        if (!el) return;
        if (!data || data.error) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          return;
        }
        var recent = Number(data.recentCount) || 0;
        var total = Number(data.total) || 0;
        if (!total) {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">None yet</span>';
        } else if (recent) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
            recent +
            ' this week</span>';
        } else {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' + total + ' total</span>';
        }
      })
      .catch(function () {
        var el = document.getElementById('advertising-enquiries-picker-status');
        if (el) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
        }
      });

    Promise.all(
      NETWORKING_CITY_PARTNER_SLUGS.map(function (region) {
        var slotKey = cityPartnerSlotFromSlug(region.slug);
        return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slotKey))
          .then(function (data) {
            return { slotKey: slotKey, data: data };
          })
          .catch(function () {
            return { slotKey: slotKey, data: null };
          });
      })
    ).then(function (rows) {
      var live = 0;
      rows.forEach(function (row) {
        if (row.data && row.data.block && row.data.block.active !== false) live += 1;
      });
      var el = document.getElementById('city-partners-picker-status');
      if (!el) return;
      if (!rows.length) {
        el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
        return;
      }
      el.innerHTML =
        live > 0
          ? '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' + live + ' live</span>'
          : '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
    });

    Promise.all(
      NETWORKING_COUNTY_PARTNER_SLUGS.map(function (region) {
        var slotKey = countyPartnerSlotFromSlug(region.slug);
        return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slotKey))
          .then(function (data) {
            return { slotKey: slotKey, data: data };
          })
          .catch(function () {
            return { slotKey: slotKey, data: null };
          });
      })
    ).then(function (rows) {
      var live = 0;
      rows.forEach(function (row) {
        if (row.data && row.data.block && row.data.block.active !== false) live += 1;
      });
      var el = document.getElementById('county-partners-picker-status');
      if (!el) return;
      el.innerHTML =
        live > 0
          ? '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' + live + ' live</span>'
          : '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
    });

    CMS_AD_SLOTS.filter(function (slot) {
      return slot.preview === 'carousel';
    }).forEach(function (slot) {
      adminGet('/api/admin/event-carousel?slot=' + encodeURIComponent(slot.key))
        .then(function (data) {
          var el = document.querySelector('[data-carousel-status="' + slot.key + '"]');
          if (!el) return;
          if (!data || data.error || data.configured === false) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
            return;
          }
          var ads = Array.isArray(data.ads) ? data.ads : [];
          var activeCount = ads.filter(function (ad) {
            return ad.active !== false && ad.logo_url && ad.cta_url;
          }).length;
          if (data.active === false) {
            el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
          } else if (activeCount) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
              activeCount +
              ' live</span>';
          } else {
            el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
          }
        })
        .catch(function () {
          var el = document.querySelector('[data-carousel-status="' + slot.key + '"]');
          if (el) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          }
        });
    });
  }

  function cityPartnerSlotStatusLabel(status, availableFromLabel) {
    if (status === 'available') return 'Available';
    if (status === 'live') return 'Live';
    if (status === 'booked_until') {
      return availableFromLabel ? 'Opens ' + availableFromLabel : 'Opening soon';
    }
    return 'Subscribed';
  }

  function cityPartnerSlotStatusClass(status) {
    if (status === 'available') return 'admin-ad-picker-badge admin-ad-picker-badge--empty';
    if (status === 'live') return 'admin-ad-picker-badge admin-ad-picker-badge--live';
    return 'admin-ad-picker-badge admin-ad-picker-badge--hidden';
  }

  function formatAdminDateTime(value) {
    if (!value) return '—';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function isoToDatetimeLocalUtc(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  }

  function datetimeLocalUtcToIso(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    var d = new Date(raw + ':00.000Z');
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function setPlacementEndsMonthsFromNow(inputEl, months) {
    if (!inputEl) return;
    var n = Math.floor(Number(months) || 0);
    if (n <= 0) {
      inputEl.value = '';
      return;
    }
    var d = new Date();
    d.setUTCMonth(d.getUTCMonth() + n);
    inputEl.value = d.toISOString().slice(0, 16);
  }

  function initCityPartnerWaitlistAdmin() {
    var statusEl = document.getElementById('city-partner-waitlist-status');
    var bodyEl = document.getElementById('city-partner-waitlist-body');

    function setWaitlistStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function renderWaitlistOverview(data) {
      if (!bodyEl) return;
      var totals = data.totals || {};
      var cities = (data.cities || []).slice().sort(function (a, b) {
        if (b.waitlistPending !== a.waitlistPending) return b.waitlistPending - a.waitlistPending;
        if (a.available !== b.available) return a.available ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      var summaryHtml =
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">' +
        '<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p class="text-xs text-slate-500">Pending waitlist</p><p class="text-lg font-bold text-brand-900">' +
        esc(String(totals.pending || 0)) +
        '</p></div>' +
        '<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p class="text-xs text-slate-500">Available cities</p><p class="text-lg font-bold text-brand-900">' +
        esc(String(totals.available || 0)) +
        '</p></div>' +
        '<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p class="text-xs text-slate-500">Sponsored / held</p><p class="text-lg font-bold text-brand-900">' +
        esc(String((totals.booked || 0) + (totals.openingSoon || 0))) +
        '</p></div>' +
        '<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p class="text-xs text-slate-500">Notified (all time)</p><p class="text-lg font-bold text-brand-900">' +
        esc(String(totals.notified || 0)) +
        '</p></div>' +
        '</div>';

      if (!cities.length) {
        bodyEl.innerHTML = summaryHtml + '<p class="text-sm text-slate-500">No city slots found.</p>';
        return;
      }

      var rows = cities
        .map(function (city) {
          var statusLabel = cityPartnerSlotStatusLabel(city.status, city.availableFromLabel);
          var statusClass = cityPartnerSlotStatusClass(city.status);
          var waitlistRows = (city.waitlist || [])
            .map(function (entry) {
              return (
                '<tr class="border-t border-slate-100">' +
                '<td class="px-3 py-2 text-sm">' +
                esc(entry.email) +
                (entry.companyName ? ' <span class="text-slate-500">(' + esc(entry.companyName) + ')</span>' : '') +
                '</td>' +
                '<td class="px-3 py-2 text-sm text-slate-600">' +
                esc(formatAdminDateTime(entry.createdAt)) +
                '</td>' +
                '<td class="px-3 py-2 text-right">' +
                '<button type="button" class="rounded border border-slate-200 text-slate-600 px-2 py-1 text-xs font-semibold hover:bg-slate-50" data-city-waitlist-remove="' +
                attrEsc(entry.id) +
                '">Remove</button>' +
                '</td></tr>'
              );
            })
            .join('');

          var waitlistBlock =
            city.waitlistPending > 0
              ? '<div class="mt-3 overflow-x-auto rounded-lg border border-slate-200">' +
                '<table class="min-w-full text-left">' +
                '<thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">' +
                '<tr><th class="px-3 py-2">Email</th><th class="px-3 py-2">Joined</th><th class="px-3 py-2 text-right">Action</th></tr></thead>' +
                '<tbody>' +
                waitlistRows +
                '</tbody></table></div>'
              : '<p class="mt-2 text-sm text-slate-500">No pending waitlist sign-ups.</p>';

          var recentNotified = (city.recentNotified || [])
            .map(function (entry) {
              return (
                '<li class="text-sm text-slate-600">' +
                esc(entry.email) +
                ' · notified ' +
                esc(formatAdminDateTime(entry.notifiedAt)) +
                '</li>'
              );
            })
            .join('');

          return (
            '<details class="rounded-xl border border-slate-200 bg-white"' +
            (city.waitlistPending > 0 ? ' open' : '') +
            '>' +
            '<summary class="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center justify-between gap-3">' +
            '<div class="min-w-0">' +
            '<p class="font-semibold text-brand-900">' +
            esc(city.name) +
            '</p>' +
            '<p class="text-xs text-slate-500 mt-0.5">' +
            esc(cityPartnerPlacementPaths(city.slug)) +
            '</p></div>' +
            '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
            '<span class="' +
            statusClass +
            '">' +
            esc(statusLabel) +
            '</span>' +
            (city.waitlistPending
              ? '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
                city.waitlistPending +
                ' waiting</span>'
              : '') +
            '<a class="text-xs font-semibold text-brand-700 hover:underline" href="#sponsorship/' +
            esc(city.slot) +
            '">Edit slot →</a>' +
            '</div></summary>' +
            '<div class="border-t border-slate-100 px-4 py-3 space-y-3">' +
            '<dl class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">' +
            '<div><dt class="text-slate-500">Checkout</dt><dd class="font-medium text-slate-800">' +
            (city.available ? 'Open now' : 'Closed') +
            '</dd></div>' +
            '<div><dt class="text-slate-500">Opens</dt><dd class="font-medium text-slate-800">' +
            esc(city.availableFromLabel || '—') +
            '</dd></div>' +
            '<div><dt class="text-slate-500">Sponsor email</dt><dd class="font-medium text-slate-800 break-all">' +
            esc(city.sponsorEmail || '—') +
            '</dd></div></dl>' +
            '<div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pending waitlist</p>' +
            waitlistBlock +
            '</div>' +
            (recentNotified
              ? '<div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Recently notified</p><ul class="space-y-1">' +
                recentNotified +
                '</ul></div>'
              : '') +
            '</div></details>'
          );
        })
        .join('');

      bodyEl.innerHTML =
        summaryHtml + '<div class="space-y-3" id="city-partner-waitlist-list">' + rows + '</div>';

      bodyEl.querySelectorAll('[data-city-waitlist-remove]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var id = btn.getAttribute('data-city-waitlist-remove');
          if (!id || !window.confirm('Remove this waitlist entry?')) return;
          btn.disabled = true;
          adminPost('/api/admin/city-partner-waitlist', { action: 'remove', id: id })
            .then(function (data) {
              if (!data || data.error) {
                throw new Error((data && data.message) || data.error || 'remove_failed');
              }
              loadCityPartnerWaitlistAdmin();
            })
            .catch(function (err) {
              btn.disabled = false;
              setWaitlistStatus((err && err.message) || 'Could not remove waitlist entry', 'error');
            });
        });
      });
    }

    function loadCityPartnerWaitlistAdmin() {
      setWaitlistStatus('Loading waitlist…');
      adminGet('/api/admin/city-partner-waitlist')
        .then(function (data) {
          if (!data || data.error) {
            throw new Error((data && data.message) || data.error || 'waitlist_load_failed');
          }
          renderWaitlistOverview(data);
          setWaitlistStatus(
            data.totals && data.totals.pending
              ? data.totals.pending + ' pending waitlist sign-up' + (data.totals.pending === 1 ? '' : 's') + ' across all cities.'
              : 'No pending waitlist sign-ups right now.',
            'ok'
          );
        })
        .catch(function (err) {
          if (bodyEl) {
            bodyEl.innerHTML =
              '<p class="text-sm text-red-700">' +
              esc((err && err.message) || 'Could not load waitlist') +
              '</p>';
          }
          setWaitlistStatus((err && err.message) || 'Could not load waitlist', 'error');
        });
    }

    loadCityPartnerWaitlistAdmin();
  }

  function renderCityPartnersPage() {
    var cards = NETWORKING_CITY_PARTNER_SLUGS.map(function (region) {
      var slotKey = cityPartnerSlotFromSlug(region.slug);
      return (
        '<a href="#sponsorship/' +
        esc(slotKey) +
        '" class="admin-ad-picker-card" data-city-partner-slot="' +
        attrEsc(slotKey) +
        '">' +
        '<div class="admin-ad-picker-card-head">' +
        '<span class="admin-ad-picker-type">City</span>' +
        '<span class="admin-ad-picker-status" data-city-partner-status="' +
        attrEsc(slotKey) +
        '">…</span>' +
        '</div>' +
        '<p class="admin-ad-picker-label">' +
        esc(region.name) +
        '</p>' +
        '<p class="admin-ad-picker-help">/networking/' +
        esc(region.slug) +
        ' · /opportunities/networking/' +
        esc(region.slug) +
        '</p>' +
        '<span class="admin-ad-picker-action">Edit placement →</span>' +
        '</a>'
      );
    }).join('');

    main.innerHTML =
      '<div class="space-y-6">' +
      sponsorshipBackLinkHtml() +
      '<section class="space-y-3">' +
      '<h3 class="font-bold text-brand-900">City Partner placements</h3>' +
      '<p class="text-sm text-slate-600">Logo + link on regional landing pages (/networking/:city and /opportunities/networking/:city). Website only — never included in hub emails. When a city is live, the organiser/provider CTA stays as a text link under the intro copy.</p>' +
      '</section>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3" id="city-partner-waitlist-admin">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h4 class="font-bold text-brand-900">Waitlist &amp; availability</h4>' +
      '<p class="text-xs text-slate-500 mt-1">Sign-ups from the advertising page — notified automatically when a slot opens after Stripe subscription ends.</p></div>' +
      '</div>' +
      '<p id="city-partner-waitlist-status" class="text-sm text-slate-500">Loading waitlist…</p>' +
      '<div id="city-partner-waitlist-body"></div>' +
      '</section>' +
      '<section class="space-y-3">' +
      '<h4 class="font-semibold text-brand-900">Edit city slots</h4>' +
      '</section>' +
      '<div class="admin-ad-picker-grid">' +
      cards +
      '</div></div>';

    initCityPartnerWaitlistAdmin();

    NETWORKING_CITY_PARTNER_SLUGS.forEach(function (region) {
      var slotKey = cityPartnerSlotFromSlug(region.slug);
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slotKey))
        .then(function (data) {
          var el = document.querySelector('[data-city-partner-status="' + slotKey + '"]');
          if (!el) return;
          if (!data || data.error) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
            return;
          }
          el.innerHTML = sponsorSlotStatusBadge(data.block);
        })
        .catch(function () {
          var el = document.querySelector('[data-city-partner-status="' + slotKey + '"]');
          if (el) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          }
        });
    });
  }

  function renderCountyPartnersPage() {
    var cards = NETWORKING_COUNTY_PARTNER_SLUGS.map(function (region) {
      var slotKey = countyPartnerSlotFromSlug(region.slug);
      return (
        '<a href="#sponsorship/' +
        esc(slotKey) +
        '" class="admin-ad-picker-card" data-county-partner-slot="' +
        attrEsc(slotKey) +
        '">' +
        '<div class="admin-ad-picker-card-head">' +
        '<span class="admin-ad-picker-type">County</span>' +
        '<span class="admin-ad-picker-status" data-county-partner-status="' +
        attrEsc(slotKey) +
        '">…</span>' +
        '</div>' +
        '<p class="admin-ad-picker-label">' +
        esc(region.name) +
        '</p>' +
        '<p class="admin-ad-picker-help">/networking/' +
        esc(region.slug) +
        ' · /opportunities/networking/' +
        esc(region.slug) +
        '</p>' +
        '<span class="admin-ad-picker-action">Edit placement →</span>' +
        '</a>'
      );
    }).join('');

    main.innerHTML =
      '<div class="space-y-6">' +
      sponsorshipBackLinkHtml() +
      '<section class="space-y-3">' +
      '<h3 class="font-bold text-brand-900">County Partner placements</h3>' +
      '<p class="text-sm text-slate-600">Logo + link on launch county pages (/networking/:county and /opportunities/networking/:county). Place manually after an advertising enquiry — Stripe self-serve can come later. Website only — never included in hub emails.</p>' +
      '<p class="text-xs text-slate-500">Launch counties: Berkshire, Cheshire, Essex, Hampshire, Hertfordshire, Kent, Lancashire, Surrey.</p>' +
      '</section>' +
      '<div class="admin-ad-picker-grid">' +
      cards +
      '</div></div>';

    NETWORKING_COUNTY_PARTNER_SLUGS.forEach(function (region) {
      var slotKey = countyPartnerSlotFromSlug(region.slug);
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slotKey))
        .then(function (data) {
          var el = document.querySelector('[data-county-partner-status="' + slotKey + '"]');
          if (!el) return;
          if (!data || data.error) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
            return;
          }
          el.innerHTML = sponsorSlotStatusBadge(data.block);
        })
        .catch(function () {
          var el = document.querySelector('[data-county-partner-status="' + slotKey + '"]');
          if (el) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          }
        });
    });
  }

  function initAdvertisingEnquiriesAdmin() {
    var statusEl = document.getElementById('advertising-enquiries-status');
    var bodyEl = document.getElementById('advertising-enquiries-body');

    function setEnquiriesStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text || '';
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function renderEnquiriesTable(data) {
      if (!bodyEl) return;
      var enquiries = Array.isArray(data.enquiries) ? data.enquiries : [];
      if (!enquiries.length) {
        bodyEl.innerHTML = '<p class="text-sm text-slate-500">No enquiries yet.</p>';
        return;
      }

      var rows = enquiries
        .map(function (row) {
          var message = String(row.message || '').trim();
          var messageCell = message
            ? '<span title="' +
              attrEsc(message) +
              '">' +
              esc(message.length > 120 ? message.slice(0, 117) + '…' : message) +
              '</span>'
            : '—';
          return (
            '<tr class="border-t border-slate-100 align-top">' +
            '<td class="px-3 py-2 text-sm whitespace-nowrap">' +
            esc(formatAdminDateTime(row.createdAt)) +
            '</td>' +
            '<td class="px-3 py-2 text-sm"><strong>' +
            esc(row.companyName || '—') +
            '</strong><br><span class="text-slate-600">' +
            esc(row.contactName || '—') +
            '</span></td>' +
            '<td class="px-3 py-2 text-sm break-all"><a class="text-brand-700 hover:underline" href="mailto:' +
            attrEsc(row.email || '') +
            '">' +
            esc(row.email || '—') +
            '</a></td>' +
            '<td class="px-3 py-2 text-sm">' +
            esc(row.section || '—') +
            '<br><span class="text-slate-600">' +
            esc(row.packageName || '—') +
            '</span></td>' +
            '<td class="px-3 py-2 text-sm whitespace-nowrap">' +
            esc(row.preferredTerm || '—') +
            '</td>' +
            '<td class="px-3 py-2 text-sm whitespace-nowrap">' +
            esc(row.budget || '—') +
            '</td>' +
            '<td class="px-3 py-2 text-sm text-slate-600 max-w-xs">' +
            messageCell +
            '</td></tr>'
          );
        })
        .join('');

      bodyEl.innerHTML =
        '<table class="min-w-full text-left">' +
        '<thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">' +
        '<tr><th class="px-3 py-2">Submitted</th><th class="px-3 py-2">Company</th><th class="px-3 py-2">Email</th><th class="px-3 py-2">Section / package</th><th class="px-3 py-2">Preferred term</th><th class="px-3 py-2">Budget</th><th class="px-3 py-2">Message</th></tr>' +
        '</thead><tbody>' +
        rows +
        '</tbody></table>';
    }

    adminGet('/api/admin/advertising-enquiries?limit=100')
      .then(function (data) {
        if (!data || data.error) {
          throw new Error((data && data.message) || data.error || 'enquiries_load_failed');
        }
        renderEnquiriesTable(data);
        var recent = Number(data.recentCount) || 0;
        var total = Number(data.total) || 0;
        setEnquiriesStatus(
          total
            ? total +
                ' enquir' +
                (total === 1 ? 'y' : 'ies') +
                ' loaded' +
                (recent ? ' · ' + recent + ' in the last 7 days' : '') +
                '.'
            : 'No enquiries yet.',
          'ok'
        );
      })
      .catch(function (err) {
        if (bodyEl) {
          bodyEl.innerHTML =
            '<p class="text-sm text-red-700">' + esc((err && err.message) || 'Could not load enquiries') + '</p>';
        }
        setEnquiriesStatus((err && err.message) || 'Could not load enquiries', 'error');
      });
  }

  function renderAdvertisingEnquiriesPage() {
    main.innerHTML =
      '<div class="space-y-6">' +
      sponsorshipBackLinkHtml() +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">Advertising enquiries</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Latest submissions from /advertising. Rosie receives each enquiry by email automatically.</p></div>' +
      '<a href="/advertising" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">Open advertising page ↗</a>' +
      '</div>' +
      '<p id="advertising-enquiries-status" class="text-sm text-slate-500">Loading enquiries…</p>' +
      '<div id="advertising-enquiries-body" class="overflow-x-auto"></div>' +
      '</section></div>';

    initAdvertisingEnquiriesAdmin();
  }

  function loadHtml2PdfLibrary() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-hub-html2pdf]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (window.html2pdf) resolve(window.html2pdf);
          else reject(new Error('PDF library failed to load.'));
        });
        existing.addEventListener('error', function () {
          reject(new Error('PDF library failed to load.'));
        });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
      script.async = true;
      script.setAttribute('data-hub-html2pdf', '1');
      script.onload = function () {
        if (window.html2pdf) resolve(window.html2pdf);
        else reject(new Error('PDF library failed to load.'));
      };
      script.onerror = function () {
        reject(new Error('PDF library failed to load.'));
      };
      document.head.appendChild(script);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('read_failed'));
      };
      reader.readAsDataURL(blob);
    });
  }

  function fetchImageAsDataUrl(url) {
    var abs = String(url || '').trim();
    if (!abs) return Promise.resolve('');
    if (abs.indexOf('data:') === 0) return Promise.resolve(abs);
    try {
      abs = new URL(abs, window.location.origin).href;
    } catch (_e) {
      /* keep */
    }
    return fetch(abs, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('img_fetch');
        return res.blob();
      })
      .then(blobToDataUrl)
      .catch(function () {
        return '';
      });
  }

  function formatSponsorPackCtr(clicks, pageViews) {
    var c = Number(clicks) || 0;
    var v = Number(pageViews) || 0;
    if (v < 1) return { label: '—', hint: 'Needs page views to calculate' };
    var pct = Math.round((c / v) * 1000) / 10;
    return {
      label: String(pct) + '%',
      hint: formatSponsorPackNumber(c) + ' clicks ÷ ' + formatSponsorPackNumber(v) + ' views',
    };
  }

  function formatSponsorPackMomDelta(pct) {
    if (pct == null || pct === '' || Number.isNaN(Number(pct))) {
      return { text: 'vs prior period: —', tone: '' };
    }
    var n = Number(pct);
    var sign = n > 0 ? '+' : '';
    return {
      text: 'vs prior: ' + sign + n + '%',
      tone: n > 0 ? 'is-up' : n < 0 ? 'is-down' : '',
    };
  }

  function sponsorPackMomDeltaHtml(pct) {
    var d = formatSponsorPackMomDelta(pct);
    return (
      '<p class="sponsor-pack-kpi-delta' +
      (d.tone ? ' ' + d.tone : '') +
      '">' +
      esc(d.text) +
      '</p>'
    );
  }

  function buildSponsorPackPdfRows(list, labelKey, limit) {
    var rows = Array.isArray(list) ? list.slice(0, limit || 6) : [];
    if (!rows.length) {
      return (
        '<tr><td colspan="2" style="padding:10px 0;color:#94a3b8;font-size:12px;">No data in this period yet.</td></tr>'
      );
    }
    return rows
      .map(function (r) {
        var label =
          labelKey === 'placement'
            ? formatSponsorPlacementLabel(r.placement || r.key)
            : labelKey === 'slug'
              ? String(r.slug || r.key || '').replace(/_/g, ' ')
              : String(r[labelKey] || r.key || '');
        return (
          '<tr>' +
          '<td style="padding:8px 0;border-bottom:1px solid #efeaf2;font-size:12.5px;color:#334155;">' +
          esc(label) +
          '</td>' +
          '<td style="padding:8px 0;border-bottom:1px solid #efeaf2;font-size:12.5px;color:#0f172a;font-weight:700;text-align:right;width:72px;">' +
          esc(formatSponsorPackNumber(r.count || 0)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function formatSponsorPackPeriodLabel(fromIso, toIso) {
    var from = String(fromIso || '').slice(0, 10);
    var to = String(toIso || '').slice(0, 10);
    if (!from) return 'This period';
    try {
      var d = new Date(from + 'T12:00:00Z');
      var monthYear = d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (to && to.slice(0, 7) !== from.slice(0, 7)) {
        var d2 = new Date(to + 'T12:00:00Z');
        return (
          monthYear +
          ' – ' +
          d2.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        );
      }
      return monthYear;
    } catch (_e) {
      return from + (to ? ' → ' + to : '');
    }
  }

  function resolveSponsorPackTierLabel(brandName) {
    if (/barnsgate/i.test(String(brandName || ''))) {
      return 'Events Headline Sponsor';
    }
    return 'Directory Partner';
  }

  function resolveSponsorPackFeeLabel(brandName) {
    if (/barnsgate/i.test(String(brandName || ''))) {
      return '£2,000 / month + VAT';
    }
    return '';
  }

  function formatSponsorPackEngagementHint(clicks, pageViews) {
    var c = Number(clicks) || 0;
    var v = Number(pageViews) || 0;
    if (v < 1) return 'Needs directory views to calculate';
    if (c === 0) return formatSponsorPackNumber(v) + ' directory views · no click-throughs yet';
    return (
      formatSponsorPackNumber(c) +
      ' of ' +
      formatSponsorPackNumber(v) +
      ' viewers clicked through'
    );
  }

  function buildSponsorPackHighlight(summary, brandName, ctr) {
    var views = Number(summary.pageVisits) || 0;
    var clicks = Number(summary.clicks) || 0;
    var name = brandName || 'This partner';
    if (views > 0 && clicks > 0 && ctr && ctr.label && ctr.label !== '—') {
      return (
        'During this period, ' +
        name +
        '’s Events placement delivered a ' +
        ctr.label +
        ' site click-through rate — ' +
        formatSponsorPackNumber(clicks) +
        ' of ' +
        formatSponsorPackNumber(views) +
        ' directory viewers went through to your site. That is strong intent from UK business decision-makers on The Networker Hub.'
      );
    }
    if (views > 0) {
      return (
        name +
        ' reached ' +
        formatSponsorPackNumber(views) +
        ' sponsored directory viewers this period. Click-through is still building — a creative refresh usually lifts engagement for the next cycle.'
      );
    }
    return (
      name +
      '’s placement is live on The Networker Hub. This pack will fill with directory reach, email exposure, and click-through as traffic accumulates.'
    );
  }

  /**
   * Hub-branded 2-page partnership pack (cover + performance).
   * Nested tables only — html2canvas-safe. Cream / lavender / charcoal.
   */
  function buildSponsorPackPdfDocument(data, logos) {
    var summary = (data && data.summary) || {};
    var previous = (data && data.previous) || null;
    var deltas = (previous && previous.deltas) || {};
    var eng = (data && data.emailEngagement) || {};
    var contact = (data && data.contact) || {};
    var brand = (data && data.brand) || {};
    var brandName = brand.company || 'Partner';
    var fromLabel = String((data && data.from) || '').slice(0, 10);
    var toLabel = String((data && data.to) || '').slice(0, 10);
    var periodLabel = formatSponsorPackPeriodLabel(fromLabel, toLabel);
    var tierLabel = resolveSponsorPackTierLabel(brandName);
    var feeLabel = resolveSponsorPackFeeLabel(brandName);
    var pageViews = Number(summary.pageVisits) || 0;
    var clicks = Number(summary.clicks) || 0;
    var emails = Number(summary.emailSends) || 0;
    var ctr = formatSponsorPackCtr(clicks, pageViews);
    var prepared = new Date().toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    var hubLogo = (logos && logos.hub) || '';
    var brandLogo = (logos && logos.brand) || '';
    var brandDark = brand.logoBandDark === true || /barnsgate/i.test(brandName);
    var amName = contact.name || 'Rosie McGilvray';
    var amEmail = contact.email || 'rosie@thenetworkerhub.com';
    var highlight = buildSponsorPackHighlight(summary, brandName, ctr);
    var topPlacement =
      data.byPlacement && data.byPlacement[0]
        ? formatSponsorPlacementLabel(data.byPlacement[0].placement)
        : '—';
    var topShare =
      data.byPlacement && data.byPlacement[0] && clicks > 0
        ? Math.round((Number(data.byPlacement[0].count || 0) / clicks) * 100) + '% of clicks'
        : 'No clicks yet';

    function momHint(base, pct) {
      if (pct == null || pct === '') return base;
      return base + ' · ' + formatSponsorPackMomDelta(pct).text;
    }

    var hubLogoHtml = hubLogo
      ? '<img src="' +
        attrEsc(hubLogo) +
        '" alt="The Networker Hub" width="150" height="44" style="max-width:150px;max-height:44px;width:auto;height:auto;display:inline-block;vertical-align:middle;">'
      : '<span style="font-size:13px;font-weight:700;color:#4a4446;">The Networker Hub</span>';

    var brandLogoHtml = brandLogo
      ? '<img src="' +
        attrEsc(brandLogo) +
        '" alt="' +
        attrEsc(brandName) +
        '" width="150" height="44" style="max-width:150px;max-height:44px;width:auto;height:auto;display:inline-block;vertical-align:middle;">'
      : '<span style="font-size:13px;font-weight:700;color:' +
        (brandDark ? '#faf6ee' : '#4a4446') +
        ';">' +
        esc(brandName) +
        '</span>';

    function metaCell(label, value) {
      return (
        '<td width="50%" style="width:50%;padding:10px 12px;vertical-align:top;border:1px solid rgba(194,153,209,0.28);background:#ffffff;">' +
        '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9a7aa8;">' +
        esc(label) +
        '</div>' +
        '<div style="margin-top:6px;font-size:13px;line-height:1.4;font-weight:600;color:#4a4446;">' +
        esc(value) +
        '</div></td>'
      );
    }

    function kpiCell(label, value, hint, accent) {
      return (
        '<td width="25%" style="width:25%;padding:4px;vertical-align:top;">' +
        '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ' +
        (accent ? '#9a7aa8' : 'rgba(194,153,209,0.28)') +
        ';background:' +
        (accent ? '#4a4446' : '#ffffff') +
        ';"><tr><td style="padding:12px 10px 14px;">' +
        '<div style="font-size:8px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' +
        (accent ? 'rgba(250,246,238,0.72)' : '#9a7aa8') +
        ';">' +
        esc(label) +
        '</div>' +
        '<div style="margin-top:8px;font-size:24px;font-weight:700;line-height:1;color:' +
        (accent ? '#faf6ee' : '#4a4446') +
        ';">' +
        esc(value) +
        '</div>' +
        '<div style="margin-top:8px;font-size:10px;line-height:1.35;color:' +
        (accent ? 'rgba(250,246,238,0.75)' : '#635c5e') +
        ';">' +
        esc(hint || '') +
        '</div></td></tr></table></td>'
      );
    }

    function rankRows(list, labelKey, totalForPct) {
      var rows = Array.isArray(list) ? list.slice(0, 5) : [];
      if (!rows.length) {
        return (
          '<tr><td colspan="2" style="padding:8px 0;font-size:11px;color:#7a7274;">No data in this period yet.</td></tr>'
        );
      }
      var total = Number(totalForPct) || 0;
      if (!total) {
        rows.forEach(function (r) {
          total += Number(r.count) || 0;
        });
      }
      return rows
        .map(function (r) {
          var label =
            labelKey === 'placement'
              ? formatSponsorPlacementLabel(r.placement || r.key)
              : labelKey === 'slug'
                ? String(r.slug || r.key || '').replace(/_/g, ' ')
                : String(r[labelKey] || r.key || '');
          var count = Number(r.count) || 0;
          var pct = total > 0 ? Math.round((count / total) * 1000) / 10 : null;
          return (
            '<tr>' +
            '<td style="padding:7px 0;border-bottom:1px solid #ebe0f0;font-size:12px;color:#4a4446;">' +
            esc(label) +
            '</td>' +
            '<td style="padding:7px 0;border-bottom:1px solid #ebe0f0;font-size:12px;font-weight:700;color:#4a4446;text-align:right;white-space:nowrap;">' +
            esc(formatSponsorPackNumber(count) + (pct != null ? ' (' + pct + '%)' : '')) +
            '</td></tr>'
          );
        })
        .join('');
    }

    var openRateLabel =
      eng.openRatePct != null ? String(eng.openRatePct) + '%' : eng.opensConfigured ? '0%' : 'Pending';
    var emailCtrLabel = eng.ctrPct != null ? String(eng.ctrPct) + '%' : emails > 0 ? '0%' : '—';
    var trackingWindow =
      fromLabel && toLabel
        ? fromLabel.split('-').reverse().join(' ') + ' – ' + toLabel.split('-').reverse().join(' ')
        : periodLabel;
    // Prefer readable en-GB dates
    try {
      if (fromLabel && toLabel) {
        trackingWindow =
          new Date(fromLabel + 'T12:00:00Z').toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          }) +
          ' – ' +
          new Date(toLabel + 'T12:00:00Z').toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          });
      }
    } catch (_e) {
      /* keep */
    }

    var pageStyle =
      'width:680px;max-width:680px;min-height:920px;padding:36px 34px 28px;box-sizing:border-box;background:#faf6ee;color:#4a4446;font-family:\'DM Sans\',Helvetica,Arial,sans-serif;';

    var cover =
      '<div class="sponsor-pack-pdf-page" style="' +
      pageStyle +
      'page-break-after:always;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:28px;">' +
      '<tr>' +
      '<td style="vertical-align:middle;">' +
      '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr>' +
      '<td style="border:1px solid rgba(194,153,209,0.35);background:#ffffff;padding:10px 14px;text-align:center;width:168px;height:58px;">' +
      hubLogoHtml +
      '</td>' +
      '<td style="width:28px;text-align:center;color:#9a7aa8;font-size:18px;">×</td>' +
      '<td style="border:1px solid ' +
      (brandDark ? '#2d2636' : 'rgba(194,153,209,0.35)') +
      ';background:' +
      (brandDark ? '#2d2636' : '#ffffff') +
      ';padding:10px 14px;text-align:center;width:168px;height:58px;">' +
      brandLogoHtml +
      '</td></tr></table></td>' +
      '<td style="text-align:right;vertical-align:middle;">' +
      '<div style="display:inline-block;padding:6px 12px;border:1px solid rgba(194,153,209,0.45);border-radius:999px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9a7aa8;background:#ffffff;">Confidential</div>' +
      '</td></tr></table>' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9a7aa8;margin-bottom:14px;">Executive performance review</div>' +
      '<div style="font-family:Georgia,\'DM Serif Display\',serif;font-size:36px;line-height:1.12;color:#4a4446;margin-bottom:12px;max-width:14ch;">Partnership<br>Performance Pack</div>' +
      '<div style="font-size:14px;line-height:1.55;color:#635c5e;max-width:34em;margin-bottom:28px;">Monthly traffic, email engagement, placement metrics, and conversion attribution for ' +
      esc(brandName) +
      ' on The Networker Hub.</div>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 0;margin-bottom:18px;"><tr>' +
      metaCell('Sponsorship tier', feeLabel ? tierLabel + ' · ' + feeLabel : tierLabel) +
      metaCell('Reporting period', periodLabel) +
      '</tr><tr>' +
      metaCell('Prepared by', amName) +
      metaCell('Prepared for', brandName) +
      '</tr></table>' +
      '<div style="margin-top:auto;padding-top:180px;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid rgba(194,153,209,0.35);"><tr>' +
      '<td style="padding-top:14px;font-size:10px;color:#7a7274;">The Networker Hub · Partnership reporting</td>' +
      '<td style="padding-top:14px;font-size:10px;color:#7a7274;text-align:right;">thenetworkerhub.com</td>' +
      '</tr></table></div></div>';

    var performance =
      '<div class="sponsor-pack-pdf-page" style="' +
      pageStyle +
      '">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:16px;"><tr>' +
      '<td style="vertical-align:bottom;">' +
      '<div style="font-family:Georgia,\'DM Serif Display\',serif;font-size:24px;color:#4a4446;line-height:1.2;">Performance overview</div>' +
      '<div style="margin-top:4px;font-size:12px;color:#635c5e;">' +
      esc(brandName) +
      ' · ' +
      esc(trackingWindow) +
      '</div></td>' +
      '<td style="text-align:right;vertical-align:bottom;">' +
      '<div style="display:inline-block;padding:6px 10px;background:#ebe0f0;color:#4a4446;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">' +
      esc(tierLabel) +
      '</div></td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:14px;"><tr><td style="padding:14px 16px;background:#ffffff;border:1px solid rgba(194,153,209,0.28);">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9a7aa8;margin-bottom:8px;">Key performance highlight</div>' +
      '<div style="font-size:13px;line-height:1.55;color:#4a4446;">' +
      esc(highlight) +
      '</div></td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;"><tr>' +
      kpiCell(
        'Site visits driven',
        formatSponsorPackNumber(clicks),
        momHint('Outbound clicks to your site', deltas.clicksPct)
      ) +
      kpiCell('Click-through rate', ctr.label, formatSponsorPackEngagementHint(clicks, pageViews), true) +
      kpiCell(
        'Directory reach',
        formatSponsorPackNumber(pageViews),
        momHint('Sponsored directory views', deltas.pageVisitsPct)
      ) +
      kpiCell('Top placement', topPlacement, topShare) +
      '</tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:8px;"><tr><td style="padding:0 0 6px;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9a7aa8;">Email engagement · Resend</div>' +
      '<div style="margin-top:3px;font-size:11px;line-height:1.4;color:#635c5e;">Hub emails that included your logo · opens and link clicks from Resend delivery tracking</div>' +
      '</td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:6px;"><tr>' +
      kpiCell(
        'Emails with logo',
        formatSponsorPackNumber(emails),
        momHint('Sends carrying your creative', deltas.emailSendsPct)
      ) +
      kpiCell(
        'Opens',
        eng.opensConfigured ? formatSponsorPackNumber(eng.opens || 0) : 'Pending',
        eng.opensConfigured
          ? momHint('Resend open events', deltas.emailOpensPct)
          : 'Connect Resend webhook + migration 237'
      ) +
      kpiCell('Open rate', openRateLabel, 'Opens ÷ emails with logo') +
      kpiCell(
        'Email clicks',
        formatSponsorPackNumber(eng.clicks || 0),
        'Resend link clicks + Hub email placements'
      ) +
      '</tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;"><tr>' +
      kpiCell('Email CTR', emailCtrLabel, 'Email clicks ÷ emails sent', true) +
      '<td width="75%" style="width:75%;padding:4px;vertical-align:top;" colspan="3">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid rgba(194,153,209,0.28);height:100%;"><tr><td style="padding:12px 14px;">' +
      '<div style="font-size:11px;font-weight:700;color:#4a4446;margin-bottom:4px;">Emails by template</div>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">' +
      rankRows((data.emails || {}).bySlug, 'slug', emails) +
      '</table>' +
      '<div style="margin-top:8px;font-size:10px;line-height:1.4;color:#7a7274;">' +
      esc(
        eng.note ||
          'Open rates come from Resend. Site leads still appear in your analytics via utm_source=thenetworkerhub.'
      ) +
      '</div></td></tr></table></td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;"><tr>' +
      '<td width="50%" style="width:50%;padding-right:6px;vertical-align:top;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid rgba(194,153,209,0.28);"><tr><td style="padding:12px 14px;">' +
      '<div style="font-size:12px;font-weight:700;color:#4a4446;margin-bottom:6px;">Clicks by placement</div>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">' +
      rankRows(data.byPlacement, 'placement', clicks) +
      '</table></td></tr></table></td>' +
      '<td width="50%" style="width:50%;padding-left:6px;vertical-align:top;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid rgba(194,153,209,0.28);"><tr><td style="padding:12px 14px;">' +
      '<div style="font-size:12px;font-weight:700;color:#4a4446;margin-bottom:6px;">Views by placement</div>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">' +
      rankRows((data.impressions || {}).byPlacement, 'placement', pageViews) +
      '</table></td></tr></table></td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:12px;"><tr>' +
      '<td width="62%" style="width:62%;padding-right:6px;vertical-align:top;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid rgba(194,153,209,0.28);"><tr><td style="padding:12px 14px;">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9a7aa8;margin-bottom:8px;">Suggested next steps</div>' +
      '<div style="font-size:12px;line-height:1.5;color:#4a4446;margin-bottom:6px;"><strong>Creative refresh</strong> — update the Events hero graphic ahead of the next busy networking month.</div>' +
      '<div style="font-size:12px;line-height:1.5;color:#4a4446;margin-bottom:6px;"><strong>Email presence</strong> — keep your logo in attendee emails; Resend opens and email CTR are reported above.</div>' +
      '<div style="font-size:12px;line-height:1.5;color:#4a4446;">Leads show in your analytics via <span style="font-family:Menlo,Consolas,monospace;font-size:10px;">utm_source=thenetworkerhub</span>.</div>' +
      '</td></tr></table></td>' +
      '<td width="38%" style="width:38%;padding-left:6px;vertical-align:top;">' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#4a4446;"><tr><td style="padding:14px 14px;">' +
      '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(250,246,238,0.7);margin-bottom:8px;">Your Hub contact</div>' +
      '<div style="font-size:15px;font-weight:700;color:#faf6ee;margin-bottom:4px;">' +
      esc(amName) +
      '</div>' +
      '<div style="font-size:11px;color:rgba(250,246,238,0.8);margin-bottom:10px;">Questions about this pack?</div>' +
      '<div style="font-size:12px;color:#c299d1;">' +
      esc(amEmail) +
      '</div></td></tr></table></td></tr></table>' +
      '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid rgba(194,153,209,0.35);"><tr>' +
      '<td style="padding-top:12px;font-size:9px;letter-spacing:0.04em;text-transform:uppercase;color:#7a7274;">Confidential · The Networker Hub × ' +
      esc(brandName) +
      '</td>' +
      '<td style="padding-top:12px;font-size:9px;letter-spacing:0.04em;text-transform:uppercase;color:#7a7274;text-align:right;">Prepared ' +
      esc(prepared) +
      '</td></tr></table></div>';

    return (
      '<div class="sponsor-pack-pdf" style="width:680px;max-width:680px;background:#faf6ee;box-sizing:border-box;">' +
      cover +
      performance +
      '</div>'
    );
  }

  function downloadSponsorPackPdf(data, filename) {
    var brand = (data && data.brand) || {};
    var brandName = brand.company || 'Partner';
    var hubUrl = (data && data.hubLogoUrl) || '/assets/logo-nav.png';
    var brandUrl = brand.logoUrl || '';
    if (/barnsgate/i.test(brandName) && (!brandUrl || /\.svg(?:[?#]|$)/i.test(brandUrl))) {
      brandUrl =
        'https://cdn.prod.website-files.com/66e99a1017187b724a2bc8b8/66e9a2aee48ebc4a38f6add4_BAR%200007%20Solutions%20logo%20various%20final-01.svg';
    }

    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:680px;background:#faf6ee;opacity:0.01;z-index:2147483000;pointer-events:none;overflow:visible;';
    document.body.appendChild(host);

    return Promise.all([fetchImageAsDataUrl(hubUrl), fetchImageAsDataUrl(brandUrl)])
      .then(function (urls) {
        host.innerHTML = buildSponsorPackPdfDocument(data, { hub: urls[0], brand: urls[1] });
        return loadHtml2PdfLibrary();
      })
      .then(function (html2pdf) {
        var node = host.firstElementChild;
        if (!node) throw new Error('PDF document failed to render.');
        var opt = {
          margin: [0, 0, 0, 0],
          filename: filename || 'sponsor-pack.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#faf6ee',
            logging: false,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
            windowWidth: 680,
            width: 680,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        };
        return html2pdf().set(opt).from(node).save();
      })
      .finally(function () {
        try {
          host.remove();
        } catch (_e) {
          /* ignore */
        }
      });
  }

  function monthDateInputsDefault() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = now.getUTCMonth();
    var from = new Date(Date.UTC(y, m, 1));
    var to = new Date(Date.UTC(y, m + 1, 0));
    function isoDay(d) {
      return d.toISOString().slice(0, 10);
    }
    return { from: isoDay(from), to: isoDay(to) };
  }

  function formatSponsorPackNumber(n) {
    var num = Number(n) || 0;
    try {
      return num.toLocaleString('en-GB');
    } catch (_e) {
      return String(num);
    }
  }

  function formatSponsorPlacementLabel(raw) {
    var s = String(raw || '').trim();
    if (!s || s === '(blank)') return 'Unlabelled';
    var map = {
      events_hero: 'Events hero',
      organisers_hero: 'Organisers hero',
      opportunities_hero: 'Opportunities hero',
      events_sponsor_hub: 'Events hero',
      organisers_sponsor_hub: 'Organisers hero',
      opportunities_sponsor_hub: 'Opportunities hero',
      home_partners: 'Home partners',
      events_email: 'Events emails',
      organisers_email: 'Organisers emails',
      opportunities_email: 'Opportunities emails',
      email_sponsor: 'Email sponsor',
      email_mini_sponsor: 'Email mini sponsors',
      page_partner_carousel: 'Page partner carousel',
      sponsor_sidebar: 'Sidebar sponsor',
    };
    if (map[s]) return map[s];
    return s.replace(/_/g, ' ');
  }

  function renderSponsorClicksReportPage() {
    var defaults = monthDateInputsDefault();
    main.innerHTML =
      '<div class="space-y-4 sponsor-pack-admin">' +
      sponsorshipBackLinkHtml() +
      '<section class="sponsor-pack-toolbar no-print">' +
      '<form id="sponsor-clicks-filters" class="sponsor-pack-filters">' +
      '<div><label for="sponsor-clicks-from">From</label>' +
      '<input type="date" id="sponsor-clicks-from" value="' +
      attrEsc(defaults.from) +
      '"></div>' +
      '<div><label for="sponsor-clicks-to">To</label>' +
      '<input type="date" id="sponsor-clicks-to" value="' +
      attrEsc(defaults.to) +
      '"></div>' +
      '<div><label for="sponsor-clicks-company">Brand</label>' +
      '<select id="sponsor-clicks-company">' +
      '<option value="">All sponsors</option>' +
      '<option value="Barnsgate Solutions">Barnsgate Solutions</option>' +
      '</select></div>' +
      '<div><label for="sponsor-clicks-placement">Placement</label>' +
      '<input type="text" id="sponsor-clicks-placement" placeholder="events_hero" autocomplete="off"></div>' +
      '<div class="sponsor-pack-filter-actions">' +
      '<button type="submit" class="sponsor-pack-btn sponsor-pack-btn--primary">Apply</button>' +
      '<button type="button" id="sponsor-clicks-barnsgate" class="sponsor-pack-btn">Barnsgate pack</button>' +
      '<button type="button" id="sponsor-clicks-export" class="sponsor-pack-btn">Export CSV</button>' +
      '<button type="button" id="sponsor-clicks-print" class="sponsor-pack-btn">Download PDF</button>' +
      '</div></form>' +
      '<p id="sponsor-clicks-status" class="sponsor-pack-status">Loading…</p>' +
      '<p class="sponsor-pack-print-hint no-print">Download PDF creates a 2-page Hub-branded pack (cover + performance) — choose a brand first.</p>' +
      '</section>' +
      '<div id="sponsor-clicks-body" class="sponsor-pack-sheet"></div></div>';

    initSponsorClicksReportAdmin();
  }

  function initSponsorClicksReportAdmin() {
    var statusEl = document.getElementById('sponsor-clicks-status');
    var bodyEl = document.getElementById('sponsor-clicks-body');
    var form = document.getElementById('sponsor-clicks-filters');
    var exportBtn = document.getElementById('sponsor-clicks-export');
    var printBtn = document.getElementById('sponsor-clicks-print');
    var barnsgateBtn = document.getElementById('sponsor-clicks-barnsgate');
    var lastReport = null;

    function setStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'sponsor-pack-status' +
        (tone === 'error' ? ' is-error' : tone === 'ok' ? ' is-ok' : '');
    }

    function queryFromForm() {
      var from = (document.getElementById('sponsor-clicks-from') || {}).value || '';
      var to = (document.getElementById('sponsor-clicks-to') || {}).value || '';
      var company = (document.getElementById('sponsor-clicks-company') || {}).value || '';
      var placement = (document.getElementById('sponsor-clicks-placement') || {}).value || '';
      var qs = [];
      if (from) qs.push('from=' + encodeURIComponent(from));
      if (to) qs.push('to=' + encodeURIComponent(to));
      if (company.trim()) qs.push('company=' + encodeURIComponent(company.trim()));
      if (placement.trim()) qs.push('placement=' + encodeURIComponent(placement.trim()));
      return qs.length ? '?' + qs.join('&') : '';
    }

    function rankListHtml(rows, labelKey, emptyMsg) {
      if (!rows || !rows.length) {
        return '<p class="sponsor-pack-empty">' + emptyMsg + '</p>';
      }
      return (
        '<ul class="sponsor-pack-rank">' +
        rows
          .slice(0, 8)
          .map(function (r) {
            var label =
              labelKey === 'placement'
                ? formatSponsorPlacementLabel(r[labelKey])
                : labelKey === 'slug'
                  ? String(r[labelKey] || '').replace(/_/g, ' ')
                  : String(r[labelKey] || '(blank)');
            return (
              '<li><span class="sponsor-pack-rank-label">' +
              esc(label) +
              '</span><span class="sponsor-pack-rank-count">' +
              esc(formatSponsorPackNumber(r.count || 0)) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul>'
      );
    }

    function sparklineHtml(days) {
      var list = days || [];
      if (!list.length) return '<p class="sponsor-pack-empty">No daily activity in this range yet.</p>';
      var max = 1;
      list.forEach(function (d) {
        if ((d.count || 0) > max) max = d.count;
      });
      return (
        '<div class="sponsor-pack-days">' +
        list
          .map(function (d) {
            var pct = Math.max(6, Math.round(((d.count || 0) / max) * 100));
            return (
              '<div class="sponsor-pack-day">' +
              '<span class="sponsor-pack-day-label">' +
              esc(String(d.day || '').slice(5)) +
              '</span>' +
              '<span class="sponsor-pack-day-bar"><i style="width:' +
              pct +
              '%"></i></span>' +
              '<span class="sponsor-pack-day-count">' +
              esc(formatSponsorPackNumber(d.count || 0)) +
              '</span></div>'
            );
          })
          .join('') +
        '</div>'
      );
    }

    function populateBrandSelect(brands, selected) {
      var sel = document.getElementById('sponsor-clicks-company');
      if (!sel || sel.tagName !== 'SELECT') return;
      var current = selected != null ? String(selected) : sel.value || '';
      var list = Array.isArray(brands) ? brands.slice() : [];
      if (!list.some(function (b) { return /barnsgate/i.test(String(b || '')); })) {
        list.unshift('Barnsgate Solutions');
      }
      var opts = ['<option value="">All sponsors</option>'];
      list.forEach(function (name) {
        var n = String(name || '').trim();
        if (!n) return;
        opts.push(
          '<option value="' +
            attrEsc(n) +
            '"' +
            (current && (current === n || n.toLowerCase().indexOf(current.toLowerCase()) === 0)
              ? ' selected'
              : '') +
            '>' +
            esc(n) +
            '</option>'
        );
      });
      sel.innerHTML = opts.join('');
      if (current) {
        var matched = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === current) {
            sel.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          for (var j = 0; j < sel.options.length; j++) {
            if (sel.options[j].value.toLowerCase().indexOf(current.toLowerCase()) === 0) {
              sel.selectedIndex = j;
              break;
            }
          }
        }
      }
    }

    function renderReport(data) {
      lastReport = data;
      if (!bodyEl) return;
      if (!data || !data.ok) {
        bodyEl.innerHTML = '';
        return;
      }

      populateBrandSelect(data.brands || [], (document.getElementById('sponsor-clicks-company') || {}).value || '');

      var summary = data.summary || {};
      var previous = data.previous || null;
      var deltas = (previous && previous.deltas) || {};
      var eng = data.emailEngagement || {};
      var contact = data.contact || {};
      var brand = data.brand || {};
      var brandName = brand.company || (document.getElementById('sponsor-clicks-company') || {}).value || 'All sponsors';
      var fromLabel = String(data.from || '').slice(0, 10);
      var toLabel = String(data.to || '').slice(0, 10);
      var hubLogo = data.hubLogoUrl || '/assets/logo-nav.png';
      var brandLogo = brand.logoUrl || '';
      var brandDark = brand.logoBandDark === true || /barnsgate/i.test(brandName);
      var ctrInfo = formatSponsorPackCtr(summary.clicks || 0, summary.pageVisits || 0);
      var ctrLabel = ctrInfo.label;
      var execLine = String(data.executiveSummary || '').trim();
      var generated = new Date().toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      var logoPair =
        '<div class="sponsor-pack-logos">' +
        '<div class="sponsor-pack-logo-tile">' +
        '<img src="' +
        attrEsc(hubLogo) +
        '" alt="The Networker Hub" class="sponsor-pack-logo sponsor-pack-logo--hub">' +
        '</div>' +
        '<span class="sponsor-pack-logo-x" aria-hidden="true">×</span>' +
        '<div class="sponsor-pack-logo-tile' +
        (brandLogo ? '' : ' is-placeholder') +
        (brandDark ? ' sponsor-pack-logo-tile--dark' : '') +
        '">' +
        (brandLogo
          ? '<img src="' +
            attrEsc(brandLogo) +
            '" alt="' +
            attrEsc(brandName) +
            '" class="sponsor-pack-logo sponsor-pack-logo--brand">'
          : '<span class="sponsor-pack-logo-fallback">' + esc(String(brandName).slice(0, 22)) + '</span>') +
        '</div></div>';

      var recentRows = (data.recent || [])
        .slice(0, 12)
        .map(function (r) {
          return (
            '<tr>' +
            '<td>' +
            esc(String(r.createdAt || '').replace('T', ' ').slice(0, 16)) +
            '</td>' +
            '<td>' +
            esc(formatSponsorPlacementLabel(r.placement)) +
            '</td>' +
            '<td class="sponsor-pack-mono">' +
            esc(r.path || '—') +
            '</td>' +
            '<td><a href="' +
            attrEsc(r.url || '#') +
            '" target="_blank" rel="noopener">' +
            esc((r.url || '').replace(/^https?:\/\//i, '').slice(0, 42) || '—') +
            '</a></td></tr>'
          );
        })
        .join('');

      var openRateLabel =
        eng.openRatePct != null
          ? String(eng.openRatePct) + '%'
          : eng.opensConfigured
            ? '—'
            : 'Pending';
      var emailCtrLabel = eng.ctrPct != null ? String(eng.ctrPct) + '%' : '—';
      var contactName = contact.name || 'Rosie McGilvray';
      var contactEmail = contact.email || 'rosie@thenetworkerhub.com';
      var contactLabel = contact.label || 'Questions about this pack?';

      bodyEl.innerHTML =
        '<article class="sponsor-pack">' +
        '<header class="sponsor-pack-header">' +
        logoPair +
        '<div class="sponsor-pack-header-copy">' +
        '<p class="sponsor-pack-eyebrow">Partnership performance pack</p>' +
        '<h2 class="sponsor-pack-title">' +
        esc(brandName) +
        '</h2>' +
        '<p class="sponsor-pack-period">' +
        esc(fromLabel) +
        ' → ' +
        esc(toLabel) +
        ' · UTC · Prepared ' +
        esc(generated) +
        '</p></div></header>' +
        (execLine ? '<p class="sponsor-pack-exec">' + esc(execLine) + '</p>' : '') +
        '<section class="sponsor-pack-kpis" aria-label="Headline metrics">' +
        '<div class="sponsor-pack-kpi"><p class="sponsor-pack-kpi-label">Page views</p>' +
        '<p class="sponsor-pack-kpi-value">' +
        esc(formatSponsorPackNumber(summary.pageVisits || 0)) +
        '</p><p class="sponsor-pack-kpi-hint">Views of the sponsored directory (e.g. /events/)</p>' +
        sponsorPackMomDeltaHtml(deltas.pageVisitsPct) +
        '</div>' +
        '<div class="sponsor-pack-kpi"><p class="sponsor-pack-kpi-label">Emails with logo</p>' +
        '<p class="sponsor-pack-kpi-value">' +
        esc(formatSponsorPackNumber(summary.emailSends || 0)) +
        '</p><p class="sponsor-pack-kpi-hint">Hub emails that included their logo</p>' +
        sponsorPackMomDeltaHtml(deltas.emailSendsPct) +
        '</div>' +
        '<div class="sponsor-pack-kpi"><p class="sponsor-pack-kpi-label">Outbound clicks</p>' +
        '<p class="sponsor-pack-kpi-value">' +
        esc(formatSponsorPackNumber(summary.clicks || 0)) +
        '</p><p class="sponsor-pack-kpi-hint">Clicks through to their website</p>' +
        sponsorPackMomDeltaHtml(deltas.clicksPct) +
        '</div>' +
        '<div class="sponsor-pack-kpi sponsor-pack-kpi--accent"><p class="sponsor-pack-kpi-label">Site CTR</p>' +
        '<p class="sponsor-pack-kpi-value">' +
        esc(ctrLabel) +
        '</p><p class="sponsor-pack-kpi-hint">' +
        esc(ctrInfo.hint) +
        '</p></div>' +
        '</section>' +
        '<section class="sponsor-pack-email-eng" aria-label="Email engagement">' +
        '<h3>Email engagement</h3>' +
        '<div class="sponsor-pack-email-eng-grid">' +
        '<div><p class="sponsor-pack-email-eng-label">Emails sent</p><p class="sponsor-pack-email-eng-value">' +
        esc(formatSponsorPackNumber(eng.sends || summary.emailSends || 0)) +
        '</p></div>' +
        '<div><p class="sponsor-pack-email-eng-label">Opens</p><p class="sponsor-pack-email-eng-value">' +
        esc(eng.opensConfigured ? formatSponsorPackNumber(eng.opens || 0) : 'Pending') +
        '</p></div>' +
        '<div><p class="sponsor-pack-email-eng-label">Open rate</p><p class="sponsor-pack-email-eng-value">' +
        esc(openRateLabel) +
        '</p></div>' +
        '<div><p class="sponsor-pack-email-eng-label">Email CTR</p><p class="sponsor-pack-email-eng-value">' +
        esc(emailCtrLabel) +
        '</p></div></div>' +
        '<p class="sponsor-pack-email-eng-note">' +
        esc(eng.note || '') +
        '</p></section>' +
        '<section class="sponsor-pack-grid">' +
        '<div class="sponsor-pack-card"><h3>Clicks by placement</h3>' +
        rankListHtml(data.byPlacement, 'placement', 'No clicks in this range.') +
        '</div>' +
        '<div class="sponsor-pack-card"><h3>Page views by placement</h3>' +
        rankListHtml((data.impressions || {}).byPlacement, 'placement', 'No page views logged yet.') +
        '</div>' +
        '<div class="sponsor-pack-card"><h3>Emails by template</h3>' +
        rankListHtml((data.emails || {}).bySlug, 'slug', 'No logo emails counted yet.') +
        '</div>' +
        '<div class="sponsor-pack-card"><h3>Daily clicks</h3>' +
        sparklineHtml(data.byDay) +
        '</div></section>' +
        '<section class="sponsor-pack-card sponsor-pack-card--wide">' +
        '<div class="sponsor-pack-card-head"><h3>Recent outbound clicks</h3>' +
        '<p>Latest Hub clicks with UTM-tagged destinations</p></div>' +
        (recentRows
          ? '<div class="sponsor-pack-table-wrap"><table class="sponsor-pack-table"><thead><tr>' +
            '<th>When (UTC)</th><th>Placement</th><th>Path</th><th>Destination</th></tr></thead><tbody>' +
            recentRows +
            '</tbody></table></div>'
          : '<p class="sponsor-pack-empty">No clicks yet for this filter.</p>') +
        '</section>' +
        '<section class="sponsor-pack-notes">' +
        '<h3>How to read this pack</h3>' +
        '<ul>' +
        '<li><strong>Page views</strong> count each visit to the sponsored directory while their hero is live (e.g. /events/ for Events Headline).</li>' +
        '<li><strong>Email opens &amp; CTR</strong> come from Resend when the webhook is connected; until then Hub email-placement clicks still appear in Email CTR.</li>' +
        '<li><strong>Leads &amp; form fills</strong> appear in their analytics / CRM via Hub UTM tags (<code>utm_source=thenetworkerhub</code>).</li>' +
        '<li><strong>Suggestion:</strong> lead with Site CTR + email volume on the renewal call; attach their GA “thenetworkerhub” sessions as proof of pipeline.</li>' +
        '</ul></section>' +
        '<section class="sponsor-pack-contact">' +
        '<p class="sponsor-pack-contact-label">' +
        esc(contactLabel) +
        ' <strong>' +
        esc(contactName) +
        '</strong></p>' +
        '<a href="mailto:' +
        attrEsc(contactEmail) +
        '">' +
        esc(contactEmail) +
        '</a></section>' +
        '<footer class="sponsor-pack-footer">' +
        '<span>Confidential · The Networker Hub × ' +
        esc(brandName) +
        '</span><span>thenetworkerhub.com</span></footer></article>';
    }

    function load() {
      setStatus('Loading pack…');
      adminGet('/api/admin/sponsor-clicks' + queryFromForm())
        .then(function (data) {
          if (!data || !data.ok) {
            setStatus(
              (data && data.message) ||
                (data && data.error === 'sponsor_clicks_table_missing'
                  ? 'Run migrations 234 + 235 (+ 237 for email opens) in Supabase.'
                  : 'Could not load report.'),
              'error'
            );
            if (bodyEl) bodyEl.innerHTML = '';
            return;
          }
          var s = data.summary || {};
          setStatus(
            formatSponsorPackNumber(s.clicks || 0) +
              ' clicks · ' +
              formatSponsorPackNumber(s.pageVisits || 0) +
              ' page views · ' +
              formatSponsorPackNumber(s.emailSends || 0) +
              ' emails',
            'ok'
          );
          renderReport(data);
        })
        .catch(function (err) {
          setStatus(err.message || 'Could not load report.', 'error');
          if (bodyEl) bodyEl.innerHTML = '';
        });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        load();
      });
    }
    if (barnsgateBtn) {
      barnsgateBtn.addEventListener('click', function () {
        var company = document.getElementById('sponsor-clicks-company');
        if (company) {
          company.value = 'Barnsgate Solutions';
          if (company.value !== 'Barnsgate Solutions') {
            // ensure option exists
            var opt = document.createElement('option');
            opt.value = 'Barnsgate Solutions';
            opt.textContent = 'Barnsgate Solutions';
            company.appendChild(opt);
            company.value = 'Barnsgate Solutions';
          }
        }
        load();
      });
    }
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        if (!lastReport || !lastReport.ok) {
          window.alert('Load a pack first, then Download PDF.');
          return;
        }
        var companyFilter = ((document.getElementById('sponsor-clicks-company') || {}).value || '').trim();
        if (!companyFilter) {
          window.alert(
            'Enter a brand (e.g. Barnsgate) and click Apply before downloading the client PDF.'
          );
          return;
        }
        var brand =
          (lastReport.brand && lastReport.brand.company) || companyFilter || 'sponsor';
        var from = String(lastReport.from || '').slice(0, 10);
        var to = String(lastReport.to || '').slice(0, 10);
        var filename =
          'sponsor-pack-' +
          String(brand || 'sponsor')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) +
          (from && to ? '-' + from + '-to-' + to : '') +
          '.pdf';

        printBtn.disabled = true;
        var prevLabel = printBtn.textContent;
        printBtn.textContent = 'Preparing PDF…';
        setStatus('Preparing client PDF…');

        downloadSponsorPackPdf(lastReport, filename)
          .then(function () {
            setStatus('PDF downloaded — ' + filename, 'ok');
          })
          .catch(function (err) {
            console.error('[sponsor-pack-pdf]', err);
            setStatus(err.message || 'Could not create PDF.', 'error');
            window.alert(err.message || 'Could not create PDF. Try again in a moment.');
          })
          .finally(function () {
            printBtn.disabled = false;
            printBtn.textContent = prevLabel || 'Download PDF';
          });
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (!lastReport || !lastReport.ok) {
          window.alert('Load a report first.');
          return;
        }
        var rows = [['metric', 'day', 'company', 'placement_or_slug', 'count']];
        var summary = lastReport.summary || {};
        rows.push(['page_visits_total', '', '', '', summary.pageVisits || 0]);
        rows.push(['email_sends_total', '', '', '', summary.emailSends || 0]);
        rows.push(['clicks_total', '', '', '', summary.clicks || 0]);
        rows.push(['ctr', '', '', '', summary.ctrPct == null ? '' : summary.ctrPct]);
        rows.push(['email_opens_total', '', '', '', summary.emailOpens || 0]);
        rows.push(['email_open_rate_pct', '', '', '', summary.emailOpenRatePct == null ? '' : summary.emailOpenRatePct]);
        rows.push(['email_ctr_pct', '', '', '', summary.emailCtrPct == null ? '' : summary.emailCtrPct]);
        if (lastReport.previous && lastReport.previous.deltas) {
          var dlt = lastReport.previous.deltas;
          rows.push(['mom_page_visits_pct', '', '', '', dlt.pageVisitsPct == null ? '' : dlt.pageVisitsPct]);
          rows.push(['mom_clicks_pct', '', '', '', dlt.clicksPct == null ? '' : dlt.clicksPct]);
        }
        (lastReport.byDay || []).forEach(function (r) {
          rows.push(['clicks_by_day', r.day || '', '', '', r.count || 0]);
        });
        ((lastReport.impressions || {}).byDay || []).forEach(function (r) {
          rows.push(['visits_by_day', r.day || '', '', '', r.count || 0]);
        });
        ((lastReport.emails || {}).bySlug || []).forEach(function (r) {
          rows.push(['emails_by_slug', '', '', r.slug || '', r.count || 0]);
        });
        (lastReport.byPlacement || []).forEach(function (r) {
          rows.push(['clicks_by_placement', '', '', r.placement || '', r.count || 0]);
        });
        (lastReport.recent || []).forEach(function (r) {
          rows.push([
            'click',
            String(r.createdAt || '').slice(0, 10),
            r.company || '',
            r.placement || '',
            1,
          ]);
        });
        var from = String(lastReport.from || '').slice(0, 10);
        var to = String(lastReport.to || '').slice(0, 10);
        downloadAdminCsv('sponsor-pack-' + from + '-to-' + to + '.csv', rows);
      });
    }

    load();
  }

  function renderHomePartnersPage() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      sponsorshipBackLinkHtml() +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5" id="home-partners-admin">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">Home page — Partners &amp; sponsors</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Live <strong>Powered by</strong> heroes (Events, Organisers, Opportunities) always appear in this strip automatically. Add any <strong>extra</strong> logos here — duplicates of the live heroes are skipped.</p></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700 shrink-0">' +
      '<input type="checkbox" id="home-partners-active" class="rounded border-slate-300" checked> ' +
      'Show extras on home page</label></div>' +
      '<div id="home-partners-list" class="space-y-4 min-w-0"></div>' +
      '<div class="flex flex-wrap gap-3">' +
      '<button type="button" id="home-partners-add" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">+ Add company</button>' +
      '<button type="button" id="home-partners-save" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save partners</button>' +
      '</div>' +
      '<p id="home-partners-status" class="text-sm text-slate-500"></p></section></div>';
    initHomePartnersAdmin();
  }

  function renderSponsorshipSlot(currentSlotKey) {
    var sponsorLogoBase64 = null;
    var sponsorLogoMime = '';
    var sponsorLogoFilename = '';

    function slotDefaults() {
      return cmsSlotByKey(currentSlotKey);
    }

    function applyDefaultsToForm() {
      var d = slotDefaults();
      var company = document.getElementById('sponsor-company');
      var logoUrl = document.getElementById('sponsor-logo-url');
      var tagline = document.getElementById('sponsor-tagline');
      var ctaLabel = document.getElementById('sponsor-cta-label');
      var ctaUrl = document.getElementById('sponsor-cta-url');
      var active = document.getElementById('sponsor-active');
      var includeInEmails = document.getElementById('sponsor-include-emails');
      if (company) company.value = '';
      if (logoUrl) logoUrl.value = '';
      if (tagline) tagline.value = d.tagline;
      if (ctaLabel) ctaLabel.value = d.ctaLabel;
      if (ctaUrl) ctaUrl.value = d.ctaUrl;
      sponsorCtaColorManual = false;
      setSponsorCtaColorFields(d.ctaColor || defaultSponsorCtaColor());
      if (active) active.checked = true;
      if (includeInEmails) includeInEmails.checked = true;
      var logoBandDark = document.getElementById('sponsor-logo-band-dark');
      if (logoBandDark) logoBandDark.checked = false;
      var slotEmail = document.getElementById('sponsor-slot-email');
      var slotOpens = document.getElementById('sponsor-slot-available-from');
      if (slotEmail) slotEmail.value = '';
      if (slotOpens) slotOpens.value = '';
      sponsorLogoBase64 = null;
      sponsorLogoMime = '';
      sponsorLogoFilename = '';
      var fileInput = document.getElementById('sponsor-logo-file');
      if (fileInput) fileInput.value = '';
    }

    main.innerHTML =
      '<div class="space-y-6">' +
      sponsorshipBackLinkHtml() +
      '<p id="sponsor-status" class="text-sm text-slate-500">Loading ad placement from Supabase…</p>' +
      '<div class="grid lg:grid-cols-2 gap-6 min-w-0">' +
      '<form id="sponsor-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 min-w-0">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">' +
      esc(slotDefaults().label) +
      '</p>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="sponsor-active" class="rounded border-slate-300" checked> ' +
      'Ad active (uncheck to hide this placement on site)</label>' +
      '<div id="sponsor-required-panel" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">What you need</p>' +
      '<p id="sponsor-required-copy" class="text-sm text-slate-700"></p></div>' +
      '<div id="city-partner-subscription-meta" class="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm space-y-1"></div>' +
      '<div id="sponsor-placement-term-fields" class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Placement term</p>' +
      '<div id="city-partner-email-wrap" class="hidden">' +
      '<label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-slot-email">Billing / hold email</label>' +
      '<input type="email" id="sponsor-slot-email" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="sponsor@company.com" autocomplete="off">' +
      '</div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-slot-available-from">Placement ends (UTC)</label>' +
      '<input type="datetime-local" id="sponsor-slot-available-from" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<div class="flex flex-wrap gap-2 mt-2" id="sponsor-placement-presets">' +
      '<button type="button" class="sponsor-placement-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="1">+1 month</button>' +
      '<button type="button" class="sponsor-placement-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="3">+3 months</button>' +
      '<button type="button" class="sponsor-placement-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="6">+6 months</button>' +
      '<button type="button" class="sponsor-placement-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="12">+12 months</button>' +
      '<button type="button" class="sponsor-placement-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="0">Clear</button>' +
      '</div>' +
      '<p class="text-xs text-slate-500 mt-1">Leave blank for no automatic end. After this date the placement stops showing and the slot shows as available again. City Partner Stripe subscriptions update this automatically.</p></div>' +
      '</div>' +
      '<label id="sponsor-include-emails-wrap" class="hidden items-start gap-2 text-sm text-slate-700 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3">' +
      '<input type="checkbox" id="sponsor-include-emails" class="rounded border-slate-300 mt-0.5" checked> ' +
      '<span><strong>Include this sponsor in matching emails</strong><span id="sponsor-email-scope" class="block text-xs text-slate-500 mt-0.5"></span></span></label>' +
      '<p id="sponsor-hero-logo-only-note" class="hidden text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">' +
      'With a logo uploaded, the live hero shows a large clickable logo only — no button or button colour. The website link below is used when visitors click the logo.</p>' +
      '<div id="sponsor-hero-fields" class="space-y-5">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-company">Company name <span class="font-normal text-slate-400">(optional)</span></label>' +
      '<input type="text" id="sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Acme Ltd"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-tagline">Tagline / offer</label>' +
      '<input type="text" id="sponsor-tagline" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().tagline) +
      '"></div></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-logo-url">Company logo <span class="text-brand-700">*</span></label>' +
      '<input type="text" id="sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2" placeholder="https://…">' +
      '<label class="block text-xs text-slate-500 mb-1" for="sponsor-logo-file">Or upload logo (max 2MB, wide format recommended)</label>' +
      '<input type="file" id="sponsor-logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="block w-full text-sm text-slate-600"></div>' +
      '<label class="flex items-start gap-2 text-sm text-slate-700 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">' +
      '<input type="checkbox" id="sponsor-logo-band-dark" class="rounded border-slate-300 mt-0.5"> ' +
      '<span><strong>Use dark logo band</strong><span class="block text-xs text-slate-500 mt-0.5">For logos with white or light artwork. The website also auto-detects this; emails always use a dark pad so light logos stay visible.</span></span></label>' +
      '<div class="grid sm:grid-cols-2 gap-4" id="sponsor-cta-fields">' +
      '<div id="sponsor-cta-label-wrap"><label id="sponsor-cta-label-label" class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-label">CTA button label <span class="text-brand-700">*</span></label>' +
      '<input type="text" id="sponsor-cta-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaLabel) +
      '"></div>' +
      '<div id="sponsor-cta-color-wrap"><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-color-hex">CTA button colour (Hex) <span class="text-brand-700">*</span></label>' +
      '<div class="flex items-center gap-2">' +
      '<span id="sponsor-cta-color-swatch" class="h-10 w-14 shrink-0 rounded border border-slate-200" style="background:' +
      esc(slotDefaults().ctaColor || defaultSponsorCtaColor()) +
      '" title="Current CTA button colour"></span>' +
      '<input type="text" id="sponsor-cta-color-hex" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono" value="' +
      esc(slotDefaults().ctaColor || defaultSponsorCtaColor()) +
      '" placeholder="#2d2636" maxlength="7" spellcheck="false" inputmode="text" autocomplete="off">' +
      '</div>' +
      '<p class="text-xs text-slate-500 mt-1">Picked automatically from the logo — type a Hex code (e.g. #2d2636) to override.</p></div></div>' +
      '<div><label id="sponsor-cta-url-label" class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-url">Website link <span class="text-brand-700">*</span></label>' +
      '<input type="text" id="sponsor-cta-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaUrl) +
      '" placeholder="https://example.com"></div>' +
      '<div class="flex flex-wrap gap-3 pt-2">' +
      '<button type="button" id="sponsor-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Update preview</button>' +
      '<button type="button" id="sponsor-publish-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save sponsor</button>' +
      '</div></form>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-w-0">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="sponsor-preview-hint" class="text-xs text-slate-500 mb-4">Logo, tagline, and CTA — matches the browse page Powered by hero block.</p>' +
      '<div id="sponsor-preview" class="max-w-md"></div>' +
      '</section></div></div>';

    function setSponsorStatus(text, tone) {
      var el = document.getElementById('sponsor-status');
      if (!el) return;
      el.textContent = text;
      el.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function readForm() {
      var d = slotDefaults();
      var activeEl = document.getElementById('sponsor-active');
      var includeEmailsEl = document.getElementById('sponsor-include-emails');
      var logoBandDarkEl = document.getElementById('sponsor-logo-band-dark');
      var logoUrl = document.getElementById('sponsor-logo-url').value.trim();
      if (sponsorLogoBase64) logoUrl = sponsorLogoBase64;
      return {
        active: activeEl ? activeEl.checked : true,
        includeInEmails: includeEmailsEl ? includeEmailsEl.checked : false,
        logoBandDark: logoBandDarkEl ? logoBandDarkEl.checked : false,
        companyName: document.getElementById('sponsor-company').value.trim(),
        logoUrl: logoUrl,
        tagline: document.getElementById('sponsor-tagline').value.trim(),
        ctaLabel: document.getElementById('sponsor-cta-label').value.trim() || d.ctaLabel,
        ctaColor: readSponsorCtaColor(),
        ctaUrl: document.getElementById('sponsor-cta-url').value.trim() || d.ctaUrl,
      };
    }

    function applyPreviewCtaColor(root, color) {
      if (!root || !window.CmsSponsorFields) return;
      var cta = root.querySelector('[data-sponsor-preview-cta]');
      if (cta) window.CmsSponsorFields.applyCtaColor(cta, color);
    }

    function creativeToBlock(active) {
      var creative = readForm();
      return {
        active: active !== false && creative.active !== false,
        company_name: creative.companyName,
        title: creative.tagline,
        subtitle: creative.tagline,
        logo_url: creative.logoUrl,
        cta_label: creative.ctaLabel,
        cta_url: creative.ctaUrl,
        cta_color: creative.ctaColor,
        logo_band_dark: creative.logoBandDark === true,
        body: '',
      };
    }

    function syncHeroLogoOnlyFields() {
      var slot = slotDefaults();
      if (slot.preview !== 'hero') return;
      var creative = readForm();
      var hasLogo = /^(https?:|\/|data:image\/)/i.test(String(creative.logoUrl || '').trim());
      var heroFields = document.getElementById('sponsor-hero-fields');
      var ctaFields = document.getElementById('sponsor-cta-fields');
      var logoOnlyNote = document.getElementById('sponsor-hero-logo-only-note');
      var ctaUrlLabel = document.getElementById('sponsor-cta-url-label');
      var requiredCopy = document.getElementById('sponsor-required-copy');
      setAdminElHidden(heroFields, hasLogo);
      setAdminElHidden(ctaFields, hasLogo);
      if (logoOnlyNote) logoOnlyNote.classList.toggle('hidden', !hasLogo);
      if (ctaUrlLabel) {
        ctaUrlLabel.innerHTML = hasLogo
          ? 'Website link (logo click-through) <span class="text-brand-700">*</span>'
          : 'CTA link (https:// opens in a new tab, or mailto:) <span class="text-brand-700">*</span>';
      }
      if (requiredCopy) {
        requiredCopy.textContent = hasLogo
          ? 'Required: company logo and website link. Live placement is logo-only — no button label or colour.'
          : 'Required: tagline (or logo), button label, button colour, and link. Upload a logo to switch to logo-only mode.';
      }
    }

    function syncSlotFormLayout() {
      var slot = slotDefaults();
      var heroFields = document.getElementById('sponsor-hero-fields');
      var ctaUrlLabel = document.getElementById('sponsor-cta-url-label');
      var ctaLabelLabel = document.getElementById('sponsor-cta-label-label');
      var ctaFields = document.getElementById('sponsor-cta-fields');
      var ctaColorWrap = document.getElementById('sponsor-cta-color-wrap');
      var previewHint = document.getElementById('sponsor-preview-hint');
      var includeWrap = document.getElementById('sponsor-include-emails-wrap');
      var emailScope = document.getElementById('sponsor-email-scope');
      var logoOnlyNote = document.getElementById('sponsor-hero-logo-only-note');
      var slotFields = document.getElementById('sponsor-placement-term-fields');
      var cityEmailWrap = document.getElementById('city-partner-email-wrap');
      var requiredCopy = document.getElementById('sponsor-required-copy');
      var emailScopes = {
        events_sponsor_hub: 'Shown in event and attendee emails selected for sponsorship.',
        organisers_sponsor_hub: 'Shown in emails sent to networking group organisers.',
        opportunities_sponsor_hub: 'Shown in business opportunity emails.',
      };
      if (includeWrap) {
        includeWrap.classList.toggle('hidden', !emailScopes[currentSlotKey]);
        includeWrap.classList.toggle('flex', Boolean(emailScopes[currentSlotKey]));
      }
      if (emailScope) emailScope.textContent = emailScopes[currentSlotKey] || '';
      if (slotFields) {
        slotFields.classList.toggle('hidden', slot.preview === 'carousel');
      }
      if (cityEmailWrap) {
        cityEmailWrap.classList.toggle(
          'hidden',
          slot.preview !== 'city_partner' || !isCityPartnerSlotKey(currentSlotKey)
        );
      }
      if (logoOnlyNote) logoOnlyNote.classList.add('hidden');

      if (slot.preview === 'hero') {
        setAdminElHidden(heroFields, false);
        setAdminElHidden(ctaFields, false);
        setAdminElHidden(ctaColorWrap, false);
        syncHeroLogoOnlyFields();
      } else if (slot.preview === 'city_partner') {
        setAdminElHidden(heroFields, true);
        setAdminElHidden(ctaFields, true);
        setAdminElHidden(ctaColorWrap, true);
        if (ctaUrlLabel) {
          ctaUrlLabel.innerHTML =
            'Sponsor website URL (https:// — opens in a new tab) <span class="text-brand-700">*</span>';
        }
        if (requiredCopy) {
          requiredCopy.textContent = isCountyPartnerSlotKey(currentSlotKey)
            ? 'Required: company logo and website link. Live county partner block is logo + link only (no button or colour).'
            : 'Required: company logo and website link. Live city partner block is logo + link only (no button or colour).';
        }
      } else {
        // compact sidebar — logo + link only
        setAdminElHidden(heroFields, true);
        setAdminElHidden(ctaFields, true);
        setAdminElHidden(ctaColorWrap, true);
        if (ctaUrlLabel) {
          ctaUrlLabel.innerHTML =
            'Sponsor website URL (https:// — opens in a new tab) <span class="text-brand-700">*</span>';
        }
        if (requiredCopy) {
          requiredCopy.textContent =
            'Required: company logo and website link. Live sidebar is a clickable logo only (no button).';
        }
      }

      if (previewHint) {
        if (slot.preview === 'city_partner') {
          previewHint.textContent = isCountyPartnerSlotKey(currentSlotKey)
            ? 'Logo + link — matches the County Sponsor block on ' +
              countyPartnerPlacementPaths(countyPartnerSlugFromSlot(currentSlotKey)) +
              ' (not included in emails).'
            : 'Logo + link — matches the City Partner block on ' +
              cityPartnerPlacementPaths(cityPartnerSlugFromSlot(currentSlotKey)) +
              ' (not included in emails).';
        } else {
          previewHint.textContent =
            slot.preview === 'compact'
              ? 'Clickable logo only — matches ' + slot.label.toLowerCase() + '.'
              : 'Matches ' +
                slot.label.toLowerCase() +
                '. Upload a logo for logo-only hero, or leave the logo empty to show tagline and CTA.';
        }
      }
    }

    function renderCityPartnerPreview(el, creative, inactive) {
      if (!el) return;
      var block = {
        active: true,
        logo_url: creative.logoUrl,
        cta_label: creative.ctaLabel,
        cta_url: creative.ctaUrl,
        cta_color: creative.ctaColor,
        company_name: creative.companyName,
        logo_band_dark: creative.logoBandDark === true,
      };
      var inactiveNote = inactive
        ? '<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Inactive — hidden on site until <strong>Ad active</strong> is checked.</p>'
        : '';
      el.innerHTML =
        inactiveNote +
        '<div class="networking-region-city-partner admin-city-partner-preview" id="admin-city-partner-preview-shell" style="--region-accent:' +
        esc(creative.ctaColor || '#7668ce') +
        ';--region-accent-border:rgba(118,104,206,0.35)"></div>';
      var shell = document.getElementById('admin-city-partner-preview-shell');
      if (!shell || !window.CmsAdBlocks) return;
      if (window.CmsAdBlocks.renderCityPartnerAd(shell, block, currentSlotKey)) return;
      if (window.CmsAdBlocks.renderCityPartnerPlaceholder) {
        window.CmsAdBlocks.renderCityPartnerPlaceholder(shell, currentSlotKey);
      }
    }

    function renderPreview() {
      var creative = readForm();
      var el = document.getElementById('sponsor-preview');
      var slot = slotDefaults();
      if (!el) return;

      el.className = 'max-w-md';
      syncHeroLogoOnlyFields();

      if (slot.preview === 'city_partner') {
        renderCityPartnerPreview(el, creative, !creative.active);
        return;
      }

      if (!creative.active) {
        el.innerHTML =
          slot.preview === 'compact'
            ? '<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Inactive — this ad slot is hidden on site.</div>'
            : '<div class="events-hero-sponsor-slot"><div class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
              '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3">★ Powered by</div>' +
              '<p class="text-sm text-slate-500">Inactive — hidden on site until <strong>Ad active</strong> is checked. With a logo live, this placement is logo-only (no CTA button).</p></div></div>';
        return;
      }

      var block = creativeToBlock(true);

      if (slot.preview === 'compact' && window.CmsAdBlocks && window.CmsAdBlocks.renderCompactAd) {
        el.innerHTML = '';
        el.className = 'max-w-xs opportunity-detail-page';
        window.CmsAdBlocks.renderCompactAd(el, block, currentSlotKey, { showPlaceholder: true });
        return;
      }

      if (slot.preview === 'hero' && window.HubSponsorHub && window.HubSponsorHub.renderPreview) {
        el.innerHTML = '';
        el.className = 'events-hero-sponsor-slot max-w-md';
        window.HubSponsorHub.renderPreview(el, block);
        return;
      }

      var taglineHtml = sponsorHeadlineHtml(creative.tagline);
      var hasLogo = /^(https?:|\/|data:image\/)/i.test(String(creative.logoUrl || '').trim());

      if (slot.preview === 'compact' || slot.preview === 'city_partner') {
        var badge =
          slot.preview === 'city_partner'
            ? isCountyPartnerSlotKey(currentSlotKey)
              ? 'County Sponsor'
              : 'City Sponsor'
            : 'Sponsored';
        el.innerHTML =
          '<aside class="relative rounded-xl border border-slate-200 bg-white p-4 pt-8 shadow-sm max-w-xs flex flex-col gap-3">' +
          '<span class="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider text-slate-500">' +
          esc(badge) +
          '</span>' +
          sponsorPreviewLogoHtml(creative.logoUrl, true, creative.logoBandDark) +
          '</aside>';
        return;
      }

      if (hasLogo) {
        el.innerHTML =
          '<aside class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 pb-4 text-[#2d1b3d] max-w-md shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
          '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3">★ Powered by</div>' +
          sponsorPreviewLogoHtml(creative.logoUrl, false, creative.logoBandDark) +
          '</aside>';
        return;
      }

      el.innerHTML =
        '<aside class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] max-w-md shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
        '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3">★ Powered by</div>' +
        sponsorPreviewLogoHtml(creative.logoUrl, false, creative.logoBandDark) +
        (creative.companyName
          ? '<p class="text-sm font-extrabold mb-1">' + esc(creative.companyName) + '</p>'
          : '') +
        (taglineHtml ? '<p class="text-sm font-semibold leading-snug mb-4">' + taglineHtml + '</p>' : '') +
        '<span data-sponsor-preview-cta class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-sm font-bold px-4 py-2.5">' +
        esc(creative.ctaLabel) +
        '</span></aside>';
      applyPreviewCtaColor(el, creative.ctaColor);
    }

    function loadCurrentSlot() {
      setSponsorStatus('Loading ' + slotDefaults().label + '…');
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(currentSlotKey))
        .then(function (data) {
          if (data.configured === false) {
            setSponsorStatus('Supabase is not configured — showing defaults only.', 'error');
            applyDefaultsToForm();
            renderPreview();
            return;
          }
          if (data.error) {
            setSponsorStatus('Could not load ad: ' + data.error, 'error');
            return;
          }
          if (data.block) {
            applySponsorBlockToForm(data.block);
            var metaEl = document.getElementById('city-partner-subscription-meta');
            if (metaEl && isCityPartnerSlotKey(currentSlotKey)) {
              var block = data.block;
              var metaLines = [];
              if (block.sponsor_email) metaLines.push('Billing email: ' + block.sponsor_email);
              if (block.sponsor_subscription_id) {
                metaLines.push('Stripe subscription: ' + block.sponsor_subscription_id);
              }
              if (block.sponsor_available_from) {
                metaLines.push('Placement ends: ' + formatAdminDateTime(block.sponsor_available_from));
              }
              if (metaLines.length) {
                metaEl.classList.remove('hidden');
                metaEl.innerHTML =
                  '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Subscription</p>' +
                  metaLines
                    .map(function (line) {
                      return '<p class="text-slate-700 break-all">' + esc(line) + '</p>';
                    })
                    .join('');
              } else {
                metaEl.classList.add('hidden');
                metaEl.innerHTML = '';
              }
            }
            if (data.block.active === false) {
              setSponsorStatus(
                'Saved draft for ' +
                  slotDefaults().label +
                  ' — check Ad active and publish to show on site (detail pages may show a fallback until then).'
              );
            } else {
              setSponsorStatus('Loaded live creative for ' + slotDefaults().label + '.');
            }
          } else {
            applyDefaultsToForm();
            setSponsorStatus('No saved creative yet — edit below and publish.');
          }
          renderPreview();
        })
        .catch(function () {
          setSponsorStatus('Could not load ad placement.', 'error');
        });
    }

    document.getElementById('sponsor-preview-btn').addEventListener('click', renderPreview);
    document.querySelectorAll('.sponsor-placement-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById('sponsor-slot-available-from');
        setPlacementEndsMonthsFromNow(input, btn.getAttribute('data-months'));
      });
    });
    [
      'sponsor-company',
      'sponsor-logo-url',
      'sponsor-logo-band-dark',
      'sponsor-tagline',
      'sponsor-cta-label',
      'sponsor-cta-color-hex',
      'sponsor-cta-url',
      'sponsor-active',
      'sponsor-include-emails',
    ].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener('input', renderPreview);
      if (input && input.type === 'checkbox') input.addEventListener('change', renderPreview);
    });

    sponsorPreviewRerender = renderPreview;

    var sponsorCtaHexInput = document.getElementById('sponsor-cta-color-hex');
    if (sponsorCtaHexInput) {
      sponsorCtaHexInput.addEventListener('input', function () {
        sponsorCtaColorManual = true;
        var safe = sanitizeSponsorCtaColor(sponsorCtaHexInput.value);
        updateSponsorCtaColorSwatch(safe || defaultSponsorCtaColor());
      });
      sponsorCtaHexInput.addEventListener('blur', function () {
        setSponsorCtaColorFields(sponsorCtaHexInput.value);
        renderPreview();
      });
    }

    var sponsorLogoUrlInput = document.getElementById('sponsor-logo-url');
    if (sponsorLogoUrlInput) {
      sponsorLogoUrlInput.addEventListener('change', function () {
        var url = sponsorLogoUrlInput.value.trim();
        if (/^(https?:|\/|data:image\/)/i.test(url)) autoFillSponsorCtaColorFromLogo(url);
      });
    }

    document.getElementById('sponsor-logo-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setSponsorStatus('Logo must be under 2MB.', 'error');
        ev.target.value = '';
        return;
      }
      sponsorLogoMime = file.type || 'image/jpeg';
      sponsorLogoFilename = file.name || 'logo.jpg';
      var reader = new FileReader();
      reader.onload = function () {
        sponsorLogoBase64 = String(reader.result || '');
        document.getElementById('sponsor-logo-url').value = '';
        autoFillSponsorCtaColorFromLogo(sponsorLogoBase64);
        renderPreview();
      };
      reader.readAsDataURL(file);
    });

    syncSlotFormLayout();

    document.getElementById('sponsor-publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('sponsor-publish-btn');
      var creative = readForm();
      var slot = slotDefaults();
      var hasLogo = /^(https?:|\/|data:image\/)/i.test(String(creative.logoUrl || '').trim());
      var logoOnlyHero = slot.preview === 'hero' && hasLogo;
      var logoOnlyPlacement =
        logoOnlyHero || slot.preview === 'city_partner' || slot.preview === 'compact';

      if (
        creative.active &&
        slot.preview === 'hero' &&
        !creative.logoUrl &&
        !creative.tagline
      ) {
        setSponsorStatus('Add a logo or tagline before publishing an active hero ad.', 'error');
        return;
      }
      if (
        creative.active &&
        slot.preview === 'city_partner' &&
        !creative.logoUrl
      ) {
        setSponsorStatus(
          isCountyPartnerSlotKey(currentSlotKey)
            ? 'Upload or paste a logo before publishing an active county partner ad.'
            : 'Upload or paste a logo before publishing an active city partner ad.',
          'error'
        );
        return;
      }
      if (
        creative.active &&
        slot.preview === 'compact' &&
        !creative.logoUrl
      ) {
        setSponsorStatus('Upload or paste a logo before publishing an active sidebar ad.', 'error');
        return;
      }
      if (creative.active && logoOnlyPlacement) {
        if (!sponsorHasValidWebsiteUrl(creative.ctaUrl)) {
          setSponsorStatus(
            'Enter the full website URL (https://example.com) used when visitors click the logo.',
            'error'
          );
          return;
        }
      } else if (creative.active && (!creative.ctaLabel || !creative.ctaUrl)) {
        setSponsorStatus('Button label and link are required for an active ad.', 'error');
        return;
      }

      if (btn) btn.disabled = true;
      setSponsorStatus('Publishing…');

      var payload = {
        slot: currentSlotKey,
        title:
          slot.preview === 'compact' || slot.preview === 'city_partner' ? '' : creative.tagline,
        body: '',
        cta_label:
          slot.preview === 'compact' || slot.preview === 'city_partner' ? '' : creative.ctaLabel,
        cta_url: creative.ctaUrl,
        cta_color:
          slot.preview === 'compact' || slot.preview === 'city_partner' ? '' : creative.ctaColor,
        company_name:
          slot.preview === 'compact' || slot.preview === 'city_partner' ? '' : creative.companyName,
        logo_url: sponsorLogoBase64 ? '' : document.getElementById('sponsor-logo-url').value.trim(),
        logo_band_dark: creative.logoBandDark === true,
        active: creative.active,
        include_in_emails: slot.preview === 'city_partner' ? false : creative.includeInEmails,
      };
      if (sponsorLogoBase64) {
        payload.logoBase64 = sponsorLogoBase64;
        payload.logoMime = sponsorLogoMime;
        payload.logoFilename = sponsorLogoFilename;
      }
      if (slot.preview === 'city_partner' && isCityPartnerSlotKey(currentSlotKey)) {
        var slotEmailEl = document.getElementById('sponsor-slot-email');
        payload.sponsor_email = slotEmailEl ? slotEmailEl.value.trim() : '';
      }
      var slotOpensEl = document.getElementById('sponsor-slot-available-from');
      if (slotOpensEl) {
        payload.sponsor_available_from = datetimeLocalUtcToIso(slotOpensEl.value);
      }

      fetch('/api/admin/sponsor', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              throw new Error(data.message || data.error || 'Publish failed (' + r.status + ')');
            }
            return data;
          });
        })
        .then(function (data) {
          sponsorLogoBase64 = null;
          sponsorLogoMime = '';
          sponsorLogoFilename = '';
          var fileInput = document.getElementById('sponsor-logo-file');
          if (fileInput) fileInput.value = '';
          if (data.block) applySponsorBlockToForm(data.block);
          setSponsorStatus(
            creative.active
              ? 'Published — live for ' + slot.label + '.'
              : 'Saved — this ad slot is hidden on site.',
            'ok'
          );
          renderPreview();
        })
        .catch(function (err) {
          setSponsorStatus(err.message || 'Could not publish Powered by hero.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    renderPreview();
    loadCurrentSlot();
  }

  function initHomePartnersAdmin() {
    var listEl = document.getElementById('home-partners-list');
    var statusEl = document.getElementById('home-partners-status');
    var activeEl = document.getElementById('home-partners-active');
    var addBtn = document.getElementById('home-partners-add');
    var saveBtn = document.getElementById('home-partners-save');
    if (!listEl || !saveBtn) return;

    var partnersState = [];
    var pendingLogos = {};

    function setPartnersStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function newPartnerId() {
      return 'partner_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    function partnerRowHtml(p, index) {
      var logo = p.logo_url || '';
      var pending = pendingLogos[p.id];
      if (pending && pending.preview) logo = pending.preview;
      return (
        '<div class="rounded-xl border border-slate-200 p-4 space-y-3 min-w-0" data-partner-id="' +
        attrEsc(p.id) +
        '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<p class="text-sm font-semibold text-brand-900">Company ' +
        (index + 1) +
        '</p>' +
        '<div class="flex items-center gap-3">' +
        '<label class="flex items-center gap-2 text-xs text-slate-600">' +
        '<input type="checkbox" class="home-partner-active rounded border-slate-300"' +
        (p.active !== false ? ' checked' : '') +
        '> Active</label>' +
        '<label class="flex items-center gap-2 text-xs text-slate-600" title="For white or light logos">' +
        '<input type="checkbox" class="home-partner-logo-dark rounded border-slate-300"' +
        (p.logo_band_dark === true ? ' checked' : '') +
        '> Dark logo band</label>' +
        '<button type="button" class="home-partner-remove text-xs font-semibold text-red-700 hover:underline">Remove</button>' +
        '</div></div>' +
        '<div class="grid sm:grid-cols-2 gap-3">' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Company name <span class="text-brand-700">*</span></label>' +
        '<input type="text" class="home-partner-name w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(p.company_name || '') +
        '" placeholder="Acme Ltd"></div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Logo <span class="text-brand-700">*</span></label>' +
        '<input type="text" class="home-partner-logo-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(pending ? '' : logo) +
        '" placeholder="https://…"></div></div>' +
        '<div><label class="block text-xs text-slate-500 mb-1">Or upload logo (max 2MB)</label>' +
        '<input type="file" class="home-partner-logo-file block w-full text-sm text-slate-600" accept="image/png,image/jpeg,image/webp,image/gif">' +
        (logo
          ? '<img src="' +
            attrEsc(logo) +
            '" alt="" class="mt-2 max-h-12 max-w-[160px] object-contain rounded border border-slate-100 p-1' +
            (p.logo_band_dark === true ? ' bg-slate-900' : ' bg-white') +
            '" />'
          : '') +
        '</div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Website link <span class="text-brand-700">*</span></label>' +
        '<input type="text" class="home-partner-cta-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(p.cta_url || '') +
        '" placeholder="https://… or mailto:…"></div>' +
        '<p class="text-xs text-slate-500">Live home page shows a clickable logo only — no separate CTA button. Tick <strong>Dark logo band</strong> for white/light logos (e.g. Barnsgate).</p></div>'
      );
    }

    function readPartnersFromDom() {
      var rows = listEl.querySelectorAll('[data-partner-id]');
      var out = [];
      rows.forEach(function (row) {
        var id = row.getAttribute('data-partner-id') || newPartnerId();
        var nameEl = row.querySelector('.home-partner-name');
        var logoUrlEl = row.querySelector('.home-partner-logo-url');
        var ctaUrlEl = row.querySelector('.home-partner-cta-url');
        var activeCheckbox = row.querySelector('.home-partner-active');
        var darkCheckbox = row.querySelector('.home-partner-logo-dark');
        var existing = partnersState.find(function (p) {
          return p.id === id;
        });
        var logoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';
        if (!logoUrl && existing && existing.logo_url) logoUrl = existing.logo_url;
        if (!logoUrl && pendingLogos[id] && pendingLogos[id].existing) logoUrl = pendingLogos[id].existing;
        var companyName = nameEl ? nameEl.value.trim() : '';
        out.push({
          id: id,
          company_name: companyName,
          logo_url: logoUrl,
          cta_label: companyName || 'Visit website',
          cta_url: ctaUrlEl ? ctaUrlEl.value.trim() : '',
          active: activeCheckbox ? activeCheckbox.checked : true,
          logo_band_dark: darkCheckbox ? darkCheckbox.checked : false,
        });
      });
      return out;
    }

    function renderPartnerList() {
      if (!partnersState.length) {
        listEl.innerHTML =
          '<p class="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-4">No partners yet — click <strong>Add company</strong> to create your first logo.</p>';
        return;
      }
      listEl.innerHTML = partnersState.map(partnerRowHtml).join('');
    }

    function loadPartners() {
      setPartnersStatus('Loading home page partners…');
      adminGet('/api/admin/home-partners')
        .then(function (data) {
          if (!data || data.error || data.configured === false) {
            setPartnersStatus('Could not load partners.', 'error');
            return;
          }
          partnersState = Array.isArray(data.partners) ? data.partners : [];
          if (activeEl) activeEl.checked = data.active !== false;
          renderPartnerList();
          setPartnersStatus(
            partnersState.length
              ? partnersState.length + ' partner' + (partnersState.length === 1 ? '' : 's') + ' saved.'
              : 'No partners saved yet — add companies below.'
          );
        })
        .catch(function () {
          setPartnersStatus('Could not load partners.', 'error');
        });
    }

    listEl.addEventListener('click', function (ev) {
      var removeBtn = ev.target.closest('.home-partner-remove');
      if (!removeBtn) return;
      var row = removeBtn.closest('[data-partner-id]');
      if (!row) return;
      var id = row.getAttribute('data-partner-id');
      partnersState = readPartnersFromDom().filter(function (p) {
        return p.id !== id;
      });
      delete pendingLogos[id];
      renderPartnerList();
    });

    listEl.addEventListener('change', function (ev) {
      var fileInput = ev.target.closest('.home-partner-logo-file');
      if (!fileInput) return;
      var row = fileInput.closest('[data-partner-id]');
      if (!row) return;
      var id = row.getAttribute('data-partner-id');
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setPartnersStatus('Logo must be under 2MB.', 'error');
        fileInput.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        partnersState = readPartnersFromDom();
        var existing = partnersState.find(function (p) {
          return p.id === id;
        });
        pendingLogos[id] = {
          preview: String(reader.result || ''),
          data: String(reader.result || ''),
          mime: file.type || 'image/jpeg',
          filename: file.name || 'logo.jpg',
          existing: existing ? existing.logo_url : '',
        };
        renderPartnerList();
      };
      reader.readAsDataURL(file);
    });

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        partnersState = readPartnersFromDom();
        partnersState.push({
          id: newPartnerId(),
          company_name: '',
          logo_url: '',
          cta_label: 'Visit website',
          cta_url: '',
          active: true,
          logo_band_dark: false,
        });
        renderPartnerList();
      });
    }

    saveBtn.addEventListener('click', function () {
      var partners = readPartnersFromDom();
      saveBtn.disabled = true;
      setPartnersStatus('Saving…');

      var payload = {
        active: activeEl ? activeEl.checked : true,
        partners: partners.map(function (p) {
          var pending = pendingLogos[p.id];
          var item = {
            id: p.id,
            company_name: p.company_name,
            logo_url: p.logo_url,
            cta_label: p.cta_label,
            cta_url: p.cta_url,
            active: p.active,
            logo_band_dark: p.logo_band_dark === true,
          };
          if (pending && pending.data) {
            item.logoBase64 = pending.data;
            item.logoMime = pending.mime;
            item.logoFilename = pending.filename;
          }
          return item;
        }),
      };

      fetch('/api/admin/home-partners', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              var code = data.error || '';
              if (code === 'missing_partner_link' || code === 'missing_partner_cta') {
                throw new Error(
                  'Add a website link (https://…) for ' +
                    (data.partner || 'each active partner') +
                    '.'
                );
              }
              if (code === 'missing_partner_logo') {
                throw new Error('Add a logo for ' + (data.partner || 'each active partner') + '.');
              }
              if (code === 'missing_company_name') {
                throw new Error('Add a company name for each active partner.');
              }
              throw new Error(data.message || data.error || 'Save failed');
            }
            return data;
          });
        })
        .then(function (data) {
          pendingLogos = {};
          partnersState = Array.isArray(data.partners) ? data.partners : [];
          renderPartnerList();
          setPartnersStatus('Saved — home page partners updated.', 'ok');
        })
        .catch(function (err) {
          setPartnersStatus(err.message || 'Could not save partners.', 'error');
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });

    loadPartners();
  }

  function renderEventCarouselPage(slotKey) {
    var slot = cmsSlotByKey(slotKey || 'event_page_carousel_ads');
    var detailText =
      slot.key === 'organiser_page_carousel_ads'
        ? 'Three Mini Sponsor slots on organiser profile pages and selected organiser emails (one Page Partner inventory; separate from Event Page Partner).'
        : slot.key === 'opportunity_page_carousel_ads'
          ? 'Three Mini Sponsor slots on opportunity detail pages and selected opportunity emails (one Page Partner inventory; separate from Event and Organiser Page Partner).'
          : 'Three Mini Sponsor slots on event detail pages and selected event/attendee emails (one Page Partner inventory).';
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      sponsorshipBackLinkHtml() +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5" id="event-carousel-admin">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">' +
      esc(slot.label) +
      '</h3>' +
      '<p class="text-sm text-slate-600 mt-1">' +
      esc(detailText) +
      ' Each active logo links to the sponsor website.</p></div></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="event-carousel-active" class="rounded border-slate-300" checked> ' +
      'Mini sponsors active (uncheck to hide all three)</label>' +
      '<div id="event-carousel-list" class="space-y-4 min-w-0"></div>' +
      '<div class="flex flex-wrap gap-3 pt-1">' +
      '<button type="button" id="event-carousel-save" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save mini sponsors</button>' +
      '</div>' +
      '<p id="event-carousel-status" class="text-sm text-slate-500"></p></section></div>';
    initEventCarouselAdmin(slot.key);
  }

  function initEventCarouselAdmin(slotKey) {
    var listEl = document.getElementById('event-carousel-list');
    var statusEl = document.getElementById('event-carousel-status');
    var activeEl = document.getElementById('event-carousel-active');
    var saveBtn = document.getElementById('event-carousel-save');
    if (!listEl || !saveBtn) return;

    var adsState = [];
    var pendingLogos = {};
    var CAROUSEL_SIZE = 3;

    function setCarouselStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function defaultAds() {
      var prefix = 'event_carousel_';
      if (slotKey === 'organiser_page_carousel_ads') prefix = 'organiser_carousel_';
      else if (slotKey === 'opportunity_page_carousel_ads') prefix = 'opportunity_carousel_';
      var out = [];
      for (var i = 0; i < CAROUSEL_SIZE; i++) {
        out.push({
          id: prefix + (i + 1),
          slot_index: i,
          logo_url: '',
          cta_url: '',
          active: false,
        });
      }
      return out;
    }

    function adRowHtml(ad, index) {
      var logo = ad.logo_url || '';
      var pending = pendingLogos[ad.id];
      if (pending && pending.preview) logo = pending.preview;
      return (
        '<div class="rounded-xl border border-slate-200 p-4 space-y-3 min-w-0" data-carousel-ad-id="' +
        attrEsc(ad.id) +
        '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<p class="text-sm font-semibold text-brand-900">Ad slot ' +
        (index + 1) +
        '</p>' +
        '<label class="flex items-center gap-2 text-xs text-slate-600">' +
        '<input type="checkbox" class="event-carousel-ad-active rounded border-slate-300"' +
        (ad.active !== false ? ' checked' : '') +
        '> Active</label></div>' +
        '<p class="text-xs text-slate-500">Required for an active slot: logo + click-through link.</p>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Logo <span class="text-brand-700">*</span></label>' +
        '<input type="text" class="event-carousel-ad-logo-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(pending ? '' : logo) +
        '" placeholder="https://…"></div>' +
        '<div><label class="block text-xs text-slate-500 mb-1">Or upload logo (max 2MB)</label>' +
        '<input type="file" class="event-carousel-ad-logo-file block w-full text-sm text-slate-600" accept="image/png,image/jpeg,image/webp,image/gif">' +
        (logo
          ? '<img src="' + attrEsc(logo) + '" alt="" class="mt-2 max-h-12 max-w-[160px] object-contain rounded border border-slate-100 bg-white p-1" />'
          : '') +
        '</div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Click-through link <span class="text-brand-700">*</span></label>' +
        '<input type="text" class="event-carousel-ad-link-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(ad.cta_url || '') +
        '" placeholder="https://… — opens when someone clicks the logo"></div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Placement ends (UTC)</label>' +
        '<input type="datetime-local" class="event-carousel-ad-ends-at w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(isoToDatetimeLocalUtc(ad.ends_at)) +
        '">' +
        '<div class="flex flex-wrap gap-2 mt-2">' +
        '<button type="button" class="event-carousel-ends-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="1">+1 mo</button>' +
        '<button type="button" class="event-carousel-ends-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="3">+3 mo</button>' +
        '<button type="button" class="event-carousel-ends-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="6">+6 mo</button>' +
        '<button type="button" class="event-carousel-ends-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="12">+12 mo</button>' +
        '<button type="button" class="event-carousel-ends-preset rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-months="0">Clear</button>' +
        '</div>' +
        '<p class="text-xs text-slate-500 mt-1">Leave blank for no automatic end. After this date the mini sponsor stops showing.</p></div></div>'
      );
    }

    function readAdsFromDom() {
      var rows = listEl.querySelectorAll('[data-carousel-ad-id]');
      var out = [];
      rows.forEach(function (row, index) {
        var id = row.getAttribute('data-carousel-ad-id') || 'event_carousel_' + (index + 1);
        var logoUrlEl = row.querySelector('.event-carousel-ad-logo-url');
        var linkUrlEl = row.querySelector('.event-carousel-ad-link-url');
        var endsAtEl = row.querySelector('.event-carousel-ad-ends-at');
        var activeCheckbox = row.querySelector('.event-carousel-ad-active');
        var existing = adsState.find(function (ad) {
          return ad.id === id;
        });
        var logoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';
        if (!logoUrl && existing && existing.logo_url) logoUrl = existing.logo_url;
        if (!logoUrl && pendingLogos[id] && pendingLogos[id].existing) logoUrl = pendingLogos[id].existing;
        out.push({
          id: id,
          slot_index: index,
          logo_url: logoUrl,
          cta_url: linkUrlEl ? linkUrlEl.value.trim() : '',
          active: activeCheckbox ? activeCheckbox.checked : false,
          ends_at: endsAtEl ? datetimeLocalUtcToIso(endsAtEl.value) : null,
        });
      });
      return out;
    }

    function renderAdList() {
      listEl.innerHTML = adsState.map(adRowHtml).join('');
    }

    function loadCarousel() {
      setCarouselStatus('Loading mini sponsors…');
      adminGet('/api/admin/event-carousel?slot=' + encodeURIComponent(slotKey))
        .then(function (data) {
          if (!data || data.error || data.configured === false) {
            adsState = defaultAds();
            if (activeEl) activeEl.checked = true;
            renderAdList();
            setCarouselStatus('Could not load carousel — showing empty slots.', 'error');
            return;
          }
          adsState = Array.isArray(data.ads) && data.ads.length ? data.ads : defaultAds();
          if (activeEl) activeEl.checked = data.active !== false;
          renderAdList();
          var liveCount = adsState.filter(function (ad) {
            return ad.active !== false && ad.logo_url && ad.cta_url;
          }).length;
          setCarouselStatus(
            liveCount
              ? liveCount + ' active ad' + (liveCount === 1 ? '' : 's') + ' in carousel.'
              : data.active === false
                ? 'Mini sponsors are hidden — tick “Mini sponsors active” above, add logo + link per slot, then save.'
                : 'No active ads yet — add a logo and click-through link for each slot you want live, then save.'
          );
        })
        .catch(function () {
          adsState = defaultAds();
          renderAdList();
          setCarouselStatus('Could not load carousel.', 'error');
        });
    }

    listEl.addEventListener('click', function (ev) {
      var preset = ev.target.closest('.event-carousel-ends-preset');
      if (!preset) return;
      var row = preset.closest('[data-carousel-ad-id]');
      if (!row) return;
      var input = row.querySelector('.event-carousel-ad-ends-at');
      setPlacementEndsMonthsFromNow(input, preset.getAttribute('data-months'));
    });

    listEl.addEventListener('change', function (ev) {
      var fileInput = ev.target.closest('.event-carousel-ad-logo-file');
      if (fileInput) {
        var row = fileInput.closest('[data-carousel-ad-id]');
        if (!row) return;
        var id = row.getAttribute('data-carousel-ad-id');
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setCarouselStatus('Logo must be under 2MB.', 'error');
          fileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          adsState = readAdsFromDom();
          var existing = adsState.find(function (ad) {
            return ad.id === id;
          });
          pendingLogos[id] = {
            preview: String(reader.result || ''),
            data: String(reader.result || ''),
            mime: file.type || 'image/jpeg',
            filename: file.name || 'logo.jpg',
            existing: existing ? existing.logo_url : '',
          };
          renderAdList();
        };
        reader.readAsDataURL(file);
      }
    });

    saveBtn.addEventListener('click', function () {
      var ads = readAdsFromDom();
      saveBtn.disabled = true;
      setCarouselStatus('Saving…');

      var payload = {
        active: activeEl ? activeEl.checked : true,
        ads: ads.map(function (ad) {
          var pending = pendingLogos[ad.id];
          var item = {
            id: ad.id,
            slot_index: ad.slot_index,
            logo_url: ad.logo_url,
            cta_url: ad.cta_url,
            active: ad.active,
          };
          if (pending && pending.data) {
            item.logoBase64 = pending.data;
            item.logoMime = pending.mime;
            item.logoFilename = pending.filename;
          }
          return item;
        }),
      };

      fetch('/api/admin/event-carousel?slot=' + encodeURIComponent(slotKey), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              var msg = data.message || data.error || 'Save failed';
              if (data.error === 'missing_carousel_logo') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a logo.';
              } else if (data.error === 'missing_carousel_link') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a valid click-through link.';
              } else if (data.error === 'missing_carousel_cta') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a valid click-through link.';
              }
              throw new Error(msg);
            }
            return data;
          });
        })
        .then(function (data) {
          pendingLogos = {};
          adsState = Array.isArray(data.ads) ? data.ads : defaultAds();
          if (activeEl) activeEl.checked = data.active !== false;
          renderAdList();
          setCarouselStatus('Saved — mini sponsors updated.', 'ok');
        })
        .catch(function (err) {
          setCarouselStatus(err.message || 'Could not save carousel.', 'error');
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });

    loadCarousel();
  }

  function replaceEmailPlaceholders(text, variables) {
    var vars = variables && typeof variables === 'object' ? variables : {};
    return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (match, key) {
      if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
      var val = vars[key];
      if (val == null) return '';
      return String(val);
    });
  }

  function renderEmails() {
    var templates = [];
    var testRecipients = [];
    var selectedSlug = '';
    var dirty = false;
    var emailSponsorLogoBase64 = null;
    var emailSponsorLogoMime = '';
    var emailSponsorLogoFilename = '';
    var emailSponsorCtaColor = '';
    var BOOKING_EMAIL_SPONSOR_SLOT = 'booking_email_sponsor';
    var EVENTS_SPONSOR_SLOT = 'events_sponsor_hub';
    var previewOrigin = (function () {
      var origin = window.location.origin || '';
      // Email previews must never link to localhost — use the public Hub.
      if (!origin || /localhost|127\.0\.0\.1/i.test(origin)) {
        return 'https://www.thenetworkerhub.com';
      }
      return origin;
    })();

    var SAMPLE_VARS = {
      user_name: 'Alex Morgan',
      user_email: 'alex@example.com',
      event_name: 'London Founders Breakfast',
      event_date: 'Tuesday 12 August 2026',
      event_time: '8:00 AM',
      event_location: 'The Shard, London SE1',
      event_url: previewOrigin + '/events/london-founders-breakfast',
      ticket_name: 'General admission',
      amount_paid: '£25.00',
      payment_status: 'Paid',
      registration_id: '00000000-0000-4000-8000-000000000001',
      booking_reference: 'HUB-00000000',
      booked_at: 'Tuesday 10 June 2026 at 2:30 pm',
      ticket_quantity: 1,
      ticket_quantity_label: '1 × General admission',
      hub_account_url: previewOrigin + '/account/',
      hub_payment_url:
        previewOrigin +
        '/account/?booking=00000000-0000-4000-8000-000000000001#payments',
      browse_events_url: previewOrigin + '/events/',
      contact_url: previewOrigin + '/contact',
      privacy_url: previewOrigin + '/legal-policies#privacy',
      terms_url: previewOrigin + '/legal-policies#terms',
      hub_rules_url: previewOrigin + '/legal-policies#hub-rules',
      refunds_url: previewOrigin + '/legal-policies#refunds',
      payment_summary_row: '',
      organiser_name: 'City Connectors',
      meeting_link: '',
      meeting_type: 'In person',
      refund_policy: 'full_refund',
      refund_policy_details: '',
      refund_cutoff_days: 7,
      event_meta_rows: '',
      meeting_link_row: '',
      refund_policy_row: '',
      sponsor_row: '',
      attendee_name: 'Alex Morgan',
      attendee_email: 'alex@example.com',
      attendee_initial: 'A',
      booking_time: 'Tuesday 10 June 2026 at 2:30 pm',
      tickets_sold: '24',
      tickets_remaining: '16',
      total_revenue: '£600.00',
      welcome_url: previewOrigin + '/welcome',
      dashboard_url: previewOrigin + '/organiser/',
      site_url: previewOrigin,
      logo_url: previewOrigin + '/assets/logo-nav-transparent.png?v=20260805footer',
      logo_footer_url: previewOrigin + '/assets/logo-email-footer.png?v=20260805footer',
      screening_industry: 'Financial services',
      screening_job_title: 'Business development manager',
      denial_closing: '',
      denial_reason_block: '',
      meeting_link_section: '',
      recommendations_html: '',
      review_url:
        previewOrigin +
        '/account/?review=sample-event-id#review/sample-event-id',
      owner_name: 'Jordan',
      opportunity_title: 'Marketing agency partnership',
      opportunity_url: previewOrigin + '/opportunities/sample',
      renew_url: previewOrigin + '/organiser/opportunity-edit?id=sample',
      edit_url: previewOrigin + '/organiser/opportunity-edit?id=sample',
      rejection_note: 'Please add more detail before resubmitting.',
      amount_net: '£240.00',
      upcoming_count: '3',
      create_event_url: previewOrigin + '/organiser/event-format',
      connect_url: previewOrigin + '/organiser/?panel=revenue',
      group_name: 'City Connectors',
      badge_label: 'Top 10 networking group on the Hub',
      period_label: 'June 2026',
      rank: '8',
      total_ranked: '42',
      average_rating: '4.8',
      review_count: '27',
      profile_url: previewOrigin + '/events/organiser?slug=city-connectors',
      social_share_text:
        'City Connectors is a Top 10 networking group on The Networker Hub for June 2026.',
      organiser_url: previewOrigin + '/events/organiser?slug=city-connectors',
      pending_applications: '2',
    };

    function previewMetaRow(label, value) {
      var text = String(value || '').trim();
      if (!text) return '';
      return (
        '<tr><td style="padding:0 0 10px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);line-height:1.5;">' +
        '<span style="color:rgba(255,255,255,0.55);">' +
        esc(label) +
        '</span><br>' +
        '<span style="color:#ffffff;font-weight:600;">' +
        esc(text) +
        '</span></td></tr>'
      );
    }

    function previewIsOnline(vars) {
      var fmt = String(vars.meeting_type || '').trim().toLowerCase();
      if (fmt.indexOf('online') !== -1) return true;
      if (fmt.indexOf('person') !== -1) return false;
      return Boolean(String(vars.meeting_link || '').trim());
    }

    function previewMeetingLinkSection(link, online) {
      var url = String(link || '').trim();
      if (!online || !url) return '';
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 24px;text-align:center;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">Join online</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.6;margin:0 0 14px;">Use the link below when the event starts.</p>' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
        '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
        '<a href="' +
        attrEsc(url) +
        '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
        '</td></tr></table></td></tr></table></td></tr>'
      );
    }

    function previewPaymentSummarySection() {
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 22px;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Payment summary</p>' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Booking reference:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.booking_reference) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Booked on:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.booked_at) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Tickets:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.ticket_quantity_label) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Total paid:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.amount_paid) +
        '</span></td></tr>' +
        '</table>' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;">' +
        '<tr><td style="background:#4a4446;border-radius:999px;">' +
        '<a href="' +
        attrEsc(SAMPLE_VARS.hub_payment_url) +
        '" style="display:inline-block;padding:9px 20px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;">View payment details &rarr;</a>' +
        '</td></tr></table>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:400;color:#9a9092;line-height:1.5;margin:12px 0 0;">Your card receipt is sent separately by our payment provider.</p>' +
        '</td></tr></table></td></tr>'
      );
    }

    function previewRefundPolicySection() {
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf7f2;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 22px;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Refund policy</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:600;color:#4a4446;margin:0 0 8px;">Full refunds available</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:#736b6e;line-height:1.65;margin:0;">Full refunds are available up to 7 days before the event.</p>' +
        '</td></tr></table></td></tr>'
      );
    }

    function isBookingEmailSlug(slug) {
      return (
        slug === 'booking_confirmation' ||
        slug === 'booking_reminder' ||
        slug === 'account_welcome' ||
        slug === 'saved_event_tickets_open' ||
        slug === 'organiser_new_registration' ||
        slug === 'organiser_new_application' ||
        slug === 'application_received' ||
        slug === 'application_approved' ||
        slug === 'application_denied'
      );
    }

    function previewDenialReasonBlock(reason) {
      var text = String(reason || '').trim();
      if (!text) return '';
      return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;">' +
        '<tr><td style="padding:16px 18px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;text-align:left;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Message from the organiser</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.65;color:#475569;margin:0;">' +
        esc(text) +
        '</p></td></tr></table>'
      );
    }

    function previewMeetingLinkButton(link) {
      var url = String(link || '').trim();
      if (!url) return '';
      return (
        '<a href="' +
        attrEsc(url) +
        '" style="display:inline-block;padding:12px 28px;background:#9a7aa8;border-radius:999px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">Join online &rarr;</a>'
      );
    }

    function previewRecommendationsHtml() {
      function card(title, subtitle, url) {
        return (
          '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:14px;margin:0 0 12px;">' +
          '<tr><td style="padding:18px 20px;">' +
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#ffffff;margin:0 0 6px;">' +
          esc(title) +
          '</p>' +
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;color:rgba(255,255,255,0.7);margin:0 0 12px;">' +
          esc(subtitle) +
          '</p>' +
          '<a href="' +
          attrEsc(url) +
          '" style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;color:#4aa8f0;text-decoration:none;">View &rarr;</a>' +
          '</td></tr></table>'
        );
      }
      return (
        card(
          'London Founders Breakfast',
          'City Connectors · Tuesday 12 August 2026 · The Shard, London',
          SAMPLE_VARS.event_url
        ) +
        card('Tech Leaders Lunch', 'Northbridge Network · Thursday 14 August 2026 · Manchester', SAMPLE_VARS.browse_events_url)
      );
    }

    function applyPreviewEventFormat() {
      var online = previewIsOnline(SAMPLE_VARS);
      var meta = '';
      meta += previewMetaRow('Date', SAMPLE_VARS.event_date);
      meta += previewMetaRow('Time', SAMPLE_VARS.event_time);
      if (online) meta += previewMetaRow('Format', 'Online event');
      else meta += previewMetaRow('Location', SAMPLE_VARS.event_location);
      SAMPLE_VARS.event_meta_rows = meta;
      SAMPLE_VARS.payment_summary_row = previewPaymentSummarySection();
      SAMPLE_VARS.meeting_link_row = previewMeetingLinkSection(
        online ? SAMPLE_VARS.meeting_link : '',
        online
      );
      SAMPLE_VARS.refund_policy_row = previewRefundPolicySection();
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewReminderFormat() {
      var online = previewIsOnline(SAMPLE_VARS);
      SAMPLE_VARS.meeting_link_row = previewMeetingLinkSection(
        online ? SAMPLE_VARS.meeting_link : '',
        online
      );
      if (online) SAMPLE_VARS.event_location = 'Online event';
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewOrganiserFormat() {
      SAMPLE_VARS.attendee_name = SAMPLE_VARS.user_name;
      SAMPLE_VARS.attendee_email = SAMPLE_VARS.user_email;
      SAMPLE_VARS.attendee_initial = String(SAMPLE_VARS.user_name || 'A').trim().charAt(0).toUpperCase() || 'A';
      SAMPLE_VARS.booking_time = SAMPLE_VARS.booked_at;
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewAccountWelcomeFormat() {
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewLifecycleFormat() {
      // Sponsors come from live CMS on the server — leave placeholders empty here.
      SAMPLE_VARS.sponsor_row = '';
      SAMPLE_VARS.sponsor_section = '';
      SAMPLE_VARS.mini_sponsors_row = '';
    }

    function applyPreviewForSlug(slug) {
      if (slug === 'booking_confirmation') applyPreviewEventFormat();
      else if (slug === 'booking_reminder') applyPreviewReminderFormat();
      else if (slug === 'organiser_new_registration' || slug === 'organiser_new_application') {
        applyPreviewOrganiserFormat();
      } else if (slug === 'account_welcome' || slug === 'saved_event_tickets_open') {
        applyPreviewAccountWelcomeFormat();
      } else if (
        slug === 'post_event_review_request' ||
        slug === 'attendee_reengagement' ||
        slug === 'attendee_signup_events_nudge' ||
        slug === 'attendee_hubert_event_concierge' ||
        slug === 'meeting_link_added' ||
        slug === 'online_join_reminder' ||
        slug === 'category_exclusivity_payment_reminder' ||
        slug === 'saved_organiser_new_listing' ||
        slug === 'password_reset'
      ) {
        applyPreviewLifecycleFormat();
      } else if (slug === 'application_denied') {
        SAMPLE_VARS.denial_closing = '';
        SAMPLE_VARS.denial_reason_block = previewDenialReasonBlock(
          'This session is focused on early-stage founders. We hope to see you at a future event.'
        );
      } else if (slug === 'meeting_link_added') {
        SAMPLE_VARS.meeting_type = 'Online';
        SAMPLE_VARS.meeting_link = SAMPLE_VARS.meeting_link || 'https://meet.example.com/london-founders';
        SAMPLE_VARS.meeting_link_section = previewMeetingLinkButton(SAMPLE_VARS.meeting_link);
      } else if (slug === 'online_join_reminder') {
        SAMPLE_VARS.meeting_type = 'Online';
        SAMPLE_VARS.meeting_link = SAMPLE_VARS.meeting_link || 'https://meet.example.com/london-founders';
        SAMPLE_VARS.meeting_link_section = previewMeetingLinkButton(SAMPLE_VARS.meeting_link);
        applyPreviewReminderFormat();
      } else if (slug === 'attendee_reengagement') {
        SAMPLE_VARS.recommendations_html = previewRecommendationsHtml();
      } else if (slug === 'attendee_signup_events_nudge') {
        SAMPLE_VARS.near_location_phrase = 'near London';
        SAMPLE_VARS.nearby_events_html =
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 12px;">Events within 25 miles of London</p>' +
          previewRecommendationsHtml();
        SAMPLE_VARS.popular_events_html =
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 12px;">Popular right now</p>' +
          previewRecommendationsHtml();
      } else if (slug === 'attendee_hubert_event_concierge') {
        SAMPLE_VARS.month_label = 'July 2026';
        SAMPLE_VARS.near_location_phrase = 'near York';
        SAMPLE_VARS.account_settings_url = previewOrigin + '/account/settings';
        SAMPLE_VARS.location_footer_html =
          'Picks based on <strong style="color:#635c5e;">York</strong>. Change your location in <a href="' +
          SAMPLE_VARS.account_settings_url +
          '" style="color:#5b2f99;font-weight:600;text-decoration:none;">account settings</a> anytime. You receive this digest because marketing emails are turned on.';
        SAMPLE_VARS.nearby_events_html =
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 12px;">Events within 25 miles of York</p>' +
          previewRecommendationsHtml();
        SAMPLE_VARS.popular_events_html =
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 12px;">Popular right now</p>' +
          previewRecommendationsHtml();
      } else if (slug === 'saved_organiser_new_listing') {
        SAMPLE_VARS.event_time = ' · ' + SAMPLE_VARS.event_time;
      }
    }

    applyPreviewForSlug('booking_confirmation');
    if (currentUser) {
      if (currentUser.name) SAMPLE_VARS.user_name = currentUser.name;
      if (currentUser.email) SAMPLE_VARS.user_email = currentUser.email;
    }

    function isLocalDevHost() {
      var host = String(window.location.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    }

    function emailActionMessage(code, fallback) {
      return hubEmailActionMessage(code, fallback);
    }

    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="email-status" class="text-sm text-slate-500">Loading email templates…</p>' +
      '<div class="grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] gap-6 min-w-0">' +
      '<aside class="admin-panel-sticky bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-w-0">' +
      '<h3 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Templates</h3>' +
      '<input type="search" id="email-template-search" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3" placeholder="Search templates…" autocomplete="off">' +
      '<ul id="email-template-list" class="space-y-1 text-sm"></ul>' +
      '</aside>' +
      '<div class="space-y-6 min-w-0">' +
      '<form id="email-editor" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 hidden min-w-0">' +
      '<div><p id="email-template-name" class="font-bold text-brand-900 text-lg"></p>' +
      '<p id="email-template-desc" class="text-sm text-slate-500 mt-1"></p>' +
      '<p id="email-template-automated" class="hidden text-xs rounded-lg bg-violet-50 text-violet-800 border border-violet-100 px-3 py-2 mt-2"></p></div>' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="email-subject">Subject line</label>' +
      '<input type="text" id="email-subject" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Your ticket for {{event_name}}"></div>' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="email-body">HTML body</label>' +
      '<textarea id="email-body" rows="14" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-xs leading-relaxed" spellcheck="false"></textarea>' +
      '<p class="text-xs text-slate-500 mt-2">Use <code class="bg-slate-100 px-1 rounded">{{placeholders}}</code> for dynamic values. Available for this template:</p>' +
      '<div id="email-placeholders" class="flex flex-wrap gap-2 mt-2"></div></div>' +
      '<div class="flex flex-wrap gap-3 pt-1">' +
      '<button type="button" id="email-save-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save template</button>' +
      '<button type="button" id="email-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh preview</button>' +
      '</div>' +
      '<div id="email-sponsor-panel" class="hidden border-t border-slate-100 pt-5 space-y-4">' +
      '<div class="space-y-2">' +
      '<h4 class="text-sm font-bold text-brand-900">Email sponsor</h4>' +
      '<p class="text-xs text-slate-500">Shown in the &ldquo;Powered by&rdquo; strip on booking confirmations, 24-hour reminders, and organiser new-booking alerts. Defaults from your <strong>Events browse</strong> sponsor — change it here without affecting the website, or pull the latest from Events.</p>' +
      '<p id="email-sponsor-status" class="text-xs text-slate-500"></p>' +
      '</div>' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-company">Company name</label>' +
      '<input type="text" id="email-sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Sponsor name"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-url">Website URL</label>' +
      '<input type="url" id="email-sponsor-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-logo-url">Logo URL</label>' +
      '<input type="url" id="email-sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://… or upload below"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-logo-file">Upload logo</label>' +
      '<input type="file" id="email-sponsor-logo-file" accept="image/*" class="w-full text-sm"></div>' +
      '</div>' +
      '<div id="email-sponsor-preview" class="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">Sponsor preview will appear here.</div>' +
      '<div class="flex flex-wrap gap-3">' +
      '<button type="button" id="email-sponsor-save-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save email sponsor</button>' +
      '<button type="button" id="email-sponsor-sync-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Pull from Events browse sponsor</button>' +
      '<a href="#sponsorship/events_sponsor_hub" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 inline-flex items-center">Edit Events sponsor</a>' +
      '</div></div>' +
      '<div class="border-t border-slate-100 pt-5 space-y-4">' +
      '<div class="space-y-3">' +
      '<h4 class="text-sm font-bold text-brand-900">Safe test recipients</h4>' +
      '<p class="text-xs text-slate-500">Only addresses on this list can receive test emails from the Command Centre.</p>' +
      '<ul id="email-test-recipient-list" class="space-y-2 text-sm"></ul>' +
      '<div class="flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[180px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-add-email">Email</label>' +
      '<input type="email" id="email-test-add-email" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="you@company.com"></div>' +
      '<div class="flex-1 min-w-[140px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-add-label">Label (optional)</label>' +
      '<input type="text" id="email-test-add-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="My inbox"></div>' +
      '<button type="button" id="email-test-add-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Add to list</button>' +
      '</div></div>' +
      '<div class="space-y-3 border-t border-slate-100 pt-4">' +
      '<h4 class="text-sm font-bold text-brand-900">Send test email</h4>' +
      '<p class="text-xs text-slate-500">Test sends use <strong>sample event and ticket data</strong> in the preview (or your name if you are signed in). When someone actually books, the email fills in their account name, the ticket they bought, the amount paid, and the event details automatically.</p>' +
      '<div class="flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[200px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-to">Recipient</label>' +
      '<select id="email-test-to" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">' +
      '<option value="">Select a safe address…</option></select></div>' +
      '<button type="button" id="email-test-btn" class="rounded-lg border border-brand-700 text-brand-700 px-4 py-2 text-sm font-semibold hover:bg-brand-50">Send test</button>' +
      '</div>' +
      '<p id="email-test-result" class="hidden text-sm rounded-lg px-3 py-2"></p>' +
      '</div></div></form>' +
      '<section id="email-preview-panel" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hidden">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="email-preview-subject" class="text-sm text-slate-600 mb-4"></p>' +
      '<iframe id="email-preview-frame" title="Email preview" class="w-full rounded-lg border border-slate-100 bg-white" style="height:min(80vh,720px);border:0;" sandbox="allow-same-origin allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>' +
      '</section></div></div></div>';

    function setEmailStatus(text, tone) {
      var el = document.getElementById('email-status');
      if (!el) return;
      el.textContent = text;
      el.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : tone === 'warn'
              ? 'text-amber-700 font-semibold'
              : 'text-slate-500');
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e) {}
    }

    function setTestResult(text, tone) {
      var el = document.getElementById('email-test-result');
      if (!el) return;
      if (!text) {
        el.className = 'hidden text-sm rounded-lg px-3 py-2';
        el.textContent = '';
        return;
      }
      el.textContent = text;
      el.className =
        'text-sm rounded-lg px-3 py-2 ' +
        (tone === 'error'
          ? 'bg-red-50 text-red-800 border border-red-100'
          : tone === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            : 'bg-slate-50 text-slate-700 border border-slate-100');
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e2) {}
    }

    function currentTemplate() {
      for (var i = 0; i < templates.length; i++) {
        if (templates[i].slug === selectedSlug) return templates[i];
      }
      return null;
    }

    var EMAIL_TEMPLATE_GROUPS = [
      { key: 'automated', label: 'Automated — sent by the Hub' },
      { key: 'attendees', label: 'Attendees' },
      { key: 'organisers', label: 'Organisers' },
      { key: 'opportunities', label: 'Business opportunities' },
    ];

    // Cron/marketing emails the Hub sends on its own schedule (no admin action needed).
    var AUTOMATED_EMAIL_INFO = {
      attendee_hubert_event_concierge:
        'Monthly digest to members with marketing emails on — nearby and popular event picks.',
      attendee_reengagement:
        'Sends after 30 days without a booking (60-day cooldown), marketing opt-in only.',
      attendee_signup_events_nudge:
        'One-off nurture 3 days after signup if no booking yet (marketing opt-in). Different from Hubert’s monthly digest.',
      saved_event_tickets_open:
        'When tickets go on sale for an event you saved. Saving an event also follows the group — new listings from that group use a separate email.',
      saved_organiser_new_listing:
        'When a saved/followed group publishes a new event (including groups auto-saved when you save one of their events).',
      saved_opportunity_closing_soon:
        'Sends when a saved business opportunity is about 7 days from expiry.',
      opportunity_saved_search_match:
        'Sends when a new listing matches a member\u2019s saved opportunity search.',
      post_event_review_request:
        'Events directory sponsor. Cron: ~24 hours after the event ends (or starts_at if no end time), to paid/free attendees who have not reviewed yet. Skips denied/cancelled. Window: events ended in the last 14 days.',
      post_event_review_reminder:
        'Events directory sponsor. Cron: 5 days after the review request if they still have not left a review.',
      password_reset:
        'Account security email for attendees, organisers, and admins (not attendee-only). Events directory sponsor under the header. Reset link expires in 15 minutes.',
    };

    var ATTENDEE_EMAIL_SLUGS = [
      'booking_confirmation',
      'booking_reminder',
      'account_welcome',
      'saved_event_tickets_open',
      'saved_organiser_new_listing',
      'online_join_reminder',
      'meeting_link_added',
      'category_exclusivity_payment_reminder',
      'application_received',
      'application_approved',
      'application_denied',
      'booking_cancelled',
      'event_cancelled',
      'refund_processed',
      'attendee_reengagement',
      'attendee_signup_events_nudge',
      'attendee_hubert_event_concierge',
      'event_connections_list',
      'event_details_updated',
    ];
    var ORGANISER_EMAIL_SLUGS = ['organiser_new_registration', 'organiser_claim_invite', 'organiser_launch_invite', 'organiser_rebrand_announcement'];

    function emailTemplateCategory(t) {
      var slug = String((t && t.slug) || '');
      if (Object.prototype.hasOwnProperty.call(AUTOMATED_EMAIL_INFO, slug)) return 'automated';
      if (ATTENDEE_EMAIL_SLUGS.indexOf(slug) !== -1) return 'attendees';
      if (ORGANISER_EMAIL_SLUGS.indexOf(slug) !== -1 || slug.indexOf('organiser_') === 0) {
        return 'organisers';
      }
      var cat = String((t && t.category) || '')
        .trim()
        .toLowerCase();
      if (cat === 'attendees' || cat === 'organisers' || cat === 'opportunities') {
        return cat;
      }
      if (slug.indexOf('opportunity') !== -1) return 'opportunities';
      if (slug.indexOf('booking_') === 0 || slug.indexOf('account_') === 0) return 'attendees';
      return 'organisers';
    }

    var templateSearchQuery = '';

    function templateMatchesSearch(t, query) {
      if (!query) return true;
      var hay = (
        String(t.name || '') +
        ' ' +
        String(t.slug || '') +
        ' ' +
        String(t.subject || '') +
        ' ' +
        String(t.description || '')
      ).toLowerCase();
      return query.split(/\s+/).every(function (word) {
        return hay.indexOf(word) !== -1;
      });
    }

    function renderTemplateList() {
      var list = document.getElementById('email-template-list');
      if (!list) return;
      if (!templates.length) {
        list.innerHTML = '<li class="text-slate-400">No templates yet — run migration 027 in Supabase.</li>';
        return;
      }
      var query = templateSearchQuery.trim().toLowerCase();
      var anyMatch = false;
      list.innerHTML = EMAIL_TEMPLATE_GROUPS.map(function (group) {
        var items = templates.filter(function (t) {
          return emailTemplateCategory(t) === group.key && templateMatchesSearch(t, query);
        });
        if (query && !items.length) return '';
        if (items.length) anyMatch = true;
        var buttons = items
          .map(function (t) {
            var active = t.slug === selectedSlug;
            return (
              '<li><button type="button" data-email-slug="' +
              attrEsc(t.slug) +
              '" class="w-full text-left rounded-lg px-3 py-2 transition ' +
              (active
                ? 'bg-brand-50 text-brand-900 font-semibold border border-brand-100'
                : 'text-slate-700 hover:bg-slate-50') +
              '">' +
              esc(t.name) +
              '<span class="block text-[11px] font-normal text-slate-400 mt-0.5">' +
              esc(t.slug) +
              '</span></button></li>'
            );
          })
          .join('');
        return (
          '<li class="mb-4 last:mb-0">' +
          '<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">' +
          esc(group.label) +
          '</p>' +
          (buttons
            ? '<ul class="space-y-1">' + buttons + '</ul>'
            : '<p class="text-xs text-slate-400 px-1">No templates yet</p>') +
          '</li>'
        );
      }).join('');
      if (query && !anyMatch) {
        list.innerHTML =
          '<li class="text-xs text-slate-400 px-1">No templates match &ldquo;' +
          esc(templateSearchQuery.trim()) +
          '&rdquo;.</li>';
      }
      list.querySelectorAll('[data-email-slug]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (dirty && !window.confirm('Discard unsaved changes?')) return;
          selectTemplate(btn.getAttribute('data-email-slug'));
        });
      });
    }

    var templateSearchInput = document.getElementById('email-template-search');
    if (templateSearchInput) {
      templateSearchInput.addEventListener('input', function () {
        templateSearchQuery = templateSearchInput.value || '';
        renderTemplateList();
      });
    }

    function renderPlaceholderChips(placeholders) {
      var wrap = document.getElementById('email-placeholders');
      if (!wrap) return;
      var keys = Array.isArray(placeholders) ? placeholders : [];
      if (!keys.length) {
        wrap.innerHTML = '<span class="text-xs text-slate-400">No placeholders documented.</span>';
        return;
      }
      wrap.innerHTML = keys
        .map(function (key) {
          return (
            '<button type="button" data-ph="' +
            attrEsc(key) +
            '" class="text-xs rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 hover:bg-brand-50 hover:text-brand-900">{{' +
            esc(key) +
            '}}</button>'
          );
        })
        .join('');
      wrap.querySelectorAll('[data-ph]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var key = chip.getAttribute('data-ph');
          var body = document.getElementById('email-body');
          if (!body) return;
          var token = '{{' + key + '}}';
          var start = body.selectionStart;
          var end = body.selectionEnd;
          var val = body.value;
          body.value = val.slice(0, start) + token + val.slice(end);
          body.focus();
          body.selectionStart = body.selectionEnd = start + token.length;
          dirty = true;
        });
      });
    }

    function buildEmailSponsorSectionHtml(logo, url, name) {
      var link = String(url || '').trim();
      if (!link) return '';
      var label = String(name || '').trim() || 'Our sponsor';
      var logoHtml = String(logo || '').trim()
        ? '<img src="' +
          attrEsc(logo) +
          '" alt="' +
          attrEsc(label) +
          '" width="140" style="max-width:140px;width:100%;height:auto;display:block;margin:0 auto;">'
        : '<span style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#9a7aa8;">' +
          esc(label) +
          '</span>';
      return (
        '<tr><td class="mobile-pad" style="padding:6px 40px 2px;text-align:center;background:#f5f0e8;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:600;color:#8a8284;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 8px;line-height:1;">Powered by</p>' +
        '<a href="' +
        attrEsc(link) +
        '" style="display:inline-block;text-decoration:none;line-height:0;">' +
        logoHtml +
        '</a></td></tr>'
      );
    }

    function readEmailSponsorForm() {
      return {
        company: (document.getElementById('email-sponsor-company').value || '').trim(),
        url: (document.getElementById('email-sponsor-url').value || '').trim(),
        logoUrl: emailSponsorLogoBase64
          ? ''
          : (document.getElementById('email-sponsor-logo-url').value || '').trim(),
      };
    }

    function applyEmailSponsorBlock(block) {
      if (!block) return;
      var logo = String(block.logo_url || block.image_url || '').trim();
      document.getElementById('email-sponsor-company').value =
        String(block.company_name || '').trim();
      document.getElementById('email-sponsor-url').value = String(block.cta_url || '').trim();
      document.getElementById('email-sponsor-logo-url').value = logo;
      emailSponsorLogoBase64 = null;
      emailSponsorLogoMime = '';
      emailSponsorLogoFilename = '';
      emailSponsorCtaColor = String(block.cta_color || '').trim();
      var fileInput = document.getElementById('email-sponsor-logo-file');
      if (fileInput) fileInput.value = '';
      updateSampleSponsorSection();
      renderEmailSponsorMiniPreview();
    }

    function updateSampleSponsorSection() {
      var form = readEmailSponsorForm();
      var logo = form.logoUrl || emailSponsorLogoBase64 || '';
      SAMPLE_VARS.sponsor_row = buildEmailSponsorSectionHtml(
        logo,
        form.url,
        form.company
      );
    }

    function renderEmailSponsorMiniPreview() {
      var el = document.getElementById('email-sponsor-preview');
      if (!el) return;
      var form = readEmailSponsorForm();
      var logo = form.logoUrl || emailSponsorLogoBase64 || '';
      if (!form.url) {
        el.innerHTML = '<span class="text-slate-400">Add a website URL to show the sponsor in emails.</span>';
        return;
      }
      if (logo) {
        el.innerHTML =
          '<p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Powered by</p>' +
          '<img src="' +
          attrEsc(logo) +
          '" alt="" class="mx-auto max-h-12 w-auto" style="max-width:140px;display:block;">';
      } else {
        el.innerHTML =
          '<p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Powered by</p>' +
          '<p class="font-semibold text-brand-900">' +
          esc(form.company || 'Sponsor') +
          '</p>';
      }
    }

    function toggleEmailSponsorPanel() {
      var panel = document.getElementById('email-sponsor-panel');
      if (!panel) return;
      panel.classList.add('hidden');
    }

    function loadBookingEmailSponsor() {
      var status = document.getElementById('email-sponsor-status');
      if (status) status.textContent = 'Loading email sponsor…';
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(BOOKING_EMAIL_SPONSOR_SLOT))
        .then(function (data) {
          if (data.block) {
            applyEmailSponsorBlock(data.block);
            if (status) status.textContent = 'Using the booking email sponsor settings below.';
          } else {
            return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(EVENTS_SPONSOR_SLOT)).then(
              function (eventsData) {
                if (eventsData.block) {
                  applyEmailSponsorBlock(eventsData.block);
                  if (status) {
                    status.textContent =
                      'No email-only sponsor saved yet — showing your Events browse sponsor. Save below to set a separate email sponsor.';
                  }
                } else if (status) {
                  status.textContent = 'No sponsor configured yet. Set one below or pull from Events.';
                }
              }
            );
          }
          refreshPreview();
        })
        .catch(function () {
          if (status) status.textContent = 'Could not load sponsor settings.';
        });
    }

    function fillEditor(template) {
      var form = document.getElementById('email-editor');
      var previewPanel = document.getElementById('email-preview-panel');
      if (!template) {
        if (form) form.classList.add('hidden');
        if (previewPanel) previewPanel.classList.add('hidden');
        toggleEmailSponsorPanel();
        return;
      }
      if (form) form.classList.remove('hidden');
      if (previewPanel) previewPanel.classList.remove('hidden');
      document.getElementById('email-template-name').textContent = template.name;
      document.getElementById('email-template-desc').textContent =
        template.description || 'Transactional email template.';
      var automatedNote = document.getElementById('email-template-automated');
      if (automatedNote) {
        var autoInfo = AUTOMATED_EMAIL_INFO[template.slug];
        if (autoInfo) {
          automatedNote.textContent = 'Automated: ' + autoInfo + ' Edits here change what the Hub sends.';
          automatedNote.classList.remove('hidden');
        } else {
          automatedNote.textContent = '';
          automatedNote.classList.add('hidden');
        }
      }
      document.getElementById('email-subject').value = template.subject || '';
      document.getElementById('email-body').value = template.body_html || '';
      renderPlaceholderChips(template.placeholders);
      dirty = false;
      toggleEmailSponsorPanel();
      refreshPreview();
    }

    function selectTemplate(slug) {
      selectedSlug = slug;
      renderTemplateList();
      fillEditor(currentTemplate());
    }

    function setPreviewHtml(html) {
      var frame = document.getElementById('email-preview-frame');
      if (!frame) return;
      frame.srcdoc = html || '';
    }

    function stripUnresolvedBookingPlaceholders(text) {
      var keys = [
        'payment_summary_row',
        'event_meta_rows',
        'meeting_link_row',
        'refund_policy_row',
        'sponsor_row',
        'event_location_row',
        'event_online_row',
        'meeting_link_section',
        'refund_policy_section',
        'sponsor_section',
      ];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedReminderPlaceholders(text) {
      var keys = ['meeting_link_row', 'sponsor_row', 'meeting_link_section', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedOrganiserPlaceholders(text) {
      var keys = ['sponsor_row', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedAccountWelcomePlaceholders(text) {
      var keys = ['sponsor_row', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    var previewRequestId = 0;

    function refreshPreview() {
      if (!selectedSlug) return;
      var subjectEl = document.getElementById('email-subject');
      var bodyEl = document.getElementById('email-body');
      if (!subjectEl || !bodyEl) return;

      applyPreviewForSlug(selectedSlug);
      // Live CMS sponsors are resolved server-side — do not inject the form placeholder.

      var requestId = ++previewRequestId;
      var subjectLine = document.getElementById('email-preview-subject');
      if (subjectLine) subjectLine.textContent = 'Subject: Loading preview…';

      adminPost('/api/admin/emails', {
        action: 'preview',
        slug: selectedSlug,
        variables: SAMPLE_VARS,
        subject: subjectEl.value,
        body_html: bodyEl.value,
      })
        .then(function (data) {
          if (requestId !== previewRequestId) return;
          if (!data.ok) {
            if (subjectLine) {
              subjectLine.textContent =
                'Preview failed: ' + (data.message || data.error || 'unknown error');
            }
            setPreviewHtml(
              '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c;">Could not render preview: ' +
                esc(data.message || data.error || 'unknown error') +
                '</p>'
            );
            return;
          }
          if (subjectLine) subjectLine.textContent = 'Subject: ' + (data.subject || '');
          setPreviewHtml(data.html || '');
        })
        .catch(function (err) {
          if (requestId !== previewRequestId) return;
          if (subjectLine) {
            subjectLine.textContent =
              'Preview failed: ' + (err && err.message ? err.message : 'network error');
          }
          setPreviewHtml(
            '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c;">Could not render preview: ' +
              esc((err && err.message) || 'network error') +
              '</p>'
          );
        });
    }

    function renderTestRecipientList() {
      var list = document.getElementById('email-test-recipient-list');
      var select = document.getElementById('email-test-to');
      var previous = select ? select.value : '';
      if (list) {
        if (!testRecipients.length) {
          list.innerHTML =
            '<li class="text-slate-400 text-xs">No safe addresses yet — add one above before sending a test.</li>';
        } else {
          list.innerHTML = testRecipients
            .map(function (r) {
              var label = r.label ? ' <span class="text-slate-400">(' + esc(r.label) + ')</span>' : '';
              return (
                '<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">' +
                '<span><span class="font-medium text-slate-800">' +
                esc(r.email) +
                '</span>' +
                label +
                '</span>' +
                '<button type="button" data-remove-test-recipient="' +
                attrEsc(r.id) +
                '" class="text-xs font-semibold text-red-600 hover:text-red-800">Remove</button></li>'
              );
            })
            .join('');
          list.querySelectorAll('[data-remove-test-recipient]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var id = btn.getAttribute('data-remove-test-recipient');
              if (!id || !window.confirm('Remove this address from the safe test list?')) return;
              btn.disabled = true;
              adminPost('/api/admin/emails', { action: 'remove_test_recipient', id: id })
                .then(function (data) {
                  if (!data.ok) throw new Error(data.message || data.error || 'Remove failed');
                  testRecipients = testRecipients.filter(function (r) {
                    return r.id !== id;
                  });
                  renderTestRecipientList();
                  setEmailStatus('Removed from safe test list.', 'ok');
                })
                .catch(function (err) {
                  setEmailStatus(err.message || 'Could not remove address.', 'error');
                })
                .finally(function () {
                  btn.disabled = false;
                });
            });
          });
        }
      }
      if (select) {
        var options =
          '<option value="">Select a safe address…</option>' +
          testRecipients
            .map(function (r) {
              var label = r.label ? r.label + ' — ' : '';
              return (
                '<option value="' +
                attrEsc(r.email) +
                '">' +
                esc(label + r.email) +
                '</option>'
              );
            })
            .join('');
        select.innerHTML = options;
        if (previous && testRecipients.some(function (r) { return r.email === previous; })) {
          select.value = previous;
        } else if (
          currentUser &&
          currentUser.email &&
          testRecipients.some(function (r) { return r.email === currentUser.email; })
        ) {
          select.value = currentUser.email;
        }
      }
    }

    function loadTemplates() {
      setEmailStatus('Loading templates from Supabase…');
      adminGet('/api/admin/emails')
        .then(function (data) {
          if (data.error === 'supabase_not_configured') {
            setEmailStatus('Supabase is not configured.', 'error');
            return;
          }
          if (data.error || !data.ok) {
            setEmailStatus('Could not load templates: ' + (data.error || 'unknown'), 'error');
            return;
          }
          templates = data.templates || [];
          testRecipients = data.testRecipients || [];
          if (!selectedSlug && templates.length) selectedSlug = templates[0].slug;
          renderTemplateList();
          renderTestRecipientList();
          fillEditor(currentTemplate());
          if (!data.emailSendingConfigured) {
            setEmailStatus(
              isLocalDevHost()
                ? 'Templates loaded. Test sends need RESEND_API_KEY and RESEND_FROM in local.env — copy from Vercel, run npm run sync-env, restart npm start.'
                : 'Templates loaded. Test sends need RESEND_API_KEY and RESEND_FROM in Vercel environment variables.',
              'warn'
            );
          } else if (data.testRecipientsWarning) {
            setEmailStatus(data.testRecipientsWarning, 'warn');
          } else {
            setEmailStatus(templates.length + ' template' + (templates.length === 1 ? '' : 's') + ' loaded.');
          }
        })
        .catch(function () {
          setEmailStatus('Could not load email templates.', 'error');
        });
    }

    document.getElementById('email-subject').addEventListener('input', function () {
      dirty = true;
      refreshPreview();
    });
    document.getElementById('email-body').addEventListener('input', function () {
      dirty = true;
      refreshPreview();
    });

    document.getElementById('email-save-btn').addEventListener('click', function () {
      if (!selectedSlug) return;
      var btn = document.getElementById('email-save-btn');
      if (btn) btn.disabled = true;
      setEmailStatus('Saving…');
      adminPatch('/api/admin/emails', {
        slug: selectedSlug,
        subject: document.getElementById('email-subject').value,
        body_html: document.getElementById('email-body').value,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
          for (var i = 0; i < templates.length; i++) {
            if (templates[i].slug === selectedSlug) {
              templates[i] = data.template;
              break;
            }
          }
          dirty = false;
          setEmailStatus('Saved ' + data.template.name + '.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not save template.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-preview-btn').addEventListener('click', refreshPreview);

    ['email-sponsor-company', 'email-sponsor-url', 'email-sponsor-logo-url'].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', function () {
        updateSampleSponsorSection();
        renderEmailSponsorMiniPreview();
        refreshPreview();
      });
    });

    document.getElementById('email-sponsor-logo-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setEmailStatus('Logo must be under 2MB.', 'error');
        ev.target.value = '';
        return;
      }
      emailSponsorLogoMime = file.type || 'image/jpeg';
      emailSponsorLogoFilename = file.name || 'logo.jpg';
      var reader = new FileReader();
      reader.onload = function () {
        emailSponsorLogoBase64 = String(reader.result || '');
        document.getElementById('email-sponsor-logo-url').value = '';
        updateSampleSponsorSection();
        renderEmailSponsorMiniPreview();
        refreshPreview();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('email-sponsor-save-btn').addEventListener('click', function () {
      var btn = document.getElementById('email-sponsor-save-btn');
      var form = readEmailSponsorForm();
      if (!form.url || !/^https?:\/\//i.test(form.url)) {
        setEmailStatus('Enter the sponsor website URL (https://…).', 'error');
        return;
      }
      if (!form.logoUrl && !emailSponsorLogoBase64 && !form.company) {
        setEmailStatus('Add a logo or company name for the email sponsor.', 'error');
        return;
      }
      if (btn) btn.disabled = true;
      setEmailStatus('Saving email sponsor…');
      var payload = {
        slot: BOOKING_EMAIL_SPONSOR_SLOT,
        title: '',
        body: '',
        cta_label: 'Visit website',
        cta_url: form.url,
        company_name: form.company,
        logo_url: form.logoUrl,
        active: true,
      };
      if (emailSponsorLogoBase64) {
        payload.logoBase64 = emailSponsorLogoBase64;
        payload.logoMime = emailSponsorLogoMime;
        payload.logoFilename = emailSponsorLogoFilename;
      }
      adminPost('/api/admin/sponsor', payload)
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
          if (data.block) applyEmailSponsorBlock(data.block);
          setEmailStatus('Email sponsor saved.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not save email sponsor.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-sponsor-sync-btn').addEventListener('click', function () {
      var btn = document.getElementById('email-sponsor-sync-btn');
      if (btn) btn.disabled = true;
      setEmailStatus('Pulling sponsor from Events browse…');
      adminPost('/api/admin/sponsor', {
        action: 'sync_from',
        slot: BOOKING_EMAIL_SPONSOR_SLOT,
        from_slot: EVENTS_SPONSOR_SLOT,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Sync failed');
          if (data.block) applyEmailSponsorBlock(data.block);
          setEmailStatus('Email sponsor updated from Events browse sponsor.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          var msg = err.message || 'Could not sync sponsor.';
          if (msg === 'source_not_found') {
            msg = 'No Events browse sponsor found. Set one under Sponsorship first.';
          }
          setEmailStatus(msg, 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-test-add-btn').addEventListener('click', function () {
      var addBtn = document.getElementById('email-test-add-btn');
      var email = (document.getElementById('email-test-add-email').value || '').trim();
      var label = (document.getElementById('email-test-add-label').value || '').trim();
      if (!email) {
        setEmailStatus('Enter an email address to add to the safe test list.', 'error');
        return;
      }
      if (addBtn) addBtn.disabled = true;
      setEmailStatus('Adding to safe test list…');
      adminPost('/api/admin/emails', {
        action: 'add_test_recipient',
        email: email,
        label: label,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Add failed');
          var exists = false;
          for (var i = 0; i < testRecipients.length; i++) {
            if (testRecipients[i].id === data.recipient.id) {
              testRecipients[i] = data.recipient;
              exists = true;
              break;
            }
          }
          if (!exists) testRecipients.push(data.recipient);
          testRecipients.sort(function (a, b) {
            return a.email.localeCompare(b.email);
          });
          document.getElementById('email-test-add-email').value = '';
          document.getElementById('email-test-add-label').value = '';
          renderTestRecipientList();
          var select = document.getElementById('email-test-to');
          if (select) select.value = data.recipient.email;
          setEmailStatus('Added ' + data.recipient.email + ' to the safe test list.', 'ok');
        })
        .catch(function (err) {
          var msg = err.message || 'Could not add address.';
          if (msg === 'email_already_listed') {
            msg = 'That address is already on the safe test list.';
          } else if (msg === 'invalid_email') {
            msg = 'Enter a valid email address.';
          }
          setEmailStatus(msg, 'error');
        })
        .finally(function () {
          if (addBtn) addBtn.disabled = false;
        });
    });

    document.getElementById('email-test-btn').addEventListener('click', function () {
      if (!selectedSlug) return;
      var btn = document.getElementById('email-test-btn');
      var to = (document.getElementById('email-test-to').value || '').trim();
      setTestResult('', '');
      if (!to) {
        var pickMsg =
          testRecipients.length === 0
            ? 'No safe test addresses yet. Run migrations 051 and 052 in Supabase, or add an address above.'
            : 'Choose a safe test recipient from the dropdown before sending.';
        setEmailStatus(pickMsg, 'error');
        setTestResult(pickMsg, 'error');
        return;
      }
      if (btn) btn.disabled = true;
      applyPreviewForSlug(selectedSlug);
      // Live CMS sponsors are resolved server-side — do not inject the form placeholder.
      setEmailStatus('Sending test email to ' + to + '…');
      adminPost('/api/admin/emails', {
        action: 'test',
        slug: selectedSlug,
        to: to,
        variables: SAMPLE_VARS,
      })
        .then(function (data) {
          if (!data.ok) {
            var err = new Error(data.message || data.error || 'Send failed');
            err.code = data.error;
            throw err;
          }
          var okMsg =
            'Test email sent to ' +
            (data.to || to) +
            '. Check your inbox and spam folder (may take a minute).';
          if (data.template_source) {
            okMsg += ' Template: ' + data.template_source + '.';
          }
          setEmailStatus(okMsg, 'ok');
          setTestResult(okMsg, 'ok');
        })
        .catch(function (err) {
          var msg = emailActionMessage(err.code, err.message || 'Could not send test email.');
          setEmailStatus(msg, 'error');
          setTestResult(msg, 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    loadTemplates();
  }

  function normalizeOrganiserOption(o) {
    return {
      id: o.id,
      name: o.name,
      email: o.email || '',
      listingStatus: o.listingStatus || o.listing_status || '',
      slug: o.slug || '',
    };
  }

  function invalidateEventOrganiserOptionsCache() {
    eventOrganiserOptionsCache = null;
  }

  function fetchEventOrganiserOptions(force) {
    if (!force && eventOrganiserOptionsCache) {
      return Promise.resolve(eventOrganiserOptionsCache);
    }
    return adminGet('/api/admin/organisers?limit=500&offset=0').then(function (data) {
      if (!data || data.error) return [];
      eventOrganiserOptionsCache = (data.organisers || []).map(normalizeOrganiserOption);
      return eventOrganiserOptionsCache;
    });
  }

  function populateEventOrganiserSelects(organisers) {
    var filterSelect = document.getElementById('event-cleanup-organiser');
    if (filterSelect) filterSelect.innerHTML = eventCleanupFilterHtml(organisers);
    syncEventCreateOrganiserPicker(organisers);
    updateEventBulkBar();
  }

  function organiserListingSuffix(status) {
    var s = String(status || '').toLowerCase();
    if (!s || s === 'published') return '';
    return ' (' + s + ')';
  }

  function findOrganiserOptionById(organisers, id) {
    var target = String(id || '');
    if (!target) return null;
    for (var i = 0; i < (organisers || []).length; i += 1) {
      if (String(organisers[i].id) === target) return organisers[i];
    }
    return null;
  }

  function setEventCreateOrganiserSelection(id, name, status) {
    var hidden = document.getElementById('event-create-organiser-id');
    var search = document.getElementById('event-create-organiser-search');
    var selected = document.getElementById('event-create-organiser-selected');
    var results = document.getElementById('event-create-organiser-results');
    if (hidden) hidden.value = id || '';
    if (search) {
      search.value = '';
      search.classList.toggle('hidden', Boolean(id));
    }
    if (selected) {
      if (id) {
        selected.classList.remove('hidden');
        selected.innerHTML =
          '<span class="font-semibold text-brand-900">' +
          esc(name || id) +
          '</span>' +
          (status && status !== 'published'
            ? '<span class="text-slate-500">' + esc(organiserListingSuffix(status)) + '</span>'
            : '') +
          ' <button type="button" class="text-brand-700 hover:underline ml-2" id="event-create-organiser-clear">Change</button>';
      } else {
        selected.classList.add('hidden');
        selected.textContent = '';
      }
    }
    if (results) {
      results.classList.add('hidden');
      results.innerHTML = '';
    }
  }

  function syncEventCreateOrganiserPicker(organisers) {
    var picker = document.getElementById('event-create-organiser-picker');
    if (!picker || picker.dataset.bound !== '1') return;
    var preselected = eventCleanupState.organiserId || '';
    if (!preselected) {
      setEventCreateOrganiserSelection('', '', '');
      return;
    }
    var match = findOrganiserOptionById(organisers, preselected);
    if (match) {
      setEventCreateOrganiserSelection(match.id, match.name, match.listingStatus);
    }
  }

  function paintEventCreateOrganiserResults(items, emptyMsg) {
    var results = document.getElementById('event-create-organiser-results');
    if (!results) return;
    if (!items.length) {
      results.innerHTML =
        '<p class="px-3 py-3 text-sm text-slate-500">' + esc(emptyMsg || 'No organisers found') + '</p>';
      results.classList.remove('hidden');
      return;
    }
    results.innerHTML = items
      .map(function (org) {
        var suffix = organiserListingSuffix(org.listingStatus || org.listing_status);
        return (
          '<button type="button" class="event-create-organiser-result w-full text-left px-3 py-2.5 hover:bg-brand-50 transition border-b border-slate-100 last:border-0" data-id="' +
          attrEsc(org.id) +
          '" data-name="' +
          attrEsc(org.name || org.id) +
          '" data-status="' +
          attrEsc(org.listingStatus || org.listing_status || '') +
          '">' +
          '<span class="block text-sm font-semibold text-brand-900">' +
          esc(org.name || org.id) +
          esc(suffix) +
          '</span>' +
          (org.slug ? '<span class="block text-xs text-slate-500 mt-0.5">/' + esc(org.slug) + '</span>' : '') +
          (org.email
            ? '<span class="block text-xs text-slate-500 mt-0.5">' + esc(org.email) + '</span>'
            : '') +
          '</button>'
        );
      })
      .join('');
    results.classList.remove('hidden');
  }

  function bindEventCreateOrganiserPicker() {
    var picker = document.getElementById('event-create-organiser-picker');
    if (!picker || picker.dataset.bound === '1') return;
    picker.dataset.bound = '1';

    var search = document.getElementById('event-create-organiser-search');
    var results = document.getElementById('event-create-organiser-results');
    var searchTimer = null;

    function runOrganiserSearch(query) {
      var params = new URLSearchParams();
      params.set('limit', '50');
      if (query) params.set('q', query);
      adminGet('/api/admin/organisers?' + params.toString())
        .then(function (data) {
          var items = ((data && data.organisers) || []).map(normalizeOrganiserOption);
          paintEventCreateOrganiserResults(
            items,
            query ? 'No groups match that search' : 'Type a group name to search'
          );
        })
        .catch(function () {
          paintEventCreateOrganiserResults([], 'Could not search organisers');
        });
    }

    if (search) {
      search.addEventListener('focus', function () {
        runOrganiserSearch(String(search.value || '').trim());
      });
      search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          runOrganiserSearch(String(search.value || '').trim());
        }, 220);
      });
    }

    picker.addEventListener('click', function (e) {
      var clearBtn = e.target.closest('#event-create-organiser-clear');
      if (clearBtn) {
        setEventCreateOrganiserSelection('', '', '');
        if (search) search.focus();
        return;
      }
      var btn = e.target.closest('.event-create-organiser-result');
      if (!btn) return;
      setEventCreateOrganiserSelection(
        btn.getAttribute('data-id') || '',
        btn.getAttribute('data-name') || '',
        btn.getAttribute('data-status') || ''
      );
    });

    if (!eventCreateOrganiserDocClickBound) {
      eventCreateOrganiserDocClickBound = true;
      document.addEventListener('click', function (e) {
        var activePicker = document.getElementById('event-create-organiser-picker');
        var activeResults = document.getElementById('event-create-organiser-results');
        if (activePicker && activeResults && !activePicker.contains(e.target)) {
          activeResults.classList.add('hidden');
        }
      });
    }

    syncEventCreateOrganiserPicker(eventOrganiserOptionsCache || []);
  }

  function setEventBulkOrganiserSelection(id, name, status) {
    var hidden = document.getElementById('event-bulk-organiser-id');
    var search = document.getElementById('event-bulk-organiser-search');
    var selected = document.getElementById('event-bulk-organiser-selected');
    var results = document.getElementById('event-bulk-organiser-results');
    var value = id || '';
    if (hidden) hidden.value = value;
    if (search) {
      search.value = '';
      search.classList.toggle('hidden', Boolean(value));
    }
    if (selected) {
      if (value === '__unlink__') {
        selected.classList.remove('hidden');
        selected.innerHTML =
          '<span class="font-semibold text-brand-900">Unlink from organiser</span>' +
          ' <button type="button" class="text-brand-700 hover:underline ml-2" id="event-bulk-organiser-clear">Change</button>';
      } else if (value) {
        selected.classList.remove('hidden');
        selected.innerHTML =
          '<span class="font-semibold text-brand-900">' +
          esc(name || value) +
          '</span>' +
          (status && status !== 'published'
            ? '<span class="text-slate-500">' + esc(organiserListingSuffix(status)) + '</span>'
            : '') +
          ' <button type="button" class="text-brand-700 hover:underline ml-2" id="event-bulk-organiser-clear">Change</button>';
      } else {
        selected.classList.add('hidden');
        selected.textContent = '';
      }
    }
    if (results) {
      results.classList.add('hidden');
      results.innerHTML = '';
    }
  }

  function paintEventBulkOrganiserResults(items, emptyMsg) {
    var results = document.getElementById('event-bulk-organiser-results');
    if (!results) return;
    var unlinkRow =
      '<button type="button" class="event-bulk-organiser-result w-full text-left px-3 py-2.5 hover:bg-brand-50 transition border-b border-slate-100" data-id="__unlink__" data-name="Unlink from organiser" data-status="">' +
      '<span class="block text-sm font-semibold text-brand-900">— Unlink from organiser —</span>' +
      '<span class="block text-xs text-slate-500 mt-0.5">Remove the organiser link from selected events</span>' +
      '</button>';
    if (!items.length) {
      results.innerHTML =
        unlinkRow +
        '<p class="px-3 py-3 text-sm text-slate-500">' +
        esc(emptyMsg || 'No organisers found') +
        '</p>';
      results.classList.remove('hidden');
      return;
    }
    results.innerHTML =
      unlinkRow +
      items
        .map(function (org) {
          var suffix = organiserListingSuffix(org.listingStatus || org.listing_status);
          return (
            '<button type="button" class="event-bulk-organiser-result w-full text-left px-3 py-2.5 hover:bg-brand-50 transition border-b border-slate-100 last:border-0" data-id="' +
            attrEsc(org.id) +
            '" data-name="' +
            attrEsc(org.name || org.id) +
            '" data-status="' +
            attrEsc(org.listingStatus || org.listing_status || '') +
            '">' +
            '<span class="block text-sm font-semibold text-brand-900">' +
            esc(org.name || org.id) +
            esc(suffix) +
            '</span>' +
            (org.slug ? '<span class="block text-xs text-slate-500 mt-0.5">/' + esc(org.slug) + '</span>' : '') +
            (org.email
              ? '<span class="block text-xs text-slate-500 mt-0.5">' + esc(org.email) + '</span>'
              : '') +
            '</button>'
          );
        })
        .join('');
    results.classList.remove('hidden');
  }

  function bindEventBulkOrganiserPicker() {
    var picker = document.getElementById('event-bulk-organiser-picker');
    if (!picker || picker.dataset.bound === '1') return;
    picker.dataset.bound = '1';

    var search = document.getElementById('event-bulk-organiser-search');
    var results = document.getElementById('event-bulk-organiser-results');
    var searchTimer = null;

    function runOrganiserSearch(query) {
      var params = new URLSearchParams();
      params.set('limit', '50');
      if (query) params.set('q', query);
      adminGet('/api/admin/organisers?' + params.toString())
        .then(function (data) {
          var items = ((data && data.organisers) || []).map(normalizeOrganiserOption);
          paintEventBulkOrganiserResults(
            items,
            query ? 'No groups match that search' : 'Type a group name to search'
          );
        })
        .catch(function () {
          paintEventBulkOrganiserResults([], 'Could not search organisers');
        });
    }

    if (search) {
      search.addEventListener('focus', function () {
        runOrganiserSearch(String(search.value || '').trim());
      });
      search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          runOrganiserSearch(String(search.value || '').trim());
        }, 220);
      });
    }

    picker.addEventListener('click', function (e) {
      var clearBtn = e.target.closest('#event-bulk-organiser-clear');
      if (clearBtn) {
        setEventBulkOrganiserSelection('', '', '');
        if (search) search.focus();
        return;
      }
      var btn = e.target.closest('.event-bulk-organiser-result');
      if (!btn) return;
      setEventBulkOrganiserSelection(
        btn.getAttribute('data-id') || '',
        btn.getAttribute('data-name') || '',
        btn.getAttribute('data-status') || ''
      );
    });

    if (!eventBulkOrganiserDocClickBound) {
      eventBulkOrganiserDocClickBound = true;
      document.addEventListener('click', function (e) {
        var activePicker = document.getElementById('event-bulk-organiser-picker');
        var activeResults = document.getElementById('event-bulk-organiser-results');
        if (activePicker && activeResults && !activePicker.contains(e.target)) {
          activeResults.classList.add('hidden');
        }
      });
    }

    setEventBulkOrganiserSelection('', '', '');
  }

  function eventCreateDateRowHtml(value) {
    return (
      '<div class="event-create-date-row flex items-center gap-2">' +
      '<input type="date" name="event_date" value="' +
      attrEsc(value || '') +
      '" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<button type="button" class="event-create-remove-date rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-600 hover:bg-slate-50" aria-label="Remove date">Remove</button>' +
      '</div>'
    );
  }

  function bindEventCreateDatesSection() {
    var list = document.getElementById('event-create-dates-list');
    var addBtn = document.getElementById('event-create-add-date');
    if (!list || list.dataset.bound === '1') return;
    list.dataset.bound = '1';
    if (!list.children.length) {
      list.innerHTML = eventCreateDateRowHtml('');
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', eventCreateDateRowHtml(''));
      });
    }
    list.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('.event-create-remove-date');
      if (!removeBtn) return;
      var row = removeBtn.closest('.event-create-date-row');
      if (!row) return;
      if (list.querySelectorAll('.event-create-date-row').length <= 1) {
        row.querySelector('input[type="date"]').value = '';
        return;
      }
      row.remove();
    });
  }

  function defaultEventCreateEndTime(startTime) {
    var parts = String(startTime || '10:00').split(':');
    var hour = parseInt(parts[0], 10);
    if (Number.isNaN(hour)) hour = 10;
    var endHour = Math.min(hour + 2, 23);
    return String(endHour).padStart(2, '0') + ':' + String(parts[1] || '00').padStart(2, '0');
  }

  function combineEventCreateDateTime(dateKey, timeValue) {
    if (!dateKey) return '';
    var time = String(timeValue || '10:00').trim() || '10:00';
    if (time.length === 5) time += ':00';
    return dateKey + 'T' + time;
  }

  function collectEventCreateOccurrences(form) {
    var startTime = formFieldVal(form, 'start_time') || '10:00';
    var endTime = formFieldVal(form, 'end_time') || defaultEventCreateEndTime(startTime);
    var dateInputs = form.querySelectorAll('#event-create-dates-list input[type="date"]');
    var keys = [];
    dateInputs.forEach(function (input) {
      var value = String(input.value || '').trim();
      if (value && keys.indexOf(value) === -1) keys.push(value);
    });
    keys.sort();
    return keys.map(function (key) {
      return {
        date: combineEventCreateDateTime(key, startTime),
        endDate: combineEventCreateDateTime(key, endTime),
      };
    });
  }

  function resetEventCreateForm(form) {
    if (!form) return;
    form.reset();
    var startTime = formField(form, 'start_time');
    if (startTime) startTime.value = '10:00';
    var list = document.getElementById('event-create-dates-list');
    if (list) {
      list.innerHTML = eventCreateDateRowHtml('');
    }
    delete adminLogoPending['event-create-photo'];
    var photoPreview = form.querySelector('[data-admin-logo-key="event-create-photo"] .admin-logo-preview');
    var photoPlaceholder = form.querySelector('[data-admin-logo-key="event-create-photo"] .admin-logo-placeholder');
    if (photoPreview) {
      photoPreview.classList.add('hidden');
      photoPreview.removeAttribute('src');
    }
    if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
    syncEventCreateLocationVisibility(form);
    if (eventCleanupState.organiserId) {
      var match = findOrganiserOptionById(eventOrganiserOptionsCache || [], eventCleanupState.organiserId);
      if (match) {
        setEventCreateOrganiserSelection(match.id, match.name, match.listingStatus);
        return;
      }
    }
    setEventCreateOrganiserSelection('', '', '');
  }

  function isInPersonMeetingFormat(value) {
    var s = String(value || '').toLowerCase();
    if (!s) return true;
    if (s.includes('online') && !s.includes('person')) return false;
    return s.includes('person') || s.includes('in ');
  }

  function eventDescriptionFieldHtml(value) {
    return (
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Description</label>' +
      '<textarea name="description" rows="4" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="What happens at this event? Organisers can refine this later.">' +
      esc(value || '') +
      '</textarea></div>'
    );
  }

  function eventLocationFieldsHtml(ev, className) {
    ev = ev || {};
    var hidden = !isInPersonMeetingFormat(ev.meeting_type);
    return (
      '<div class="' +
      (className || 'event-location-fields') +
      ' sm:col-span-2 grid sm:grid-cols-2 gap-3' +
      (hidden ? ' hidden' : '') +
      '">' +
      '<div class="sm:col-span-2"><p class="text-xs font-semibold text-slate-500">In-person location</p></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Venue name</label>' +
      '<input type="text" name="venue" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(ev.venue || '') +
      '" placeholder="e.g. The Exchange"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Street address</label>' +
      '<input type="text" name="address" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(ev.address || '') +
      '" placeholder="Street address" autocomplete="street-address"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">City</label>' +
      '<input type="text" name="city" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(ev.city || '') +
      '" placeholder="e.g. Leeds" autocomplete="address-level2"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Postcode</label>' +
      '<input type="text" name="postcode" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(ev.postcode || '') +
      '" placeholder="e.g. LS1 4DY" autocomplete="postal-code"></div></div>'
    );
  }

  function eventPhotoFieldHtml(key, photoUrl) {
    var hasPhoto = !!photoUrl;
    return (
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Event photo</label>' +
      '<p class="text-[11px] text-slate-500 mb-2">Click, paste (Ctrl+V), or drop an image — or paste a URL below. Leave blank to use the group logo.</p>' +
      '<div class="admin-logo-zone border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
      attrEsc(key) +
      '" tabindex="0" role="button" aria-label="Upload or paste event photo">' +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
      '<img class="admin-logo-preview mx-auto h-16 w-16 rounded-lg object-cover border border-slate-200' +
      (hasPhoto ? '' : ' hidden') +
      '" src="' +
      attrEsc(photoUrl || '') +
      '" alt="">' +
      '<p class="admin-logo-placeholder text-xs text-slate-500 mt-2' +
      (hasPhoto ? ' hidden' : '') +
      '">Drop image here or click to browse</p></div>' +
      '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm mt-2" value="' +
      attrEsc(photoUrl || '') +
      '" placeholder="https://… (optional if you uploaded a file)"></div>'
    );
  }

  function eventPhotoPayloadForKey(key, form) {
    var pending = adminLogoPending[key];
    if (pending && pending.file) {
      return readFileAsBase64(pending.file).then(function (b64) {
        var payload = {
          photo_base64: b64,
          photo_mime: pending.file.type,
          photo_filename: pending.file.name,
        };
        if (form && formField(form, 'photo_url')) {
          var url = formFieldVal(form, 'photo_url');
          if (url) payload.photo_url = url;
        }
        return payload;
      });
    }
    var payload = {};
    if (form && formField(form, 'photo_url')) payload.photo_url = formFieldVal(form, 'photo_url');
    return Promise.resolve(payload);
  }

  function eventDetailsPayloadFromForm(form) {
    return {
      description: formFieldVal(form, 'description'),
      venue: formFieldVal(form, 'venue'),
      address: formFieldVal(form, 'address'),
      city: formFieldVal(form, 'city'),
      postcode: formFieldVal(form, 'postcode'),
    };
  }

  function syncEventCreateLocationVisibility(form) {
    if (!form) return;
    var formatEl = formField(form, 'meeting_type');
    var locationBlock = form.querySelector('.event-location-fields');
    if (!locationBlock || !formatEl) return;
    locationBlock.classList.toggle('hidden', !isInPersonMeetingFormat(formatEl.value));
  }

  function bindEventFormLocationToggle(root) {
    (root || main).querySelectorAll('select[name="meeting_type"]').forEach(function (select) {
      if (select.dataset.locationToggleBound === '1') return;
      select.dataset.locationToggleBound = '1';
      select.addEventListener('change', function () {
        var form = select.closest('form');
        if (!form) return;
        var locationBlock = form.querySelector('.event-location-fields');
        if (locationBlock) {
          locationBlock.classList.toggle('hidden', !isInPersonMeetingFormat(select.value));
        }
      });
    });
  }

  function missingBadge(field) {
    var labels = {
      description: 'No bio',
      logo: 'No logo',
      website: 'No website',
      email: 'No contact email',
    };
    return (
      '<span class="inline-flex items-center rounded-full bg-amber-100 text-amber-900 text-[10px] font-semibold px-2 py-0.5 mr-1">' +
      esc(labels[field] || field) +
      '</span>'
    );
  }

  function listingStatusBadge(status) {
    var s = String(status || 'draft').toLowerCase();
    var cls =
      s === 'published'
        ? 'bg-emerald-100 text-emerald-800'
        : s === 'unpublished'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-amber-100 text-amber-900';
    return (
      '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ' +
      cls +
      '">' +
      esc(s) +
      '</span>'
    );
  }

  function approvalStatusBadge(status) {
    var s = String(status || 'Pending Review');
    var low = s.toLowerCase();
    var cls =
      low.indexOf('approved') >= 0 && low.indexOf('pending') < 0
        ? 'bg-emerald-100 text-emerald-800'
        : low.indexOf('reject') >= 0
          ? 'bg-red-100 text-red-800'
          : 'bg-amber-100 text-amber-900';
    return (
      '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ' +
      cls +
      '">' +
      esc(s) +
      '</span>'
    );
  }

  function eventCleanupHasActiveFilters() {
    return !!(
      eventCleanupState.q ||
      eventCleanupState.organiserId ||
      eventCleanupState.unlinked ||
      eventCleanupState.noDate ||
      eventCleanupState.when ||
      eventCleanupState.status ||
      eventCleanupState.approval
    );
  }

  function syncEventCleanupFilterUi() {
    var el;
    el = document.getElementById('event-cleanup-organiser');
    if (el) el.value = eventCleanupState.organiserId || '';
    el = document.getElementById('event-cleanup-search');
    if (el) el.value = eventCleanupState.q || '';
    el = document.getElementById('event-cleanup-unlinked');
    if (el) el.checked = !!eventCleanupState.unlinked;
    el = document.getElementById('event-cleanup-no-date');
    if (el) el.checked = !!eventCleanupState.noDate;
    el = document.getElementById('event-cleanup-when');
    if (el) el.value = eventCleanupState.when || '';
    el = document.getElementById('event-cleanup-status-filter');
    if (el) el.value = eventCleanupState.status || '';
    el = document.getElementById('event-cleanup-approval-filter');
    if (el) el.value = eventCleanupState.approval || '';
    el = document.getElementById('event-cleanup-sort');
    if (el) el.value = eventCleanupState.sort || 'recent';
    main.querySelectorAll('[data-event-quick]').forEach(function (btn) {
      var key = btn.getAttribute('data-event-quick');
      var active = false;
      if (key === 'unlinked') active = eventCleanupState.unlinked;
      else if (key === 'no_date') active = eventCleanupState.noDate;
      else if (key === 'live') active = eventCleanupState.when === 'upcoming';
      else if (key === 'past') active = eventCleanupState.when === 'past';
      else if (key === 'draft') active = eventCleanupState.status === 'draft';
      else if (key === 'pending') active = eventCleanupState.approval === 'Pending Review';
      btn.classList.toggle('ring-2', active);
      btn.classList.toggle('ring-brand-700', active);
      btn.classList.toggle('bg-brand-50', active);
    });
  }

  function eventCleanupEditFormHtml(ev, organisers) {
    return (
      '<form class="event-cleanup-form grid sm:grid-cols-2 gap-3" data-event-id="' +
      attrEsc(ev.id) +
      '">' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Title</label>' +
      '<input type="text" name="title" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(ev.title || '') +
      '"></div>' +
      eventDescriptionFieldHtml(ev.description || '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
      '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      organiserOptionsHtml(organisers, ev.organiser_id) +
      '</select>' +
      (ev.organiser_id && !ev.organiser_email
        ? '<p class="text-[11px] text-amber-800 font-semibold mt-1">This organiser profile has no contact email — add one below so the owner can sign in.</p>'
        : ev.organiser_email
          ? '<p class="text-[11px] text-slate-500 mt-1">Owner email: ' + esc(ev.organiser_email) + '</p>'
          : '') +
      '</div>' +
      (ev.organiser_id
        ? '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser contact email</label>' +
          '<input type="email" name="organiser_contact_email" autocomplete="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
          attrEsc(ev.organiser_email || '') +
          '" placeholder="hello@chapter-leader.com"></div>'
        : '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date</label>' +
      '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(toDatetimeLocalValue(ev.starts_at)) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
      '<select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      eventStatusOptions(ev.status || 'draft', { hideCancelled: eventHasCommerce(ev) }) +
      '</select>' +
      (eventHasCommerce(ev)
        ? '<p class="text-[11px] text-amber-800 mt-1">To cancel with refunds, use Cancel event &amp; refund bookings in the bulk bar.</p>'
        : '') +
      '</div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
      '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">—</option>' +
      eventTypeOptions(ev.event_type) +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
      '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">—</option>' +
      meetingFormatOptions(ev.meeting_type) +
      '</select></div>' +
      eventLocationFieldsHtml(ev) +
      eventPhotoFieldHtml('event-photo-' + ev.id, ev.photo_url || '') +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Save event</button>' +
      (ev.can_reinstate
        ? '<button type="button" class="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold px-4 py-2 hover:bg-emerald-100" data-reinstate-event="' +
          attrEsc(ev.id) +
          '" data-reinstate-status="unpublished">Reinstate (unpublished)</button>' +
          '<button type="button" class="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold px-4 py-2 hover:bg-emerald-100" data-reinstate-event="' +
          attrEsc(ev.id) +
          '" data-reinstate-status="published">Reinstate &amp; republish</button>'
        : ev.status === 'cancelled' && ev.reinstate_blocked_reason
          ? '<span class="text-xs text-amber-800">' + esc(ev.reinstate_blocked_reason) + '</span>'
          : eventHasCommerce(ev)
            ? '<button type="button" class="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-semibold px-4 py-2 hover:bg-amber-100" data-unpublish-event="' +
              attrEsc(ev.id) +
              '" data-event-title="' +
              attrEsc(ev.title || 'Untitled') +
              '">Unpublish listing</button>'
            : '<button type="button" class="rounded-lg border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50" data-delete-event="' +
              attrEsc(ev.id) +
              '" data-event-title="' +
              attrEsc(ev.title || 'Untitled') +
              '">Delete event</button>') +
      '<span class="event-cleanup-msg text-xs"></span></div></form>' +
      entityActivityPanelHtml({
        entityType: 'event',
        entityId: ev.id,
        organiserId: ev.organiser_id || '',
      })
    );
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function adminLogoFieldHtml(key, photoUrl, compact) {
    var hasPhoto = !!photoUrl;
    if (compact) {
      return (
        '<div class="group-cleanup-logo-field min-w-0">' +
        '<label class="block text-xs font-semibold text-slate-500 mb-1">Logo</label>' +
        '<div class="admin-logo-zone admin-logo-zone--compact border-2 border-dashed border-slate-300 rounded-lg p-2 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
        attrEsc(key) +
        '" tabindex="0" role="button" aria-label="Upload or paste logo">' +
        '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
        '<img class="admin-logo-preview mx-auto h-12 w-12 rounded-lg object-contain border border-slate-200' +
        (hasPhoto ? '' : ' hidden') +
        '" src="' +
        attrEsc(photoUrl || '') +
        '" alt="">' +
        '<p class="admin-logo-placeholder text-[10px] text-slate-500 mt-1' +
        (hasPhoto ? ' hidden' : '') +
        '">Drop or click</p></div>' +
        '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-xs mt-1.5" value="' +
        attrEsc(photoUrl || '') +
        '" placeholder="Logo URL"></div>'
      );
    }
    return (
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Logo</label>' +
      '<p class="text-[11px] text-slate-500 mb-2">Click, paste (Ctrl+V), or drop an image — or paste a URL below.</p>' +
      '<div class="admin-logo-zone border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
      attrEsc(key) +
      '" tabindex="0" role="button" aria-label="Upload or paste logo">' +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
      '<img class="admin-logo-preview mx-auto h-16 w-16 rounded-lg object-cover border border-slate-200' +
      (hasPhoto ? '' : ' hidden') +
      '" src="' +
      attrEsc(photoUrl || '') +
      '" alt="">' +
      '<p class="admin-logo-placeholder text-xs text-slate-500 mt-2' +
      (hasPhoto ? ' hidden' : '') +
      '">Drop image here or click to browse</p></div>' +
      '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm mt-2" value="' +
      attrEsc(photoUrl || '') +
      '" placeholder="https://… (optional if you uploaded a file)"></div>'
    );
  }

  function bindAdminLogoZone(zone) {
    if (!zone || zone.dataset.logoBound) return;
    zone.dataset.logoBound = '1';
    var key = zone.getAttribute('data-admin-logo-key') || '';
    var fileInput = zone.querySelector('input[type="file"]');
    var preview = zone.querySelector('.admin-logo-preview');
    var placeholder = zone.querySelector('.admin-logo-placeholder');
    var form = zone.closest('form');
    var wrap = zone.parentElement;
    var urlName = zone.getAttribute('data-admin-logo-url-name') || 'photo_url';
    var urlInput =
      (wrap && wrap.querySelector('input[name="' + urlName + '"]')) ||
      (form && form.querySelector('input[name="' + urlName + '"]')) ||
      (form && form.querySelector('input[name="photo_url"]'));

    function showPreview(src) {
      if (preview) {
        preview.src = src;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    }

    function setFile(file) {
      adminLogoPending[key] = { file: file };
      var reader = new FileReader();
      reader.onload = function () {
        adminLogoPending[key].dataUrl = reader.result;
        showPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }

    if (window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone: zone, fileInput: fileInput, onFile: setFile });
    } else if (fileInput) {
      zone.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (file) setFile(file);
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', function () {
        var url = String(urlInput.value || '').trim();
        if (url && preview) {
          preview.src = url;
          preview.classList.remove('hidden');
          if (placeholder) placeholder.classList.add('hidden');
          delete adminLogoPending[key];
        }
      });
    }
  }

  function bindAdminLogoZones(root) {
    (root || main).querySelectorAll('[data-admin-logo-key]').forEach(bindAdminLogoZone);
  }

  function rememberSelectedGroup(o) {
    if (!o || o.id == null) return;
    groupCleanupState.selected[String(o.id)] = {
      id: o.id,
      name: o.name || 'Untitled',
      email: o.email || '',
      event_count: o.event_count || 0,
      hub_suspended: Boolean(o.hub_suspended),
      listing_status: o.listing_status || '',
    };
  }

  function forgetSelectedGroup(id) {
    delete groupCleanupState.selected[String(id)];
  }

  function clearSelectedGroups() {
    groupCleanupState.selected = {};
  }

  function getSelectedGroupIds() {
    return Object.keys(groupCleanupState.selected);
  }

  function selectedGroupRows() {
    return getSelectedGroupIds().map(function (id) {
      return groupCleanupState.selected[id];
    });
  }

  function updateGroupBulkBar() {
    var bar = document.getElementById('group-cleanup-bulk');
    var countEl = document.getElementById('group-bulk-count');
    var mergeSection = document.getElementById('group-merge-section');
    var primarySelect = document.getElementById('group-merge-primary');
    var chipsEl = document.getElementById('group-selected-chips');
    var ids = getSelectedGroupIds();
    var rows = selectedGroupRows();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
    if (mergeSection) mergeSection.classList.toggle('hidden', ids.length < 2);
    var deleteSection = document.getElementById('group-delete-section');
    if (deleteSection) deleteSection.classList.toggle('hidden', ids.length === 0);
    var browseSection = document.getElementById('group-browse-section');
    if (browseSection) browseSection.classList.toggle('hidden', ids.length === 0);
    if (chipsEl) {
      chipsEl.innerHTML = rows
        .map(function (o) {
          var label = o.name || 'Untitled';
          if (o.email) label += ' (' + o.email + ')';
          return (
            '<span class="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-900">' +
            '<span class="truncate max-w-[14rem]" title="' +
            attrEsc(label) +
            '">' +
            esc(label) +
            '</span>' +
            '<button type="button" class="group-unselect shrink-0 text-slate-400 hover:text-red-700 font-bold leading-none" data-unselect-group="' +
            attrEsc(o.id) +
            '" aria-label="Remove ' +
            attrEsc(o.name || 'group') +
            ' from selection">×</button></span>'
          );
        })
        .join('');
    }
    if (primarySelect) {
      var current = primarySelect.value;
      primarySelect.innerHTML = rows
        .map(function (o) {
          var label = (o.name || 'Untitled') + (o.email ? ' (' + o.email + ')' : '');
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (String(current) === String(o.id) ? ' selected' : '') +
            '>' +
            esc(label) +
            '</option>'
          );
        })
        .join('');
      if (!primarySelect.value && rows.length) primarySelect.value = rows[0].id;
    }
    if (main) {
      var selectPage = document.getElementById('group-cleanup-select-page');
      var pageCbs = main.querySelectorAll('.group-select-checkbox');
      var allPageChecked = pageCbs.length > 0;
      pageCbs.forEach(function (cb) {
        if (!groupCleanupState.selected[cb.value]) allPageChecked = false;
      });
      if (selectPage) selectPage.checked = allPageChecked;
    }
  }

  function logoPayloadForKey(key, form) {
    var pending = adminLogoPending[key];
    if (pending && pending.file) {
      return readFileAsBase64(pending.file).then(function (b64) {
        var payload = {
          logoBase64: b64,
          logoMime: pending.file.type,
          logoFilename: pending.file.name,
        };
        if (form && formField(form, 'photo_url')) {
          var url = formFieldVal(form, 'photo_url');
          if (url) payload.photo_url = url;
        }
        return payload;
      });
    }
    var payload = {};
    if (form && formField(form, 'photo_url')) payload.photo_url = formFieldVal(form, 'photo_url');
    return Promise.resolve(payload);
  }

  function adminPaginationHtml(page, total, pageSize, dataAttr) {
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return '';
    var attr = dataAttr || 'data-admin-page';
    var parts = [];
    function btn(p, label, active, disabled) {
      if (disabled) {
        return (
          '<span class="admin-page-btn admin-page-btn--disabled" aria-disabled="true">' + esc(label) + '</span>'
        );
      }
      if (active) {
        return (
          '<span class="admin-page-btn admin-page-btn--active" aria-current="page">' + esc(label) + '</span>'
        );
      }
      return (
        '<button type="button" class="admin-page-btn" ' +
        attr +
        '="' +
        p +
        '">' +
        esc(label) +
        '</button>'
      );
    }
    parts.push(btn(page - 1, '← Prev', false, page <= 0));
    var i = 0;
    while (i < totalPages) {
      if (i === 0 || i === totalPages - 1 || (i >= page - 2 && i <= page + 2)) {
        parts.push(btn(i, String(i + 1), i === page, false));
        i += 1;
      } else if (i < page - 2) {
        parts.push('<span class="admin-page-ellipsis">…</span>');
        i = Math.max(i + 1, page - 2);
      } else {
        parts.push('<span class="admin-page-ellipsis">…</span>');
        i = totalPages - 1;
      }
    }
    parts.push(btn(page + 1, 'Next →', false, page >= totalPages - 1));
    return (
      '<nav class="admin-pagination" aria-label="Page navigation">' +
      parts.join('') +
      '<span class="admin-page-summary">Page ' +
      (page + 1) +
      ' of ' +
      totalPages +
      '</span></nav>'
    );
  }

  function paginateRows(rows, page, pageSize) {
    var list = rows || [];
    var size = Math.max(1, pageSize || 30);
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / size) || 1);
    var safePage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
    var start = safePage * size;
    return {
      page: safePage,
      total: total,
      pageSize: size,
      rows: list.slice(start, start + size),
    };
  }

  function hubHashTab(fullHash, fallback) {
    var parts = String(fullHash || '')
      .replace(/^#/, '')
      .split(/[/?]/);
    return parts[1] || fallback || '';
  }

  function currentAdminHash() {
    return normalizeAdminHash((location.hash || '#dashboard').replace(/^#/, ''));
  }

  function refreshModerationView() {
    renderModerationHub(currentAdminHash());
  }

  function refreshFinancialsView() {
    financialsState.cache = null;
    renderFinancialsHub(currentAdminHash());
  }

  function moderationBadge(o) {
    var mod = o.moderation || {};
    var count = Number(mod.warning_count != null ? mod.warning_count : o.warning_count) || 0;
    var limit = Number(mod.warning_limit != null ? mod.warning_limit : o.warning_limit) || 3;
    var suspended = Boolean(mod.hub_suspended != null ? mod.hub_suspended : o.hub_suspended);
    if (suspended) {
      return '<span class="text-xs font-semibold text-red-800 bg-red-100 px-2 py-0.5 rounded">Suspended</span>';
    }
    if (count > 0) {
      return (
        '<span class="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">' +
        count +
        ' warning' +
        (count === 1 ? '' : 's') +
        ' / ' +
        limit +
        '</span>'
      );
    }
    return '';
  }

  var MANUAL_CONDUCT_WARNING_REASONS = [
    'Breach of Hub rules',
    'Misleading listing',
    'Quality issue',
    'Spam or prohibited content',
    'Other',
  ];

  function formatModerationActionLine(action) {
    if (!action) return '';
    var when = '';
    if (action.created_at) {
      var d = new Date(action.created_at);
      if (!isNaN(d.getTime())) {
        when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    var label =
      action.action_type === 'warning'
        ? 'Warning'
        : action.action_type === 'suspension'
          ? 'Suspended'
          : action.action_type === 'reinstatement'
            ? 'Reinstated'
            : action.action_type || 'Action';
    return esc(label + ': ' + (action.reason || '—')) + (when ? ' · ' + esc(when) : '');
  }

  function actorRoleLabel(role) {
    var r = String(role || '').toLowerCase();
    if (r === 'owner') return 'Owner';
    if (r === 'team' || r === 'editor') return 'Team member';
    if (r === 'admin') return 'Hub admin';
    if (r === 'system') return 'System';
    return 'Unknown';
  }

  function renderEntityActivityItems(items) {
    if (!items || !items.length) {
      return '<p class="text-xs text-slate-500">No activity recorded yet for this listing.</p>';
    }
    return (
      '<ul class="entity-activity-list-items space-y-2">' +
      items
        .map(function (item) {
          var when = item.createdAt ? fmtTime(item.createdAt) : '—';
          var who =
            (item.actorEmail ? item.actorEmail : 'Unknown user') +
            ' · ' +
            actorRoleLabel(item.actorRole);
          return (
            '<li class="entity-activity-item">' +
            '<div class="entity-activity-item-main">' +
            '<p class="entity-activity-summary">' +
            esc(item.summary || item.action || 'Change') +
            '</p>' +
            '<p class="entity-activity-meta">' +
            esc(who) +
            ' · ' +
            esc(when) +
            '</p></div></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function entityActivityPanelHtml(opts) {
    var o = opts || {};
    return (
      '<div class="entity-activity-panel" data-entity-type="' +
      attrEsc(o.entityType || '') +
      '" data-entity-id="' +
      attrEsc(o.entityId || '') +
      '"' +
      (o.organiserId ? ' data-organiser-id="' + attrEsc(o.organiserId) + '"' : '') +
      '>' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<div><p class="text-xs font-semibold text-brand-900">Activity log</p>' +
      '<p class="text-[11px] text-slate-500 mt-0.5">Who changed this listing — owner, team member, or Hub admin.</p></div>' +
      '<button type="button" class="entity-activity-load rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50">Show activity</button></div>' +
      '<div class="entity-activity-body mt-2 hidden"></div></div>'
    );
  }

  function loadEntityActivityPanel(panel) {
    if (!panel) return;
    var body = panel.querySelector('.entity-activity-body');
    var btn = panel.querySelector('.entity-activity-load');
    if (!body) return;
    body.classList.remove('hidden');
    body.innerHTML = '<p class="text-xs text-slate-500">Loading activity…</p>';
    if (btn) btn.disabled = true;
    var entityType = panel.getAttribute('data-entity-type') || '';
    var entityId = panel.getAttribute('data-entity-id') || '';
    var organiserId = panel.getAttribute('data-organiser-id') || '';
    var qs = [];
    if (entityType === 'organiser' && organiserId) {
      qs.push('organiserId=' + encodeURIComponent(organiserId));
    } else if (entityType && entityId) {
      qs.push('entityType=' + encodeURIComponent(entityType));
      qs.push('entityId=' + encodeURIComponent(entityId));
    } else if (organiserId) {
      qs.push('organiserId=' + encodeURIComponent(organiserId));
    }
    qs.push('limit=40');
    adminGet('/api/admin/activity?' + qs.join('&'))
      .then(function (data) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Refresh activity';
        }
        if (!data || data.ok === false || data.error) {
          body.innerHTML =
            '<p class="text-xs text-red-700">' +
            esc((data && (data.message || data.error)) || 'Could not load activity.') +
            '</p>';
          return;
        }
        if (data.unavailable) {
          body.innerHTML =
            '<p class="text-xs text-amber-800">' +
            esc(data.message || 'Run migration 206_entity_activity_log.sql to enable activity history.') +
            '</p>';
          return;
        }
        body.innerHTML = renderEntityActivityItems(data.items || []);
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        body.innerHTML =
          '<p class="text-xs text-red-700">' + esc(err.message || 'Could not load activity.') + '</p>';
      });
  }

  function groupModerationPanelHtml(o) {
    var mod = o.moderation || {};
    var recent = mod.recent || [];
    var suspended = Boolean(mod.hub_suspended != null ? mod.hub_suspended : o.hub_suspended);
    var historyHtml = recent.length
      ? recent
          .map(function (action) {
            return '<li class="text-xs text-slate-600">' + formatModerationActionLine(action) + '</li>';
          })
          .join('')
      : '<li class="text-xs text-slate-500">No conduct warnings on record.</li>';

    return (
      '<div class="group-moderation-panel rounded-lg border border-slate-200 bg-white p-3 space-y-3 mt-3" data-organiser-moderation="' +
      attrEsc(o.id) +
      '">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<div><p class="text-xs font-semibold text-brand-900">Conduct &amp; warnings</p>' +
      '<p class="text-[11px] text-slate-500 mt-0.5">Three conduct warnings suspend the organiser from the Hub. <a href="../legal-policies#hub-rules" target="_blank" rel="noopener" class="text-brand-700 font-semibold hover:underline">Hub rules</a></p></div>' +
      moderationBadge(o) +
      '</div>' +
      '<ul class="space-y-1 list-disc pl-4">' +
      historyHtml +
      '</ul>' +
      '<div class="grid sm:grid-cols-2 gap-2">' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Issue warning</label>' +
      '<select class="group-warning-reason w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">Select reason…</option>' +
      MANUAL_CONDUCT_WARNING_REASONS.map(function (r) {
        return '<option value="' + attrEsc(r) + '">' + esc(r) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Note (optional)</label>' +
      '<input type="text" class="group-warning-details w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Internal note sent to organiser"></div></div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<button type="button" class="group-issue-warning rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold px-3 py-1.5 hover:bg-amber-100" data-organiser-id="' +
      attrEsc(o.id) +
      '">Issue warning</button>' +
      (suspended
        ? '<button type="button" class="group-reinstate rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-100" data-organiser-id="' +
          attrEsc(o.id) +
          '">Reinstate profile</button>'
        : '') +
      '<span class="group-moderation-msg text-xs"></span></div></div>'
    );
  }

  function groupCleanupQuickFormHtml(o) {
    var hiddenFromBrowse =
      String(o.listing_status || '').toLowerCase() === 'unpublished' && !o.hub_suspended;
    var browseHiddenDisabled = Boolean(o.hub_suspended);
    return (
      '<form class="group-cleanup-form group-cleanup-quick-form" data-organiser-id="' +
      attrEsc(o.id) +
      '">' +
      adminLogoFieldHtml(o.id, o.photo_url, true) +
      '<div class="group-cleanup-quick-fields min-w-0 space-y-2">' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Group name</label>' +
      '<input type="text" name="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(o.name || '') +
      '" placeholder="Networking group name"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Contact email</label>' +
      '<input type="email" name="contact_email" autocomplete="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(o.email || '') +
      '" placeholder="hello@theircompany.com">' +
      '<p class="text-[11px] text-slate-500 mt-1">Links this profile to an organiser login and shows on event cleanup.</p></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
      '<input type="url" name="website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(o.website || '') +
      '" placeholder="https://example.com"></div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<button type="button" class="group-fill-from-website rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50">Fill logo &amp; description from website</button>' +
      '<span class="text-[11px] text-slate-500">Reads the site’s logo and intro text</span></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
      '<textarea name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Short intro for this networking group">' +
      esc(o.description || '') +
      '</textarea></div>' +
      '<label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer' +
      (browseHiddenDisabled ? ' opacity-60 cursor-not-allowed' : '') +
      '">' +
      '<input type="checkbox" name="hide_from_browse" class="rounded border-slate-300 mt-0.5"' +
      (hiddenFromBrowse ? ' checked' : '') +
      (browseHiddenDisabled ? ' disabled' : '') +
      '>' +
      '<span class="min-w-0"><span class="block text-sm font-semibold text-brand-900">Hide from browse</span>' +
      '<span class="block text-[11px] text-slate-500 mt-0.5">Keeps this group off the public organiser directory until they claim the profile and publish a listing.</span>' +
      (browseHiddenDisabled
        ? '<span class="block text-[11px] text-amber-800 font-semibold mt-1">Suspended — use Reinstate profile to publish again.</span>'
        : '') +
      '</span></label></div>' +
      '<div class="group-cleanup-quick-actions flex flex-col items-stretch gap-2 shrink-0">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900 whitespace-nowrap">Save</button>' +
      '<button type="button" class="group-open-full-editor text-xs font-semibold text-brand-700 hover:underline text-center" data-organiser-id="' +
      attrEsc(o.id) +
      '" data-group-email="' +
      attrEsc(o.email || '') +
      '">Full editor</button>' +
      '<span class="group-cleanup-msg text-xs text-center"></span></div></form>' +
      groupModerationPanelHtml(o) +
      entityActivityPanelHtml({
        entityType: 'organiser',
        entityId: o.id,
        organiserId: o.id,
      })
    );
  }

  function issueGroupWarning(organiserId, panel, triggerBtn) {
    if (!organiserId || !panel) return;
    var reasonEl = panel.querySelector('.group-warning-reason');
    var detailsEl = panel.querySelector('.group-warning-details');
    var msgEl = panel.querySelector('.group-moderation-msg');
    var reason = reasonEl ? String(reasonEl.value || '').trim() : '';
    if (!reason) {
      if (msgEl) {
        msgEl.textContent = 'Select a warning reason.';
        msgEl.className = 'group-moderation-msg text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (triggerBtn) triggerBtn.disabled = true;
    if (msgEl) {
      msgEl.textContent = 'Issuing warning…';
      msgEl.className = 'group-moderation-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/organisers', {
      action: 'issue_warning',
      id: organiserId,
      reason: reason,
      details: detailsEl ? String(detailsEl.value || '').trim() : '',
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not issue warning');
        if (msgEl) {
          msgEl.textContent = data.message || 'Warning recorded.';
          msgEl.className = 'group-moderation-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .catch(function (err) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Could not issue warning';
          msgEl.className = 'group-moderation-msg text-xs text-red-700 font-semibold';
        }
        if (triggerBtn) triggerBtn.disabled = false;
      });
  }

  function reinstateGroup(organiserId, panel, triggerBtn) {
    if (!organiserId) return;
    if (
      !window.confirm(
        'Reinstate this organiser profile?\n\nTheir listing will be published again, but events stay unpublished until they republish manually. Warning history remains on record.'
      )
    ) {
      return;
    }
    var msgEl = panel && panel.querySelector('.group-moderation-msg');
    if (triggerBtn) triggerBtn.disabled = true;
    if (msgEl) {
      msgEl.textContent = 'Reinstating…';
      msgEl.className = 'group-moderation-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/organisers', { action: 'reinstate_organiser', id: organiserId })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not reinstate');
        if (msgEl) {
          msgEl.textContent = data.message || 'Profile reinstated.';
          msgEl.className = 'group-moderation-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .catch(function (err) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Could not reinstate';
          msgEl.className = 'group-moderation-msg text-xs text-red-700 font-semibold';
        }
        if (triggerBtn) triggerBtn.disabled = false;
      });
  }

  function applyLogoPreviewToForm(form, logoUrl) {
    if (!form) return;
    var urlInput = form.querySelector('input[name="photo_url"]');
    if (urlInput) urlInput.value = logoUrl;
    var key = form.getAttribute('data-organiser-id');
    if (key) delete adminLogoPending[key];
    var zone = form.querySelector('[data-admin-logo-key]');
    if (!zone) return;
    var preview = zone.querySelector('.admin-logo-preview');
    var placeholder = zone.querySelector('.admin-logo-placeholder');
    if (preview && logoUrl) {
      preview.src = logoUrl;
      preview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
  }

  function fillGroupFromWebsite(btn) {
    var form = btn && btn.closest('.group-cleanup-form');
    if (!form) return;
    var msg = form.querySelector('.group-cleanup-msg');
    var website = formFieldVal(form, 'website');
    if (!website) {
      if (msg) {
        msg.textContent = 'Enter a website URL first.';
        msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold text-center';
      }
      return;
    }
    btn.disabled = true;
    if (msg) {
      msg.textContent = 'Reading website…';
      msg.className = 'group-cleanup-msg text-xs text-slate-500 text-center';
    }
    adminPost('/api/admin/organisers', { action: 'fetch_website_meta', url: website })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not read website');
        if (data.logo_url) applyLogoPreviewToForm(form, data.logo_url);
        if (data.description) {
          var desc = form.querySelector('[name="description"]');
          if (desc) desc.value = data.description;
        }
        if (msg) {
          msg.textContent = data.message || 'Filled — review and Save.';
          msg.className = 'group-cleanup-msg text-xs text-emerald-700 font-semibold text-center';
        }
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not read website';
          msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold text-center';
        }
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function refreshGroupCleanupPage() {
    return fetchGroupCleanup(groupCleanupState.page).then(function (data) {
      renderGroupCleanupList(data);
      bindGroupCleanupPageUi();
      updateGroupBulkBar();
      return data;
    });
  }

  function bindExpandedGroupPanels() {
    if (!main) return;
    main.querySelectorAll('.group-cleanup-panel:not(.hidden)').forEach(function (panel) {
      bindAdminLogoZones(panel);
    });
  }

  function goToGroupPage(page) {
    var next = Math.max(0, page);
    var listEl = document.getElementById('group-cleanup-list');
    fetchGroupCleanup(next).then(function (data) {
      renderGroupCleanupList(data);
      bindGroupCleanupPageUi();
      updateGroupBulkBar();
      if (listEl && listEl.scrollIntoView) {
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function syncGroupCleanupFilterUi() {
    var el = document.getElementById('group-cleanup-visibility');
    if (el) el.value = groupCleanupState.visibility || '';
    el = document.getElementById('group-cleanup-incomplete');
    if (el) el.checked = !!groupCleanupState.incomplete;
    el = document.getElementById('group-cleanup-exclude-hidden');
    if (el) el.checked = !!groupCleanupState.excludeHidden && !groupCleanupState.visibility;
    if (!main) return;
    main.querySelectorAll('[data-group-quick]').forEach(function (btn) {
      var key = btn.getAttribute('data-group-quick');
      var active = false;
      if (key === 'browse' || key === 'draft' || key === 'unpublished') {
        active = groupCleanupState.visibility === key;
      } else if (key === 'incomplete') {
        active = !!groupCleanupState.incomplete;
      }
      btn.classList.toggle('ring-2', active);
      btn.classList.toggle('ring-brand-700', active);
      btn.classList.toggle('bg-brand-50', active);
    });
  }

  function fetchGroupCleanup(pageIndex, options) {
    options = options || {};
    if (groupCleanupState.loading) return Promise.resolve(groupCleanupCache);
    groupCleanupState.loading = true;
    var page =
      typeof pageIndex === 'number' && !isNaN(pageIndex) ? Math.max(0, pageIndex) : groupCleanupState.page;
    groupCleanupState.page = page;
    var params = new URLSearchParams();
    params.set('offset', String(page * GROUP_PAGE_SIZE));
    params.set('limit', String(GROUP_PAGE_SIZE));
    if (groupCleanupState.q) params.set('q', groupCleanupState.q);
    if (groupCleanupState.incomplete) params.set('incomplete', '1');
    if (groupCleanupState.visibility) params.set('visibility', groupCleanupState.visibility);
    else if (groupCleanupState.excludeHidden) params.set('exclude_hidden', '1');
    if (options.organiserId || groupCleanupState.focusOrganiserId) {
      params.set('id', String(options.organiserId || groupCleanupState.focusOrganiserId));
    }
    return adminGet('/api/admin/organisers?' + params.toString())
      .then(function (data) {
        groupCleanupState.loading = false;
        if (!data || data.error) return data;
        groupCleanupCache = data;
        groupCleanupState.total = data.total || (data.organisers || []).length;
        return groupCleanupCache;
      })
      .catch(function () {
        groupCleanupState.loading = false;
        return { error: 'network_error' };
      });
  }

  function fetchEventCleanup(pageIndex) {
    if (eventCleanupState.loading) return Promise.resolve(eventCleanupCache);
    eventCleanupState.loading = true;

    var page =
      typeof pageIndex === 'number' && !isNaN(pageIndex) ? Math.max(0, pageIndex) : eventCleanupState.page;
    eventCleanupState.page = page;
    var params = new URLSearchParams();
    params.set('offset', String(page * EVENT_PAGE_SIZE));
    params.set('limit', String(EVENT_PAGE_SIZE));
    if (eventCleanupState.organiserId) params.set('organiser_id', eventCleanupState.organiserId);
    if (eventCleanupState.unlinked) params.set('unlinked', '1');
    if (eventCleanupState.noDate) params.set('no_date', '1');
    if (eventCleanupState.when) params.set('when', eventCleanupState.when);
    if (eventCleanupState.status) params.set('status', eventCleanupState.status);
    if (eventCleanupState.approval) params.set('approval_status', eventCleanupState.approval);
    if (eventCleanupState.sort) params.set('sort', eventCleanupState.sort);
    if (eventCleanupState.q) params.set('q', eventCleanupState.q);
    return adminGet('/api/admin/events?' + params.toString())
      .then(function (data) {
        eventCleanupState.loading = false;
        if (!data || data.error) return data;
        var batch = data.events || [];
        eventCleanupState.total = data.total != null ? data.total : batch.length;
        eventCleanupState.items = batch.slice();
        eventCleanupCache = Object.assign({}, data, { events: eventCleanupState.items });
        return eventCleanupCache;
      })
      .catch(function () {
        eventCleanupState.loading = false;
        return { error: 'network_error' };
      });
  }

  function resetEventCleanupScroll(target) {
    var mainEl = document.getElementById('admin-main');
    if (target === 'list') {
      var list = document.getElementById('event-cleanup-list');
      if (list && typeof list.scrollIntoView === 'function') {
        list.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
      return;
    }
    if (mainEl) mainEl.scrollTop = 0;
  }

  function goToEventPage(page) {
    eventCleanupState.page = Math.max(0, page);
    eventCleanupState.expanded = {};
    return fetchEventCleanup(eventCleanupState.page)
      .then(applyEventCleanupData)
      .then(function () {
        resetEventCleanupScroll('list');
      });
  }

  function createGroupCleanupForm(form) {
    var msg = document.getElementById('group-create-msg');
    var btn = form.querySelector('[type="submit"]');
    var name = formFieldVal(form, 'name').trim();
    var email = formFieldVal(form, 'email').trim();
    if (!name) {
      if (msg) {
        msg.textContent = 'Enter a group name.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (!email) {
      if (msg) {
        msg.textContent = 'Enter a contact email.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating group…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/organisers', {
      action: 'create_group',
      name: name,
      contact_email: email,
      website: formFieldVal(form, 'website').trim(),
      description: formFieldVal(form, 'description').trim(),
      provision_login: true,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        if (msg) {
          msg.textContent = data.message || 'Group created.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        var newId = data.organiser && data.organiser.id;
        form.reset();
        groupCleanupState.createOpen = false;
        groupCleanupState.page = 0;
        groupCleanupState.q = '';
        invalidateEventOrganiserOptionsCache();
        var panel = document.getElementById('group-create-panel');
        var toggle = document.getElementById('group-create-toggle');
        if (panel) panel.classList.add('hidden');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = '+ New networking group';
        }
        var search = document.getElementById('group-cleanup-search');
        if (search) search.value = '';
        if (newId) groupCleanupState.expanded[newId] = true;
        return fetchGroupCleanup(0);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create group';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function saveGroupCleanupForm(form) {
    var id = form.getAttribute('data-organiser-id');
    var msg = form.querySelector('.group-cleanup-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'group-cleanup-msg text-xs text-slate-500';
    }
    logoPayloadForKey(id, form)
      .then(function (logoPayload) {
        var hideInput = form.querySelector('[name="hide_from_browse"]');
        var payload = {
          id: id,
          name: formFieldVal(form, 'name'),
          contact_email: formFieldVal(form, 'contact_email'),
          description: formFieldVal(form, 'description'),
          website: formFieldVal(form, 'website'),
          photo_url: logoPayload.photo_url,
          logoBase64: logoPayload.logoBase64,
          logoMime: logoPayload.logoMime,
          logoFilename: logoPayload.logoFilename,
        };
        if (hideInput && !hideInput.disabled) {
          payload.hide_from_browse = hideInput.checked;
        }
        return adminPost('/api/admin/organisers', payload);
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
        delete adminLogoPending[id];
        if (msg) {
          msg.textContent = 'Saved.';
          msg.className = 'group-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function provisionGroupLogin(organiserId, btn) {
    if (btn) btn.disabled = true;
    return adminPost('/api/admin/organisers', { action: 'provision_user', id: organiserId })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not create login');
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not create login');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function impersonateOrganiserGroup(organiserId, email, redirect) {
    var payload = {
      organiserId: organiserId,
      email: email || '',
      view: 'organiser',
      provision: true,
    };
    if (redirect) payload.redirect = redirect;
    adminPost('/api/admin/impersonate', payload)
      .then(function (data) {
        if (!data.ok) {
          window.alert(data.message || data.error || 'Could not impersonate group.');
          return;
        }
        try {
          sessionStorage.removeItem('hub_nav_session_v1');
        } catch (e) {
          /* ignore */
        }
        window.location.href = '../' + String(data.redirect || redirect || '/organiser/').replace(/^\//, '');
      })
      .catch(function () {
        window.alert('Request failed. Try again.');
      });
  }

  function openGroupFullEditor(organiserId, email, btn) {
    if (btn) btn.disabled = true;
    var redirect = '/organiser/group-edit?id=' + encodeURIComponent(organiserId);
    adminPost('/api/admin/impersonate', {
      organiserId: organiserId,
      email: email || '',
      view: 'organiser',
      provision: true,
      redirect: redirect,
    })
      .then(function (data) {
        if (!data.ok) {
          window.alert(data.message || data.error || 'Could not open full editor.');
          if (btn) btn.disabled = false;
          return;
        }
        try {
          sessionStorage.removeItem('hub_nav_session_v1');
        } catch (e) {
          /* ignore */
        }
        window.location.href = '../' + String(data.redirect || redirect).replace(/^\//, '');
      })
      .catch(function () {
        window.alert('Request failed. Try again.');
        if (btn) btn.disabled = false;
      });
  }

  function setGroupEmailsEnabled(organiserId, enabled, btn) {
    if (btn) btn.disabled = true;
    adminPost('/api/admin/organisers', {
      action: 'set_emails_enabled',
      id: organiserId,
      emails_enabled: enabled,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not update emails');
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not update email setting');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function mergeSelectedGroups() {
    var ids = getSelectedGroupIds();
    var primarySelect = document.getElementById('group-merge-primary');
    var msg = document.getElementById('group-merge-msg');
    var btn = document.getElementById('group-merge-btn');
    if (ids.length < 2) return;

    var primaryId = primarySelect ? primarySelect.value : ids[0];
    var rows = selectedGroupRows();
    var primary = rows.find(function (o) {
      return String(o.id) === String(primaryId);
    });
    var duplicateCount = ids.length - 1;
    var primaryLabel = (primary && primary.name) || 'selected group';
    var duplicateEmails = rows
      .filter(function (o) {
        return String(o.id) !== String(primaryId) && o.email;
      })
      .map(function (o) {
        return o.email;
      });
    var teamNote =
      duplicateEmails.length === 1
        ? ' Contact email ' + duplicateEmails[0] + ' will be added as a team editor on the primary account (unless it already owns the profile).'
        : duplicateEmails.length > 1
          ? ' Contact emails from merged groups will be added as team editors on the primary account.'
          : '';
    var confirmMsg =
      'Merge ' +
      duplicateCount +
      ' duplicate group' +
      (duplicateCount === 1 ? '' : 's') +
      ' into "' +
      primaryLabel +
      '"?\n\n' +
      'Events will move to the primary profile.' +
      teamNote +
      ' Duplicate profiles will be deleted. This cannot be undone.';
    if (!window.confirm(confirmMsg)) return;

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Merging groups…';
      msg.className = 'text-xs text-slate-500';
    }

    adminPost('/api/admin/organisers', {
      action: 'merge_groups',
      primaryId: primaryId,
      ids: ids,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Merge failed');
        clearSelectedGroups();
        if (msg) {
          msg.textContent =
            'Merged ' +
            (data.merged || duplicateCount) +
            ' group' +
            ((data.merged || duplicateCount) === 1 ? '' : 's') +
            ', moved ' +
            (data.eventsMoved || 0) +
            ' event' +
            ((data.eventsMoved || 0) === 1 ? '' : 's') +
            ', added ' +
            (data.teamAdded || 0) +
            ' team member' +
            ((data.teamAdded || 0) === 1 ? '' : 's') +
            '.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        invalidateEventOrganiserOptionsCache();
        return fetchGroupCleanup(0);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
        updateGroupBulkBar();
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not merge groups';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function groupDeleteConfirmMsg(count, label, eventCount) {
    var msg =
      'Delete ' +
      (count === 1 && label ? '"' + label + '"' : count + ' selected group' + (count === 1 ? '' : 's')) +
      '?\n\n';
    if (eventCount > 0) {
      msg +=
        eventCount +
        ' linked event' +
        (eventCount === 1 ? '' : 's') +
        ' will become unlinked from a group profile. ';
    }
    msg += 'This cannot be undone.';
    return msg;
  }

  function groupDeleteResultMsg(data, requestedCount) {
    if (data.message) return data.message;
    var deleted = data.deleted || 0;
    var alreadyGone = data.alreadyGone || 0;
    if (!deleted && alreadyGone) {
      var goneMsg =
        alreadyGone === 1
          ? 'Group profile was already removed'
          : alreadyGone + ' group profiles were already removed';
      if (data.eventsUnlinked) {
        goneMsg +=
          ' — cleared ' +
          data.eventsUnlinked +
          ' broken event link' +
          (data.eventsUnlinked === 1 ? '' : 's');
      }
      return goneMsg + '.';
    }
    var msg =
      'Deleted ' +
      (deleted || requestedCount) +
      ' group' +
      ((deleted || requestedCount) === 1 ? '' : 's');
    if (data.eventsUnlinked) {
      msg +=
        ', ' +
        data.eventsUnlinked +
        ' event' +
        (data.eventsUnlinked === 1 ? '' : 's') +
        ' unlinked';
    }
    if (alreadyGone) {
      msg +=
        ' (' +
        alreadyGone +
        ' profile' +
        (alreadyGone === 1 ? ' was' : 's were') +
        ' already removed)';
    }
    return msg + '.';
  }

  function showGroupDeleteFeedback(row, text, isError) {
    if (!row) return;
    var slot = row.querySelector('.group-delete-feedback');
    if (!slot) {
      slot = document.createElement('p');
      slot.className = 'group-delete-feedback text-xs mt-1';
      var header = row.querySelector('.flex.flex-wrap.items-center.justify-between');
      if (header) header.appendChild(slot);
    }
    slot.textContent = text;
    slot.className =
      'group-delete-feedback text-xs mt-1 ' +
      (isError ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold');
  }

  function deleteGroupsByIds(ids, opts) {
    opts = opts || {};
    var msgEl = opts.msgEl;
    var btn = opts.btn;
    var row = opts.row;
    if (!ids.length) return;

    if (btn) btn.disabled = true;
    if (row) showGroupDeleteFeedback(row, 'Deleting…', false);
    if (msgEl) {
      msgEl.textContent = 'Deleting group' + (ids.length === 1 ? '' : 's') + '…';
      msgEl.className = 'text-xs text-slate-500';
    }

    adminPost('/api/admin/organisers', { action: 'delete_groups', ids: ids })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
        ids.forEach(function (id) {
          forgetSelectedGroup(id);
          delete groupCleanupState.expanded[id];
        });
        var resultMsg = groupDeleteResultMsg(data, ids.length);
        if (msgEl) {
          msgEl.textContent = resultMsg;
          msgEl.className = 'text-xs text-emerald-700 font-semibold';
        }
        if (row) showGroupDeleteFeedback(row, resultMsg, false);
        invalidateEventOrganiserOptionsCache();
        return fetchGroupCleanup(groupCleanupState.page);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
        updateGroupBulkBar();
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        var errMsg = err.message || 'Could not delete groups';
        if (msgEl) {
          msgEl.textContent = errMsg;
          msgEl.className = 'text-xs text-red-700 font-semibold';
        }
        if (row) showGroupDeleteFeedback(row, errMsg, true);
        if (btn) btn.disabled = false;
      });
  }

  function deleteSelectedGroups() {
    var ids = getSelectedGroupIds();
    if (!ids.length) return;
    var rows = selectedGroupRows();
    var eventCount = rows.reduce(function (sum, o) {
      return sum + (o.event_count || 0);
    }, 0);
    if (!window.confirm(groupDeleteConfirmMsg(ids.length, null, eventCount))) return;
    deleteGroupsByIds(ids, {
      msgEl: document.getElementById('group-delete-msg'),
      btn: document.getElementById('group-delete-btn'),
    });
  }

  function bulkSetGroupsHiddenFromBrowse(hide) {
    var rows = selectedGroupRows();
    var eligible = rows.filter(function (o) {
      return !o.hub_suspended;
    });
    var suspendedCount = rows.length - eligible.length;
    if (!eligible.length) {
      window.alert('None of the selected profiles can be updated — suspended profiles must be reinstated first.');
      return;
    }
    var ids = eligible.map(function (o) {
      return o.id;
    });
    var confirmMsg =
      (hide
        ? 'Hide ' +
          ids.length +
          ' group profile' +
          (ids.length === 1 ? '' : 's') +
          ' from the public organiser directory?\n\nThey can still claim via invite email and add events.'
        : 'Show ' +
          ids.length +
          ' group profile' +
          (ids.length === 1 ? '' : 's') +
          ' on the public organiser directory again?') +
      (suspendedCount
        ? '\n\n' + suspendedCount + ' suspended profile' + (suspendedCount === 1 ? '' : 's') + ' will be skipped.'
        : '');
    if (!window.confirm(confirmMsg)) return;

    var msgEl = document.getElementById('group-browse-msg');
    var hideBtn = document.getElementById('group-hide-browse-btn');
    var showBtn = document.getElementById('group-show-browse-btn');
    if (hideBtn) hideBtn.disabled = true;
    if (showBtn) showBtn.disabled = true;
    if (msgEl) {
      msgEl.textContent = hide ? 'Hiding from browse…' : 'Showing on browse…';
      msgEl.className = 'text-xs text-slate-500';
    }

    adminPost('/api/admin/organisers', { action: 'bulk_update', ids: ids, hide_from_browse: hide })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Bulk update failed');
        clearSelectedGroups();
        if (main) {
          main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
            cb.checked = false;
          });
        }
        var selectPage = document.getElementById('group-cleanup-select-page');
        if (selectPage) selectPage.checked = false;
        if (msgEl) {
          msgEl.textContent =
            (hide ? 'Hidden ' : 'Shown ') +
            (data.updated || ids.length) +
            ' profile' +
            ((data.updated || ids.length) === 1 ? '' : 's') +
            ' on browse.' +
            (suspendedCount ? ' ' + suspendedCount + ' suspended skipped.' : '');
          msgEl.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Could not update browse visibility';
          msgEl.className = 'text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (hideBtn) hideBtn.disabled = false;
        if (showBtn) showBtn.disabled = false;
      });
  }

  function deleteSingleGroup(id, name, eventCount, btn) {
    if (!id) return;
    if (!window.confirm(groupDeleteConfirmMsg(1, name || 'this group', eventCount || 0))) return;
    var row = btn && btn.closest('[data-organiser-id-row]');
    deleteGroupsByIds([id], { btn: btn, row: row });
  }

  function saveGroupBulkForm(form) {
    var ids = getSelectedGroupIds();
    var msg = document.getElementById('group-bulk-msg');
    var btn = form.querySelector('[type="submit"]');
    if (!ids.length) return;
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Applying to ' + ids.length + ' groups…';
      msg.className = 'text-xs text-slate-500';
    }
    logoPayloadForKey('bulk', form)
      .then(function (logoPayload) {
        var payload = { action: 'bulk_update', ids: ids };
        var desc = formFieldVal(form, 'bulk_description');
        var site = formFieldVal(form, 'bulk_website');
        var bulkEmail = formFieldVal(form, 'bulk_contact_email').trim();
        if (desc) payload.description = desc;
        if (site) payload.website = site;
        if (bulkEmail) payload.contact_email = bulkEmail;
        if (logoPayload.photo_url) payload.photo_url = logoPayload.photo_url;
        if (logoPayload.logoBase64) {
          payload.logoBase64 = logoPayload.logoBase64;
          payload.logoMime = logoPayload.logoMime;
          payload.logoFilename = logoPayload.logoFilename;
        }
        if (!payload.description && !payload.website && !payload.contact_email && !payload.photo_url && !payload.logoBase64) {
          throw new Error('Fill in at least one field to apply.');
        }
        return adminPost('/api/admin/organisers', payload);
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Bulk update failed');
        delete adminLogoPending.bulk;
        clearSelectedGroups();
        if (msg) {
          msg.textContent = 'Updated ' + (data.updated || ids.length) + ' groups.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not apply bulk update';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function saveEventCleanupForm(form) {
    var id = form.getAttribute('data-event-id');
    var msg = form.querySelector('.event-cleanup-msg');
    var btn = form.querySelector('[type="submit"]');
    var photoKey = 'event-photo-' + id;
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'event-cleanup-msg text-xs text-slate-500';
    }
    eventPhotoPayloadForKey(photoKey, form)
      .then(function (photoPayload) {
        return adminPost('/api/admin/events', Object.assign(
          {
            id: id,
            title: formFieldVal(form, 'title'),
            organiser_id: formFieldVal(form, 'organiser_id') || null,
            organiser_contact_email: formFieldVal(form, 'organiser_contact_email').trim(),
            starts_at: formFieldVal(form, 'starts_at') || null,
            event_type: formFieldVal(form, 'event_type') || null,
            meeting_type: formFieldVal(form, 'meeting_type') || null,
            status: formFieldVal(form, 'status') || null,
          },
          eventDetailsPayloadFromForm(form),
          photoPayload
        ));
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
        delete adminLogoPending[photoKey];
        if (msg) {
          msg.textContent = 'Saved.';
          msg.className = 'event-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshEventCleanupPage();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'event-cleanup-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function createEventCleanupForm(form) {
    var msg = form.querySelector('.event-create-msg');
    var btn = form.querySelector('[type="submit"]');
    var organiserId = formFieldVal(form, 'organiser_id');
    var occurrences = collectEventCreateOccurrences(form);
    var status = formFieldVal(form, 'status') || 'draft';
    if (!organiserId) {
      if (msg) {
        msg.textContent = 'Choose an organiser / group first.';
        msg.className = 'event-create-msg text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (status !== 'draft' && !occurrences.length) {
      if (msg) {
        msg.textContent = 'Add at least one date before publishing.';
        msg.className = 'event-create-msg text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating…';
      msg.className = 'event-create-msg text-xs text-slate-500';
    }
    eventPhotoPayloadForKey('event-create-photo', form)
      .then(function (photoPayload) {
        return adminPost('/api/admin/events', Object.assign(
          {
            action: 'create',
            title: formFieldVal(form, 'title'),
            organiser_id: organiserId,
            occurrences: occurrences,
            event_type: formFieldVal(form, 'event_type') || 'Meeting',
            meeting_type: formFieldVal(form, 'meeting_type') || 'In person',
            status: status,
          },
          eventDetailsPayloadFromForm(form),
          photoPayload
        ));
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        var count = Array.isArray(data.events) ? data.events.length : 1;
        if (msg) {
          msg.textContent =
            count > 1
              ? count + ' events created as a date series.'
              : 'Event created.';
          msg.className = 'event-create-msg text-xs text-emerald-700 font-semibold';
        }
        resetEventCreateForm(form);
        delete adminLogoPending['event-create-photo'];
        if (btn) btn.disabled = false;
        return refreshEventCleanupData();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create event';
          msg.className = 'event-create-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function bindGroupCleanupPageUi() {
    bindExpandedGroupPanels();
    var bulk = document.getElementById('group-cleanup-bulk');
    if (bulk) bindAdminLogoZones(bulk);
  }

  function handleGroupCleanupClick(e) {
    var groupQuick = e.target.closest('[data-group-quick]');
    if (groupQuick) {
      var gKey = groupQuick.getAttribute('data-group-quick');
      if (gKey === 'clear') {
        groupCleanupState.q = '';
        groupCleanupState.incomplete = false;
        groupCleanupState.excludeHidden = false;
        groupCleanupState.visibility = '';
      } else if (gKey === 'browse' || gKey === 'draft' || gKey === 'unpublished') {
        groupCleanupState.visibility = groupCleanupState.visibility === gKey ? '' : gKey;
        if (groupCleanupState.visibility) groupCleanupState.excludeHidden = false;
      } else if (gKey === 'incomplete') {
        groupCleanupState.incomplete = !groupCleanupState.incomplete;
      }
      groupCleanupState.page = 0;
      syncGroupCleanupFilterUi();
      var searchEl = document.getElementById('group-cleanup-search');
      if (searchEl) searchEl.value = groupCleanupState.q || '';
      fetchGroupCleanup(0).then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
      });
      return;
    }

    var activityLoad = e.target.closest('.entity-activity-load');
    if (activityLoad) {
      loadEntityActivityPanel(activityLoad.closest('.entity-activity-panel'));
      return;
    }

    var approveClaimBtn = e.target.closest('[data-approve-organiser-claim-request]');
    if (approveClaimBtn) {
      var approveRequestId = approveClaimBtn.getAttribute('data-approve-organiser-claim-request');
      var approveOrganiserName = approveClaimBtn.getAttribute('data-claim-organiser-name') || 'this group';
      if (!approveRequestId) return;
      if (
        !window.confirm(
          'Approve this claim request for “' +
            approveOrganiserName +
            '”? The claimant email will become the profile contact and they will receive the claim invite email.'
        )
      ) {
        return;
      }
      approveClaimBtn.disabled = true;
      adminPost('/api/admin/organisers', {
        action: 'approve_organiser_claim_request',
        requestId: approveRequestId,
      })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not approve claim request');
          var successMsg = (data && data.message) || 'Claim invite sent.';
          if (data && data.claimUrl) {
            successMsg += '\n\nClaim link (for your records):\n' + data.claimUrl;
          }
          window.alert(successMsg);
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          approveClaimBtn.disabled = false;
          window.alert(err.message || 'Could not approve claim request.');
        });
      return;
    }

    var resolveClaimRequestBtn = e.target.closest('[data-resolve-organiser-claim-request]');
    if (resolveClaimRequestBtn) {
      var claimRequestId = resolveClaimRequestBtn.getAttribute('data-resolve-organiser-claim-request');
      if (!claimRequestId) return;
      if (!window.confirm('Mark this claim request as resolved without sending an invite?')) return;
      resolveClaimRequestBtn.disabled = true;
      adminPost('/api/admin/organisers', {
        action: 'resolve_organiser_claim_request',
        requestId: claimRequestId,
      })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not resolve claim request');
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          resolveClaimRequestBtn.disabled = false;
          window.alert(err.message || 'Could not resolve claim request.');
        });
      return;
    }

    var resolveDisputeBtn = e.target.closest('[data-resolve-claim-dispute]');
    if (resolveDisputeBtn) {
      var disputeId = resolveDisputeBtn.getAttribute('data-resolve-claim-dispute');
      if (!disputeId) return;
      if (!window.confirm('Mark this dispute as resolved? The alert will clear from Command Centre.')) return;
      resolveDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'resolve_claim_dispute', disputeId: disputeId })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not resolve dispute');
          return refreshAdminNotifications();
        })
        .catch(function (err) {
          resolveDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not resolve dispute.');
        });
      return;
    }

    var clearDisputeBtn = e.target.closest('[data-clear-dispute-email]');
    if (clearDisputeBtn) {
      var clearDisputeId = clearDisputeBtn.getAttribute('data-clear-dispute-email');
      var clearName = clearDisputeBtn.getAttribute('data-dispute-organiser-name') || 'this group';
      if (!clearDisputeId) return;
      if (
        !window.confirm(
          'Clear the contact email on “' +
            clearName +
            '” and mark this dispute resolved? The user will no longer be matched to this profile on login.'
        )
      ) {
        return;
      }
      clearDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'clear_disputed_profile_email', disputeId: clearDisputeId })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not clear profile email');
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          clearDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not clear profile email.');
        });
      return;
    }

    var deleteDisputeBtn = e.target.closest('[data-dispute-delete-profile]');
    if (deleteDisputeBtn) {
      var deleteDisputeId = deleteDisputeBtn.getAttribute('data-dispute-delete-profile');
      var deleteOrganiserId = deleteDisputeBtn.getAttribute('data-dispute-organiser-id');
      var deleteName = deleteDisputeBtn.getAttribute('data-dispute-organiser-name') || 'this group';
      if (!deleteDisputeId || !deleteOrganiserId) return;
      if (
        !window.confirm(
          'Permanently delete “' +
            deleteName +
            '”? Linked events will stay on the platform but become unlinked. The dispute will be marked resolved.'
        )
      ) {
        return;
      }
      deleteDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'delete_groups', ids: [deleteOrganiserId] })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not delete profile');
          return adminPost('/api/admin/organisers', { action: 'resolve_claim_dispute', disputeId: deleteDisputeId });
        })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Profile deleted but dispute not cleared');
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          deleteDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not delete profile.');
        });
      return;
    }

    if (!document.getElementById('group-cleanup-list')) return;

    var pageBtn = e.target.closest('[data-group-page]');
    if (pageBtn) {
      var page = parseInt(pageBtn.getAttribute('data-group-page'), 10);
      if (!isNaN(page)) goToGroupPage(page);
      return;
    }

    var toggle = e.target.closest('[data-toggle-group-edit]');
    if (toggle) {
      var row = toggle.closest('[data-organiser-id-row]');
      var id = row && row.getAttribute('data-organiser-id-row');
      var panel = row && row.querySelector('.group-cleanup-panel');
      if (panel && id) {
        var opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        if (opening) {
          groupCleanupState.expanded[id] = true;
          bindAdminLogoZones(panel);
          toggle.textContent = 'Close';
        } else {
          delete groupCleanupState.expanded[id];
          toggle.textContent = 'Edit profile';
        }
      }
      return;
    }

    var fillBtn = e.target.closest('.group-fill-from-website');
    if (fillBtn) {
      fillGroupFromWebsite(fillBtn);
      return;
    }

    var warnBtn = e.target.closest('.group-issue-warning');
    if (warnBtn) {
      var warnPanel = warnBtn.closest('.group-moderation-panel');
      issueGroupWarning(warnBtn.getAttribute('data-organiser-id'), warnPanel, warnBtn);
      return;
    }

    var reinstateBtn = e.target.closest('.group-reinstate');
    if (reinstateBtn) {
      var reinstatePanel = reinstateBtn.closest('.group-moderation-panel');
      reinstateGroup(reinstateBtn.getAttribute('data-organiser-id'), reinstatePanel, reinstateBtn);
      return;
    }

    if (e.target.closest('#group-create-toggle')) {
      var createPanel = document.getElementById('group-create-panel');
      var createToggle = document.getElementById('group-create-toggle');
      if (!createPanel || !createToggle) return;
      groupCleanupState.createOpen = !groupCleanupState.createOpen;
      createPanel.classList.toggle('hidden', !groupCleanupState.createOpen);
      createToggle.setAttribute('aria-expanded', groupCleanupState.createOpen ? 'true' : 'false');
      createToggle.textContent = groupCleanupState.createOpen
        ? 'Cancel new group'
        : '+ New networking group';
      if (groupCleanupState.createOpen) {
        var nameInput = createPanel.querySelector('[name="name"]');
        if (nameInput) nameInput.focus();
      }
      return;
    }

    if (e.target.closest('#group-bulk-clear')) {
      clearSelectedGroups();
      if (main) {
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
      }
      var selectPage = document.getElementById('group-cleanup-select-page');
      if (selectPage) selectPage.checked = false;
      updateGroupBulkBar();
      return;
    }

    var unselectBtn = e.target.closest('[data-unselect-group]');
    if (unselectBtn) {
      var unselectId = unselectBtn.getAttribute('data-unselect-group');
      forgetSelectedGroup(unselectId);
      if (main) {
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          if (String(cb.value) === String(unselectId)) cb.checked = false;
        });
      }
      updateGroupBulkBar();
      return;
    }

    if (e.target.closest('#group-merge-btn')) {
      mergeSelectedGroups();
      return;
    }

    if (e.target.closest('#group-hide-browse-btn')) {
      bulkSetGroupsHiddenFromBrowse(true);
      return;
    }

    if (e.target.closest('#group-show-browse-btn')) {
      bulkSetGroupsHiddenFromBrowse(false);
      return;
    }

    if (e.target.closest('#group-delete-btn')) {
      deleteSelectedGroups();
      return;
    }

    var deleteGroupBtn = e.target.closest('[data-delete-group]');
    if (deleteGroupBtn) {
      deleteSingleGroup(
        deleteGroupBtn.getAttribute('data-delete-group'),
        deleteGroupBtn.getAttribute('data-group-name'),
        parseInt(deleteGroupBtn.getAttribute('data-group-event-count'), 10) || 0,
        deleteGroupBtn
      );
      return;
    }

    var provisionBtn = e.target.closest('[data-provision-group-login]');
    if (provisionBtn) {
      provisionGroupLogin(provisionBtn.getAttribute('data-provision-group-login'), provisionBtn);
      return;
    }

    var impersonateGroupBtn = e.target.closest('[data-impersonate-group]');
    if (impersonateGroupBtn) {
      impersonateOrganiserGroup(
        impersonateGroupBtn.getAttribute('data-impersonate-group'),
        impersonateGroupBtn.getAttribute('data-group-email')
      );
      return;
    }

    var fullEditorBtn = e.target.closest('.group-open-full-editor');
    if (fullEditorBtn) {
      openGroupFullEditor(
        fullEditorBtn.getAttribute('data-organiser-id'),
        fullEditorBtn.getAttribute('data-group-email'),
        fullEditorBtn
      );
      return;
    }

    var enableEmailsBtn = e.target.closest('[data-enable-group-emails]');
    if (enableEmailsBtn) {
      setGroupEmailsEnabled(enableEmailsBtn.getAttribute('data-enable-group-emails'), true, enableEmailsBtn);
      return;
    }

    var disableEmailsBtn = e.target.closest('[data-disable-group-emails]');
    if (disableEmailsBtn) {
      if (
        !window.confirm(
          'Block emails for this group? They will not receive invites, reminders, or password-reset emails until you enable them again.'
        )
      ) {
        return;
      }
      setGroupEmailsEnabled(disableEmailsBtn.getAttribute('data-disable-group-emails'), false, disableEmailsBtn);
    }
  }

  function bindGroupCleanupForms() {
    if (window.__groupCleanupEventsBound) return;
    window.__groupCleanupEventsBound = true;

    document.body.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList || !form.closest('#admin-main')) return;
      if (form.id === 'group-create-form') {
        e.preventDefault();
        createGroupCleanupForm(form);
      } else if (form.classList.contains('group-cleanup-form')) {
        e.preventDefault();
        saveGroupCleanupForm(form);
      } else if (form.id === 'group-bulk-form') {
        e.preventDefault();
        saveGroupBulkForm(form);
      }
    });

    document.body.addEventListener('input', function (e) {
      if (e.target.id !== 'group-cleanup-search') return;
      clearTimeout(groupSearchTimer);
      groupSearchTimer = setTimeout(function () {
        groupCleanupState.q = e.target.value || '';
        groupCleanupState.page = 0;
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
      }, 300);
    });

    document.body.addEventListener('change', function (e) {
      if (e.target.id === 'group-cleanup-incomplete') {
        groupCleanupState.incomplete = e.target.checked;
        groupCleanupState.page = 0;
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
        return;
      }
      if (e.target.id === 'group-cleanup-visibility') {
        groupCleanupState.visibility = e.target.value || '';
        if (groupCleanupState.visibility) groupCleanupState.excludeHidden = false;
        groupCleanupState.page = 0;
        syncGroupCleanupFilterUi();
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
        return;
      }
      if (e.target.id === 'group-cleanup-exclude-hidden') {
        groupCleanupState.excludeHidden = e.target.checked;
        if (groupCleanupState.excludeHidden) groupCleanupState.visibility = '';
        groupCleanupState.page = 0;
        syncGroupCleanupFilterUi();
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
        return;
      }
      if (e.target.classList && e.target.classList.contains('group-select-checkbox')) {
        var gid = e.target.value;
        if (e.target.checked) {
          var organisers = (groupCleanupCache && groupCleanupCache.organisers) || [];
          var row = organisers.find(function (o) {
            return String(o.id) === String(gid);
          });
          if (row) rememberSelectedGroup(row);
        } else forgetSelectedGroup(gid);
        updateGroupBulkBar();
        return;
      }
      if (e.target.id === 'group-cleanup-select-page' && main) {
        var pageOrganisers = (groupCleanupCache && groupCleanupCache.organisers) || [];
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            var pageRow = pageOrganisers.find(function (o) {
              return String(o.id) === String(cb.value);
            });
            if (pageRow) rememberSelectedGroup(pageRow);
          } else forgetSelectedGroup(cb.value);
        });
        updateGroupBulkBar();
      }
    });

    document.body.addEventListener('click', handleGroupCleanupClick);
  }

  function handleEventCleanupClick(e) {
    if (!document.getElementById('event-cleanup-list')) return;

    var activityLoad = e.target.closest('.entity-activity-load');
    if (activityLoad) {
      loadEntityActivityPanel(activityLoad.closest('.entity-activity-panel'));
      return;
    }

    var pageBtn = e.target.closest('[data-event-page]');
    if (pageBtn) {
      var page = parseInt(pageBtn.getAttribute('data-event-page'), 10);
      if (!isNaN(page)) goToEventPage(page);
      return;
    }

    if (e.target.closest('#event-bulk-clear')) {
      clearSelectedEvents();
      main.querySelectorAll('.event-select-checkbox').forEach(function (cb) {
        cb.checked = false;
      });
      var selectPage = document.getElementById('event-cleanup-select-page');
      if (selectPage) selectPage.checked = false;
      updateEventBulkBar();
      return;
    }
    var grantAccessBtn = e.target.closest('[data-grant-organiser-access]');
    if (grantAccessBtn) {
      var grantOrganiserId = grantAccessBtn.getAttribute('data-grant-organiser-access');
      if (!grantOrganiserId) return;
      grantAccessBtn.disabled = true;
      adminPost('/api/admin/events', { action: 'ensure_organiser_owner', organiser_id: grantOrganiserId })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Could not grant access');
          if (data.reason === 'missing_email') {
            throw new Error(
              'This organiser profile has no contact email. Add one in the event editor or Group profile cleanup, then try again.'
            );
          }
          var msg = grantAccessBtn.closest('.event-cleanup-form');
          var msgEl = msg && msg.querySelector('.event-cleanup-msg');
          if (msgEl) {
            msgEl.textContent = data.already
              ? 'Profile already claimed for ' + (data.email || 'owner') + '.'
              : 'Owner access granted.';
            msgEl.className = 'event-cleanup-msg text-xs text-emerald-700 font-semibold';
          }
        })
        .catch(function (err) {
          window.alert(err.message || 'Could not grant owner access');
        })
        .finally(function () {
          grantAccessBtn.disabled = false;
        });
      return;
    }
    if (e.target.closest('#event-bulk-grant-access')) {
      var bulkIds = getSelectedEventIds();
      if (!bulkIds.length) return;
      var bulkBtn = document.getElementById('event-bulk-grant-access');
      var bulkMsg = document.getElementById('event-bulk-msg');
      if (bulkBtn) bulkBtn.disabled = true;
      if (bulkMsg) bulkMsg.textContent = 'Granting access…';
      adminPost('/api/admin/events', { action: 'bulk_ensure_organiser_owner', ids: bulkIds })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Could not grant access');
          var skipped = (data.results || []).filter(function (row) {
            return row && row.reason === 'missing_email';
          }).length;
          if (bulkMsg) {
            bulkMsg.textContent =
              'Granted access for ' +
              String(data.organiser_count || 0) +
              ' organiser profile' +
              (Number(data.organiser_count) === 1 ? '' : 's') +
              '.' +
              (skipped
                ? ' ' +
                  skipped +
                  ' skipped — add a contact email on the organiser profile first (Group profile cleanup or event editor).'
                : '');
            bulkMsg.className = 'text-xs text-emerald-700 font-semibold';
          }
        })
        .catch(function (err) {
          if (bulkMsg) {
            bulkMsg.textContent = err.message || 'Could not grant access';
            bulkMsg.className = 'text-xs text-red-700 font-semibold';
          }
        })
        .finally(function () {
          if (bulkBtn) bulkBtn.disabled = false;
        });
      return;
    }
    var unselectBtn = e.target.closest('[data-unselect-event]');
    if (unselectBtn) {
      var unselectId = unselectBtn.getAttribute('data-unselect-event');
      forgetSelectedEvent(unselectId);
      main.querySelectorAll('.event-select-checkbox').forEach(function (cb) {
        if (String(cb.value) === String(unselectId)) cb.checked = false;
      });
      updateEventBulkBar();
      return;
    }
    if (e.target.closest('#event-unpublish-btn')) {
      unpublishSelectedEvents({
        getIds: getSelectedEventIds,
        clearSelection: clearSelectedEvents,
        refresh: function () {
          return refreshEventCleanupData().then(function () {
            updateEventBulkBar();
          });
        },
        msgId: 'event-unpublish-msg',
        btnId: 'event-unpublish-btn',
      });
      return;
    }
    if (e.target.closest('#event-delete-btn')) {
      deleteSelectedEvents(false);
      return;
    }
    if (e.target.closest('#event-force-delete-btn')) {
      deleteSelectedEvents(true);
      return;
    }
    var unpublishEventBtn = e.target.closest('[data-unpublish-event]');
    if (unpublishEventBtn) {
      var unpublishId = unpublishEventBtn.getAttribute('data-unpublish-event');
      promptAdminUnpublish(1)
        .then(function (payload) {
          unpublishEventBtn.disabled = true;
          return adminPost('/api/admin/events', {
            action: 'bulk_unpublish',
            ids: [unpublishId],
            reason: payload.reason,
            details: payload.details,
            notify_organiser: payload.notifyOrganiser !== false,
          });
        })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Unpublish failed');
          forgetSelectedEvent(unpublishId);
          return refreshEventCleanupData();
        })
        .then(function () {
          updateEventBulkBar();
        })
        .catch(function (err) {
          if (err && err.message === 'cancelled') return;
          unpublishEventBtn.disabled = false;
          window.alert(err.message || 'Could not unpublish event');
        });
      return;
    }
    var reinstateBtn = e.target.closest('[data-reinstate-event]');
    if (reinstateBtn) {
      var form = reinstateBtn.closest('.event-cleanup-form');
      var msg = form && form.querySelector('.event-cleanup-msg');
      reinstateSelectedEvent(
        reinstateBtn.getAttribute('data-reinstate-event'),
        reinstateBtn.getAttribute('data-reinstate-status') || 'unpublished',
        msg,
        reinstateBtn
      );
      return;
    }
    var deleteEventBtn = e.target.closest('[data-delete-event]');
    if (deleteEventBtn) {
      var delId = deleteEventBtn.getAttribute('data-delete-event');
      var delTitle = deleteEventBtn.getAttribute('data-event-title');
      if (
        !window.confirm(
          'Permanently delete “' +
            (delTitle || 'this event') +
            '”?\n\nOnly use for empty drafts with no registrations.'
        )
      ) {
        return;
      }
      deleteEventBtn.disabled = true;
      adminPost('/api/admin/events', { action: 'bulk_delete', ids: [delId] })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
          if (!data.deleted) {
            throw new Error(formatEventBulkSkipped(data.skipped) || 'Could not delete this event');
          }
          forgetSelectedEvent(delId);
          return refreshEventCleanupData();
        })
        .then(function () {
          updateEventBulkBar();
        })
        .catch(function (err) {
          deleteEventBtn.disabled = false;
          window.alert(err.message || 'Could not delete event');
        });
      return;
    }
    var toggle = e.target.closest('[data-toggle-event-edit]');
    if (toggle) {
      var row = toggle.closest('[data-event-id-row]');
      var id = row && row.getAttribute('data-event-id-row');
      var panel = id && main.querySelector('.event-cleanup-panel[data-event-panel-for="' + id + '"]');
      if (panel && id) {
        var opening = panel.classList.contains('hidden');
        main.querySelectorAll('.event-cleanup-panel').forEach(function (p) {
          p.classList.add('hidden');
        });
        main.querySelectorAll('[data-toggle-event-edit]').forEach(function (btn) {
          btn.textContent = 'Edit';
        });
        if (opening) {
          panel.classList.remove('hidden');
          eventCleanupState.expanded[id] = true;
          toggle.textContent = 'Close';
          bindAdminLogoZones(panel);
          bindEventFormLocationToggle(panel);
        } else {
          delete eventCleanupState.expanded[id];
          toggle.textContent = 'Edit';
        }
      }
      return;
    }
    var quick = e.target.closest('[data-event-quick]');
    if (quick) {
      var key = quick.getAttribute('data-event-quick');
      if (key === 'clear') {
        eventCleanupState.organiserId = '';
        eventCleanupState.unlinked = false;
        eventCleanupState.noDate = false;
        eventCleanupState.when = '';
        eventCleanupState.status = '';
        eventCleanupState.approval = '';
        eventCleanupState.q = '';
      } else if (key === 'unlinked') {
        eventCleanupState.unlinked = !eventCleanupState.unlinked;
      } else if (key === 'no_date') {
        eventCleanupState.noDate = !eventCleanupState.noDate;
        if (eventCleanupState.noDate) eventCleanupState.when = '';
      } else if (key === 'live') {
        eventCleanupState.when = eventCleanupState.when === 'upcoming' ? '' : 'upcoming';
        if (eventCleanupState.when) eventCleanupState.noDate = false;
      } else if (key === 'past') {
        eventCleanupState.when = eventCleanupState.when === 'past' ? '' : 'past';
        if (eventCleanupState.when) eventCleanupState.noDate = false;
      } else if (key === 'draft') {
        eventCleanupState.status = eventCleanupState.status === 'draft' ? '' : 'draft';
      } else if (key === 'pending') {
        eventCleanupState.approval =
          eventCleanupState.approval === 'Pending Review' ? '' : 'Pending Review';
      }
      syncEventCleanupFilterUi();
      refreshEventCleanupData();
    }
  }

  function bindEventCleanupForms() {
    if (window.__eventCleanupEventsBound) return;
    window.__eventCleanupEventsBound = true;

    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList) return;
      if (form.classList.contains('event-cleanup-form')) {
        e.preventDefault();
        saveEventCleanupForm(form);
      } else if (form.classList.contains('event-create-form')) {
        e.preventDefault();
        createEventCleanupForm(form);
      } else if (form.id === 'event-bulk-form') {
        e.preventDefault();
        saveEventBulkForm(form);
      }
    });
    main.addEventListener('change', function (e) {
      if (e.target.id === 'event-cleanup-organiser') {
        eventCleanupState.organiserId = e.target.value || '';
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-unlinked') {
        eventCleanupState.unlinked = e.target.checked;
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-no-date') {
        eventCleanupState.noDate = e.target.checked;
        if (eventCleanupState.noDate) eventCleanupState.when = '';
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-when') {
        eventCleanupState.when = e.target.value || '';
        if (eventCleanupState.when) eventCleanupState.noDate = false;
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-status-filter') {
        eventCleanupState.status = e.target.value || '';
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-approval-filter') {
        eventCleanupState.approval = e.target.value || '';
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-sort') {
        eventCleanupState.sort = e.target.value || 'recent';
        refreshEventCleanupData();
      }
      if (e.target.classList && e.target.classList.contains('event-select-checkbox')) {
        var evId = e.target.value;
        if (e.target.checked) {
          rememberSelectedEvent(lookupEventFromCleanupCache(evId) || { id: evId, title: 'Event' });
        } else {
          forgetSelectedEvent(evId);
        }
        updateEventBulkBar();
      }
      if (e.target.id === 'event-cleanup-select-page') {
        var checked = e.target.checked;
        if (!eventCleanupCache || !eventCleanupCache.events) return;
        eventCleanupCache.events.forEach(function (ev) {
          if (checked) rememberSelectedEvent(ev);
          else forgetSelectedEvent(ev.id);
        });
        main.querySelectorAll('.event-select-checkbox').forEach(function (cb) {
          cb.checked = checked;
        });
        updateEventBulkBar();
      }
    });
    main.addEventListener('input', function (e) {
      if (e.target.id !== 'event-cleanup-search') return;
      clearTimeout(eventSearchTimer);
      eventSearchTimer = setTimeout(function () {
        eventCleanupState.q = e.target.value || '';
        refreshEventCleanupData();
      }, 300);
    });
    document.body.addEventListener('click', handleEventCleanupClick);
  }

  function renderGroupCleanupList(data) {
    var list = document.getElementById('group-cleanup-list');
    var status = document.getElementById('group-cleanup-status');
    if (!list) return;

    if (!data || data.error || data.ok === false) {
      if (status) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load groups (' +
          esc((data && (data.error || data.message)) || 'unknown') +
          ').</span>';
      }
      list.innerHTML = '';
      return;
    }

    var organisers = data.organisers || [];
    var page = groupCleanupState.page;
    var pageStart = page * GROUP_PAGE_SIZE + 1;
    var pageEnd = page * GROUP_PAGE_SIZE + organisers.length;
    var total = groupCleanupState.total || organisers.length;

    if (status) {
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        (organisers.length
          ? 'Showing ' + pageStart + '–' + pageEnd + ' of ' + total + ' group' + (total === 1 ? '' : 's')
          : 'No groups on this page') +
        '</span>' +
        (data.incomplete
          ? ' <span class="text-slate-500">(' + data.incomplete + ' with missing profile data)</span>'
          : '') +
        (groupCleanupState.loading ? ' <span class="text-slate-400">Loading…</span>' : '');
    }

    if (!organisers.length) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No groups match your filters.</p>' +
        adminPaginationHtml(page, total, GROUP_PAGE_SIZE, 'data-group-page');
      return;
    }

    list.innerHTML =
      organisers
        .map(function (o) {
          var publicHref = o.slug ? '../organisers/' + encodeURIComponent(o.slug) : '';
          var missingHtml =
            (o.missing || []).map(missingBadge).join('') ||
            '<span class="text-xs text-emerald-700">Complete</span>';
          var loginBadge = !o.has_login
            ? '<span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">No login</span>'
            : o.emails_enabled === false
              ? '<span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Emails off</span>'
              : '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Login ready</span>';
          if (groupCleanupState.selected[o.id]) rememberSelectedGroup(o);
          var checked = groupCleanupState.selected[o.id] ? ' checked' : '';
          var incomplete = (o.missing || []).length > 0;
          var isOpen = !!groupCleanupState.expanded[o.id];
          return (
            '<article class="rounded-xl border bg-white shadow-sm' +
            (incomplete ? ' border-amber-200 ring-1 ring-amber-100' : ' border-slate-200') +
            '" data-organiser-id-row="' +
            attrEsc(o.id) +
            '">' +
            '<div class="flex flex-wrap items-center justify-between gap-2 p-3">' +
            '<div class="flex items-start gap-2.5 min-w-0 flex-1">' +
            '<input type="checkbox" class="group-select-checkbox mt-0.5 rounded border-slate-300" value="' +
            attrEsc(o.id) +
            '"' +
            checked +
            ' aria-label="Select ' +
            attrEsc(o.name || 'group') +
            '">' +
            '<div class="min-w-0">' +
            '<div class="flex flex-wrap items-center gap-2">' +
            '<h3 class="text-sm font-semibold text-brand-900 truncate">' +
            esc(o.name || 'Untitled') +
            '</h3>' +
            listingStatusBadge(o.listing_status) +
            (String(o.listing_status || '').toLowerCase() === 'unpublished' && !o.hub_suspended
              ? '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200">Hidden from browse</span>'
              : '') +
            moderationBadge(o) +
            loginBadge +
            '</div>' +
            '<p class="text-xs text-slate-500 mt-0.5">' +
            (o.email ? esc(o.email) + ' · ' : '') +
            (o.event_count || 0) +
            ' event' +
            (o.event_count === 1 ? '' : 's') +
            ' · ' +
            missingHtml +
            (o.website && !isOpen ? ' · ' + esc(o.website) : '') +
            '</p></div></div>' +
            '<div class="flex flex-wrap gap-1.5 shrink-0">' +
            (publicHref
              ? '<a href="' +
                attrEsc(publicHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline px-1 py-1">View</a>'
              : '') +
            (!o.has_login && o.email
              ? '<button type="button" data-provision-group-login="' +
                attrEsc(o.id) +
                '" class="text-xs font-semibold rounded-lg border border-brand-200 text-brand-800 px-2.5 py-1 hover:bg-brand-50">Create login</button>'
              : '') +
            (o.email || o.has_login
              ? '<button type="button" data-impersonate-group="' +
                attrEsc(o.id) +
                '" data-group-email="' +
                attrEsc(o.email || '') +
                '" class="text-xs font-semibold rounded-lg border border-brand-700 text-brand-700 px-2.5 py-1 hover:bg-brand-50">Impersonate</button>'
              : '') +
            (o.has_login
              ? o.emails_enabled === false
                ? '<button type="button" data-enable-group-emails="' +
                  attrEsc(o.id) +
                  '" class="text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-800 px-2.5 py-1 hover:bg-emerald-50">Enable emails</button>'
                : '<button type="button" data-disable-group-emails="' +
                  attrEsc(o.id) +
                  '" class="text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 px-2.5 py-1 hover:bg-slate-50">Block emails</button>'
              : '') +
            '<button type="button" data-toggle-group-edit="1" class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">' +
            (isOpen ? 'Close' : 'Edit profile') +
            '</button>' +
            '<button type="button" data-delete-group="' +
            attrEsc(o.id) +
            '" data-group-name="' +
            attrEsc(o.name || '') +
            '" data-group-event-count="' +
            String(o.event_count || 0) +
            '" class="text-xs font-semibold rounded-lg border border-red-200 text-red-700 px-2.5 py-1 hover:bg-red-50">Delete</button></div></div>' +
            '<div class="group-cleanup-panel border-t border-slate-100 bg-slate-50/80 px-4 py-3' +
            (isOpen ? '' : ' hidden') +
            '">' +
            groupCleanupQuickFormHtml(o) +
            '</div></article>'
          );
        })
        .join('') +
      adminPaginationHtml(page, total, GROUP_PAGE_SIZE, 'data-group-page');
    updateGroupBulkBar();
  }

  function renderGroupCleanup(fullHash) {
    var query = parseAdminHashQuery(fullHash || (location.hash || '').replace('#', ''));
    var focusId = String(query.get('organiser') || query.get('id') || '').trim();
    groupCleanupState.focusOrganiserId = focusId;
    if (focusId) groupCleanupState.expanded[focusId] = true;

    groupCleanupState.loading = false;
    main.innerHTML =
      '<div class="space-y-4">' +
      '<section class="rounded-xl border border-amber-200 bg-white p-4 shadow-sm space-y-3">' +
      '<div><h3 class="font-bold text-brand-900">Organiser claim requests</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Public claim requests — approve to update the profile email and send the claim invite, or mark resolved once handled.</p></div>' +
      '<div id="group-claim-requests"><p class="text-sm text-slate-500">Loading claim requests…</p></div></section>' +
      '<section class="rounded-xl border border-red-200 bg-white p-4 shadow-sm space-y-3">' +
      '<div><h3 class="font-bold text-brand-900">Group profile disputes</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">When an organiser says a pre-imported profile is not theirs, use Edit profile, Clear profile email, or Delete profile — then Mark resolved if needed.</p></div>' +
      '<div id="group-claim-disputes"><p class="text-sm text-slate-500">Loading disputes…</p></div></section>' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<div id="group-cleanup-status" class="text-sm text-slate-500">Loading groups…</div>' +
      '<button type="button" id="group-create-toggle" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900 shrink-0" aria-expanded="' +
      (groupCleanupState.createOpen ? 'true' : 'false') +
      '" aria-controls="group-create-panel">' +
      (groupCleanupState.createOpen ? 'Cancel new group' : '+ New networking group') +
      '</button></div>' +
      '<div id="group-create-panel" class="rounded-xl border border-brand-200 bg-brand-50/80 p-4 shadow-sm space-y-3' +
      (groupCleanupState.createOpen ? '' : ' hidden') +
      '">' +
      '<h3 class="text-sm font-semibold text-brand-900">New networking group</h3>' +
      '<p class="text-xs text-slate-600">Creates a draft group profile and adds a login for the contact email. No emails are sent.</p>' +
      '<form id="group-create-form" class="grid sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-name">Group name</label>' +
      '<input type="text" id="group-create-name" name="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="e.g. Catalyst Networking Club"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-email">Contact email</label>' +
      '<input type="email" id="group-create-email" name="email" required autocomplete="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="hello@theircompany.com"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-website">Website <span class="font-normal text-slate-400">(optional)</span></label>' +
      '<input type="url" id="group-create-website" name="website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="https://…"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-description">Description <span class="font-normal text-slate-400">(optional)</span></label>' +
      '<textarea id="group-create-description" name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Short intro for this networking group"></textarea></div>' +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Create group</button>' +
      '<span id="group-create-msg" class="text-xs"></span></div></form></div>' +
      '<div id="group-cleanup-bulk" class="hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<form id="group-bulk-form" class="space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="group-bulk-count">0</span> groups selected</p>' +
      '<button type="button" id="group-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Search again to add more groups — your selection is kept until you merge, delete, or clear.</p>' +
      '<div id="group-selected-chips" class="flex flex-wrap gap-1.5"></div>' +
      '<p class="text-xs text-slate-600">Only filled-in fields are applied to every selected group.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Contact email</label>' +
      '<input type="email" name="bulk_contact_email" autocomplete="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Leave blank to keep existing emails"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
      '<textarea name="bulk_description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Leave blank to keep existing bios"></textarea></div>' +
      adminLogoFieldHtml('bulk', '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
      '<input type="url" name="bulk_website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="https://…"></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Apply to selected</button>' +
      '<span id="group-bulk-msg" class="text-xs"></span></div></form>' +
      '<div id="group-browse-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Browse visibility</p>' +
      '<p class="text-xs text-slate-600">Hide removes profiles from the public organiser directory. They can still claim via invite email and publish events (which puts the page live again).</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="group-hide-browse-btn" class="rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Hide from browse</button>' +
      '<button type="button" id="group-show-browse-btn" class="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold px-4 py-2 hover:bg-emerald-100">Show on browse</button>' +
      '<span id="group-browse-msg" class="text-xs"></span></div></div>' +
      '<div id="group-merge-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Merge duplicate groups</p>' +
      '<p class="text-xs text-slate-600">Pick the profile to keep. Other selected groups are removed; their events move to the primary profile and their account owners become team editors.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-merge-primary">Keep this profile</label>' +
      '<select id="group-merge-primary" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></select></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="group-merge-btn" class="rounded-lg bg-amber-600 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-700">Merge into primary</button>' +
      '<span id="group-merge-msg" class="text-xs"></span></div></div>' +
      '<div id="group-delete-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Delete selected groups</p>' +
      '<p class="text-xs text-slate-600">Permanently remove the selected group profiles. Linked events stay on the platform but become unlinked.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="group-delete-btn" class="rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700">Delete selected</button>' +
      '<span id="group-delete-msg" class="text-xs"></span></div></div></div>' +
      '<div class="admin-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<input type="search" id="group-cleanup-search" placeholder="Search by name…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:max-w-xs bg-white" value="' +
      attrEsc(groupCleanupState.q) +
      '">' +
      '<select id="group-cleanup-visibility" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[12rem]" aria-label="Browse visibility">' +
      '<option value=""' +
      (groupCleanupState.visibility === '' ? ' selected' : '') +
      '>Any visibility</option>' +
      '<option value="browse"' +
      (groupCleanupState.visibility === 'browse' ? ' selected' : '') +
      '>On organiser browse</option>' +
      '<option value="draft"' +
      (groupCleanupState.visibility === 'draft' ? ' selected' : '') +
      '>Draft</option>' +
      '<option value="unpublished"' +
      (groupCleanupState.visibility === 'unpublished' ? ' selected' : '') +
      '>Unpublished / hidden</option></select>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="group-cleanup-incomplete" class="rounded border-slate-300"' +
      (groupCleanupState.incomplete ? ' checked' : '') +
      '> Show incomplete only</label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="group-cleanup-select-page" class="rounded border-slate-300"> Select all on page</label></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" data-group-quick="browse" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">On browse</button>' +
      '<button type="button" data-group-quick="draft" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Draft</button>' +
      '<button type="button" data-group-quick="unpublished" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Unpublished</button>' +
      '<button type="button" data-group-quick="incomplete" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Incomplete</button>' +
      '<button type="button" data-group-quick="clear" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-500 hover:bg-slate-50">Clear filters</button></div>' +
      '<p class="text-xs text-slate-500">Compact rows — click <strong>Edit profile</strong> to expand. Use page numbers below to browse.</p>' +
      '<div id="group-cleanup-list" class="space-y-2"></div></div>';

    groupCleanupState.page = 0;
    refreshAdminNotifications();
    syncGroupCleanupFilterUi();
    fetchGroupCleanup(0, { organiserId: focusId })
      .then(function (data) {
        renderGroupCleanupList(data || { error: 'load_failed' });
        bindGroupCleanupPageUi();
        syncGroupCleanupFilterUi();
        if (focusId) focusOrganiserInGroupCleanup(focusId);
      })
      .catch(function () {
        renderGroupCleanupList({ error: 'network_error' });
      });
  }

  function eventTypeOptions(selected) {
    return EVENT_TYPES.map(function (t) {
      return (
        '<option value="' +
        attrEsc(t) +
        '"' +
        (selected === t ? ' selected' : '') +
        '>' +
        esc(t) +
        '</option>'
      );
    }).join('');
  }

  function meetingFormatOptions(selected) {
    return MEETING_FORMATS.map(function (f) {
      return (
        '<option value="' +
        attrEsc(f) +
        '"' +
        (selected === f ? ' selected' : '') +
        '>' +
        esc(f) +
        '</option>'
      );
    }).join('');
  }

  function eventStatusOptions(selected, options) {
    var opts = options || {};
    var statuses = ['draft', 'published', 'unpublished', 'archived'];
    if (!opts.hideCancelled) statuses.push('cancelled');
    return statuses
      .map(function (s) {
        return (
          '<option value="' +
          attrEsc(s) +
          '"' +
          (selected === s ? ' selected' : '') +
          '>' +
          esc(s) +
          '</option>'
        );
      })
      .join('');
  }

  function eventCleanupFilterHtml(organisers) {
    return (
      '<option value="">All organisers</option>' +
      organisers
        .map(function (o) {
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (eventCleanupState.organiserId === o.id ? ' selected' : '') +
            '>' +
            esc(o.name) +
            (o.listingStatus === 'published' ? '' : ' (draft)') +
            '</option>'
          );
        })
        .join('')
    );
  }

  function rememberSelectedEvent(ev) {
    if (!ev || ev.id == null) return;
    eventCleanupState.selected[String(ev.id)] = {
      id: ev.id,
      title: ev.title || 'Untitled',
      organiser_name: ev.organiser_name || '',
      organiser_email: ev.organiser_email || '',
      organiser_id: ev.organiser_id || '',
      status: ev.status || '',
      starts_at: ev.starts_at || '',
      ends_at: ev.ends_at || '',
      locked: Boolean(ev.locked),
      registration_count: Math.max(0, Number(ev.registration_count) || 0),
      paid_booking_count: Math.max(0, Number(ev.paid_booking_count) || 0),
      can_reinstate: Boolean(ev.can_reinstate),
      reinstate_blocked_reason: ev.reinstate_blocked_reason || '',
    };
  }

  function lookupEventFromCleanupCache(eventId) {
    var events = (eventCleanupCache && eventCleanupCache.events) || [];
    for (var i = 0; i < events.length; i += 1) {
      if (String(events[i].id) === String(eventId)) return events[i];
    }
    return null;
  }

  function eventHasCommerce(ev) {
    if (!ev) return false;
    return Boolean(ev.locked) || Math.max(0, Number(ev.registration_count) || 0) > 0;
  }

  function forgetSelectedEvent(id) {
    delete eventCleanupState.selected[String(id)];
  }

  function clearSelectedEvents() {
    eventCleanupState.selected = {};
  }

  function getSelectedEventIds() {
    return Object.keys(eventCleanupState.selected);
  }

  function selectedEventRows() {
    return getSelectedEventIds().map(function (id) {
      return eventCleanupState.selected[id];
    });
  }

  function updateEventBulkBar() {
    var bar = document.getElementById('event-cleanup-bulk');
    var countEl = document.getElementById('event-bulk-count');
    var chipsEl = document.getElementById('event-selected-chips');
    var deleteSection = document.getElementById('event-delete-section');
    var moderationSection = document.getElementById('event-moderation-section');
    var ids = getSelectedEventIds();
    var rows = selectedEventRows();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
    if (deleteSection) deleteSection.classList.toggle('hidden', ids.length === 0);
    if (moderationSection) moderationSection.classList.toggle('hidden', ids.length === 0);
    if (chipsEl) {
      chipsEl.innerHTML = rows
        .map(function (ev) {
          var label = ev.title || 'Untitled';
          if (ev.organiser_name) label += ' · ' + ev.organiser_name;
          return (
            '<span class="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-900">' +
            '<span class="truncate max-w-[14rem]" title="' +
            attrEsc(label) +
            '">' +
            esc(label) +
            '</span>' +
            '<button type="button" class="event-unselect shrink-0 text-slate-400 hover:text-red-700 font-bold leading-none" data-unselect-event="' +
            attrEsc(ev.id) +
            '" aria-label="Remove ' +
            attrEsc(ev.title || 'event') +
            ' from selection">×</button></span>'
            );
          })
          .join('');
    }
    if (main) {
      var selectPage = document.getElementById('event-cleanup-select-page');
      var pageCbs = main.querySelectorAll('.event-select-checkbox');
      var allPageChecked = pageCbs.length > 0;
      pageCbs.forEach(function (cb) {
        if (!eventCleanupState.selected[cb.value]) allPageChecked = false;
      });
      if (selectPage) selectPage.checked = allPageChecked;
    }
    applyEventModerationButtonStates('event', rows);
  }

  function eventDeleteConfirmMsg(count, force) {
    if (force) {
      return (
        'Cancel ' +
        count +
        ' selected event' +
        (count === 1 ? '' : 's') +
        ' and refund all paid bookings?\n\nThis cannot be undone. Attendees are refunded and organisers lose ticket revenue for those bookings.'
      );
    }
    return (
      'Permanently delete ' +
      count +
      ' selected empty event' +
      (count === 1 ? '' : 's') +
      '?\n\nOnly events with no registrations are removed. If any selected event has bookings, use Unpublish listing or Cancel & refund bookings instead.'
    );
  }

  var ADMIN_EVENT_REMOVAL_REASONS = [
    'Breach of Hub rules',
    'Misleading listing',
    'Duplicate or test event',
    'Quality issue',
    'Organiser request',
    'Other',
  ];

  function ensureAdminForceRemoveModal() {
    if (document.getElementById('admin-force-remove-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'admin-force-remove-modal';
    modal.hidden = true;
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'admin-force-remove-title');
    modal.innerHTML =
      '<div class="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">' +
      '<div><h2 id="admin-force-remove-title" class="text-lg font-semibold text-brand-900">Cancel event &amp; refund bookings</h2>' +
      '<p id="admin-force-remove-sub" class="text-sm text-slate-600 mt-1">Only use when the event is genuinely off. Paying attendees are refunded automatically and the organiser is emailed.</p></div>' +
      '<div id="admin-force-remove-summary" class="hidden rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1"></div>' +
      '<div><label for="admin-force-remove-reason" class="block text-xs font-semibold text-slate-500 mb-1">Reason</label>' +
      '<select id="admin-force-remove-reason" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">' +
      '<option value="">Select a reason…</option>' +
      ADMIN_EVENT_REMOVAL_REASONS.map(function (r) {
        return '<option value="' + attrEsc(r) + '">' + esc(r) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label for="admin-force-remove-details" class="block text-xs font-semibold text-slate-500 mb-1">Note for organiser (optional)</label>' +
      '<textarea id="admin-force-remove-details" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Extra context included in emails where helpful"></textarea></div>' +
      '<p id="admin-force-remove-error" class="text-xs text-red-700 font-semibold hidden"></p>' +
      '<div class="flex justify-end gap-2 pt-1">' +
      '<button type="button" id="admin-force-remove-cancel" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>' +
      '<button type="button" id="admin-force-remove-confirm" class="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700">Cancel &amp; refund</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    document.getElementById('admin-force-remove-cancel').addEventListener('click', function () {
      modal.hidden = true;
      if (modal._reject) modal._reject(new Error('cancelled'));
    });
    document.getElementById('admin-force-remove-confirm').addEventListener('click', function () {
      var reasonEl = document.getElementById('admin-force-remove-reason');
      var detailsEl = document.getElementById('admin-force-remove-details');
      var errEl = document.getElementById('admin-force-remove-error');
      var reason = reasonEl ? String(reasonEl.value || '').trim() : '';
      if (!reason) {
        if (errEl) {
          errEl.textContent = 'Select a removal reason.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      if (errEl) errEl.classList.add('hidden');
      modal.hidden = true;
      if (modal._resolve) {
        modal._resolve({
          reason: reason,
          details: detailsEl ? String(detailsEl.value || '').trim() : '',
        });
      }
    });
  }

  function promptAdminForceRemove(rows) {
    ensureAdminForceRemoveModal();
    var modal = document.getElementById('admin-force-remove-modal');
    var sub = document.getElementById('admin-force-remove-sub');
    var summaryEl = document.getElementById('admin-force-remove-summary');
    var reasonEl = document.getElementById('admin-force-remove-reason');
    var detailsEl = document.getElementById('admin-force-remove-details');
    var errEl = document.getElementById('admin-force-remove-error');
    var list = Array.isArray(rows) ? rows : [];
    var count = list.length || 0;
    var commerce = summarizeEventCommerceRows(list);
    if (sub) {
      sub.textContent =
        count === 1
          ? 'This event will be cancelled. Paying attendees are refunded automatically and the organiser is emailed.'
          : count +
            ' events with bookings will be cancelled. Paying attendees are refunded automatically and organisers are emailed.';
    }
    if (summaryEl) {
      var lines = [];
      if (commerce.totalRegistrations > 0) {
        lines.push(
          '<p><strong>' +
            commerce.totalRegistrations +
            '</strong> registration' +
            (commerce.totalRegistrations === 1 ? '' : 's') +
            ' across ' +
            commerce.withBookings +
            ' event' +
            (commerce.withBookings === 1 ? '' : 's') +
            (commerce.totalPaidBookings
              ? ' · <strong>' + commerce.totalPaidBookings + '</strong> paid booking' +
                (commerce.totalPaidBookings === 1 ? '' : 's')
              : '') +
            '.</p>'
        );
      }
      if (commerce.pastOrArchived > 0) {
        lines.push(
          '<p class="font-semibold">Warning: ' +
            commerce.pastOrArchived +
            ' selected event' +
            (commerce.pastOrArchived === 1 ? ' has' : 's have') +
            ' already ended or is archived. Confirm the event is genuinely off before refunding.</p>'
        );
      }
      lines.push('<p>Organisers will not keep ticket revenue for refunded bookings.</p>');
      if (lines.length) {
        summaryEl.innerHTML = lines.join('');
        summaryEl.classList.remove('hidden');
      } else {
        summaryEl.innerHTML = '';
        summaryEl.classList.add('hidden');
      }
    }
    if (reasonEl) reasonEl.value = '';
    if (detailsEl) detailsEl.value = '';
    if (errEl) errEl.classList.add('hidden');
    modal.hidden = false;
    return new Promise(function (resolve, reject) {
      modal._resolve = resolve;
      modal._reject = reject;
    });
  }

  function ensureAdminUnpublishModal() {
    if (document.getElementById('admin-unpublish-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'admin-unpublish-modal';
    modal.hidden = true;
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'admin-unpublish-title');
    modal.innerHTML =
      '<div class="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">' +
      '<div><h2 id="admin-unpublish-title" class="text-lg font-semibold text-brand-900">Unpublish listing</h2>' +
      '<p id="admin-unpublish-sub" class="text-sm text-slate-600 mt-1">Hide from browse and stop ticket sales. Bookings and organiser revenue stay intact.</p></div>' +
      '<div><label for="admin-unpublish-reason" class="block text-xs font-semibold text-slate-500 mb-1">Reason</label>' +
      '<select id="admin-unpublish-reason" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">' +
      '<option value="">Select a reason…</option>' +
      ADMIN_EVENT_REMOVAL_REASONS.map(function (r) {
        return '<option value="' + attrEsc(r) + '">' + esc(r) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label for="admin-unpublish-details" class="block text-xs font-semibold text-slate-500 mb-1">Note for organiser (optional)</label>' +
      '<textarea id="admin-unpublish-details" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Included in the email to the organiser"></textarea></div>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">' +
      '<input type="checkbox" id="admin-unpublish-notify" class="rounded border-slate-300" checked> Email organiser</label>' +
      '<p id="admin-unpublish-error" class="text-xs text-red-700 font-semibold hidden"></p>' +
      '<div class="flex justify-end gap-2 pt-1">' +
      '<button type="button" id="admin-unpublish-cancel" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>' +
      '<button type="button" id="admin-unpublish-confirm" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Unpublish</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    document.getElementById('admin-unpublish-cancel').addEventListener('click', function () {
      modal.hidden = true;
      if (modal._reject) modal._reject(new Error('cancelled'));
    });
    document.getElementById('admin-unpublish-confirm').addEventListener('click', function () {
      var reasonEl = document.getElementById('admin-unpublish-reason');
      var detailsEl = document.getElementById('admin-unpublish-details');
      var notifyEl = document.getElementById('admin-unpublish-notify');
      var errEl = document.getElementById('admin-unpublish-error');
      var reason = reasonEl ? String(reasonEl.value || '').trim() : '';
      if (!reason) {
        if (errEl) {
          errEl.textContent = 'Select an unpublish reason.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      if (errEl) errEl.classList.add('hidden');
      modal.hidden = true;
      if (modal._resolve) {
        modal._resolve({
          reason: reason,
          details: detailsEl ? String(detailsEl.value || '').trim() : '',
          notifyOrganiser: notifyEl ? !!notifyEl.checked : true,
        });
      }
    });
  }

  function promptAdminUnpublish(count) {
    ensureAdminUnpublishModal();
    var modal = document.getElementById('admin-unpublish-modal');
    var sub = document.getElementById('admin-unpublish-sub');
    var reasonEl = document.getElementById('admin-unpublish-reason');
    var detailsEl = document.getElementById('admin-unpublish-details');
    var notifyEl = document.getElementById('admin-unpublish-notify');
    var errEl = document.getElementById('admin-unpublish-error');
    if (sub) {
      sub.textContent =
        count === 1
          ? 'Hide this listing from browse and stop ticket sales. Bookings and organiser revenue stay intact.'
          : 'Hide ' +
            count +
            ' listings from browse and stop ticket sales. Bookings and organiser revenue stay intact.';
    }
    if (reasonEl) reasonEl.value = '';
    if (detailsEl) detailsEl.value = '';
    if (notifyEl) notifyEl.checked = true;
    if (errEl) errEl.classList.add('hidden');
    modal.hidden = false;
    return new Promise(function (resolve, reject) {
      modal._resolve = resolve;
      modal._reject = reject;
    });
  }

  function formatEventBulkDeleteResult(data) {
    var parts = [];
        if (data.removed) {
          parts.push(
            'Cancelled ' +
              data.removed +
              ' event' +
              (data.removed === 1 ? '' : 's') +
              ' (refunds processing, organiser notified)'
          );
          var removedRows = data.removedEvents || data.removedSummaries || [];
          if (removedRows.length) {
            var suspended = removedRows.filter(function (row) {
              return row.hubSuspended || (row.moderationResult && row.moderationResult.hubSuspended);
            }).length;
            if (suspended) {
              parts.push(
                suspended +
                  ' organiser' +
                  (suspended === 1 ? '' : 's') +
                  ' suspended after conduct warnings'
              );
            }
          }
        }
    if (data.deleted) {
      parts.push('Deleted ' + data.deleted + ' empty event' + (data.deleted === 1 ? '' : 's') + '.');
    }
    if (data.skipped && data.skipped.length) {
      parts.push('Skipped ' + data.skipped.length + ': ' + formatEventBulkSkipped(data.skipped) + '.');
    }
    return parts.join(' ');
  }

  function postAdminEventBulkDelete(ids, options) {
    var payload = { action: 'bulk_delete', ids: ids, force: !!options.force };
    if (options.reason) payload.reason = options.reason;
    if (options.details) payload.details = options.details;
    return adminPost('/api/admin/events', payload);
  }

  function formatEventBulkSkipped(skipped) {
    if (!skipped || !skipped.length) return '';
    var labels = {
      locked: 'locked (active ticket sales)',
      has_registrations: 'has registrations',
      reason_required: 'reason required to cancel and refund',
      not_found: 'not found',
    };
    return skipped
      .slice(0, 5)
      .map(function (s) {
        var reason = labels[s.reason] || s.reason || 'skipped';
        var title = s.title ? '"' + s.title + '"' : s.id;
        if (s.reason === 'has_registrations' && s.registrationCount) {
          reason = s.registrationCount + ' registration' + (s.registrationCount === 1 ? '' : 's');
        }
        return title + ' (' + reason + ')';
      })
      .join('; ');
  }

  function deleteSelectedEvents(force) {
    var ids = getSelectedEventIds();
    if (!ids.length) return;
    var msg = document.getElementById('event-delete-msg');
    var btn = force
      ? document.getElementById('event-force-delete-btn')
      : document.getElementById('event-delete-btn');

    function runDelete(extra) {
      if (btn) btn.disabled = true;
      if (msg) {
        msg.textContent = force ? 'Cancelling & refunding…' : 'Deleting…';
        msg.className = 'text-xs text-slate-500';
      }
      postAdminEventBulkDelete(ids, {
        force: !!force,
        reason: extra && extra.reason,
        details: extra && extra.details,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
          clearSelectedEvents();
          if (msg) {
            msg.textContent = formatEventBulkDeleteResult(data) || 'Done.';
            msg.className = 'text-xs text-emerald-700 font-semibold';
          }
          return refreshEventCleanupData();
        })
        .then(function () {
          updateEventBulkBar();
        })
        .catch(function (err) {
          if (msg) {
            msg.textContent = err.message || 'Could not delete events';
            msg.className = 'text-xs text-red-700 font-semibold';
          }
          if (btn) btn.disabled = false;
        });
    }

    if (force) {
      promptAdminForceRemove(selectedEventRows())
        .then(function (payload) {
          runDelete(payload);
        })
        .catch(function () {
          /* cancelled */
        });
      return;
    }
    if (!window.confirm(eventDeleteConfirmMsg(ids.length, false))) return;
    runDelete(null);
  }

  function saveEventBulkForm(form) {
    var ids = getSelectedEventIds();
    var msg = document.getElementById('event-bulk-msg');
    var btn = form.querySelector('[type="submit"]');
    if (!ids.length) return;
    var payload = { action: 'bulk_update', ids: ids };
    var organiserVal = formFieldVal(form, 'bulk_organiser_id');
    if (organiserVal === '__unlink__') payload.unlink_organiser = true;
    else if (organiserVal) payload.organiser_id = organiserVal;
    var status = formFieldVal(form, 'bulk_status');
    if (status) payload.status = status;
    var approval = formFieldVal(form, 'bulk_approval_status');
    if (approval) payload.approval_status = approval;
    var featuredVal = formFieldVal(form, 'bulk_featured');
    if (featuredVal === 'true') payload.featured = true;
    else if (featuredVal === 'false') payload.featured = false;
    if (
      !payload.organiser_id &&
      !payload.unlink_organiser &&
      !payload.status &&
      !payload.approval_status &&
      !Object.prototype.hasOwnProperty.call(payload, 'featured')
    ) {
      if (msg) {
        msg.textContent = 'Choose at least one field to apply.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Applying to ' + ids.length + ' events…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/events', payload)
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Bulk update failed');
        clearSelectedEvents();
        setEventBulkOrganiserSelection('', '', '');
        var parts = ['Updated ' + (data.updated || 0) + ' event' + ((data.updated || 0) === 1 ? '' : 's') + '.'];
        if (data.skipped && data.skipped.length) {
          parts.push('Skipped ' + data.skipped.length + '.');
        }
        if (msg) {
          msg.textContent = parts.join(' ');
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshEventCleanupData();
      })
      .then(function () {
        updateEventBulkBar();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not apply bulk update';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function applyEventCleanupData(data) {
    var status = document.getElementById('event-cleanup-status');
    if (!data || data.error || data.ok === false) {
      if (status) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load events (' +
          esc((data && (data.error || data.message)) || 'unknown') +
          ').</span>';
      }
      return;
    }

    eventCleanupCache = data;
    renderEventCleanupList();
    fetchEventOrganiserOptions().then(populateEventOrganiserSelects);
  }

  function refreshEventCleanupData() {
    eventCleanupState.page = 0;
    eventCleanupState.items = [];
    eventCleanupState.expanded = {};
    var status = document.getElementById('event-cleanup-status');
    if (status) status.textContent = 'Loading events…';
    resetEventCleanupScroll();
    return fetchEventCleanup(0)
      .then(applyEventCleanupData)
      .catch(function () {
        applyEventCleanupData({ error: 'network_error' });
      });
  }

  function refreshEventCleanupPage() {
    return fetchEventCleanup(eventCleanupState.page).then(applyEventCleanupData);
  }

  function eventCleanupRowHtml(ev, organisers) {
    var publicHref = ev.slug ? '../events/' + encodeURIComponent(ev.slug) : '';
    var organiserLabel = ev.organiser_name
      ? esc(ev.organiser_name)
      : '<span class="text-amber-800 font-semibold">Unlinked</span>';
    if (ev.organiser_email) {
      organiserLabel +=
        '<span class="block text-[10px] text-slate-500 truncate mt-0.5">' +
        esc(ev.organiser_email) +
        '</span>';
    } else if (ev.organiser_id) {
      organiserLabel +=
        '<span class="block text-[10px] text-amber-800 font-semibold mt-0.5">No owner email</span>';
    }
    var dateLabel = ev.starts_at
      ? esc(fmtTime(ev.starts_at))
      : '<span class="text-slate-400">No date</span>';
    if (eventCleanupState.selected[ev.id]) rememberSelectedEvent(ev);
    var checked = eventCleanupState.selected[ev.id] ? ' checked' : '';
    var isOpen = !!eventCleanupState.expanded[ev.id];
    return (
      '<tr class="border-b border-slate-100 hover:bg-slate-50/80" data-event-id-row="' +
      attrEsc(ev.id) +
      '">' +
      '<td class="py-2.5 pr-2 w-8">' +
      '<input type="checkbox" class="event-select-checkbox rounded border-slate-300" value="' +
      attrEsc(ev.id) +
      '"' +
      checked +
      ' aria-label="Select ' +
      attrEsc(ev.title || 'event') +
      '">' +
      '</td>' +
      '<td class="py-2.5 pr-3 max-w-[14rem]"><div class="font-semibold text-brand-900 truncate" title="' +
      attrEsc(ev.title || 'Untitled') +
      '">' +
      esc(ev.title || 'Untitled') +
      '</div>' +
      (ev.city ? '<div class="text-[11px] text-slate-500 truncate">' + esc(ev.city) + '</div>' : '') +
      '</td>' +
      '<td class="py-2.5 pr-3 text-xs text-slate-600 max-w-[10rem]"><span class="block truncate">' +
      organiserLabel +
      '</span></td>' +
      '<td class="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">' +
      dateLabel +
      '</td>' +
      '<td class="py-2.5 pr-3"><div class="flex flex-wrap gap-1">' +
      listingStatusBadge(ev.status) +
      approvalStatusBadge(ev.approval_status) +
      (Math.max(0, Number(ev.registration_count) || 0) > 0
        ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">' +
          esc(String(ev.registration_count)) +
          ' booking' +
          (Number(ev.registration_count) === 1 ? '' : 's') +
          '</span>'
        : '') +
      '</div></td>' +
      '<td class="py-2.5 text-right whitespace-nowrap">' +
      '<div class="flex flex-wrap justify-end gap-2">' +
      (publicHref
        ? '<a href="' +
          attrEsc(publicHref) +
          '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View</a>'
        : '') +
      '<button type="button" data-toggle-event-edit class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">' +
      (isOpen ? 'Close' : 'Edit') +
      '</button>' +
      '</div></td></tr>' +
      '<tr class="event-cleanup-panel' +
      (isOpen ? '' : ' hidden') +
      ' border-b border-slate-200 bg-slate-50/80" data-event-panel-for="' +
      attrEsc(ev.id) +
      '">' +
      '<td colspan="6" class="p-4">' +
      eventCleanupEditFormHtml(ev, organisers) +
      '</td></tr>'
    );
  }

  function renderEventCleanupList() {
    var list = document.getElementById('event-cleanup-list');
    var status = document.getElementById('event-cleanup-status');
    var hint = document.getElementById('event-cleanup-hint');
    if (!list || !eventCleanupCache) return;

    var data = eventCleanupCache;
    var organisers =
      eventOrganiserOptionsCache || (data.organisers || []).map(normalizeOrganiserOption);
    var events = eventCleanupState.items.length ? eventCleanupState.items : data.events || [];
    var page = eventCleanupState.page;
    var shown = events.length;
    var total = eventCleanupState.total || shown;
    var pageStart = shown ? page * EVENT_PAGE_SIZE + 1 : 0;
    var pageEnd = page * EVENT_PAGE_SIZE + shown;
    var pagination = adminPaginationHtml(page, total, EVENT_PAGE_SIZE, 'data-event-page');

    if (status) {
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        (shown
          ? 'Showing ' + pageStart + '–' + pageEnd + ' of ' + total + ' event' + (total === 1 ? '' : 's')
          : 'No events match your filters') +
        '</span>' +
        (data.unlinked_count
          ? ' · <span class="text-amber-800 font-semibold">' +
            data.unlinked_count +
            ' unlinked in catalogue</span>'
          : '') +
        (eventCleanupState.loading ? ' · <span class="text-slate-400">Loading…</span>' : '');
    }

    if (hint) {
      if (total > EVENT_PAGE_SIZE) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }

    if (!shown) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No events match your filters. Try search, quick filters, or create a new event above.</p>' +
        pagination;
      updateEventBulkBar();
      return;
    }

    var rows = events
      .map(function (ev) {
        return eventCleanupRowHtml(ev, organisers);
      })
      .join('');

    list.innerHTML =
      adminTableScroll(
        '<table class="w-full text-sm text-left border-collapse">' +
          '<thead class="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
          '<tr>' +
          '<th class="py-2 pr-2 w-8"><span class="sr-only">Select</span></th>' +
          '<th class="py-2 pr-3 font-semibold">Event</th>' +
          '<th class="py-2 pr-3 font-semibold">Organiser</th>' +
          '<th class="py-2 pr-3 font-semibold">Date</th>' +
          '<th class="py-2 pr-3 font-semibold">Status</th>' +
          '<th class="py-2 font-semibold text-right">Actions</th>' +
          '</tr></thead><tbody>' +
          rows +
          '</tbody></table>'
      ) + pagination;
    updateEventBulkBar();
  }

  function eventCleanupCreateSectionHtml() {
    return (
      '<details class="event-cleanup-create rounded-xl border border-brand-200 bg-brand-50/50 shadow-sm group">' +
      '<summary class="cursor-pointer list-none font-semibold text-brand-900 px-4 py-3 select-none">Create event for a group</summary>' +
      '<div class="px-4 pb-4 space-y-3 border-t border-brand-100 event-cleanup-create-body">' +
      '<p class="text-xs text-slate-600 pt-3">Add an event under an existing organiser profile with the core listing details. You can publish as a listing without tickets — visitors can nudge the organiser to add them. Organisers finish tickets and enable sales when ready.</p>' +
      '<form class="event-create-form grid sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Title</label>' +
      '<input type="text" name="title" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Monthly networking breakfast"></div>' +
      eventDescriptionFieldHtml('') +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
      '<div id="event-create-organiser-picker" class="relative">' +
      '<input type="hidden" name="organiser_id" id="event-create-organiser-id">' +
      '<input type="search" id="event-create-organiser-search" autocomplete="off" placeholder="Search by group name…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<div id="event-create-organiser-selected" class="hidden rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"></div>' +
      '<div id="event-create-organiser-results" class="hidden absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-20"></div>' +
      '</div></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Dates (optional)</label>' +
      '<p class="text-xs text-slate-500 mb-2">Add one or more dates. The same start and end time applies to each date. Multiple dates create a linked series.</p>' +
      '<div class="grid sm:grid-cols-2 gap-3 mb-3">' +
      '<div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Start time</label>' +
      '<input type="time" name="start_time" value="10:00" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></div>' +
      '<div><label class="block text-[11px] font-semibold text-slate-500 mb-1">End time (optional)</label>' +
      '<input type="time" name="end_time" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></div></div>' +
      '<div id="event-create-dates-list" class="space-y-2 mb-2"></div>' +
      '<button type="button" id="event-create-add-date" class="text-xs font-semibold text-brand-700 hover:underline">+ Add another date</button></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
      '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      eventTypeOptions('Meeting') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
      '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      meetingFormatOptions('In person') +
      '</select></div>' +
      eventLocationFieldsHtml({ meeting_type: 'In person' }) +
      eventPhotoFieldHtml('event-create-photo', '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
      '<select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      eventStatusOptions('published') +
      '</select>' +
      '<p class="text-[11px] text-slate-500 mt-1">Published events go live on browse (listing-only until tickets are added).</p></div>' +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Create event</button>' +
      '<span class="event-create-msg text-xs"></span></div></form></div></details>'
    );
  }

  function eventCleanupFiltersHtml() {
    return (
      '<div class="admin-filter-bar rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="event-cleanup-search" placeholder="Search title or city…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(eventCleanupState.q) +
      '">' +
      '<select id="event-cleanup-sort" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value="recent"' +
      (eventCleanupState.sort === 'recent' ? ' selected' : '') +
      '>Newest first</option>' +
      '<option value="date"' +
      (eventCleanupState.sort === 'date' ? ' selected' : '') +
      '>Event date</option>' +
      '<option value="title"' +
      (eventCleanupState.sort === 'title' ? ' selected' : '') +
      '>Title A–Z</option></select></div>' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<select id="event-cleanup-organiser" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-xs">' +
      '<option value="">All organisers</option></select>' +
      '<select id="event-cleanup-status-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[10rem]">' +
      '<option value="">Any status</option>' +
      eventStatusOptions(eventCleanupState.status) +
      '</select>' +
      '<select id="event-cleanup-approval-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value="">Any approval</option>' +
      '<option value="Pending Review"' +
      (eventCleanupState.approval === 'Pending Review' ? ' selected' : '') +
      '>Pending review</option>' +
      '<option value="Approved"' +
      (eventCleanupState.approval === 'Approved' ? ' selected' : '') +
      '>Approved</option>' +
      '<option value="Rejected"' +
      (eventCleanupState.approval === 'Rejected' ? ' selected' : '') +
      '>Rejected</option></select>' +
      '<select id="event-cleanup-when" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]" aria-label="Event date timing">' +
      '<option value=""' +
      (eventCleanupState.when === '' ? ' selected' : '') +
      '>Any date</option>' +
      '<option value="upcoming"' +
      (eventCleanupState.when === 'upcoming' ? ' selected' : '') +
      '>Live / upcoming</option>' +
      '<option value="past"' +
      (eventCleanupState.when === 'past' ? ' selected' : '') +
      '>Past</option></select>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-unlinked" class="rounded border-slate-300"' +
      (eventCleanupState.unlinked ? ' checked' : '') +
      '> Unlinked</label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-no-date" class="rounded border-slate-300"' +
      (eventCleanupState.noDate ? ' checked' : '') +
      '> No date</label></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" data-event-quick="live" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Live / upcoming</button>' +
      '<button type="button" data-event-quick="past" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Past</button>' +
      '<button type="button" data-event-quick="unlinked" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Unlinked</button>' +
      '<button type="button" data-event-quick="no_date" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">No date</button>' +
      '<button type="button" data-event-quick="draft" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Draft</button>' +
      '<button type="button" data-event-quick="pending" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Draft events</button>' +
      '<button type="button" data-event-quick="clear" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-500 hover:bg-slate-50">Clear filters</button></div>' +
      '<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-select-page" class="rounded border-slate-300"> Select all on page</label>' +
      '<div id="event-cleanup-status" class="text-sm text-slate-500">Loading events…</div></div></div>'
    );
  }

  function eventCleanupHintHtml() {
    return (
      '<p id="event-cleanup-hint" class="hidden text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">' +
      'Large catalogue — search by title or city, pick an organiser, or use quick filters. Use the page numbers below the table to browse.</p>'
    );
  }

  function eventCleanupBulkHtml() {
    return (
      '<div id="event-cleanup-bulk" class="event-cleanup-bulk hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<form id="event-bulk-form" class="space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="event-bulk-count">0</span> events selected</p>' +
      '<button type="button" id="event-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Change pages to select events on other pages — your selection is kept until you apply changes, unpublish, or clear.</p>' +
      '<div id="event-selected-chips" class="flex flex-wrap gap-1.5"></div>' +
      '<p class="text-xs text-slate-600">Only fields you set below are applied to every selected event.</p>' +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
      '<div id="event-bulk-organiser-picker" class="relative">' +
      '<input type="hidden" name="bulk_organiser_id" id="event-bulk-organiser-id" value="">' +
      '<input type="search" id="event-bulk-organiser-search" autocomplete="off" placeholder="Search by group name…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<div id="event-bulk-organiser-selected" class="hidden rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm"></div>' +
      '<div id="event-bulk-organiser-results" class="hidden absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-20"></div>' +
      '</div>' +
      '<p class="text-[11px] text-slate-500 mt-1">Leave blank to keep current organisers.</p></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
      '<select name="bulk_status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      eventStatusOptions('', { hideCancelled: true }) +
      '</select>' +
      '<p class="text-[11px] text-slate-500 mt-1">To cancel with refunds, use Cancel event &amp; refund bookings below.</p></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Approval</label>' +
      '<select name="bulk_approval_status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      '<option value="Pending Review">Pending review</option>' +
      '<option value="Approved">Approved</option>' +
      '<option value="Rejected">Rejected</option></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Featured spotlight</label>' +
      '<select name="bulk_featured" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      '<option value="">— Leave unchanged —</option>' +
      '<option value="true">Mark featured</option>' +
      '<option value="false">Remove featured</option></select></div></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Apply to selected</button>' +
      '<button type="button" id="event-bulk-grant-access" class="rounded-lg border border-brand-300 bg-white text-brand-800 text-sm font-semibold px-4 py-2 hover:bg-brand-50">Grant owner access</button>' +
      '<span id="event-bulk-msg" class="text-xs"></span></div></form>' +
      '<div id="event-moderation-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Hide listing (default for moderation)</p>' +
      '<p class="text-xs text-slate-600">Unpublish removes the event from browse and stops ticket sales. Bookings, revenue, and organiser payouts are kept.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="event-unpublish-btn" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Unpublish listing</button>' +
      '<span id="event-unpublish-msg" class="text-xs"></span></div></div>' +
      '<div id="event-delete-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Danger zone</p>' +
      '<p class="text-xs text-slate-600">Only use when the event is genuinely off. Cancel &amp; refund unwinds every paid booking. Delete permanently removes empty drafts with no registrations.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="event-force-delete-btn" class="rounded-lg border border-red-300 bg-white text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">Cancel event &amp; refund bookings</button>' +
      '<button type="button" id="event-delete-btn" class="rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Delete empty events</button>' +
      '<span id="event-delete-msg" class="text-xs"></span></div></div></div>'
    );
  }

  function renderEventCleanup() {
    main.innerHTML =
      '<div class="event-cleanup-page space-y-3">' +
      eventCleanupCreateSectionHtml() +
      '<div class="event-cleanup-toolbar space-y-3">' +
      eventCleanupFiltersHtml() +
      eventCleanupHintHtml() +
      '</div>' +
      eventCleanupBulkHtml() +
      '<div id="event-cleanup-list" class="event-cleanup-list"></div></div>';

    syncEventCleanupFilterUi();
    bindEventCreateOrganiserPicker();
    bindEventBulkOrganiserPicker();
    bindEventCreateDatesSection();
    bindEventFormLocationToggle(main);
    bindAdminLogoZones(main.querySelector('.event-create-form'));
    refreshEventCleanupData();
  }

  function renderRankingsCurrent() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="rankings-status" class="text-sm text-slate-500">Loading ranking snapshot…</p>' +
      '<div class="admin-filter-bar flex flex-wrap gap-3 items-center">' +
      '<input type="search" id="rankings-search" class="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]" placeholder="Search group name" />' +
      '<select id="rankings-tier" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All badges</option>' +
      '<option value="top10">Top 10</option>' +
      '<option value="top25">Top 25</option>' +
      '<option value="top50">Top 50</option>' +
      '</select></div>' +
      '<div id="rankings-panels" class="space-y-4"></div>' +
      '<div id="rankings-pager"></div></div>';

    function tierBadge(tier) {
      var label =
        tier === 'top10' ? 'Top 10' : tier === 'top25' ? 'Top 25' : tier === 'top50' ? 'Top 50' : tier;
      return (
        '<span class="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">' +
        esc(label) +
        '</span>'
      );
    }

    function loadReport() {
      return fetch('/api/admin/rankings', { credentials: 'include', cache: 'no-store' }).then(function (r) {
        return r.json();
      });
    }

    function filteredEntries(data) {
      var q = String(rankingsState.q || '')
        .trim()
        .toLowerCase();
      var tier = String(rankingsState.tier || '').trim();
      return (data.entries || []).filter(function (row) {
        if (tier && String(row.tier || '') !== tier) return false;
        if (!q) return true;
        var org = row.organisers || {};
        return String(org.name || '')
          .toLowerCase()
          .indexOf(q) >= 0;
      });
    }

    function paint(data) {
      rankingsState.cache = data;
      var status = document.getElementById('rankings-status');
      var panels = document.getElementById('rankings-panels');
      var pager = document.getElementById('rankings-pager');
      if (!panels) return;

      if (!data.ok && data.error) {
        if (status) status.textContent = data.message || 'Could not load rankings.';
        return;
      }

      var snap = data.snapshot;
      var filtered = filteredEntries(data);
      var pageData = paginateRows(filtered, rankingsState.page, RANKINGS_PAGE_SIZE);
      rankingsState.page = pageData.page;

      if (status) {
        status.textContent = snap
          ? 'Current period: ' +
            snap.period_label +
            ' (' +
            snap.period_key +
            ') · ' +
            pageData.total +
            ' group' +
            (pageData.total === 1 ? '' : 's') +
            (rankingsState.q || rankingsState.tier ? ' matching filters' : ' ranked')
          : 'No snapshot yet — run the monthly snapshot to publish badges.';
      }

      var entryRows = pageData.rows
        .map(function (row) {
          var org = row.organisers || {};
          return (
            '<tr class="border-b border-slate-100 last:border-0">' +
            '<td class="py-2 pr-3 text-sm font-semibold text-slate-800">#' +
            esc(String(row.rank)) +
            '</td>' +
            '<td class="py-2 pr-3 text-sm">' +
            esc(org.name || '—') +
            '</td>' +
            '<td class="py-2 pr-3">' +
            tierBadge(row.tier) +
            '</td>' +
            '<td class="py-2 pr-3 text-sm text-slate-600">★ ' +
            esc(Number(row.rating).toFixed(1)) +
            ' · ' +
            esc(String(row.review_count)) +
            ' reviews · ' +
            esc(
              row.review_rate != null && row.review_rate !== ''
                ? Math.round(Number(row.review_rate) * 100) + '%'
                : '—'
            ) +
            ' rate</td></tr>'
          );
        })
        .join('');

      panels.innerHTML =
        '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
        '<div class="flex flex-wrap items-start justify-between gap-3 mb-4">' +
        '<div><h3 class="font-bold text-brand-900">Monthly snapshot</h3>' +
        '<p class="text-xs text-slate-500 mt-1">Groups need at least ' +
        esc(String(data.minReviews || 3)) +
        ' reviews and a published profile. Ranked by average rating, then review rate. Cron runs on the 1st of each month at 10:00 UTC.</p></div>' +
        '<div class="flex flex-wrap gap-2">' +
        '<button type="button" id="rankings-run-btn" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Run snapshot now</button>' +
        '<button type="button" id="rankings-run-no-email-btn" class="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 hover:bg-slate-50">Snapshot only (no emails)</button>' +
        '<button type="button" id="rankings-top10-graphic-btn" class="rounded-lg border border-amber-300 bg-amber-50 text-amber-950 text-sm font-semibold px-4 py-2 hover:bg-amber-100">Make Top 10 graphic</button>' +
        '</div></div>' +
        '<p id="rankings-run-msg" class="text-xs text-slate-500 mb-3"></p>' +
        '<div id="rankings-top10-graphic-panel" class="hidden mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">' +
        '<label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="rankings-top10-caption">Caption</label>' +
        '<textarea id="rankings-top10-caption" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3" rows="6"></textarea>' +
        '<div class="flex flex-wrap gap-2 mb-3">' +
        '<button type="button" id="rankings-top10-copy-caption" class="rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-1.5 hover:bg-white">Copy caption</button>' +
        '<a id="rankings-top10-download" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-3 py-1.5 hover:bg-brand-900" download="networker-top10.png" hidden>Download PNG</a>' +
        '</div>' +
        '<img id="rankings-top10-preview" alt="Top 10 graphic preview" class="max-w-full rounded-lg border border-slate-200 hidden" />' +
        '</div>' +
        (entryRows
          ? '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
            '<th class="py-2 pr-3">Rank</th><th class="py-2 pr-3">Group</th><th class="py-2 pr-3">Badge</th><th class="py-2 pr-3">Rating / rate</th></tr></thead><tbody>' +
            entryRows +
            '</tbody></table></div>'
          : '<p class="text-sm text-slate-500">No ranked groups match these filters.</p>') +
        '</section>';

      if (pager) {
        pager.innerHTML = adminPaginationHtml(
          pageData.page,
          pageData.total,
          RANKINGS_PAGE_SIZE,
          'data-rankings-page'
        );
      }

      function runSnapshot(sendEmails) {
        var msg = document.getElementById('rankings-run-msg');
        if (msg) msg.textContent = 'Running snapshot…';
        fetch('/api/admin/rankings', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'run_snapshot', sendEmails: sendEmails }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (result) {
            if (msg) {
              msg.textContent = result.ok
                ? 'Done — ' +
                  result.badgeCount +
                  ' badges · ' +
                  result.emailsSent +
                  ' emails sent'
                : result.message || result.error || 'Snapshot failed';
            }
            return loadReport();
          })
          .then(paint)
          .catch(function () {
            if (msg) msg.textContent = 'Snapshot request failed.';
          });
      }

      var runBtn = document.getElementById('rankings-run-btn');
      var runNoEmailBtn = document.getElementById('rankings-run-no-email-btn');
      if (runBtn) runBtn.addEventListener('click', function () { runSnapshot(true); });
      if (runNoEmailBtn)
        runNoEmailBtn.addEventListener('click', function () { runSnapshot(false); });

      var top10Btn = document.getElementById('rankings-top10-graphic-btn');
      if (top10Btn) {
        top10Btn.addEventListener('click', function () {
          var panel = document.getElementById('rankings-top10-graphic-panel');
          var captionEl = document.getElementById('rankings-top10-caption');
          var preview = document.getElementById('rankings-top10-preview');
          var download = document.getElementById('rankings-top10-download');
          var msg = document.getElementById('rankings-run-msg');
          var top10 = (data.entries || [])
            .filter(function (row) {
              return String(row.tier || '') === 'top10' || Number(row.rank) <= 10;
            })
            .slice(0, 10);
          if (!top10.length) {
            if (msg) msg.textContent = 'No Top 10 groups in this snapshot yet.';
            return;
          }
          var periodLabel = (data.snapshot && data.snapshot.period_label) || 'this month';
          var listFull = top10
            .map(function (row) {
              var org = row.organisers || {};
              var rating = Number(row.rating);
              return (
                String(row.rank) +
                '. ' +
                (org.name || 'Networking group') +
                (Number.isFinite(rating) ? ' ★ ' + rating.toFixed(1) : '')
              );
            })
            .join('\n');
          var caption =
            '🏆 Top 10 networking groups on The Networker Hub — ' +
            periodLabel +
            '\n\n' +
            listFull +
            '\n\nBrowse events and groups: https://www.thenetworkerhub.com/rankings';
          if (captionEl) captionEl.value = caption;
          if (panel) panel.classList.remove('hidden');
          if (msg) msg.textContent = 'Generating Top 10 graphic…';
          var generator =
            window.AdminSocialPosts && window.AdminSocialPosts.generateRankingCardImage;
          if (!generator) {
            if (msg) msg.textContent = 'Graphic helper not loaded — open Social posts instead.';
            return;
          }
          generator(top10, periodLabel)
            .then(function (dataUrl) {
              if (preview) {
                preview.src = dataUrl;
                preview.classList.remove('hidden');
              }
              if (download) {
                download.href = dataUrl;
                download.hidden = false;
              }
              if (msg) msg.textContent = 'Top 10 graphic ready — copy the caption and download the PNG.';
            })
            .catch(function () {
              if (msg) msg.textContent = 'Could not generate Top 10 graphic.';
            });
        });
      }
      var copyCaptionBtn = document.getElementById('rankings-top10-copy-caption');
      if (copyCaptionBtn) {
        copyCaptionBtn.addEventListener('click', function () {
          var captionEl = document.getElementById('rankings-top10-caption');
          var text = (captionEl && captionEl.value) || '';
          if (!text) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              copyCaptionBtn.textContent = 'Copied';
              setTimeout(function () {
                copyCaptionBtn.textContent = 'Copy caption';
              }, 1400);
            });
          }
        });
      }
    }

    var searchEl = document.getElementById('rankings-search');
    var tierEl = document.getElementById('rankings-tier');
    var pager = document.getElementById('rankings-pager');
    if (searchEl) {
      searchEl.value = rankingsState.q || '';
      searchEl.addEventListener('input', function () {
        rankingsState.q = searchEl.value || '';
        rankingsState.page = 0;
        if (rankingsState.cache) paint(rankingsState.cache);
      });
    }
    if (tierEl) {
      tierEl.value = rankingsState.tier || '';
      tierEl.addEventListener('change', function () {
        rankingsState.tier = tierEl.value || '';
        rankingsState.page = 0;
        if (rankingsState.cache) paint(rankingsState.cache);
      });
    }
    if (pager && !pager.dataset.bound) {
      pager.dataset.bound = '1';
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-rankings-page]');
        if (!btn) return;
        rankingsState.page = Number(btn.getAttribute('data-rankings-page')) || 0;
        if (rankingsState.cache) paint(rankingsState.cache);
      });
    }

    loadReport().then(paint).catch(function () {
      var status = document.getElementById('rankings-status');
      if (status) status.textContent = 'Could not load rankings.';
    });
  }

  function renderRankingsHistory() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="rankings-status" class="text-sm text-slate-500">Loading history…</p>' +
      '<div id="rankings-panels" class="space-y-4"></div></div>';

    function tierBadge(tier) {
      var label =
        tier === 'top10' ? 'Top 10' : tier === 'top25' ? 'Top 25' : tier === 'top50' ? 'Top 50' : tier;
      return (
        '<span class="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">' +
        esc(label) +
        '</span>'
      );
    }

    fetch('/api/admin/rankings', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var status = document.getElementById('rankings-status');
        var panels = document.getElementById('rankings-panels');
        if (!panels) return;
        if (!data.ok && data.error) {
          if (status) status.textContent = data.message || 'Could not load rankings.';
          return;
        }
        if (status) status.textContent = 'Snapshot history and recent congratulation emails.';

      var historyRows = (data.snapshots || [])
        .map(function (s) {
          return (
            '<tr class="border-b border-slate-100 last:border-0">' +
            '<td class="py-2 pr-3 text-sm">' +
            esc(s.period_label) +
            '</td>' +
            '<td class="py-2 pr-3 text-sm text-slate-600">' +
            esc(String(s.total_ranked)) +
            ' groups</td>' +
            '<td class="py-2 pr-3 text-xs text-slate-500">' +
            esc(s.triggered_by || 'cron') +
            '</td></tr>'
          );
        })
        .join('');

      var emailRows = (data.recentEmails || [])
        .map(function (m) {
          return (
            '<tr class="border-b border-slate-100 last:border-0">' +
            '<td class="py-2 pr-3 text-sm text-slate-700">' +
            esc(m.email_to) +
            '</td>' +
            '<td class="py-2 pr-3">' +
            tierBadge(m.tier) +
            '</td>' +
            '<td class="py-2 pr-3 text-sm text-slate-600">' +
            esc(m.period_label) +
            '</td>' +
            '<td class="py-2 pr-3 text-xs uppercase text-slate-500">' +
            esc(m.reason) +
            '</td></tr>'
          );
        })
        .join('');

      panels.innerHTML =
        '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
        '<h3 class="font-bold text-brand-900 mb-3">Snapshot history</h3>' +
        (historyRows
          ? '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
            '<th class="py-2 pr-3">Period</th><th class="py-2 pr-3">Ranked</th><th class="py-2 pr-3">Source</th></tr></thead><tbody>' +
            historyRows +
            '</tbody></table></div>'
          : '<p class="text-sm text-slate-500">No history yet.</p>') +
        '</section>' +
        '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
        '<h3 class="font-bold text-brand-900 mb-3">Recent congratulation emails</h3>' +
        (emailRows
          ? '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
            '<th class="py-2 pr-3">Sent to</th><th class="py-2 pr-3">Badge</th><th class="py-2 pr-3">Period</th><th class="py-2 pr-3">Reason</th></tr></thead><tbody>' +
            emailRows +
            '</tbody></table></div>'
          : '<p class="text-sm text-slate-500">No ranking emails sent yet.</p>') +
        '</section>';
      })
          .catch(function () {
        var status = document.getElementById('rankings-status');
        if (status) status.textContent = 'Could not load rankings.';
      });
  }

  function renderRankingsHub(fullHash) {
    var tab = resolveHubTab(fullHash, 'rankings', ['current', 'history'], 'current');
    if (!tab) return;
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'current', label: 'Current', href: '#rankings/current' },
        { key: 'history', label: 'History', href: '#rankings/history' },
      ],
      tab
    );
    if (tab === 'history') withHubTabs(tabsHtml, renderRankingsHistory);
    else withHubTabs(tabsHtml, renderRankingsCurrent);
  }

  function renderRankings() {
    renderRankingsHub(currentAdminHash());
  }

  function renderSystem() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="system-status" class="text-sm text-slate-500">Checking environment and Supabase…</p>' +
      '<div id="system-panels" class="space-y-4"></div></div>';

    fetch('/api/auth/config-check', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var status = document.getElementById('system-status');
        var panels = document.getElementById('system-panels');
        if (!panels) return;

        var env = data.env || {};
        var hints = data.hints || {};
        var sb = data.supabase || {};
        var admin = data.adminAccount || {};

        if (status) {
          status.textContent = data.authReady
            ? 'Core services look ready — review any warnings below.'
            : 'Some configuration is missing — fix env vars in Vercel and redeploy.';
        }

        function envRow(label, ok) {
          return (
            '<div class="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">' +
            '<span class="text-slate-600">' +
            esc(label) +
            '</span>' +
            '<span class="font-semibold ' +
            (ok ? 'text-emerald-700' : 'text-red-700') +
            '">' +
            (ok ? 'OK' : 'Missing') +
            '</span></div>'
          );
        }

        panels.innerHTML =
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-3">Environment</h3>' +
          '<div class="text-sm">' +
          envRow('SESSION_SECRET', env.hasSessionSecret) +
          envRow('SUPABASE_URL', env.hasSupabaseUrl) +
          envRow('SUPABASE_SERVICE_ROLE_KEY', env.hasSupabaseServiceKey) +
          envRow('SUPABASE_ANON_KEY', env.hasSupabaseAnonKey) +
          envRow('SITE_URL', env.hasSiteUrl) +
          envRow('RESEND_API_KEY', env.hasResendApiKey) +
          envRow('RESEND_FROM', env.hasResendFrom) +
          envRow('RESEND_WEBHOOK_SECRET', env.hasResendWebhookSecret) +
          envRow('STRIPE_SECRET_KEY', env.hasStripeSecretKey) +
          envRow('STRIPE_WEBHOOK_SECRET', env.hasStripeWebhookSecret) +
          envRow('STRIPE_CONNECT_ENABLED', env.stripeConnectEnabled) +
          envRow('CRON_SECRET', env.hasCronSecret) +
          '</div></section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-3">Email &amp; scheduled jobs</h3>' +
          '<div class="text-sm">' +
          envRow('Transactional email (Resend)', env.emailSendingConfigured) +
          envRow('Pre-launch email allowlist', env.emailAllowlistEnabled) +
          envRow('Cron jobs secured', env.cronReady) +
          '</div>' +
          (hints.missingResend
            ? '<p class="text-xs text-amber-800 mt-3">' + esc(hints.missingResend) + '</p>'
            : '') +
          (hints.emailAllowlist
            ? '<p class="text-xs text-amber-800 mt-2">' + esc(hints.emailAllowlist) + '</p>'
            : '') +
          (hints.missingCronSecret
            ? '<p class="text-xs text-amber-800 mt-2">' + esc(hints.missingCronSecret) + '</p>'
            : '') +
          '<p class="text-xs text-slate-500 mt-3">Daily crons (07:00–09:00 UTC): booking reminders, saved-event ticket alerts, and featured listing maintenance. Monthly rankings run on the 1st at 10:00 UTC.</p>' +
          '</section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-3">Stripe &amp; checkout</h3>' +
          '<div class="text-sm">' +
          envRow('Paid checkout (STRIPE_SECRET_KEY)', env.hasStripeSecretKey) +
          envRow('Webhook signing secret', env.hasStripeWebhookSecret) +
          envRow('Connect destination charges', env.stripeConnectEnabled) +
          envRow('Checkout webhook gate', env.checkoutReady) +
          (env.stripeMode
            ? '<p class="text-xs text-slate-500 mt-2">Stripe mode: <strong>' +
              esc(env.stripeMode) +
              '</strong></p>'
            : '') +
          '</div>' +
          (hints.missingStripeSecret
            ? '<p class="text-xs text-amber-800 mt-3">' + esc(hints.missingStripeSecret) + '</p>'
            : '') +
          (hints.missingStripeWebhook
            ? '<p class="text-xs text-amber-800 mt-2">' + esc(hints.missingStripeWebhook) + '</p>'
            : '') +
          (hints.stripeModeMismatch
            ? '<p class="text-xs text-amber-800 mt-2">' + esc(hints.stripeModeMismatch) + '</p>'
            : '') +
          (hints.checkoutWebhookReady
            ? '<p class="text-xs text-emerald-800 mt-2">' + esc(hints.checkoutWebhookReady) + '</p>'
            : '') +
          (hints.checkoutEmailReady
            ? '<p class="text-xs text-slate-600 mt-2">' + esc(hints.checkoutEmailReady) + '</p>'
            : '') +
          '<p class="text-xs text-slate-500 mt-3">Webhook endpoint: <code class="text-[11px]">/api/stripe-webhook</code> · Event: <code class="text-[11px]">checkout.session.completed</code>. See <code class="text-[11px]">CHECKOUT-SETUP.md</code>.</p>' +
          '</section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-2">Supabase connection</h3>' +
          '<p class="text-sm ' +
          (sb.ok ? 'text-emerald-700' : 'text-red-700') +
          ' font-semibold">' +
          esc(sb.ok ? 'Connected' : sb.message || 'Not connected') +
          '</p>' +
          (hints.supabaseConnection
            ? '<p class="text-xs text-slate-500 mt-2">' + esc(hints.supabaseConnection) + '</p>'
            : '') +
          '</section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-2">Admin account</h3>' +
          '<p class="text-sm text-slate-600">' +
          esc(admin.email || '—') +
          ' · ' +
          (admin.exists ? 'exists (' + esc(admin.role || 'user') + ')' : 'not created yet') +
          '</p>' +
          (hints.setupAdminRequired
            ? '<p class="text-xs text-amber-800 mt-2">Run <code class="text-[11px]">npm run seed-admin</code> or POST <code class="text-[11px]">/api/auth/setup-admin</code></p>'
            : '') +
          '</section>' +
          '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
          '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-3">Quick links</h3>' +
          '<ul class="text-sm space-y-2">' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="../events/" target="_blank" rel="noopener">Public events browse</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="../organiser/" target="_blank" rel="noopener">Organiser dashboard</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="' +
          esc(VERCEL_ANALYTICS_URL) +
          '" target="_blank" rel="noopener">Vercel Analytics</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="/api/auth/config-check" target="_blank" rel="noopener">Config check JSON</a> (admin session required in production)</li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="/api/hub-listings" target="_blank" rel="noopener">Events API smoke test</a></li>' +
          '</ul></section>';
      })
      .catch(function () {
        var status = document.getElementById('system-status');
        if (status) status.textContent = 'Could not load system health check.';
      });
  }

  function renderUsers() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="users-page-status" class="text-sm text-slate-500">Loading accounts from Supabase…</p>' +
      '<div class="admin-filter-bar">' +
      '<input type="search" id="users-page-search" class="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]" placeholder="Search name or email" />' +
      '<select id="users-page-role" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All roles</option><option value="Admin">Admin</option><option value="Organiser">Organiser</option><option value="Attendee">Attendee</option>' +
      '</select></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Name</th><th class="px-4 py-3 text-left">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Emails</th><th class="px-4 py-3">Featured</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="users-page-tbody"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '<div id="users-page-pager"></div></div>';

    var searchTimer = null;
    var searchEl = document.getElementById('users-page-search');
    var roleEl = document.getElementById('users-page-role');
    var pager = document.getElementById('users-page-pager');
    if (searchEl) searchEl.value = usersPageState.q || '';
    if (roleEl) roleEl.value = usersPageState.role || '';

    function mergeUsersIntoLive(rows) {
      (rows || []).forEach(function (u) {
        var idx = liveUsers.findIndex(function (existing) {
          return existing.id === u.id;
        });
        if (idx >= 0) liveUsers[idx] = u;
        else liveUsers.push(u);
      });
    }

    function paintUsersRows(rows, total) {
      var tbody = document.getElementById('users-page-tbody');
      var status = document.getElementById('users-page-status');
      var pagerEl = document.getElementById('users-page-pager');
      usersPageState.total = total;
      if (status) {
        status.textContent =
          total +
          ' account' +
          (total === 1 ? '' : 's') +
          (usersPageState.q || usersPageState.role ? ' matching filters' : ' in Supabase');
      }
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No matching accounts.</td></tr>';
      } else {
      tbody.innerHTML = rows
        .map(function (u) {
          return (
            '<tr class="border-t border-slate-100">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(u.name) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.email) +
            '</td>' +
            '<td class="px-4 py-3 text-center">' +
            esc(u.role) +
            '</td>' +
            '<td class="px-4 py-3 text-center text-xs">' +
            (u.emailsEnabled === false
              ? '<span class="text-slate-500">Blocked</span>'
              : '<span class="text-emerald-700">On</span>') +
            '</td>' +
            '<td class="px-4 py-3 text-center">' +
            (u.organiserId
              ? '<input type="checkbox" class="users-featured-toggle" data-user-id="' +
                attrEsc(u.id) +
                '" data-organiser-id="' +
                attrEsc(u.organiserId) +
                '" ' +
                (u.featured ? 'checked' : '') +
                ' aria-label="Featured organiser" />'
              : '<span class="text-xs text-slate-400">—</span>') +
            '</td>' +
            '<td class="px-4 py-3 text-right whitespace-nowrap">' +
            '<button type="button" class="users-open-drawer text-brand-700 text-xs font-semibold hover:underline" data-user-id="' +
            attrEsc(u.id) +
            '">Details</button>' +
            (u.role !== 'Admin'
              ? ' · <button type="button" class="users-impersonate text-brand-700 text-xs font-semibold hover:underline" data-email="' +
                attrEsc(u.email) +
                '">Impersonate</button>'
              : '') +
            '</td></tr>'
          );
        })
        .join('');
      }
      if (pagerEl) {
        pagerEl.innerHTML = adminPaginationHtml(
          usersPageState.page,
          total,
          USERS_PAGE_SIZE,
          'data-users-page'
        );
      }
    }

    function fetchUsersPage() {
      var requestKey =
        usersPageState.page +
        '|' +
        String(usersPageState.q || '') +
        '|' +
        String(usersPageState.role || '');
      usersPageState.pendingKey = requestKey;
      if (usersPageState.loading) return;
      usersPageState.loading = true;
      var status = document.getElementById('users-page-status');
      if (status) status.textContent = 'Loading accounts…';
      var params = new URLSearchParams();
      params.set('limit', String(USERS_PAGE_SIZE));
      params.set('offset', String(usersPageState.page * USERS_PAGE_SIZE));
      if (usersPageState.q) params.set('q', usersPageState.q);
      if (usersPageState.role) params.set('role', usersPageState.role);
      var startedKey = requestKey;
      adminGet('/api/admin/users?' + params.toString())
        .then(function (data) {
          usersPageState.loading = false;
          if (usersPageState.pendingKey !== startedKey) {
            fetchUsersPage();
            return;
          }
          if (!data || data.error || data.configured === false) {
            paintUsersRows([], 0);
            if (status) status.textContent = 'Could not load accounts from Supabase.';
            return;
          }
          var rows = data.users || [];
          mergeUsersIntoLive(rows);
          var total = data.total != null ? Number(data.total) : rows.length;
          var maxPage = Math.max(0, Math.ceil(total / USERS_PAGE_SIZE) - 1);
          if (usersPageState.page > maxPage) {
            usersPageState.page = maxPage;
            fetchUsersPage();
            return;
          }
          paintUsersRows(rows, total);
        })
        .catch(function () {
          usersPageState.loading = false;
          if (usersPageState.pendingKey !== startedKey) {
            fetchUsersPage();
            return;
          }
          paintUsersRows([], 0);
          if (status) status.textContent = 'Could not load accounts from Supabase.';
        });
    }

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          usersPageState.q = (searchEl.value || '').trim();
          usersPageState.page = 0;
          fetchUsersPage();
        }, 280);
      });
    }
    if (roleEl) {
      roleEl.addEventListener('change', function () {
        usersPageState.role = roleEl.value || '';
        usersPageState.page = 0;
        fetchUsersPage();
      });
    }
    if (pager && !pager.dataset.bound) {
      pager.dataset.bound = '1';
      pager.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-users-page]');
        if (!btn) return;
        usersPageState.page = Number(btn.getAttribute('data-users-page')) || 0;
        fetchUsersPage();
      });
    }

    if (!main.dataset.usersBound) {
      main.dataset.usersBound = '1';
      main.addEventListener('change', function (e) {
        var toggle = e.target.closest('.users-featured-toggle');
        if (!toggle) return;
        toggle.disabled = true;
        adminPatch('/api/admin/users', {
          userId: toggle.getAttribute('data-user-id'),
          organiserId: toggle.getAttribute('data-organiser-id'),
          featured: toggle.checked,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            var uid = toggle.getAttribute('data-user-id');
            var row = liveUsers.find(function (u) {
              return u.id === uid;
            });
            if (row) row.featured = toggle.checked;
          })
          .catch(function (err) {
            toggle.checked = !toggle.checked;
            window.alert(err.message || 'Could not update featured status.');
          })
          .finally(function () {
            toggle.disabled = false;
          });
      });
      main.addEventListener('click', function (e) {
        var openBtn = e.target.closest('.users-open-drawer');
        if (openBtn) {
          var uid = openBtn.getAttribute('data-user-id');
          var user = liveUsers.find(function (u) {
            return u.id === uid;
          });
          if (user) openUserDrawer(user);
          return;
        }
        var impBtn = e.target.closest('.users-impersonate');
        if (impBtn) {
          submitImpersonation(impBtn.getAttribute('data-email'), 'account');
        }
      });
    }

    fetchUsersPage();
  }

  function formatSpotlightExpiry(featured, untilIso) {
    if (!featured) return '—';
    if (!untilIso) return 'No end date';
    var d = new Date(untilIso);
    if (isNaN(d.getTime())) return '—';
    if (d.getTime() <= Date.now()) return 'Expired';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function spotlightExpiryDateValue(untilIso) {
    if (!untilIso) return '';
    var d = new Date(untilIso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function defaultSpotlightUntilDate() {
    var d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  function addDaysToDateInput(days) {
    var d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function ensureSpotlightUntilModal() {
    if (document.getElementById('admin-spotlight-until-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'admin-spotlight-until-modal';
    modal.hidden = true;
    modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'admin-spotlight-until-title');
    modal.innerHTML =
      '<div class="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 p-5 space-y-4">' +
      '<div><h2 id="admin-spotlight-until-title" class="text-lg font-semibold text-brand-900">Feature until</h2>' +
      '<p id="admin-spotlight-until-sub" class="text-sm text-slate-600 mt-1">Choose when this Premium Spotlight placement ends.</p></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" data-spotlight-until-preset="7" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">1 week</button>' +
      '<button type="button" data-spotlight-until-preset="30" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">1 month</button>' +
      '<button type="button" data-spotlight-until-preset="90" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">3 months</button>' +
      '</div>' +
      '<div><label for="admin-spotlight-until-date" class="block text-xs font-semibold text-slate-500 mb-1">End date</label>' +
      '<input type="date" id="admin-spotlight-until-date" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" /></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="admin-spotlight-until-none" /> No end date (stays until removed)</label>' +
      '<p id="admin-spotlight-until-error" class="text-xs text-red-700 font-semibold hidden"></p>' +
      '<div class="flex justify-end gap-2 pt-1">' +
      '<button type="button" id="admin-spotlight-until-cancel" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>' +
      '<button type="button" id="admin-spotlight-until-confirm" class="rounded-lg bg-brand-800 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save</button>' +
      '</div></div>';
    document.body.appendChild(modal);

    function syncNoneState() {
      var noneEl = document.getElementById('admin-spotlight-until-none');
      var dateEl = document.getElementById('admin-spotlight-until-date');
      if (!noneEl || !dateEl) return;
      dateEl.disabled = !!noneEl.checked;
      if (noneEl.checked) dateEl.value = '';
    }

    document.getElementById('admin-spotlight-until-none').addEventListener('change', syncNoneState);
    modal.querySelectorAll('[data-spotlight-until-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var days = Number(btn.getAttribute('data-spotlight-until-preset') || 30);
        var noneEl = document.getElementById('admin-spotlight-until-none');
        var dateEl = document.getElementById('admin-spotlight-until-date');
        if (noneEl) noneEl.checked = false;
        if (dateEl) {
          dateEl.disabled = false;
          dateEl.value = addDaysToDateInput(days);
        }
      });
    });
    document.getElementById('admin-spotlight-until-cancel').addEventListener('click', function () {
      modal.hidden = true;
      if (modal._reject) modal._reject(new Error('cancelled'));
    });
    document.getElementById('admin-spotlight-until-confirm').addEventListener('click', function () {
      var noneEl = document.getElementById('admin-spotlight-until-none');
      var dateEl = document.getElementById('admin-spotlight-until-date');
      var errEl = document.getElementById('admin-spotlight-until-error');
      var noExpiry = !!(noneEl && noneEl.checked);
      var dateVal = dateEl ? String(dateEl.value || '').trim() : '';
      if (!noExpiry && !dateVal) {
        if (errEl) {
          errEl.textContent = 'Pick an end date, or choose no end date.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      if (!noExpiry && dateVal) {
        var picked = new Date(dateVal + 'T23:59:59.000Z');
        if (isNaN(picked.getTime()) || picked.getTime() <= Date.now()) {
          if (errEl) {
            errEl.textContent = 'End date must be in the future.';
            errEl.classList.remove('hidden');
          }
          return;
        }
      }
      if (errEl) errEl.classList.add('hidden');
      modal.hidden = true;
      if (modal._resolve) {
        modal._resolve({ featured_until: noExpiry ? null : dateVal });
      }
    });
  }

  function promptSpotlightFeaturedUntil(options) {
    options = options || {};
    ensureSpotlightUntilModal();
    var modal = document.getElementById('admin-spotlight-until-modal');
    var titleEl = document.getElementById('admin-spotlight-until-title');
    var subEl = document.getElementById('admin-spotlight-until-sub');
    var dateEl = document.getElementById('admin-spotlight-until-date');
    var noneEl = document.getElementById('admin-spotlight-until-none');
    var errEl = document.getElementById('admin-spotlight-until-error');
    if (titleEl) titleEl.textContent = options.title || 'Feature until';
    if (subEl) {
      subEl.textContent =
        options.subtitle || 'Choose when this Premium Spotlight placement ends.';
    }
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
    var initial = options.initialUntil ? spotlightExpiryDateValue(options.initialUntil) : '';
    var noExpiry = options.allowNoExpiry !== false && !initial && options.defaultNoExpiry;
    if (noneEl) noneEl.checked = !!noExpiry;
    if (dateEl) {
      dateEl.value = noExpiry ? '' : initial || defaultSpotlightUntilDate();
      dateEl.disabled = !!noExpiry;
      dateEl.min = new Date().toISOString().slice(0, 10);
    }
    modal.hidden = false;
    return new Promise(function (resolve, reject) {
      modal._resolve = resolve;
      modal._reject = reject;
    });
  }

  function spotlightExpiryCellHtml(kind, id, featured, untilIso) {
    if (!featured) {
      return '<span class="text-slate-400">—</span>';
    }
    var dateVal = spotlightExpiryDateValue(untilIso);
    var label = formatSpotlightExpiry(featured, untilIso);
    return (
      '<div class="space-y-1">' +
      '<input type="date" class="spotlight-expiry-input rounded border border-slate-300 px-2 py-1 text-xs bg-white w-full max-w-[9.5rem]" data-spotlight-kind="' +
      attrEsc(kind) +
      '" data-id="' +
      attrEsc(id) +
      '" value="' +
      attrEsc(dateVal) +
      '" title="End date" />' +
      '<p class="text-[10px] text-slate-500">' +
      esc(label) +
      (dateVal ? '' : ' · clear date = no end') +
      '</p></div>'
    );
  }

  function spotlightSlotCard(label, slot, note) {
    var used = slot && slot.used != null ? slot.used : 0;
    var max = slot && slot.max != null ? slot.max : 0;
    var full = slot && slot.full;
    return (
      '<div class="rounded-xl border p-4 shadow-sm ' +
      (full ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white') +
      '"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">' +
      esc(label) +
      '</p><p class="text-xl font-bold text-brand-900 mt-1">' +
      esc(String(used) + ' / ' + String(max)) +
      '</p>' +
      (note ? '<p class="text-xs text-slate-500 mt-1">' + esc(note) + '</p>' : '') +
      '</div>'
    );
  }

  function spotlightSlotCardsHtml(slots) {
    slots = slots || {};
    return (
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="spotlight-slot-cards">' +
      spotlightSlotCard('Events carousel', slots.events, 'Browse /events/ spotlight') +
      spotlightSlotCard('Organisers carousel', slots.organisers, 'Group spotlight on Events page') +
      spotlightSlotCard('Opportunities carousel', slots.opportunities, 'Browse /opportunities/') +
      '</div>'
    );
  }

  function loadSpotlightSlotBanner() {
    var el = document.getElementById('spotlight-slots-wrap');
    if (!el) return;
    if (spotlightSlotsCache) {
      el.innerHTML = spotlightSlotCardsHtml(spotlightSlotsCache);
      if (document.getElementById('featured-status')) paintFeaturedSpotlightTable();
      return;
    }
    adminGet('/api/admin/spotlight').then(function (data) {
      if (!el) return;
      if (!data || !data.ok || !data.slots) {
        el.innerHTML =
          '<p class="text-sm text-red-700 rounded-lg border border-red-200 bg-red-50 px-4 py-3">Could not load carousel slot usage. ' +
          esc((data && data.message) || 'Try refreshing the page.') +
          '</p>';
        return;
      }
      spotlightSlotsCache = data.slots;
      el.innerHTML = spotlightSlotCardsHtml(data.slots);
      if (document.getElementById('featured-status')) paintFeaturedSpotlightTable();
    });
  }

  function invalidateSpotlightSlotsCache() {
    spotlightSlotsCache = null;
    loadSpotlightSlotBanner();
  }

  function filterFeaturedSpotlightEvents(events) {
    var q = String(featuredSpotlightState.q || '').trim().toLowerCase();
    var featured = featuredSpotlightState.featured;
    var type = featuredSpotlightState.eventType;
    var when = featuredSpotlightState.when;
    var now = Date.now();
    return (events || []).filter(function (ev) {
      if (featured === 'yes' && !ev.featured) return false;
      if (featured === 'no' && ev.featured) return false;
      if (type && String(ev.event_type || '') !== type) return false;
      if (when === 'upcoming') {
        if (!ev.starts_at) return false;
        if (new Date(ev.starts_at).getTime() < now) return false;
      } else if (when === 'past') {
        if (!ev.starts_at) return false;
        if (new Date(ev.starts_at).getTime() >= now) return false;
      }
      if (!q) return true;
      var hay = (
        String(ev.title || '') +
        ' ' +
        String(ev.organiser_name || '') +
        ' ' +
        String(ev.city || '')
      ).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function featuredSpotlightStatusText(events, rows, filterActive) {
    var flaggedCount = (events || []).filter(function (e) {
      return e.featured;
    }).length;
    var slot = spotlightSlotsCache && spotlightSlotsCache.events;
    var activeCount = slot && slot.used != null ? slot.used : null;
    var slotMax = slot && slot.max != null ? slot.max : 12;
    var countLabel =
      activeCount != null
        ? activeCount + ' active in carousel (max ' + slotMax + ')'
        : flaggedCount + ' featured';
    if (activeCount != null && flaggedCount !== activeCount) {
      countLabel = flaggedCount + ' flagged · ' + countLabel;
    }
    return (
      countLabel +
      ' · ' +
      (filterActive ? rows.length + ' shown · ' + events.length + ' loaded' : events.length + ' approved events') +
      ' (upcoming first)'
    );
  }

  function paintFeaturedSpotlightTable() {
    var tbody = document.getElementById('featured-tbody');
    var status = document.getElementById('featured-status');
    var events = featuredSpotlightEvents || [];
    var rows = filterFeaturedSpotlightEvents(events);
    if (status) {
      var filterActive =
        featuredSpotlightState.q ||
        featuredSpotlightState.featured ||
        featuredSpotlightState.eventType ||
        featuredSpotlightState.when;
      status.textContent = featuredSpotlightStatusText(events, rows, filterActive);
    }
    if (!tbody) return;
    if (!events.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-slate-500">No approved events yet.</td></tr>';
      return;
    }
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="px-4 py-6 text-slate-500">No events match your filters. Try clearing search or filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (ev) {
        var dateLabel = ev.starts_at ? fmtTime(ev.starts_at).split(',')[0] : '—';
        var viewUrl = ev.slug
          ? '../events/' + encodeURIComponent(ev.slug)
          : '../events/event.html?id=' + encodeURIComponent(ev.id);
        return (
          '<tr class="border-t border-slate-100' +
          (ev.featured ? ' bg-amber-50/40' : '') +
          '">' +
          '<td class="px-4 py-3"><input type="checkbox" class="spotlight-event-toggle" data-event-id="' +
          attrEsc(ev.id) +
          '" ' +
          (ev.featured ? 'checked' : '') +
          ' aria-label="Feature event" /></td>' +
          '<td class="px-4 py-3 font-medium">' +
          esc(ev.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(ev.organiser_name || '—') +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(dateLabel) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(ev.city || '—') +
          '</td>' +
          '<td class="px-4 py-3 text-xs">' +
          spotlightExpiryCellHtml('event', ev.id, ev.featured, ev.featured_until || ev.featuredUntil) +
          '</td>' +
          '<td class="px-4 py-3"><a href="' +
          attrEsc(viewUrl) +
          '" target="_blank" rel="noopener" class="text-brand-700 text-xs font-semibold hover:underline">View</a></td></tr>'
        );
      })
      .join('');
  }

  function filterSpotlightOrganisers(rows) {
    var q = String(spotlightOrganiserState.q || '').trim().toLowerCase();
    var featured = spotlightOrganiserState.featured;
    return (rows || []).filter(function (o) {
      if (featured === 'yes' && !o.featured) return false;
      if (featured === 'no' && o.featured) return false;
      if (!q) return true;
      var hay = (String(o.name || '') + ' ' + String(o.city || '') + ' ' + String(o.email || '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function paintSpotlightOrganisersTable() {
    var tbody = document.getElementById('spotlight-organisers-tbody');
    var status = document.getElementById('spotlight-organisers-status');
    var rows = filterSpotlightOrganisers(featuredSpotlightOrganisers);
    var featuredCount = featuredSpotlightOrganisers.filter(function (o) {
      return o.featured;
    }).length;
    if (status) {
      status.textContent = featuredCount + ' featured · ' + rows.length + ' shown';
    }
    if (!tbody) return;
    if (!featuredSpotlightOrganisers.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No organiser profiles found.</td></tr>';
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No organisers match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (o) {
        var viewUrl = o.slug
          ? '../organisers/' + encodeURIComponent(o.slug)
          : '../events/organiser.html?id=' + encodeURIComponent(o.id);
        return (
          '<tr class="border-t border-slate-100' +
          (o.featured ? ' bg-amber-50/40' : '') +
          '">' +
          '<td class="px-4 py-3"><input type="checkbox" class="spotlight-organiser-toggle" data-organiser-id="' +
          attrEsc(o.id) +
          '" ' +
          (o.featured ? 'checked' : '') +
          ' aria-label="Feature organiser" /></td>' +
          '<td class="px-4 py-3 font-medium">' +
          esc(o.name) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(o.city || '—') +
          '</td>' +
          '<td class="px-4 py-3 text-xs">' +
          esc(o.listing_status || '—') +
          '</td>' +
          '<td class="px-4 py-3 text-xs">' +
          spotlightExpiryCellHtml('organiser', o.id, o.featured, o.featured_until || o.featuredUntil) +
          '</td>' +
          '<td class="px-4 py-3"><a href="' +
          attrEsc(viewUrl) +
          '" target="_blank" rel="noopener" class="text-brand-700 text-xs font-semibold hover:underline">View</a></td></tr>'
        );
      })
      .join('');
  }

  function filterSpotlightOpportunities(rows) {
    var q = String(spotlightOpportunityState.q || '').trim().toLowerCase();
    var featured = spotlightOpportunityState.featured;
    return (rows || []).filter(function (o) {
      if (featured === 'yes' && !o.featured) return false;
      if (featured === 'no' && o.featured) return false;
      if (!q) return true;
      var hay = (String(o.title || '') + ' ' + String(o.host || '') + ' ' + String(o.owner_email || '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function paintSpotlightOpportunitiesTable() {
    var tbody = document.getElementById('spotlight-opportunities-tbody');
    var status = document.getElementById('spotlight-opportunities-status');
    var rows = filterSpotlightOpportunities(featuredSpotlightOpportunities);
    var featuredCount = featuredSpotlightOpportunities.filter(function (o) {
      return o.featured;
    }).length;
    if (status) {
      status.textContent = featuredCount + ' featured · ' + rows.length + ' shown';
    }
    if (!tbody) return;
    if (!featuredSpotlightOpportunities.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No approved opportunities found.</td></tr>';
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No opportunities match your filters.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (o) {
        var viewUrl = o.slug
          ? '/opportunities/' + encodeURIComponent(o.slug)
          : '/opportunities/' + encodeURIComponent(o.id);
        return (
          '<tr class="border-t border-slate-100' +
          (o.featured ? ' bg-amber-50/40' : '') +
          '">' +
          '<td class="px-4 py-3"><input type="checkbox" class="spotlight-opportunity-toggle" data-opportunity-id="' +
          attrEsc(o.id) +
          '" ' +
          (o.featured ? 'checked' : '') +
          ' aria-label="Feature opportunity" /></td>' +
          '<td class="px-4 py-3 font-medium">' +
          esc(o.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(o.host || '—') +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(o.type || '—') +
          '</td>' +
          '<td class="px-4 py-3 text-xs">' +
          spotlightExpiryCellHtml(
            'opportunity',
            o.id,
            o.featured,
            o.featured_until || o.featuredUntil
          ) +
          '</td>' +
          '<td class="px-4 py-3"><a href="' +
          attrEsc(viewUrl) +
          '" target="_blank" rel="noopener" class="text-brand-700 text-xs font-semibold hover:underline">View</a></td></tr>'
        );
      })
      .join('');
  }

  function bindFeaturedSpotlightFilters() {
    var searchEl = document.getElementById('featured-spotlight-search');
    var featuredEl = document.getElementById('featured-spotlight-featured');
    var typeEl = document.getElementById('featured-spotlight-type');
    var whenEl = document.getElementById('featured-spotlight-when');
    var clearBtn = document.getElementById('featured-spotlight-clear');

    function syncFromControls() {
      featuredSpotlightState.q = searchEl ? searchEl.value : '';
      featuredSpotlightState.featured = featuredEl ? featuredEl.value : '';
      featuredSpotlightState.eventType = typeEl ? typeEl.value : '';
      featuredSpotlightState.when = whenEl ? whenEl.value : '';
      paintFeaturedSpotlightTable();
    }

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        if (featuredSpotlightSearchTimer) clearTimeout(featuredSpotlightSearchTimer);
        featuredSpotlightSearchTimer = setTimeout(syncFromControls, 200);
      });
    }
    if (featuredEl) featuredEl.addEventListener('change', syncFromControls);
    if (typeEl) typeEl.addEventListener('change', syncFromControls);
    if (whenEl) whenEl.addEventListener('change', syncFromControls);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        featuredSpotlightState.q = '';
        featuredSpotlightState.featured = '';
        featuredSpotlightState.eventType = '';
        featuredSpotlightState.when = '';
        if (searchEl) searchEl.value = '';
        if (featuredEl) featuredEl.value = '';
        if (typeEl) typeEl.value = '';
        if (whenEl) whenEl.value = '';
        paintFeaturedSpotlightTable();
      });
    }
  }

  function bindSpotlightOrganiserFilters() {
    var searchEl = document.getElementById('spotlight-organisers-search');
    var featuredEl = document.getElementById('spotlight-organisers-featured');
    var clearBtn = document.getElementById('spotlight-organisers-clear');
    function sync() {
      spotlightOrganiserState.q = searchEl ? searchEl.value : '';
      spotlightOrganiserState.featured = featuredEl ? featuredEl.value : '';
      paintSpotlightOrganisersTable();
    }
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        if (spotlightOrganiserSearchTimer) clearTimeout(spotlightOrganiserSearchTimer);
        spotlightOrganiserSearchTimer = setTimeout(sync, 200);
      });
    }
    if (featuredEl) featuredEl.addEventListener('change', sync);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        spotlightOrganiserState.q = '';
        spotlightOrganiserState.featured = '';
        if (searchEl) searchEl.value = '';
        if (featuredEl) featuredEl.value = '';
        paintSpotlightOrganisersTable();
      });
    }
  }

  function bindSpotlightOpportunityFilters() {
    var searchEl = document.getElementById('spotlight-opportunities-search');
    var featuredEl = document.getElementById('spotlight-opportunities-featured');
    var clearBtn = document.getElementById('spotlight-opportunities-clear');
    function sync() {
      spotlightOpportunityState.q = searchEl ? searchEl.value : '';
      spotlightOpportunityState.featured = featuredEl ? featuredEl.value : '';
      paintSpotlightOpportunitiesTable();
    }
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        if (spotlightOpportunitySearchTimer) clearTimeout(spotlightOpportunitySearchTimer);
        spotlightOpportunitySearchTimer = setTimeout(sync, 200);
      });
    }
    if (featuredEl) featuredEl.addEventListener('change', sync);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        spotlightOpportunityState.q = '';
        spotlightOpportunityState.featured = '';
        if (searchEl) searchEl.value = '';
        if (featuredEl) featuredEl.value = '';
        paintSpotlightOpportunitiesTable();
      });
    }
  }

  function bindSpotlightToggleHandlers() {
    if (window.__spotlightTogglesBound) return;
    window.__spotlightTogglesBound = true;

    function applyLocalFeatured(list, id, wantFeatured, until, rowKey, dataRow) {
      var idx = list.findIndex(function (row) {
        return String(row.id) === String(id);
      });
      if (idx >= 0 && dataRow) {
        list[idx] = Object.assign({}, list[idx], dataRow);
      } else if (idx < 0 && dataRow) {
        list.push(dataRow);
        idx = list.length - 1;
      }
      if (idx >= 0) {
        list[idx].featured = wantFeatured;
        list[idx].featured_until = wantFeatured ? until : null;
        list[idx].featuredUntil = wantFeatured ? until : null;
      }
      return idx;
    }

    function postFeaturedUpdate(kind, id, wantFeatured, until) {
      var payload = { id: id, featured: wantFeatured, featured_until: wantFeatured ? until : null };
      if (kind === 'event') return adminPost('/api/admin/events', payload);
      if (kind === 'organiser') return adminPost('/api/admin/organisers', payload);
      return adminPost('/api/admin/opportunities', payload);
    }

    function saveFeaturedUntilOnly(kind, id, until) {
      var payload = { id: id, featured_until: until };
      if (kind === 'event') return adminPost('/api/admin/events', payload);
      if (kind === 'organiser') return adminPost('/api/admin/organisers', Object.assign({ featured: true }, payload));
      return adminPost('/api/admin/opportunities', payload);
    }

    document.body.addEventListener('change', function (e) {
      var expiryInput = e.target.closest('.spotlight-expiry-input');
      if (expiryInput) {
        var kind = expiryInput.getAttribute('data-spotlight-kind');
        var id = expiryInput.getAttribute('data-id');
        if (!kind || !id) return;
        var untilVal = String(expiryInput.value || '').trim() || null;
        expiryInput.disabled = true;
        saveFeaturedUntilOnly(kind, id, untilVal)
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            var untilIso =
              untilVal && /^\d{4}-\d{2}-\d{2}$/.test(untilVal)
                ? untilVal + 'T23:59:59.000Z'
                : untilVal;
            if (kind === 'event') {
              applyLocalFeatured(
                featuredSpotlightEvents,
                id,
                true,
                (data.event && (data.event.featured_until || data.event.featuredUntil)) || untilIso,
                'event',
                data.event
              );
              paintFeaturedSpotlightTable();
            } else if (kind === 'organiser') {
              applyLocalFeatured(
                featuredSpotlightOrganisers,
                id,
                true,
                (data.organiser && (data.organiser.featured_until || data.organiser.featuredUntil)) ||
                  untilIso,
                'organiser',
                data.organiser
              );
              paintSpotlightOrganisersTable();
            } else {
              applyLocalFeatured(
                featuredSpotlightOpportunities,
                id,
                true,
                (data.opportunity &&
                  (data.opportunity.featured_until || data.opportunity.featuredUntil)) ||
                  untilIso,
                'opportunity',
                data.opportunity
              );
              paintSpotlightOpportunitiesTable();
            }
            invalidateSpotlightSlotsCache();
          })
          .catch(function (err) {
            window.alert(err.message || 'Could not update expiry.');
            if (kind === 'event') paintFeaturedSpotlightTable();
            else if (kind === 'organiser') paintSpotlightOrganisersTable();
            else paintSpotlightOpportunitiesTable();
          })
          .finally(function () {
            expiryInput.disabled = false;
          });
        return;
      }

      var eventToggle = e.target.closest('.spotlight-event-toggle');
      var orgToggle = e.target.closest('.spotlight-organiser-toggle');
      var oppToggle = e.target.closest('.spotlight-opportunity-toggle');
      var toggle = eventToggle || orgToggle || oppToggle;
      if (!toggle) return;

      var kind = eventToggle ? 'event' : orgToggle ? 'organiser' : 'opportunity';
      var id =
        toggle.getAttribute('data-event-id') ||
        toggle.getAttribute('data-organiser-id') ||
        toggle.getAttribute('data-opportunity-id');
      if (!id) return;
      var wantFeatured = !!toggle.checked;

      function finishFail(err) {
        toggle.checked = !wantFeatured;
        if (err && err.message !== 'cancelled') {
          window.alert(err.message || 'Could not update featured status.');
        }
      }

      function runUpdate(until) {
        toggle.disabled = true;
        return postFeaturedUpdate(kind, id, wantFeatured, until)
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            var untilIso =
              (data.event && (data.event.featured_until || data.event.featuredUntil)) ||
              (data.organiser && (data.organiser.featured_until || data.organiser.featuredUntil)) ||
              (data.opportunity &&
                (data.opportunity.featured_until || data.opportunity.featuredUntil)) ||
              until ||
              null;
            if (kind === 'event') {
              applyLocalFeatured(featuredSpotlightEvents, id, wantFeatured, untilIso, 'event', data.event);
              featuredSpotlightLoadGen += 1;
              paintFeaturedSpotlightTable();
            } else if (kind === 'organiser') {
              applyLocalFeatured(
                featuredSpotlightOrganisers,
                id,
                wantFeatured,
                untilIso,
                'organiser',
                data.organiser
              );
              paintSpotlightOrganisersTable();
            } else {
              applyLocalFeatured(
                featuredSpotlightOpportunities,
                id,
                wantFeatured,
                untilIso,
                'opportunity',
                data.opportunity
              );
              paintSpotlightOpportunitiesTable();
            }
            invalidateSpotlightSlotsCache();
          })
          .catch(finishFail)
          .finally(function () {
            toggle.disabled = false;
          });
      }

      if (!wantFeatured) {
        runUpdate(null);
        return;
      }

      toggle.checked = false;
      promptSpotlightFeaturedUntil({
        title: 'Feature until',
        subtitle: 'Choose when this Premium Spotlight placement ends. Defaults to 1 month.',
      })
        .then(function (choice) {
          toggle.checked = true;
          return runUpdate(choice.featured_until);
        })
        .catch(function (err) {
          finishFail(err);
        });
    });
  }

  function loadFeaturedSpotlightEvents() {
    var loadGen = ++featuredSpotlightLoadGen;
    var tbody = document.getElementById('featured-tbody');
    var status = document.getElementById('featured-status');
    if (status) status.textContent = 'Loading approved events…';
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr>';
    }

    function mergeSpotlightRows(primary, secondary) {
      var byId = new Map();
      (primary || []).forEach(function (row) {
        if (row && row.id != null) byId.set(String(row.id), row);
      });
      (secondary || []).forEach(function (row) {
        if (!row || row.id == null) return;
        var key = String(row.id);
        if (!byId.has(key)) byId.set(key, row);
      });
      return Array.from(byId.values());
    }

    Promise.all([
      adminGet('/api/admin/events?approval_status=Approved&featured=1&limit=100&sort=date&light=1'),
      adminGet('/api/admin/events?approval_status=Approved&limit=100&sort=date&light=1&when=upcoming'),
    ])
      .then(function (results) {
        if (loadGen !== featuredSpotlightLoadGen) return;
        if (!document.getElementById('featured-tbody')) return;
        var featuredData = results[0];
        var upcomingData = results[1];
        var ok = (featuredData && featuredData.ok) || (upcomingData && upcomingData.ok);
        if (!ok) {
          if (status) {
            status.textContent =
              'Could not load events.' +
              (featuredData && featuredData.message
                ? ' ' + featuredData.message
                : upcomingData && upcomingData.message
                  ? ' ' + upcomingData.message
                  : '');
          }
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="7" class="px-4 py-6 text-red-700">Load failed. Try refreshing the page.</td></tr>';
          }
          return;
        }
        featuredSpotlightEvents = mergeSpotlightRows(
          featuredData && featuredData.ok ? featuredData.events : [],
          upcomingData && upcomingData.ok ? upcomingData.events : []
        );
        try {
          paintFeaturedSpotlightTable();
        } catch (err) {
          if (status) status.textContent = 'Could not display events.';
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="7" class="px-4 py-6 text-red-700">' +
              esc((err && err.message) || 'Display failed.') +
              '</td></tr>';
          }
        }
      })
      .catch(function (err) {
        if (loadGen !== featuredSpotlightLoadGen) return;
        if (!document.getElementById('featured-tbody')) return;
        if (status) status.textContent = 'Could not load events.';
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="7" class="px-4 py-6 text-red-700">' +
            esc((err && err.message) || 'Request failed.') +
            '</td></tr>';
        }
      });
  }

  function renderSpotlightEventsTab() {
    var typeOptions = EVENT_TYPES.map(function (t) {
      return (
        '<option value="' +
        attrEsc(t) +
        '"' +
        (featuredSpotlightState.eventType === t ? ' selected' : '') +
        '>' +
        esc(t) +
        '</option>'
      );
    }).join('');

    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="spotlight-slots-wrap" class="text-sm text-slate-500">Loading carousel slot usage…</div>' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Toggle featured events for the <strong>Premium Spotlight</strong> on <code class="text-[11px]">/events/</code>. Set an end date when you feature something (or choose no end date). You can change the date anytime under Expires.</p>' +
      '<p id="featured-status" class="text-sm text-slate-500">Loading approved events…</p>' +
      '<div class="admin-filter-bar rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="featured-spotlight-search" placeholder="Search event, organiser, or city…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(featuredSpotlightState.q) +
      '">' +
      '<select id="featured-spotlight-featured" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value=""' +
      (featuredSpotlightState.featured === '' ? ' selected' : '') +
      '>All spotlight</option>' +
      '<option value="yes"' +
      (featuredSpotlightState.featured === 'yes' ? ' selected' : '') +
      '>Featured only</option>' +
      '<option value="no"' +
      (featuredSpotlightState.featured === 'no' ? ' selected' : '') +
      '>Not featured</option></select></div>' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<select id="featured-spotlight-type" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value="">Any type</option>' +
      typeOptions +
      '</select>' +
      '<select id="featured-spotlight-when" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value=""' +
      (featuredSpotlightState.when === '' ? ' selected' : '') +
      '>Any date</option>' +
      '<option value="upcoming"' +
      (featuredSpotlightState.when === 'upcoming' ? ' selected' : '') +
      '>Upcoming</option>' +
      '<option value="past"' +
      (featuredSpotlightState.when === 'past' ? ' selected' : '') +
      '>Past</option></select>' +
      '<button type="button" id="featured-spotlight-clear" class="text-sm font-semibold text-slate-600 hover:text-brand-900 px-2 py-1">Clear filters</button></div></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Featured</th><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">Date</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Expires</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="featured-tbody"><tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>';

    loadSpotlightSlotBanner();
    bindFeaturedSpotlightFilters();
    bindSpotlightToggleHandlers();
    loadFeaturedSpotlightEvents();
  }

  function renderSpotlightOrganisersTab() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="spotlight-slots-wrap" class="text-sm text-slate-500">Loading carousel slot usage…</div>' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Featured groups appear in the organiser spotlight carousel on the Events browse page. Set an end date when you feature them (or choose no end date).</p>' +
      '<p id="spotlight-organisers-status" class="text-sm text-slate-500">Loading organisers…</p>' +
      '<div class="admin-filter-bar rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="spotlight-organisers-search" placeholder="Search name, city, or email…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(spotlightOrganiserState.q) +
      '">' +
      '<select id="spotlight-organisers-featured" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value=""' +
      (spotlightOrganiserState.featured === '' ? ' selected' : '') +
      '>All groups</option>' +
      '<option value="yes"' +
      (spotlightOrganiserState.featured === 'yes' ? ' selected' : '') +
      '>Featured only</option>' +
      '<option value="no"' +
      (spotlightOrganiserState.featured === 'no' ? ' selected' : '') +
      '>Not featured</option></select>' +
      '<button type="button" id="spotlight-organisers-clear" class="text-sm font-semibold text-slate-600 hover:text-brand-900 px-2 py-1">Clear</button></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Featured</th><th class="px-4 py-3 text-left">Group</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Listing</th><th class="px-4 py-3">Expires</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="spotlight-organisers-tbody"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>';

    loadSpotlightSlotBanner();
    bindSpotlightOrganiserFilters();
    bindSpotlightToggleHandlers();

    Promise.all([
      adminGet('/api/admin/organisers?featured=1&limit=100'),
      adminGet('/api/admin/organisers?limit=100'),
    ]).then(function (results) {
      var tbody = document.getElementById('spotlight-organisers-tbody');
      var status = document.getElementById('spotlight-organisers-status');
      var featuredData = results[0];
      var allData = results[1];
      if ((!featuredData || !featuredData.ok) && (!allData || !allData.ok)) {
        if (status) status.textContent = 'Could not load organisers.';
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-red-700">Load failed.</td></tr>';
        return;
      }
      var byId = new Map();
      ((featuredData && featuredData.ok && featuredData.organisers) || []).forEach(function (row) {
        if (row && row.id != null) byId.set(String(row.id), row);
      });
      ((allData && allData.ok && allData.organisers) || []).forEach(function (row) {
        if (!row || row.id == null) return;
        var key = String(row.id);
        if (!byId.has(key)) byId.set(key, row);
      });
      featuredSpotlightOrganisers = Array.from(byId.values());
      paintSpotlightOrganisersTable();
    });
  }

  function renderSpotlightOpportunitiesTab() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="spotlight-slots-wrap" class="text-sm text-slate-500">Loading carousel slot usage…</div>' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Featured opportunities appear in the Premium Spotlight on <code class="text-[11px]">/opportunities/</code>. Set an end date when you feature a listing (or choose no end date).</p>' +
      '<p id="spotlight-opportunities-status" class="text-sm text-slate-500">Loading opportunities…</p>' +
      '<div class="admin-filter-bar rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="spotlight-opportunities-search" placeholder="Search title, host, or owner email…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(spotlightOpportunityState.q) +
      '">' +
      '<select id="spotlight-opportunities-featured" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value=""' +
      (spotlightOpportunityState.featured === '' ? ' selected' : '') +
      '>All listings</option>' +
      '<option value="yes"' +
      (spotlightOpportunityState.featured === 'yes' ? ' selected' : '') +
      '>Featured only</option>' +
      '<option value="no"' +
      (spotlightOpportunityState.featured === 'no' ? ' selected' : '') +
      '>Not featured</option></select>' +
      '<button type="button" id="spotlight-opportunities-clear" class="text-sm font-semibold text-slate-600 hover:text-brand-900 px-2 py-1">Clear</button></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Featured</th><th class="px-4 py-3 text-left">Listing</th><th class="px-4 py-3">Host</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Expires</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="spotlight-opportunities-tbody"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>';

    loadSpotlightSlotBanner();
    bindSpotlightOpportunityFilters();
    bindSpotlightToggleHandlers();

    Promise.all([
      adminGet('/api/admin/opportunities?approval_status=Approved&featured=1&limit=100&sort=title'),
      adminGet('/api/admin/opportunities?approval_status=Approved&limit=100&sort=title'),
    ]).then(function (results) {
      var tbody = document.getElementById('spotlight-opportunities-tbody');
      var status = document.getElementById('spotlight-opportunities-status');
      var featuredData = results[0];
      var allData = results[1];
      if ((!featuredData || !featuredData.ok) && (!allData || !allData.ok)) {
        if (status) status.textContent = 'Could not load opportunities.';
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-red-700">Load failed.</td></tr>';
        return;
      }
      var byId = new Map();
      ((featuredData && featuredData.ok && featuredData.opportunities) || []).forEach(function (row) {
        if (row && row.id != null) byId.set(String(row.id), row);
      });
      ((allData && allData.ok && allData.opportunities) || []).forEach(function (row) {
        if (!row || row.id == null) return;
        var key = String(row.id);
        if (!byId.has(key)) byId.set(key, row);
      });
      featuredSpotlightOpportunities = Array.from(byId.values());
      paintSpotlightOpportunitiesTable();
    });
  }

  function renderSpotlightHub(fullHash) {
    var tab = resolveHubTab(
      fullHash,
      'spotlight',
      ['events', 'organisers', 'opportunities'],
      'events'
    );
    if (!tab) return;

    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'events', label: 'Events', href: '#spotlight/events' },
        { key: 'organisers', label: 'Organisers', href: '#spotlight/organisers' },
        { key: 'opportunities', label: 'Opportunities', href: '#spotlight/opportunities' },
      ],
      tab
    );

    if (tab === 'organisers') withHubTabs(tabsHtml, renderSpotlightOrganisersTab);
    else if (tab === 'opportunities') withHubTabs(tabsHtml, renderSpotlightOpportunitiesTab);
    else withHubTabs(tabsHtml, renderSpotlightEventsTab);
  }

  function renderFeatured() {
    location.replace('#spotlight/events');
  }

  function renderSupportBookings() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Search by attendee email, booking reference (<code class="text-[11px]">HUB-…</code>), registration ID, or event title. Use results to answer payment and ticket questions — refunds are handled via Stripe and organiser flows.</p>' +
      '<form id="bookings-search-form" class="flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="bookings-search-input" required placeholder="Email, HUB- reference, ID, or event title…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(bookingsSearchState.q) +
      '">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-800">Search</button></form>' +
      '<p id="bookings-search-status" class="text-sm text-slate-500">Enter a search term above.</p>' +
      '<div id="bookings-search-results"></div></div>';

    var form = document.getElementById('bookings-search-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('bookings-search-input');
        var q = (input && input.value ? input.value : '').trim();
        bookingsSearchState.q = q;
        runBookingsSearch(q);
      });
    }
    if (bookingsSearchState.q) runBookingsSearch(bookingsSearchState.q);
  }

  function runBookingsSearch(q) {
    var status = document.getElementById('bookings-search-status');
    var results = document.getElementById('bookings-search-results');
    if (!q) {
      if (status) status.textContent = 'Enter a search term above.';
      if (results) results.innerHTML = '';
      return;
    }
    if (status) status.textContent = 'Searching…';
    if (results) results.innerHTML = '';
    adminGet('/api/admin/bookings?q=' + encodeURIComponent(q)).then(function (data) {
      if (!data || !data.ok) {
        if (status) status.textContent = (data && data.message) || 'Search failed.';
        return;
      }
      var bookings = data.bookings || [];
      if (status) {
        status.textContent = bookings.length
          ? bookings.length + ' booking' + (bookings.length === 1 ? '' : 's') + ' found'
          : data.message || 'No bookings match that search.';
      }
      if (!results) return;
      if (!bookings.length) {
        results.innerHTML = '';
        return;
      }
      results.innerHTML = adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Reference</th><th class="px-4 py-3 text-left">Attendee</th><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Paid</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Booked</th><th class="px-4 py-3"></th></tr></thead><tbody>' +
          bookings
            .map(function (b) {
              var eventDate = b.eventStartsAt ? fmtTime(b.eventStartsAt).split(',')[0] : '—';
              var payLabel = b.amountPaid > 0 ? fmtMoney(b.amountPaid) : 'Free';
              var statusCls =
                b.paymentStatus === 'Paid'
                  ? 'text-emerald-700'
                  : b.paymentStatus === 'Refunded'
                    ? 'text-slate-500'
                    : 'text-amber-800';
              var accountUrl =
                '../account/?booking=' + encodeURIComponent(b.id) + '#payments';
              return (
                '<tr class="border-t border-slate-100">' +
                '<td class="px-4 py-3 font-mono text-xs">' +
                esc(b.bookingReference) +
                '</td>' +
                '<td class="px-4 py-3"><span class="font-medium">' +
                esc(b.attendeeName) +
                '</span><br><span class="text-xs text-slate-500">' +
                esc(b.attendeeEmail) +
                '</span></td>' +
                '<td class="px-4 py-3"><span class="font-medium">' +
                esc(b.eventTitle) +
                '</span><br><span class="text-xs text-slate-500">' +
                esc(eventDate) +
                ' · ' +
                esc(b.ticketName) +
                (b.quantity > 1 ? ' ×' + b.quantity : '') +
                '</span></td>' +
                '<td class="px-4 py-3">' +
                esc(payLabel) +
                '</td>' +
                '<td class="px-4 py-3"><span class="text-xs font-semibold ' +
                statusCls +
                '">' +
                esc(b.paymentStatus) +
                (b.cancelledAt ? ' · Cancelled' : '') +
                (b.refundEmailSentAt ? ' · Refund emailed' : '') +
                '</span></td>' +
                '<td class="px-4 py-3 text-xs">' +
                esc(formatAccountDate(b.createdAt)) +
                '</td>' +
                '<td class="px-4 py-3"><a href="' +
                attrEsc(accountUrl) +
                '" target="_blank" rel="noopener" class="text-brand-700 text-xs font-semibold hover:underline">Open</a></td></tr>'
              );
            })
            .join('') +
          '</tbody></table>'
      );
    });
  }

  function complaintCategoryLabel(key) {
    var labels = {
      platform: 'Platform / service',
      refund: 'Refund',
      listing: 'Listing / content',
      advertising: 'Advertising',
      data_protection: 'Data protection',
      payments: 'Payments',
      accessibility: 'Accessibility',
      other: 'Other',
    };
    return labels[key] || key || 'Other';
  }

  function complaintStatusLabel(key) {
    var labels = {
      open: 'Open',
      investigating: 'Investigating',
      awaiting_third_party: 'Awaiting third party',
      resolved: 'Resolved',
      escalated: 'Escalated',
      closed: 'Closed',
    };
    return labels[key] || key || 'Open';
  }

  function complaintOutcomeLabel(key) {
    var labels = {
      upheld: 'Upheld',
      partly_upheld: 'Partly upheld',
      not_upheld: 'Not upheld',
      referred: 'Referred externally',
    };
    return labels[key] || '—';
  }

  function complaintDueClass(dueDate, status) {
    if (status === 'resolved' || status === 'closed') return 'text-slate-500';
    if (!dueDate) return 'text-slate-600';
    var due = new Date(dueDate + 'T23:59:59');
    var now = new Date();
    if (due < now) return 'text-red-700 font-semibold';
    var soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    if (due <= soon) return 'text-amber-800 font-semibold';
    return 'text-slate-600';
  }

  function renderSupportComplaints() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">When a complaint arrives at <strong>hello@thenetworkerhub.com</strong>, log it here after sending the acknowledgement (target: 2 working days). Substantive response target: <strong>14 days</strong>. Ops lead: <strong>Catherine Hancher</strong>. Commercial / ASA: <strong>Rosie McGilvray</strong>.</p>' +
      '<form id="complaint-create-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">' +
      '<h3 class="font-bold text-brand-900">Log complaint</h3>' +
      '<div class="grid gap-4 sm:grid-cols-2">' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Complainant name<input type="text" id="complaint-name" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Jane Smith"></label>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Complainant email<span class="text-red-600">*</span><input type="email" id="complaint-email" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="jane@example.com"></label>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Category<select id="complaint-category" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">' +
      '<option value="platform">Platform / service</option><option value="refund">Refund</option><option value="listing">Listing / content</option><option value="advertising">Advertising</option><option value="data_protection">Data protection</option><option value="payments">Payments</option><option value="accessibility">Accessibility</option><option value="other">Other</option>' +
      '</select></label>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Assigned to<select id="complaint-assigned" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">' +
      '<option value="">Unassigned</option><option value="Catherine Hancher">Catherine Hancher (Operations)</option><option value="Rosie McGilvray">Rosie McGilvray (Commercial)</option>' +
      '</select></label>' +
      '</div>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Subject<input type="text" id="complaint-subject" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Complaint about refund"></label>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Complaint details<textarea id="complaint-body" rows="4" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Paste the email or summary"></textarea></label>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase">Related reference <span class="font-normal normal-case">(HUB-…, event, optional)</span><input type="text" id="complaint-related-ref" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="HUB-…"></label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" id="complaint-ack-sent" class="rounded border-slate-300"> Acknowledgement already sent</label>' +
      '<div class="flex flex-wrap items-center gap-3"><button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-800">Save complaint</button><span id="complaint-create-status" class="text-sm text-slate-500"></span></div>' +
      '</form>' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<h3 class="font-bold text-brand-900">Complaints register</h3>' +
      '<div class="flex gap-2 text-sm">' +
      '<button type="button" class="complaints-filter-btn rounded-lg border px-3 py-1.5 font-semibold ' +
      (complaintsState.filter === 'open' ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-600') +
      '" data-filter="open">Open</button>' +
      '<button type="button" class="complaints-filter-btn rounded-lg border px-3 py-1.5 font-semibold ' +
      (complaintsState.filter === 'all' ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-600') +
      '" data-filter="all">All</button></div></div>' +
      '<p id="complaints-status" class="text-sm text-slate-500">Loading complaints…</p>' +
      '<div id="complaints-list" class="space-y-3"></div></div>';

    bindComplaintsActions();
    loadComplaints();
  }

  function complaintsListHtml(items) {
    if (!items.length) {
      return '<p class="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">No complaints in this view.</p>';
    }
    return items
      .map(function (c) {
        var expanded = !!complaintsState.expanded[c.id];
        var dueCls = complaintDueClass(c.dueDate, c.status);
        return (
          '<article class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-complaint-id="' +
          attrEsc(c.id) +
          '">' +
          '<button type="button" class="complaint-toggle w-full text-left px-4 py-3 hover:bg-slate-50" data-complaint-id="' +
          attrEsc(c.id) +
          '">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<div><p class="font-semibold text-brand-900">' +
          esc(c.reference) +
          ' · ' +
          esc(c.subject || complaintCategoryLabel(c.category)) +
          '</p><p class="text-xs text-slate-500 mt-0.5">' +
          esc(c.complainantName || '—') +
          ' · ' +
          esc(c.complainantEmail) +
          (c.assignedTo ? ' · ' + esc(c.assignedTo) : '') +
          '</p></div>' +
          '<div class="text-right text-xs"><span class="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">' +
          esc(complaintStatusLabel(c.status)) +
          '</span><p class="' +
          dueCls +
          ' mt-1">Due ' +
          esc(c.dueDate || '—') +
          '</p></div></div></button>' +
          (expanded
            ? '<div class="border-t border-slate-100 px-4 py-4 space-y-3 bg-slate-50/60">' +
              '<p class="text-sm text-slate-700 whitespace-pre-wrap">' +
              esc(c.body || '—') +
              '</p>' +
              (c.relatedReference
                ? '<p class="text-xs text-slate-500">Related: <span class="font-mono">' + esc(c.relatedReference) + '</span></p>'
                : '') +
              (c.acknowledgementSentAt
                ? '<p class="text-xs text-emerald-700">Ack sent ' + esc(formatAccountDate(c.acknowledgementSentAt)) + '</p>'
                : '<p class="text-xs text-amber-800">Acknowledgement not logged yet</p>') +
              '<div class="grid gap-3 sm:grid-cols-3">' +
              '<label class="block text-xs font-semibold text-slate-500 uppercase">Status<select class="complaint-edit-status mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" data-complaint-id="' +
              attrEsc(c.id) +
              '">' +
              ['open', 'investigating', 'awaiting_third_party', 'resolved', 'escalated', 'closed']
                .map(function (s) {
                  return (
                    '<option value="' +
                    s +
                    '"' +
                    (c.status === s ? ' selected' : '') +
                    '>' +
                    esc(complaintStatusLabel(s)) +
                    '</option>'
                  );
                })
                .join('') +
              '</select></label>' +
              '<label class="block text-xs font-semibold text-slate-500 uppercase">Outcome<select class="complaint-edit-outcome mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" data-complaint-id="' +
              attrEsc(c.id) +
              '"><option value="">—</option>' +
              ['upheld', 'partly_upheld', 'not_upheld', 'referred']
                .map(function (o) {
                  return (
                    '<option value="' +
                    o +
                    '"' +
                    (c.outcome === o ? ' selected' : '') +
                    '>' +
                    esc(complaintOutcomeLabel(o)) +
                    '</option>'
                  );
                })
                .join('') +
              '</select></label>' +
              '<label class="block text-xs font-semibold text-slate-500 uppercase">Assigned<select class="complaint-edit-assigned mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white" data-complaint-id="' +
              attrEsc(c.id) +
              '"><option value="">Unassigned</option><option value="Catherine Hancher"' +
              (c.assignedTo === 'Catherine Hancher' ? ' selected' : '') +
              '>Catherine Hancher</option><option value="Rosie McGilvray"' +
              (c.assignedTo === 'Rosie McGilvray' ? ' selected' : '') +
              '>Rosie McGilvray</option></select></label></div>' +
              '<label class="block text-xs font-semibold text-slate-500 uppercase">Internal notes<textarea class="complaint-edit-notes mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows="3" data-complaint-id="' +
              attrEsc(c.id) +
              '">' +
              esc(c.notes || '') +
              '</textarea></label>' +
              '<label class="block text-xs font-semibold text-slate-500 uppercase">Resolution summary<textarea class="complaint-edit-resolution mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows="2" data-complaint-id="' +
              attrEsc(c.id) +
              '">' +
              esc(c.resolutionSummary || '') +
              '</textarea></label>' +
              '<div class="flex flex-wrap gap-2">' +
              '<button type="button" class="complaint-save-btn rounded-lg bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 hover:bg-brand-800" data-complaint-id="' +
              attrEsc(c.id) +
              '">Save changes</button>' +
              '<button type="button" class="complaint-ack-btn rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 hover:bg-white" data-complaint-id="' +
              attrEsc(c.id) +
              '">Mark ack sent</button></div></div>'
            : '') +
          '</article>'
        );
      })
      .join('');
  }

  function renderComplaintsList(items) {
    var listEl = document.getElementById('complaints-list');
    if (listEl) listEl.innerHTML = complaintsListHtml(items || []);
  }

  function loadComplaints() {
    var statusEl = document.getElementById('complaints-status');
    var listEl = document.getElementById('complaints-list');
    if (statusEl) statusEl.textContent = 'Loading complaints…';
    var url =
      '/api/admin/complaints' + (complaintsState.filter === 'open' ? '?status=open' : '');
    adminGet(url).then(function (data) {
      if (!data || !data.ok) {
        complaintsState.items = [];
        if (statusEl) statusEl.textContent = (data && data.message) || 'Could not load complaints.';
        if (listEl) listEl.innerHTML = '';
        return;
      }
      if (data.configured === false) {
        complaintsState.items = [];
        if (statusEl) statusEl.textContent = data.message || 'Run migration 138 in Supabase.';
        if (listEl) listEl.innerHTML = '';
        return;
      }
      complaintsState.items = data.complaints || [];
      if (statusEl) {
        statusEl.textContent =
          complaintsState.items.length +
          ' complaint' +
          (complaintsState.items.length === 1 ? '' : 's') +
          ' · register in Supabase';
      }
      renderComplaintsList(complaintsState.items);
    });
  }

  function bindComplaintsActions() {
    if (!main || main.dataset.complaintsBound) return;
    main.dataset.complaintsBound = '1';

    main.addEventListener('submit', function (e) {
      var form = e.target.closest('#complaint-create-form');
      if (!form) return;
      e.preventDefault();
      var statusEl = document.getElementById('complaint-create-status');
      var email = (document.getElementById('complaint-email') || {}).value || '';
      if (!String(email).trim()) {
        if (statusEl) statusEl.textContent = 'Email is required.';
        return;
      }
      if (statusEl) statusEl.textContent = 'Saving…';
      adminPost('/api/admin/complaints', {
        complainantName: (document.getElementById('complaint-name') || {}).value || '',
        complainantEmail: email.trim(),
        category: (document.getElementById('complaint-category') || {}).value || 'other',
        subject: (document.getElementById('complaint-subject') || {}).value || '',
        body: (document.getElementById('complaint-body') || {}).value || '',
        relatedReference: (document.getElementById('complaint-related-ref') || {}).value || '',
        assignedTo: (document.getElementById('complaint-assigned') || {}).value || '',
        acknowledgementSent: !!(document.getElementById('complaint-ack-sent') || {}).checked,
      })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Save failed');
          form.reset();
          if (statusEl) {
            statusEl.textContent = 'Saved as ' + (data.complaint && data.complaint.reference) + '.';
          }
          loadComplaints();
          refreshAdminNotifications();
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || 'Could not save complaint.';
        });
    });

    main.addEventListener('click', function (e) {
      var filterBtn = e.target.closest('.complaints-filter-btn');
      if (filterBtn) {
        complaintsState.filter = filterBtn.getAttribute('data-filter') || 'open';
        document.querySelectorAll('.complaints-filter-btn').forEach(function (btn) {
          var on = btn.getAttribute('data-filter') === complaintsState.filter;
          btn.className =
            'complaints-filter-btn rounded-lg border px-3 py-1.5 font-semibold ' +
            (on ? 'border-brand-700 bg-brand-50 text-brand-900' : 'border-slate-200 text-slate-600');
        });
        loadComplaints();
        return;
      }

      var toggleBtn = e.target.closest('.complaint-toggle');
      if (toggleBtn) {
        var toggleId = toggleBtn.getAttribute('data-complaint-id');
        if (toggleId) complaintsState.expanded[toggleId] = !complaintsState.expanded[toggleId];
        renderComplaintsList(complaintsState.items);
        return;
      }

      var ackBtn = e.target.closest('.complaint-ack-btn');
      if (ackBtn) {
        var ackId = ackBtn.getAttribute('data-complaint-id');
        if (!ackId) return;
        ackBtn.disabled = true;
        adminPatch('/api/admin/complaints', { id: ackId, acknowledgementSent: true })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            loadComplaints();
          })
          .catch(function (err) {
            ackBtn.disabled = false;
            window.alert(err.message || 'Could not update acknowledgement.');
          });
        return;
      }

      var saveBtn = e.target.closest('.complaint-save-btn');
      if (saveBtn) {
        var saveId = saveBtn.getAttribute('data-complaint-id');
        if (!saveId) return;
        saveBtn.disabled = true;
        adminPatch('/api/admin/complaints', {
          id: saveId,
          status: (document.querySelector('.complaint-edit-status[data-complaint-id="' + saveId + '"]') || {})
            .value,
          outcome: (document.querySelector('.complaint-edit-outcome[data-complaint-id="' + saveId + '"]') || {})
            .value,
          assignedTo: (document.querySelector('.complaint-edit-assigned[data-complaint-id="' + saveId + '"]') || {})
            .value,
          notes: (document.querySelector('.complaint-edit-notes[data-complaint-id="' + saveId + '"]') || {}).value,
          resolutionSummary: (
            document.querySelector('.complaint-edit-resolution[data-complaint-id="' + saveId + '"]') || {}
          ).value,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            loadComplaints();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            saveBtn.disabled = false;
            window.alert(err.message || 'Could not save changes.');
          });
      }
    });
  }

  function renderSupportHub(fullHash) {
    var tab = resolveHubTab(fullHash, 'support', ['bookings', 'complaints'], 'bookings');
    if (!tab) return;
    var complaintsBadge = hubTabBadge(actionCountValue('openComplaints'));
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'bookings', label: 'Bookings', href: '#support/bookings' },
        {
          key: 'complaints',
          label: 'Complaints',
          href: '#support/complaints',
          badgeHtml: complaintsBadge,
          badgeKey: 'openComplaints',
        },
      ],
      tab
    );
    if (tab === 'complaints') withHubTabs(tabsHtml, renderSupportComplaints);
    else withHubTabs(tabsHtml, renderSupportBookings);
  }

  function bindFinancialsActions() {
    if (!main || main.dataset.financialsBound) return;
    main.dataset.financialsBound = '1';
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('.payout-status-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-payout-id');
      var status = btn.getAttribute('data-payout-status');
      if (!id || !status) return;
      var label = status === 'paid' ? 'Mark this payout as paid?' : 'Approve this payout request?';
      if (!window.confirm(label)) return;
      btn.disabled = true;
      adminPatch('/api/admin/financials', { id: id, status: status })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
          refreshFinancialsView();
        })
        .catch(function (err) {
          btn.disabled = false;
          window.alert(err.message || 'Could not update payout.');
        });
    });
  }

  function renderSocialPosts() {
    if (window.AdminSocialPosts && window.AdminSocialPosts.render) {
      window.AdminSocialPosts.render(main, {
        adminGet: adminGet,
        adminPost: adminPost,
        esc: esc,
        attrEsc: attrEsc,
      });
      return;
    }
    main.innerHTML =
      '<p class="text-sm text-slate-600">Social post composer failed to load. Refresh the page.</p>';
  }


  function renderCampaigns() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      '<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">' +
      '<p class="text-sm font-semibold text-amber-950">Two-step organiser outreach (recommended)</p>' +
      '<ol class="text-sm text-amber-900 list-decimal list-inside space-y-1">' +
      '<li><strong>Email 1 — Rebrand</strong> (this week): familiar the-networker.co.uk tone. No password. Link to /for-organisers only.</li>' +
      '<li><strong>Email 2 — Confirm page</strong> (3–5 days later): create password → confirm listing → add event.</li>' +
      '</ol>' +
      '<p class="text-xs text-amber-800">For Email 1 via Resend, verify <code class="text-xs">the-networker.co.uk</code> and set <code class="text-xs">RESEND_FROM_LEGACY</code> in Vercel, or send manually from your co.uk inbox.</p>' +
      '</div>' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Bulk send organiser campaigns (max <strong>50 per batch</strong>). Use the <strong>same email as the group profile</strong> on each line.</p>' +
      '<p class="text-xs text-slate-500 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">Automated lifecycle emails are under <a href="#email/templates" class="font-semibold text-violet-800 underline">Templates &rarr; Automated</a>.</p>' +
      '<form id="campaign-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase mb-1" for="campaign-template">Email template</label>' +
      '<select id="campaign-template" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="organiser_rebrand_announcement">Email 1 — Rebrand announcement (send first)</option>' +
      '<option value="organiser_launch_invite">Email 2 — Confirm organiser page (3–5 days later)</option>' +
      '<option value="organiser_claim_invite">Short claim nudge (existing listing only)</option>' +
      '</select>' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase mb-1" for="campaign-recipients">Recipient emails</label>' +
      '<textarea id="campaign-recipients" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[120px]" placeholder="organiser@example.com&#10;one per line"></textarea>' +
      '<div id="campaign-claim-wrap">' +
      '<label class="block text-xs font-semibold text-slate-500 uppercase mb-1" for="campaign-claim-url">Claim URL override <span class="font-normal normal-case">(optional, Email 2 only)</span></label>' +
      '<input type="url" id="campaign-claim-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Leave blank for default confirm deep-link">' +
      '<p class="text-xs text-slate-500 mt-1">Default: <code class="text-xs">/register?email=…</code> or <code class="text-xs">/login?email=…</code> with <code class="text-xs">next=/organiser/?onboard=claim</code></p>' +
      '</div>' +
      '<div class="flex flex-wrap items-center gap-3 pt-2">' +
      '<button type="submit" class="rounded-lg bg-slate-800 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-900" id="campaign-submit">Send batch (max 50)</button>' +
      '<span id="campaign-status" class="text-sm text-slate-500"></span></div>' +
      '<pre id="campaign-result" class="hidden text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap"></pre>' +
      '</form></div>';

    var templateSelect = document.getElementById('campaign-template');
    var claimWrap = document.getElementById('campaign-claim-wrap');
    function syncCampaignClaimField() {
      if (!templateSelect || !claimWrap) return;
      var rebrand = templateSelect.value === 'organiser_rebrand_announcement';
      claimWrap.hidden = rebrand;
      claimWrap.style.display = rebrand ? 'none' : '';
    }
    if (templateSelect) {
      templateSelect.addEventListener('change', syncCampaignClaimField);
      syncCampaignClaimField();
    }

    var legacyForm = document.getElementById('campaign-form');
    if (legacyForm) {
      legacyForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var statusEl = document.getElementById('campaign-status');
        var resultEl = document.getElementById('campaign-result');
        var btn = document.getElementById('campaign-submit');
        var raw = (document.getElementById('campaign-recipients').value || '').trim();
        if (!raw) {
          if (statusEl) statusEl.textContent = 'Add at least one email.';
          return;
        }
        var lines = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        var slug = (document.getElementById('campaign-template').value || 'organiser_rebrand_announcement').trim();
        var payload = { action: 'bulk_send', slug: slug, emails: lines };
        if (slug !== 'organiser_rebrand_announcement') {
          var claimUrl = (document.getElementById('campaign-claim-url').value || '').trim();
          if (claimUrl) payload.variables = { claim_url: claimUrl };
        }
        btn.disabled = true;
        if (statusEl) statusEl.textContent = 'Sending…';
        adminPost('/api/admin/campaigns', payload)
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Send failed');
            if (statusEl) statusEl.textContent = data.message || 'Done.';
            if (resultEl) {
              resultEl.textContent = JSON.stringify(data, null, 2);
              resultEl.classList.remove('hidden');
            }
          })
          .catch(function (err) {
            if (statusEl) statusEl.textContent = err.message || 'Send failed.';
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    }
  }

  function renderImport() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"><strong>No emails are sent.</strong> Organiser import creates or updates group profiles. Attendee import adds browse records only — users still need to register to sign in.</p>' +
      '<form id="import-form" class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Import type</label>' +
      '<select id="import-type" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="organisers">Organisers (group profiles)</option>' +
      '<option value="attendees">Attendees (directory only)</option>' +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">CSV data</label>' +
      '<p class="text-xs text-slate-500 mb-2">Header row required. Columns: <code>email</code>, <code>name</code> (optional), <code>phone</code> (organisers only).</p>' +
      '<textarea id="import-csv" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[160px]" placeholder="email,name&#10;organiser@example.com,Example Networking Group"></textarea></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900" id="import-submit">Run import</button>' +
      '<span id="import-status" class="text-sm text-slate-500"></span></div>' +
      '<pre id="import-result" class="hidden text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap"></pre>' +
      '</form></div>';

    var form = document.getElementById('import-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var csv = (document.getElementById('import-csv').value || '').trim();
      var type = document.getElementById('import-type').value;
      var statusEl = document.getElementById('import-status');
      var resultEl = document.getElementById('import-result');
      var btn = document.getElementById('import-submit');
      if (!csv) {
        if (statusEl) statusEl.textContent = 'Paste CSV data first.';
        return;
      }
      if (!window.confirm('Import ' + type + ' from ' + csv.split(/\r?\n/).length + ' lines? No emails will be sent.')) return;
      btn.disabled = true;
      if (statusEl) statusEl.textContent = 'Importing…';
      if (resultEl) resultEl.classList.add('hidden');
      adminPost('/api/admin/import', { type: type, csv: csv })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Import failed');
          if (statusEl) statusEl.textContent = data.message || 'Import complete.';
          if (resultEl) {
            resultEl.textContent = JSON.stringify(
              { ok: data.ok, fail: data.fail, total: data.total, errors: data.errors },
              null,
              2
            );
            resultEl.classList.remove('hidden');
          }
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || 'Import failed.';
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  var OPPORTUNITY_TYPES = [
    ['franchise', 'Franchise'],
    ['side-hustle', 'Side hustle'],
    ['partnership', 'Partnership / Affiliate'],
    ['networking', 'Networking group / Ambassador'],
    ['network-marketing', 'Network marketing'],
    ['business-opportunity', 'Business opportunity'],
    ['distributorship', 'Distributorship / Reseller'],
  ];

  function opportunityTypeLabel(type) {
    for (var i = 0; i < OPPORTUNITY_TYPES.length; i++) {
      if (OPPORTUNITY_TYPES[i][0] === type) return OPPORTUNITY_TYPES[i][1];
    }
    return type || '—';
  }

  function opportunityTypeOptions(selected) {
    return OPPORTUNITY_TYPES.map(function (pair) {
      return (
        '<option value="' +
        attrEsc(pair[0]) +
        '"' +
        (selected === pair[0] ? ' selected' : '') +
        '>' +
        esc(pair[1]) +
        '</option>'
      );
    }).join('');
  }

  function opportunityStatusOptions(selected) {
    return ['draft', 'published', 'unpublished', 'archived']
      .map(function (s) {
        return (
          '<option value="' +
          attrEsc(s) +
          '"' +
          (selected === s ? ' selected' : '') +
          '>' +
          esc(s) +
          '</option>'
        );
      })
      .join('');
  }

  function opportunityCommitmentOptions(selected) {
    return ['', 'Full-time', 'Part-time / Flexible', 'Event-based', 'Flexible']
      .map(function (s) {
        return (
          '<option value="' +
          attrEsc(s) +
          '"' +
          (selected === s ? ' selected' : '') +
          '>' +
          esc(s || 'Select…') +
          '</option>'
        );
      })
      .join('');
  }

  function opportunityImageFieldHtml(key, urlName, label, help, imageUrl) {
    var hasPhoto = !!imageUrl;
    return (
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">' +
      esc(label) +
      '</label>' +
      '<p class="text-[11px] text-slate-500 mb-2">' +
      esc(help) +
      '</p>' +
      '<div class="admin-logo-zone border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
      attrEsc(key) +
      '" data-admin-logo-url-name="' +
      attrEsc(urlName) +
      '" tabindex="0" role="button" aria-label="' +
      attrEsc(label) +
      '">' +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
      '<img class="admin-logo-preview mx-auto h-16 w-auto max-w-full rounded-lg object-cover border border-slate-200' +
      (hasPhoto ? '' : ' hidden') +
      '" src="' +
      attrEsc(imageUrl || '') +
      '" alt="">' +
      '<p class="admin-logo-placeholder text-xs text-slate-500 mt-2' +
      (hasPhoto ? ' hidden' : '') +
      '">Drop image here or click to browse</p></div>' +
      '<input type="url" name="' +
      attrEsc(urlName) +
      '" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm mt-2" value="' +
      attrEsc(imageUrl || '') +
      '" placeholder="https://… (optional if you uploaded a file)"></div>'
    );
  }

  function opportunityImagePayloadForKey(key, form, urlName, base64Key) {
    var pending = adminLogoPending[key];
    var fieldName = urlName || 'image_url';
    var prefix = base64Key || 'photo';
    if (pending && pending.file) {
      return readFileAsBase64(pending.file).then(function (b64) {
        var payload = {};
        payload[prefix + '_base64'] = b64;
        payload[prefix + '_mime'] = pending.file.type;
        payload[prefix + '_filename'] = pending.file.name;
        if (form && formField(form, fieldName)) {
          var url = formFieldVal(form, fieldName);
          if (url) payload[fieldName] = url;
        }
        return payload;
      });
    }
    var payload = {};
    if (form && formField(form, fieldName)) payload[fieldName] = formFieldVal(form, fieldName) || null;
    return Promise.resolve(payload);
  }

  function opportunityListingFieldsHtml(opp, opts) {
    opp = opp || {};
    opts = opts || {};
    var coverKey = opts.coverKey || 'opp-cover';
    var logoKey = opts.logoKey || 'opp-logo';
    return (
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Title</label>' +
      '<input type="text" name="title" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(opp.title || '') +
      '" placeholder="e.g. Yorkshire café franchise — territory available"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Host / company</label>' +
      '<input type="text" name="host" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(opp.host || '') +
      '" placeholder="Acme Ltd"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Type</label>' +
      '<select name="type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      opportunityTypeOptions(opp.type || 'business-opportunity') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
      '<select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      opportunityStatusOptions(opp.status || 'published') +
      '</select></div>' +
      (opts.includeApproval
        ? '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Approval</label>' +
          '<select name="approval_status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
          '<option value="Pending Review"' +
          (opp.approval_status === 'Pending Review' ? ' selected' : '') +
          '>Pending review</option>' +
          '<option value="Approved"' +
          (opp.approval_status === 'Approved' ? ' selected' : '') +
          '>Approved</option>' +
          '<option value="Rejected"' +
          (opp.approval_status === 'Rejected' ? ' selected' : '') +
          '>Rejected</option></select></div>'
        : '') +
      '<div class="flex items-end"><label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer pb-2">' +
      '<input type="checkbox" name="featured" class="rounded border-slate-300"' +
      (opp.featured ? ' checked' : '') +
      '> Featured in spotlight <span class="text-xs text-slate-500">(not for network marketing)</span></label></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Short description</label>' +
      '<textarea name="description" rows="2" maxlength="400" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Shown on listing cards — what it is and who it suits">' +
      esc(opp.description || '') +
      '</textarea></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Full description</label>' +
      '<textarea name="about_text" rows="5" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="What’s included, support offered, and who you’re looking for. Separate paragraphs with a blank line.">' +
      esc(opp.about_text || '') +
      '</textarea></div>' +
      opportunityImageFieldHtml(
        coverKey,
        'image_url',
        'Cover image',
        'Shown on the listing card and detail page. Click, paste, or drop an image — or paste a URL.',
        opp.image_url || ''
      ) +
      opportunityImageFieldHtml(
        logoKey,
        'logo_url',
        'Business logo (optional)',
        'Square logo shown beside the company name.',
        opp.logo_url || ''
      ) +
      '<div class="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3 grid sm:grid-cols-2 gap-3">' +
      '<p class="sm:col-span-2 text-xs font-semibold text-slate-600">Card details</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Investment required</label>' +
      '<input type="text" name="investment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(opp.investment || '') +
      '" placeholder="e.g. £0 or £9,500"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Territory / location</label>' +
      '<input type="text" name="location" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(opp.location || '') +
      '" placeholder="e.g. Yorkshire / Remote / UK-wide"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">What’s included in this investment? <span class="font-normal">(optional)</span></label>' +
      '<textarea name="investment_includes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Training, starter kit, marketing materials…">' +
      esc(opp.investment_includes || '') +
      '</textarea></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Commitment</label>' +
      '<select name="commitment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      opportunityCommitmentOptions(opp.commitment || '') +
      '</select></div></div>'
    );
  }

  function opportunityCleanupHasActiveFilters() {
    return !!(
      opportunityCleanupState.q ||
      opportunityCleanupState.status ||
      opportunityCleanupState.approval ||
      opportunityCleanupState.type ||
      opportunityCleanupState.featured ||
      opportunityCleanupState.noImage
    );
  }

  function syncOpportunityCleanupFilterUi() {
    var el;
    el = document.getElementById('opportunity-cleanup-search');
    if (el) el.value = opportunityCleanupState.q || '';
    el = document.getElementById('opportunity-cleanup-sort');
    if (el) el.value = opportunityCleanupState.sort || 'recent';
    el = document.getElementById('opportunity-cleanup-status-filter');
    if (el) el.value = opportunityCleanupState.status || '';
    el = document.getElementById('opportunity-cleanup-approval-filter');
    if (el) el.value = opportunityCleanupState.approval || '';
    el = document.getElementById('opportunity-cleanup-type-filter');
    if (el) el.value = opportunityCleanupState.type || '';
    el = document.getElementById('opportunity-cleanup-featured');
    if (el) el.checked = !!opportunityCleanupState.featured;
    el = document.getElementById('opportunity-cleanup-no-image');
    if (el) el.checked = !!opportunityCleanupState.noImage;
    if (!main) return;
    main.querySelectorAll('[data-opp-quick]').forEach(function (btn) {
      var key = btn.getAttribute('data-opp-quick');
      var active = false;
      if (key === 'pending') active = opportunityCleanupState.approval === 'Pending Review';
      else if (key === 'draft') active = opportunityCleanupState.status === 'draft';
      else if (key === 'published') active = opportunityCleanupState.status === 'published';
      else if (key === 'featured') active = opportunityCleanupState.featured;
      else if (key === 'no_image') active = opportunityCleanupState.noImage;
      btn.classList.toggle('ring-2', active);
      btn.classList.toggle('ring-brand-700', active);
      btn.classList.toggle('bg-brand-50', active);
    });
  }

  function opportunityCleanupEditFormHtml(opp) {
    return (
      '<form class="opportunity-cleanup-form space-y-4" data-opportunity-id="' +
      attrEsc(opp.id) +
      '">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-[1] -mx-1 px-1 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-200">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Save listing</button>' +
      '<button type="button" data-opp-delete-form="' +
      attrEsc(opp.id) +
      '" data-opp-delete-title="' +
      attrEsc(opp.title || 'Untitled') +
      '" class="rounded-lg border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50">Delete listing</button>' +
      '</div>' +
      '<span class="opportunity-cleanup-msg text-xs"></span></div>' +
      '<div class="grid sm:grid-cols-2 gap-3">' +
      opportunityListingFieldsHtml(opp, {
        includeApproval: true,
        coverKey: 'opp-edit-cover-' + opp.id,
        logoKey: 'opp-edit-logo-' + opp.id,
      }) +
      '<div class="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3 space-y-2">' +
      '<p class="text-xs font-semibold text-slate-600">Listing owner &amp; claim invite</p>' +
      '<p class="text-xs text-slate-500">Hub-owned listings stay claimable until you assign a claimant email. Assigning opens the in-dashboard claim prompt when they sign in.</p>' +
      '<div class="flex flex-wrap gap-2 items-end">' +
      '<div class="flex-1 min-w-[12rem]"><label class="block text-xs font-semibold text-slate-500 mb-1">Owner email</label>' +
      '<input type="email" name="owner_email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(opp.owner_email || '') +
      '" placeholder="claimant@example.com"></div>' +
      '<button type="button" data-opp-assign-owner="' +
      attrEsc(opp.id) +
      '" class="rounded-lg bg-amber-700 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-800">Assign &amp; send claim invite</button>' +
      '</div>' +
      (opp.ownership_claim_status
        ? '<p class="text-xs text-slate-500">Claim status: <span class="font-semibold">' +
          esc(opp.ownership_claim_status) +
          '</span></p>'
        : '') +
      '</div>' +
      '</div></form>'
    );
  }

  function rememberSelectedOpportunity(opp) {
    if (!opp || opp.id == null) return;
    opportunityCleanupState.selected[String(opp.id)] = {
      id: opp.id,
      title: opp.title || 'Untitled',
      host: opp.host || '',
    };
  }

  function forgetSelectedOpportunity(id) {
    delete opportunityCleanupState.selected[String(id)];
  }

  function clearSelectedOpportunities() {
    opportunityCleanupState.selected = {};
  }

  function getSelectedOpportunityIds() {
    return Object.keys(opportunityCleanupState.selected);
  }

  function selectedOpportunityRows() {
    return getSelectedOpportunityIds().map(function (id) {
      return opportunityCleanupState.selected[id];
    });
  }

  function updateOpportunityBulkBar() {
    var bar = document.getElementById('opportunity-cleanup-bulk');
    var countEl = document.getElementById('opportunity-bulk-count');
    var chipsEl = document.getElementById('opportunity-selected-chips');
    var deleteSection = document.getElementById('opportunity-delete-section');
    var ids = getSelectedOpportunityIds();
    var rows = selectedOpportunityRows();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
    if (deleteSection) deleteSection.classList.toggle('hidden', ids.length === 0);
    if (chipsEl) {
      chipsEl.innerHTML = rows
        .map(function (opp) {
          var label = opp.title || 'Untitled';
          if (opp.host) label += ' · ' + opp.host;
          return (
            '<span class="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-900">' +
            '<span class="truncate max-w-[14rem]" title="' +
            attrEsc(label) +
            '">' +
            esc(label) +
            '</span>' +
            '<button type="button" class="shrink-0 text-slate-400 hover:text-red-700 font-bold leading-none" data-unselect-opp="' +
            attrEsc(opp.id) +
            '" aria-label="Remove ' +
            attrEsc(opp.title || 'listing') +
            ' from selection">×</button></span>'
          );
        })
        .join('');
    }
    if (main) {
      var selectPage = document.getElementById('opportunity-cleanup-select-page');
      var pageCbs = main.querySelectorAll('.opportunity-select-checkbox');
      var allPageChecked = pageCbs.length > 0;
      pageCbs.forEach(function (cb) {
        if (!opportunityCleanupState.selected[cb.value]) allPageChecked = false;
      });
      if (selectPage) selectPage.checked = allPageChecked;
    }
  }

  function deleteSelectedOpportunities() {
    var ids = getSelectedOpportunityIds();
    if (!ids.length) return;
    if (
      !window.confirm(
        'Permanently delete ' +
          ids.length +
          ' selected listing' +
          (ids.length === 1 ? '' : 's') +
          '? This cannot be undone.'
      )
    ) {
      return;
    }
    var msg = document.getElementById('opportunity-delete-msg');
    var btn = document.getElementById('opportunity-delete-btn');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Deleting…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/opportunities', { action: 'bulk_delete', ids: ids })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
        clearSelectedOpportunities();
        if (msg) {
          var skipped = data.skipped && data.skipped.length;
          msg.textContent = skipped
            ? 'Deleted ' + data.deleted + '. Skipped ' + skipped + '.'
            : 'Deleted ' + data.deleted + ' listing' + (data.deleted === 1 ? '' : 's') + '.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshOpportunityCleanupData();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not delete';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function deleteOpportunityListing(id, title) {
    if (!id) return;
    var label = title || 'this listing';
    if (!window.confirm('Permanently delete “' + label + '”? This cannot be undone.')) return;
    adminPost('/api/admin/opportunities', { id: id, action: 'delete' })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
        delete opportunityCleanupState.expanded[id];
        forgetSelectedOpportunity(id);
        return refreshOpportunityCleanupData();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not delete listing.');
      });
  }

  function fetchOpportunityCleanup(pageIndex) {
    var fetchToken = ++opportunityCleanupState.fetchToken;
    opportunityCleanupState.loading = true;
    var page =
      typeof pageIndex === 'number' && !isNaN(pageIndex)
        ? Math.max(0, pageIndex)
        : opportunityCleanupState.page;
    opportunityCleanupState.page = page;
    var params = new URLSearchParams();
    params.set('offset', String(page * OPPORTUNITY_PAGE_SIZE));
    params.set('limit', String(OPPORTUNITY_PAGE_SIZE));
    if (opportunityCleanupState.status) params.set('status', opportunityCleanupState.status);
    if (opportunityCleanupState.approval) params.set('approval_status', opportunityCleanupState.approval);
    if (opportunityCleanupState.type) params.set('type', opportunityCleanupState.type);
    if (opportunityCleanupState.featured) params.set('featured', '1');
    if (opportunityCleanupState.noImage) params.set('no_image', '1');
    if (opportunityCleanupState.sort) params.set('sort', opportunityCleanupState.sort);
    if (opportunityCleanupState.q) params.set('q', opportunityCleanupState.q);
    return adminGet('/api/admin/opportunities?' + params.toString())
      .then(function (data) {
        if (fetchToken !== opportunityCleanupState.fetchToken) return opportunityCleanupCache;
        opportunityCleanupState.loading = false;
        if (!data || data.error) return data;
        opportunityCleanupCache = data;
        opportunityCleanupState.total =
          data.total != null ? data.total : (data.opportunities || []).length;
        return opportunityCleanupCache;
      })
      .catch(function () {
        if (fetchToken === opportunityCleanupState.fetchToken) {
          opportunityCleanupState.loading = false;
        }
        return { error: 'network_error' };
      });
  }

  function goToOpportunityPage(page) {
    var next = Math.max(0, page);
    var listEl = document.getElementById('opportunity-cleanup-list');
    opportunityCleanupState.expanded = {};
    fetchOpportunityCleanup(next).then(function (data) {
      applyOpportunityCleanupData(data);
      if (listEl && listEl.scrollIntoView) {
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function applyOpportunityCleanupData(data) {
    var status = document.getElementById('opportunity-cleanup-status');
    if (!data || data.error || data.ok === false) {
      if (status) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load opportunities (' +
          esc((data && (data.error || data.message)) || 'unknown') +
          ').</span>';
      }
      return;
    }
    opportunityCleanupCache = data;
    renderOpportunityCleanupList();
  }

  function refreshOpportunityCleanupData() {
    opportunityCleanupState.page = 0;
    opportunityCleanupState.expanded = {};
    return fetchOpportunityCleanup(0).then(applyOpportunityCleanupData);
  }

  function refreshOpportunityCleanupPage() {
    var savedExpanded = opportunityCleanupState.expanded;
    return fetchOpportunityCleanup(opportunityCleanupState.page).then(function (data) {
      opportunityCleanupState.expanded = savedExpanded;
      applyOpportunityCleanupData(data);
    });
  }

  function renderOpportunityCleanupList() {
    var list = document.getElementById('opportunity-cleanup-list');
    var status = document.getElementById('opportunity-cleanup-status');
    var hint = document.getElementById('opportunity-cleanup-hint');
    if (!list || !opportunityCleanupCache) return;

    var opportunities = opportunityCleanupCache.opportunities || [];
    var page = opportunityCleanupState.page;
    var pageStart = opportunities.length ? page * OPPORTUNITY_PAGE_SIZE + 1 : 0;
    var pageEnd = page * OPPORTUNITY_PAGE_SIZE + opportunities.length;
    var total = opportunityCleanupState.total || opportunities.length;
    var pendingCount = opportunityCleanupCache.pending_count || 0;

    if (status) {
      var parts = [
        '<span class="text-brand-900 font-semibold">' +
          (opportunities.length
            ? 'Showing ' +
              pageStart +
              '–' +
              pageEnd +
              ' of ' +
              total +
              ' listing' +
              (total === 1 ? '' : 's')
            : 'No listings on this page') +
          '</span>',
      ];
      if (pendingCount) {
        parts.push(
          '<span class="text-amber-800 font-semibold">' + pendingCount + ' pending review</span>'
        );
      }
      if (opportunityCleanupState.loading) {
        parts.push('<span class="text-slate-400">Loading…</span>');
      }
      status.innerHTML = parts.join(' · ');
    }

    if (hint) {
      if (total > OPPORTUNITY_PAGE_SIZE && !opportunityCleanupHasActiveFilters()) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }

    if (!opportunities.length) {
      var emptyMsg =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No business opportunities match your filters.</p>';
      if (pendingCount > 0 && opportunityCleanupHasActiveFilters()) {
        emptyMsg =
          '<div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">' +
          '<p class="text-sm text-amber-950 font-semibold">' +
          pendingCount +
          ' listing' +
          (pendingCount === 1 ? ' is' : 's are') +
          ' awaiting review, but ' +
          (pendingCount === 1 ? 'it is' : 'they are') +
          ' hidden by your current filters.</p>' +
          '<p class="text-sm text-amber-900/90">Pending listings are usually drafts — try clearing filters or use the Pending review shortcut.</p>' +
          '<button type="button" data-opp-quick="pending" class="text-xs font-semibold rounded-full border border-amber-300 bg-white px-3 py-1.5 text-amber-950 hover:bg-amber-100">Show pending review</button>' +
          '</div>';
      }
      list.innerHTML = emptyMsg + adminPaginationHtml(page, total, OPPORTUNITY_PAGE_SIZE, 'data-opp-page');
      return;
    }

    var rows = opportunities
      .map(function (opp) {
        var publicHref =
          '../opportunities/' +
          encodeURIComponent(opp.slug || opp.id);
        var isPending = opp.approval_status === 'Pending Review';
        var rowClass = isPending ? 'border-b border-amber-100 bg-amber-50/40' : 'border-b border-slate-100';
        var isOpen = !!opportunityCleanupState.expanded[opp.id];
        if (opportunityCleanupState.selected[opp.id]) rememberSelectedOpportunity(opp);
        var checked = opportunityCleanupState.selected[opp.id] ? ' checked' : '';
        return (
          '<tr class="hover:bg-slate-50/80 ' +
          rowClass +
          '" data-opportunity-id-row="' +
          attrEsc(opp.id) +
          '">' +
          '<td class="py-2.5 pr-2 w-8">' +
          '<input type="checkbox" class="opportunity-select-checkbox rounded border-slate-300" value="' +
          attrEsc(opp.id) +
          '"' +
          checked +
          ' aria-label="Select ' +
          attrEsc(opp.title || 'listing') +
          '">' +
          '</td>' +
          '<td class="py-2.5 pr-3 max-w-[14rem]"><div class="font-semibold text-brand-900 truncate" title="' +
          attrEsc(opp.title || 'Untitled') +
          '">' +
          esc(opp.title || 'Untitled') +
          '</div>' +
          '<div class="text-[11px] text-slate-500 truncate">' +
          esc(opp.host || '—') +
          '</div></td>' +
          '<td class="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">' +
          esc(opportunityTypeLabel(opp.type)) +
          '</td>' +
          '<td class="py-2.5 pr-3"><div class="flex flex-wrap gap-1">' +
          listingStatusBadge(opp.status) +
          approvalStatusBadge(opp.approval_status) +
          (opp.featured
            ? '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-violet-100 text-violet-800">Featured</span>'
            : '') +
          '</div></td>' +
          '<td class="py-2.5 pr-3 text-xs text-slate-500 max-w-[10rem] truncate">' +
          esc(opp.owner_email || '—') +
          '</td>' +
          '<td class="py-2.5 text-right whitespace-nowrap">' +
          '<div class="flex flex-wrap justify-end gap-2">' +
          (isPending
            ? '<button type="button" data-opp-approve class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">Approve</button>' +
              '<button type="button" data-opp-reject class="text-xs font-semibold rounded-lg border border-red-200 text-red-700 px-2.5 py-1 hover:bg-red-50">Reject</button>'
            : '') +
          '<a href="' +
          attrEsc(publicHref) +
          '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View</a>' +
          '<button type="button" data-toggle-opp-edit class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">' +
          (isOpen ? 'Close' : 'Edit') +
          '</button>' +
          '<button type="button" data-opp-delete="' +
          attrEsc(opp.id) +
          '" data-opp-delete-title="' +
          attrEsc(opp.title || 'Untitled') +
          '" class="text-xs font-semibold rounded-lg border border-red-200 text-red-700 px-2.5 py-1 hover:bg-red-50">Delete</button>' +
          '</div></td></tr>' +
          '<tr class="opportunity-cleanup-panel' +
          (isOpen ? '' : ' hidden') +
          ' border-b border-slate-200 bg-slate-50/80" data-opp-panel-for="' +
          attrEsc(opp.id) +
          '">' +
          '<td colspan="6" class="p-4">' +
          opportunityCleanupEditFormHtml(opp) +
          '</td></tr>'
        );
      })
      .join('');

    list.innerHTML =
      adminTableScroll(
        '<table class="w-full text-sm text-left border-collapse">' +
          '<thead class="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
          '<tr>' +
          '<th class="py-2 pr-2 w-8"><span class="sr-only">Select</span></th>' +
          '<th class="py-2 pr-3 font-semibold">Listing</th>' +
          '<th class="py-2 pr-3 font-semibold">Type</th>' +
          '<th class="py-2 pr-3 font-semibold">Status</th>' +
          '<th class="py-2 pr-3 font-semibold">Owner</th>' +
          '<th class="py-2 font-semibold text-right">Actions</th>' +
          '</tr></thead><tbody>' +
          rows +
          '</tbody></table>'
      ) +
      adminPaginationHtml(page, total, OPPORTUNITY_PAGE_SIZE, 'data-opp-page');
    updateOpportunityBulkBar();
    bindAdminLogoZones(list);
  }

  function renderOpportunityCleanup(fullHash) {
    var query = parseAdminHashQuery(fullHash || (location.hash || '').replace('#', ''));
    var approvalQ = String(query.get('approval') || '').trim().toLowerCase();
    if (approvalQ === 'pending' || approvalQ === 'pending review') {
      opportunityCleanupState.approval = 'Pending Review';
      opportunityCleanupState.status = '';
      opportunityCleanupState.type = '';
      opportunityCleanupState.featured = false;
      opportunityCleanupState.noImage = false;
      opportunityCleanupState.q = '';
      opportunityCleanupState.page = 0;
    }

    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Manage business opportunity listings submitted by organisers. Approve pending listings, toggle <strong>featured</strong> for the Premium Spotlight carousel on <code class="text-[11px]">/opportunities/</code>, or expand a row to edit details.</p>' +
      '<div id="opportunity-cleanup-status" class="text-sm text-slate-500">Loading business opportunities…</div>' +
      '<p id="opportunity-cleanup-hint" class="hidden text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">' +
      'Large catalogue — use search and filters below. Use page numbers below the table to browse.</p>' +
      '<div id="opportunity-cleanup-bulk" class="hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="opportunity-bulk-count">0</span> listings selected</p>' +
      '<button type="button" id="opportunity-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Use page numbers to browse — your selection is kept until you delete or clear.</p>' +
      '<div id="opportunity-selected-chips" class="flex flex-wrap gap-1.5"></div>' +
      '<div id="opportunity-delete-section" class="border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Delete selected listings</p>' +
      '<p class="text-xs text-slate-600">Permanently removes listings and related enquiries. This cannot be undone.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="opportunity-delete-btn" class="rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700">Delete selected</button>' +
      '<span id="opportunity-delete-msg" class="text-xs"></span></div></div></div>' +
      '<div class="admin-filter-bar sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-4 space-y-3 shadow-sm">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="opportunity-cleanup-search" placeholder="Search title, host, or owner email…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(opportunityCleanupState.q) +
      '">' +
      '<select id="opportunity-cleanup-sort" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value="recent"' +
      (opportunityCleanupState.sort === 'recent' ? ' selected' : '') +
      '>Recently updated</option>' +
      '<option value="published"' +
      (opportunityCleanupState.sort === 'published' ? ' selected' : '') +
      '>Recently published</option>' +
      '<option value="title"' +
      (opportunityCleanupState.sort === 'title' ? ' selected' : '') +
      '>Title A–Z</option>' +
      '<option value="host"' +
      (opportunityCleanupState.sort === 'host' ? ' selected' : '') +
      '>Host A–Z</option></select></div>' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<select id="opportunity-cleanup-status-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[10rem]">' +
      '<option value="">Any status</option>' +
      opportunityStatusOptions(opportunityCleanupState.status) +
      '</select>' +
      '<select id="opportunity-cleanup-approval-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value="">Any approval</option>' +
      '<option value="Pending Review"' +
      (opportunityCleanupState.approval === 'Pending Review' ? ' selected' : '') +
      '>Pending review</option>' +
      '<option value="Approved"' +
      (opportunityCleanupState.approval === 'Approved' ? ' selected' : '') +
      '>Approved</option>' +
      '<option value="Rejected"' +
      (opportunityCleanupState.approval === 'Rejected' ? ' selected' : '') +
      '>Rejected</option></select>' +
      '<select id="opportunity-cleanup-type-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value="">Any type</option>' +
      opportunityTypeOptions(opportunityCleanupState.type) +
      '</select>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="opportunity-cleanup-featured" class="rounded border-slate-300"' +
      (opportunityCleanupState.featured ? ' checked' : '') +
      '> Featured only</label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="opportunity-cleanup-no-image" class="rounded border-slate-300"' +
      (opportunityCleanupState.noImage ? ' checked' : '') +
      '> No cover image</label></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" data-opp-quick="pending" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Pending review</button>' +
      '<button type="button" data-opp-quick="draft" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Draft</button>' +
      '<button type="button" data-opp-quick="published" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Published</button>' +
      '<button type="button" data-opp-quick="featured" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Featured</button>' +
      '<button type="button" data-opp-quick="no_image" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">No image</button>' +
      '<button type="button" data-opp-quick="clear" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-500 hover:bg-slate-50">Clear filters</button></div>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="opportunity-cleanup-select-page" class="rounded border-slate-300"> Select all on page</label></div>' +
      '<div id="opportunity-cleanup-list"></div>' +
      '<details class="rounded-xl border border-brand-200 bg-brand-50/50 group" open>' +
      '<summary class="cursor-pointer list-none font-semibold text-brand-900 px-4 py-3 select-none">Create listing</summary>' +
      '<div class="px-4 pb-4 space-y-4 border-t border-brand-100">' +
      '<p class="text-xs text-slate-600 pt-3">Create a hub-owned business opportunity with image, description, and card details. It stays claimable until you assign an owner email (or someone requests a claim). Prefix the title with <code class="text-[11px]">[TEST]</code> for throwaway previews.</p>' +
      '<form class="opportunity-create-form grid sm:grid-cols-2 gap-3">' +
      opportunityListingFieldsHtml(
        { type: 'business-opportunity', status: 'published' },
        { coverKey: 'opp-create-cover', logoKey: 'opp-create-logo' }
      ) +
      '<div class="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3 space-y-2">' +
      '<p class="text-xs font-semibold text-slate-600">Claim later (optional)</p>' +
      '<p class="text-xs text-slate-500">Leave blank to keep the listing hub-owned and claimable. Enter an email to open the in-dashboard claim prompt when that person signs in.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Owner / claimant email</label>' +
      '<input type="email" name="owner_email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Leave blank for hub-owned"></div></div>' +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Create listing</button>' +
      '<span class="opportunity-create-msg text-xs"></span></div></form>' +
      '<div class="border-t border-brand-100 pt-4 space-y-3">' +
      '<p class="text-xs font-semibold text-slate-600">Quick samples</p>' +
      '<p class="text-xs text-slate-600">Add 3 sample <code class="text-[11px]">[TEST]</code> listings with stock images for previewing /opportunities/ — delete them from the table when done.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="opportunity-test-samples-btn" class="rounded-lg border border-brand-300 bg-white text-brand-900 text-sm font-semibold px-4 py-2 hover:bg-brand-50">Add 3 sample test listings</button>' +
      '<span id="opportunity-test-samples-msg" class="text-xs"></span></div></div></div></details></div>';

    syncOpportunityCleanupFilterUi();
    bindAdminLogoZones(main.querySelector('.opportunity-create-form'));
    refreshOpportunityCleanupData();
  }

  function resetOpportunityCreateForm(form) {
    if (!form) return;
    form.reset();
    var statusField = formField(form, 'status');
    if (statusField) statusField.value = 'published';
    var typeField = formField(form, 'type');
    if (typeField) typeField.value = 'business-opportunity';
    delete adminLogoPending['opp-create-cover'];
    delete adminLogoPending['opp-create-logo'];
    form.querySelectorAll('.admin-logo-preview').forEach(function (img) {
      img.classList.add('hidden');
      img.removeAttribute('src');
    });
    form.querySelectorAll('.admin-logo-placeholder').forEach(function (el) {
      el.classList.remove('hidden');
    });
  }

  function opportunityFormPayload(form) {
    return {
      title: formFieldVal(form, 'title'),
      host: formFieldVal(form, 'host'),
      type: formFieldVal(form, 'type') || 'business-opportunity',
      status: formFieldVal(form, 'status') || 'published',
      description: formFieldVal(form, 'description') || null,
      about_text: formFieldVal(form, 'about_text') || null,
      investment: formFieldVal(form, 'investment') || null,
      investment_includes: formFieldVal(form, 'investment_includes') || null,
      location: formFieldVal(form, 'location') || null,
      commitment: formFieldVal(form, 'commitment') || null,
      featured: !!(form.querySelector('[name="featured"]') && form.querySelector('[name="featured"]').checked),
      owner_email: formFieldVal(form, 'owner_email') || null,
    };
  }

  function createOpportunityCleanupForm(form) {
    var msg = form.querySelector('.opportunity-create-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating…';
      msg.className = 'opportunity-create-msg text-xs text-slate-500';
    }
    var coverKey =
      (form.querySelector('[data-admin-logo-url-name="image_url"]') &&
        form.querySelector('[data-admin-logo-url-name="image_url"]').getAttribute('data-admin-logo-key')) ||
      'opp-create-cover';
    var logoKey =
      (form.querySelector('[data-admin-logo-url-name="logo_url"]') &&
        form.querySelector('[data-admin-logo-url-name="logo_url"]').getAttribute('data-admin-logo-key')) ||
      'opp-create-logo';
    Promise.all([
      opportunityImagePayloadForKey(coverKey, form, 'image_url', 'photo'),
      opportunityImagePayloadForKey(logoKey, form, 'logo_url', 'logo'),
    ])
      .then(function (parts) {
        var payload = Object.assign({ action: 'create' }, opportunityFormPayload(form), parts[0], parts[1]);
        return adminPost('/api/admin/opportunities', payload);
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        if (msg) {
          msg.textContent = payloadOwnerClaimMsg(data.opportunity) || 'Listing created.';
          msg.className = 'opportunity-create-msg text-xs text-emerald-700 font-semibold';
        }
        resetOpportunityCreateForm(form);
        if (btn) btn.disabled = false;
        return refreshOpportunityCleanupData();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create listing';
          msg.className = 'opportunity-create-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function payloadOwnerClaimMsg(opportunity) {
    if (!opportunity) return '';
    if (opportunity.ownership_claim_status === 'pending' && opportunity.owner_email) {
      return 'Listing created — claim invite will appear when ' + opportunity.owner_email + ' signs in.';
    }
    return 'Listing created — hub-owned and claimable.';
  }

  function createOpportunityTestSamples() {
    var msg = document.getElementById('opportunity-test-samples-msg');
    var btn = document.getElementById('opportunity-test-samples-btn');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating sample listings…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/opportunities', { action: 'create_test_samples' })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        if (msg) {
          msg.textContent = 'Created ' + (data.created || 0) + ' sample test listings.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshOpportunityCleanupData();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create sample listings';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function assignOpportunityOwner(id, form) {
    var ownerEmail = formFieldVal(form, 'owner_email');
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      window.alert('Enter a valid owner email before assigning.');
      return;
    }
    if (
      !window.confirm(
        'Assign “' +
          ownerEmail +
          '” as owner and open the in-dashboard claim prompt when they sign in?'
      )
    ) {
      return;
    }
    var msg = form.querySelector('.opportunity-cleanup-msg');
    var btn = form.querySelector('[data-opp-assign-owner]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Assigning owner…';
      msg.className = 'opportunity-cleanup-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/opportunities', {
      id: id,
      action: 'assign_owner',
      owner_email: ownerEmail,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Assign owner failed');
        if (msg) {
          msg.textContent = 'Owner assigned — claim invite will appear when they sign in.';
          msg.className = 'opportunity-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshOpportunityCleanupPage();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not assign owner';
          msg.className = 'opportunity-cleanup-msg text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function saveOpportunityCleanupForm(form) {
    var id = form.getAttribute('data-opportunity-id');
    var msg = form.querySelector('.opportunity-cleanup-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'opportunity-cleanup-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/opportunities', {
      id: id,
      title: formFieldVal(form, 'title'),
      host: formFieldVal(form, 'host'),
      type: formFieldVal(form, 'type'),
      status: formFieldVal(form, 'status'),
      approval_status: formFieldVal(form, 'approval_status'),
      featured: !!(form.querySelector('[name="featured"]') && form.querySelector('[name="featured"]').checked),
      image_url: formFieldVal(form, 'image_url') || null,
      description: formFieldVal(form, 'description') || null,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
        if (msg) {
          msg.textContent = 'Saved.';
          msg.className = 'opportunity-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshOpportunityCleanupPage();
      })
      .then(function () {
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'opportunity-cleanup-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function handleOpportunityCleanupClick(e) {
    if (!document.getElementById('opportunity-cleanup-list')) return;

    var pageBtn = e.target.closest('[data-opp-page]');
    if (pageBtn) {
      var page = parseInt(pageBtn.getAttribute('data-opp-page'), 10);
      if (!isNaN(page)) goToOpportunityPage(page);
      return;
    }

    if (e.target.closest('#opportunity-bulk-clear')) {
      clearSelectedOpportunities();
      main.querySelectorAll('.opportunity-select-checkbox').forEach(function (cb) {
        cb.checked = false;
      });
      var selectPage = document.getElementById('opportunity-cleanup-select-page');
      if (selectPage) selectPage.checked = false;
      updateOpportunityBulkBar();
      return;
    }
    var unselectBtn = e.target.closest('[data-unselect-opp]');
    if (unselectBtn) {
      var unselectId = unselectBtn.getAttribute('data-unselect-opp');
      forgetSelectedOpportunity(unselectId);
      main.querySelectorAll('.opportunity-select-checkbox').forEach(function (cb) {
        if (String(cb.value) === String(unselectId)) cb.checked = false;
      });
      updateOpportunityBulkBar();
      return;
    }
    if (e.target.closest('#opportunity-delete-btn')) {
      deleteSelectedOpportunities();
      return;
    }
    if (e.target.closest('#opportunity-test-samples-btn')) {
      if (
        !window.confirm(
          'Add 3 sample test listings? They will appear on /opportunities/ and can be deleted from this page later.'
        )
      ) {
        return;
      }
      createOpportunityTestSamples();
      return;
    }
    var deleteBtn = e.target.closest('[data-opp-delete]');
    if (deleteBtn) {
      deleteOpportunityListing(
        deleteBtn.getAttribute('data-opp-delete'),
        deleteBtn.getAttribute('data-opp-delete-title')
      );
      return;
    }
    var deleteFormBtn = e.target.closest('[data-opp-delete-form]');
    if (deleteFormBtn) {
      deleteOpportunityListing(
        deleteFormBtn.getAttribute('data-opp-delete-form'),
        deleteFormBtn.getAttribute('data-opp-delete-title')
      );
      return;
    }

    var toggle = e.target.closest('[data-toggle-opp-edit]');
    if (toggle) {
      var row = toggle.closest('[data-opportunity-id-row]');
      var id = row && row.getAttribute('data-opportunity-id-row');
      var panel = id && main.querySelector('.opportunity-cleanup-panel[data-opp-panel-for="' + id + '"]');
      if (panel && id) {
        var opening = panel.classList.contains('hidden');
        main.querySelectorAll('.opportunity-cleanup-panel').forEach(function (p) {
          p.classList.add('hidden');
        });
        main.querySelectorAll('[data-toggle-opp-edit]').forEach(function (btn) {
          btn.textContent = 'Edit';
        });
        if (opening) {
          panel.classList.remove('hidden');
          opportunityCleanupState.expanded[id] = true;
          toggle.textContent = 'Close';
        } else {
          delete opportunityCleanupState.expanded[id];
          toggle.textContent = 'Edit';
        }
      }
      return;
    }
    var assignOwnerBtn = e.target.closest('[data-opp-assign-owner]');
    if (assignOwnerBtn) {
      var assignRow = assignOwnerBtn.closest('.opportunity-cleanup-panel');
      var assignForm = assignRow && assignRow.querySelector('.opportunity-cleanup-form');
      var assignId = assignOwnerBtn.getAttribute('data-opp-assign-owner');
      if (assignForm && assignId) assignOpportunityOwner(assignId, assignForm);
      return;
    }
    var approveBtn = e.target.closest('[data-opp-approve]');
    if (approveBtn) {
      var approveRow = approveBtn.closest('[data-opportunity-id-row]');
      var approveId = approveRow && approveRow.getAttribute('data-opportunity-id-row');
      if (!approveId) return;
      approveBtn.disabled = true;
      adminPost('/api/admin/opportunities', { id: approveId, action: 'approve' })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Approve failed');
          return refreshOpportunityCleanupData();
        })
        .then(function () {
          refreshAdminNotifications();
        })
        .catch(function (err) {
          window.alert(err.message || 'Could not approve listing.');
          approveBtn.disabled = false;
        });
      return;
    }
    var rejectBtn = e.target.closest('[data-opp-reject]');
    if (rejectBtn) {
      var rejectRow = rejectBtn.closest('[data-opportunity-id-row]');
      var rejectId = rejectRow && rejectRow.getAttribute('data-opportunity-id-row');
      if (!rejectId) return;
      var rejectionNote = window.prompt(
        'Why is this listing being rejected? This reason will be emailed to the lister.',
        ''
      );
      if (rejectionNote == null) return;
      rejectionNote = String(rejectionNote).trim();
      if (!rejectionNote) {
        window.alert('Please enter a rejection reason so the lister knows what to fix.');
        return;
      }
      rejectBtn.disabled = true;
      adminPost('/api/admin/opportunities', {
        id: rejectId,
        action: 'reject',
        rejection_note: rejectionNote,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Reject failed');
          return refreshOpportunityCleanupData();
        })
        .then(function () {
          refreshAdminNotifications();
        })
        .catch(function (err) {
          window.alert(err.message || 'Could not reject listing.');
          rejectBtn.disabled = false;
        });
      return;
    }
    var quick = e.target.closest('[data-opp-quick]');
    if (quick) {
      var key = quick.getAttribute('data-opp-quick');
      if (key === 'clear') {
        opportunityCleanupState.status = '';
        opportunityCleanupState.approval = '';
        opportunityCleanupState.type = '';
        opportunityCleanupState.featured = false;
        opportunityCleanupState.noImage = false;
        opportunityCleanupState.q = '';
      } else if (key === 'pending') {
        if (opportunityCleanupState.approval === 'Pending Review') {
          opportunityCleanupState.approval = '';
        } else {
          opportunityCleanupState.approval = 'Pending Review';
          opportunityCleanupState.status = '';
        }
      } else if (key === 'draft') {
        opportunityCleanupState.status = opportunityCleanupState.status === 'draft' ? '' : 'draft';
      } else if (key === 'published') {
        opportunityCleanupState.status =
          opportunityCleanupState.status === 'published' ? '' : 'published';
      } else if (key === 'featured') {
        opportunityCleanupState.featured = !opportunityCleanupState.featured;
      } else if (key === 'no_image') {
        opportunityCleanupState.noImage = !opportunityCleanupState.noImage;
      }
      syncOpportunityCleanupFilterUi();
      refreshOpportunityCleanupData();
    }
  }

  function bindOpportunityCleanupForms() {
    if (window.__opportunityCleanupEventsBound) return;
    window.__opportunityCleanupEventsBound = true;

    document.body.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList || !form.closest('#admin-main')) return;
      if (form.classList.contains('opportunity-cleanup-form')) {
        e.preventDefault();
        saveOpportunityCleanupForm(form);
        return;
      }
      if (form.classList.contains('opportunity-create-form')) {
        e.preventDefault();
        createOpportunityCleanupForm(form);
      }
    });

    document.body.addEventListener('change', function (e) {
      if (!e.target.closest('#admin-main')) return;
      if (e.target.classList && e.target.classList.contains('opportunity-select-checkbox')) {
        var oppId = e.target.value;
        if (e.target.checked) {
          var opportunities = (opportunityCleanupCache && opportunityCleanupCache.opportunities) || [];
          var row = opportunities.find(function (o) {
            return String(o.id) === String(oppId);
          });
          if (row) rememberSelectedOpportunity(row);
        } else {
          forgetSelectedOpportunity(oppId);
        }
        updateOpportunityBulkBar();
        return;
      }
      if (e.target.id === 'opportunity-cleanup-select-page' && main) {
        var pageOpportunities = (opportunityCleanupCache && opportunityCleanupCache.opportunities) || [];
        main.querySelectorAll('.opportunity-select-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            var pageRow = pageOpportunities.find(function (o) {
              return String(o.id) === String(cb.value);
            });
            if (pageRow) rememberSelectedOpportunity(pageRow);
          } else {
            forgetSelectedOpportunity(cb.value);
          }
        });
        updateOpportunityBulkBar();
        return;
      }
      if (e.target.id === 'opportunity-cleanup-status-filter') {
        opportunityCleanupState.status = e.target.value || '';
        syncOpportunityCleanupFilterUi();
        refreshOpportunityCleanupData();
      }
      if (e.target.id === 'opportunity-cleanup-approval-filter') {
        opportunityCleanupState.approval = e.target.value || '';
        syncOpportunityCleanupFilterUi();
        refreshOpportunityCleanupData();
      }
      if (e.target.id === 'opportunity-cleanup-type-filter') {
        opportunityCleanupState.type = e.target.value || '';
        syncOpportunityCleanupFilterUi();
        refreshOpportunityCleanupData();
      }
      if (e.target.id === 'opportunity-cleanup-featured') {
        opportunityCleanupState.featured = e.target.checked;
        syncOpportunityCleanupFilterUi();
        refreshOpportunityCleanupData();
      }
      if (e.target.id === 'opportunity-cleanup-no-image') {
        opportunityCleanupState.noImage = e.target.checked;
        syncOpportunityCleanupFilterUi();
        refreshOpportunityCleanupData();
      }
      if (e.target.id === 'opportunity-cleanup-sort') {
        opportunityCleanupState.sort = e.target.value || 'recent';
        refreshOpportunityCleanupData();
      }
    });

    document.body.addEventListener('input', function (e) {
      if (e.target.id !== 'opportunity-cleanup-search') return;
      clearTimeout(opportunitySearchTimer);
      opportunitySearchTimer = setTimeout(function () {
        opportunityCleanupState.q = e.target.value || '';
        refreshOpportunityCleanupData();
      }, 300);
    });

    document.body.addEventListener('click', handleOpportunityCleanupClick);
  }

  function renderCleanupHub(fullHash) {
    var tab = resolveHubTab(
      fullHash,
      'cleanup',
      ['groups', 'events', 'opportunities', 'issues'],
      'groups'
    );
    if (!tab) return;

    var incompleteBadge = hubTabBadge(actionCountValue('incompleteOrganisers'));
    var oppBadge = hubTabBadge(actionCountValue('pendingOpportunities'));
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'groups', label: 'Groups', href: '#cleanup/groups', badgeHtml: incompleteBadge, badgeKey: 'incompleteOrganisers' },
        { key: 'events', label: 'Events', href: '#cleanup/events' },
        { key: 'opportunities', label: 'Opportunities', href: '#cleanup/opportunities', badgeHtml: oppBadge, badgeKey: 'pendingOpportunities' },
        { key: 'issues', label: 'Data issues', href: '#cleanup/issues' },
      ],
      tab
    );

    if (tab === 'events') withHubTabs(tabsHtml, renderEventCleanup);
    else if (tab === 'opportunities')
      withHubTabs(tabsHtml, function () {
        renderOpportunityCleanup(fullHash);
      });
    else if (tab === 'issues') withHubTabs(tabsHtml, renderEventHealth);
    else withHubTabs(tabsHtml, function () {
      renderGroupCleanup(fullHash);
    });
  }

  function renderAccountsHub(fullHash) {
    var tab = resolveHubTab(fullHash, 'accounts', ['users', 'impersonate'], 'users');
    if (!tab) return;
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'users', label: 'Users', href: '#accounts/users' },
        { key: 'impersonate', label: 'Impersonate', href: '#accounts/impersonate' },
      ],
      tab
    );
    if (tab === 'impersonate') withHubTabs(tabsHtml, renderImpersonate);
    else withHubTabs(tabsHtml, renderUsers);
  }

  function renderSocialHub() {
    renderSocialPosts();
  }

  function renderEmailHub(fullHash) {
    var tab = resolveHubTab(fullHash, 'email', ['campaigns', 'templates'], 'campaigns');
    if (!tab) return;
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'campaigns', label: 'Campaigns', href: '#email/campaigns' },
        { key: 'templates', label: 'Templates', href: '#email/templates' },
      ],
      tab
    );
    if (tab === 'templates') withHubTabs(tabsHtml, renderEmails);
    else withHubTabs(tabsHtml, renderCampaigns);
  }

  function renderModerationHub(fullHash) {
    var tab = resolveHubTab(
      fullHash,
      'moderation',
      ['reports', 'listings', 'reviews', 'import'],
      'reports'
    );
    if (!tab) return;
    var reportsBadge = hubTabBadge(
      actionCountValue('openListingReports') + actionCountValue('openReviewReports')
    );
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'reports', label: 'Reports', href: '#moderation/reports', badgeHtml: reportsBadge, badgeKey: 'openReports' },
        { key: 'listings', label: 'Listings', href: '#moderation/listings' },
        { key: 'reviews', label: 'Reviews', href: '#moderation/reviews' },
        { key: 'import', label: 'Import', href: '#moderation/import' },
      ],
      tab
    );
    if (tab === 'import') withHubTabs(tabsHtml, renderImport);
    else if (tab === 'listings') withHubTabs(tabsHtml, renderModerationListings);
    else if (tab === 'reviews') withHubTabs(tabsHtml, renderModerationReviews);
    else withHubTabs(tabsHtml, renderModerationReports);
  }

  var routes = {
    dashboard: renderDashboard,
    analytics: renderAnalyticsHub,
    system: renderSystem,
    rankings: renderRankingsHub,
    cleanup: renderCleanupHub,
    accounts: renderAccountsHub,
    email: renderEmailHub,
    social: renderSocialHub,
    moderation: renderModerationHub,
    financials: renderFinancialsHub,
    'revenue-targets': renderRevenueTargetsHub,
    spotlight: renderSpotlightHub,
    featured: renderFeatured,
    support: renderSupportHub,
    sponsorship: renderSponsorshipHub,
    'event-health': function () {
      location.replace('#cleanup/issues');
    },
    'group-cleanup': function () {
      location.replace('#cleanup/groups');
    },
    'event-cleanup': function () {
      location.replace('#cleanup/events');
    },
    'opportunity-cleanup': function () {
      location.replace('#cleanup/opportunities');
    },
    impersonate: function () {
      location.replace('#accounts/impersonate');
    },
    users: function () {
      location.replace('#accounts/users');
    },
    campaigns: function () {
      location.replace('#email/campaigns');
    },
    import: function () {
      location.replace('#moderation/import');
    },
    emails: function () {
      location.replace('#email/templates');
    },
  };

  function route() {
    var rawHash = (location.hash || '#dashboard').replace('#', '');
    var hash = normalizeAdminHash(rawHash);
    if (hash !== rawHash) {
      location.replace('#' + hash);
      return;
    }
    var routeKey = hash.split('/')[0];
    if (!routes[routeKey]) {
      routeKey = 'dashboard';
      hash = 'dashboard';
    }
    setActiveNav(routeKey, hash);
    try {
      routes[routeKey](hash);
    } catch (err) {
      if (main) {
        main.innerHTML =
          '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">' +
          '<p class="font-semibold">Could not open this admin page.</p>' +
          '<p class="text-sm mt-2">' +
          esc((err && err.message) || 'Unknown error') +
          '</p></div>';
      }
    }
  }

  function bindAdminMobileNav() {
    var toggle = document.getElementById('admin-nav-toggle');
    var sidebar = document.getElementById('admin-sidebar');
    var backdrop = document.getElementById('admin-sidebar-backdrop');
    if (!toggle || !sidebar) return;

    function closeNav() {
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open Command Center menu');
    }

    function openNav() {
      sidebar.classList.add('is-open');
      if (backdrop) backdrop.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close Command Center menu');
    }

    toggle.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) closeNav();
      else openNav();
    });
    if (backdrop) backdrop.addEventListener('click', closeNav);
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 1023px)').matches) closeNav();
      });
    });
    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 1024px)').matches) closeNav();
    });
  }

  function showAdminGate(html) {
    shell.classList.add('hidden');
    gate.hidden = false;
    gate.classList.remove('hidden');
    if (html) gate.innerHTML = html;
  }

  function hideAdminGate() {
    gate.hidden = true;
    gate.classList.add('hidden');
    shell.classList.remove('hidden');
  }

  function boot(user) {
    currentUser = user;
    document.getElementById('sidebar-user').textContent = user.email;
    hideAdminGate();
    document.body.classList.add('hub-admin-active');
    bindAdminLayoutSync();
    setTimeout(syncAdminLayoutOffset, 0);
    bindAdminMobileNav();
    bindAdminSidebarGroups();
    bindAdminPageGuides();
    bindEventHealthForms();
    bindGroupCleanupForms();
    bindEventCleanupForms();
    bindOpportunityCleanupForms();
    bindModerationActions();
    bindFinancialsActions();
    var refreshBadge = document.getElementById('admin-data-badge');
    if (refreshBadge) {
      refreshBadge.classList.remove('hidden');
      refreshBadge.addEventListener('click', function () {
        refreshBadge.disabled = true;
        refreshBadge.textContent = 'Refreshing…';
        refreshAdminNotifications({ forceHealth: true }).finally(function () {
          refreshBadge.disabled = false;
        });
      });
    }
    var routeKey = (location.hash || '#dashboard').replace('#', '').split('/')[0];
    if (routeKey !== 'dashboard') {
      refreshAdminNotifications();
    }
    startAdminNotificationsPolling();
    route();
    window.addEventListener('hashchange', route);
  }

  document.querySelectorAll('[data-close-drawer]').forEach(function (el) {
    el.addEventListener('click', function () {
      document.getElementById('user-drawer').classList.add('hidden');
    });
  });

  document.getElementById('admin-signout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
      window.location.href = '../login';
    });
  });

  bindAdminPageGuides();

  adminMetricsCache = readCachedAdminMetrics();
  if (adminMetricsCache && document.getElementById('dashboard-action-queue')) {
    applyDashboardMetrics(adminMetricsCache);
    applyDashboardNotifications(adminMetricsCache);
  }
  fetchAdminMetrics(false, true);
  fetchAdminMetrics(false, false);

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.impersonating) {
        showAdminGate(
          '<div class="text-center max-w-md space-y-4">' +
            '<p class="text-slate-600">You are impersonating <strong>' +
            esc(data.user && data.user.email ? data.user.email : 'a user') +
            '</strong>. Stop impersonating to open the Command Center.</p>' +
            '<button type="button" id="admin-gate-stop-impersonate" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Stop impersonating</button>' +
            '<p><a href="../account/" class="text-sm font-semibold text-brand-700">Continue as this user</a></p></div>'
        );
        var stopBtn = document.getElementById('admin-gate-stop-impersonate');
        if (stopBtn) {
          stopBtn.addEventListener('click', function () {
            fetch('/api/auth/stop-impersonate', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            })
              .then(function (res) {
                return res.json();
              })
              .then(function (result) {
                window.location.href = '../' + String(result.redirect || '/admin/').replace(/^\//, '');
              });
          });
        }
        return;
      }
      if (!data.ok || !data.user || data.user.role !== 'admin') {
        showAdminGate(
          '<div class="text-center max-w-md space-y-3"><p class="text-slate-600">Admin access required. Sign in with an admin account.</p>' +
            '<a href="../login?next=/admin/" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Sign in</a>' +
            '<p class="text-sm text-slate-500">Forgot your password? <a href="../forgot-password" class="font-semibold text-brand-700 hover:underline">Email a reset link</a></p></div>'
        );
        return;
      }
      boot(data.user);
    })
    .catch(function () {
      showAdminGate('<p class="text-slate-500" id="admin-gate-msg">Could not verify session.</p>');
    });
})();
