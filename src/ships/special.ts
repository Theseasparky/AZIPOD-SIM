// Inland, naval and special ships. Particulars typical of their types, not one ship's data; hull
// forces from Clarke's regression (the push convoy and the icebreaker sit at the edge of its range).
// Origin at the CG (positions from midship minus xg).
import { DEG } from '../physics/consts';
import type { MmgHull, PodSpec, ShipSpec } from '../physics/ship';
import { POD_DEFAULTS, rudder, shaftUnit } from './base';
import { PANAMAX } from './cargo';

const LEVERS = { ahead: [0.2, 0.4, 0.6, 0.8, 1], astern: [0.2, 0.4, 0.6, 0.8, 1] };

/** Polar icebreaker, 110 m: three Azipods, icebreaking bow (Lindqvist level-ice resistance). */
const IB_XG = -2;
const pod = (label: string, x: number, y: number, Tb: number, P: number, tol = 0): PodSpec =>
  ({ label, x, y, Tb, asternFrac: 0.8, strutArea: 18, D: 4.2, P, slewMul: 1 + tol * 0.04, thrustMul: 1 - tol * 0.02, alphaOffset: tol * 0.3 * DEG });
export const ICEBREAKER: ShipSpec = {
  ...POD_DEFAULTS,
  id: 'icebreaker', name: 'Icebreaker 110 m · 3 Azipods', type: 'icebreaker', station: 'asd', load: 'operating draught',
  note: 'Typical 110 m Baltic/polar icebreaker: three Azipods (2 × 6.5 MW wing units, 6 MW centre), diesel-electric, a sloping icebreaking bow (stem 25°, waterline entrance 30°). Level-ice resistance from Lindqvist (1989): crushing, bending and submersion of the broken ice, rising with speed; behind her the broken channel offers a fraction of it. Turning and sideways motion in unbroken ice are resisted much harder. Hull forces in open water from Clarke\'s regression.',
  LOA: 110, vmaxKn: 17,
  L: 96, B: 24, T: 8, Cb: 0.55, xg: IB_XG,
  pods: [pod('PORT', -0.42 * 96 - IB_XG, -7, 780e3, 6.5e6), pod('CENTRE', -0.46 * 96 - IB_XG, 0, 700e3, 6e6, 0.5), pod('STBD', -0.42 * 96 - IB_XG, 7, 780e3, 6.5e6, 1)],
  bowThruster: { x: 0, Tmax: 0, P: 0 },
  windage: { AF: 560, AL: 1500, cx: 0.8, cy: 0.9, cn: 0.08, xw: 5 },
  wake: 0.1, tded: 0.12, Vzero: 11, Cd: 0.85, formFactor: 1.35, cwMul: 2.2,
  podSlew: 6 * DEG, podRpmTime: 20, powerAvail: 21e6, btRpmTime: 8,
  bridgeX: 0.12 * 96 - IB_XG, ramK: 0.85,
  iceBow: { phi: 25 * DEG, alpha: 30 * DEG },
  roll: { GM: 2.6, KG: 9.8, kxx: 9.4, zWind: 9, vanish: 65 * DEG },
  look: {
    freeboard: 5.2, bridgeH: 22, bridgeLen: 8, wingOut: 1.0,
    decks: [{ x0: -10, x1: 24, h: 11, inset: 0.6 }, { x0: -4, x1: 21, h: 16, inset: 1.4 }, { x0: 2, x1: 18, h: 22, inset: 2.6 }],
    funnel: { x: -12, h: 27, w: 5, l: 6 },
    hull: '#c8102e', topsides: '#c8102e', super: '#f4f4f0', glass: '#1d2731', accent: '#1d2731',
  },
};

/**
 * Paspaley Pearl, 53.5 m expedition yacht (Vard 2021, refit 2024, operated by Ponant): published
 * 53.5 m LOA, 11.2 m beam, 3.4 m draught, diesel-electric with two azimuthing pods aft, a bow
 * tunnel thruster and fin stabilisers. Not published, so assumed: Lpp, Cb, pod and thruster power,
 * speed, windage. Her stern thruster is left out: the Azipod joystick drives the pods and the bow thruster.
 */
