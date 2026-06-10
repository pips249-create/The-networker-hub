const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  isPublishableSponsorBlock,
  sponsorLogoUrl,
  sponsorCompanyName,
} = require('./cms-sponsor-fields');

const BOOKING_EMAIL_SPONSOR_SLOT = 'booking_email_sponsor';
const EVENTS_SPONSOR_SLOT = 'events_sponsor_hub';
const LEGACY_SPONSOR_SLOT = 'sponsor_hub';
const SPONSOR_FALLBACK_SLOTS = [
  BOOKING_EMAIL_SPONSOR_SLOT,
  EVENTS_SPONSOR_SLOT,
  LEGACY_SPONSOR_SLOT,
];

function buildSponsorSection(block) {
  if (!block) return '';
  const logo = sponsorLogoUrl(block);
  const url = String(block.cta_url || '').trim();
  const name = sponsorCompanyName(block) || 'Our sponsor';
  if (!url) return '';
  const safeUrl = url.replace(/"/g, '&quot;');
  const logoHtml = logo
    ? '<img src="' +
      logo.replace(/"/g, '&quot;') +
      '" alt="' +
      name.replace(/"/g, '&quot;') +
      '" width="140" style="height:auto;display:inline-block;opacity:0.9;">'
    : '<span style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#9a7aa8;">' +
      name +
      '</span>';
  return (
    '<tr><td style="padding:18px 48px;text-align:center;background:#ffffff;border-top:1px solid #d9c4e0;border-bottom:1px solid #d9c4e0;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:600;color:#9a9092;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Our event directory is proudly powered by</p>' +
    '<a href="' +
    safeUrl +
    '" style="display:inline-block;text-decoration:none;">' +
    logoHtml +
    '</a></td></tr>'
  );
}

async function fetchSponsorBlockForSlot(sb, slot) {
  const { data, error } = await sb.from('cms_blocks').select('*').eq('slot', slot).maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveBookingEmailSponsorBlock(sb) {
  for (const slot of SPONSOR_FALLBACK_SLOTS) {
    const data = await fetchSponsorBlockForSlot(sb, slot);
    if (data && isPublishableSponsorBlock(data, slot)) return { block: data, slot };
  }
  return { block: null, slot: '' };
}

async function getBookingEmailDefaultVars() {
  if (!isSupabaseConfigured()) return { sponsor_section: '' };
  try {
    const sb = getSupabaseAdmin();
    const { block } = await resolveBookingEmailSponsorBlock(sb);
    if (!block) return { sponsor_section: '' };
    return { sponsor_section: buildSponsorSection(block) };
  } catch {
    return { sponsor_section: '' };
  }
}

module.exports = {
  BOOKING_EMAIL_SPONSOR_SLOT,
  EVENTS_SPONSOR_SLOT,
  buildSponsorSection,
  getBookingEmailDefaultVars,
  resolveBookingEmailSponsorBlock,
};
