# Research #4: Stat Growth Math

**Status:** Complete (2026-05-09)
**Files audited:**
- `scripts/resources/unit_data.gd` (growth fields, `_level_up`, `add_experience`)
- `autoload/game_manager.gd` lines 270–315 (Roy/Marcus/Lilina starter baselines + growth rates)
- `autoload/event_manager.gd` lines 132–290 (enemy stat scaling per class + level)
- `scripts/combat/battlefield.gd` lines 494–527, 939–947 (XP grant on kill, EXP bar UI)
- `phaser/src/domain/unit.ts`, `phaser/src/domain/class.ts` (current TS shape)

---

## Godot Implementation

### Growth Roll Model

Per-stat independent percentage rolls. On level-up, each of 8 growth fields rolls `randi() % 100 < growth%`; on success, the corresponding stat gains exactly **+1**. No banking, no guaranteed minimum, no caps — pure independent Bernoulli rolls. (`unit_data.gd:142–179`.)

Stats rolled (8): `hp`, `str`, `mag`, `skl`, `spd`, `lck`, `def`, `res`. Note `movement` does **not** grow on level-up. `max_hp +1` also bumps `current_hp +1`; `defense +1` also bumps `current_armor +1` (so the in-battle armor pool refreshes mid-run).

**No stat caps** are enforced anywhere. **No class change / promotion** logic exists.

**Random source:** Godot's global `randi()` — non-seeded, non-deterministic. Cannot be reproduced for tests or replays.

**AP milestone:** at levels 5, 10, 15, `max_ap += 1` (cap 5). This is a deterministic class-agnostic bump, separate from the stat rolls.

### XP Curve

- Trigger: enemy unit dies and `killer != null`. Killer gains **flat +30 XP** per kill regardless of level/class (`battlefield.gd:508`).
- Curve: flat **`EXP_TO_LEVEL = 100`** constant (`unit_data.gd:71`). On overflow, EXP rolls over (`experience -= 100`) and `_level_up()` runs once. Multiple level-ups in a single `add_experience` call are **not supported** (only one `_level_up` per call).
- No assist XP, no participation XP, no kill-stealer mechanics, no level-difference scaling.

This is the simplest possible curve: every 4 kills = 1 level, forever.

### Per-Class Differences

Player baselines are **hardcoded in `game_manager.gd`** (only LORD / KNIGHT / MAGE actually defined as starters). No `data/classes/*.json` exists; class definitions are scattered between `game_manager.gd` (player templates) and `event_manager.gd` (enemy generation by class+level).

**Player starter growth rates (level 1 baselines):**

| Class | HP | STR | MAG | SKL | SPD | LCK | DEF | RES | hp/str/mag/skl/spd/lck/def/res growth % |
|---|---|---|---|---|---|---|---|---|---|
| LORD (Roy)    | 22 | 6 | 1 | 6 | 7 | 7 | 5  | 2 | 80/50/5/50/45/60/30/25 |
| KNIGHT (Marcus) | 28 | 8 | 0 | 7 | 4 | 4 | 10 | 1 | 70/45/0/40/25/20/50/15 |
| MAGE (Lilina) | 18 | 1 | 8 | 5 | 6 | 6 | 3  | 7 | 55/5/65/40/40/45/15/50 |

All starters have `movement = 5`. `UnitData` defaults (used by enemies / un-customized units) are `hp_growth=50, str=40, mag=0, skl=35, spd=35, lck=30, def=25, res=20`.

The remaining six classes (CAVALIER, ARCHER, CLERIC, THIEF, BOUNTY_HUNTER) have **no defined player baselines or growth rates** in the Godot source — the enum exists, but `start_new_run` only spawns the three above. Only `FIGHTER, KNIGHT, ARCHER, MAGE, THIEF` have enemy stat formulas in `event_manager._scale_enemy_stats`; CLERIC/CAVALIER/LORD fall through to the generic `_:` fallback. **The leveling system in TS will need to ship class definitions for all 9.**

### Capture-Then-Recruit

