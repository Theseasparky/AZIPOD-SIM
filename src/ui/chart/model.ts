// What a chart holds, whatever it was made from (an ENC, or a hand-built scenario's own depths):
// depth areas, contours, soundings, land and shoreline constructions, aids to navigation with their lights.
import type { Light } from './lights';

export type Ring = [number, number];                 // [n, e] m
export interface DepthArea { d1: number | null; d2: number | null; rings: Ring[][] }

/** An aid to navigation, S-57 style. */
export interface Aid {
  /** Object class: BOYLAT BOYCAR BOYISD BOYSAW BOYSPP (buoys), BCNLAT BCNCAR BCNISD BCNSAW BCNSPP (beacons),
   *  LIGHTS (a light on its own structure), LNDMRK, FOGSIG, MORFAC. */
  k: string;
  n: number; e: number;
  col: string[];               // body colours, top down (COLOUR)
  colpat?: number;             // COLPAT: 1 horizontal bands, 2 vertical stripes, 3 diagonal, 4 squared
  shp?: number;                // BOYSHP (1 conical, 2 can, 3 spherical, 4 pillar, 5 spar, 6 barrel, 7 super-buoy) or BCNSHP
  cat?: number;                // CATLAM (1 port, 2 stbd, 3 pref. channel to stbd, 4 to port) / CATCAM (1 N, 2 E, 3 S, 4 W)
  top?: number;                // TOPSHP
  topCol?: string[];
  name?: string;
  light?: Light;
  fog?: string;                // fog signal (horn, siren…)
}

export interface ChartModel {
  id: string;
  meta: { datum: string; iala: 'A' | 'B'; source: string; synthetic?: boolean; note?: string };
  /** Fill rule for the area rings: ENC rings carry holes the other way round only once oriented ('nonzero'). */
  fill: CanvasFillRule;
  depare: DepthArea[];
  drgare: { d: number | null; name?: string; rings: Ring[][] }[];
  land: Ring[][][];
  contours: { v: number | null; pts: Ring[] }[];
  soundings: [number, number, number][];
  slcons: { c: number | null; pts: Ring[] }[];
  aids: Aid[];
  labels: { k: string; n: number; e: number; t: string }[];
  bridges: { rings: Ring[][]; verclr?: number; name?: string }[];
}
