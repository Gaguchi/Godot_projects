# Phaser Combat Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2-week combat sandbox in `phaser/` that proves out the TS + Phaser 4 + React + Vite stack and the AI iteration loop, before scaling the migration to wider FE_MB scope.

**Architecture:** Phaser 4 owns combat (grid, units, cards, HUD) inside a `<canvas>`. React 19 mounts modals only via a transparent `<div>` overlay. Both share a Zustand store. JSON game data validated by Zod at boot. Playwright MCP gives the AI agent visual perception of the running game.

**Tech Stack:** TypeScript 5.7 (strict), Phaser 4, React 19, Vite 6, Zustand 5, Zod 3, Tailwind CSS 4, Vitest 2, Playwright 1.50.

**Spec:** `docs/superpowers/specs/2026-05-05-phaser-migration-design.md`

**Working directory for all tasks:** `phaser/` (created in Task 1).

---

## Phase 1 — Scaffold + AI Loop (Day 1-2, Tasks 1-6)

Validate the highest-uncertainty piece first: can the AI iterate on a Phaser scene by writing TS and reading screenshots via Playwright MCP?

### Task 1: Initialize Vite + React-TS project

**Files:**
- Create: `phaser/package.json`
- Create: `phaser/index.html`
- Create: `phaser/src/main.tsx`
- Create: `phaser/tsconfig.json`
- Create: `phaser/vite.config.ts`

- [ ] **Step 1: Scaffold Vite project**

```bash
npm create vite@latest phaser -- --template react-ts
```

Expected: `phaser/` folder created with default Vite + React + TS template.

- [ ] **Step 2: Install base dependencies**

```bash
cd phaser && npm install
```

Expected: `node_modules/` populated, `package-lock.json` created.

- [ ] **Step 3: Run dev server smoke test**

```bash
npm run dev
```

Expected: Vite serves at `http://localhost:5173`. Default Vite welcome page renders.

- [ ] **Step 4: Stop dev server, commit**

```bash
git add phaser/
git commit -m "feat(phaser): scaffold vite react-ts project"
```

---

### Task 2: Install Phaser 4 + supporting libs

**Files:**
- Modify: `phaser/package.json`

- [ ] **Step 1: Install game/UI/state libs**

```bash
cd phaser
npm install phaser@^4.0.0 zustand@^5.0.0 zod@^3.23.0
```

- [ ] **Step 2: Install Tailwind 4**

```bash
npm install -D tailwindcss@^4.0.0 @tailwindcss/vite@^4.0.0
```

- [ ] **Step 3: Install testing**

```bash
npm install -D vitest@^2.0.0 @vitest/ui @playwright/test@^1.50.0
npx playwright install chromium
```

- [ ] **Step 4: Verify install**

```bash
npx tsc --noEmit
```

Expected: No errors (default template still typechecks).

- [ ] **Step 5: Commit**

```bash
git add phaser/package.json phaser/package-lock.json
git commit -m "feat(phaser): install phaser 4, zustand, zod, tailwind, vitest, playwright"
```

---

### Task 3: Configure TypeScript strict + Vite + Tailwind

**Files:**
- Modify: `phaser/tsconfig.json`
- Modify: `phaser/vite.config.ts`
- Create: `phaser/src/index.css`
- Modify: `phaser/src/main.tsx`

- [ ] **Step 1: Tighten tsconfig**

Replace `phaser/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Configure Vite with Tailwind plugin**

Replace `phaser/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: { target: 'es2022' },
});
```

- [ ] **Step 3: Initialize Tailwind**

Replace `phaser/src/index.css`:

```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
  margin: 0;
  background: #1a1410;
  color: #e8d8c0;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}
```

- [ ] **Step 4: Verify dev server still runs**

```bash
npm run dev
```

Expected: serves at :5173 with dark background, no console errors.

- [ ] **Step 5: Commit**

```bash
git add phaser/tsconfig.json phaser/vite.config.ts phaser/src/index.css
git commit -m "feat(phaser): strict tsconfig, vite + tailwind config"
```

---

### Task 4: Mount Phaser canvas alongside React shell

**Files:**
- Replace: `phaser/src/main.tsx`
- Create: `phaser/src/ui/App.tsx`
- Create: `phaser/src/game/scenes/BootScene.ts`
- Create: `phaser/src/game/createGame.ts`

- [ ] **Step 1: Create BootScene placeholder**

Create `phaser/src/game/scenes/BootScene.ts`:

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.add.text(width / 2, height / 2, 'Phaser ready', {
      color: '#e8d8c0',
      fontSize: '24px',
    }).setOrigin(0.5);
  }
}
```

- [ ] **Step 2: Create game factory**

Create `phaser/src/game/createGame.ts`:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#1a1410',
    scene: [BootScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
```

- [ ] **Step 3: Create React App shell**

Create `phaser/src/ui/App.tsx`:

```tsx
export function App(): JSX.Element {
  return (
    <div
      id="react-shell"
      className="absolute inset-0 pointer-events-none"
    >
      {/* Modals will mount here in later tasks */}
    </div>
  );
}
```

- [ ] **Step 4: Wire main.tsx**

Replace `phaser/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { createGame } from './game/createGame';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

const phaserParent = document.createElement('div');
phaserParent.id = 'phaser-parent';
phaserParent.className = 'absolute inset-0';
rootEl.appendChild(phaserParent);

const reactParent = document.createElement('div');
reactParent.id = 'react-parent';
reactParent.className = 'absolute inset-0 pointer-events-none';
rootEl.appendChild(reactParent);

createGame(phaserParent);

createRoot(reactParent).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Update index.html**

Replace `<body>` content in `phaser/index.html`:

```html
<body>
  <div id="root" class="relative h-screen w-screen"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

- [ ] **Step 6: Verify**

```bash
npm run dev
```

Expected: Browser shows "Phaser ready" centered on dark background. No console errors.

- [ ] **Step 7: Commit**

```bash
git add phaser/src/ phaser/index.html
git commit -m "feat(phaser): mount phaser canvas + react shell, BootScene placeholder"
```

---

### Task 5: Configure Playwright + smoke test

**Files:**
- Create: `phaser/playwright.config.ts`
- Create: `phaser/tests/e2e/boot.spec.ts`
- Create: `phaser/tests/e2e/snapshots/.gitkeep`

- [ ] **Step 1: Configure Playwright**

Create `phaser/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 720 } },
    },
  ],
});
```

- [ ] **Step 2: Write smoke test**

Create `phaser/tests/e2e/boot.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('boot scene renders Phaser ready text', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // let Phaser scene boot
  await expect(page).toHaveScreenshot('boot.png', {
    maxDiffPixels: 200,
  });
});
```

- [ ] **Step 3: Add npm test scripts**

Modify `phaser/package.json` scripts section:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:update": "playwright test --update-snapshots",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: Generate baseline snapshot**

```bash
npm run test:e2e:update
```

Expected: `tests/e2e/boot.spec.ts-snapshots/boot-chromium-*.png` created.

- [ ] **Step 5: Run E2E to confirm green**

```bash
npm run test:e2e
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add phaser/playwright.config.ts phaser/tests/ phaser/package.json
git commit -m "feat(phaser): playwright config, smoke E2E with snapshot baseline"
```

---

### Task 6: MCP config + verify AI iteration loop

**Files:**
- Create: `phaser/.claude/CLAUDE.md`
- Create: `phaser/.mcp.json`
- Create: `phaser/README.md`

- [ ] **Step 1: Create local CLAUDE.md for phaser/**

Create `phaser/.claude/CLAUDE.md`:

```markdown
# phaser/ — FE_MB Combat Sandbox

TypeScript + Phaser 4 + React 19 (modals only) + Vite + Zustand + Zod.
Spec: ../docs/superpowers/specs/2026-05-05-phaser-migration-design.md
Plan: ../docs/superpowers/plans/2026-05-05-phaser-sandbox.md

## Run
- `npm run dev` — Vite at :5173
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E
- `npm run test:e2e:update` — Update visual snapshot baselines
- `npm run typecheck` — tsc --noEmit

## Architecture
- src/game/ — Phaser scenes, entities, systems (no React imports)
- src/ui/ — React shell + modals only (no Phaser imports)
- src/state/ — Zustand stores (the bridge)
- src/data/ — JSON + Zod schemas

## Conventions
- Pure systems (combatResolver, deckManager) MUST NOT import phaser.
- React components MUST NOT import phaser.
- Communication between Phaser and React: Zustand store only.
- Detached arrays: never mutate shared array references; always `.slice()` or `[...]` at boundaries.
```

- [ ] **Step 2: Create MCP config**

Create `phaser/.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--vision", "auto"]
    }
  }
}
```

- [ ] **Step 3: Write README**

Create `phaser/README.md`:

```markdown
# FE_MB Phaser Sandbox

First milestone of the FE_MB migration from Godot to TypeScript + Phaser 4.

## Quickstart
```bash
npm install
npm run dev
```

## Test
```bash
npm test            # Vitest unit
npm run test:e2e    # Playwright E2E
npm run typecheck   # tsc
```

## Stack
- Phaser 4 (combat), React 19 (modals), Zustand 5 (state)
- Zod 3 (data validation), Tailwind 4 (modal styling)
- Vite 6 (build/HMR), Vitest 2 + Playwright 1.50 (test)

See `docs/superpowers/specs/2026-05-05-phaser-migration-design.md` for design rationale.
```

- [ ] **Step 4: Manually verify the AI iteration loop**

Open Claude Code in `phaser/`. Ask the agent: *"Change BootScene's text from 'Phaser ready' to 'Hello World', then verify by screenshot."*

Expected: agent edits BootScene.ts, runs `npm run test:e2e:update`, sees the new snapshot, confirms text changed. Total wall time under 30 seconds.

If the loop doesn't work in under 30 seconds, debug before continuing — this is the migration's core hypothesis.

- [ ] **Step 5: Revert the test edit**

```bash
git checkout -- phaser/src/game/scenes/BootScene.ts phaser/tests/e2e/
npm run test:e2e:update  # restore baseline
```

- [ ] **Step 6: Commit Phase 1 baseline**

```bash
git add phaser/.claude/ phaser/.mcp.json phaser/README.md phaser/tests/e2e/
git commit -m "feat(phaser): MCP config, CLAUDE.md, README; AI loop verified"
git tag phaser-phase1-scaffold
```

---

## Phase 2 — Card Hand UI (Day 3-5, Tasks 7-14)

The hardest UX is built first: card hand → grid targeting interaction. If this feels good, the rest follows.

### Task 7: Zod schemas for card, unit, enemy

**Files:**
- Create: `phaser/src/data/schemas/card.ts`
- Create: `phaser/src/data/schemas/unit.ts`
- Create: `phaser/src/data/schemas/enemy.ts`
- Create: `phaser/src/data/schemas/index.ts`
- Create: `phaser/tests/unit/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `phaser/tests/unit/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CardSchema, UnitSchema, EnemySchema } from '../../src/data/schemas';

describe('CardSchema', () => {
  it('accepts a valid attack card', () => {
    const card = {
      id: 'iron_strike',
      name: 'Iron Strike',
      cost: 1,
      damage_base: 4,
      stat: 'STR',
      target: 'ENEMY',
      range: { min: 1, max: 1 },
      aoe: { shape: 'single', radius: 0 },
      description: 'Single target attack.',
    };
    expect(CardSchema.parse(card)).toEqual(card);
  });

  it('rejects negative cost', () => {
    const bad = { id: 'x', name: 'X', cost: -1, damage_base: 0, stat: 'STR',
      target: 'ENEMY', range: { min: 1, max: 1 },
      aoe: { shape: 'single', radius: 0 }, description: '' };
    expect(() => CardSchema.parse(bad)).toThrow();
  });

  it('accepts AOE card', () => {
    const fireball = {
      id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5,
      stat: 'MAG', target: 'GROUND',
      range: { min: 2, max: 4 },
      aoe: { shape: 'circle', radius: 1 },
      description: 'AOE.',
    };
    expect(CardSchema.parse(fireball)).toEqual(fireball);
  });
});

describe('UnitSchema', () => {
  it('accepts a valid unit', () => {
    const roy = {
      id: 'roy', name: 'Roy', class: 'LORD', level: 1,
      stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
      deck: ['iron_strike', 'iron_strike', 'iron_strike'],
    };
    expect(UnitSchema.parse(roy)).toEqual(roy);
  });
});

describe('EnemySchema', () => {
  it('accepts a valid enemy', () => {
    const bandit = {
      id: 'bandit', name: 'Bandit', level: 1,
      stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
      attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' },
      ai: 'closest_target',
    };
    expect(EnemySchema.parse(bandit)).toEqual(bandit);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd phaser && npm test -- schemas
```

