/**
 * Build partner kit PNG exports + one-pager PDF rate card.
 * Run: node scripts/build-partner-kit-assets.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const GUIDES = path.join(ASSETS, 'guides');

const SVG_TO_PNG = [
  { svg: 'partner-promo-opp-listing-square.svg', png: 'partner-promo-opp-listing-square.png', width: 1080 },
  { svg: 'partner-promo-opp-listing-landscape.svg', png: 'partner-promo-opp-listing-landscape.png', width: 1200 },
  { svg: 'partner-promo-sponsor-square.svg', png: 'partner-promo-sponsor-square.png', width: 1080 },
  { svg: 'partner-promo-opp-listing-story.svg', png: 'partner-promo-opp-listing-story.png', width: 1080 },
  { svg: 'partner-promo-sponsor-story.svg', png: 'partner-promo-sponsor-story.png', width: 1080 },
  // lockup PNG is hand-authored — do not regenerate from SVG
  { svg: 'logo-networker-uk-partner-light.svg', png: 'logo-networker-uk-partner-light.png', width: 1280 },
  { svg: 'logo-networker-uk-partner-dark.svg', png: 'logo-networker-uk-partner-dark.png', width: 1280 },
];

async function exportPngs() {
  for (const item of SVG_TO_PNG) {
    const input = path.join(ASSETS, item.svg);
    const output = path.join(ASSETS, item.png);
    if (!fs.existsSync(input)) {
      console.warn('skip missing', item.svg);
      continue;
    }
    await sharp(input, { density: 144 })
      .resize({ width: item.width, withoutEnlargement: false })
      .png()
      .toFile(output);
    console.log('png', item.png);
  }
}

function drawRateCardPdf() {
  if (!fs.existsSync(GUIDES)) fs.mkdirSync(GUIDES, { recursive: true });
  const outPath = path.join(GUIDES, 'partner-rate-card.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: {
      Title: 'The Networker UK — Partner programme rate card',
      Author: 'The Networker Group Ltd',
    },
  });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const navy = '#1c2040';
  const muted = '#635c5e';
  const lavender = '#b992be';

  const logoPath = path.join(ASSETS, 'logo-networker-uk-transparent.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 48, 40, { width: 160 });
  }

  doc
    .fillColor(lavender)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('REFERRAL PARTNER PROGRAMME', 48, 120);

  doc
    .fillColor(navy)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('Rate card & commission guide', 48, 140);

  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(11)
    .text(
      'Earn 20% (ex-VAT) when you introduce opportunity listings and sponsorship. Commission pays on the first three successful months (or once on a prepaid invoice). Paid monthly after a 14-day hold. Minimum payout £25.',
      48,
      175,
      { width: 500, lineGap: 3 }
    );

  const rows = [
    ['Product', 'Guide price (ex-VAT)', 'Your 20%'],
    ['Opportunity listing', '£25 / month', '£5 × first 3 months'],
    ['Featured Opportunity Boost', '£55 one-time', '£11 once'],
    ['City Partner', 'from £29 / city / month', '20% × first 3 / prepaid once'],
    ['County / Industry Partner', 'from £49 / month (launch)', '20% × first 3'],
    ['Events Headline Sponsor', '£2,000 / month', '£400 × first 3'],
    ['Events Mini Sponsor', '£600 / slot / month', '£120 × first 3'],
    ['Organisers Headline', '£1,000 / month', '£200 × first 3'],
    ['Organisers Mini', '£300 / slot / month', '£60 × first 3'],
    ['Opportunities Headline', '£2,000 / month', '£400 × first 3'],
    ['Opportunities Mini', '£600 / slot / month', '£120 × first 3'],
  ];

  let y = 250;
  const col1 = 48;
  const col2 = 250;
  const col3 = 420;
  rows.forEach(function (row, i) {
    const isHead = i === 0;
    doc
      .fillColor(isHead ? navy : muted)
      .font(isHead ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isHead ? 9 : 9.5);
    doc.text(row[0], col1, y, { width: 190 });
    doc.text(row[1], col2, y, { width: 160 });
    doc.text(row[2], col3, y, { width: 130 });
    y += isHead ? 22 : 20;
    if (isHead) {
      doc
        .moveTo(48, y - 6)
        .lineTo(547, y - 6)
        .strokeColor('#d8d0d4')
        .stroke();
    }
  });

  y += 16;
  doc
    .fillColor(navy)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('How tracking works', 48, y);
  y += 20;
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(10)
    .text(
      'Share your unique links (advertising + list an opportunity). A 30-day cookie attributes the sale. Self-serve Stripe checkouts record commission automatically. Offline sponsor deals can be attributed manually by the partnerships team.',
      48,
      y,
      { width: 500, lineGap: 2 }
    );

  y += 70;
  doc
    .fillColor(navy)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Media kit', 48, y);
  y += 18;
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(10)
    .text('Partner hub (earnings + creatives): thenetworkeruk.com/partners/earnings', 48, y);

  y += 36;
  doc
    .fillColor(navy)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('Contact', 48, y);
  y += 18;
  doc
    .fillColor(muted)
    .font('Helvetica')
    .fontSize(10)
    .text('partnerships@thenetworkeruk.com', 48, y);
  y += 16;
  doc.text('Guide rates only — confirm live pricing at thenetworkeruk.com/advertising', 48, y);

  doc
    .fillColor('#9a9294')
    .fontSize(8)
    .text(
      'The Networker Group Ltd · thenetworkeruk.com · Prices ex-VAT. Listings subject to review and advertising policies.',
      48,
      780,
      { width: 500 }
    );

  doc.end();
  return new Promise(function (resolve, reject) {
    stream.on('finish', function () {
      console.log('pdf partner-rate-card.pdf');
      resolve(outPath);
    });
    stream.on('error', reject);
  });
}

async function main() {
  await exportPngs();
  await drawRateCardPdf();
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
