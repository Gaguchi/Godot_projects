/**
 * combat/words.ts — what a card, a play and its forecast are CALLED, for every surface that has to say it.
 *
 * These strings were written twice over: once in `ui/combat/CardHand.tsx` (the face, the shape of a blast, the
 * status word) and once in `ui/combat/Hud.tsx` (the outcome and the reckoning), with the terminal — which
 * CONTRACT §10 makes a first-class way to play — printing the AUTHORED CODES instead, because `scripts/**` may
 * not import `ui/**` (CONTRACT §6). The headless hand read `Flame Burst  2 AP  tile  r1-2 aoe2`: the exact
 * `a tile r2` family ARCHITECTURE §5.1 bans and CONTRACT-CHANGES 0065 removed from the browser card face
 * (FINAL GATE A 1.3). So the word-maker moves down here and both surfaces read it — the 0094 shape, not a
 * second copy.
 *
 * Pure and framework-free: `combat/*` may import its siblings and `../types` (CONTRACT §6), which is all this
 * needs. No rendering decisions live here — the browser lifts the numbers out for `.numeral`, the terminal
 * prints the string.
 */
import { attackPower } from './damage'
import { quiverEffects } from './deck'
import type { Card, CardEffect, CombatUnit, DamageStat, Forecast, PlayableCard, QuiverModifier, StatusId } from '../types'

/** The display-name layer for statuses: a card face names the condition, never its id. */
export const STATUS_WORD: Readonly<Record<StatusId, string>> = {
  poison: 'poison', burn: 'burn', slow: 'slow', immobilize: 'held fast',
  taunt: 'taunt', riposte: 'riposte', empower: 'empower',
}

/** The damage stat in the player's language — a face never shows the authored key. */
export const STAT_WORD: Readonly<Record<DamageStat, string>> = { str: 'strength', mag: 'magic', skl: 'skill' }

/**
 * The damage this card puts out in THIS unit's hands, before the target's own defense: base + damage stat +
 * empower + the quiver baked onto the instance. `attackPower` is the reducer's own sum, so the face and the
 * forecast can never drift; `forecast.afterDr + quiverTerm` is this number less the target's DR.
 */
export function cardPower(base: number, card: Card, source: CombatUnit | null, mod: QuiverModifier | null): number {
  if (source === null) return base
  const quiver = mod === null ? 0 : quiverEffects(mod).reduce((n, q) => (q.kind === 'Damage' && q.target === 'target' ? n + q.base : n), 0)
  return attackPower(base, card.damageStat ?? null, source).total + quiver
}

/** The one number the card is about, and a one-line outcome (show outcomes, not components). */
export function cardFace(card: Card, source: CombatUnit | null = null, mod: QuiverModifier | null = null): { readonly number: string; readonly foot: string } {
  for (const e of card.effects) {
    if (e.kind === 'Damage') return { number: String(cardPower(e.base, card, source, mod)), foot: `${e.damageType === 'magic' ? 'magic' : 'damage'} · ${targetWord(card)}` }
  }
  for (const e of card.effects) {
    if (e.kind === 'Heal') return { number: `+${e.amount}`, foot: `heal · ${targetWord(card)}` }
    if (e.kind === 'GrantArmor') return { number: String(e.amount), foot: `armor · ${targetWord(card)}` }
    if (e.kind === 'DrawCards') return { number: `+${e.count}`, foot: `draw${e.gainAp ? ` · +${e.gainAp} ap` : ''}` }
    if (e.kind === 'GainAp') return { number: `+${e.amount}`, foot: `ap · ${targetWord(card)}` }
    if (e.kind === 'ApplyStatus') return { number: `${e.value}`, foot: `${STATUS_WORD[e.effectId]} ${e.turns} ${e.turns === 1 ? 'turn' : 'turns'} · ${targetWord(card)}` }
    if (e.kind === 'RemoveStatus') return { number: e.all === true ? '∅' : String(e.amount ?? 0), foot: `${e.remove === 'armor' ? 'shred armor' : 'cleanse'} · ${targetWord(card)}` }
    if (e.kind === 'Move') return { number: String(e.distance), foot: 'charge' }
  }
  return { number: '', foot: targetWord(card) }
}

/**
 * What the card DOES, in words — the body of the play panel when there is no damage forecast to run (an AoE pinned on
 * empty ground, a status-only or AP-only play). One line per effect, saying who it lands on: the player must never be
 * asked to confirm a card the screen has not described.
 */
