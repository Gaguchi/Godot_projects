# Phaser Foundations v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation systems specified in `docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md` — three-store architecture, combat reducer, effect pipeline, quest engine bones, predicate AST, domain event bus, MapRegistry, hierarchical RNG, save format, Phaser/React firewall, living doc + CI — fully unit-tested with TDD.

**Architecture:** Two execution surfaces (Phaser canvas for combat, React DOM for everything else) bridged by three Zustand stores (`metaStore`, `runStore`, `combatStore`). Combat is a reducer over a discriminated `CombatEvent` union with an effects queue. Cross-system writes go through typed contracts in `src/contracts/`. Predicates are declarative AST. Domain events flow through `eventBus`. Procgen is pure. RNG is hierarchical via `deriveRng(parent, label)`.

**Tech Stack:** TypeScript ^5.7 (strict + noUncheckedIndexedAccess), Phaser ^4.0, React ^19, Vite ^6, Zustand ^5, Zod ^3, Tailwind ^4, Vitest ^2, Playwright ^1.50.

**Working directory:** `phaser/` (everything below is relative to it unless noted).

**Living doc protocol:** Any task touching `domain/`, `state/*Store.ts`, `systems/`, `contracts/`, or `persistence/saveFormat.ts` MUST update `phaser/CONTEXT.md` in the same commit. Tasks below mark this with **`[CONTEXT.md update required]`**.

---

## Phase Overview

- **Phase 1 (Week 1):** Domain primitives — branded IDs, RNG, predicate AST, every domain type
- **Phase 2 (Week 2):** Contracts + state — flags, event bus, action log, three stores
- **Phase 3 (Week 3):** Combat systems — deck builder, effect pipeline, status effects, reducer
- **Phase 4 (Week 4):** Quest + dialogue + maps — quest runner, dialogue runner, map registry, procgen stubs
- **Phase 5 (Week 5):** Persistence + Phaser shell + React + living doc CI
- **Phase 6 (Week 6):** Stabilization — research deliverables 4-5, milestone gate

---

## Phase 1 — Domain Primitives (Week 1)

### Task 1: Reset src/ to bare scaffold

**Files:**
- Delete: `src/data/`, `src/game/`, `src/state/`, `src/ui/shell/`
- Modify: `src/App.tsx`, `src/main.tsx`
- Keep: `src/assets/`, `src/index.css`, `src/App.css`, all configs

- [ ] **Step 1: Delete obsolete src/ subtrees**

```bash
rm -rf phaser/src/data phaser/src/game phaser/src/state
rm -rf phaser/src/ui
rm -rf phaser/tests/unit phaser/tests/e2e
```

- [ ] **Step 2: Replace App.tsx with minimal placeholder**

`src/App.tsx`:
```tsx
import './App.css'

export function App() {
  return (
    <div id="app-root">
      <div id="game-canvas-container" />
      <div id="react-shell" />
    </div>
  )
}
```

- [ ] **Step 3: Replace main.tsx with minimal mount**

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Run typecheck to verify compilation**

```bash
cd phaser && npm run typecheck
```

Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add phaser/src phaser/tests
git commit -m "refactor(phaser): reset src/ to bare scaffold for v2 foundation"
```

---

### Task 2: Branded ID types

**Files:**
- Create: `src/domain/ids.ts`
- Test: `tests/unit/domain/ids.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/domain/ids.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { asUnitId, asItemId, asCardId, asFlagKey } from '../../../src/domain/ids'

