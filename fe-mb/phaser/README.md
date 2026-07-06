# FE_MB Phaser — Beta

TypeScript + Phaser 4 + React 19 + Vite + Zustand + Zod tactical roguelite. Migrated from a Godot 4.6 prototype.

## Play the beta

```bash
npm install
npm run dev               # → http://localhost:5183
```

**New Game** starts a guided tutorial fight, then the overworld. The loop:
travel the node map (encounters roll per hop, food burns per day) → fight
card-battles where your **gear IS your deck** (press **I** for the loadout
screen; every weapon/shield/tome contributes its cards) → buy/sell in towns,
take tavern quests, brave dungeons → cross all three regions and challenge
**the Iron Throne**. Permadeath is real; save from the pause menu (Esc).
Keys: **I** loadout · **Q** quest log · **Tab** danger zones (combat) ·
**Esc** pause/cancel · backtick dev HUD.

## Dev commands

```bash
npm run dev               # Vite dev server :5183 (5173 is NOT ours)
npm test                  # Vitest unit tests (~140)
npm run test:e2e          # Playwright smoke
npm run typecheck
npm run build
npm run check-context-doc # CI: assert CONTEXT.md is in sync with exported names
```

## What's playable

A complete vertical-slice run from title screen through the borderlands and back.

- **Title screen** — New Game / Load Game (placeholder) / Quit
- **Overworld** (React) — 5-node map (Pine Crossing, Frontier Camp, North Watch, Smuggler's Cave, Iron Throne) with travel + per-edge encounter rolls. Visited markers; quest indicator on Pine Crossing
- **Combat** (Phaser canvas) — 14×10 grid, 3 party (Roy/Marcus/Lilina) vs 3 Bandits, deterministic card resolution, AP economy, animations (sprite tween, hit-flash, floating damage, camera shake), enemy AI (closest target + attack/move), Victory/Defeat modals, capture event reducer, AP indicator + End Turn button
- **Town** (React) — Pine Crossing with Inn (heal 8g/unit), Shop (regional buy/sell), Tavern (rumors + Blood Ties quest accept)
- **Dungeon** (React) — Slay-the-Spire-style 6+1 row branching map with weighted room typing (Combat/Event/Rest/Elite/Boss), full reveal, validator, deterministic per `(runSeed, dungeonId)`. Combat rooms boot the canvas; rest heals 30%; treasure grants gold; boss exits the dungeon on victory
- **Permadeath** — fallen party members removed from `runStore.party` on victory; subsequent battles seed only with survivors
- **Quest log** — `Q` key overlay listing active quest stages
- **Dev HUD** — bottom-right in dev mode: live errors, domain events, action log

## Architecture invariants

1. Combat = Phaser canvas. Everything else (overworld, town, shop, inventory, dialogue, modals) = React DOM
2. Three Zustand stores: `metaStore` (cross-run unlocks), `runStore` (current run), `combatStore` (current battle, ephemeral). Single `dispatch(action)` chokepoint each
3. Pure systems in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O
4. Combat is a reducer over `CombatEvent` discriminated union → `{ state, effects[] }`. Effects are intents to render, drained by `CombatScene`
5. `CombatScene` owns a mutable `CombatRuntime` POJO; never reads store state per frame
6. `Math.random()` is lint-banned. Use `RNG` parameters via `deriveRng(parent, label)`
7. Cross-system writes typed in `src/contracts/`
8. Predicates are declarative AST nodes that round-trip through save
9. Domain events flow through `eventBus`; subscribers dispatch back to stores. Bus is not a mutation channel
10. Specs in `docs/superpowers/specs/` are append-only post-merge

See `CONTEXT.md` for the canonical reference (always loaded for AI agents).

## Specs

- Foundation v2: `../docs/superpowers/specs/2026-05-08-phaser-foundations-v2-design.md`
- Ship plan: `../docs/superpowers/specs/2026-05-09-ralph-ship-plan-design.md`
- Game design: `../docs/superpowers/specs/2026-03-29-ship-plan-design.md`

## Layout

```
phaser/
├── CONTEXT.md                       # living architectural reference (read first)
├── README.md                        # you are here
├── src/
│   ├── domain/                      # pure types (units, cards, items, statuses, maps, quests, dialogue)
│   ├── contracts/                   # cross-system action/event types
│   ├── data/
│   │   ├── schemas/                 # Zod schemas
│   │   └── content/                 # JSON (classes, items, cards, overworld, etc.)
│   ├── state/                       # Zustand stores + buses + action log
│   ├── systems/                     # pure reducers (combatReducer, deckBuilder, statusEffects, predicates, ...)
│   ├── procgen/                     # dungeonGenerator + future overworld procgen
│   ├── persistence/                 # save/load + replay harness
│   ├── game/                        # Phaser runtime (scenes, CombatRuntime)
│   └── ui/                          # React (screens, modals, overlays)
├── tests/
│   ├── unit/                        # Vitest
│   └── e2e/                         # Playwright
└── scripts/check-context-doc.ts     # CI drift checker
```

## Known deferrals (next milestone)

Tracked in `../RALPH_PROGRESS.md`:

- F-17 grid drag-drop inventory (currently list view in shop)
- F-19/F-20 Blood Ties full quest port + dialogue UI (currently placeholder accept; Q-log shows stage progress)
- F-22 capture UI button (capture *reducer* event implemented; in-combat button not wired yet)
- F-27 recruitment full UX (Tavern stub)
- F-28 comprehensive E2E suite (basic boot smoke + 4 flow tests present)
- F-29 content fill — currently 4 classes (LORD/KNIGHT/MAGE/Bandit), 10 items, 1 town, 1 dungeon. Godot parity is 9 classes / 39 items / 5 towns
- F-30 audio routing
