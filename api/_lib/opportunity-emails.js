const { sendTemplatedEmail } = require('./send-template-email');
const { escapeHtml } = require('./event-refund-policy');
const {
  siteBase,
  opportunityPublicUrl,
  organiserBusinessDashboardUrl,
  organiserBusinessOpenDaysUrl,
} = require('./hub-email-urls');

function formatEmailDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const { emailGreetingName } = require('./email-display-name');

function ownerNameFromOpportunity(opportunity, email) {
  const em = String(email || opportunity?.ownerEmail || opportunity?.contactEmail || '').trim();
  if (em) {
    const local = em.split('@')[0].replace(/[._-]+/g, ' ').trim();
    const greeting = emailGreetingName(local);
    if (greeting && greeting.toLowerCase() !== 'there') return greeting;
  }
  const host = String(opportunity?.host || '').trim();
  if (host) {
    const parts = host.split(/\s+/).filter(Boolean);
    const meaningful = parts.filter(function (word) {
      return !/^(the|a|an)$/i.test(word);
    });
    if (meaningful.length) return meaningful[0];
    return parts[0] || host;
  }
  return 'there';
}

function ownerEmailForOpportunity(opportunity) {
  return String(
    opportunity?.ownerEmail ||
      opportunity?.contactEmail ||
      opportunity?.owner_email ||
      opportunity?.contact_email ||
      ''
  )
    .trim()
    .toLowerCase();
}

function truncateText(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function humanizeCategory(category) {
  const raw = String(category || '').trim();
  if (!raw || raw.toLowerCase() === 'general') return '';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function opportunityLocationLabel(opportunity) {
  const input = opportunity && typeof opportunity === 'object' ? opportunity : {};
  const meta = input.meta && typeof input.meta === 'object' ? input.meta : {};
  return String(
    input.location ||
      input.territory ||
      meta.location ||
      meta.territory ||
      input.outcode ||
      ''
  ).trim();
}

function detailRow(label, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return (
    '<tr><td style="padding:0 0 10px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.5;">' +
    '<span style="color:rgba(255,255,255,0.55);">' +
    escapeHtml(label) +
    '</span><br>' +
    '<span style="color:#ffffff;font-weight:600;">' +
    escapeHtml(text) +
    '</span></td></tr>'
  );
}

/** Shared listing fields for opportunity transactional emails. */
function buildOpportunityListingEmailVars(opportunity) {
  const row = opportunity && typeof opportunity === 'object' ? opportunity : {};
  const title = String(row.title || 'Your opportunity').trim();
  const host = String(row.host || '').trim();
  const category = humanizeCategory(row.category || row.type);
  const location = opportunityLocationLabel(row);
  const premiumUntil = row.featuredUntil ? formatEmailDate(row.featuredUntil) : '';
  const listingUntil = row.listingExpiresAt ? formatEmailDate(row.listingExpiresAt) : '';

  const detailRows =
    detailRow('Company', host) +
    detailRow('Category', category) +
    detailRow('Location', location) +
    detailRow('Premium until', premiumUntil) +
    detailRow('Listing until', listingUntil);

  return {
    opportunity_title: title,
    opportunity_host: host,
    opportunity_category: category,
    opportunity_location: location,
    premium_until: premiumUntil,
    listing_until: listingUntil,
    opportunity_details_rows: detailRows,
  };
}

function listingLiveEmailIdempotencyKey(opportunity) {
  const id = String(opportunity?.id || '').trim();
  if (!id) return undefined;
  const paidAt = String(opportunity?.listingPaidAt || opportunity?.listing_paid_at || '').trim();
  const period = paidAt || 'nopay';
  return ('opp-listing-live:' + id + ':' + period).slice(0, 256);
}

function isMissingListingLiveEmailColumnError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (!msg.includes('listing_live_email_sent_at')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('unknown column')
  );
}

/**
 * Send "Your opportunity is live" at most once per paid period.
 * Claim listing_live_email_sent_at before Resend; release on failure.
 * Pass { force: true } only for deliberate admin resends.
 */
async function sendOpportunityListingLiveEmail(opportunity, options) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const opportunityId = String(opportunity?.id || '').trim();
  const force = Boolean(options && options.force);
  let claimedAt = null;
  let sb = null;

  if (!force && opportunityId) {
    try {
      const { getSupabaseAdmin } = require('./supabase');
      const { claimRowTimestamp } = require('./email-send-claim');
      sb = (options && options.sb) || getSupabaseAdmin();
      claimedAt = new Date().toISOString();
      const claimed = await claimRowTimestamp(sb, {
        table: 'business_opportunities',
        id: opportunityId,
        column: 'listing_live_email_sent_at',
        claimedAt,
        previousValue: null,
      });
      if (!claimed) {
        return { skipped: true, reason: 'already_sent' };
      }
    } catch (claimErr) {
      if (isMissingListingLiveEmailColumnError(claimErr)) {
        console.warn(
          '[opportunity] listing_live_email_sent_at missing — apply migration 276_opportunity_listing_live_email_sent_at.sql'
        );
        claimedAt = null;
      } else {
        throw claimErr;
      }
    }
  }

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  const send = (options && options.sendTemplatedEmail) || sendTemplatedEmail;
  try {
    await send({
      slug: 'opportunity_listing_live',
      to,
      variables: {
        owner_name: ownerNameFromOpportunity(opportunity, to),
        ...listing,
        opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
        dashboard_url: organiserBusinessDashboardUrl(siteUrl),
        open_days_url: organiserBusinessOpenDaysUrl(siteUrl),
        business_opportunities_url: organiserBusinessDashboardUrl(siteUrl),
        expiry_date: listing.listing_until,
        expiry_note: listing.listing_until
          ? 'Your listing is paid until ' +
            listing.listing_until +
            '. Cancel any time from Edit listing → Manage or cancel subscription.'
          : 'Your listing is now visible in the business opportunities directory. Cancel any time from Edit listing → Manage or cancel subscription.',
      },
      subject: 'Your opportunity is live — ' + listing.opportunity_title,
      idempotencyKey: force ? undefined : listingLiveEmailIdempotencyKey(opportunity),
      resendTags: [
        { name: 'email_type', value: 'opportunity_listing_live' },
        ...(opportunityId ? [{ name: 'opportunity_id', value: opportunityId.slice(0, 40) }] : []),
      ],
    });
  } catch (sendErr) {
    if (claimedAt && opportunityId && sb) {
      try {
        const { releaseRowTimestamp } = require('./email-send-claim');
        await releaseRowTimestamp(sb, {
          table: 'business_opportunities',
          id: opportunityId,
          column: 'listing_live_email_sent_at',
          claimedAt,
        });
      } catch {
        /* best-effort release */
      }
    }
    throw sendErr;
  }
  return { sent: true, to };
}

