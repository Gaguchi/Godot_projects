/**
 * Character registry for dialogue UI placeholders.
 *
 * Each entry maps a speaker name (matches the `speaker` field on DialogueNode)
 * to a visual treatment: accent color (Tailwind palette), initials, and a
 * faction tag that drives portrait shape variants.
 *
 * Per-character accent is applied to:
 *   - portrait fill background
 *   - name plate underline (via `plateUnderlineClass`)
 *   - subtle border on the modal's speaker side
 *
 * For unknown speakers, `defaultCharacter()` derives a deterministic styling
 * from a name hash — never breaks, always reads as intentional.
 */
export type Faction = 'party' | 'enemy' | 'neutral' | 'narrator' | 'noble' | 'mystic'
export type PortraitShape = 'circle' | 'square' | 'hex' | 'diamond' | 'triangle'

export interface CharacterDef {
  /** Stable id (the speaker key). Empty string is the narrator. */
  id: string
  /** Display name (defaults to id). */
  displayName: string
  /** 1-2 chars rendered inside the portrait. */
  initials: string
  /** Authored sprite (public path). When set, portraits render it; initials are the fallback. */
  sprite?: string
  /** Tailwind class fragment that becomes bg-{color}. */
  bgColor: string
  /** Tailwind class for portrait ring + name plate underline. */
  ringColor: string
  /** Text color over the portrait bg. */
  textColor: string
  faction: Faction
  shape: PortraitShape
}

/**
 * Hand-curated entries for known speakers. Mirrors all dialogue trees ported
 * in GP-B5 plus the narrator (empty speaker).
 */
