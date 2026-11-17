// Writes the reading pages beside the built app: About, the fleet (a page per ship), the places (a page per
// port), Learn (the training guide), the FAQ, and the files search engines and AI assistants read (sitemap,
// robots, llms.txt). Everything is generated from the simulator's own data, so the pages cannot drift from it.
// Run after `vite build`:  tsx scripts/site.ts [outDir]   (default dist)
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIPS, propulsionSummary, type ShipSpec, type StationKind } from '../src/physics/ship';
import { OPEN_WATER, SCENARIOS, berthFor, fits, type Scenario } from '../src/scenarios';
import { AREAS } from '../src/scenes/areas';
import { CONTENT } from '../src/guide/content';
import { SOURCES } from '../src/guide/sources';
import { appliesTo } from '../src/guide/families';
import { fill, tokensIn } from '../src/guide/tokens';
import type { Card, Claim, Exercise, Procedure, Track } from '../src/guide/types';
import pkg from '../package.json';
import { GLOSSARY } from './site-glossary';
import { SKILLS } from './site-skills';
import type { Ctx, Lang, Locale } from './i18n/types';
import en from './i18n/en';
import es from './i18n/es';
import hr from './i18n/hr';
import fr from './i18n/fr';
import it from './i18n/it';
import pt from './i18n/pt';
import de from './i18n/de';
import nl from './i18n/nl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? join(ROOT, 'dist');
const SITE = (process.env.SITE_URL ?? 'https://shipshape.skipjack.app').replace(/\/$/, '');
const REPO = process.env.REPO_URL ?? 'https://github.com/Theseasparky/AZIPOD-SIM';
/** IndexNow key: a public token that proves to Bing, Yandex and the others that this site may announce its own pages. */
export const INDEXNOW_KEY = '8b8f8d6d1f88d4f02f414e14dbea8c38';
const TODAY = new Date().toISOString().slice(0, 10);
const AUTHOR = { '@type': 'Person', name: 'Kal.M', jobTitle: 'Captain', url: `${SITE}/about/` };
const CTX: Ctx = { ships: Object.keys(SHIPS).length, scenarios: SCENARIOS.length, terms: GLOSSARY.length, version: pkg.version, year: TODAY.slice(0, 4) };
/** English first: it is the original, the x-default, and the language of the simulator itself. */
const LOCALES: Locale[] = [en, es, hr, fr, it, pt, de, nl].map(f => f(CTX));
const LOC = Object.fromEntries(LOCALES.map(l => [l.code, l])) as Record<Lang, Locale>;
const EN = LOC.en;
// every language must cover every skill, place and glossary term, and every non-English one needs a home page
for (const L of LOCALES) {
  const miss = [
    ...SKILLS.filter(k => !L.skills.items[k.id]).map(k => `skill ${k.id}`),
    ...GLOSSARY.filter(t => !L.glossary.items[t.id]).map(t => `term ${t.id}`),
    ...['miami', 'split', 'lalb', 'ijmuiden', 'practice', 'open-water'].filter(id => !L.places.items[id]).map(id => `place ${id}`),
    ...(L.code !== 'en' && !L.home ? ['home page'] : []),
  ];
  if (miss.length) { console.error(`${L.code}: missing ${miss.join(', ')}`); process.exit(1); }
}
/** Where a language's pages live: '' for English, '/es' and so on for the others. */
const pre = (l: Lang) => l === 'en' ? '' : `/${l}`;
const glossaryPath = (l: Lang) => l === 'en' ? '/learn/glossary/' : `/${l}/glossary/`;

// ---------------------------------------------------------------- helpers
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s: string) => s.replace(/\s+/g, ' ').trim();
const num = (x: number, d = 0) => (+x.toFixed(d)).toLocaleString('en-GB');
const clip = (s: string, n = 158) => { s = plain(s); if (s.length <= n) return s; const c = s.slice(0, n - 1); return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:·.]$/, '') + '…'; };
const app = (q: Record<string, string | undefined> = {}) => {
  const p = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  return p ? `/?${p}` : '/';
};
const ships = Object.values(SHIPS);
const shipName = (id: string) => SHIPS[id]?.name ?? id;

interface Page { path: string; title: string; description: string; body: string; ld?: object[]; md: string; nav?: string; crumbs?: [string, string][]; priority?: number; image?: Shot;
  /** The page's language (English when absent) and the key it shares with its translations, for hreflang and the language switcher. */
  lang?: Lang; key?: string }
/** key → language → path, filled once every page is made. The simulator itself is the English 'home'. */
const ALT = new Map<string, Map<Lang, string>>([['home', new Map<Lang, string>([['en', '/'], ...LOCALES.filter(l => l.code !== 'en').map(l => [l.code, `/${l.code}/`] as [Lang, string])])]]);
/** A screenshot from site/img (made by npm run site:shots), 1200 × 630. */
interface Shot { src: string; alt: string }
const shot = (rel: string, alt: string): Shot | undefined => existsSync(join(ROOT, 'site/img', rel)) ? { src: `/site/img/${rel}`, alt } : undefined;
const figure = (im: Shot | undefined, cap?: string) => im ? `<figure class="shot"><img src="${im.src}" alt="${esc(im.alt)}" width="1200" height="630" loading="lazy" decoding="async" />${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>` : '';
const imageLd = (im: Shot | undefined) => im ? { image: { '@type': 'ImageObject', url: SITE + im.src, width: 1200, height: 630, caption: im.alt } } : {};
const pages: Page[] = [];

/** The main menu in a language. The fleet, the scenario pages, Learn and What's new exist in English only. */
const navFor = (L: Locale): [string, string][] => {
  const u = L.ui, p = pre(L.code);
  return L.code === 'en'
    ? [['/', u.sim], ['/ships/', u.fleet], ['/places/', u.places], ['/skills/', u.skills], ['/learn/', u.learn], ['/faq/', u.faq], ['/about/', u.about]]
    : [['/', u.sim], ['/ships/', u.fleet], [`${p}/places/`, u.places], [`${p}/skills/`, u.skills], ['/learn/', u.learn], [glossaryPath(L.code), u.glossary], [`${p}/faq/`, u.faq], [`${p}/about/`, u.about]];
};
const footFor = (L: Locale): [string, string][] => [...navFor(L), ...(L.code === 'en' ? [[glossaryPath('en'), L.ui.glossary] as [string, string]] : []), ['/news/', L.ui.news]];

function crumbsLd(c: [string, string][]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: c.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href })) };
}

