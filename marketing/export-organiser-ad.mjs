/**
 * Export organiser LinkedIn ad as MP4.
 * Usage: node export-organiser-ad.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 1080;
const htmlPath = path.join(__dirname, 'linkedin-ad-organisers.html');
const outDir = path.join(__dirname, 'exports');
const outName = 'organiser-why-switch.mp4';
const outPath = path.join(outDir, outName);

fs.mkdirSync(outDir, { recursive: true });

const url = pathToFileURL(htmlPath).href + '?export=1';
console.log('Opening', url);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: size, height: size } },
});

const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.addStyleTag({
  content: `
    html, body {
      margin: 0 !important; padding: 0 !important;
      width: ${size}px !important; height: ${size}px !important;
      overflow: hidden !important; display: block !important; background: #000 !important;
    }
    #canvas {
      position: fixed !important; inset: 0 !important;
      width: ${size}px !important; height: ${size}px !important;
    }
    .rec-hint { display: none !important; }
  `,
});

await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const durationMs = await page.evaluate(() => window.__adDurationMs || 20000);
await page.keyboard.press('Space');
await page.waitForTimeout(durationMs + 1500);

await page.close();
await context.close();
await browser.close();

const files = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => ({ f, t: fs.statSync(path.join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

if (!files.length) {
  console.error('No video recorded');
  process.exit(1);
}

const webmFinal = path.join(outDir, outName.replace('.mp4', '.webm'));
fs.renameSync(path.join(outDir, files[0].f), webmFinal);
console.log('Recorded:', webmFinal);

function findFfmpeg() {
  const sys = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (sys.status === 0) return 'ffmpeg';
  const py = spawnSync(
    'python3',
    ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
    { encoding: 'utf8' }
  );
  if (py.status === 0 && py.stdout.trim()) return py.stdout.trim();
  return null;
}

const ffmpegBin = findFfmpeg();
if (!ffmpegBin) {
  console.log('No ffmpeg — kept WebM:', webmFinal);
  process.exit(0);
}

const rawMp4 = path.join(outDir, 'organiser-raw.mp4');
let result = spawnSync(
  ffmpegBin,
  ['-y', '-i', webmFinal, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', rawMp4],
  { encoding: 'utf8' }
);
if (result.status !== 0) {
  console.error(result.stderr?.slice(-600));
  process.exit(1);
}

// Trim blank lead-in from page load; keep full benefits + founding CTA
result = spawnSync(
  ffmpegBin,
  [
    '-y', '-ss', '1.2', '-i', rawMp4, '-t', '18',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', outPath,
  ],
  { encoding: 'utf8' }
);
if (result.status !== 0) {
  console.error(result.stderr?.slice(-600));
  process.exit(1);
}

try { fs.unlinkSync(rawMp4); } catch (_) {}

const downloads = path.join(
  process.env.HOME || '',
  'Downloads',
  'Networker UK - Why Switch Organiser Ad.mp4'
);
fs.copyFileSync(outPath, downloads);
console.log('Exported MP4:', outPath);
console.log('Copied to:', downloads);
