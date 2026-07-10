/**
 * Reminder emails for business opportunity listing and premium placement expiry.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  sendOpportunityListingExpiredEmail,
  sendOpportunityPremiumExpiredEmail,
} = require('./lifecycle-emails');
const { formatEmailDate, ownerNameFromOpportunity } = require('./opportunity-emails');
const {
  siteBase,
  opportunityPublicUrl,
  organiserBusinessDashboardUrl,
} = require('./hub-email-urls');

const LISTING_REMINDER_DAYS = 7;
const PREMIUM_REMINDER_DAYS = 2;
const REMINDER_WINDOW_HOURS = 12;

function reminderWindow(targetDays) {
  const now = Date.now();
  const targetMs = now + targetDays * 24 * 60 * 60 * 1000;
  const windowMs = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;
  return {
    start: new Date(targetMs - windowMs / 2).toISOString(),
    end: new Date(targetMs + windowMs / 2).toISOString(),
  };
}

function ownerEmail(row) {
  return String(row.owner_email || row.contact_email || '').trim().toLowerCase();
}

async function sendListingExpiryReminders(sb) {
  const client = sb || getSupabaseAdmin();
  const { start, end } = reminderWindow(LISTING_REMINDER_DAYS);
  const siteUrl = siteBase();

  const { data: rows, error } = await client
    .from('business_opportunities')
    .select('id, title, host, owner_email, contact_email, listing_expires_at')
    .eq('status', 'published')
    .is('listing_expiry_reminder_sent_at', null)
    .not('listing_expires_at', 'is', null)
    .gte('listing_expires_at', start)
    .lte('listing_expires_at', end);
  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };

  for (const row of rows || []) {
    const to = ownerEmail(row);
    if (!to) {
      result.skipped += 1;
      continue;
    }

    const renewUrl =
      siteUrl + '/organiser/opportunity-edit.html?id=' + encodeURIComponent(row.id);

    try {
      await sendTemplatedEmail({
        slug: 'opportunity_listing_expiry_reminder',
        to,
        variables: {
          owner_name: ownerNameFromOpportunity(row, to),
          opportunity_title: String(row.title || 'Your opportunity').trim(),
          expiry_date: formatEmailDate(row.listing_expires_at),
          renew_url: renewUrl,
          opportunity_url: opportunityPublicUrl(row, siteUrl),
          dashboard_url: organiserBusinessDashboardUrl(siteUrl),
        },
      });

      const { error: markErr } = await client
        .from('business_opportunities')
        .update({ listing_expiry_reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id);
      if (markErr) throw new Error(markErr.message);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendPremiumExpiryReminders(sb) {
  const client = sb || getSupabaseAdmin();
  const { start, end } = reminderWindow(PREMIUM_REMINDER_DAYS);
  const siteUrl = siteBase();

  const { data: rows, error } = await client
    .from('business_opportunities')
    .select('id, title, host, owner_email, contact_email, featured_until')
    .eq('status', 'published')
    .eq('featured', true)
    .is('featured_expiry_reminder_sent_at', null)
    .not('featured_until', 'is', null)
    .gte('featured_until', start)
    .lte('featured_until', end);
  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };

  for (const row of rows || []) {
    const to = ownerEmail(row);
    if (!to) {
      result.skipped += 1;
      continue;
    }

    const renewUrl =
      siteUrl +
      '/organiser/opportunity-submitted.html?id=' +
      encodeURIComponent(row.id);

    try {
      await sendTemplatedEmail({
        slug: 'opportunity_premium_expiry_reminder',
        to,
        variables: {
          owner_name: ownerNameFromOpportunity(row, to),
          opportunity_title: String(row.title || 'Your opportunity').trim(),
          expiry_date: formatEmailDate(row.featured_until),
          renew_url: renewUrl,
          opportunity_url: opportunityPublicUrl(row, siteUrl),
          dashboard_url: organiserBusinessDashboardUrl(siteUrl),
        },
      });

      const { error: markErr } = await client
        .from('business_opportunities')
        .update({ featured_expiry_reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id);
      if (markErr) throw new Error(markErr.message);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function expireOpportunityPremium(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: rows, error: fetchErr } = await client
    .from('business_opportunities')
    .select('id, title, host, owner_email, contact_email, featured_until')
    .eq('featured', true)
    .not('featured_until', 'is', null)
    .lt('featured_until', now)
    .is('premium_expired_email_sent_at', null);
  if (fetchErr) throw new Error(fetchErr.message);

  const result = { expired: 0, emailsSent: 0, skipped: 0, errors: [] };

  for (const row of rows || []) {
    const { error: updErr } = await client
      .from('business_opportunities')
      .update({ featured: false, package_tier: 'standard' })
      .eq('id', row.id);
    if (updErr) {
      result.errors.push({ id: row.id, error: updErr.message });
      continue;
    }
    result.expired += 1;

    try {
      await sendOpportunityPremiumExpiredEmail(row);
      await client
        .from('business_opportunities')
        .update({ premium_expired_email_sent_at: new Date().toISOString() })
        .eq('id', row.id);
      result.emailsSent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function expireOpportunityListings(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: rows, error: fetchErr } = await client
    .from('business_opportunities')
    .select('id, title, host, owner_email, contact_email, listing_expires_at')
    .eq('status', 'published')
    .not('listing_expires_at', 'is', null)
    .lt('listing_expires_at', now)
    .is('listing_expired_email_sent_at', null);
  if (fetchErr) throw new Error(fetchErr.message);

  const result = { expired: 0, emailsSent: 0, skipped: 0, errors: [] };

  for (const row of rows || []) {
    const { error: updErr } = await client
      .from('business_opportunities')
      .update({ status: 'unpublished', updated_at: now })
      .eq('id', row.id);
    if (updErr) {
      result.errors.push({ id: row.id, error: updErr.message });
      continue;
    }
    result.expired += 1;

    try {
      await sendOpportunityListingExpiredEmail(row);
      await client
        .from('business_opportunities')
        .update({ listing_expired_email_sent_at: new Date().toISOString() })
        .eq('id', row.id);
      result.emailsSent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function runOpportunityReminderMaintenance(sb) {
  const { sendDueSavedOpportunityClosingEmails } = require('./favourite-opportunity-emails');
  const { sendDueSavedSearchMatchEmails } = require('./opportunity-saved-search-emails');
  const client = sb || getSupabaseAdmin();
  const listing = await sendListingExpiryReminders(client);
  const premium = await sendPremiumExpiryReminders(client);
  const savedClosingSoon = await sendDueSavedOpportunityClosingEmails(client);
  const savedSearchMatches = await sendDueSavedSearchMatchEmails(client);
  const listingExpired = await expireOpportunityListings(client);
  const premiumExpired = await expireOpportunityPremium(client);
  return { listing, premium, savedClosingSoon, savedSearchMatches, listingExpired, premiumExpired };
}

module.exports = {
  sendListingExpiryReminders,
  sendPremiumExpiryReminders,
  expireOpportunityPremium,
  expireOpportunityListings,
  runOpportunityReminderMaintenance,
};
