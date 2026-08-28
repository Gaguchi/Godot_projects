# Balance Re-baseline — 2026-08-28

> Supersedes the numbers (NOT the targets) in `balance-baseline-2026-07-06.md`.
> Feeds Atlas epic 110 / story 475.

## Why the old baseline was invalid

Every stalemate and every boss loss in the 2026-07-06 tables was an **engine
bug**, not balance. Three of them, all fixed on this date:

1. **Corpse shadowing** — `combatReducer` resolved a target tile to the FIRST
   unit at that position with no alive filter. A living enemy standing on a
   corpse was immune to every single-target card, so long fights degenerated
   into whiff loops. (Repro at the time: Jab expected 11, dealt 0.)
2. **Melee AI stall** — `enemyAI.stepToward` only ever tried the
   distance-reducing axis. One party unit on the single approach tile froze a
   melee enemy for the rest of the battle (12+ rounds of bare `endTurn`s in
   the playtest). This was the sim's dominant "stalemate" source. Now a BFS
   field from the destination routes around blockers.
3. **Dungeon battles spawned the party off-board** — `seedDungeonBattle`
   never positioned the party (run-store units carry `position: null`), which
   is why all three dungeon room types read 100% stalemate at exactly the
   51-turn cap for every seed. Player-facing soft-lock, not a tuning issue.

Two adjacent fixes also move numbers: 1-turn defensive buffs (taunt, riposte,
covers) now survive the enemy phase instead of expiring unused, and the sim's
party AI no longer sees non-bandit classes as allies (`systems/team.ts`
everywhere).

## Honest numbers (greedy AI both sides, 20 seeds/scenario, 50-run bulk)

| scenario | win% | loss% | stale% | avg turns |
|---|---|---|---|---|
| stub (default loadout) | 100% | 0% | 0% | 2.0 |
| stub (NO gear) | 100% | 0% | 0% | 4.3 |
| dungeon combat / elite | 100% | 0% | 0% | 2.6 / 2.6 |
| dungeon boss | 100% | 0% | 0% | 3.0 |
| **Iron Throne boss** | **100%** | 0% | 0% | 3.9 |
| bulk `npm run sim -- --runs 50` | 50/50 VICTORY | — | — | 2.0 |

Targets (unchanged, from 2026-07-06): stub w/ starters 55–75% · boss w/ epic+
40–60% · 0% stalemates · 4–10 turns.

## Reading

The picture INVERTED: the game is far too easy, not too hard. Three party
units at 3 AP × ~11 damage focus-fired is ~99 damage/turn into a 54-HP bandit
pool — battles end before the enemy AI matters. A gearless party still never
loses.

Tuning direction for story 475 is therefore UP on threat, not down:
- enemy HP / pack sizes (L1 packs die in 2 turns), or
- party damage down (card base or stat scaling), or
- both, tuned to land avg 4–10 turns with real loss risk at the boss.

Caveats: the greedy sim AI now focus-fires efficiently, so these numbers are
closer to a competent floor than the old helpless one — but a human still
plays above it (positioning, capture, gear choice). Validate any tuning against
manual play, per the standing lesson. And `mage_circle` remains a documented
one-shot risk for level-1 parties in the real game (13×2 damage in one enemy
phase) — pack-level tuning should look at burst, not just totals.