function render(p: Page) {
  const url = SITE + p.path;
  const L = LOC[p.lang ?? 'en'], u = L.ui;
  const alts = p.key ? ALT.get(p.key) : undefined;
  const hreflang = alts && alts.size > 1 ? [...alts].map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${SITE}${h}" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${SITE}${alts.get('en') ?? '/'}" />\n` : '';
  const langs = LOCALES.map(o => { const h = alts?.get(o.code) ?? ALT.get('home')!.get(o.code)!; return `<li><a href="${h}" lang="${o.code}" hreflang="${o.code}"${o.code === L.code ? ' aria-current="true"' : ''}>${o.name}</a></li>`; }).join('');
  const crumbs: [string, string][] = p.crumbs ?? [];
  const ld = [...(p.ld ?? []).map((o, i) => i === 0 ? { ...o, dateModified: TODAY, inLanguage: L.code, ...imageLd(p.image) } : o), ...(crumbs.length > 1 ? [crumbsLd(crumbs)] : [])];
  const og = p.image ?? { src: '/og.png', alt: "SHIPSHAPE: a cruise ship's conning readouts, the harbour chart and the Azipod controls" };
  const nav = navFor(L).map(([h, t]) => `<li><a href="${h}"${p.nav === h ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
  const crumbHtml = crumbs.length > 1
    ? `<nav class="crumbs" aria-label="${u.crumbs}"><ol>${crumbs.map(([h, t], i) => `<li>${i === crumbs.length - 1 ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>`}</li>`).join('')}</ol></nav>`
    : '';
  return `<!doctype html>
<html lang="${L.code}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}" />
<link rel="canonical" href="${url}" />
<meta name="author" content="Kal.M" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="SHIPSHAPE" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}${og.src}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(og.alt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${SITE}${og.src}" />
<meta name="twitter:image:alt" content="${esc(og.alt)}" />
<link rel="alternate" type="application/atom+xml" title="SHIPSHAPE: what's new" href="/feed.xml" />
<meta name="theme-color" content="#f7f9fa" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#06121a" media="(prefers-color-scheme: dark)" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="/site/site.css" />
<link rel="alternate" type="text/plain" title="SHIPSHAPE for language models" href="/llms.txt" />
${hreflang}${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">${u.skip}</a>
<header class="site"><div class="wrap">
<a class="brand" href="${L.code === 'en' ? '/' : `/${L.code}/`}">SHIPSHAPE</a>
<nav class="main" aria-label="${u.mainNav}"><ul>${nav}</ul></nav>
<nav class="langs" aria-label="${u.language}"><ul>${langs}</ul></nav>
</div></header>
<div class="wrap">${crumbHtml}</div>
<main id="main" class="wrap" tabindex="-1">
${p.body}
</main>
<footer class="site"><div class="wrap">
<p>SHIPSHAPE ${pkg.version} · ${u.byline} · ${u.updated} <time datetime="${TODAY}">${TODAY}</time>. ${u.notNav}</p>
<nav aria-label="${u.footNav}"><ul>${footFor(L).map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="/shipshape-offline.html">${u.offline}</a></li><li><a href="${REPO}">${u.source}</a></li></ul></nav>
</div></footer>
</body>
</html>
`;
}

const STATION: Record<StationKind, string> = {
  azipod: 'Azipod console: an rpm lever and an azimuth dial for each pod, a joystick, and the bow thrusters',
  telegraph: 'Engine telegraph and wheel: a direct-reversing two-stroke that has to be stopped and restarted to go astern',
  cpp: 'Propulsion levers and helm: controllable pitch or shaft-speed levers, rudders, and thrusters',
  asd: 'Azimuth drive combi-levers: thrust and direction on one handle for each drive',
  vsp: 'Voith Schneider levers: pitch set anywhere around the circle, so thrust can point in any direction',
  waterjet: 'Waterjet levers: bucket for ahead and astern, nozzles for steering',
  dp: 'Dynamic positioning console: joystick, auto heading and auto position, with the manual levers behind it',
};
const TYPE: Record<string, string> = {
  cruise: 'Cruise ship', tanker: 'Tanker', container: 'Container ship', bulk: 'Bulk carrier', gas: 'LNG carrier', ropax: 'Ro-Pax ferry',
  tug: 'Tug', 'fast ferry': 'Fast ferry', psv: 'Platform supply vessel', ahts: 'Anchor-handling tug supply vessel', icebreaker: 'Icebreaker',
  inland: 'Inland push convoy', naval: 'Frigate', yacht: 'Yacht',
};
const typeOf = (s: ShipSpec) => TYPE[s.type ?? 'cruise'] ?? 'Ship';
const SHIP_GROUPS = ['Cruise ships and yachts', 'Ferries', 'Cargo ships', 'Tugs', 'Offshore', 'Special ships'];
const shipGroup = (sp: ShipSpec) => { const t = sp.type ?? 'cruise'; return /cruise|yacht/.test(t) ? 0 : /ferry|ropax/.test(t) ? 1 : /tanker|container|bulk|gas/.test(t) ? 2 : /tug/.test(t) ? 3 : /psv|ahts/.test(t) ? 4 : 5; };
const fitsHere = (s: Scenario, sp: ShipSpec) => !!s.needsData || fits(s, sp.T, s.berthFace ? berthFor(s, sp.B, 0) : s.berth, !!sp.towPoints, sp.station === 'dp');
const shipLine = (s: ShipSpec) => `${num(s.LOA, 1)} m × ${num(s.B, 1)} m, ${num(s.T, 1)} m draught · ${propulsionSummary(s)}`;

// ---------------------------------------------------------------- places
interface Place { id: string; name: string; short: string; about: string; chart: string; scenarios: Scenario[] }
const PLACE_TEXT = EN.places.items;
const places: Place[] = [];
for (const s of SCENARIOS) {
  const id = s.area ?? (OPEN_WATER.has(s.id) ? 'open-water' : 'practice');
  let p = places.find(x => x.id === id);
  if (!p) {
    const name = s.area ? AREAS[s.area].meta.name : id === 'open-water' ? 'Open water and special operations' : 'Practice harbours and channels';
    const short = ({ miami: 'PortMiami', split: 'Split', lalb: 'Los Angeles & Long Beach', ijmuiden: 'IJmuiden & Amsterdam' } as Record<string, string>)[s.area ?? ''] ?? name;
    p = { ...PLACE_TEXT[id], id, name, short, scenarios: [] };
    places.push(p);
  }
  p.scenarios.push(s);
}
const placeOf = (s: Scenario) => places.find(p => p.scenarios.includes(s))!;
const wind = (s: Scenario) => s.windKn ? `${num(s.windKn)} kn from ${String(Math.round(s.windFrom)).padStart(3, '0')}°${s.gusts ? ', gusting' : ''}` : 'calm';
const current = (s: Scenario) => s.currentKn ? `${num(s.currentKn, 1)} kn setting ${String(Math.round(s.currentSet)).padStart(3, '0')}°` : 'none';
const depth = (s: Scenario) => s.needsData ? 'from the chart' : Number.isFinite(s.depth) ? `${num(s.depth, 1)} m` : 'deep';

// ---------------------------------------------------------------- learn
const TRACKS: { id: Track; slug: string; title: string; lede: string }[] = [
  { id: 'azipod', slug: 'azipod', title: 'Handling Azipod ships', lede: 'How podded propulsion behaves at slow speed and in a stop: turning the pods round, the reverse interlock, walking the ship sideways, and where she pivots.' },
  { id: 'tugs', slug: 'tugs', title: 'Tug handling', lede: 'Azimuth stern drive, Voith Schneider and rotor tugs: how each pushes and pulls, the escort envelope behind a ship under way, and the orders a pilot gives.' },
  { id: 'special', slug: 'propulsion', title: 'Specialised propulsion', lede: 'Direct-reversing two-strokes, controllable-pitch propellers, waterjets and dynamic positioning: what each does that a plain propeller does not, and where it catches people out.' },
];
const conf: Record<Claim['conf'], string> = { measured: 'Measured', published: 'Published', rule: 'Rule of thumb', derived: 'From the model' };
const SRC = new Map(SOURCES.map(s => [s.id, s]));
/** The ship whose particulars fill in a card's figures. */
const exampleShip = (it: { fam: Card['fam']; ships?: string[] }) => [SHIPS.spirit, ...ships].find(s => appliesTo(it, s)) ?? SHIPS.spirit;

function claimsHtml(cl: Claim[], sp: ShipSpec) {
  if (!cl.length) return '';
  return `<ul class="claims">${cl.map(c => {
    const src = c.src.map(id => SRC.get(id)).filter(Boolean).map(s => s!.url ? `<a href="${esc(s!.url)}" rel="noopener">${esc(s!.short)}</a>` : esc(s!.short)).join(', ');
    return `<li><span class="conf">${conf[c.conf]}</span>${esc(fill(c.text, sp))}${src ? ` <span class="src">(${src})</span>` : ''}</li>`;
  }).join('')}</ul>`;
}
const claimsMd = (cl: Claim[], sp: ShipSpec) => cl.map(c => `- ${conf[c.conf]}: ${fill(c.text, sp)}${c.src.length ? ` (${c.src.map(id => SRC.get(id)?.short ?? id).join(', ')})` : ''}`).join('\n');
const forShips = (it: { fam: Card['fam']; ships?: string[] }) => ships.filter(s => appliesTo(it, s));
const shipLinks = (list: ShipSpec[]) => list.map(s => `<a href="/ships/${s.id}/">${esc(s.name)}</a>`).join(', ');

// ---------------------------------------------------------------- pages
const total = { ships: ships.length, scenarios: SCENARIOS.length, real: places.filter(p => p.id !== 'practice' && p.id !== 'open-water') };
const realNames = total.real.map(p => p.short);
const listing = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// ---- Fleet index
{
  const groups = SHIP_GROUPS.map((g, i) => ({ g, list: ships.filter(s => shipGroup(s) === i) })).filter(x => x.list.length);
  const body = `<div class="hero"><p class="kicker">The fleet</p><h1>${total.ships} ships to handle</h1>
<p class="lede">Every ship in SHIPSHAPE has the propulsion and the controls her crew would really use. Pick one to see her particulars and where to take her, or open her straight in the simulator.</p></div>
${groups.map(({ g, list }) => `<h2 id="${g.toLowerCase().replace(/[^a-z]+/g, '-')}">${g}</h2>
<ul class="grid">${list.map(s => `<li><div class="card"><h3><a href="/ships/${s.id}/">${esc(s.name)}</a></h3><p class="meta">${esc(typeOf(s))} · ${num(s.LOA, 1)} m · ${num(s.vmaxKn, 1)} kn</p><p>${esc(propulsionSummary(s))}</p><a class="go" href="${app({ ship: s.id })}">Handle her now</a></div></li>`).join('')}</ul>`).join('\n')}`;
  const md = `# The SHIPSHAPE fleet\n\n${groups.map(({ g, list }) => `## ${g}\n\n${list.map(s => `- [${s.name}](${SITE}/ships/${s.id}/): ${typeOf(s)}, ${shipLine(s)}`).join('\n')}`).join('\n\n')}`;
  pages.push({
    path: '/ships/', nav: '/ships/', priority: 0.9, image: shot('ships/spirit.jpg', 'A 293 m Azipod cruise ship in SHIPSHAPE\'s 3D view'),
    title: `The fleet: ${total.ships} ships to handle · SHIPSHAPE ship simulator`,
    description: clip(`Handle ${total.ships} ships in a free browser simulator: Azipod cruise ships, ferries, tugs, tankers, container ships, an LNG carrier, a frigate, an icebreaker and superyachts, each with her own controls.`),
    crumbs: [['/', 'SHIPSHAPE'], ['/ships/', 'Fleet']],
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'The SHIPSHAPE fleet', url: `${SITE}/ships/`, mainEntity: { '@type': 'ItemList', numberOfItems: ships.length, itemListElement: ships.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/ships/${s.id}/`, name: s.name })) } }],
    body, md,
  });
}

// ---- One page per ship
for (const s of ships) {
  const own = SCENARIOS.filter(x => x.ship === s.id);
  const also = SCENARIOS.filter(x => x.ship !== s.id && !x.area && !x.needsData && fitsHere(x, s));
  const guide = [...CONTENT.cards, ...CONTENT.procedures].filter(it => appliesTo(it, s));
  const station = STATION[s.station ?? 'azipod'];
  const sister = ships.filter(o => o !== s && o.name.split(' · ')[0] === s.name.split(' · ')[0]);
  const facts: [string, string][] = [
    ['Type', typeOf(s)],
    ['Length overall', `${num(s.LOA, 1)} m`],
    ['Length between perpendiculars', `${num(s.L, 1)} m`],
    ['Beam', `${num(s.B, 2)} m`],
    ['Draught', `${num(s.T, 2)} m${s.load ? ` (${s.load})` : ''}`],
    ['Block coefficient', num(s.Cb, 3)],
    ['Service speed', `${num(s.vmaxKn, 1)} kn at full power, deep water`],
    ['Propulsion', propulsionSummary(s)],
    ['Bridge controls', station],
  ];
  const im = shot(`ships/${s.id}.jpg`, `The ${s.name} in SHIPSHAPE's 3D view, with her conning readouts and bridge controls`);
  const sc = (x: Scenario) => `<li><a href="/places/${placeOf(x).id}/${x.id}/">${esc(x.name)}</a> · <a href="${app({ scenario: x.id, ship: s.id })}">open with her</a></li>`;
  const body = `<div class="hero"><p class="kicker">${esc(typeOf(s))}</p><h1>${esc(s.name)}</h1>
<p class="lede">${esc(shipLine(s))}.</p>
<div class="cta"><a class="btn primary" href="${app({ ship: s.id, scenario: own[0]?.id })}">Handle her in the simulator</a><a class="btn" href="/ships/">The whole fleet</a></div></div>
${figure(im)}
<h2>Particulars</h2>
<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
${s.note ? `<h2>About the model</h2><p>${esc(s.note)}</p>` : ''}
${own.length ? `<h2>Scenarios written for her</h2><ul>${own.map(sc).join('')}</ul>` : ''}
${also.length ? `<h2>She also fits</h2><p>Any ship can be loaded into any scenario; these practice areas have water enough for her draught.</p><ul>${also.map(sc).join('')}</ul>` : ''}
${guide.length ? `<h2>From the training guide</h2><ul>${guide.map(it => `<li><a href="/learn/${TRACKS.find(t => t.id === it.track)!.slug}/#${it.id}">${esc(it.title)}</a></li>`).join('')}</ul>` : ''}
${sister.length ? `<h2>Same hull, other conditions</h2><ul>${sister.map(o => `<li><a href="/ships/${o.id}/">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}`;
  const md = `# ${s.name}\n\n${typeOf(s)}. ${shipLine(s)}.\n\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n${s.note ?? ''}\n\nOpen in the simulator: ${SITE}${app({ ship: s.id, scenario: own[0]?.id })}${own.length ? `\n\nScenarios written for her: ${own.map(x => x.name).join('; ')}.` : ''}`;
  pages.push({
    path: `/ships/${s.id}/`, nav: '/ships/', priority: 0.7, image: im,
    title: `${s.name} · ship-handling simulator · SHIPSHAPE`,
    description: clip(`Handle the ${s.name} in a free browser simulator: ${typeOf(s).toLowerCase()}, ${num(s.LOA, 1)} m, ${propulsionSummary(s)}. Particulars, controls and scenarios.`),
    crumbs: [['/', 'SHIPSHAPE'], ['/ships/', 'Fleet'], [`/ships/${s.id}/`, s.name]],
    ld: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: s.name, url: `${SITE}/ships/${s.id}/`, description: shipLine(s), isPartOf: { '@type': 'WebSite', name: 'SHIPSHAPE', url: SITE + '/' }, about: { '@type': 'Thing', name: `${typeOf(s)} handling`, description: s.note } }],
    body, md,
  });
}

// ---- Places index and one page per place
{
  const body = `<div class="hero"><p class="kicker">Places</p><h1>Real ports and practice waters</h1>
<p class="lede">${listing(realNames)} on their real charts, plus harbours and open-water exercises built to teach one thing at a time. ${total.scenarios} scenarios in all.</p></div>
<ul class="grid">${places.map(p => `<li><div class="card"><h2><a href="/places/${p.id}/">${esc(p.name)}</a></h2><p class="meta">${p.scenarios.length} scenario${p.scenarios.length > 1 ? 's' : ''}</p><p>${esc(clip(p.about, 170))}</p></div></li>`).join('')}</ul>`;
  pages.push({
    path: '/places/', nav: '/places/', priority: 0.9, key: 'places', image: shot('places/split-medmoor.jpg', 'A superyacht moored stern-to in the Port of Split, 3D view beside the chart'),
    title: `Ports and scenarios: ${listing(realNames)} · SHIPSHAPE`,
    description: clip(`Practise ship handling in ${listing(realNames)} on real charts, with wind, current, tugs and mooring lines. ${total.scenarios} free scenarios in the browser.`),
    crumbs: [['/', 'SHIPSHAPE'], ['/places/', 'Places']],
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'SHIPSHAPE places', url: `${SITE}/places/`, mainEntity: { '@type': 'ItemList', itemListElement: places.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/places/${p.id}/`, name: p.name })) } }],
    body, md: `# Places in SHIPSHAPE\n\n${places.map(p => `- [${p.name}](${SITE}/places/${p.id}/): ${p.scenarios.length} scenarios. ${p.about}`).join('\n')}`,
  });
  for (const p of places) {
    const meta = p.scenarios[0].area ? AREAS[p.scenarios[0].area!].meta : undefined;
    const geo = meta ? { '@type': 'Place', name: p.name, geo: { '@type': 'GeoCoordinates', latitude: meta.origin[0], longitude: meta.origin[1] } } : undefined;
    const body = `<div class="hero"><p class="kicker">${meta ? 'Real chart' : 'Practice'}</p><h1>${esc(p.name)}</h1>
<p class="lede">${esc(p.about)}</p></div>
<p class="note">${esc(p.chart)}</p>
<h2>Scenarios</h2>
<p class="toc">${p.scenarios.map(s => `<a href="#${s.id}">${esc(s.name)}</a>`).join('<br />')}</p>
${p.scenarios.map(s => {
  const sp = SHIPS[s.ship ?? 'becancour'] ?? SHIPS.becancour;
  return `<article class="item" id="${s.id}" aria-labelledby="${s.id}-h"><h3 id="${s.id}-h"><a href="/places/${p.id}/${s.id}/">${esc(s.name)}</a></h3>
<p>${esc(s.brief)}</p>
<dl class="facts"><dt>Ship</dt><dd><a href="/ships/${sp.id}/">${esc(sp.name)}</a></dd><dt>Wind</dt><dd>${wind(s)}</dd><dt>Current</dt><dd>${current(s)}</dd><dt>Depth</dt><dd>${depth(s)}</dd><dt>Start</dt><dd>${num(s.start.kn, 1)} kn on ${String(Math.round(s.start.psi)).padStart(3, '0')}°</dd></dl>
<div class="cta"><a class="btn primary" href="${app({ scenario: s.id, ship: sp.id })}">Open this scenario</a></div></article>`;
}).join('\n')}`;
    pages.push({
      path: `/places/${p.id}/`, nav: '/places/', priority: 0.8, image: shot(`places/${p.scenarios[0].id}.jpg`, `${p.scenarios[0].name}: chart and 3D view in SHIPSHAPE`),
      title: `${p.name} ship-handling scenarios · SHIPSHAPE simulator`,
      description: clip(`${p.name} in a free ship-handling simulator: ${p.scenarios.map(s => s.name.replace(/^[^·]*· /, '')).join(', ')}.`),
      crumbs: [['/', 'SHIPSHAPE'], ['/places/', 'Places'], [`/places/${p.id}/`, p.name]],
      ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${p.name} scenarios`, url: `${SITE}/places/${p.id}/`, description: p.about, ...(geo ? { about: geo } : {}), mainEntity: { '@type': 'ItemList', itemListElement: p.scenarios.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE}/places/${p.id}/#${s.id}` })) } }],
      body,
      md: `# ${p.name}\n\n${p.about}\n\nChart: ${p.chart}\n\n${p.scenarios.map(s => `## ${s.name}\n\n${s.brief}\n\n- Ship: ${shipName(s.ship ?? 'becancour')}\n- Wind: ${wind(s)}\n- Current: ${current(s)}\n- Depth: ${depth(s)}\n- Open: ${SITE}${app({ scenario: s.id, ship: s.ship })}`).join('\n\n')}`,
    });
  }
}

