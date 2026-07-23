/**
 * Request to claim a hub-seeded business opportunity listing.
 */
const { getPublishedOpportunityById } = require('./supabase-opportunities');
const { isHubSeedOwnerEmail } = require('./opportunity-hub-seed');
const { sendViaResend } = require('./send-template-email');
const { supportEmail } = require('./hub-email-urls');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function createOpportunityClaimRequest(input) {
  const opportunityId = String(input.opportunityId || input.opportunity_id || '').trim();
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const company = String(input.company || input.host || '').trim();
  const role = String(input.role || input.jobTitle || '').trim();
  const message = String(input.message || '').trim();

  if (!opportunityId) throw new Error('missing_opportunity_id');
  if (!name) throw new Error('missing_name');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  if (!company) throw new Error('missing_company');

  const opportunity = await getPublishedOpportunityById(opportunityId);
  if (!opportunity) throw new Error('not_found');
  if (!isHubSeedOwnerEmail(opportunity.ownerEmail)) throw new Error('not_claimable');

  const siteUrl = String(process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const listingUrl =
    siteUrl +
    '/opportunities/' +
    encodeURIComponent(opportunity.slug || opportunity.id);
  const adminUrl = siteUrl + '/admin/#cleanup/opportunities';
  const to = supportEmail();

  const subject = 'Opportunity claim request — ' + String(opportunity.title || 'Listing').trim();
  const html =
    '<p>Someone has asked to <strong>claim and manage</strong> a hub-seeded business opportunity listing.</p>' +
    '<h3>Listing</h3>' +
    '<ul>' +
    '<li><strong>Title:</strong> ' +
    escapeHtml(opportunity.title) +
    '</li>' +
    '<li><strong>Company on listing:</strong> ' +
    escapeHtml(opportunity.host) +
    '</li>' +
    '<li><strong>Public page:</strong> <a href="' +
    escapeHtml(listingUrl) +
    '">' +
    escapeHtml(listingUrl) +
    '</a></li>' +
    '<li><strong>Listing id:</strong> ' +
    escapeHtml(opportunity.id) +
    '</li>' +
    '</ul>' +
    '<h3>Claimant</h3>' +
    '<ul>' +
    '<li><strong>Name:</strong> ' +
    escapeHtml(name) +
    '</li>' +
    '<li><strong>Email:</strong> <a href="mailto:' +
    escapeHtml(email) +
    '">' +
    escapeHtml(email) +
    '</a></li>' +
    '<li><strong>Company:</strong> ' +
    escapeHtml(company) +
    '</li>' +
    (role ? '<li><strong>Role:</strong> ' + escapeHtml(role) + '</li>' : '') +
    (message ? '<li><strong>Message:</strong> ' + escapeHtml(message) + '</li>' : '') +
    '</ul>' +
    '<p><strong>Next steps:</strong> assign the claimant in Command Centre with action <code>assign_owner</code> (sets owner email and opens the in-dashboard claim prompt), or update <code>owner_email</code> manually and set claim status to pending.</p>' +
    '<p><a href="' +
    escapeHtml(adminUrl) +
    '">Open opportunities in Command Centre</a></p>' +
    '<p>— The Networker Hub</p>';

  const emailResult = await sendViaResend({
    to,
    subject,
    html,
    replyTo: email,
  });

  return {
    ok: true,
    opportunityId: opportunity.id,
    emailResult,
  };
}

module.exports = {
  createOpportunityClaimRequest,
};
