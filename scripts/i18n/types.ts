// The words of the reading pages, one file per language. English (en.ts) is the original; the others translate it.
// Ship particulars, scenario briefs and the sourced training notes stay in English and are linked from every language.

/** Figures the text quotes, taken from the simulator so no language goes stale. */
export interface Ctx { ships: number; scenarios: number; terms: number; version: string; year: string }

export type Lang = 'en' | 'es' | 'hr' | 'fr' | 'it' | 'pt' | 'de' | 'nl';
export interface Titled { title: string; description: string; h1: string; lede?: string }

export interface Locale {
  code: Lang;
  /** The language's name in itself, for the switcher. */
  name: string;
  ui: {
    sim: string; fleet: string; places: string; skills: string; learn: string; faq: string; about: string; glossary: string; news: string;
    skip: string; mainNav: string; footNav: string; crumbs: string; language: string;
    /** "a free ship-handling simulator by Kal.M" */
    byline: string; updated: string; notNav: string; offline: string; source: string;
    openSim: string; open: string; see: string; english: string;
    whatItIs: string; howTo: string; practise: string; ships: string; terms: string; guide: string; moreSkills: string;
    /** Under the language switcher on translated pages. */
    appNote: string;
    scenarios: (n: number) => string;
  };
  home?: Titled & { kicker: string; points: string[] };
  about: Titled & { what: string; why: string; model: string; access: string; privacy: string; who: string; credits: string; citeIntro: string; h: { why: string; model: string; data: string; access: string; privacy: string; who: string; cite: string; credits: string } };
  faq: Titled & { items: [string, string][] };
  places: Titled & { items: Record<string, { name: string; about: string; chart: string }> };
  skills: Titled & { items: Record<string, { title: string; lede: string; what: string[]; steps: string[] }> };
  glossary: Titled & { items: Record<string, { term: string; also?: string[]; def: string }> };
}
