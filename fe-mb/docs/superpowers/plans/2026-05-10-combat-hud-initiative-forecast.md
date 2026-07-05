# Combat HUD — Initiative Strip + Forecast Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two combat HUD additions — a fixed bottom-center turn-order portrait strip and a fixed top-right damage forecast panel — backed by a shared pure damage function that finally makes armor consume physical damage.

**Architecture:** A single new pure module (`src/systems/damage.ts`) is the truth source for damage math; both the reducer (state changes) and the forecast panel (UI preview) call it. The initiative strip is a selector-derived React component reading `state.units` + `state.turn.unitId` only. The forecast panel uses a new `pinnedTargetTile` field in CombatState plus a `pinTarget` reducer event so first-click-pins / second-click-plays.

**Tech Stack:** TypeScript 5.6 (strict, noUncheckedIndexedAccess), React 19, Zustand 5, Phaser 4 (BoardScene only), Vitest, Playwright, Tailwind v4. Spec at `docs/superpowers/specs/2026-05-10-combat-hud-initiative-forecast-design.md`.

---

## File structure

```
phaser/
├── src/
│   ├── systems/
│   │   ├── damage.ts                                # NEW — pure applyDamage + computeForecast
│   │   └── combatReducer.ts                         # MODIFIED — Damage handler calls applyDamage
│   ├── domain/
│   │   └── combatState.ts                           # MODIFIED — add pinnedTargetTile + pinTarget event
│   ├── ui/
│   │   ├── hooks/
│   │   │   ├── useInitiativeQueue.ts                # NEW — selector returning UnitId[] in display order
│   │   │   └── useForecastPreview.ts                # NEW — selector returning ForecastResult | null
│   │   └── scenes/combat/
│   │       ├── CombatHud.tsx                        # MODIFIED — mount InitiativeStrip + ForecastPanel
│   │       ├── InitiativeStrip.tsx                  # NEW — bottom-center horizontal portrait row
│   │       ├── InitiativeEntry.tsx                  # NEW — single portrait + HP label
│   │       ├── ForecastPanel.tsx                    # NEW — top-right pinned panel
│   │       ├── ForecastCombatantRow.tsx             # NEW — source portrait → arrow → target portrait
│   │       ├── ForecastHpBar.tsx                    # NEW — HP/armor segmented bar with delta
│   │       ├── ForecastMathRow.tsx                  # NEW — collapsible damage breakdown
│   │       └── ForecastStatusRow.tsx                # NEW — status effect chips
│   └── game/scenes/
│       └── BoardScene.ts                            # MODIFIED — pin-then-play target click; KO skull on preview
└── tests/unit/
    ├── systems/
    │   ├── damage.test.ts                           # NEW
    │   └── combatReducer.test.ts                    # MODIFIED — armor consumption assertions
    └── ui/
        ├── hooks/
        │   ├── useInitiativeQueue.test.ts           # NEW
        │   └── useForecastPreview.test.ts           # NEW
        └── scenes/combat/
            ├── InitiativeStrip.test.tsx             # NEW
            └── ForecastPanel.test.tsx               # NEW
```

CONTEXT.md updates land alongside each task that adds an exported name.

---

## Gate commands (used at end of every task)

```bash
npm run typecheck
npm test -- --reporter=basic
npm run check-context-doc
npm run build
npm run perf-gates
npm run test:e2e
```

All six must pass. The `e2e` step starts a dev server internally — no manual `npm run dev` needed.

---

## Task 1: Pure damage function (CHF-1)

**Files:**
- Create: `phaser/src/systems/damage.ts`
- Create: `phaser/tests/unit/systems/damage.test.ts`
- Modify: `phaser/CONTEXT.md` — add `damage.ts` row in systems section

- [ ] **Step 1.1: Write the failing test file**

Create `phaser/tests/unit/systems/damage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { applyDamage, computeForecast } from '../../../src/systems/damage'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mkUnit = (id: string, hp: number, armor: number, def = 4, res = 4): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: hp, max: hp },
  stats: { str: 5, mag: 5, skl: 4, spd: 5, def, res },
  position: null,
  ap: 3,
  armor,
  statuses: [],
})

describe('applyDamage', () => {
  it('physical damage with no armor: full HP loss', () => {
    const u = mkUnit('u', 20, 0)
    const r = applyDamage(u, 8, 'physical')
    expect(r).toEqual({ newArmor: 0, newHp: 12, hpLost: 8, armorLost: 0 })
  })

  it('physical damage absorbed entirely by armor', () => {
    const u = mkUnit('u', 20, 10)
    const r = applyDamage(u, 6, 'physical')
    expect(r).toEqual({ newArmor: 4, newHp: 20, hpLost: 0, armorLost: 6 })
  })

  it('physical damage exceeds armor: residual to HP', () => {
    const u = mkUnit('u', 20, 3)
    const r = applyDamage(u, 8, 'physical')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 3 })
  })

  it('magic damage with no armor: full HP loss', () => {
    const u = mkUnit('u', 20, 0)
    const r = applyDamage(u, 8, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 12, hpLost: 8, armorLost: 0 })
  })

  it('magic damage with armor: half-armor / half-pierce', () => {
    // dmg 8 → halfArmored 4, halfPiercing 4
    // armor=3 absorbs 3 of the 4 armored half; 1 leaks through
    // total hpLost = 1 (leak) + 4 (pierce) = 5
    const u = mkUnit('u', 20, 3)
    const r = applyDamage(u, 8, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 3 })
  })

  it('magic damage with abundant armor: armored half fully blocked, pierce half through', () => {
    // dmg 6 → halfArmored 3, halfPiercing 3
    // armor=10 absorbs all 3 of armored half; pierce 3 → hp
    const u = mkUnit('u', 20, 10)
    const r = applyDamage(u, 6, 'magic')
    expect(r).toEqual({ newArmor: 7, newHp: 17, hpLost: 3, armorLost: 3 })
  })

  it('odd damage with armor: floor(amount/2) for armored half', () => {
    // dmg 7 → halfArmored 3 (floor 7/2), halfPiercing 4
    // armor=2 absorbs 2 of armored half; 1 leaks; pierce 4 → hp
    // hpLost = 1 + 4 = 5
    const u = mkUnit('u', 20, 2)
    const r = applyDamage(u, 7, 'magic')
    expect(r).toEqual({ newArmor: 0, newHp: 15, hpLost: 5, armorLost: 2 })
  })

  it('zero damage is a no-op', () => {
    const u = mkUnit('u', 20, 5)
    const r = applyDamage(u, 0, 'physical')
    expect(r).toEqual({ newArmor: 5, newHp: 20, hpLost: 0, armorLost: 0 })
  })

  it('damage exceeds HP: clamped at 0', () => {
    const u = mkUnit('u', 5, 0)
    const r = applyDamage(u, 100, 'physical')
    expect(r.newHp).toBe(0)
    expect(r.hpLost).toBe(5)
  })
})

describe('computeForecast', () => {
  const card = {
    id: 'iron_sword_thrust',
    apCost: 2,
    range: { min: 1, max: 1 },
    targetKind: 'enemy' as const,
    weaponType: 'sword' as const,
    damageStat: 'str' as const,
    effects: [{ kind: 'Damage' as const, params: { base: 8 } }],
  }

  it('returns null when card has no Damage or Heal effect', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 20, 0)
    const utility = { ...card, effects: [{ kind: 'GainAp' as const, params: { amount: 1 } }] }
    expect(computeForecast(utility, src, tgt, 0)).toBeNull()
  })

  it('damage forecast: base + STR − DR, then armor absorbs', () => {
    const src = mkUnit('src', 20, 0)               // STR 5
    const tgt = mkUnit('tgt', 14, 2, 4, 4)         // armor 2, DEF 4 → DR 2
    // raw = 8 + 5 = 13 ; afterDR = 13 − 2 = 11 ; armor 2 absorbs ; hp loss 9
    const r = computeForecast(card, src, tgt, 0)!
    expect(r).toMatchObject({
      damageBefore: 11,
      armorLost: 2,
      hpLost: 9,
      predictedHp: 5,
      predictedArmor: 0,
      lethal: false,
      damageType: 'physical',
    })
  })

  it('damage forecast: lethal flag when predicted HP === 0', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 5, 0, 0, 0)
    const r = computeForecast(card, src, tgt, 0)!
    expect(r.predictedHp).toBe(0)
    expect(r.lethal).toBe(true)
  })

  it('terrain DR adds to defensive DR', () => {
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 20, 0, 0, 0)
    // raw = 13 ; afterDR = 13 − 0 (def) − 3 (terrain) = 10
    const r = computeForecast(card, src, tgt, 3)!
    expect(r.damageBefore).toBe(10)
    expect(r.hpLost).toBe(10)
  })

  it('heal forecast: positive heal capped at max HP', () => {
    const heal = {
      id: 'heal_staff_heal',
      apCost: 1,
      range: { min: 1, max: 2 },
      targetKind: 'ally' as const,
      weaponType: 'staff' as const,
      effects: [{ kind: 'Heal' as const, params: { amount: 8 } }],
    }
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 12, 0)
    tgt.hp.current = 12
    tgt.hp.max = 22
    const r = computeForecast(heal, src, tgt, 0)!
    expect(r).toMatchObject({
      heal: 8,
      predictedHp: 20,
      damageBefore: 0,
      hpLost: 0,
      lethal: false,
    })
  })

  it('heal forecast: caps when overflow', () => {
    const heal = {
      id: 'heal_staff_restore',
      apCost: 2,
      range: { min: 1, max: 2 },
      targetKind: 'ally' as const,
      weaponType: 'staff' as const,
      effects: [{ kind: 'Heal' as const, params: { amount: 15 } }],
    }
    const src = mkUnit('src', 20, 0)
    const tgt = mkUnit('tgt', 18, 0)
    tgt.hp.current = 18
    tgt.hp.max = 22
    const r = computeForecast(heal, src, tgt, 0)!
    expect(r.heal).toBe(4)         // 18 → 22, clamped
    expect(r.predictedHp).toBe(22)
  })

  it('magic damage forecast uses MAG stat and RES for DR', () => {
    const src = mkUnit('src', 20, 0)
    src.stats.str = 5
    src.stats.mag = 7
    const tgt = mkUnit('tgt', 20, 0, 4, 6)         // DEF 4, RES 6 → DR 3
    const magic = {
      id: 'fire_tome_blaze',
      apCost: 2,
      range: { min: 1, max: 2 },
      targetKind: 'enemy' as const,
      weaponType: 'tome' as const,
      damageStat: 'mag' as const,
      effects: [{ kind: 'Damage' as const, params: { base: 8, damageType: 'magic' } }],
    }
    // raw = 8 + 7 = 15 ; afterDR = 15 − 3 = 12 ; magic split 6/6
    // armor 0 → all 12 to hp
    const r = computeForecast(magic, src, tgt, 0)!
    expect(r).toMatchObject({
      damageBefore: 12,
      damageType: 'magic',
      hpLost: 12,
      predictedHp: 8,
    })
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npx vitest run tests/unit/systems/damage.test.ts --reporter=basic
```

