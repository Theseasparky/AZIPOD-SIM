// Writes the reading pages beside the built app: About, the fleet (a page per ship), the places (a page per
// port), Learn (the training guide), the FAQ, and the files search engines and AI assistants read (sitemap,
// robots, llms.txt). Everything is generated from the simulator's own data, so the pages cannot drift from it.
// Run after `vite build`:  tsx scripts/site.ts [outDir]   (default dist)
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? join(ROOT, 'dist');
const SITE = (process.env.SITE_URL ?? 'https://shipshape.skipjack.app').replace(/\/$/, '');
const REPO = process.env.REPO_URL ?? 'https://github.com/Theseasparky/AZIPOD-SIM';
/** IndexNow key: a public token that proves to Bing, Yandex and the others that this site may announce its own pages. */
export const INDEXNOW_KEY = '8b8f8d6d1f88d4f02f414e14dbea8c38';
const TODAY = new Date().toISOString().slice(0, 10);
const AUTHOR = { '@type': 'Person', name: 'Khalil Mahboub', jobTitle: 'Captain', url: `${SITE}/about/` };

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

interface Page { path: string; title: string; description: string; body: string; ld?: object[]; md: string; nav?: string; crumbs?: [string, string][]; priority?: number }
const pages: Page[] = [];

const NAV: [string, string][] = [['/', 'Simulator'], ['/ships/', 'Fleet'], ['/places/', 'Places'], ['/learn/', 'Learn'], ['/faq/', 'FAQ'], ['/about/', 'About']];

function crumbsLd(c: [string, string][]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: c.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href })) };
}