const KNOWN: Record<string, CharacterDef> = {
  Roy: {
    id: 'Roy',
    displayName: 'Roy',
    initials: 'Ro',
    sprite: '/sprites/units/roy.png',
    bgColor: 'bg-amber-700',
    ringColor: 'ring-amber-300 border-amber-300',
    textColor: 'text-amber-50',
    faction: 'party',
    shape: 'circle',
  },
  Marcus: {
    id: 'Marcus',
    displayName: 'Marcus',
    initials: 'Ma',
    sprite: '/sprites/units/marcus.png',
    bgColor: 'bg-sky-800',
    ringColor: 'ring-sky-400 border-sky-400',
    textColor: 'text-sky-50',
    faction: 'party',
    shape: 'square',
  },
  Lilina: {
    id: 'Lilina',
    displayName: 'Lilina',
    initials: 'Li',
    sprite: '/sprites/units/lilina.png',
    bgColor: 'bg-rose-700',
    ringColor: 'ring-rose-300 border-rose-300',
    textColor: 'text-rose-50',
    faction: 'mystic',
    shape: 'diamond',
  },
  Kael: {
    id: 'Kael',
    displayName: 'Kael',
    initials: 'Ka',
    sprite: '/sprites/units/kael.png',
    bgColor: 'bg-orange-800',
    ringColor: 'ring-orange-300 border-orange-300',
    textColor: 'text-orange-50',
    faction: 'neutral',
    shape: 'hex',
  },
  Daren: {
    id: 'Daren',
    displayName: 'Daren',
    initials: 'Da',
    sprite: '/sprites/units/daren.png',
    bgColor: 'bg-yellow-900',
    ringColor: 'ring-yellow-500 border-yellow-500',
    textColor: 'text-yellow-100',
    faction: 'enemy',
    shape: 'hex',
  },
  Garrik: {
    id: 'Garrik',
    displayName: 'Garrik',
    initials: 'Ga',
    sprite: '/sprites/units/garrik.png',
    bgColor: 'bg-stone-700',
    ringColor: 'ring-stone-400 border-stone-400',
    textColor: 'text-stone-100',
    faction: 'party',
    shape: 'square',
  },
  Lyra: {
    id: 'Lyra',
    displayName: 'Lyra',
    initials: 'Ly',
    sprite: '/sprites/units/lyra.png',
    bgColor: 'bg-emerald-800',
    ringColor: 'ring-emerald-300 border-emerald-300',
    textColor: 'text-emerald-50',
    faction: 'party',
    shape: 'circle',
  },
  Bandit: {
    id: 'Bandit',
    displayName: 'Bandit',
    initials: 'Ba',
    sprite: '/sprites/units/bandit.png',
    bgColor: 'bg-red-900',
    ringColor: 'ring-red-400 border-red-400',
    textColor: 'text-red-100',
    faction: 'enemy',
    shape: 'square',
  },
  'Bandit Archer': {
    id: 'Bandit Archer',
    displayName: 'Bandit Archer',
    initials: 'Ba',
    sprite: '/sprites/units/bandit_archer.png',
    bgColor: 'bg-red-950',
    ringColor: 'ring-red-500 border-red-500',
    textColor: 'text-red-100',
    faction: 'enemy',
    shape: 'square',
  },
  'Brigand Chief': {
    id: 'Brigand Chief',
    displayName: 'Brigand Chief',
    initials: 'Bc',
    sprite: '/sprites/units/brigand_chief.png',
    bgColor: 'bg-red-900',
    ringColor: 'ring-red-400 border-red-400',
    textColor: 'text-red-100',
    faction: 'enemy',
    shape: 'hex',
  },
  Wolf: {
    id: 'Wolf',
    displayName: 'Wolf',
    initials: 'Wo',
    sprite: '/sprites/units/wolf.png',
    bgColor: 'bg-stone-800',
    ringColor: 'ring-stone-500 border-stone-500',
    textColor: 'text-stone-100',
    faction: 'enemy',
    shape: 'triangle',
  },
  'Shield Knight': {
    id: 'Shield Knight', displayName: 'Shield Knight', initials: 'Sk',
    sprite: '/sprites/units/shield_knight.png',
    bgColor: 'bg-slate-800', ringColor: 'ring-slate-400 border-slate-400', textColor: 'text-slate-100',
    faction: 'enemy', shape: 'square',
  },
  'Raider Mage': {
    id: 'Raider Mage', displayName: 'Raider Mage', initials: 'Rm',
    sprite: '/sprites/units/raider_mage.png',
    bgColor: 'bg-violet-900', ringColor: 'ring-violet-400 border-violet-400', textColor: 'text-violet-100',
    faction: 'enemy', shape: 'diamond',
  },
  'Raider Cleric': {
    id: 'Raider Cleric', displayName: 'Raider Cleric', initials: 'Rc',
    sprite: '/sprites/units/raider_cleric.png',
    bgColor: 'bg-stone-700', ringColor: 'ring-stone-400 border-stone-400', textColor: 'text-stone-100',
    faction: 'enemy', shape: 'diamond',
  },
  'Bone Dagger Thief': {
    id: 'Bone Dagger Thief', displayName: 'Thief', initials: 'Th',
    sprite: '/sprites/units/thief.png',
    bgColor: 'bg-emerald-950', ringColor: 'ring-emerald-500 border-emerald-500', textColor: 'text-emerald-100',
    faction: 'enemy', shape: 'triangle',
  },
  'Ember Mage': {
    id: 'Ember Mage', displayName: 'Ember Mage', initials: 'Em',
    sprite: '/sprites/units/ember_mage.png',
    bgColor: 'bg-red-950', ringColor: 'ring-orange-500 border-orange-500', textColor: 'text-orange-100',
    faction: 'enemy', shape: 'diamond',
  },
  'Alpha Wolf': {
    id: 'Alpha Wolf', displayName: 'Alpha Wolf', initials: 'Aw',
    sprite: '/sprites/units/alpha_wolf.png',
    bgColor: 'bg-stone-900', ringColor: 'ring-amber-600 border-amber-600', textColor: 'text-amber-100',
    faction: 'enemy', shape: 'triangle',
  },
  'The Warlord': {
    id: 'The Warlord',
    displayName: 'The Warlord',
    initials: 'Wl',
    sprite: '/sprites/units/warlord.png',
    bgColor: 'bg-red-950',
    ringColor: 'ring-red-500 border-red-500',
    textColor: 'text-red-100',
    faction: 'enemy',
    shape: 'hex',
  },
  'Bandit Leader': {
    id: 'Bandit Leader',
    displayName: 'Bandit Leader',
    initials: 'Bl',
    sprite: '/sprites/units/brigand_chief.png',
    bgColor: 'bg-red-900',
    ringColor: 'ring-red-400 border-red-400',
    textColor: 'text-red-100',
    faction: 'enemy',
    shape: 'square',
  },
  'Traveling Merchant': {
    id: 'Traveling Merchant',
    displayName: 'Merchant',
    initials: 'Mr',
    bgColor: 'bg-emerald-800',
    ringColor: 'ring-emerald-300 border-emerald-300',
    textColor: 'text-emerald-50',
    faction: 'neutral',
    shape: 'square',
  },
  'Wounded Traveler': {
    id: 'Wounded Traveler',
    displayName: 'Traveler',
    initials: 'Wt',
    bgColor: 'bg-stone-700',
    ringColor: 'ring-stone-400 border-stone-400',
    textColor: 'text-stone-100',
    faction: 'neutral',
    shape: 'circle',
  },
  Narrator: {
    id: 'Narrator',
    displayName: 'Narrator',
    initials: '',
    bgColor: 'bg-stone-950',
    ringColor: 'ring-stone-600 border-stone-600',
    textColor: 'text-stone-400',
    faction: 'narrator',
    shape: 'circle',
  },
}

