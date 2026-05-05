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