Expected: FAIL — schemas don't exist.

- [ ] **Step 3: Implement schemas**

Create `phaser/src/data/schemas/card.ts`:

```ts
import { z } from 'zod';

export const StatSchema = z.enum(['STR', 'MAG', 'SKL', 'SPD', 'LCK', 'DEF', 'RES']);
export const TargetSchema = z.enum(['SELF', 'ALLY', 'ENEMY', 'GROUND', 'ALL_ENEMIES', 'ALL_ALLIES']);
export const AoeShapeSchema = z.enum(['single', 'circle', 'cross', 'line']);

export const RangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const AoeSchema = z.object({
  shape: AoeShapeSchema,
  radius: z.number().int().nonnegative(),
});

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().int().nonnegative(),
  damage_base: z.number().int(),
  stat: StatSchema,
  target: TargetSchema,
  range: RangeSchema,
  aoe: AoeSchema,
  description: z.string(),
});

export type Card = z.infer<typeof CardSchema>;
export type Stat = z.infer<typeof StatSchema>;
export type Target = z.infer<typeof TargetSchema>;
```

Create `phaser/src/data/schemas/unit.ts`:

```ts
import { z } from 'zod';

export const StatBlockSchema = z.object({
  hp: z.number().int().positive(),
  str: z.number().int().nonnegative(),
  mag: z.number().int().nonnegative(),
  skl: z.number().int().nonnegative(),
  spd: z.number().int().nonnegative(),
  lck: z.number().int().nonnegative(),
  def: z.number().int().nonnegative(),
  res: z.number().int().nonnegative(),
  mov: z.number().int().positive(),
});

export const ClassSchema = z.enum(['LORD', 'KNIGHT', 'MAGE', 'CLERIC', 'ARCHER', 'BOUNTY_HUNTER']);

export const UnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: ClassSchema,
  level: z.number().int().positive(),
  stats: StatBlockSchema,
  deck: z.array(z.string()).min(1),
});

export type StatBlock = z.infer<typeof StatBlockSchema>;
export type UnitClass = z.infer<typeof ClassSchema>;
export type Unit = z.infer<typeof UnitSchema>;
```

Create `phaser/src/data/schemas/enemy.ts`:

```ts
import { z } from 'zod';
import { StatBlockSchema } from './unit';
import { RangeSchema } from './card';

export const AiBehaviorSchema = z.enum(['closest_target', 'support', 'flee_low_hp']);

export const EnemySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().positive(),
  stats: StatBlockSchema,
  attack: z.object({
    damage: z.number().int().nonnegative(),
    range: RangeSchema,
    type: z.enum(['physical', 'magical']),
  }),
  ai: AiBehaviorSchema,
});

export type Enemy = z.infer<typeof EnemySchema>;
export type AiBehavior = z.infer<typeof AiBehaviorSchema>;
```

Create `phaser/src/data/schemas/index.ts`:

```ts
export * from './card';
export * from './unit';
export * from './enemy';
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- schemas
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add phaser/src/data/schemas/ phaser/tests/unit/schemas.test.ts
git commit -m "feat(phaser): zod schemas for card, unit, enemy"
```

---

### Task 8: Sandbox JSON data + load.ts with validation

**Files:**
- Create: `phaser/src/data/cards.json`
- Create: `phaser/src/data/units.json`
- Create: `phaser/src/data/enemies.json`
- Create: `phaser/src/data/load.ts`
- Create: `phaser/tests/unit/load.test.ts`

- [ ] **Step 1: Write 5 sandbox cards**

Create `phaser/src/data/cards.json`:

```json
{
  "cards": [
    {
      "id": "iron_strike",
      "name": "Iron Strike",
      "cost": 1,
      "damage_base": 4,
      "stat": "STR",
      "target": "ENEMY",
      "range": { "min": 1, "max": 1 },
      "aoe": { "shape": "single", "radius": 0 },
      "description": "Melee strike. STR scaling."
    },
    {
      "id": "shield_bash",
      "name": "Shield Bash",
      "cost": 2,
      "damage_base": 3,
      "stat": "STR",
      "target": "ENEMY",
      "range": { "min": 1, "max": 1 },
      "aoe": { "shape": "single", "radius": 0 },
      "description": "STR attack, immobilizes target 1 turn."
    },
    {
      "id": "fireball",
      "name": "Fireball",
      "cost": 2,
      "damage_base": 5,
      "stat": "MAG",
      "target": "GROUND",
      "range": { "min": 2, "max": 4 },
      "aoe": { "shape": "circle", "radius": 1 },
      "description": "AOE blast, MAG scaling."
    },
    {
      "id": "heal",
      "name": "Heal",
      "cost": 1,
      "damage_base": -6,
      "stat": "MAG",
      "target": "ALLY",
      "range": { "min": 1, "max": 2 },
      "aoe": { "shape": "single", "radius": 0 },
      "description": "Restore 6 + MAG HP."
    },
    {
      "id": "guard",
      "name": "Guard",
      "cost": 1,
      "damage_base": 0,
      "stat": "DEF",
      "target": "SELF",
      "range": { "min": 0, "max": 0 },
      "aoe": { "shape": "single", "radius": 0 },
      "description": "Halve incoming damage until next turn."
    }
  ]
}
```

- [ ] **Step 2: Write 3 placeholder units**

Create `phaser/src/data/units.json`:

```json
{
  "units": [
    {
      "id": "roy",
      "name": "Roy",
      "class": "LORD",
      "level": 1,
      "stats": { "hp": 22, "str": 6, "mag": 0, "skl": 6, "spd": 7, "lck": 7, "def": 5, "res": 2, "mov": 5 },
      "deck": ["iron_strike", "iron_strike", "iron_strike", "iron_strike", "shield_bash", "shield_bash", "shield_bash", "guard", "guard", "guard", "heal", "heal"]
    },
    {
      "id": "marcus",
      "name": "Marcus",
      "class": "KNIGHT",
      "level": 1,
      "stats": { "hp": 28, "str": 8, "mag": 0, "skl": 5, "spd": 3, "lck": 5, "def": 10, "res": 2, "mov": 4 },
      "deck": ["iron_strike", "iron_strike", "iron_strike", "iron_strike", "iron_strike", "iron_strike", "shield_bash", "shield_bash", "shield_bash", "shield_bash", "guard", "guard"]
    },
    {
      "id": "lilina",
      "name": "Lilina",
      "class": "MAGE",
      "level": 1,
      "stats": { "hp": 16, "str": 2, "mag": 8, "skl": 5, "spd": 4, "lck": 6, "def": 2, "res": 6, "mov": 4 },
      "deck": ["fireball", "fireball", "fireball", "fireball", "fireball", "fireball", "heal", "heal", "heal", "heal", "guard", "guard"]
    }
  ]
}
```

- [ ] **Step 3: Write 3 sandbox enemies**

Create `phaser/src/data/enemies.json`:

```json
{
  "enemies": [
    {
      "id": "bandit",
      "name": "Bandit",
      "level": 1,
      "stats": { "hp": 18, "str": 5, "mag": 0, "skl": 4, "spd": 4, "lck": 2, "def": 3, "res": 1, "mov": 4 },
      "attack": { "damage": 5, "range": { "min": 1, "max": 1 }, "type": "physical" },
      "ai": "closest_target"
    },
    {
      "id": "mage_bandit",
      "name": "Mage Bandit",
      "level": 1,
      "stats": { "hp": 14, "str": 2, "mag": 6, "skl": 4, "spd": 5, "lck": 2, "def": 1, "res": 4, "mov": 4 },
      "attack": { "damage": 6, "range": { "min": 2, "max": 3 }, "type": "magical" },
      "ai": "closest_target"
    },
    {
      "id": "bandit_captain",
      "name": "Bandit Captain",
      "level": 2,
      "stats": { "hp": 26, "str": 7, "mag": 0, "skl": 5, "spd": 4, "lck": 3, "def": 5, "res": 2, "mov": 4 },
      "attack": { "damage": 7, "range": { "min": 1, "max": 1 }, "type": "physical" },
      "ai": "closest_target"
    }
  ]
}
```

- [ ] **Step 4: Write failing test for load.ts**

Create `phaser/tests/unit/load.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadGameData } from '../../src/data/load';

describe('loadGameData', () => {
  it('loads and validates all data files', () => {
    const data = loadGameData();
    expect(data.cards).toHaveLength(5);
    expect(data.units).toHaveLength(3);
    expect(data.enemies).toHaveLength(3);
    expect(data.cards.find(c => c.id === 'iron_strike')).toBeDefined();
    expect(data.units.find(u => u.id === 'roy')?.deck).toHaveLength(12);
  });

  it('exposes lookup maps', () => {
    const data = loadGameData();
    expect(data.cardById('iron_strike')?.name).toBe('Iron Strike');
    expect(data.unitById('roy')?.class).toBe('LORD');
    expect(data.enemyById('bandit')?.stats.hp).toBe(18);
  });

  it('returns undefined for unknown ids', () => {
    const data = loadGameData();
    expect(data.cardById('xxx')).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run test, verify failure**

```bash
npm test -- load
```

Expected: FAIL — `loadGameData` not defined.

- [ ] **Step 6: Implement load.ts**

Create `phaser/src/data/load.ts`:

```ts
import { z } from 'zod';
import { CardSchema, UnitSchema, EnemySchema, type Card, type Unit, type Enemy } from './schemas';
import cardsJson from './cards.json';
import unitsJson from './units.json';
import enemiesJson from './enemies.json';

const CardsFileSchema = z.object({ cards: z.array(CardSchema) });
const UnitsFileSchema = z.object({ units: z.array(UnitSchema) });
const EnemiesFileSchema = z.object({ enemies: z.array(EnemySchema) });

export interface GameData {
  cards: readonly Card[];
  units: readonly Unit[];
  enemies: readonly Enemy[];
  cardById(id: string): Card | undefined;
  unitById(id: string): Unit | undefined;
  enemyById(id: string): Enemy | undefined;
}

export function loadGameData(): GameData {
  const cards = CardsFileSchema.parse(cardsJson).cards;
  const units = UnitsFileSchema.parse(unitsJson).units;
  const enemies = EnemiesFileSchema.parse(enemiesJson).enemies;

  const cardMap = new Map(cards.map(c => [c.id, c]));
  const unitMap = new Map(units.map(u => [u.id, u]));
  const enemyMap = new Map(enemies.map(e => [e.id, e]));

  // Validate every unit's deck references real cards
  for (const unit of units) {
    for (const cardId of unit.deck) {
      if (!cardMap.has(cardId)) {
        throw new Error(`Unit ${unit.id} references unknown card: ${cardId}`);
      }
    }
  }

  return {
    cards,
    units,
    enemies,
    cardById: id => cardMap.get(id),
    unitById: id => unitMap.get(id),
    enemyById: id => enemyMap.get(id),
  };
}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: All passing (3 new + 5 from Task 7).

- [ ] **Step 8: Commit**

```bash
git add phaser/src/data/ phaser/tests/unit/load.test.ts
git commit -m "feat(phaser): sandbox card/unit/enemy data + validated loader"
```

---

### Task 9: CombatScene + 14×10 grid renderer

**Files:**
- Create: `phaser/src/game/scenes/CombatScene.ts`
- Modify: `phaser/src/game/createGame.ts`
- Create: `phaser/src/game/render/gridRenderer.ts`
- Modify: `phaser/src/game/scenes/BootScene.ts`
- Create: `phaser/tests/e2e/combat-grid.spec.ts`

- [ ] **Step 1: Constants for grid**

Create `phaser/src/game/render/gridRenderer.ts`:

