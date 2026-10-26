import classesJson from '../../data/content/classes.json'
import cardsJson from '../../data/content/cards.json'
import { asUnitId, asClassId, asTileId, asItemId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'
import type { CombatEvent, CombatGrid, DeckState } from '../../domain/combatState'
import type { RngState } from '../../domain/rng'
import { buildDeckForUnit } from '../../systems/deckBuilder'
import { getItemDef } from '../../data/itemRegistry'

const DAMAGE_CARD_IDS = new Set(
  cardsJson.filter(c => c.effects.some(e => e.kind === 'Damage')).map(c => c.id),
)

/**
 * First-run tutorial (ship plan §12): 5×5 grid, Roy (Iron Sword) vs one
 * under-statted bandit. battleTag 'tutorial' drives the TutorialOverlay's
 * guided steps. ~60 seconds, can't realistically be lost.
 */
export function seedTutorialBattle(rngSeed: RngState): Extract<CombatEvent, { type: 'startBattle' }> {
  const classMap = new Map(classesJson.map((c) => [c.id, c]))
  const lord = classMap.get('lord')
  const bandit = classMap.get('bandit')
  if (!lord || !bandit) throw new Error('seedTutorialBattle: missing classes')

  const roy: Unit = {
    id: asUnitId('roy'),
    name: 'Roy',
    classId: asClassId('lord'),
    team: 'party',
    level: 1,
    hp: { current: lord.startingHp, max: lord.startingHp },
    stats: { ...lord.baseStats },
    position: asTileId('0,2'),
    ap: 3,
    armor: 0,
    statuses: [],
    handLeft: getItemDef('iron_sword') ? asItemId('iron_sword') : null,
    handRight: null,
  }
  const dummy: Unit = {
    id: asUnitId('tutorial_bandit'),
    name: 'Bandit',
    classId: asClassId('bandit'),
    team: 'enemy',
    level: 1,
    hp: { current: 10, max: 10 },
    stats: { ...bandit.baseStats, str: 2, spd: 1 },
    position: asTileId('4,2'),
    ap: 3,
    armor: 0,
    statuses: [],
  }

  const decks: Record<string, DeckState> = {}
  for (const u of [roy, dummy]) {
    const cls = classMap.get(u.classId as unknown as string)!
    decks[u.id as unknown as string] = buildDeckForUnit(u, {
      itemById: getItemDef,
      innateCardIds: cls.innateCardIds,
      cardDealsDamage: id => DAMAGE_CARD_IDS.has(id),
    })
  }

  // Authored floor: a worn dirt lane from Roy's tile to the bandit's. The
  // map-design rule is "draw the critical path first" — here the path IS the
  // tutorial's one instruction (advance toward the bandit), so the ground
  // says it before the overlay does. Shoulders keep it from reading as a rule.
  const grid: CombatGrid = {
    width: 5,
    height: 5,
    obstacles: new Set(),
    floor: ['0,2', '1,2', '2,2', '3,2', '4,2', '1,3', '2,1', '3,1'],
  }
  return {
    type: 'startBattle',
    payload: { units: [roy, dummy], grid, rngSeed, decks, battleTag: 'tutorial' },
  }
}
