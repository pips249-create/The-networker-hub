/**
 * Dynamic ranking badge SVG for website embeds.
 * Award-style plaque — designed to look good on organiser websites.
 * GET /api/ranking-badge?tier=top10&period=July%202026&name=Harbour%20City%20Connectors
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

const BADGE_WIDTH = 380;
const BADGE_HEIGHT = 128;
/** Approx chars that fit in the copy column at 12px bold. */
const NAME_LINE_CHARS = 32;

function cleanGroupName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wrap a group name onto up to two lines at word boundaries.
 * Only truncates with an ellipsis if it still overflows two lines.
 */
function wrapGroupName(raw, maxCharsPerLine, maxLines) {
  const name = cleanGroupName(raw) || 'Your networking group';
  const perLine = maxCharsPerLine || NAME_LINE_CHARS;
  const linesMax = maxLines || 2;
  if (name.length <= perLine) return [name];

  const words = name.split(' ');
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = current ? current + ' ' + word : word;
    if (next.length <= perLine) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= linesMax - 1) {
      const rest = [word].concat(words.slice(i + 1)).join(' ');
      if (rest.length <= perLine) {
        lines.push(rest);
        current = '';
      } else {
        lines.push(rest.slice(0, Math.max(1, perLine - 1)).trimEnd() + '…');
        current = '';
      }
      break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, linesMax);
}

/** @deprecated Prefer wrapGroupName — kept for callers/tests. */
function truncateGroupName(raw, maxChars) {
  const lines = wrapGroupName(raw, maxChars || NAME_LINE_CHARS, 1);
  return lines[0] || 'Your networking group';
}

