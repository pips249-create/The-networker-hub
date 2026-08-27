/**
 * Live business-opportunity lookup for Hubert.
 */
const { isSupabaseConfigured } = require('./supabase');
const { listPublishedOpportunities } = require('./supabase-opportunities');
const { hubOpportunityUrl, hubSiteUrl } = require('./hubert-site-url');

/** Organiser listing / enquiry help — must not trigger live opportunity browse. */
const HELP_NOT_OPPORTUNITY_BROWSE =
  /\b(how do i list|how can i list|how do i publish|list a|list my|publish a|submit a|create a listing|manage enquir|respond to enquir|reply to enquir|organiser dashboard|listing form|submit for review|how do i enquire|how to enquire|send an enquiry|what is a business opportunit|what are business opportunit|business opportunit.*(fee|cost|price)|listings are reviewed)\b/i;

/** Explicit browse / discovery intent for business opportunities. */
const OPPORTUNITY_BROWSE_INTENT =
  /\b(what opportunit\w*|find (?:a |an )?(?:franchise|partnership|side|deal|opportunit\w*)|show (?:me )?(?:any )?(?:franchise|partnership|side|opportunit\w*)|any franchis|franchise opportunit\w*|partnership opportunit\w*|side[\s-]?hustle opportunit\w*|distributorship opportunit\w*|browse opportunit\w*|search opportunit\w*|help me find|(?:on|available on) (?:the )?hub|what(?:'s| is) (?:on|available on) (?:the )?opportunit\w*|low[\s-]?investment|under £|under \d+k|featured opportunit\w*|opportunities on The Networker UK|franchise deals?|partnership deals?)\b/i;

const TYPE_ALIASES = {
  franchise: /\bfranchis/i,
  partnership: /\bpartnership|\bjoint venture\b|\bwhite[\s-]?label\b/i,
  affiliate: /\baffiliate\b|\baffiliate (?:link|program+e?|market)/i,
  'side-hustle': /\bside[\s-]?hustle|\bextra income\b|\bmoonlight/i,
  distributorship: /\bdistribut/i,
  networking: /\bnetwork(?:ing)? opportunit|\breferral\b/i,
  'network-marketing': /\bnetwork\s*marketing|\bdirect\s*sales\b|\bmlm\b/i,
  'business-opportunity': /\bbusiness opportunit|\bdeal\b|\binvestment\b/i,
};

function wantsOpportunitySearch(text, options) {
  const t = String(text || '');
  if (!t) return false;
  if (options && options.skipOpportunitySearch) return false;
  if (HELP_NOT_OPPORTUNITY_BROWSE.test(t)) return false;
  return OPPORTUNITY_BROWSE_INTENT.test(t);
}

function detectOpportunityTypes(text) {
  const lower = String(text || '').toLowerCase();
  const types = [];
  Object.keys(TYPE_ALIASES).forEach(function (type) {
    if (TYPE_ALIASES[type].test(lower)) types.push(type);
  });
  return types;
}

function opportunityHaystack(item) {
  return [
    item.title,
    item.desc,
    item.host,
    item.type,
    item.category,
    (item.tags || []).join(' '),
    (item.about || []).join(' '),
    (item.meta || [])
      .map(function (m) {
        return m.key + ' ' + m.val;
      })
      .join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function typeLabel(type) {
  const labels = {
    franchise: 'Franchise',
    'side-hustle': 'Side hustle',
    partnership: 'Partnership',
    affiliate: 'Affiliate',
    networking: 'Networking group / Ambassador',
    'network-marketing': 'Network marketing',
    'business-opportunity': 'Business opportunity',
    distributorship: 'Distributorship / Reseller',
  };
  return labels[type] || 'Business opportunity';
}

function scoreOpportunity(item, query) {
  let score = 0;
  const haystack = opportunityHaystack(item);
  const title = String(item.title || '').toLowerCase();

  if (query.types.length) {
    const itemTypes = [item.type].concat(item.tags || []).map(function (t) {
      return String(t || '').toLowerCase();
    });
    const typeHit = query.types.some(function (wanted) {
      return itemTypes.includes(wanted);
    });
    if (!typeHit) return -1;
    score += 10;
  }

  if (query.featuredOnly && !item.featured) return -1;
  if (query.featuredOnly && item.featured) score += 3;

  const words = String(query.text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(function (w) {
      return (
        w.length >= 4 &&
        !/^(what|show|find|browse|list|opportunity|opportunities|business|franchise|partnership|deal|deals|available|hub)$/.test(
          w
        )
      );
    });

  words.forEach(function (word) {
    if (title.includes(word)) score += 5;
    else if (haystack.includes(word)) score += 2;
  });

  if (!query.types.length && !query.featuredOnly && score === 0 && words.length === 0) {
    score = 1;
  }

  return score;
}

function compactOpportunityLine(item) {
  const summary = String(item.desc || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const bits = [
    item.title,
    typeLabel(item.type),
    item.host,
    summary,
    hubOpportunityUrl(item.id),
  ].filter(Boolean);
  return '- ' + bits.join(' | ');
}

function formatOpportunityListingLine(item) {
  const summary = String(item.desc || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return (
    '• ' +
    item.title +
    ' — ' +
    typeLabel(item.type) +
    (item.host ? ' · ' + item.host : '') +
    (summary ? ' · ' + summary : '') +
    '\n  ' +
    hubOpportunityUrl(item.id)
  );
}

async function searchOpportunitiesForHubert(userMessage, limit) {
  const text = String(userMessage || '').trim();
  if (!text || !wantsOpportunitySearch(text)) {
    return { opportunities: [], query: null };
  }

  if (!isSupabaseConfigured()) {
    return { opportunities: [], query: { text: text, configured: false } };
  }

  const query = {
    text: text,
    types: detectOpportunityTypes(text),
    featuredOnly: /\bfeatured\b/i.test(text),
    configured: true,
  };

  const all = await listPublishedOpportunities();
  const ranked = (all || [])
    .map(function (item) {
      return { item: item, score: scoreOpportunity(item, query) };
    })
    .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.item.publishedAt || a.item.createdAt || '';
      const bTime = b.item.publishedAt || b.item.createdAt || '';
      return String(bTime).localeCompare(String(aTime));
    });

  const max = Math.min(Math.max(limit || 6, 1), 8);
  const hasSignal =
    query.types.length > 0 ||
    query.featuredOnly ||
    ranked.some(function (r) {
      return r.score > 1;
    });

  let opportunities;
  if (hasSignal) {
    opportunities = ranked
      .filter(function (r) {
        return r.score > 0;
      })
      .slice(0, max)
      .map(function (r) {
        return r.item;
      });
  } else {
    opportunities = (all || []).slice(0, max);
  }

  return { opportunities: opportunities, query: query };
}

function buildOpportunityContextBlock(result) {
  const opportunities = (result && result.opportunities) || [];
  const query = result && result.query;

  if (query && query.configured === false) {
    return (
      'LIVE OPPORTUNITY LOOKUP: Business opportunities database is not configured in this environment. ' +
      'Do not invent listings — suggest browsing /opportunities/.'
    );
  }

  if (!opportunities.length) {
    const typeHint =
      query && query.types.length
        ? ' for ' + query.types.map(typeLabel).join(', ')
        : '';
    return (
      'LIVE OPPORTUNITY LOOKUP: No matching published business opportunities found' +
      typeHint +
      '. Tell the user honestly, suggest browsing /opportunities/, and do not invent listings.'
    );
  }

  return (
    'LIVE OPPORTUNITY LOOKUP — cite only these real published listings. Include the full URL link for each listing. Do not invent others:\n' +
    opportunities.map(compactOpportunityLine).join('\n')
  );
}

function formatOpportunityFallbackReply(result) {
  const opportunities = (result && result.opportunities) || [];
  const query = result && result.query;

  if (!opportunities.length) {
    const typeHint =
      query && query.types.length
        ? ' matching ' + query.types.map(typeLabel).join(', ')
        : '';
    return (
      "I'm afraid I couldn't find published business opportunities" +
      typeHint +
      ' on the platform at present. Do browse the directory at ' +
      hubSiteUrl('/opportunities/') +
      ', or check back soon.'
    );
  }

  const lines = opportunities.map(formatOpportunityListingLine);

  return (
    'Allow me to highlight a few business opportunities that may suit you:\n\n' +
    lines.join('\n\n') +
    '\n\nBrowse everything at ' +
    hubSiteUrl('/opportunities/') +
    '. A free account is needed to send an enquiry.'
  );
}

module.exports = {
  wantsOpportunitySearch,
  searchOpportunitiesForHubert,
  buildOpportunityContextBlock,
  formatOpportunityFallbackReply,
  HELP_NOT_OPPORTUNITY_BROWSE,
  OPPORTUNITY_BROWSE_INTENT,
  scoreOpportunity,
};