async function sendOpportunityListingPendingReviewEmail(opportunity) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  await sendTemplatedEmail({
    slug: 'opportunity_listing_pending_review',
    to,
    variables: {
      owner_name: ownerNameFromOpportunity(opportunity, to),
      ...listing,
      dashboard_url: organiserBusinessDashboardUrl(siteUrl),
      opportunity_edit_url:
        siteUrl +
        '/organiser/opportunity-edit?id=' +
        encodeURIComponent(String(opportunity.id || '')),
    },
    subject: 'Your listing is pending review — ' + listing.opportunity_title,
  });
  return { sent: true, to };
}

async function sendOpportunityListingApprovedPayEmail(opportunity, options) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  const opportunityId = encodeURIComponent(String(opportunity.id || ''));
  // Deep-link straight into listing checkout — more reliable than dashboard ?renew=
  // (login redirects used to drop the renew query param).
  const payUrl =
    siteUrl + '/organiser/opportunity-edit?id=' + opportunityId + '&checkout=start';
  const editUrl = siteUrl + '/organiser/opportunity-edit?id=' + opportunityId;
  const isReminder = options && options.reminder;
  await sendTemplatedEmail({
    slug: isReminder
      ? 'opportunity_listing_approved_pay_reminder'
      : 'opportunity_listing_approved_pay',
    to,
    variables: {
      owner_name: ownerNameFromOpportunity(opportunity, to),
      ...listing,
      dashboard_url: organiserBusinessDashboardUrl(siteUrl),
      checkout_url: payUrl,
      pay_url: payUrl,
      opportunity_edit_url: editUrl,
    },
    subject: isReminder
      ? "Reminder: You're Approved! — " + listing.opportunity_title
      : "You're Approved! — " + listing.opportunity_title,
  });
  return { sent: true, to };
}

async function sendOpportunityPremiumLiveEmail(opportunity) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  await sendTemplatedEmail({
    slug: 'opportunity_premium_live',
    to,
    variables: {
      owner_name: ownerNameFromOpportunity(opportunity, to),
      ...listing,
      opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
      dashboard_url: organiserBusinessDashboardUrl(siteUrl),
      premium_note: listing.premium_until
        ? 'Premium spotlight is active until ' + listing.premium_until + '.'
        : 'Premium spotlight is now active on the business opportunities directory.',
    },
    subject: 'Premium placement active — ' + listing.opportunity_title,
  });
  return { sent: true, to };
}