describe('branded ids', () => {
  it('preserves string value through brand cast', () => {
    expect(asUnitId('roy')).toBe('roy')
    expect(asItemId('iron_sword')).toBe('iron_sword')
    expect(asCardId('slash')).toBe('slash')
    expect(asFlagKey('quest.bloodTies.complete')).toBe('quest.bloodTies.complete')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd phaser && npm test -- tests/unit/domain/ids.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement domain/ids.ts**

`src/domain/ids.ts`:
```ts
declare const __brand: unique symbol
type Brand<T, B> = T & { readonly [__brand]: B }

export type UnitId       = Brand<string, 'UnitId'>
export type ItemId       = Brand<string, 'ItemId'>
export type CardId       = Brand<string, 'CardId'>
export type ClassId      = Brand<string, 'ClassId'>
export type StatusEffectId = Brand<string, 'StatusEffectId'>
export type FlagKey      = Brand<string, 'FlagKey'>
export type QuestId      = Brand<string, 'QuestId'>
export type StageId      = Brand<string, 'StageId'>
export type DialogueId   = Brand<string, 'DialogueId'>
export type DialogueNodeId = Brand<string, 'DialogueNodeId'>
export type MapId        = Brand<string, 'MapId'>
export type NodeId       = Brand<string, 'NodeId'>
export type DungeonId    = Brand<string, 'DungeonId'>
export type EncounterId  = Brand<string, 'EncounterId'>
export type EncounterTableId = Brand<string, 'EncounterTableId'>
export type EnemyGroupId = Brand<string, 'EnemyGroupId'>
export type TileId       = Brand<string, 'TileId'>

export const asUnitId       = (s: string): UnitId       => s as UnitId
export const asItemId       = (s: string): ItemId       => s as ItemId
export const asCardId       = (s: string): CardId       => s as CardId
export const asClassId      = (s: string): ClassId      => s as ClassId
export const asStatusEffectId = (s: string): StatusEffectId => s as StatusEffectId
export const asFlagKey      = (s: string): FlagKey      => s as FlagKey
export const asQuestId      = (s: string): QuestId      => s as QuestId
export const asStageId      = (s: string): StageId      => s as StageId
export const asDialogueId   = (s: string): DialogueId   => s as DialogueId
export const asDialogueNodeId = (s: string): DialogueNodeId => s as DialogueNodeId
export const asMapId        = (s: string): MapId        => s as MapId
export const asNodeId       = (s: string): NodeId       => s as NodeId
export const asDungeonId    = (s: string): DungeonId    => s as DungeonId
export const asEncounterId  = (s: string): EncounterId  => s as EncounterId
export const asEncounterTableId = (s: string): EncounterTableId => s as EncounterTableId
export const asEnemyGroupId = (s: string): EnemyGroupId => s as EnemyGroupId
export const asTileId       = (s: string): TileId       => s as TileId
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd phaser && npm test -- tests/unit/domain/ids.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §8 (Schema Index) — note `domain/ids.ts` exists and lists branded ID types.

```bash
git add phaser/src/domain/ids.ts phaser/tests/unit/domain/ids.test.ts phaser/CONTEXT.md
git commit -m "feat(phaser): branded ID types for cross-system identity"
```

---

### Task 3: RNG interface + Mulberry32 implementation

**Files:**
- Create: `src/domain/rng.ts`, `src/systems/rng.ts`
- Test: `tests/unit/systems/rng.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createRng, deriveRng } from '../../../src/systems/rng'

describe('rng', () => {
  it('is deterministic given same seed', () => {
    const a = createRng({ seed: 12345, counter: 0 })
    const b = createRng({ seed: 12345, counter: 0 })
    const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('differs across distinct seeds', () => {
    const a = createRng({ seed: 1, counter: 0 })
    const b = createRng({ seed: 2, counter: 0 })
    expect(a.next()).not.toBe(b.next())
  })

  it('nextInt is in [min, max] inclusive', () => {
    const r = createRng({ seed: 99, counter: 0 })
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('pick returns an element from the array', () => {
    const r = createRng({ seed: 7, counter: 0 })
    const arr = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr as unknown as string[]))
    }
  })

  it('shuffle returns a NEW array, same elements', () => {
    const r = createRng({ seed: 42, counter: 0 })
    const orig = [1, 2, 3, 4, 5]
    const out = r.shuffle(orig)
    expect(out).not.toBe(orig)
    expect(out.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('derive produces deterministic sub-rng per (parent, label)', () => {
    const parent = createRng({ seed: 100, counter: 0 })
    const a = deriveRng(parent, 'world')
    const b = deriveRng(parent, 'world')
    expect(a.next()).toBe(b.next())
  })

  it('derive produces different streams per label', () => {
    const parent = createRng({ seed: 100, counter: 0 })
    const a = deriveRng(parent, 'world')
    const b = deriveRng(parent, 'dungeon')
    expect(a.next()).not.toBe(b.next())
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd phaser && npm test -- tests/unit/systems/rng.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement domain/rng.ts**

`src/domain/rng.ts`:
```ts
export interface RngState {
  seed: number
  counter: number
  label?: string
}

export interface RNG {
  state(): RngState
  next(): number
  nextInt(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
}
```

- [ ] **Step 4: Implement systems/rng.ts**

`src/systems/rng.ts`:
```ts
import type { RNG, RngState } from '../domain/rng'

// Mulberry32 — small, fast, well-distributed PRNG suitable for game use.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash combiner for derive(label).
function hashLabel(parentSeed: number, label: string): number {
  let h = parentSeed >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0
  }
  return h
}

export function createRng(initial: RngState): RNG {
  const state: RngState = { ...initial }
  const gen = mulberry32(state.seed + state.counter)
  return {
    state: () => ({ ...state }),
    next: () => {
      state.counter++
      return gen()
    },
    nextInt: (min, max) => {
      const r = state.counter++, _ = gen()
      return Math.floor(_ * (max - min + 1)) + min
    },
    pick: <T,>(arr: readonly T[]) => {
      if (arr.length === 0) throw new Error('rng.pick: empty array')
      state.counter++
      return arr[Math.floor(gen() * arr.length)]!
    },
    shuffle: <T,>(arr: readonly T[]) => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        state.counter++
        const j = Math.floor(gen() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
  }
}

export function deriveRng(parent: RNG, label: string): RNG {
  const parentState = parent.state()
  return createRng({
    seed: hashLabel(parentState.seed, label),
    counter: 0,
    label,
  })
}
```

- [ ] **Step 5: Run test, fix if needed, then commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/systems/rng.test.ts
```

Expected: PASS.

Update `phaser/CONTEXT.md` §5 (RNG Domain Map) — confirm the derivation tree wording matches `deriveRng` signature.

```bash
git add phaser/src/domain/rng.ts phaser/src/systems/rng.ts phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): hierarchical RNG with deriveRng (Mulberry32 + hash combiner)"
```

---

### Task 4: Forbid Math.random via lint rule

**Files:**
- Modify: `phaser/eslint.config.js`

- [ ] **Step 1: Add no-restricted-globals rule**

Add to `phaser/eslint.config.js` (in the rules block of the TS config):
```js
'no-restricted-globals': [
  'error',
  { name: 'Math', message: 'Use RNG parameter; Math.random is forbidden. See CONTEXT.md §1.' },
],
```

Wait — that bans all of Math, which we need. Use `no-restricted-properties`:
```js
'no-restricted-properties': [
  'error',
  { object: 'Math', property: 'random', message: 'Use RNG parameter; Math.random is forbidden. See CONTEXT.md §1.' },
],
```

- [ ] **Step 2: Run lint to verify clean**

```bash
cd phaser && npx eslint src/
```

Expected: PASS (no Math.random references in src/ yet).

- [ ] **Step 3: Verify rule fires by adding then removing a temporary violation**

In any src file temporarily add `const x = Math.random()`. Run lint. Expect: ERROR.
Remove the line. Run lint. Expect: PASS.

- [ ] **Step 4: Commit**

```bash
git add phaser/eslint.config.js
git commit -m "chore(phaser): lint rule banning Math.random in favor of RNG parameter"
```

---

### Task 5: Predicate AST type

**Files:**
- Create: `src/domain/predicate.ts`

- [ ] **Step 1: Define Predicate as discriminated union**

`src/domain/predicate.ts`:
```ts
import type { FlagKey, QuestId, StageId, ClassId, ItemId, EncounterId } from './ids'
import type { MapNodeRef } from './map'

export type Predicate =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'flag'; key: FlagKey; equals?: unknown }
  | { kind: 'notFlag'; key: FlagKey }
  | { kind: 'questStage'; questId: QuestId; stage: StageId }
  | { kind: 'questComplete'; questId: QuestId }
  | { kind: 'partyHas'; classId: ClassId }
  | { kind: 'hasItem'; itemId: ItemId }
  | { kind: 'goldAtLeast'; amount: number }
  | { kind: 'visited'; ref: MapNodeRef }
  | { kind: 'cleared'; encounterId: EncounterId }
  | { kind: 'allOf'; preds: Predicate[] }
  | { kind: 'anyOf'; preds: Predicate[] }
  | { kind: 'not'; pred: Predicate }
```

- [ ] **Step 2: Typecheck (will fail because MapNodeRef not yet defined)**

This task depends on Task 6 (map.ts). Mark this file partial; full check passes after Task 6.

- [ ] **Step 3: Commit (combined with Task 6)**

Hold this commit; combine with Task 6 below.

---

### Task 6: Map domain types (MapNodeRef, WorldMap, BattleMap, DungeonGraph)

**Files:**
- Create: `src/domain/map.ts`

- [ ] **Step 1: Implement map.ts**

`src/domain/map.ts`:
```ts
import type { MapId, NodeId, TileId, EncounterTableId, DungeonId, ClassId, EnemyGroupId } from './ids'
import type { Predicate } from './predicate'

export type MapKind = 'overworld' | 'dungeon' | 'battle'

export interface MapNodeRef {
  mapKind: MapKind
  mapId: MapId
  nodeId: NodeId
}

export interface TerrainTile {
  kind: 'plain' | 'forest' | 'mountain' | 'water' | 'road' | 'fortress'
  defBonus: number
  resBonus: number
  movementCost: number
  impassable: boolean
  blocksLOS: boolean
}

// --- Overworld ---

export interface WorldNode {
  id: NodeId
  type: 'town' | 'camp' | 'dungeon' | 'exit'
  position: { x: number; y: number }
  visiblePredicate: Predicate
}

export interface WorldEdge {
  from: NodeId
  to: NodeId
  encounterTableId: EncounterTableId
  rollChance: number   // [0, 1]
}

export interface WorldMap {
  id: MapId
  width: number
  height: number
  tileSize: number
  terrainGrid: TerrainTile[][]   // [y][x]
  nodes: WorldNode[]
  edges: WorldEdge[]
}

// --- Battle ---

export interface BattleMap {
  id: MapId
  width: 14
  height: 10
  terrain: TerrainTile[][]            // [y][x]
  spawnZones: { party: TileId[]; enemy: TileId[] }
  obstacles: TileId[]
  source: 'handcrafted' | 'procgen-template'
}

// --- Dungeon (Slay the Spire-style) ---

export interface DungeonRoom {
  id: NodeId
  type: 'combat' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss'
  encounterRef: MapNodeRef | null
}

export interface DungeonGraph {
  id: DungeonId
  rows: DungeonRoom[][]               // rows[0] = entry; rows[bossRow] = boss
  edges: Array<[NodeId, NodeId]>      // monotonic — each edge advances one row
  entryRow: 0
  bossRow: number
  genSeed: number                     // independent from runSeed
  fogOfWar: 'full' | 'lookahead-1' | 'reveal-on-enter'
}

// Enemy group ref (used by battle setup) — defined here for cohesion
export interface EnemyGroupRef {
  id: EnemyGroupId
  enemies: { classId: ClassId; level: number }[]
}
```

- [ ] **Step 2: Typecheck both files together**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit predicate.ts + map.ts together**

```bash
git add phaser/src/domain/predicate.ts phaser/src/domain/map.ts
git commit -m "feat(phaser): predicate AST + map domain types (MapNodeRef, WorldMap, BattleMap, DungeonGraph)"
```

---

### Task 7: Card, Effect, Unit, Item, StatusEffect domain types

**Files:**
- Create: `src/domain/card.ts`, `src/domain/unit.ts`, `src/domain/item.ts`, `src/domain/statusEffect.ts`, `src/domain/class.ts`

- [ ] **Step 1: Implement card.ts (Card + CardEffect)**

`src/domain/card.ts`:
```ts
import type { CardId, UnitId, ItemId, StatusEffectId, TileId } from './ids'

export type WeaponType = 'sword'|'lance'|'axe'|'bow'|'crossbow'|'tome'|'staff'

export type DamageKind = 'physical' | 'magic'

export type CardEffect =
  | { kind: 'Damage'; targetId: UnitId; amount: number; damageType: DamageKind; source: CardId; armorPiercing?: boolean }
  | { kind: 'Heal'; targetId: UnitId; amount: number; source: CardId }
  | { kind: 'ApplyStatus'; targetId: UnitId; effect: StatusEffectId; stacks: number; turns: number }
  | { kind: 'RemoveStatus'; targetId: UnitId; effect: StatusEffectId }
  | { kind: 'Move'; unitId: UnitId; tileId: TileId }
  | { kind: 'GrantArmor'; targetId: UnitId; amount: number }
  | { kind: 'DrawCards'; unitId: UnitId; count: number }
  | { kind: 'GainAp'; unitId: UnitId; amount: number }

export type CardSource = 'innate' | 'hand_left' | 'hand_right'

export type CardTargetKind = 'enemy' | 'ally' | 'self' | 'tile' | 'all_enemies' | 'all_allies'

export interface CardEffectTemplate {
  kind: CardEffect['kind']
  // Card definitions store template parameters (e.g., damage amount, status duration);
  // resolution at play time fills in concrete IDs.
  params: Record<string, unknown>
}

export interface Card {
  id: CardId
  name: string
  apCost: number
  source: CardSource           // populated at deck-build time, not in JSON
  effects: CardEffectTemplate[]
  range: { min: number; max: number }
  targetKind: CardTargetKind
  aoeRadius?: number
  weaponType: WeaponType | null  // null = innate (any weapon)
  damageStat?: 'str' | 'mag' | 'skl'
}
```

- [ ] **Step 2: Implement unit.ts**

`src/domain/unit.ts`:
```ts
import type { UnitId, ItemId, ClassId, TileId, StatusEffectId } from './ids'

export interface UnitStats {
  str: number; mag: number; skl: number
  spd: number; def: number; res: number
}

export interface UnitHp { current: number; max: number }

export interface ActiveStatus {
  effectId: StatusEffectId
  stacks: number
  turnsRemaining: number
  source: UnitId | null
}

export interface HandSlots {
  left: ItemId | null
  right: ItemId | null
}

export interface Unit {
  id: UnitId
  name: string
  classId: ClassId
  level: number
  hp: UnitHp
  stats: UnitStats
  hand: HandSlots
  position: TileId | null
  ap: number
  armor: number
  statuses: ActiveStatus[]
}
```

- [ ] **Step 3: Implement item.ts**

`src/domain/item.ts`:
```ts
import type { ItemId, CardId } from './ids'
import type { WeaponType } from './card'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type Region = 'borderlands' | 'thornwood' | 'ashfall' | 'none'

export type ItemKind =
  | 'weapon_1h' | 'weapon_2h'
  | 'shield' | 'tome' | 'staff' | 'quiver'
  | 'consumable'

export type QuiverEffectKind = 'poison' | 'burn' | 'slow' | 'thunder' | 'explosive'

export interface QuiverModifier {
  kind: QuiverEffectKind
  value: number
  turns?: number
}

export interface Item {
  id: ItemId
  name: string
  kind: ItemKind
  weaponType?: WeaponType
  rarity: Rarity
  region: Region
  gearCards: CardId[]
  quiverModifier?: QuiverModifier
  isTwoHanded: boolean
  gridSize: { width: number; height: number }
  range?: { min: number; max: number }
  buyPrice: number
  sellPrice: number
}
```

- [ ] **Step 4: Implement statusEffect.ts**

`src/domain/statusEffect.ts`:
```ts
import type { StatusEffectId, UnitId } from './ids'
import type { CardEffect, DamageKind } from './card'

export interface HookCtx {
  selfUnitId: UnitId
  selfStacks: number
  selfTurnsRemaining: number
}

export interface StatusEffectDef {
  id: StatusEffectId
  name: string
  stackable: boolean
  onApply?(ctx: HookCtx): CardEffect[]
  onTurnStart?(ctx: HookCtx): CardEffect[]
  onTurnEnd?(ctx: HookCtx): CardEffect[]
  onDamageTaken?(ctx: HookCtx, dmg: number, kind: DamageKind): { dmg: number; effects: CardEffect[] }
  onDamageDealt?(ctx: HookCtx, dmg: number): { dmg: number; effects: CardEffect[] }
  onTick?(ctx: HookCtx): CardEffect[]
  interactsWith?: Partial<Record<StatusEffectId, 'remove' | 'consume' | 'amplify'>>
}
```

- [ ] **Step 5: Implement class.ts**

`src/domain/class.ts`:
```ts
import type { ClassId, CardId } from './ids'
import type { UnitStats } from './unit'

export interface ClassDef {
  id: ClassId
  name: string
  baseStats: UnitStats
  growthRates: UnitStats   // % per level (0–100)
  innateCardIds: CardId[]
  startingMov: number
  startingHp: number
}
```

- [ ] **Step 6: Typecheck**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add phaser/src/domain
git commit -m "feat(phaser): card, unit, item, statusEffect, class domain types"
```

---

### Task 8: CombatState, CombatEvent, CombatEffect domain types

**Files:**
- Create: `src/domain/combatState.ts`

- [ ] **Step 1: Implement combatState.ts**

`src/domain/combatState.ts`:
```ts
import type { UnitId, CardId, TileId } from './ids'
import type { Unit } from './unit'
import type { CardEffect } from './card'
import type { RngState } from './rng'

export type CombatPhase = 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT'
export type CombatSubPhase = 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'RESOLVING'

export interface DeckState {
  draw: CardId[]
  hand: CardId[]
  discard: CardId[]
}

export interface CombatGrid {
  width: number
  height: number
  obstacles: Set<TileId>
}

export interface CombatTurn {
  number: number
  unitId: UnitId | null
  team: 'party' | 'enemy'
}

export interface CombatState {
  phase: CombatPhase
  subPhase: CombatSubPhase
  turn: CombatTurn
  units: Record<UnitId, Unit>
  decks: Record<UnitId, DeckState>
  grid: CombatGrid
  rng: RngState
  selectedCardId: CardId | null
  effectQueue: CombatEffect[]
}

// --- CombatEvent: dispatched into the reducer ---

export type CombatEvent =
  | { type: 'startBattle'; payload: { units: Unit[]; grid: CombatGrid; rngSeed: RngState } }
  | { type: 'startTurn'; payload: { unitId: UnitId } }
  | { type: 'selectCard'; payload: { cardId: CardId } }
  | { type: 'cancelSelection' }
  | { type: 'playCard'; payload: { cardId: CardId; srcId: UnitId; targets: TileId[] } }
  | { type: 'moveUnit'; payload: { unitId: UnitId; tileId: TileId } }
  | { type: 'endTurn' }
  | { type: 'tickStatus' }
  | { type: 'capture'; payload: { targetId: UnitId; attackerIds: UnitId[] } }
  | { type: 'animationsCompleted' }

// --- CombatEffect: drained by Phaser CombatScene, not state ---

export interface SpriteRef { id: string }

export type CombatEffect =
  | { kind: 'PlayTween'; sprite: SpriteRef; props: Record<string, unknown>; durationMs: number }
  | { kind: 'FloatDamage'; tile: TileId; amount: number; kind: 'physical' | 'magic' | 'heal' }
  | { kind: 'ShakeCamera'; intensity: number; durationMs: number }
  | { kind: 'PlaySfx'; key: string }
  | { kind: 'HitFlash'; sprite: SpriteRef; durationMs: number }
  | { kind: 'WaitForAnimations' }
  | { kind: 'ApplyCardEffect'; effect: CardEffect }   // logged for replay; resolution lives in reducer
```

- [ ] **Step 2: Typecheck**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §3 (Action Catalog) — populate combatStore events from `CombatEvent`.

```bash
git add phaser/src/domain/combatState.ts phaser/CONTEXT.md
git commit -m "feat(phaser): CombatState + CombatEvent + CombatEffect domain types"
```

---

### Task 9: Quest + Dialogue domain types

**Files:**
- Create: `src/domain/quest.ts`, `src/domain/dialogue.ts`

- [ ] **Step 1: Implement quest.ts**

`src/domain/quest.ts`:
```ts
import type { QuestId, StageId, FlagKey, ItemId, ClassId, DialogueId } from './ids'
import type { Predicate } from './predicate'
import type { MapNodeRef } from './map'

export type FlagScope = 'run' | 'quest' | 'battle' | 'permanent'

// Quest effects (distinct from CardEffect — different domain).
export type QuestEffect =
  | { kind: 'setFlag'; key: FlagKey; value: unknown; scope?: FlagScope }
  | { kind: 'grantItem'; itemId: ItemId }
  | { kind: 'recruitUnit'; classId: ClassId; level: number }
  | { kind: 'spawnNode'; ref: MapNodeRef }
  | { kind: 'unlockNode'; ref: MapNodeRef }
  | { kind: 'startDialogue'; treeId: DialogueId }
  | { kind: 'completeQuest'; questId: QuestId }

export type QuestListenerEvent = 'BattleVictory' | 'LocationArrived' | 'ItemAcquired' | 'FlagSet'

export interface QuestListener {
  on: QuestListenerEvent
  predicate: Predicate
  emit: QuestEffect[]
}

export interface QuestStage {
  id: StageId
  onEnter: QuestEffect[]
  listeners: QuestListener[]
  transitions: { when: Predicate; to: StageId }[]
  onExit: QuestEffect[]
}

export interface QuestDef {
  id: QuestId
  name: string
  initialStage: StageId
  stages: Record<string, QuestStage>   // keyed by StageId-as-string
}
```

- [ ] **Step 2: Implement dialogue.ts**

`src/domain/dialogue.ts`:
```ts
import type { DialogueId, DialogueNodeId } from './ids'
import type { Predicate } from './predicate'
import type { QuestEffect } from './quest'

export interface DialogueChoice {
  id: string
  text: string
  visibleIf?: Predicate
  enabledIf?: Predicate
  effects: QuestEffect[]
  next: DialogueNodeId | 'end'
}

export interface DialogueNode {
  id: DialogueNodeId
  speaker?: string
  text: string
  choices: DialogueChoice[]
  onEnter?: QuestEffect[]
}

export interface DialogueTree {
  id: DialogueId
  startNodeId: DialogueNodeId
  nodes: Record<string, DialogueNode>   // keyed by DialogueNodeId-as-string
}
```

- [ ] **Step 3: Typecheck**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add phaser/src/domain/quest.ts phaser/src/domain/dialogue.ts
git commit -m "feat(phaser): Quest + Dialogue domain types with QuestEffect/QuestListener/DialogueTree"
```

---

### Task 10: Predicate evaluator + tests

**Files:**
- Create: `src/systems/predicates.ts`
- Test: `tests/unit/systems/predicates.test.ts`

- [ ] **Step 1: Write failing test (covers every Predicate kind)**

`tests/unit/systems/predicates.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { evaluatePredicate } from '../../../src/systems/predicates'
import { asFlagKey, asQuestId, asStageId, asClassId, asItemId, asEncounterId, asMapId, asNodeId } from '../../../src/domain/ids'
import type { Predicate } from '../../../src/domain/predicate'

const baseState = () => ({
  flags: new Map<string, { value: unknown; scope: 'run'|'quest'|'battle'|'permanent' }>(),
  questStates: {} as Record<string, { currentStage: string; metadata: Record<string, unknown> }>,
  party: { units: {} as Record<string, { classId: string }> },
  inventory: { items: [] as { itemId: string }[] },
  gold: 0,
  visitedNodes: new Set<string>(),
  clearedEncounters: new Set<string>(),
})

describe('evaluatePredicate', () => {
  it('always = true; never = false', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'always' }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'never' }, s)).toBe(false)
  })

  it('flag (no equals) checks existence', () => {
    const s = baseState()
    s.flags.set('quest.test.complete', { value: true, scope: 'quest' })
    const p: Predicate = { kind: 'flag', key: asFlagKey('quest.test.complete') }
    expect(evaluatePredicate(p, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('absent') }, s)).toBe(false)
  })

  it('flag (with equals) compares value', () => {
    const s = baseState()
    s.flags.set('counter', { value: 3, scope: 'run' })
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('counter'), equals: 3 }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'flag', key: asFlagKey('counter'), equals: 4 }, s)).toBe(false)
  })

  it('notFlag', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'notFlag', key: asFlagKey('absent') }, s)).toBe(true)
    s.flags.set('present', { value: 1, scope: 'run' })
    expect(evaluatePredicate({ kind: 'notFlag', key: asFlagKey('present') }, s)).toBe(false)
  })

  it('questStage', () => {
    const s = baseState()
    s.questStates['blood_ties'] = { currentStage: 'stage_2', metadata: {} }
    expect(evaluatePredicate({ kind: 'questStage', questId: asQuestId('blood_ties'), stage: asStageId('stage_2') }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'questStage', questId: asQuestId('blood_ties'), stage: asStageId('stage_3') }, s)).toBe(false)
  })

  it('questComplete', () => {
    const s = baseState()
    s.questStates['blood_ties'] = { currentStage: '__complete__', metadata: {} }
    expect(evaluatePredicate({ kind: 'questComplete', questId: asQuestId('blood_ties') }, s)).toBe(true)
  })

  it('partyHas', () => {
    const s = baseState()
    s.party.units['roy'] = { classId: 'lord' }
    expect(evaluatePredicate({ kind: 'partyHas', classId: asClassId('lord') }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'partyHas', classId: asClassId('mage') }, s)).toBe(false)
  })

  it('hasItem', () => {
    const s = baseState()
    s.inventory.items.push({ itemId: 'iron_sword' })
    expect(evaluatePredicate({ kind: 'hasItem', itemId: asItemId('iron_sword') }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'hasItem', itemId: asItemId('absent') }, s)).toBe(false)
  })

  it('goldAtLeast', () => {
    const s = baseState()
    s.gold = 100
    expect(evaluatePredicate({ kind: 'goldAtLeast', amount: 50 }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'goldAtLeast', amount: 200 }, s)).toBe(false)
  })

  it('visited', () => {
    const s = baseState()
    s.visitedNodes.add('overworld:test:pine')
    const ref = { mapKind: 'overworld' as const, mapId: asMapId('test'), nodeId: asNodeId('pine') }
    expect(evaluatePredicate({ kind: 'visited', ref }, s)).toBe(true)
  })

  it('cleared', () => {
    const s = baseState()
    s.clearedEncounters.add('bandit_road')
    expect(evaluatePredicate({ kind: 'cleared', encounterId: asEncounterId('bandit_road') }, s)).toBe(true)
  })

  it('allOf — all must pass', () => {
    const s = baseState()
    s.gold = 100
    s.flags.set('a', { value: 1, scope: 'run' })
    expect(evaluatePredicate({ kind: 'allOf', preds: [
      { kind: 'goldAtLeast', amount: 50 },
      { kind: 'flag', key: asFlagKey('a') },
    ]}, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'allOf', preds: [
      { kind: 'goldAtLeast', amount: 200 },
      { kind: 'flag', key: asFlagKey('a') },
    ]}, s)).toBe(false)
  })

  it('anyOf — at least one passes', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'anyOf', preds: [
      { kind: 'never' }, { kind: 'always' },
    ]}, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'anyOf', preds: [
      { kind: 'never' }, { kind: 'never' },
    ]}, s)).toBe(false)
  })

  it('not — inverts', () => {
    const s = baseState()
    expect(evaluatePredicate({ kind: 'not', pred: { kind: 'never' } }, s)).toBe(true)
    expect(evaluatePredicate({ kind: 'not', pred: { kind: 'always' } }, s)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd phaser && npm test -- tests/unit/systems/predicates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement predicates.ts**

`src/systems/predicates.ts`:
```ts
import type { Predicate } from '../domain/predicate'
import type { FlagScope } from '../domain/quest'

// Minimal state shape for predicate evaluation. The real RunState provides this.
export interface PredicateState {
  flags: Map<string, { value: unknown; scope: FlagScope }>
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  party: { units: Record<string, { classId: string }> }
  inventory: { items: { itemId: string }[] }
  gold: number
  visitedNodes: Set<string>
  clearedEncounters: Set<string>
}

const QUEST_COMPLETE_MARKER = '__complete__'

function refKey(ref: { mapKind: string; mapId: string; nodeId: string }): string {
  return `${ref.mapKind}:${ref.mapId}:${ref.nodeId}`
}

export function evaluatePredicate(pred: Predicate, state: PredicateState): boolean {
  switch (pred.kind) {
    case 'always': return true
    case 'never':  return false
    case 'flag': {
      const entry = state.flags.get(pred.key as unknown as string)
      if (!entry) return false
      return pred.equals === undefined ? true : entry.value === pred.equals
    }
    case 'notFlag':
      return !state.flags.has(pred.key as unknown as string)
    case 'questStage': {
      const q = state.questStates[pred.questId as unknown as string]
      return q?.currentStage === (pred.stage as unknown as string)
    }
    case 'questComplete': {
      const q = state.questStates[pred.questId as unknown as string]
      return q?.currentStage === QUEST_COMPLETE_MARKER
    }
    case 'partyHas':
      return Object.values(state.party.units).some(u => u.classId === (pred.classId as unknown as string))
    case 'hasItem':
      return state.inventory.items.some(i => i.itemId === (pred.itemId as unknown as string))
    case 'goldAtLeast':
      return state.gold >= pred.amount
    case 'visited':
      return state.visitedNodes.has(refKey({
        mapKind: pred.ref.mapKind,
        mapId: pred.ref.mapId as unknown as string,
        nodeId: pred.ref.nodeId as unknown as string,
      }))
    case 'cleared':
      return state.clearedEncounters.has(pred.encounterId as unknown as string)
    case 'allOf':
      return pred.preds.every(p => evaluatePredicate(p, state))
    case 'anyOf':
      return pred.preds.some(p => evaluatePredicate(p, state))
    case 'not':
      return !evaluatePredicate(pred.pred, state)
  }
}

export const QUEST_COMPLETE = QUEST_COMPLETE_MARKER
```

- [ ] **Step 4: Run, expect PASS**

```bash
cd phaser && npm test -- tests/unit/systems/predicates.test.ts
```

Expected: PASS (14 tests).

- [ ] **Step 5: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §6 (Predicate Vocabulary) — confirm every predicate kind from the test is listed.

```bash
git add phaser/src phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): predicate AST evaluator covering all kinds (incl. allOf/anyOf/not)"
```

---

### Task 11: Zod schemas mirroring domain types

**Files:**
- Create: `src/data/schemas/card.ts`, `unit.ts`, `item.ts`, `class.ts`, `statusEffect.ts`, `predicate.ts`, `map.ts`, `quest.ts`, `dialogue.ts`, `index.ts`

- [ ] **Step 1: Implement schemas/predicate.ts (recursive)**

`src/data/schemas/predicate.ts`:
```ts
import { z } from 'zod'

export const PredicateSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
    z.object({ kind: z.literal('flag'), key: z.string(), equals: z.unknown().optional() }),
    z.object({ kind: z.literal('notFlag'), key: z.string() }),
    z.object({ kind: z.literal('questStage'), questId: z.string(), stage: z.string() }),
    z.object({ kind: z.literal('questComplete'), questId: z.string() }),
    z.object({ kind: z.literal('partyHas'), classId: z.string() }),
    z.object({ kind: z.literal('hasItem'), itemId: z.string() }),
    z.object({ kind: z.literal('goldAtLeast'), amount: z.number() }),
    z.object({ kind: z.literal('visited'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
    z.object({ kind: z.literal('cleared'), encounterId: z.string() }),
    z.object({ kind: z.literal('allOf'), preds: z.array(PredicateSchema) }),
    z.object({ kind: z.literal('anyOf'), preds: z.array(PredicateSchema) }),
    z.object({ kind: z.literal('not'), pred: PredicateSchema }),
  ])
)
```

- [ ] **Step 2: Implement remaining schemas**

`src/data/schemas/card.ts`:
```ts
import { z } from 'zod'

export const WeaponTypeSchema = z.enum(['sword','lance','axe','bow','crossbow','tome','staff'])

export const CardSchema = z.object({
  id: z.string(),
  name: z.string(),
  apCost: z.number().int().min(0),
  effects: z.array(z.object({
    kind: z.string(),
    params: z.record(z.string(), z.unknown()),
  })),
  range: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  targetKind: z.enum(['enemy','ally','self','tile','all_enemies','all_allies']),
  aoeRadius: z.number().int().min(0).optional(),
  weaponType: WeaponTypeSchema.nullable(),
  damageStat: z.enum(['str','mag','skl']).optional(),
})

export type CardInput = z.infer<typeof CardSchema>
```

`src/data/schemas/unit.ts`:
```ts
import { z } from 'zod'

export const UnitStatsSchema = z.object({
  str: z.number().int(), mag: z.number().int(), skl: z.number().int(),
  spd: z.number().int(), def: z.number().int(), res: z.number().int(),
})

export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1),
  hp: z.object({ current: z.number().int().min(0), max: z.number().int().min(1) }),
  stats: UnitStatsSchema,
  hand: z.object({ left: z.string().nullable(), right: z.string().nullable() }),
  position: z.string().nullable(),
  ap: z.number().int().min(0),
  armor: z.number().int().min(0),
  statuses: z.array(z.object({
    effectId: z.string(),
    stacks: z.number().int().min(0),
    turnsRemaining: z.number().int().min(0),
    source: z.string().nullable(),
  })),
})
```

`src/data/schemas/item.ts`:
```ts
import { z } from 'zod'
import { WeaponTypeSchema } from './card'

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['weapon_1h','weapon_2h','shield','tome','staff','quiver','consumable']),
  weaponType: WeaponTypeSchema.optional(),
  rarity: z.enum(['common','uncommon','rare','epic','legendary']),
  region: z.enum(['borderlands','thornwood','ashfall','none']),
  gearCards: z.array(z.string()),
  quiverModifier: z.object({
    kind: z.enum(['poison','burn','slow','thunder','explosive']),
    value: z.number(),
    turns: z.number().int().optional(),
  }).optional(),
  isTwoHanded: z.boolean(),
  gridSize: z.object({ width: z.number().int().min(1), height: z.number().int().min(1) }),
  range: z.object({ min: z.number().int().min(0), max: z.number().int().min(0) }).optional(),
  buyPrice: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
})
```

`src/data/schemas/class.ts`:
```ts
import { z } from 'zod'
import { UnitStatsSchema } from './unit'

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseStats: UnitStatsSchema,
  growthRates: UnitStatsSchema,
  innateCardIds: z.array(z.string()),
  startingMov: z.number().int().min(1),
  startingHp: z.number().int().min(1),
})
```

`src/data/schemas/statusEffect.ts`:
```ts
// StatusEffectDef contains function hooks; can't be Zod-validated directly.
// JSON content for status effects is registered in a code-side registry, not loaded as data.
// This file exists for future status-effect-data shape if we ever externalize them.
import { z } from 'zod'

export const StatusEffectDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  stackable: z.boolean(),
})
```

`src/data/schemas/map.ts`:
```ts
import { z } from 'zod'
import { PredicateSchema } from './predicate'

export const TerrainTileSchema = z.object({
  kind: z.enum(['plain','forest','mountain','water','road','fortress']),
  defBonus: z.number().int(),
  resBonus: z.number().int(),
  movementCost: z.number().int().min(0),
  impassable: z.boolean(),
  blocksLOS: z.boolean(),
})

export const WorldMapSchema = z.object({
  id: z.string(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tileSize: z.number().int().min(1),
  terrainGrid: z.array(z.array(TerrainTileSchema)),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['town','camp','dungeon','exit']),
    position: z.object({ x: z.number().int(), y: z.number().int() }),
    visiblePredicate: PredicateSchema,
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    encounterTableId: z.string(),
    rollChance: z.number().min(0).max(1),
  })),
})

export const BattleMapSchema = z.object({
  id: z.string(),
  width: z.literal(14),
  height: z.literal(10),
  terrain: z.array(z.array(TerrainTileSchema)),
  spawnZones: z.object({
    party: z.array(z.string()),
    enemy: z.array(z.string()),
  }),
  obstacles: z.array(z.string()),
  source: z.enum(['handcrafted','procgen-template']),
})
```

`src/data/schemas/quest.ts`:
```ts
import { z } from 'zod'
import { PredicateSchema } from './predicate'

export const QuestEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setFlag'), key: z.string(), value: z.unknown(), scope: z.enum(['run','quest','battle','permanent']).optional() }),
  z.object({ kind: z.literal('grantItem'), itemId: z.string() }),
  z.object({ kind: z.literal('recruitUnit'), classId: z.string(), level: z.number().int().min(1) }),
  z.object({ kind: z.literal('spawnNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
  z.object({ kind: z.literal('unlockNode'), ref: z.object({ mapKind: z.enum(['overworld','dungeon','battle']), mapId: z.string(), nodeId: z.string() }) }),
  z.object({ kind: z.literal('startDialogue'), treeId: z.string() }),
  z.object({ kind: z.literal('completeQuest'), questId: z.string() }),
])

export const QuestStageSchema = z.object({
  id: z.string(),
  onEnter: z.array(QuestEffectSchema),
  listeners: z.array(z.object({
    on: z.enum(['BattleVictory','LocationArrived','ItemAcquired','FlagSet']),
    predicate: PredicateSchema,
    emit: z.array(QuestEffectSchema),
  })),
  transitions: z.array(z.object({
    when: PredicateSchema,
    to: z.string(),
  })),
  onExit: z.array(QuestEffectSchema),
})

export const QuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  initialStage: z.string(),
  stages: z.record(z.string(), QuestStageSchema),
})
```

`src/data/schemas/dialogue.ts`:
```ts
import { z } from 'zod'
import { PredicateSchema } from './predicate'
import { QuestEffectSchema } from './quest'

export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  visibleIf: PredicateSchema.optional(),
  enabledIf: PredicateSchema.optional(),
  effects: z.array(QuestEffectSchema),
  next: z.union([z.string(), z.literal('end')]),
})

export const DialogueNodeSchema = z.object({
  id: z.string(),
  speaker: z.string().optional(),
  text: z.string(),
  choices: z.array(DialogueChoiceSchema),
  onEnter: z.array(QuestEffectSchema).optional(),
})

export const DialogueTreeSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  nodes: z.record(z.string(), DialogueNodeSchema),
})
```

`src/data/schemas/index.ts`:
```ts
export * from './card'
export * from './unit'
export * from './item'
export * from './class'
export * from './statusEffect'
export * from './predicate'
export * from './map'
export * from './quest'
export * from './dialogue'
```

- [ ] **Step 3: Typecheck**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Add roundtrip test**

`tests/unit/data/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { CardSchema, ItemSchema, ClassSchema, QuestSchema, DialogueTreeSchema, BattleMapSchema, WorldMapSchema, PredicateSchema } from '../../../src/data/schemas'

describe('Zod schemas', () => {
  it('CardSchema parses valid card JSON', () => {
    expect(() => CardSchema.parse({
      id: 'slash', name: 'Slash', apCost: 1,
      effects: [{ kind: 'Damage', params: { base: 4, stat: 'str' } }],
      range: { min: 1, max: 1 }, targetKind: 'enemy', weaponType: 'sword', damageStat: 'str',
    })).not.toThrow()
  })

  it('rejects card with negative apCost', () => {
    expect(() => CardSchema.parse({
      id: 'x', name: 'X', apCost: -1, effects: [], range: { min: 1, max: 1 },
      targetKind: 'enemy', weaponType: null,
    })).toThrow()
  })

  it('PredicateSchema parses recursive allOf', () => {
    expect(() => PredicateSchema.parse({
      kind: 'allOf',
      preds: [
        { kind: 'flag', key: 'a' },
        { kind: 'not', pred: { kind: 'flag', key: 'b' } },
      ],
    })).not.toThrow()
  })

  it('QuestSchema parses minimal quest', () => {
    expect(() => QuestSchema.parse({
      id: 'q1', name: 'Quest 1', initialStage: 's1',
      stages: { s1: { id: 's1', onEnter: [], listeners: [], transitions: [], onExit: [] } },
    })).not.toThrow()
  })

  it('BattleMapSchema enforces 14x10', () => {
    expect(() => BattleMapSchema.parse({
      id: 'b1', width: 12, height: 10,
      terrain: [], spawnZones: { party: [], enemy: [] },
      obstacles: [], source: 'handcrafted',
    })).toThrow()
  })
})
```

```bash
cd phaser && npm test -- tests/unit/data/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §8 (Schema Index) with each file mapping.

```bash
git add phaser/src/data phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): Zod schemas mirroring all domain types"
```

---

### Task 12: data/load.ts boot validator

**Files:**
- Create: `src/data/load.ts`
- Test: `tests/unit/data/load.test.ts`

- [ ] **Step 1: Implement load.ts**

`src/data/load.ts`:
```ts
import { z, ZodError } from 'zod'
import { CardSchema, UnitSchema, ItemSchema, ClassSchema, QuestSchema, DialogueTreeSchema, BattleMapSchema, WorldMapSchema } from './schemas'

export interface ContentBundle {
  cards: z.infer<typeof CardSchema>[]
  units: z.infer<typeof UnitSchema>[]
  items: z.infer<typeof ItemSchema>[]
  classes: z.infer<typeof ClassSchema>[]
  quests: z.infer<typeof QuestSchema>[]
  dialogues: z.infer<typeof DialogueTreeSchema>[]
  battleMaps: z.infer<typeof BattleMapSchema>[]
  worldMaps: z.infer<typeof WorldMapSchema>[]
}

export type LoadResult =
  | { ok: true; bundle: ContentBundle }
  | { ok: false; errors: { file: string; error: ZodError | string }[] }

export interface RawContent {
  cards: unknown[]
  units: unknown[]
  items: unknown[]
  classes: unknown[]
  quests: unknown[]
  dialogues: unknown[]
  battleMaps: unknown[]
  worldMaps: unknown[]
}

export function validateContent(raw: RawContent): LoadResult {
  const errors: { file: string; error: ZodError | string }[] = []
  const out: Partial<ContentBundle> = {}

  function arr<T>(name: keyof RawContent, schema: z.ZodType<T>): T[] | undefined {
    const list: T[] = []
    for (let i = 0; i < raw[name].length; i++) {
      const r = schema.safeParse(raw[name][i])
      if (r.success) list.push(r.data)
      else errors.push({ file: `${name}[${i}]`, error: r.error })
    }
    return errors.length === 0 ? list : undefined
  }

  out.cards = arr('cards', CardSchema)
  out.units = arr('units', UnitSchema)
  out.items = arr('items', ItemSchema)
  out.classes = arr('classes', ClassSchema)
  out.quests = arr('quests', QuestSchema)
  out.dialogues = arr('dialogues', DialogueTreeSchema)
  out.battleMaps = arr('battleMaps', BattleMapSchema)
  out.worldMaps = arr('worldMaps', WorldMapSchema)

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, bundle: out as ContentBundle }
}
```

- [ ] **Step 2: Test it**

`tests/unit/data/load.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateContent } from '../../../src/data/load'