```ts
import Phaser from 'phaser';

export const GRID_WIDTH = 14;
export const GRID_HEIGHT = 10;
export const TILE_SIZE = 48;
export const GRID_OFFSET_X = (1280 - GRID_WIDTH * TILE_SIZE) / 2;
export const GRID_OFFSET_Y = 80;

export interface GridCoord {
  readonly x: number;
  readonly y: number;
}

export function tileToWorld(coord: GridCoord): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + coord.x * TILE_SIZE + TILE_SIZE / 2,
    y: GRID_OFFSET_Y + coord.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function worldToTile(world: { x: number; y: number }): GridCoord | null {
  const gx = Math.floor((world.x - GRID_OFFSET_X) / TILE_SIZE);
  const gy = Math.floor((world.y - GRID_OFFSET_Y) / TILE_SIZE);
  if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) return null;
  return { x: gx, y: gy };
}

export function drawGrid(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, 0x44342a, 0.8);
  for (let x = 0; x <= GRID_WIDTH; x++) {
    const px = GRID_OFFSET_X + x * TILE_SIZE;
    g.lineBetween(px, GRID_OFFSET_Y, px, GRID_OFFSET_Y + GRID_HEIGHT * TILE_SIZE);
  }
  for (let y = 0; y <= GRID_HEIGHT; y++) {
    const py = GRID_OFFSET_Y + y * TILE_SIZE;
    g.lineBetween(GRID_OFFSET_X, py, GRID_OFFSET_X + GRID_WIDTH * TILE_SIZE, py);
  }
  return g;
}
```

- [ ] **Step 2: Create CombatScene**

Create `phaser/src/game/scenes/CombatScene.ts`:

```ts
import Phaser from 'phaser';
import { drawGrid } from '../render/gridRenderer';

export class CombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', {
      color: '#e8d8c0',
      fontSize: '20px',
    }).setOrigin(0.5);
  }
}
```

- [ ] **Step 3: Boot transitions to combat**

Replace `phaser/src/game/scenes/BootScene.ts`:

```ts
import Phaser from 'phaser';
import { loadGameData } from '../../data/load';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    try {
      const data = loadGameData();
      this.registry.set('gameData', data);
      this.scene.start('CombatScene');
    } catch (err) {
      this.add.text(40, 40, `BOOT FAILED:\n${(err as Error).message}`, {
        color: '#ff6b6b', fontSize: '14px', wordWrap: { width: 1200 },
      });
    }
  }
}
```

- [ ] **Step 4: Register CombatScene in createGame**

Modify `phaser/src/game/createGame.ts`:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#1a1410',
    scene: [BootScene, CombatScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
```

- [ ] **Step 5: E2E for grid render**

Create `phaser/tests/e2e/combat-grid.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('combat scene renders 14x10 grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('combat-grid.png', {
    maxDiffPixels: 200,
  });
});
```

- [ ] **Step 6: Generate baseline + run**

```bash
npm run test:e2e:update
npm run test:e2e
```

Expected: 2 passed (boot + combat-grid).

- [ ] **Step 7: Commit**

```bash
git add phaser/src/game/ phaser/tests/e2e/combat-grid.spec.ts phaser/tests/e2e/combat-grid.spec.ts-snapshots/
git commit -m "feat(phaser): CombatScene with 14x10 grid, BootScene loads data and transitions"
```

---

### Task 10: Combat store (Zustand) with phase machine

**Files:**
- Create: `phaser/src/state/combatStore.ts`
- Create: `phaser/tests/unit/combatStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `phaser/tests/unit/combatStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatStore } from '../../src/state/combatStore';

describe('combatStore', () => {
  beforeEach(() => {
    useCombatStore.getState().reset();
  });

  it('starts in BOOT phase', () => {
    expect(useCombatStore.getState().phase).toBe('BOOT');
  });

  it('transitions BOOT -> DEPLOY -> COMBAT', () => {
    const s = useCombatStore.getState();
    s.setPhase('DEPLOY');
    expect(useCombatStore.getState().phase).toBe('DEPLOY');
    s.setPhase('COMBAT');
    expect(useCombatStore.getState().phase).toBe('COMBAT');
  });

  it('manages card targeting sub-state', () => {
    const s = useCombatStore.getState();
    s.setPhase('COMBAT');
    expect(useCombatStore.getState().subPhase).toBe('IDLE');
    s.selectCard('iron_strike');
    expect(useCombatStore.getState().subPhase).toBe('SELECTING_TARGET');
    expect(useCombatStore.getState().selectedCardId).toBe('iron_strike');
    s.cancelSelection();
    expect(useCombatStore.getState().subPhase).toBe('IDLE');
    expect(useCombatStore.getState().selectedCardId).toBeNull();
  });

  it('tracks current AP', () => {
    const s = useCombatStore.getState();
    s.setAP(3);
    expect(useCombatStore.getState().ap).toBe(3);
    s.spendAP(2);
    expect(useCombatStore.getState().ap).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- combatStore
```

Expected: FAIL — store doesn't exist.

- [ ] **Step 3: Implement store**

Create `phaser/src/state/combatStore.ts`:

```ts
import { create } from 'zustand';

export type CombatPhase = 'BOOT' | 'DEPLOY' | 'COMBAT' | 'VICTORY' | 'DEFEAT';
export type SubPhase = 'IDLE' | 'SELECTING_CARD' | 'SELECTING_TARGET' | 'RESOLVING';

export interface GridCoord {
  readonly x: number;
  readonly y: number;
}

interface CombatState {
  phase: CombatPhase;
  subPhase: SubPhase;
  selectedCardId: string | null;
  hoveredTile: GridCoord | null;
  ap: number;
  setPhase: (p: CombatPhase) => void;
  setSubPhase: (p: SubPhase) => void;
  selectCard: (cardId: string) => void;
  cancelSelection: () => void;
  setHoveredTile: (tile: GridCoord | null) => void;
  setAP: (n: number) => void;
  spendAP: (n: number) => void;
  reset: () => void;
}

const initial = {
  phase: 'BOOT' as CombatPhase,
  subPhase: 'IDLE' as SubPhase,
  selectedCardId: null,
  hoveredTile: null,
  ap: 0,
};

export const useCombatStore = create<CombatState>((set) => ({
  ...initial,
  setPhase: (phase) => set({ phase }),
  setSubPhase: (subPhase) => set({ subPhase }),
  selectCard: (cardId) => set({ selectedCardId: cardId, subPhase: 'SELECTING_TARGET' }),
  cancelSelection: () => set({ selectedCardId: null, subPhase: 'IDLE', hoveredTile: null }),
  setHoveredTile: (hoveredTile) => set({ hoveredTile }),
  setAP: (ap) => set({ ap }),
  spendAP: (n) => set((s) => ({ ap: Math.max(0, s.ap - n) })),
  reset: () => set(initial),
}));
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All passing.

- [ ] **Step 5: Commit**

```bash
git add phaser/src/state/combatStore.ts phaser/tests/unit/combatStore.test.ts
git commit -m "feat(phaser): zustand combat store with phase + targeting state machine"
```

---

### Task 11: Card hand renderer (fan layout)

**Files:**
- Create: `phaser/src/game/render/cardHandRenderer.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Card hand renderer**

Create `phaser/src/game/render/cardHandRenderer.ts`:

```ts
import Phaser from 'phaser';
import type { Card } from '../../data/schemas';

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 140;
const HAND_Y = 720 - CARD_HEIGHT / 2 - 20;
const HAND_CENTER_X = 640;
const FAN_SPREAD = 100;
const FAN_ANGLE = 0.06;

export interface CardSprite {
  container: Phaser.GameObjects.Container;
  card: Card;
  baseX: number;
  baseY: number;
  baseAngle: number;
}

export function renderHand(scene: Phaser.Scene, cards: Card[]): CardSprite[] {
  const sprites: CardSprite[] = [];
  const count = cards.length;
  const totalWidth = (count - 1) * FAN_SPREAD;
  const startX = HAND_CENTER_X - totalWidth / 2;

  cards.forEach((card, i) => {
    const baseX = startX + i * FAN_SPREAD;
    const baseY = HAND_Y;
    const baseAngle = (i - (count - 1) / 2) * FAN_ANGLE;
    sprites.push({ container: createCardContainer(scene, card, baseX, baseY, baseAngle), card, baseX, baseY, baseAngle });
  });

  return sprites;
}

function createCardContainer(
  scene: Phaser.Scene,
  card: Card,
  x: number,
  y: number,
  angle: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  container.setRotation(angle);
  container.setSize(CARD_WIDTH, CARD_HEIGHT);

  const bg = scene.add.graphics();
  drawCardBackground(bg, false);
  container.add(bg);
  container.setData('bg', bg);

  const name = scene.add.text(0, -CARD_HEIGHT / 2 + 14, card.name, {
    color: '#e8d8c0',
    fontSize: '12px',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);
  container.add(name);

  const cost = scene.add.text(-CARD_WIDTH / 2 + 12, -CARD_HEIGHT / 2 + 12, String(card.cost), {
    color: '#ffb366',
    fontSize: '14px',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(cost);

  const dmg = card.damage_base >= 0 ? `${card.damage_base}+${card.stat}` : `+${-card.damage_base}HP`;
  const dmgText = scene.add.text(0, 0, dmg, {
    color: '#e8d8c0',
    fontSize: '14px',
  }).setOrigin(0.5);
  container.add(dmgText);

  const desc = scene.add.text(0, CARD_HEIGHT / 2 - 24, card.description, {
    color: '#a89878',
    fontSize: '9px',
    wordWrap: { width: CARD_WIDTH - 12 },
    align: 'center',
  }).setOrigin(0.5, 0);
  container.add(desc);

  container.setInteractive(
    new Phaser.Geom.Rectangle(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );

  return container;
}

function drawCardBackground(g: Phaser.GameObjects.Graphics, hovered: boolean): void {
  g.clear();
  g.fillStyle(hovered ? 0x3a2a20 : 0x2a1c14, 1);
  g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 6);
  g.lineStyle(2, hovered ? 0xffb366 : 0x6a4a30, 1);
  g.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 6);
}

export function setCardHovered(sprite: CardSprite, hovered: boolean): void {
  const bg = sprite.container.getData('bg') as Phaser.GameObjects.Graphics;
  drawCardBackground(bg, hovered);
}
```

- [ ] **Step 2: Render hand in CombatScene**

Replace `phaser/src/game/scenes/CombatScene.ts`:

```ts
import Phaser from 'phaser';
import { drawGrid } from '../render/gridRenderer';
import { renderHand, type CardSprite } from '../render/cardHandRenderer';
import type { GameData } from '../../data/load';

export class CombatScene extends Phaser.Scene {
  private hand: CardSprite[] = [];

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', {
      color: '#e8d8c0', fontSize: '20px',
    }).setOrigin(0.5);

    const data = this.registry.get('gameData') as GameData;
    const royDeck = data.unitById('roy')!.deck;
    const handCards = royDeck.slice(0, 5).map(id => data.cardById(id)!);
    this.hand = renderHand(this, handCards);
  }
}
```

- [ ] **Step 3: Update visual baseline**

```bash
npm run test:e2e:update
npm run test:e2e
```

Expected: 2 passed; new combat-grid.png shows 5-card fan at bottom.

- [ ] **Step 4: Commit**

```bash
git add phaser/src/game/ phaser/tests/e2e/combat-grid.spec.ts-snapshots/
git commit -m "feat(phaser): card hand fan layout in CombatScene"
```

---

### Task 12: Hover and click states on cards

**Files:**
- Modify: `phaser/src/game/render/cardHandRenderer.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Add hover/click handlers + tween-on-hover**

Append to `phaser/src/game/render/cardHandRenderer.ts`:

```ts
const HOVER_LIFT = 30;