function buildRankingBadgeSvg(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const tier = normalizeTier(opts.tier);
  const theme = tierTheme(tier);
  const period = String(opts.period || opts.periodLabel || '')
    .trim()
    .slice(0, 40);
  const periodLine = period || 'This month';
  const fullName = cleanGroupName(opts.name || opts.groupName || opts.organiserName);
  const nameLines = wrapGroupName(fullName, NAME_LINE_CHARS, 2);
  const displayName = nameLines.join(' ');
  const title = `${displayName} — ${theme.shortLabel} on The Networker Hub · ${periodLine}`;
  const uid =
    tier +
    '-' +
    String(periodLine + displayName)
      .replace(/[^a-z0-9]+/gi, '')
      .slice(0, 16)
      .toLowerCase();

  const twoLineName = nameLines.length > 1;
  const nameSize = twoLineName || displayName.length > 26 ? 11.5 : 13;
  const nameLineGap = 14;
  // Vertical rhythm: kicker → tier → name (1–2 lines) → verify footer
  const kickerY = 28;
  const tierY = twoLineName ? 52 : 54;
  const nameStartY = twoLineName ? 72 : 76;
  const footerY = twoLineName ? 112 : 108;

  const nameTexts = nameLines
    .map(function (line, idx) {
      return (
        `<text x="112" y="${nameStartY + idx * nameLineGap}" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize}" font-weight="700">${escapeXml(line)}</text>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
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
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="18" fill="url(#bg-${uid})"/>` +
    `<rect x="2.5" y="2.5" width="${BADGE_WIDTH - 5}" height="${BADGE_HEIGHT - 5}" rx="16" fill="none" stroke="url(#metal-${uid})" stroke-width="2.5"/>` +
    `<rect x="8" y="8" width="${BADGE_WIDTH - 16}" height="${BADGE_HEIGHT - 16}" rx="13" fill="none" stroke="${theme.metal}" stroke-opacity="0.28" stroke-width="1"/>` +
    // Left seal / medal
    `<circle cx="58" cy="64" r="34" fill="url(#metal-${uid})"/>` +
    `<circle cx="58" cy="64" r="28" fill="${theme.panel}" stroke="${theme.metalSoft}" stroke-width="1.5"/>` +
    `<circle cx="58" cy="64" r="22" fill="none" stroke="${theme.metal}" stroke-opacity="0.55" stroke-width="1"/>` +
    `<text x="58" y="58" text-anchor="middle" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="700">★</text>` +
    `<text x="58" y="78" text-anchor="middle" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="800" letter-spacing="0.04em">${escapeXml(theme.label.replace('TOP ', ''))}</text>` +
    // Copy block
    `<text x="112" y="${kickerY}" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" letter-spacing="0.16em">THE NETWORKER HUB</text>` +
    `<text x="112" y="${tierY}" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="700">${escapeXml(theme.label)}</text>` +
    nameTexts +
    `<text x="112" y="${footerY}" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="600">${escapeXml(periodLine)} · Verified on thenetworkhub.com</text>` +
    // Soft sheen
    `<rect x="10" y="10" width="${BADGE_WIDTH - 20}" height="42" rx="12" fill="url(#sheen-${uid})"/>` +
    `</svg>`
  );
}


/** Shown when an embed is missing verification or the group did not earn that month. */
function buildUnearnedRankingBadgeSvg(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const period = String(opts.period || opts.periodLabel || '')
    .trim()
    .slice(0, 40);
  const reason = String(opts.reason || 'unverified').trim().toLowerCase();
  const headline =
    reason === 'expired' || reason === 'outdated'
      ? 'AWARD PERIOD ENDED'
      : reason === 'missing_organiser'
        ? 'UNVERIFIED BADGE'
        : 'NOT A VERIFIED AWARD';
  const detail = period
    ? `${period} · Check current rankings`
    : 'See verified awards on The Networker Hub';
  const title = `${headline} — The Networker Hub`;
  const uid = 'unearned-' + String(period || reason).replace(/[^a-z0-9]+/gi, '').slice(0, 12);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#2a2f3a"/>` +
    `<stop offset="100%" stop-color="#151820"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="18" fill="url(#bg-${uid})"/>` +
    `<rect x="2.5" y="2.5" width="${BADGE_WIDTH - 5}" height="${BADGE_HEIGHT - 5}" rx="16" fill="none" stroke="#6b7280" stroke-width="2"/>` +
    `<circle cx="58" cy="64" r="28" fill="#3a404c" stroke="#9ca3af" stroke-width="1.5"/>` +
    `<text x="58" y="70" text-anchor="middle" fill="#d1d5db" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">—</text>` +
    `<text x="112" y="42" fill="rgba(229,231,235,0.7)" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="0.16em">THE NETWORKER HUB</text>` +
    `<text x="112" y="72" fill="#e5e7eb" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="700">${escapeXml(headline)}</text>` +
    `<text x="112" y="96" fill="rgba(209,213,219,0.85)" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600">${escapeXml(detail)}</text>` +
    `</svg>`
  );
}

function rankingBadgeImageUrl(origin, tier, periodLabel, extras) {
  const base = String(origin || '').replace(/\/$/, '');
  const opts =
    extras && typeof extras === 'object'
      ? extras
      : extras
        ? { organiserId: extras }
        : {};
  const params = new URLSearchParams();
  params.set('tier', normalizeTier(tier));
  if (periodLabel) params.set('period', String(periodLabel).trim());
  const name = String(opts.name || opts.groupName || opts.organiserName || '').trim();
  if (name) params.set('name', name.slice(0, 80));
  if (opts.organiserId) params.set('organiserId', String(opts.organiserId).trim());
  if (opts.demo) params.set('demo', '1');
  // Bust caches when verification / plaque design changes
  params.set('v', '5');
  return base + '/api/ranking-badge?' + params.toString();
}

function rankingBadgeEmbedHtml(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const origin = String(opts.origin || 'https://www.thenetworkerhub.com').replace(/\/$/, '');
  const profileUrl = String(opts.profileUrl || origin + '/rankings').trim();
  const rankingsUrl = String(opts.rankingsUrl || origin + '/rankings').trim();
  const groupName = String(opts.groupName || opts.name || 'Our group').trim();
  const organiserId = opts.organiserId || opts.id || '';
  const tier = normalizeTier(opts.tier);
  const periodLabel = String(opts.periodLabel || opts.period || '').trim();
  const theme = tierTheme(tier);
  const alt = `${groupName} — ${theme.shortLabel} networking group on The Networker Hub${periodLabel ? ' · ' + periodLabel : ''}`;
  const imgSrc = rankingBadgeImageUrl(origin, tier, periodLabel, {
    name: groupName,
    organiserId,
  });

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
    '" width="' +
    BADGE_WIDTH +
    '" height="' +
    BADGE_HEIGHT +
    '" style="border:0;display:inline-block;max-width:100%;height:auto;" />' +
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
  wrapGroupName,
  truncateGroupName,
  BADGE_WIDTH,
  BADGE_HEIGHT,
  buildRankingBadgeSvg,
  buildUnearnedRankingBadgeSvg,
  rankingBadgeImageUrl,
  rankingBadgeEmbedHtml,
};
