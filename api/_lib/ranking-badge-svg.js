/**
 * Dynamic ranking badge SVG for website embeds.
 * Award-style plaque — designed to look good on organiser websites.
 * GET /api/ranking-badge?tier=top10&period=July%202026
 */
function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeTier(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (t === 'top10' || t === '10') return 'top10';
  if (t === 'top25' || t === '25') return 'top25';
  if (t === 'top50' || t === '50') return 'top50';
  return 'top50';
}

function tierTheme(tier) {
  if (tier === 'top10') {
    return {
      label: 'TOP 10',
      shortLabel: 'Top 10',
      metal: '#e8c56a',
      metalDeep: '#9a7420',
      metalSoft: '#f7e7b0',
      panel: '#14182c',
      panelEdge: '#2a3150',
      ink: '#f8f4e8',
      muted: 'rgba(248,244,232,0.72)',
      ribbon: '#c9a84c',
    };
  }
  if (tier === 'top25') {
    return {
      label: 'TOP 25',
      shortLabel: 'Top 25',
      metal: '#8eb6e0',
      metalDeep: '#3d6fa0',
      metalSoft: '#d4e6f7',
      panel: '#121c2c',
      panelEdge: '#243550',
      ink: '#f2f7fc',
      muted: 'rgba(242,247,252,0.72)',
      ribbon: '#5b8fc4',
    };
  }
  return {
    label: 'TOP 50',
    shortLabel: 'Top 50',
    metal: '#9fc49a',
    metalDeep: '#4a7048',
    metalSoft: '#d8ead4',
    panel: '#121f1a',
    panelEdge: '#264034',
    ink: '#f2f8f1',
    muted: 'rgba(242,248,241,0.72)',
    ribbon: '#6a9a66',
  };
}

function buildRankingBadgeSvg(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const tier = normalizeTier(opts.tier);
  const theme = tierTheme(tier);
  const period = String(opts.period || opts.periodLabel || '')
    .trim()
    .slice(0, 40);
  const periodLine = period || 'This month';
  const title = `${theme.shortLabel} networking group on The Networker Hub · ${periodLine}`;
  const uid = tier + '-' + String(periodLine).replace(/[^a-z0-9]+/gi, '').slice(0, 12);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="120" viewBox="0 0 340 120" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${theme.panel}"/>` +
    `<stop offset="55%" stop-color="#0c1020"/>` +
    `<stop offset="100%" stop-color="${theme.panelEdge}"/>` +
    `</linearGradient>` +
    `<linearGradient id="metal-${uid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${theme.metalSoft}"/>` +
    `<stop offset="45%" stop-color="${theme.metal}"/>` +
    `<stop offset="100%" stop-color="${theme.metalDeep}"/>` +
    `</linearGradient>` +
    `<linearGradient id="sheen-${uid}" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="45%" stop-color="#ffffff" stop-opacity="0.14"/>` +
    `<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    // Outer plaque
    `<rect width="340" height="120" rx="18" fill="url(#bg-${uid})"/>` +
    `<rect x="2.5" y="2.5" width="335" height="115" rx="16" fill="none" stroke="url(#metal-${uid})" stroke-width="2.5"/>` +
    `<rect x="8" y="8" width="324" height="104" rx="13" fill="none" stroke="${theme.metal}" stroke-opacity="0.28" stroke-width="1"/>` +
    // Left seal / medal
    `<circle cx="58" cy="60" r="34" fill="url(#metal-${uid})"/>` +
    `<circle cx="58" cy="60" r="28" fill="${theme.panel}" stroke="${theme.metalSoft}" stroke-width="1.5"/>` +
    `<circle cx="58" cy="60" r="22" fill="none" stroke="${theme.metal}" stroke-opacity="0.55" stroke-width="1"/>` +
    `<text x="58" y="54" text-anchor="middle" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="700">★</text>` +
    `<text x="58" y="74" text-anchor="middle" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="800" letter-spacing="0.04em">${escapeXml(theme.label.replace('TOP ', ''))}</text>` +
    // Copy block
    `<text x="108" y="36" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="0.16em">THE NETWORKER HUB</text>` +
    `<text x="108" y="62" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700">${escapeXml(theme.label)}</text>` +
    `<text x="108" y="84" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="0.04em">NETWORKING GROUP</text>` +
    `<text x="108" y="102" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600">${escapeXml(periodLine)} · Attendee rated</text>` +
    // Soft sheen
    `<rect x="10" y="10" width="320" height="40" rx="12" fill="url(#sheen-${uid})"/>` +
    `</svg>`
  );
}

function rankingBadgeImageUrl(origin, tier, periodLabel) {
  const base = String(origin || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('tier', normalizeTier(tier));
  if (periodLabel) params.set('period', String(periodLabel).trim());
  // Bust caches when the plaque design changes
  params.set('v', '2');
  return base + '/api/ranking-badge?' + params.toString();
}

function rankingBadgeEmbedHtml(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const origin = String(opts.origin || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const profileUrl = String(opts.profileUrl || origin + '/rankings').trim();
  const rankingsUrl = String(opts.rankingsUrl || origin + '/rankings').trim();
  const groupName = String(opts.groupName || 'Our group').trim();
  const tier = normalizeTier(opts.tier);
  const periodLabel = String(opts.periodLabel || opts.period || '').trim();
  const theme = tierTheme(tier);
  const alt = `${groupName} — ${theme.shortLabel} networking group on The Networker Hub${periodLabel ? ' · ' + periodLabel : ''}`;
  const imgSrc = rankingBadgeImageUrl(origin, tier, periodLabel);

  return (
    '<a href="' +
    profileUrl.replace(/"/g, '&quot;') +
    '" target="_blank" rel="noopener noreferrer" title="' +
    alt.replace(/"/g, '&quot;') +
    '">' +
    '<img src="' +
    imgSrc.replace(/"/g, '&quot;') +
    '" alt="' +
    alt.replace(/"/g, '&quot;') +
    '" width="340" height="120" style="border:0;display:inline-block;max-width:100%;height:auto;" />' +
    '</a>' +
    '<br />' +
    '<a href="' +
    rankingsUrl.replace(/"/g, '&quot;') +
    '" target="_blank" rel="noopener noreferrer" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;text-decoration:underline;">' +
    'See this month’s top groups on The Networker Hub' +
    '</a>'
  );
}

module.exports = {
  escapeXml,
  normalizeTier,
  tierTheme,
  buildRankingBadgeSvg,
  rankingBadgeImageUrl,
  rankingBadgeEmbedHtml,
};
