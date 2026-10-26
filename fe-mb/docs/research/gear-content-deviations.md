# Gear Content Deviations — ship plan §7 vs shipped cards.json/items.json

Date: 2026-07-06
Scope: full §7 gear catalog authoring (`phaser/src/data/content/cards.json`, `items.json`).
Spec: `docs/superpowers/specs/2026-03-29-ship-plan-design.md` §7 (catalog), §11 (prices).

Several §7 cards require mechanics the combat engine does not have yet
(supported effect kinds: `Damage`, `Heal`, `ApplyStatus` [poison / burn / slow /
immobilize / taunt / riposte / empower, optional `splash: "adjacent"`],
`GrantArmor`, `GainAp`, `DrawCards`, `RemoveStatus`). Every such card shipped
with the closest supported approximation, keeping the spec name and AP/damage
feel. This file is the authoritative list of those deviations so the cards can
be restored to spec once the engine grows the missing mechanics.

## Spec inconsistency: §7 summary table vs detail tables

§7's "Total Gear Count" summary table claims **39** gear items
(12 common / 17 uncommon / 3 rare / 4 epic / 3 legendary). The §7 **detail
tables** — which enumerate every item by name — actually contain **46**
(12 common / 24 uncommon / 3 rare / 4 epic / 3 legendary):

| Row | Summary claims | Detail tables enumerate |
|-----|----------------|------------------------|
| 1H uncommon | 9 | 15 (7 Borderlands steel/thunder/mend + 4 Thornwood + 4 Ashfall) |
| Shields uncommon | 3 | 4 (Steel Buckler, Steel Tower Shield, Bark Shield, Volcanic Tower Shield) |

The catalog implements **every named item in the detail tables (46)**, since
"the tables" are the enumerated source of truth and no principled subset of 7
uncommon items could be cut. `tests/unit/data/gearCatalog.test.ts` asserts the
detail-table totals. The §7 summary table should be corrected in a follow-up
spec.

## Card-level mechanic deviations

| Card | Spec text | Shipped approximation | Engine mechanic needed later |
|------|-----------|----------------------|------------------------------|
| `iron_tower_shield_shield_wall` / `steel_tower_shield_shield_wall` | Gain 4/6 armor + adjacent allies gain 2/3 armor | Grant 4/6 armor to self or ONE adjacent ally (`targetKind: ally`, range 0-1) | Multi-target ally splash (armor to self AND all adjacent allies in one play) |
| `iron_tower_shield_cover` / `steel_tower_shield_cover` | Redirect next attack on adjacent ally to you (+3 armor steel) | Self: taunt 1 turn + 2/3 armor | Attack redirect / cover-ally targeting |
| `bark_shield_thorn_block` | Gain 4 armor + attackers take 2 dmg | Gain 4 armor + riposte 2 (next melee attacker takes 2), 1 turn | Persistent thorns aura (all attackers, full duration) vs one-shot riposte |
| `volcanic_tower_shield_magma_fortress` | Gain 9 armor + 3 burn/2 turns to ALL adjacent enemies | Gain 9 armor + riposte 3, 1 turn | Self-centered enemy AOE from a self-target card (burn adjacent) |
| `volcanic_tower_shield_heat_shield` | Gain 4 armor, next melee attacker takes 4 burn/2 turns | Gain 4 armor + riposte 4 (direct damage, not burn) | Riposte variant that applies a status (burn) to the attacker |
| `thorn_staff_regrowth` | Heal 8 HP + heal 4 HP next turn | Flat Heal 12 | Heal-over-time (regen status) |
| `serpent_blade_shed_skin` | Remove all debuffs from self + deal 4 dmg to adjacent | Self: RemoveStatus all debuffs + riposte 4, 1 turn | Self-centered enemy AOE from a self-target card |
| `magma_blade_molten_edge` | 5 dmg; if target already burning deal +4 | Flat Damage 7 (midpoint of 5/9) | Conditional damage (bonus vs status-afflicted target) |
| `hellfire_tome_pyroclasm` | 8 magic dmg to ALL enemies + 2 burn/2 turns | Tile-target AOE radius 2 (Damage 8 magic + burn 2/2) | True `all_enemies` battlefield targeting at runtime (type exists, no runtime path) |
| `longbow_steady_aim` / `composite_bow_steady_aim` | Next RANGED attack +5/+7 dmg | `empower` 5/7 (next damage card of ANY kind, consumed) | Empower variant restricted to ranged/bow cards |
| `flame_blade_ignite` | 5 dmg to all adjacent TO TARGET + 2 burn/2 turns | Damage 5 with aoeRadius 1 (hits target + adjacent) + burn splash adjacent | Ring-only AOE (exclude center target) |
| `paladins_aegis_radiant_shield` | Gain 8 armor + 4 magic dmg to all adjacent enemies | Gain 8 armor + riposte 4 | Self-centered enemy AOE (magic) from a self-target card |
| `paladins_aegis_martyr` | 0 AP: take next attack aimed at ANY ally | 0 AP: taunt 1 turn + 3 armor | Attack interception / bodyguard redirect |
| `wraithbow_soul_arrow` | 8 dmg + heal self 3 | Flat Damage 9 | Lifesteal-on-hit (heal source on damage) |
| `wraithbow_phantom_volley` | 6 dmg to 3x3 + heal self 2 PER ENEMY HIT | Tile AOE Damage 6, heal dropped | Per-target-hit source lifesteal |
| `wraithbow_death_sight` | Next ranged attack +7 + draw 1 | `empower` 7 (any next damage card) + DrawCards 1 | Ranged-restricted empower |
| `shadowfang_shadow_step` | 0 AP: teleport to any tile adjacent to an enemy | 0 AP melee strike, Damage 6 | Teleport / reposition effect |
| `shadowfang_vanish` | Untargetable for 1 turn | GrantArmor 8 self | Untargetable / stealth status |
| `doombow_piercing_shot` | 8 dmg to all enemies in a STRAIGHT LINE, range 2-4 | Damage 8 + aoeRadius 1 around target | Straight-line pierce targeting |
| `doombow_death_mark` | Mark target: takes +5 dmg from ALL sources for 2 turns | ApplyStatus poison 5, 2 turns (≈ +5 dmg/turn for 2 turns) | Damage-taken amplification mark status |
| `doombow_volley_of_ruin` | 8 dmg to 3x3 + MARKED enemies take double | Tile AOE Damage 8, mark synergy dropped | Mark status + conditional double damage |
| `excalibur_holy_slash` | 9 dmg + heal self 4 | Flat Damage 10 | Lifesteal-on-hit |
| `excalibur_judgment` | 15 dmg, deals DOUBLE to enemies below 25% HP | Flat Damage 17 | Conditional execute damage (HP-threshold) |
| `excalibur_radiance` | 6 magic dmg to ALL enemies + heal ALL allies 4 | Tile-target AOE radius 2, Damage 6 magic (`damageStat: mag`); ally heal dropped | `all_enemies` runtime targeting + dual-team effect resolution (damage foes, heal allies) |

