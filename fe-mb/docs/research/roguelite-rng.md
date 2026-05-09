# Research #2: Roguelite RNG Strategies

**Status:** Complete (2026-05-09)
**Sources:** see end of file.

---

## Comparison Table

| Game | Seed Model | Sub-stream Strategy | Save-scum Posture |
|---|---|---|---|
| **Hades** | `runSeed` set at run start (visible in F6 panel; can be entered manually). Procgen for room layout, encounter pool, boon offerings, mini-boss assignment, room rewards is replayable from the seed. Internal Lua exposes `RandomFloat` / `RandomChance` / `RandomInt` against a global state used by all of these. | No public docs from Supergiant; from modder reverse-engineering, sub-domains are all advanced off the same global `Random` state — specific draws happen in deterministic order during run setup, so each seed produces a reproducible "shape." | **Permissive but harmless.** No mid-run save-scum to manipulate (you can't quit-reload to change a boon roll inside the same chamber — the offer is locked once generated). Persistent meta-progression (Mirror, Keepsakes) means players don't *want* to scum a single run. |
| **FTL** | Sector tree generated up-front from a per-run seed. Beacon contents, event outcomes, store loadouts predetermined at sector generation. Combat damage, however, is rolled as it happens against the running RNG state. | One stream advanced through generation; events use the seed but combat consumption pushes the stream forward in real time. | **Hostile by design.** Single `continue.sav`, deleted on death, no in-game manual saves. *Quit & continue* keeps the same RNG state — but file-level backup of `continue.sav` is the well-known scum vector. Critically, reloading **does** change in-fight outcomes (enemy hull rolls, hit chances re-roll on each reload) because combat state isn't fully captured. Devs have stated the no-save design is intentional anti-scum. |
| **Slay the Spire** | Single 64-bit `runSeed`. **12 named `Random` instances** are constructed: 7 run-scoped (`monsterRng`, `eventRng`, `merchantRng`, `cardRng`, `treasureRng`, `relicRng`, `potionRng`) + 5 floor-scoped (`monsterHpRng`, `aiRng`, `shuffleRng`, `cardRandomRng`, `miscRng`). | **All 12 instances seeded with the same `runSeed`** (and the floor-scoped ones reseeded from `runSeed + floor` each floor). This is the famous **"correlated randomness" bug**: streams that were *meant* to be independent actually produce identical output when queried the same way, leaking information across domains (e.g. inferring next event from monster type). | **Resists save-scum.** Reloading restores the saved RNG counters — same shop, same card pile shuffle, same monster intent. The intentional anti-scum here is "reloading doesn't change outcomes." Players who want a different result must back up `*.autosave` *before* entering the node. Mod culture (RngFix mod, FilterTheSpire) explicitly tries to fix the correlated-streams *quality* problem, not the determinism guarantee. |
| **FE_MB (current)** | `runSeed` chosen on new game. Sub-streams derived via `deriveRng(parent, label)` where `label ∈ {'world', 'hop:N', 'dungeon:ID', 'battle:INSTANCE', 'loot:INSTANCE'}` — see `phaser/CONTEXT.md` §5. | `child.seed = hashLabel(parent.seed, label)` using FNV-1a 32-bit prime mixed into a `Math.imul`-ed accumulator. Each child is an independent Mulberry32 stream with its own `counter`. | **Resists save-scum by design.** Combat persists `rngState = { seed, counter, label }`, so reloading mid-battle replays the identical sequence (the `e8de989` fix pre-rolls the generator `counter` times at construction so resumption continues the original stream rather than starting a fresh one from a shifted seed). Out-of-combat, hop encounter rolls use `deriveRng(world, 'hop:N')` — entering hop N twice produces the same encounter, so quit-reload doesn't reroll. |

---

## Hash Combiner Recommendation

**Verdict: keep Mulberry32 + FNV-style combiner for v1; track SplitMix32 + xmur3 as a future-work upgrade.**

### Why the current implementation is good enough

- **Mulberry32** is the de-facto small-PRNG choice for JS games. It is fast, allocation-free, and produces statistically reasonable output for combat dice, deck shuffles, encounter weights, and loot rolls — all draws where any modern PRNG (well, anything not LCG) is indistinguishable from "true" random.
- **The FNV-1a-style mix** in `hashLabel` (32-bit prime `0x01000193`, XOR each char, `Math.imul` accumulate) is fine for what we ask of it: turn `(parentSeed, label)` into a child seed that is *unlikely to collide* with any other `(parentSeed', label')` we will use in a single run. We never derive more than a few dozen children per run.

### Known limitations (document, defer fix)

1. **Mulberry32 skips ~⅓ of 32-bit values** ([bryc/code](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)). It is not equidistributed. For a card game with O(10⁴) draws per run this is invisible; for cryptography or large-N statistical work it is disqualifying. We are not those.
2. **FNV-1a is a weak avalanche function for short labels.** Two labels differing in one character (`'hop:9'` vs `'hop:10'`) produce child seeds that share many high bits. Independent enough in practice — but if we ever observe correlated outcomes between adjacent hops, swap the combiner first.

### Recommended future-work upgrade (do NOT do in this commit)

- Replace `mulberry32` with **SplitMix32** (same 32-bit state, similar speed, equidistributed, passes more of TestU01).
- Replace the FNV inner loop in `hashLabel` with **xmur3** (a MurmurHash3 finalizer): better avalanche, same algorithmic shape, ~5 lines of code.
- Both are drop-in: same `RNG` interface, same `RngState { seed, counter, label }` shape, same `deriveRng(parent, label)` contract. Save format does not change.

### Why not match Slay the Spire's "12 instances from the same seed"

Don't. That design **is the bug** the StS community spent years complaining about ([forgottenarbiter](https://forgottenarbiter.github.io/Correlated-Randomness/)). Our `deriveRng(parent, label)` deliberately *hashes* the label into the child seed so two sub-streams started from the same parent diverge immediately. Keep this.

---

## Counter Persistence

**Verdict: keep `RngState { seed; counter; label }`. The counter is mandatory, not optional.**

### Why both fields

We do **not** advance the seed each call. Mulberry32 carries its `s` state internally, but `s` is not exposed and not serialized — only `(seed, counter)` are. To resume from a save, we re-construct the generator from `seed` and pre-roll it `counter` times. This is what the bug fixed in `e8de989` does:

```ts
const gen = mulberry32(state.seed)
for (let i = 0; i < state.counter; i++) gen()
```

Without the pre-roll, resuming a saved combat would call `mulberry32(state.seed)` and return the *first* output of the original stream — collapsing the entire post-load sequence onto the pre-load one. Damage rolls would change. Card shuffles would change. Replay determinism would silently fail in a way that only manifests on reload.

### Why we don't store the internal `s` directly

- It would tie the save format to the choice of PRNG. Switching to SplitMix32 later would require a save migration.
- `(seed, counter)` is the *abstract* state — it's the same regardless of which generator is plugged underneath. The counter is bounded (we draw ≪ 2³² times per run), so re-rolling at load is O(milliseconds) and run *once* per resume.

### Why `label` lives in state

Debug only. When dumping state to console, `label = 'battle:enc_42'` is far easier to trace than a raw integer. Not used for any logic; safe to ignore at load if missing.

---

## Save-scum Prevention

FE_MB is a **permadeath roguelite** — the design intent is to resist save-scum, matching FTL and Slay the Spire's stance.

### What we resist (deliberately)

- **Mid-combat reload to reroll damage.** Combat persists `rngState`. Resume restores the same `(seed, counter)`. Same card draws, same enemy AI choices, same status tick order. The *only* way to alter outcomes is to alter player input — which is the whole point of a tactical game.
- **Mid-travel reload to reroll an encounter.** Hop N's encounter is `deriveRng(world, 'hop:N').next()`. The seed is fixed at run start; entering hop N a second time *after a reload* produces the same encounter. Players cannot scout-by-reload.
- **Re-entering a battle via reload to reshuffle decks.** Battle setup uses `deriveRng(world, 'battle:INSTANCE').next()` to seed shuffles. Same instance ID → same shuffle.

### What we permit (deliberately)

- **Alternate decisions inside a determined frame.** Inside one combat, the player chooses *which* card to play, *which* enemy to target. The RNG determines the dice — the choices are theirs. This is the StS contract: same seed, same opportunities, different play = different outcome.
- **New game with same seed for daily/seeded runs.** Future work; the architecture supports it trivially (runSeed is a single value to persist).

### Where the design is permissive (call-out for review)

- **No tamper-proofing.** A motivated player editing the save JSON can change `runSeed` or rewind `counter`. We accept this — same as StS, same as FTL with file backups. Anti-tamper is not in scope for a single-player game.
- **Out-of-combat dialogue choices** (e.g. event outcomes) are currently rolled at the moment of choice using the parent stream. If a player quits during a dialogue and reloads, the same draw repeats — good. But if a feature later rerolls dialogue *after* a stat check fails, that reroll must use a fresh `deriveRng(parent, 'dialogue:NODE_ID:retry')` to avoid double-consuming the parent counter. Watch for this when adding reroll mechanics.

---

## Sources

- **Slay the Spire RNG architecture:** [Correlated Randomness in Slay the Spire — forgottenarbiter](https://forgottenarbiter.github.io/Correlated-Randomness/) — exhaustive list of the 12 named `Random` instances and the same-seed bug.
- **Slay the Spire seed determinism:** [An extremely unwinnable Slay the Spire seed — oohbleh](https://oohbleh.github.io/losing-seed/) — confirms shuffle RNG is `(seed, floor)`-determined and reload preserves outcomes.
- **JS PRNG quality survey:** [bryc/code: jshash/PRNGs.md](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) — Mulberry32 skips ⅓ of 32-bit values; SplitMix32 / sfc32 / jsf32b score better; xmur3 recommended over FNV for seeding.
- **Mulberry32 origin:** [tommyettinger Mulberry32 gist](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c).
- **FTL RNG and save-scum:** [FTL Wiki: RNG](https://ftl.fandom.com/wiki/RNG); [Subset Games forum: Observations and facts about basic game mechanics](https://subsetgames.com/forum/viewtopic.php?t=2251); [Steam: Is there some sort of anti-save scumming thing implemented?](https://steamcommunity.com/app/212680/discussions/0/558754899892344499/) — confirms sector contents predetermined at generation; reloading mid-fight *does* re-roll combat (a known oversight, not a feature).
- **Hades RNG (community-level only — Supergiant has not published internals):** [Hades modding sources via HadesRando repo](https://github.com/Dannyj1/HadesRando); seed is exposed in the in-game telemetry panel for run-sharing.
