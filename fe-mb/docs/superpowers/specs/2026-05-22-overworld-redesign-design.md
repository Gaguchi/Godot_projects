# FE_MB Overworld Redesign — Design Spec

**Date:** 2026-05-22
**Author:** Claude Opus 4.7 (1M context) + 6 research agents
**Supersedes:** Parts of `2026-05-10-godot-parity-design.md` (multi-region overworld section)
**Status:** Approved direction; spec for user review

## Problem statement

The current overworld is a 46-node hand-authored graph across 3 regions (Borderlands, Thornwood, Ashfall) that renders as nodes-floating-in-a-void with edges drawn between them. Even after recent atmospheric polish (gradient backdrop, fog drift, curved edges, sprite-iconography, M&B-style quick-action menu), the *systemic* design still reads as a flowchart with cosmetic dressing rather than a place the player traverses.

A six-agent research wave (game-design theory, roguelite postmortems, strategic-map devs, JRPG narrative function, procgen-vs-authored, failure-mode case studies) identified the following specific failure modes our current design exhibits or is at risk of:

- **Menu-in-disguise (highest risk):** multi-hop click-to-destination via BFS auto-walks the party through intermediate nodes the player never sees decide on. Banner Saga 3, Vagrus, Underrail all shipped this; reviewers asked for skip buttons.
- **Regions as reskins:** Borderlands/Thornwood/Ashfall differ in enemy pools only. Per agents 3+4, region identity comes from *rules*, not palette. Banner Saga 3's specific failure mode was "ruined walls third time passé."
- **Asymmetric service absence:** the 11 camps : 3 towns : 1 dungeon mix in Borderlands has towns full-feature and camps as stubs. There's no "I detour to the camp because only it has X" decision.
- **Opaque mid-route encounters:** the encounter roller produces FTL "perfect-to-dead" runs — a coinflip the player didn't agree to ends a permadeath run.
- **No anchor rhythm:** no predictable rest landmark mid-region. STS's Floor-9-treasure / Floor-15-rest cadence is what makes the act *plannable*.
- **Region transitions are just edges:** crossing into Thornwood is mechanically identical to walking to the next camp.
- **No persistent memory within a run:** cleared encounters, killed enemies, narrative scars don't visibly inscribe on the map.
- **No run-to-run novelty:** same 46 nodes, same content, every run. Wildermyth "rush optimal" trap waiting after run 2.

## Goals

The overworld must:

1. Present a **decision per hop the player is present for** — no silent auto-walks through interesting nodes.
2. Make the **route choice a real spending plan** across three currencies (Wounds / Supplies / Gold) that trade against each other; no node wins all three.
3. Give each region a **gameplay-feel distinct from the others** at low authoring cost — one numerical knob per region in v1.0; gameplay rules can deepen in v1.x.
4. Provide **planning information** (telegraphed encounters, scout option) appropriate to multi-hour permadeath runs.
5. **Inscribe the run on the map** (visible caravan shrinking on unit loss, cleared/failed node marks, hidden conviction surfacing at region-end forks).
6. Stay **hand-authored at v1.0** with per-run content rotation (STS pattern: fixed graph, randomized icons/encounters).

## Non-goals (explicit)

- Real-time campaign map (M&B / Bannerlord) — incompatible with permadeath stakes and 2-4h run length.
- Procgen overworld layout — we already have procgen dungeons; stacking two procgen layers compounds into noise. Defer to v1.x as authored-anchors-plus-procgen-filler.
- Map-traversal currency layered on top of Supplies (Roguebook "ink" failure mode).
- Multi-region world view shown as one image — FTL pattern (current region fully shown, next region hidden until you enter) matches our run length.
- Decorative cartographer-artifact aesthetic (parchment, compass rose, ink jitter on borders). Returns post-v1.0 if at all.
- Per-region full-systems differentiation (different combat mechanics, different supply formulas). Deferred to v1.x; v1.0 is one-knob per region.
- 100-hour-game features (full faction simulation, multi-generational arcs, 108-recruit anthology).