export function cardIntentLines(card: Card, source: CombatUnit | null = null, mod: QuiverModifier | null = null): readonly string[] {
  return card.effects.map((e) => {
    const who = selectorWord(e.target, card)
    switch (e.kind) {
      case 'Damage': return `${cardPower(e.base, card, source, mod)} ${e.damageType} damage${e.armorPiercing === true ? ' (ignores armor)' : ''} ${who}`
      case 'Heal': return `heals ${e.amount} ${who}`
      case 'GrantArmor': return `${e.amount} armor ${who}`
      case 'ApplyStatus': return `${STATUS_WORD[e.effectId]} ${e.value} for ${e.turns} turn${e.turns === 1 ? '' : 's'} ${who}`
      case 'RemoveStatus': return `${e.all === true ? 'strips all' : `strips ${e.amount ?? 0}`} ${e.remove === 'armor' ? 'armor' : 'debuffs'} ${who}`
      case 'Move': return `steps up to ${e.distance} tiles in`
      case 'DrawCards': return `draws ${e.count} card${e.count === 1 ? '' : 's'}${e.gainAp === undefined ? '' : ` and +${e.gainAp} AP`}`
      case 'GainAp': return `+${e.amount} AP ${who}`
    }
  })
}

function selectorWord(target: CardEffect['target'], card: Card): string {
  switch (target) {
    case 'self': return 'to you'
    case 'target': return 'to the unit on the tile'
    case 'area': return card.targetKind === 'all_enemies' ? 'to every foe' : `to every foe within ${card.aoeRadius ?? 0} ${(card.aoeRadius ?? 0) === 1 ? 'tile' : 'tiles'}`
    case 'ally': return card.targetKind === 'all_allies' ? 'to every ally' : `to every ally within ${card.aoeRadius ?? 0} ${(card.aoeRadius ?? 0) === 1 ? 'tile' : 'tiles'}`
    case 'ring': return 'to foes beside the tile'
  }
}

/**
 * How wide a blast is, in words. The card foot used to print the authored
 * range CODE ("a tile r2"), which is a dev string on the loudest element in
 * the game (crafting-game-ui signal C). A radius is a shape the player feels,
 * so it is named, not numbered.
 */
export function blastWord(radius: number): string {
  if (radius <= 0) return ''
  if (radius === 1) return 'blast'
  return radius === 2 ? 'wide blast' : 'huge blast'
}

export function targetWord(card: Pick<Card, 'targetKind' | 'aoeRadius'>): string {
  const blast = blastWord(card.aoeRadius ?? 0)
  switch (card.targetKind) {
    case 'enemy': return blast === '' ? 'one foe' : `foes in a ${blast}`
    case 'ally': return blast === '' ? 'an ally' : `allies in a ${blast}`
    case 'self': return 'self'
    case 'tile': return blast === '' ? 'a tile' : `a ${blast}`
    case 'all_enemies': return 'all foes'
    case 'all_allies': return 'all allies'
  }
}

/**
 * How far it reaches, in words. The browser draws this — a wash of reachable tiles under the pinned card — and a
 * drawing needs no sentence; the terminal has no wash, and printed the authored band instead (`r1-2`), which is
 * the code §5.1 tells you to name or draw. It names the band and the ASCII board draws the tiles beside it
 * (`scripts/cli.ts#renderAim`), so the headless player gets both readings the browser gives.
 */
export function reachWord(card: Pick<PlayableCard, 'range'>): string {
  const { min, max } = card.range
  if (max <= 0) return 'where you stand'
  if (max === 1) return "at arm's reach"
  if (min <= 1) return `within ${max} tiles`
  return `${min} to ${max} tiles away`
}

/**
 * What the play CHANGES, in the player's terms. This is the line the panel leads with. `armorBefore` is the ward
 * the target already had: armor GRANTED lives in `predictedArmor`, not in a field of its own, so a ward card
 * would otherwise announce a play that visibly changes armor as no change at all.
 */
export function outcomeWords(f: Forecast, armorBefore = 0): string {
  const parts: string[] = []
  if (f.hpLost > 0) parts.push(`−${f.hpLost} HP`)
  if (f.armorLost > 0) parts.push(`−${f.armorLost} armor`)
  if (f.heal > 0) parts.push(`+${f.heal} HP`)
  const gained = f.predictedArmor - armorBefore
  if (gained > 0) parts.push(`+${gained} armor`)
  return parts.length === 0 ? 'Nothing changes' : parts.join(' · ')
}

/**
 * How that number was reckoned — the SECONDARY read, and never a formula: no `=`, no raw stat key, every term
 * named in a word the player has already seen on the card or the plaque.
 */
export function reckoningWords(f: Forecast): string {
  const parts = [`${f.baseTerm} base`]
  if (f.statTerm > 0) parts.push(`+${f.statTerm} ${f.statName === null ? 'power' : STAT_WORD[f.statName]}`)
  if (f.empowerTerm > 0) parts.push(`+${f.empowerTerm} empower`)
  if (f.quiverTerm > 0) parts.push(`+${f.quiverTerm} quiver`)
  if (f.drTerm > 0) parts.push(`−${f.drTerm} ${f.damageType === 'magic' ? 'resistance' : 'defense'}`)
  if (f.terrainDr > 0) parts.push(`−${f.terrainDr} cover`)
  return parts.join(' · ')
}

/** The riders a play carries, in the same words the card face uses. */
export function riderWords(riders: Forecast['riders']): string {
  return riders.map((r) => `${STATUS_WORD[r.status]} ${r.stacks} for ${r.turns} ${r.turns === 1 ? 'turn' : 'turns'}`).join(' · ')
}
