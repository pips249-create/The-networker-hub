const fs = require('fs');
const path = require('path');

const BRANDED_EMAIL_TEMPLATES = {
  organiser_featured_expiry_reminder: {
    file: 'organiser-featured-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your featured listing for {{event_name}} expires soon',
  },
  organiser_claim_invite: {
    file: 'organiser-claim-invite.html',
    marker: 'hub-email-layout-v2',
    subject: 'Claim your profile on The Networker Hub',
  },
  opportunity_listing_live: {
    file: 'opportunity-listing-live.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your opportunity is live — {{opportunity_title}}',
  },
  opportunity_listing_expiry_reminder: {
    file: 'opportunity-listing-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your opportunity listing expires on {{expiry_date}}',
  },
  opportunity_premium_expiry_reminder: {
    file: 'opportunity-premium-expiry-reminder.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your premium placement expires on {{expiry_date}}',
  },
  opportunity_premium_live: {
    file: 'opportunity-premium-live.html',
    marker: 'hub-email-layout-v2',
    subject: 'Premium placement active — {{opportunity_title}}',
  },
  opportunity_enquiry_received: {
    file: 'opportunity-enquiry-received.html',
    marker: 'hub-email-layout-v2',
    subject: 'New enquiry: {{enquirer_name}} — {{opportunity_title}}',
  },
  opportunity_enquiry_sent: {
    file: 'opportunity-enquiry-sent.html',
    marker: 'hub-email-layout-v2',
    subject: 'Your enquiry was sent — {{opportunity_title}}',
  },
};

const cache = new Map();

function readTemplateFile(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const filePath = path.join(__dirname, '../../email-templates', filename);
  const html = fs.readFileSync(filePath, 'utf8');
  cache.set(filename, html);
  return html;
}

function resolveBrandedEmailBody(slug, dbBodyHtml) {
  const cfg = BRANDED_EMAIL_TEMPLATES[slug];
  if (!cfg) {
    return { bodyHtml: String(dbBodyHtml || ''), source: 'database' };
  }
  const body = String(dbBodyHtml || '');
  if (!body.includes(cfg.marker)) {
    return { bodyHtml: readTemplateFile(cfg.file), source: 'file' };
  }
  return { bodyHtml: body, source: 'database' };
}

function getBrandedEmailSubject(slug) {
  return BRANDED_EMAIL_TEMPLATES[slug]?.subject || '';
}

function isBrandedEmailSlug(slug) {
  return Object.prototype.hasOwnProperty.call(BRANDED_EMAIL_TEMPLATES, slug);
}

module.exports = {
  BRANDED_EMAIL_TEMPLATES,
  resolveBrandedEmailBody,
  getBrandedEmailSubject,
  isBrandedEmailSlug,
};