export function attachCardInput(
  scene: Phaser.Scene,
  sprite: CardSprite,
  onClick: (card: Card) => void,
): void {
  const { container, baseX, baseY, baseAngle } = sprite;

  container.on('pointerover', () => {
    setCardHovered(sprite, true);
    scene.tweens.add({
      targets: container,
      y: baseY - HOVER_LIFT,
      rotation: 0,
      scale: 1.1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    container.setDepth(100);
  });

  container.on('pointerout', () => {
    setCardHovered(sprite, false);
    scene.tweens.add({
      targets: container,
      y: baseY,
      rotation: baseAngle,
      scale: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    container.setDepth(0);
  });

  container.on('pointerdown', () => onClick(sprite.card));
}
```

(Make sure `import type { Card } from '../../data/schemas';` is at the top.)

- [ ] **Step 2: Wire input in CombatScene**

Modify `CombatScene.create()`:

```ts
import { useCombatStore } from '../../state/combatStore';
import { renderHand, attachCardInput, type CardSprite } from '../render/cardHandRenderer';

// inside create():
this.hand = renderHand(this, handCards);
this.hand.forEach(sprite => {
  attachCardInput(this, sprite, (card) => {
    useCombatStore.getState().selectCard(card.id);
  });
});

useCombatStore.getState().setPhase('COMBAT');
```

- [ ] **Step 3: Visual baseline**

```bash
npm run test:e2e:update
npm run test:e2e
```

- [ ] **Step 4: Commit**

```bash
git add phaser/src/game/ phaser/tests/e2e/
git commit -m "feat(phaser): card hover lift + click selects card in store"
```

---

### Task 13: Valid-tile highlight + AOE preview on hover

**Files:**
- Create: `phaser/src/game/systems/targeting.ts`
- Create: `phaser/src/game/render/targetingRenderer.ts`
- Create: `phaser/tests/unit/targeting.test.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Failing test for targeting**

Create `phaser/tests/unit/targeting.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validTilesForCard, aoeTilesAt } from '../../src/game/systems/targeting';
import type { Card } from '../../src/data/schemas';

const ironStrike: Card = {
  id: 'iron_strike', name: 'Iron Strike', cost: 1, damage_base: 4,
  stat: 'STR', target: 'ENEMY', range: { min: 1, max: 1 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const fireball: Card = {
  id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5,
  stat: 'MAG', target: 'GROUND', range: { min: 2, max: 4 },
  aoe: { shape: 'circle', radius: 1 }, description: '',
};

describe('validTilesForCard', () => {
  it('returns adjacent tiles for melee card', () => {
    const tiles = validTilesForCard(ironStrike, { x: 5, y: 5 });
    expect(tiles).toHaveLength(4); // N, S, E, W
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 5, y: 6 });
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 6, y: 5 });
  });

  it('returns ring of tiles for ranged card', () => {
    const tiles = validTilesForCard(fireball, { x: 5, y: 5 });
    // Manhattan distance 2-4, all in-bounds
    expect(tiles.length).toBeGreaterThan(20);
  });

  it('clips to grid bounds', () => {
    const tiles = validTilesForCard(ironStrike, { x: 0, y: 0 });
    expect(tiles).toHaveLength(2); // E, S only
  });
});

describe('aoeTilesAt', () => {
  it('single AOE returns just the target', () => {
    const tiles = aoeTilesAt(ironStrike, { x: 5, y: 5 });
    expect(tiles).toEqual([{ x: 5, y: 5 }]);
  });

  it('circle radius 1 returns center + 4 neighbors', () => {
    const tiles = aoeTilesAt(fireball, { x: 5, y: 5 });
    expect(tiles).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- targeting
```

Expected: FAIL.

- [ ] **Step 3: Implement targeting**

Create `phaser/src/game/systems/targeting.ts`:

```ts
import type { Card } from '../../data/schemas';
import { GRID_WIDTH, GRID_HEIGHT, type GridCoord } from '../render/gridRenderer';

function inBounds(c: GridCoord): boolean {
  return c.x >= 0 && c.x < GRID_WIDTH && c.y >= 0 && c.y < GRID_HEIGHT;
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function validTilesForCard(card: Card, source: GridCoord): GridCoord[] {
  const out: GridCoord[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tile = { x, y };
      const d = manhattan(source, tile);
      if (d >= card.range.min && d <= card.range.max && d > 0) {
        out.push(tile);
      }
    }
  }
  return out;
}

export function aoeTilesAt(card: Card, target: GridCoord): GridCoord[] {
  if (card.aoe.shape === 'single' || card.aoe.radius === 0) {
    return [target];
  }
  if (card.aoe.shape === 'circle') {
    const out: GridCoord[] = [];
    for (let dy = -card.aoe.radius; dy <= card.aoe.radius; dy++) {
      for (let dx = -card.aoe.radius; dx <= card.aoe.radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= card.aoe.radius) {
          const tile = { x: target.x + dx, y: target.y + dy };
          if (inBounds(tile)) out.push(tile);
        }
      }
    }
    return out;
  }
  // cross, line: stub for sandbox
  return [target];
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- targeting
```

Expected: 5 passed.

- [ ] **Step 5: Render valid-tile highlight + AOE**

Create `phaser/src/game/render/targetingRenderer.ts`:

```ts
import Phaser from 'phaser';
import { tileToWorld, TILE_SIZE, type GridCoord } from './gridRenderer';

export class TargetingOverlay {
  private validG: Phaser.GameObjects.Graphics;
  private aoeG: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.validG = scene.add.graphics();
    this.aoeG = scene.add.graphics();
  }

  showValidTiles(tiles: GridCoord[]): void {
    this.validG.clear();
    this.validG.fillStyle(0xffb366, 0.15);
    this.validG.lineStyle(1, 0xffb366, 0.5);
    for (const t of tiles) {
      const { x, y } = tileToWorld(t);
      this.validG.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      this.validG.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }
  }

  showAoe(tiles: GridCoord[]): void {
    this.aoeG.clear();
    this.aoeG.fillStyle(0x9b6bff, 0.3);
    this.aoeG.lineStyle(2, 0x9b6bff, 0.8);
    for (const t of tiles) {
      const { x, y } = tileToWorld(t);
      this.aoeG.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      this.aoeG.strokeRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    }
  }

  clear(): void {
    this.validG.clear();
    this.aoeG.clear();
  }
}
```

- [ ] **Step 6: Wire into CombatScene**

Modify `phaser/src/game/scenes/CombatScene.ts`:

```ts
import Phaser from 'phaser';
import { drawGrid, worldToTile, tileToWorld } from '../render/gridRenderer';
import { renderHand, attachCardInput, type CardSprite } from '../render/cardHandRenderer';
import { TargetingOverlay } from '../render/targetingRenderer';
import { validTilesForCard, aoeTilesAt } from '../systems/targeting';
import { useCombatStore } from '../../state/combatStore';
import type { GameData } from '../../data/load';

const ROY_TILE = { x: 3, y: 5 };

export class CombatScene extends Phaser.Scene {
  private hand: CardSprite[] = [];
  private overlay!: TargetingOverlay;
  private data!: GameData;
  private royMarker!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'CombatScene' });
  }

  create(): void {
    drawGrid(this);
    this.add.text(640, 40, 'Combat Sandbox', { color: '#e8d8c0', fontSize: '20px' }).setOrigin(0.5);

    this.data = this.registry.get('gameData') as GameData;
    this.overlay = new TargetingOverlay(this);

    // Placeholder marker for Roy
    const royPos = tileToWorld(ROY_TILE);
    this.royMarker = this.add.graphics();
    this.royMarker.fillStyle(0x4488ff, 1);
    this.royMarker.fillCircle(royPos.x, royPos.y, 16);

    const royDeck = this.data.unitById('roy')!.deck;
    const handCards = royDeck.slice(0, 5).map(id => this.data.cardById(id)!);
    this.hand = renderHand(this, handCards);
    this.hand.forEach(sprite => {
      attachCardInput(this, sprite, (card) => {
        useCombatStore.getState().selectCard(card.id);
        const valid = validTilesForCard(card, ROY_TILE);
        this.overlay.showValidTiles(valid);
      });
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const { selectedCardId } = useCombatStore.getState();
      if (!selectedCardId) return;
      const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
      if (!tile) { this.overlay.showAoe([]); return; }
      const card = this.data.cardById(selectedCardId)!;
      const valid = validTilesForCard(card, ROY_TILE);
      const onValid = valid.some(t => t.x === tile.x && t.y === tile.y);
      this.overlay.showAoe(onValid ? aoeTilesAt(card, tile) : []);
    });

    useCombatStore.getState().setPhase('COMBAT');
  }
}
```

- [ ] **Step 7: Update baseline**

```bash
npm run test:e2e:update
npm run test:e2e
```

- [ ] **Step 8: Commit**

```bash
git add phaser/src/game/ phaser/tests/
git commit -m "feat(phaser): targeting overlay - valid tiles + AOE preview on hover"
```

---

### Task 14: Cancel flow + visual snapshots for full hand UX

**Files:**
- Modify: `phaser/src/game/scenes/CombatScene.ts`
- Create: `phaser/tests/e2e/card-hand-flow.spec.ts`

- [ ] **Step 1: Add cancel handlers**

In `CombatScene.create()`, append:

```ts
this.input.keyboard?.on('keydown-ESC', () => {
  useCombatStore.getState().cancelSelection();
  this.overlay.clear();
});

this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
  if (pointer.rightButtonDown()) {
    useCombatStore.getState().cancelSelection();
    this.overlay.clear();
  }
});
```

- [ ] **Step 2: E2E test for hand flow**

Create `phaser/tests/e2e/card-hand-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('hover, select, target preview, cancel', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Click first card (Iron Strike)
  await page.mouse.click(540, 670);
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-card-selected.png', { maxDiffPixels: 400 });

  // Hover a valid tile near Roy
  await page.mouse.move(240, 320);
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-aoe-preview.png', { maxDiffPixels: 400 });

  // Cancel via ESC
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot('hand-after-cancel.png', { maxDiffPixels: 400 });
});
```

- [ ] **Step 3: Generate baselines**

```bash
npm run test:e2e:update
npm run test:e2e
```

Expected: 3 E2E tests passing.

- [ ] **Step 4: Commit + tag end of Phase 2**

```bash
git add phaser/src/ phaser/tests/
git commit -m "feat(phaser): cancel flow (ESC, right-click) + full hand UX snapshots"
git tag phaser-phase2-card-hand
```

---

## Phase 3 — Combat Math + Resolution (Day 6-8, Tasks 15-21)

Pure logic systems first (TDD), then wire them into the scene.

### Task 15: Unit/Enemy runtime entities

**Files:**
- Create: `phaser/src/game/entities/Unit.ts`
- Create: `phaser/src/game/entities/Enemy.ts`
- Create: `phaser/tests/unit/entities.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/entities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createUnit, applyDamage, isDead } from '../../src/game/entities/Unit';
import type { Unit } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['iron_strike'],
};

describe('Unit entity', () => {
  it('starts with full HP', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    expect(u.currentHp).toBe(22);
    expect(isDead(u)).toBe(false);
  });

  it('takes damage', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 10);
    expect(u.currentHp).toBe(12);
  });

  it('cannot drop below 0', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 100);
    expect(u.currentHp).toBe(0);
    expect(isDead(u)).toBe(true);
  });

  it('heal does not exceed max', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    applyDamage(u, 5);
    applyDamage(u, -10); // negative damage = heal
    expect(u.currentHp).toBe(22);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- entities
```

- [ ] **Step 3: Implement Unit**

Create `phaser/src/game/entities/Unit.ts`:

```ts
import type { Unit as UnitData, StatBlock } from '../../data/schemas';
import type { GridCoord } from '../render/gridRenderer';

export interface UnitInstance {
  data: UnitData;
  pos: GridCoord;
  currentHp: number;
  hand: string[]; // card IDs
  draw: string[];
  discard: string[];
  alive: boolean;
}

export function createUnit(data: UnitData, pos: GridCoord): UnitInstance {
  return {
    data,
    pos: { ...pos },
    currentHp: data.stats.hp,
    hand: [],
    draw: [...data.deck],
    discard: [],
    alive: true,
  };
}

export function applyDamage(u: UnitInstance, amount: number): void {
  u.currentHp = Math.max(0, Math.min(u.data.stats.hp, u.currentHp - amount));
  if (u.currentHp === 0) u.alive = false;
}

export function isDead(u: UnitInstance): boolean {
  return !u.alive;
}

export function statValue(u: UnitInstance, stat: keyof StatBlock): number {
  return u.data.stats[stat];
}
```

- [ ] **Step 4: Implement Enemy (mirror structure)**

Create `phaser/src/game/entities/Enemy.ts`:

```ts
import type { Enemy as EnemyData } from '../../data/schemas';
import type { GridCoord } from '../render/gridRenderer';

export interface EnemyInstance {
  data: EnemyData;
  pos: GridCoord;
  currentHp: number;
  alive: boolean;
}

export function createEnemy(data: EnemyData, pos: GridCoord): EnemyInstance {
  return {
    data,
    pos: { ...pos },
    currentHp: data.stats.hp,
    alive: true,
  };
}

export function applyDamageEnemy(e: EnemyInstance, amount: number): void {
  e.currentHp = Math.max(0, Math.min(e.data.stats.hp, e.currentHp - amount));
  if (e.currentHp === 0) e.alive = false;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add phaser/src/game/entities/ phaser/tests/unit/entities.test.ts
git commit -m "feat(phaser): Unit and Enemy runtime entities"
```

---

### Task 16: combatResolver (TDD damage formula)

**Files:**
- Create: `phaser/src/game/systems/combatResolver.ts`
- Create: `phaser/tests/unit/combatResolver.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/combatResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveCard } from '../../src/game/systems/combatResolver';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Card, Unit, Enemy } from '../../src/data/schemas';

const ironStrike: Card = {
  id: 'iron_strike', name: 'Iron Strike', cost: 1, damage_base: 4,
  stat: 'STR', target: 'ENEMY', range: { min: 1, max: 1 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const heal: Card = {
  id: 'heal', name: 'Heal', cost: 1, damage_base: -6, stat: 'MAG',
  target: 'ALLY', range: { min: 1, max: 2 },
  aoe: { shape: 'single', radius: 0 }, description: '',
};

const fireball: Card = {
  id: 'fireball', name: 'Fireball', cost: 2, damage_base: 5, stat: 'MAG',
  target: 'GROUND', range: { min: 2, max: 4 },
  aoe: { shape: 'circle', radius: 1 }, description: '',
};

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['iron_strike'],
};

const lilinaData: Unit = {
  id: 'lilina', name: 'Lilina', class: 'MAGE', level: 1,
  stats: { hp: 16, str: 2, mag: 8, skl: 5, spd: 4, lck: 6, def: 2, res: 6, mov: 4 },
  deck: ['fireball'],
};

const banditData: Enemy = {
  id: 'bandit', name: 'Bandit', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' },
  ai: 'closest_target',
};

describe('resolveCard', () => {
  it('applies physical damage with DR', () => {
    // Iron Strike: 4 + 6 (STR) - floor(3/2) = 9
    const roy = createUnit(royData, { x: 0, y: 0 });
    const bandit = createEnemy(banditData, { x: 1, y: 0 });
    const result = resolveCard(ironStrike, roy, [bandit]);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]?.damage).toBe(9);
    expect(bandit.currentHp).toBe(9);
  });

  it('applies magic damage to RES', () => {
    // Fireball: 5 + 8 (MAG) - floor(1/2) = 13
    const lilina = createUnit(lilinaData, { x: 0, y: 0 });
    const bandit = createEnemy(banditData, { x: 3, y: 0 });
    const result = resolveCard(fireball, lilina, [bandit]);
    expect(result.targets[0]?.damage).toBe(13);
  });

  it('heal applies as negative damage to ally', () => {
    const roy = createUnit(royData, { x: 0, y: 0 });
    roy.currentHp = 10;
    const result = resolveCard(heal, roy, [roy]);
    expect(result.targets[0]?.damage).toBe(-6);
    expect(roy.currentHp).toBe(16);
  });

  it('clamps damage to 0 minimum (no negative-damage heals from attacks)', () => {
    // Mage with 0 STR vs high-DEF target
    const wimp: Unit = { ...royData, stats: { ...royData.stats, str: 0 } };
    const tank: Enemy = { ...banditData, stats: { ...banditData.stats, def: 50 } };
    const u = createUnit(wimp, { x: 0, y: 0 });
    const e = createEnemy(tank, { x: 1, y: 0 });
    const result = resolveCard(ironStrike, u, [e]);
    expect(result.targets[0]?.damage).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- combatResolver
```

- [ ] **Step 3: Implement resolver**

Create `phaser/src/game/systems/combatResolver.ts`:

```ts
import type { Card } from '../../data/schemas';
import { applyDamage, statValue, type UnitInstance } from '../entities/Unit';
import { applyDamageEnemy, type EnemyInstance } from '../entities/Enemy';

export interface CardResult {
  card: Card;
  source: UnitInstance;
  targets: Array<{
    target: UnitInstance | EnemyInstance;
    damage: number;
    killed: boolean;
  }>;
}

type Combatant = UnitInstance | EnemyInstance;

function defenseFor(target: Combatant, card: Card): number {
  // Magic cards (MAG) hit RES; everything else hits DEF
  const stat = card.stat === 'MAG' ? 'res' : 'def';
  return target.data.stats[stat];
}

export function resolveCard(
  card: Card,
  source: UnitInstance,
  targets: Combatant[],
): CardResult {
  const sourceStatValue = statValue(source, statKey(card.stat));
  const result: CardResult = { card, source, targets: [] };

  for (const target of targets) {
    let damage: number;
    if (card.damage_base < 0) {
      // Healing: damage_base is negative, applied as negative damage
      damage = card.damage_base - sourceStatValue; // e.g., -6 + (-MAG) = bigger heal
    } else {
      const dr = Math.floor(defenseFor(target, card) / 2);
      damage = Math.max(0, card.damage_base + sourceStatValue - dr);
    }

    if ('hand' in target) {
      applyDamage(target, damage);
    } else {
      applyDamageEnemy(target, damage);
    }

    result.targets.push({
      target,
      damage,
      killed: target.currentHp === 0 && damage > 0,
    });
  }

  return result;
}

function statKey(s: Card['stat']): 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res' {
  return s.toLowerCase() as 'str' | 'mag' | 'skl' | 'spd' | 'lck' | 'def' | 'res';
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 4 new combatResolver tests pass.

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/systems/combatResolver.ts phaser/tests/unit/combatResolver.test.ts
git commit -m "feat(phaser): combatResolver — deterministic damage = card_base + stat - DR"
```

---

### Task 17: deckManager (TDD draw/discard/reshuffle)

**Files:**
- Create: `phaser/src/game/systems/deckManager.ts`
- Create: `phaser/tests/unit/deckManager.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/deckManager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { drawCards, discardHand, reshuffleIfNeeded } from '../../src/game/systems/deckManager';
import { createUnit } from '../../src/game/entities/Unit';
import type { Unit } from '../../src/data/schemas';

function makeUnit(): ReturnType<typeof createUnit> {
  const data: Unit = {
    id: 'test', name: 'T', class: 'LORD', level: 1,
    stats: { hp: 1, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0, mov: 1 },
    deck: ['a','a','a','b','b','b','c','c','c','d','d','d'],
  };
  return createUnit(data, { x: 0, y: 0 });
}

describe('deckManager', () => {
  it('draws N cards from draw pile to hand', () => {
    const u = makeUnit();
    drawCards(u, 5);
    expect(u.hand).toHaveLength(5);
    expect(u.draw).toHaveLength(7);
  });

  it('does not mutate the original deck array (reference safety)', () => {
    const u = makeUnit();
    const originalDeck = u.data.deck;
    drawCards(u, 5);
    expect(u.data.deck).toBe(originalDeck);
    expect(u.data.deck).toHaveLength(12);
  });

  it('discards hand', () => {
    const u = makeUnit();
    drawCards(u, 5);
    discardHand(u);
    expect(u.hand).toHaveLength(0);
    expect(u.discard).toHaveLength(5);
  });

  it('reshuffles discard into draw when draw is empty', () => {
    const u = makeUnit();
    drawCards(u, 12);
    discardHand(u);
    expect(u.draw).toHaveLength(0);
    expect(u.discard).toHaveLength(12);
    reshuffleIfNeeded(u);
    expect(u.draw).toHaveLength(12);
    expect(u.discard).toHaveLength(0);
  });

  it('drawing past draw pile auto-reshuffles', () => {
    const u = makeUnit();
    drawCards(u, 12);
    discardHand(u);
    drawCards(u, 5);
    expect(u.hand).toHaveLength(5);
    expect(u.draw).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- deckManager
```

- [ ] **Step 3: Implement**

Create `phaser/src/game/systems/deckManager.ts`:

```ts
import type { UnitInstance } from '../entities/Unit';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

export function reshuffleIfNeeded(u: UnitInstance): void {
  if (u.draw.length === 0 && u.discard.length > 0) {
    u.draw = shuffle(u.discard);
    u.discard = [];
  }
}

export function drawCards(u: UnitInstance, count: number): void {
  for (let i = 0; i < count; i++) {
    reshuffleIfNeeded(u);
    const card = u.draw.shift();
    if (!card) return;
    u.hand.push(card);
  }
}

export function discardHand(u: UnitInstance): void {
  u.discard.push(...u.hand);
  u.hand = [];
}

export function discardCard(u: UnitInstance, cardId: string): void {
  const idx = u.hand.indexOf(cardId);
  if (idx >= 0) {
    u.hand.splice(idx, 1);
    u.discard.push(cardId);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 5 new deckManager tests pass.

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/systems/deckManager.ts phaser/tests/unit/deckManager.test.ts
git commit -m "feat(phaser): deckManager with draw/discard/reshuffle, reference-safe arrays"
```

---

### Task 18: turnManager (phase transitions)

**Files:**
- Create: `phaser/src/game/systems/turnManager.ts`
- Create: `phaser/tests/unit/turnManager.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/turnManager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTurnManager, advanceTurn } from '../../src/game/systems/turnManager';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['x'],
};
const banditData: Enemy = {
  id: 'bandit', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};

describe('turnManager', () => {
  it('starts with first party unit', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const tm = createTurnManager([u], [e]);
    expect(tm.currentSide).toBe('party');
    expect(tm.currentActor).toBe(u);
  });

  it('advances party -> enemy -> party', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const tm = createTurnManager([u], [e]);
    advanceTurn(tm);
    expect(tm.currentSide).toBe('enemy');
    expect(tm.currentActor).toBe(e);
    advanceTurn(tm);
    expect(tm.currentSide).toBe('party');
    expect(tm.currentActor).toBe(u);
  });

  it('skips dead actors', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e1 = createEnemy(banditData, { x: 5, y: 5 });
    const e2 = createEnemy(banditData, { x: 6, y: 5 });
    e1.alive = false;
    const tm = createTurnManager([u], [e1, e2]);
    advanceTurn(tm);
    expect(tm.currentActor).toBe(e2);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- turnManager
```

- [ ] **Step 3: Implement**

Create `phaser/src/game/systems/turnManager.ts`:

```ts
import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

export type Side = 'party' | 'enemy';

export interface TurnManager {
  party: UnitInstance[];
  enemies: EnemyInstance[];
  partyIdx: number;
  enemyIdx: number;
  currentSide: Side;
  currentActor: UnitInstance | EnemyInstance;
}

export function createTurnManager(
  party: UnitInstance[],
  enemies: EnemyInstance[],
): TurnManager {
  if (party.length === 0) throw new Error('party cannot be empty');
  if (enemies.length === 0) throw new Error('enemies cannot be empty');
  return {
    party, enemies,
    partyIdx: 0, enemyIdx: 0,
    currentSide: 'party',
    currentActor: party[0]!,
  };
}

export function advanceTurn(tm: TurnManager): void {
  if (tm.currentSide === 'party') {
    tm.currentSide = 'enemy';
    tm.enemyIdx = nextAliveIdx(tm.enemies, tm.enemyIdx);
    tm.currentActor = tm.enemies[tm.enemyIdx]!;
  } else {
    tm.currentSide = 'party';
    tm.partyIdx = nextAliveIdx(tm.party, tm.partyIdx);
    tm.currentActor = tm.party[tm.partyIdx]!;
  }
}

function nextAliveIdx<T extends { alive: boolean }>(arr: T[], from: number): number {
  for (let i = 1; i <= arr.length; i++) {
    const idx = (from + i) % arr.length;
    if (arr[idx]?.alive) return idx;
  }
  return from;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/systems/turnManager.ts phaser/tests/unit/turnManager.test.ts
git commit -m "feat(phaser): turnManager with party/enemy alternation, skips dead"
```

---

### Task 19: Wire combat resolution into CombatScene

**Files:**
- Create: `phaser/src/game/render/unitSprites.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`
- Modify: `phaser/src/state/combatStore.ts`

- [ ] **Step 1: Add unit/enemy state to store**

Modify `phaser/src/state/combatStore.ts` — add to interface and initial:

```ts
import type { UnitInstance } from '../game/entities/Unit';
import type { EnemyInstance } from '../game/entities/Enemy';

interface CombatState {
  // ... existing fields
  party: UnitInstance[];
  enemies: EnemyInstance[];
  setBattle: (party: UnitInstance[], enemies: EnemyInstance[]) => void;
}

const initial = {
  // ... existing fields
  party: [] as UnitInstance[],
  enemies: [] as EnemyInstance[],
};

export const useCombatStore = create<CombatState>((set) => ({
  ...initial,
  // ... existing setters
  setBattle: (party, enemies) => set({ party, enemies }),
  // ... rest
}));
```

(Apply this carefully — preserve all existing methods.)

- [ ] **Step 2: Unit sprite renderer**

Create `phaser/src/game/render/unitSprites.ts`:

```ts
import Phaser from 'phaser';
import { tileToWorld, TILE_SIZE } from './gridRenderer';
import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

const PARTY_COLOR = 0x4488ff;
const ENEMY_COLOR = 0xc04444;

export interface ActorSprite {
  graphics: Phaser.GameObjects.Graphics;
  hpText: Phaser.GameObjects.Text;
  ref: UnitInstance | EnemyInstance;
}

export function renderActor(
  scene: Phaser.Scene,
  actor: UnitInstance | EnemyInstance,
  isParty: boolean,
): ActorSprite {
  const { x, y } = tileToWorld(actor.pos);
  const g = scene.add.graphics();
  g.fillStyle(isParty ? PARTY_COLOR : ENEMY_COLOR, 1);
  g.fillCircle(x, y, TILE_SIZE / 2 - 6);
  g.lineStyle(2, 0x000000, 0.5);
  g.strokeCircle(x, y, TILE_SIZE / 2 - 6);

  const hpText = scene.add.text(x, y + TILE_SIZE / 2 - 10, `${actor.currentHp}`, {
    color: '#fff', fontSize: '11px', fontStyle: 'bold',
  }).setOrigin(0.5);

  return { graphics: g, hpText, ref: actor };
}

export function refreshActor(sprite: ActorSprite): void {
  sprite.hpText.setText(`${sprite.ref.currentHp}`);
  if (!sprite.ref.alive) {
    sprite.graphics.alpha = 0.3;
    sprite.hpText.setText('×');
  }
}
```

- [ ] **Step 3: Wire into CombatScene**

In `CombatScene.create()`, replace the placeholder Roy marker with full battle setup:

```ts
import { createUnit } from '../entities/Unit';
import { createEnemy } from '../entities/Enemy';
import { renderActor, refreshActor, type ActorSprite } from '../render/unitSprites';
import { resolveCard } from '../systems/combatResolver';
import { drawCards } from '../systems/deckManager';

// in CombatScene class:
private actors: ActorSprite[] = [];

// in create():
const data = this.registry.get('gameData') as GameData;
const royData = data.unitById('roy')!;
const marcusData = data.unitById('marcus')!;
const lilinaData = data.unitById('lilina')!;
const banditData = data.enemyById('bandit')!;
const mageData = data.enemyById('mage_bandit')!;
const captainData = data.enemyById('bandit_captain')!;

const party = [
  createUnit(royData, { x: 3, y: 5 }),
  createUnit(marcusData, { x: 3, y: 4 }),
  createUnit(lilinaData, { x: 3, y: 6 }),
];
const enemies = [
  createEnemy(banditData, { x: 10, y: 5 }),
  createEnemy(mageData, { x: 10, y: 4 }),
  createEnemy(captainData, { x: 10, y: 6 }),
];

useCombatStore.getState().setBattle(party, enemies);
party.forEach(p => drawCards(p, 5));

party.forEach(p => this.actors.push(renderActor(this, p, true)));
enemies.forEach(e => this.actors.push(renderActor(this, e, false)));

// Render Roy's hand
const roy = party[0]!;
const handCards = roy.hand.map(id => data.cardById(id)!);
this.hand = renderHand(this, handCards);
this.hand.forEach((sprite) => {
  attachCardInput(this, sprite, (card) => {
    useCombatStore.getState().selectCard(card.id);
    const valid = validTilesForCard(card, roy.pos);
    this.overlay.showValidTiles(valid);
  });
});
```

No store changes needed — the selected card ID is sufficient to resolve effects (lookup card by ID, source unit is the active party member).

- [ ] **Step 4: Click target → resolve**

Add to `CombatScene.create()`:

```ts
this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
  if (pointer.rightButtonDown()) return; // handled elsewhere
  const { selectedCardId } = useCombatStore.getState();
  if (!selectedCardId) return;

  const tile = worldToTile({ x: pointer.worldX, y: pointer.worldY });
  if (!tile) return;

  const card = this.data.cardById(selectedCardId)!;
  const valid = validTilesForCard(card, roy.pos);
  if (!valid.some(t => t.x === tile.x && t.y === tile.y)) return;

  const aoeTiles = aoeTilesAt(card, tile);
  const targets = enemies.filter(e =>
    e.alive && aoeTiles.some(t => t.x === e.pos.x && t.y === e.pos.y)
  );

  if (targets.length === 0 && card.target !== 'GROUND') return;

  resolveCard(card, roy, targets);
  this.actors.forEach(refreshActor);
  useCombatStore.getState().cancelSelection();
  this.overlay.clear();
});
```

- [ ] **Step 5: Manually verify**

```bash
npm run dev
```

Click Iron Strike → click adjacent enemy. Enemy HP drops by 9 (4+6-floor(3/2)). Click Fireball → click ground in range → AOE damages enemies in radius.

- [ ] **Step 6: Commit**

```bash
git add phaser/src/
git commit -m "feat(phaser): wire card play to combatResolver, render party + enemies, HP updates"
```

---

### Task 20: Damage popup + death handling

**Files:**
- Create: `phaser/src/game/render/damageNumber.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Damage number renderer**

Create `phaser/src/game/render/damageNumber.ts`:

```ts
import Phaser from 'phaser';
import { tileToWorld, type GridCoord } from './gridRenderer';

export function spawnDamageNumber(
  scene: Phaser.Scene,
  pos: GridCoord,
  amount: number,
): void {
  const { x, y } = tileToWorld(pos);
  const isHeal = amount < 0;
  const text = isHeal ? `+${-amount}` : `${amount}`;
  const color = isHeal ? '#7fffaa' : amount === 0 ? '#aaaaaa' : '#ff6b6b';

  const t = scene.add.text(x, y - 10, text, {
    color, fontSize: '20px', fontStyle: 'bold',
    stroke: '#000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(200);

  scene.tweens.add({
    targets: t,
    y: y - 50,
    alpha: 0,
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}
```

- [ ] **Step 2: Use after resolve in CombatScene**

In the click-target handler, after `resolveCard(...)`:

```ts
const result = resolveCard(card, roy, targets);
result.targets.forEach(t => spawnDamageNumber(this, t.target.pos, t.damage));
this.actors.forEach(refreshActor);
useCombatStore.getState().cancelSelection();
this.overlay.clear();
```

(Add `import { spawnDamageNumber } from '../render/damageNumber';` at top.)

- [ ] **Step 3: Manual verify + commit**

```bash
npm run dev
```

Damage numbers float up from targets after card play.

```bash
git add phaser/src/game/render/damageNumber.ts phaser/src/game/scenes/CombatScene.ts
git commit -m "feat(phaser): floating damage numbers on card resolution"
```

---

### Task 21: Playwright E2E — full card play flow

**Files:**
- Create: `phaser/tests/e2e/card-play.spec.ts`

- [ ] **Step 1: E2E test**

Create `phaser/tests/e2e/card-play.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('initial battle state renders', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot('battle-initial.png', { maxDiffPixels: 400 });
});

test('selecting first card highlights valid tiles', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Click first card in hand
  await page.mouse.click(540, 670);
  await page.waitForTimeout(200);

  await expect(page).toHaveScreenshot('battle-card-selected.png', { maxDiffPixels: 400 });
});
```

Note: full hit-and-damage E2E is deferred to Task 30 (full-flow.spec.ts) once damage numbers and animations are landed.

- [ ] **Step 2: Generate baselines + run**

```bash
npm run test:e2e:update
npm run test:e2e
```

- [ ] **Step 3: Commit + tag end of Phase 3**

```bash
git add phaser/tests/e2e/
git commit -m "test(phaser): E2E for card play flow"
git tag phaser-phase3-combat-math
```

---

## Phase 4 — Content + Enemy AI (Day 9-10, Tasks 22-26)

**Scope note on player movement:** The sandbox uses fixed party deployment (Roy/Marcus/Lilina at column 3, enemies at column 10) with no player-controlled unit movement. Lilina (Fireball range 2-4, Bolt range 2-3), Marcus (Lance Thrust 1-2, Javelin 2-3), and Roy (Iron Strike 1-1) cover ranged engagement until enemy AI advances into melee. Free unit movement is deferred to Milestone 2 alongside the wider HUD redesign. This is intentional sandbox scope — minimum surface to validate the stack.

### Task 22: Expand to full 12-card class decks

**Files:**
- Modify: `phaser/src/data/cards.json` (add ~10 more cards)
- Modify: `phaser/src/data/units.json` (decks already 12 each, but verify card variety)

- [ ] **Step 1: Add Marcus and Lilina-specific cards to cards.json**

Add these entries to the `cards` array in `phaser/src/data/cards.json`:

```json
{
  "id": "lance_thrust",
  "name": "Lance Thrust",
  "cost": 1,
  "damage_base": 5,
  "stat": "STR",
  "target": "ENEMY",
  "range": { "min": 1, "max": 2 },
  "aoe": { "shape": "single", "radius": 0 },
  "description": "Reach 2 tiles. STR scaling."
},
{
  "id": "javelin",
  "name": "Javelin",
  "cost": 2,
  "damage_base": 4,
  "stat": "STR",
  "target": "ENEMY",
  "range": { "min": 2, "max": 3 },
  "aoe": { "shape": "single", "radius": 0 },
  "description": "Thrown spear, longer range."
},
{
  "id": "bolt",
  "name": "Bolt",
  "cost": 1,
  "damage_base": 3,
  "stat": "MAG",
  "target": "ENEMY",
  "range": { "min": 2, "max": 3 },
  "aoe": { "shape": "single", "radius": 0 },
  "description": "Single-target lightning."
},
{
  "id": "frostbite",
  "name": "Frostbite",
  "cost": 2,
  "damage_base": 3,
  "stat": "MAG",
  "target": "ENEMY",
  "range": { "min": 2, "max": 3 },
  "aoe": { "shape": "single", "radius": 0 },
  "description": "Slows target on hit."
}
```

- [ ] **Step 2: Update unit decks for variety**

Modify `phaser/src/data/units.json`:

```json
"deck": ["iron_strike", "iron_strike", "iron_strike", "iron_strike", "shield_bash", "shield_bash", "guard", "guard", "heal", "heal", "heal", "heal"]
```
(Roy keeps similar)

```json
"deck": ["iron_strike", "iron_strike", "iron_strike", "lance_thrust", "lance_thrust", "lance_thrust", "javelin", "javelin", "shield_bash", "shield_bash", "guard", "guard"]
```
(Marcus — gets lances/javelins)

```json
"deck": ["fireball", "fireball", "fireball", "fireball", "bolt", "bolt", "bolt", "frostbite", "frostbite", "heal", "heal", "guard"]
```
(Lilina — varied magic)

- [ ] **Step 3: Verify load passes**

```bash
npm test -- load
```

Expected: 3 passed (validates card refs).

- [ ] **Step 4: Commit**

```bash
git add phaser/src/data/
git commit -m "feat(phaser): expand card pool to 9 cards, give units varied decks"
```

---

### Task 23: enemyAI (closest target)

**Files:**
- Create: `phaser/src/game/systems/enemyAI.ts`
- Create: `phaser/tests/unit/enemyAI.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/enemyAI.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideEnemyAction } from '../../src/game/systems/enemyAI';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const banditData: Enemy = {
  id: 'bandit', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};
const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 },
  deck: ['x'],
};

describe('decideEnemyAction', () => {
  it('moves toward closest party unit', () => {
    const e = createEnemy(banditData, { x: 10, y: 5 });
    const u = createUnit(royData, { x: 5, y: 5 });
    const action = decideEnemyAction(e, [u]);
    expect(action.kind).toBe('move');
    if (action.kind === 'move') {
      // Should move 4 tiles (mov=4) toward Roy
      expect(action.to.x).toBeLessThan(e.pos.x);
    }
  });

  it('attacks when adjacent', () => {
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const u = createUnit(royData, { x: 6, y: 5 });
    const action = decideEnemyAction(e, [u]);
    expect(action.kind).toBe('attack');
    if (action.kind === 'attack') {
      expect(action.target).toBe(u);
    }
  });

  it('skips dead targets', () => {
    const e = createEnemy(banditData, { x: 5, y: 5 });
    const u1 = createUnit(royData, { x: 6, y: 5 });
    const u2 = createUnit({ ...royData, id: 'm' }, { x: 8, y: 5 });
    u1.alive = false;
    const action = decideEnemyAction(e, [u1, u2]);
    expect(action.kind).toBe('move');
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- enemyAI
```

- [ ] **Step 3: Implement**

Create `phaser/src/game/systems/enemyAI.ts`:

```ts
import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';
import type { GridCoord } from '../render/gridRenderer';

export type EnemyAction =
  | { kind: 'move'; to: GridCoord }
  | { kind: 'attack'; target: UnitInstance }
  | { kind: 'wait' };

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function decideEnemyAction(
  enemy: EnemyInstance,
  party: UnitInstance[],
): EnemyAction {
  const alive = party.filter(p => p.alive);
  if (alive.length === 0) return { kind: 'wait' };

  // Closest alive unit
  let closest = alive[0]!;
  let bestDist = manhattan(enemy.pos, closest.pos);
  for (const p of alive) {
    const d = manhattan(enemy.pos, p.pos);
    if (d < bestDist) { closest = p; bestDist = d; }
  }

  // In attack range?
  if (bestDist >= enemy.data.attack.range.min && bestDist <= enemy.data.attack.range.max) {
    return { kind: 'attack', target: closest };
  }

  // Step toward closest, up to mov tiles
  const stepCount = Math.min(enemy.data.stats.mov, bestDist - 1);
  const dx = Math.sign(closest.pos.x - enemy.pos.x);
  const dy = Math.sign(closest.pos.y - enemy.pos.y);
  let nx = enemy.pos.x;
  let ny = enemy.pos.y;
  let stepsLeft = stepCount;
  // Greedy: prioritize axis with greater distance
  while (stepsLeft > 0) {
    const ddx = closest.pos.x - nx;
    const ddy = closest.pos.y - ny;
    if (Math.abs(ddx) >= Math.abs(ddy) && dx !== 0) { nx += dx; }
    else if (dy !== 0) { ny += dy; }
    else if (dx !== 0) { nx += dx; }
    else break;
    stepsLeft--;
  }
  return { kind: 'move', to: { x: nx, y: ny } };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/systems/enemyAI.ts phaser/tests/unit/enemyAI.test.ts
git commit -m "feat(phaser): enemyAI - closest target movement and attack"
```

---

### Task 24: Capture mechanic

**Files:**
- Create: `phaser/src/game/systems/capture.ts`
- Create: `phaser/tests/unit/capture.test.ts`

- [ ] **Step 1: Failing test**

Create `phaser/tests/unit/capture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canAttemptCapture, captureChance } from '../../src/game/systems/capture';
import { createUnit } from '../../src/game/entities/Unit';
import { createEnemy } from '../../src/game/entities/Enemy';
import type { Unit, Enemy } from '../../src/data/schemas';

const royData: Unit = {
  id: 'roy', name: 'Roy', class: 'LORD', level: 1,
  stats: { hp: 22, str: 6, mag: 0, skl: 6, spd: 7, lck: 7, def: 5, res: 2, mov: 5 }, deck: ['x'],
};
const banditData: Enemy = {
  id: 'b', name: 'B', level: 1,
  stats: { hp: 18, str: 5, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 1, mov: 4 },
  attack: { damage: 5, range: { min: 1, max: 1 }, type: 'physical' }, ai: 'closest_target',
};

describe('capture', () => {
  it('cannot capture if not adjacent', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 5, y: 5 });
    expect(canAttemptCapture(u, e)).toBe(false);
  });

  it('can capture if adjacent', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 1, y: 0 });
    expect(canAttemptCapture(u, e)).toBe(true);
  });

  it('chance scales with low HP', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const fullHp = createEnemy(banditData, { x: 1, y: 0 });
    const lowHp = createEnemy(banditData, { x: 1, y: 0 });
    lowHp.currentHp = 2;
    expect(captureChance(u, fullHp, [])).toBeLessThan(captureChance(u, lowHp, []));
  });

  it('chance scales with adjacent allies (surround)', () => {
    const u = createUnit(royData, { x: 0, y: 0 });
    const e = createEnemy(banditData, { x: 1, y: 0 });
    const ally = createUnit({ ...royData, id: 'm' }, { x: 2, y: 0 });
    e.currentHp = 5;
    const aloneChance = captureChance(u, e, []);
    const surrounded = captureChance(u, e, [ally]);
    expect(surrounded).toBeGreaterThan(aloneChance);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
npm test -- capture
```

- [ ] **Step 3: Implement**

Create `phaser/src/game/systems/capture.ts`:

```ts
import type { UnitInstance } from '../entities/Unit';
import type { EnemyInstance } from '../entities/Enemy';

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function canAttemptCapture(u: UnitInstance, e: EnemyInstance): boolean {
  return e.alive && manhattan(u.pos, e.pos) === 1;
}

export function captureChance(
  attacker: UnitInstance,
  enemy: EnemyInstance,
  adjacentAllies: UnitInstance[],
): number {
  const hpFraction = enemy.currentHp / enemy.data.stats.hp;
  const baseChance = (1 - hpFraction) * 0.6; // up to 60% from HP
  const surroundBonus = adjacentAllies.filter(a =>
    a.alive && manhattan(a.pos, enemy.pos) === 1
  ).length * 0.25;
  return Math.min(0.95, baseChance + surroundBonus);
}

export function attemptCapture(
  attacker: UnitInstance,
  enemy: EnemyInstance,
  adjacentAllies: UnitInstance[],
): boolean {
  const chance = captureChance(attacker, enemy, adjacentAllies);
  return Math.random() < chance;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add phaser/src/game/systems/capture.ts phaser/tests/unit/capture.test.ts
git commit -m "feat(phaser): capture mechanic with surround bonus"
```

---

### Task 25: Wire enemy turns + win/lose detection

**Files:**
- Modify: `phaser/src/game/scenes/CombatScene.ts`
- Modify: `phaser/src/state/combatStore.ts`

- [ ] **Step 1: End turn button (text-only for sandbox)**

In `CombatScene.create()`, append:

```ts
const endTurnBtn = this.add.text(1150, 680, '[End Turn]', {
  color: '#ffb366', fontSize: '16px', backgroundColor: '#2a1c14', padding: { x: 10, y: 6 },
}).setOrigin(0.5).setInteractive();

endTurnBtn.on('pointerdown', () => this.endPlayerTurn());
```

- [ ] **Step 2: Implement endPlayerTurn**

Add method to CombatScene:

```ts
import { decideEnemyAction } from '../systems/enemyAI';
import { applyDamage } from '../entities/Unit';

private endPlayerTurn(): void {
  const { party, enemies } = useCombatStore.getState();

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const action = decideEnemyAction(enemy, party);
    if (action.kind === 'attack') {
      applyDamage(action.target, enemy.data.attack.damage);
      spawnDamageNumber(this, action.target.pos, enemy.data.attack.damage);
    } else if (action.kind === 'move') {
      enemy.pos = action.to;
      const sprite = this.actors.find(a => a.ref === enemy);
      if (sprite) {
        const w = tileToWorld(enemy.pos);
        sprite.graphics.clear();
        sprite.graphics.fillStyle(0xc04444, 1).fillCircle(w.x, w.y, TILE_SIZE / 2 - 6);
        sprite.graphics.lineStyle(2, 0x000000, 0.5).strokeCircle(w.x, w.y, TILE_SIZE / 2 - 6);
        sprite.hpText.setPosition(w.x, w.y + TILE_SIZE / 2 - 10);
      }
    }
  }

  this.actors.forEach(refreshActor);
  this.checkWinLose();
}

private checkWinLose(): void {
  const { party, enemies } = useCombatStore.getState();
  const enemiesAlive = enemies.some(e => e.alive);
  const royAlive = party[0]?.alive ?? false;
  const partyAlive = party.some(p => p.alive);

  if (!enemiesAlive) {
    useCombatStore.getState().setPhase('VICTORY');
  } else if (!royAlive || !partyAlive) {
    useCombatStore.getState().setPhase('DEFEAT');
  }
}
```

(Add appropriate imports: `tileToWorld, TILE_SIZE` from gridRenderer.)

- [ ] **Step 3: Capture mechanic for sandbox (Vitest-only)**

Capture logic is fully implemented in Task 24 and tested via Vitest. The interactive capture button is **deferred to Milestone 2** — sandbox proves the math works; a click-to-capture UI button on adjacent low-HP enemies belongs with the wider HUD redesign in the next milestone. This is an explicit scope choice, not a TODO.

- [ ] **Step 4: Manual playthrough test**

```bash
npm run dev
```

Play several rounds: cards damage enemies, click End Turn, enemies attack/move, eventually reach VICTORY or DEFEAT phase.

- [ ] **Step 5: Commit + tag end of Phase 4**

```bash
git add phaser/src/
git commit -m "feat(phaser): enemy turns (move + attack) + win/lose phase detection"
git tag phaser-phase4-content-ai
```

---

## Phase 5 — Polish & Shippability (Day 11-14, Tasks 26-32)

### Task 26: Victory + Defeat React modals

**Files:**
- Create: `phaser/src/ui/shell/VictoryModal.tsx`
- Create: `phaser/src/ui/shell/DefeatModal.tsx`
- Create: `phaser/src/ui/shell/PauseModal.tsx`
- Modify: `phaser/src/ui/App.tsx`

- [ ] **Step 1: VictoryModal**

Create `phaser/src/ui/shell/VictoryModal.tsx`:

```tsx
import { useCombatStore } from '../../state/combatStore';

export function VictoryModal(): JSX.Element | null {
  const phase = useCombatStore(s => s.phase);
  if (phase !== 'VICTORY') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#ffb366] rounded-lg p-8 text-center min-w-[320px]">
        <h1 className="text-3xl font-bold text-[#ffb366] mb-4">Victory</h1>
        <p className="text-[#e8d8c0] mb-6">All enemies defeated.</p>
        <button
          onClick={() => location.reload()}
          className="bg-[#ffb366] text-[#1a1410] font-bold px-6 py-2 rounded hover:bg-[#ffc480]"
        >
          New Battle
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: DefeatModal (similar pattern, red accent)**

Create `phaser/src/ui/shell/DefeatModal.tsx`:

```tsx
import { useCombatStore } from '../../state/combatStore';

export function DefeatModal(): JSX.Element | null {
  const phase = useCombatStore(s => s.phase);
  if (phase !== 'DEFEAT') return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#c04444] rounded-lg p-8 text-center min-w-[320px]">
        <h1 className="text-3xl font-bold text-[#c04444] mb-4">Defeat</h1>
        <p className="text-[#e8d8c0] mb-6">Your party has fallen.</p>
        <button
          onClick={() => location.reload()}
          className="bg-[#c04444] text-[#fff] font-bold px-6 py-2 rounded hover:bg-[#d05454]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: PauseModal**

Create `phaser/src/ui/shell/PauseModal.tsx`:

```tsx
import { useEffect, useState } from 'react';

export function PauseModal(): JSX.Element | null {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!paused) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-auto">
      <div className="bg-[#2a1c14] border-2 border-[#ffb366] rounded-lg p-8 text-center">
        <h2 className="text-2xl text-[#ffb366] mb-4">Paused</h2>
        <p className="text-[#e8d8c0] mb-4">Press P to resume.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into App**

Replace `phaser/src/ui/App.tsx`:

```tsx
import { VictoryModal } from './shell/VictoryModal';
import { DefeatModal } from './shell/DefeatModal';
import { PauseModal } from './shell/PauseModal';

export function App(): JSX.Element {
  return (
    <div id="react-shell" className="absolute inset-0 pointer-events-none">
      <VictoryModal />
      <DefeatModal />
      <PauseModal />
    </div>
  );
}
```

- [ ] **Step 5: Manual verify**

```bash
npm run dev
```

Win or lose a battle → modal appears with restart button.

- [ ] **Step 6: Commit**

```bash
git add phaser/src/ui/
git commit -m "feat(phaser): victory/defeat/pause React modals"
```

---

### Task 27: Sprite animations (hit flash, death fade)

**Files:**
- Modify: `phaser/src/game/render/unitSprites.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Add hit flash**

Append to `phaser/src/game/render/unitSprites.ts`:

```ts
export function hitFlash(scene: Phaser.Scene, sprite: ActorSprite): void {
  scene.tweens.add({
    targets: sprite.graphics,
    alpha: { from: 1, to: 0.3 },
    duration: 80,
    yoyo: true,
  });
}

export function deathFade(scene: Phaser.Scene, sprite: ActorSprite): void {
  scene.tweens.add({
    targets: [sprite.graphics, sprite.hpText],
    alpha: 0.2,
    duration: 400,
    ease: 'Quad.easeOut',
  });
}
```

- [ ] **Step 2: Trigger from card resolution**

In `CombatScene` click-target handler, after `resolveCard`:

```ts
result.targets.forEach(t => {
  spawnDamageNumber(this, t.target.pos, t.damage);
  const sprite = this.actors.find(a => a.ref === t.target);
  if (sprite) {
    if (t.killed) deathFade(this, sprite);
    else hitFlash(this, sprite);
  }
});
```

(Add imports: `hitFlash, deathFade`.)

- [ ] **Step 3: Commit**

```bash
git add phaser/src/game/
git commit -m "feat(phaser): hit flash + death fade animations"
```

---

### Task 28: Camera shake on big hits

**Files:**
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Shake on big damage**

In CombatScene click-target handler, after damage resolution:

```ts
const totalDamage = result.targets.reduce((s, t) => s + Math.max(0, t.damage), 0);
if (totalDamage >= 10) {
  this.cameras.main.shake(150, 0.005);
}
if (result.targets.some(t => t.killed)) {
  this.cameras.main.shake(220, 0.008);
}
```

- [ ] **Step 2: Commit**

```bash
git add phaser/src/game/scenes/CombatScene.ts
git commit -m "feat(phaser): camera shake on big hits and kills"
```

---

### Task 29: Audio (Howler.js, 5 SFX)

**Files:**
- Modify: `phaser/package.json` (install howler)
- Create: `phaser/public/audio/.gitkeep`
- Create: `phaser/src/game/audio.ts`
- Modify: `phaser/src/game/scenes/CombatScene.ts`

- [ ] **Step 1: Install Howler**

```bash
cd phaser && npm install howler@^2.2.4
npm install -D @types/howler
```

- [ ] **Step 2: Audio module**

Create `phaser/src/game/audio.ts`:

```ts
import { Howl } from 'howler';

const sounds: Record<string, Howl> = {};

export function loadAudio(name: string, src: string): void {
  sounds[name] = new Howl({ src: [src], volume: 0.6 });
}

export function play(name: string): void {
  sounds[name]?.play();
}

export function initAudio(): void {
  // Sandbox: load placeholder ogg/mp3 files OR use silent stubs.
  // Drop your SFX into phaser/public/audio/ as: hit.mp3, miss.mp3, draw.mp3, victory.mp3, defeat.mp3
  loadAudio('hit', '/audio/hit.mp3');
  loadAudio('miss', '/audio/miss.mp3');
  loadAudio('draw', '/audio/draw.mp3');
  loadAudio('victory', '/audio/victory.mp3');
  loadAudio('defeat', '/audio/defeat.mp3');
}
```

- [ ] **Step 3: Wire into BootScene**

In `phaser/src/game/scenes/BootScene.ts`, add to `create()` before `scene.start`:

```ts
import { initAudio } from '../audio';
initAudio();
```

- [ ] **Step 4: Trigger SFX from CombatScene**

In click-target handler:

```ts
import { play } from '../audio';

if (totalDamage > 0) play('hit');
else play('miss');
```

In `checkWinLose`:

```ts
if (!enemiesAlive) {
  play('victory');
  useCombatStore.getState().setPhase('VICTORY');
} else if (!royAlive || !partyAlive) {
  play('defeat');
  useCombatStore.getState().setPhase('DEFEAT');
}
```

- [ ] **Step 5: Document expected audio files**

Add to `phaser/public/audio/.gitkeep`:

```
# Drop SFX files here:
# hit.mp3, miss.mp3, draw.mp3, victory.mp3, defeat.mp3
# Free placeholders: https://freesound.org or https://opengameart.org
```

- [ ] **Step 6: Commit**

```bash
git add phaser/
git commit -m "feat(phaser): audio module with 5 SFX hooks (placeholder files)"
```

---

### Task 30: Comprehensive visual snapshot suite

**Files:**
- Create: `phaser/tests/e2e/full-flow.spec.ts`

- [ ] **Step 1: Multi-scenario test**

Create `phaser/tests/e2e/full-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Full sandbox visual coverage', () => {
  test('initial battle state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('full-initial.png', { maxDiffPixels: 400 });
  });

  test('card hovered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.mouse.move(540, 670);
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('full-hover.png', { maxDiffPixels: 400 });
  });

  test('card selected, valid tiles shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.mouse.click(540, 670);
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('full-selected.png', { maxDiffPixels: 400 });
  });
});
```

- [ ] **Step 2: Generate baselines**

```bash
npm run test:e2e:update
npm run test:e2e
```

- [ ] **Step 3: Commit**

```bash
git add phaser/tests/e2e/full-flow.spec.ts phaser/tests/e2e/full-flow.spec.ts-snapshots/
git commit -m "test(phaser): full visual snapshot suite covering hand UX states"
```

---

### Task 31: README, run/test/build commands documented

**Files:**
- Modify: `phaser/README.md`

- [ ] **Step 1: Expand README**

Replace `phaser/README.md`:

```markdown
# FE_MB Phaser Sandbox

