/**
 * Standard industry list for attendee profiles — used in onboarding, settings, and admin reporting.
 */
const HUB_PROFILE_INDUSTRIES = [
  'Accountancy & Finance',
  'Banking & Insurance',
  'Legal',
  'Marketing, PR & Media',
  'IT, Software & Technology',
  'Consulting & Professional Services',
  'Construction & Trades',
  'Property & Real Estate',
  'Healthcare & Medical',
  'Education & Training',
  'Manufacturing & Engineering',
  'Retail, Hospitality & Leisure',
  'Recruitment & HR',
  'Creative, Design & Arts',
  'Coaching & Personal Development',
  'Transport & Logistics',
  'Energy & Environment',
  'Charity, Public & Social Enterprise',
  'Other',
];

const INDUSTRY_LOOKUP = new Map(
  HUB_PROFILE_INDUSTRIES.map((label) => [label.toLocaleLowerCase('en-GB'), label])
);

function normalizeIndustry(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const canonical = INDUSTRY_LOOKUP.get(trimmed.toLocaleLowerCase('en-GB'));
  return canonical || trimmed;
}

function isKnownIndustry(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return false;
  return INDUSTRY_LOOKUP.has(trimmed.toLocaleLowerCase('en-GB'));
}

function isBareOther(raw) {
  return normalizeIndustry(raw).toLocaleLowerCase('en-GB') === 'other';
}

function isAnalyticsProfileComplete(profile) {
  const sector = String(profile?.businessSector || profile?.business_sector || '').trim();
  const title = String(profile?.jobTitle || profile?.job_title || '').trim();
  return sector.length >= 2 && !isBareOther(sector) && title.length >= 2;
}

module.exports = {
  HUB_PROFILE_INDUSTRIES,
  normalizeIndustry,
  isKnownIndustry,
  isBareOther,
  isAnalyticsProfileComplete,
};