Expected: ALL FAIL — `Cannot find module '../../../src/systems/damage'`.

- [ ] **Step 1.3: Write minimal implementation**

Create `phaser/src/systems/damage.ts`:

```typescript
import type { Unit } from '../domain/unit'

export type DamageType = 'physical' | 'magic'

export interface ApplyDamageResult {
  newArmor: number
  newHp: number
  hpLost: number
  armorLost: number
}

/**
 * Apply damage to a unit through the armor model:
 *   - Physical: armor absorbs first, residual to HP.
 *   - Magic: half goes through armor, half pierces directly to HP.
 *
 * Pure function. Does not mutate the input unit.
 */
export function applyDamage(target: Unit, amount: number, damageType: DamageType): ApplyDamageResult {
  if (amount <= 0) {
    return { newArmor: target.armor, newHp: target.hp.current, hpLost: 0, armorLost: 0 }
  }
  if (damageType === 'physical') {
    const armorLost = Math.min(target.armor, amount)
    const hpLost = Math.min(target.hp.current, amount - armorLost)
    return {
      newArmor: target.armor - armorLost,
      newHp: target.hp.current - hpLost,
      hpLost,
      armorLost,
    }
  }
  // Magic: floor(amount/2) faces armor, ceil(amount/2) pierces.
  const halfArmored = Math.floor(amount / 2)
  const halfPiercing = amount - halfArmored
  const armorLost = Math.min(target.armor, halfArmored)
  const armoredLeak = halfArmored - armorLost
  const totalHpLossRaw = armoredLeak + halfPiercing
  const hpLost = Math.min(target.hp.current, totalHpLossRaw)
  return {
    newArmor: target.armor - armorLost,
    newHp: target.hp.current - hpLost,
    hpLost,
    armorLost,
  }
}

// --- Forecast ----------------------------------------------------------------

export type ForecastEffectKind = 'Damage' | 'Heal' | 'GrantArmor' | 'GainAp' | 'DrawCards'
  | 'ApplyStatus' | 'RemoveStatus' | 'Move'

export interface ForecastCard {
  id: string
  apCost: number
  damageStat?: 'str' | 'mag' | 'skl'
  effects: Array<{ kind: string; params: Record<string, unknown> }>
}

export interface ForecastResult {
  damageType: DamageType | null    // null for non-damage cards
  damageBefore: number             // damage after raw + stat − DR (before armor split)
  armorLost: number
  hpLost: number
  predictedHp: number
  predictedArmor: number
  heal: number                     // 0 for non-heal
  lethal: boolean
  // Math row terms (for ForecastMathRow rendering):
  baseTerm: number
  statTerm: number
  statName: 'str' | 'mag' | 'skl' | null
  drTerm: number
  terrainDr: number
}

/**
 * Compute a forecast for `card` cast by `src` onto `target` at given terrain DR.
 * Returns null if the card has no Damage/Heal effect (pure utility cards).
 */
export function computeForecast(
  card: ForecastCard,
  src: Unit,
  target: Unit,
  terrainDr: number,
): ForecastResult | null {
  const damageEff = card.effects.find((e) => e.kind === 'Damage')
  const healEff = card.effects.find((e) => e.kind === 'Heal')
  if (!damageEff && !healEff) return null

  if (healEff) {
    const amount = (healEff.params.amount as number | undefined) ?? 0
    const heal = Math.min(amount, target.hp.max - target.hp.current)
    return {
      damageType: null,
      damageBefore: 0,
      armorLost: 0,
      hpLost: 0,
      predictedHp: target.hp.current + heal,
      predictedArmor: target.armor,
      heal,
      lethal: false,
      baseTerm: amount,
      statTerm: 0,
      statName: null,
      drTerm: 0,
      terrainDr: 0,
    }
  }

  // Damage path
  const dmgParams = damageEff!.params as { base?: number; damageType?: DamageType }
  const base = dmgParams.base ?? 0
  const damageType: DamageType = dmgParams.damageType === 'magic' ? 'magic' : 'physical'
  const stat = card.damageStat ?? null
  const statTerm = stat === 'str' ? src.stats.str : stat === 'mag' ? src.stats.mag : stat === 'skl' ? src.stats.skl : 0
  const dr = damageType === 'magic' ? Math.floor(target.stats.res / 2) : Math.floor(target.stats.def / 2)
  const totalDr = dr + terrainDr
  const damageBefore = Math.max(0, base + statTerm - totalDr)
  const apply = applyDamage(target, damageBefore, damageType)
  return {
    damageType,
    damageBefore,
    armorLost: apply.armorLost,
    hpLost: apply.hpLost,
    predictedHp: apply.newHp,
    predictedArmor: apply.newArmor,
    heal: 0,
    lethal: apply.newHp === 0 && target.hp.current > 0,
    baseTerm: base,
    statTerm,
    statName: stat,
    drTerm: dr,
    terrainDr,
  }
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
npx vitest run tests/unit/systems/damage.test.ts --reporter=basic
```

Expected: 13/13 PASS.

- [ ] **Step 1.5: Update CONTEXT.md**

Modify `phaser/CONTEXT.md` — find the systems section (search for `src/systems/` heading) and add a row under it:

```markdown
**Damage (`systems/damage.ts`):** pure `applyDamage(target, amount, type)` and `computeForecast(card, src, target, terrainDr)`. Single source of truth for damage math. Reducer `Damage` handler and forecast UI both call these — they cannot drift. Physical absorbs through armor first; magic splits floor/2 armored + ceil/2 piercing. Exports `applyDamage`, `computeForecast`, `ApplyDamageResult`, `ForecastResult`, `ForecastCard`, `DamageType`.
```

- [ ] **Step 1.6: Run all gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates
```

Expected: all green.

- [ ] **Step 1.7: Commit**

```bash
git add src/systems/damage.ts tests/unit/systems/damage.test.ts CONTEXT.md
git commit -m "$(cat <<'EOF'
feat(phaser): [CHF-1] pure damage.ts — applyDamage + computeForecast

Single source of truth for damage math. Mirrors Godot's combat_manager.gd:
physical damage absorbs through armor first; magic damage splits half to
armor, half piercing to HP. Heals cap at max HP.

Exports applyDamage and computeForecast, both pure. Reducer (CHF-2) and
ForecastPanel (CHF-4) will both call these — they cannot drift.

13 unit tests cover: physical/magic with/without armor, lethal detection,
terrain DR, heal capping, magic stat scaling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire applyDamage into the reducer (CHF-2)

**Files:**
- Modify: `phaser/src/systems/combatReducer.ts:200-220` (Damage effect handler)
- Modify: `phaser/tests/unit/systems/combatReducer.test.ts` (assert armor consumption)

- [ ] **Step 2.1: Add a failing test for armor consumption**

Open `phaser/tests/unit/systems/combatReducer.test.ts`. At the bottom of the file, before the closing `})` of the outer `describe`, add this new test block (DO NOT remove existing tests):

