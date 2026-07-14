/**
 * Export Find Your Next LinkedIn ad as MP4.
 * Usage: node export-ad-video.mjs [audience] [theme]
 *   audience: attendee|organiser (default attendee)
 *   theme: dark|light (default dark)
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audience = process.argv[2] === 'organiser' ? 'organiser' : 'attendee';
const theme = process.argv[3] === 'light' ? 'light' : 'dark';
const durationSec = 15;
const size = 1080;

const htmlPath = path.join(__dirname, 'linkedin-ad-find-your-next.html');
const outDir = path.join(__dirname, 'exports');
const outName = `find-your-next-${audience}-${theme}-${durationSec}s.mp4`;
const outPath = path.join(outDir, outName);

fs.mkdirSync(outDir, { recursive: true });

const url =
  pathToFileURL(htmlPath).href +
  `?audience=${audience}&theme=${theme}&duration=15&export=1`;

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

// Wait for fonts, then restart animation for a clean take
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.keyboard.press('Space');
// Full 15s animation + a little pad so the end card holds
await page.waitForTimeout(durationSec * 1000 + 1200);

await page.close();
await context.close();
await browser.close();

// Playwright names the video randomly — rename the newest webm
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

// Convert to MP4 using system ffmpeg or imageio-ffmpeg's bundled binary
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

function findFfmpeg() {
  const sys = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (sys.status === 0) return 'ffmpeg';
  try {
    const require = createRequire(import.meta.url);
    // Prefer python imageio-ffmpeg path
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
if (ffmpegBin) {
  const result = spawnSync(
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
  if (result.status === 0) {
    console.log('Exported MP4:', outPath);
  } else {
    console.error(result.stderr?.slice(-800) || result.stdout);
    console.log('Kept WebM (convert failed):', webmFinal);
  }
} else {
  console.log('No ffmpeg — WebM saved at:', webmFinal);
}