function render(p: Page) {
  const url = SITE + p.path;
  const crumbs: [string, string][] = p.crumbs ?? [];
  const ld = [...(p.ld ?? []), ...(crumbs.length > 1 ? [crumbsLd(crumbs)] : [])];
  const nav = NAV.map(([h, t]) => `<li><a href="${h}"${p.nav === h ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
  const crumbHtml = crumbs.length > 1
    ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([h, t], i) => `<li>${i === crumbs.length - 1 ? `<span aria-current="page">${esc(t)}</span>` : `<a href="${h}">${esc(t)}</a>`}</li>`).join('')}</ol></nav>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}" />
<link rel="canonical" href="${url}" />
<meta name="author" content="Khalil Mahboub" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="SHIPSHAPE" />
<meta property="og:title" content="${esc(p.title)}" />
<meta property="og:description" content="${esc(p.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="SHIPSHAPE: a cruise ship's conning readouts, the harbour chart and the Azipod controls" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${SITE}/og.png" />
<meta name="theme-color" content="#f7f9fa" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#06121a" media="(prefers-color-scheme: dark)" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="/site/site.css" />
<link rel="alternate" type="text/plain" title="SHIPSHAPE for language models" href="/llms.txt" />
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="brand" href="/">SHIPSHAPE</a>
<nav class="main" aria-label="Main"><ul>${nav}</ul></nav>
</div></header>
<div class="wrap">${crumbHtml}</div>
<main id="main" class="wrap" tabindex="-1">
${p.body}
</main>
<footer class="site"><div class="wrap">
<p>SHIPSHAPE ${pkg.version} · a free ship-handling simulator by Khalil Mahboub. For training and enjoyment only: not for navigation.</p>
<nav aria-label="Footer"><ul>${NAV.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="/shipshape-offline.html">Offline copy</a></li><li><a href="${REPO}">Source on GitHub</a></li></ul></nav>
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
const PLACE_TEXT: Record<string, { about: string; chart: string }> = {
  miami: {
    about: 'PortMiami sits on Dodge and Lummus Islands in Biscayne Bay, reached from the Atlantic through Government Cut. It is one of the busiest cruise ports in the world, and its long turning basin, the narrow cut between the jetties and the cross-set off the beach make it a good test of slow-speed control.',
    chart: 'Depths, land, buoys and lights from the NOAA electronic navigational charts (ENC) of the area, with the cruise and cargo berths built from the chart\'s own berth and shoreline features.',
  },
  lalb: {
    about: 'The San Pedro Bay ports, Los Angeles and Long Beach, together handle more containers than any other port complex in the Americas. Ships come in through Angels Gate or Queen\'s Gate in the breakwater, so the scenarios here cover the largest ships in the fleet: a 400 m container ship, a laden VLCC and a cruise ship.',
    chart: 'Depths, breakwaters, aids to navigation and berths from the NOAA electronic navigational charts of the San Pedro Bay area.',
  },
  ijmuiden: {
    about: 'IJmuiden is the Dutch North Sea entrance to the Noordzeekanaal and Amsterdam. The Zeesluis IJmuiden, opened in 2022, is one of the largest sea locks in the world, and the scenarios here work it in both directions with the real difference in water level between the sea and the canal.',
    chart: 'Inland ENC and survey depths from Rijkswaterstaat, with EMODnet bathymetry offshore. The lock runs as a working lock: gates, levels and traffic lights.',
  },
  split: {
    about: 'Split is Croatia\'s largest passenger port: car ferries to the Dalmatian islands, fast catamarans and cruise ships share one compact harbour behind a breakwater, a short walk from Diocletian\'s Palace. The tight basin, the mix of traffic and the stern-to mooring on the city quay make it ideal for practising Mediterranean mooring with anchors.',
    chart: 'Built from open data: the coastline, piers and breakwater from OpenStreetMap, offshore depths from EMODnet, and depths alongside from the port\'s published berth figures. The depths are approximate and this is not an official chart.',
  },
  practice: {
    about: 'Purpose-built harbours and channels for learning one thing at a time: landing alongside, turning in a basin, keeping a channel in bank effect, meeting another ship, a tanker jetty, a river bend with current, and a fast-ferry entrance at speed.',
    chart: 'Drawn for the exercise, with depths, banks and berths chosen to make the lesson clear.',
  },
  'open-water': {
    about: 'No harbour at all: trials in deep water, anchoring in an open roadstead, escorting a laden tanker as the tug, breaking ice, sailing with rotor sails, and holding position on dynamic positioning beside a platform.',
    chart: 'Open water with the conditions each exercise needs.',
  },
};
const places: Place[] = [];
for (const s of SCENARIOS) {
  const id = s.area ?? (OPEN_WATER.has(s.id) ? 'open-water' : 'practice');
  let p = places.find(x => x.id === id);
  if (!p) {
    const name = s.area ? AREAS[s.area].meta.name : id === 'open-water' ? 'Open water and special operations' : 'Practice harbours and channels';
    const short = ({ miami: 'PortMiami', split: 'Split', lalb: 'Los Angeles & Long Beach', ijmuiden: 'IJmuiden & Amsterdam' } as Record<string, string>)[s.area ?? ''] ?? name;
    p = { id, name, short, ...PLACE_TEXT[id], scenarios: [] };
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
    path: '/ships/', nav: '/ships/', priority: 0.9,
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
  const sc = (x: Scenario) => `<li><a href="/places/${placeOf(x).id}/#${x.id}">${esc(x.name)}</a> · <a href="${app({ scenario: x.id, ship: s.id })}">open with her</a></li>`;
  const body = `<div class="hero"><p class="kicker">${esc(typeOf(s))}</p><h1>${esc(s.name)}</h1>
<p class="lede">${esc(shipLine(s))}.</p>
<div class="cta"><a class="btn primary" href="${app({ ship: s.id, scenario: own[0]?.id })}">Handle her in the simulator</a><a class="btn" href="/ships/">The whole fleet</a></div></div>
<h2>Particulars</h2>
<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
${s.note ? `<h2>About the model</h2><p>${esc(s.note)}</p>` : ''}
${own.length ? `<h2>Scenarios written for her</h2><ul>${own.map(sc).join('')}</ul>` : ''}
${also.length ? `<h2>She also fits</h2><p>Any ship can be loaded into any scenario; these practice areas have water enough for her draught.</p><ul>${also.map(sc).join('')}</ul>` : ''}
${guide.length ? `<h2>From the training guide</h2><ul>${guide.map(it => `<li><a href="/learn/${TRACKS.find(t => t.id === it.track)!.slug}/#${it.id}">${esc(it.title)}</a></li>`).join('')}</ul>` : ''}
${sister.length ? `<h2>Same hull, other conditions</h2><ul>${sister.map(o => `<li><a href="/ships/${o.id}/">${esc(o.name)}</a></li>`).join('')}</ul>` : ''}`;
  const md = `# ${s.name}\n\n${typeOf(s)}. ${shipLine(s)}.\n\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n${s.note ?? ''}\n\nOpen in the simulator: ${SITE}${app({ ship: s.id, scenario: own[0]?.id })}${own.length ? `\n\nScenarios written for her: ${own.map(x => x.name).join('; ')}.` : ''}`;
  pages.push({
    path: `/ships/${s.id}/`, nav: '/ships/', priority: 0.7,
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
    path: '/places/', nav: '/places/', priority: 0.9,
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
  return `<article class="item" id="${s.id}" aria-labelledby="${s.id}-h"><h3 id="${s.id}-h">${esc(s.name)}</h3>
<p>${esc(s.brief)}</p>
<dl class="facts"><dt>Ship</dt><dd><a href="/ships/${sp.id}/">${esc(sp.name)}</a></dd><dt>Wind</dt><dd>${wind(s)}</dd><dt>Current</dt><dd>${current(s)}</dd><dt>Depth</dt><dd>${depth(s)}</dd><dt>Start</dt><dd>${num(s.start.kn, 1)} kn on ${String(Math.round(s.start.psi)).padStart(3, '0')}°</dd></dl>
<div class="cta"><a class="btn primary" href="${app({ scenario: s.id, ship: sp.id })}">Open this scenario</a></div></article>`;
}).join('\n')}`;
    pages.push({
      path: `/places/${p.id}/`, nav: '/places/', priority: 0.8,
      title: `${p.name} ship-handling scenarios · SHIPSHAPE simulator`,
      description: clip(`${p.name} in a free ship-handling simulator: ${p.scenarios.map(s => s.name.replace(/^[^·]*· /, '')).join(', ')}.`),
      crumbs: [['/', 'SHIPSHAPE'], ['/places/', 'Places'], [`/places/${p.id}/`, p.name]],
      ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${p.name} scenarios`, url: `${SITE}/places/${p.id}/`, description: p.about, ...(geo ? { about: geo } : {}), mainEntity: { '@type': 'ItemList', itemListElement: p.scenarios.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${SITE}/places/${p.id}/#${s.id}` })) } }],
      body,
      md: `# ${p.name}\n\n${p.about}\n\nChart: ${p.chart}\n\n${p.scenarios.map(s => `## ${s.name}\n\n${s.brief}\n\n- Ship: ${shipName(s.ship ?? 'becancour')}\n- Wind: ${wind(s)}\n- Current: ${current(s)}\n- Depth: ${depth(s)}\n- Open: ${SITE}${app({ scenario: s.id, ship: s.ship })}`).join('\n\n')}`,
    });
  }
}