First milestone of the FE_MB migration from Godot 4.6 to TypeScript + Phaser 4.

This sandbox is a single-battle proof-of-concept that validates the AI iteration loop and the Phaser+React hybrid architecture before scaling to wider FE_MB scope.

## What works
- 3v3 tactical combat on a 14×10 grid (Roy/Marcus/Lilina vs Bandit/MageBandit/BanditCaptain)
- Card-based actions with 3 AP per turn, deterministic damage
- 9-card pool: Iron Strike, Shield Bash, Fireball (AOE), Heal, Guard, Lance Thrust, Javelin, Bolt, Frostbite
- Card hand UI: hover lift, click-to-select, valid-tile highlight, AOE preview, ESC/right-click cancel
- Enemy AI: closest-target movement and attacks
- Capture mechanic (HP%-based with surround bonus)
- Win (all enemies defeated) / Defeat (Roy or party wiped) modals
- Hit flash, death fade, camera shake on big hits, 5 audio SFX hooks

## Quickstart

```bash
npm install
npm run dev          # http://localhost:5173
```

## Test

```bash
npm test                  # Vitest unit (combat math, deck, turn, targeting)
npm run test:e2e          # Playwright E2E + visual snapshots
npm run test:e2e:update   # Regenerate visual baselines after intentional UI changes
npm run typecheck         # tsc --noEmit
```

