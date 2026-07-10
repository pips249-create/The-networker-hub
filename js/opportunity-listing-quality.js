/**
 * Opportunity listing quality — trust badges, completeness, similar listings, criteria match.
 */
(function () {
  var COMPANIES_HOUSE_KEY = 'Companies House';

  function metaVal(meta, keyRe) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (keyRe.test(meta[i].key)) return String(meta[i].val || '').trim();
    }
    return '';
  }

  function normalizeCompaniesHouseNumber(raw) {
    return String(raw || '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function isValidCompaniesHouseNumber(raw) {
    var n = normalizeCompaniesHouseNumber(raw);
    if (!n) return false;
    return /^[A-Z0-9]{6,8}$/.test(n);
  }

  function hasTerritoryListed(item) {
    var loc = metaVal(item.meta, /^location$/i);
    if (!loc || loc === '—') return false;
    return loc.length > 1;
  }

  function hasCostBreakdown(item) {
    if (item.investmentIncludes && item.investmentIncludes.length) return true;
    if (window.HubOpportunityInvestment && window.HubOpportunityInvestment.fromMeta) {
      return window.HubOpportunityInvestment.fromMeta(item.meta).length > 0;
    }
    return Boolean(metaVal(item.meta, /^investment includes$/i));
  }

  function companiesHouseNumber(item) {
    return normalizeCompaniesHouseNumber(metaVal(item.meta, /^companies house$/i));
  }

  function companiesHouseUrl(number) {
    var n = normalizeCompaniesHouseNumber(number);
    if (!n || !isValidCompaniesHouseNumber(n)) return '';
    return 'https://find-and-update.company-information.service.gov.uk/company/' + encodeURIComponent(n);
  }

  function companiesHouseMetaHtml(item) {
    var n = companiesHouseNumber(item);
    if (!n || !isValidCompaniesHouseNumber(n)) return '';
    var url = companiesHouseUrl(n);
    if (url) {
      return (
        '<a class="opp-companies-house-link" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">Co. ' +
        escapeHtml(n) +
        ' (Companies House)</a>'
      );
    }
    return 'Co. ' + escapeHtml(n);
  }

  function trustBadges(item) {
    var badges = [];
    if (hasCostBreakdown(item)) {
      badges.push({ id: 'breakdown', label: 'Cost breakdown' });
    }
    if (hasTerritoryListed(item)) {
      badges.push({ id: 'territory', label: 'Territory listed' });
    }
    var ch = companiesHouseNumber(item);
    if (ch && isValidCompaniesHouseNumber(ch)) {
      badges.push({ id: 'companies-house', label: 'Co. number listed' });
    }
    return badges;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function trustBadgesHtml(item, className) {
    var badges = trustBadges(item);
    if (!badges.length) return '';
    var cls = className || 'opp-trust-badges';
    return (
      '<div class="' +
      cls +
      '" aria-label="Listing details">' +
      badges
        .map(function (b) {
          return '<span class="opp-trust-badge opp-trust-badge--' + b.id + '">' + escapeHtml(b.label) + '</span>';
        })
        .join('') +
      '</div>'
    );
  }

  function investTier(item) {
    var tags = item.filterTags || item.tags || [];
    if (tags.indexOf('low-invest') !== -1) return 'low';
    if (tags.indexOf('mid-invest') !== -1) return 'mid';
    if (tags.indexOf('high-invest') !== -1) return 'high';
    return '';
  }

  function similarScore(current, candidate) {
    if (!current || !candidate || current.id === candidate.id) return -1;
    var score = 0;
    if (current.type === candidate.type) score += 4;
    var ct = current.tags || [];
    var ot = candidate.tags || [];
    ct.forEach(function (t) {
      if (ot.indexOf(t) !== -1 && t.indexOf('cat-') !== 0) score += 1;
    });
    if (current.category && current.category === candidate.category) score += 3;
    var a = investTier(current);
    var b = investTier(candidate);
    if (a && b && a === b) score += 2;
    else if (a && b) {
      var order = { low: 0, mid: 1, high: 2 };
      if (Math.abs(order[a] - order[b]) === 1) score += 1;
    }
    if (current.host && candidate.host && current.host.toLowerCase() === candidate.host.toLowerCase()) {
      return -1;
    }
    return score;
  }

  function similarOpportunities(all, current, limit) {
    var max = limit || 4;
    if (!current || !Array.isArray(all)) return [];
    return all
      .map(function (item) {
        return { item: item, score: similarScore(current, item) };
      })
      .filter(function (row) {
        return row.score > 0;
      })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return (a.item.title || '').localeCompare(b.item.title || '', 'en-GB');
      })
      .slice(0, max)
      .map(function (row) {
        return row.item;
      });
  }

  function hasTag(item, tag) {
    var tags = item.filterTags || item.tags || [];
    return tags.indexOf(tag) !== -1 || item.type === tag;
  }

  function matchesSearchCriteria(item, criteria) {
    if (!item || !criteria) return false;
    var type = String(criteria.type || '').trim();
    if (type && type !== 'all' && item.type !== type && !hasTag(item, type)) return false;

    var invest = String(criteria.invest || '').trim();
    if (invest && !hasTag(item, invest)) return false;

    var location = String(criteria.location || '').trim();
    if (location && !hasTag(item, location)) return false;

    var commitment = String(criteria.commitment || '').trim();
    if (commitment && !hasTag(item, commitment)) return false;

    var category = String(criteria.category || '').trim();
    if (category && item.category !== category) return false;

    var q = String(criteria.q || '')
      .trim()
      .toLowerCase();
    if (q && String(item.searchText || '').indexOf(q) === -1) return false;

    if (criteria.minInvest != null && criteria.minInvest !== '') {
      var min = Number(criteria.minInvest);
      if (!isNaN(min) && (item.investAmount == null || item.investAmount < min)) return false;
    }
    if (criteria.maxInvest != null && criteria.maxInvest !== '') {
      var max = Number(criteria.maxInvest);
      if (!isNaN(max) && (item.investAmount == null || item.investAmount > max)) return false;
    }
    return true;
  }

  function criteriaLabel(criteria) {
    var parts = [];
    if (criteria.type && criteria.type !== 'all') parts.push(criteria.type.replace(/-/g, ' '));
    if (criteria.invest) {
      var investLabels = {
        'low-invest': 'under £2.5k',
        'mid-invest': '£2.5k–£10k',
        'high-invest': '£10k+',
      };
      parts.push(investLabels[criteria.invest] || criteria.invest);
    }
    if (criteria.location) parts.push(criteria.location.replace(/-/g, ' '));
    if (criteria.q) parts.push('“' + criteria.q + '”');
    return parts.length ? parts.join(', ') : 'All opportunities';
  }

  function listingCompleteness(input) {
    var checks = [
      { key: 'title', label: 'Title', weight: 12, ok: Boolean(input.title) },
      { key: 'types', label: 'Opportunity type', weight: 10, ok: (input.types || []).length > 0 },
      { key: 'desc', label: 'Short description', weight: 12, ok: Boolean(input.desc) },
      { key: 'about', label: 'Full description', weight: 10, ok: Boolean(input.about) },
      { key: 'host', label: 'Company name', weight: 10, ok: Boolean(input.host) },
      { key: 'email', label: 'Contact email', weight: 8, ok: Boolean(input.email) },
      { key: 'investment', label: 'Investment amount', weight: 12, ok: Boolean(input.investment) },
      { key: 'location', label: 'Territory / location', weight: 10, ok: Boolean(input.location) },
      { key: 'commitment', label: 'Commitment', weight: 8, ok: Boolean(input.commitment) },
      { key: 'logo', label: 'Logo or image', weight: 8, ok: Boolean(input.logoUrl || input.logoFile) },
      { key: 'cover', label: 'Cover photo', weight: 6, ok: Boolean(input.imageUrl || input.imageFile) },
      {
        key: 'breakdown',
        label: 'Cost breakdown',
        weight: 6,
        ok: Boolean(input.investmentIncludes),
        tip: 'Help browsers trust your listing',
      },
      {
        key: 'companies-house',
        label: 'Companies House number',
        weight: 4,
        ok: Boolean(input.companiesHouse),
        tip: 'Optional — shows co. number on your listing',
      },
    ];
    var earned = 0;
    var total = 0;
    var missing = [];
    checks.forEach(function (c) {
      total += c.weight;
      if (c.ok) earned += c.weight;
      else missing.push(c);
    });
    var percent = total ? Math.round((earned / total) * 100) : 0;
    return { percent: percent, checks: checks, missing: missing };
  }

  window.HubOpportunityQuality = {
    COMPANIES_HOUSE_KEY: COMPANIES_HOUSE_KEY,
    metaVal: metaVal,
    normalizeCompaniesHouseNumber: normalizeCompaniesHouseNumber,
    isValidCompaniesHouseNumber: isValidCompaniesHouseNumber,
    trustBadges: trustBadges,
    trustBadgesHtml: trustBadgesHtml,
    similarOpportunities: similarOpportunities,
    matchesSearchCriteria: matchesSearchCriteria,
    criteriaLabel: criteriaLabel,
    listingCompleteness: listingCompleteness,
    hasCostBreakdown: hasCostBreakdown,
    hasTerritoryListed: hasTerritoryListed,
    companiesHouseNumber: companiesHouseNumber,
    companiesHouseUrl: companiesHouseUrl,
    companiesHouseMetaHtml: companiesHouseMetaHtml,
  };
})();