// ---- Learn
{
  const counts = (t: Track) => [CONTENT.cards, CONTENT.procedures, CONTENT.exercises].map(xs => xs.filter(x => x.track === t).length);
  const body = `<div class="hero"><p class="kicker">Learn</p><h1>The training guide</h1>
<p class="lede">The guide inside SHIPSHAPE explains what the ship is doing and why, step by step drills to run on her, and exercises with a debrief. Every statement carries its source: a model test, a standard, a manufacturer's manual or a port's own guidelines, or, where it says so, the simulator's own model.</p>
<div class="cta"><a class="btn primary" href="/">Open the simulator</a></div></div>
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

// ---- FAQ
const FAQ: [string, string][] = [
  ['What is SHIPSHAPE?', `SHIPSHAPE is a free ship-handling simulator that runs in a web browser. You take the controls of one of ${total.ships} ships, each with the propulsion and the bridge controls her crew would use, and bring her alongside, through a lock, out to an anchorage or into a tight harbour, in wind, current and shallow water.`],
  ['Is it free?', 'Yes. There is no account, no subscription and no advertising. It opens straight in the browser.'],
  ['Do I need to install anything?', 'No. It runs in any modern browser on a phone, tablet or computer. You can also install it as an app from the browser (Add to Home Screen, or Install in the address bar), and it then works offline. A single-file offline copy is also available at /shipshape-offline.html.'],
  ['Which ships can I handle?', `${total.ships} in all: Azipod cruise ships and an expedition yacht, a twin-screw cruise ship and a superyacht, a Ro-Pax ferry and a fast catamaran, a VLCC, a product tanker, container ships up to 24 000 TEU, a Panamax bulk carrier (with and without rotor sails), an LNG carrier, ASD, Voith and rotor tugs, a platform supply vessel and an anchor-handling tug on DP, an icebreaker, a frigate and a Rhine push convoy. See the fleet page for each one.`],
  ['Which ports are in it?', `${listing(total.real.map(p => p.name))}, on their real charts, plus practice harbours and channels and open-water exercises. ${total.scenarios} scenarios in all.`],
  ['Are the charts real?', 'The US ports use NOAA electronic navigational charts, and IJmuiden and the Noordzeekanaal use Rijkswaterstaat charts and survey with EMODnet bathymetry offshore. Split is built from open data (OpenStreetMap, EMODnet and the port\'s published depths alongside) and its depths are approximate. None of it is for navigation.'],
  ['How realistic is the ship behaviour?', 'Hull forces come from published manoeuvring models: the MMG captive-test coefficients for the KVLCC2 and KCS benchmark hulls, and published regressions for the others. The model includes shallow water, bank effect, ship-to-ship interaction, wind and current, propeller and rudder interaction, tugs, mooring lines and anchors, and the speed, turning and stopping results are checked against published trials and the IMO manoeuvring standards. It is a training aid, not a certified simulator.'],
  ['Can I use it for training?', 'It is meant for practice and familiarisation: learning how a podded ship, a tug, a controllable-pitch propeller or a direct-reversing engine behaves before you meet it for real, and rehearsing a port. It is not approved simulator time under STCW, and it does not replace training with an instructor.'],
  ['How do I handle an Azipod ship?', 'Each pod is an electric motor that can turn all the way round, so thrust can point anywhere. SHIPSHAPE gives each pod an rpm lever and an azimuth dial, plus a joystick that sets both for you. The Learn pages explain crash stops by turning the pods round, the reverse interlock, walking her sideways and where she pivots.'],
  ['Can I practise Mediterranean mooring?', 'Yes. Every ship carries two bow anchors, and several carry a stern anchor. The Split scenario "Mediterranean moor, stern-to" has you let go both bow anchors and back a 90 m superyacht onto the city quay, then send stern lines ashore. There is also an open anchorage to practise anchoring anywhere.'],
  ['Does it work on a phone?', 'Yes. The controls are made for touch, with + and − buttons for exact rpm and 5° steps of rudder or azimuth. On a computer the keyboard drives the main controls; the keys are listed in the menu.'],
  ['Does it collect my data?', 'No personal data. If anonymous counts are switched on, the site sends only aggregated figures (a visit, which ship and scenario were opened, and a rough "how often" band) without cookies or any identifier. It honours Do Not Track and Global Privacy Control, and you can switch it off in the menu.'],
  ['Who made it?', 'SHIPSHAPE is developed by Khalil Mahboub, a ship\'s captain and maritime systems enthusiast.'],
];
pages.push({
  path: '/faq/', nav: '/faq/', priority: 0.8,
  title: 'SHIPSHAPE ship-handling simulator: questions and answers',
  description: clip('Is SHIPSHAPE free? Which ships and ports are in it, how realistic is it, does it work offline and on a phone, and can it be used for training? Answers here.'),
  crumbs: [['/', 'SHIPSHAPE'], ['/faq/', 'FAQ']],
  ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `<div class="hero"><p class="kicker">FAQ</p><h1>Questions and answers</h1></div>
${FAQ.map(([q, a], i) => `<details class="faq"${i < 3 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}`,
  md: `# SHIPSHAPE: questions and answers\n\n${FAQ.map(([q, a]) => `## ${q}\n\n${a}`).join('\n\n')}`,
});

// ---- About
const ABOUT = {
  what: `SHIPSHAPE is a free ship-handling simulator for the web. It puts you on the bridge of ${total.ships} ships, from Azipod cruise ships and harbour tugs to a laden VLCC, and lets you bring them into ${listing(realNames)} on real charts, or practise in purpose-built harbours and open water.`,
  why: 'Ship handling is learned by doing, and good simulator time is scarce and expensive. SHIPSHAPE is meant to make the basics available to anyone with a browser: cadets and officers meeting a new type of propulsion, pilots rehearsing a port, and anyone curious about how a 300 m ship is actually stopped and turned.',
  model: 'Each ship is a three-degree-of-freedom manoeuvring model (surge, sway and yaw, with roll for the ships where heel matters), built from published hull data where it exists: the MMG captive-test coefficients for the KVLCC2 and KCS benchmark hulls, and regression models for the rest. Propellers, rudders, Azipods, azimuth drives, Voith Schneider units, waterjets, rotor sails and thrusters are modelled unit by unit, with shallow water, bank effect, ship-to-ship interaction, wind, current, tugs, mooring lines, anchors and a working sea lock. Results are checked against published trials and the IMO manoeuvring standards.',
};
pages.push({
  path: '/about/', nav: '/about/', priority: 0.7,
  title: 'About SHIPSHAPE · a free ship-handling simulator by Captain Khalil Mahboub',
  description: clip(ABOUT.what),
  crumbs: [['/', 'SHIPSHAPE'], ['/about/', 'About']],
  ld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About SHIPSHAPE', url: `${SITE}/about/`, mainEntity: { '@type': 'Person', name: 'Khalil Mahboub', jobTitle: 'Captain', description: 'Ship\'s captain and maritime systems enthusiast, developer of SHIPSHAPE.', sameAs: ['https://www.instagram.com/snowskyz/'] } }],
  body: `<div class="hero"><p class="kicker">About</p><h1>About SHIPSHAPE</h1><p class="lede">${esc(ABOUT.what)}</p>
<div class="cta"><a class="btn primary" href="/">Open the simulator</a></div></div>
<h2>Why it exists</h2><p>${esc(ABOUT.why)}</p>
<h2>What is modelled</h2><p>${esc(ABOUT.model)}</p>
<h2>Charts and data</h2><ul>${places.filter(p => p.id !== 'practice' && p.id !== 'open-water').map(p => `<li><b>${esc(p.name)}.</b> ${esc(p.chart)}</li>`).join('')}</ul>
<p class="note">SHIPSHAPE is for training and enjoyment only. It is not a navigational aid and its charts must not be used for navigation.</p>
<h2>Accessibility</h2><p>These pages are written to WCAG 2.2 AA: they work with a keyboard and a screen reader, follow the system's light or dark setting, respect reduced motion, and keep text contrast at AA or better. The simulator itself is a visual, real-time instrument; its controls have labels and keyboard shortcuts, and every readout is also given in text. If something gets in your way, please say so through the contact below.</p>
<h2>Privacy</h2><p>No account, no cookies and no personal data. Where anonymous counts are switched on, only aggregated figures are kept (visits, which ships and places are opened, and a rough band of how often people come back), and the setting can be turned off in the menu.</p>
<h2>Who made it</h2><p>SHIPSHAPE is developed by <b>Khalil Mahboub</b>, a ship's captain and maritime systems enthusiast. Questions, feedback or collaborations: Instagram <a href="https://www.instagram.com/snowskyz/" rel="noopener">@snowskyz</a>. The source is on <a href="${REPO}">GitHub</a>.</p>
<h2>Credits</h2><p>Typeface Geologica, by the Geologica Project Authors, under the SIL Open Font License 1.1. Chart data from NOAA, Rijkswaterstaat, EMODnet and OpenStreetMap contributors (ODbL). 3D ship models are credited by name in the simulator's menu.</p>`,
  md: `# About SHIPSHAPE\n\n${ABOUT.what}\n\n## Why it exists\n\n${ABOUT.why}\n\n## What is modelled\n\n${ABOUT.model}\n\n## Who made it\n\nDeveloped by Khalil Mahboub, a ship's captain and maritime systems enthusiast.\n\nNot for navigation.`,
});

