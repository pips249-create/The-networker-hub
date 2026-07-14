#!/usr/bin/env node
/**
 * Build organiser-first LinkedIn cover PNGs (1584×396).
 * Large copy is about the organiser; Hub logo is a small corner trust mark.
 * Usage: node scripts/build-linkedin-covers.js
 */
const fs = require('fs');
const path = require('path');

let Resvg;
try {
  Resvg = require('@resvg/resvg-js').Resvg;
} catch {
  console.error('Install @resvg/resvg-js first: npm install --no-save @resvg/resvg-js');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets/social');
const logoPath = path.join(root, 'assets/logo-nav-transparent.png');
const logoHref =
  'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');

/**
 * Organiser-first: THEIR message is the hero.
 * Hub appears only as a small bottom-right credit.
 */
const ORGANISER_FIRST = [
  {
    file: 'linkedin-cover-events',
    aria: 'Join our next networking event',
    kicker: 'NETWORKING EVENT',
    line1: 'Join our next',
    line2: 'networking event',
    line3: 'Meet founders, operators, and local connectors',
    accent: '#9a7aa8',
  },
  {
    file: 'linkedin-cover-meet',
    aria: 'Let us connect in person',
    kicker: 'LET US MEET',
    line1: 'Let us connect',
    line2: 'in the room',
    line3: 'Business networking that leads to real introductions',
    accent: '#4a4446',
  },
  {
    file: 'linkedin-cover-guest',
    aria: 'Guest visits welcome',
    kicker: 'GUEST VISITS',
    line1: 'Guest visits welcome',
    line2: 'try before you join',
    line3: 'A complimentary first visit - then come back as a member',
    accent: '#c299d1',
  },
  {
    file: 'linkedin-cover-book',
    aria: 'Tickets open for our next event',
    kicker: 'TICKETS OPEN',
    line1: 'Tickets are open',
    line2: 'for our next event',
    line3: 'Secure your seat and bring a guest if you like',
    accent: '#b8956a',
  },
  {
    file: 'linkedin-cover-opportunity',
    aria: 'Business opportunity available',
    kicker: 'BUSINESS OPPORTUNITY',
    line1: 'A business opportunity',
    line2: 'worth a conversation',
    line3: 'Franchise, partnership, or side-hustle - enquire to learn more',
    accent: '#b8956a',
  },
  {
    file: 'linkedin-cover-partnership',
    aria: 'Looking for the right partners',
    kicker: 'PARTNERSHIP',
    line1: 'Looking for the',
    line2: 'right partners',
    line3: 'Serious enquiries welcome from aligned founders and operators',
    accent: '#c299d1',
  },
  {
    file: 'linkedin-cover-franchise',
    aria: 'Franchise opportunity',
    kicker: 'FRANCHISE',
    line1: 'Franchise opportunity',
    line2: 'now open to enquire',
    line3: 'Explore territory, investment, and next steps',
    accent: '#9a7aa8',
  },
  {
    file: 'linkedin-cover-enquire',
    aria: 'Enquire to learn more',
    kicker: 'ENQUIRE',
    line1: 'Curious?',
    line2: 'Enquire to learn more',
    line3: 'Send a short note - we will share the details that matter',
    accent: '#4a4446',
  },
];

/** Soft Hub badges — Hub is intentional here, still kept modest. */
const HUB_BADGES = [
  {
    file: 'linkedin-cover-verified',
    aria: 'Verified organiser on The Networker Hub',
    kicker: 'TRUST MARK',
    line1: 'Verified organiser',
    line2: 'on The Networker Hub',
    line3: 'A small credibility badge for your LinkedIn profile',
    accent: '#c299d1',
    hubEmphasis: true,
  },
  {
    file: 'linkedin-cover-members',
    aria: 'Listed on The Networker Hub',
    kicker: 'DIRECTORY',
    line1: 'Listed on',
    line2: 'The Networker Hub',
    line3: 'UK networking events and business opportunities',
    accent: '#9a7aa8',
    hubEmphasis: true,
  },
];

const COVERS = ORGANISER_FIRST.concat(HUB_BADGES);

function commonBg(accent) {
  return `  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf6ee"/>
      <stop offset="55%" stop-color="#f5f0e8"/>
      <stop offset="100%" stop-color="#ebe0f0"/>
    </linearGradient>
  </defs>
  <rect width="1584" height="396" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="396" fill="${accent}"/>
  <circle cx="1520" cy="40" r="180" fill="#c299d1" opacity="0.1"/>
  <circle cx="1460" cy="380" r="140" fill="#9a7aa8" opacity="0.08"/>`;
}

/** Small Hub mark + credit — corner trust signal, not the hero. */
function hubCredit(logoSrc, opts) {
  const emphasis = opts && opts.hubEmphasis;
  const logoW = emphasis ? 168 : 132;
  const logoH = emphasis ? 45 : 36;
  const x = 1584 - logoW - 36;
  const y = 396 - logoH - 28;
  const label = emphasis ? 'The Networker Hub' : 'on The Networker Hub';
  return `
  <image href="${logoSrc}" xlink:href="${logoSrc}" x="${x}" y="${y - 18}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" opacity="0.92"/>
  <text x="${x + logoW / 2}" y="${y + logoH + 6}" text-anchor="middle" fill="#5c5557" font-family="Arial, Helvetica, sans-serif" font-size="11">${label}</text>`;
}

function organiserBody(c) {
  // Copy starts mid-banner so LinkedIn avatar (left) never covers it
  return `  <g transform="translate(520, 108)">
    <text x="0" y="0" fill="#9a7aa8" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" letter-spacing="2.4">${c.kicker}</text>
    <text x="0" y="58" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="46">${c.line1}</text>
    <text x="0" y="116" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="46">${c.line2}</text>
    <text x="0" y="168" fill="#5c5557" font-family="Arial, Helvetica, sans-serif" font-size="20">${c.line3}</text>
  </g>`;
}

function bannerSvg(c, logoSrc) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1584" height="396" viewBox="0 0 1584 396" role="img" aria-label="${c.aria}">
${commonBg(c.accent)}
${organiserBody(c)}
${hubCredit(logoSrc, { hubEmphasis: Boolean(c.hubEmphasis) })}
</svg>`;
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const keep = new Set(COVERS.map((c) => c.file));
for (const name of fs.readdirSync(outDir)) {
  if (!name.startsWith('linkedin-cover-')) continue;
  const base = name.replace(/\.(png|svg)$/, '');
  if (!keep.has(base)) {
    fs.unlinkSync(path.join(outDir, name));
    console.log('removed', name);
  }
}

for (const c of COVERS) {
  const pngSvg = bannerSvg(c, logoHref);
  const leanSvg = bannerSvg(c, '../logo-nav-transparent.png');
  const resvg = new Resvg(pngSvg, { fitTo: { mode: 'width', value: 1584 } });
  fs.writeFileSync(path.join(outDir, c.file + '.png'), resvg.render().asPng());
  fs.writeFileSync(path.join(outDir, c.file + '.svg'), leanSvg);
  console.log('built', c.file, c.hubEmphasis ? '(hub badge)' : '(organiser-first)');
}

console.log('Done:', COVERS.length, 'covers →', outDir);