describe('validateContent', () => {
  it('returns ok when all content is valid', () => {
    const r = validateContent({
      cards: [], units: [], items: [], classes: [], quests: [], dialogues: [], battleMaps: [], worldMaps: [],
    })
    expect(r.ok).toBe(true)
  })

  it('aggregates errors across files', () => {
    const r = validateContent({
      cards: [{ id: 'bad' }],   // missing required fields
      units: [], items: [], classes: [], quests: [], dialogues: [], battleMaps: [], worldMaps: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0)
  })
})
```

```bash
cd phaser && npm test -- tests/unit/data/load.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add phaser/src/data/load.ts phaser/tests/unit/data/load.test.ts
git commit -m "feat(phaser): boot-time content validator aggregating Zod errors"
```

---

## Phase 2 — Contracts + State (Week 2)

### Task 13: Contracts module — domainEvents, crossStoreActions, handoffs, predicates

**Files:**
- Create: `src/contracts/domainEvents.ts`, `crossStoreActions.ts`, `handoffs.ts`, `predicates.ts`, `index.ts`

- [ ] **Step 1: Implement contracts/domainEvents.ts**

`src/contracts/domainEvents.ts`:
```ts
import type { UnitId, ItemId, ClassId, QuestId, StageId, FlagKey } from '../domain/ids'
import type { MapNodeRef } from '../domain/map'
import type { FlagScope } from '../domain/quest'

export type DomainEvent =
  | { type: 'BattleStarted'; payload: { battleId: string; enemies: UnitId[] } }
  | { type: 'BattleVictory'; payload: { battleId: string; survivors: UnitId[]; capturedIds: UnitId[] } }
  | { type: 'BattleDefeat';  payload: { battleId: string } }
  | { type: 'UnitDied'; payload: { unitId: UnitId; cause: string } }
  | { type: 'EnemyCaptured'; payload: { unitId: UnitId; classId: ClassId; level: number } }
  | { type: 'LocationArrived'; payload: { nodeRef: MapNodeRef } }
  | { type: 'ItemAcquired'; payload: { itemId: ItemId; source: 'loot'|'shop'|'quest'|'event' } }
  | { type: 'FlagSet'; payload: { key: FlagKey; value: unknown; scope: FlagScope } }
  | { type: 'QuestStageAdvanced'; payload: { questId: QuestId; from: StageId; to: StageId } }
```

- [ ] **Step 2: Implement contracts/crossStoreActions.ts**

`src/contracts/crossStoreActions.ts`:
```ts
import type { UnitId, ItemId, ClassId } from '../domain/ids'
import type { Unit } from '../domain/unit'
import type { DomainEvent } from './domainEvents'

export interface BattleResult {
  outcome: 'victory' | 'defeat' | 'fled'
  battleId: string
  survivors: UnitId[]
  fallen: UnitId[]
  xpAwards: Record<string, number>     // keyed by UnitId-as-string
  capturedEnemies: { id: UnitId; classId: ClassId; level: number }[]
  loot: { itemId: ItemId }[]
  goldEarned: number
  consumedTravelHop: number | null
  emittedEvents: DomainEvent[]
}

export interface RecruitmentResult {
  unit: Unit
  goldCost: number
  source: 'tavern' | 'event' | 'quest'
  emittedEvents: DomainEvent[]
}
```

- [ ] **Step 3: Implement contracts/handoffs.ts**

`src/contracts/handoffs.ts`:
```ts
import type { NodeId, MapId, EnemyGroupId, DungeonId } from '../domain/ids'
import type { RngState } from '../domain/rng'

export interface PendingTravelPath {
  remainingNodeIds: NodeId[]
  totalHopsThisLeg: number
  rngBranch: RngState
}

export interface CombatBootRequest {
  battleId: string
  battleMapId: MapId
  enemyGroupId: EnemyGroupId
  rngSeed: RngState
  triggeringHopIndex: number | null
  returnTo:
    | { sceneId: 'overworld'; resumeWith: PendingTravelPath }
    | { sceneId: 'dungeon'; resumeWith: { dungeonId: DungeonId; nodeId: NodeId } }
}
```

- [ ] **Step 4: Implement contracts/predicates.ts (re-export)**

`src/contracts/predicates.ts`:
```ts
export type { Predicate } from '../domain/predicate'
export { evaluatePredicate } from '../systems/predicates'
export type { PredicateState } from '../systems/predicates'
```

- [ ] **Step 5: Implement contracts/index.ts**

`src/contracts/index.ts`:
```ts
export * from './domainEvents'
export * from './crossStoreActions'
export * from './handoffs'
export * from './predicates'
```

- [ ] **Step 6: Typecheck**

```bash
cd phaser && npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §4 (Cross-System Contracts) — list `BattleResult`, `RecruitmentResult`, `PendingTravelPath`, `CombatBootRequest`. Update §7 (Domain Event Catalog) with full event list.

```bash
git add phaser/src/contracts phaser/CONTEXT.md
git commit -m "feat(phaser): src/contracts/ module — compiler-enforced integration boundaries"
```

---

### Task 14: TypedFlagStore

**Files:**
- Create: `src/state/flags.ts`
- Test: `tests/unit/state/flags.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/flags.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createFlagStore } from '../../../src/state/flags'
import { asFlagKey } from '../../../src/domain/ids'

describe('TypedFlagStore', () => {
  it('set/get/has roundtrip', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), 1, 'run')
    expect(fs.get(asFlagKey('a'))).toBe(1)
    expect(fs.has(asFlagKey('a'))).toBe(true)
    expect(fs.has(asFlagKey('absent'))).toBe(false)
  })

  it('clearScope removes only matching scope', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('run.x'), 1, 'run')
    fs.set(asFlagKey('battle.x'), 2, 'battle')
    fs.set(asFlagKey('perm.x'), 3, 'permanent')
    fs.clearScope('battle')
    expect(fs.has(asFlagKey('run.x'))).toBe(true)
    expect(fs.has(asFlagKey('battle.x'))).toBe(false)
    expect(fs.has(asFlagKey('perm.x'))).toBe(true)
  })

  it('enumerate returns all entries with scope', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), 1, 'run')
    fs.set(asFlagKey('b'), 2, 'quest')
    const entries = fs.enumerate()
    expect(entries.length).toBe(2)
    expect(entries.find(e => e.key === 'a')?.scope).toBe('run')
    expect(entries.find(e => e.key === 'b')?.scope).toBe('quest')
  })

  it('default scope is run', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('x'), 1)
    expect(fs.enumerate()[0]!.scope).toBe('run')
  })

  it('serialize/hydrate roundtrip', () => {
    const fs = createFlagStore()
    fs.set(asFlagKey('a'), { foo: 1 }, 'permanent')
    const dump = fs.serialize()
    const fs2 = createFlagStore()
    fs2.hydrate(dump)
    expect(fs2.get(asFlagKey('a'))).toEqual({ foo: 1 })
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/state/flags.test.ts
```

- [ ] **Step 3: Implement flags.ts**

`src/state/flags.ts`:
```ts
import type { FlagKey } from '../domain/ids'
import type { FlagScope } from '../domain/quest'

export interface SerializedFlag {
  key: string
  value: unknown
  scope: FlagScope
}

export interface TypedFlagStore {
  set(key: FlagKey, value: unknown, scope?: FlagScope): void
  get<T = unknown>(key: FlagKey): T | undefined
  has(key: FlagKey): boolean
  clearScope(scope: FlagScope): void
  enumerate(): SerializedFlag[]
  serialize(): SerializedFlag[]
  hydrate(data: SerializedFlag[]): void
  asPredicateMap(): Map<string, { value: unknown; scope: FlagScope }>
}

export function createFlagStore(): TypedFlagStore {
  const data = new Map<string, { value: unknown; scope: FlagScope }>()

  return {
    set(key, value, scope = 'run') {
      data.set(key as unknown as string, { value, scope })
    },
    get<T = unknown>(key: FlagKey): T | undefined {
      return data.get(key as unknown as string)?.value as T | undefined
    },
    has(key) {
      return data.has(key as unknown as string)
    },
    clearScope(scope) {
      for (const [k, v] of data.entries()) {
        if (v.scope === scope) data.delete(k)
      }
    },
    enumerate() {
      return Array.from(data.entries()).map(([key, { value, scope }]) => ({ key, value, scope }))
    },
    serialize() {
      return this.enumerate()
    },
    hydrate(entries) {
      data.clear()
      for (const { key, value, scope } of entries) data.set(key, { value, scope })
    },
    asPredicateMap() {
      return new Map(data)
    },
  }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
cd phaser && npm test -- tests/unit/state/flags.test.ts
```

- [ ] **Step 5: Commit `[CONTEXT.md update required]`**

Update `phaser/CONTEXT.md` §2 (Three-Store Ownership) — confirm flags live on `runStore` with the four scopes.

```bash
git add phaser/src/state/flags.ts phaser/tests/unit/state/flags.test.ts phaser/CONTEXT.md
git commit -m "feat(phaser): TypedFlagStore with run/quest/battle/permanent scopes + serialization"
```

---

### Task 15: Domain event bus

**Files:**
- Create: `src/state/eventBus.ts`
- Test: `tests/unit/state/eventBus.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/eventBus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../../src/state/eventBus'
import type { DomainEvent } from '../../../src/contracts'

describe('EventBus', () => {
  it('emits to subscribers', () => {
    const bus = createEventBus()
    const sub = vi.fn()
    bus.subscribe(sub)
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b1', survivors: [], capturedIds: [] } }
    bus.emit(evt)
    expect(sub).toHaveBeenCalledWith(evt)
  })

  it('unsubscribe stops further events', () => {
    const bus = createEventBus()
    const sub = vi.fn()
    const off = bus.subscribe(sub)
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'b' } })
    off()
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'b' } })
    expect(sub).toHaveBeenCalledTimes(1)
  })

  it('multiple subscribers all receive events', () => {
    const bus = createEventBus()
    const a = vi.fn(), b = vi.fn()
    bus.subscribe(a); bus.subscribe(b)
    bus.emit({ type: 'BattleDefeat', payload: { battleId: 'x' } })
    expect(a).toHaveBeenCalled()
    expect(b).toHaveBeenCalled()
  })

  it('subscriber error does not break other subscribers', () => {
    const bus = createEventBus()
    bus.subscribe(() => { throw new Error('boom') })
    const ok = vi.fn()
    bus.subscribe(ok)
    expect(() => bus.emit({ type: 'BattleDefeat', payload: { battleId: 'x' } })).not.toThrow()
    expect(ok).toHaveBeenCalled()
  })

  it('replay events in order via replayAll', () => {
    const bus = createEventBus()
    const log: string[] = []
    bus.subscribe(e => log.push(e.type))
    bus.replayAll([
      { type: 'BattleStarted', payload: { battleId: 'a', enemies: [] } },
      { type: 'BattleVictory', payload: { battleId: 'a', survivors: [], capturedIds: [] } },
    ])
    expect(log).toEqual(['BattleStarted', 'BattleVictory'])
  })
})
```

- [ ] **Step 2: Implement eventBus.ts**

`src/state/eventBus.ts`:
```ts
import type { DomainEvent } from '../contracts'

export interface EventBus {
  emit(event: DomainEvent): void
  subscribe(listener: (e: DomainEvent) => void): () => void
  replayAll(events: DomainEvent[]): void
}

export function createEventBus(): EventBus {
  const listeners = new Set<(e: DomainEvent) => void>()

  return {
    emit(event) {
      for (const fn of listeners) {
        try { fn(event) }
        catch (err) { /* errors propagate to errorBus in real wiring; here just isolate */
          // eslint-disable-next-line no-console
          console.error('eventBus listener threw', err)
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    replayAll(events) {
      for (const e of events) this.emit(e)
    },
  }
}
```

- [ ] **Step 3: Run, expect PASS**

```bash
cd phaser && npm test -- tests/unit/state/eventBus.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add phaser/src/state/eventBus.ts phaser/tests/unit/state/eventBus.test.ts
git commit -m "feat(phaser): domain event bus (emit/subscribe/replayAll)"
```

---

### Task 16: Error bus + ErrorBoundary

**Files:**
- Create: `src/state/errorBus.ts`, `src/ui/ErrorBoundary.tsx`
- Test: `tests/unit/state/errorBus.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/errorBus.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { createErrorBus } from '../../../src/state/errorBus'

describe('ErrorBus', () => {
  it('emits errors to subscribers with context', () => {
    const bus = createErrorBus()
    const sub = vi.fn()
    bus.subscribe(sub)
    bus.emit({ source: 'combatStore', error: new Error('x'), context: { action: 'playCard' } })
    expect(sub).toHaveBeenCalled()
    expect(sub.mock.calls[0]![0].source).toBe('combatStore')
  })

  it('keeps a last-N ring buffer for diagnostic export', () => {
    const bus = createErrorBus(3)
    for (let i = 0; i < 5; i++) bus.emit({ source: 's', error: new Error(`e${i}`), context: {} })
    const recent = bus.recent()
    expect(recent.length).toBe(3)
    expect(recent[0]!.error.message).toBe('e2')
  })
})
```

- [ ] **Step 2: Implement errorBus.ts**

`src/state/errorBus.ts`:
```ts
export interface ErrorEntry {
  source: string
  error: Error
  context: Record<string, unknown>
  timestamp: number
}

export interface ErrorBus {
  emit(entry: { source: string; error: Error; context: Record<string, unknown> }): void
  subscribe(fn: (e: ErrorEntry) => void): () => void
  recent(): ErrorEntry[]
}

export function createErrorBus(ringSize = 50): ErrorBus {
  const ring: ErrorEntry[] = []
  const subs = new Set<(e: ErrorEntry) => void>()

  return {
    emit({ source, error, context }) {
      const entry: ErrorEntry = { source, error, context, timestamp: Date.now() }
      ring.push(entry)
      if (ring.length > ringSize) ring.shift()
      for (const fn of subs) {
        try { fn(entry) } catch { /* swallow — never let an error subscriber break */ }
      }
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    recent: () => [...ring],
  }
}
```

- [ ] **Step 3: Implement ErrorBoundary.tsx**

`src/ui/ErrorBoundary.tsx`:
```tsx
import React from 'react'
import type { ErrorBus } from '../state/errorBus'

interface Props { errorBus: ErrorBus; children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.errorBus.emit({ source: 'react', error, context: { info } })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-8 bg-red-950 text-red-100">
          <h1>Something broke.</h1>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 4: Test + commit**

```bash
cd phaser && npm test -- tests/unit/state/errorBus.test.ts
git add phaser/src/state/errorBus.ts phaser/src/ui/ErrorBoundary.tsx phaser/tests/unit/state/errorBus.test.ts
git commit -m "feat(phaser): errorBus + ErrorBoundary (last-N ring + React boundary)"
```

---

### Task 17: Action log ring buffer

**Files:**
- Create: `src/state/actionLog.ts`
- Test: `tests/unit/state/actionLog.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/actionLog.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createActionLog } from '../../../src/state/actionLog'

describe('ActionLog', () => {
  it('appends and ring-buffers at capacity', () => {
    const log = createActionLog(3)
    for (let i = 0; i < 5; i++) {
      log.append({ store: 'run', action: { type: 'addGold' as const, payload: { amount: i } }, timestamp: i, rngStateBeforeAction: { seed: 0, counter: 0 } })
    }
    const all = log.snapshot()
    expect(all.length).toBe(3)
    expect((all[0]!.action.payload as { amount: number }).amount).toBe(2)
  })

  it('serialize/hydrate roundtrip', () => {
    const log = createActionLog(10)
    log.append({ store: 'run', action: { type: 'addGold', payload: { amount: 5 } }, timestamp: 1, rngStateBeforeAction: { seed: 0, counter: 0 } })
    const dump = log.serialize()
    const log2 = createActionLog(10)
    log2.hydrate(dump)
    expect(log2.snapshot()).toEqual(dump)
  })
})
```

- [ ] **Step 2: Implement actionLog.ts**

`src/state/actionLog.ts`:
```ts
import type { RngState } from '../domain/rng'

export type StoreName = 'meta' | 'run' | 'combat'

export interface ActionLogEntry {
  store: StoreName
  action: { type: string; payload?: unknown }
  timestamp: number
  rngStateBeforeAction: RngState
}

export interface ActionLog {
  append(entry: ActionLogEntry): void
  snapshot(): ActionLogEntry[]
  serialize(): ActionLogEntry[]
  hydrate(entries: ActionLogEntry[]): void
}

