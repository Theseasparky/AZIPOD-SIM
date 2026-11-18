# Physics audit, October 2026

An audit of the simulator's ship physics, every propulsion system, every ship's layout, and the controls and graphics that show them. The aim was to check each part against published data and real-life practice, fix what was wrong, and record honestly what could not be checked.

**Summary**
- **Sound:** the core model, the propulsion force models and the sign conventions through the whole chain. Physics, levers, dials, 2D chart and 3D view all agree on which way things push and turn.
- **Problems found and fixed:**
  - Bow and stern thrusters lost far too much push under way.
  - The tugs' hulls were modelled too deep, which made two of them handle backwards or uncontrollably.
  - The escort towline tension was read at the wrong moment, so the escorted tanker hardly felt a steady pull.
  - Four ships had rudders too far behind their propellers.
  - The ballast tanker's propeller and rudder were modelled half out of the water.
  - Several trial and display errors (listed under "Trials and displays").
- **Still open:** the items under "Open questions" have no reliable published data to settle them.

## How it was checked

1. **Code review.** Every force in the manoeuvring model was read against its source method:
   - Hull: Fossen/MMG equations, Clarke's regression, MMG derivatives for KVLCC2.
   - Propulsors: pods and azimuth drives, shaft propeller and rudder (MMG standard method), two-stroke engine, CPP, Voith Schneider, waterjet.
   - Other forces: tunnel thrusters, wind, contact, towline.
2. **Geometry audit.** A script checked, for all 23 ships:
   - Every propulsor, rudder, thruster and the bridge against the hull outline.
   - Propeller diameter against draught.
   - The gap from propeller to rudder.
   - The centre of gravity position.
3. **Fleet trials.** Every ship ran the trials: speed, turning circle, zig-zag, crash stops, turning on the spot, coast-down and wind drift. Results were compared with published tests and with IMO MSC.137(76).
4. **Display audit.** The direction and rate of every lever, dial, chart symbol and 3D part were traced back to the physics.

## Verified correct

- **Axes and signs:** the conventions hold everywhere.
  - **Axes:** x forward, y to starboard, positive yaw turns the bow to starboard.
  - **Units:** positive azimuth pushes to starboard; positive rudder turns the ship to starboard; a waterjet nozzle to starboard throws the jet to starboard and turns the ship to starboard.
  - **Displays:** helm, combi-levers, Voith pads and Azipod dials match these. So do the 2D rudder and pod symbols, and the 3D pod yaw, rudder deflection and nozzle swing.
- **Propeller walk:**
  - **Fixed propellers:** a right-handed propeller walks the stern to starboard ahead (weakly) and to port astern (strongly).
  - **CPP:** turning ahead with astern pitch, it walks like a left-handed fixed propeller.
  - **Twin-screw ships:** they turn outward (port shaft left-handed), so their walks cancel.
  - Direction as in standard ship-handling texts. The astern magnitude is 3–9 % of thrust by ship type.
- **KVLCC2, the international benchmark tanker:**
  - Our 35° turn from 15.5 kn gives an advance of 3.60 L and a tactical diameter of 3.66 L.
  - That is within 0.5 % of an independent implementation of the published MMG model, and within about 2 % of the MMG paper's own full-scale prediction (Yasukawa & Yoshimura 2015).
  - The paper's 7 m model tests give 3.1–3.3 L. The difference is scale effect on the wake, which the paper discusses.
- **Azipod crash stop with the pods swung outward:**
  - Our three Azipod ships stop in 2.2–2.8 L.
  - Sea trials of the Azipod cruise ship *Elation* gave 2.4 L (TransNav, "Stopping of Ships Equipped with Azipods").
- **Pivot point in a steady turn:**
  - Published values are 0.12–0.25 L from the bow (closer for full hulls), with about 1/3 L as the seaman's rule of thumb. A full-scale Panamax trial measured 0.17 L.
  - Most ships here fall at 0.07–0.24 L. The fullest ones (Lady-class, LNG carrier, the VLCC in ballast) sit at or just ahead of the bow end of that range in hard-over turns.
  - The pivot point is not a setting: it comes out of the dynamics as the point with no sideways velocity, x = −v/r.
- **Propeller-to-rudder spacing and propeller immersion:** within normal practice for the other ships after the fixes below.

## Fixed