**Current Godot answer:** captured enemies don't currently become playable units — capture flips `is_bound`, the unit is held for tavern bounty turn-in, and is destroyed (or sold) afterward. There's **no recruit-from-capture flow shipped**, only the data field `is_capture_target` and quest hand-in (`quest_manager.gd`).

So Godot has not yet decided this. The TS spec must.

---

## Proposed TS Spec

### Type changes required

`UnitStats` in `phaser/src/domain/unit.ts` is missing `hp` and `lck` fields. Godot rolls **8** growths but TS `UnitStats` has **6** (str/mag/skl/spd/def/res). Two options:

- **(A)** Extend `UnitStats` to include `hp` and `lck` (matches Godot 1:1).
- **(B)** Keep `UnitStats` as combat-relevant 6, and split out `Unit.hp.max` + a new `Unit.luck` field; growth rates carry the union of both.

Recommend **(A)** — minimal divergence from Godot, simpler reducer math. `Unit.hp.max` becomes derived from `unit.stats.hp` at level-up time (or `Unit.hp` stays as-is and gets a parallel `+1` write whenever `stats.hp` increments).

Then `ClassDef.growthRates: UnitStats` covers all 8 growth %s.

### Pure functions

```ts
import type { Unit } from '../domain/unit'
import type { ClassDef } from '../domain/class'
import type { Rng } from './rng'  // hierarchical seeded RNG

const XP_PER_KILL = 30
const EXP_TO_LEVEL = 100
const STAT_KEYS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res'] as const
type StatKey = typeof STAT_KEYS[number]

export interface LevelUpResult {
  unit: Unit                            // new unit (no mutation)
  gains: Partial<Record<StatKey, number>>
  leveledUp: boolean
  apGained: 0 | 1
}

/** Pure. Rolls one level. Caller increments `level` and decides multi-level loops. */
export function rollLevelUp(unit: Unit, classDef: ClassDef, rng: Rng): LevelUpResult {
  const gains: Partial<Record<StatKey, number>> = {}
  const newStats = { ...unit.stats }
  for (const key of STAT_KEYS) {
    const growth = classDef.growthRates[key]   // 0..100
    if (rng.nextInt(100) < growth) {
      newStats[key] = newStats[key] + 1
      gains[key] = 1
    }
  }
  const newLevel = unit.level + 1
  const apGained: 0 | 1 = (newLevel === 5 || newLevel === 10 || newLevel === 15) ? 1 : 0

  // hp growth bumps both stats.hp (max ceiling) and current hp by +1, mirroring Godot
  const hpDelta = gains.hp ?? 0
  return {
    unit: {
      ...unit,
      level: newLevel,
      stats: newStats,
      hp: { max: unit.hp.max + hpDelta, current: unit.hp.current + hpDelta },
      ap: unit.ap + apGained,   // or store maxAp separately
    },
    gains,
    leveledUp: true,
    apGained,
  }
}

/** Pure. Awards XP, loops level-ups while overflow remains. */
export function awardXp(
  unit: Unit,
  xpEarned: number,
  classDef: ClassDef,
  xpInBank: number,         // unit's pre-existing experience toward next level
  rng: Rng,
): { unit: Unit; xpInBank: number; levelUps: LevelUpResult[] } {
  let bank = xpInBank + xpEarned
  let current = unit
  const levelUps: LevelUpResult[] = []
  while (bank >= EXP_TO_LEVEL) {
    bank -= EXP_TO_LEVEL
    const result = rollLevelUp(current, classDef, rng)
    levelUps.push(result)
    current = result.unit
  }
  return { unit: current, xpInBank: bank, levelUps }
}
```

**Behaviour notes:**
- **Deterministic given `rng`.** Caller derives via `deriveRng(parentRng, 'levelup:'+unitId+':'+level)` so replays / tests reproduce.
- **Multi-level support** (Godot lacks this, TS gains it for free) — important if XP awards are batched at battle end.
- **Movement and ap** are not in `UnitStats`; `ap` bumps at milestone levels are handled separately. `movement` is fixed by class.
- **No caps** initially (matches Godot). Add per-stat per-class caps in `ClassDef` later if needed.
- **XP source** stays flat `+30 per kill` for parity. Reducer triggers via the `KillEvent` handler in `combatReducer`; battle-end bundles per-unit XP into `BattleResult.xpAwards`.