const PP_XG = -1;
// No azimuth mis-set: on a 47 m hull 0.3° of it swings her 2.6°/min with the pods centred, more than a
// helmsman can trim out against the dial's centre detent; yacht pods are zeroed at sea trials.
const ppPod = (label: string, y: number, tol: number): PodSpec =>
  ({ label, x: -0.5 * 47 - 0.2 * 6.5 - PP_XG + 3.45, y, Tb: 105e3, asternFrac: 0.78, strutArea: 4, D: 1.9, P: 0.85e6, slewMul: 1 + tol * 0.04, thrustMul: 1 - tol * 0.02, alphaOffset: 0 });
export const PASPALEY_PEARL: ShipSpec = {
  ...POD_DEFAULTS,
  id: 'paspaley-pearl', name: 'Paspaley Pearl · 53.5 m expedition yacht', type: 'yacht', load: 'service draught',
  note: 'Paspaley Pearl, a 53.5 m expedition yacht built by Vard (2021): 11.2 m beam, 3.4 m draught (published), diesel-electric with two azimuthing pods aft and a bow tunnel thruster. Assumed, as not published: Lpp 47 m, block coefficient 0.5, 2 × 0.85 MW pods, a 0.3 MW bow thruster and about 13 kn. Her stern thruster and fin stabilisers are not modelled. Hull forces from Clarke\'s regression.',
  LOA: 53.5, vmaxKn: 13,
  L: 47, B: 11.2, T: 3.4, Cb: 0.5, xg: PP_XG,
  pods: [ppPod('PORT', -2.7, 0), ppPod('STBD', 2.7, 1)],
  bowThruster: { x: 0.5 * 47 + 0.8 * 6.5 - PP_XG - 4.5, Tmax: 45e3, P: 0.3e6 },
  windage: { AF: 140, AL: 450, cx: 0.7, cy: 0.9, cn: 0.08, xw: 1 },
  Vzero: 12, Cd: 0.8, formFactor: 1.25,
  podSlew: 10 * DEG, podRpmTime: 15, btRpmTime: 5, powerAvail: 2.4e6, bridgeX: 12.5,
  look: {
    freeboard: 3.6, bridgeH: 9.6, bridgeLen: 5, wingOut: 0.3,
    decks: [{ x0: -16, x1: 14, h: 6.6, inset: 0.4 }, { x0: -8, x1: 13, h: 9.4, inset: 0.8 }],
    funnel: { x: -6, h: 11, w: 2, l: 3 },
    hull: '#f4f5f2', topsides: '#f4f5f2', super: '#f4f5f2', glass: '#1a232c', accent: '#b89b5e',
  },
};

/** European push convoy: pushboat and 2 × 2 barges (class Vb), three propellers with steering and flanking rudders. */
const PC_XG = -10;      // CG of the convoy, 10 m aft of midship (the pushboat's weight is aft)
const PC_LOA = 193;

/**
 * Hull of a 2 × 2 pusher–barge system: the derivatives measured on the 22BP system (pusher 40 m, four 60.96 m
 * barges, 161.9 × 21.3 × 2.74 m, 7 knots, deep water) in circular-motion tests at the Hiroshima University
 * towing tank, Koh, Yasukawa, Hirata & Kose (2008), J. Mar. Sci. Technol. 13:256–268 (Table 3) and
 * "Maneuvering simulations of pusher–barge systems", J. Mar. Sci. Technol. (2008) (Table 3). Made
 * non-dimensional with the overall length and the draught, in the paper's form (β = atan(−v/u)),
 *   Y′ = Y′β β + Y′r r′ + Y′βββ β³ + Y′ββr β² r′, X′ = X′0 cos²β + X′ββ β² + X′βr β r′ + X′rr r′²,
 * written here in the MMG form of the rest of the fleet (v′ = −sin β). The Rhine convoy is 193 × 22.8 × 3.5 m
 * (L/B 8.5, B/d 6.5; the tested system 7.6 and 7.8): similar in shape, not the same hull. The tests reached
 * |β| ≤ 25° and |r′| ≤ 0.2 (their circular-motion runs); beyond that the low-speed model takes over. The
 * paper's added masses are about 14 times below Clarke's and strip theory for the same hull and look mis-scaled,
 * so they are not used (Clarke's stay). Y′r − m′x and X′βr − m′y are taken back to Y′r and X′βr with the
 * paper's own m′x 0.00076 and m′y 0.00741.
 */
