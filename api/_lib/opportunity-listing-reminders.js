/**
 * Reminder emails for business opportunity listing and premium placement expiry.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  sendOpportunityListingExpiredEmail,
  sendOpportunityPremiumExpiredEmail,
} = require('./lifecycle-emails');
const { formatEmailDate, ownerNameFromOpportunity, sendOpportunityListingApprovedPayEmail } = require('./opportunity-emails');
const { listingPaymentCurrent } = require('./opportunity-listing-pricing');
const {
  siteBase,
  opportunityPublicUrl,
  organiserBusinessDashboardUrl,
} = require('./hub-email-urls');
const { claimRowTimestamp, releaseRowTimestamp } = require('./email-send-claim');

const LISTING_REMINDER_DAYS = 7;
const PREMIUM_REMINDER_DAYS = 2;
const APPROVED_PAY_REMINDER_DAYS = 3;
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
      siteUrl +
      '/organiser/?renew=' +
      encodeURIComponent(row.id) +
      '#business-overview';

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(client, {
        table: 'business_opportunities',
        id: row.id,
        column: 'listing_expiry_reminder_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

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
      } catch (sendErr) {
        await releaseRowTimestamp(client, {
          table: 'business_opportunities',
          id: row.id,
          column: 'listing_expiry_reminder_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
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
      '/organiser/opportunity-submitted?id=' +
      encodeURIComponent(row.id);

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(client, {
        table: 'business_opportunities',
        id: row.id,
        column: 'featured_expiry_reminder_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

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
      } catch (sendErr) {
        await releaseRowTimestamp(client, {
          table: 'business_opportunities',
          id: row.id,
          column: 'featured_expiry_reminder_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
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
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(client, {
        table: 'business_opportunities',
        id: row.id,
        column: 'premium_expired_email_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendOpportunityPremiumExpiredEmail(row);
      } catch (sendErr) {
        await releaseRowTimestamp(client, {
          table: 'business_opportunities',
          id: row.id,
          column: 'premium_expired_email_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
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
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(client, {
        table: 'business_opportunities',
        id: row.id,
        column: 'listing_expired_email_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendOpportunityListingExpiredEmail(row);
      } catch (sendErr) {
        await releaseRowTimestamp(client, {
          table: 'business_opportunities',
          id: row.id,
          column: 'listing_expired_email_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.emailsSent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function sendApprovedPayReminders(sb) {
  const client = sb || getSupabaseAdmin();
  const cutoff = new Date(Date.now() - APPROVED_PAY_REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await client
    .from('business_opportunities')
    .select('*')
    .eq('approval_status', 'Approved')
    .is('approved_pay_reminder_sent_at', null)
    .not('approved_at', 'is', null)
    .lte('approved_at', cutoff)
    .is('listing_paid_at', null)
    .limit(50);
  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };

  for (const row of rows || []) {
    if (listingPaymentCurrent(row)) {
      result.skipped += 1;
      continue;
    }
    const to = ownerEmail(row);
    if (!to) {
      result.skipped += 1;
      continue;
    }

    try {
      const claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(client, {
        table: 'business_opportunities',
        id: row.id,
        column: 'approved_pay_reminder_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        const { rowToListing } = require('./supabase-opportunities');
        await sendOpportunityListingApprovedPayEmail(rowToListing(row), { reminder: true });
      } catch (sendErr) {
        await releaseRowTimestamp(client, {
          table: 'business_opportunities',
          id: row.id,
          column: 'approved_pay_reminder_sent_at',
          claimedAt,
        });
        throw sendErr;
      }
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return result;
}

async function runOpportunityReminderMaintenance(sb) {
  const { sendDueSavedOpportunityClosingEmails } = require('./favourite-opportunity-emails');
  const { sendDueSavedSearchMatchEmails, sendOpenDaySavedSearchMatchEmails } = require('./opportunity-saved-search-emails');
  const { sendDueEventSavedSearchMatchEmails } = require('./event-saved-search-emails');
  const client = sb || getSupabaseAdmin();
  const listing = await sendListingExpiryReminders(client);
  const premium = await sendPremiumExpiryReminders(client);
  const approvedPay = await sendApprovedPayReminders(client);
  const savedClosingSoon = await sendDueSavedOpportunityClosingEmails(client);
  const savedSearchMatches = await sendDueSavedSearchMatchEmails(client);
  const openDaySavedSearchMatches = await sendOpenDaySavedSearchMatchEmails(client);
  const eventSavedSearchMatches = await sendDueEventSavedSearchMatchEmails(client);
  const listingExpired = await expireOpportunityListings(client);
  const premiumExpired = await expireOpportunityPremium(client);
  const { notifyPremiumWaitlistIfSlotsOpen } = require('./opportunity-premium-waitlist');
  const premiumWaitlist = await notifyPremiumWaitlistIfSlotsOpen(client);
  return {
    listing,
    premium,
    approvedPay,
    savedClosingSoon,
    savedSearchMatches,
    openDaySavedSearchMatches,
    eventSavedSearchMatches,
    listingExpired,
    premiumExpired,
    premiumWaitlist,
  };
}

module.exports = {
  sendListingExpiryReminders,
  sendPremiumExpiryReminders,
  sendApprovedPayReminders,
  expireOpportunityPremium,
  expireOpportunityListings,
  runOpportunityReminderMaintenance,
};
