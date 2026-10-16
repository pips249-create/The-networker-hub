/**
 * Email sent when staff hand an organiser page to someone who asked for it,
 * or when staff transfer ownership and the new owner still needs to sign in.
 * This is not the cold "It's FREE to claim" outreach campaign.
 */
const OWNERSHIP_TRANSFER_SLUG = 'organiser_ownership_transfer';

function organiserLabel(organiserName) {
  return String(organiserName || 'your group').trim() || 'your group';
}

function ownershipTransferLead(organiserName, requested) {
  const name = organiserLabel(organiserName);
  if (requested) {
    return (
      'You asked to claim and manage ' +
      name +
      '. We have approved that request and updated the profile so this email address can take it over.'
    );
  }
  return 'We have transferred ' + name + ' to this email address so you can manage the page.';
}

function ownershipTransferSubject(organiserName, requested) {
  const name = organiserLabel(organiserName);
  if (requested) return 'Your request to manage ' + name + ' is approved';
  return 'You can manage ' + name + ' — The Networker UK';
}

async function sendOrganiserOwnershipTransferEmail({ to, organiserName, claimUrl, requested, host }) {
  const { sendTemplatedEmail } = require('./send-template-email');
  const { campaignSiteVars } = require('./organiser-campaign-defaults');
  const site = String(host || process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  const name = organiserLabel(organiserName);
  return sendTemplatedEmail({
    slug: OWNERSHIP_TRANSFER_SLUG,
    to,
    subject: ownershipTransferSubject(name, requested),
    variables: {
      ...campaignSiteVars(site),
      organiser_name: name,
      claim_url: claimUrl,
      lead: ownershipTransferLead(name, requested),
    },
    skipEmailCheck: true,
  });
}

module.exports = {
  OWNERSHIP_TRANSFER_SLUG,
  ownershipTransferLead,
  ownershipTransferSubject,
  sendOrganiserOwnershipTransferEmail,
};