export const PUSH_CONVOY_MMG: MmgHull = {
  xG: PC_XG, Lref: PC_LOA, kzz: 0.25,
  R0: 0.0642, Xvv: -0.0609 + 0.0642, Xvr: -(-0.113 + 0.00741), Xrr: -0.0085, Xvvvv: 0,
  Yv: -0.2544, Yr: 0.0122 + 0.00076, Yvvv: -0.2795, Yvvr: -0.0777, Yvrr: 0, Yrrr: 0,
  Nv: -0.0397, Nr: -0.0497, Nvvv: -0.1381, Nvvr: -0.0789, Nvrr: 0, Nrrr: 0,
  range: { v: [0.42, 0.62], r: [0.2, 0.4] },
  source: 'Koh, Yasukawa, Hirata & Kose (2008), Hiroshima University towing tank, 22BP system (2 × 2 barges), Table 3',
};
export const PUSH_CONVOY: ShipSpec = {
  ...POD_DEFAULTS,
  id: 'push-convoy', name: 'Push convoy · 4 barges, 193 m', type: 'inland', station: 'cpp', load: 'laden, 3.5 m',
  note: 'Rhine-type push convoy: a 40 m pushboat with three 1.5 MW propellers in nozzles, each with twin steering rudders behind and twin flanking rudders ahead, pushing four laden Europe IIa barges (2 × 2, 193 × 22.8 m overall). On a river the water under her is rarely more than half her draught again. The flanking rudders sit in the propeller slipstream when going astern and steer the stern while backing and stopping. Hull forces from the Hiroshima University pusher–barge captive tests (Koh et al. 2008), strip-theory cross-flow beyond the 25° they reached.',
  LOA: 193, vmaxKn: 7,
  L: 190, B: 22.8, T: 3.5, Cb: 0.9, xg: 0,        // body origin at midship, the CG PC_XG ahead of it (as for KVLCC2)
  mmg: PUSH_CONVOY_MMG,
  hull: {
    model: 'unified', class: 'scaled', shallow: 'power-law',
    cross: { CD: 1.1, CrY: 1, CrN: 1, source: 'strip theory with Hoerner\'s cross-flow drag; no circular-motion data beyond 25° drift' },
    source: 'Koh et al. (2008) pusher–barge captive tests (22BP) within their range; strip-theory cross-flow beyond it',
  },
  pods: ([-3.6, 0, 3.6]).map((y, k) => shaftUnit(['PORT', 'CENTRE', 'STBD'][k], y, {
    // t_P and w_P0 as assumed for the pusher in the same paper (Table 4, after a conventional twin-screw vessel)
    D: 2.0, k0: 0.6, k1: -0.4, k2: -0.12, KQ0: 0.09, asternFrac: 0.7,
    tP: 0.164, wP0: 0.34, xP: -0.49 * 190, hand: k === 0 ? -1 : 1, kTTah: 0.01, kTTas: 0.04,
  }, { type: 'geared', P: 1.5e6, n: 350 / 60, nMin: 0.25, loadTime: 15, I: 3e3, clutch: true },
  // rudder–hull interaction as assumed for the pusher in the same paper (Table 4): t_R, a_H, x'_H, γ_R, l'_R, ε
  { ...rudder({ type: 'schilling', A: 2 * 4.2, H: 2.4, xR: -0.49 * 190 - 0.8 * 2.0, xH: -0.427 * PC_LOA, tR: 0.055, aH: 0.194, gammaP: 0.23, gammaM: 0.23, lR: -1.033, eps: 0.987, kappa: 0.6 / 0.987, max: 60 * DEG, rate: 8 * DEG }), flank: { A: 2 * 3.5, xF: -0.49 * 190 + 2.6, max: 45 * DEG } },
  LEVERS)),
  bowThruster: { x: 0.5 * 190 - 4, Tmax: 60e3, P: 0.5e6 },
  windage: { AF: 120, AL: 900, cx: 0.8, cy: 0.9, cn: 0.06, xw: -60 + PC_XG },
  wake: 0.25, tded: 0.15, Vzero: 20, Cd: 1.1, formFactor: 2.2,
  btRpmTime: 5, powerAvail: 0.6e6, bridgeX: -0.44 * 190,
  look: {
    freeboard: 1.2, bridgeH: 9, bridgeLen: 5, wingOut: 0.5,
    decks: [{ x0: -0.5 * 190 + 4, x1: -0.5 * 190 + 30, h: 5.5, inset: 2 }, { x0: -0.5 * 190 + 8, x1: -0.5 * 190 + 24, h: 9, inset: 4 }],
    funnel: { x: -0.5 * 190 + 9, h: 10, w: 1.6, l: 2.4 },
    hull: '#20242a', topsides: '#2f4f3a', super: '#f2f2ec', glass: '#1b2530', accent: '#e8b11c',
  },
};

