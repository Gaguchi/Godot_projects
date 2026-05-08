# Research #2: Roguelite RNG Strategies

**Status:** `[STUB — to be filled before RNG hierarchy is finalized]`
**Deliverable target:** 1 page comparing roguelite RNG patterns; recommended derivation tree for FE_MB.
**Blocks:** RNG hierarchy validation (informs `phaser/CONTEXT.md` §5 and `domain/rng.ts` design).

---

## Required Outputs

When this stub is filled, it must answer:

1. **Hades' RNG model** — runSeed + per-domain sub-streams? Documented at GDC 2020 / Supergiant blog posts. Capture the derivation pattern.
2. **FTL's RNG model** — per-event seeds? Reddit dev posts. How is save-scumming prevented?
3. **Slay the Spire's RNG** — single counter? Per-card-pile shuffle seed? Reddit dev posts on the "rerolling" discourse.
4. **Hashing function for `deriveRng(parent, label)`** — recommended approach (Mulberry32, SplitMix64, FNV-1a, hash combiner over concat). Tradeoff: speed vs distribution quality.
5. **Counter persistence** — does `RngState` need both `seed` AND `counter`, or is `seed` advanced after each roll? Best practice for replay determinism.
6. **Save-scum prevention** — does our RNG strategy resist save-load-retry? Do we want it to? (Permadeath roguelites usually resist.)

## FE_MB-Specific Decisions

- `runSeed` chosen on new game.
- Sub-streams: `world`, `hop:N`, `dungeon:DUNGEON_ID`, `battle:BATTLE_INSTANCE`, `loot:BATTLE_INSTANCE`.
- `deriveRng` deterministic per `(parent.state.seed, label)`.
- Combat persists `rngState` so reload mid-battle replays identically.

## Sources to Consult

- Hades: GDC 2020 talk by Greg Kasavin or Amir Rao on systems design
- FTL: Subset Games dev blog, Reddit r/ftlgame post-mortem threads
- Slay the Spire: Mega Crit's Q&A on Reddit, Steam discussions on RNG
- General: <https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript> — JS PRNG choices
- Mulberry32 reference implementation (small, fast, well-distributed for game use)

## How To Fill This

Spawn a subagent. Brief: "Compare 3 roguelite RNG patterns. Recommend derivation function and counter strategy for FE_MB given the sub-stream tree above. 1 page output."
