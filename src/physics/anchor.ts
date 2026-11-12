// Anchors: two bow anchors on every ship and a stern anchor on those that carry one, on chain worked by a
// windlass. The chain is a quasi-static catenary on a level bottom: with slack in it the pull is nil, as the
// ship falls back the chain lifts off the bottom and the horizontal pull rises, and once it is all off the
// bottom it comes taut. The anchor holds up to a multiple of its weight (less on a poor bottom, much less
// when the chain lifts its shank), plus the friction of the chain lying on the bottom; beyond that it drags.
import type { Pt } from './contact';
import type { ShipSpec } from './ship';
import type { DepthField } from './harbour';
import type { ShipState, Wrench } from './sim';
import { pointWorld } from './towline';

export const SHACKLE = 27.5;                       // one shackle (shot) of chain [m]
export const ANCHOR = {
  hold: 4.5,          // holding power of a stockless anchor in good ground, as a multiple of its weight
  holdLifted: 0.3,    // the share left when the chain lifts the shank off the bottom
  chainMu: 1.0,       // friction of chain lying on the bottom, as a share of its weight
  letGo: 2.5,         // chain running out on the brake when let go [m/s]
  walk: 0.17,         // windlass walking out or heaving in [m/s] (about 10 m/min)
  render: 0.45,       // the brake renders above this share of the chain's breaking load
  hawseH: 3,          // height of the hawse pipe above the water, added to the depth [m]
  maxDepth: 82.5,     // a windlass is built to lift an anchor and three shackles of chain hanging free
};
export type Seabed = 'good' | 'soft' | 'rock';
const BED: Record<Seabed, number> = { good: 1, soft: 0.6, rock: 0.3 };

export type WindlassMode = 'brake' | 'letgo' | 'walk' | 'heave';
export interface Anchor {
  name: string;
  hawse: [number, number];        // hawse pipe, body [x, y]
  mass: number;                   // anchor [kg]
  w: number;                      // weight of chain in water [N/m]
  EA: number;                     // axial stiffness of the chain [N]
  MBL: number;                    // breaking load of the chain [N]
  pull: number;                   // windlass pull when heaving [N]
  chain: number;                  // chain on board [m]
  state: 'stowed' | 'down' | 'lost';
  mode: WindlassMode;
  out: number;                    // chain out [m]
  pos: Pt | null;                 // where the anchor lies on the bottom
  depth: number;                  // hawse to seabed at the anchor [m]
  bed: number;                    // holding factor of the seabed
  T: number;                      // chain tension at the hawse [N]
  H: number;                      // its horizontal part [N]
  dragV: number;                  // speed the anchor is dragging at [m/s]
  onBottom: number;               // chain lying on the bottom [m]
}

/** Ships that carry a stern anchor as well: ferries, yachts and the river convoy. */
const STERN = new Set(['ropax', 'hsc-cat', 'paspaley-pearl', 'superyacht', 'push-convoy']);

/**
 * Anchor gear sized from the ship, after the equipment-number rule of the class societies:
 * EN = Δ^⅔ + 2·(frontal area) + (side area)/10; a stockless anchor of about 3 kg per unit, stud-link chain of
 * about 1.75·√EN mm. Chain weighs about 0.0219·d² kg/m in air (0.87 of that in water).
 */
export function anchorGear(spec: ShipSpec): Anchor[] {
  const disp = 1.025 * spec.Cb * spec.L * spec.B * spec.T;                       // tonnes
  const EN = Math.pow(disp, 2 / 3) + 2 * spec.windage.AF + spec.windage.AL / 10;
  const mass = 3 * EN, d = 1.75 * Math.sqrt(EN);                                   // kg, mm
  const mk = (name: string, x: number, y: number, k = 1): Anchor => ({
    name, hawse: [x - spec.xg, y], mass: mass * k, w: 0.0219 * d * d * 9.81 * 0.87 * k, EA: 5e4 * d * d * k,
    MBL: 27.4 * d * d * (44 - 0.08 * d) * k, pull: 47.5 * d * d * k,
    chain: SHACKLE * Math.max(6, Math.min(14, Math.round(5 + EN / 500))),
    state: 'stowed', mode: 'brake', out: 0, pos: null, depth: 0, bed: 1, T: 0, H: 0, dragV: 0, onBottom: 0,
  });
  const x = spec.L / 2 - 0.04 * spec.L, y = 0.25 * spec.B;
  const list = [mk('PORT BOW', x, -y), mk('STBD BOW', x, y)];
  if (STERN.has(spec.id)) list.push(mk('STERN', -spec.L / 2 + 1.5, 0, 0.5));        // a stream anchor: about half the bower
  return list;
}