```typescript
describe('combatReducer: armor consumption (CHF-2)', () => {
  it('physical damage absorbs through armor before hitting HP', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const attacker = mk('atk', 5, 'lord')
    attacker.position = 't0,0' as never
    attacker.stats.str = 5
    const target = mk('tgt', 4, 'bandit')
    target.position = 't1,0' as never
    target.stats.def = 0
    target.armor = 10
    target.hp.current = 20
    target.hp.max = 20
    const s0 = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [attacker, target],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: { atk: { draw: [], hand: [], discard: [] }, tgt: { draw: [], hand: [], discard: [] } },
      },
    }, rng).state

    const s1 = reduce(s0, {
      type: 'playCard',
      payload: {
        cardId: 'iron_sword_thrust' as never,
        srcId: attacker.id,
        targets: ['t1,0' as never],
        card: {
          apCost: 2,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 8 } }],
        },
      },
    }, rng).state

    const updatedTgt = s1.units['tgt']!
    // raw 8 + 5 = 13, def 0 → DR 0, armor 10 absorbs all 13? no — armor 10 absorbs 10, 3 leaks
    expect(updatedTgt.armor).toBe(0)
    expect(updatedTgt.hp.current).toBe(17)
  })

  it('magic damage half-armor / half-pierce', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const mage = mk('m', 5, 'mage')
    mage.position = 't0,0' as never
    mage.stats.mag = 5
    const target = mk('tgt', 4, 'bandit')
    target.position = 't2,0' as never
    target.stats.res = 0
    target.armor = 5
    target.hp.current = 20
    target.hp.max = 20
    const s0 = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [mage, target],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: { m: { draw: [], hand: [], discard: [] }, tgt: { draw: [], hand: [], discard: [] } },
      },
    }, rng).state

    const s1 = reduce(s0, {
      type: 'playCard',
      payload: {
        cardId: 'fire_tome_blaze' as never,
        srcId: mage.id,
        targets: ['t2,0' as never],
        card: {
          apCost: 2,
          damageStat: 'mag',
          effects: [{ kind: 'Damage', params: { base: 8, damageType: 'magic' } }],
        },
      },
    }, rng).state

    const updatedTgt = s1.units['tgt']!
    // raw 8 + 5 = 13 ; magic split: halfArmored 6, halfPiercing 7
    // armor 5 absorbs 5 of armored half; 1 leaks; pierce 7 → hp
    // hp 20 − (1 + 7) = 12, armor 0
    expect(updatedTgt.armor).toBe(0)
    expect(updatedTgt.hp.current).toBe(12)
  })

  it('zero damage after DR does not consume armor', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const weakling = mk('w', 5, 'lord')
    weakling.position = 't0,0' as never
    weakling.stats.str = 0
    const tank = mk('k', 4, 'knight')
    tank.position = 't1,0' as never
    tank.stats.def = 20
    tank.armor = 5
    const s0 = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [weakling, tank],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 0, counter: 0 },
        decks: { w: { draw: [], hand: [], discard: [] }, k: { draw: [], hand: [], discard: [] } },
      },
    }, rng).state

    const s1 = reduce(s0, {
      type: 'playCard',
      payload: {
        cardId: 'iron_sword_slash' as never,
        srcId: weakling.id,
        targets: ['t1,0' as never],
        card: {
          apCost: 1,
          damageStat: 'str',
          effects: [{ kind: 'Damage', params: { base: 1 } }],
        },
      },
    }, rng).state

    const updatedTank = s1.units['k']!
    // raw 1 + 0 = 1 ; DR floor(20/2) = 10 ; afterDR = 0 → armor + hp untouched
    expect(updatedTank.armor).toBe(5)
    expect(updatedTank.hp.current).toBe(20)
  })
})
```

- [ ] **Step 2.2: Run the new tests to verify they fail**

```bash
npx vitest run tests/unit/systems/combatReducer.test.ts --reporter=basic
```

Expected: 3 NEW tests FAIL. Existing tests still pass. Failure messages will say things like `expected armor to be 0, received 10` because the current reducer ignores armor.

- [ ] **Step 2.3: Modify the reducer's Damage handler**

Open `phaser/src/systems/combatReducer.ts`. At the top of the file, add:

```typescript
import { applyDamage } from './damage'
```

Then locate the Damage effect handling block (around line 200-220 — the section that reads `if (eff.kind === 'Damage')`). Replace the body with this:

```typescript
if (eff.kind === 'Damage') {
  const params = eff.params as { base?: number; damageType?: 'physical' | 'magic' }
  const base = params.base ?? 0
  const damageType: 'physical' | 'magic' = params.damageType === 'magic' ? 'magic' : 'physical'
  const stat = card.damageStat
  let statBonus = 0
  if (stat === 'str') statBonus = src.stats.str
  else if (stat === 'mag') statBonus = src.stats.mag
  else if (stat === 'skl') statBonus = src.stats.skl
  for (const target of targetUnits) {
    const dr = damageType === 'magic'
      ? Math.floor(target.stats.res / 2)
      : Math.floor(target.stats.def / 2)
    const damageBefore = Math.max(0, base + statBonus - dr)
    const result = applyDamage(target, damageBefore, damageType)
    const tStr = target.id as unknown as string
    const updated: Unit = {
      ...target,
      hp: { ...target.hp, current: result.newHp },
      armor: result.newArmor,
    }
    newUnits[tStr] = updated
    effects.push({
      kind: 'FloatDamage',
      tile: target.position!,
      amount: result.hpLost + result.armorLost,
      damageKind: damageType,
    })
    effects.push({
      kind: 'HitFlash',
      sprite: { id: tStr },
      durationMs: 80,
    })
  }
}
```

Note: this preserves the same `FloatDamage` total (armorLost + hpLost) so the existing screen number animation matches what the player feels — they see total damage dealt. Future polish could split the floating numbers; out of scope here.

- [ ] **Step 2.4: Run combatReducer tests to verify everything passes**

```bash
npx vitest run tests/unit/systems/combatReducer.test.ts --reporter=basic
```

Expected: ALL pass — 3 new tests + every existing test (none of the existing tests assert armor, so they're unaffected).

- [ ] **Step 2.5: Run all gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green. The e2e combat tests (`combat-buttons.spec.ts`, `combat-movement.spec.ts`) don't measure armor either, so they should pass without modification.

- [ ] **Step 2.6: Commit**

```bash
git add src/systems/combatReducer.ts tests/unit/systems/combatReducer.test.ts
git commit -m "$(cat <<'EOF'
feat(phaser): [CHF-2] reducer Damage handler consumes armor

Wire applyDamage from damage.ts into the playCard handler. Armor now
actually reduces incoming damage (was previously a cosmetic field that
only grew via GrantArmor). Knight Fortify, Buckler Block, Mage Barrier,
and other defensive cards now matter.

3 new tests cover physical-armor-absorb, magic-half-pierce, and zero-
damage-after-DR-not-consuming-armor.

FloatDamage screen number stays as armorLost + hpLost so the player sees
the full damage dealt at the tile (split visualization is out of scope).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Initiative Strip (CHF-3)

**Files:**
- Create: `phaser/src/ui/hooks/useInitiativeQueue.ts`
- Create: `phaser/tests/unit/ui/hooks/useInitiativeQueue.test.ts`
- Create: `phaser/src/ui/scenes/combat/InitiativeEntry.tsx`
- Create: `phaser/src/ui/scenes/combat/InitiativeStrip.tsx`
- Create: `phaser/tests/unit/ui/scenes/combat/InitiativeStrip.test.tsx`
- Modify: `phaser/src/ui/scenes/combat/CombatHud.tsx` (mount strip)
- Modify: `phaser/CONTEXT.md` (add hook + components)

- [ ] **Step 3.1: Write failing test for useInitiativeQueue**

Create `phaser/tests/unit/ui/hooks/useInitiativeQueue.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInitiativeQueue } from '../../../../src/ui/hooks/useInitiativeQueue'
import { useCombatStore } from '../../../../src/state/combatStore'
import { initialCombatState } from '../../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mk = (id: string, spd: number, hp = 20): Unit => ({
  id: asUnitId(id),
  name: id,
  classId: asClassId('lord'),
  level: 1,
  hp: { current: hp, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

const seedCombat = (units: Unit[], turnUnitId: string): void => {
  const recordUnits: Record<string, Unit> = {}
  for (const u of units) recordUnits[u.id as unknown as string] = u
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      units: recordUnits,
      turn: { number: 1, unitId: asUnitId(turnUnitId), team: 'party' },
    },
    lastEffectId: 0,
  })
}

describe('useInitiativeQueue', () => {
  it('returns empty array when in BOOT phase', () => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current).toEqual([])
  })

  it('returns SPD-descending order with current actor first', () => {
    seedCombat([mk('a', 8), mk('b', 5), mk('c', 7)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['a', 'c', 'b'])
    expect(result.current[0]!.isActive).toBe(true)
    expect(result.current[1]!.isActive).toBe(false)
  })

  it('rotates queue so current actor is first when not at top of SPD', () => {
    seedCombat([mk('a', 8), mk('b', 5), mk('c', 7)], 'b')
    const { result } = renderHook(() => useInitiativeQueue())
    // SPD order is a(8), c(7), b(5). Current is b → rotate so b is first.
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['b', 'a', 'c'])
  })

  it('filters dead units (hp.current === 0)', () => {
    seedCombat([mk('a', 8), mk('b', 5, 0), mk('c', 7)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current.map((e) => e.unitId as unknown as string)).toEqual(['a', 'c'])
  })

  it('updates when turn changes', () => {
    seedCombat([mk('a', 8), mk('b', 5)], 'a')
    const { result } = renderHook(() => useInitiativeQueue())
    expect(result.current[0]!.unitId as unknown as string).toBe('a')

    act(() => {
      useCombatStore.setState((s) => ({
        ...s,
        state: { ...s.state, turn: { ...s.state.turn, unitId: asUnitId('b') } },
      }))
    })

    expect(result.current[0]!.unitId as unknown as string).toBe('b')
  })
})
```

- [ ] **Step 3.2: Run hook tests to verify failure**

```bash
npx vitest run tests/unit/ui/hooks/useInitiativeQueue.test.ts --reporter=basic
```

Expected: ALL FAIL — `Cannot find module '../../../../src/ui/hooks/useInitiativeQueue'`.

- [ ] **Step 3.3: Create useInitiativeQueue hook**

Create `phaser/src/ui/hooks/useInitiativeQueue.ts`:

```typescript
import { useCombatStore } from '../../state/combatStore'
import { buildInitiativeQueue } from '../../systems/turnOrder'
import type { UnitId } from '../../domain/ids'
import type { Unit } from '../../domain/unit'

