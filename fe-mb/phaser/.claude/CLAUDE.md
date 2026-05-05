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
