# FE_MB Overworld Grounding — Design Spec

**Date:** 2026-06-06
**Author:** Claude Opus 4.8 (1M context) + 10-agent research workflow
**Research input:** `docs/research/2026-06-06-overworld-grounding-research.md` (full rationale + sources)
**Composes with (does NOT supersede):** `2026-05-22-overworld-redesign-design.md` (systems: archetypes / currencies / conviction) and its plan `2026-05-22-overworld-v2-spine.md`. That work is *systems-only* and explicitly defers all render/art layers ("No new render layers; piggybacks on the existing OverworldScene"). **This spec is the visual-grounding layer that one deferred.** The two are orthogonal: this spec renders nodes *by `type`* and never changes graph topology, encounter rolls, currencies, or conviction.
**Status:** Approved direction (user picked **Diorama + safety net** and **full-width journey** on 2026-06-06). Spec for implementation.

## Problem statement

The overworld "floats in space." Root cause (research §1): the backdrop is generated from noise (`PaperMap`/`TerrainCanvas` biome grids) that bears **no relationship to where the 15 nodes and their roads actually are**, so nodes look pasted onto random terrain. Compounding: two procedural art languages fight on one surface (sepia parchment vs atmospheric void), nodes have no contact shadow, roads are flat wireframe strokes (the `ROAD` table's `shadowW` is `0` everywhere), and there is no value staging, projection match, or focal hierarchy. Today the 15 nodes also occupy only the **left ~31%** of the 2120-wide strip, so the signature left→right pan barely happens.

## Decisions locked

1. **Art direction = "Hearth-Lit Diorama"** — a painterly ¾-oblique terrain band you march across (Banner Saga / Darkest Dungeon bar), **with a fail-fast fallback ladder** gated on one proof bake (see Fallback ladder). Adopt FTL's *discipline* (dark staged field, state-carried hierarchy, glow-as-scalpel) and layer the painterly ground only as far as the 6 GB GPU proves out.
2. **Full-width journey** — respread the 15 Borderlands nodes to span x≈100→2000 (linear x-stretch preserving topology; node IDs, edges, types unchanged) so the camera truly pans.
3. **Terrain-only backdrop; SVG owns everything interactive.** The PNG is a value-staged painterly ground with quiet *reserved clearings*. Roads, node sockets, contact shadows, beacons, and the value mask are drawn at runtime — **never baked** — so node edits stay a JSON change, never an art re-bake.
4. **Value structure is composited in code, not prompted.** A node-derived value mask (multiply-darken vignette + per-node radial lifts) guarantees the 3-value depth plan deterministically; the greyscale legibility gate tests the *composited* result.
5. **Scope = visual only.** No changes to currencies/archetypes/conviction/encounter systems. Compatible with the v2-spine plan; either can land first.

## Goals

1. Kill the "floating / pasted-on" read: every node sits *in* the ground with a contact shadow; roads read as carved paths; one coherent light direction across art + UI.
2. Make the journey *felt*: the party token + caravan walk the actual road spline with a continuous following camera and parallax depth.
3. Terrain derives from the node graph (clearings reserved where nodes sit) — fixing root cause #1 by construction.
4. A grounded map ships **even if zero new art is generated** (Phase 1 alone targets ~70%); the painterly backdrop is upside gated on feasibility.
5. Stylistic cohesion across all 3 regions; GPU-feasible on a 6 GB GTX 1660.

## Non-goals

- Baking roads/sockets/nodes into the backdrop image (registration drift + hard-couples art to coordinates).
- A 3–4-PNG parallax stack (compositor jank on a CSS-scaled stage). Hero PNG + ≤2 thin bands only.
- Procedural autotiling / scattered-prop terrain (`TerrainCanvas` path) — retired for the overworld backdrop.
- Stacking ComfyUI subsystems (multi-ControlNet + IPAdapter + upscale co-resident) — OOMs the 1660.
- Any systems/gameplay change (currencies, archetypes, conviction, encounter rates).
- Real-time campaign map (M&B / Pirates) — out of scope, per user.

## Fallback ladder (the safety net)

All three directions share the **same SVG-owned grounding layer** (roads, beacons, sockets, contact shadows, value mask, caravan, camera, fog). Only the *backdrop* differs. The ladder is resolved by the **Phase 2 proof bake** (one Borderlands backdrop):

- **Diorama (target):** the proof bake renders an acceptable painterly ¾-oblique vista AND the depth map reliably reserves flat node clearings → proceed to full diorama rollout.
- **↓ Lit Tabletop (step-down):** if the oblique vista fights `waiIllustrious_v160` (anime character checkpoint) → flatten to a near-top-down lit plane (simpler prompt, no projection-match risk). Same grounding layer, flatter bake.
- **↓ Polished Parchment (hard fallback):** if depth-controlled clearings don't reserve at all → keep `PaperMap` as the sole language, commit to it fully (bespoke per-region vellum, ink terrain tuned around nodes, double-line roads, leather frame). Mostly already built; minimal ComfyUI.

The gate is judged on the **actual generated image** (the agent reads the PNG and scores painterly-quality / low-left key light / reserved clearings). No further backdrop build happens until the gate passes.

## Architecture

### Layer stack (bottom → top), all inside the existing pan container unless noted

| Layer | Content | Pan ×mult | Tech |
|---|---|---|---|
| Sky band (thin) | far haze, top ~25% | 0.15 | one `<div>` `translate3d`, CSS gradient or thin PNG |
| Massif band (thin) | one cool desaturated horizon strip | 0.35 | one thin `<img>` `translate3d` |
| **Backdrop hero** (terrain only) | painterly ground PNG | **1.0** | single `<img decoding="async" fetchpriority="high">` |
| **Value mask** (node-derived) | multiply-darken vignette + per-node radial lifts | 1.0 | Canvas, composited from node positions |
| Ground-haze seam | warm valley mist at fore/mid seam | 1.0 | CSS gradient div |
| Roads — static casing `<g>` | ditch/bank/body/centerline, filtered ONCE | 1.0 | SVG, static |
| Roads — dynamic state `<g>` | dash/comet/glow, unfiltered | 1.0 | SVG, animated |
| Nodes + contact shadow + state glow | 15 markers | 1.0 | SVG/DOM `Pressable` |
| Fog / reveal | explored mask | 1.0 | Canvas, event-driven |
| Caravan token + 2 follower silhouettes | walks the road | 1.0 | DOM/SVG, rAF |
| Vignette / framing | asymmetric bottom/left-keyed | screen-fixed | CSS overlay |
| HUD | `GameHud`, route planner | screen-fixed | DOM (unchanged) |

Parallax bands are sibling divs reading the same `camera` state × multiplier. Round `camera.x` to integers; `translate3d`; decode only the current region's hero PNG (drop others; pre-decode next region before a transition).

### Node-derived value mask (`src/ui/screens/overworld/valueMask.ts` + Canvas layer)
Pure function `buildValueMask(nodes, width, height) → draw ops`: a global multiply-darkening vignette (asymmetric, low-left key) plus a soft additive radial *lift* at each node center. Composited on a Canvas sized to map dims. This is what *guarantees* figure/ground separation and the 3-value plan, independent of what the model painted. **Acceptance gate:** desaturate the composited map to greyscale — nodes must be instantly distinguishable from terrain; if not, tune the mask (not the prompt).

### Road rendering (SVG hybrid — replaces `OverworldScene` road `<svg>`)
Keep `edgePath()` (seeded quadratic Bézier). Split into two `<g>`:
- **Static casing (filtered once):** stacked strokes bottom→top — ditch shadow (`w+5`, `rgba(0,0,0,0.35)`, +1.5px down), far-bank highlight (`w+3`, warm, −1px up), dirt body (`w`), worn centerline (`w*0.4`). One static `feTurbulence`→`feDisplacementMap` worn-edge filter (expand filter region `x=-20% width=140%`). **Restore `shadowW` in the `ROAD` table.** Remove the `#ecdfbe` parchment halo when parchment is retired.
- **Dynamic state (unfiltered, animated):** one stroke/edge — planned = dotted amber, traveled = solid amber, active hop = comet (`stroke-dashoffset` animation over `path.getTotalLength()`), distant = faint. Never animate the filter.
- Only traversable edges get lit treatment; the backdrop never paints a connectivity-implying path.

### Node beacons (`NodeMapSymbol` kept; node wrapper restructured)
3-element grounding stack per node: (1) **ground-contact ellipse** (CSS `radial-gradient` ~34×12px, offset below center, `blur(1.5px)`); (2) disc body; (3) **state glow via `filter: drop-shadow()`** (heavy `feGaussianBlur` bloom reserved for the single boss). Three orthogonal axes so states never collide: **type** = silhouette + hue swatch (redundant shape+icon+color for colorblind safety); **state ring** = current/hover/planned/reachable/distant; **progress** = unvisited (full ink) → visited (desaturated + ✓) → **failed** (cold grey + ✕, new). Idle = expanding **ping ring** (`scale 1→2.1`, `opacity .45→0`), per-node hash stagger — **not** `scale(1.15)` (that re-introduces float). Node count pinned at 15.

### Caravan / you-are-here token (replaces `#player-marker`)
A distinct vertical object (planted banner/pennant) with its own contact ellipse. **Walks the actual road spline** — sample the Bézier into a polyline **once per hop** (not per-frame `getPointAtLength`), interpolate along arc-length, derive facing from tangent, ±1.5px gait bob, 2–3 trailing follower silhouettes at small length offsets.

### Camera + parallax
Continuous rAF follow during the hop (no CSS transition; token kept ~45% up, leading slightly in travel direction), settling on arrival. Replaces the snap-on-arrival `useEffect`. Optional rest-state mouse parallax (±4–8px on bands).

### Fog / reveal (`src/ui/screens/overworld/FogLayer.tsx`, Canvas)
Canvas inside the pan layer at map dims: fill warm-dark `rgba(10,8,6,0.82)`, `globalCompositeOperation='destination-out'` soft radial brushes at revealed nodes; redraw only on reveal events; tween reveal radius 0→R (~700ms) on arrival at a frontier node + one-shot ping. Region-tinted. **Release canvas/context on region switch** (leak guard).

### Stage-0 depth-map tooling (`scripts/cli/overworld-depth.ts`, no GPU)
Rasterize a depth PNG from `borderlands.json`: road corridor + node clearings drawn as flat mid-gray **plateaus** (reserving quiet ground exactly where the graph needs it); gradient elsewhere implying the receding ground plane. **Authored directly** (do not auto-estimate depth from flat renders). Output → `scripts/cli/comfy/depth/<region>.png`. This is the long pole and what makes terrain derive from the node graph.

### ComfyUI `backdrop` kind (`scripts/cli/comfy-gen.ts` + new workflow graph)
- New `backdrop` kind with its **own preamble** — drop `DFSV1` / `pixel art` / `top-down`; add painterly / ¾-oblique / atmospheric-perspective terms.
- Own **negative** — keep landscape features (trees/hills/mist), ban `character, person, text, UI, frame, road, path, trail, focal single object, map, minimap, vignette, centered composition`.
- Latent ~1024×336 (≈3:1), not 1024×1024.
- New workflow graph from scratch: `LoadImage(depth)` → depth **Control-LoRA** (one ControlNet only) → KSampler (fp32, dpmpp_2m/euler, 28–32 steps, CFG 6–7) → Tiled VAE decode → **`freeVram()`** → **UltimateSDUpscale** (separate stage, ESRGAN 4x, 512 tiles/32 pad, denoise 0.18) → Save. Poll ceiling ~20 min.
- **GPU rules:** `--force-fp32 --lowvram --disable-smart-memory`, `freeVram()` between every stage, never co-resident subsystems.
- **Cross-region cohesion:** same checkpoint+negative+sampler/CFG (dominant), same prompt skeleton (swap biome/palette/light only), IPAdapter style-transfer from Borderlands as its *own* pass for regions 2–3.
- **Light by selection, not prompt:** generate several, agent reads each PNG and keeps only low-left-lit bakes; then set a single `--key-light-angle` CSS var that all UI shadow offsets derive from.

## Phasing & acceptance gates

- **Phase 0 — DONE** (decisions locked: Diorama + full-width).
- **Phase 1 — zero-art grounding** (no ComfyUI). Respread nodes full-width; contact shadows + ping ring; road casing/state hybrid + restore `shadowW`; token walks spline + caravan + continuous camera; asymmetric vignette + ground-haze + `--key-light-angle`; state glows + `failed` state + colorblind-safe encoding; retire the competing `PaperMap`/`TerrainCanvas` conflict (pick the staged dark field as the interim backdrop). **Gate:** Playwright before/after screenshots show nodes grounded (contact shadows), roads carved, caravan walking; `npm run verify` green; greyscale legibility holds on the interim backdrop.
- **Phase 2 — gated diorama proof slice** (ComfyUI). Build `overworld-depth.ts`; wire the `backdrop` kind + workflow graph; bake ONE Borderlands backdrop (generate several, agent-judge for painterly quality + low-left light + reserved clearings). **Gate = the fallback ladder.** Resolve Diorama / Tabletop / Parchment from the actual image.
- **Phase 3 — rollout** (only after the slice proves out). Hero backdrop `<img>` + ≤2 parallax bands (perf-verified); node-derived value mask Canvas (+ greyscale gate on composited result); fog-of-war Canvas; bake Thornwood + Ashfall (IPAdapter cohesion pass). **Gate:** all 3 regions cohesive; perf smooth at 1280×720; adversarial re-review passes.

## Testing strategy

- **Pure-fn unit tests (Vitest):** `valueMask` ops are deterministic from node positions; spline-polyline sampler returns arc-length-correct points; depth-map rasterizer plateau placement matches node coords; full-width respread preserves topology (every original edge still connects the same IDs).
- **Component tests:** node renders contact ellipse + correct state class per (type, visited, failed, current); road `<g>` emits casing + state strokes; `failed` state badge.
- **E2E (Playwright):** boot → overworld renders without console errors; travel a multi-hop route → token walks the curved road (not corner-cut) and camera follows; arrive at frontier → fog reveal fires; before/after masked screenshots. Reuse `tests/e2e/visual.spec.ts` patterns.
- **Perf check:** pan a full-width region on a throttled profile; assert no long-frame spikes on region switch (pre-decode works).
- **Adversarial gate (Phase 2/3):** agent reads generated backdrops + composited map screenshots and scores against the failure-mode rules (muddy values, light mismatch, pasted-on nodes, AI-slop tiling). Re-bake/tune until it passes; a second adversarial agent re-checks.

## Promise tag

`<promise>OVERWORLD-GROUNDED</promise>` — emit when Phase 1 is green on all gates AND the Phase 2 ladder is resolved with a manual before/after confirming the map no longer "floats."

## Self-review notes
- **Placeholder scan:** no TBDs. Tuning values (mask opacity, vignette falloff, road casing widths, CFG/steps) are flagged as playtest/bake-time tunables, not blockers.
- **Internal consistency:** layer stack, value-mask, road hybrid, beacon/caravan, and ComfyUI plan all cross-reference the research §3/§4. Fallback ladder ties Phase 2 gate to the three directions.
- **Scope check:** large but cleanly phased; Phase 1 is independently shippable and direction-agnostic; Phase 2 is one gated slice; Phase 3 is rollout. Good fit for one implementation plan.
- **Ambiguity check:** "terrain-only backdrop, SVG owns interactive" is the load-bearing rule — stated explicitly so a later contributor can't re-bake roads/nodes into the PNG.
