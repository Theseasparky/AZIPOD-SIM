// Screenshots for the reading pages: one per scenario (chart and 3D side by side) and one per ship (3D, chase
// camera), 1200 × 630 so each also serves as the page's social-media preview. Run after build:all, then commit
// site/img:  npm run site:shots [-- only-this-id ...]
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || !statSync(f).isFile()) f = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;
const list = JSON.parse(execFileSync('npx', ['tsx', '-e', `import { SHIPS } from './src/physics/ship'; import { SCENARIOS } from './src/scenarios';
console.log(JSON.stringify({ ships: Object.keys(SHIPS), scenarios: SCENARIOS.map(s => [s.id, s.ship ?? 'becancour']) }))`], { cwd: ROOT }).toString());
const only = process.argv.slice(2);
const jobs = [
  ...list.scenarios.map(([id, ship]) => ({ out: `places/${id}`, q: `scenario=${id}&ship=${ship}&view=split&cam=chase&tod=day`, run: 4 })),
  ...list.ships.map(id => ({ out: `ships/${id}`, q: `scenario=trials&ship=${id}&view=3d&cam=chase&tod=day`, run: 2 })),
].filter(j => !only.length || only.some(o => j.out.endsWith('/' + o)));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('azb-gate', '1'); localStorage.setItem('azb-ios-hint', '1'); } catch {} });
for (const j of jobs) {
  const page = await ctx.newPage();
  await page.goto(`${base}/?capture&${j.q}`); await page.waitForTimeout(3500);
  await page.evaluate(sec => { for (let i = 0; i < sec * 20; i++) globalThis.__azb.tick(50); }, j.run);
  await page.waitForTimeout(2500);
  await page.evaluate(() => globalThis.__azb.tick(50));
  const png = join(ROOT, 'scripts/tmp', j.out.replace('/', '-') + '.png'); mkdirSync(join(ROOT, 'scripts/tmp'), { recursive: true });
  await page.screenshot({ path: png });
  const jpg = join(ROOT, 'site/img', j.out + '.jpg'); mkdirSync(join(jpg, '..'), { recursive: true });
  execFileSync('python3', ['-c', `from PIL import Image; Image.open(${JSON.stringify(png)}).convert('RGB').save(${JSON.stringify(jpg)}, quality=74, optimize=True, progressive=True)`]);
  console.log('shot', j.out);
  await page.close();
}
await browser.close(); server.close();