/** Frigate on the DTMB 5415 hull (the open benchmark surface combatant), twin CPP, twin rudders, 30 kn. */
const FR_XG = -2.5;
/** DTMB 5512 (1:46.6 geosim of the 5415) bare-hull captive tests, Fn 0.28, IIHR 100 m tank (Yoon 2009, PhD thesis,
 *  University of Iowa), values as tabulated by Hajivand & Mousavizadegan (2015), Int. J. Nav. Archit. Ocean Eng. 7:
 *  Tables 12–18 (EFD columns). The tabulated nonlinear terms are Taylor derivatives (the paper's Eq. 33 has 1/6 and 1/2
 *  in front of them), so the polynomial coefficients are Yvvv/6, Yvvr/2 and so on. The tabulated Y'r equals the
 *  measured Y'r − m' (with m' = 0.136, the PMM balance carries the model's inertia): that is the only reading that
 *  leaves the hull course-stable, as the 5415 is, so m' is added back to get the hull-only MMG derivative. No resistance
 *  is tabulated: the simulator's own stays. */
const FR_M = 0.1361;      // m' = ∇ / (½ L² d): 86 kg model, 3.048 m, 0.136 m
const FRIGATE_MMG: MmgHull = {
  xG: FR_XG, kzz: 0.25, my: 0.1111, Jz: 0.0070,
  Xvv: -0.1528 / 2, Xvr: 0.0300, Xrr: -0.0282 / 2, Xvvvv: 0,
  Yv: -0.2961, Yr: -0.0485 + FR_M, Yvvv: -1.9456 / 6, Yvvr: -1.7067 / 2, Yvrr: -1.3683 / 2, Yrrr: -0.4520 / 6,
  Nv: -0.1667, Nr: -0.0485, Nvvv: -0.4355 / 6, Nvvr: -0.5512 / 2, Nvrr: -0.4011 / 2, Nrrr: -0.0505 / 6,
  // drift to 20° (|v'| 0.34) and yaw rate to r' 0.75 were tested, at Fn 0.138–0.41 (about 10–30 kn)
  range: { u: [2.5, 5], v: [0.34, 0.5], r: [0.75, 1.0] },
  source: 'DTMB 5512 captive tests, Fn 0.28 (Yoon 2009; Hajivand & Mousavizadegan 2015, Tables 12–18)',
};
export const FRIGATE: ShipSpec = {
  ...POD_DEFAULTS,
  id: 'frigate', name: 'Frigate · DTMB 5415 hull', type: 'naval', station: 'cpp', load: 'full load',
  note: 'Surface combatant on the DTMB 5415 hull (142 × 19.06 × 6.15 m, Cb 0.507), the open benchmark of the SIMMAN workshops: twin controllable-pitch propellers on gas turbines and diesels (2 × 37.5 MW), twin spade rudders. Particulars of the benchmark hull; propulsion, steering and windage typical of the type. Bare-hull forces from the Iowa (IIHR) captive tests of the 5512 model, drift to 20°, yaw rate to r\' 0.75; the propulsion and rudder interaction are typical, not measured.',
  LOA: 153.3, vmaxKn: 29,
  L: 142, B: 19.06, T: 6.15, Cb: 0.507, xg: 0,       // body origin at midship, the CG FR_XG ahead of it
  mmg: FRIGATE_MMG,
  hull: { model: 'unified', class: 'captive', shallow: 'published', source: 'DTMB 5512 bare-hull captive tests (Yoon 2009) within their range; Yoshimura et al. (2009) cross-flow beyond it' },
  pods: (['PORT', 'STBD'] as const).map((side, k) => shaftUnit(side, k ? 4.6 : -4.6, {
    D: 5.2, k0: 0.52, k1: -0.3, k2: -0.1, KQ0: 0.09, asternFrac: 0.6,
    tP: 0.08, wP0: 0.06, xP: -0.43 * 142, hand: k ? 1 : -1, kTTah: 0.005, kTTas: 0.03,
    cpp: { pitchTime: 12, asternPitch: 0.75 },
  }, { type: 'turbine', P: 37.5e6, n: 168 / 60, nMin: 0.3, loadTime: 50, I: 1.4e5 },
  rudder({ A: 15, H: 4.5, xR: -0.47 * 142, rate: 4 * DEG }), LEVERS)),
  bowThruster: { x: 0, Tmax: 0, P: 0 },
  windage: { AF: 330, AL: 1700, cx: 0.75, cy: 0.9, cn: 0.08, xw: 4 + FR_XG },
  wake: 0.06, tded: 0.08, Vzero: 20, Cd: 0.7, formFactor: 1.08, cwMul: 0.75,
  btRpmTime: 5, powerAvail: 1e6, bridgeX: 0.2 * 142,
  look: {
    freeboard: 6, bridgeH: 16, bridgeLen: 6, wingOut: 0.8,
    decks: [{ x0: -30, x1: 28, h: 10, inset: 1.2 }, { x0: -18, x1: 26, h: 14, inset: 2.6 }],
    funnel: { x: -10, h: 22, w: 4, l: 7 },
    hull: '#5d6670', topsides: '#7c858e', super: '#8d959d', glass: '#1b232b', accent: '#2b3137',
  },
};

