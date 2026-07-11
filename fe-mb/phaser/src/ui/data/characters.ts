/**
 * Character registry for dialogue UI placeholders.
 *
 * Each entry maps a speaker name (matches the `speaker` field on DialogueNode)
 * to a visual treatment: an IDENTITY accent (a CSS color value from the
 * `--id-*` ramp in index.css), initials, and a faction tag that drives
 * portrait shape variants.
 *
 * The accent is applied to:
 *   - portrait ring/border (and, mixed with ink via color-mix, the fill)
 *   - name plate underline (2px edge accent)
 *
 * Identity hues say WHO someone is — never what to do. Hearth ("act here")
 * and ember (threat) stay reserved for actions/danger.
 *
 * For unknown speakers, `defaultCharacter()` hashes the name into the same
 * 8-token ramp — never breaks, always stays on-palette.
 */
export type Faction = 'party' | 'enemy' | 'neutral' | 'narrator' | 'noble' | 'mystic'
export type PortraitShape = 'circle' | 'square' | 'hex' | 'diamond' | 'triangle'

/** The 8-token identity ramp defined in index.css (desaturated, warm-shifted). */
export const IDENTITY_RAMP = [
  'var(--id-gold)',
  'var(--id-steel)',
  'var(--id-rose)',
  'var(--id-moss)',
  'var(--id-arcane)',
  'var(--id-ember)',
  'var(--id-slate)',
  'var(--id-wine)',
] as const

export type IdentityAccent = (typeof IDENTITY_RAMP)[number]

