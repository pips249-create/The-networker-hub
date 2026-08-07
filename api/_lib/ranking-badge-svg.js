/**
 * Dynamic ranking badge SVG for website embeds.
 * Light certificate style — meant to look at home on organiser websites.
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
      label: 'Top 10',
      shortLabel: 'Top 10',
      sealNum: '10',
      metal: '#c9a227',
      metalDeep: '#9a7018',
      metalSoft: '#f3e2a3',
      metalMid: '#e0c35a',
      title: '#8f6a10',
      wash: '#fffbf3',
      washEdge: '#f5ecd4',
      ink: '#1c2040',
      muted: '#5c6478',
      rule: 'rgba(201, 162, 39, 0.4)',
    };
  }
  if (tier === 'top25') {
    return {
      label: 'Top 25',
      shortLabel: 'Top 25',
      sealNum: '25',
      metal: '#5b8fc4',
      metalDeep: '#2f5f8f',
      metalSoft: '#d7e7f7',
      metalMid: '#8eb6e0',
      title: '#2f5f8f',
      wash: '#f7fafd',
      washEdge: '#e2eef8',
      ink: '#1c2040',
      muted: '#5c6478',
      rule: 'rgba(91, 143, 196, 0.4)',
    };
  }
  return {
    label: 'Top 50',
    shortLabel: 'Top 50',
    sealNum: '50',
    metal: '#6a9a66',
    metalDeep: '#3d6a3a',
    metalSoft: '#dcead8',
    metalMid: '#9fc49a',
    title: '#3d6a3a',
    wash: '#f7fbf6',
    washEdge: '#e2eee0',
    ink: '#1c2040',
    muted: '#5c6478',
    rule: 'rgba(106, 154, 102, 0.4)',
  };
}

const BADGE_WIDTH = 400;
const BADGE_HEIGHT = 136;
const SHADOW_PAD = 10;
const LAYOUT_WIDTH = BADGE_WIDTH + SHADOW_PAD * 2;
const LAYOUT_HEIGHT = BADGE_HEIGHT + SHADOW_PAD * 2;
/** Approx chars that fit in the copy column at ~12.5px. */
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
  const nameSize = twoLineName || displayName.length > 28 ? 13 : 15;
  const nameLineGap = 17;
  const nameStartY = twoLineName ? 72 : 74;
  const periodY = twoLineName ? 112 : 100;

  const nameTexts = nameLines
    .map(function (line, idx) {
      return (
        `<text x="118" y="${nameStartY + idx * nameLineGap}" fill="${theme.ink}" font-family="Georgia, 'Times New Roman', Times, serif" font-size="${nameSize}" font-weight="700">${escapeXml(line)}</text>`
      );
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT_WIDTH}" height="${LAYOUT_HEIGHT}" viewBox="0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<filter id="shadow-${uid}" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1c2040" flood-opacity="0.14"/>` +
    `</filter>` +
    `<linearGradient id="card-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#ffffff"/>` +
    `<stop offset="55%" stop-color="${theme.wash}"/>` +
    `<stop offset="100%" stop-color="${theme.washEdge}"/>` +
    `</linearGradient>` +
    `<linearGradient id="metal-${uid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${theme.metalSoft}"/>` +
    `<stop offset="42%" stop-color="${theme.metalMid}"/>` +
    `<stop offset="100%" stop-color="${theme.metalDeep}"/>` +
    `</linearGradient>` +
    `<linearGradient id="seal-${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#1c2040"/>` +
    `<stop offset="100%" stop-color="#2a3358"/>` +
    `</linearGradient>` +
    `<linearGradient id="shine-${uid}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>` +
    `<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<g transform="translate(${SHADOW_PAD},${SHADOW_PAD})" filter="url(#shadow-${uid})">` +
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="20" fill="url(#card-${uid})"/>` +
    `<rect x="0.75" y="0.75" width="${BADGE_WIDTH - 1.5}" height="${BADGE_HEIGHT - 1.5}" rx="19.25" fill="none" stroke="${theme.metal}" stroke-opacity="0.45" stroke-width="1.5"/>` +
    `<path d="M20 18 H28 Q34 18 34 24 V${BADGE_HEIGHT - 24} Q34 ${BADGE_HEIGHT - 18} 28 ${BADGE_HEIGHT - 18} H20 Q14 ${BADGE_HEIGHT - 18} 14 ${BADGE_HEIGHT - 24} V24 Q14 18 20 18 Z" fill="url(#metal-${uid})"/>` +
    `<circle cx="72" cy="68" r="36" fill="url(#metal-${uid})"/>` +
    `<circle cx="72" cy="68" r="30" fill="url(#seal-${uid})"/>` +
    `<circle cx="72" cy="68" r="30" fill="url(#shine-${uid})"/>` +
    `<circle cx="72" cy="68" r="24.5" fill="none" stroke="${theme.metalSoft}" stroke-opacity="0.55" stroke-width="1"/>` +
    `<text x="72" y="60" text-anchor="middle" fill="${theme.metalSoft}" font-family="Georgia, 'Times New Roman', Times, serif" font-size="13">★</text>` +
    `<text x="72" y="82" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="0.02em">${escapeXml(theme.sealNum)}</text>` +
    `<text x="118" y="34" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="0.14em">THE NETWORKER HUB</text>` +
    `<text x="118" y="56" fill="${theme.title}" font-family="Georgia, 'Times New Roman', Times, serif" font-size="22" font-weight="700">${escapeXml(theme.label)}</text>` +
    `<line x1="118" y1="62" x2="248" y2="62" stroke="${theme.rule}" stroke-width="1"/>` +
    nameTexts +
    `<rect x="118" y="${periodY - 12}" width="118" height="22" rx="11" fill="#ffffff" stroke="${theme.rule}" stroke-width="1"/>` +
    `<text x="177" y="${periodY + 3}" text-anchor="middle" fill="${theme.ink}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="600">${escapeXml(periodLine)}</text>` +
    `<text x="${BADGE_WIDTH - 20}" y="${BADGE_HEIGHT - 18}" text-anchor="end" fill="${theme.muted}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600">Verified · thenetworkerhub.com</text>` +
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
      ? 'Award period ended'
      : reason === 'missing_organiser'
        ? 'Unverified badge'
        : 'Not a verified award';
  const detail = period
    ? `${period} · Check current rankings`
    : 'See verified awards on The Networker Hub';
  const title = `${headline} — The Networker Hub`;
  const uid = 'unearned-' + String(period || reason).replace(/[^a-z0-9]+/gi, '').slice(0, 12);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LAYOUT_WIDTH}" height="${LAYOUT_HEIGHT}" viewBox="0 0 ${LAYOUT_WIDTH} ${LAYOUT_HEIGHT}" role="img" aria-label="${escapeXml(title)}">` +
    `<title>${escapeXml(title)}</title>` +
    `<defs>` +
    `<filter id="shadow-${uid}" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#1c2040" flood-opacity="0.1"/>` +
    `</filter>` +
    `</defs>` +
    `<g transform="translate(${SHADOW_PAD},${SHADOW_PAD})" filter="url(#shadow-${uid})">` +
    `<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="20" fill="#f4f5f7"/>` +
    `<rect x="0.75" y="0.75" width="${BADGE_WIDTH - 1.5}" height="${BADGE_HEIGHT - 1.5}" rx="19.25" fill="none" stroke="#c5cad3" stroke-width="1.5"/>` +
    `<path d="M20 18 H28 Q34 18 34 24 V${BADGE_HEIGHT - 24} Q34 ${BADGE_HEIGHT - 18} 28 ${BADGE_HEIGHT - 18} H20 Q14 ${BADGE_HEIGHT - 18} 14 ${BADGE_HEIGHT - 24} V24 Q14 18 20 18 Z" fill="#c5cad3"/>` +
    `<circle cx="72" cy="68" r="32" fill="#dfe3ea"/>` +
    `<circle cx="72" cy="68" r="26" fill="#eef0f4"/>` +
    `<text x="72" y="74" text-anchor="middle" fill="#8b93a7" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">—</text>` +
    `<text x="118" y="40" fill="#8b93a7" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="0.14em">THE NETWORKER HUB</text>` +
    `<text x="118" y="70" fill="#3a4254" font-family="Georgia, 'Times New Roman', Times, serif" font-size="20" font-weight="700">${escapeXml(headline)}</text>` +
    `<text x="118" y="96" fill="#6b7385" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600">${escapeXml(detail)}</text>` +
    `<text x="${BADGE_WIDTH - 20}" y="${BADGE_HEIGHT - 18}" text-anchor="end" fill="#8b93a7" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600">thenetworkerhub.com/rankings</text>` +
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
  // Bust caches when certificate design changes
  params.set('v', '6');
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
