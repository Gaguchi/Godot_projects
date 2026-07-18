# Character Identity Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace name-substring identity plumbing with stable `characterId` keys so the Long Carry cast swap (spec `2026-07-18-cast-the-long-carry-design.md`, Appendix A) becomes data-only.

**Architecture:** One new pure module (`src/data/characterAssets.ts`) becomes the single characterId→sprite mapping consumed by BoardScene, BootScene, and CharacterPortrait (killing three duplicated name-matching maps). `Unit` gains `characterId` (threaded by every seeder) and `captured: boolean` (replacing the `' (captured)'` name-suffix marker). Encounter `captureTargets` thread through `pendingCombat` into combat state, and a new pure `resolveCaptures` fires their flags/dialogues at victory — making the Blood Ties capture chain actually work. The dialogue registry re-keys onto characterId with a speaker-alias map so dialogue JSON stays readable.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`), Zod schemas, Zustand stores with `dispatch(action)` chokepoints, Vitest, Playwright.

## Global Constraints

- Plan 1 of 4 for the cast spec. **NO renames in this plan** — Roy/Marcus/Lilina/Daren etc. keep their names; this plan makes renames cheap (plan 3 does them).
- Pure systems (`src/systems/`, `src/data/characterAssets.ts`) import only `domain/`, `contracts/`, other systems. No Phaser, no React, no I/O (CLAUDE.md invariant 3).
- React components never import Phaser; Phaser scenes never import React (invariant fence). `characterAssets.ts` lives in `src/data/` so BOTH may import it.
- `Math.random()` forbidden; RNG via parameters only.
- Any domain type / store action / save field change updates `phaser/CONTEXT.md` **in the same commit** — CI (`npm run check-context-doc`) fails otherwise.
- All commands run from `E:/Work/GameDev/Godot/fe-mb/phaser/`. Green gate: `npm run verify` (typecheck + typecheck:cli + lint:content + check-context-doc + unit tests).
- Save compatibility: old saves must load. `SAVE_VERSION` bumps `'0.7.0-gear'` → `'0.8.0-identity'` with hydration migrations (legacy `' (captured)'` suffix → `captured: true`; absent `characterId` → derived).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `characterId` + `captured` on the Unit domain type and schema

**Files:**
- Modify: `phaser/src/domain/unit.ts` (interface `Unit`, after `handRight`)
- Modify: `phaser/src/data/schemas/unit.ts`
- Modify: `phaser/CONTEXT.md` (domain section — same commit)
- Test: `phaser/tests/unit/data/unitSchema.test.ts` (create if absent; check `tests/unit/data/` for an existing unit schema test first and extend it instead)

**Interfaces:**
- Produces: `Unit.characterId?: string | null` — canonical cast key (e.g. `'roy'`, `'daren'`, `'bandit'`); presentation-independent; survives renames. `Unit.captured?: boolean` — capture state marker (replaces name suffix). Both optional so old saves and lightweight fixtures round-trip.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/data/unitSchema.test.ts
import { describe, it, expect } from 'vitest'
import { UnitSchema } from '../../../src/data/schemas/unit'

describe('UnitSchema identity fields', () => {
  const base = {
    id: 'u1', name: 'Roy', classId: 'lord', level: 1,
    hp: { current: 10, max: 10 },
    stats: { str: 5, mag: 1, skl: 4, spd: 5, def: 4, res: 2, lck: 3 },
    position: null, ap: 3, armor: 0, statuses: [],
  }

  it('accepts characterId and captured', () => {
    const u = UnitSchema.parse({ ...base, characterId: 'roy', captured: true })
    expect(u.characterId).toBe('roy')
    expect(u.captured).toBe(true)
  })

  it('round-trips without the new fields (old saves)', () => {
    const u = UnitSchema.parse(base)
    expect(u.characterId).toBeUndefined()
    expect(u.captured).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/data/unitSchema.test.ts`
Expected: FAIL — `characterId` stripped/unknown (schema has no such key).

- [ ] **Step 3: Add the fields**

In `phaser/src/domain/unit.ts`, append to `interface Unit` (after `handRight`):

```ts
  /** Canonical cast key ('roy', 'daren', 'bandit'…) — stable across display
   *  renames. Drives sprite/portrait/registry lookup via
   *  data/characterAssets.ts. Optional: legacy saves + fixtures omit it and
   *  fall back to a classId-derived sprite. */
  characterId?: string | null
  /** Taken alive (capture mechanic). Replaces the legacy `' (captured)'`
   *  name-suffix marker; hydration migrates the suffix to this flag. */
  captured?: boolean
```

In `phaser/src/data/schemas/unit.ts`, add to `UnitSchema` object (mirroring the optional style of `hasMovedThisTurn`/`handLeft` there):

```ts
  characterId: z.string().nullable().optional(),
  captured: z.boolean().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/data/unitSchema.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Update CONTEXT.md**

In `phaser/CONTEXT.md`, find the `Unit` line in the schema/domain index and append: `characterId (canonical cast key, drives characterAssets sprite lookup), captured (capture flag — replaced the ' (captured)' name-suffix marker)`.

Run: `npm run check-context-doc`
Expected: `✓ CONTEXT.md is in sync`.

- [ ] **Step 6: Commit**

```bash
git add phaser/src/domain/unit.ts phaser/src/data/schemas/unit.ts phaser/tests/unit/data/unitSchema.test.ts phaser/CONTEXT.md
git commit -m "feat(domain): characterId + captured fields on Unit

Groundwork for the Long Carry identity layer (spec Appendix A): a stable
cast key decoupled from display names, and capture-as-state instead of
capture-as-name-suffix.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `characterAssets.ts` — the ONE characterId→sprite mapping