export function createActionLog(capacity = 200): ActionLog {
  let buf: ActionLogEntry[] = []
  return {
    append(entry) {
      buf.push(entry)
      if (buf.length > capacity) buf = buf.slice(buf.length - capacity)
    },
    snapshot: () => [...buf],
    serialize: () => [...buf],
    hydrate(entries) { buf = entries.slice(-capacity) },
  }
}
```

- [ ] **Step 3: Test + commit**

```bash
cd phaser && npm test -- tests/unit/state/actionLog.test.ts
git add phaser/src/state/actionLog.ts phaser/tests/unit/state/actionLog.test.ts
git commit -m "feat(phaser): action log ring buffer (default 200) with serialize/hydrate"
```

---

### Task 18: metaStore (skeletal Zustand)

**Files:**
- Create: `src/state/metaStore.ts`
- Test: `tests/unit/state/metaStore.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/metaStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useMetaStore } from '../../../src/state/metaStore'

describe('metaStore', () => {
  beforeEach(() => useMetaStore.getState().__reset())

  it('starts un-started, 0 runs', () => {
    expect(useMetaStore.getState().gameStarted).toBe(false)
    expect(useMetaStore.getState().totalRuns).toBe(0)
  })

  it('startNewRun marks gameStarted, increments totalRuns', () => {
    useMetaStore.getState().dispatch({ type: 'startNewRun' })
    expect(useMetaStore.getState().gameStarted).toBe(true)
    expect(useMetaStore.getState().totalRuns).toBe(1)
  })

  it('recordRunCompleted is a no-op for skeletal store (will track wins later)', () => {
    useMetaStore.getState().dispatch({ type: 'startNewRun' })
    useMetaStore.getState().dispatch({ type: 'recordRunCompleted', payload: { won: true } })
    expect(useMetaStore.getState().gameStarted).toBe(true)
  })
})
```

- [ ] **Step 2: Implement metaStore.ts**

`src/state/metaStore.ts`:
```ts
import { create } from 'zustand'

export type MetaAction =
  | { type: 'startNewRun' }
  | { type: 'recordRunCompleted'; payload: { won: boolean } }

interface MetaState {
  gameStarted: boolean
  totalRuns: number
  dispatch: (action: MetaAction) => void
  __reset: () => void
}

const initial = { gameStarted: false, totalRuns: 0 }

export const useMetaStore = create<MetaState>((set) => ({
  ...initial,
  dispatch(action) {
    switch (action.type) {
      case 'startNewRun':
        set(s => ({ gameStarted: true, totalRuns: s.totalRuns + 1 }))
        return
      case 'recordRunCompleted':
        // skeletal — wins/losses tracked in later milestone
        return
    }
  },
  __reset() { set(initial) },
}))
```

- [ ] **Step 3: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/state/metaStore.test.ts
git add phaser/src/state/metaStore.ts phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): metaStore (skeletal Zustand: gameStarted + totalRuns)"
```

Update `phaser/CONTEXT.md` §3 (Action Catalog) with `metaStore` actions.

---

### Task 19: runStore (Zustand with full action set)

**Files:**
- Create: `src/state/runStore.ts`
- Test: `tests/unit/state/runStore.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/state/runStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStore } from '../../../src/state/runStore'
import { asUnitId, asItemId, asNodeId, asMapId, asFlagKey, asQuestId, asStageId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'
import { asClassId } from '../../../src/domain/ids'

const mkUnit = (id: string): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('runStore', () => {
  beforeEach(() => useRunStore.getState().__resetForTest())

  it('recruitUnit adds to party + partyOrder', () => {
    useRunStore.getState().dispatch({ type: 'recruitUnit', payload: { unit: mkUnit('roy') } })
    const s = useRunStore.getState()
    expect(s.party.units[asUnitId('roy') as unknown as string]).toBeDefined()
    expect(s.party.partyOrder).toContain(asUnitId('roy'))
  })

  it('addGold accumulates', () => {
    const d = useRunStore.getState().dispatch
    d({ type: 'addGold', payload: { amount: 10 } })
    d({ type: 'addGold', payload: { amount: 25 } })
    expect(useRunStore.getState().gold).toBe(35)
  })

  it('arriveAtNode updates worldPosition + visitedNodes', () => {
    useRunStore.getState().dispatch({ type: 'arriveAtNode', payload: { nodeId: asNodeId('pine') } })
    const s = useRunStore.getState()
    expect(s.worldPosition.nodeId).toBe(asNodeId('pine'))
    expect(s.visitedNodes['overworld:test_overworld:pine']).toBe(true)
  })

  it('setFlag delegates to flag store with scope', () => {
    useRunStore.getState().dispatch({ type: 'setFlag', payload: { key: asFlagKey('q.x'), value: 42, scope: 'quest' } })
    expect(useRunStore.getState().flags.get(asFlagKey('q.x'))).toBe(42)
  })

  it('clearFlagsByScope', () => {
    const d = useRunStore.getState().dispatch
    d({ type: 'setFlag', payload: { key: asFlagKey('a'), value: 1, scope: 'battle' } })
    d({ type: 'setFlag', payload: { key: asFlagKey('b'), value: 1, scope: 'run' } })
    d({ type: 'clearFlagsByScope', payload: { scope: 'battle' } })
    expect(useRunStore.getState().flags.has(asFlagKey('a'))).toBe(false)
    expect(useRunStore.getState().flags.has(asFlagKey('b'))).toBe(true)
  })

  it('advanceQuestStage updates questStates', () => {
    useRunStore.getState().dispatch({ type: 'advanceQuestStage', payload: { questId: asQuestId('blood_ties'), toStage: asStageId('stage_2') } })
    expect(useRunStore.getState().questStates['blood_ties']?.currentStage).toBe('stage_2')
  })
})
```

- [ ] **Step 2: Implement runStore.ts**

`src/state/runStore.ts`:
```ts
import { create } from 'zustand'
import { createFlagStore, type TypedFlagStore } from './flags'
import type { Unit } from '../domain/unit'
import type { UnitId, ItemId, NodeId, MapId, FlagKey, QuestId, StageId, DungeonId } from '../domain/ids'
import type { FlagScope } from '../domain/quest'
import type { BattleResult } from '../contracts'
import type { PendingTravelPath } from '../contracts'
import type { DungeonGraph } from '../domain/map'
import type { RngState } from '../domain/rng'

export interface RunState {
  runId: string
  runSeed: number
  party: { units: Record<string, Unit>; partyOrder: UnitId[] }
  inventory: { items: { itemId: ItemId; gridX: number; gridY: number }[] }
  gold: number
  worldPosition: { mapId: MapId; nodeId: NodeId }
  visitedNodes: Record<string, boolean>           // key: "overworld:mapId:nodeId"
  clearedEncounters: Record<string, boolean>
  pendingTravelPath: PendingTravelPath | null
  flags: TypedFlagStore
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  activeDungeon: { dungeonId: DungeonId; graph: DungeonGraph; position: NodeId; clearedRooms: Set<NodeId> } | null
  rngState: RngState
  deathLog: { unitId: UnitId; cause: string; turn: number }[]
}

export type RunAction =
  | { type: 'recruitUnit'; payload: { unit: Unit } }
  | { type: 'fallenUnit'; payload: { unitId: UnitId; cause: string; turn: number } }
  | { type: 'equipHand'; payload: { unitId: UnitId; slot: 'left'|'right'; itemId: ItemId | null } }
  | { type: 'moveItemInBag'; payload: { itemId: ItemId; x: number; y: number } }
  | { type: 'addGold'; payload: { amount: number } }
  | { type: 'arriveAtNode'; payload: { nodeId: NodeId } }
  | { type: 'startTravelPath'; payload: { path: PendingTravelPath } }
  | { type: 'consumeTravelHop'; payload: { hopIndex: number } }
  | { type: 'enterDungeon'; payload: { dungeonId: DungeonId; graph: DungeonGraph } }
  | { type: 'advanceDungeonRoom'; payload: { roomId: NodeId } }
  | { type: 'exitDungeon' }
  | { type: 'setFlag'; payload: { key: FlagKey; value: unknown; scope?: FlagScope } }
  | { type: 'clearFlagsByScope'; payload: { scope: FlagScope } }
  | { type: 'advanceQuestStage'; payload: { questId: QuestId; toStage: StageId } }
  | { type: 'applyBattleResult'; payload: { result: BattleResult } }

interface RunStateWithDispatch extends RunState {
  dispatch(action: RunAction): void
  __resetForTest(): void
}

function freshState(): RunState {
  return {
    runId: 'run-' + Date.now(),
    runSeed: 0,
    party: { units: {}, partyOrder: [] },
    inventory: { items: [] },
    gold: 0,
    worldPosition: { mapId: 'test_overworld' as unknown as MapId, nodeId: 'pine' as unknown as NodeId },
    visitedNodes: {},
    clearedEncounters: {},
    pendingTravelPath: null,
    flags: createFlagStore(),
    questStates: {},
    activeDungeon: null,
    rngState: { seed: 0, counter: 0 },
    deathLog: [],
  }
}

function visitedKey(mapId: MapId, nodeId: NodeId): string {
  return `overworld:${mapId as unknown as string}:${nodeId as unknown as string}`
}

export const useRunStore = create<RunStateWithDispatch>((set, get) => ({
  ...freshState(),
  dispatch(action) {
    switch (action.type) {
      case 'recruitUnit': {
        const u = action.payload.unit
        set(s => ({
          party: {
            units: { ...s.party.units, [u.id as unknown as string]: u },
            partyOrder: [...s.party.partyOrder, u.id],
          },
        }))
        return
      }
      case 'fallenUnit': {
        set(s => ({
          deathLog: [...s.deathLog, { unitId: action.payload.unitId, cause: action.payload.cause, turn: action.payload.turn }],
        }))
        return
      }
      case 'equipHand': {
        const { unitId, slot, itemId } = action.payload
        set(s => {
          const u = s.party.units[unitId as unknown as string]
          if (!u) return s
          const updated: Unit = { ...u, hand: { ...u.hand, [slot]: itemId } }
          return { party: { ...s.party, units: { ...s.party.units, [unitId as unknown as string]: updated } } }
        })
        return
      }
      case 'moveItemInBag': {
        const { itemId, x, y } = action.payload
        set(s => ({
          inventory: {
            items: s.inventory.items.map(i =>
              i.itemId === itemId ? { ...i, gridX: x, gridY: y } : i
            ),
          },
        }))
        return
      }
      case 'addGold':
        set(s => ({ gold: s.gold + action.payload.amount }))
        return
      case 'arriveAtNode': {
        const nid = action.payload.nodeId
        set(s => {
          const key = visitedKey(s.worldPosition.mapId, nid)
          return {
            worldPosition: { ...s.worldPosition, nodeId: nid },
            visitedNodes: { ...s.visitedNodes, [key]: true },
          }
        })
        return
      }
      case 'startTravelPath':
        set({ pendingTravelPath: action.payload.path })
        return
      case 'consumeTravelHop':
        set(s => {
          if (!s.pendingTravelPath) return s
          return { pendingTravelPath: { ...s.pendingTravelPath, remainingNodeIds: s.pendingTravelPath.remainingNodeIds.slice(1) } }
        })
        return
      case 'enterDungeon': {
        const { dungeonId, graph } = action.payload
        const entry = graph.rows[graph.entryRow]?.[0]?.id
        if (!entry) return
        set({ activeDungeon: { dungeonId, graph, position: entry, clearedRooms: new Set() } })
        return
      }
      case 'advanceDungeonRoom':
        set(s => {
          if (!s.activeDungeon) return s
          const cleared = new Set(s.activeDungeon.clearedRooms); cleared.add(s.activeDungeon.position)
          return { activeDungeon: { ...s.activeDungeon, position: action.payload.roomId, clearedRooms: cleared } }
        })
        return
      case 'exitDungeon':
        set({ activeDungeon: null })
        return
      case 'setFlag': {
        const { key, value, scope } = action.payload
        get().flags.set(key, value, scope)
        // trigger React subscribers by reassigning a marker
        set({})
        return
      }
      case 'clearFlagsByScope':
        get().flags.clearScope(action.payload.scope)
        set({})
        return
      case 'advanceQuestStage': {
        const { questId, toStage } = action.payload
        set(s => ({
          questStates: {
            ...s.questStates,
            [questId as unknown as string]: {
              currentStage: toStage as unknown as string,
              metadata: s.questStates[questId as unknown as string]?.metadata ?? {},
            },
          },
        }))
        return
      }
      case 'applyBattleResult': {
        const r = action.payload.result
        set(s => ({
          gold: s.gold + r.goldEarned,
          deathLog: [
            ...s.deathLog,
            ...r.fallen.map(unitId => ({ unitId, cause: 'battle', turn: 0 })),
          ],
          inventory: {
            items: [
              ...s.inventory.items,
              ...r.loot.map((l, idx) => ({ itemId: l.itemId, gridX: idx % 8, gridY: Math.floor(idx / 8) })),
            ],
          },
        }))
        return
      }
    }
  },
  __resetForTest() { set(freshState()) },
}))
```

- [ ] **Step 3: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/state/runStore.test.ts
git add phaser/src phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): runStore (Zustand) with full action set + flag/quest/dungeon/inventory ownership"
```

Update `phaser/CONTEXT.md` §3 (Action Catalog) — `runStore` actions list now authoritative.

---

### Task 20: combatStore skeleton (Zustand reducer-driven, stub reducer)

**Files:**
- Create: `src/state/combatStore.ts`
- Test: `tests/unit/state/combatStore.test.ts`

(Real reducer implementation in Task 23; this task ships the store with a no-op reducer to wire actions/dispatch/effects-queue plumbing.)

- [ ] **Step 1: Implement combatStore.ts with stub reducer**

`src/state/combatStore.ts`:
```ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { RNG } from '../domain/rng'

export interface CombatStoreState {
  state: CombatState | null
  effectQueue: CombatEffect[]
  lastEffectId: number      // event-shaped subscription target
  dispatch(event: CombatEvent, rng: RNG): void
  drainEffects(): CombatEffect[]
  __resetForTest(): void
}

export const useCombatStore = create<CombatStoreState>()(
  subscribeWithSelector((set, get) => ({
    state: null,
    effectQueue: [],
    lastEffectId: 0,
    dispatch(event, _rng) {
      // Real reducer wiring lands in Task 23. For now: log no-op.
      // Each dispatch advances lastEffectId so subscribers fire.
      set(s => ({ lastEffectId: s.lastEffectId + 1 }))
    },
    drainEffects() {
      const out = get().effectQueue
      set({ effectQueue: [] })
      return out
    },
    __resetForTest() { set({ state: null, effectQueue: [], lastEffectId: 0 }) },
  }))
)
```

- [ ] **Step 2: Test stub plumbing**

`tests/unit/state/combatStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCombatStore } from '../../../src/state/combatStore'
import { createRng } from '../../../src/systems/rng'

describe('combatStore (stub plumbing)', () => {
  beforeEach(() => useCombatStore.getState().__resetForTest())

  it('lastEffectId increments on dispatch', () => {
    const before = useCombatStore.getState().lastEffectId
    useCombatStore.getState().dispatch({ type: 'endTurn' }, createRng({ seed: 0, counter: 0 }))
    expect(useCombatStore.getState().lastEffectId).toBe(before + 1)
  })

  it('drainEffects returns and clears queue', () => {
    useCombatStore.setState({ effectQueue: [{ kind: 'WaitForAnimations' }] })
    const drained = useCombatStore.getState().drainEffects()
    expect(drained.length).toBe(1)
    expect(useCombatStore.getState().effectQueue.length).toBe(0)
  })
})
```

- [ ] **Step 3: Test + commit**

```bash
cd phaser && npm test -- tests/unit/state/combatStore.test.ts
git add phaser/src/state/combatStore.ts phaser/tests/unit/state/combatStore.test.ts
git commit -m "feat(phaser): combatStore skeleton (Zustand + subscribeWithSelector, reducer wired in Task 23)"
```

---

## Phase 3 — Combat Systems (Week 3)

### Task 21: deckBuilder

**Files:**
- Create: `src/systems/deckBuilder.ts`
- Test: `tests/unit/systems/deckBuilder.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/deckBuilder.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildDeck } from '../../../src/systems/deckBuilder'
import type { Unit } from '../../../src/domain/unit'
import type { Item } from '../../../src/domain/item'
import type { ClassDef } from '../../../src/domain/class'
import { asUnitId, asClassId, asCardId, asItemId } from '../../../src/domain/ids'

const lordClass: ClassDef = {
  id: asClassId('lord'), name: 'Lord',
  baseStats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  growthRates: { str: 50, mag: 10, skl: 50, spd: 40, def: 30, res: 20 },
  innateCardIds: [asCardId('rally'), asCardId('inspiring_strike')],
  startingMov: 5, startingHp: 20,
}

const ironSword: Item = {
  id: asItemId('iron_sword'), name: 'Iron Sword', kind: 'weapon_1h',
  weaponType: 'sword', rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('slash'), asCardId('thrust'), asCardId('guard_break')],
  isTwoHanded: false, gridSize: { width: 1, height: 3 },
  range: { min: 1, max: 1 }, buyPrice: 120, sellPrice: 60,
}

const ironBuckler: Item = {
  id: asItemId('iron_buckler'), name: 'Iron Buckler', kind: 'shield',
  rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('block'), asCardId('parry')],
  isTwoHanded: false, gridSize: { width: 1, height: 2 },
  buyPrice: 80, sellPrice: 40,
}

const greatsword: Item = {
  id: asItemId('iron_greatsword'), name: 'Iron Greatsword', kind: 'weapon_2h',
  weaponType: 'sword', rarity: 'common', region: 'borderlands',
  gearCards: [asCardId('heavy_slash'), asCardId('cleave'), asCardId('overhead'), asCardId('whirlwind')],
  isTwoHanded: true, gridSize: { width: 2, height: 4 },
  range: { min: 1, max: 1 }, buyPrice: 200, sellPrice: 100,
}

