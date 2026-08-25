/**
 * Client-side scan for business opportunity listing content — mirrors api/_lib/opportunity-moderation.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HubOpportunityModerationScan = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var RED_FLAG_PATTERNS = [
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

  var VAGUE_INVESTMENT = /^(unlimited|n\/?a|tbc|tba|contact|enquire|varies|negotiable)$/i;

  function normalizeMeta(meta) {
    if (!Array.isArray(meta)) return [];
    return meta
      .map(function (m) {
        return {
          key: String(m.key || '').trim(),
          val: String(m.val || '').trim(),
        };
      })
      .filter(function (m) {
        return m.key && m.val;
      });
  }

  function metaValue(meta, keyPattern) {
    var hit = (meta || []).find(function (m) {
      return keyPattern.test(String(m.key || ''));
    });
    return hit ? String(hit.val || '').trim() : '';
  }

  function collectOpportunityText(opportunity) {
    var meta = normalizeMeta(opportunity && opportunity.meta);
    var parts = [
      opportunity && opportunity.title,
      opportunity && opportunity.description,
      opportunity && opportunity.desc,
      opportunity && opportunity.host,
      opportunity && opportunity.category,
      opportunity && opportunity.type,
    ];
    if (opportunity && Array.isArray(opportunity.about)) {
      parts = parts.concat(opportunity.about);
    }
    parts = parts.concat(meta.flatMap(function (m) {
      return [m.key, m.val];
    }));
    if (opportunity && Array.isArray(opportunity.tags)) {
      parts = parts.concat(opportunity.tags);
    }
    return parts
      .map(function (p) {
        return String(p || '').trim();
      })
      .filter(Boolean)
      .join(' ');
  }

  function collectOpportunityTypes(opportunity) {
    var types = Array.isArray(opportunity && opportunity.types)
      ? opportunity.types.map(function (value) {
          return String(value || '').trim().toLowerCase();
        }).filter(Boolean)
      : [];
    var primary = String((opportunity && opportunity.type) || '').trim().toLowerCase();
    if (primary && types.indexOf(primary) === -1) types.unshift(primary);
    return types;
  }

  function isAffiliateStyleListing(opportunity) {
    var types = collectOpportunityTypes(opportunity);
    if (types.indexOf('partnership') === -1) return false;
    var capital = ['franchise', 'distributorship', 'business-opportunity', 'network-marketing'];
    return !types.some(function (value) {
      return capital.indexOf(value) !== -1;
    });
  }

  function validateStructuredFields(opportunity) {
    var meta = normalizeMeta(opportunity && opportunity.meta);
    var missing = [];
    var types = collectOpportunityTypes(opportunity);
    var affiliateOnly = isAffiliateStyleListing(opportunity);

    if (affiliateOnly) {
      if (!metaValue(meta, /^commission$/i)) missing.push('commission');
      if (!metaValue(meta, /^what you promote$/i)) missing.push('what you promote');
    } else if (!metaValue(meta, /^investment$/i)) {
      missing.push('investment amount');
    }

    if (!metaValue(meta, /^location$/i) && !metaValue(meta, /^territory$/i)) {
      missing.push('territory / location');
    }
    if (!String((opportunity && opportunity.type) || '').trim() && !types.length) {
      missing.push('opportunity type');
    }
    if (!missing.length) return null;
    return {
      flagged: true,
      blocking: true,
      reasons: missing.map(function (field) {
        return { id: 'missing_field', label: 'Missing required field: ' + field };
      }),
    };
  }

  function scanOpportunityRedFlags(opportunity, options) {
    var includeMissingFields = !options || options.includeMissingFields !== false;
    if (includeMissingFields) {
      var structured = validateStructuredFields(opportunity);
      if (structured) return structured;
    }

    var text = collectOpportunityText(opportunity);
    var hits = [];
    RED_FLAG_PATTERNS.forEach(function (pattern) {
      if (pattern.regex.test(text)) hits.push(pattern);
    });

    var investment = metaValue(normalizeMeta(opportunity && opportunity.meta), /^investment$/i);
    if (investment && VAGUE_INVESTMENT.test(investment)) {
      hits.push({
        id: 'vague_investment',
        label: 'Vague or unspecified investment amount',
      });
    }

    if (!hits.length) return null;

    return {
      flagged: true,
      blocking: true,
      reasons: hits,
    };
  }

  return {
    RED_FLAG_PATTERNS: RED_FLAG_PATTERNS,
    scanOpportunityRedFlags: scanOpportunityRedFlags,
    collectOpportunityText: collectOpportunityText,
  };
});
