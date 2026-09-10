#!/usr/bin/env node
/**
 * Rebuild partner badge SVGs with correct contrast.
 * Lavender "Networker" disappears on lavender/navy — lockup + dark use a cream wordmark.
 * Run: node scripts/rebuild-partner-badges.js && npm run build:partner-kit
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'logo-networker-uk-transparent.png');

async function creamWordmark() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 12) continue;
    const isLavender = r > 140 && b > 140 && g > 100 && Math.abs(r - b) < 50 && r > g;
    const isDark = r < 120 && g < 120 && b < 120;
    if (isLavender || isDark || (r + g + b) / 3 < 200) {
      data[i] = 250;
      data[i + 1] = 246;
      data[i + 2] = 238;
    }
  }
  const outPath = path.join(ASSETS, 'logo-networker-uk-on-dark.png');
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log('wrote', path.basename(outPath));
  return outPath;
}

function dataUriFromFile(filePath) {
  return 'data:image/png;base64,' + fs.readFileSync(filePath).toString('base64');
}

async function main() {
  const onDark = await creamWordmark();
  const uriColor = dataUriFromFile(SRC);
  const uriLight = dataUriFromFile(onDark);

  const lockup = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="360" viewBox="0 0 960 360" role="img" aria-label="The Networker UK Referral Partner">
  <title>The Networker UK Referral Partner</title>
  <rect width="960" height="360" rx="24" fill="#b992be"/>
  <image xlink:href="${uriLight}" x="40" y="72" width="420" height="195" preserveAspectRatio="xMidYMid meet"/>
  <line x1="500" y1="88" x2="500" y2="272" stroke="#1c2040" stroke-opacity="0.28" stroke-width="2"/>
  <text x="540" y="150" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="0.12em" fill="#1c2040">REFERRAL</text>
  <text x="540" y="230" font-family="Georgia, 'Times New Roman', serif" font-size="58" fill="#faf6ee">Partner</text>
</svg>
`;

  const lightBadge = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="The Networker UK Partner">
  <title>The Networker UK Partner</title>
  <rect width="640" height="360" rx="20" fill="#faf6ee"/>
  <rect x="1.5" y="1.5" width="637" height="357" rx="18.5" fill="none" stroke="#1c2040" stroke-opacity="0.1"/>
  <image xlink:href="${uriColor}" x="95" y="48" width="450" height="190" preserveAspectRatio="xMidYMid meet"/>
  <rect x="200" y="278" width="240" height="42" rx="21" fill="#1c2040"/>
  <text x="320" y="306" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="0.2em" fill="#faf6ee">PARTNER</text>
</svg>
`;

  const darkBadge = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="The Networker UK Partner">
  <title>The Networker UK Partner</title>
  <rect width="640" height="360" rx="20" fill="#1c2040"/>
  <rect x="1.5" y="1.5" width="637" height="357" rx="18.5" fill="none" stroke="#e8b84b" stroke-opacity="0.35"/>
  <image xlink:href="${uriLight}" x="95" y="48" width="450" height="190" preserveAspectRatio="xMidYMid meet"/>
  <rect x="200" y="278" width="240" height="42" rx="21" fill="#e8b84b"/>
  <text x="320" y="306" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="0.2em" fill="#1c2040">PARTNER</text>
</svg>
`;

  // lockup PNG/SVG are hand-authored — do not overwrite
  // fs.writeFileSync(path.join(ASSETS, 'logo-networker-uk-partner-lockup.svg'), lockup);
  fs.writeFileSync(path.join(ASSETS, 'logo-networker-uk-partner-light.svg'), lightBadge);
  fs.writeFileSync(path.join(ASSETS, 'logo-networker-uk-partner-dark.svg'), darkBadge);
  console.log('wrote partner badge SVGs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
