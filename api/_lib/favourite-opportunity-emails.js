const { sendTemplatedEmail } = require('./send-template-email');
const { formatEmailDate } = require('./opportunity-emails');
const {
  siteBase,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  opportunityPublicUrl,
  logoNavUrl,
} = require('./hub-email-urls');

const CLOSING_SOON_DAYS = 7;
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

function buildSavedOpportunityClosingSoonVars({ attendee, opportunityRow, siteUrl }) {
  const site = siteBase(siteUrl);
  const name = String(attendee?.name || '').trim() || 'there';
  const email = String(attendee?.email || '').trim().toLowerCase();

  return {
    user_name: name,
    user_email: email,
    opportunity_title: String(opportunityRow.title || 'Opportunity').trim(),
    opportunity_host: String(opportunityRow.host || 'Listed on The Networker UK').trim(),
    expiry_date: formatEmailDate(opportunityRow.listing_expires_at),
    opportunity_url: opportunityPublicUrl(opportunityRow, site),
    hub_account_url: hubAccountUrl(site) + '#saved',
    browse_opportunities_url: site + '/opportunities/',
    contact_url: contactUrl(site),
    privacy_url: legalPolicyUrl(site, 'privacy'),
    terms_url: legalPolicyUrl(site, 'terms'),
    refunds_url: legalPolicyUrl(site, 'refunds'),
    site_url: site,
    logo_url: logoNavUrl(site),
  };
}

/**
 * Email users who saved an opportunity when its listing is nearing expiry.
 */
async function sendDueSavedOpportunityClosingEmails(sb) {
  const { start, end } = reminderWindow(CLOSING_SOON_DAYS);
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };

  const favRes = await sb
    .from('opportunity_favourites')
    .select(
      'id, attendee_id, opportunity_id, notify_email, expiry_reminded_at, attendees(id, email, name), business_opportunities(id, title, slug, host, status, listing_expires_at)'
    )
    .eq('notify_email', true)
    .is('expiry_reminded_at', null);

  if (favRes.error) throw new Error(favRes.error.message);
  const favourites = favRes.data || [];
  result.checked = favourites.length;
  if (!favourites.length) return result;

  for (const favourite of favourites) {
    const opportunityRow = favourite.business_opportunities;
    const attendee = favourite.attendees;
    const attendeeEmail = String(attendee?.email || '').trim().toLowerCase();

    if (!opportunityRow || String(opportunityRow.status || '').toLowerCase() !== 'published') {
      result.skipped += 1;
      continue;
    }

    const expiresAt = opportunityRow.listing_expires_at;
    if (!expiresAt) {
      result.skipped += 1;
      continue;
    }

    const expiryMs = new Date(expiresAt).getTime();
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(expiryMs) || expiryMs < startMs || expiryMs > endMs) {
      result.skipped += 1;
      continue;
    }

    if (!attendeeEmail) {
      result.skipped += 1;
      continue;
    }

    const vars = buildSavedOpportunityClosingSoonVars({ attendee, opportunityRow });

    try {
      await sendTemplatedEmail({
        slug: 'saved_opportunity_closing_soon',
        to: attendeeEmail,
        variables: vars,
      });
      await sb
        .from('opportunity_favourites')
        .update({ expiry_reminded_at: new Date().toISOString() })
        .eq('id', favourite.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else {
        result.errors.push({
          favourite_id: favourite.id,
          email: attendeeEmail,
          message: e.message || String(e),
        });
      }
    }
  }

  return result;
}

module.exports = {
  buildSavedOpportunityClosingSoonVars,
  sendDueSavedOpportunityClosingEmails,
};