// ---- One page per scenario
for (const p of places) for (const s of p.scenarios) {
  const sp = SHIPS[s.ship ?? 'becancour'] ?? SHIPS.becancour;
  const meta = s.area ? AREAS[s.area].meta : undefined;
  const im = shot(`places/${s.id}.jpg`, `${s.name}: the ${sp.name} in SHIPSHAPE, 3D view beside the chart`);
  const others = p.scenarios.filter(x => x !== s);
  const exs = CONTENT.exercises.filter(e => e.scenario === s.id);
  const fitting = !s.area && !s.needsData ? ships.filter(o => o !== sp && fitsHere(s, o)) : [];
  const href = app({ scenario: s.id, ship: sp.id });
  const facts: [string, string][] = [['Place', p.name], ['Ship', sp.name], ['Wind', wind(s)], ['Current', current(s)], ['Depth', depth(s)], ['Start', `${num(s.start.kn, 1)} kn, heading ${String(Math.round(s.start.psi)).padStart(3, '0')}°`]];
  const body = `<div class="hero"><p class="kicker">${esc(p.name)}</p><h1>${esc(s.name)}</h1>
<p class="lede">${esc(s.brief)}</p>
<div class="cta"><a class="btn primary" href="${href}">Open this scenario</a><a class="btn" href="/places/${p.id}/">All of ${esc(p.short)}</a></div></div>
${figure(im)}
<h2>Conditions</h2>
<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'Ship' ? `<a href="/ships/${sp.id}/">${esc(v)}</a>` : k === 'Place' ? `<a href="/places/${p.id}/">${esc(v)}</a>` : esc(v)}</dd>`).join('')}</dl>
<p class="note">${esc(p.chart)}</p>
${exs.length ? `<h2>Guided exercise</h2><ul>${exs.map(e => `<li><a href="/learn/${TRACKS.find(t => t.id === e.track)!.slug}/#${e.id}">${esc(e.title)}</a>: ${esc(fill(e.brief, SHIPS[e.ship]))}</li>`).join('')}</ul>` : ''}
<h2>Try her with another ship</h2>
<p>Any ship in the fleet can be loaded here from Menu → Ships; the simulator warns when she draws too much water for the berth.${fitting.length ? ' These have water enough:' : ''}</p>
${fitting.length ? `<ul class="toc">${fitting.map(o => `<li><a href="${app({ scenario: s.id, ship: o.id })}">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}
${others.length ? `<h2>More at ${esc(p.short)}</h2><ul>${others.map(o => `<li><a href="/places/${p.id}/${o.id}/">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}`;
  pages.push({
    path: `/places/${p.id}/${s.id}/`, nav: '/places/', priority: 0.7, image: im,
    title: `${s.name} · ship-handling scenario · SHIPSHAPE`,
    description: clip(`${s.name}: ${s.brief}`),
    crumbs: [['/', 'SHIPSHAPE'], ['/places/', 'Places'], [`/places/${p.id}/`, p.name], [`/places/${p.id}/${s.id}/`, s.name]],
    ld: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: s.name, url: `${SITE}/places/${p.id}/${s.id}/`, description: s.brief, isPartOf: { '@type': 'WebSite', name: 'SHIPSHAPE', url: SITE + '/' },
      ...(meta ? { about: { '@type': 'Place', name: p.name, geo: { '@type': 'GeoCoordinates', latitude: meta.origin[0], longitude: meta.origin[1] } } } : {}),
      potentialAction: { '@type': 'PlayAction', target: SITE + href, name: 'Open this scenario' } }],
    body,
    md: `# ${s.name}\n\n${s.brief}\n\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nOpen: ${SITE}${href}`,
  });
}

