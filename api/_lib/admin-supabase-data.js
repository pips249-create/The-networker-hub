/**
 * Admin Command Center — read platform data from Supabase.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  registrationTicketRevenue,
  registrationHubPlatformFee,
} = require('./booking-fees');
const { isTestFixtureText, isTestRegistration } = require('./test-fixture-filters');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isMissingTableError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  return /could not find the table|schema cache|relation .* does not exist/.test(msg);
}

function listingStatusLabel(status) {
  const s = String(status || '').trim();
  if (s === 'Approved') return 'Live';
  if (s === 'Pending Review') return 'Draft';
  if (s === 'Rejected') return 'Rejected';
  return s || 'Draft';
}

function isSpamReview(text) {
  const t = String(text || '').toLowerCase();
  return /buy cheap|viagra|casino|click here|http:\/\//i.test(t);
}

const INCOMPLETE_ORGANISER_FILTER =
  'description.is.null,description.eq.,photo_url.is.null,photo_url.eq.,website.is.null,website.eq.';

/** Actionable admin queue totals — used for alerts, attention, and sidebar badge (excludes event-health scan). */
async function fetchAdminActionCounts(sb, options) {
  const light = !!(options && options.light);
  const baseQueries = [
    sb.from('listing_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb.from('review_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    sb
      .from('business_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Pending Review'),
    sb
      .from('organiser_claim_disputes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    sb
      .from('organiser_claim_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    sb
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("resolved","closed")'),
    sb.from('organisers').select('id', { count: 'exact', head: true }).or(INCOMPLETE_ORGANISER_FILTER),
    sb
      .from('organiser_payouts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    sb
      .from('organisers')
      .select('id', { count: 'exact', head: true })
      .not('stripe_account_id', 'is', null)
      .eq('stripe_charges_enabled', false),
  ];

  if (light) {
    const [
      openListingReportsRes,
      openReviewReportsRes,
      pendingOpportunitiesRes,
      claimDisputesRes,
      openOrganiserClaimRequestsRes,
      openComplaintsRes,
      incompleteOrgsRes,
      pendingPayoutsRes,
      stripeOnboardingRes,
    ] = await Promise.all(baseQueries);

    return {
      openListingReports: openListingReportsRes.error ? 0 : openListingReportsRes.count || 0,
      openReviewReports: openReviewReportsRes.error ? 0 : openReviewReportsRes.count || 0,
      pendingOpportunities: pendingOpportunitiesRes.error ? 0 : pendingOpportunitiesRes.count || 0,
      openClaimDisputes: claimDisputesRes.error ? 0 : claimDisputesRes.count || 0,
      openOrganiserClaimRequests: openOrganiserClaimRequestsRes.error
        ? 0
        : openOrganiserClaimRequestsRes.count || 0,
      openComplaints: openComplaintsRes.error ? 0 : openComplaintsRes.count || 0,
      spamReviews: 0,
      incompleteOrganisers: incompleteOrgsRes.error ? 0 : incompleteOrgsRes.count || 0,
      pendingPayouts: pendingPayoutsRes.error ? 0 : pendingPayoutsRes.count || 0,
      stripeOnboarding: stripeOnboardingRes.error ? 0 : stripeOnboardingRes.count || 0,
    };
  }

  const [
    openListingReportsRes,
    openReviewReportsRes,
    pendingOpportunitiesRes,
    claimDisputesRes,
    openOrganiserClaimRequestsRes,
    openComplaintsRes,
    incompleteOrgsRes,
    pendingPayoutsRes,
    stripeOnboardingRes,
    recentReviewsRes,
  ] = await Promise.all([
    ...baseQueries,
    sb.from('reviews').select('review_text').order('created_at', { ascending: false }).limit(50),
  ]);

  const spamReviews = (recentReviewsRes.data || []).filter((r) => isSpamReview(r.review_text)).length;

  return {
    openListingReports: openListingReportsRes.error ? 0 : openListingReportsRes.count || 0,
    openReviewReports: openReviewReportsRes.error ? 0 : openReviewReportsRes.count || 0,
    pendingOpportunities: pendingOpportunitiesRes.error ? 0 : pendingOpportunitiesRes.count || 0,
    openClaimDisputes: claimDisputesRes.error ? 0 : claimDisputesRes.count || 0,
    openOrganiserClaimRequests: openOrganiserClaimRequestsRes.error
      ? 0
      : openOrganiserClaimRequestsRes.count || 0,
    openComplaints: openComplaintsRes.error ? 0 : openComplaintsRes.count || 0,
    spamReviews,
    incompleteOrganisers: incompleteOrgsRes.error ? 0 : incompleteOrgsRes.count || 0,
    pendingPayouts: pendingPayoutsRes.error ? 0 : pendingPayoutsRes.count || 0,
    stripeOnboarding: stripeOnboardingRes.error ? 0 : stripeOnboardingRes.count || 0,
  };
}

function sumAdminNotificationCounts(counts) {
  if (!counts) return 0;
  return (
    (counts.openListingReports || 0) +
    (counts.openReviewReports || 0) +
    (counts.spamReviews || 0) +
    (counts.pendingOpportunities || 0) +
    (counts.openClaimDisputes || 0) +
    (counts.openOrganiserClaimRequests || 0) +
    (counts.openComplaints || 0) +
    (counts.pendingPayouts || 0)
  );
}

function buildAlertsFromCounts(counts) {
  const alerts = [];
  if (!counts) return alerts;

  if (counts.pendingOpportunities > 0) {
    alerts.push({
      id: 'pending-opportunities',
      severity: 'medium',
      title: `${counts.pendingOpportunities} business opportunit${counts.pendingOpportunities === 1 ? 'y' : 'ies'} waiting for approval`,
      detail: 'Review and approve or reject each listing.',
      href: '#cleanup/opportunities?approval=pending',
      time: new Date().toISOString(),
    });
  }

  if (counts.incompleteOrganisers > 0) {
    alerts.push({
      id: 'incomplete-organisers',
      severity: 'low',
      title: `${counts.incompleteOrganisers} group page${counts.incompleteOrganisers === 1 ? '' : 's'} need a photo or description`,
      detail: 'Add a logo, description, or website link.',
      href: '#cleanup/groups',
      time: new Date().toISOString(),
    });
  }

  if (counts.spamReviews > 0) {
    alerts.push({
      id: 'spam-reviews',
      severity: 'medium',
      title: `${counts.spamReviews} review${counts.spamReviews === 1 ? '' : 's'} look like spam`,
      detail: 'Check and remove if needed.',
      href: '#moderation/reviews',
      time: new Date().toISOString(),
    });
  }

  if (counts.openListingReports > 0) {
    alerts.push({
      id: 'listing-reports',
      severity: 'medium',
      title: `${counts.openListingReports} listing${counts.openListingReports === 1 ? '' : 's'} reported by a user`,
      detail: 'Read the report and decide what to do.',
      href: '#moderation/reports',
      time: new Date().toISOString(),
    });
  }

  if (counts.openReviewReports > 0) {
    alerts.push({
      id: 'review-reports',
      severity: 'medium',
      title: `${counts.openReviewReports} review${counts.openReviewReports === 1 ? '' : 's'} reported by a user`,
      detail: 'Read the report and decide what to do.',
      href: '#moderation/reports',
      time: new Date().toISOString(),
    });
  }

  if (counts.openComplaints > 0) {
    alerts.push({
      id: 'open-complaints',
      severity: 'high',
      title: `${counts.openComplaints} complaint${counts.openComplaints === 1 ? '' : 's'} need a response`,
      detail: 'Log and reply to emails sent to hello@thenetworkerhub.com.',
      href: '#support/complaints',
      time: new Date().toISOString(),
    });
  }

  if (counts.openClaimDisputes > 0) {
    alerts.push({
      id: 'claim-disputes',
      severity: 'high',
      title: `${counts.openClaimDisputes} group page dispute${counts.openClaimDisputes === 1 ? '' : 's'}`,
      detail: 'An organiser said a profile is not theirs — resolve on the home page.',
      href: '#dashboard',
      time: new Date().toISOString(),
    });
  }

  if (counts.openOrganiserClaimRequests > 0) {
    alerts.push({
      id: 'organiser-claim-requests',
      severity: 'high',
      title: `${counts.openOrganiserClaimRequests} request${counts.openOrganiserClaimRequests === 1 ? '' : 's'} to claim a group page`,
      detail: 'Check who they are, then approve and send the invite.',
      href: '#cleanup/groups',
      time: new Date().toISOString(),
    });
  }

  if (counts.pendingPayouts > 0) {
    alerts.push({
      id: 'pending-payouts',
      severity: 'high',
      title: `${counts.pendingPayouts} payout request${counts.pendingPayouts === 1 ? '' : 's'} waiting for approval`,
      detail: 'Approve the payout, then mark it paid once the money has been sent.',
      href: '#financials/payouts',
      time: new Date().toISOString(),
    });
  }

  if (counts.stripeOnboarding > 0) {
    alerts.push({
      id: 'stripe-onboarding',
      severity: 'medium',
      title: `${counts.stripeOnboarding} organiser${counts.stripeOnboarding === 1 ? '' : 's'} has not finished payment setup`,
      detail: 'They cannot receive ticket money until Stripe setup is complete.',
      href: '#financials/organisers',
      time: new Date().toISOString(),
    });
  }

  return alerts;
}

/** Exclude E2E seed scripts only — avoid filtering legitimate titles or names. */
function isTestActivityText(text) {
  return isTestFixtureText(text);
}

async function fetchPaidRegistrationTotals(sb) {
  const pageSize = 1000;
  let from = 0;
  let totalRevenue = 0;
  let hubBookingFees = 0;

  while (true) {
    const res = await sb
      .from('registrations')
      .select('amount_paid, quantity, events(title), attendees(name, email), organisers(name)')
      .eq('payment_status', 'Paid')
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const rows = res.data || [];
    rows.forEach((r) => {
      if (isTestRegistration(r)) return;
      totalRevenue += registrationTicketRevenue(r);
      hubBookingFees += registrationHubPlatformFee(r);
    });
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return {
    revenue: round2(totalRevenue),
    fees: round2(hubBookingFees),
  };
}

async function fetchDashboardMetrics(sb) {
  const { applyPublicOrganiserBrowseFilter } = require('./supabase-organisers-browse');
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  let browseOrgQuery = sb.from('organisers').select('id', { count: 'exact', head: true });
  browseOrgQuery = applyPublicOrganiserBrowseFilter(browseOrgQuery);
  const [
    approvedTotalRes,
    exhibitionsRes,
    workshopsRes,
    orgRes,
    browseOrgRes,
    attendeesRes,
    accountsRes,
    paidTotals,
    browseUpcomingRes,
    liveDatedRes,
    liveUndatedRes,
  ] = await Promise.all([
    sb.from('events').select('id', { count: 'exact', head: true }).eq('approval_status', 'Approved'),
    sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Approved')
      .or('event_type.eq.Exhibition,event_type.ilike.%exhibit%'),
    sb.from('workshops').select('id', { count: 'exact', head: true }),
    sb.from('organisers').select('id', { count: 'exact', head: true }),
    browseOrgQuery,
    sb.from('attendees').select('id', { count: 'exact', head: true }),
    sb.from('hub_accounts').select('user_id', { count: 'exact', head: true }),
    fetchPaidRegistrationTotals(sb),
    // Same catalogue as /events/ — published Approved rows in browse_events_index that have not started.
    sb
      .from('browse_events_index')
      .select('id', { count: 'exact', head: true })
      .gt('starts_at', nowIso),
    sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Approved')
      .gte('starts_at', cutoff),
    sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'Approved')
      .is('starts_at', null),
  ]);

  if (approvedTotalRes.error) throw new Error(approvedTotalRes.error.message);
  if (exhibitionsRes.error) throw new Error(exhibitionsRes.error.message);

  const total = approvedTotalRes.count || 0;
  const exhibitions = exhibitionsRes.count || 0;
  const meetings = Math.max(0, total - exhibitions);
  const training = workshopsRes.count || 0;
  const browseFallback = (liveDatedRes.count || 0) + (liveUndatedRes.count || 0);
  const liveEvents = browseUpcomingRes.error ? browseFallback : browseUpcomingRes.count || 0;
  const organisersAll = orgRes.count || 0;
  const browseOrganisers = browseOrgRes.error ? organisersAll : browseOrgRes.count || 0;

  return {
    revenue: paidTotals.revenue,
    fees: paidTotals.fees,
    listings: {
      meetings,
      exhibitions,
      training,
      total,
    },
    /** All group profiles — drafts and unpublished included. */
    organisers: organisersAll,
    /** Public directory size — matches organiser browse. */
    browseOrganisers,
    providers: training,
    attendees: Math.max(attendeesRes.count || 0, accountsRes.count || 0),
    /** Upcoming catalogue size — matches the unfiltered /events/ browse total. */
    liveEvents,
    currency: 'GBP',
  };
}

async function fetchAlerts(counts) {
  return buildAlertsFromCounts(counts);
}

async function fetchAttentionQueueLight(sb, counts) {
  const pendingClaimsRes = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .eq('ownership_claim_status', 'pending');
  const action = counts || {};
  return {
    pendingOpportunities: [],
    pendingOpportunitiesTotal: action.pendingOpportunities || 0,
    incompleteOrganisers: action.incompleteOrganisers || 0,
    spamReviews: action.spamReviews || 0,
    openClaimDisputes: [],
    openOrganiserClaimRequests: [],
    openListingReports: action.openListingReports || 0,
    openListingReportItems: [],
    openReviewReports: action.openReviewReports || 0,
    openReviewReportItems: [],
    pendingOwnershipClaims: pendingClaimsRes.error ? 0 : pendingClaimsRes.count || 0,
    pendingPayouts: action.pendingPayouts || 0,
    stripeOnboarding: action.stripeOnboarding || 0,
    totalCount: sumAdminNotificationCounts(action),
  };
}

async function fetchAttentionQueue(sb, counts) {
  const [pendingOppsRes, claimDisputesRes, claimRequestsRes, openReportsRes, reviewReportsRes, pendingClaimsRes] =
    await Promise.all([
      sb
        .from('business_opportunities')
        .select('id, title, host, created_at')
        .eq('approval_status', 'Pending Review')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('organiser_claim_disputes')
        .select('id, organiser_id, organiser_name, profile_email, reporter_email, notes, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('organiser_claim_requests')
        .select(
          'id, organiser_id, organiser_name, profile_email, claimant_name, claimant_email, claimant_role, message, created_at'
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('listing_reports')
        .select('id, listing_type, listing_title, reason, details, reporter_email, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('review_reports')
        .select('id, review_id, review_snippet, reason, details, reporter_email, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('organisers')
        .select('id', { count: 'exact', head: true })
        .eq('ownership_claim_status', 'pending'),
    ]);

  const pendingOpportunities = (pendingOppsRes.data || []).map((o) => ({
    id: o.id,
    title: String(o.title || '').trim(),
    host: String(o.host || '').trim() || '—',
    createdAt: o.created_at,
  }));
  const openClaimDisputes = (claimDisputesRes.data || []).map((d) => ({
    id: d.id,
    organiserId: d.organiser_id,
    organiserName: String(d.organiser_name || '').trim() || 'Group profile',
    profileEmail: String(d.profile_email || '').trim(),
    reporterEmail: String(d.reporter_email || '').trim(),
    notes: String(d.notes || '').trim(),
    createdAt: d.created_at,
  }));
  const openOrganiserClaimRequests = (claimRequestsRes.error ? [] : claimRequestsRes.data || []).map((r) => ({
    id: r.id,
    organiserId: r.organiser_id,
    organiserName: String(r.organiser_name || '').trim() || 'Group profile',
    profileEmail: String(r.profile_email || '').trim(),
    claimantName: String(r.claimant_name || '').trim(),
    claimantEmail: String(r.claimant_email || '').trim(),
    claimantRole: String(r.claimant_role || '').trim(),
    message: String(r.message || '').trim(),
    createdAt: r.created_at,
  }));
  const openListingReportItems = (openReportsRes.error ? [] : openReportsRes.data || []).map((r) => ({
    id: r.id,
    listingType: r.listing_type,
    title: String(r.listing_title || '').trim() || '—',
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
  }));
  const openReviewReportItems = (reviewReportsRes.error ? [] : reviewReportsRes.data || []).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    snippet: String(r.review_snippet || '').trim(),
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
  }));
  const pendingOwnershipClaims = pendingClaimsRes.error ? 0 : pendingClaimsRes.count || 0;
  const action = counts || {};

  return {
    pendingOpportunities,
    pendingOpportunitiesTotal: action.pendingOpportunities || 0,
    incompleteOrganisers: action.incompleteOrganisers || 0,
    spamReviews: action.spamReviews || 0,
    openClaimDisputes,
    openOrganiserClaimRequests,
    openListingReports: action.openListingReports || 0,
    openListingReportItems,
    openReviewReports: action.openReviewReports || 0,
    openReviewReportItems,
    pendingOwnershipClaims,
    pendingPayouts: action.pendingPayouts || 0,
    stripeOnboarding: action.stripeOnboarding || 0,
    totalCount: sumAdminNotificationCounts(action),
  };
}

async function fetchActivity(sb) {
  const items = [];

  const [eventsRes, regsRes, reviewsRes, orgRes, disputesRes, reportsRes] = await Promise.all([
    sb
      .from('events')
      .select('title, approval_status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('registrations')
      .select('payment_status, amount_paid, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('reviews')
      .select('rating, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('organisers').select('name, created_at').order('created_at', { ascending: false }).limit(15),
    sb
      .from('organiser_claim_disputes')
      .select('organiser_name, reporter_email, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(15),
    sb
      .from('listing_reports')
      .select('listing_title, reason, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  (eventsRes.data || []).forEach((e) => {
    items.push({
      time: e.created_at,
      text: `Event "${String(e.title || '').trim()}" — ${listingStatusLabel(e.approval_status)}`,
      type: 'event',
    });
  });

  (regsRes.data || []).forEach((r) => {
    const who = r.attendees?.name || r.attendees?.email || 'Attendee';
    const eventTitle = r.events?.title || 'an event';
    const paid =
      r.payment_status === 'Paid'
        ? ` · £${round2(Number(r.amount_paid) || 0).toFixed(2)}`
        : r.payment_status === 'Free'
          ? ' · Free'
          : '';
    items.push({
      time: r.created_at,
      text: `${who} registered for ${eventTitle}${paid}`,
      type: 'registration',
    });
  });

  (reviewsRes.data || []).forEach((r) => {
    const who = r.attendees?.name || r.attendees?.email || 'Attendee';
    items.push({
      time: r.created_at,
      text: `${who} left a ${r.rating}★ review on ${r.events?.title || 'an event'}`,
      type: 'review',
    });
  });

  (orgRes.data || []).forEach((o) => {
    items.push({
      time: o.created_at,
      text: `Organiser profile created: ${String(o.name || '').trim()}`,
      type: 'organiser',
    });
  });

  (disputesRes.data || []).forEach((d) => {
    items.push({
      time: d.created_at,
      text: `Group profile disputed: ${String(d.organiser_name || 'profile').trim()} (reported by ${String(d.reporter_email || 'user').trim()})`,
      type: 'dispute',
    });
  });

  (reportsRes.data || []).forEach((r) => {
    items.push({
      time: r.created_at,
      text: `Listing reported: ${String(r.listing_title || 'listing').trim()} — ${String(r.reason || 'report').trim()}`,
      type: 'report',
    });
  });

  return items
    .filter((i) => i.time && !isTestActivityText(i.text))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 12);
}

async function fetchUsers(sb) {
  const accountsSelectWithRoundups =
    'user_id, role, display_name, hub_view, emails_enabled, email_pref_event_reminders, email_pref_organiser_alerts, email_pref_organiser_roundups, organiser_terms_accepted_at, created_at';
  const accountsSelectFallback =
    'user_id, role, display_name, hub_view, emails_enabled, email_pref_event_reminders, email_pref_organiser_alerts, organiser_terms_accepted_at, created_at';
  let accountsRes = await sb.from('hub_accounts').select(accountsSelectWithRoundups);
  if (
    accountsRes.error &&
    /email_pref_organiser_roundups/i.test(String(accountsRes.error.message || ''))
  ) {
    accountsRes = await sb.from('hub_accounts').select(accountsSelectFallback);
  }
  const [attendeesRes, organisersRes, authRes] = await Promise.all([
    sb.from('attendees').select('supabase_user_id, name, email, location'),
    sb
      .from('organisers')
      .select('id, supabase_user_id, name, email, city, featured, listing_status'),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (authRes.error) throw new Error(authRes.error.message);

  const authById = new Map((authRes.data?.users || []).map((u) => [u.id, u]));
  const attendeeByUser = new Map(
    (attendeesRes.data || []).filter((a) => a.supabase_user_id).map((a) => [a.supabase_user_id, a])
  );
  const organiserByUser = new Map(
    (organisersRes.data || []).filter((o) => o.supabase_user_id).map((o) => [o.supabase_user_id, o])
  );

  const users = [];
  const seen = new Set();

  for (const acc of accountsRes.data || []) {
    const auth = authById.get(acc.user_id);
    const org = organiserByUser.get(acc.user_id);
    const att = attendeeByUser.get(acc.user_id);
    let role = 'Attendee';
    if (acc.role === 'admin') role = 'Admin';
    else if (org) role = 'Organiser';
    else if (acc.hub_view === 'organiser') role = 'Organiser';

    users.push({
      id: acc.user_id,
      organiserId: org?.id || null,
      name: acc.display_name || org?.name || att?.name || auth?.user_metadata?.full_name || '—',
      email: auth?.email || att?.email || org?.email || '—',
      role,
      city: org?.city || att?.location || '—',
      location: att?.location || org?.city || '—',
      postcode: '—',
      status: 'Active',
      featured: Boolean(org?.featured),
      emailsEnabled: acc.emails_enabled !== false,
      hubView: acc.hub_view || 'attendee',
      displayName: acc.display_name || null,
      emailPrefEventReminders: acc.email_pref_event_reminders !== false,
      emailPrefOrganiserAlerts: acc.email_pref_organiser_alerts !== false,
      emailPrefOrganiserRoundups: acc.email_pref_organiser_roundups !== false,
      organiserTermsAcceptedAt: acc.organiser_terms_accepted_at || null,
      organiserListingStatus: org?.listing_status || null,
      accountCreatedAt: acc.created_at || auth?.created_at || null,
      lastSignInAt: auth?.last_sign_in_at || null,
      authCreatedAt: auth?.created_at || null,
    });
    seen.add(acc.user_id);
  }

  for (const att of attendeesRes.data || []) {
    if (!att.supabase_user_id || seen.has(att.supabase_user_id)) continue;
    const auth = authById.get(att.supabase_user_id);
    users.push({
      id: att.supabase_user_id,
      organiserId: null,
      name: att.name || '—',
      email: att.email || auth?.email || '—',
      role: 'Attendee',
      city: att.location || '—',
      location: att.location || '—',
      postcode: '—',
      status: 'Active',
      featured: false,
      emailsEnabled: true,
      hubView: 'attendee',
      displayName: null,
      emailPrefNewsletter: true,
      emailPrefEventReminders: true,
      emailPrefOrganiserAlerts: true,
      emailPrefOrganiserRoundups: true,
      organiserTermsAcceptedAt: null,
      organiserListingStatus: null,
      accountCreatedAt: auth?.created_at || null,
      lastSignInAt: auth?.last_sign_in_at || null,
      authCreatedAt: auth?.created_at || null,
    });
  }

  users.sort((a, b) => {
    const nameA = String(a.name || '').trim().toLowerCase();
    const nameB = String(b.name || '').trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
    }
    return String(a.email || '').localeCompare(String(b.email || ''), 'en', {
      sensitivity: 'base',
    });
  });
  return users;
}

function mapEventToListing(e, soldByEvent) {
  const sold = soldByEvent.get(e.id) || 0;
  const approvalStatus = String(e.approval_status || '').trim();
  const status = listingStatusLabel(approvalStatus);
  return {
    id: e.id,
    title: String(e.title || '').trim(),
    type: String(e.event_type || 'Event').trim(),
    organiser: e.organisers?.name || '—',
    city: e.city || '—',
    status,
    approvalStatus,
    pending: false,
    sold,
    capacity: null,
  };
}

const LISTING_REPORT_SELECT =
  'id, listing_type, listing_title, reason, details, reporter_email, created_at, reviewed_at, status, event_id, organiser_id, opportunity_id, events(slug), organisers(slug), business_opportunities(slug)';

function mapListingReportRow(r, options = {}) {
  const readOnly = Boolean(options.readOnly);
  const title = String(r.listing_title || '').trim() || '—';
  const eventId = r.event_id || null;
  const organiserId = r.organiser_id || null;
  const opportunityId = r.opportunity_id || null;
  const eventSlug = r.events?.slug ? String(r.events.slug).trim() : '';
  const organiserSlug = r.organisers?.slug ? String(r.organisers.slug).trim() : '';
  const opportunitySlug = r.business_opportunities?.slug
    ? String(r.business_opportunities.slug).trim()
    : '';
  let viewUrl = null;
  let adminUrl = null;
  if (r.listing_type === 'event' && eventId) {
    // Pretty /events/:slug — avoid /events/event?slug=… which Vercel treats as slug "event"
    viewUrl = eventSlug
      ? `../events/${encodeURIComponent(eventSlug)}`
      : `../events/event.html?id=${encodeURIComponent(eventId)}`;
    adminUrl = `#cleanup/events?q=${encodeURIComponent(title)}`;
  } else if (r.listing_type === 'organiser' && organiserId) {
    viewUrl = organiserSlug
      ? `../organisers/${encodeURIComponent(organiserSlug)}`
      : `../events/organiser.html?id=${encodeURIComponent(organiserId)}`;
    adminUrl = `#cleanup/groups?organiser=${encodeURIComponent(organiserId)}`;
  } else if (r.listing_type === 'opportunity' && opportunityId) {
    viewUrl = opportunitySlug
      ? `../opportunities/${encodeURIComponent(opportunitySlug)}`
      : `../opportunities/opportunity.html?id=${encodeURIComponent(opportunityId)}`;
    adminUrl = `#cleanup/opportunities?q=${encodeURIComponent(title)}`;
  }
  return {
    id: r.id,
    listingType: r.listing_type,
    title,
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
    reviewedAt: r.reviewed_at || null,
    status: r.status,
    eventId,
    organiserId,
    opportunityId,
    viewUrl,
    adminUrl,
    canUnpublish: !readOnly && Boolean(eventId || organiserId || opportunityId),
    conductWarning: r.conductWarning || null,
    hubSuspended: Boolean(r.hubSuspended),
  };
}

async function attachConductWarningsToReports(sb, reports) {
  const ids = (reports || []).map((r) => r.id).filter(Boolean);
  if (!ids.length) return reports;

  const { data, error } = await sb
    .from('organiser_moderation_actions')
    .select('listing_report_id, action_type, reason, created_at, organiser_id')
    .in('listing_report_id', ids);
  if (error) {
    return reports.map((r) => ({ ...r, conductWarning: null, hubSuspended: false }));
  }

  const byReport = new Map();
  for (const row of data || []) {
    if (!row.listing_report_id) continue;
    byReport.set(row.listing_report_id, row);
  }

  const organiserIds = [...new Set((data || []).map((row) => row.organiser_id).filter(Boolean))];
  const { moderationSummariesForOrganisers } = require('./organiser-moderation');
  const summaries = organiserIds.length
    ? await moderationSummariesForOrganisers(sb, organiserIds)
    : new Map();

  return reports.map((r) => {
    const action = byReport.get(r.id) || null;
    const summaryOrganiserId = r.organiserId || action?.organiser_id || null;
    const summary = summaryOrganiserId ? summaries.get(summaryOrganiserId) : null;
    return {
      ...r,
      organiserId: summaryOrganiserId || r.organiserId || null,
      conductWarning: action
        ? {
            reason: action.reason,
            createdAt: action.created_at,
            warningCount: summary?.warning_count || null,
            warningLimit: summary?.warning_limit || 3,
          }
        : null,
      hubSuspended: Boolean(summary?.hub_suspended),
    };
  });
}

async function fetchModeration(sb) {
  const eventSelect =
    'id, title, event_type, city, approval_status, organiser_id, organisers(name)';

  const [eventsRes, reviewsRes, regCountsRes, reportsRes, validatedReportsRes, reviewReportsRes] =
    await Promise.all([
    sb.from('events').select(eventSelect).order('created_at', { ascending: false }).limit(80),
    sb
      .from('reviews')
      .select('id, rating, review_text, created_at, events(title), attendees(name, email)')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('registrations').select('event_id'),
    sb
      .from('listing_reports')
      .select(LISTING_REPORT_SELECT)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
    sb
      .from('listing_reports')
      .select(LISTING_REPORT_SELECT)
      .eq('status', 'reviewed')
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(50),
    sb
      .from('review_reports')
      .select('id, review_id, review_snippet, reason, details, reporter_email, created_at, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (reviewsRes.error) throw new Error(reviewsRes.error.message);

  const soldByEvent = new Map();
  (regCountsRes.data || []).forEach((r) => {
    if (!r.event_id) return;
    soldByEvent.set(r.event_id, (soldByEvent.get(r.event_id) || 0) + 1);
  });

  const listings = (eventsRes.data || []).map((e) => mapEventToListing(e, soldByEvent));

  const reviews = (reviewsRes.data || []).map((r) => {
    const text = String(r.review_text || '').trim();
    return {
      id: r.id,
      user: r.attendees?.name || r.attendees?.email || 'Anonymous',
      event: r.events?.title || '—',
      rating: Number(r.rating) || 0,
      text,
      time: r.created_at,
      spam: isSpamReview(text),
    };
  });

  const listingReports = (reportsRes.error ? [] : reportsRes.data || []).map((r) =>
    mapListingReportRow(r)
  );

  let validatedListingReports = (validatedReportsRes.error ? [] : validatedReportsRes.data || []).map(
    (r) => mapListingReportRow(r, { readOnly: true })
  );
  validatedListingReports = await attachConductWarningsToReports(sb, validatedListingReports);

  const reviewReports = (reviewReportsRes.error ? [] : reviewReportsRes.data || []).map((r) => ({
    id: r.id,
    reviewId: r.review_id,
    snippet: String(r.review_snippet || '').trim(),
    reason: r.reason,
    details: String(r.details || '').trim(),
    reporterEmail: r.reporter_email || '',
    time: r.created_at,
    status: r.status,
  }));

  return {
    listings,
    reviews,
    listingReports,
    validatedListingReports,
    reviewReports,
    listingReportsError: reportsRes.error ? reportsRes.error.message : null,
    validatedListingReportsError: validatedReportsRes.error
      ? validatedReportsRes.error.message
      : null,
    reviewReportsError: reviewReportsRes.error ? reviewReportsRes.error.message : null,
  };
}

async function fetchFinancials(sb) {
  const [orgsRes, paidRegsRes, recentRegsRes, payoutsRes] = await Promise.all([
    sb
      .from('organisers')
      .select(
        'id, name, stripe_account_id, stripe_charges_enabled, stripe_connect_details_submitted, stripe_payouts_enabled'
      )
      .order('name'),
    sb
      .from('registrations')
      .select(
        'organiser_id, amount_paid, payment_status, quantity, events(title), attendees(name, email), organisers(name)'
      )
      .eq('payment_status', 'Paid'),
    sb
      .from('registrations')
      .select(
        'created_at, payment_status, amount_paid, quantity, organiser_id, organisers(name), events(title), attendees(name, email)'
      )
      .order('created_at', { ascending: false })
      .limit(40),
    sb
      .from('organiser_payouts')
      .select(
        'id, status, amount, amount_net, amount_gross, requested_at, created_at, event_id, events(title, organiser_id, organisers(name))'
      )
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (paidRegsRes.error) throw new Error(paidRegsRes.error.message);
  if (recentRegsRes.error) throw new Error(recentRegsRes.error.message);

  let payoutRows = [];
  let payoutWarning = null;
  if (payoutsRes.error) {
    if (isMissingTableError(payoutsRes.error)) {
      payoutWarning =
        'Payout queue unavailable — run migration 120_organiser_payouts_backfill.sql in Supabase (organiser_payouts table missing).';
    } else {
      throw new Error(payoutsRes.error.message);
    }
  } else {
    payoutRows = payoutsRes.data || [];
  }

  const revenueByOrgId = new Map();
  let totalTicketRevenue = 0;
  let totalBookingFees = 0;
  (paidRegsRes.data || []).forEach((r) => {
    if (isTestRegistration(r)) return;
    totalTicketRevenue += registrationTicketRevenue(r);
    totalBookingFees += registrationHubPlatformFee(r);
    const orgId = r.organiser_id;
    if (!orgId) return;
    revenueByOrgId.set(orgId, (revenueByOrgId.get(orgId) || 0) + registrationTicketRevenue(r));
  });

  const lastPayoutByOrgId = new Map();
  payoutRows.forEach((p) => {
    if (String(p.status || '') !== 'paid') return;
    const orgId = p.events?.organiser_id;
    if (!orgId) return;
    const at = p.requested_at || p.created_at;
    if (!at) return;
    const prev = lastPayoutByOrgId.get(orgId);
    if (!prev || new Date(at) > new Date(prev)) {
      lastPayoutByOrgId.set(orgId, at);
    }
  });

  function stripeConnectLabel(o) {
    if (o.stripe_account_id && o.stripe_charges_enabled) return 'Connected';
    if (o.stripe_account_id) return 'Onboarding';
    return 'Not connected';
  }

  function formatPayoutDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  const stripeAccounts = (orgsRes.data || []).map((o) => {
    const earned = revenueByOrgId.get(o.id) || 0;
    return {
      organiserId: o.id,
      organiser: o.name || '—',
      balance: earned > 0 ? `£${round2(earned).toFixed(2)}` : '—',
      balanceNum: round2(earned),
      lastPayout: formatPayoutDate(lastPayoutByOrgId.get(o.id)),
      status: stripeConnectLabel(o),
    };
  });

  stripeAccounts.sort((a, b) => (b.balanceNum || 0) - (a.balanceNum || 0));

  const automationLog = (recentRegsRes.data || []).map((r) => {
    const orgName = r.organisers?.name || 'Unknown organiser';
    const eventTitle = r.events?.title ? ` · ${r.events.title}` : '';
    const amt = Number(r.amount_paid) || 0;
    let line = `${orgName}${eventTitle}: registration — ${r.payment_status}`;
    if (r.payment_status === 'Paid') line += ` (£${round2(amt).toFixed(2)})`;
    let status = 'info';
    if (r.payment_status === 'Paid') status = 'ok';
    if (r.payment_status === 'Refunded') status = 'error';
    return { ts: r.created_at, line, status };
  });

  const payoutStatusLabels = {
    pending_review: 'Pending review',
    approved: 'Approved',
    paid: 'Paid',
    held: 'Held',
  };

  const payoutQueue = payoutRows.map((p) => {
    const net = p.amount_net != null ? Number(p.amount_net) : Number(p.amount) || 0;
    return {
      id: p.id,
      status: p.status || 'pending_review',
      statusLabel: payoutStatusLabels[p.status] || p.status,
      amount: net > 0 ? `£${round2(net).toFixed(2)}` : '—',
      amountNet: net,
      eventId: p.event_id,
      eventTitle: p.events?.title || '—',
      organiser: p.events?.organisers?.name || '—',
      requestedAt: p.requested_at || p.created_at,
    };
  });

  const pendingPayouts = payoutQueue.filter((p) => p.status === 'pending_review').length;

  let refundsPending = [];
  let refundsPendingWarning = null;
  try {
    const { listRefundsPendingEvents } = require('./admin-refunds-pending');
    refundsPending = await listRefundsPendingEvents(sb, 50);
  } catch (e) {
    refundsPendingWarning = e.message || String(e);
  }

  return {
    summary: {
      totalTicketRevenue: round2(totalTicketRevenue),
      totalBookingFees: round2(totalBookingFees),
      paidRegistrationCount: (paidRegsRes.data || []).length,
      pendingPayoutCount: pendingPayouts,
      refundsPendingCount: refundsPending.length,
      organiserCount: (orgsRes.data || []).length,
    },
    stripeAccounts,
    payoutQueue,
    refundsPending,
    refundsPendingWarning,
    automationLog,
    payoutWarning,
  };
}

const DEFAULT_CMS_SLOT = 'events_sponsor_hub';
const { buildSponsorRow, normalizeSponsorBlock } = require('./cms-sponsor-fields');

async function fetchSponsorBlock(sb, slot) {
  const key = String(slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const res = await sb.from('cms_blocks').select('*').eq('slot', key).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function saveSponsorBlock(sb, payload) {
  const key = String(payload.slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const existing = await fetchSponsorBlock(sb, key);
  if (!String(payload.logo_url || '').trim() && existing) {
    payload.logo_url = existing.logo_url || existing.image_url || '';
  }
  const row = buildSponsorRow({ ...payload, slot: key });
  if (existing) {
    if (payload.sponsor_subscription_id === undefined) {
      row.sponsor_subscription_id = existing.sponsor_subscription_id ?? null;
    }
    if (payload.sponsor_email === undefined) {
      row.sponsor_email = existing.sponsor_email ?? null;
    }
    if (payload.sponsor_available_from === undefined) {
      row.sponsor_available_from = existing.sponsor_available_from ?? null;
    }
  }
  const res = await sb.from('cms_blocks').upsert(row, { onConflict: 'slot' }).select().single();
  if (res.error) throw new Error(res.error.message);
  return normalizeSponsorBlock(res.data);
}

async function copySponsorBlock(sb, fromSlot, toSlot) {
  const source = await fetchSponsorBlock(sb, fromSlot);
  if (!source) {
    const err = new Error('source_not_found');
    err.code = 'source_not_found';
    throw err;
  }
  return saveSponsorBlock(sb, {
    slot: toSlot,
    title: source.title || source.subtitle || '',
    body: source.body || '',
    cta_label: source.cta_label || 'Visit website',
    cta_url: source.cta_url || '',
    cta_color: source.cta_color || '',
    logo_url: source.logo_url || source.image_url || '',
    company_name: source.company_name || '',
    logo_band_dark: source.logo_band_dark === true,
    active: source.active !== false,
    include_in_emails: source.include_in_emails !== false,
  });
}

async function getAdminSponsor(slot) {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase', block: null, slot: slot || DEFAULT_CMS_SLOT };
  }
  const sb = getSupabaseAdmin();
  const key = String(slot || DEFAULT_CMS_SLOT).trim() || DEFAULT_CMS_SLOT;
  const block = await fetchSponsorBlock(sb, key);
  return { configured: true, provider: 'supabase', block, slot: key, updatedAt: new Date().toISOString() };
}

async function resolveClaimDispute(disputeId) {
  const id = String(disputeId || '').trim();
  if (!id) {
    const err = new Error('missing_dispute_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_claim_disputes')
    .update({ status: 'resolved' })
    .eq('id', id)
    .eq('status', 'open')
    .select('id, organiser_id, organiser_name')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('dispute_not_found');
    err.status = 404;
    throw err;
  }
  return data;
}

async function clearDisputedProfileEmail(disputeId) {
  const id = String(disputeId || '').trim();
  if (!id) {
    const err = new Error('missing_dispute_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data: dispute, error: disputeErr } = await sb
    .from('organiser_claim_disputes')
    .select('id, organiser_id, status')
    .eq('id', id)
    .eq('status', 'open')
    .maybeSingle();
  if (disputeErr) throw new Error(disputeErr.message);
  if (!dispute) {
    const err = new Error('dispute_not_found');
    err.status = 404;
    throw err;
  }

  if (dispute.organiser_id) {
    const { error: updateErr } = await sb
      .from('organisers')
      .update({
        email: null,
        contact_email: null,
        supabase_user_id: null,
        organiser_account_id: null,
        ownership_claim_status: null,
        ownership_claimed_at: null,
        ownership_disputed_at: null,
        ownership_disputed_by_email: null,
      })
      .eq('id', dispute.organiser_id);
    if (updateErr) throw new Error(updateErr.message);
  }

  return resolveClaimDispute(id);
}

async function resolveOrganiserClaimRequest(requestId) {
  const id = String(requestId || '').trim();
  if (!id) {
    const err = new Error('missing_request_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('organiser_claim_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    .select('id, organiser_id, organiser_name, claimant_email')
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) {
      const err = new Error('request_not_found');
      err.status = 404;
      throw err;
    }
    throw new Error(error.message);
  }
  if (!data) {
    const err = new Error('request_not_found');
    err.status = 404;
    throw err;
  }
  return data;
}

async function approveOrganiserClaimRequest(requestId) {
  const id = String(requestId || '').trim();
  if (!id) {
    const err = new Error('missing_request_id');
    err.status = 400;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data: request, error: requestErr } = await sb
    .from('organiser_claim_requests')
    .select('*')
    .eq('id', id)
    .eq('status', 'open')
    .maybeSingle();
  if (requestErr) {
    if (isMissingTableError(requestErr)) {
      const err = new Error('request_not_found');
      err.status = 404;
      throw err;
    }
    throw new Error(requestErr.message);
  }
  if (!request) {
    const err = new Error('request_not_found');
    err.status = 404;
    throw err;
  }
  if (!request.organiser_id) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }

  const claimantEmail = String(request.claimant_email || '')
    .trim()
    .toLowerCase();
  if (!claimantEmail) {
    const err = new Error('invalid_claimant_email');
    err.status = 400;
    throw err;
  }

  const { data: organiser, error: organiserErr } = await sb
    .from('organisers')
    .select('id, name, ownership_claim_status')
    .eq('id', request.organiser_id)
    .maybeSingle();
  if (organiserErr) throw new Error(organiserErr.message);
  if (!organiser) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }
  if (String(organiser.ownership_claim_status || '').toLowerCase() === 'claimed') {
    const err = new Error('already_claimed');
    err.status = 400;
    throw err;
  }

  const { error: updateErr } = await sb
    .from('organisers')
    .update({
      email: claimantEmail,
      contact_email: claimantEmail,
      ownership_claim_status: 'pending',
      supabase_user_id: null,
      organiser_account_id: null,
      ownership_disputed_at: null,
      ownership_disputed_by_email: null,
    })
    .eq('id', organiser.id);
  if (updateErr) throw new Error(updateErr.message);

  const { resolveOrganiserClaimUrl } = require('./organiser-claim-url');
  const { sendTemplatedEmail } = require('./send-template-email');
  const { campaignSiteVars } = require('./organiser-campaign-defaults');
  const host = String(process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const claimUrl = await resolveOrganiserClaimUrl(claimantEmail, host);
  const organiserName =
    String(organiser.name || request.organiser_name || 'your group').trim() || 'your group';

  await sendTemplatedEmail({
    slug: 'organiser_claim_invite',
    to: claimantEmail,
    variables: {
      ...campaignSiteVars(host),
      organiser_name: organiserName,
      claim_url: claimUrl,
    },
    skipEmailCheck: true,
  });

  const { data: resolved, error: resolveErr } = await sb
    .from('organiser_claim_requests')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      admin_notes: 'Approved — contact email updated and claim invite sent.',
    })
    .eq('id', id)
    .select('id, organiser_id, organiser_name, claimant_email')
    .maybeSingle();
  if (resolveErr) throw new Error(resolveErr.message);

  return {
    request: resolved || request,
    organiserId: organiser.id,
    claimantEmail,
    claimUrl,
  };
}

async function getAdminDashboard(options) {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase' };
  }
  const light = !!(options && options.light);
  const sb = getSupabaseAdmin();
  const actionCounts = await fetchAdminActionCounts(sb, { light });

  if (light) {
    const attention = await fetchAttentionQueueLight(sb, actionCounts);
    return {
      configured: true,
      provider: 'supabase',
      light: true,
      metrics: null,
      alerts: buildAlertsFromCounts(actionCounts),
      activity: [],
      attention,
      actionCounts,
      notificationCount: sumAdminNotificationCounts(actionCounts),
      updatedAt: new Date().toISOString(),
    };
  }

  const [metrics, activity, attention] = await Promise.all([
    fetchDashboardMetrics(sb),
    fetchActivity(sb),
    fetchAttentionQueue(sb, actionCounts),
  ]);
  const alerts = buildAlertsFromCounts(actionCounts);
  return {
    configured: true,
    provider: 'supabase',
    metrics,
    alerts,
    activity,
    attention,
    actionCounts,
    notificationCount: sumAdminNotificationCounts(actionCounts),
    updatedAt: new Date().toISOString(),
  };
}

async function getAdminUsers(options = {}) {
  if (!isSupabaseConfigured()) {
    return { configured: false, provider: 'supabase', users: [], total: 0 };
  }
  const sb = getSupabaseAdmin();
  let users = await fetchUsers(sb);

  const q = String(options.q || '')
    .trim()
    .toLowerCase();
  const role = String(options.role || '').trim();
  if (q) {
    users = users.filter((u) => {
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }
  if (role) {
    users = users.filter((u) => String(u.role || '') === role);
  }

  users.sort((a, b) =>
    String(a.name || '')
      .localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  );

  const total = users.length;
  const hasPaging =
    options.limit != null &&
    options.limit !== '' &&
    Number.isFinite(Number(options.limit));

  if (!hasPaging) {
    return {
      configured: true,
      provider: 'supabase',
      users,
      total,
      updatedAt: new Date().toISOString(),
    };
  }

  const limit = Math.min(Math.max(parseInt(String(options.limit), 10) || 30, 1), 100);
  const offset = Math.max(parseInt(String(options.offset), 10) || 0, 0);
  return {
    configured: true,
    provider: 'supabase',
    users: users.slice(offset, offset + limit),
    total,
    offset,
    limit,
    updatedAt: new Date().toISOString(),
  };
}

async function getAdminModeration() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      provider: 'supabase',
      listings: [],
      reviews: [],
      listingReports: [],
      reviewReports: [],
    };
  }
  const sb = getSupabaseAdmin();
  const data = await fetchModeration(sb);
  return { configured: true, provider: 'supabase', ...data, updatedAt: new Date().toISOString() };
}

async function getAdminFinancials() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      provider: 'supabase',
      stripeAccounts: [],
      payoutQueue: [],
      automationLog: [],
    };
  }
  const sb = getSupabaseAdmin();
  const data = await fetchFinancials(sb);
  return { configured: true, provider: 'supabase', ...data, updatedAt: new Date().toISOString() };
}

module.exports = {
  getAdminDashboard,
  getAdminUsers,
  getAdminModeration,
  getAdminFinancials,
  getAdminSponsor,
  saveSponsorBlock,
  copySponsorBlock,
  fetchSponsorBlock,
  resolveClaimDispute,
  clearDisputedProfileEmail,
  resolveOrganiserClaimRequest,
  approveOrganiserClaimRequest,
  sumAdminNotificationCounts,
};
