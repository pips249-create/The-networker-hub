/**
 * Dynamic ranking badge SVG for website embeds.
 * Dark award plaque with tier-tinted interiors — readable on light and dark sites.
 * GET /api/ranking-badge?organiserId=<uuid>&period=August%202026
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
      sealNum: '10',
      metal: '#e8c56a',
      metalDeep: '#9a7420',
      metalSoft: '#f7e7b0',
      metalMid: '#d4b24a',
      // Warm gold wash across the whole card — not only the ring
      panel: '#1a1620',
      panelMid: '#2a2218',
      panelEdge: '#4a3418',
      glow: 'rgba(232, 197, 106, 0.38)',
      ink: '#f8f4e8',
      muted: 'rgba(248, 244, 232, 0.72)',
      name: '#ffffff',
    };
  }
  if (tier === 'top25') {
    return {
      label: 'TOP 25',
      shortLabel: 'Top 25',
      sealNum: '25',
      metal: '#8eb6e0',
      metalDeep: '#3d6fa0',
      metalSoft: '#d4e6f7',
      metalMid: '#6a9cc9',
      panel: '#101820',
      panelMid: '#183048',
      panelEdge: '#244868',
      glow: 'rgba(110, 168, 230, 0.36)',
      ink: '#f2f7fc',
      muted: 'rgba(242, 247, 252, 0.72)',
      name: '#ffffff',
    };
  }
  return {
    label: 'TOP 50',
    shortLabel: 'Top 50',
    sealNum: '50',
    metal: '#9fc49a',
    metalDeep: '#4a7048',
    metalSoft: '#d8ead4',
    metalMid: '#7aaa74',
    panel: '#101816',
    panelMid: '#183828',
    panelEdge: '#245040',
    glow: 'rgba(120, 190, 150, 0.34)',
    ink: '#f2f8f1',
    muted: 'rgba(242, 248, 241, 0.72)',
    name: '#ffffff',
  };
}

const BADGE_WIDTH = 400;
const BADGE_HEIGHT = 132;
const SHADOW_PAD = 10;
const LAYOUT_WIDTH = BADGE_WIDTH + SHADOW_PAD * 2;
const LAYOUT_HEIGHT = BADGE_HEIGHT + SHADOW_PAD * 2;
/** Copy column starts after a smaller seal. */
const TEXT_X = 100;
const NAME_LINE_CHARS = 34;

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