// ---- Learn
{
  const counts = (t: Track) => [CONTENT.cards, CONTENT.procedures, CONTENT.exercises].map(xs => xs.filter(x => x.track === t).length);
  const body = `<div class="hero"><p class="kicker">Learn</p><h1>The training guide</h1>
<p class="lede">The guide inside SHIPSHAPE explains what the ship is doing and why, step by step drills to run on her, and exercises with a debrief. Every statement carries its source: a model test, a standard, a manufacturer's manual or a port's own guidelines, or, where it says so, the simulator's own model.</p>
<div class="cta"><a class="btn primary" href="/">Open the simulator</a><a class="btn" href="/learn/glossary/">Glossary</a></div></div>
<ul class="grid">${TRACKS.map(t => { const [c, p, e] = counts(t.id); return `<li><div class="card"><h2><a href="/learn/${t.slug}/">${t.title}</a></h2><p class="meta">${c} notes · ${p} drills · ${e} exercises</p><p>${esc(t.lede)}</p></div></li>`; }).join('')}</ul>
<h2>How the guide keeps itself honest</h2>
<p>Each statement is marked by how well it is established. <b>Measured</b> means published trials or model tests. <b>Published</b> means a standard, a manual, an incident report or port guidance. <b>Rule of thumb</b> is a cited textbook rule. <b>From the model</b> is what this simulator computes, and is the only kind allowed without an outside source. Figures in the text are taken from the ship's own particulars, so they always match the ship you are handling.</p>`;
  pages.push({
    path: '/learn/', nav: '/learn/', priority: 0.9,
    title: 'Learn ship handling: Azipods, tugs, CPP, waterjets and DP · SHIPSHAPE',
    description: clip('A free, sourced ship-handling guide: Azipod crash stops, tug escort, controllable-pitch propellers, two-stroke astern starts, waterjets and dynamic positioning, with drills to run in the simulator.'),
    crumbs: [['/', 'SHIPSHAPE'], ['/learn/', 'Learn']],
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'SHIPSHAPE training guide', url: `${SITE}/learn/`, hasPart: TRACKS.map(t => ({ '@type': 'LearningResource', name: t.title, url: `${SITE}/learn/${t.slug}/` })) }],
    body, md: `# The SHIPSHAPE training guide\n\n${TRACKS.map(t => `- [${t.title}](${SITE}/learn/${t.slug}/): ${t.lede}`).join('\n')}`,
  });

  for (const t of TRACKS) {
    const cards = CONTENT.cards.filter(c => c.track === t.id);
    const procs = CONTENT.procedures.filter(c => c.track === t.id);
    const exs = CONTENT.exercises.filter(c => c.track === t.id);
    const cardHtml = (c: Card) => { const sp = exampleShip(c); const on = forShips(c); return `<article class="item" id="${c.id}" aria-labelledby="${c.id}-h"><h3 id="${c.id}-h">${esc(c.title)}</h3>
<p>${esc(fill(c.brief, sp))}</p>${c.why ? `<p>${esc(fill(c.why, sp))}</p>` : ''}
${c.real.length ? `<h4 class="kicker">At sea</h4>${claimsHtml(c.real, sp)}` : ''}
${c.sim ? `<p class="note"><b>In SHIPSHAPE:</b> ${esc(fill(c.sim, sp))}</p>` : ''}
<p class="note">Applies to ${shipLinks(on)}.${tokensIn([c.brief, c.why ?? '', c.sim ?? '', ...c.real.map(x => x.text)].join(' ')).length ? ` Figures shown for the ${esc(sp.name)}.` : ''}</p></article>`; };
    const procHtml = (p: Procedure) => { const sp = exampleShip(p); return `<article class="item" id="${p.id}" aria-labelledby="${p.id}-h"><h3 id="${p.id}-h">${esc(p.title)}</h3>
<p>${esc(fill(p.brief, sp))}</p>
<ol>${p.steps.map(s => `<li>${esc(fill(s.text, sp))}${s.why ? ` <span class="note">${esc(fill(s.why, sp))}</span>` : ''}</li>`).join('')}</ol>
${p.real.length ? `<h4 class="kicker">At sea</h4>${claimsHtml(p.real, sp)}` : ''}
${p.sim ? `<p class="note"><b>In SHIPSHAPE:</b> ${esc(fill(p.sim, sp))}</p>` : ''}
<p class="note">Run it on ${shipLinks(forShips(p))}: open the ship, then Coach → Drills.</p></article>`; };
    const exHtml = (e: Exercise) => { const sp = SHIPS[e.ship]; return `<article class="item" id="${e.id}" aria-labelledby="${e.id}-h"><h3 id="${e.id}-h">${esc(e.title)}</h3>
<p>${esc(fill(e.brief, sp))}</p>
<ul>${e.objectives.map(o => `<li>${esc(fill(o, sp))}</li>`).join('')}</ul>
${e.real.length ? claimsHtml(e.real, sp) : ''}
<div class="cta"><a class="btn primary" href="${app({ scenario: e.scenario, ship: e.ship })}">Open with the ${esc(sp.name)}</a></div></article>`; };
    const body = `<div class="hero"><p class="kicker">Learn</p><h1>${t.title}</h1><p class="lede">${esc(t.lede)}</p></div>
<nav aria-label="On this page"><p class="toc">${[...cards, ...procs, ...exs].map(x => `<a href="#${x.id}">${esc(x.title)}</a>`).join('<br />')}</p></nav>
${cards.length ? `<h2>Notes</h2>${cards.map(cardHtml).join('\n')}` : ''}
${procs.length ? `<h2>Drills</h2>${procs.map(procHtml).join('\n')}` : ''}
${exs.length ? `<h2>Exercises</h2>${exs.map(exHtml).join('\n')}` : ''}
<h2>Sources</h2>
<ul>${[...new Set([...cards, ...procs, ...exs].flatMap(x => x.real.flatMap(c => c.src)))].map(id => SRC.get(id)).filter(Boolean).map(s => `<li>${esc(s!.cite)}${s!.url ? ` <a href="${esc(s!.url)}" rel="noopener">link</a>` : ''}</li>`).join('')}</ul>`;
    const md = `# ${t.title}\n\n${t.lede}\n\n${cards.map(c => { const sp = exampleShip(c); return `## ${c.title}\n\n${fill(c.brief, sp)}${c.why ? `\n\n${fill(c.why, sp)}` : ''}\n\n${claimsMd(c.real, sp)}${c.sim ? `\n\nIn SHIPSHAPE: ${fill(c.sim, sp)}` : ''}`; }).join('\n\n')}\n\n${procs.map(p => { const sp = exampleShip(p); return `## Drill: ${p.title}\n\n${fill(p.brief, sp)}\n\n${p.steps.map((s, i) => `${i + 1}. ${fill(s.text, sp)}`).join('\n')}\n\n${claimsMd(p.real, sp)}`; }).join('\n\n')}\n\n${exs.map(e => `## Exercise: ${e.title}\n\n${fill(e.brief, SHIPS[e.ship])}\n\nOpen: ${SITE}${app({ scenario: e.scenario, ship: e.ship })}`).join('\n\n')}`;
    pages.push({
      path: `/learn/${t.slug}/`, nav: '/learn/', priority: 0.8,
      title: `${t.title}: notes, drills and exercises · SHIPSHAPE`,
      description: clip(`${t.lede}`),
      crumbs: [['/', 'SHIPSHAPE'], ['/learn/', 'Learn'], [`/learn/${t.slug}/`, t.title]],
      ld: [
        { '@context': 'https://schema.org', '@type': 'LearningResource', name: t.title, url: `${SITE}/learn/${t.slug}/`, description: t.lede, learningResourceType: 'Guide', educationalLevel: 'Professional', isAccessibleForFree: true, inLanguage: 'en', author: AUTHOR, teaches: [...cards, ...procs].map(x => x.title) },
        ...procs.map(p => { const sp = exampleShip(p); return { '@context': 'https://schema.org', '@type': 'HowTo', name: p.title, description: fill(p.brief, sp), url: `${SITE}/learn/${t.slug}/#${p.id}`, step: p.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: fill(s.text, sp) })) }; }),
      ],
      body, md,
    });
  }
}