async function sendOpportunityEnquiryEmails(opportunity, enquiry) {
  const siteUrl = siteBase();
  const title = String(opportunity?.title || enquiry?.opportunityTitle || 'Opportunity').trim();
  const ownerTo = String(
    enquiry?.ownerEmail || opportunity?.ownerEmail || opportunity?.contactEmail || ''
  )
    .trim()
    .toLowerCase();
  const enquirerTo = String(enquiry?.enquirerEmail || '').trim().toLowerCase();
  const enquirerName = String(enquiry?.enquirerName || 'there').trim();
  const message = String(enquiry?.message || '').trim();
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const preview = escapeHtml(truncateText(message, 280)).replace(/\r?\n/g, '<br>');
  const replySubject = encodeURIComponent('Re: ' + title);
  const replyBody = encodeURIComponent(
    'Hi ' + enquirerName + ',\n\nThank you for your enquiry about "' + title + '".\n\n'
  );
  const replyMailto = enquirerTo
    ? 'mailto:' + encodeURIComponent(enquirerTo) + '?subject=' + replySubject + '&body=' + replyBody
    : '';

  const results = { owner: null, enquirer: null };

  if (ownerTo) {
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_enquiry_received',
        to: ownerTo,
        replyTo: enquirerTo || undefined,
        variables: {
          owner_name: ownerNameFromOpportunity(opportunity, ownerTo),
          opportunity_title: title,
          enquirer_name: enquirerName,
          enquirer_email: enquirerTo,
          enquiry_message: safeMessage,
          dashboard_url: organiserBusinessDashboardUrl(siteUrl),
          reply_mailto_url: replyMailto,
          opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
        },
      });
      results.owner = true;
    } catch (e) {
      results.owner = { error: e.message || String(e) };
    }
  } else {
    results.owner = { skipped: true, reason: 'no_owner_email' };
  }

  if (enquirerTo) {
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_enquiry_sent',
        to: enquirerTo,
        variables: {
          enquirer_name: enquirerName,
          opportunity_title: title,
          opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
          message_preview: preview,
          lister_name: String(opportunity?.host || 'The lister').trim(),
        },
      });
      results.enquirer = true;
    } catch (e) {
      results.enquirer = { error: e.message || String(e) };
    }
  } else {
    results.enquirer = { skipped: true, reason: 'no_enquirer_email' };
  }

  return results;
}

async function sendOpportunityOpenDayInterestEmails(opportunity, openDay, interest) {
  const siteUrl = siteBase();
  const title = String(opportunity?.title || interest?.opportunityTitle || 'Opportunity').trim();
  const ownerTo = String(
    interest?.ownerEmail || opportunity?.ownerEmail || opportunity?.contactEmail || ''
  )
    .trim()
    .toLowerCase();
  const registrantTo = String(interest?.registrantEmail || '').trim().toLowerCase();
  const registrantName = String(interest?.registrantName || 'there').trim();
  const phone = String(interest?.registrantPhone || '').trim();
  const { formatOpenDayWhen, formatOpenDayAddress } = require('./opportunity-open-days');
  const whenLabel = formatOpenDayWhen(openDay);
  const addressLabel = formatOpenDayAddress(openDay);
  const summary =
    String(interest?.openDaySummary || '').trim() ||
    [whenLabel, addressLabel].filter(Boolean).join(' · ');
  const replySubject = encodeURIComponent('Re: Open day — ' + title);
  const replyBody = encodeURIComponent(
    'Hi ' +
      registrantName +
      ',\n\nThank you for your interest in our open day for "' +
      title +
      '"' +
      (whenLabel ? ' on ' + whenLabel : '') +
      '.\n\n'
  );
  const replyMailto = registrantTo
    ? 'mailto:' + encodeURIComponent(registrantTo) + '?subject=' + replySubject + '&body=' + replyBody
    : '';

  const results = { owner: null, registrant: null };

  if (ownerTo) {
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_open_day_interest_received',
        to: ownerTo,
        replyTo: registrantTo || undefined,
        variables: {
          owner_name: ownerNameFromOpportunity(opportunity, ownerTo),
          opportunity_title: title,
          registrant_name: registrantName,
          registrant_email: registrantTo,
          registrant_phone: phone,
          registrant_phone_line: phone ? ' · ' + phone : '',
          open_day_summary: summary,
          open_day_date: whenLabel,
          open_day_address: addressLabel,
          dashboard_url: siteUrl + '/organiser/#business-open-days',
          reply_mailto_url: replyMailto,
          opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
        },
      });
      results.owner = true;
    } catch (e) {
      results.owner = { error: e.message || String(e) };
    }
  } else {
    results.owner = { skipped: true, reason: 'no_owner_email' };
  }

  if (registrantTo) {
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_open_day_interest_sent',
        to: registrantTo,
        variables: {
          registrant_name: registrantName,
          opportunity_title: title,
          opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
          open_day_summary: summary,
          open_day_date: whenLabel,
          open_day_address: addressLabel,
          lister_name: String(opportunity?.host || 'The team').trim(),
        },
      });
      results.registrant = true;
    } catch (e) {
      results.registrant = { error: e.message || String(e) };
    }
  } else {
    results.registrant = { skipped: true, reason: 'no_registrant_email' };
  }

  return results;
}

module.exports = {
  formatEmailDate,
  ownerNameFromOpportunity,
  ownerEmailForOpportunity,
  buildOpportunityListingEmailVars,
  listingLiveEmailIdempotencyKey,
  sendOpportunityListingLiveEmail,
  sendOpportunityListingPendingReviewEmail,
  sendOpportunityListingApprovedPayEmail,
  sendOpportunityPremiumLiveEmail,
  sendOpportunityEnquiryEmails,
  sendOpportunityOpenDayInterestEmails,
};
