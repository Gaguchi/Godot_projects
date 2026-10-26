# Embermarch (`game/`)

The from-scratch build. Read `ARCHITECTURE.md` first; rules and numbers are
in `../docs/rewrite/BRIEF.md`, decisions in `../docs/rewrite/DECISIONS.md`,
the engine contract in `../docs/rewrite/CONTRACT.md`.

```bash
npm install
npm run dev            # http://localhost:5184 (pinned; 5173/5183 belong to other things)
npm run app            # Electron window on the DEV server, locked 1280x720
npm run app:prod       # build, then open THAT BUILD in the same window
npm run verify         # typecheck + lint + unit tests — green before any commit
npm run test:e2e       # Playwright (boots its own dev server)
npm run lint:content   # cross-reference lint over every content id and flag
npm run cli -- play --seed 7          # headless: play a run in the terminal
npm run cli -- sim --runs 50          # headless: balance simulation
```

Dev fast-paths (dev builds only): `/?screen=<kind>&seed=<n>&motion=0` with
`kind` one of `title prologue overworld town camp dungeon combat battleEnd win
gameOver` seeds a representative run and jumps straight to that screen
(`motion=0` collapses hop/enemy pacing so screenshots never race);
`window.__game` exposes `getState`/`dispatch`/`env` for Playwright.

**Opening a build.** `dist/index.html` cannot be opened by double-clicking it: the
page loads its bundle as an ES module (blocked from an opaque `file://` origin) and
asks for sprites, art and fonts by root-absolute path (`/sprites/...`), which under
`file://` resolve to the drive root. Serve it instead:

```bash
npm run app:prod       # build + desktop window; the shell serves dist on a loopback port
npm run preview        # serves an existing build at http://localhost:4173
```

Gates: `npm run verify` (typecheck + lint + 856 unit tests), `npm run test:e2e`
(smoke, combat-input, journey, loadout, pause), `npm run cli -- lint`
(content cross-references, warning-free), `npm run cli -- balance` (win-rate
bands green; the 4–10 rounds band is an open balance question — see
`docs/rewrite/CONTRACT-CHANGES.md` 0027).
