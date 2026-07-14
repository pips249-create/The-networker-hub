#!/usr/bin/env node
/**
 * Build evergreen LinkedIn cover PNGs (1584×396) with the official Hub logo.
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

const COVERS = [
  {
    file: 'linkedin-cover-verified',
    aria: 'We are a verified organiser listing on The Networker Hub',
    kicker: 'VERIFIED ORGANISER',
    line1: 'We are a verified organiser',
    line2: 'listing on The Networker Hub',
    line3: 'Find our events in the UK networking directory',
    accent: '#c299d1',
  },
  {
    file: 'linkedin-cover-events',
    aria: 'Find our next event on The Networker Hub',
    kicker: 'NEXT EVENT',
    line1: 'Find our next event on',
    line2: 'The Networker Hub',
    line3: 'Browse dates, book tickets, and join us',
    accent: '#9a7aa8',
  },
  {
    file: 'linkedin-cover-book',
    aria: 'Book tickets via The Networker Hub',
    kicker: 'SECURE BOOKING',
    line1: 'Book tickets with us via',
    line2: 'The Networker Hub',
    line3: 'Simple checkout - confirmation in your inbox',
    accent: '#b8956a',
  },
  {
    file: 'linkedin-cover-members',
    aria: 'Members find us on The Networker Hub',
    kicker: 'UK DIRECTORY',
    line1: 'Members find our group on',
    line2: 'The Networker Hub',
    line3: 'Networking meetings, exhibitions, and opportunities',
    accent: '#4a4446',
  },
  {
    file: 'linkedin-cover-guest',
    aria: 'Guest visits welcome on The Networker Hub',
    kicker: 'GUEST VISITS',
    line1: 'Guest visits welcome -',
    line2: 'try our room on The Networker Hub',
    line3: 'Book a complimentary trial visit before you join',
    accent: '#c299d1',
  },
  {
    file: 'linkedin-cover-meet',
    aria: 'Meet us at our next networking event on The Networker Hub',
    kicker: 'NETWORK WITH US',
    line1: 'Meet us at our next',
    line2: 'networking event on the Hub',
    line3: 'UK business networking - find dates and tickets online',
    accent: '#9a7aa8',
  },
  {
    file: 'linkedin-cover-opportunity',
    aria: 'Business opportunity listed on The Networker Hub',
    kicker: 'BUSINESS OPPORTUNITY',
    line1: 'Our business opportunity is',
    line2: 'listed on The Networker Hub',
    line3: 'Franchise, partnership, and side-hustle enquiries welcome',
    accent: '#b8956a',
  },
  {
    file: 'linkedin-cover-enquire',
    aria: 'Enquire about our listing on The Networker Hub',
    kicker: 'ENQUIRE ON THE HUB',
    line1: 'Enquire about our listing',
    line2: 'on The Networker Hub',
    line3: 'Send a direct enquiry - free account, no obligation',
    accent: '#4a4446',
  },
  {
    file: 'linkedin-cover-partnership',
    aria: 'Partnership opportunity on The Networker Hub',
    kicker: 'PARTNERSHIP',
    line1: 'Looking for partners?',
    line2: 'Find our opportunity on the Hub',
    line3: 'Business opportunities for UK networkers and founders',
    accent: '#c299d1',
  },
  {
    file: 'linkedin-cover-franchise',
    aria: 'Franchise opportunity on The Networker Hub',
    kicker: 'FRANCHISE',
    line1: 'Franchise opportunity listed',
    line2: 'on The Networker Hub',
    line3: 'Explore investment details and send an enquiry online',
    accent: '#9a7aa8',
  },
];

function bannerSvg(c) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1584" height="396" viewBox="0 0 1584 396" role="img" aria-label="${c.aria}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf6ee"/>
      <stop offset="48%" stop-color="#f5f0e8"/>
      <stop offset="100%" stop-color="#ebe0f0"/>
    </linearGradient>
  </defs>
  <rect width="1584" height="396" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="396" fill="${c.accent}"/>
  <circle cx="1540" cy="30" r="210" fill="#c299d1" opacity="0.14"/>
  <circle cx="1470" cy="380" r="170" fill="#9a7aa8" opacity="0.1"/>
  <g transform="translate(740, 118)">
    <text x="0" y="0" fill="#9a7aa8" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="2.2">${c.kicker}</text>
    <text x="0" y="52" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="34">${c.line1}</text>
    <text x="0" y="98" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="34">${c.line2}</text>
    <text x="0" y="148" fill="#5c5557" font-family="Arial, Helvetica, sans-serif" font-size="19">${c.line3}</text>
  </g>
  <image href="${logoHref}" xlink:href="${logoHref}" x="1160" y="28" width="360" height="97" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

function leanSvg(c) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1584" height="396" viewBox="0 0 1584 396" role="img" aria-label="${c.aria}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf6ee"/>
      <stop offset="48%" stop-color="#f5f0e8"/>
      <stop offset="100%" stop-color="#ebe0f0"/>
    </linearGradient>
  </defs>
  <rect width="1584" height="396" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="396" fill="${c.accent}"/>
  <circle cx="1540" cy="30" r="210" fill="#c299d1" opacity="0.14"/>
  <circle cx="1470" cy="380" r="170" fill="#9a7aa8" opacity="0.1"/>
  <g transform="translate(740, 118)">
    <text x="0" y="0" fill="#9a7aa8" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="2.2">${c.kicker}</text>
    <text x="0" y="52" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="34">${c.line1}</text>
    <text x="0" y="98" fill="#4a4446" font-family="Georgia, 'Times New Roman', serif" font-size="34">${c.line2}</text>
    <text x="0" y="148" fill="#5c5557" font-family="Arial, Helvetica, sans-serif" font-size="19">${c.line3}</text>
  </g>
  <image href="../logo-nav-transparent.png" xlink:href="../logo-nav-transparent.png" x="1160" y="28" width="360" height="97" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const c of COVERS) {
  const pngSvg = bannerSvg(c);
  const resvg = new Resvg(pngSvg, { fitTo: { mode: 'width', value: 1584 } });
  fs.writeFileSync(path.join(outDir, c.file + '.png'), resvg.render().asPng());
  fs.writeFileSync(path.join(outDir, c.file + '.svg'), leanSvg(c));
  console.log('built', c.file);
}

console.log('Done:', COVERS.length, 'covers in', outDir);
