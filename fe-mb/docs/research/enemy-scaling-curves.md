# Research #5: Enemy Scaling Curves

**Status:** Complete (2026-05-09)
**Sources:**
- Slay the Spire Wiki: [Bosses](https://slay-the-spire.fandom.com/wiki/Bosses), [Health](https://slay-the-spire.fandom.com/wiki/Health), [Ascension](https://slay-the-spire.fandom.com/wiki/Ascension)
- Serenes Forest: [Awakening Enemy Data](https://wiki.serenesforest.net/index.php/Awakening_Enemy_Data), [Generating Enemy Stats (GBA)](https://wiki.serenesforest.net/index.php/Generating_Enemy_Stats_(GBA))
- Fire Emblem Wiki: [Difficulty](https://fireemblemwiki.org/wiki/Difficulty), [Growth Rate](https://fireemblemwiki.org/wiki/Growth_rate)
- FTL: [Enemy Ships (Fandom)](https://ftl.fandom.com/wiki/Enemy_Ships), [Subset forum scaling thread](https://subsetgames.com/forum/viewtopic.php?t=3357)
- Internal: `autoload/event_manager.gd`, `data/events/enemy_groups.json`, `docs/superpowers/specs/2026-03-29-ship-plan-design.md` §11–§12, MEMORY.md

---

## 1. Comparison

| Game | Tier System | HP Curve | Damage Curve | Notes |
|---|---|---|---|---|
| **Slay the Spire** | 3 acts, then bosses; orthogonal Ascension axis (A0–A20) | **Boss HP roughly doubles per act:** Act 1 bosses 140–250 HP, Act 2 250–420, Act 3 300–456. Common enemies: Act 1 ~10–30, Act 2 ~30–60, Act 3 ~50–110. | **Multi-hit attacks scale.** Generic enemy hit grows ~+1–3/act; bosses gain new attack patterns rather than bigger numbers. Ascension 8 ("Tough Enemies") is the only HP step inside the difficulty axis — stays flat A8–A20. | Player power grows by deck size+rarity — combat is asymmetric. |
| **Fire Emblem (Awakening, Three Houses)** | Chapter-by-chapter authored levels | **Linear, ~+1 level/chapter for unpromoted, ~+2 with weapon tier bumps.** Generic Fighter HP: Ch2 ~21, Ch10 ~28, Ch20 ~36; promoted Ch15+ jump 8–12 HP from class change. | **Weapon tier > stat scaling.** Iron(5 Mt) → Steel(8) at Ch2, Silver(11) by Ch12. Each tier adds +3 Mt > +1 STR. Hard mode adds flat +2–4 to stats. | Auto-level using class growth rates per chapter. Stats deterministic given level+class. |
| **FTL** | 8 sectors (variable hop count); Easy/Normal/Hard scrap multiplier | **Discrete capability tiers, not raw HP.** Hull HP ~6–14 across all sectors (small range). Real scaling: shield layers (1 in S1–2, 2 in S3–4, 3 in S5–6, 4 in S7–8). Weapons grow by tier slot count, not damage per shot. | Per-sector "scrap budget" picks ship loadout from a pool. Damage per attack stays similar; **rate of fire and shield negation** changes. | Ship stats keyed off sector index only — player progression is independent. |
| **FE_MB (current Godot)** | `level` field per template, hand-tuned in `enemy_groups.json` | **Linear from `event_manager.gd`:** `max_hp = base + level*2` (FIGHTER 18+2L, KNIGHT 22+3L, MAGE 14+2L, etc.) | `STR = base + level` (so +1/level), `DEF = 3 + floor(level/2)`, `weapon might = 5 + floor(level/2)`. SPD has `randi() % (level+2)` jitter. | Currently only levels 1–2 used. No regional gating; encounters are random. Fallback group is hardcoded HP 18, STR 5. |

### Key takeaways
- **StS = exponential by act** (HP doubles), but only 3 acts. Translates poorly to a 4-region map with similar relative power across regions.
- **FE = linear by chapter**, using *weapon tier jumps* as the real difficulty step (every 4–5 chapters). Maps cleanly onto FE_MB's gear-rarity system.
- **FTL = capability layers** (shields, system slots) — analogous to FE_MB's status-effect quivers and Rare gear effects appearing in later regions.
- **FE_MB current model is already FE-like** but flat (`+2 HP/lvl`, `+1 STR/lvl`). Needs region multipliers and a defined level→region mapping.

---

## 2. Recommended FE_MB Curve

### Region → level mapping (per 03-29 ship plan §12)

| Region | Levels | Rationale |
|---|---|---|
| Borderlands (Pine Crossing → Riverside Market → South Junction) | **1–2** | Tutorial; teaches AP, cards, weapon triangle replacement. Iron gear baseline. |
| Thornwood Wilds | **3–4** | Introduces poison status, faster `THIEF`/`ARCHER` enemies. +1 weapon tier (Steel/Darkwood). |
| Ashfall Peaks | **5–6** | Burn DOT, heavy `KNIGHT`/`FIGHTER` lineups, magma weapons. |
| Iron Throne (final dungeon) | **7–9** | Boss + elite escorts, Epic/Legendary gear cards. |

Linear within each region; jumps between regions enforced by node graph (no encounter rolls outside player's current zone).

### HP per level (per class, retain Godot's class-baseline shape)

```
hp(level, class) = base[class] + perLevel[class] * level
```

| Class | base | perLevel |
|---|---|---|
| FIGHTER | 18 | 2 |
| KNIGHT | 24 | 3 |
| ARCHER | 16 | 2 |
| THIEF | 15 | 2 |
| MAGE | 14 | 2 |
| CLERIC | 16 | 2 |
| LORD (boss) | 30 | 4 |
| BEAST | 22 | 3 |

(Same shape as `event_manager.gd` today; `KNIGHT.base` bumped 22→24 to keep it relevant at lvl 5+.)

### Damage per level

Keep the existing soft scaling; **the gear rarity tier carries most of the difficulty curve** (matches FE's "weapon-tier-as-progression" pattern):

```
strength    = base[class] + level
weaponMight = 4 + floor(level / 2)         // was 5; -1 to leave headroom for gear
defense     = floor(base/4) + floor(level / 2)
resistance  = baseRes + floor(level / 3)
```

Effective ATK at common gear (no rarity bonus):
| Level | Fighter ATK | Mage ATK |
|---|---|---|
| 1 | 5+1+4 = 10 | 6+1+4 = 11 |
| 3 | 5+3+5 = 13 | 6+3+5 = 14 |
| 5 | 5+5+6 = 16 | 6+5+7 = 18 |
| 7 | 5+7+7 = 19 | 6+7+8 = 21 |
| 9 (boss) | 5+9+8 + Epic gear (+4) = 26 | 6+9+8 + Epic (+4) = 27 |

A lvl 1 Roy (~22 HP, 4 DEF/2 DR) takes ~8 dmg/hit from a lvl 1 fighter (10−2 DR) — survives 2–3 hits. A lvl 7 enemy hits him for ~17, two-shot. Forces gear upgrades by Thornwood.

### Region multiplier (light touch)

Per FTL's "discrete capability layer" idea — a flat region multiplier on HP only, leaving damage to gear:

```json
{
  "borderlands": { "hpMul": 1.0,  "lootRarityFloor": "common"   },
  "thornwood":   { "hpMul": 1.10, "lootRarityFloor": "uncommon" },
  "ashfall":     { "hpMul": 1.20, "lootRarityFloor": "uncommon" },
  "ironThrone":  { "hpMul": 1.35, "lootRarityFloor": "rare"     }
}
```

Net HP at region boundaries (FIGHTER, level given by region floor):
- Borderlands lvl 2: 18 + 4 = **22 HP**
- Thornwood lvl 3: (18 + 6) × 1.10 = **26 HP**
- Ashfall lvl 5: (18 + 10) × 1.20 = **34 HP**
- Iron Throne lvl 8: (18 + 16) × 1.35 = **46 HP**

Boss (LORD lvl 9, Iron Throne): (30 + 36) × 1.35 = **89 HP**. With ~3 player units doing 8–14 dmg/turn, 4–6 turn boss fight — feels right for a roguelite finale, well shy of StS's 250–456 HP bosses (which face one player only).

### Loot rarity curve (reconcile with 03-29 ship plan §11)

Ship plan already specifies, by enemy level:
- L1–2: 80% Common, 20% Uncommon
- L3–4: 50% Common, 40% Uncommon, 10% Rare
- L5+:  30% Uncommon, 50% Rare, 20% Epic

This stays unchanged; it lines up with the region tiers above (Borderlands feeds Common, Iron Throne feeds Epic/Legendary). The `lootRarityFloor` in `regionMultipliers` is a **gate** (region can't drop below the floor) — useful when a stray lvl 2 enemy spawns in Ashfall as a weak escort, the loot still respects regional theme.

---

## 3. JSON Schema Mock — `data/curves/enemy_scaling.json`

```json
{
  "version": "0.1.0",
  "schema": "enemy_scaling/v1",

  "perClass": {
    "FIGHTER": { "hpBase": 18, "hpPerLevel": 2, "strBase": 5, "defBase": 3, "resBase": 1, "spdBase": 4 },
    "KNIGHT":  { "hpBase": 24, "hpPerLevel": 3, "strBase": 6, "defBase": 6, "resBase": 1, "spdBase": 2 },
    "ARCHER":  { "hpBase": 16, "hpPerLevel": 2, "strBase": 4, "defBase": 2, "resBase": 2, "spdBase": 5 },
    "THIEF":   { "hpBase": 15, "hpPerLevel": 2, "strBase": 3, "defBase": 2, "resBase": 2, "spdBase": 7 },
    "MAGE":    { "hpBase": 14, "hpPerLevel": 2, "magBase": 6, "defBase": 1, "resBase": 5, "spdBase": 4 },
    "CLERIC":  { "hpBase": 16, "hpPerLevel": 2, "magBase": 5, "defBase": 1, "resBase": 5, "spdBase": 4 },
    "LORD":    { "hpBase": 30, "hpPerLevel": 4, "strBase": 7, "defBase": 5, "resBase": 4, "spdBase": 5 },
    "BEAST":   { "hpBase": 22, "hpPerLevel": 3, "strBase": 6, "defBase": 4, "resBase": 1, "spdBase": 4 }
  },

  "perLevelFormulas": {
    "strPerLevel": 1,
    "defPerLevel": 0.5,
    "resPerLevel": 0.333,
    "weaponMightBase": 4,
    "weaponMightPerLevel": 0.5,
    "spdJitterMax": 2
  },

  "regionMultipliers": {
    "borderlands": { "hpMul": 1.00, "levelRange": [1, 2], "lootRarityFloor": "common"   },
    "thornwood":   { "hpMul": 1.10, "levelRange": [3, 4], "lootRarityFloor": "uncommon" },
    "ashfall":     { "hpMul": 1.20, "levelRange": [5, 6], "lootRarityFloor": "uncommon" },
    "ironThrone":  { "hpMul": 1.35, "levelRange": [7, 9], "lootRarityFloor": "rare"     }
  },

  "lootRarityByLevel": {
    "1-2": { "common": 0.80, "uncommon": 0.20 },
    "3-4": { "common": 0.50, "uncommon": 0.40, "rare": 0.10 },
    "5-6": { "uncommon": 0.30, "rare": 0.50, "epic": 0.20 },
    "7-9": { "rare": 0.40, "epic": 0.45, "legendary": 0.15 }
  },

  "bossOverrides": {
    "ironThroneBoss": { "class": "LORD", "level": 9, "hpMul": 1.50, "gearRarity": "legendary" }
  }
}
```

Loader contract: `getEnemyStats(class, level, region) -> { hp, atk, def, ... }` applies `perClass[class]` + `perLevelFormulas` then multiplies HP by `regionMultipliers[region].hpMul`. Existing `enemy_groups.json` templates supply `class`, `level`, `count`, `name` only.

---

## 4. Migration Notes

- **Phaser:** Drop `enemy_scaling.json` in `phaser/src/data/content/curves/`, validate with a Zod schema in `phaser/src/data/schemas/`, expose via a `getEnemyStats()` selector.
- **Godot:** Optional follow-up — refactor `event_manager._create_enemy_from_template()` to read the JSON instead of the hardcoded match; preserves current behavior at lvl 1–2 since the formulas reproduce existing numbers (`+2 HP/lvl`, `+1 STR/lvl`, `weaponMight = 5 + floor(level/2)` becomes `4 + floor(level/2)` — minor nerf to leave room for gear).
- **Tuning hooks** (post-foundation milestone): `hpMul` per region is the single dial for "make Ashfall harder" without touching per-class tables. Loot floor is the dial for "make Thornwood feel better."
