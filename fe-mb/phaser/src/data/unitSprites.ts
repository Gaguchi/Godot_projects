/**
 * THE unit-id → sprite mapping. Board sprites and portraits key on the unit's
 * stable `id` (with a classId fallback for generated enemies) — never on
 * display names. Display names are presentation: they can change, be
 * localized, or collide; ids cannot.
 *
 * Consumed by BoardScene (preload + board sprites) and CharacterPortrait
 * (dialogue/HUD portraits). Pure data: no Phaser, no React, no I/O.
 */

/** Units whose id carries authored art. Multi-copy group members get their
 *  member id suffixed (`wolf_0`, `wolf_1`…) — lookup strips one trailing
 *  numeric suffix so packs share their member's sprite. */
export const UNIT_ID_SPRITES: Record<string, string> = {
  roy: 'roy',
  marcus: 'marcus',
  lilina: 'lilina',
  garrik: 'garrik',
  lyra: 'lyra',
  kael: 'kael',
  daren: 'daren',
  wolf: 'wolf',
  bandit_archer: 'bandit_archer',
  brigand_chief: 'brigand_chief',
  warlord_boss: 'warlord',
}

/** Fallback for units without id-mapped art (generated enemies, recruits of
 *  classes with no personal sprite yet). */
export const CLASS_FALLBACK_SPRITE: Record<string, string> = {
  lord: 'roy',
  knight: 'marcus',
  mage: 'lilina',
  bandit: 'bandit',
  bandit_archer: 'bandit_archer',
  thief: 'thief',
  wolf: 'wolf',
  alpha_wolf: 'alpha_wolf',
  shield_knight: 'shield_knight',
  raider_mage: 'raider_mage',
  raider_cleric: 'raider_cleric',
  ember_mage: 'ember_mage',
  warlord: 'warlord',
}

/** Unique sprite ids — the preload manifest (BootScene + BoardScene). */
export const ALL_SPRITE_IDS: readonly string[] = [
  ...new Set([
    ...Object.values(UNIT_ID_SPRITES),
    ...Object.values(CLASS_FALLBACK_SPRITE),
  ]),
]

/** Unit id wins (exact, then with one `_N` copy-suffix stripped); classId
 *  fallback second; null = no sprite (unit renders as a shape token). */
export function spriteIdForUnit(
  unitId: string | null | undefined,
  classId: string,
): string | null {
  if (unitId) {
    const direct = UNIT_ID_SPRITES[unitId]
    if (direct) return direct
    const base = unitId.replace(/_\d+$/, '')
    const stripped = UNIT_ID_SPRITES[base]
    if (stripped) return stripped
  }
  return CLASS_FALLBACK_SPRITE[classId] ?? null
}

export function spritePathFor(spriteId: string): string {
  return `/sprites/units/${spriteId}.png`
}

/** Board-size bake of the same art (÷8, box-filtered — see
 *  scripts/cli/bake-board-sprites.ts). BoardScene loads these; portraits use
 *  `spritePathFor`. */
export function boardSpritePathFor(spriteId: string): string {
  return `/sprites/units/board/${spriteId}.png`
}