/** Horizontal pull of a chain of length S whose ends are h apart in height and X apart on the level. */
export function catenary(S: number, h: number, X: number, w: number, EA: number): { H: number; onBottom: number } {
  if (S <= h) return { H: 0, onBottom: 0 };                                      // the anchor hangs clear of the bottom
  if (X <= S - h) return { H: 0, onBottom: S - h };                              // slack: up and down
  // with chain still on the bottom: the hanging part s = h·√(1 + 2H/(w·h)) spans (H/w)·acosh(1 + w·h/H)
  const span = (H: number) => { const s = h * Math.sqrt(1 + 2 * H / (w * h)); return S - s + (H / w) * Math.acosh(1 + w * h / H); };
  const Hlift = w * (S * S - h * h) / (2 * h), Xlift = (Hlift / w) * Math.acosh(1 + w * h / Hlift);
  if (X >= Xlift) return { H: Hlift + (EA / S) * (X - Xlift), onBottom: 0 };     // all of it off the bottom: taut
  let lo = 1e-6 * Hlift, hi = Hlift;
  for (let k = 0; k < 40; k++) { const m = 0.5 * (lo + hi); if (span(m) < X) lo = m; else hi = m; }
  const H = 0.5 * (lo + hi);
  return { H, onBottom: Math.max(0, S - h * Math.sqrt(1 + 2 * H / (w * h))) };
}

/** What the anchor will hold before it drags [N]. */
export function holding(a: Anchor, onBottom: number) {
  return a.mass * 9.81 * 0.87 * ANCHOR.hold * a.bed * (onBottom > 0.5 ? 1 : ANCHOR.holdLifted) + ANCHOR.chainMu * a.w * onBottom;
}

/** Chain force on the ship as a body wrench (the vertical part is left out). */
export function anchorForce(st: ShipState, a: Anchor): Wrench & { T: number; H: number; onBottom: number } {
  if (a.state !== 'down' || !a.pos) return { X: 0, Y: 0, N: 0, T: 0, H: 0, onBottom: 0 };
  const [hn, he, vn, ve] = pointWorld(st, a.hawse);
  const dn = a.pos[0] - hn, de = a.pos[1] - he, X = Math.hypot(dn, de) || 1e-6;
  const c = catenary(a.out, a.depth, X, a.w, a.EA);
  // a dragging anchor gives way: the pull cannot rise far above what it holds
  let H = Math.min(c.H, 1.5 * holding(a, c.onBottom));
  if (c.onBottom === 0 && H > 0) H = Math.max(0, H - 2e4 * ((vn * dn + ve * de) / X));   // a taut chain damps its own stretch
  const FN = H * dn / X, FE = H * de / X, cs = Math.cos(st.psi), sn = Math.sin(st.psi);
  const fx = cs * FN + sn * FE, fy = -sn * FN + cs * FE;
  return { X: fx, Y: fy, N: a.hawse[0] * fy - a.hawse[1] * fx, T: H + a.w * Math.min(a.out, a.depth), H, onBottom: c.onBottom };
}
export function anchorsForce(st: ShipState, list: Anchor[]): Wrench {
  let X = 0, Y = 0, N = 0;
  for (const a of list) if (a.state === 'down') { const f = anchorForce(st, a); X += f.X; Y += f.Y; N += f.N; }
  return { X, Y, N };
}

/** Give the windlass an order. Returns a message when the order cannot be carried out. */
export function orderAnchor(a: Anchor, mode: WindlassMode, st: ShipState, depthAt: DepthField): string | null {
  if (a.state === 'lost') return `${a.name} anchor is lost`;
  if (mode === 'letgo' || mode === 'walk') {
    const [n, e] = pointWorld(st, a.hawse), h = depthAt(n, e);
    if (a.state === 'stowed' && !(h < ANCHOR.maxDepth) ) return `${a.name}: too deep to anchor here (${isFinite(h) ? h.toFixed(0) + ' m' : 'no bottom'})`;
    if (a.state === 'stowed' && h + ANCHOR.hawseH > a.chain - SHACKLE) return `${a.name}: not enough chain for ${h.toFixed(0)} m`;
  }
  if (mode === 'heave' && a.state === 'stowed') return null;
  if (a.state === 'stowed' && (mode === 'letgo' || mode === 'walk')) { a.state = 'down'; a.out = 0; a.pos = null; a.dragV = 0; }
  a.mode = mode;
  return null;
}

