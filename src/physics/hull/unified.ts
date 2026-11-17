// One hull model from berthing to sea speed, ahead and astern, at any drift angle:
// Yoshimura, Nakao & Ishibashi (2009), "Unified mathematical model for ocean and harbour manoeuvring",
// MARSIM'09 (HUSCAP open copy). The linear MMG derivatives carry the hull at small drift; every
// nonlinear sway and yaw term is replaced by one cross-flow drag integral along the length,
//   Y = ½ρLd [Y'v v|u| + Y'r Lr·u − C_D ∫ |v + C_rY Lr x'|(v + C_rY Lr x') dx']
//   N = ½ρL²d [N'v v·u + N'r Lr|u| − C_D ∫ |v + C_rN Lr x'|(v + C_rN Lr x') x' dx'],   x' ∈ [−½, ½]
// which stays finite through zero speed and 0–180° drift (no switching between low- and high-speed
// models). As printed, the paper's Eq. (7), (9) and (12) put C_rY in the N integral; its Eq. (10) for
// zero-speed turning, N = −½ρL²d·C_D·C_rN²·L²|r|r/32, holds only with C_rN there, so C_rN is used.
//
// Linear derivatives for ships without captive data: Kijima, Katsuno, Nakiri & Furukawa (1990),
// J. Soc. Nav. Arch. Japan 168:141–148, Eq. (7) (J-STAGE), written in MMG form as in Yoshimura (2009)
// Eq. (18): Y'v = −(πd/L + 1.4 Cb B/L), Y'r − m'x = 0.5 Cb B/L, N'v = −2d/L, N'r = −1.08 d/L + 4(d/L)².
//
// Shallow water: the factors compiled by Taimuri et al. (2020), Ocean Eng. 218:108103, Appendix C,
// Table 7 (Aalto open copy): Kijima-type −T/H + (1 − T/H)^−n for Y'v, N'r and the cross-flow drag
// (as for Y'vv, the v|v| term the cross-flow integral replaces), the A1–A3 polynomial for Y'r, and
// Ankudinov's K0/K1/K2 factors for N'v (f_nv) and the added masses (g_v, g_nr).
import type { ShipSpec } from '../ship';

/** The regressions' database (Yoshimura et al. 2009, Table 1–2: SR108, Esso Osaka, PCC, research ship). */
const LD = [13.07, 21.95], LB = [4.792, 6.897];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface CrossFlow { CD: number; CrY: number; CrN: number; source: string }

/** Cross-flow coefficients from Yoshimura et al. (2009) Eq. (19)–(21), evaluated inside the database's
 *  L/d and L/B range (outside it the straight-line fit goes unphysical: at L/d 30 it gives C_D 0.08). */
export function crossFlowRegression(s: ShipSpec): CrossFlow {
  const T = s.hullT ?? s.T;
  const Ld = clamp(s.L / T, LD[0], LD[1]), Lb = clamp(s.L / s.B, LB[0], LB[1]);
  return {
    CD: -0.0591 * Ld + 1.848,
    CrY: 0.520 * Lb - 1.062,
    CrN: 0.0742 * Ld - 0.297,
    source: 'Yoshimura et al. (2009) Eq. (19)–(21)',
  };
}

/** Linear hull derivatives, MMG non-dimensional (÷ ½ρLdU², ½ρL²dU²), r' = rL/U. Yr is the total
 *  measured derivative, Y'r − m'x, as in Yoshimura (2009). */
export interface Linear { Yv: number; Yr: number; Nv: number; Nr: number; Xvr: number; source: string }

export function kijimaLinear(s: ShipSpec, myPrime: number): Linear {
  const T = s.hullT ?? s.T, dL = T / s.L, cbl = s.Cb * s.B / s.L, k = 2 * dL;
  return {
    Yv: -(Math.PI * dL + 1.4 * cbl),
    Yr: 0.5 * cbl,
    Nv: -k,
    Nr: -0.54 * k + k * k,
    // m'y + X'vr = 2.86 Cb/(L/B) − 0.21 (Yoshimura 2009, Eq. 18); m'y is carried by the equations of motion
    Xvr: 2.86 * cbl - 0.21 - myPrime,
    source: 'Kijima et al. (1990) Eq. (7) in the MMG form of Yoshimura (2009) Eq. (18)',
  };
}

/** Shallow-water multipliers at depth h (Taimuri et al. 2020, Table 7). Evaluated no shallower than
 *  h/T = 1.2, the lowest depth the underlying captive data covered; 1 in deep water. */
export interface Shallow { Yv: number; Yr: number; Nv: number; Nr: number; CD: number; gv: number; gnr: number }
export const DEEP: Shallow = { Yv: 1, Yr: 1, Nv: 1, Nr: 1, CD: 1, gv: 1, gnr: 1 };

export function shallowFactors(s: ShipSpec, depth: number, set: 'published' | 'power-law' = 'published'): Shallow {
  const T = s.hullT ?? s.T;
  if (!isFinite(depth) || depth / T > 12) return DEEP;
  if (set === 'power-law') {
    // the simulator's own laws (not from a source), for hulls the published factors were never checked on:
    // Taimuri's Kijima-type factor reaches 13 for a Cb·B/T 5.9 barge convoy at h/T 1.5
    const rr = Math.min(T / depth, 0.92), fsh = Math.pow(1 - rr, -0.65), fam = Math.pow(1 - rr, -0.35);
    return { Yv: fsh, Yr: 1, Nv: fsh ** 0.8, Nr: fsh ** 0.6, CD: fsh, gv: fam, gnr: fam };
  }
  const hT = Math.max(1.2, depth / T), TH = 1 / hT, HT = hT - 1;
  const cbBT = s.Cb * s.B / T;
  const kij = (n: number) => -TH + Math.pow(1 - TH, -n);
  // Y'r: (1 + A1 T/H + A2 (T/H)² + A3 (T/H)³), coefficients in Cb·B/T
  const A1 = -5.5 * cbBT ** 2 + 26 * cbBT - 31.5, A2 = 37 * cbBT ** 2 - 185 * cbBT + 230, A3 = -38 * cbBT ** 2 + 197 * cbBT - 250;
  // Ankudinov: H_T = H/T − 1, B1 = Cb·B(1 + B/L)². K2 is taken as 0.0342/H_T for every hull: the
  // B/T > 4 branch as printed (0.137·B/(H_T·T)) gives factors above 50 at h/T 1.2, which cannot be right.
  const K0 = 1 + 0.0775 / HT ** 2 - 0.011 / HT ** 3 + 0.000068 / HT ** 5;
  const K1 = -0.0643 / HT + 0.0724 / HT ** 2 - 0.0113 / HT ** 3 + 0.0000767 / HT ** 5;
  const K2 = 0.0342 / HT;
  const b = s.Cb * s.B * (1 + s.B / s.L) ** 2 / T;
  return {
    Yv: kij(0.4 * cbBT),
    Yr: clamp(1 + A1 * TH + A2 * TH * TH + A3 * TH ** 3, 0.5, 4),
    Nv: K0 + K1 * b + K2 * b * b,
    Nr: kij(-14.28 * T / s.L + 1.5),
    CD: kij(-0.26 * cbBT + 1.74),
    gv: K0 + (2 / 3) * K1 * b + (8 / 15) * K2 * b * b,
    gnr: K0 + (8 / 15) * K1 * b + (40 / 105) * K2 * b * b,
  };
}
