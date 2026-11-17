// Where each area's heavy data lives, and fetching it: the area pack (depths, land, charted bollards) and the
// chart. Fetched when an area is first opened and kept for offline use by the service worker. Main thread only
// (the workers get the pack posted to them), so the single-file build carries each pack once.
import { gunzip } from './pack';

// new URL(…, import.meta.url): an asset for Vite, a file for Node (the tests read the packs from disk)
const URLS: Record<string, { pack: string; chart: string }> = {
  miami: { pack: new URL('./miami/miami.azp', import.meta.url).href, chart: new URL('./miami/miami.azc', import.meta.url).href },
  lalb: { pack: new URL('./lalb/lalb.azp', import.meta.url).href, chart: new URL('./lalb/lalb.azc', import.meta.url).href },
  split: { pack: new URL('./split/split.azp', import.meta.url).href, chart: new URL('./split/split.azc', import.meta.url).href },
  ijmuiden: { pack: new URL('./ijmuiden/ijmuiden.azp', import.meta.url).href, chart: new URL('./ijmuiden/ijmuiden.azc', import.meta.url).href },
};
/** The areas' data files (for "download for offline use"). */
export const AREA_FILES = Object.values(URLS).flatMap(u => [u.pack, u.chart]);

/** Read a pack or chart: fetch in the browser, the file itself under Node. fresh: past any cached copy. */
async function load(url: string, fresh = false): Promise<ArrayBuffer> {
  if (url.startsWith('file:')) {
    const fs = await import(/* @vite-ignore */ 'node:fs' as string) as { readFileSync(p: URL): Uint8Array };
    const b = fs.readFileSync(new URL(url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  }
  const r = await fetch(url, fresh ? { cache: 'reload' } : undefined); if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
}
/** Forget the offline copy of a file (the service worker's area cache), so the next fetch goes to the network. */
async function forget(url: string) {
  if (typeof caches === 'undefined') return;
  try { for (const k of await caches.keys()) if (k.includes('area-data')) await (await caches.open(k)).delete(url); } catch { /* storage blocked */ }
}
/**
 * Fetch and read a file; if it cannot be read (a copy cut short when the connection dropped while it was being
 * saved for offline use is kept, and served, for good), forget the stored copy and fetch it again from the network.
 */
async function readFresh<T>(url: string, read: (b: ArrayBuffer) => Promise<T>): Promise<T> {
  try { return await read(await load(url)); } catch (first) {
    if (url.startsWith('file:')) throw first;
    console.warn('area data unreadable, fetching again:', url, first);
    await forget(url);
    return read(await load(url, true));
  }
}
const inflatePack = async (b: ArrayBuffer) => {
  const raw = await gunzip(b);
  const m = String.fromCharCode(...new Uint8Array(raw, 0, Math.min(4, raw.byteLength)));
  if (m !== 'AZP1') throw new Error(`not an area pack (${m || 'empty'}, ${b.byteLength} bytes)`);
  return raw;
};
const raw = new Map<string, Promise<ArrayBuffer>>();
/** The area pack, inflated (fetched once a session; the service worker keeps it for offline use). */
export function fetchAreaPack(id: string): Promise<ArrayBuffer> {
  let p = raw.get(id);
  if (!p) {
    p = readFresh(URLS[id].pack, inflatePack);
    raw.set(id, p); p.catch(() => raw.delete(id));
  }
  return p;
}
export async function fetchAreaChart(id: string): Promise<unknown> {
  return readFresh(URLS[id].chart, async b => JSON.parse(new TextDecoder().decode(await gunzip(b))));
}