// ---- 404
const notFound: Page = {
  path: '/404.html', title: 'Page not found · SHIPSHAPE', description: 'This page does not exist.', md: '',
  body: `<div class="hero"><h1>Nothing at this berth</h1><p class="lede">The page you asked for is not here. Try the <a href="/">simulator</a>, the <a href="/ships/">fleet</a>, the <a href="/places/">places</a> or the <a href="/learn/">training guide</a>.</p></div>`,
};

// ---------------------------------------------------------------- write
const write = (rel: string, text: string) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };
for (const p of pages) write(p.path.endsWith('/') ? `${p.path}index.html` : p.path, render(p));
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

const intro = `SHIPSHAPE is a free ship-handling simulator that runs in a web browser, made by Captain Khalil Mahboub. ${total.ships} ships, each with her real propulsion and bridge controls (Azipods, telegraph and wheel, controllable-pitch propellers, tug drives, waterjets, dynamic positioning), in ${listing(realNames)} on real charts and in practice harbours, with wind, current, shallow water, tugs, mooring lines, anchors and a working sea lock. No account, no cost, works offline as an installable app. For training and enjoyment only, not for navigation.`;
write('llms.txt', `# SHIPSHAPE

> ${intro}

The simulator is at ${SITE}/ . Deep links open a scenario with a given ship: ${SITE}/?scenario=<scenario id>&ship=<ship id>, optionally &view=2d|split|3d and &tod=day|dusk|night.

## Pages

- [About](${SITE}/about/): what SHIPSHAPE is, what it models, data sources and who made it
- [FAQ](${SITE}/faq/): common questions, cost, offline use, realism, training use, privacy
- [Fleet](${SITE}/ships/): all ${total.ships} ships with particulars and controls
- [Places](${SITE}/places/): ${listing(realNames)}, practice harbours and open-water exercises
- [Learn](${SITE}/learn/): the sourced training guide on Azipods, tugs and specialised propulsion

## Ships

${ships.map(s => `- [${s.name}](${SITE}/ships/${s.id}/): ${typeOf(s)}, ${shipLine(s)}`).join('\n')}

## Places

${places.map(p => `- [${p.name}](${SITE}/places/${p.id}/): ${p.scenarios.map(s => s.name).join('; ')}`).join('\n')}

## Learn

${TRACKS.map(t => `- [${t.title}](${SITE}/learn/${t.slug}/): ${t.lede}`).join('\n')}

## Optional

- [Full text of every page](${SITE}/llms-full.txt)
- [Source code](${REPO})
`);
write('llms-full.txt', `# SHIPSHAPE: full text\n\n> ${intro}\n\n${pages.map(p => p.md).join('\n\n---\n\n')}\n`);
write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
write('site/urls.txt', urls.map(([u]) => SITE + u).join('\n') + '\n');
console.log(`site: ${pages.length} pages, sitemap of ${urls.length} URLs, llms.txt, robots.txt → ${OUT}`);