// ---- Glossary
pages.push({
  path: '/learn/glossary/', nav: '/learn/', priority: 0.8, key: 'glossary',
  title: 'Ship-handling glossary: Azipod, pivot point, squat, Med moor and more · SHIPSHAPE',
  description: clip(`Plain definitions of ${GLOSSARY.length} ship-handling terms: Azipod, ASD and Voith tugs, CPP, direct-reversing engines, pivot point, squat, bank effect, scope, Mediterranean moor, DP and more.`),
  crumbs: [['/', 'SHIPSHAPE'], ['/learn/', 'Learn'], ['/learn/glossary/', 'Glossary']],
  ld: [{ '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': `${SITE}/learn/glossary/`, name: 'Ship-handling glossary', url: `${SITE}/learn/glossary/`, author: AUTHOR,
    hasDefinedTerm: GLOSSARY.map(t => ({ '@type': 'DefinedTerm', '@id': `${SITE}/learn/glossary/#${t.id}`, name: t.term, ...(t.also ? { alternateName: t.also } : {}), description: t.def, inDefinedTermSet: `${SITE}/learn/glossary/` })) }],
  body: `<div class="hero"><p class="kicker">Learn</p><h1>Ship-handling glossary</h1><p class="lede">The words pilots, masters and tug crews use, in plain English, with a link to where each can be seen or tried in the simulator.</p></div>
<nav aria-label="Terms"><p class="toc">${GLOSSARY.map(t => `<a href="#${t.id}">${esc(t.term)}</a>`).join('<br />')}</p></nav>
<dl class="glossary">${GLOSSARY.map(t => `<div id="${t.id}"><dt>${esc(t.term)}${t.also ? ` <span class="note">(${esc(t.also.join(', '))})</span>` : ''}</dt><dd><p>${esc(t.def)}</p>${t.see ? `<p class="note">See: ${t.see.map(([h, n]) => `<a href="${h}">${esc(n)}</a>`).join(' · ')}</p>` : ''}</dd></div>`).join('\n')}</dl>`,
  md: `# Ship-handling glossary\n\n${GLOSSARY.map(t => `**${t.term}**${t.also ? ` (${t.also.join(', ')})` : ''}: ${t.def}`).join('\n\n')}`,
});

// ---- What's new (also the Atom feed)
const NEWS: { v: string; date: string; title: string; text: string; link?: string }[] = [
  { v: '5.6.0', date: TODAY, title: 'Your own start, fenders on board, and the load-down', text: 'Choose where she starts on the chart, with a ghost of her hull that shows whether there is water enough under her. Hang pneumatic fenders over her own side. Hide the forward and aft lateral speeds, as on most cargo-ship wings. A stop order from sea speed on a direct-reversing engine now runs the load-down programme before the fuel is cut.', link: '/places/' },
  { v: '5.5.0', date: '2026-11-15', title: 'Skills, and eight languages', text: 'A page for each ship-handling skill (anchoring, Mediterranean mooring, berthing, locks, tugs, Azipods, channels and dynamic positioning) with the scenarios to practise it on, and the reading pages, skills and glossary in Spanish, Croatian, French, Italian, Portuguese, German and Dutch as well as English.', link: '/skills/' },
  { v: '5.4.0', date: '2026-11-15', title: 'Easy to find, easy to read', text: 'Plain reading pages beside the simulator: a page for every ship and every scenario, the training guide with its sources, a ship-handling glossary, and questions and answers. Every page opens the simulator with that ship or scenario loaded, and works with a keyboard and a screen reader.', link: '/ships/' },
  { v: '5.3.1', date: '2026-11-13', title: 'Lines on both sides', text: 'Rig the mooring lines on port, starboard or both at once, and send a whole side ashore, set all its winches, or let it all go with one tap. For a Mediterranean moor with lines from both quarters, or a ship held in the middle of a slip.', link: '/places/split/split-medmoor/' },
  { v: '5.3.0', date: '2026-11-13', title: 'Anchors, the Port of Split, and finer control', text: 'Two bow anchors on every ship and a stern anchor on the ferries and yachts, with an ANCHOR panel to work them. The Port of Split with its ferry berths, cruise berths and a Mediterranean-moor scenario. Plus and minus buttons beside every power lever and 5° buttons beside every wheel and pod dial. A tidier menu with Ships, Places and Settings tabs and search.', link: '/places/split/' },
  { v: '5.2.0', date: '2026-11-10', title: 'A cleaner console', text: 'The readouts, buttons and panels redrawn as a flat, dark instrument console with one typeface and larger figures.' },
  { v: '5.1.0', date: '2026-11-07', title: 'An optional training guide', text: 'Drills for an Azipod crash stop, a crash astern on a direct-reversing engine, stopping a waterjet ship, working two assist tugs and releasing a tug\'s line before it girts, plus exercises with a debrief. Every statement carries its source.', link: '/learn/' },
  { v: '5.0.0', date: '2026-11-06', title: 'Real charts, real harbours, and a lock', text: 'Los Angeles and Long Beach and IJmuiden to Amsterdam on their real charts, PortMiami out to its sea buoy, depth contours, soundings and every buoy and light, and the Zeesluis IJmuiden as a working lock.', link: '/places/' },
  { v: '4.0.0', date: '2026-10-28', title: 'A whole fleet', text: 'From three Azipod cruise ships to every way a ship can be driven: tankers and container ships on a telegraph, ferries with controllable-pitch propellers, ASD, Voith and rotor tugs, a fast ferry on waterjets, DP vessels, an icebreaker, a frigate and a push convoy, with realistic 3D models.', link: '/ships/' },
];
pages.push({
  path: '/news/', priority: 0.6,
  title: "What's new in SHIPSHAPE · ship-handling simulator updates",
  description: clip(`The latest SHIPSHAPE updates: ${NEWS.slice(0, 3).map(n => n.title.toLowerCase()).join('; ')}.`),
  crumbs: [['/', 'SHIPSHAPE'], ['/news/', "What's new"]],
  ld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: "What's new in SHIPSHAPE", url: `${SITE}/news/`, author: AUTHOR, blogPost: NEWS.map(n => ({ '@type': 'BlogPosting', headline: `${n.v}: ${n.title}`, datePublished: n.date, url: `${SITE}/news/#v${n.v.replace(/\./g, '-')}`, author: AUTHOR, description: n.text })) }],
  body: `<div class="hero"><p class="kicker">Updates</p><h1>What's new</h1><p class="lede">SHIPSHAPE updates itself: open it and the newest version loads. Follow along with the <a href="/feed.xml">Atom feed</a>.</p></div>
${NEWS.map(n => `<article class="item" id="v${n.v.replace(/\./g, '-')}" aria-labelledby="v${n.v.replace(/\./g, '-')}-h"><h2 id="v${n.v.replace(/\./g, '-')}-h">${esc(n.title)}</h2><p class="note">Version ${n.v} · <time datetime="${n.date}">${n.date}</time></p><p>${esc(n.text)}</p>${n.link ? `<p><a href="${n.link}">Take a look</a></p>` : ''}</article>`).join('\n')}`,
  md: `# What's new in SHIPSHAPE\n\n${NEWS.map(n => `## ${n.v} (${n.date}): ${n.title}\n\n${n.text}`).join('\n\n')}`,
});

