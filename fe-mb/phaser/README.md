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
npm test                  # Vitest unit tests (555 in 90 files)
npm run test:e2e          # Playwright (23 tests, incl. a full-run journey)
npm run verify            # the green gate: typecheck + typecheck:cli + lint:content
                          #   + check-context-doc + unit tests
npm run typecheck
npm run build
npm run check-context-doc # assert CONTEXT.md is in sync with exported names
                          # (there is no CI pipeline — run `verify` yourself)
```

## What's playable

A complete run: title → tutorial → three regions → the Iron Throne boss → win or
game-over screen. Tagged `beta-0.1` (2026-07-06).

- **Title screen** — New Game / Load Game (3 localStorage slots, working) / Quit
- **Overworld** (React) — Oregon-Trail split view: a side-view travel band over a
  parchment map. 46 hand-authored nodes across three regions (borderlands →
  thornwood → ashfall). Click any node to travel; the party auto-paths, burning
  one ration and one day per hop and rolling for an encounter on each
- **Combat** (Phaser canvas + React HUD) — 14×10 grid, initiative by SPD, a free
  move plus 3 AP of cards per turn, hand of 5 that cycles Slay-the-Spire style.
  **Your gear IS your deck.** Deterministic damage, armour, poison/burn/slow/
  immobilize/empower, taunt, riposte, AoE, and capture (the one RNG roll in
  combat). 9 enemy groups with role-based AI (rusher/archer/healer/tank)
- **Town** (React) — 5 towns with Inn (heal, 8g/unit), Shop (stock by region and
  rarity), Tavern (rumours, quests, recruits)
- **Dungeon** (React) — Slay-the-Spire-style 6+1 row branching map with weighted room typing (Combat/Event/Rest/Elite/Boss), full reveal, validator, deterministic per `(runSeed, dungeonId)`. Combat rooms boot the canvas; rest heals 30%; treasure grants gold; boss exits the dungeon on victory
- **Permadeath** — fallen party members removed from `runStore.party` on victory; subsequent battles seed only with survivors
- **Quest log** — `Q` key overlay listing active quest stages
- **Loadout** — `I` opens per-unit hand slots over a shared 8×4 grid bag; 49
  items / 161 cards; two-handed weapons lock the off-hand
- **Audio** — WebAudio synth engine: ambient beds + SFX, no asset files
- **Dev HUD** — backtick in dev mode: live errors, plus the domain-event and
  action-log panels (both empty — nothing emits on the bus yet, see CONTEXT §1)

## Architecture invariants

1. Combat = Phaser canvas. Everything else (overworld, town, shop, inventory, dialogue, modals) = React DOM
2. Three Zustand stores: `metaStore` (cross-run unlocks), `runStore` (current run), `combatStore` (current battle, ephemeral). Single `dispatch(action)` chokepoint each
3. Pure systems in `src/systems/` and `src/procgen/` — no Phaser, no React, no I/O
4. Combat is a reducer over `CombatEvent` discriminated union → `{ state, effects[] }`. Effects are intents to render, drained by `CombatScene`
5. `CombatScene` owns a mutable `CombatRuntime` POJO; never reads store state per frame
6. `Math.random()` is lint-banned. Use `RNG` parameters via `deriveRng(parent, label)`
7. Cross-system writes typed in `src/contracts/`
8. Predicates are declarative AST nodes that round-trip through save
9. Domain events are meant to flow through `eventBus`; subscribers dispatch back to stores, and the bus is never a mutation channel. NOT YET WIRED — see CONTEXT.md §1
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

## Known gaps

The old F-xx list in `../RALPH_PROGRESS.md` is historical (last touched
2026-05-10) — all of it shipped. Tracked in Atlas (project FEMB) instead:

- **Balance is unfinished.** Simulated win-rates sit far below target under the
  floor-level auto-battle AI. See `../docs/research/balance-baseline-2026-07-06.md`.
  Treat sim numbers as a FLOOR — a human plays well above them.
- **The domain event bus is never emitted on**, so quest listeners never fire and
  `LocationArrived` never dispatches; quests advance only through dialogue and
  check-event effects. The `spawnNode` / `unlockNode` / `recruitUnit` quest
  effects are no-op stubs, and encounter `captureTargets` is read by nothing.
- **Hop RNG never advances**, so a given road re-rolls the same encounter for
  the whole run.
- **Load does not restore** metaStore, the combat snapshot, the active dungeon,
  or a pending travel path.
- **No UI sound layer** — audio covers combat and ambience only.
- **No CI pipeline.** `npm run verify` is a local gate; `npm run lint` is red
  with pre-existing react-hooks debt and is not part of `verify` yet.
- **Direction is in flux.** `../docs/worldbuilding/story-bible.md` sets a
  Mount & Blade free-company premise that disagrees with the shipped directed
  map, the candle-lit palette, and the placeholder cast names.
