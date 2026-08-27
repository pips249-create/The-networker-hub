/**
 * Automated moderation for business opportunity listings.
 * Flags MLM, guaranteed-income, and unregulated investment-style content.
 */
function normalizeMeta(meta) {
  if (!Array.isArray(meta)) return [];
  return meta
    .map((m) => ({
      key: String(m.key || '').trim(),
      val: String(m.val || '').trim(),
    }))
    .filter((m) => m.key && m.val);
}

const RED_FLAG_PATTERNS = [
  {
    id: 'recruitment_primary',
    label: 'Recruitment-primary network marketing (downline / team-build focus)',
    regex:
      /\bmlm\b|multi[\s-]?level(?:\s+market(?:ing)?)?|pyramid\s+schem|downline|upline|team[\s-]?build(?:ing)?|build\s+(?:your\s+)?(?:team|downline)|recruit(?:ing|ment)?\s+(?:for\s+)?(?:income|earnings|commission|others|people|distributors)|earn(?:ings)?\s+(?:from|by)\s+recruit|compensation\s+(?:based\s+)?on\s+recruit|get[\s-]?rich\s+quick|be\s+your\s+own\s+boss/i,
  },
  {
    id: 'guaranteed_income',
    label: 'Guaranteed or unrealistic income claims',
    regex:
      /guaranteed\s+(income|earnings|profit|return|salary)|quit your job|financial freedom|passive income|unlimited income|get rich|six[\s-]?figure income|replace your salary|earn \d+k?\s*(?:per|a)\s*(?:week|month)/i,
  },
  {
    id: 'unregulated_investment',
    label: 'Unregulated investment or high-risk scheme language',
    regex:
      /(?:crypto(?:currency)?|forex|binary option|initial coin|ico\b|token sale|unregulated investment|high[\s-]?yield|hyip|ponzi|trading bot|staking pool)/i,
  },
  {
    id: 'guaranteed_return',
    label: 'Guaranteed investment returns',
    regex:
      /guaranteed\s+\d+\s*%|risk[\s-]?free\s+investment|no[\s-]?risk investment|assured return|capital guaranteed/i,
  },
];

const NETWORK_MARKETING_TYPE = 'network-marketing';

function isNetworkMarketingType(value) {
  const types = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value.type].concat(Array.isArray(value.types) ? value.types : []).concat(Array.isArray(value.tags) ? value.tags : [])
      : [value];
  return types.some((t) => String(t || '').trim().toLowerCase() === NETWORK_MARKETING_TYPE);
}

const VAGUE_INVESTMENT = /^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable)$/i;

function collectOpportunityText(opportunity) {
  const meta = normalizeMeta(opportunity?.meta);
  const parts = [
    opportunity?.title,
    opportunity?.description,
    opportunity?.desc,
    opportunity?.host,
    opportunity?.category,
    opportunity?.type,
    ...(Array.isArray(opportunity?.about) ? opportunity.about : []),
    ...meta.flatMap((m) => [m.key, m.val]),
    ...(Array.isArray(opportunity?.tags) ? opportunity.tags : []),
  ];
  return parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
}

function metaValue(meta, keyPattern) {
  const hit = (meta || []).find((m) => keyPattern.test(String(m.key || '')));
  return hit ? String(hit.val || '').trim() : '';
}

function validateStructuredFields(opportunity) {
  const meta = normalizeMeta(opportunity?.meta);
  const missing = [];
  const types = collectOpportunityTypes(opportunity);
  const affiliateOnly = isAffiliateStyleListing(opportunity);

  if (affiliateOnly) {
    if (!metaValue(meta, /^commission$/i)) missing.push('commission');
    if (!metaValue(meta, /^what you promote$/i) && !metaValue(meta, /^promotes?$/i)) {
      missing.push('what you promote');
    }
  } else if (!metaValue(meta, /^investment$/i)) {
    missing.push('investment amount');
  }

  if (!metaValue(meta, /^location$/i) && !metaValue(meta, /^territory$/i)) {
    missing.push('territory / location');
  }
  if (!String(opportunity?.type || '').trim() && !types.length) missing.push('opportunity type');
  if (!missing.length) return null;
  return {
    flagged: true,
    reasons: missing.map((field) => ({ id: 'missing_field', label: 'Missing required field: ' + field })),
    rejectionNote:
      'We could not approve this listing because required details are missing: ' +
      missing.join(', ') +
      (affiliateOnly
        ? '. Please complete commission, what you promote, opportunity type, and territory / location, then resubmit.'
        : '. Please complete investment, opportunity type, and territory / location, then resubmit.'),
  };
}

function opportunityHasFinancialMeta(meta) {
  return normalizeMeta(meta).some(
    (m) =>
      m.val &&
      /^(return(\s+est\.?)?|earnings|revenue|income|profit)$/i.test(m.key)
  );
}

/** Guaranteed-return style keys — not affiliate commission. */
function isEarningsMetaKey(key) {
  return /^(return(\s+est\.?)?|earnings|revenue|income|profit)$/i.test(
    String(key || '').trim()
  );
}