// ---- FAQ
const FAQ = EN.faq.items;
pages.push({
  path: '/faq/', nav: '/faq/', priority: 0.8, key: 'faq',
  title: EN.faq.title,
  description: clip(EN.faq.description),
  crumbs: [['/', 'SHIPSHAPE'], ['/faq/', 'FAQ']],
  ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `<div class="hero"><p class="kicker">FAQ</p><h1>Questions and answers</h1></div>
${FAQ.map(([q, a], i) => `<details class="faq"${i < 3 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}`,
  md: `# SHIPSHAPE: questions and answers\n\n${FAQ.map(([q, a]) => `## ${q}\n\n${a}`).join('\n\n')}`,
});

// ---- About
const ABOUT = EN.about;
pages.push({
  path: '/about/', nav: '/about/', priority: 0.7, key: 'about',
  title: 'About SHIPSHAPE · a free ship-handling simulator by Captain Kal.M',
  description: clip(ABOUT.what),
  crumbs: [['/', 'SHIPSHAPE'], ['/about/', 'About']],
  ld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About SHIPSHAPE', url: `${SITE}/about/`, mainEntity: { '@type': 'Person', name: 'Kal.M', jobTitle: 'Captain', description: 'Ship\'s captain and maritime systems enthusiast, developer of SHIPSHAPE.', sameAs: ['https://www.instagram.com/snowskyz/'] } }],
  body: `<div class="hero"><p class="kicker">About</p><h1>About SHIPSHAPE</h1><p class="lede">${esc(ABOUT.what)}</p>
<div class="cta"><a class="btn primary" href="/">Open the simulator</a></div></div>
<h2>Why it exists</h2><p>${esc(ABOUT.why)}</p>
<h2>What is modelled</h2><p>${esc(ABOUT.model)}</p>
<h2>Charts and data</h2><ul>${places.filter(p => p.id !== 'practice' && p.id !== 'open-water').map(p => `<li><b>${esc(p.name)}.</b> ${esc(p.chart)}</li>`).join('')}</ul>
<p class="note">SHIPSHAPE is for training and enjoyment only. It is not a navigational aid and its charts must not be used for navigation.</p>
<h2>Accessibility</h2><p>These pages are written to WCAG 2.2 AA: they work with a keyboard and a screen reader, follow the system's light or dark setting, respect reduced motion, and keep text contrast at AA or better. The simulator itself is a visual, real-time instrument; its controls have labels and keyboard shortcuts, and every readout is also given in text. If something gets in your way, please say so through the contact below.</p>
<h2>Privacy</h2><p>No account, no cookies and no personal data. Where anonymous counts are switched on, only aggregated figures are kept (visits, which ships and places are opened, and a rough band of how often people come back), and the setting can be turned off in the menu.</p>
<h2>Who made it</h2><p>SHIPSHAPE is developed by <b>Kal.M</b>, a ship's captain and maritime systems enthusiast. Questions, feedback or collaborations: Instagram <a href="https://www.instagram.com/snowskyz/" rel="noopener">@snowskyz</a>. The source is on <a href="${REPO}">GitHub</a>.</p>
<h2>Citing SHIPSHAPE</h2><p>If you use SHIPSHAPE in teaching, writing or research, please cite it as:</p><p><cite>Kal.M (${TODAY.slice(0, 4)}). SHIPSHAPE: a ship-handling simulator for the web (version ${pkg.version}). ${SITE}/</cite></p>
<h2>Credits</h2><p>Typeface Geologica, by the Geologica Project Authors, under the SIL Open Font License 1.1. Chart data from NOAA, Rijkswaterstaat, EMODnet and OpenStreetMap contributors (ODbL). 3D ship models are credited by name in the simulator's menu.</p>`,
  md: `# About SHIPSHAPE\n\n${ABOUT.what}\n\n## Why it exists\n\n${ABOUT.why}\n\n## What is modelled\n\n${ABOUT.model}\n\n## Who made it\n\nDeveloped by Kal.M, a ship's captain and maritime systems enthusiast.\n\nNot for navigation.`,
});

// ---- Skills, in every language
const scenarioById = (id: string) => SCENARIOS.find(s => s.id === id)!;
const scenarioPath = (s: Scenario) => `/places/${placeOf(s).id}/${s.id}/`;
for (const L of LOCALES) {
  const u = L.ui, P = pre(L.code), home: [string, string] = [L.code === 'en' ? '/' : `/${L.code}/`, 'SHIPSHAPE'];
  const enNote = L.code === 'en' ? '' : `<p class="note">${esc(u.appNote)}</p>`;
  const S = L.skills;
  pages.push({
    path: `${P}/skills/`, nav: `${P}/skills/`, priority: 0.8, lang: L.code, key: 'skills',
    title: S.title, description: clip(S.description),
    image: shot('places/split-medmoor.jpg', `${S.items['mediterranean-mooring'].title}: SHIPSHAPE`),
    crumbs: [home, [`${P}/skills/`, u.skills]],
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: S.h1, url: `${SITE}${P}/skills/`, hasPart: SKILLS.map(k => ({ '@type': 'LearningResource', name: S.items[k.id].title, url: `${SITE}${P}/skills/${k.id}/` })) }],
    body: `<div class="hero"><p class="kicker">${esc(u.skills)}</p><h1>${esc(S.h1)}</h1><p class="lede">${esc(S.lede ?? '')}</p></div>
<ul class="grid">${SKILLS.map(k => `<li><div class="card"><h2><a href="${P}/skills/${k.id}/">${esc(S.items[k.id].title)}</a></h2><p>${esc(S.items[k.id].lede)}</p></div></li>`).join('')}</ul>`,
    md: `# ${S.h1}\n\n${SKILLS.map(k => `- [${S.items[k.id].title}](${SITE}${P}/skills/${k.id}/): ${S.items[k.id].lede}`).join('\n')}`,
  });
  for (const k of SKILLS) {
    const t = S.items[k.id], scs = k.scenarios.map(scenarioById), first = scs[0];
    const im = shot(`places/${first.id}.jpg`, `${t.title}: ${first.name}, SHIPSHAPE`);
    const body = `<div class="hero"><p class="kicker">${esc(u.skills)}</p><h1>${esc(t.title)}</h1><p class="lede">${esc(t.lede)}</p>
<div class="cta"><a class="btn primary" href="${app({ scenario: first.id, ship: first.ship })}">${esc(u.openSim)}</a><a class="btn" href="${P}/skills/">${esc(S.h1)}</a></div></div>
${figure(im)}
<h2>${esc(u.whatItIs)}</h2>${t.what.map(x => `<p>${esc(x)}</p>`).join('')}
<h2>${esc(u.howTo)}</h2><ol>${t.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
<h2>${esc(u.practise)}</h2>${enNote}
<ul>${scs.map(x => `<li><a href="${scenarioPath(x)}" hreflang="en">${esc(x.name)}</a> · <a href="${app({ scenario: x.id, ship: x.ship })}">${esc(u.open)}</a></li>`).join('')}</ul>
<h2>${esc(u.ships)}</h2><ul>${k.ships.map(id => `<li><a href="/ships/${id}/" hreflang="en">${esc(SHIPS[id].name)}</a></li>`).join('')}</ul>
<h2>${esc(u.terms)}</h2><ul>${k.terms.map(id => `<li><a href="${glossaryPath(L.code)}#${id}">${esc(L.glossary.items[id].term)}</a></li>`).join('')}</ul>
${k.guide ? `<h2>${esc(u.guide)}</h2><p><a href="${k.guide}" hreflang="en">${esc(EN.ui.learn)}: ${esc(TRACKS.find(tr => `/learn/${tr.slug}/` === k.guide)!.title)}</a>${L.code === 'en' ? '' : ` (${esc(u.english)})`}</p>` : ''}
<h2>${esc(u.moreSkills)}</h2><ul>${SKILLS.filter(o => o !== k).map(o => `<li><a href="${P}/skills/${o.id}/">${esc(S.items[o.id].title)}</a></li>`).join('')}</ul>`;
    pages.push({
      path: `${P}/skills/${k.id}/`, nav: `${P}/skills/`, priority: 0.8, lang: L.code, key: `skill:${k.id}`, image: im,
      title: `${t.title} · ${S.h1} · SHIPSHAPE`, description: clip(`${t.lede} ${t.what[0]}`),
      crumbs: [home, [`${P}/skills/`, u.skills], [`${P}/skills/${k.id}/`, t.title]],
      ld: [
        { '@context': 'https://schema.org', '@type': 'LearningResource', name: t.title, description: t.lede, url: `${SITE}${P}/skills/${k.id}/`, learningResourceType: 'Guide', isAccessibleForFree: true, author: AUTHOR, teaches: t.title },
        { '@context': 'https://schema.org', '@type': 'HowTo', name: t.title, description: t.lede, inLanguage: L.code, step: t.steps.map((x, i) => ({ '@type': 'HowToStep', position: i + 1, text: x })) },
      ],
      body, md: `# ${t.title}\n\n${t.lede}\n\n${t.what.join('\n\n')}\n\n${t.steps.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n${scs.map(x => `- ${x.name}: ${SITE}${app({ scenario: x.id, ship: x.ship })}`).join('\n')}`,
    });
  }
}

