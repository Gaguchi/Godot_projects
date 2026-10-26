# Embermarch — architecture of the from-scratch build (`game/`)

> Living contract for everyone (human or agent) writing code under `game/`.
> Rules and numbers come from `docs/superpowers/specs/2026-03-29-ship-plan-design.md`
> and the rewrite brief (`docs/rewrite/BRIEF.md`). When this file and the code
> disagree, the code is wrong or this file is stale — fix one in the same commit.

## 0. Why this build exists

The `phaser/` build works but grew two render layers (Phaser canvas + React
DOM) bridged by three Zustand stores, an effect queue, a `CombatRuntime`
sprite cache, Tailwind + react-aria + framer-motion, Storybook, Electron and
a 6-gate CI. Most of its bugs were seams between those layers. This build has
**one render layer, one state, one dispatch.**

## 1. Stack

TypeScript 5 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
· Vite 7 · React 19 (DOM only — no canvas, no Phaser) · Zod (content
validation at boot) · Vitest (engine) · Playwright (screens) · Electron shell
(optional desktop window, `npm run app`). Nothing else. Adding a dependency
needs a sentence in this file saying why.

## 2. The one invariant: `engine/` is a pure function of its inputs

```
GameState × Action ──reducer──▶ GameState × Effect[]
```

- `src/engine/**` imports nothing from React or the DOM (eslint-enforced) and
  never touches `Math.random`, `Date`, `localStorage`, or `fetch`.
- Every change to game state is an `Action` through `dispatch`. There is no
  second door. A saved game is `{ seed, contentVersion, actions[] }` **or**
  a snapshot of `GameState` — both replay to the same state.
- Randomness is `rng.ts` (Mulberry32 + labelled sub-streams) with its
  `RngState` stored *inside* `GameState`. Replaying the action log
  reproduces every roll.
- `Effect`s (`{ kind: 'unitHit', … }`, `{ kind: 'sound', … }`, `{ kind:
  'toast', … }`) are the reducer's *description* of what the UI should
  animate/play. They are never state; the UI consumes and forgets them.
  Every kind in the union has an emit site in `src/engine/**` — a declared
  member with no emitter is a bug the flow tests fail on (CONTRACT §7.8).

Consequences: the whole game is unit-testable headlessly (`scripts/cli.ts`
plays entire runs in the terminal); balance sims are `for` loops; save/load
cannot drift from the live game.

## 3. Layout

```
game/
├── src/
│   ├── engine/              pure rules
│   │   ├── rng.ts           seeded RNG (ported verbatim)
│   │   ├── types.ts         GameState + every domain type; branded ids
│   │   ├── actions.ts       the Action union + Effect union
│   │   ├── reducer.ts       root reducer → run / combat / meta
│   │   ├── content.ts       typed, validated content registry (read-only)
│   │   ├── combat/          turn, ap, cards, targeting, damage, statuses, ai, capture, resolve
│   │   ├── run/             overworld, travel, encounters, town, camp, dungeon, quests, dialogue, loot, economy, party
│   │   ├── procgen/         dungeon graph, floor generation (boardFloor ported)
│   │   ├── save.ts          GameState ⇄ JSON, version + migrations
│   │   └── autotile.ts      47-piece blob autotiler (ported verbatim)
│   ├── content/             JSON + zod schemas (cards, classes, items, regions, maps, towns, dungeons, battlefields, encounters, enemyGroups, quests, dialogue)
│   ├── ui/                  React DOM
│   │   ├── App.tsx          screen router driven by state.screen
│   │   ├── store.ts         useSyncExternalStore over the engine; `dispatch`, `useGame(selector)`
│   │   ├── screens/         Title, Prologue, Overworld, Town, Camp, Dungeon, Combat, BattleEnd, Win, GameOver
│   │   ├── combat/          Board (CSS grid), UnitToken, CardHand, Hud, Forecast, DangerZone, Tutorial
│   │   ├── components/      Button, Switch, Tooltip (the on-glass reason surface), BagGrid, Icon, LedgerPage, RefusalToast
│   │   ├── effects/         effect consumer: CSS animations, sound hooks
│   │   └── audio.ts         Howler-free: `<audio>` pool
│   ├── styles/index.css     Field Ledger tokens + material recipes (ported)
│   └── main.tsx
├── public/                  fonts, art (px tileset, terrain, backdrops), sprites (units + board bakes), audio
├── scripts/cli.ts           headless play / simulate / balance
├── tests/unit/**            engine + content tests (vitest, node env)
├── tests/e2e/**             Playwright: boot, every screen, visual snapshots
└── electron/main.cjs        locked 1280×720 window (ported)
```

## 4. Screen model

`state.screen` is a discriminated union — `title | prologue | overworld |
town | camp | dungeon | combat | battleEnd | win | gameOver` — plus
`state.modal` (`save | load | pause | quit | questLog | loadout | null`).
`App.tsx` is a `switch`. Screens are dumb: they select state and dispatch.

The stage is authored at **1280×720** and uniformly scaled to the window
(`ui/Stage.tsx`), so every layout number in CSS is a stage pixel.

## 5. UI rules (from `.claude/skills/crafting-game-ui`, binding)

- Tokens only. No hex, no ad-hoc durations. `styles/index.css` is the palette.
- Canvas (light) = information you READ; leather (dark) = things you ACT on.
  One brass primary per screen. Nothing glows.