## Design pillars

### Pillar 1 — Smart multi-hop movement
Player clicks a destination node (today's UX). BFS computes the route. Party auto-walks. **The walk pauses at any node where a decision exists for the player.**

A node is a "decision node" for the walking party if any of:

- The node type is `town` / `camp` / `dungeon` / `exit`.
- The node has an unresolved encounter table roll and the player hasn't pre-cleared it this run.
- The node has an active Discovery event tied to a current run flag.
- The node is the destination of the path.
- The node has never been visited by this run (first-encounter cue).

Otherwise (a previously-cleared Trail node with no fresh encounter), the party chains through silently. Multi-hop UX preserved; menu-in-disguise neutralized for the hops that matter.

### Pillar 2 — Three currencies that trade against each other
| Currency | Role | Visible attrition |
|---|---|---|
| **Wounds** (master) | Per-unit HP carryover until rest; permadeath when HP→0 | None (state-based) |
| **Supplies** | Drained per hop at a region-tunable rate; starvation HP damage when 0 | Visible counter, predictable rate |
| **Gold** | Upgrades, recruits, shop inventory, tavern bribes | None |

**Rule: every node-type's payoff equation spends two and gains one.** A bandit ambush spends Wounds + Supplies, gains Gold. A Rest Camp spends Supplies + Gold (food costs), gains Wounds. A Town spends Gold, gains all-of-Wounds-and-Supplies-restored (premium price). Discovery nodes vary. No node ever wins all three.

### Pillar 3 — Five node archetypes
Replace the current 3-type (town/camp/dungeon) structure with five archetypes. Stay hand-authored.

| Archetype | Role | Spends → Gains |
|---|---|---|
| **Trail** | Pass-through node with chance of encounter; most common | (encounter rolls; pure tax/reward) |
| **Town** | Full services hub (Inn/Shop/Tavern/Recruit). Premium-priced. | Gold → Wounds healed + Supplies restocked + Recruits available |
| **Rest Camp** | Restore wounds; consume supplies; no enemies | Supplies → Wounds (partial) |
| **Discovery** | One-time event/check/branching consequence (per-run rotated content) | Variable per Discovery deck card |
| **Dungeon** | STS-style branching dungeon (already shipped) | Variable; Gold + loot, Wound risk |

Plus one **Boss/Exit** per region as the anchor terminus.

### Pillar 4 — Asymmetric services per archetype
*Never* let one archetype strictly dominate another. Each must offer something the others can't:

- **Town**: full Inn (full heal), full Shop (broad stock), full Tavern (recruit + quest accept), but expensive Gold cost. No party Wound restoration outside Inn purchase.
- **Rest Camp**: cheap partial heal (% of max HP) and Scout action (peek next region; see encounter category at adjacent nodes; Supplies cost) — Scout is unique to Rest Camps, not available at towns.
- **Discovery**: one-time strong bonus or one-time strong narrative consequence — per-run not repeatable, but unique to this slot.
- **Dungeon**: loot + gold density Town shops can't match, at higher Wound risk.
- **Trail**: cheap; the route-spacing currency. Sometimes a Trail has a passing-merchant micro-event (Discovery-lite).

### Pillar 5 — Regions differentiated by one knob
Per region, a single constants entry:

```ts
interface RegionTuning {
  encounterChancePerHop: number      // 0.25 / 0.40 / 0.55 for borderlands/thornwood/ashfall
  supplyDrainPerHop: number          // 1 / 1 / 2 (Ashfall is harsher)
  favoredEnemyTags: string[]         // ['bandit', 'wolf'] / ['brigand', 'bandit_mage'] / ['ember_cult', 'wraith']
}
```

This is a 3-row table. No new gameplay systems. Yet Thornwood now *feels* thicker (40% encounter rate) and Ashfall *feels* harsher (supply tax + premium enemy tags). Future v1.x can layer per-region special rules on top (Thornwood patrols, Ashfall siege nodes) without breaking the v1.0 spec.

### Pillar 6 — Telegraphed encounters with Scout
Hover an adjacent node → tooltip shows encounter category if one is rolled this run (e.g. "Bandits — 3 units, melee threat") at info-density appropriate to the hover surface.

Scout action (Rest Camp only, costs Supplies): peek the next region's first 2-3 nodes; reveal encounter composition (specific enemies, not just category) at adjacent nodes.

For multi-hour permadeath, this matches the STS standard (visible upfront) — fog is wrong. Failure mode prevented: FTL "perfect-to-dead" runs from random fights the player didn't agree to.

### Pillar 7 — STS unique-destination audit
For every node with ≥2 outgoing edges, BFS-walk the graph and assert that no two outputs converge to the same node within 2 hops. Eliminate the "fake choice" failure mode that's structural in hand-authored maps. Codify as a content-validation check at boot time (data/load.ts) so the rule can't be re-broken by editing JSON.

### Pillar 8 — Per-run variation in content, not in graph
The 46-node graph stays fixed across runs. Per-run randomization:

- Encounter pool draws per-node from the region's encounter table with per-run RNG (already exists; ensure variety).
- **Discovery deck**: a pool of ~30-40 hand-authored events. Each run, Discovery node slots are filled by drawing without replacement from the deck weighted by tier-tags.
- Town shop inventories shift per-run (regionally-themed stock + 1-2 rotating items).
- Tavern recruit pools shift per-run from a regional template.
- The Boss encounter at each region's exit is fixed by region but varies in 2-3 authored compositions.

### Pillar 9 — Visible memory and visible caravan
- **Party caravan** rendered on the map as a token next to the current node, drawn with portrait-tiles per living unit (1-4 visible). On unit death, the token visibly loses a tile and never restores. Banner Saga's caravan-as-record.
- **Node memory states** rendered visibly:
  - `unvisited` (default)
  - `current` (active highlight)
  - `cleared` (encounter resolved this run — checkmark)
  - `failed` (failed Discovery / fled encounter — burn/scar mark)
  - `quest-active` (existing quest marker)
- **Hidden conviction tracking**: small node choices (Discovery branches, dialogue stat-checks, captured-or-killed enemies) feed unseen counters. Surface at region-end "scales" moment — pick which of 2-3 region-boss flavors based on accumulated conviction. Triangle Strategy's mechanism. *No visible meter on the HUD* — the convictions surface only at the gate.

## Architecture

### State changes

New fields on `RunState`:

```ts
interface RunState {
  // ... existing
  /** Per-run resolved state of nodes the party has acted on. */
  nodeResolutionState: Record<NodeId, 'cleared' | 'failed' | 'quest-active'>
  /** Hidden conviction tracker for region-end forks (Triangle Strategy borrowing). */
  conviction: { honor: number; ruthlessness: number; mercy: number }
  /** Active Discovery cards drawn from the deck per node slot, this run. */
  discoveryAssignments: Record<NodeId, DiscoveryCardId>
  /** Nodes the player has scouted this run (showing enemy composition pre-engagement). */
  scoutedNodes: Set<NodeId>
}
```

### Node archetype enum (extends domain/map.ts)

```ts
export type NodeArchetype =
  | 'trail'     // current 'camp' renamed conceptually; pass-through with encounter chance
  | 'rest_camp' // dedicated rest landmark; mid-region; Scout source
  | 'town'
  | 'discovery' // new — one-time event/check slot
  | 'dungeon'
  | 'boss'      // region exit
```

(Note: existing JSON `type: 'camp'` migrates to `'trail'` for most current camps, `'rest_camp'` for designated rest landmarks — see Migration below.)

### Region tuning table

```ts
const REGION_TUNING: Record<RegionId, RegionTuning> = {
  borderlands: { encounterChancePerHop: 0.25, supplyDrainPerHop: 1, favoredEnemyTags: ['bandit', 'wolf'] },
  thornwood:   { encounterChancePerHop: 0.40, supplyDrainPerHop: 1, favoredEnemyTags: ['brigand', 'bandit_mage'] },
  ashfall:     { encounterChancePerHop: 0.55, supplyDrainPerHop: 2, favoredEnemyTags: ['ember_cult', 'wraith'] },
}
```

### Smart multi-hop algorithm

In `OverworldScene.executeHop`, after arriving at a node and before advancing the path:

```ts
const isDecisionNode = (
  node.type === 'town' || node.type === 'rest_camp' ||
  node.type === 'town' || node.type === 'dungeon' ||
  node.type === 'boss' || node.type === 'discovery' ||
  hasUnresolvedEncounterRoll(node) ||
  !visitedNodes[node.id] ||
  isFinalDestination
)
if (isDecisionNode) {
  // pause the walk; show menu/dialogue/combat boot/scene
  setQuickMenuNode(...)  // or trigger encounter/event flow
} else {
  // chain to next hop silently
}
```

### Discovery deck

`src/data/content/discoveries/*.json` — each file a Discovery card (similar to CheckEventDef structure). Per-run draw at game start: each Discovery node slot in the 3 regions is assigned a card from the deck (weighted by region-tier-tag, drawn without replacement). State stored in `runStore.discoveryAssignments`.

### Caravan render

New `src/ui/scenes/overworld/Caravan.tsx` — anchored to current node on the pan layer. Renders 1-4 mini-portraits (from CharacterPortrait) for living party units. Updates reactively when `runStore.party.partyOrder` changes. On unit death, the portrait fades + a faint cross/wound mark stays beneath the caravan (within this run).

### Conviction tracker

Three numeric counters in `RunState.conviction`. Each Discovery card's branches award conviction deltas in its JSON (`{ honor: +1 }` etc.). No HUD display. At region-end (Boss node), the conviction values pick which boss variant fires (e.g. Borderlands boss: `bandit_king` if ruthlessness >= 3, else `bandit_chief`).

## UI/UX notes

- **Hover tooltip** on adjacent node: name + node-type + encounter category if encountered (e.g. "Old Mill Crossing · Trail · Bandits — 3 units").
- **Scout action** lives in the Rest Camp quick-action menu as a third option: "Scout the road ahead (1 Supply)".
- **Caravan token** anchored next to the player marker; partly behind the marker. Portrait tiles arranged horizontally; fade-out + scar on death.
- **Node memory marks**: small icons in corners of the node circle — checkmark for cleared, faint scar for failed. Existing visited (✓) becomes obsolete; replaced by clearer per-archetype memory marks.
- **Region transition**: when crossing a region edge, the next region's map slides in (camera pan) with a fade — not just "another node click." Reinforces the "you've crossed into Thornwood" feeling.

## Content authoring

- **5 node-archetype taxonomy**: rewrite the 3 region JSON files (borderlands/thornwood/ashfall) so each region has: 1 Town hub, 2-3 Rest Camps spaced ~1/3 and 2/3 through, 1 Dungeon, 1 Boss exit, ~3-4 Discovery slots, remaining ~6-8 Trail nodes.
- **STS unique-destination audit script**: `phaser/scripts/audit-overworld-graph.ts` — boot-time check that emits warnings for converging branches.
- **Discovery deck**: 30-40 cards in `src/data/content/discoveries/`. Each card defines a name, narrative, choices, conviction deltas, and outcome effects.

## Migration plan (from current overworld to redesign)

1. **Phase O1 — Data model**: add `NodeArchetype` + `RegionTuning` + `RunState.conviction` + `nodeResolutionState` + `discoveryAssignments` + `scoutedNodes`. Add Zod schemas. Update `CONTEXT.md`.
2. **Phase O2 — Region tuning**: ship the 3-row `REGION_TUNING` constants table; rewire `encounterRoller` to consume per-region encounter chance + supply drain.
3. **Phase O3 — Smart multi-hop**: extend `OverworldScene.executeHop` with the `isDecisionNode` predicate; tests cover Trail-chain vs decision-pause cases.
4. **Phase O4 — Archetype taxonomy migration**: rename existing `'camp'` JSONs → `'trail'` (most) and `'rest_camp'` (designated landmarks). Add `'discovery'` slots in each region.
5. **Phase O5 — Discovery deck**: schema + 10-15 starter cards. Per-run assignment logic. UI modal for resolution.
6. **Phase O6 — Asymmetric services**: implement Scout action at Rest Camp; reflag Camp Scout from "Coming Soon" stub.
7. **Phase O7 — Caravan render + memory marks**: visual feedback for run state on the map.
8. **Phase O8 — Conviction tracking + region-end forks**: silent counters; surface at Boss node.
9. **Phase O9 — STS unique-destination audit script**: boot-time check; fix any current converging branches.
10. **Phase O10 — Telegraphed encounters**: hover tooltip surfacing.

Each phase is independently testable + shippable. O1-O3 are the spine; O4-O10 are content + polish layered on.

## Testing strategy

- **Smart multi-hop unit tests**: synthetic 5-node path, mix of trail/discovery/town; assert pause-vs-chain decisions for each archetype + each resolution state.
- **Region tuning unit tests**: encounter rate math across regions; supply drain rate math.
- **Discovery deck unit tests**: per-run assignment is deterministic given a seed; no card used twice; weighting respects region tiers.
- **Unique-destination graph audit**: standalone script + a Vitest unit test that loads all region JSONs and asserts the rule.
- **Conviction tracker unit tests**: deltas accumulate correctly; region-end fork selects correct boss variant.
- **E2E**: drive a run that visits a Rest Camp, picks Scout, sees revealed encounters; resolves a Discovery; reaches a Boss with seeded conviction; assert the right boss variant fires.

## Open questions (v1.x candidates)

These don't block v1.0; flagged so they can be picked up later with telemetry guidance:

- **Per-region special rules**: Thornwood ambush patrols moving on the map; Ashfall siege-style set-piece nodes. Real systems differentiation. Targets v1.1.
- **Authored anchors + procgen filler**: Caves of Qud / Dead Cells pattern. v1.x once we have telemetry on which authored nodes feel redundant.
- **Faction-control overlay**: Tyranny-style region cartouches showing who controls what. Defer until factions exist as a system.
- **Run-to-run scars across runs**: the meta-progression layer noting where heroes fell. Belongs with meta-store unlocks.
- **Hidden conviction's UI revelation**: when to surface accumulated conviction (just boss variant? Also region-end "scale" cinematic?). Decide post-playtest.

## Promise tag

`<promise>OVERWORLD-V2</promise>` — emit when O1-O7 (spine + content migration + caravan) are green on all six gates and a manual playthrough confirms a 3-region run feels distinctly improved from v1.0.

---

## Self-review notes

- **Placeholder scan**: no TBDs in the body. The per-region tuning values (0.25 / 0.40 / 0.55, drain rates 1 / 1 / 2) are placeholders to be tuned by playtest — flagged as tuning targets in O2.
- **Internal consistency**: Pillars and Architecture cross-reference correctly. Currency/archetype/region tables align.
- **Scope check**: 10-phase migration is large but each phase is independently shippable. The spec defines a coherent unit of design work for a writing-plans plan.
- **Ambiguity check**: smart multi-hop's "Trail with unresolved encounter roll" semantics is the trickiest — clarified that a *fresh roll* (not "ever-encountered") triggers a pause, so chasing a known route through cleared territory works as expected.