export interface CharacterDef {
  /** Stable id (the speaker key). Empty string is the narrator. */
  id: string
  /** Display name (defaults to id). */
  displayName: string
  /** 1-2 chars rendered inside the portrait. */
  initials: string
  /** Authored sprite (public path). When set, portraits render it; initials are the fallback. */
  sprite?: string
  /**
   * Identity accent — a CSS color VALUE (an `--id-*` token reference).
   * Consumers derive fills via color-mix with ink; text stays parchment.
   */
  accent: IdentityAccent
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
    accent: 'var(--id-gold)',
    faction: 'party',
    shape: 'circle',
  },
  Marcus: {
    id: 'Marcus',
    displayName: 'Marcus',
    initials: 'Ma',
    sprite: '/sprites/units/marcus.png',
    accent: 'var(--id-steel)',
    faction: 'party',
    shape: 'square',
  },
  Lilina: {
    id: 'Lilina',
    displayName: 'Lilina',
    initials: 'Li',
    sprite: '/sprites/units/lilina.png',
    accent: 'var(--id-rose)',
    faction: 'mystic',
    shape: 'diamond',
  },
  Kael: {
    id: 'Kael',
    displayName: 'Kael',
    initials: 'Ka',
    sprite: '/sprites/units/kael.png',
    accent: 'var(--id-ember)',
    faction: 'neutral',
    shape: 'hex',
  },
  Daren: {
    id: 'Daren',
    displayName: 'Daren',
    initials: 'Da',
    sprite: '/sprites/units/daren.png',
    accent: 'var(--id-wine)',
    faction: 'enemy',
    shape: 'hex',
  },
  Garrik: {
    id: 'Garrik',
    displayName: 'Garrik',
    initials: 'Ga',
    sprite: '/sprites/units/garrik.png',
    accent: 'var(--id-slate)',
    faction: 'party',
    shape: 'square',
  },
  Lyra: {
    id: 'Lyra',
    displayName: 'Lyra',
    initials: 'Ly',
    sprite: '/sprites/units/lyra.png',
    accent: 'var(--id-moss)',
    faction: 'party',
    shape: 'circle',
  },
  Bandit: {
    id: 'Bandit',
    displayName: 'Bandit',
    initials: 'Ba',
    sprite: '/sprites/units/bandit.png',
    accent: 'var(--id-ember)',
    faction: 'enemy',
    shape: 'square',
  },
  'Bandit Archer': {
    id: 'Bandit Archer',
    displayName: 'Bandit Archer',
    initials: 'Ba',
    sprite: '/sprites/units/bandit_archer.png',
    accent: 'var(--id-ember)',
    faction: 'enemy',
    shape: 'square',
  },
  'Brigand Chief': {
    id: 'Brigand Chief',
    displayName: 'Brigand Chief',
    initials: 'Bc',
    sprite: '/sprites/units/brigand_chief.png',
    accent: 'var(--id-wine)',
    faction: 'enemy',
    shape: 'hex',
  },
  Wolf: {
    id: 'Wolf',
    displayName: 'Wolf',
    initials: 'Wo',
    sprite: '/sprites/units/wolf.png',
    accent: 'var(--id-slate)',
    faction: 'enemy',
    shape: 'triangle',
  },
  'Shield Knight': {
    id: 'Shield Knight', displayName: 'Shield Knight', initials: 'Sk',
    sprite: '/sprites/units/shield_knight.png',
    accent: 'var(--id-slate)',
    faction: 'enemy', shape: 'square',
  },
  'Raider Mage': {
    id: 'Raider Mage', displayName: 'Raider Mage', initials: 'Rm',
    sprite: '/sprites/units/raider_mage.png',
    accent: 'var(--id-arcane)',
    faction: 'enemy', shape: 'diamond',
  },
  'Raider Cleric': {
    id: 'Raider Cleric', displayName: 'Raider Cleric', initials: 'Rc',
    sprite: '/sprites/units/raider_cleric.png',
    accent: 'var(--id-moss)',
    faction: 'enemy', shape: 'diamond',
  },
  'Bone Dagger Thief': {
    id: 'Bone Dagger Thief', displayName: 'Thief', initials: 'Th',
    sprite: '/sprites/units/thief.png',
    accent: 'var(--id-moss)',
    faction: 'enemy', shape: 'triangle',
  },
  'Ember Mage': {
    id: 'Ember Mage', displayName: 'Ember Mage', initials: 'Em',
    sprite: '/sprites/units/ember_mage.png',
    accent: 'var(--id-ember)',
    faction: 'enemy', shape: 'diamond',
  },
  'Alpha Wolf': {
    id: 'Alpha Wolf', displayName: 'Alpha Wolf', initials: 'Aw',
    sprite: '/sprites/units/alpha_wolf.png',
    accent: 'var(--id-gold)',
    faction: 'enemy', shape: 'triangle',
  },
  'The Warlord': {
    id: 'The Warlord',
    displayName: 'The Warlord',
    initials: 'Wl',
    sprite: '/sprites/units/warlord.png',
    accent: 'var(--id-wine)',
    faction: 'enemy',
    shape: 'hex',
  },
  'Bandit Leader': {
    id: 'Bandit Leader',
    displayName: 'Bandit Leader',
    initials: 'Bl',
    sprite: '/sprites/units/brigand_chief.png',
    accent: 'var(--id-ember)',
    faction: 'enemy',
    shape: 'square',
  },
  'Traveling Merchant': {
    id: 'Traveling Merchant',
    displayName: 'Merchant',
    initials: 'Mr',
    accent: 'var(--id-moss)',
    faction: 'neutral',
    shape: 'square',
  },
  'Wounded Traveler': {
    id: 'Wounded Traveler',
    displayName: 'Traveler',
    initials: 'Wt',
    accent: 'var(--id-slate)',
    faction: 'neutral',
    shape: 'circle',
  },
  Narrator: {
    id: 'Narrator',
    displayName: 'Narrator',
    initials: '',
    accent: 'var(--id-slate)',
    faction: 'narrator',
    shape: 'circle',
  },
}

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
 * Deterministic styling for an unknown speaker: hash the name into the SAME
 * 8-token identity ramp the curated cast uses, so surprise speakers still sit
 * inside the Forged & Lit palette.
 */
export function defaultCharacter(speaker: string): CharacterDef {
  return {
    id: speaker,
    displayName: speaker,
    initials: initialsOf(speaker),
    accent: IDENTITY_RAMP[hashName(speaker) % IDENTITY_RAMP.length]!,
    faction: 'neutral',
    shape: 'circle',
  }
}

/**
 * Look up a speaker. Empty / null name → Narrator. Unknown speakers get a
 * deterministic on-ramp fallback styling so the UI never breaks.
 */
export function getCharacter(speaker: string | undefined): CharacterDef {
  if (!speaker) return KNOWN['Narrator']!
  return KNOWN[speaker] ?? defaultCharacter(speaker)
}
