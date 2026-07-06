# Balance Baseline — 2026-07-06 (post gear-engine + deck cycling)

Snapshot of `npm run sim` / `play.ts combat --report` after the gear-as-deck
engine, deck cycling (StS discard-hand model), and difficulty scaling landed.
Feeds Atlas epic 110 (Balance pass) — stories 474/475.

## Method
Greedy both-sides auto-battle (`--report --seeds 10-20`), fixed seeds.
The greedy party AI is WEAK: no utility/heal card usage, nearest-target only,
no focus fire, ally-cards occasionally wasted. Treat win-rates as a FLOOR —
a human plays far better.

## Numbers

| scenario | loadout | win% | loss% | stale% | avg turns |
|---|---|---:|---:|---:|---:|
| stub (3 bandits L1) | none (innate-only) | 0 | 0 | 100 | 16.0 |
| stub | default starters | 20 | 0 | 80 | 9.8 |
| boss (Iron Throne) | default starters | 0 | 10 | 90 | 15.7 |
| boss | full legendary | 0 | 55 | 45 | 9.9 |

## Reading

1. **Deck cycling fixed the hard-stall.** Pre-cycling every fight stalemated at
   the 16-turn cap with empty hands. Gear now measurably moves outcomes
   (0% → 20% on stub with starter gear).
2. **Innate-only decks can't finish** (no damage volume) — recruits must come
   with gear, and enemy innates need the same check.
3. **Boss legit hard but the sim can't prove beatable.** The greedy AI never
   heals, blocks, or focuses; losses at 55% under legendary gear say more
   about the sim than the fight.

## Hardening-phase TODO (epic 110)

- Upgrade the sim party AI: play heals when wounded, armor when engaged,
  focus lowest-HP foe, use empower before big hits. Then re-baseline.
- Set targets: stub w/ starters 55-75% win; boss w/ epic+ gear 40-60%; 0%
  hard-stalemates anywhere; battles 4-10 turns.
- Tune: bandit HP (18) vs starter card damage; boss 55 HP / armor 6 / spd 3;
  gold curve (10 + 5·level per kill vs §11 price bands).
- Riposte/taunt statuses are tracked but INERT (no retaliation/targeting
  effect) — implement or cut before tuning cards that grant them.
- Greedy AI armors ENEMIES with ally-cards occasionally (targeting misuse) —
  sim-only artifact, but fix while touching the AI.


## Post-AI-upgrade re-baseline (same day)

autoPartyTurn now heals (<75% ally), empowers before strikes, focuses the
lowest-HP foe with its highest-damage card, armors when engaged, and cycles
draw effects. Results (seeds 20):

| scenario | loadout | win% | loss% | stale% |
|---|---|---:|---:|---:|
| stub | none | 0 | 0 | 100 |
| stub | default | 0 | 0 | 100 |
| boss | default | 0 | 10 | 90 |
| boss | legendary | 0 | 0 | 100 |

Outcomes DROPPED vs the dumb AI — trace analysis (seed 4) shows why, and it
is a real balance finding, not an AI bug:

1. **Focus-fire asymmetry.** 3 rusher bandits act back-to-back and all
   target the weakest unit; any party unit that ends its turn inside their
   combined reach dies that round (3 × ~7 dmg into 18-22 HP). The party AI
   advancing piecemeal feeds them one by one; survivors then kite forever →
   stalemate cap.
2. Party damage volume is comparable per hit (9-13) but split across turns
   with no burst; bandit HP 18 takes 2 hits each.

## Tuning levers for story 475 (in priority order)
- Group-movement discipline in the AI (don't advance past the ally line /
  into ≥2 foes' reach) — makes sims reflect human caution.
- Party survivability: starter HP (18-28) vs 3-focus alpha; consider +4-6 HP
  on player classes OR bandit swing 4→3.
- Enemy pack sizes at L1 (3 rushers may simply be a mid-game encounter).
- Riposte/taunt inert statuses (Knight identity is missing its anchor role —
  taunt would absorb exactly this focus-fire).