// ---- The translated pages: a home page, About, FAQ, places and the glossary in each language
const realPlaces = places.filter(p => p.id !== 'practice' && p.id !== 'open-water');
for (const L of LOCALES.filter(l => l.code !== 'en')) {
  const u = L.ui, P = pre(L.code), home: [string, string] = [`${P}/`, 'SHIPSHAPE'], H = L.home!;
  const note = `<p class="note">${esc(u.appNote)}</p>`;
  pages.push({
    path: `${P}/`, priority: 0.9, lang: L.code, key: 'home', title: H.title, description: clip(H.description),
    image: shot('places/split-medmoor.jpg', `${L.skills.items['mediterranean-mooring'].title} · Split · SHIPSHAPE`),
    ld: [{ '@context': 'https://schema.org', '@type': 'WebPage', name: H.title, url: `${SITE}${P}/`, description: H.description, about: { '@id': `${SITE}/#app` }, author: AUTHOR }],
    body: `<div class="hero"><p class="kicker">${esc(H.kicker)}</p><h1>${esc(H.h1)}</h1><p class="lede">${esc(H.lede ?? '')}</p>
<div class="cta"><a class="btn primary" href="/">${esc(u.openSim)}</a><a class="btn" href="${P}/about/">${esc(u.about)}</a></div>${note}</div>
${figure(shot('places/split-medmoor.jpg', `${L.skills.items['mediterranean-mooring'].title} · Split · SHIPSHAPE`))}
<ul>${H.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>${esc(L.skills.h1)}</h2>
<ul class="grid">${SKILLS.map(k => `<li><div class="card"><h3><a href="${P}/skills/${k.id}/">${esc(L.skills.items[k.id].title)}</a></h3><p>${esc(L.skills.items[k.id].lede)}</p></div></li>`).join('')}</ul>
<h2>${esc(L.places.h1)}</h2>
<ul>${places.map(p => `<li><a href="${P}/places/#${p.id}">${esc(L.places.items[p.id].name)}</a></li>`).join('')}</ul>
<p><a href="${glossaryPath(L.code)}">${esc(L.glossary.h1)}</a> · <a href="${P}/faq/">${esc(L.faq.h1)}</a></p>`,
    md: `# ${H.h1}\n\n${H.lede}\n\n${H.points.map(x => `- ${x}`).join('\n')}`,
  });
  const A = L.about;
  pages.push({
    path: `${P}/about/`, nav: `${P}/about/`, priority: 0.6, lang: L.code, key: 'about', title: A.title, description: clip(A.description),
    crumbs: [home, [`${P}/about/`, u.about]],
    ld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: A.h1, url: `${SITE}${P}/about/`, mainEntity: { '@type': 'Person', name: 'Kal.M', jobTitle: 'Captain', sameAs: ['https://www.instagram.com/snowskyz/'] } }],
    body: `<div class="hero"><p class="kicker">${esc(u.about)}</p><h1>${esc(A.h1)}</h1><p class="lede">${esc(A.what)}</p>
<div class="cta"><a class="btn primary" href="/">${esc(u.openSim)}</a></div>${note}</div>
<h2>${esc(A.h.why)}</h2><p>${esc(A.why)}</p>
<h2>${esc(A.h.model)}</h2><p>${esc(A.model)}</p>
<h2>${esc(A.h.data)}</h2><ul>${realPlaces.map(p => `<li><b>${esc(L.places.items[p.id].name)}.</b> ${esc(L.places.items[p.id].chart)}</li>`).join('')}</ul>
<p class="note">${esc(u.notNav)}</p>
<h2>${esc(A.h.access)}</h2><p>${esc(A.access)}</p>
<h2>${esc(A.h.privacy)}</h2><p>${esc(A.privacy)}</p>
<h2>${esc(A.h.who)}</h2><p>${esc(A.who)} Instagram <a href="https://www.instagram.com/snowskyz/" rel="noopener">@snowskyz</a> · <a href="${REPO}">GitHub</a></p>
<h2>${esc(A.h.cite)}</h2><p>${esc(A.citeIntro)}</p><p><cite>Kal.M (${CTX.year}). SHIPSHAPE: a ship-handling simulator for the web (version ${pkg.version}). ${SITE}/</cite></p>
<h2>${esc(A.h.credits)}</h2><p>${esc(A.credits)}</p>`,
    md: `# ${A.h1}\n\n${A.what}\n\n## ${A.h.why}\n\n${A.why}\n\n## ${A.h.model}\n\n${A.model}`,
  });
  pages.push({
    path: `${P}/faq/`, nav: `${P}/faq/`, priority: 0.7, lang: L.code, key: 'faq', title: L.faq.title, description: clip(L.faq.description),
    crumbs: [home, [`${P}/faq/`, u.faq]],
    ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: L.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
    body: `<div class="hero"><p class="kicker">${esc(u.faq)}</p><h1>${esc(L.faq.h1)}</h1></div>
${L.faq.items.map(([q, a], i) => `<details class="faq"${i < 3 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}`,
    md: `# ${L.faq.h1}\n\n${L.faq.items.map(([q, a]) => `## ${q}\n\n${a}`).join('\n\n')}`,
  });
  pages.push({
    path: `${P}/places/`, nav: `${P}/places/`, priority: 0.7, lang: L.code, key: 'places', title: L.places.title, description: clip(L.places.description),
    image: shot('places/split-medmoor.jpg', `Split · SHIPSHAPE`),
    crumbs: [home, [`${P}/places/`, u.places]],
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: L.places.h1, url: `${SITE}${P}/places/` }],
    body: `<div class="hero"><p class="kicker">${esc(u.places)}</p><h1>${esc(L.places.h1)}</h1><p class="lede">${esc(L.places.lede ?? '')}</p>${note}</div>
${places.map(p => { const t = L.places.items[p.id]; return `<section class="item" id="${p.id}" aria-labelledby="${p.id}-h"><h2 id="${p.id}-h">${esc(t.name)}</h2>
<p>${esc(t.about)}</p><p class="note">${esc(t.chart)}</p>
<ul>${p.scenarios.map(x => `<li><a href="${scenarioPath(x)}" hreflang="en">${esc(x.name)}</a> · <a href="${app({ scenario: x.id, ship: x.ship })}">${esc(u.open)}</a></li>`).join('')}</ul></section>`; }).join('\n')}`,
    md: `# ${L.places.h1}\n\n${places.map(p => `## ${L.places.items[p.id].name}\n\n${L.places.items[p.id].about}`).join('\n\n')}`,
  });
  const G = L.glossary;
  const seeLabel = (h: string) => { const m = /^\/ships\/([^/]+)\//.exec(h); if (m) return SHIPS[m[1]]?.name ?? h; const s = /^\/places\/[^/]+\/([^/]+)\//.exec(h); if (s) return scenarioById(s[1]).name; return `${u.learn} (${u.english})`; };
  pages.push({
    path: glossaryPath(L.code), nav: glossaryPath(L.code), priority: 0.7, lang: L.code, key: 'glossary', title: G.title, description: clip(G.description),
    crumbs: [home, [glossaryPath(L.code), u.glossary]],
    ld: [{ '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': `${SITE}${glossaryPath(L.code)}`, name: G.h1, url: `${SITE}${glossaryPath(L.code)}`,
      hasDefinedTerm: GLOSSARY.map(t => ({ '@type': 'DefinedTerm', '@id': `${SITE}${glossaryPath(L.code)}#${t.id}`, name: G.items[t.id].term, ...(G.items[t.id].also ? { alternateName: G.items[t.id].also } : {}), description: G.items[t.id].def, inDefinedTermSet: `${SITE}${glossaryPath(L.code)}` })) }],
    body: `<div class="hero"><p class="kicker">${esc(u.learn)}</p><h1>${esc(G.h1)}</h1><p class="lede">${esc(G.lede ?? '')}</p></div>
<nav aria-label="${esc(u.glossary)}"><p class="toc">${GLOSSARY.map(t => `<a href="#${t.id}">${esc(G.items[t.id].term)}</a>`).join('<br />')}</p></nav>
<dl class="glossary">${GLOSSARY.map(t => { const g = G.items[t.id]; return `<div id="${t.id}"><dt>${esc(g.term)}${g.also?.length ? ` <span class="note">(${esc(g.also.join(', '))})</span>` : ''}</dt><dd><p>${esc(g.def)}</p>${t.see ? `<p class="note">${esc(u.see)}: ${t.see.map(([h]) => `<a href="${h}" hreflang="en">${esc(seeLabel(h))}</a>`).join(' · ')}</p>` : ''}</dd></div>`; }).join('\n')}</dl>`,
    md: `# ${G.h1}\n\n${GLOSSARY.map(t => `**${G.items[t.id].term}**: ${G.items[t.id].def}`).join('\n\n')}`,
  });
}