## Build

```bash
npm run build             # Production bundle in dist/
npm run preview           # Serve dist/ for verification
```

## Architecture

- `src/game/` — Phaser scenes, entities, pure systems. Never imports React.
- `src/ui/` — React modals only. Never imports Phaser.
- `src/state/` — Zustand stores; the bridge between Phaser and React.
- `src/data/` — JSON content + Zod schemas + validated loader.

See `docs/superpowers/specs/2026-05-05-phaser-migration-design.md` and `docs/superpowers/plans/2026-05-05-phaser-sandbox.md` for design rationale.

## Known limits (sandbox scope)

- Single fixed battle, no save/load, no overworld, no towns
- Sharpness, status effects, quick slots not implemented
- Audio files are placeholder hooks — drop your own into `public/audio/`
- Sprite art is geometric primitives — Kenney sprite swap is a future task
```

- [ ] **Step 2: Commit**

```bash
git add phaser/README.md
git commit -m "docs(phaser): expand README with quickstart, test, build, scope"
```

---

### Task 32: Final verification + tag v0.1-sandbox

**Files:** none new — verification only.

- [ ] **Step 1: Full test suite**

```bash
cd phaser
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Expected: typecheck clean, all unit tests pass, all E2E pass, build artifact in `dist/`.

- [ ] **Step 2: Manual playthrough**