**Files:**
- Create: `phaser/src/data/characterAssets.ts`
- Modify: `phaser/CONTEXT.md` (systems/data index — same commit)
- Test: `phaser/tests/unit/data/characterAssets.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3, 4, 5):

```ts
export const CHARACTER_SPRITES: Record<string, string>   // characterId → sprite file id
export const CLASS_FALLBACK_SPRITE: Record<string, string> // classId → sprite file id
export const ALL_SPRITE_IDS: readonly string[]           // unique sprite ids for preload
export function spriteIdForUnit(characterId: string | null | undefined, classId: string): string | null
export function spritePathFor(spriteId: string): string  // `/sprites/units/<id>.png`
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/data/characterAssets.test.ts
import { describe, it, expect } from 'vitest'
import {
  spriteIdForUnit, spritePathFor, ALL_SPRITE_IDS, CHARACTER_SPRITES,
} from '../../../src/data/characterAssets'

describe('characterAssets', () => {
  it('characterId wins over class fallback', () => {
    expect(spriteIdForUnit('daren', 'bandit')).toBe('daren')
    expect(spriteIdForUnit('roy', 'lord')).toBe('roy')
  })

  it('falls back to classId when characterId is absent or unknown', () => {
    expect(spriteIdForUnit(null, 'bandit')).toBe('bandit')
    expect(spriteIdForUnit(undefined, 'shield_knight')).toBe('shield_knight')
    expect(spriteIdForUnit('someone_new', 'mage')).toBe('lilina')
  })

  it('returns null for unknown class with no characterId (shape-token fallback)', () => {
    expect(spriteIdForUnit(null, 'not_a_class')).toBeNull()
  })

  it('preload list is unique and contains every mapped sprite', () => {
    expect(new Set(ALL_SPRITE_IDS).size).toBe(ALL_SPRITE_IDS.length)
    for (const s of Object.values(CHARACTER_SPRITES)) expect(ALL_SPRITE_IDS).toContain(s)
  })

  it('builds public sprite paths', () => {
    expect(spritePathFor('roy')).toBe('/sprites/units/roy.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/data/characterAssets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```ts
// phaser/src/data/characterAssets.ts
/**
 * THE single characterId → sprite mapping (Long Carry spec, Appendix A).
 * Consumed by BoardScene (board sprites), BootScene (preload), and
 * CharacterPortrait (dialogue/HUD portraits). Never key art on display
 * names — names are presentation and will change; characterIds are forever.
 *
 * Pure data: no Phaser, no React, no I/O.
 */

/** Named individuals (and named enemies) → their sprite file id. */
export const CHARACTER_SPRITES: Record<string, string> = {
  roy: 'roy',
  marcus: 'marcus',
  lilina: 'lilina',
  garrik: 'garrik',
  lyra: 'lyra',
  kael: 'kael',
  daren: 'daren',
  warlord: 'warlord',
  brigand_chief: 'brigand_chief',
}

/** Class-level fallback for units with no (or an unmapped) characterId. */
export const CLASS_FALLBACK_SPRITE: Record<string, string> = {
  lord: 'roy',
  knight: 'marcus',
  mage: 'lilina',
  bandit: 'bandit',
  bandit_archer: 'bandit_archer',
  thief: 'thief',
  wolf: 'wolf',
  alpha_wolf: 'alpha_wolf',
  shield_knight: 'shield_knight',
  raider_mage: 'raider_mage',
  raider_cleric: 'raider_cleric',
  ember_mage: 'ember_mage',
  warlord: 'warlord',
}

/** Unique sprite ids — the preload manifest (BootScene + BoardScene). */
export const ALL_SPRITE_IDS: readonly string[] = [
  ...new Set([
    ...Object.values(CHARACTER_SPRITES),
    ...Object.values(CLASS_FALLBACK_SPRITE),
  ]),
]

/** characterId wins; classId fallback second; null = no sprite (shape token). */
export function spriteIdForUnit(
  characterId: string | null | undefined,
  classId: string,
): string | null {
  if (characterId && CHARACTER_SPRITES[characterId]) return CHARACTER_SPRITES[characterId]
  return CLASS_FALLBACK_SPRITE[classId] ?? null
}

export function spritePathFor(spriteId: string): string {
  return `/sprites/units/${spriteId}.png`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/data/characterAssets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: CONTEXT.md + commit**

Add to CONTEXT.md's data/systems index: `- data/characterAssets.ts — THE characterId→sprite mapping (CHARACTER_SPRITES, CLASS_FALLBACK_SPRITE, ALL_SPRITE_IDS, spriteIdForUnit, spritePathFor). BoardScene/BootScene/CharacterPortrait all consume it; name-substring sprite matching is dead. **Active.**`

```bash
npm run check-context-doc
git add phaser/src/data/characterAssets.ts phaser/tests/unit/data/characterAssets.test.ts phaser/CONTEXT.md
git commit -m "feat(data): characterAssets — single characterId→sprite mapping module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
---

### Task 3: BoardScene + BootScene consume characterAssets (name matching dies on canvas)

**Files:**
- Modify: `phaser/src/game/scenes/BoardScene.ts:62-84` (delete `UNIT_SPRITES` + `unitSpriteKey`), plus its preload loop (~line 171) and every `unitSpriteKey(...)` call site (grep within the file)
- Modify: `phaser/src/game/scenes/BootScene.ts:3,9` (delete duplicate list)
- Test: existing `phaser/tests/unit/game/seedStubBattle.test.ts` must stay green; visual check via e2e boot

**Interfaces:**
- Consumes: `spriteIdForUnit(characterId, classId)`, `ALL_SPRITE_IDS`, `spritePathFor` from Task 2. Unit views read `unit.characterId` (undefined until Task 5 seeds it — class fallback covers the gap, so this task is safe to land first).

- [ ] **Step 1: Replace the mapping in BoardScene**

Delete lines 61-84 of `phaser/src/game/scenes/BoardScene.ts` (the `UNIT_SPRITES` const and `unitSpriteKey` function) and add to the imports:

```ts
import { spriteIdForUnit, spritePathFor, ALL_SPRITE_IDS } from '../../data/characterAssets'
```

Everywhere the file called `unitSpriteKey(unit.name, cls)` (unit-view creation — grep `unitSpriteKey(`), replace with:

```ts
const spriteId = spriteIdForUnit(unit.characterId, unit.classId as unknown as string)
const textureKey = spriteId ? `unit_${spriteId}` : null
```

and use `textureKey` where the old return value (`'unit_<id>' | null`) was used.

In `preload()` (~line 171), replace the `UNIT_SPRITES` loop with:

```ts
for (const id of ALL_SPRITE_IDS) this.load.image(`unit_${id}`, spritePathFor(id))
```

- [ ] **Step 2: Same replacement in BootScene**

`phaser/src/game/scenes/BootScene.ts` — delete the local `UNIT_SPRITES` const (line 3); import and use the shared list:

```ts
import { spriteIdForUnit as _unused, ALL_SPRITE_IDS, spritePathFor } from '../../data/characterAssets'
```

(actually import only what's used:)

```ts
import { ALL_SPRITE_IDS, spritePathFor } from '../../data/characterAssets'
```

```ts
preload(): void {
  for (const id of ALL_SPRITE_IDS) this.load.image(`unit_${id}`, spritePathFor(id))
}
```

- [ ] **Step 3: Typecheck + unit suite**

Run: `npx tsc --noEmit && npx vitest run tests/unit/game/`
Expected: clean; `seedStubBattle.test.ts` still green (names untouched, sprites now resolve via class fallback until Task 5 threads characterIds).

- [ ] **Step 4: Rendered check (Iron Rule)**

With the dev server on :5183: `npx playwright test tests/e2e/boot.spec.ts tests/e2e/combat-movement.spec.ts --reporter=line`
Expected: PASS. Then screenshot the tutorial battle (New Game) and confirm Roy/bandit sprites render on the board exactly as before (class fallback covers them: lord→roy, bandit→bandit).

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/scenes/BoardScene.ts phaser/src/game/scenes/BootScene.ts
git commit -m "refactor(board): sprite lookup via characterAssets, not name substrings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: CharacterPortrait consumes characterAssets (the KEEP-IN-SYNC mirror dies)

**Files:**
- Modify: `phaser/src/ui/components/CharacterPortrait.tsx:19-44` (delete `spritePath` + `unitSpritePathForName`), props + sprite resolution
- Modify: `phaser/src/ui/scenes/combat/InitiativeEntry.tsx` (pass `characterId`/`classId` — grep `<CharacterPortrait` for the call)
- Modify: `phaser/src/ui/scenes/combat/UnitDetailPanel.tsx:41` (same)
- Test: `phaser/tests/unit/ui/components/CharacterPortrait.test.tsx` (create)

**Interfaces:**
- Consumes: `spriteIdForUnit`, `spritePathFor` (Task 2); registry `getCharacter` unchanged.
- Produces: `CharacterPortraitProps` gains `characterId?: string | null` and `classId?: string`. Resolution order: registry sprite → `characterId`/`classId` via characterAssets → initials shape. Existing dialogue callers (speaker-only) keep working unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/ui/components/CharacterPortrait.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CharacterPortrait } from '../../../../src/ui/components/CharacterPortrait'

describe('CharacterPortrait sprite resolution', () => {
  it('uses characterAssets for units the registry does not know', () => {
    render(<CharacterPortrait speaker="Bandit Thug" characterId={null} classId="bandit" team="enemy" />)
    const img = screen.getByRole('img', { name: 'Bandit Thug' }).querySelector('img')
    expect(img?.getAttribute('src')).toBe('/sprites/units/bandit.png')
  })

  it('characterId beats class fallback', () => {
    render(<CharacterPortrait speaker="Daren" characterId="daren" classId="bandit" team="enemy" />)
    const img = screen.getByRole('img', { name: 'Daren' }).querySelector('img')
    expect(img?.getAttribute('src')).toBe('/sprites/units/daren.png')
  })

  it('falls back to initials when nothing maps', () => {
    render(<CharacterPortrait speaker="Mystery Pilgrim" />)
    expect(screen.getByText('MP')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/components/CharacterPortrait.test.tsx`
Expected: FAIL — `characterId` prop does not exist / resolution differs.

- [ ] **Step 3: Implement**

In `CharacterPortrait.tsx`: delete lines 19-44 (`spritePath` + `unitSpritePathForName` and its KEEP-IN-SYNC comment). Add import:

```ts
import { spriteIdForUnit, spritePathFor } from '../../data/characterAssets'
```

Add to `CharacterPortraitProps` after `team`:

```ts
  /** Canonical cast key, when the caller has a Unit. Beats name lookup. */
  characterId?: string | null
  /** Unit class — enables the class-fallback sprite for unmapped units. */
  classId?: string
```

Replace the `spriteSrc` line (currently `const spriteSrc = c.sprite ?? (speaker ? unitSpritePathForName(speaker) : null)`) with:

```ts
  const assetSprite = classId != null || characterId != null
    ? (() => { const sid = spriteIdForUnit(characterId, classId ?? ''); return sid ? spritePathFor(sid) : null })()
    : null
  const spriteSrc = c.sprite ?? assetSprite
```

and destructure the two new props in the component signature.

- [ ] **Step 4: Update the two combat callers**

In `InitiativeEntry.tsx` and `UnitDetailPanel.tsx`, the `<CharacterPortrait speaker={unit.name} …/>` calls gain:

```tsx
characterId={unit.characterId ?? null}
classId={unit.classId as unknown as string}
```

- [ ] **Step 5: Run tests + rendered check**

Run: `npx vitest run tests/unit/ui/ && npx tsc --noEmit`
Expected: PASS. Then screenshot the combat initiative strip (dev server, New Game) — enemy portraits must still be sprite crops, not initials.

- [ ] **Step 6: Commit**

```bash
git add phaser/src/ui/components/CharacterPortrait.tsx phaser/src/ui/scenes/combat/InitiativeEntry.tsx phaser/src/ui/scenes/combat/UnitDetailPanel.tsx phaser/tests/unit/ui/components/CharacterPortrait.test.tsx
git commit -m "refactor(ui): portraits resolve via characterAssets — KEEP-IN-SYNC mirror deleted

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Every unit is born with a characterId (buildUnit, seeders, recruits, enemy groups)

**Files:**
- Modify: `phaser/src/systems/buildUnit.ts` (signature)
- Modify: `phaser/src/systems/starterParty.ts:16-33`
- Modify: `phaser/src/ui/screens/town/TavernPanel.tsx:46` (recruit build call)
- Modify: `phaser/src/data/schemas/enemyGroup.ts` (member gains `characterId`), `phaser/src/domain/` enemy-group type if separate (grep `interface EnemyGroupMember`)
- Modify: `phaser/src/data/content/enemyGroups/darens_gang.json` (Daren gains `"characterId": "daren"`), `phaser/src/data/content/towns/pine_crossing.json` + `borderkeep_castle.json` (recruits gain `characterId`)
- Modify: `phaser/src/game/scenes/seedGroupBattle.ts`, `seedStubBattle.ts`, `seedTutorialBattle.ts`, `seedBossBattle.ts`, `seedDungeonBattle.ts` (thread it)
- Test: `phaser/tests/unit/systems/buildUnit.test.ts` (extend), `phaser/tests/unit/game/seedStubBattle.test.ts` (extend)

**Interfaces:**
- Consumes: `Unit.characterId` (Task 1).
- Produces: `buildUnit(classId: string, level: number, name: string, id: string, characterId?: string | null): Unit | null` — the new optional 5th param defaults to `null`. Starters pass `'roy' | 'marcus' | 'lilina'`; tavern recruits pass the town JSON's optional `characterId ?? null`; enemy seeders pass the group member's optional `characterId ?? null`; boss seeder passes `'warlord'`; tutorial passes `'roy'` / `'bandit'`.

- [ ] **Step 1: Write the failing tests**

Extend `tests/unit/systems/buildUnit.test.ts`:

```ts
it('threads characterId onto the unit (default null)', () => {
  const u = buildUnit('knight', 1, 'Garrik', 'recruit_g', 'garrik')
  expect(u?.characterId).toBe('garrik')
  const anon = buildUnit('bandit', 1, 'Bandit', 'e1')
  expect(anon?.characterId).toBeNull()
})
```

Extend `tests/unit/game/seedStubBattle.test.ts` (keep every existing assertion untouched):

```ts
it('seeds characterIds: starters mapped, generic enemies null', () => {
  const evt = seedStubBattle(createRng({ seed: 1, counter: 0 }).state())
  const byName = new Map(evt.payload.units.map((u) => [u.name, u]))
  expect(byName.get('Roy')?.characterId).toBe('roy')
  expect(byName.get('Bandit')?.characterId).toBeNull()
})
```

- [ ] **Step 2: Run to verify both fail**

Run: `npx vitest run tests/unit/systems/buildUnit.test.ts tests/unit/game/seedStubBattle.test.ts`
Expected: FAIL — `characterId` is `undefined` (param doesn't exist yet).

- [ ] **Step 3: Implement**

`buildUnit.ts` — add the parameter and set it on the returned unit:

```ts
export function buildUnit(
  classId: string, level: number, name: string, id: string,
  characterId: string | null = null,
): Unit | null {
  // ...existing body unchanged, add to the returned object:
  //   characterId,
}
```

`starterParty.ts` — each `STARTERS` entry already has `id: 'roy' | 'marcus' | 'lilina'`; pass it through: `buildUnit(s.classId, 1, s.name, s.id, s.id)`.

`TavernPanel.tsx:46` — town recruit rows: `buildUnit(r.classId, r.level, r.name, \`recruit_${r.id}\`, r.characterId ?? null)`. Add `characterId?: string` to the town-recruit schema (grep `recruits` in `phaser/src/data/schemas/town.ts`) and set `"characterId": "garrik"` / `"lyra"` on the Pine Crossing entries in `towns/pine_crossing.json` (Tane/Seraphine get none until the cast wave).

Enemy-group schema (`phaser/src/data/schemas/enemyGroup.ts`): member object gains `characterId: z.string().optional()`. `darens_gang.json` Daren member gains `"characterId": "daren"`.

Seeders: `seedGroupBattle.ts` passes `member.characterId ?? null` where units are constructed; `seedBossBattle.ts` passes `'warlord'` for the boss and `null` for guards; `seedTutorialBattle.ts` passes `'roy'` / `null`; `seedStubBattle.ts` passes the starter ids for the fallback trio and `null` for bandits; `seedDungeonBattle.ts` passes `member.characterId ?? null` (same pattern as group battle). Where a seeder builds unit objects directly (not via `buildUnit`), set `characterId` explicitly in the object literal.

- [ ] **Step 4: Run tests to verify pass + lint content**

Run: `npx vitest run tests/unit/ && npm run lint:content && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A phaser/src phaser/tests
git commit -m "feat(identity): every unit born with a characterId (seeders, recruits, groups)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
---

### Task 6: Capture becomes state, not a name suffix

**Files:**
- Modify: `phaser/src/systems/combatReducer.ts:702-710` (the `'capture'` success branch)
- Modify: `phaser/src/persistence/` hydration path (grep `hydrate` / `fromSaveFile` in `phaser/src/persistence/` — apply the migration where `partyUnits`/`combat.units` are parsed)
- Modify: `phaser/CONTEXT.md` (capture marker note — same commit)
- Test: `phaser/tests/unit/systems/` capture reducer test (grep `capture` under tests/unit — extend the existing one, else create `tests/unit/systems/captureReducer.test.ts`), plus `tests/unit/persistence/fullHydration.test.ts` (extend)

**Interfaces:**
- Consumes: `Unit.captured` (Task 1).
- Produces: capture success sets `captured: true`, `hp.current = 0`, **name untouched**. New pure helper in the same commit — `capturedUnits(units: Record<string, Unit>): Unit[]` exported from `phaser/src/systems/captureResolution.ts` (file created here, extended in Task 7). Hydration migration: any loaded unit whose name ends `' (captured)'` gets the suffix stripped and `captured: true`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/systems/captureReducer.test.ts
import { describe, it, expect } from 'vitest'
import { combatReducer } from '../../../src/systems/combatReducer'
import { createRng } from '../../../src/systems/rng'
// build a minimal state via the existing test helpers used by neighboring
// reducer tests (grep those tests for their state fixture and reuse it).

describe('capture marks state, not name', () => {
  it('success sets captured=true and leaves the name alone', () => {
    // fixture: one enemy at 1/18 HP, adjacency 1 → chance ≈ 0.82; rng seeded to roll under it
    const { state } = setupCaptureFixture()          // reuse neighboring fixture pattern
    const rng = createRng({ seed: 3, counter: 0 })   // pick a seed that rolls < chance; assert on the success branch
    const out = combatReducer(state, { type: 'capture', payload: { targetId: enemyId, attackerIds: [allyId] } }, rng)
    const captured = out.state.units[enemyId as unknown as string]!
    expect(captured.captured).toBe(true)
    expect(captured.hp.current).toBe(0)
    expect(captured.name).toBe('Daren')              // NO suffix
  })
})
```

And in `tests/unit/persistence/fullHydration.test.ts` add:

```ts
it('migrates legacy " (captured)" name suffix to the captured flag', () => {
  const save = makeLegacySaveWithUnit({ name: 'Daren (captured)' }) // clone the file fixture the test already uses
  const run = hydrate(save)
  const daren = findUnit(run, 'Daren')
  expect(daren.name).toBe('Daren')
  expect(daren.captured).toBe(true)
})
```

(Adapt helper names to what `fullHydration.test.ts` actually uses — read it first; the assertion contract above is what matters.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/systems/captureReducer.test.ts tests/unit/persistence/fullHydration.test.ts`
Expected: new tests FAIL (suffix still applied; no migration).

- [ ] **Step 3: Implement**

`combatReducer.ts` success branch becomes:

```ts
      if (success) {
        // Taken alive: off the grid like death, but flagged — resolution
        // (flags, dialogue, the coal-oath offer) happens at battle end.
        newUnits[targetId as unknown as string] = {
          ...target,
          hp: { ...target.hp, current: 0 },
          captured: true,
        }
      }
```

Create `phaser/src/systems/captureResolution.ts`:

```ts
import type { Unit } from '../domain/unit'

/** Units taken alive this battle (captured flag, not the legacy name marker). */
export function capturedUnits(units: Record<string, Unit>): Unit[] {
  return Object.values(units).filter((u) => u.captured === true)
}
```

Hydration migration (in the persistence load path, applied to every parsed unit array — party and combat):

```ts
const LEGACY_CAPTURED = / \(captured\)$/
function migrateCapturedSuffix<T extends { name: string; captured?: boolean }>(u: T): T {
  if (!LEGACY_CAPTURED.test(u.name)) return u
  return { ...u, name: u.name.replace(LEGACY_CAPTURED, ''), captured: true }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/systems/ tests/unit/persistence/ && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: CONTEXT.md + commit**

CONTEXT.md: update the capture note (search "captured") to: capture success sets `captured: true` (name untouched); legacy suffix migrated at hydration.

```bash
npm run check-context-doc
git add -A phaser/src phaser/tests phaser/CONTEXT.md
git commit -m "refactor(combat): capture is a unit flag, not a name suffix (+ save migration)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: captureTargets thread through to battle end — Blood Ties finally fires

**Files:**
- Modify: `phaser/src/state/runStore.ts:36,215-219` (`pendingCombat` carries `captureTargets`)
- Modify: `phaser/src/ui/screens/OverworldScene.tsx:66,218,352` (thread through `onTravelToCombat`)
- Modify: `phaser/src/App.tsx:378-385` (pass into combat seed)
- Modify: `phaser/src/domain/combatState.ts` (state gains `captureTargets?: CaptureTarget[]`), `phaser/src/systems/combatReducer.ts` `startBattle` case (~line 160) stores them, seeder payload type
- Modify: `phaser/src/systems/captureResolution.ts` (add `resolveCaptures`)
- Modify: `phaser/src/App.tsx` battle-end handoff (`onWinBattle`, ~line 380-412) — apply results
- Modify: `phaser/CONTEXT.md` (combatState + runStore fields — same commit)
- Test: `phaser/tests/unit/systems/captureResolution.test.ts`

**Interfaces:**
- Consumes: `CaptureTarget` from `phaser/src/domain/encounter.ts:37-43` (`{ unitName, capturedDialogueId, killedDialogueId, capturedFlag, killedFlag }` — this plan adds optional `characterId?: string` to it + its Zod schema at `data/schemas/encounter.ts:5-11`), `capturedUnits` (Task 6).
- Produces:

```ts
export interface CaptureResolution {
  flags: string[]            // flag keys to set (permanent scope)
  dialogueId: string | null  // first matched captured/killed dialogue to fire
}
export function resolveCaptures(
  units: Record<string, Unit>,
  targets: readonly CaptureTarget[] | undefined,
): CaptureResolution
```

Matching rule: a target matches a unit by `characterId` when the target declares one, else by exact `unitName === unit.name` (legacy). Captured match → `capturedFlag` + `capturedDialogueId`; present-but-dead (hp 0, not captured) → `killedFlag` + `killedDialogueId`; absent from the battle → nothing.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/systems/captureResolution.test.ts
import { describe, it, expect } from 'vitest'
import { resolveCaptures } from '../../../src/systems/captureResolution'
import type { Unit } from '../../../src/domain/unit'

const unit = (over: Partial<Unit>): Unit => ({
  id: 'u' as never, name: 'Daren', classId: 'bandit' as never, level: 2,
  hp: { current: 0, max: 18 },
  stats: { str: 5, mag: 1, skl: 4, spd: 5, def: 4, res: 2, lck: 3 },
  position: null, ap: 0, armor: 0, statuses: [], ...over,
})

const TARGET = {
  characterId: 'daren', unitName: 'Daren',
  capturedDialogueId: 'sq_blood_ties_daren_captured',
  killedDialogueId: 'sq_blood_ties_daren_killed',
  capturedFlag: 'daren_captured', killedFlag: 'daren_killed',
}

describe('resolveCaptures', () => {
  it('captured target → captured flag + dialogue', () => {
    const r = resolveCaptures({ d: unit({ characterId: 'daren', captured: true }) }, [TARGET])
    expect(r.flags).toEqual(['daren_captured'])
    expect(r.dialogueId).toBe('sq_blood_ties_daren_captured')
  })
  it('dead (not captured) target → killed flag + dialogue', () => {
    const r = resolveCaptures({ d: unit({ characterId: 'daren' }) }, [TARGET])
    expect(r.flags).toEqual(['daren_killed'])
    expect(r.dialogueId).toBe('sq_blood_ties_daren_killed')
  })
  it('legacy name matching works without characterId', () => {
    const { characterId: _cut, ...legacy } = TARGET
    const r = resolveCaptures({ d: unit({ captured: true }) }, [legacy])
    expect(r.flags).toEqual(['daren_captured'])
  })
  it('surviving target / no targets → nothing', () => {
    expect(resolveCaptures({ d: unit({ hp: { current: 5, max: 18 }, characterId: 'daren' }) }, [TARGET]).flags).toEqual([])
    expect(resolveCaptures({}, undefined).dialogueId).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/systems/captureResolution.test.ts`
Expected: FAIL — `resolveCaptures` not exported.

- [ ] **Step 3: Implement `resolveCaptures`**

Append to `phaser/src/systems/captureResolution.ts`:

```ts
import type { CaptureTarget } from '../domain/encounter'

export interface CaptureResolution {
  flags: string[]
  dialogueId: string | null
}

/** Post-battle resolution of authored capture targets → flags + dialogue.
 *  Pure: caller (App battle-end handoff) dispatches the results. */
export function resolveCaptures(
  units: Record<string, Unit>,
  targets: readonly CaptureTarget[] | undefined,
): CaptureResolution {
  const flags: string[] = []
  let dialogueId: string | null = null
  if (!targets?.length) return { flags, dialogueId }
  const all = Object.values(units)
  for (const t of targets) {
    const match = all.find((u) =>
      t.characterId ? u.characterId === t.characterId : u.name === t.unitName)
    if (!match || match.hp.current > 0) continue
    if (match.captured) {
      flags.push(t.capturedFlag)
      dialogueId ??= t.capturedDialogueId
    } else {
      flags.push(t.killedFlag)
      dialogueId ??= t.killedDialogueId
    }
  }
  return { flags, dialogueId }
}
```

Add `characterId?: string` to `CaptureTarget` (`domain/encounter.ts`) and `characterId: z.string().optional()` to `CaptureTargetSchema` (`data/schemas/encounter.ts`); set `"characterId": "daren"` on the target in `encounters/borderlands_road.json:392-398`.

- [ ] **Step 4: Thread the targets**

1. `runStore.ts:36`: `pendingCombat: { enemyGroupId: string; captureTargets?: CaptureTarget[] } | null` — and at :215-219 copy `effect.captureTargets` into the set() (the travel-encounter effect already carries the outcome object; grep the effect construction for where `enemyGroupId` is read and take `captureTargets` from the same outcome).
2. `OverworldScene.tsx`: `onTravelToCombat: (nodeId, enemyGroupId?, captureTargets?) => void`; pass `pendingCombat.captureTargets` (line ~218) and `result.outcome.captureTargets` (line ~352).
3. `App.tsx onTravelToCombat`: accept and stash them into combat via the seed event: `seedGroupBattle(...)` return value gains `captureTargets` in its payload — add `captureTargets?: CaptureTarget[]` to the `startBattle` payload type (`domain/combatState.ts` event union) and to `CombatState` itself; `combatReducer` `startBattle` case stores `captureTargets: event.payload.captureTargets` on the new state.
4. `App.tsx` battle-end handoff (in the victory path of `onWinBattle`, before `useCombatStore.getState().reset()`):

```ts
const combatUnits = useCombatStore.getState().state.units
const targets = useCombatStore.getState().state.captureTargets
const resolution = resolveCaptures(combatUnits, targets)
for (const flag of resolution.flags) {
  run.dispatch({ type: 'setFlag', payload: { key: flag as never, scope: 'permanent' } })
}
if (resolution.dialogueId) {
  run.dispatch({ type: 'startDialogue', payload: { dialogueId: resolution.dialogueId as never, nodeId: 'start' } })
}
```

(Adapt the two dispatch shapes to the runStore action types actually present — grep `setFlag` and `startDialogue` in `runStore.ts` and copy their existing payload shapes verbatim.)

- [ ] **Step 5: Run everything + play the chain**

Run: `npm run verify`
Expected: green. Then the real proof (CLI, no browser):

Run: `npx tsx scripts/cli/play.ts combat --seed 7 --cmds "auto" --json` (smoke: reducer changes break nothing)
Then in the browser (dev server): New Game → travel to Daren's ambush (use `window.__debug.runStore` to set the route flags if needed) → Subdue Daren → verify at battle end the `sq_blood_ties_daren_captured` dialogue FIRES and `daren_captured` is set (`window.__debug.runStore.getState().flags`). This is the first time this chain has ever worked — screenshot it.

- [ ] **Step 6: CONTEXT.md + commit**

CONTEXT.md: `pendingCombat` + `CombatState.captureTargets` + `systems/captureResolution.ts` entries.

```bash
npm run check-context-doc
git add -A phaser/src phaser/tests phaser/CONTEXT.md
git commit -m "feat(capture): thread captureTargets to battle end; resolveCaptures fires flags+dialogue

The Blood Ties capture chain works for the first time: Subdue Daren ->
daren_captured flag -> quest dialogue. Matching prefers characterId with
unitName as legacy fallback.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
---

### Task 8: Registry re-keys on characterId with speaker aliases

**Files:**
- Modify: `phaser/src/ui/data/characters.ts` (KNOWN keys, `getCharacter`, new `SPEAKER_ALIASES` + `getCharacterById`)
- Test: `phaser/tests/unit/ui/data/characters.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `KNOWN: Record<string, CharacterDef>` keyed by **characterId** (`'roy'`, `'marcus'`, `'the_warlord'` → use `'warlord'`, `'bandit_archer'`, …). `SPEAKER_ALIASES: Record<string, string>` mapping every dialogue speaker string currently in content (`'Roy'`, `'The Warlord'`, `'Bandit Leader'`, `'Traveling Merchant'`, `'Wounded Traveler'`, `'Bandit Archer'`, `'Brigand Chief'`, …) to a characterId. `getCharacter(speaker)` unchanged in signature/behavior: resolves alias → KNOWN, exact-key → KNOWN (so ids also work as speakers), else `defaultCharacter`. New `getCharacterById(id: string): CharacterDef | null`. **Dialogue JSON is not touched** — aliases absorb it (plan 3 flips dialogue to ids when names change).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ui/data/characters.test.ts
import { describe, it, expect } from 'vitest'
import { getCharacter, getCharacterById, SPEAKER_ALIASES, KNOWN } from '../../../../src/ui/data/characters'

describe('characters registry (characterId keys + speaker aliases)', () => {
  it('KNOWN is keyed by characterId, not display strings', () => {
    expect(KNOWN['roy']).toBeDefined()
    expect(KNOWN['Roy']).toBeUndefined()
  })
  it('dialogue speaker strings resolve through aliases', () => {
    expect(getCharacter('Roy').id).toBe('roy')
    expect(getCharacter('The Warlord').id).toBe('warlord')
    expect(getCharacter('Bandit Leader').id).toBe('bandit_leader')
  })
  it('ids resolve directly too', () => {
    expect(getCharacter('roy').id).toBe('roy')
  })
  it('unknown speakers still hash-fallback', () => {
    expect(getCharacter('Mystery Pilgrim').displayName).toBe('Mystery Pilgrim')
  })
  it('every alias points at a KNOWN entry', () => {
    for (const id of Object.values(SPEAKER_ALIASES)) expect(KNOWN[id]).toBeDefined()
  })
  it('getCharacterById is null-safe', () => {
    expect(getCharacterById('roy')?.displayName).toBe('Roy')
    expect(getCharacterById('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/ui/data/characters.test.ts`
Expected: FAIL — KNOWN keyed by display names; no exports.

- [ ] **Step 3: Implement**

In `characters.ts`: re-key every `KNOWN` entry to snake_case characterId (`Roy`→`roy`, `Marcus`→`marcus`, `Lilina`→`lilina`, `Kael`→`kael`, `Daren`→`daren`, `Garrik`→`garrik`, `Lyra`→`lyra`, `'The Warlord'`→`warlord`, `'Bandit Leader'`→`bandit_leader`, `'Traveling Merchant'`→`traveling_merchant`, `'Wounded Traveler'`→`wounded_traveler`, `'Narrator'`→`narrator`, class-plate entries `'Bandit'`→`bandit`, `'Bandit Archer'`→`bandit_archer`, `'Brigand Chief'`→`brigand_chief`, `'Shield Knight'`→`shield_knight`, `'Raider Mage'`→`raider_mage`, `'Raider Cleric'`→`raider_cleric`, `'Ember Mage'`→`ember_mage`, `'Alpha Wolf'`→`alpha_wolf`, `'Wolf'`→`wolf`, `'Bone Dagger Thief'`→`thief`). Keep each entry's `id` field = the new key and `displayName` = the old display string.

Add + export:

```ts
/** Dialogue `speaker` string → characterId. Content JSON keeps using display
 *  names; this table absorbs them. Grep dialogue/*.json "speaker" when adding. */
export const SPEAKER_ALIASES: Record<string, string> = {
  'Roy': 'roy', 'Marcus': 'marcus', 'Lilina': 'lilina',
  'Kael': 'kael', 'Daren': 'daren', 'Garrik': 'garrik', 'Lyra': 'lyra',
  'The Warlord': 'warlord', 'Bandit Leader': 'bandit_leader',
  'Traveling Merchant': 'traveling_merchant', 'Wounded Traveler': 'wounded_traveler',
  'Bandit': 'bandit', 'Bandit Archer': 'bandit_archer', 'Brigand Chief': 'brigand_chief',
  'Shield Knight': 'shield_knight', 'Raider Mage': 'raider_mage',
  'Raider Cleric': 'raider_cleric', 'Ember Mage': 'ember_mage',
  'Alpha Wolf': 'alpha_wolf', 'Wolf': 'wolf', 'Bone Dagger Thief': 'thief',
  'Narrator': 'narrator',
}

export function getCharacterById(id: string): CharacterDef | null {
  return KNOWN[id] ?? null
}
```

`getCharacter` becomes:

```ts
export function getCharacter(speaker: string | undefined): CharacterDef {
  if (!speaker) return KNOWN['narrator']!
  const id = SPEAKER_ALIASES[speaker] ?? speaker
  return KNOWN[id] ?? defaultCharacter(speaker)
}
```

Also export `KNOWN` (the test asserts through it). Grep the repo for `KNOWN[` / `getCharacter(` consumers (`DialogueModal`, `CharacterPortrait`, stories) — signatures unchanged, so only the `'Narrator'` literal inside `getCharacter` needed the re-key.

- [ ] **Step 4: Run the full UI suite**

Run: `npx vitest run tests/unit/ui/ && npx tsc --noEmit`
Expected: PASS — DialogueModal tests (speaker names) still green through aliases.

- [ ] **Step 5: Commit**

```bash
git add phaser/src/ui/data/characters.ts phaser/tests/unit/ui/data/characters.test.ts
git commit -m "refactor(registry): characters keyed by characterId; dialogue speakers resolve via aliases

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Save version bump + full-gate sweep

**Files:**
- Modify: `phaser/src/persistence/saveFormat.ts:5` (`SAVE_VERSION`)
- Modify: the version-acceptance check in the load path (grep `SAVE_VERSION` consumers in `phaser/src/persistence/` — old `'0.7.0-gear'` saves must still load through the Task 6 migration, so the loader accepts both versions)
- Modify: `phaser/CONTEXT.md` (save-format note — same commit)
- Test: `phaser/tests/unit/persistence/fullHydration.test.ts` (extend)

**Interfaces:**
- Produces: `SAVE_VERSION = '0.8.0-identity'`; loader accepts `'0.7.0-gear' | '0.8.0-identity'` (7.x runs Task 6's suffix migration; `characterId` absent → stays undefined, sprite lookup class-falls-back — no unit migration needed).

- [ ] **Step 1: Write the failing test**

```ts
it('accepts 0.7.0-gear saves and 0.8.0-identity saves', () => {
  const legacy = makeSave({ saveVersion: '0.7.0-gear' })    // reuse the file's fixture builder
  expect(() => hydrate(legacy)).not.toThrow()
  const current = makeSave({ saveVersion: '0.8.0-identity' })
  expect(() => hydrate(current)).not.toThrow()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/persistence/fullHydration.test.ts`
Expected: FAIL — `'0.8.0-identity'` rejected (version literal mismatch).

- [ ] **Step 3: Implement**

`saveFormat.ts`:

```ts
export const SAVE_VERSION = '0.8.0-identity' as const
export type SaveVersion = typeof SAVE_VERSION
/** Versions the loader accepts; pre-0.8 saves run the identity migrations. */
export const ACCEPTED_SAVE_VERSIONS = ['0.7.0-gear', SAVE_VERSION] as const
```

Point the loader's version check at `ACCEPTED_SAVE_VERSIONS.includes(...)`.

- [ ] **Step 4: The full gate**

Run: `npm run verify && npx playwright test --reporter=line`
Expected: everything green (23 e2e incl. visual snapshots — identity work must be pixel-invisible this plan; if a snapshot diffs, that's a BUG in the refactor, not an intended change).

- [ ] **Step 5: CONTEXT.md + commit**

```bash
npm run check-context-doc
git add -A phaser/src phaser/tests phaser/CONTEXT.md
git commit -m "feat(save): 0.8.0-identity version + legacy acceptance

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review (performed at write time)

**Spec coverage (Appendix A):** stable characterId ✓ (T1, T5) · one mapping module ✓ (T2) · BoardScene/BootScene/CharacterPortrait consume it ✓ (T3, T4) · capture-as-flag, not name ✓ (T6) · capture chain wired end-to-end ✓ (T7) · registry exact-string keys → id keys + aliases ✓ (T8) · saves survive ✓ (T6 migration, T9 versioning). Appendix B items touched here: the dead captureTargets chain (T7). NOT in this plan by design: renames (plan 3), recruitUnit no-op stub, growthRates, tavern name (plans 3–4).
**Placeholders:** none — every step carries code or an exact command. Two steps direct the implementer to read a neighboring fixture/action shape before writing (fullHydration helpers, runStore dispatch payloads); the assertion/behavior contracts are stated so those reads are mechanical.
**Type consistency:** `characterId?: string | null` everywhere; `spriteIdForUnit(characterId, classId)` signature identical in T2/T3/T4; `resolveCaptures(units, targets)` matches its T7 test; `capturedUnits` defined T6, available to T7's file.

## Execution order & independence

T1 → T2 → (T3, T4 parallel) → T5 → T6 → T7 → T8 → T9. T8 is independent of T5–T7 and may run any time after T1. Each task lands green (`npm run verify`) on its own — no task leaves the tree red.