/** One step of the windlass, the chain and the anchor on the bottom. Returns messages to announce. */
export function stepAnchor(a: Anchor, st: ShipState, depthAt: DepthField, dt: number, bed: Seabed = 'good'): string[] {
  const msg: string[] = [];
  if (a.state !== 'down') { a.T = a.H = a.dragV = a.onBottom = 0; return msg; }
  const [hn, he] = pointWorld(st, a.hawse);
  const hHere = depthAt(hn, he) + ANCHOR.hawseH;
  a.bed = BED[bed];
  // on the way down: the anchor takes the bottom under the hawse
  if (!a.pos) {
    a.depth = hHere;
    if (a.mode === 'letgo' || a.mode === 'walk') a.out = Math.min(a.chain, a.out + (a.mode === 'letgo' ? ANCHOR.letGo : ANCHOR.walk) * dt);
    else if (a.mode === 'heave') { a.out = Math.max(0, a.out - ANCHOR.walk * dt); if (a.out === 0) { a.state = 'stowed'; a.mode = 'brake'; msg.push(`${a.name} anchor home`); } }
    if (a.out >= a.depth && isFinite(a.depth)) { a.pos = [hn, he]; msg.push(`${a.name} anchor on the bottom · ${a.depth.toFixed(0)} m`); }
    a.T = a.w * a.out + a.mass * 9.81 * 0.87; a.H = 0; a.onBottom = 0; a.dragV = 0;
    return msg;
  }
  a.depth = depthAt(a.pos[0], a.pos[1]) + ANCHOR.hawseH;
  if (!isFinite(a.depth)) a.depth = hHere;
  const dn = a.pos[0] - hn, de = a.pos[1] - he, X = Math.hypot(dn, de) || 1e-6;
  // the windlass
  if (a.mode === 'letgo') a.out = Math.min(a.chain, Math.max(a.out, Math.min(a.out + ANCHOR.letGo * dt, X + a.depth + 2)));   // runs out as she falls back, lying slack on the bottom
  else if (a.mode === 'walk') a.out = Math.min(a.chain, a.out + ANCHOR.walk * dt);
  const f = anchorForce(st, a);
  if (a.mode === 'heave') {
    if (f.T < a.pull) a.out = Math.max(0, a.out - ANCHOR.walk * dt);          // stalls when the chain is too heavy to bring in
    if (a.out <= a.depth) { a.pos = null; msg.push(`${a.name} anchor aweigh`); a.T = f.T; a.H = 0; a.dragV = 0; a.onBottom = 0; return msg; }
  }
  if (a.mode === 'brake' && f.T > ANCHOR.render * a.MBL && a.out < a.chain) a.out = Math.min(a.chain, a.out + 0.5 * dt);   // the brake renders
  if (f.T > a.MBL) { a.state = 'lost'; a.pos = null; a.out = 0; a.T = a.H = 0; msg.push(`${a.name} CHAIN PARTED · anchor lost`); return msg; }
  if (a.out >= a.chain - 1e-6 && a.mode !== 'brake' && a.mode !== 'heave') { a.mode = 'brake'; msg.push(`${a.name}: all the chain is out`); }
  // the anchor: it drags along the pull once that passes what it holds
  const hold = holding(a, f.onBottom), was = a.dragV;
  a.dragV = f.H > hold ? Math.min(2, 0.5 * (f.H - hold) / hold + 0.05) : 0;
  if (a.dragV > 0) { const k = Math.min(1, a.dragV * dt / X); a.pos = [a.pos[0] - dn * k, a.pos[1] - de * k]; }
  if (a.dragV > 0.05 && was <= 0.05) msg.push(`${a.name} ANCHOR DRAGGING`);
  a.T = f.T; a.H = f.H; a.onBottom = f.onBottom;
  return msg;
}
