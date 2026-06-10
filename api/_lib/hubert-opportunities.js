/**
 * Live business-opportunity lookup for Hubert.
 */
const { isSupabaseConfigured } = require('./supabase');
const { listPublishedOpportunities } = require('./supabase-opportunities');

const OPPORTUNITY_INTENT =
  /\b(opportunit|opportunities|franchise|franchises|partnership|partnerships|side[\s-]?hustle|distributorship|referral deal|business deal|invest(?:ment)?|listings? on the hub|browse opportunit|find (?:a )?(?:franchise|partnership|deal)|what(?:'s| is) (?:on|available on) (?:the )?opportunit)/i;

const TYPE_ALIASES = {
  franchise: /\bfranchis/i,
  partnership: /\bpartner/i,
  'side-hustle': /\bside[\s-]?hustle|\bextra income\b|\bmoonlight/i,
  distributorship: /\bdistribut/i,
  networking: /\bnetwork(?:ing)? opportunit|\breferral\b/i,
  'business-opportunity': /\bbusiness opportunit|\bdeal\b|\binvestment\b/i,
};

function wantsOpportunitySearch(text) {
  return OPPORTUNITY_INTENT.test(String(text || ''));
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
    partnership: 'Partnership',
    'side-hustle': 'Side hustle',
    distributorship: 'Distributorship',
    networking: 'Networking / referral',
    'business-opportunity': 'Business opportunity',
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
    if (typeHit) score += 10;
    else score -= 2;
  }

  if (query.featuredOnly && item.featured) score += 3;

  const words = String(query.text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(function (w) {
      return (
        w.length >= 4 &&
        !/^(what|show|find|browse|list|opportunity|opportunities|business|franchise|partnership|deal|deals|available)$/.test(
          w
        )
      );
    });

  words.forEach(function (word) {
    if (title.includes(word)) score += 5;
    else if (haystack.includes(word)) score += 2;
  });

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
    '/opportunities/' + item.id,
  ].filter(Boolean);
  return '- ' + bits.join(' | ');
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
  const hasSignal = query.types.length > 0 || ranked.some(function (r) {
    return r.score > 0;
  });

  let opportunities;
  if (hasSignal) {
    opportunities = ranked
      .filter(function (r) {
        return r.score > 0 || !query.types.length;
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
    'LIVE OPPORTUNITY LOOKUP — cite only these real published listings (title, type, host, summary, link). Do not invent others:\n' +
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
      "I couldn't find published business opportunities" +
      typeHint +
      ' on the hub right now. Browse the directory at /opportunities/ or check back soon.'
    );
  }

  const lines = opportunities.map(function (item) {
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
      ' · /opportunities/' +
      item.id
    );
  });

  return (
    'Here are some business opportunities that may suit you:\n\n' +
    lines.join('\n') +
    '\n\nBrowse everything at /opportunities/. A free account is needed to send an enquiry.'
  );
}

module.exports = {
  wantsOpportunitySearch,
  searchOpportunitiesForHubert,
  buildOpportunityContextBlock,
  formatOpportunityFallbackReply,
};
