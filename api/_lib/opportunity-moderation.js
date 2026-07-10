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
    id: 'mlm',
    label: 'MLM or network-marketing style recruitment',
    regex:
      /mlm|multi[\s-]?level|network marketing|direct sales|downline|upline|team build|independent consultant|ambassador program|be your own boss/i,
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
  if (!metaValue(meta, /^investment$/i)) missing.push('investment amount');
  if (!metaValue(meta, /^location$/i) && !metaValue(meta, /^territory$/i)) {
    missing.push('territory / location');
  }
  if (!String(opportunity?.type || '').trim()) missing.push('opportunity type');
  if (!missing.length) return null;
  return {
    flagged: true,
    reasons: missing.map((field) => ({ id: 'missing_field', label: 'Missing required field: ' + field })),
    rejectionNote:
      'We could not approve this listing because required details are missing: ' +
      missing.join(', ') +
      '. Please complete investment, opportunity type, and territory / location, then resubmit.',
  };
}

function opportunityHasFinancialMeta(meta) {
  return normalizeMeta(meta).some(
    (m) =>
      m.val &&
      /^(return(\s+est\.?)?|earnings|commission|revenue|income|profit)$/i.test(m.key)
  );
}

function validateEarningsAttestation(payload) {
  if (!opportunityHasFinancialMeta(payload?.meta)) return null;
  if (!payload?.earningsClaimsAttested) {
    return {
      code: 'earnings_attestation_required',
      message:
        'Confirm your earnings or return figures are truthful, typical, and substantiated before listing.',
    };
  }
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
      'We could not approve this listing because it includes content we do not allow on The Networker Hub:\n\n' +
      bulletLines +
      '\n\nPlease remove prohibited claims (such as MLM-style recruitment, guaranteed income, or unregulated investment promotions), ensure investment and territory are clearly stated, and resubmit.',
  };
}

module.exports = {
  RED_FLAG_PATTERNS,
  collectOpportunityText,
  validateStructuredFields,
  opportunityHasFinancialMeta,
  validateEarningsAttestation,
  scanOpportunityRedFlags,
};