## Struck rows (no longer deviations)

Three rows left this table when the rebuild's engine grew what they were
waiting for; they are recorded here so the history is not lost:

- `wraithbow_ghost_shot` — `Damage` now carries `armorPiercing: true`, so the
  card is 14 physical damage that ignores armor. To spec.
- `bark_shield_root_guard` — `GrantArmor` now carries an explicit `target`, so
  the card grants its 3 armor to `self`. To spec.
- `frost_axe_frozen_ground` — a tile-target card with `aoeRadius: 1` and
  `slow 2 / 2 turns`. To spec (only the unspecced range was chosen).

Every remaining row's card carries a `todoMechanic` string naming the mechanic
it still waits on; `npm run lint:content` prints the list and
`tests/unit/content/content.test.ts` pins its size, so the list cannot silently
drain back to zero.

## Engine notes (pre-existing conventions followed, flagged for a future fix)

- **Brace-family `GrantArmor` riders on enemy-target cards** (`iron_lance_brace`
  [pre-existing], `steel_lance_brace`, `venom_lance_poison_brace`,
  `bark_shield_root_guard`): the reducer applies `GrantArmor` to
  `targetUnits` when non-empty, i.e. to the ENEMY being hit, not the attacker.
  Shipped following the existing `iron_lance_brace` encoding (spec intent:
  "deal X dmg + gain N armor" for the source). Needs a `target: "source"`
  param on `GrantArmor` (or reducer fix) — all four cards then work to spec
  without content changes.
- **AOE resolution**: `aoeRadius` is authored per existing convention
  (`gs_cleave`, `darkwood_briar_volley`), but `BoardScene` currently
  dispatches only the single clicked tile as `targets`; multi-tile expansion
  exists only in the hover preview. All new AOE cards inherit this pre-existing
  runtime limitation.
