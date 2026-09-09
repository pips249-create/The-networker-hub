/**
 * Allow-listed industry directory pages for Opportunities AEO.
 * Keep labels in sync with js/opportunities-catalog.js CATEGORY_OPTIONS.
 * Excludes mlm + general (not used as Industry Sponsor / directory chips).
 */

const OPPORTUNITY_INDUSTRIES = {
  cleaning: { id: 'cleaning', label: 'Cleaning' },
  'home-services': { id: 'home-services', label: 'Home services & trades' },
  food: { id: 'food', label: 'Food & Drink' },
  retail: { id: 'retail', label: 'Retail & E-commerce' },
  tech: { id: 'tech', label: 'Tech & Digital' },
  health: { id: 'health', label: 'Health & Fitness' },
  medical: { id: 'medical', label: 'Medical & clinical' },
  beauty: { id: 'beauty', label: 'Beauty & Wellness' },
  property: { id: 'property', label: 'Property' },
  automotive: { id: 'automotive', label: 'Automotive' },
  education: { id: 'education', label: 'Education & Coaching' },
  childcare: { id: 'childcare', label: 'Childcare & Family' },
  care: { id: 'care', label: 'Care & support' },
  finance: { id: 'finance', label: 'Finance, legal & admin' },
  recruitment: { id: 'recruitment', label: 'Recruitment & staffing' },
  pets: { id: 'pets', label: 'Pets & Animals' },
  leisure: { id: 'leisure', label: 'Leisure, travel & hospitality' },
  networking: { id: 'networking', label: 'Networking' },
};

const OPPORTUNITY_INDUSTRY_SLUGS = Object.keys(OPPORTUNITY_INDUSTRIES);

function getOpportunityIndustry(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  const industry = OPPORTUNITY_INDUSTRIES[key];
  if (!industry) return null;
  return {
    id: industry.id,
    label: industry.label,
    path: '/opportunities/industry/' + industry.id,
  };
}

module.exports = {
  OPPORTUNITY_INDUSTRIES,
  OPPORTUNITY_INDUSTRY_SLUGS,
  getOpportunityIndustry,
};