const FALLBACK_PALETTE: Pick<CharacterDef, 'bgColor' | 'ringColor' | 'textColor'>[] = [
  { bgColor: 'bg-violet-800', ringColor: 'ring-violet-400 border-violet-400', textColor: 'text-violet-50' },
  { bgColor: 'bg-teal-800', ringColor: 'ring-teal-400 border-teal-400', textColor: 'text-teal-50' },
  { bgColor: 'bg-fuchsia-800', ringColor: 'ring-fuchsia-300 border-fuchsia-300', textColor: 'text-fuchsia-50' },
  { bgColor: 'bg-cyan-800', ringColor: 'ring-cyan-400 border-cyan-400', textColor: 'text-cyan-50' },
  { bgColor: 'bg-lime-800', ringColor: 'ring-lime-400 border-lime-400', textColor: 'text-lime-50' },
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    const w = parts[0]!
    return w.length >= 2 ? (w[0]! + w[1]!.toLowerCase()) : w[0]!.toUpperCase()
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

/**
 * Character identity as an EDGE accent (materials §4.2: never a full colored
 * outline). Extracts the `border-*` classes from `ringColor` so the dialogue
 * name plate can render a 2px bottom underline in the character hue while the
 * plate itself stays on the shared iron material.
 */
export function plateUnderlineClass(c: CharacterDef): string {
  return c.ringColor
    .split(' ')
    .filter((cl) => cl.startsWith('border-'))
    .join(' ')
}

/**
 * Look up a speaker. Empty / null name → Narrator. Unknown speakers get a
 * deterministic fallback styling so the UI never breaks.
 */
export function getCharacter(speaker: string | undefined): CharacterDef {
  if (!speaker) return KNOWN['Narrator']!
  const known = KNOWN[speaker]
  if (known) return known
  // Unknown speaker: pick a fallback palette deterministically by name hash.
  const palette = FALLBACK_PALETTE[hashName(speaker) % FALLBACK_PALETTE.length]!
  return {
    id: speaker,
    displayName: speaker,
    initials: initialsOf(speaker),
    bgColor: palette.bgColor,
    ringColor: palette.ringColor,
    textColor: palette.textColor,
    faction: 'neutral',
    shape: 'circle',
  }
}
