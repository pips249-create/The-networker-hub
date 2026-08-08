/**
 * Export rebuild story LinkedIn ad as MP4 + GIF (1080×1080, ~12s).
 * Usage: node export-rebuild-ad.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const durationSec = 12;
const size = 1080;

const htmlPath = path.join(__dirname, 'linkedin-ad-rebuild.html');
const outDir = path.join(__dirname, 'exports');
const outName = `rebuild-story-${durationSec}s.mp4`;
const outPath = path.join(outDir, outName);
const gifPath = path.join(outDir, `rebuild-story-${durationSec}s.gif`);

fs.mkdirSync(outDir, { recursive: true });

const url = pathToFileURL(htmlPath).href + `?export=1`;

console.log('Opening', url);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: outDir,
    size: { width: size, height: size },
  },
});

const page = await context.newPage();

await page.goto(url, { waitUntil: 'networkidle' });

await page.addStyleTag({
  content: `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${size}px !important;
      height: ${size}px !important;
      overflow: hidden !important;
      display: block !important;
      background: #000 !important;
    }
    #canvas {
      position: fixed !important;
      inset: 0 !important;
      width: ${size}px !important;
      height: ${size}px !important;
      transform: none !important;
    }
    .rec-hint { display: none !important; }
  `,
});

await page.evaluate(() => document.fonts.ready);
// Animation auto-starts in export mode — no Space press / blank lead-in
await page.waitForTimeout(durationSec * 1000 + 600);

await page.close();
await context.close();
await browser.close();

const files = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => ({ f, t: fs.statSync(path.join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);

if (!files.length) {
  console.error('No video was recorded.');
  process.exit(1);
}

const webmPath = path.join(outDir, files[0].f);
const webmFinal = path.join(outDir, outName.replace('.mp4', '.webm'));
fs.renameSync(webmPath, webmFinal);
console.log('Recorded:', webmFinal);

function findFfmpeg() {
  const sys = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (sys.status === 0) return 'ffmpeg';
  try {
    const require = createRequire(import.meta.url);
    void require;
    const py = spawnSync(
      'python3',
      ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8' }
    );
    if (py.status === 0 && py.stdout.trim()) return py.stdout.trim();
  } catch (_) {}
  return null;
}

const ffmpegBin = findFfmpeg();
if (!ffmpegBin) {
  console.log('No ffmpeg — WebM saved at:', webmFinal);
  process.exit(0);
}

const mp4 = spawnSync(
  ffmpegBin,
  [
    '-y',
    '-i',
    webmFinal,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    outPath,
  ],
  { encoding: 'utf8' }
);

if (mp4.status === 0) {
  console.log('Exported MP4:', outPath);
} else {
  console.error(mp4.stderr?.slice(-800) || mp4.stdout);
  console.log('Kept WebM (MP4 convert failed):', webmFinal);
}

// LinkedIn-friendly GIF: palette + ~12fps, scaled to 720 for size
const gif = spawnSync(
  ffmpegBin,
  [
    '-y',
    '-i',
    webmFinal,
    '-vf',
    'fps=12,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
    '-loop',
    '0',
    gifPath,
  ],
  { encoding: 'utf8' }
);

if (gif.status === 0) {
  console.log('Exported GIF:', gifPath);
} else {
  console.error(gif.stderr?.slice(-800) || gif.stdout);
  console.log('GIF convert failed — use the MP4 on LinkedIn instead.');
}
