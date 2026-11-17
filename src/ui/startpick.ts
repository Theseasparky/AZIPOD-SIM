// Where she starts: the scenario's own start, or one the player chose on the chart (kept per scenario on this
// device). While choosing, a ghost of her hull shows where she would lie, green with water enough under her
// from stem to stern, red where she would take the ground or lie in a quay.
import type { Scenario } from '../scenarios';

export interface StartPose { n: number; e: number; psi: number; kn: number }
const KEY = (sc: string) => `azb-start-${sc}`;
const ok = (v: unknown): v is StartPose => !!v && ['n', 'e', 'psi', 'kn'].every(k => typeof (v as Record<string, unknown>)[k] === 'number' && isFinite((v as Record<string, number>)[k]));

export function savedStart(sc: Scenario): StartPose | null {
  try { const v = JSON.parse(localStorage.getItem(KEY(sc.id)) ?? 'null'); return ok(v) ? v : null; } catch { return null; }
}
export function saveStart(sc: Scenario, p: StartPose | null) {
  try { if (p) localStorage.setItem(KEY(sc.id), JSON.stringify(p)); else localStorage.removeItem(KEY(sc.id)); } catch { /* ignored */ }
}

/** The start being chosen (psi in degrees), and whether there is water enough under her there. */
export const pick = { on: false, pose: null as StartPose | null, ok: true, least: Infinity };
export const SPEEDS_KN = [0, 2, 4, 6, 8, 10];
