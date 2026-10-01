// Render every animation to PNG frames with headless Chromium.
// Usage: node tools/export_frames.mjs [outDir=out/frames] [fps=12] [background=forest|tan|night|none]
// Then: python3 tools/build_gifs.py out/frames gifs   (GIF previews + transparent sprite sheets)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// playwright may be installed locally or only globally
const { chromium } = await import('playwright').catch(() =>
  createRequire(join(execSync('npm root -g').toString().trim(), 'x'))('playwright'));

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [outDir = join(root, 'out/frames'), fps = '12', bg = 'forest'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(pathToFileURL(join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.MageAnim && window.MageAnim.Sprite.ready);

const anims = await page.evaluate(() => Object.entries(window.MageAnim.ANIMS).map(([k, a]) => [k, a.ms]));
for (const [name, ms] of anims) {
  const n = Math.ceil(ms / (1000 / fps)), dir = join(outDir, name);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate(([name, t, bg]) => {
      const M = window.MageAnim, b = new M.Buf(M.STAGE_W, M.STAGE_H), s = M.renderFrame(b, name, t);
      const f = document.createElement('canvas'); f.width = M.STAGE_W; f.height = M.STAGE_H; f.getContext('2d').putImageData(b.img, 0, 0);
      if (bg === 'none') return f.toDataURL('image/png');
      const c = window.MageView.makeBg(bg);
      c.getContext('2d').drawImage(f, s.shake[0], s.shake[1]);
      return c.toDataURL('image/png');
    }, [name, i * 1000 / fps, bg]);
    writeFileSync(join(dir, String(i).padStart(3, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(name, n, 'frames');
}
await browser.close();