| What | Was | Now | Why |
| --- | --- | --- | --- |
| Bow and stern thrusters under way | Side force fell to 38 % at 4 kn, 21 % at 6 kn, 8 % at 10 kn | About 50 % by 3–4 kn, then level | Two independent model-test studies (a 60 000 dwt tanker, *Int. Shipbuilding Progress* 14/156, 1967; Japanese side-thruster tests, 1975) show the side force halving by 3–4 kn and then staying nearly constant. The joystick and DP allocators use the same curve. |
| Tug hulls (ASD, rotor, Voith) | Hull modelled to the navigational draught, the bottom of the drives or guard plate | Hull at its own draught (ASD 4.3 m, rotor 3.8 m, Voith 2.9 m); drives, fin and guard below it. Depth, grounding and under-keel clearance still use the full draught | The hull's destabilising moment grows with draught squared. Modelled 5 m deep, the rotor tug locked into a turn its thrusters could not check, and the Voith tractor turned the wrong way when thrust was put to the side at the bow. Voith describes the tractor as "a comparatively flat ship hull" with the propellers, guard plate and fin below it, the fin giving course stability and moving the centre of lateral resistance aft. Displacements are now realistic (about 700–830 t). |
| Escort towline | Tension read with the tanker's fairlead where it was at the start of the step; a steadily loaded line read slack | Tension taken with both ends at the same instant | The tow gauge showed about 0 t during a steady tow, and the escorted tanker got its reaction from that reading, so it barely felt the tug except for snatch loads. |
| Rudder positions | Twin-screw cruise ship 1.79 D behind the propeller, push convoy 2.05 D (and beyond the transom), superyacht 1.23 D, LNG carrier 1.13 D | 0.7–0.8 D, under the hull | Rudders sit close behind the propeller, in its slipstream. |
| VLCC in ballast | Even keel at 10.5 m: propeller tip at the surface, a third of the rudder in the air | Trimmed by the stern (about 12 m aft): propeller immersed, immersed rudder area 81 m² of 112.5 m² with its lift slope reduced for the shorter span | VLCCs ballast trimmed by the stern to keep the propeller and rudder working. |
| Trials: steering | Every unit given the same angle | Units forward of the centre of gravity steer the opposite way to those aft | The rotor tug's two forward thrusters fought the aft one (zig-zag overshoot 408°); the Voith tractor turned the wrong way. |
| Trials: Voith "hard over" | Thrust 35° to the side | 45°: full ahead and full steering together saturate the Voith order | How a Voith Schneider control combines its steering and propulsion orders. |
| Trials: rpm-reversal crash stop | Run for units that cannot reverse, giving a meaningless distance and a "NaN" time | "Not applicable": the units turn to go astern | ASD and rotor tugs, the PSV and Voith Schneider units have no astern rpm. |
| Trials: turn on the spot | "0°/min" for ships without a bow thruster | A thrust couple from the units themselves | Tugs and the icebreaker turn on their own units. |
| Trials: IMO grading | Every ship graded | Graded only where MSC.137(76) applies: ships of 100 m and over, plus all gas carriers and chemical tankers. Shorter ships still show the figures, with the limit as a note | Tugs and yachts were shown as "failing" a standard that does not cover them. |
| Ship sheet | Every Azipod ship described as "7.5°/s, 60 s reversal" | That ship's own azimuth rate and reversal time | Paspaley Pearl's smaller pods slew at 10°/s and reverse in 30 s. |
| 2D chart, waterjets | Jet symbol rotated with the nozzle, so the wash showed on the wrong side | Drawn along the jet's thrust axis | A waterjet pushes against its jet. |
| 2D chart, Z-drives | Drawn with the propeller ahead, like a pulling Azipod | Propeller behind the leg | Tug Z-drives push. |
| 3D propellers | Every pod at 140 rpm; spin direction taken from the unit's place in the list | Shaft speed from a typical blade-tip speed (about 130 rpm on a 6 m pod, 420 rpm on a 2 m pod); outward-turning by which side the unit is on | Small pods turn much faster than big ones. The list order happened to give the right directions for today's ships, but a new ship could have got them wrong. |

The regression baseline for the original Azipod ships was re-recorded. The bow-thruster correction is the only change to them: with the old curve put back, all records match exactly. The baseline now also covers every scenario.

### Follow-up: joystick and straight running (Paspaley Pearl)

