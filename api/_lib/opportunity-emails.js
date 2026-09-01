const { sendTemplatedEmail, sendViaResend } = require('./send-template-email');
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

async function sendOpportunityListingLiveEmail(opportunity) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  await sendTemplatedEmail({
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
  });
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

function opportunityReviewNotifyInboxes() {
  const configured = String(process.env.OPPORTUNITY_REVIEW_NOTIFY_EMAILS || '').trim();
  if (configured) {
    return configured
      .split(/[,;]+/)
      .map(function (email) {
        return String(email || '').trim().toLowerCase();
      })
      .filter(Boolean);
  }
  const inboxes = [];
  const adminEmail = String(process.env.ADMIN_EMAIL || 'pips249@gmail.com')
    .trim()
    .toLowerCase();
  const rosieEmail = String(
    process.env.OPPORTUNITY_REVIEW_NOTIFY_ROSIE || 'rosie@thenetworkeruk.com'
  )
    .trim()
    .toLowerCase();
  if (adminEmail) inboxes.push(adminEmail);
  if (rosieEmail && inboxes.indexOf(rosieEmail) === -1) inboxes.push(rosieEmail);
  return inboxes;
}

async function sendOpportunityListingSubmittedAdminEmail(opportunity, options) {
  const inboxes = opportunityReviewNotifyInboxes();
  if (!inboxes.length) return { skipped: true, reason: 'no_inboxes' };

  const siteUrl = siteBase();
  const listing = buildOpportunityListingEmailVars(opportunity);
  const ownerEmail = ownerEmailForOpportunity(opportunity);
  const reviewId = String(opportunity.id || '').trim();
  const reviewUrl =
    siteUrl +
    '/admin/#opportunities/review/' +
    encodeURIComponent(reviewId);
  const queueUrl = siteUrl + '/admin/#opportunities?approval=pending';
  const isResubmit = Boolean(options && options.resubmit);
  const subject =
    (isResubmit ? 'Opportunity resubmitted — ' : 'Opportunity to review — ') +
    listing.opportunity_title;
  const html =
    '<p>A business opportunity listing has been ' +
    (isResubmit ? 'resubmitted for approval' : 'submitted for approval') +
    '.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;"><strong>Listing</strong></td><td style="padding:4px 0;">' +
    escapeHtml(listing.opportunity_title || 'Untitled') +
    '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;"><strong>Host</strong></td><td style="padding:4px 0;">' +
    escapeHtml(String(opportunity.host || '').trim() || '—') +
    '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;"><strong>Owner email</strong></td><td style="padding:4px 0;">' +
    escapeHtml(ownerEmail || '—') +
    '</td></tr>' +
    '</table>' +
    '<p style="margin:20px 0 0;">' +
    '<a href="' +
    escapeHtml(reviewUrl) +
    '" style="display:inline-block;padding:12px 20px;background:#1c2040;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">Review listing</a>' +
    ' &nbsp; ' +
    '<a href="' +
    escapeHtml(queueUrl) +
    '">Open review queue</a></p>' +
    '<p style="margin:16px 0 0;color:#666;font-size:13px;">Approve sends the owner a pay-to-go-live email. Deny if it does not meet standards.</p>';

  const results = [];
  for (const to of inboxes) {
    try {
      await sendViaResend({
        to,
        subject,
        html,
        replyTo: ownerEmail || undefined,
        skipAllowlist: true,
      });
      results.push({ to, sent: true });
    } catch (err) {
      results.push({ to, error: err && err.message ? err.message : String(err) });
    }
  }
  return { sent: results.some(function (r) {
    return r.sent;
  }), results };
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
  sendOpportunityListingLiveEmail,
  sendOpportunityListingPendingReviewEmail,
  sendOpportunityListingSubmittedAdminEmail,
  opportunityReviewNotifyInboxes,
  sendOpportunityListingApprovedPayEmail,
  sendOpportunityPremiumLiveEmail,
  sendOpportunityEnquiryEmails,
  sendOpportunityOpenDayInterestEmails,
};
