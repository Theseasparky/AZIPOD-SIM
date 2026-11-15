// The skill pages (/skills/<id>/): which scenarios, ships, glossary terms and guide page belong to each skill.
// The words themselves are in scripts/i18n/<language>.ts, so each skill exists once here and once per language there.
export interface SkillDef { id: string; scenarios: string[]; ships: string[]; terms: string[]; guide?: string }

export const SKILLS: SkillDef[] = [
  { id: 'anchoring', scenarios: ['anchorage', 'split-medmoor'], ships: ['spirit', 'superyacht', 'paspaley-pearl'], terms: ['scope', 'shackle', 'windlass', 'brought-up', 'dragging'] },
  { id: 'mediterranean-mooring', scenarios: ['split-medmoor'], ships: ['superyacht', 'paspaley-pearl'], terms: ['med-moor', 'scope', 'mooring-lines', 'transverse-thrust'] },
  { id: 'berthing', scenarios: ['quai27', 'miami-terminal-v', 'la-cruise', 'amsterdam-pta', 'split-ferry', 'terminal'], ships: ['spirit', 'ropax', 'kvlcc2'], terms: ['pivot-point', 'spring', 'mooring-lines', 'bow-thruster', 'joystick'] },
  { id: 'locks', scenarios: ['ijm-lock-in', 'ijm-lock-out', 'ijm-lock-vlcc'], ships: ['spirit', 'kvlcc2-ballast'], terms: ['lock', 'squat', 'shallow-water', 'bank-effect', 'ukc'] },
  { id: 'tugs', scenarios: ['escort', 'lb-vlcc', 'terminal', 'miami-cargo', 'split-cruise'], ships: ['asd-tug', 'vsp-tug', 'rotor-tug'], terms: ['asd-tug', 'tractor-tug', 'rotor-tug', 'bollard-pull', 'indirect-towing', 'girting'], guide: '/learn/tugs/' },
  { id: 'azipod', scenarios: ['trials', 'quai27', 'miami-terminal-v'], ships: ['spirit', 'lady', 'becancour', 'paspaley-pearl'], terms: ['azipod', 'pivot-point', 'crash-stop', 'joystick', 'turning-circle'], guide: '/learn/azipod/' },
  { id: 'channels', scenarios: ['canal', 'meet', 'nzk-transit', 'river', 'lalb-gates'], ships: ['spirit', 'kcs', 'push-convoy'], terms: ['bank-effect', 'shallow-water', 'squat', 'interaction', 'ukc'] },
  { id: 'dynamic-positioning', scenarios: ['dp'], ships: ['psv', 'ahts'], terms: ['dp', 'joystick', 'azimuth-thruster', 'bow-thruster'], guide: '/learn/propulsion/' },
];
