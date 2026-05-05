# FE_MB Phaser Sandbox

First milestone of the FE_MB migration from Godot 4.6 to TypeScript + Phaser 4.

This sandbox is a single-battle proof-of-concept that validates the AI iteration loop and the Phaser+React hybrid architecture before scaling to wider FE_MB scope.

## What works
- 3v3 tactical combat on a 14x10 grid (Roy/Marcus/Lilina vs Bandit/MageBandit/BanditCaptain)
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