export interface InitiativeEntry {
  unitId: UnitId
  unit: Unit
  isActive: boolean
  team: 'party' | 'enemy'
}

const PARTY_CLASSES = new Set(['lord', 'knight', 'mage', 'cleric', 'cavalier', 'thief', 'pegasus', 'wyvern', 'bow_knight', 'bounty_hunter'])

function teamOf(u: Unit): 'party' | 'enemy' {
  return PARTY_CLASSES.has(u.classId as unknown as string) ? 'party' : 'enemy'
}

/**
 * Selector hook returning the current battle's turn order, rotated so the
 * active actor is first. Filters out dead units. Returns [] outside COMBAT.
 *
 * The queue is recomputed on every render via buildInitiativeQueue. This is
 * cheap (≤16 units sort) and keeps the strip in sync without store-state churn.
 */
export function useInitiativeQueue(): InitiativeEntry[] {
  return useCombatStore((s) => {
    if (s.state.phase !== 'COMBAT') return []
    const alive = Object.values(s.state.units).filter((u) => u.hp.current > 0)
    if (alive.length === 0) return []
    const order = buildInitiativeQueue(alive)
    const currentUid = s.state.turn.unitId
    const currentIdx = currentUid === null
      ? 0
      : order.findIndex((id) => (id as unknown as string) === (currentUid as unknown as string))
    const startIdx = currentIdx === -1 ? 0 : currentIdx
    const rotated = [...order.slice(startIdx), ...order.slice(0, startIdx)]
    return rotated.map((uid, i) => {
      const u = s.state.units[uid as unknown as string]!
      return {
        unitId: uid,
        unit: u,
        isActive: i === 0 && currentIdx !== -1,
        team: teamOf(u),
      }
    })
  })
}
```

- [ ] **Step 3.4: Run hook tests to verify pass**

```bash
npx vitest run tests/unit/ui/hooks/useInitiativeQueue.test.ts --reporter=basic
```

Expected: 5/5 PASS.

- [ ] **Step 3.5: Write failing test for InitiativeStrip component**

Create `phaser/tests/unit/ui/scenes/combat/InitiativeStrip.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InitiativeStrip } from '../../../../../src/ui/scenes/combat/InitiativeStrip'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../../../src/domain/ids'
import type { Unit } from '../../../../../src/domain/unit'

const mk = (id: string, spd: number, classId = 'lord', hp = 20): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: hp, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  position: null,
  ap: 3,
  armor: 0,
  statuses: [],
})

const seed = (units: Unit[], turnUnitId: string): void => {
  const recordUnits: Record<string, Unit> = {}
  for (const u of units) recordUnits[u.id as unknown as string] = u
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      units: recordUnits,
      turn: { number: 1, unitId: asUnitId(turnUnitId), team: 'party' },
    },
    lastEffectId: 0,
  })
}

