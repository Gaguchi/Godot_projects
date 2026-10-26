/**
 * combat/reasons.ts — the sentences the battlefield refuses with.
 *
 * A refusal reason is PLAYER-FACING TEXT (ARCHITECTURE §5.1: "a lowercase fragment, no stop — it completes an
 * implied 'because …'"), and the combat package used to answer with camelCase enum members instead: `noPath`,
 * `notInHand`, `outOfMoveRange`, `alreadyMoved`. They were invisible in the browser and printed verbatim to the
 * headless player, who is playing the same game (ARCHITECTURE §6, CONTRACT §10) — `· REFUSED combat/playCard:
 * noPath`. Twenty-three of them.
 *
 * Every rule now names its sentence HERE, so there is one home for each and every surface reads the same words:
 * the CLI's refusal line, `menu()`'s withheld verbs, and any on-glass surface the combat screen grows. Several
 * are shared between the card resolver and the free move (a wall is a wall for either), which is the other half
 * of why they are constants rather than literals at each site.
 *
 * Four of them (`BATTLE_OVER`, `NO_ACTIVE_UNIT`, `ENEMY_ACTING`, `NOT_ENEMY_TURN`) are the words
 * `flow/legality.ts` already answers the same four conditions with — the gate refuses first, so the reducer's
 * copies are reached only by a direct `reduceCombat` call, and when they are they must not read differently.
 */

/** AP is quoted the way the card face quotes it (`ui/combat/CardHand.tsx`): "needs 2 AP". */
export function needsAp(cost: number): string {
  return `needs ${cost} AP`
}

// ── the board ──
export const OFF_THE_FIELD = 'off the edge of the field'
export const A_WALL_THERE = 'a wall stands there'
export const SOMEONE_THERE = 'someone is standing there'
export const ALREADY_THERE = 'already standing there'
export const TOO_FAR_TO_WALK = 'too far to walk this turn'
export const NOT_ON_THE_FIELD = 'that one is not on the field'

// ── the free move ──
export const ALREADY_MOVED = 'already moved this turn'
export const ROOTED = 'rooted in place'

// ── a card and its target ──
export const NOT_IN_HAND = 'that card is not in hand'
export const NO_CARD_CHOSEN = 'no card is chosen'
export const NOT_A_TARGET = 'not a tile this one can strike'
export const NO_TILE_CHOSEN = 'no tile is chosen'
export const STRIKES_ON_ITS_OWN = 'this one needs no tile — it strikes on its own'
export const USED_ON_ONESELF = 'this one is used on oneself'
export const OUT_OF_REACH = 'out of reach'
export const NO_FOE_THERE = 'no foe on that tile'
export const NO_FRIEND_THERE = 'no friend on that tile'
export const NO_WAY_THROUGH = 'no way through to strike from'

// ── the satchel ──
export const NOT_IN_SATCHEL = 'nothing like that in the satchel'

// ── capture ──
export const NO_FOE_IN_REACH = "no foe within arm's reach"
export const NOT_IN_ARMS_REACH = "not within arm's reach"
export const NO_FOE_TO_TAKE = 'no foe there to take'

// ── whose turn it is (the gate's own words; see the header) ──
export const BATTLE_OVER = 'the battle is over'
export const NO_ACTIVE_UNIT = 'no active unit'
export const ENEMY_ACTING = 'the enemy is acting'
export const NOT_ENEMY_TURN = 'not the enemy turn'
export const NOT_OF_THE_COMPANY = 'not one of the company'
export const NOT_THE_ACTIVE_UNIT = 'that one does not have the initiative'

// ── an enemy's own turn (reached only by a malformed plan; still prose) ──
export const NO_ACTION_LEFT = 'no action left this turn'
export const NO_SUCH_ACTION = 'there is no such action'
export const NO_WAY_TO_FIGHT = 'this one has no way to fight'
