/**
 * UK GDPR subject access / portability — assemble a member's personal data export.
 */
const { getSupabaseAdmin } = require('./supabase');

const EXPORT_VERSION = 1;

function pick(row, keys) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  keys.forEach((k) => {
    if (row[k] !== undefined) out[k] = row[k];
  });
  return out;
}

async function findAttendee(sb, userId, email) {
  const uid = String(userId || '').trim();
  const em = String(email || '').toLowerCase();

  if (uid) {
    const byUser = await sb
      .from('attendees')
      .select('*')
      .eq('supabase_user_id', uid)
      .maybeSingle();
    if (!byUser.error && byUser.data) return byUser.data;
  }

  if (em) {
    const byEmail = await sb.from('attendees').select('*').eq('email', em).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

async function safeSelect(sb, table, buildQuery) {
  try {
    const query = buildQuery(sb.from(table));
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: data || [], error: null };
  } catch (e) {
    return { rows: [], error: e.message || String(e) };
  }
}

function hubAccountExport(hub) {
  if (!hub) return null;
  return pick(hub, [
    'user_id',
    'role',
    'hub_view',
    'display_name',
    'emails_enabled',
    'email_pref_event_reminders',
    'email_pref_organiser_alerts',
    'email_pref_organiser_roundups',
    'organiser_terms_accepted_at',
    'created_at',
  ]);
}

function attendeeExport(attendee) {
  if (!attendee) return null;
  return pick(attendee, [
    'id',
    'email',
    'name',
    'company',
    'job_title',
    'business_sector',
    'professional_role',
    'location',
    'public_review_name',
    'market_preferences',
    'created_at',
    'updated_at',
  ]);
}

async function buildUserDataExport(session) {
  const sb = getSupabaseAdmin();
  const userId = String(session.sub || '').trim();
  const email = String(session.email || '').toLowerCase();
  const exportedAt = new Date().toISOString();

  const [hubRes, attendee] = await Promise.all([
    sb.from('hub_accounts').select('*').eq('user_id', userId).maybeSingle(),
    findAttendee(sb, userId, email),
  ]);

  const attendeeId = attendee?.id || null;
  const warnings = [];

  const [
    registrations,
    reviews,
    eventFavourites,
    organiserFavourites,
    opportunityFavourites,
    eventSavedSearches,
    opportunitySavedSearches,
    opportunityEnquiries,
    complaints,
    listingReports,
    reviewReports,
    countryInterest,
    groupIntake,
    organiserProfiles,
  ] = await Promise.all([
    attendeeId
      ? safeSelect(sb, 'registrations', (q) =>
          q
            .select(
              'id, created_at, payment_status, amount_paid, quantity, application_status, cancelled_at, stripe_payment_intent_id, event_id, organiser_id, events(title), organisers(name)'
            )
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'reviews', (q) =>
          q
            .select(
              'id, created_at, rating, review_text, organiser_reply, event_id, organiser_id, events(title), organisers(name)'
            )
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'event_favourites', (q) =>
          q
            .select('id, created_at, event_id, events(title)')
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'organiser_favourites', (q) =>
          q
            .select('id, created_at, organiser_id, notify_email, organisers(name)')
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'opportunity_favourites', (q) =>
          q
            .select('id, created_at, opportunity_id, business_opportunities(title)')
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'event_saved_searches', (q) =>
          q
            .select('id, created_at, label, filters')
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    attendeeId
      ? safeSelect(sb, 'opportunity_saved_searches', (q) =>
          q
            .select('id, created_at, label, filters')
            .eq('attendee_id', attendeeId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    email
      ? safeSelect(sb, 'opportunity_enquiries', (q) =>
          q
            .select(
              'id, created_at, opportunity_id, enquirer_name, enquirer_email, message, status, business_opportunities(title)'
            )
            .eq('enquirer_email', email)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    email
      ? safeSelect(sb, 'complaints', (q) =>
          q
            .select(
              'id, reference, created_at, category, subject, body, status, outcome, closed_at, related_reference'
            )
            .eq('complainant_email', email)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    safeSelect(sb, 'listing_reports', (q) => {
      let query = q
        .select(
          'id, created_at, listing_type, listing_title, reason, details, status, event_id, organiser_id'
        )
        .order('created_at', { ascending: false });
      if (userId) query = query.eq('reporter_user_id', userId);
      else if (email) query = query.eq('reporter_email', email);
      return query;
    }),
    safeSelect(sb, 'review_reports', (q) => {
      let query = q
        .select('id, created_at, reason, details, status, review_id, event_id, organiser_id')
        .order('created_at', { ascending: false });
      if (userId) query = query.eq('reporter_user_id', userId);
      else if (email) query = query.eq('reporter_email', email);
      return query;
    }),
    email
      ? safeSelect(sb, 'international_country_interest', (q) =>
          q
            .select('id, created_at, country_code, country_name, intent, source')
            .eq('email', email)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    email
      ? safeSelect(sb, 'international_group_intake', (q) =>
          q
            .select(
              'id, created_at, contact_name, email, phone, group_name, website_url, org_type, description, country_code, country_name, status'
            )
            .eq('email', email)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
    userId
      ? safeSelect(sb, 'organisers', (q) =>
          q
            .select(
              'id, name, email, contact_email, listing_status, verification_status, stripe_account_id, stripe_connect_onboarded_at, created_at'
            )
            .eq('supabase_user_id', userId)
            .order('created_at', { ascending: false })
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const sections = [
    registrations,
    reviews,
    eventFavourites,
    organiserFavourites,
    opportunityFavourites,
    eventSavedSearches,
    opportunitySavedSearches,
    opportunityEnquiries,
    complaints,
    listingReports,
    reviewReports,
    countryInterest,
    groupIntake,
    organiserProfiles,
  ];
  sections.forEach((section) => {
    if (section.error) warnings.push(section.error);
  });

  return {
    export_version: EXPORT_VERSION,
    exported_at: exportedAt,
    controller: 'The Networker Group Ltd',
    subject_email: email,
    privacy_contact: 'hi@thenetworkeruk.com',
    hub_account: hubAccountExport(hubRes.error ? null : hubRes.data),
    attendee_profile: attendeeExport(attendee),
    registrations: registrations.rows,
    reviews: reviews.rows,
    event_favourites: eventFavourites.rows,
    organiser_favourites: organiserFavourites.rows,
    opportunity_favourites: opportunityFavourites.rows,
    event_saved_searches: eventSavedSearches.rows,
    opportunity_saved_searches: opportunitySavedSearches.rows,
    opportunity_enquiries_sent: opportunityEnquiries.rows,
    complaints: complaints.rows,
    listing_reports_submitted: listingReports.rows,
    review_reports_submitted: reviewReports.rows,
    international_country_interest: countryInterest.rows,
    international_group_intake: groupIntake.rows,
    organiser_profiles: organiserProfiles.rows,
    notes: [
      'This export contains personal data we hold about you as a platform member.',
      'Financial records may be retained up to 7 years where required by law even after account closure.',
      'Attendee lists an organiser downloaded separately are their responsibility — contact the organiser for copies they hold.',
      'To request correction or erasure, email hi@thenetworkeruk.com with subject "Data request".',
    ],
    warnings: warnings.length ? warnings : undefined,
  };
}

module.exports = {
  buildUserDataExport,
};
