#!/usr/bin/env node
/**
 * Rebuild partner badge PNGs + download SVGs from hand-authored sources.
 *
 * Sources (do not auto-generate lockup/dark — replace these files from design):
 *   assets/logo-networker-uk-partner-lockup-source.png
 *   assets/logo-networker-uk-partner-dark-source.png
 *
 * Light badge: prefer assets/logo-networker-uk-partner-light-source.png from design;
 *   otherwise composited from logo-networker-uk-transparent.png on cream.
 * Run: node scripts/rebuild-partner-badges.js && npm run build:partner-kit
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const LOCKUP_SOURCE = path.join(ASSETS, 'logo-networker-uk-partner-lockup-source.png');
const DARK_SOURCE = path.join(ASSETS, 'logo-networker-uk-partner-dark-source.png');
const LIGHT_SOURCE = path.join(ASSETS, 'logo-networker-uk-partner-light-source.png');
const WORDMARK = path.join(ASSETS, 'logo-networker-uk-transparent.png');
const OUT_LIGHT = path.join(ASSETS, 'logo-networker-uk-partner-light.png');

function writeSvgWrapper(pngName, label, outSvgName) {
  const pngPath = path.join(ASSETS, pngName);
  if (!fs.existsSync(pngPath)) return;
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const meta = require('child_process')
    .execSync(
      `python3 -c "from PIL import Image; im=Image.open('${pngPath.replace(/'/g, "'\\''")}'); print(im.size[0], im.size[1])"`
    )
    .toString()
    .trim()
    .split(/\s+/);
  const w = meta[0];
  const h = meta[1];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <title>${label}</title>
  <image xlink:href="data:image/png;base64,${b64}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  fs.writeFileSync(path.join(ASSETS, outSvgName), svg);
}

async function buildLightBadge() {
  if (fs.existsSync(LIGHT_SOURCE)) {
    await sharp(LIGHT_SOURCE)
      .resize(1280, null, { withoutEnlargement: false })
      .png()
      .toFile(OUT_LIGHT);
    console.log('wrote logo-networker-uk-partner-light.png (from light source)');
    return;
  }

  const w = 640;
  const h = 360;
  const logoW = 450;
  const logoBuf = await sharp(WORDMARK).resize(logoW).png().toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const logoLeft = Math.round((w - logoMeta.width) / 2);
  const logoTop = 48;

  const baseSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" rx="20" fill="#faf6ee"/>
    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="18.5" fill="none" stroke="#1c2040" stroke-opacity="0.1"/>
    <rect x="200" y="278" width="240" height="42" rx="21" fill="#1c2040"/>
    <text x="320" y="306" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="0.2em" fill="#faf6ee">PARTNER</text>
  </svg>`);

  const composed = await sharp(baseSvg)
    .composite([{ input: logoBuf, left: logoLeft, top: logoTop }])
    .png()
    .toBuffer();

  await sharp(composed).resize(1280, null, { withoutEnlargement: false }).png().toFile(OUT_LIGHT);

  console.log('wrote logo-networker-uk-partner-light.png (composited — add light source PNG to replace)');
}

async function main() {
  if (!fs.existsSync(LOCKUP_SOURCE)) {
    throw new Error('Missing ' + LOCKUP_SOURCE + ' — add the Referral Partner lockup PNG from design.');
  }
  if (!fs.existsSync(DARK_SOURCE)) {
    throw new Error('Missing ' + DARK_SOURCE + ' — add the Partner badge · dark PNG from design.');
  }

  await sharp(LOCKUP_SOURCE)
    .resize(1920, null, { withoutEnlargement: false })
    .png()
    .toFile(path.join(ASSETS, 'logo-networker-uk-partner-lockup.png'));
  console.log('wrote logo-networker-uk-partner-lockup.png');

  await sharp(DARK_SOURCE)
    .resize(1280, null, { withoutEnlargement: false })
    .png()
    .toFile(path.join(ASSETS, 'logo-networker-uk-partner-dark.png'));
  console.log('wrote logo-networker-uk-partner-dark.png');

  await buildLightBadge();

  writeSvgWrapper(
    'logo-networker-uk-partner-lockup.png',
    'The Networker UK Referral Partner',
    'logo-networker-uk-partner-lockup.svg'
  );
  writeSvgWrapper(
    'logo-networker-uk-partner-dark.png',
    'The Networker UK Partner',
    'logo-networker-uk-partner-dark.svg'
  );
  writeSvgWrapper(
    'logo-networker-uk-partner-light.png',
    'The Networker UK Partner',
    'logo-networker-uk-partner-light.svg'
  );
  console.log('wrote partner badge SVG wrappers');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