- **`RemoveStatus`** (`kind: armor|debuff`) is used by pre-existing cards
  (`iron_sword_guard_break`, `heal_staff_purify`) and is schema-valid, but has
  no handler in `combatReducer.ts` — currently a no-op at runtime. New cards
  reuse the same shape (incl. `frost_axe_shatter`'s `{ kind: "armor",
  all: true }`, mirroring purify's `all: true`).

## Naming choices (not deviations)

- Steel-tier variants keep the existing `steel_sword_*` precedent of a
  "Steel " name prefix (e.g. "Steel Chop"); spec repeats the base names.
- Mend Staff / Composite Bow / Longbow variants keep identical spec card names
  across items (name duplication is precedented: two "Charge" cards exist).
- Card ids follow `<item_snake_case>_<card_snake_case>` (the older `gs_*` /
  `buckler_*` / `crossbow_*` short prefixes are grandfathered, not extended).

## Phase 45 content deviations

Date: 2026-07-06
Scope: §13 enemy roster expansion (stories 465/466) + travel-event expansion
(story 469) — `enemyGroups/*.json`, `classes.json` (append-only),
`enemyAI/*.json`, region encounter tables.

### Enemy roster (§13 "Additional Enemy Groups")

- **Poison daggers (Thornwood Ambush thieves)** — the `enemyAI` action schema
  supports only `kind: attack|heal`; `planTurn` synthesizes cards with a bare
  `Damage`/`Heal` effect, so an AI action cannot carry `ApplyStatus: poison`.
  Shipped as str attacks with poison-flavored action ids (`envenomed_stab`,
  `twist_the_blade`). The `thief` class innates DO include the real
  `bone_dagger_stab`/`bone_dagger_lacerate` poison cards, but the enemy AI
  planner plays synthesized actions, not deck cards — poison never actually
  fires. Needs: status support on `EnemyActionSchema` (or deck-driven enemy AI).
- **Burn DOT (Ashfall Raiders ember mage)** — same limitation; approximated
  with higher flat `mag` amounts (`ember_bolt` 7 / `conflagrate` 10). The
  `ember_mage` class innates carry the real `ember_tome_*` burn cards for
  parity if enemy AI ever goes deck-driven.
- **Alpha wolf "howl buffs pack SPD"** — no buff/status action kind exists in
  the enemyAI schema. Approximated as `howl_swipe`: an `aoeRadius: 1` sweep
  (warlord `warcry_sweep` precedent) on a `tank`-role, high-HP (38) unit.
  Needs: an AI buff action kind.
- **"Raider archer" / "darkwood archer" members** use a NEW `bandit_archer`
  class entry in classes.json, which binds to the PRE-EXISTING (already
  registered but previously classless) `enemyAI/bandit_archer.json`. Ashfall
  "obsidian axe fighters" reuse the `bandit` class for generic melee, per the
  existing convention (brigands/darens_gang name members over `bandit`).
- `AI_BY_CLASS` in `src/systems/enemyAI.ts` is now `export`ed so
  `tests/unit/data/roster.test.ts` can assert group→class→AI coverage.

### Travel events (§13 "Additional Travel Events")

Authored INLINE in the region encounter tables (the `EncounterOutcomeSchema`
`checkEvent` arm embeds the full `CheckEventSchema`; there is no id-referenced
registry for encounter events — standalone `checkEvents/*.json` files are only
looked up for enemy-group `victoryEvent` refs in `BattleEndModal`).

- **Wandering Blacksmith** ("buy 1 random Uncommon gear at discount") — no
  `addItem`/grant-gear QuestEffect kind exists. Approximated as a 60g
  gear-maintenance service: `addGold -60` + `healParty 0.3` + run-scoped flag
  `blacksmith_patronized`. Needs: an `addItem` QuestEffect.
- **Injured Knight** ("heal for recruitment chance or loot their gear") — the
  `recruitUnit` QuestEffect parses but is a runtime no-op stub
  (`runStore.applyQuestEffect` case `'recruitUnit'` returns without creating a
  unit), so shipping it would silently give nothing. Approximated: help branch
  = `addFood -1` + `addGold 40` + permanent flag `injured_knight_helped`
  (future recruitment content can key off the flag); loot branch = `addGold
  25` + `injured_knight_looted` (no gear effect exists).
- **Ancient Shrine** ("sacrifice HP for a temporary innate card for N
  battles") — no temporary-card QuestEffect exists. Approximated as
  `damageParty 3` + `addFood 3` + permanent flag `ancient_shrine_blessed` for
  future blessing content. Needs: a timed card-grant effect.
- **Thieves' Crossroads** fail branches use ungated negative `addGold`
  (-20/-25); `runStore` does not clamp gold at 0, so gold can go negative in
  the broke-party edge case. (Design explicitly asks for gold loss on fail;
  gating with a second check per choice isn't expressible.)
- **`addFood` with negative amounts is a runtime no-op** (the interpreter's
  append loop doesn't run for `amount < 0`) — pre-existing engine behavior;
  the new events follow the existing content pattern (`stuck_caravan` already
  ships `addFood -1`). Needs: food-decrement handling in `applyQuestEffect`.
- **Ambush Toll** "fight for loot" branch grants no extra loot beyond normal
  battle rewards — no loot-bonus effect exists; the fight routes through
  `startCombat: thornwood_ambush` (also used on failed pay/flee branches).
