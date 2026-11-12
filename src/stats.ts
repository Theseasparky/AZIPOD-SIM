// Anonymous usage counts, so the author can see how many people use the simulator and how often.
// Nothing here identifies anyone: no cookie, no identifier, no position, nothing typed. Counts go to
// GoatCounter (which stores no personal data), only when a site code is set at build time, the player has not
// switched them off, and the browser does not ask not to be tracked. With no connection nothing is sent
// and nothing is queued. The logic is kept free of the DOM so it can be tested.

export interface StatsEnv {
  site: string;                 // GoatCounter site code; empty = statistics off
  enabled: boolean;             // the player's own switch
  online: boolean;
  doNotTrack: boolean;          // Do Not Track or Global Privacy Control
  automated: boolean;           // a test browser, capture mode, a file opened from disk, a local server
}
/** Whether anything may be sent at all. */
export const mayCount = (e: StatsEnv) => !!e.site && e.enabled && e.online && !e.doNotTrack && !e.automated;

export interface Returning { days: number; last: string | null }
/** How many different days this device has used the app, as a coarse band. */
export const daysBand = (days: number) => (days <= 1 ? 'first-day' : days <= 5 ? '2-5-days' : days <= 20 ? '6-20-days' : 'over-20-days');
/** How long since the last day of use, as a coarse band. */
export function gapBand(last: string | null, today: string) {
  if (!last) return 'new';
  const d = Math.round((Date.parse(today) - Date.parse(last)) / 86400e3);
  return d <= 0 ? 'same-day' : d <= 1 ? 'next-day' : d <= 7 ? 'within-a-week' : d <= 31 ? 'within-a-month' : 'longer';
}
/**
 * A new app start: what to remember on the device, and the two bands to count.
 * A second start on the same day counts as 'same-day' and does not add a day.
 */
export function comeBack(prev: Returning, today: string): { next: Returning; days: string; gap: string } {
  const same = prev.last === today;
  const next = { days: same ? Math.max(1, prev.days) : prev.days + 1, last: today };
  return { next, days: daysBand(next.days), gap: gapBand(prev.last, today) };
}
/** The address of one count. Only a path, a title and whether it is an event: no identifier of any kind. */
export function countUrl(site: string, path: string, title: string, event: boolean, rnd = Math.random().toString(36).slice(2, 7)) {
  const q = new URLSearchParams({ p: path, t: title, ...(event ? { e: 'true' } : {}), rnd });
  return `https://${site}.goatcounter.com/count?${q}`;
}

// ---------------------------------------------------------------- the browser side
const KEY_OFF = 'azb-stats', KEY_SEEN = 'azb-stats-days';
const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export const statsSite = () => __STATS_SITE__;
export const statsOn = () => ls.get(KEY_OFF) !== 'off';
export function setStats(on: boolean) { ls.set(KEY_OFF, on ? 'on' : 'off'); }
function env(): StatsEnv {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; webdriver?: boolean };
  const local = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
  return {
    site: __PWA__ ? __STATS_SITE__ : '', enabled: statsOn(), online: n.onLine !== false,
    doNotTrack: n.doNotTrack === '1' || n.globalPrivacyControl === true,
    automated: !!n.webdriver || local || new URLSearchParams(location.search).has('capture'),
  };
}
const sent = new Set<string>();
function count(path: string, title: string, event: boolean) {
  const e = env();
  if (!mayCount(e) || sent.has(path)) return;
  sent.add(path);
  try { navigator.sendBeacon(countUrl(e.site, path, title, event)); } catch { /* never in the way of the app */ }
}
/** Once per app start: the visit, the version and how the app runs, and the two come-back bands. */
export function countVisit(version: string, installed: boolean) {
  if (!mayCount(env())) return;
  let prev: Returning = { days: 0, last: null };
  try { const v = JSON.parse(ls.get(KEY_SEEN) ?? 'null'); if (v && typeof v.days === 'number') prev = { days: v.days, last: typeof v.last === 'string' ? v.last : null }; } catch { /* start afresh */ }
  const r = comeBack(prev, new Date().toISOString().slice(0, 10));
  ls.set(KEY_SEEN, JSON.stringify(r.next));
  count('/app', `SHIPSHAPE ${version}`, false);
  count(`use/${installed ? 'installed' : 'browser'}`, installed ? 'Installed app' : 'In a browser tab', true);
  count(`days/${r.days}`, `Days used: ${r.days}`, true);
  count(`back/${r.gap}`, `Back after: ${r.gap}`, true);
}
/** Which ship and which place are opened (once each per app start). */
export function countUse(ship: string, place: string) {
  count(`ship/${ship}`, `Ship: ${ship}`, true);
  count(`place/${place}`, `Place: ${place}`, true);
}