- Every interactive element has idle / hover / press / disabled-with-reason.
  A verb that ARMS a mode rather than firing (Move, Capture) has a fifth state,
  **armed** — `aria-pressed` + `.btn-forged--armed` on the control itself, never
  only a shift in the board's wash (0098).
  A reason is CONTENT: it is spoken on the glass by `components/Tooltip`
  (hover **and** focus) and carried in `data-reason` for the tests. A native
  `title=` on a player-facing element is a test failure — it is invisible,
  late, unthemed, unscaled and unreachable from the keyboard. A refused control
  is `aria-disabled` (still focusable, press swallowed), never `disabled`,
  unless its reason is already permanently printed beside it.
- Nothing player-authored is ellipsised. A name, a place or a line of prose
  either fits, wraps, or is a bug; `text-overflow: ellipsis` on content needs a
  reading of the full string on the glass beside it.
- A pane that hides content below a fold needs a real affordance — a pager, a
  count, or `.scroll-rail`. The platform's overlay scrollbar is zero-width and
  paints nothing until it is dragged, so it is never the cue.
- Escape backs out ONE level, on every screen: it closes what is open (a modal,
  a pinned play, an armed verb) and opens Pause when there is nothing to close.
  One key, one rule — the combat board is not an exception (0104).
- Reduced motion is one switch: `ui/timings.ts` stamps `data-motion="off"` on
  `<html>` for the OS preference AND `?motion=0`, and the stylesheets gate off
  that attribute. A screen must be fully painted the instant it is visible.
- Every state change the player cares about gets ≥2 feedback channels.
- Iron Rule: no screen is done until it is screenshotted at 1280×720 and
  swept against the amateur-signals list.
- Board: CSS grid, `tileSize(w,h)` derives the pitch (5×5 → 84px, 14×10 → 42px);
  units are `<img class="pixel">` from `public/sprites/units/board/`.
- Maps: `.claude/skills/drawing-maps` — plan in ASCII, autotile by code.

### 5.1 Voice — one capitalisation rule per element class

Three self-hosted faces, no fourth: **Cinzel** (`--font-display`) for names,
titles and places; **EB Garamond** (`--font-body`) for prose and control
labels; **Bitter** (`--font-numeric`, `.numeral`) for every changing number,
tabular. `--font-numeric` must never name a generic family — an unembedded
fallback re-cuts every number per machine and reads as console output.

| Element class | Rule | Example |
|---|---|---|
| **Named thing** — screen, document, modal, place, person, item, quest | Title Case, no terminal stop | `Field Report` · `The Iron Throne` · `Riverside Market` · `Contracts` |
| **Moment headline** — the line at the top of an event / camp / node card | sentence case, **no terminal stop** | `An inscription on a fallen pillar` · `One night` |
| **Eyebrow, label, tab, button, chip** | authored in sentence case; CSS uppercases + tracks it | `Paused` → PAUSED |
| **Body prose, blurbs, rumours, narration, empty states** | sentence case, initial capital; a full stop only when it is a full sentence | `A ration feeds the fire either way.` · `No one` |
| **Refusal reason** (`disabledReason`, `refused.reason`) | lowercase fragment, no stop — it completes an implied "because …" | `nobody is wounded — a ration for nothing` |
| **Number** | `.numeral`, tabular; the ordinal or unit rides INSIDE the same span so it is one typographic object | `<b class="numeral">3rd</b> day` |

One name per thing, everywhere: the quest log is **Contracts** on the band, in
the pause card and as the modal title — never three names for one screen. That
binds CONTENT too — a briefing teaches a mechanic by the name the control
carries (Capture, never "Subdue") — and `content/lint.ts#MECHANIC_VOCABULARY`
fails the gate on a synonym or on a system this build does not have (0107).

The question comes before the answer: a `promptName` suspends everything with a
text field, so it rides the CHOICE that answers it, never the `onEnter` of the
node that asks (0106) — the lint refuses the second shape.

No id ever reaches the player. `ui/names.ts` is the display-name layer
(`className`, `placeName`, `questName`); `run/party.ts#displayName` is the
unit one. `id.replace(/_/g, ' ')` in `src/ui/**` is a test failure, as is a
raw range/grid code in copy (`a tile r2`, `sword · 1×2`) — name the shape or
draw it.

## 6. Testing contract

- Engine: every rule in the brief's acceptance list has a vitest case.
  Golden scenarios drive whole battles/runs through the reducer.
- `scripts/cli.ts play --seed N --cmds "…"` must be able to reach every
  screen without a browser.
- Playwright: boot with zero console errors, every screen reachable via
  `?screen=` dev fast-path with seeded state, full-frame snapshots.
- `npm run verify` = typecheck + lint + unit. Green before any commit.

## 7. Lessons designed out (from `phaser/` history)

| Shipped bug | Structural answer here |
|---|---|
| All tests resolved battles in one turn (P0 multi-turn bug) | Golden scenarios run ≥3 full turn cycles; CLI autobattle in CI |
| Shared array mutated across systems | Reducer returns new objects; `readonly` everywhere; `Object.freeze` in dev |
| Invisible containers ate clicks | One DOM layer; overlays are `pointer-events: none` with `auto` children |
| Canvas/DOM geometry drift | One geometry module consumed by the CSS grid — nothing else measures |
| Port 5173 collision | 5184 with `strictPort` |
| Balance "stalemates" were engine bugs | Balance sim asserts first-blood + terminal outcome; a stalemate fails CI |
