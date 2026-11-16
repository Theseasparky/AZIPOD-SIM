// Water levels that change over time: the tide outside, a held canal level inside, and a lock chamber in
// between. The depth a ship has is the bed below datum plus the level of the water she is in.
/** Harmonic tide: mean level and constituents (amplitude m, period h, phase deg), heights above datum. */
export interface TideDef { msl: number; cons: { amp: number; periodH: number; phaseDeg: number }[] }
export function tideAt(t: TideDef, sec: number) {
  let h = t.msl;
  for (const c of t.cons) h += c.amp * Math.cos(2 * Math.PI * sec / (c.periodH * 3600) - c.phaseDeg * Math.PI / 180);
  return h;
}
/** IJmuiden Buitenhaven, NAP (estimates, kept as config): M2, S2 and the shallow-water M4 that makes the
 *  rise faster than the fall; high water about +1.0, low water about −0.7, mean +0.1. */
export const IJMUIDEN_TIDE: TideDef = { msl: 0.1, cons: [{ amp: 0.70, periodH: 12.42, phaseDeg: 0 }, { amp: 0.15, periodH: 12.0, phaseDeg: 0 }, { amp: 0.08, periodH: 6.21, phaseDeg: 220 }] };

