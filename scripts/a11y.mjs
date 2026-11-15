// Accessibility check: serves dist/, opens every reading page and the app in light and dark, and runs axe-core
// (WCAG 2.0/2.1/2.2 A and AA plus best practice). Needs Playwright with Chromium. Run after build:all: npm run a11y
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const AXE = require.resolve('axe-core/axe.min.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || !statSync(f).isFile()) f = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const urls = readFileSync(join(DIST, 'site/urls.txt'), 'utf8').trim().split('\n').map(u => base + new URL(u).pathname);
const browser = await chromium.launch();
let failed = 0;
for (const colorScheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme });
  await ctx.addInitScript(() => { try { localStorage.setItem('azb-gate', '1'); } catch {} });
  const page = await ctx.newPage();
  for (const u of urls) {
    await page.goto(u, { waitUntil: 'load' });
    if (new URL(u).pathname === '/') await page.waitForTimeout(1500);
    await page.addScriptTag({ path: AXE });
    const v = await page.evaluate(async () => (await globalThis.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map(x => `${x.id} (${x.impact}, ${x.nodes.length})`));
    if (v.length) { failed++; console.log(`✗ ${colorScheme} ${new URL(u).pathname}: ${v.join('; ')}`); }
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(`${urls.length * 2 - failed} of ${urls.length * 2} page views pass`);
process.exit(failed ? 1 : 0);