Reported: on the Paspaley Pearl the joystick seemed to work backwards, and she would not hold a straight course.

| What | Was | Now | Why |
| --- | --- | --- | --- |
| Joystick sideways under way | Stick to starboard at 4 kn swung the yacht's bow to port at 37°/min, so she seemed to go the wrong way. Every sign in the allocator was right; the big ships swung 0–4°/min | 4°/min or less on every joystick ship, up to 8 kn | Drifting sideways while making way gives a hull turning moment (the Munk moment). Here it was about 390 kN·m, more than the yacht's 45 kN bow thruster can balance at that speed. The allocator commanded thrust as if it could, so the moment won. Two changes, both part of auto heading (HDG HOLD), which is now on whenever the joystick is selected. With it switched off the joystick is a plain force order, as in the manual joystick mode of real systems, and she swings as before. First, with the twist centred the gyro stops any swing, then gently keeps the heading she settled on. The rate gain scales with her length so the slow pods of a big ship don't hunt, and the heading term is kept soft because the bow thruster takes seconds to spin up. Second, the sideways order is cut back until the bow thruster can still balance it, so heading comes before sway. In the PortMiami channel at nearly 5 kn, with 13 kn of wind on the quarter, a full sideways stick now moves her about 1.3° off heading in 30 s (it was 19°/min). Twisting the stick still turns her, and POS HOLD works as before. HDG HOLD was a slow heading controller (0.06 rad/s, with weak rate damping); it is now this auto heading. The gains are chosen and tested here, not taken from any maker. |
| Pod dials | No centre detent: a pixel off dead ahead was 1° of pod angle, about 9°/min of swing on the yacht against 2°/min on a cruise ship | Snaps to dead ahead within 3° | You could never put the pods back exactly straight. |
| Paspaley Pearl pod alignment | Starboard pod mis-set by 0.3°, as on the big ships | Zeroed | On a 47 m hull that small error swung her 2.6°/min with the pods centred, which the centre detent would have made impossible to trim out. |
| Joystick on ships without a bow thruster | Allowed by the physics (the tugs' tray never offers it), and gave NaN | Not offered | The allocator divides by the bow thruster's lever arm. |

## Fleet trials after the audit

Deep, calm water, from full speed. Turning at hard over (35°; 45° for the Voith tractor), crash stop full astern (pods swung outward on pod ships).

| Ship | L (m) | Speed | Advance | Tactical diam. | 10/10 1st overshoot | Crash stop (track reach) | Pivot point (from bow) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MV Bécancour | 130 | 16.6 kn | 2.85 L | 3.52 L | 1.9° | 2.56 L | 0.11 L |
| Lady-class 278 m | 250 | 22.4 kn | 2.24 L | 2.22 L | 2.6° | 2.24 L | 0.05 L (pivot) |
| Spirit-class 293 m | 260.6 | 23.6 kn | 2.63 L | 3.38 L | 1.5° | 2.15 L | 0.12 L |
| VLCC · KVLCC2 hull | 320 | 15.8 kn | 3.60 L | 3.71 L | 5.8° | 14.37 L | 0.11 L |
| VLCC · KVLCC2 hull, ballast | 320 | 17.2 kn | 3.81 L | 4.32 L | 2.1° | 13.20 L | −0.03 L |
| Container 3600 TEU · KCS hull | 230 | 25.0 kn | 3.62 L | 4.07 L | 3.6° | 12.45 L | 0.17 L |
| Panamax bulk carrier | 222 | 15.7 kn | 4.01 L | 4.47 L | 3.5° | 16.08 L | 0.14 L |
| Container 24 000 TEU | 383 | 22.8 kn | 3.81 L | 4.37 L | 3.0° | 14.80 L | 0.13 L |
| LNG carrier 174 000 m³ | 285 | 18.6 kn | 3.27 L | 3.56 L | 2.9° | 14.66 L | 0.07 L |
| Ro-Pax ferry · twin CPP | 186 | 23.6 kn | 2.77 L | 3.09 L | 2.8° | 2.89 L | 0.11 L |
| Cruise ship · twin screw | 233 | 21.5 kn | 3.03 L | 3.36 L | 2.9° | 4.58 L | 0.11 L |
| ASD tug | 29 | 13.8 kn | 2.33 L | 1.72 L | 6.6° | 1.45 L | 0.10 L |
| Voith tractor tug | 29.5 | 11.8 kn | 7.67 L | 14.64 L | 0.6° | 1.00 L | 0.93 L |
| Rotor tug | 30 | 13.4 kn | 2.37 L | 2.29 L | 4.6° | 1.39 L | 0.29 L |
| Fast ferry (nozzles 30°) | 63 | 36.9 kn | 4.20 L | 5.17 L | 2.4° | 1.89 L | – |
| Platform supply vessel | 81 | 13.7 kn | 2.48 L | 2.51 L | 5.1° | 2.95 L | 0.21 L |
| Anchor-handling tug supply | 72 | 16.3 kn | 2.33 L | 2.22 L | 7.1° | 2.54 L | 0.14 L |
| Icebreaker · 3 Azipods | 96 | 16.7 kn | 2.32 L | 2.42 L | 4.1° | 1.76 L | 0.17 L |
| Push convoy | 190 | 7.0 kn | 1.49 L | 1.49 L | 2.8° | 1.35 L | 0.69 L (transfer) |
| Frigate · DTMB 5415 hull | 142 | 28.8 kn | 1.97 L | 2.20 L | 6.0° | 2.28 L | 0.96 L (transfer) |
| Superyacht | 80 | 20.4 kn | 2.57 L | 2.60 L | 4.7° | 4.29 L | 0.17 L |
| Bulk carrier · rotor sails | 222 | 15.7 kn | 4.01 L | 4.47 L | 3.5° | 16.08 L | 0.14 L |
| Paspaley Pearl | 47 | 12.6 kn | 2.41 L | 2.73 L | 2.9° | 1.89 L | 0.18 L |
| CB Baltic, laden | 177.4 | 13.5 kn | 3.63 L | 3.80 L | 3.4° | 8.84 L | 0.11 L |
| CB Baltic, ballast | 177.4 | 13.9 kn | 3.51 L | 3.49 L | 3.2° | 5.72 L | 0.08 L |

IMO MSC.137(76) limits, where they apply: advance < 4.5 L, tactical diameter < 5 L, 10/10 first overshoot 10–20° depending on L/V, crash stop < 15 L.

### CB Baltic against her own papers

She is set up from her pilot card, wheelhouse poster, particulars and loading computer, corrected where her officers say the papers are wrong.

| | Her papers | Her officers | Simulator |
| --- | --- | --- | --- |
| Full speed, laden | 13.7 kn | about 14 kn flat out | 13.5 kn |
| Full speed, ballast | 15.2 kn | about 14 kn | 13.9 kn |
| Astern | "75 % of ahead" (power) | about 30 % of ahead (thrust) | 30 % of the ahead bollard thrust |
| Ballast draughts | 7.8 m (particulars) | 7.5 m aft, 5.5 m forward | 7.53 / 5.57 m (loading computer), 6.55 m mean |
| Advance, laden (35°) | 648–699 m | | 644 m (stbd), 669 m (port) |
| Tactical diameter, laden | 542–578 m | | 674 m (stbd), 720 m (port) |
| Tactical diameter, ballast | 618–659 m | | 620 m (stbd), 674 m (port) |
| Crash stop, laden, head reach | 1 428 m (pilot card), 1 821 m (poster) | | 1 496 m |

The lever is her bridge programme: each order sets shaft speed and pitch as on the pilot card (dead slow 56.3 rpm and 40 % pitch up to navigation full 89.3 rpm and 100 %; astern −28 % to −100 % pitch). Clarke's regression gives her a tactical diameter about 15 % larger than the poster's in the laden condition, even with a large rudder; the advance and the ballast circle match. The propeller curves, the rudder area and type (taken as a high-lift rudder, since a plain one stalls before her 45°) are assumed.

## Hull model: moving the fleet onto published data

A literature review (2026) classified every ship by the data behind its hull model. Only the laden KVLCC2 has a
published captive-test MMG set (Yasukawa & Yoshimura 2015); the other ships use Clarke's regression, and every
shaft ship borrows KVLCC2's propeller–rudder interaction constants. The fleet is being moved ship by ship onto:

- **Unified hull** (`src/physics/hull/unified.ts`): Yoshimura, Nakao & Ishibashi (2009), MARSIM'09. Linear MMG
  derivatives plus one cross-flow drag integral with C_D, C_rY, C_rN, valid from zero speed to 180° drift. The paper
  prints C_rY in the yaw integral; its zero-speed turning equation (Eq. 10) holds only with C_rN, which is used. The
  C_D, C_rY, C_rN regressions (Eq. 19–21) are evaluated only inside their database (L/d 13.07–21.95, L/B 4.79–6.90).
- **Linear derivatives without captive data**: Kijima et al. (1990), Eq. (7), in Yoshimura's MMG form.
- **Shallow water**: Taimuri et al. (2020), Table 7: Kijima-type factors for Y'v, N'r and the cross-flow drag, the
  A1–A3 polynomial for Y'r, Ankudinov's factors for N'v and the added masses; held at their h/T 1.2 value below that
  depth. Ankudinov's K2 is taken as 0.0342/(h/T − 1) for every hull: the printed B/T > 4 branch gives factors above 50.

**KVLCC2, first ship moved.** The unified model alone, even with cross-flow coefficients fitted to KVLCC2's own
captive nonlinear terms, does not reproduce the captive model at sea speed: it lacks the drift and turn drag terms
(speed in a 35° turn fell from 4.6 to 2.3–2.9 kn) and its single integral cannot match the captive cubic couplings
(zig-zag overshoots 25–55 % low). So for a ship with captive data the captive MMG polynomials stay in charge where
the tests reached (manoeuvring speed, moderate drift and yaw) and the unified model, with cross-flow coefficients
measured on Esso Osaka up to 180° drift (Yoshimura 2009, Table 2), covers slow speed, large drift and sternway. In
deep water KVLCC2's turning and zig-zags are unchanged; in shallow water both parts use the published factors.

**KVLCC2 checked against the paper itself.** Yasukawa & Yoshimura (2015) was read in full. It confirms the full-scale
D_P 9.86 m and A_R 112.5 m² (Table 1; the open-source codes that disagreed had copied 7 m model values), the hull and
interaction coefficients (Tables 2–3) and K_T(J) = 0.2931 − 0.2753 J − 0.1385 J² (p. 49). Two corrections followed:
the full-scale wake w_P0 is 0.35 (0.40 is the 7 m model's), and the added masses are Motora-chart estimates, not
captive measurements. x'_P is not in the paper and stays at the usual −0.48. A new test runs KVLCC2 in the paper's
conditions (15.5 kn, constant revolutions, rudder rate 1.76°/s, k_zz 0.25 L) against its published full-scale
predictions (Tables 6–7): advance and tactical diameter within 1–5 %, zig-zag overshoots within 0.3–1.1°. The paper's
own method sits within 5.8 % of its free-running 7 m model tests at MARIN (Tables 4–5), which are listed beside them.
The corrected wake lets the propeller windmill faster with way on, so in a crash stop the shaft takes longer to fall
below the 40 % brake-air limit (about 108 s from 15 kn instead of 29 s); the track reach still meets the IMO limit.

**Push convoy, second ship moved.** The Hiroshima University pusher–barge captive tests (Koh, Yasukawa, Hirata & Kose
2008, 22BP 2 × 2 system) replace the strip hull inside their range (|β| ≤ 25°, |r′| ≤ 0.2): resistance X′0 0.0642,
Y′β, Y′r, N′β, N′r with the cubic couplings, and the paper's assumed pusher interaction values (t_P 0.164, w_P0 0.34,
ε 0.987, t_R 0.055, a_H 0.194, x′_H −0.427, γ_R 0.23, l′_R −1.033). Beyond that range strip-theory cross-flow (C_D 1.1)
carries the hull, and shallow water uses the simulator's own power laws, because the published Kijima-type factor
reaches about 13 for a convoy (Cb·B/T 5.9) at h/T 1.5. Consequences: the measured resistance is 2.4 times the strip
estimate, so the 4.5 MW pushboat now makes 7 kn through the water (it made 11 kn), and she turns tighter (tactical
diameter 1.49 L against 2.22 L). The 10/10 zig-zag overshoots are 2.8°/3.3°, against the paper's predicted 1.7°/1.9°
for the same pusher at 7 kn. The paper's tabulated added masses are about 14× below strip theory and look mis-scaled;
Clarke's are kept. Class: scaled (one model-scale pusher, not the Rhine convoy itself).

**Frigate (DTMB 5415), third ship moved.** The bare-hull captive tests of the 5512 model (the 1:46.6 geosim of the 5415)
in the Iowa (IIHR) tank, Yoon (2009), enter as tabulated by Hajivand & Mousavizadegan (2015, Tables 12–18, experimental
columns, Fn 0.28 ≈ 20 kn): Y′v −0.296, N′v −0.167, Y′r, N′r −0.0485, the cubic and cross-coupling terms, and the added
masses Y′v̇ −0.111, N′ṙ −0.0070. Two readings are ours and stated in the code: the tabulated nonlinear terms are Taylor
derivatives, so the polynomial coefficients are Y′vvv/6, Y′vvr/2 and so on (Eq. 33 of that paper); and the tabulated
Y′r is the measured Y′r − m′ (m′ 0.136), because only that makes the hull course-stable as the 5415 is (read as a hull-only
Y′r the same data give a 10/10 zig-zag overshoot of 12.8°/25.6° and an unstable ship). The polynomials hold where the
tests reached (drift to 20°, r′ to 0.75, u above 5 m/s); the unified hull covers the rest. No bare-hull resistance is
tabulated, so the simulator's own stays. Rudder and propeller interaction are not measured on this hull and remain
typical values. Nonlinear terms were also measured at Fn 0.138 and 0.41 (Y′vvv −1.63 and −3.80 against −1.95): the
Fn 0.28 set is used at all speeds, so the frigate at 29 kn has weaker nonlinear sway damping than the model had. Results:
tactical diameter 2.20 L (was 2.48), 10/10 zig-zag overshoot 6.0° (was 4.5°), 20/20 first overshoot 20.9°; the 5415's
published free-running manoeuvres were not available to check against.

**Lady-class (Azipod), fourth ship moved, hull only.** Kim, Yoon, Kim & Son (2013), J. Soc. Nav. Archit. Korea 50(6),
Table 4: captive tests of a 243 × 36 × 8.3 m twin-pod cruise ship (KRISO, 1:52, 8 kn; drift to 20°, circular motion to
r′ 1.0, pure yaw to r′ 2.2). Read from the page images; the paper non-dimensionalises with ½ρL²U², so the table values
times L/T give the MMG form. Its hull model has |v|v and |r|r damping in place of cubics (new optional terms in
`MmgHull`), and its own cross-flow coefficients from crabbing and still-turn tests (C_D0 0.695, C_rY 1.134, C_rN 1.316)
are used in the unified low-speed hull. The data are applied to the Lady-class hull as a scaled model (L/B 6.6 against
6.75, B/T 4.7 against 4.3). The pod model (thrust, strut force, hull–pod interaction) is still the simulator's own:
the paper's pod model has its own constants (t, κ, ε, a_H, x_H; K_T with pod angle) that are not yet built in, and
its Table 2 pod open-water coefficients could not be read from the page. Result in deep water: advance 2.24 L and
tactical diameter 2.22 L at 35° (were 2.82 and 3.47); the paper's free-running model at 16 kn: 2.25 L and 2.20 L.
The 10/10 zig-zag overshoot is 2.6°/3.5° against the model's 5.0°/7.25°: the ship checks yaw too readily, probably
the pod model's. Golden: only the 30 Lady records changed (`npm run golden` was re-recorded once for this).

**Open check.** At h/T 1.2 the published cross-flow factor makes KVLCC2's 90° drift force 6.7 × the deep value
(today's power law gave 3 ×). Tanker current-force data (OCIMF) is usually quoted nearer 4–5 × at that depth; compare
when that document is obtained.

## Open questions

These were looked into but could not be settled from published data. They are listed rather than tuned to a guess.

- **Two-stroke crash stops (VLCC, Panamax, LNG, container ships).** *Since changed, see below.*
  - **What happened:** after the stop order the propeller kept the engine turning (windmilling) at 32–42 % rpm for minutes. The engine waited for 32 % before an astern start, so the Panamax travelled 9.7 L before astern power was applied and stopped in 16 L. At harbour speeds, with the shaft already slow, it reversed almost at once.
  - **What sources say:** braking air is applied below about 40 % rpm (MAN B&W reversing descriptions). One source puts reversal at 15–30 s after the order.
  - **Changed (user request, then the sources):**
    - The astern start now waits for 40 % rpm and for the camshaft (fuel pumps and starting-air distributor) to be reversed, taking 20 s (`reverseTime`). That gives a reversal 15–30 s after the order at any speed.
    - Easing the rpm down now follows a load-down programme: 0.7 of the range in a minute, and slower above 80 %. It used to be 5 % a second. Geared and electric drives ease down 1.5 times more slowly than they speed up.
    - Panamax crash stop from sea speed: 11.6 L (it was 16 L).
    - The training-text figure for a laden 200 000 t tanker (about 25 minutes from 16 kn) still argues for longer stops; no trial data for these ships has been found.
- **Azipod stopping methods "pods 90°, rpm kept".** Against the six published model-test methods for a 277 m twin-Azipod ship, four agree within ±22 %; these two come out 56–64 % long. This predates the audit.
- **Voith tractor free-running turns.** With the hull and fin corrected she is very course-stable and turns about her fin: tactical diameter about 15 L at full speed and 45° steering. No published free-running turning data for these tugs was found; Voith publishes steering forces and simulator models built from captive tests, not turning circles.
- **3D bridge positions.** On seven ships the 3D model's bridge (where the bridge camera stands) is more than 8 % of the length away from the ship's conning position used for the GNSS antenna and the chart's reference point:
  - KCS and the 24 000 TEU ship share one model with a midships bridge; their real types have it aft and forward respectively.
  - Also the LNG carrier, the icebreaker, Bécancour, the fast ferry and the ASD tug.

  The physics keeps the type-correct position; better-matched 3D models would close the gap.
- **No public trial data** was found for most of these specific ship types (Panamax and VLCC crash stops, tug and yacht turning circles). Their values are typical of their classes, not one ship's measured data, as each ship's notes say.

## Sources

- Yasukawa, H. and Yoshimura, Y. (2015), *Introduction of MMG standard method for ship maneuvering predictions*, J. Mar. Sci. Technol. 20, 37–52, [doi:10.1007/s00773-014-0293-y](https://doi.org/10.1007/s00773-014-0293-y).
- Stern, F. et al. (2011), *Experience from SIMMAN 2008*, J. Ship Research 55(2), 135–147 ([MARIN](https://www.marin.nl/en/publications/experience-from-simman-2008-the-first-workshop-on-verification-and-validation-of-ship-maneuvering-simulation-methods)).
- *Stopping of Ships Equipped with Azipods*, TransNav ([PDF](https://www.transnav.eu/files/Stopping_of_Ships_Equipped_with_Azipods,519.pdf)).
- *Influence of forward speed on the manoeuvrability of a ship with a side thruster* ([TRID](https://trid.trb.org/View/159173)); *International Shipbuilding Progress* 14/156 ([IOS Press](https://content.iospress.com/articles/international-shipbuilding-progress/isp14-156-01)); *Experimental studies on the effectiveness of the side thruster* ([TRID](https://trid.trb.org/View/85435)).
- Tzeng, C.-Y. (1998), *Analysis of the pivot point for a turning ship*, J. Marine Science and Technology 6(1) ([JMSTT](https://jmstt.ntou.edu.tw/journal/vol6/iss1/5)); pivot-point practice ([KoreaScience](https://koreascience.kr/article/CFKO201224542272818.pdf)); full-scale Panamax trial ([KSMA](https://rep.ksma.ks.ua/bitstreams/ec2f54e4-b7ea-412c-9bf0-7531b7073a4a/download)).
- Jürgens, D. and Palm, M., *Voith Water Tractor – improved manoeuvrability and seakeeping behaviour* ([PDF](https://towmasters.wordpress.com/wp-content/uploads/2009/06/voithwatertractor.pdf)); Wärtsilä Encyclopedia, [Voith Water Tractor](https://www.wartsila.com/encyclopedia/term/voith-water-tractor).
- MAN B&W reversing ([marinediesels.info](https://www.marinediesels.info/2_stroke_engine_parts/Other_info/MANB&W_reversing.htm)); crash manoeuvring procedure ([marinesite.info](https://www.marinesite.info/2019/07/crash-manouvering-crash-stop-main-engine.html)).
- IMO MSC.137(76) criteria, as summarised in the ABS *Guide for Vessel Maneuverability* ([PDF](https://ww2.eagle.org/content/dam/eagle/rules-and-guides/current/conventional_ocean_service/145_vesselmaneuverability/Vessel_Maneuverability_Guide_e-Feb17.pdf)).