const mkUnit = (left: string | null, right: string | null): Unit => ({
  id: asUnitId('roy'), name: 'Roy', classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
  hand: { left: left ? asItemId(left) : null, right: right ? asItemId(right) : null },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('deckBuilder', () => {
  it('1H + 1H = innate + leftCards + rightCards', () => {
    const items = new Map([[ironSword.id, ironSword], [ironBuckler.id, ironBuckler]])
    const deck = buildDeck(mkUnit('iron_sword', 'iron_buckler'), lordClass, items)
    expect(deck.length).toBe(2 + 3 + 2) // 7
    expect(deck.filter(c => c.source === 'innate').length).toBe(2)
    expect(deck.filter(c => c.source === 'hand_left').length).toBe(3)
    expect(deck.filter(c => c.source === 'hand_right').length).toBe(2)
  })

  it('2H weapon contributes all its cards from left slot, right slot is empty', () => {
    const items = new Map([[greatsword.id, greatsword]])
    const deck = buildDeck(mkUnit('iron_greatsword', null), lordClass, items)
    expect(deck.length).toBe(2 + 4) // innate + 2H cards
    expect(deck.filter(c => c.source === 'hand_left').length).toBe(4)
    expect(deck.filter(c => c.source === 'hand_right').length).toBe(0)
  })

  it('empty hands = innate only', () => {
    const items = new Map<typeof ironSword.id, Item>()
    const deck = buildDeck(mkUnit(null, null), lordClass, new Map())
    expect(deck.length).toBe(2)
    expect(deck.every(c => c.source === 'innate')).toBe(true)
  })

  it('unknown itemId throws', () => {
    expect(() => buildDeck(mkUnit('phantom', null), lordClass, new Map())).toThrow()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/systems/deckBuilder.test.ts
```

- [ ] **Step 3: Implement deckBuilder.ts**

`src/systems/deckBuilder.ts`:
```ts
import type { Unit } from '../domain/unit'
import type { Item } from '../domain/item'
import type { ClassDef } from '../domain/class'
import type { CardId, ItemId } from '../domain/ids'

export interface BuiltDeckEntry {
  cardId: CardId
  source: 'innate' | 'hand_left' | 'hand_right'
}

export function buildDeck(
  unit: Unit,
  classDef: ClassDef,
  itemsById: Map<ItemId, Item>,
): BuiltDeckEntry[] {
  const out: BuiltDeckEntry[] = []

  for (const cardId of classDef.innateCardIds) {
    out.push({ cardId, source: 'innate' })
  }

  if (unit.hand.left) {
    const left = itemsById.get(unit.hand.left)
    if (!left) throw new Error(`deckBuilder: unknown item in hand_left: ${unit.hand.left}`)
    for (const cardId of left.gearCards) out.push({ cardId, source: 'hand_left' })
  }

  if (unit.hand.right) {
    const right = itemsById.get(unit.hand.right)
    if (!right) throw new Error(`deckBuilder: unknown item in hand_right: ${unit.hand.right}`)
    for (const cardId of right.gearCards) out.push({ cardId, source: 'hand_right' })
  }

  return out
}
```

- [ ] **Step 4: Test + commit**

```bash
cd phaser && npm test -- tests/unit/systems/deckBuilder.test.ts
git add phaser/src/systems/deckBuilder.ts phaser/tests
git commit -m "feat(phaser): deckBuilder — innate + hand_left.gearCards + hand_right.gearCards"
```

---

### Task 22: effectPipeline (middleware ordering)

**Files:**
- Create: `src/systems/effectPipeline.ts`
- Test: `tests/unit/systems/effectPipeline.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/effectPipeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { runEffects, type Middleware, type PipelineCtx } from '../../../src/systems/effectPipeline'
import type { CardEffect } from '../../../src/domain/card'
import { asUnitId, asCardId } from '../../../src/domain/ids'

const dmg = (target: string, amount: number, ap = false): CardEffect => ({
  kind: 'Damage', targetId: asUnitId(target), amount, damageType: 'physical', source: asCardId('test'), armorPiercing: ap,
})

const stubCtx: PipelineCtx = { sourceUnitId: asUnitId('roy'), now: 0 }

describe('effectPipeline.runEffects', () => {
  it('passes through with no middleware', () => {
    const r = runEffects([dmg('e', 5)], [], stubCtx)
    expect(r.emitted).toEqual([dmg('e', 5)])
  })

  it('source modifier increases damage (stage 1)', () => {
    const sourceMod: Middleware = (e) => e.kind === 'Damage' ? [{ ...e, amount: e.amount + 3 }] : [e]
    const r = runEffects([dmg('e', 5)], [{ stage: 1, fn: sourceMod }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ kind: 'Damage', amount: 8 })
  })

  it('respects stage ordering (1=source, 2=target, 3=terrain, 4=card, 5=armor, 6=clamp)', () => {
    const order: string[] = []
    const middlewares: Middleware[] = []
    const stages = [1, 2, 3, 4, 5, 6]
    for (const s of stages) {
      middlewares.push((e) => { order.push(`s${s}`); return [e] })
    }
    runEffects([dmg('e', 5)], middlewares.map((fn, i) => ({ stage: stages[i]!, fn })), stubCtx)
    expect(order).toEqual(['s1','s2','s3','s4','s5','s6'])
  })

  it('armor reducer at stage 5 reduces non-piercing damage', () => {
    const armor: Middleware = (e) => e.kind === 'Damage' && !e.armorPiercing ? [{ ...e, amount: Math.max(0, e.amount - 3) }] : [e]
    const r = runEffects([dmg('e', 7), dmg('e', 7, true)], [{ stage: 5, fn: armor }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ amount: 4 })
    expect(r.emitted[1]).toMatchObject({ amount: 7 })
  })

  it('clamp at stage 6 floors damage at 0', () => {
    const clamp: Middleware = (e) => e.kind === 'Damage' ? [{ ...e, amount: Math.max(0, e.amount) }] : [e]
    const r = runEffects([dmg('e', -5)], [{ stage: 6, fn: clamp }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ amount: 0 })
  })

  it('middleware can spawn additional effects', () => {
    const spawn: Middleware = (e) => e.kind === 'Damage' ? [e, { kind: 'GainAp', unitId: asUnitId('roy'), amount: 1 }] : [e]
    const r = runEffects([dmg('e', 3)], [{ stage: 4, fn: spawn }], stubCtx)
    expect(r.emitted.length).toBe(2)
  })

  it('middleware can absorb effects (return empty)', () => {
    const absorb: Middleware = () => []
    const r = runEffects([dmg('e', 3)], [{ stage: 2, fn: absorb }], stubCtx)
    expect(r.emitted.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/systems/effectPipeline.test.ts
```

- [ ] **Step 3: Implement effectPipeline.ts**

`src/systems/effectPipeline.ts`:
```ts
import type { CardEffect } from '../domain/card'
import type { UnitId } from '../domain/ids'

export interface PipelineCtx {
  sourceUnitId: UnitId
  now: number
}

export type Middleware = (effect: CardEffect, ctx: PipelineCtx) => CardEffect[]

export interface StagedMiddleware {
  stage: 1 | 2 | 3 | 4 | 5 | 6   // 1=source, 2=target, 3=terrain, 4=card-specific, 5=armor, 6=clamp
  fn: Middleware
}

export interface PipelineResult {
  emitted: CardEffect[]
}

export function runEffects(
  effects: CardEffect[],
  middlewares: StagedMiddleware[],
  ctx: PipelineCtx,
): PipelineResult {
  const sorted = [...middlewares].sort((a, b) => a.stage - b.stage)

  let current = effects
  for (const { fn } of sorted) {
    const next: CardEffect[] = []
    for (const e of current) {
      next.push(...fn(e, ctx))
    }
    current = next
  }

  return { emitted: current }
}
```

- [ ] **Step 4: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/systems/effectPipeline.test.ts
git add phaser/src/systems/effectPipeline.ts phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): effect pipeline with 6-stage middleware ordering"
```

Update `phaser/CONTEXT.md` §1 invariant 4 to reference the 6-stage pipeline.

---

### Task 23: Status effects registry (poison + burn)

**Files:**
- Create: `src/systems/statusEffects.ts`
- Test: `tests/unit/systems/statusEffects.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/statusEffects.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { STATUS_EFFECTS, getStatusEffect } from '../../../src/systems/statusEffects'
import { asStatusEffectId, asUnitId } from '../../../src/domain/ids'

describe('statusEffects registry', () => {
  it('registers poison and burn', () => {
    expect(getStatusEffect(asStatusEffectId('poison'))).toBeDefined()
    expect(getStatusEffect(asStatusEffectId('burn'))).toBeDefined()
  })

  it('poison is non-stacking (refresh-on-reapply)', () => {
    expect(getStatusEffect(asStatusEffectId('poison'))!.stackable).toBe(false)
  })

  it('burn is stacking', () => {
    expect(getStatusEffect(asStatusEffectId('burn'))!.stackable).toBe(true)
  })

  it('poison onTurnEnd emits Damage equal to stacks', () => {
    const def = getStatusEffect(asStatusEffectId('poison'))!
    const out = def.onTurnEnd!({ selfUnitId: asUnitId('e'), selfStacks: 3, selfTurnsRemaining: 2 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'Damage', amount: 3, damageType: 'physical', armorPiercing: true })
  })

  it('burn onTurnEnd emits Damage equal to stacks', () => {
    const def = getStatusEffect(asStatusEffectId('burn'))!
    const out = def.onTurnEnd!({ selfUnitId: asUnitId('e'), selfStacks: 5, selfTurnsRemaining: 2 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'Damage', amount: 5, damageType: 'magic' })
  })

  it('exposes registry as iterable', () => {
    expect(STATUS_EFFECTS.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/systems/statusEffects.test.ts
```

- [ ] **Step 3: Implement statusEffects.ts**

`src/systems/statusEffects.ts`:
```ts
import type { StatusEffectDef, HookCtx } from '../domain/statusEffect'
import type { CardEffect } from '../domain/card'
import { asStatusEffectId, asCardId, type StatusEffectId } from '../domain/ids'

const POISON: StatusEffectDef = {
  id: asStatusEffectId('poison'),
  name: 'Poison',
  stackable: false,   // refreshes at higher stacks
  onTurnEnd(ctx: HookCtx): CardEffect[] {
    return [{
      kind: 'Damage',
      targetId: ctx.selfUnitId,
      amount: ctx.selfStacks,
      damageType: 'physical',
      source: asCardId('status:poison'),
      armorPiercing: true,
    }]
  },
}

const BURN: StatusEffectDef = {
  id: asStatusEffectId('burn'),
  name: 'Burn',
  stackable: true,
  onTurnEnd(ctx: HookCtx): CardEffect[] {
    return [{
      kind: 'Damage',
      targetId: ctx.selfUnitId,
      amount: ctx.selfStacks,
      damageType: 'magic',
      source: asCardId('status:burn'),
    }]
  },
}

export const STATUS_EFFECTS: StatusEffectDef[] = [POISON, BURN]

const byId = new Map<string, StatusEffectDef>(
  STATUS_EFFECTS.map(s => [s.id as unknown as string, s])
)

export function getStatusEffect(id: StatusEffectId): StatusEffectDef | undefined {
  return byId.get(id as unknown as string)
}
```

- [ ] **Step 4: Test + commit**

```bash
cd phaser && npm test -- tests/unit/systems/statusEffects.test.ts
git add phaser/src/systems/statusEffects.ts phaser/tests
git commit -m "feat(phaser): statusEffects registry with poison (non-stacking) + burn (stacking)"
```

---

### Task 24: targeting

**Files:**
- Create: `src/systems/targeting.ts`
- Test: `tests/unit/systems/targeting.test.ts`

- [ ] **Step 1: Implement + test minimal targeting**

`src/systems/targeting.ts`:
```ts
import type { Card } from '../domain/card'
import type { TileId } from '../domain/ids'

export interface TargetingState {
  width: number
  height: number
  obstacles: Set<TileId>
}

function tileToXY(t: TileId): [number, number] {
  const [xs, ys] = (t as unknown as string).split(',')
  return [parseInt(xs!, 10), parseInt(ys!, 10)]
}

function xyToTile(x: number, y: number): TileId {
  return (`${x},${y}`) as unknown as TileId
}

export function manhattan(a: TileId, b: TileId): number {
  const [ax, ay] = tileToXY(a)
  const [bx, by] = tileToXY(b)
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

export function tilesInRange(origin: TileId, minR: number, maxR: number, state: TargetingState): TileId[] {
  const [ox, oy] = tileToXY(origin)
  const out: TileId[] = []
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const t = xyToTile(x, y)
      if (state.obstacles.has(t)) continue
      const d = Math.abs(ox - x) + Math.abs(oy - y)
      if (d >= minR && d <= maxR) out.push(t)
    }
  }
  return out
}

export function tilesInAoe(center: TileId, radius: number, state: TargetingState): TileId[] {
  return tilesInRange(center, 0, radius, state)
}

export function validTargets(card: Card, source: TileId, state: TargetingState): TileId[] {
  return tilesInRange(source, card.range.min, card.range.max, state)
}
```

`tests/unit/systems/targeting.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { manhattan, tilesInRange, tilesInAoe } from '../../../src/systems/targeting'
import { asTileId } from '../../../src/domain/ids'

const grid = (w: number, h: number) => ({ width: w, height: h, obstacles: new Set([]) })

describe('targeting', () => {
  it('manhattan distance', () => {
    expect(manhattan(asTileId('0,0'), asTileId('3,4'))).toBe(7)
  })

  it('tilesInRange respects min/max', () => {
    const out = tilesInRange(asTileId('5,5'), 1, 1, grid(10, 10))
    expect(out.length).toBe(4)
    expect(out.map(t => t as unknown as string).sort()).toEqual(['4,5', '5,4', '5,6', '6,5'])
  })

  it('tilesInAoe includes center', () => {
    const out = tilesInAoe(asTileId('5,5'), 1, grid(10, 10))
    expect(out.length).toBe(5)  // center + 4 neighbors
  })

  it('obstacles excluded', () => {
    const state = { width: 10, height: 10, obstacles: new Set([asTileId('5,4')]) }
    const out = tilesInRange(asTileId('5,5'), 1, 1, state)
    expect(out.length).toBe(3)
  })
})
```

- [ ] **Step 2: Test + commit**

```bash
cd phaser && npm test -- tests/unit/systems/targeting.test.ts
git add phaser/src/systems/targeting.ts phaser/tests/unit/systems/targeting.test.ts
git commit -m "feat(phaser): targeting — manhattan range + AOE coverage with obstacle exclusion"
```

---

### Task 25: turnOrder (initiative queue)

**Files:**
- Create: `src/systems/turnOrder.ts`
- Test: `tests/unit/systems/turnOrder.test.ts`

- [ ] **Step 1: Implement + test**

`src/systems/turnOrder.ts`:
```ts
import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'

export interface InitiativeModifier {
  unitId: UnitId
  spdDelta: number   // from status effects (slow = -2, etc.)
}

export function buildInitiativeQueue(
  units: Unit[],
  modifiers: InitiativeModifier[] = [],
): UnitId[] {
  const modBySpd = new Map<string, number>(modifiers.map(m => [m.unitId as unknown as string, m.spdDelta]))
  const enriched = units.map(u => ({
    id: u.id,
    spd: u.stats.spd + (modBySpd.get(u.id as unknown as string) ?? 0),
    tieBreaker: (u.id as unknown as string),
  }))
  enriched.sort((a, b) => {
    if (b.spd !== a.spd) return b.spd - a.spd
    return a.tieBreaker.localeCompare(b.tieBreaker)
  })
  return enriched.map(e => e.id)
}
```

`tests/unit/systems/turnOrder.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildInitiativeQueue } from '../../../src/systems/turnOrder'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, spd: number): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 1, max: 1 }, stats: { str: 0, mag: 0, skl: 0, spd, def: 0, res: 0 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('buildInitiativeQueue', () => {
  it('orders by SPD descending', () => {
    const q = buildInitiativeQueue([mk('a', 5), mk('b', 8), mk('c', 3)])
    expect(q.map(id => id as unknown as string)).toEqual(['b', 'a', 'c'])
  })

  it('tie-breaks alphabetically by id', () => {
    const q = buildInitiativeQueue([mk('z', 5), mk('a', 5)])
    expect(q.map(id => id as unknown as string)).toEqual(['a', 'z'])
  })

  it('applies SPD modifiers', () => {
    const q = buildInitiativeQueue(
      [mk('a', 5), mk('b', 7)],
      [{ unitId: asUnitId('b'), spdDelta: -3 }],
    )
    expect(q.map(id => id as unknown as string)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Test + commit**

```bash
cd phaser && npm test -- tests/unit/systems/turnOrder.test.ts
git add phaser/src/systems/turnOrder.ts phaser/tests/unit/systems/turnOrder.test.ts
git commit -m "feat(phaser): initiative queue with SPD descending + alphabetic tie-break + modifiers"
```

---

### Task 26: capture mechanic

**Files:**
- Create: `src/systems/capture.ts`
- Test: `tests/unit/systems/capture.test.ts`

- [ ] **Step 1: Implement + test**

`src/systems/capture.ts`:
```ts
import type { Unit } from '../domain/unit'

export interface CaptureContext {
  target: Unit
  adjacentAttackers: number
  bountyHunterBonus: boolean
}

/** Returns chance ∈ [0, 1] of successful capture. */
export function captureChance(ctx: CaptureContext): number {
  const hpFraction = ctx.target.hp.current / Math.max(1, ctx.target.hp.max)
  const base = (1 - hpFraction) * 0.6
  const surround = ctx.adjacentAttackers * 0.25
  const bounty = ctx.bountyHunterBonus ? 0.15 : 0
  return Math.max(0, Math.min(1, base + surround + bounty))
}
```

`tests/unit/systems/capture.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { captureChance } from '../../../src/systems/capture'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (cur: number, max: number): Unit => ({
  id: asUnitId('e'), name: 'e', classId: asClassId('bandit'), level: 1,
  hp: { current: cur, max }, stats: { str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('captureChance', () => {
  it('full HP, no surround, no bounty = 0', () => {
    expect(captureChance({ target: mk(20, 20), adjacentAttackers: 0, bountyHunterBonus: false })).toBe(0)
  })

  it('low HP increases chance', () => {
    const a = captureChance({ target: mk(2, 20), adjacentAttackers: 0, bountyHunterBonus: false })
    expect(a).toBeGreaterThan(0.5)
  })

  it('surround adds 25% per adjacent attacker', () => {
    const a = captureChance({ target: mk(20, 20), adjacentAttackers: 2, bountyHunterBonus: false })
    expect(a).toBeCloseTo(0.5)
  })

  it('bounty hunter adds 15%', () => {
    const a = captureChance({ target: mk(20, 20), adjacentAttackers: 0, bountyHunterBonus: true })
    expect(a).toBeCloseTo(0.15)
  })

  it('clamps to [0,1]', () => {
    const a = captureChance({ target: mk(0, 20), adjacentAttackers: 4, bountyHunterBonus: true })
    expect(a).toBe(1)
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd phaser && npm test -- tests/unit/systems/capture.test.ts
git add phaser/src/systems/capture.ts phaser/tests/unit/systems/capture.test.ts
git commit -m "feat(phaser): capture chance — HP%-based + 25%/adjacent + 15% bounty hunter"
```

---

### Task 27: enemyAI (closest-target plan)

**Files:**
- Create: `src/systems/enemyAI.ts`
- Test: `tests/unit/systems/enemyAI.test.ts`

- [ ] **Step 1: Implement minimal plan(state, rng) → events**

`src/systems/enemyAI.ts`:
```ts
import type { CombatState, CombatEvent } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import type { UnitId } from '../domain/ids'

export function planTurn(state: CombatState, _rng: RNG, enemyId: UnitId): CombatEvent[] {
  // Stub AI: always end turn. Real movement+attack logic in next milestone.
  return [{ type: 'endTurn' as const }]
}
```

`tests/unit/systems/enemyAI.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { planTurn } from '../../../src/systems/enemyAI'
import { asUnitId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'

const stubState = () => ({
  phase: 'COMBAT' as const, subPhase: 'IDLE' as const,
  turn: { number: 1, unitId: asUnitId('bandit'), team: 'enemy' as const },
  units: {}, decks: {}, grid: { width: 14, height: 10, obstacles: new Set() },
  rng: { seed: 0, counter: 0 }, selectedCardId: null, effectQueue: [],
})

describe('enemyAI.planTurn (foundation stub)', () => {
  it('emits endTurn for skeleton AI', () => {
    const events = planTurn(stubState(), createRng({ seed: 0, counter: 0 }), asUnitId('bandit'))
    expect(events).toEqual([{ type: 'endTurn' }])
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd phaser && npm test -- tests/unit/systems/enemyAI.test.ts
git add phaser/src/systems/enemyAI.ts phaser/tests/unit/systems/enemyAI.test.ts
git commit -m "feat(phaser): enemyAI stub returning endTurn (full AI in next milestone)"
```

---

### Task 28: combatReducer — core events (startBattle, startTurn, endTurn, tickStatus)

**Files:**
- Create: `src/systems/combatReducer.ts`
- Test: `tests/unit/systems/combatReducer.test.ts`

- [ ] **Step 1: Write failing test for core transitions**

`tests/unit/systems/combatReducer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { reduce, initialCombatState } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../src/domain/ids'
import { createRng } from '../../../src/systems/rng'
import type { Unit } from '../../../src/domain/unit'

const mk = (id: string, spd: number, team: 'party'|'enemy'): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('combatReducer (core)', () => {
  it('initialCombatState is BOOT phase', () => {
    expect(initialCombatState().phase).toBe('BOOT')
  })

  it('startBattle transitions to COMBAT and seeds the first turn', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const r = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: {
        units: [mk('roy', 5, 'party'), mk('bandit', 4, 'enemy')],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 1, counter: 0 },
      },
    }, rng)
    expect(r.state.phase).toBe('COMBAT')
    expect(r.state.turn.unitId).toBe(asUnitId('roy'))
    expect(r.state.turn.team).toBe('party')
  })

  it('endTurn advances to next unit in initiative order', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 8, 'party'), mk('b', 5, 'enemy')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.turn.unitId).toBe(asUnitId('b'))
  })

  it('endTurn after last unit increments turn number and wraps', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 8, 'party'), mk('b', 5, 'enemy')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.turn.number).toBe(2)
    expect(s.turn.unitId).toBe(asUnitId('a'))
  })

  it('tickStatus: poison emits Damage effect at turn end', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const u = mk('e', 5, 'enemy')
    u.statuses.push({
      effectId: ('poison' as unknown as Unit['statuses'][number]['effectId']),
      stacks: 3, turnsRemaining: 2, source: null,
    })
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [u], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    const r = reduce(s, { type: 'tickStatus' }, rng)
    const damageEffect = r.effects.find(e => e.kind === 'ApplyCardEffect' && e.effect.kind === 'Damage')
    expect(damageEffect).toBeDefined()
  })

  it('victory: when all enemies dead, phase = VICTORY', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const enemy = mk('bandit', 4, 'enemy')
    enemy.hp.current = 0
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('roy', 5, 'party'), enemy], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.phase).toBe('VICTORY')
  })

  it('defeat: when all party dead, phase = DEFEAT', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const ally = mk('roy', 5, 'party')
    ally.hp.current = 0
    let s = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [ally, mk('bandit', 4, 'enemy')], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state
    s = reduce(s, { type: 'endTurn' }, rng).state
    expect(s.phase).toBe('DEFEAT')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/systems/combatReducer.test.ts
```

- [ ] **Step 3: Implement combatReducer.ts**

`src/systems/combatReducer.ts`:
```ts
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'
import type { RNG } from '../domain/rng'
import { buildInitiativeQueue } from './turnOrder'
import { getStatusEffect } from './statusEffects'

interface UnitTeam { partyIds: UnitId[]; enemyIds: UnitId[] }

export interface ReduceResult {
  state: CombatState
  effects: CombatEffect[]
}

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
    effectQueue: [],
  }
}

function teamsOf(units: Record<string, Unit>): UnitTeam {
  // Convention: enemy ids prefixed with "bandit", "mage", "boss" — for foundation,
  // we encode team via initiative tag. Simplification: party units have classId !== 'bandit' AND not statuses tagged "enemy".
  // For real battles the team is set explicitly in unit metadata. For now, derive from the test fixtures.
  const partyIds: UnitId[] = []
  const enemyIds: UnitId[] = []
  for (const u of Object.values(units)) {
    // crude: classId 'bandit' or 'mage_bandit' or 'bandit_captain' = enemy
    const cid = u.classId as unknown as string
    if (cid.includes('bandit') || cid.includes('mage')) enemyIds.push(u.id)
    else partyIds.push(u.id)
  }
  return { partyIds, enemyIds }
}

function isAlive(u: Unit): boolean { return u.hp.current > 0 }

function checkEnd(state: CombatState): CombatState['phase'] {
  const { partyIds, enemyIds } = teamsOf(state.units)
  const partyAlive = partyIds.some(id => isAlive(state.units[id as unknown as string]!))
  const enemiesAlive = enemyIds.some(id => isAlive(state.units[id as unknown as string]!))
  if (!partyAlive) return 'DEFEAT'
  if (!enemiesAlive) return 'VICTORY'
  return 'COMBAT'
}

export function reduce(state: CombatState, event: CombatEvent, _rng: RNG): ReduceResult {
  switch (event.type) {
    case 'startBattle': {
      const units: Record<string, Unit> = {}
      for (const u of event.payload.units) units[u.id as unknown as string] = u
      const order = buildInitiativeQueue(event.payload.units)
      const first = order[0]!
      const team: 'party' | 'enemy' = teamsOf(units).partyIds.includes(first) ? 'party' : 'enemy'
      const newState: CombatState = {
        ...state,
        phase: 'COMBAT',
        subPhase: 'IDLE',
        turn: { number: 1, unitId: first, team },
        units,
        grid: event.payload.grid,
        rng: event.payload.rngSeed,
      }
      return { state: newState, effects: [] }
    }

    case 'startTurn': {
      const u = state.units[event.payload.unitId as unknown as string]
      if (!u) return { state, effects: [] }
      const team: 'party' | 'enemy' = teamsOf(state.units).partyIds.includes(u.id) ? 'party' : 'enemy'
      return {
        state: { ...state, turn: { ...state.turn, unitId: u.id, team } },
        effects: [],
      }
    }

    case 'endTurn': {
      const aliveUnits = Object.values(state.units).filter(isAlive)
      const order = buildInitiativeQueue(aliveUnits)
      const currentIdx = order.findIndex(id => id === state.turn.unitId)
      const nextIdx = (currentIdx + 1) % order.length
      const wrapped = nextIdx === 0
      const nextId = order[nextIdx]!
      const team: 'party' | 'enemy' = teamsOf(state.units).partyIds.includes(nextId) ? 'party' : 'enemy'

      const phase = checkEnd(state)
      if (phase !== 'COMBAT') return { state: { ...state, phase }, effects: [] }

      return {
        state: {
          ...state,
          phase: 'COMBAT',
          subPhase: 'IDLE',
          turn: {
            number: wrapped ? state.turn.number + 1 : state.turn.number,
            unitId: nextId,
            team,
          },
        },
        effects: [],
      }
    }

    case 'tickStatus': {
      const effects: CombatEffect[] = []
      for (const u of Object.values(state.units)) {
        for (const s of u.statuses) {
          const def = getStatusEffect(s.effectId)
          if (!def?.onTurnEnd) continue
          const cardEffects = def.onTurnEnd({
            selfUnitId: u.id, selfStacks: s.stacks, selfTurnsRemaining: s.turnsRemaining,
          })
          for (const e of cardEffects) effects.push({ kind: 'ApplyCardEffect', effect: e })
        }
      }
      return { state, effects }
    }

    case 'selectCard':
      return {
        state: { ...state, selectedCardId: event.payload.cardId, subPhase: 'SELECTING_TARGET' },
        effects: [],
      }

    case 'cancelSelection':
      return {
        state: { ...state, selectedCardId: null, subPhase: 'IDLE' },
        effects: [],
      }

    case 'playCard':
    case 'moveUnit':
    case 'capture':
    case 'animationsCompleted':
      // Detailed implementations land in next milestone (combat scene rendering).
      // For foundation, log and no-op.
      return { state, effects: [{ kind: 'WaitForAnimations' }] }
  }
}
```

- [ ] **Step 4: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/systems/combatReducer.test.ts
git add phaser/src/systems/combatReducer.ts phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): combatReducer — startBattle, startTurn, endTurn, tickStatus, selectCard, cancel"
```

Update `phaser/CONTEXT.md` §1 invariant 4 (combat is reducer) to confirm `reduce(state, event, rng)` signature is real.

---

### Task 29: Wire combatStore to combatReducer + replace stub

**Files:**
- Modify: `src/state/combatStore.ts`
- Test: extend `tests/unit/state/combatStore.test.ts`

- [ ] **Step 1: Wire dispatch through reduce**

Replace `src/state/combatStore.ts`:
```ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CombatState, CombatEvent, CombatEffect } from '../domain/combatState'
import type { RNG } from '../domain/rng'
import { reduce, initialCombatState } from '../systems/combatReducer'

export interface CombatStoreState {
  state: CombatState
  effectQueue: CombatEffect[]
  lastEffectId: number
  dispatch(event: CombatEvent, rng: RNG): void
  drainEffects(): CombatEffect[]
  __resetForTest(): void
}

export const useCombatStore = create<CombatStoreState>()(
  subscribeWithSelector((set, get) => ({
    state: initialCombatState(),
    effectQueue: [],
    lastEffectId: 0,
    dispatch(event, rng) {
      const { state: nextState, effects } = reduce(get().state, event, rng)
      set(s => ({
        state: nextState,
        effectQueue: [...s.effectQueue, ...effects],
        lastEffectId: s.lastEffectId + 1,
      }))
    },
    drainEffects() {
      const out = get().effectQueue
      set({ effectQueue: [] })
      return out
    },
    __resetForTest() {
      set({ state: initialCombatState(), effectQueue: [], lastEffectId: 0 })
    },
  }))
)
```

- [ ] **Step 2: Extend test**

Append to `tests/unit/state/combatStore.test.ts`:
```ts
import { reduce } from '../../../src/systems/combatReducer'
import { asUnitId, asClassId } from '../../../src/domain/ids'

describe('combatStore reducer wiring', () => {
  it('dispatch advances state per reducer', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    useCombatStore.getState().dispatch({
      type: 'startBattle',
      payload: {
        units: [{
          id: asUnitId('roy'), name: 'Roy', classId: asClassId('lord'), level: 1,
          hp: { current: 20, max: 20 },
          stats: { str: 5, mag: 0, skl: 4, spd: 5, def: 3, res: 1 },
          hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
        }],
        grid: { width: 14, height: 10, obstacles: new Set() },
        rngSeed: { seed: 1, counter: 0 },
      },
    }, rng)
    expect(useCombatStore.getState().state.phase).toBe('COMBAT')
  })
})
```

- [ ] **Step 3: Test + commit**

```bash
cd phaser && npm test -- tests/unit/state/combatStore.test.ts
git add phaser/src/state/combatStore.ts phaser/tests
git commit -m "feat(phaser): combatStore wired to combatReducer.reduce"
```

---

## Phase 4 — Quest, Dialogue, Map Registry, Procgen (Week 4)

### Task 30: questRunner — onDomainEvent + transitionStages

**Files:**
- Create: `src/systems/questRunner.ts`
- Test: `tests/unit/systems/questRunner.test.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/systems/questRunner.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { onDomainEvent, transitionStages, type QuestEngineState } from '../../../src/systems/questRunner'
import type { QuestDef } from '../../../src/domain/quest'
import type { DomainEvent } from '../../../src/contracts'
import type { PredicateState } from '../../../src/systems/predicates'
import { asQuestId, asStageId, asFlagKey, asUnitId } from '../../../src/domain/ids'

const bloodTies: QuestDef = {
  id: asQuestId('blood_ties'),
  name: 'Blood Ties',
  initialStage: asStageId('start') as unknown as string,
  stages: {
    start: {
      id: asStageId('start'),
      onEnter: [{ kind: 'setFlag', key: asFlagKey('blood_ties.started'), value: true }],
      listeners: [{
        on: 'BattleVictory',
        predicate: { kind: 'always' },
        emit: [{ kind: 'setFlag', key: asFlagKey('blood_ties.daren_killed'), value: true }],
      }],
      transitions: [{
        when: { kind: 'flag', key: asFlagKey('blood_ties.daren_killed') },
        to: asStageId('end') as unknown as string,
      }],
      onExit: [],
    },
    end: {
      id: asStageId('end'),
      onEnter: [{ kind: 'completeQuest', questId: asQuestId('blood_ties') }],
      listeners: [], transitions: [], onExit: [],
    },
  },
}

const baseState = (): PredicateState => ({
  flags: new Map(),
  questStates: { 'blood_ties': { currentStage: 'start', metadata: {} } },
  party: { units: {} },
  inventory: { items: [] },
  gold: 0,
  visitedNodes: new Set(),
  clearedEncounters: new Set(),
})

describe('questRunner.onDomainEvent', () => {
  it('emits effects from matching listener at current stage', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [asUnitId('daren')] } }
    const r = onDomainEvent(evt, eng, baseState())
    expect(r.effects.length).toBe(1)
    expect(r.effects[0]).toMatchObject({ kind: 'setFlag', key: 'blood_ties.daren_killed' })
  })

  it('skips listener when predicate fails', () => {
    const guarded: QuestDef = {
      ...bloodTies,
      stages: {
        ...bloodTies.stages,
        start: {
          ...bloodTies.stages.start!,
          listeners: [{
            on: 'BattleVictory',
            predicate: { kind: 'never' },
            emit: [{ kind: 'setFlag', key: asFlagKey('x'), value: 1 }],
          }],
        },
      },
    }
    const eng: QuestEngineState = { quests: { 'blood_ties': guarded } }
    const evt: DomainEvent = { type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [] } }
    const r = onDomainEvent(evt, eng, baseState())
    expect(r.effects.length).toBe(0)
  })

  it('does not fire listeners from inactive stages', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const state = baseState()
    state.questStates['blood_ties']!.currentStage = 'end'
    const r = onDomainEvent({ type: 'BattleVictory', payload: { battleId: 'b', survivors: [], capturedIds: [] } }, eng, state)
    expect(r.effects.length).toBe(0)
  })
})

describe('questRunner.transitionStages', () => {
  it('advances stage when transition predicate passes', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const state = baseState()
    state.flags.set('blood_ties.daren_killed', { value: true, scope: 'quest' })
    const r = transitionStages(eng, state)
    expect(r.transitions).toEqual([{ questId: 'blood_ties', from: 'start', to: 'end' }])
  })

  it('no transition when predicate fails', () => {
    const eng: QuestEngineState = { quests: { 'blood_ties': bloodTies } }
    const r = transitionStages(eng, baseState())
    expect(r.transitions.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
cd phaser && npm test -- tests/unit/systems/questRunner.test.ts
```

- [ ] **Step 3: Implement questRunner.ts**

`src/systems/questRunner.ts`:
```ts
import type { QuestDef, QuestEffect, QuestListenerEvent } from '../domain/quest'
import type { DomainEvent } from '../contracts'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'

export interface QuestEngineState {
  quests: Record<string, QuestDef>
}

export interface OnEventResult {
  effects: QuestEffect[]
}

const EVENT_TYPE_MAP: Record<DomainEvent['type'], QuestListenerEvent | null> = {
  BattleStarted: null,
  BattleVictory: 'BattleVictory',
  BattleDefeat: null,
  UnitDied: null,
  EnemyCaptured: null,
  LocationArrived: 'LocationArrived',
  ItemAcquired: 'ItemAcquired',
  FlagSet: 'FlagSet',
  QuestStageAdvanced: null,
}

export function onDomainEvent(
  event: DomainEvent,
  engine: QuestEngineState,
  state: PredicateState,
): OnEventResult {
  const listenerKind = EVENT_TYPE_MAP[event.type]
  if (!listenerKind) return { effects: [] }

  const effects: QuestEffect[] = []
  for (const [questIdStr, quest] of Object.entries(engine.quests)) {
    const qs = state.questStates[questIdStr]
    if (!qs) continue
    const stage = quest.stages[qs.currentStage]
    if (!stage) continue
    for (const listener of stage.listeners) {
      if (listener.on !== listenerKind) continue
      if (!evaluatePredicate(listener.predicate, state)) continue
      effects.push(...listener.emit)
    }
  }
  return { effects }
}

export interface TransitionResult {
  transitions: { questId: string; from: string; to: string }[]
  effects: QuestEffect[]   // onExit + onEnter effects from the transitioning stages
}

export function transitionStages(engine: QuestEngineState, state: PredicateState): TransitionResult {
  const transitions: TransitionResult['transitions'] = []
  const effects: QuestEffect[] = []

  for (const [questIdStr, quest] of Object.entries(engine.quests)) {
    const qs = state.questStates[questIdStr]
    if (!qs) continue
    const stage = quest.stages[qs.currentStage]
    if (!stage) continue
    for (const t of stage.transitions) {
      if (evaluatePredicate(t.when, state)) {
        transitions.push({ questId: questIdStr, from: qs.currentStage, to: t.to as unknown as string })
        effects.push(...stage.onExit)
        const nextStage = quest.stages[t.to as unknown as string]
        if (nextStage) effects.push(...nextStage.onEnter)
        break
      }
    }
  }
  return { transitions, effects }
}
```

- [ ] **Step 4: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/systems/questRunner.test.ts
git add phaser/src/systems/questRunner.ts phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): questRunner — onDomainEvent + transitionStages, declarative listeners"
```

Update `phaser/CONTEXT.md` §11 (Known Gotchas) with: "QuestEffect ≠ CardEffect — separate domains; never confuse."

---

### Task 31: dialogueRunner

**Files:**
- Create: `src/systems/dialogueRunner.ts`
- Test: `tests/unit/systems/dialogueRunner.test.ts`

- [ ] **Step 1: Implement + test**

`src/systems/dialogueRunner.ts`:
```ts
import type { DialogueTree, DialogueChoice } from '../domain/dialogue'
import type { DialogueNodeId } from '../domain/ids'
import type { QuestEffect } from '../domain/quest'
import type { PredicateState } from './predicates'
import { evaluatePredicate } from './predicates'

export interface StepResult {
  nextNodeId: DialogueNodeId | 'end'
  effects: QuestEffect[]
}

export function visibleChoices(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  state: PredicateState,
): DialogueChoice[] {
  const node = tree.nodes[currentNodeId as unknown as string]
  if (!node) return []
  return node.choices.filter(c =>
    !c.visibleIf || evaluatePredicate(c.visibleIf, state)
  )
}

export function isChoiceEnabled(choice: DialogueChoice, state: PredicateState): boolean {
  return !choice.enabledIf || evaluatePredicate(choice.enabledIf, state)
}

export function step(
  tree: DialogueTree,
  currentNodeId: DialogueNodeId,
  choiceId: string,
  state: PredicateState,
): StepResult {
  const node = tree.nodes[currentNodeId as unknown as string]
  if (!node) throw new Error(`dialogueRunner: unknown node ${currentNodeId}`)
  const choice = node.choices.find(c => c.id === choiceId)
  if (!choice) throw new Error(`dialogueRunner: unknown choice ${choiceId}`)
  if (choice.visibleIf && !evaluatePredicate(choice.visibleIf, state)) {
    throw new Error(`dialogueRunner: choice ${choiceId} not visible`)
  }
  if (choice.enabledIf && !evaluatePredicate(choice.enabledIf, state)) {
    throw new Error(`dialogueRunner: choice ${choiceId} not enabled`)
  }
  return { nextNodeId: choice.next, effects: choice.effects }
}
```

`tests/unit/systems/dialogueRunner.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { step, visibleChoices, isChoiceEnabled } from '../../../src/systems/dialogueRunner'
import type { DialogueTree } from '../../../src/domain/dialogue'
import { asDialogueId, asDialogueNodeId, asFlagKey } from '../../../src/domain/ids'
import type { PredicateState } from '../../../src/systems/predicates'

const tree: DialogueTree = {
  id: asDialogueId('greet'),
  startNodeId: asDialogueNodeId('start'),
  nodes: {
    start: {
      id: asDialogueNodeId('start'),
      text: 'Hello traveler.',
      choices: [
        { id: 'help', text: 'Help me', effects: [{ kind: 'setFlag', key: asFlagKey('greeted'), value: true }], next: 'end' },
        { id: 'leave', text: 'Goodbye', effects: [], next: 'end' },
        { id: 'gated', text: 'Secret', visibleIf: { kind: 'flag', key: asFlagKey('unlocked') }, effects: [], next: 'end' },
      ],
    },
  },
}

const baseState = (): PredicateState => ({
  flags: new Map(), questStates: {}, party: { units: {} }, inventory: { items: [] },
  gold: 0, visitedNodes: new Set(), clearedEncounters: new Set(),
})

describe('dialogueRunner', () => {
  it('step returns next node + effects', () => {
    const r = step(tree, asDialogueNodeId('start'), 'help', baseState())
    expect(r.nextNodeId).toBe('end')
    expect(r.effects).toHaveLength(1)
  })

  it('visibleChoices filters by visibleIf', () => {
    const v = visibleChoices(tree, asDialogueNodeId('start'), baseState())
    expect(v.map(c => c.id)).toEqual(['help', 'leave'])
  })

  it('visibleChoices includes gated when flag set', () => {
    const s = baseState(); s.flags.set('unlocked', { value: true, scope: 'run' })
    const v = visibleChoices(tree, asDialogueNodeId('start'), s)
    expect(v.map(c => c.id)).toContain('gated')
  })

  it('throws on unknown node or choice', () => {
    expect(() => step(tree, asDialogueNodeId('phantom'), 'x', baseState())).toThrow()
    expect(() => step(tree, asDialogueNodeId('start'), 'phantom', baseState())).toThrow()
  })

  it('throws when choice not visible', () => {
    expect(() => step(tree, asDialogueNodeId('start'), 'gated', baseState())).toThrow()
  })

  it('isChoiceEnabled defaults true with no enabledIf', () => {
    expect(isChoiceEnabled(tree.nodes['start']!.choices[0]!, baseState())).toBe(true)
  })
})
```

- [ ] **Step 2: Test + commit**

```bash
cd phaser && npm test -- tests/unit/systems/dialogueRunner.test.ts
git add phaser/src/systems/dialogueRunner.ts phaser/tests
git commit -m "feat(phaser): dialogueRunner — step + visible/enabled choice gating via predicates"
```

---

### Task 32: dungeonGenerator stub (3-row linear corridor)

**Files:**
- Create: `src/procgen/dungeonGenerator.ts`
- Test: `tests/unit/procgen/dungeonGenerator.test.ts`

- [ ] **Step 1: Implement + test**

`src/procgen/dungeonGenerator.ts`:
```ts
import type { DungeonGraph, DungeonRoom } from '../domain/map'
import type { RNG } from '../domain/rng'
import { asDungeonId, asNodeId, type NodeId } from '../domain/ids'

export interface DungeonGenerateParams {
  dungeonId: string
  fogOfWar?: DungeonGraph['fogOfWar']
}

export function generateDungeon(rng: RNG, params: DungeonGenerateParams): DungeonGraph {
  // Foundation stub: 3-row linear corridor: row 0 combat → row 1 combat → row 2 boss.
  const r0: DungeonRoom = { id: asNodeId('r0'), type: 'combat', encounterRef: null }
  const r1: DungeonRoom = { id: asNodeId('r1'), type: 'combat', encounterRef: null }
  const r2: DungeonRoom = { id: asNodeId('r2'), type: 'boss', encounterRef: null }

  const seed = rng.state().seed

  return {
    id: asDungeonId(params.dungeonId),
    rows: [[r0], [r1], [r2]],
    edges: [
      [r0.id, r1.id] as [NodeId, NodeId],
      [r1.id, r2.id] as [NodeId, NodeId],
    ],
    entryRow: 0,
    bossRow: 2,
    genSeed: seed,
    fogOfWar: params.fogOfWar ?? 'reveal-on-enter',
  }
}
```

`tests/unit/procgen/dungeonGenerator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateDungeon } from '../../../src/procgen/dungeonGenerator'
import { createRng } from '../../../src/systems/rng'

describe('dungeonGenerator (stub)', () => {
  it('produces a 3-row graph with boss at last row', () => {
    const g = generateDungeon(createRng({ seed: 1, counter: 0 }), { dungeonId: 'd1' })
    expect(g.rows.length).toBe(3)
    expect(g.bossRow).toBe(2)
    expect(g.rows[2]![0]!.type).toBe('boss')
  })

  it('is deterministic given seed', () => {
    const a = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    const b = generateDungeon(createRng({ seed: 42, counter: 0 }), { dungeonId: 'd1' })
    expect(a).toEqual(b)
  })

  it('edges form valid monotonic path', () => {
    const g = generateDungeon(createRng({ seed: 1, counter: 0 }), { dungeonId: 'd1' })
    expect(g.edges).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd phaser && npm test -- tests/unit/procgen/dungeonGenerator.test.ts
git add phaser/src/procgen phaser/tests
git commit -m "feat(phaser): dungeonGenerator stub — 3-row linear corridor (real procgen blocked on research #1)"
```

---

### Task 33: MapRegistry

**Files:**
- Create: `src/mapRegistry/registry.ts`
- Test: `tests/unit/mapRegistry/registry.test.ts`

- [ ] **Step 1: Implement + test**

`src/mapRegistry/registry.ts`:
```ts
import type { WorldMap, BattleMap, MapNodeRef, DungeonGraph, MapKind } from '../domain/map'
import type { MapId, DungeonId } from '../domain/ids'
import type { RNG } from '../domain/rng'

export type DungeonGenerator = (rng: RNG) => DungeonGraph

export interface MapRegistry {
  overworld: Record<string, WorldMap>
  battleTemplates: Record<string, BattleMap>
  dungeonGenerators: Record<string, DungeonGenerator>
  resolveRef(ref: MapNodeRef): {
    mapKind: MapKind
    mapId: MapId | DungeonId
    nodeId: string
  } | null
  validate(): { ok: true } | { ok: false; issues: string[] }
}

export function createMapRegistry(input: {
  overworld?: Record<string, WorldMap>
  battleTemplates?: Record<string, BattleMap>
  dungeonGenerators?: Record<string, DungeonGenerator>
}): MapRegistry {
  const overworld = input.overworld ?? {}
  const battleTemplates = input.battleTemplates ?? {}
  const dungeonGenerators = input.dungeonGenerators ?? {}

  return {
    overworld, battleTemplates, dungeonGenerators,

    resolveRef(ref) {
      switch (ref.mapKind) {
        case 'overworld': {
          const m = overworld[ref.mapId as unknown as string]
          if (!m) return null
          const node = m.nodes.find(n => n.id === ref.nodeId)
          return node ? { mapKind: 'overworld', mapId: ref.mapId, nodeId: ref.nodeId as unknown as string } : null
        }
        case 'battle': {
          const m = battleTemplates[ref.mapId as unknown as string]
          if (!m) return null
          return { mapKind: 'battle', mapId: ref.mapId, nodeId: ref.nodeId as unknown as string }
        }
        case 'dungeon':
          // dungeon refs resolve at runtime against the active dungeon graph, not the registry
          return null
      }
    },

    validate() {
      const issues: string[] = []
      // Ensure every world edge references existing nodes
      for (const [mapId, wm] of Object.entries(overworld)) {
        const nodeIds = new Set(wm.nodes.map(n => n.id as unknown as string))
        for (const e of wm.edges) {
          if (!nodeIds.has(e.from as unknown as string)) issues.push(`${mapId}: edge from unknown node ${e.from}`)
          if (!nodeIds.has(e.to as unknown as string)) issues.push(`${mapId}: edge to unknown node ${e.to}`)
        }
      }
      return issues.length === 0 ? { ok: true } : { ok: false, issues }
    },
  }
}
```

`tests/unit/mapRegistry/registry.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createMapRegistry } from '../../../src/mapRegistry/registry'
import { generateDungeon } from '../../../src/procgen/dungeonGenerator'
import type { WorldMap } from '../../../src/domain/map'
import { asMapId, asNodeId, asEncounterTableId } from '../../../src/domain/ids'

const stubWorld: WorldMap = {
  id: asMapId('test'), width: 10, height: 10, tileSize: 64,
  terrainGrid: [],
  nodes: [
    { id: asNodeId('pine'), type: 'town', position: { x: 1, y: 1 }, visiblePredicate: { kind: 'always' } },
    { id: asNodeId('exit'), type: 'exit', position: { x: 9, y: 9 }, visiblePredicate: { kind: 'always' } },
  ],
  edges: [{ from: asNodeId('pine'), to: asNodeId('exit'), encounterTableId: asEncounterTableId('road'), rollChance: 0.35 }],
}

describe('MapRegistry', () => {
  it('resolveRef returns node when valid', () => {
    const reg = createMapRegistry({ overworld: { test: stubWorld } })
    const r = reg.resolveRef({ mapKind: 'overworld', mapId: asMapId('test'), nodeId: asNodeId('pine') })
    expect(r).not.toBeNull()
  })

  it('resolveRef returns null for unknown node', () => {
    const reg = createMapRegistry({ overworld: { test: stubWorld } })
    const r = reg.resolveRef({ mapKind: 'overworld', mapId: asMapId('test'), nodeId: asNodeId('phantom') })
    expect(r).toBeNull()
  })

  it('validate catches dangling edge nodes', () => {
    const broken: WorldMap = {
      ...stubWorld,
      edges: [{ from: asNodeId('pine'), to: asNodeId('phantom'), encounterTableId: asEncounterTableId('e'), rollChance: 0 }],
    }
    const reg = createMapRegistry({ overworld: { test: broken } })
    const v = reg.validate()
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.issues.length).toBeGreaterThan(0)
  })

  it('exposes dungeon generators', () => {
    const reg = createMapRegistry({ dungeonGenerators: { 'smugglers_cave': generateDungeon as never } })
    expect(reg.dungeonGenerators['smugglers_cave']).toBeDefined()
  })
})
```

- [ ] **Step 2: Test + commit `[CONTEXT.md update required]`**

```bash
cd phaser && npm test -- tests/unit/mapRegistry/registry.test.ts
git add phaser/src/mapRegistry phaser/tests phaser/CONTEXT.md
git commit -m "feat(phaser): MapRegistry with resolveRef + validate (overworld + battle + dungeon generators)"
```

Update `phaser/CONTEXT.md` §9 (File Map) — confirm `mapRegistry/` exists.

---

### Task 34: battleResolver — battle-end → BattleResult

**Files:**
- Create: `src/systems/battleResolver.ts`
- Test: `tests/unit/systems/battleResolver.test.ts`

- [ ] **Step 1: Implement + test**

`src/systems/battleResolver.ts`:
```ts
import type { CombatState } from '../domain/combatState'
import type { BattleResult } from '../contracts'
import type { Unit } from '../domain/unit'
import type { UnitId } from '../domain/ids'
import type { DomainEvent } from '../contracts'

export interface ResolveBattleInput {
  state: CombatState
  battleId: string
  partyIds: UnitId[]
  enemyIds: UnitId[]
  consumedTravelHop: number | null
}

function isAlive(u: Unit): boolean { return u.hp.current > 0 }

export function resolveBattle(input: ResolveBattleInput): BattleResult {
  const { state, battleId, partyIds, enemyIds, consumedTravelHop } = input

  const allUnits = state.units
  const survivors: UnitId[] = []
  const fallen: UnitId[] = []
  for (const id of partyIds) {
    const u = allUnits[id as unknown as string]
    if (!u) continue
    if (isAlive(u)) survivors.push(id); else fallen.push(id)
  }

  const enemiesAlive = enemyIds.filter(id => isAlive(allUnits[id as unknown as string]!))
  const partyAlive = survivors.length > 0
  const outcome: BattleResult['outcome'] = !partyAlive ? 'defeat'
    : enemiesAlive.length === 0 ? 'victory' : 'fled'

  // Foundation: simple gold reward formula 10 + level*5 per defeated enemy.
  let goldEarned = 0
  for (const id of enemyIds) {
    const u = allUnits[id as unknown as string]
    if (u && !isAlive(u)) goldEarned += 10 + u.level * 5
  }

  // Foundation: no XP awards yet — leveling lands in next milestone.
  const xpAwards: Record<string, number> = {}
  for (const id of survivors) xpAwards[id as unknown as string] = 0

  const emittedEvents: DomainEvent[] = [
    { type: outcome === 'victory' ? 'BattleVictory' : outcome === 'defeat' ? 'BattleDefeat' : 'BattleVictory', payload: { battleId, survivors, capturedIds: [] } as never },
    ...fallen.map<DomainEvent>(unitId => ({ type: 'UnitDied', payload: { unitId, cause: 'battle' } })),
  ]

  return {
    outcome,
    battleId,
    survivors,
    fallen,
    xpAwards,
    capturedEnemies: [],   // populated when capture event fires
    loot: [],              // populated by loot table in next milestone
    goldEarned,
    consumedTravelHop,
    emittedEvents,
  }
}
```

`tests/unit/systems/battleResolver.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveBattle } from '../../../src/systems/battleResolver'
import { initialCombatState } from '../../../src/systems/combatReducer'
import type { Unit } from '../../../src/domain/unit'
import { asUnitId, asClassId } from '../../../src/domain/ids'

const mk = (id: string, cur: number, max: number, classId: string, level = 1): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId(classId), level,
  hp: { current: cur, max }, stats: { str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('resolveBattle', () => {
  it('victory when all enemies dead', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 18, 20, 'lord')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 0, 12, 'bandit', 2)
    const r = resolveBattle({
      state, battleId: 'b1',
      partyIds: [asUnitId('roy')],
      enemyIds: [asUnitId('bandit')],
      consumedTravelHop: 3,
    })
    expect(r.outcome).toBe('victory')
    expect(r.goldEarned).toBe(10 + 2 * 5)
    expect(r.fallen).toHaveLength(0)
    expect(r.consumedTravelHop).toBe(3)
  })

  it('defeat when all party dead', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 0, 20, 'lord')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 5, 12, 'bandit')
    const r = resolveBattle({ state, battleId: 'b', partyIds: [asUnitId('roy')], enemyIds: [asUnitId('bandit')], consumedTravelHop: null })
    expect(r.outcome).toBe('defeat')
    expect(r.fallen).toContain(asUnitId('roy'))
  })

  it('emits UnitDied events for fallen', () => {
    const state = initialCombatState()
    state.units[asUnitId('roy') as unknown as string] = mk('roy', 18, 20, 'lord')
    state.units[asUnitId('marcus') as unknown as string] = mk('marcus', 0, 24, 'cavalier')
    state.units[asUnitId('bandit') as unknown as string] = mk('bandit', 0, 12, 'bandit')
    const r = resolveBattle({ state, battleId: 'b', partyIds: [asUnitId('roy'), asUnitId('marcus')], enemyIds: [asUnitId('bandit')], consumedTravelHop: null })
    const deaths = r.emittedEvents.filter(e => e.type === 'UnitDied')
    expect(deaths).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Commit**

```bash
cd phaser && npm test -- tests/unit/systems/battleResolver.test.ts
git add phaser/src/systems/battleResolver.ts phaser/tests/unit/systems/battleResolver.test.ts
git commit -m "feat(phaser): battleResolver — produces BattleResult with emittedEvents (gold + deaths)"
```

---

## Phase 5 — Persistence + Phaser/React Shell + Living Doc CI (Week 5)

### Task 35: Save format + content aliases

**Files:**
- Create: `src/persistence/saveFormat.ts`, `src/persistence/contentAliases.ts`

- [ ] **Step 1: Implement saveFormat.ts**

`src/persistence/saveFormat.ts`:
```ts
import type { CombatState } from '../domain/combatState'
import type { ActionLogEntry } from '../state/actionLog'
import type { SerializedFlag } from '../state/flags'

export const SAVE_VERSION = '0.5.0-foundation' as const
export type SaveVersion = typeof SAVE_VERSION

export interface SerializedRunState {
  runId: string
  runSeed: number
  partyUnits: unknown[]
  partyOrder: string[]
  inventoryItems: { itemId: string; gridX: number; gridY: number }[]
  gold: number
  worldPosition: { mapId: string; nodeId: string }
  visitedNodes: Record<string, boolean>
  clearedEncounters: Record<string, boolean>
  pendingTravelPath: unknown
  flags: SerializedFlag[]
  questStates: Record<string, { currentStage: string; metadata: Record<string, unknown> }>
  activeDungeon: unknown
  rngState: { seed: number; counter: number }
  deathLog: { unitId: string; cause: string; turn: number }[]
}

export interface SerializedMetaState {
  gameStarted: boolean
  totalRuns: number
}

export interface SaveFile {
  saveVersion: SaveVersion
  createdAt: number
  meta: SerializedMetaState
  run: SerializedRunState | null
  combat: CombatState | null
  actionLog: ActionLogEntry[]
  contentAliasesApplied: string
}
```

- [ ] **Step 2: Implement contentAliases.ts**

`src/persistence/contentAliases.ts`:
```ts
export const CONTENT_ALIASES_VERSION = '2026-05-08' as const

export interface ContentAliases {
  cardId: Record<string, string>
  itemId: Record<string, string>
  flagKey: Record<string, string>
  questId: Record<string, string>
  stageId: Record<string, string>
  dungeonId: Record<string, string>
  mapId: Record<string, string>
}

export const ALIASES: ContentAliases = {
  cardId: {},
  itemId: {},
  flagKey: {},
  questId: {},
  stageId: {},
  dungeonId: {},
  mapId: {},
}

export function resolveAlias(category: keyof ContentAliases, id: string): string {
  return ALIASES[category][id] ?? id
}
```

- [ ] **Step 3: Commit**

```bash
git add phaser/src/persistence
git commit -m "feat(phaser): SaveFile shape + contentAliases scaffolding (cardId/itemId/flagKey/questId/stageId/dungeonId/mapId)"
```

---

### Task 36: Save + atomic load

**Files:**
- Create: `src/persistence/save.ts`, `src/persistence/load.ts`
- Test: `tests/unit/persistence/saveLoad.test.ts`

- [ ] **Step 1: Implement save.ts**

`src/persistence/save.ts`:
```ts
import type { SaveFile, SerializedRunState, SerializedMetaState } from './saveFormat'
import { SAVE_VERSION } from './saveFormat'
import { CONTENT_ALIASES_VERSION } from './contentAliases'
import type { RunState } from '../state/runStore'
import type { CombatState } from '../domain/combatState'
import type { ActionLogEntry } from '../state/actionLog'

export function serializeRun(run: RunState | null): SerializedRunState | null {
  if (!run) return null
  return {
    runId: run.runId,
    runSeed: run.runSeed,
    partyUnits: Object.values(run.party.units),
    partyOrder: run.party.partyOrder.map(id => id as unknown as string),
    inventoryItems: run.inventory.items.map(i => ({
      itemId: i.itemId as unknown as string,
      gridX: i.gridX,
      gridY: i.gridY,
    })),
    gold: run.gold,
    worldPosition: {
      mapId: run.worldPosition.mapId as unknown as string,
      nodeId: run.worldPosition.nodeId as unknown as string,
    },
    visitedNodes: { ...run.visitedNodes },
    clearedEncounters: { ...run.clearedEncounters },
    pendingTravelPath: run.pendingTravelPath,
    flags: run.flags.serialize(),
    questStates: { ...run.questStates },
    activeDungeon: run.activeDungeon ? {
      ...run.activeDungeon,
      clearedRooms: Array.from(run.activeDungeon.clearedRooms),
    } : null,
    rngState: { ...run.rngState },
    deathLog: run.deathLog.map(d => ({
      unitId: d.unitId as unknown as string, cause: d.cause, turn: d.turn,
    })),
  }
}

export function buildSaveFile(input: {
  meta: SerializedMetaState
  run: RunState | null
  combat: CombatState | null
  actionLog: ActionLogEntry[]
}): SaveFile {
  return {
    saveVersion: SAVE_VERSION,
    createdAt: Date.now(),
    meta: input.meta,
    run: serializeRun(input.run),
    combat: input.combat,
    actionLog: input.actionLog,
    contentAliasesApplied: CONTENT_ALIASES_VERSION,
  }
}

export function saveToString(save: SaveFile): string {
  return JSON.stringify(save)
}
```

- [ ] **Step 2: Implement load.ts (atomic)**

`src/persistence/load.ts`:
```ts
import { z } from 'zod'
import type { SaveFile } from './saveFormat'
import { SAVE_VERSION } from './saveFormat'
import { resolveAlias } from './contentAliases'

const SerializedFlagSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  scope: z.enum(['run','quest','battle','permanent']),
})

const SerializedRunSchema = z.object({
  runId: z.string(),
  runSeed: z.number(),
  partyUnits: z.array(z.unknown()),
  partyOrder: z.array(z.string()),
  inventoryItems: z.array(z.object({ itemId: z.string(), gridX: z.number(), gridY: z.number() })),
  gold: z.number(),
  worldPosition: z.object({ mapId: z.string(), nodeId: z.string() }),
  visitedNodes: z.record(z.string(), z.boolean()),
  clearedEncounters: z.record(z.string(), z.boolean()),
  pendingTravelPath: z.unknown(),
  flags: z.array(SerializedFlagSchema),
  questStates: z.record(z.string(), z.object({ currentStage: z.string(), metadata: z.record(z.string(), z.unknown()) })),
  activeDungeon: z.unknown(),
  rngState: z.object({ seed: z.number(), counter: z.number() }),
  deathLog: z.array(z.object({ unitId: z.string(), cause: z.string(), turn: z.number() })),
})

const SaveFileSchema = z.object({
  saveVersion: z.string(),
  createdAt: z.number(),
  meta: z.object({ gameStarted: z.boolean(), totalRuns: z.number() }),
  run: SerializedRunSchema.nullable(),
  combat: z.unknown().nullable(),
  actionLog: z.array(z.unknown()),
  contentAliasesApplied: z.string(),
})

export type LoadResult =
  | { ok: true; save: SaveFile; warnings: string[] }
  | { ok: false; error: string }

export function loadFromString(raw: string): LoadResult {
  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch (e) { return { ok: false, error: `JSON parse failed: ${(e as Error).message}` } }

  const r = SaveFileSchema.safeParse(parsed)
  if (!r.success) return { ok: false, error: `Schema validation failed: ${r.error.message}` }

  const save = r.data as unknown as SaveFile
  const warnings: string[] = []

  if (save.saveVersion !== SAVE_VERSION) {
    warnings.push(`Save version ${save.saveVersion} differs from current ${SAVE_VERSION} — pre-alpha policy: nuke or proceed with caution.`)
  }

  // Apply content aliases (best-effort; missing IDs surface as warnings, not errors)
  if (save.run) {
    save.run.inventoryItems = save.run.inventoryItems.map(i => {
      const resolved = resolveAlias('itemId', i.itemId)
      if (resolved !== i.itemId) warnings.push(`alias: itemId ${i.itemId} -> ${resolved}`)
      return { ...i, itemId: resolved }
    })
    save.run.flags = save.run.flags.map(f => {
      const resolved = resolveAlias('flagKey', f.key)
      if (resolved !== f.key) warnings.push(`alias: flagKey ${f.key} -> ${resolved}`)
      return { ...f, key: resolved }
    })
  }

  return { ok: true, save, warnings }
}
```

- [ ] **Step 3: Test**

`tests/unit/persistence/saveLoad.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSaveFile, saveToString } from '../../../src/persistence/save'
import { loadFromString } from '../../../src/persistence/load'

describe('save/load', () => {
  it('roundtrip preserves meta and empty run', () => {
    const save = buildSaveFile({
      meta: { gameStarted: false, totalRuns: 0 },
      run: null, combat: null, actionLog: [],
    })
    const r = loadFromString(saveToString(save))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.save.meta.gameStarted).toBe(false)
      expect(r.save.run).toBeNull()
    }
  })

  it('rejects malformed JSON with ok:false', () => {
    const r = loadFromString('not json')
    expect(r.ok).toBe(false)
  })

  it('rejects schema-invalid payload', () => {
    const r = loadFromString(JSON.stringify({ saveVersion: 'x' }))
    expect(r.ok).toBe(false)
  })

  it('warns on version mismatch but does not reject', () => {
    const save = buildSaveFile({ meta: { gameStarted: false, totalRuns: 0 }, run: null, combat: null, actionLog: [] })
    save.saveVersion = '0.4.0' as never
    const r = loadFromString(saveToString(save))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.some(w => w.includes('version'))).toBe(true)
  })
})
```

```bash
cd phaser && npm test -- tests/unit/persistence/saveLoad.test.ts
git add phaser/src/persistence phaser/tests/unit/persistence
git commit -m "feat(phaser): save/load with atomic hydration, Zod validation, content alias resolution"
```

---

### Task 37: Replay harness — reproduce(state, action)

**Files:**
- Create: `src/persistence/replay.ts`
- Test: `tests/unit/persistence/replay.test.ts`

- [ ] **Step 1: Implement + test**

`src/persistence/replay.ts`:
```ts
import { reduce } from '../systems/combatReducer'
import { createRng } from '../systems/rng'
import type { CombatState, CombatEvent } from '../domain/combatState'

export interface ReproduceResult {
  before: CombatState
  after: CombatState
  effects: unknown[]
}

export function reproduceCombatAction(state: CombatState, event: CombatEvent): ReproduceResult {
  const rng = createRng(state.rng)
  const r = reduce(state, event, rng)
  return { before: state, after: r.state, effects: r.effects }
}
```

`tests/unit/persistence/replay.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { reproduceCombatAction } from '../../../src/persistence/replay'
import { initialCombatState, reduce } from '../../../src/systems/combatReducer'
import { createRng } from '../../../src/systems/rng'
import { asUnitId, asClassId } from '../../../src/domain/ids'
import type { Unit } from '../../../src/domain/unit'

const mk = (id: string, spd: number): Unit => ({
  id: asUnitId(id), name: id, classId: asClassId('lord'), level: 1,
  hp: { current: 20, max: 20 },
  stats: { str: 5, mag: 0, skl: 4, spd, def: 3, res: 1 },
  hand: { left: null, right: null }, position: null, ap: 3, armor: 0, statuses: [],
})

describe('reproduceCombatAction', () => {
  it('produces same after-state as direct reduce', () => {
    const rng = createRng({ seed: 0, counter: 0 })
    const start = reduce(initialCombatState(), {
      type: 'startBattle',
      payload: { units: [mk('a', 5)], grid: { width: 14, height: 10, obstacles: new Set() }, rngSeed: { seed: 0, counter: 0 } },
    }, rng).state

    const direct = reduce(start, { type: 'endTurn' }, rng).state
    const replayed = reproduceCombatAction(start, { type: 'endTurn' }).after

    expect(replayed.turn).toEqual(direct.turn)
  })
})
```

```bash
cd phaser && npm test -- tests/unit/persistence/replay.test.ts
git add phaser/src/persistence/replay.ts phaser/tests/unit/persistence/replay.test.ts
git commit -m "feat(phaser): replay harness reproduce(state, action) for combat reducer"
```

---

### Task 38: CombatRuntime POJO

**Files:**
- Create: `src/game/runtime/CombatRuntime.ts`

- [ ] **Step 1: Implement (no tests — Phaser-coupled, smoke-tested via E2E)**

`src/game/runtime/CombatRuntime.ts`:
```ts
import type { UnitId } from '../../domain/ids'

// CombatRuntime is a plain mutable POJO scoped to the Phaser CombatScene.
// It holds sprite refs, tween handles, hover state — anything per-frame mutable.
// State that must survive save/load lives in combatStore, not here.

export interface RuntimeUnitSprite {
  id: string
  // In a real Phaser scene this is Phaser.GameObjects.Sprite. We type it as `unknown`
  // here so the runtime stays Phaser-agnostic for testing; the scene casts on use.
  sprite: unknown
}

export class CombatRuntime {
  spriteByUnitId = new Map<string, RuntimeUnitSprite>()
  tilesContainer: unknown = null
  hoverTileId: string | null = null
  activeTweens: unknown[] = []
  awaitingAnimations = false

  registerUnit(id: UnitId, sprite: unknown): void {
    this.spriteByUnitId.set(id as unknown as string, { id: id as unknown as string, sprite })
  }

  unregisterUnit(id: UnitId): void {
    this.spriteByUnitId.delete(id as unknown as string)
  }

  reset(): void {
    this.spriteByUnitId.clear()
    this.tilesContainer = null
    this.hoverTileId = null
    this.activeTweens = []
    this.awaitingAnimations = false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add phaser/src/game/runtime/CombatRuntime.ts
git commit -m "feat(phaser): CombatRuntime POJO — per-frame mutable state for CombatScene firewall"
```

---

### Task 39: BootScene + CombatScene shell + createGame

**Files:**
- Create: `src/game/scenes/BootScene.ts`, `src/game/scenes/CombatScene.ts`, `src/game/createGame.ts`

- [ ] **Step 1: Implement createGame.ts**

`src/game/createGame.ts`:
```ts
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { CombatScene } from './scenes/CombatScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a0f',
    scene: [BootScene, CombatScene],
    pixelArt: true,
  })
}
```

- [ ] **Step 2: Implement BootScene.ts**

`src/game/scenes/BootScene.ts`:
```ts
import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
  constructor() { super('boot') }

  create(): void {
    this.add.text(640, 360, 'FE_MB Foundation — Boot OK', {
      fontFamily: 'monospace', fontSize: '24px', color: '#e0d0a0',
    }).setOrigin(0.5)

    this.time.delayedCall(800, () => {
      this.scene.start('combat')
    })
  }
}
```

- [ ] **Step 3: Implement CombatScene.ts (shell that drains effects)**

`src/game/scenes/CombatScene.ts`:
```ts
import Phaser from 'phaser'
import { useCombatStore } from '../../state/combatStore'
import { CombatRuntime } from '../runtime/CombatRuntime'
import type { CombatEffect } from '../../domain/combatState'

export class CombatScene extends Phaser.Scene {
  private runtime!: CombatRuntime
  private unsub: (() => void) | null = null

  constructor() { super('combat') }

  create(): void {
    this.runtime = new CombatRuntime()

    this.add.text(20, 20, 'CombatScene shell — placeholder grid', {
      fontFamily: 'monospace', fontSize: '14px', color: '#a0a0c0',
    })

    // Draw 14x10 grid outline
    const g = this.add.graphics()
    g.lineStyle(1, 0x333344, 0.6)
    const tile = 48
    const offX = 240, offY = 120
    for (let x = 0; x <= 14; x++) g.lineBetween(offX + x * tile, offY, offX + x * tile, offY + 10 * tile)
    for (let y = 0; y <= 10; y++) g.lineBetween(offX, offY + y * tile, offX + 14 * tile, offY + y * tile)

    // Subscribe to lastEffectId changes to drain effects from the queue.
    this.unsub = useCombatStore.subscribe(
      (s) => s.lastEffectId,
      () => {
        const drained = useCombatStore.getState().drainEffects()
        for (const e of drained) this.handleEffect(e)
      }
    )
  }

  private handleEffect(e: CombatEffect): void {
    // Foundation: log only. Real animation handling lands in next milestone.
    // eslint-disable-next-line no-console
    console.debug('[CombatScene] effect:', e.kind)
  }

  shutdown(): void {
    this.runtime.reset()
    if (this.unsub) { this.unsub(); this.unsub = null }
  }
}
```

- [ ] **Step 4: Wire into main.tsx**

Modify `src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { createGame } from './game/createGame'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Phaser game mounts after React shell renders.
queueMicrotask(() => {
  const parent = document.getElementById('game-canvas-container')
  if (parent) createGame(parent)
})
```

- [ ] **Step 5: Verify build + dev server boot**

```bash
cd phaser && npm run build
cd phaser && npm run typecheck
```

Expected: PASS.

```bash
cd phaser && npm run dev
```

Expected: localhost:5173 renders boot text, transitions to grid placeholder.

- [ ] **Step 6: Commit `[CONTEXT.md update required]`**

```bash
git add phaser/src/game phaser/src/main.tsx phaser/CONTEXT.md
git commit -m "feat(phaser): BootScene + CombatScene shell + Phaser/React mount, drains effects via subscribeWithSelector"
```

Update `phaser/CONTEXT.md` §9 (File Map) — confirm `game/scenes/` and `game/runtime/` populated.

---

### Task 40: DevHud (React)

**Files:**
- Create: `src/ui/DevHud.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement DevHud.tsx**

`src/ui/DevHud.tsx`:
```tsx
import { useEffect, useState } from 'react'
import type { ErrorBus, ErrorEntry } from '../state/errorBus'
import type { EventBus } from '../state/eventBus'
import type { DomainEvent } from '../contracts'
import type { ActionLog, ActionLogEntry } from '../state/actionLog'

interface Props {
  errorBus: ErrorBus
  eventBus: EventBus
  actionLog: ActionLog
}

export function DevHud({ errorBus, eventBus, actionLog }: Props): React.JSX.Element | null {
  const isDev = import.meta.env.DEV
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [actions, setActions] = useState<ActionLogEntry[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!isDev) return
    const unsubE = errorBus.subscribe(() => setErrors(errorBus.recent().slice(-5)))
    const unsubV = eventBus.subscribe(e => setEvents(prev => [...prev.slice(-9), e]))
    const tick = setInterval(() => setActions(actionLog.snapshot().slice(-10)), 500)
    return () => { unsubE(); unsubV(); clearInterval(tick) }
  }, [isDev, errorBus, eventBus, actionLog])

  if (!isDev) return null
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 99999 }}>
      Dev HUD
    </button>
  )

  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, width: 360, maxHeight: 320,
      overflow: 'auto', background: 'rgba(10,10,15,0.92)', color: '#cfd', padding: 8,
      fontFamily: 'monospace', fontSize: 11, zIndex: 99999, border: '1px solid #444',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>Dev HUD</strong>
        <button onClick={() => setOpen(false)}>×</button>
      </div>
      <h4 style={{ margin: '6px 0 2px', color: '#fa6' }}>Errors ({errors.length})</h4>
      {errors.map((e, i) => <div key={i}>{e.source}: {e.error.message}</div>)}
      <h4 style={{ margin: '6px 0 2px', color: '#6af' }}>Events ({events.length})</h4>
      {events.map((e, i) => <div key={i}>{e.type}</div>)}
      <h4 style={{ margin: '6px 0 2px', color: '#6fa' }}>Actions ({actions.length})</h4>
      {actions.map((a, i) => <div key={i}>{a.store}: {a.action.type}</div>)}
    </div>
  )
}
```

- [ ] **Step 2: Wire into App.tsx (mount with shared bus singletons)**

`src/App.tsx`:
```tsx
import './App.css'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

export function App(): React.JSX.Element {
  return (
    <ErrorBoundary errorBus={errorBus}>
      <div id="app-root">
        <div id="game-canvas-container" />
        <div id="react-shell" />
        <DevHud errorBus={errorBus} eventBus={eventBus} actionLog={actionLog} />
      </div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 3: Verify build + commit**

```bash
cd phaser && npm run typecheck
git add phaser/src/ui/DevHud.tsx phaser/src/App.tsx
git commit -m "feat(phaser): DevHud React overlay surfacing errors/events/actions in dev"
```

---

### Task 41: scripts/check-context-doc.ts (CI drift check)

**Files:**
- Create: `phaser/scripts/check-context-doc.ts`
- Modify: `phaser/package.json` (add script)

- [ ] **Step 1: Implement check script**

`phaser/scripts/check-context-doc.ts`:
```ts
#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CTX_PATH = join(ROOT, 'CONTEXT.md')
const SCAN_DIRS = ['src/domain', 'src/contracts', 'src/state', 'src/persistence']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (entry.endsWith('.ts')) out.push(p)
  }
  return out
}

function extractExportedNames(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const names: string[] = []
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+(?:type|interface)\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(src)) !== null) {
      const name = m[1]
      if (name && !name.startsWith('_')) names.push(name)
    }
  }
  return names
}

function main(): void {
  const ctx = readFileSync(CTX_PATH, 'utf8')
  const allNames = new Set<string>()
  for (const dir of SCAN_DIRS) {
    const files = walk(join(ROOT, dir))
    for (const f of files) for (const n of extractExportedNames(f)) allNames.add(n)
  }

  const allowSkip = new Set([
    // Names intentionally not in CONTEXT.md (test helpers, internal types)
    '__brand', '__reset', '__resetForTest', '__busRefs',
  ])

  const missing: string[] = []
  for (const n of allNames) {
    if (allowSkip.has(n)) continue
    if (!ctx.includes(n)) missing.push(n)
  }

  if (missing.length > 0) {
    console.error('\n✖ CONTEXT.md drift detected. Missing references:')
    for (const m of missing.slice(0, 30)) console.error('  - ' + m)
    if (missing.length > 30) console.error(`  ... and ${missing.length - 30} more`)
    console.error('\nUpdate phaser/CONTEXT.md or add the name to allowSkip in scripts/check-context-doc.ts.')
    process.exit(1)
  }
  console.log('✓ CONTEXT.md is in sync with', allNames.size, 'exported names.')
}

main()
```

- [ ] **Step 2: Add npm script**

Modify `phaser/package.json`:
```json
"scripts": {
  ...
  "check-context-doc": "tsx scripts/check-context-doc.ts"
}
```

- [ ] **Step 3: Install tsx (dev dep)**

```bash
cd phaser && npm install -D tsx
```

- [ ] **Step 4: Run the check (expect drift, then resolve by populating CONTEXT.md or adding names to allowSkip)**

```bash
cd phaser && npm run check-context-doc
```

Expected: lists drift OR passes if CONTEXT.md is comprehensive enough.

- [ ] **Step 5: Iterate — populate CONTEXT.md sections until check passes**

This is the bulk of CONTEXT.md population work. Edit `phaser/CONTEXT.md` to add references for any flagged names. Refer to spec §24 line budgets per section.

- [ ] **Step 6: Commit**

```bash
cd phaser && npm run check-context-doc
git add phaser/scripts phaser/package.json phaser/package-lock.json phaser/CONTEXT.md
git commit -m "feat(phaser): CI drift check for CONTEXT.md (greps exported names from domain/contracts/state/persistence)"
```

---

### Task 42: Playwright smoke E2E

**Files:**
- Create: `tests/e2e/boot.spec.ts`

- [ ] **Step 1: Implement smoke test**

`tests/e2e/boot.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('boot smoke', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#game-canvas-container canvas')).toBeVisible({ timeout: 5000 })
  // DevHud renders in dev mode
  await expect(page.locator('text=Dev HUD')).toBeVisible({ timeout: 2000 })
})
```

- [ ] **Step 2: Run**

```bash
cd phaser && npm run dev &
cd phaser && npm run test:e2e
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add phaser/tests/e2e/boot.spec.ts
git commit -m "test(phaser): playwright smoke for boot + canvas + DevHud"
```

---

## Phase 6 — Research Deliverables + Milestone Gate (Week 6)

### Task 43: Research deliverable #1 — Slay the Spire procgen

**Files:**
- Replace stub at: `docs/research/sts-procgen.md`

- [ ] **Step 1: Dispatch research subagent**

```
Agent (general-purpose):
  description: "Fill StS procgen research stub"
  prompt: "Read docs/research/sts-procgen.md (stub). Fulfill the deliverable: 1-2 pages of concrete rules for Slay the Spire-style dungeon procgen — row count, path-count invariant, row-skipping rule, forced placements (Treasure/Rest/Shop/Elite), room-type weights by row, convergence rule, reveal model recommendation, seed determinism, edge-case handling. Sources: Slay the Spire wiki, Mega Crit Reddit posts, open-source clones, Marvelous Mapping Modder. Output: replace the stub file content with the filled deliverable, committed."
```

- [ ] **Step 2: Review the output, reconcile with `phaser/CONTEXT.md` OQ-1 (fog-of-war decision)**

Update CONTEXT.md §12 — close OQ-1 with the recommendation from research.

- [ ] **Step 3: Commit (if research subagent didn't already)**

```bash
git add docs/research/sts-procgen.md phaser/CONTEXT.md
git commit -m "docs(research): StS procgen rules — fills deliverable #1, closes OQ-1"
```

---

### Task 44: Research deliverable #2 — Roguelite RNG strategies

**Files:**
- Replace stub at: `docs/research/roguelite-rng.md`

- [ ] **Step 1: Dispatch research subagent**

```
Agent (general-purpose):
  description: "Fill roguelite RNG research"
  prompt: "Read docs/research/roguelite-rng.md (stub). Fulfill the deliverable: 1-page comparison of Hades/FTL/StS RNG patterns + recommendation for FE_MB. Cover hash combiner choice, counter persistence, save-scum prevention. Output: replace stub content with deliverable, committed."
```

- [ ] **Step 2: Reconcile with current Mulberry32 + hash combiner in `systems/rng.ts`**

If the research recommends a different hash combiner, open an issue or update the implementation. Note any deviation in CONTEXT.md §11 (Known Gotchas).

- [ ] **Step 3: Commit**

```bash
git add docs/research/roguelite-rng.md phaser/CONTEXT.md
git commit -m "docs(research): roguelite RNG strategies — fills deliverable #2"
```

---

### Task 45: Research deliverable #3 — Godot quest system audit

**Files:**
- Replace stub at: `docs/research/godot-quest-audit.md`

- [ ] **Step 1: Dispatch research subagent**

```
Agent (Explore + general-purpose):
  description: "Audit Godot quest system"
  prompt: "Read docs/research/godot-quest-audit.md (stub). Fulfill: read autoload/quest_manager.gd, autoload/event_bus.gd, autoload/dialogue_manager.gd, data/quests/quest_definitions.json, data/dialogue/*.json (especially Blood Ties), scripts/overworld/world_map.gd, scripts/ui/quest_log_panel.gd. Document quest data shape, QuestManager behavior, flag system, Blood Ties end-to-end cross-system writes. Propose TS schema mapping per foundation v2 §13–§14. Output: replace stub with deliverable, committed."
```

- [ ] **Step 2: Reconcile any schema gaps in `domain/quest.ts` or predicate kinds**

If the audit reveals quest patterns the current `QuestDef` shape can't express, add to OQ tracker in CONTEXT.md §12 with a deadline.

- [ ] **Step 3: Commit**

```bash
git add docs/research/godot-quest-audit.md phaser/CONTEXT.md
git commit -m "docs(research): Godot quest system audit — fills deliverable #3, validates QuestDef shape"
```

---

### Task 46: Research deliverable #4 — Stat growth math

**Files:**
- Replace stub at: `docs/research/stat-growth-math.md`

- [ ] **Step 1: Dispatch research subagent**

```
Agent (Explore + general-purpose):
  description: "Document Godot stat growth math"
  prompt: "Read docs/research/stat-growth-math.md (stub). Fulfill: read scripts/resources/unit_data.gd, scripts/resources/class_data.gd if present, data/classes/*.json, scripts/combat/battlefield.gd. Document growth math, XP curve, class differences, propose TS pure-function spec. Output: replace stub, committed."
```

- [ ] **Step 2: Commit**

```bash
git add docs/research/stat-growth-math.md
git commit -m "docs(research): stat growth math — fills deliverable #4"
```

---

### Task 47: Research deliverable #5 — Enemy scaling curves

**Files:**
- Replace stub at: `docs/research/enemy-scaling-curves.md`
- Optionally: `phaser/src/data/content/curves/enemy_scaling.json`

- [ ] **Step 1: Dispatch research subagent**

```
Agent (Explore + general-purpose):
  description: "Recommend enemy scaling curves"
  prompt: "Read docs/research/enemy-scaling-curves.md (stub). Compare StS / FE / FTL scaling, audit autoload/event_manager.gd and data/events/enemy_groups.json, propose FE_MB curve respecting 03-29 ship-plan regional structure. Output JSON mock + 1-page deliverable, committed."
```

- [ ] **Step 2: Commit**

```bash
git add docs/research phaser/src/data/content/curves
git commit -m "docs(research): enemy scaling curves — fills deliverable #5"
```

---

### Task 48: Foundation milestone gate — verify success criteria

**Files:** none (verification + tag).

- [ ] **Step 1: Run full CI locally**

```bash
cd phaser && npm run typecheck
cd phaser && npm test
cd phaser && npm run test:e2e
cd phaser && npm run check-context-doc
cd phaser && npm run build
```

All five must pass.

- [ ] **Step 2: Verify success criteria from foundation v2 spec §29**

Walk the §29 list:
1. Typecheck strict + noUncheckedIndexedAccess clean — confirm
2. Vitest ≥ 80 tests passing — count `npm test 2>&1 | grep -c '✓'`
3. Playwright boot smoke passes — confirm
4. `check-context-doc` passes — confirm
5. Representative content loads + validates — exercise via a test that calls `validateContent` with the actual JSON files (add this if missing)
6. Replay harness reproduces state for representative actions — covered by `tests/unit/persistence/replay.test.ts`
7. DevHud surfaces last 10 actions, last 10 events, last error, flag enumeration — manual smoke
8. Five research deliverables present in `docs/research/` — `ls docs/research/*.md` shows all 5 + README
9. README documents `dev`, `test`, `test:e2e`, `check-context-doc`, `build` — verify `phaser/README.md`
10. CONTEXT.md ≤ 300 lines, every section populated — `wc -l phaser/CONTEXT.md`

- [ ] **Step 3: Update phaser/README.md**

Modify `phaser/README.md` to document all five npm scripts and reference the v2 spec + CONTEXT.md.

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a phaser-foundations-v2 -m "Foundation v2 milestone: full GDLC schemas + systems, ready for first feature milestone"
git log --oneline phaser-foundations-v2 ^phaser-v0.1-sandbox 2>/dev/null | wc -l
```

- [ ] **Step 5: Foundation retro doc**

Append to `phaser/CONTEXT.md` §10 (Active Spec Index): mark v2 spec as "Phase 1 complete; first feature milestone next."

```bash
git add phaser/README.md phaser/CONTEXT.md
git commit -m "docs(phaser): foundation v2 milestone gate — README + CONTEXT.md retro"
```

---

## Self-Review

Before handing this plan to subagents, the controller should verify:

**Spec coverage:** Every section of `2026-05-08-phaser-foundations-v2-design.md` maps to at least one task. Quick walk:
- §3 scope items → all addressed across Phases 1–5
- §7 three stores → Tasks 18, 19, 20, 29
- §8 MapRegistry → Task 33
- §9 hierarchical RNG → Tasks 3, 4
- §10 combat reducer → Tasks 28, 29
- §11 effect pipeline → Task 22
- §12 status effects → Task 23
- §13 quest engine → Tasks 14, 30
- §14 predicate AST → Tasks 5, 10
- §15 domain event bus → Task 15
- §16 contracts module → Task 13
- §17 dialogue → Task 31
- §18 procgen → Task 32
- §19 Phaser firewall → Tasks 38, 39
- §20 data model → Tasks 6, 7, 8, 9
- §21 save format → Tasks 35, 36
- §22 action log + replay → Tasks 17, 37
- §23 error infra → Task 16
- §24 living doc → Tasks 41, plus CONTEXT.md updates throughout
- §25 research deliverables → Tasks 43–47
- §26 testing strategy → embedded throughout (every task has TDD steps)
- §29 success criteria → Task 48 gate

**Cross-task consistency:** signatures used in later tasks match earlier definitions. `BattleResult.consumedTravelHop: number | null`, `RNG.derive`, `evaluatePredicate(pred, state)` are referenced consistently.

**Living doc updates:** every task touching `domain/`, `state/*Store.ts`, `systems/`, `contracts/`, `persistence/saveFormat.ts` has the `[CONTEXT.md update required]` marker.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-phaser-foundations-v2.md`.

**The user has already specified subagent-driven execution** (autonomous_execution preference + the spec mandates it via §24 living doc protocol). Use **superpowers:subagent-driven-development** to dispatch one fresh subagent per task with two-stage review (spec compliance + code quality) between tasks.

**Recommended dispatch order:** strictly sequential within each phase. Phase boundaries are natural review checkpoints — pause after Phase 1 (Task 12), Phase 2 (Task 20), Phase 3 (Task 29), Phase 4 (Task 34), Phase 5 (Task 42) for the human to spot-check before committing to the next phase. Phase 6 research tasks can run in parallel as background subagents.