/** Superyacht, 90 m: twin screws on electric motors, bow and stern thrusters. */
const SY_XG = -1;
export const SUPERYACHT: ShipSpec = {
  ...POD_DEFAULTS,
  id: 'superyacht', name: 'Superyacht 90 m · twin screw', type: 'yacht', station: 'cpp', load: 'half load',
  note: 'Typical 90 m motor yacht: diesel-electric, twin fixed propellers on electric motors (2 × 5.5 MW, reversing through zero), twin rudders, bow and stern tunnel thrusters for berthing stern-to in crowded marinas. High windage for her size. Hull forces from Clarke\'s regression.',
  LOA: 90, vmaxKn: 20,
  L: 80, B: 14.5, T: 3.9, Cb: 0.48, xg: SY_XG,
  pods: (['PORT', 'STBD'] as const).map((side, k) => shaftUnit(side, k ? 2.9 : -2.9, {
    D: 2.6, k0: 0.48, k1: -0.36, k2: -0.1, KQ0: 0.07, asternFrac: 0.65,
    tP: 0.1, wP0: 0.08, xP: -0.43 * 80 - SY_XG, hand: k ? 1 : -1, kTTah: 0.01, kTTas: 0.05,
  }, { type: 'electric', P: 5.5e6, n: 300 / 60, nMin: 0, loadTime: 20, I: 2e3 },
  rudder({ A: 4.2, H: 2.6, xR: -0.43 * 80 - SY_XG - 0.75 * 2.6, rate: 5 * DEG }), LEVERS)),
  bowThruster: { x: 0.43 * 80 - SY_XG, Tmax: 60e3, P: 0.4e6 },
  sternThruster: { x: -0.4 * 80 - SY_XG, Tmax: 40e3, P: 0.3e6 },
  windage: { AF: 260, AL: 1100, cx: 0.7, cy: 0.9, cn: 0.08, xw: 2 },
  wake: 0.08, tded: 0.1, Vzero: 20, Cd: 0.75, formFactor: 1.12,
  btRpmTime: 5, powerAvail: 12e6, bridgeX: 0.24 * 80 - SY_XG,
  look: {
    freeboard: 3.6, bridgeH: 13, bridgeLen: 6, wingOut: 0.6,
    decks: [{ x0: -32, x1: 30, h: 7, inset: 0.5 }, { x0: -24, x1: 26, h: 10, inset: 1.4 }, { x0: -14, x1: 22, h: 13, inset: 2.4 }],
    funnel: { x: -12, h: 15, w: 3, l: 4 },
    hull: '#f4f5f2', topsides: '#16243a', super: '#f4f5f2', glass: '#141c26', accent: '#b89b5e',
  },
};

/** Panamax bulk carrier fitted with four Flettner rotor sails. */
export const PANAMAX_ROTOR: ShipSpec = {
  ...PANAMAX, id: 'panamax-rotor', name: 'Bulk carrier · 4 rotor sails',
  note: PANAMAX.note + ' Fitted with four 5 × 30 m Flettner rotor sails on the centreline: each spins to the spin ratio that gives the most forward thrust in the apparent wind (lift to about 9 × q·D·H near spin ratio 3), or stops when the wind is too far ahead. Thrust and side force go into the manoeuvring model like any other force.',
  rotors: [-0.32, -0.08, 0.14, 0.32].map(f => ({ x: f * PANAMAX.L - PANAMAX.xg, y: 0, D: 5, H: 30, zc: PANAMAX.look.freeboard + 15, vMax: 30 })),
};
