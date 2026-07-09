const { sendTemplatedEmail } = require('./send-template-email');
const { escapeHtml } = require('./event-refund-policy');
const {
  siteBase,
  opportunityPublicUrl,
  organiserBusinessDashboardUrl,
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

function ownerNameFromOpportunity(opportunity, email) {
  const host = String(opportunity?.host || '').trim();
  if (host) return host.split(' ')[0] || host;
  const em = String(email || opportunity?.ownerEmail || opportunity?.contactEmail || '').trim();
  if (!em) return 'there';
  return em.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'there';
}

function ownerEmailForOpportunity(opportunity) {
  return String(opportunity?.ownerEmail || opportunity?.contactEmail || '').trim().toLowerCase();
}

function truncateText(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

async function sendOpportunityListingLiveEmail(opportunity) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'opportunity_listing_live',
    to,
    variables: {
      owner_name: ownerNameFromOpportunity(opportunity, to),
      opportunity_title: String(opportunity.title || 'Your opportunity').trim(),
      opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
      dashboard_url: organiserBusinessDashboardUrl(siteUrl),
      expiry_date: opportunity.listingExpiresAt
        ? formatEmailDate(opportunity.listingExpiresAt)
        : '',
      expiry_note: opportunity.listingExpiresAt
        ? 'Your listing is paid until ' + formatEmailDate(opportunity.listingExpiresAt) + '.'
        : 'Your listing is now visible in the business opportunities directory.',
    },
    subject: 'Your opportunity is live — ' + String(opportunity.title || 'listing').trim(),
  });
  return { sent: true, to };
}

async function sendOpportunityPremiumLiveEmail(opportunity) {
  const to = ownerEmailForOpportunity(opportunity);
  if (!to) return { skipped: true, reason: 'no_owner_email' };

  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'opportunity_premium_live',
    to,
    variables: {
      owner_name: ownerNameFromOpportunity(opportunity, to),
      opportunity_title: String(opportunity.title || 'Your opportunity').trim(),
      opportunity_url: opportunityPublicUrl(opportunity, siteUrl),
      dashboard_url: organiserBusinessDashboardUrl(siteUrl),
    },
    subject: 'Premium placement active — ' + String(opportunity.title || 'listing').trim(),
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

module.exports = {
  formatEmailDate,
  ownerNameFromOpportunity,
  ownerEmailForOpportunity,
  sendOpportunityListingLiveEmail,
  sendOpportunityPremiumLiveEmail,
  sendOpportunityEnquiryEmails,
};
