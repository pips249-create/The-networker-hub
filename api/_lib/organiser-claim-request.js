/**
 * Public request to claim an unclaimed organiser group profile.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { getPublicOrganiserById } = require('./supabase-organisers-browse');
const { sendViaResend } = require('./send-template-email');
const { supportEmail } = require('./hub-email-urls');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function profileEmail(row) {
  return String(row?.email || row?.contact_email || '')
    .trim()
    .toLowerCase();
}

function isOrganiserClaimableRow(row) {
  if (!row || !row.id) return false;
  if (!String(row.name || '').trim()) return false;
  const verified = row.verification_status === 'Verified';
  const published = String(row.listing_status || '').toLowerCase() === 'published';
  if (!verified && !published) return false;
  const status = String(row.ownership_claim_status || '').toLowerCase();
  return status !== 'claimed';
}

async function createOrganiserClaimRequest(input) {
  const organiserId = String(input.organiserId || input.organiser_id || input.id || '').trim();
  const name = String(input.name || input.claimantName || '').trim();
  const email = String(input.email || input.claimantEmail || '')
    .trim()
    .toLowerCase();
  const role = String(input.role || input.claimantRole || '').trim();
  const message = String(input.message || '').trim();

  if (!organiserId) throw new Error('missing_organiser_id');
  if (!name) throw new Error('missing_name');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');

  if (!isSupabaseConfigured()) throw new Error('not_configured');

  const sb = getSupabaseAdmin();
  const { data: row, error: rowErr } = await sb
    .from('organisers')
    .select('*')
    .eq('id', organiserId)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);
  if (!row || !isOrganiserClaimableRow(row)) throw new Error('not_claimable');

  const organiserName = String(row.name || '').trim() || 'Group profile';
  const existingOpen = await sb
    .from('organiser_claim_requests')
    .select('id')
    .eq('organiser_id', organiserId)
    .eq('claimant_email', email)
    .eq('status', 'open')
    .maybeSingle();
  if (existingOpen.error && !/could not find the table|schema cache|relation .* does not exist/i.test(existingOpen.error.message || '')) {
    throw new Error(existingOpen.error.message);
  }
  if (existingOpen.data?.id) {
    return {
      ok: true,
      organiserId,
      requestId: existingOpen.data.id,
      duplicate: true,
    };
  }

  const insertRes = await sb
    .from('organiser_claim_requests')
    .insert({
      organiser_id: organiserId,
      organiser_name: organiserName,
      profile_email: profileEmail(row) || null,
      claimant_name: name,
      claimant_email: email,
      claimant_role: role || null,
      message: message || null,
      status: 'open',
    })
    .select('id')
    .single();
  if (insertRes.error) throw new Error(insertRes.error.message);

  const publicOrganiser = await getPublicOrganiserById(organiserId);
  const slug = publicOrganiser?.slug || '';
  const siteUrl = String(process.env.SITE_URL || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const listingUrl = slug
    ? siteUrl + '/organisers/' + encodeURIComponent(slug)
    : siteUrl + '/events/organiser?id=' + encodeURIComponent(organiserId);
  const adminUrl = siteUrl + '/admin/#cleanup/groups';
  const to = supportEmail();

  const subject = 'Organiser claim request — ' + organiserName;
  const html =
    '<p>Someone has asked to <strong>claim and manage</strong> a public organiser profile on The Networker Hub.</p>' +
    '<h3>Group profile</h3>' +
    '<ul>' +
    '<li><strong>Name:</strong> ' +
    escapeHtml(organiserName) +
    '</li>' +
    (profileEmail(row)
      ? '<li><strong>Email on file:</strong> ' + escapeHtml(profileEmail(row)) + '</li>'
      : '') +
    '<li><strong>Public page:</strong> <a href="' +
    escapeHtml(listingUrl) +
    '">' +
    escapeHtml(listingUrl) +
    '</a></li>' +
    '<li><strong>Organiser id:</strong> ' +
    escapeHtml(organiserId) +
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
    (role ? '<li><strong>Role:</strong> ' + escapeHtml(role) + '</li>' : '') +
    (message ? '<li><strong>Message:</strong> ' + escapeHtml(message) + '</li>' : '') +
    '</ul>' +
    '<p><strong>Next steps:</strong> verify the claimant in Command Centre, update the profile contact email if needed, then approve to send the claim invite.</p>' +
    '<p><a href="' +
    escapeHtml(adminUrl) +
    '">Open group cleanup in Command Centre</a></p>' +
    '<p>— The Networker Hub</p>';

  const emailResult = await sendViaResend({
    to,
    subject,
    html,
    replyTo: email,
  });

  return {
    ok: true,
    organiserId,
    requestId: insertRes.data.id,
    emailResult,
  };
}

module.exports = {
  isOrganiserClaimableRow,
  createOrganiserClaimRequest,
};