function stripEarningsMeta(meta) {
  return normalizeMeta(meta).filter((m) => !isEarningsMetaKey(m.key));
}

function parseInvestmentAmount(meta) {
  const raw = metaValue(normalizeMeta(meta), /^investment$/i);
  if (!raw) return null;
  const num = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}

const CAPITAL_OPPORTUNITY_TYPES = new Set([
  'franchise',
  'distributorship',
  'business-opportunity',
  'network-marketing',
  'partnership',
]);

const HIGH_RISK_OPPORTUNITY_TYPES = new Set([
  'franchise',
  'distributorship',
  'business-opportunity',
  'network-marketing',
]);

function collectOpportunityTypes(opportunity) {
  const types = Array.isArray(opportunity?.types)
    ? opportunity.types.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const primary = String(opportunity?.type || '').trim().toLowerCase();
  if (primary && types.indexOf(primary) === -1) types.unshift(primary);
  return types;
}

/** Affiliate programmes (or legacy partnership + commission) without capital-intensive types. */
function isAffiliateStyleListing(typesOrOpportunity) {
  const opportunity = Array.isArray(typesOrOpportunity) ? null : typesOrOpportunity;
  const types = Array.isArray(typesOrOpportunity)
    ? typesOrOpportunity.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : collectOpportunityTypes(typesOrOpportunity);
  if (!types.length) return false;

  const meta = normalizeMeta(opportunity?.meta);
  const hasCommission = Boolean(metaValue(meta, /^commission$/i));
  const investRaw = metaValue(meta, /^investment$/i);
  const investNum = investRaw ? parseInt(String(investRaw).replace(/[^0-9]/g, ''), 10) : null;
  const hasMeaningfulInvest =
    investRaw &&
    !/^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable|on request)$/i.test(investRaw) &&
    !Number.isNaN(investNum) &&
    investNum > 0;
  const capitalOthers = new Set([
    'franchise',
    'distributorship',
    'business-opportunity',
    'network-marketing',
  ]);
  const legacyPartnership =
    types.indexOf('partnership') !== -1 &&
    types.indexOf('affiliate') === -1 &&
    !types.some((value) => capitalOthers.has(value)) &&
    hasCommission &&
    !hasMeaningfulInvest;

  if (legacyPartnership) return true;
  if (types.indexOf('affiliate') === -1) return false;
  return !types.some((value) => CAPITAL_OPPORTUNITY_TYPES.has(value));
}

function opportunityRequiresFcaDisclaimer(opportunity) {
  const types = collectOpportunityTypes(opportunity);
  if (isAffiliateStyleListing(opportunity)) {
    const investment = parseInvestmentAmount(opportunity?.meta);
    return investment != null && investment >= 10000;
  }
  const hasHighRiskType = types.some((value) => HIGH_RISK_OPPORTUNITY_TYPES.has(value));
  const investment = parseInvestmentAmount(opportunity?.meta);
  return hasHighRiskType || (investment != null && investment >= 10000);
}

function validateFcaDisclaimer(payload) {
  if (!opportunityRequiresFcaDisclaimer(payload)) return null;
  if (!payload?.fcaDisclaimerAttested) {
    return {
      code: 'fca_disclaimer_required',
      message:
        'Confirm this is not a regulated investment and you will not make guaranteed return claims before listing.',
    };
  }
  return null;
}

function validateEarningsAttestation() {
  // Earnings / return fields were removed from listing forms.
  return null;
}

function scanOpportunityRedFlags(opportunity) {
  const structured = validateStructuredFields(opportunity);
  if (structured) return structured;

  const text = collectOpportunityText(opportunity);
  const hits = [];
  RED_FLAG_PATTERNS.forEach((pattern) => {
    if (pattern.regex.test(text)) hits.push(pattern);
  });

  const investment = metaValue(normalizeMeta(opportunity?.meta), /^investment$/i);
  if (investment && VAGUE_INVESTMENT.test(investment)) {
    hits.push({
      id: 'vague_investment',
      label: 'Vague or unspecified investment amount',
    });
  }

  if (!hits.length) return null;

  const bulletLines = hits.map((h) => '• ' + h.label).join('\n');
  return {
    flagged: true,
    reasons: hits,
    rejectionNote:
      'We could not approve this listing because it includes content we do not allow on The Networker UK:\n\n' +
      bulletLines +
      '\n\nPlease remove prohibited claims (such as recruitment-primary network marketing, guaranteed income, or unregulated investment promotions), ensure investment and territory are clearly stated, and resubmit.',
  };
}

module.exports = {
  RED_FLAG_PATTERNS,
  NETWORK_MARKETING_TYPE,
  isNetworkMarketingType,
  collectOpportunityText,
  collectOpportunityTypes,
  isAffiliateStyleListing,
  validateStructuredFields,
  opportunityHasFinancialMeta,
  isEarningsMetaKey,
  stripEarningsMeta,
  opportunityRequiresFcaDisclaimer,
  validateEarningsAttestation,
  validateFcaDisclaimer,
  scanOpportunityRedFlags,
};