```bash
npm run preview
```

Walk through: select cards → target enemies → kill them → see victory modal. Reload, get yourself defeated → see defeat modal. Press P → pause modal works.

- [ ] **Step 3: Verify edit-to-see latency**

Time this manually. Edit `cardHandRenderer.ts` (e.g., change `HOVER_LIFT` to 50). Save. Time until visible in browser. Target: under 5 seconds.

- [ ] **Step 4: Demo recording**

Record a ~2 minute video showing one full battle. Place at `docs/media/sandbox-demo.mp4`.

- [ ] **Step 5: Final commit + tag**

```bash
git add -A
git commit -m "chore(phaser): sandbox milestone complete"
git tag phaser-v0.1-sandbox
```

- [ ] **Step 6: Update root MEMORY.md or CLAUDE.md**

Add a one-line entry to `CLAUDE.md` at the project root noting the phaser/ sandbox is shipped.

```markdown
- `phaser/` — Combat sandbox (TypeScript + Phaser 4 + React + Vite). Ships v0.1, validated AI iteration loop. See phaser/README.md.
```

```bash
git add CLAUDE.md
git commit -m "docs: note phaser/ sandbox milestone in root CLAUDE.md"
```

---

## Sandbox Milestone Success Criteria

Per spec §13, the sandbox is shipped when ALL of:

