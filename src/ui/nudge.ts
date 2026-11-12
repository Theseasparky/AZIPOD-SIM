// Fine-control buttons beside a lever, helm, dial or slider: one tap is one step, holding repeats.
// The buttons write through the same setters as a drag, so links and limits behave the same.
import { uiTick } from './audio';

const FIRST = 380, EVERY = 160;   // ms before the repeat starts, and between repeats

/** A press runs `act` once; holding repeats it until the pointer lets go or leaves. */
export function holdRepeat(b: HTMLElement, act: () => void) {
  let t = 0;
  const stop = () => { clearTimeout(t); t = 0; };
  const fire = () => { act(); uiTick('step'); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); stop(); fire(); const again = () => { fire(); t = window.setTimeout(again, EVERY); }; t = window.setTimeout(again, FIRST); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
  // keyboard and assistive technology: a click that did not come from a pointer
  b.addEventListener('click', e => { if ((e as PointerEvent).pointerType === '' || e.detail === 0) fire(); });
  b.addEventListener('contextmenu', e => e.preventDefault());
}
export function nudgeButton(text: string, label: string, act: () => void) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'nb'; b.textContent = text; b.setAttribute('aria-label', label);
  holdRepeat(b, act);
  return b;
}
/** Wrap a control with a − / + pair. 'side': the pair stacked beside it (a lever); 'ends': one at each end (a helm or slider). */
export function nudged(el: HTMLElement, layout: 'side' | 'ends', what: string, down: () => void, up: () => void, glyphs: [string, string] = ['−', '+'], words: [string, string] = ['down', 'up']) {
  const w = document.createElement('div'); w.className = 'nudge ' + layout;
  const lo = nudgeButton(glyphs[0], `${what} ${words[0]}`, down), hi = nudgeButton(glyphs[1], `${what} ${words[1]}`, up);
  if (layout === 'ends') w.append(lo, el, hi);
  else { const col = document.createElement('div'); col.className = 'nudge-col'; col.append(hi, lo); w.append(el, col); }
  return w;
}
/** The same for a slider that is already in the page: the buttons go either side of it. */
export function nudgeSlider(el: HTMLInputElement, what: string, write: (v: number) => void, read: () => number, step = 0.02) {
  const go = (d: number) => { const v = Math.max(-1, Math.min(1, Math.round((read() + d * step) * 100) / 100)); el.value = String(Math.round(v * 100)); write(v); };
  // a slider with a suggestion ghost keeps its own box, so the ghost still lines up with the track
  const box = (el.closest('.btslide') as HTMLElement | null) ?? el, w = document.createElement('div'); w.className = 'nudge ends';
  box.parentElement!.insertBefore(w, box);
  w.append(nudgeButton('−', `${what} to port`, () => go(-1)), box, nudgeButton('+', `${what} to starboard`, () => go(1)));
}