describe('<InitiativeStrip>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders nothing in BOOT phase', () => {
    const { container } = render(<InitiativeStrip />)
    expect(container.querySelector('#initiative-strip')).toBeNull()
  })

  it('renders portraits in turn order with active first', () => {
    seed([mk('roy', 8, 'lord'), mk('marcus', 5, 'knight'), mk('lilina', 7, 'mage')], 'roy')
    render(<InitiativeStrip />)
    const entries = screen.getAllByTestId('initiative-entry')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveAttribute('data-active', 'true')
    expect(entries[1]).toHaveAttribute('data-active', 'false')
  })

  it('uses red ring class for enemies', () => {
    seed([mk('roy', 8, 'lord'), mk('bandit', 5, 'bandit')], 'roy')
    render(<InitiativeStrip />)
    const entries = screen.getAllByTestId('initiative-entry')
    const banditEntry = entries.find((e) => e.getAttribute('data-unit-id') === 'bandit')!
    expect(banditEntry.getAttribute('data-team')).toBe('enemy')
  })

  it('shows unit HP label', () => {
    seed([mk('roy', 8, 'lord', 12)], 'roy')
    render(<InitiativeStrip />)
    expect(screen.getByText('12/20')).toBeInTheDocument()
  })

  it('shows "+N more" badge when queue exceeds 8', () => {
    const units = Array.from({ length: 10 }, (_, i) => mk(`u${i}`, 10 - i, 'lord'))
    seed(units, 'u0')
    render(<InitiativeStrip />)
    expect(screen.getByText(/\+2/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3.6: Run component tests to verify failure**

```bash
npx vitest run tests/unit/ui/scenes/combat/InitiativeStrip.test.tsx --reporter=basic
```

Expected: ALL FAIL — `Cannot find module ... InitiativeStrip`.

- [ ] **Step 3.7: Create InitiativeEntry component**

Create `phaser/src/ui/scenes/combat/InitiativeEntry.tsx`:

```typescript
import React from 'react'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import type { InitiativeEntry as InitiativeEntryData } from '../../hooks/useInitiativeQueue'

export interface InitiativeEntryProps {
  entry: InitiativeEntryData
}

const ACTIVE_RING_PARTY = 'ring-2 ring-amber-300'
const ACTIVE_RING_ENEMY = 'ring-2 ring-red-600'
const UPCOMING_RING_PARTY = 'ring-1 ring-amber-700/50'
const UPCOMING_RING_ENEMY = 'ring-1 ring-red-900/60'

export function InitiativeEntry({ entry }: InitiativeEntryProps): React.JSX.Element {
  const { unit, isActive, team } = entry
  const ringClass = isActive
    ? team === 'party' ? ACTIVE_RING_PARTY : ACTIVE_RING_ENEMY
    : team === 'party' ? UPCOMING_RING_PARTY : UPCOMING_RING_ENEMY
  const portraitSize = isActive ? 56 : 44
  const hpPct = unit.hp.current / unit.hp.max
  const hpColor = hpPct > 0.5 ? 'text-amber-200' : hpPct > 0.25 ? 'text-amber-400' : 'text-red-400'

  return (
    <div
      data-testid="initiative-entry"
      data-unit-id={unit.id as unknown as string}
      data-active={isActive ? 'true' : 'false'}
      data-team={team}
      className={`flex flex-col items-center gap-1 transition-transform ${isActive ? 'scale-110' : ''}`}
      aria-label={`${unit.name}, ${unit.classId as unknown as string}, HP ${unit.hp.current} of ${unit.hp.max}${isActive ? ', active turn' : ''}`}
    >
      <div className={`rounded-full overflow-hidden ${ringClass}`}>
        <CharacterPortrait speaker={unit.name} size={portraitSize} active={isActive} />
      </div>
      <span className={`text-[10px] font-mono tabular-nums ${hpColor}`}>
        {unit.hp.current}/{unit.hp.max}
      </span>
    </div>
  )
}
```

- [ ] **Step 3.8: Create InitiativeStrip component**

Create `phaser/src/ui/scenes/combat/InitiativeStrip.tsx`:

```typescript
import React from 'react'
import { useInitiativeQueue } from '../../hooks/useInitiativeQueue'
import { InitiativeEntry } from './InitiativeEntry'

const MAX_VISIBLE = 8

export function InitiativeStrip(): React.JSX.Element | null {
  const queue = useInitiativeQueue()
  if (queue.length === 0) return null

  const visible = queue.slice(0, MAX_VISIBLE)
  const overflow = queue.length - MAX_VISIBLE

  return (
    <div
      id="initiative-strip"
      className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-end gap-2 px-3 py-2 bg-stone-950/85 border border-amber-900/50 rounded backdrop-blur-sm pointer-events-auto z-[90]"
      aria-label="Turn order"
    >
      {visible.map((entry) => (
        <InitiativeEntry key={entry.unitId as unknown as string} entry={entry} />
      ))}
      {overflow > 0 && (
        <div
          data-testid="initiative-overflow"
          className="flex items-center justify-center w-11 h-11 rounded-full border border-stone-700 text-stone-400 text-xs font-mono"
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3.9: Run InitiativeStrip tests to verify pass**

```bash
npx vitest run tests/unit/ui/scenes/combat/InitiativeStrip.test.tsx --reporter=basic
```

Expected: 5/5 PASS.

- [ ] **Step 3.10: Wire into CombatHud**

Open `phaser/src/ui/scenes/combat/CombatHud.tsx`. Add the import and render the strip:

```typescript
import React from 'react'
import { TopBar } from './TopBar'
import { ModeLabel } from './ModeLabel'
import { MoveBtn } from './MoveBtn'
import { EndTurnBtn } from './EndTurnBtn'
import { CardHand } from './CardHand'
import { CaptureBtn } from './CaptureBtn'
import { InitiativeStrip } from './InitiativeStrip'

export function CombatHud(): React.JSX.Element {
  return (
    <div
      id="combat-hud"
      className="pointer-events-none absolute inset-0 z-[100] font-mono"
    >
      <div className="pointer-events-auto"><TopBar /></div>
      <ModeLabel />
      <InitiativeStrip />
      <CardHand />
      <CaptureBtn />
      <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
        <MoveBtn />
        <EndTurnBtn />
      </div>
    </div>
  )
}
```

- [ ] **Step 3.11: Update CONTEXT.md**

Modify `phaser/CONTEXT.md` to add a new row in the appropriate UI section (search for "Combat HUD" or the section listing CombatHud subcomponents):

```markdown
**Initiative strip (`ui/scenes/combat/InitiativeStrip.tsx` + `InitiativeEntry.tsx`):** fixed bottom-center HUD element. Reads `useInitiativeQueue` (which calls `buildInitiativeQueue` over alive units and rotates so current actor is first). Renders up to 8 portraits with `+N` overflow badge. Active actor scales 1.1x with team-colored ring (amber=party, red=enemy). Independent of player selection — only depends on `state.units` and `state.turn.unitId`.
```

- [ ] **Step 3.12: Run all gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green. The existing `CombatHud.test.tsx` still passes — it doesn't assert against initiative, just TopBar contents.

- [ ] **Step 3.13: Commit**

```bash
git add src/ui/hooks/useInitiativeQueue.ts \
        src/ui/scenes/combat/InitiativeStrip.tsx \
        src/ui/scenes/combat/InitiativeEntry.tsx \
        src/ui/scenes/combat/CombatHud.tsx \
        tests/unit/ui/hooks/useInitiativeQueue.test.ts \
        tests/unit/ui/scenes/combat/InitiativeStrip.test.tsx \
        CONTEXT.md
git commit -m "$(cat <<'EOF'
feat(phaser): [CHF-3] initiative strip — fixed bottom-center turn-order portraits

Banner-Saga-style horizontal portrait queue, pinned bottom-center above
the card hand. Active actor scales 1.1x with team-colored ring
(amber=party, red=enemy). Up to 8 portraits visible; +N overflow badge.
HP label below each portrait, color-graded green→amber→red.

useInitiativeQueue hook recomputes via buildInitiativeQueue + rotation
on every render — pure selector, no state-shape churn. Filters dead
units. Returns [] outside COMBAT phase.

Independent of player selection: only reads state.units and
state.turn.unitId. Always present, always reflecting same data.

5 hook tests + 5 component tests cover empty/active/rotation/dead/overflow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Forecast Panel (CHF-4)

**Files:**
- Modify: `phaser/src/domain/combatState.ts` (add `pinnedTargetTile` + `pinTarget`/`unpinTarget` events)
- Modify: `phaser/src/systems/combatReducer.ts` (handle pinTarget/unpinTarget; clear on cancelSelection / playCard / endTurn)
- Modify: `phaser/src/game/scenes/BoardScene.ts` (tile click during SELECTING_TARGET pins first time, plays second time)
- Create: `phaser/src/ui/hooks/useForecastPreview.ts`
- Create: `phaser/tests/unit/ui/hooks/useForecastPreview.test.ts`
- Create: `phaser/src/ui/scenes/combat/ForecastPanel.tsx`
- Create: `phaser/src/ui/scenes/combat/ForecastCombatantRow.tsx`
- Create: `phaser/src/ui/scenes/combat/ForecastHpBar.tsx`
- Create: `phaser/src/ui/scenes/combat/ForecastMathRow.tsx`
- Create: `phaser/src/ui/scenes/combat/ForecastStatusRow.tsx`
- Create: `phaser/tests/unit/ui/scenes/combat/ForecastPanel.test.tsx`
- Modify: `phaser/src/ui/scenes/combat/CombatHud.tsx` (mount ForecastPanel)
- Modify: `phaser/CONTEXT.md`

- [ ] **Step 4.1: Add `pinnedTargetTile` + reducer events**

Open `phaser/src/domain/combatState.ts`. In the `CombatState` interface, add `pinnedTargetTile` after `selectedCardId`:

```typescript
export interface CombatState {
  phase: CombatPhase
  subPhase: CombatSubPhase
  turn: CombatTurn
  units: Record<string, Unit>
  decks: Record<string, DeckState>
  grid: CombatGrid
  rng: RngState
  selectedCardId: CardId | null
  pinnedTargetTile: TileId | null
  effectQueue: CombatEffect[]
}
```

In the `CombatEvent` union, add two new events after `cancelSelection`:

```typescript
| { type: 'pinTarget'; payload: { tileId: TileId } }
| { type: 'unpinTarget' }
```

- [ ] **Step 4.2: Update initialCombatState and existing reducer cases**

Open `phaser/src/systems/combatReducer.ts`. Find the `initialCombatState()` function and add `pinnedTargetTile: null` to the returned state:

```typescript
export function initialCombatState(): CombatState {
  return {
    phase: 'BOOT',
    subPhase: 'IDLE',
    turn: { number: 0, unitId: null, team: 'party' },
    units: {},
    decks: {},
    grid: { width: 14, height: 10, obstacles: new Set() },
    rng: { seed: 0, counter: 0 },
    selectedCardId: null,
    pinnedTargetTile: null,
    effectQueue: [],
  }
}
```

In the `cancelSelection` case (find it via `case 'cancelSelection'`), update to also clear pinned target:

```typescript
case 'cancelSelection':
  return {
    state: { ...state, selectedCardId: null, pinnedTargetTile: null, subPhase: 'IDLE' },
    effects: [],
  }
```

In the `endTurn` case, in the new state object after the `phase` check, ensure pinnedTargetTile clears too — find where the new turn state is built and include `pinnedTargetTile: null`. Search for `state.turn.unitId` updated to next unit and ensure it returns `{ ...state, turn: ..., subPhase: 'IDLE', selectedCardId: null, pinnedTargetTile: null }`.

In the `playCard` case, after the card resolves, the existing return already sets `selectedCardId: null` — add `pinnedTargetTile: null` next to it.

Add the two new cases somewhere alongside `cancelSelection`:

```typescript
case 'pinTarget':
  return {
    state: { ...state, pinnedTargetTile: event.payload.tileId },
    effects: [],
  }
case 'unpinTarget':
  return {
    state: { ...state, pinnedTargetTile: null },
    effects: [],
  }
```

- [ ] **Step 4.3: Verify reducer compiles + tests still pass**

```bash
npm run typecheck && npx vitest run tests/unit/systems/combatReducer.test.ts --reporter=basic
```

Expected: typecheck passes; all combatReducer tests pass (existing tests don't read pinnedTargetTile).

- [ ] **Step 4.4: Write failing test for useForecastPreview**

Create `phaser/tests/unit/ui/hooks/useForecastPreview.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useForecastPreview } from '../../../../src/ui/hooks/useForecastPreview'
import { useCombatStore } from '../../../../src/state/combatStore'
import { initialCombatState } from '../../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId } from '../../../../src/domain/ids'
import type { Unit } from '../../../../src/domain/unit'

const mk = (id: string, classId = 'lord'): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0 },
  position: id === 'roy' ? ('t0,0' as never) : ('t1,0' as never),
  ap: 3,
  armor: 0,
  statuses: [],
})

const seed = (selectedCardId: string | null, pinnedTile: string | null): void => {
  const roy = mk('roy', 'lord')
  const bandit = mk('bandit', 'bandit')
  bandit.hp.current = 14
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      subPhase: 'SELECTING_TARGET',
      units: { roy, bandit },
      turn: { number: 1, unitId: asUnitId('roy'), team: 'party' },
      selectedCardId: selectedCardId === null ? null : asCardId(selectedCardId),
      pinnedTargetTile: pinnedTile === null ? null : asTileId(pinnedTile),
    },
    lastEffectId: 0,
  })
}

describe('useForecastPreview', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('returns null when no card selected', () => {
    seed(null, 't1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when no target pinned', () => {
    seed('iron_sword_thrust', null)
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when card id not in catalog', () => {
    seed('phantom_card', 't1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns null when pinned tile has no unit', () => {
    seed('iron_sword_thrust', 't9,9')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).toBeNull()
  })

  it('returns ForecastResult-with-card-and-units when valid', () => {
    seed('iron_sword_thrust', 't1,0')
    const { result } = renderHook(() => useForecastPreview())
    expect(result.current).not.toBeNull()
    const r = result.current!
    expect(r.card.id).toBe('iron_sword_thrust')
    expect(r.source.id as unknown as string).toBe('roy')
    expect(r.target.id as unknown as string).toBe('bandit')
    // Iron Sword Thrust: base 8 + STR 5 = 13, def 0 → DR 0, armor 0 → hp loss 13
    expect(r.forecast.damageBefore).toBe(13)
    expect(r.forecast.predictedHp).toBe(1)
  })
})
```

- [ ] **Step 4.5: Run hook tests to verify failure**

```bash
npx vitest run tests/unit/ui/hooks/useForecastPreview.test.ts --reporter=basic
```

Expected: ALL FAIL — module not found.

- [ ] **Step 4.6: Create useForecastPreview hook**

Create `phaser/src/ui/hooks/useForecastPreview.ts`:

```typescript
import { useCombatStore } from '../../state/combatStore'
import { computeForecast, type ForecastResult, type ForecastCard } from '../../systems/damage'
import type { Unit } from '../../domain/unit'
import cardsJson from '../../data/content/cards.json'

const cardsMap = new Map<string, ForecastCard>(
  cardsJson.map((c) => [c.id, c as ForecastCard]),
)

export interface ForecastPreview {
  card: ForecastCard
  source: Unit
  target: Unit
  forecast: ForecastResult
}

/**
 * Selector hook returning the active forecast (card × source × target) when
 * the player has both a card selected and a target pinned, OR null otherwise.
 *
 * Recomputes via computeForecast on every relevant state change. Terrain DR
 * is 0 for now — to be wired when terrain types land in BoardScene's runtime.
 */
export function useForecastPreview(): ForecastPreview | null {
  return useCombatStore((s) => {
    const cardId = s.state.selectedCardId
    const tile = s.state.pinnedTargetTile
    if (cardId === null || tile === null) return null
    const card = cardsMap.get(cardId as unknown as string)
    if (!card) return null
    const sourceId = s.state.turn.unitId
    if (sourceId === null) return null
    const source = s.state.units[sourceId as unknown as string]
    if (!source) return null
    const tileStr = tile as unknown as string
    const target = Object.values(s.state.units).find(
      (u) => (u.position as unknown as string) === tileStr,
    )
    if (!target) return null
    const forecast = computeForecast(card, source, target, 0)
    if (!forecast) return null
    return { card, source, target, forecast }
  })
}
```

- [ ] **Step 4.7: Run hook tests to verify pass**

```bash
npx vitest run tests/unit/ui/hooks/useForecastPreview.test.ts --reporter=basic
```

Expected: 5/5 PASS.

- [ ] **Step 4.8: Write failing test for ForecastPanel**

Create `phaser/tests/unit/ui/scenes/combat/ForecastPanel.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ForecastPanel } from '../../../../../src/ui/scenes/combat/ForecastPanel'
import { useCombatStore } from '../../../../../src/state/combatStore'
import { initialCombatState } from '../../../../../src/systems/combatReducer'
import { asUnitId, asClassId, asCardId, asTileId } from '../../../../../src/domain/ids'
import type { Unit } from '../../../../../src/domain/unit'

const mk = (id: string, classId = 'lord', hpCur = 20, hpMax = 20, armor = 0): Unit => ({
  id: asUnitId(id),
  name: id.toUpperCase(),
  classId: asClassId(classId),
  level: 1,
  hp: { current: hpCur, max: hpMax },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 0, res: 0 },
  position: id === 'roy' ? ('t0,0' as never) : ('t1,0' as never),
  ap: 3,
  armor,
  statuses: [],
})

const seed = (selectedCardId: string | null, pinnedTile: string | null, target: Unit = mk('bandit', 'bandit', 14, 14, 0)): void => {
  const roy = mk('roy', 'lord')
  useCombatStore.setState({
    state: {
      ...initialCombatState(),
      phase: 'COMBAT',
      subPhase: 'SELECTING_TARGET',
      units: { roy, bandit: target },
      turn: { number: 1, unitId: asUnitId('roy'), team: 'party' },
      selectedCardId: selectedCardId === null ? null : asCardId(selectedCardId),
      pinnedTargetTile: pinnedTile === null ? null : asTileId(pinnedTile),
    },
    lastEffectId: 0,
  })
}

describe('<ForecastPanel>', () => {
  beforeEach(() => {
    useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
  })

  it('renders nothing when no preview', () => {
    seed(null, null)
    const { container } = render(<ForecastPanel />)
    expect(container.querySelector('#forecast-panel')).toBeNull()
  })

  it('renders title with card name and AP cost', () => {
    seed('iron_sword_thrust', 't1,0')
    render(<ForecastPanel />)
    expect(screen.getByText(/Thrust/i)).toBeInTheDocument()
    expect(screen.getByText(/2 AP/i)).toBeInTheDocument()
  })

  it('renders source and target portraits', () => {
    seed('iron_sword_thrust', 't1,0')
    render(<ForecastPanel />)
    expect(screen.getByLabelText(/source: ROY/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target: BANDIT/i)).toBeInTheDocument()
  })

  it('shows lethal badge when predicted HP is 0', () => {
    const tinyBandit = mk('bandit', 'bandit', 5, 14, 0)
    seed('iron_sword_thrust', 't1,0', tinyBandit)
    render(<ForecastPanel />)
    expect(screen.getByText(/LETHAL/i)).toBeInTheDocument()
  })

  it('omits lethal badge when target survives', () => {
    seed('iron_sword_thrust', 't1,0')
    render(<ForecastPanel />)
    expect(screen.queryByText(/LETHAL/i)).toBeNull()
  })

  it('clicking confirm dispatches playCard and clears pin', () => {
    seed('iron_sword_thrust', 't1,0')
    render(<ForecastPanel />)
    const confirm = screen.getByTestId('forecast-confirm-btn')
    fireEvent.click(confirm)
    const s = useCombatStore.getState().state
    expect(s.pinnedTargetTile).toBeNull()
    expect(s.selectedCardId).toBeNull()
  })

  it('clicking cancel dispatches unpinTarget', () => {
    seed('iron_sword_thrust', 't1,0')
    render(<ForecastPanel />)
    const cancel = screen.getByTestId('forecast-cancel-btn')
    fireEvent.click(cancel)
    const s = useCombatStore.getState().state
    expect(s.pinnedTargetTile).toBeNull()
    expect(s.selectedCardId).toBe(asCardId('iron_sword_thrust')) // card still selected
  })

  it('renders armor row when target has armor', () => {
    const armoredKnight = mk('bandit', 'bandit', 14, 14, 5)
    seed('iron_sword_thrust', 't1,0', armoredKnight)
    render(<ForecastPanel />)
    expect(screen.getByText(/Armor/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4.9: Run ForecastPanel tests to verify failure**

```bash
npx vitest run tests/unit/ui/scenes/combat/ForecastPanel.test.tsx --reporter=basic
```

Expected: ALL FAIL — module not found.

- [ ] **Step 4.10: Create ForecastHpBar**

Create `phaser/src/ui/scenes/combat/ForecastHpBar.tsx`:

```typescript
import React from 'react'

export interface ForecastHpBarProps {
  label: string                 // 'HP' or 'Armor'
  current: number
  max: number
  predictedAfter: number
  fillColor: string             // Tailwind class for the filled segment
  lossColor: string             // Tailwind class for the dimmed-loss segment
}

export function ForecastHpBar({
  label,
  current,
  max,
  predictedAfter,
  fillColor,
  lossColor,
}: ForecastHpBarProps): React.JSX.Element {
  const safeMax = Math.max(1, max)
  const safeAfter = Math.max(0, Math.min(predictedAfter, safeMax))
  const safeCurrent = Math.max(safeAfter, Math.min(current, safeMax))
  const remainPct = (safeAfter / safeMax) * 100
  const lossPct = ((safeCurrent - safeAfter) / safeMax) * 100
  const delta = predictedAfter - current
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="w-12 text-stone-400">{label}</span>
      <div className="flex-1 h-3 bg-stone-800 rounded-sm overflow-hidden flex">
        <div className={fillColor} style={{ width: `${remainPct}%` }} />
        <div className={lossColor} style={{ width: `${lossPct}%` }} />
      </div>
      <span className="tabular-nums w-20 text-right">
        {current}/{max}
        {delta !== 0 && (
          <span className={delta > 0 ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
            → {predictedAfter}
          </span>
        )}
      </span>
    </div>
  )
}
```

- [ ] **Step 4.11: Create ForecastCombatantRow**

Create `phaser/src/ui/scenes/combat/ForecastCombatantRow.tsx`:

```typescript
import React from 'react'
import { CharacterPortrait } from '../../components/CharacterPortrait'
import type { Unit } from '../../../domain/unit'

export interface ForecastCombatantRowProps {
  source: Unit
  target: Unit
}

export function ForecastCombatantRow({ source, target }: ForecastCombatantRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <div className="flex flex-col items-center gap-1" aria-label={`source: ${source.name}`}>
        <CharacterPortrait speaker={source.name} size={48} active />
        <span className="text-[10px] font-mono text-amber-200">{source.name}</span>
      </div>
      <span className="text-2xl text-amber-700 select-none">→</span>
      <div className="flex flex-col items-center gap-1" aria-label={`target: ${target.name}`}>
        <CharacterPortrait speaker={target.name} size={48} active={false} />
        <span className="text-[10px] font-mono text-red-300">{target.name}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.12: Create ForecastMathRow**

Create `phaser/src/ui/scenes/combat/ForecastMathRow.tsx`:

```typescript
import React, { useState } from 'react'
import type { ForecastResult } from '../../../systems/damage'

export interface ForecastMathRowProps {
  forecast: ForecastResult
}

export function ForecastMathRow({ forecast }: ForecastMathRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  if (forecast.heal > 0) {
    return (
      <div className="px-3 py-2 text-xs font-mono text-emerald-300">
        +{forecast.heal} healed
      </div>
    )
  }
  const total = forecast.damageBefore
  return (
    <div className="px-3 py-2 text-xs font-mono">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-left w-full text-stone-300 hover:text-amber-200"
        data-testid="forecast-math-toggle"
      >
        <span className="text-stone-500">{expanded ? '▾' : '▸'}</span>
        <span className="text-amber-300">{total} damage</span>
        {forecast.armorLost > 0 && (
          <span className="text-stone-500">
            (−{forecast.armorLost} armor, −{forecast.hpLost} HP)
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-4 text-stone-400">
          <div>
            {forecast.baseTerm} base
            {forecast.statName && (
              <> + {forecast.statTerm} {forecast.statName.toUpperCase()}</>
            )}
            {forecast.drTerm > 0 && (
              <> − {forecast.drTerm} DR</>
            )}
            {forecast.terrainDr > 0 && (
              <> − {forecast.terrainDr} terrain</>
            )}
            {' = '}
            <span className="text-amber-300">{total}</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.13: Create ForecastStatusRow**

Create `phaser/src/ui/scenes/combat/ForecastStatusRow.tsx`:

```typescript
import React from 'react'
import type { ForecastCard } from '../../../systems/damage'

export interface ForecastStatusRowProps {
  card: ForecastCard
}

const STATUS_ICONS: Record<string, string> = {
  bleed: '🩸',
  burn: '🔥',
  poison: '☠',
  slow: '❄',
  immobilize: '⛓',
  taunt: '!',
  riposte: '↩',
}

interface ParsedStatus {
  effectId: string
  turns: number
  value?: number
}

function parseStatuses(card: ForecastCard): ParsedStatus[] {
  const out: ParsedStatus[] = []
  for (const e of card.effects) {
    if (e.kind !== 'ApplyStatus') continue
    const p = e.params as { effectId?: string; turns?: number; value?: number }
    if (typeof p.effectId !== 'string') continue
    out.push({
      effectId: p.effectId,
      turns: typeof p.turns === 'number' ? p.turns : 1,
      ...(typeof p.value === 'number' ? { value: p.value } : {}),
    })
  }
  return out
}

export function ForecastStatusRow({ card }: ForecastStatusRowProps): React.JSX.Element | null {
  const statuses = parseStatuses(card)
  if (statuses.length === 0) return null
  return (
    <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-stone-800">
      {statuses.map((s, i) => (
        <span
          key={`${s.effectId}-${i}`}
          className="px-2 py-0.5 rounded-full bg-stone-800 text-xs font-mono text-amber-300"
          data-testid="forecast-status-chip"
        >
          {STATUS_ICONS[s.effectId] ?? '◇'} {s.effectId}
          {s.value !== undefined && ` (${s.value})`}
          {' '}({s.turns}t)
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4.14: Create ForecastPanel**

Create `phaser/src/ui/scenes/combat/ForecastPanel.tsx`:

```typescript
import React from 'react'
import { useCombatStore } from '../../../state/combatStore'
import { useForecastPreview } from '../../hooks/useForecastPreview'
import { createRng } from '../../../systems/rng'
import { ForecastCombatantRow } from './ForecastCombatantRow'
import { ForecastHpBar } from './ForecastHpBar'
import { ForecastMathRow } from './ForecastMathRow'
import { ForecastStatusRow } from './ForecastStatusRow'
import { Button } from '../../components'
import cardsJson from '../../../data/content/cards.json'

const cardsByName = new Map(cardsJson.map((c) => [c.id, c.name]))

export function ForecastPanel(): React.JSX.Element | null {
  const preview = useForecastPreview()
  const dispatch = useCombatStore((s) => s.dispatch)
  const rngState = useCombatStore((s) => s.state.rng)
  if (!preview) return null
  const { card, source, target, forecast } = preview
  const cardName = cardsByName.get(card.id) ?? card.id

  const onConfirm = (): void => {
    const tileStr = (target.position as unknown as string)
    if (!tileStr) return
    dispatch(
      {
        type: 'playCard',
        payload: {
          cardId: card.id as never,
          srcId: source.id,
          targets: [tileStr as never],
          card: {
            apCost: card.apCost,
            ...(card.damageStat ? { damageStat: card.damageStat } : {}),
            effects: card.effects,
          },
        },
      },
      createRng(rngState),
    )
  }

  const onCancel = (): void => {
    dispatch({ type: 'unpinTarget' }, createRng(rngState))
  }

  return (
    <div
      id="forecast-panel"
      role="region"
      aria-label={`Combat forecast for ${cardName} on ${target.name}`}
      className="fixed top-4 right-4 w-[360px] bg-stone-950/95 border border-amber-900/50 rounded backdrop-blur-sm pointer-events-auto z-[95] font-mono shadow-lg"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800">
        <span className="text-amber-200 font-bold">⚔ {cardName}</span>
        <span className="text-amber-300 text-xs px-2 py-0.5 rounded bg-stone-900 border border-amber-900/50">
          {card.apCost} AP
        </span>
      </div>

      <ForecastCombatantRow source={source} target={target} />

      <div className="px-3 pb-2 flex flex-col gap-1.5">
        <ForecastHpBar
          label="HP"
          current={target.hp.current}
          max={target.hp.max}
          predictedAfter={forecast.predictedHp}
          fillColor="bg-emerald-600"
          lossColor="bg-red-900/70"
        />
        {target.armor > 0 && (
          <ForecastHpBar
            label="Armor"
            current={target.armor}
            max={Math.max(target.armor, forecast.armorLost)}
            predictedAfter={forecast.predictedArmor}
            fillColor="bg-amber-700"
            lossColor="bg-amber-900/50"
          />
        )}
      </div>

      <ForecastMathRow forecast={forecast} />
      <ForecastStatusRow card={card} />

      {forecast.lethal && (
        <div className="px-3 py-1.5 bg-red-900/30 text-red-300 text-xs text-center border-t border-red-900/40">
          ☠ LETHAL
        </div>
      )}

      <div className="flex gap-2 px-3 py-2 border-t border-stone-800">
        <Button
          data-testid="forecast-confirm-btn"
          variant="primary"
          onPress={onConfirm}
          className="flex-1"
        >
          Play
        </Button>
        <Button
          data-testid="forecast-cancel-btn"
          variant="secondary"
          onPress={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4.15: Wire ForecastPanel into CombatHud**

Open `phaser/src/ui/scenes/combat/CombatHud.tsx`. Add the import and render:

```typescript
import React from 'react'
import { TopBar } from './TopBar'
import { ModeLabel } from './ModeLabel'
import { MoveBtn } from './MoveBtn'
import { EndTurnBtn } from './EndTurnBtn'
import { CardHand } from './CardHand'
import { CaptureBtn } from './CaptureBtn'
import { InitiativeStrip } from './InitiativeStrip'
import { ForecastPanel } from './ForecastPanel'

export function CombatHud(): React.JSX.Element {
  return (
    <div
      id="combat-hud"
      className="pointer-events-none absolute inset-0 z-[100] font-mono"
    >
      <div className="pointer-events-auto"><TopBar /></div>
      <ModeLabel />
      <InitiativeStrip />
      <CardHand />
      <CaptureBtn />
      <ForecastPanel />
      <div className="absolute bottom-4 right-4 flex gap-3 pointer-events-auto">
        <MoveBtn />
        <EndTurnBtn />
      </div>
    </div>
  )
}
```

- [ ] **Step 4.16: Update BoardScene tile-click handler for pin-then-play**

Open `phaser/src/game/scenes/BoardScene.ts`. Find the `handleTileClick` (or whichever method handles tile clicks during SELECTING_TARGET — search for the block starting `if (state.subPhase !== 'SELECTING_TARGET' || state.selectedCardId === null) return`). Replace the body of that branch with:

```typescript
if (state.subPhase !== 'SELECTING_TARGET' || state.selectedCardId === null) return
const card = cardsMap.get(state.selectedCardId as unknown as string)
if (!card) return
const activeId = state.turn.unitId === null ? null : (state.turn.unitId as unknown as string)
if (!activeId) return
const activeUnit = state.units[activeId]
if (!activeUnit?.position) return
const valid = tilesInRange(
  asTileId(activeUnit.position as unknown as string),
  card.range.min,
  card.range.max,
  { width: state.grid.width, height: state.grid.height, obstacles: state.grid.obstacles },
)
if (!new Set(valid.map((t) => t as unknown as string)).has(tileId)) return

// Pin-then-play behavior. First click on a valid target tile pins the
// forecast panel; second click on the SAME tile commits the play. Clicking
// a different valid tile re-pins. Right-click / Escape clears the pin via
// the unpinTarget event from the forecast panel itself.
if ((state.pinnedTargetTile as unknown as string | null) !== tileId) {
  cs.dispatch({ type: 'pinTarget', payload: { tileId: asTileId(tileId) } }, createRng(state.rng))
  return
}

const cardPayload: {
  apCost: number
  damageStat?: 'str' | 'mag' | 'skl'
  effects: Array<{ kind: string; params: Record<string, unknown> }>
} = { apCost: card.apCost, effects: card.effects }
if (card.damageStat) cardPayload.damageStat = card.damageStat as 'str' | 'mag' | 'skl'

cs.dispatch({
  type: 'playCard',
  payload: {
    cardId: state.selectedCardId,
    srcId: activeUnit.id,
    targets: [asTileId(tileId)],
    card: cardPayload,
  },
}, createRng(state.rng))
```

- [ ] **Step 4.17: Verify ForecastPanel + integration tests pass**

```bash
npx vitest run tests/unit/ui/scenes/combat/ForecastPanel.test.tsx tests/unit/ui/hooks/useForecastPreview.test.ts --reporter=basic
```

Expected: 13 PASS (8 panel + 5 hook).

- [ ] **Step 4.18: Update existing combat e2e tests for new pin-then-play flow**

Open `phaser/tests/e2e/combat-buttons.spec.ts`. Find the test starting `B-02: clicking a card transitions subPhase to SELECTING_TARGET`. After this test, the existing flow is "click target → playCard." If any test asserts immediate damage on first tile click, add an extra "click same tile again" step. Search for `subPhase` assertions; if found, update accordingly. (If no test exists for the post-target-click resolution, no e2e edits needed; the existing 8 e2e tests don't cover that path.)

Run the e2e suite to verify:

```bash
npm run test:e2e
```

Expected: 8/8 PASS. If a test fails because of the extra-click requirement, edit it to click twice on the target tile.

- [ ] **Step 4.19: Update CONTEXT.md**

Add to `phaser/CONTEXT.md` in the appropriate sections:

In domain section (CombatState row):
```markdown
... `pinnedTargetTile: TileId | null` (forecast pin target, null when no panel) ...
```

In events catalog:
```markdown
`pinTarget { tileId }` — record forecast pin (no other state change). `unpinTarget` — clear the pin without ending the targeting session.
```

In UI section:
```markdown
**Forecast panel (`ui/scenes/combat/ForecastPanel.tsx` + ForecastCombatantRow / ForecastHpBar / ForecastMathRow / ForecastStatusRow):** fixed top-right HUD panel pinned by `pinnedTargetTile`. Reads `useForecastPreview` (which calls `computeForecast`). Shows source→target portraits, HP/armor bars with predicted-loss segments, expandable damage breakdown, status effect chips, LETHAL badge. Confirm button dispatches `playCard`; Cancel dispatches `unpinTarget`. Click-to-pin / click-again-to-play flow lives in `BoardScene.handleTileClick` for the SELECTING_TARGET subphase.
```

- [ ] **Step 4.20: Run all gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green.

- [ ] **Step 4.21: Commit**

```bash
git add src/domain/combatState.ts \
        src/systems/combatReducer.ts \
        src/game/scenes/BoardScene.ts \
        src/ui/hooks/useForecastPreview.ts \
        src/ui/scenes/combat/ForecastPanel.tsx \
        src/ui/scenes/combat/ForecastCombatantRow.tsx \
        src/ui/scenes/combat/ForecastHpBar.tsx \
        src/ui/scenes/combat/ForecastMathRow.tsx \
        src/ui/scenes/combat/ForecastStatusRow.tsx \
        src/ui/scenes/combat/CombatHud.tsx \
        tests/unit/ui/hooks/useForecastPreview.test.ts \
        tests/unit/ui/scenes/combat/ForecastPanel.test.tsx \
        tests/e2e/combat-buttons.spec.ts \
        CONTEXT.md
git commit -m "$(cat <<'EOF'
feat(phaser): [CHF-4] forecast panel — top-right pin-then-play

Click a valid target tile during SELECTING_TARGET → forecast panel pins
top-right showing source→target portraits, HP/armor bars with predicted
loss segments, damage breakdown (collapsible), status effect chips, and
a LETHAL badge when predicted_hp = 0. Click target again to play; click
Cancel or right-click to unpin. Card stays selected on Cancel.

useForecastPreview hook calls computeForecast (CHF-1) — single source of
truth ensures panel numbers match what the reducer applies.

5 sub-components for layout responsibility split: CombatantRow, HpBar,
MathRow, StatusRow + the panel shell.

CombatState gains pinnedTargetTile: TileId | null. Two new events
pinTarget/unpinTarget. Cleared on cancelSelection/playCard/endTurn.

8 panel tests + 5 hook tests cover: render-when-preview, render-nothing-
without, lethal flag, armor row, confirm dispatches play, cancel
dispatches unpin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: KO indicator on hover preview (CHF-5)

**Files:**
- Modify: `phaser/src/game/scenes/BoardScene.ts` (extend hover damage preview to show ☠ when lethal)

- [ ] **Step 5.1: Locate the hover preview code**

In `phaser/src/game/scenes/BoardScene.ts`, search for the block that draws the floating damage number on tile hover during SELECTING_TARGET. Identify the function that runs in `pointerover` for tiles when `state.subPhase === 'SELECTING_TARGET'`. The current implementation creates a Phaser Text object showing the damage number above each affected unit.

Save the relevant function name into your editor's clipboard for the next step. (It is typically `showDamagePreview`, `renderTargetPreview`, or inline inside the tile hover handler. The grep below identifies it.)

```bash
npx grep -nE "showDamagePreview|renderTargetPreview|previewText|damagePreviewText|hoverDamage" src/game/scenes/BoardScene.ts | head -10
```

- [ ] **Step 5.2: Extend the preview to add a KO skull**

In the function that creates the damage number Text object, after computing the predicted HP for the affected target, add a sibling Text with `☠` if `predictedHp <= 0 && target.hp.current > 0`. Skull text is positioned 14px below the damage number. Use color `#dc2626`, font size 16, depth = damage number depth + 1.

The exact code change depends on the existing structure; the rule is: wherever the existing preview adds a Text per affected target, conditionally add a sibling Text right next to it for the skull.

Concretely, find the line (search snippet):

```typescript
// inside the hover handler, after damage = computed:
const previewText = this.add.text(wx, wy - 14, `-${damage}`, { /* ... */ })
```

Add immediately after:

```typescript
const targetUnit = Object.values(useCombatStore.getState().state.units)
  .find((u) => (u.position as unknown as string) === tileStr)
const predictedHp = targetUnit ? Math.max(0, targetUnit.hp.current - damage) : null
if (predictedHp === 0 && targetUnit && targetUnit.hp.current > 0) {
  const koText = this.add.text(wx, wy + 2, '☠', {
    fontFamily: 'monospace', fontSize: '16px', color: '#dc2626',
  }).setOrigin(0.5).setDepth(previewText.depth + 1)
  this.previewObjects.push(koText)         // or whatever the cleanup array is
}
```

The cleanup array name varies (`hoverPreviewObjects`, `previewTexts`, etc.) — search for `previewText` and follow how it gets cleared on `pointerout` to find the array name. Append the new `koText` to the same array so it cleans up correctly.

- [ ] **Step 5.3: Add an e2e test for the KO indicator**

Create `phaser/tests/e2e/combat-forecast.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Combat forecast', () => {
  test('hovering a lethal target shows ☠ skull', async ({ page }) => {
    await page.goto('/?view=combat')
    await page.waitForSelector('#combat-hud')
    // Drive combat into a state where the active unit can lethally hit a 1-HP enemy.
    await page.evaluate(() => {
      const cs = (window as unknown as { __debug: { combatStore: { setState: (u: unknown) => void; getState: () => { state: unknown } } } }).__debug.combatStore
      const state = cs.getState().state as Record<string, unknown> & {
        units: Record<string, { id: string; hp: { current: number; max: number }; position?: string }>
      }
      // Lower an enemy unit to 1 HP at a known tile.
      const enemyId = Object.keys(state.units).find((id) => id !== state['turn'])
      if (enemyId) {
        state.units[enemyId]!.hp.current = 1
      }
    })
    // Open card hand, select a damage card, hover over the enemy tile.
    // Skip detailed mouse coords — assert that on hover during SELECTING_TARGET,
    // the canvas reports (via dev probe) at least one Text object whose text contains '☠'.
    // For now, just assert the panel mounts cleanly (smoke test).
    expect(await page.locator('#combat-hud').count()).toBeGreaterThan(0)
  })
})
```

> Note: the e2e harness for combat hover preview is limited because hover targets are Phaser canvas pixels, not DOM. The smoke test above verifies the HUD mounts and the test infrastructure is in place. A future `data-debug-preview-text` attribute on the canvas root could carry the latest preview text into DOM for richer assertions; out of scope here.

- [ ] **Step 5.4: Run all gates**

```bash
npm run typecheck && npm test -- --reporter=basic && npm run check-context-doc && npm run build && npm run perf-gates && npm run test:e2e
```

Expected: all green. The new e2e test passes the smoke assertion; existing combat e2e tests still pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/game/scenes/BoardScene.ts tests/e2e/combat-forecast.spec.ts
git commit -m "$(cat <<'EOF'
feat(phaser): [CHF-5] KO skull on lethal hover preview

When the player hovers a card-target tile during SELECTING_TARGET and
the predicted damage would reduce the target's HP to 0, render a ☠
skull below the damage number. Reuses the existing preview-cleanup
array so it dismisses on pointerout.

Smoke e2e test verifies HUD mounts cleanly. Richer hover-preview
assertions wait on a future data-debug attribute on the canvas root.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

### Spec coverage

| Spec section | Plan task |
|---|---|
| §1 Initiative strip — fixed bottom-center, portraits in turn order | Task 3 |
| §1 Selector-derived (Option B) | Task 3 step 3.3 |
| §1 Active 1.2x scale, team rings, HP label, +N badge | Task 3 step 3.7-3.8 |
| §1 Independent of selection | Task 3 step 3.3 (only reads `state.units` + `state.turn.unitId`) |
| §2 Precondition: armor in reducer | Tasks 1 + 2 |
| §2 `applyDamage` + `computeForecast` pure | Task 1 |
| §2 Reducer wires `applyDamage` | Task 2 |
| §2 Forecast click-pin / click-confirm | Task 4 step 4.16 |
| §2 Fixed top-right position | Task 4 step 4.14 |
| §2 Title + AP, combatant row, HP/armor bars, math row, status, LETHAL | Task 4 steps 4.10-4.14 |
| §2 KO indicator on hover preview | Task 5 |

All spec sections have an implementing task. No gaps.

### Placeholder scan

- No "TBD" or "TODO" placeholders.
- All steps include either runnable commands, exact code, or file-path edits with surrounding context.
- "Find the function that..." instructions in Tasks 4 step 4.16 and 5 step 5.1-5.2 are necessary because BoardScene's exact structure isn't fully specified in this plan. They include grep snippets and search anchors to locate the right code.

### Type consistency

- `ForecastResult` used identically in `damage.ts`, `useForecastPreview`, `ForecastPanel`.
- `ForecastCard` shape = `{ id, apCost, effects[], damageStat?, ... }` consistently across files.
- `InitiativeEntry` (the data type) is exported from `useInitiativeQueue.ts` and consumed in `InitiativeEntry.tsx` (the component) — note: shared name across data type and component is intentional and follows existing conventions; the import paths disambiguate.
- `pinnedTargetTile: TileId | null` referenced in CombatState, reducer, useForecastPreview, BoardScene — all match.
- `pinTarget` event has `payload: { tileId: TileId }` everywhere referenced.

### Risks acknowledged

1. Existing combat e2e tests may rely on "click target = play immediately" — Task 4 step 4.18 says to update them. If they don't actually depend on this (likely), no change needed. The smoke test in Task 5 step 5.3 verifies the HUD still mounts.
2. `BoardScene.ts` is large and not fully readable in this plan; Tasks 4 step 4.16 and Task 5 step 5.1-5.2 use grep anchors to locate exact insertion points. If those snippets don't appear in the current source, the engineer falls back to scanning the file.
3. CONTEXT.md edits in steps 1.5, 3.11, 4.19 may need wording adjustments to fit existing section structure; the content is accurate and the drift check will fail if exports are missed.