1. ✅ A complete battle (3v3, full kits, capture-eligible) is playable start-to-finish in browser.
2. ✅ Vitest suite has ≥20 passing tests covering combat math, deck, turn order, targeting, capture, AI.
3. ✅ Playwright suite has ≥5 E2E scenarios with visual snapshot baselines.
4. ✅ Edit-to-see latency for a card-render change is under 5 seconds via Vite HMR + Playwright MCP.
5. ✅ README documents run/test/build commands.
6. ✅ A demo recording (~2 min) of one full battle is captured.

If any fail, the migration premise is reconsidered before scaling to Milestone 2 (combat + 1 town).

---

## After Sandbox: Milestone Roadmap (not in this plan)

- **Milestone 2 — Combat + 1 town:** Add a single town menu (Inn/Shop/Blacksmith), save/load, scene transitions. Validates React-heavy UI in this stack.
- **Milestone 3 — Mini-run loop:** Tiny overworld (3-5 nodes), travel encounters, 1 dialogue event with stat check. Validates full core loop.
- **Milestone 4 — Vertical slice:** ~6 battles, 2 towns, 1 dungeon, polished art pass, audio pass. Playable demo for stranger testing.
- **Milestone 5 — Steam packaging:** Electron + steamworks.js, gamepad support, achievements, Steam Deck verification.
