// Fenders the ship carries herself: pneumatic fenders hung over the side wherever the player puts them (for a
// berth with no fenders of its own, a pier corner, or lying alongside another ship). Tap near her side to hang
// one there; it snaps to the waterline outline, facing outboard. Kept per ship on this device.
import { S } from './state';
import { HULL, SHIP_FENDER_SIZES, hullPointNear, type ShipFender } from '../physics/contact';

const KEY = (ship: string) => `azb-shipfenders-${ship}`;
export type ShipFenderSize = (typeof SHIP_FENDER_SIZES)[number]['id'];
let size: ShipFenderSize = 'm';
export const shipFenderSize = () => size;
export function cycleShipFenderSize() {
  const i = SHIP_FENDER_SIZES.findIndex(z => z.id === size);
  size = SHIP_FENDER_SIZES[(i + 1) % SHIP_FENDER_SIZES.length].id;
  return SHIP_FENDER_SIZES.find(z => z.id === size)!.label;
}

const valid = (f: ShipFender) => [f.x, f.y, f.nx, f.ny, f.width, f.height, f.Rr, f.Er, f.dRated, f.mu].every(v => typeof v === 'number' && isFinite(v));
function read(ship: string): ShipFender[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(ship)) ?? '[]');
    if (Array.isArray(v)) return v.filter(valid);
  } catch { /* storage blocked or garbled: none */ }
  return [];
}
function save() {
  const list = S.rt.world.shipFenders ?? [];
  try {
    if (list.length) localStorage.setItem(KEY(S.rt.spec.id), JSON.stringify(list));
    else localStorage.removeItem(KEY(S.rt.spec.id));
  } catch { /* ignored */ }
}
/** Hang this device's fenders on the ship in use (after a scenario or ship is loaded). */
export function loadShipFenders() { S.rt.world.shipFenders = read(S.rt.spec.id); }
export const shipFenderCount = () => S.rt.world.shipFenders?.length ?? 0;

/** World point → body frame of the ship as the chart shows her now. */
function toBody(n: number, e: number) {
  const st = S.rt.sensors.out.est, c = Math.cos(st.psi), s = Math.sin(st.psi), dn = n - st.n, de = e - st.e;
  return { x: c * dn + s * de, y: -s * dn + c * de };
}
/** A tap near her side: hang a fender there. Returns the hint to show. */
export function addShipFenderAt(n: number, e: number): string {
  const b = toBody(n, e), p = hullPointNear(b.x, b.y, HULL);
  if (p.d > 15) return 'Tap close to her side to hang a fender there.';
  const z = SHIP_FENDER_SIZES.find(q => q.id === size)!;
  const list = (S.rt.world.shipFenders ??= []);
  if (list.some(f => Math.hypot(f.x - p.x, f.y - p.y) < (f.width + z.width) / 2)) return 'There is a fender there already: tap Remove, then the fender, to take it away.';
  list.push({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, width: z.width, height: z.height, Rr: z.Rr, Er: z.Er, dRated: 0.6, mu: 0.3 });
  save();
  return `${z.label} pneumatic fender hung over the ${p.y >= 0 ? 'starboard' : 'port'} side, ${Math.abs(p.x).toFixed(0)} m ${p.x >= 0 ? 'forward' : 'aft'} of the centre of gravity. ${list.length} on board.`;
}
/** A tap with Remove: take away her nearest fender, if one is within reach. Returns null if none was near. */
export function removeShipFenderNear(n: number, e: number): string | null {
  const list = S.rt.world.shipFenders; if (!list?.length) return null;
  const b = toBody(n, e);
  let best = -1, bd = 10;
  list.forEach((f, i) => { const d = Math.hypot(f.x + f.nx * f.height / 2 - b.x, f.y + f.ny * f.height / 2 - b.y); if (d < bd) { bd = d; best = i; } });
  if (best < 0) return null;
  list.splice(best, 1); save();
  return `Fender taken in. ${list.length} left on board.`;
}
export function clearShipFenders() { if (S.rt.world.shipFenders) S.rt.world.shipFenders.length = 0; save(); }