function nameFontSize(lines, displayName) {
  if (lines.length > 1) return 14.5;
  if (displayName.length > 28) return 15;
  if (displayName.length > 20) return 16;
  return 17.5;
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
  const nameSize = nameFontSize(nameLines, displayName);
  const nameLineGap = 17;
  // Hierarchy: brand → tier → group name (hero) → period/verify
  const kickerY = 30;
  const tierY = 52;
  const nameStartY = twoLineName ? 74 : 76;
  const footerY = twoLineName ? 114 : 108;

  const nameTexts = nameLines
    .map(function (line, idx) {
      return (
        `<text x="${TEXT_X}" y="${nameStartY + idx * nameLineGap}" fill="${theme.name}" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize}" font-weight="800">${escapeXml(line)}</text>`
      );
    })
    .join('');

  // Seal ~15% smaller than the previous 34px-radius medal so copy can breathe
  const sealCx = 54;
  const sealCy = 66;
  const sealR = 28;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT_WIDTH}" height="${LAYOUT_HEIGHT}" viewBox="0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<filter id="shadow-${uid}" x="-25%" y="-25%" width="150%" height="150%">` +
    `<feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0a0c14" flood-opacity="0.45"/>` +
    `</filter>` +
    `<radialGradient id="glow-${uid}" cx="18%" cy="42%" r="88%">` +
    `<stop offset="0%" stop-color="${theme.glow}"/>` +
    `<stop offset="42%" stop-color="${theme.panelMid}"/>` +
    `<stop offset="100%" stop-color="${theme.panel}"/>` +
    `</radialGradient>` +
    `<linearGradient id="edge-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${theme.panelEdge}"/>` +
    `<stop offset="100%" stop-color="${theme.panel}"/>` +
    `</linearGradient>` +
    `<linearGradient id="metal-${uid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${theme.metalSoft}"/>` +
    `<stop offset="45%" stop-color="${theme.metalMid}"/>` +
    `<stop offset="100%" stop-color="${theme.metalDeep}"/>` +
    `</linearGradient>` +
    `<linearGradient id="sheen-${uid}" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="40%" stop-color="#ffffff" stop-opacity="0.1"/>` +
    `<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<g transform="translate(${SHADOW_PAD},${SHADOW_PAD})" filter="url(#shadow-${uid})">` +
    // Light outer stroke so the card lifts off dark website backgrounds
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="18" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.25"/>` +
    `<rect x="1.25" y="1.25" width="${BADGE_WIDTH - 2.5}" height="${BADGE_HEIGHT - 2.5}" rx="16.75" fill="url(#glow-${uid})"/>` +
    `<rect x="1.25" y="1.25" width="${BADGE_WIDTH - 2.5}" height="${BADGE_HEIGHT - 2.5}" rx="16.75" fill="url(#edge-${uid})" fill-opacity="0.35"/>` +
    // Metal frame
    `<rect x="3.5" y="3.5" width="${BADGE_WIDTH - 7}" height="${BADGE_HEIGHT - 7}" rx="15" fill="none" stroke="url(#metal-${uid})" stroke-width="2.25"/>` +
    `<rect x="8" y="8" width="${BADGE_WIDTH - 16}" height="${BADGE_HEIGHT - 16}" rx="12" fill="none" stroke="${theme.metal}" stroke-opacity="0.22" stroke-width="1"/>` +
    // Seal (smaller)
    `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR}" fill="url(#metal-${uid})"/>` +
    `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR - 5.5}" fill="${theme.panelMid}"/>` +
    `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR - 5.5}" fill="url(#sheen-${uid})"/>` +
    `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR - 10}" fill="none" stroke="${theme.metalSoft}" stroke-opacity="0.45" stroke-width="1"/>` +
    `<text x="${sealCx}" y="${sealCy - 4}" text-anchor="middle" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="13">★</text>` +
    `<text x="${sealCx}" y="${sealCy + 14}" text-anchor="middle" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" letter-spacing="0.02em">${escapeXml(theme.sealNum)}</text>` +
    // Copy — group name is the prize recipient, so it leads visually after the tier
    `<text x="${TEXT_X}" y="${kickerY}" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" letter-spacing="0.16em">THE NETWORKER HUB</text>` +
    `<text x="${TEXT_X}" y="${tierY}" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="700">${escapeXml(theme.label)}</text>` +
    nameTexts +
    `<text x="${TEXT_X}" y="${footerY}" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="600">${escapeXml(periodLine)} · Verified on thenetworkerhub.com</text>` +
    // Soft top sheen
    `<rect x="10" y="10" width="${BADGE_WIDTH - 20}" height="36" rx="10" fill="url(#sheen-${uid})"/>` +
    `</g>` +
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT_WIDTH}" height="${LAYOUT_HEIGHT}" viewBox="0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<filter id="shadow-${uid}" x="-25%" y="-25%" width="150%" height="150%">` +
    `<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0a0c14" flood-opacity="0.4"/>` +
    `</filter>` +
    `<linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#2a2f3a"/>` +
    `<stop offset="100%" stop-color="#151820"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<g transform="translate(${SHADOW_PAD},${SHADOW_PAD})" filter="url(#shadow-${uid})">` +
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="18" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.25"/>` +
    `<rect x="1.25" y="1.25" width="${BADGE_WIDTH - 2.5}" height="${BADGE_HEIGHT - 2.5}" rx="16.75" fill="url(#bg-${uid})"/>` +
    `<rect x="3.5" y="3.5" width="${BADGE_WIDTH - 7}" height="${BADGE_HEIGHT - 7}" rx="15" fill="none" stroke="#6b7280" stroke-width="2"/>` +
    `<circle cx="54" cy="66" r="24" fill="#3a404c" stroke="#9ca3af" stroke-width="1.5"/>` +
    `<text x="54" y="72" text-anchor="middle" fill="#d1d5db" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">—</text>` +
    `<text x="${TEXT_X}" y="40" fill="rgba(229,231,235,0.7)" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="0.16em">THE NETWORKER HUB</text>` +
    `<text x="${TEXT_X}" y="70" fill="#e5e7eb" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-weight="700">${escapeXml(headline)}</text>` +
    `<text x="${TEXT_X}" y="96" fill="rgba(209,213,219,0.85)" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600">${escapeXml(detail)}</text>` +
    `</g>` +
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
  params.set('v', '7');
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
    LAYOUT_WIDTH +
    '" height="' +
    LAYOUT_HEIGHT +
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
  LAYOUT_WIDTH,
  LAYOUT_HEIGHT,
  buildRankingBadgeSvg,
  buildUnearnedRankingBadgeSvg,
  rankingBadgeImageUrl,
  rankingBadgeEmbedHtml,
};