### Capture-Then-Recruit Decision

**Recommendation: enemies who are recruited use class-baseline growth rates at the captured level**, not their procedural enemy stat block. Reasons:

- Enemy stats from `event_manager._scale_enemy_stats` are `(base + level*k + randi())` — non-deterministic and built for combat balance, not progression. Carrying these into the player party would produce wildly inconsistent recruits.
- Godot enemies have **no growth rates set** (defaults are used since `event_manager` only writes baseline stats). So there's nothing meaningful to carry.
- A captured Bandit (FIGHTER class) joining at level 4 should look like "a level-4 fighter with the canonical fighter growth profile + 4 levels of expected variance," reproducible from the class def + a deterministic recruit RNG.

**Concrete spec for recruitment:**

```ts
function recruitFromCapture(
  classId: ClassId,
  level: number,
  classDef: ClassDef,
  rng: Rng,
): Unit {
  // 1. Start from class baseline
  let unit = createBaselineUnit(classDef)
  // 2. Roll forward (level - 1) level-ups from the same RNG
  for (let i = 1; i < level; i++) {
    unit = rollLevelUp(unit, classDef, rng).unit
  }
  return unit
}
```

This means a recruited bandit at level 4 is statistically identical to a level-4 player fighter. Trade-off: high-level captures are less exciting, but progression stays balanced.

---

## Open Questions

Flag in `phaser/CONTEXT.md` §12 (or the leveling system spec when it lands):

1. **Stat caps:** Godot has none. Should TS add `ClassDef.statCaps?: Partial<UnitStats>` for promoted/late-game classes? Recommend yes when promotion lands.
2. **`UnitStats` shape:** confirm Option A (extend with `hp` + `lck`) before leveling implementation starts, since this changes the type used by `ClassDef.baseStats`/`growthRates`.
3. **XP curve:** flat `EXP_TO_LEVEL = 100` matches Godot but produces a power curve where late-game kills are equally rewarding. Consider a per-level-difference scalar (FE classic: `XP = 31 + (defenderLvl - attackerLvl) * 3`, clamped) for the leveling milestone.
4. **AP milestone:** Godot bumps `max_ap` at levels 5/10/15. TS `Unit` has only `ap` (current), no `maxAp`. Add `maxAp: number` to the domain type when leveling lands.
5. **Movement growth:** Godot does not grow `movement`. Confirm same in TS (current `class.ts` has `startingMov` — probably stays static).
6. **6 unimplemented player classes:** CAVALIER, ARCHER, CLERIC, THIEF, BOUNTY_HUNTER, FIGHTER need baseline + growth definitions invented in TS land (Godot only has the three starter blocks). Use FE6/FE7 archetypes as reference.

---

## Sources

| File | Lines | Content |
|---|---|---|
| `scripts/resources/unit_data.gd` | 43–51 | 8 growth-rate `@export_range(0,100)` fields |
| `scripts/resources/unit_data.gd` | 71 | `EXP_TO_LEVEL = 100` constant |
| `scripts/resources/unit_data.gd` | 133–179 | `add_experience` + `_level_up` Bernoulli rolls + AP milestones |
| `autoload/game_manager.gd` | 275–312 | Roy/Marcus/Lilina baselines + growth rates |
| `autoload/event_manager.gd` | 132–290 | Enemy stat scaling per class+level (no growth_rate writes) |
| `scripts/combat/battlefield.gd` | 507–513 | Flat 30 XP per kill, killer-only |
| `scripts/combat/battlefield.gd` | 939–947 | `EXP_TO_LEVEL` referenced in EXP bar UI |
| `phaser/src/domain/unit.ts` | 3–6 | `UnitStats` (6 fields — needs hp/lck added) |
| `phaser/src/domain/class.ts` | 4–12 | `ClassDef` with `growthRates: UnitStats` |