// ---- 404
const notFound: Page = {
  path: '/404.html', title: 'Page not found · SHIPSHAPE', description: 'This page does not exist.', md: '',
  body: `<div class="hero"><h1>Nothing at this berth</h1><p class="lede">The page you asked for is not here. Try the <a href="/">simulator</a>, the <a href="/ships/">fleet</a>, the <a href="/places/">places</a> or the <a href="/learn/">training guide</a>.</p></div>`,
};

// ---------------------------------------------------------------- write
for (const p of pages) if (p.key) { if (!ALT.has(p.key)) ALT.set(p.key, new Map()); ALT.get(p.key)!.set(p.lang ?? 'en', p.path); }
const write = (rel: string, text: string) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };
for (const p of pages) write(p.path.endsWith('/') ? `${p.path}index.html` : p.path, render(p));
// the simulator is the English home page: point it at its translations too
if (existsSync(join(OUT, 'index.html'))) {
  const homeAlts = [...ALT.get('home')!].map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${SITE}${h}" />`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${SITE}/" />`;
  write('index.html', readFileSync(join(OUT, 'index.html'), 'utf8').replace(/(<link rel="alternate" hreflang[^>]*>\n?)*<\/head>/, homeAlts + '\n</head>'));
}
write('404.html', render(notFound).replace('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />', '<meta name="robots" content="noindex" />'));
mkdirSync(join(OUT, 'site'), { recursive: true });
copyFileSync(join(ROOT, 'site/site.css'), join(OUT, 'site/site.css'));
copyFileSync(join(ROOT, 'src/fonts/geologica-latin-full-normal.woff2'), join(OUT, 'site/geologica.woff2'));

const urls: [string, number][] = [['/', 1], ...pages.map(p => [p.path, p.priority ?? 0.5] as [string, number])];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, pr]) => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod><priority>${pr.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);

// Search engines and AI assistants are all welcome: the site is public and free, and being found is the point.
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'Amazonbot', 'meta-externalagent', 'MistralAI-User', 'cohere-ai', 'CCBot'];
write('robots.txt', `# SHIPSHAPE is a free, public ship-handling simulator. Search engines and AI assistants are welcome to read,
# index and cite every page. A plain-text summary for language models is at /llms.txt.
User-agent: *
Allow: /

${AI_BOTS.map(b => `User-agent: ${b}`).join('\n')}
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

const intro = `SHIPSHAPE is a free ship-handling simulator that runs in a web browser, made by Captain Kal.M. ${total.ships} ships, each with her real propulsion and bridge controls (Azipods, telegraph and wheel, controllable-pitch propellers, tug drives, waterjets, dynamic positioning), in ${listing(realNames)} on real charts and in practice harbours, with wind, current, shallow water, tugs, mooring lines, anchors and a working sea lock. No account, no cost, works offline as an installable app. For training and enjoyment only, not for navigation.`;
write('llms.txt', `# SHIPSHAPE

> ${intro}

The simulator is at ${SITE}/ . Deep links open a scenario with a given ship: ${SITE}/?scenario=<scenario id>&ship=<ship id>, optionally &view=2d|split|3d and &tod=day|dusk|night.

## Pages

- [About](${SITE}/about/): what SHIPSHAPE is, what it models, data sources and who made it
- [FAQ](${SITE}/faq/): common questions, cost, offline use, realism, training use, privacy
- [Fleet](${SITE}/ships/): all ${total.ships} ships with particulars and controls
- [Places](${SITE}/places/): ${listing(realNames)}, practice harbours and open-water exercises
- [Learn](${SITE}/learn/): the sourced training guide on Azipods, tugs and specialised propulsion
- [Skills](${SITE}/skills/): ${SKILLS.length} ship-handling skills explained step by step, each with scenarios to practise
- [Glossary](${SITE}/learn/glossary/): ${GLOSSARY.length} ship-handling terms defined in plain English
- [What's new](${SITE}/news/): dated release notes (Atom feed at ${SITE}/feed.xml)

## Ships

${ships.map(s => `- [${s.name}](${SITE}/ships/${s.id}/): ${typeOf(s)}, ${shipLine(s)}`).join('\n')}

## Places

${places.map(p => `### [${p.name}](${SITE}/places/${p.id}/)\n\n${p.scenarios.map(s => `- [${s.name}](${SITE}/places/${p.id}/${s.id}/): ${clip(s.brief, 200)}`).join('\n')}`).join('\n\n')}

## Learn

${TRACKS.map(t => `- [${t.title}](${SITE}/learn/${t.slug}/): ${t.lede}`).join('\n')}

## Skills

${SKILLS.map(k => `- [${EN.skills.items[k.id].title}](${SITE}/skills/${k.id}/): ${EN.skills.items[k.id].lede}`).join('\n')}

## Other languages

The reading pages (home, about, FAQ, places, skills, glossary) are also in ${LOCALES.filter(l => l.code !== 'en').map(l => `[${l.name}](${SITE}/${l.code}/)`).join(', ')}.

## Optional

- [Full text of every page](${SITE}/llms-full.txt)
- [Source code](${REPO})
`);
write('llms-full.txt', `# SHIPSHAPE: full text\n\n> ${intro}\n\n${pages.map(p => p.md).join('\n\n---\n\n')}\n`);
write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
write('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>SHIPSHAPE: what's new</title>
  <subtitle>Updates to SHIPSHAPE, the free ship-handling simulator for the web.</subtitle>
  <link href="${SITE}/feed.xml" rel="self" />
  <link href="${SITE}/news/" />
  <id>${SITE}/news/</id>
  <updated>${NEWS[0].date}T00:00:00Z</updated>
  <author><name>Kal.M</name></author>
  <icon>${SITE}/favicon.svg</icon>
${NEWS.map(n => `  <entry>
    <title>${esc(`${n.v}: ${n.title}`)}</title>
    <link href="${SITE}/news/#v${n.v.replace(/\./g, '-')}" />
    <id>${SITE}/news/#v${n.v.replace(/\./g, '-')}</id>
    <updated>${n.date}T00:00:00Z</updated>
    <summary>${esc(n.text)}</summary>
  </entry>`).join('\n')}
</feed>
`);
if (existsSync(join(ROOT, 'site/img'))) cpSync(join(ROOT, 'site/img'), join(OUT, 'site/img'), { recursive: true });

// every link between the pages must land on a page and, where it names one, an anchor that exists
const known = new Set(['/', '/feed.xml', '/shipshape-offline.html', ...pages.map(p => p.path)]);
const ids = new Map(pages.map(p => [p.path, new Set([...p.body.matchAll(/ id="([^"]+)"/g)].map(m => m[1]))]));
const broken: string[] = [];
for (const p of pages) for (const [, href] of p.body.matchAll(/href="(\/[^"?]*)(?:\?[^"]*)?"/g)) {
  const [path, hash] = href.split('#');
  if (!known.has(path)) broken.push(`${p.path} → ${href}`);
  else if (hash && !ids.get(path)?.has(hash)) broken.push(`${p.path} → ${href} (no such anchor)`);
}
if (broken.length) { console.error('broken links:\n' + broken.join('\n')); process.exit(1); }

// the service worker answers navigations with the app unless vite.config.ts lists the section: check every one is listed
const deny = /navigateFallbackDenylist: \[\/\^\\\/\(([a-z|]+)\)/.exec(readFileSync(join(ROOT, 'vite.config.ts'), 'utf8'))?.[1].split('|') ?? [];
const missing = [...new Set(pages.map(p => p.path.split('/')[1]))].filter(sec => !deny.includes(sec));
if (missing.length) { console.error(`add to navigateFallbackDenylist in vite.config.ts: ${missing.join(', ')}`); process.exit(1); }
write('site/urls.txt', urls.map(([u]) => SITE + u).join('\n') + '\n');
console.log(`site: ${pages.length} pages, sitemap of ${urls.length} URLs, llms.txt, robots.txt → ${OUT}`);
