# Research #3: Existing Godot Quest System Audit

**Status:** Complete (2026-05-09)
**Files audited:**
- `autoload/quest_manager.gd` (189 lines)
- `autoload/event_bus.gd` (163 lines)
- `autoload/dialogue_manager.gd` (452 lines)
- `data/quests/quest_definitions.json` (41 lines, 1 quest)
- `data/dialogue/sq_blood_ties_accept.json`, `sq_blood_ties_daren_captured.json`, `sq_blood_ties_daren_killed.json`, `prologue.json`, `test_event_crossroads.json`
- `data/events/travel_events.json` (the `sq_blood_ties_encounter` entry)
- `data/towns/pine_crossing.json` (tavern quest entry)
- `scripts/overworld/world_map.gd` (905 lines — quest-related slices)
- `scripts/combat/battlefield.gd` (capture-target resolution lines 770–795)
- `scripts/ui/quest_log_panel.gd` (352 lines)
- `scripts/ui/town_menu.gd` (tavern quest panel lines 619–705)

---

## 1. Quest Data Shape (Godot)

The single quest defined today (`sq_blood_ties`) reveals a flat, mostly-static schema. There is NO per-stage state machine in the JSON — stages are display-only labels; behavior lives in (a) dialogue-effect dispatch, (b) `quest_nodes[].spawn_on_stage` filtering, and (c) `location_indicators[].stage` filtering.

```jsonc
{
  "id": "sq_blood_ties",                       // QuestId
  "name": "Blood Ties",                        // display
  "source": "Pine Crossing Tavern",            // display only
  "description": "...",                        // display only
  "stages": [                                  // ALL display-only objectives list
    { "stage": 0, "label": "Find Daren's gang..." },
    { "stage": 1, "label": "Defeat the bandits..." },
    { "stage": 2, "label": "Return to report..." }
  ],
  "location_indicators": [                     // shows "!" on map nodes
    { "location": "Pine Crossing", "stage": -1 }   // -1 = any active stage
  ],
  "quest_nodes": [                             // dynamic map nodes spawned at runtime
    {
      "name": "Daren's Camp",
      "x": 180, "y": 510,                      // pixel position on map
      "region": "borderlands",
      "connections": [0, 2],                   // ids of static map nodes to wire into
      "spawn_on_stage": 0,                     // appears when quest stage >= 0
      "battle": {
        "enemy_group": "darens_gang",
        "name": "Daren's Bandits",
        "capture_targets": [                   // post-battle dialogue + flag wiring
          {
            "unit_name": "Daren",
            "captured_dialogue": "sq_blood_ties_daren_captured",
            "killed_dialogue":   "sq_blood_ties_daren_killed",
            "captured_flag":     "daren_captured",   // (NB: see flag-bug pattern below)
            "killed_flag":       "daren_killed"
          }
        ]
      }
    }
  ]
}
```

**Field-by-field notes**

| Field | Purpose | Notes |
|---|---|---|
| `id` | unique key | flag-namespace prefix (`{id}_active`, `{id}_complete`) |
| `name`, `source`, `description` | UI display | rendered by `quest_log_panel.gd` |
| `stages[]` | UI checklist | `current_stage` numeric compared with `stage_data.stage` to render `[x] / [ ] / [ ]` |
| `location_indicators[]` | yellow `!` on map | filtered each frame by `QuestManager.get_quest_locations()` |
| `quest_nodes[]` | dynamic LocationData spawned by `world_map._sync_quest_nodes()` | filtered by `spawn_on_stage` |
| `quest_nodes[].battle` | inlined battle config | read by `world_map._enter_quest_battle()` |
| `capture_targets[]` | bridges combat → dialogue | read by `battlefield.gd` lines 780–795 |

There are **no** rewards, **no** transitions, **no** listeners, **no** `onEnter` effects in the JSON itself. All effects are emitted from dialogue files (`recruit_unit`, `add_gold`, `advance_quest`, `complete_quest`, `set_flag`).

## 2. QuestManager Behavior

`QuestManager` is a thin state container. It does **not** orchestrate; orchestration is implicit, distributed across DialogueManager, world_map, and battlefield.

- **`start_quest(id)`** — registers `{status: "active", stage: 0}`, sets `EventBus.set_flag("{id}_active", true)`, emits `quest_started`. Idempotent (no-op if already started).
- **`advance_quest(id, stage = -1)`** — bumps `stage` (or sets explicitly). Emits `quest_stage_changed`. **Does not auto-grant rewards or run any per-stage effects.**
- **`complete_quest(id)`** — sets `status = "complete"`, clears `_active`, sets `_complete`, emits `quest_completed`. Once complete, the quest dictionary is **kept** (for the log) but never pruned.
- **`is_quest_active / is_quest_complete / get_quest_stage`** — pure accessors.
- **`get_quest_locations()` / `get_active_quest_nodes()`** — read-side queries that filter definitions by current stage.
- **No condition-check protocol.** Conditions are evaluated where they're needed (dialogue choice gates, tavern visibility) via `EventBus.evaluate_condition()`. There is no QuestManager-driven event subscription.
- **Rewards** are NOT granted by QuestManager. Each dialogue node emits the reward effects (`add_gold`, `recruit_unit`, `give_item`) at the precise narrative moment. QuestManager only tracks status/stage.
- **Save / load** — `_quests` dict is serialized whole; `load_save_data` re-asserts EventBus flags but does **not** re-emit `quest_stage_changed`, so any UI listening for those signals must repopulate from `get_active_quests()` on scene reload.
- **`reset()`** — clears `_active`/`_complete` flags then clears `_quests`. Called by `GameManager.start_new_run()`.

## 3. Flag System

Flags live in `EventBus._flags: Dictionary` (untyped, string-keyed, value-typed booleans-only).

- **Storage:** `Dictionary` of `name → true`. `set_flag(name, false)` **erases** the entry rather than setting it to `false` (so `false` and "unset" are indistinguishable). `get_flag()` returns `false` for missing keys.
- **Naming convention:** by accident only. QuestManager prepends `{quest_id}_` for `_active`/`_complete`. Other flags are bare strings (`prologue_seen`, `crossroads_cleared`, `daren_captured`). No registry, no scope tag, no namespace enforcement.
- **Set from:** `DialogueManager._execute_effect()` for `set_flag` and `clear_flag`; `QuestManager.start_quest/complete_quest`; `battlefield.gd` lines 791/795 for capture/kill flags; some travel-event flags via dialogue.
- **Cleared:** never automatically by scope. `EventBus.clear_all_flags()` exists but is only called by `GameManager.start_new_run()` via `QuestManager.reset()` (which only clears the `_active`/`_complete` pair). All other flags persist forever within a save.
- **Bug pattern (`_daren_captured` vs `daren_captured`).** Two parallel sources of truth wrote different flag names for the same outcome:
  - `data/quests/quest_definitions.json` writes `daren_captured` / `daren_killed` (from `quest_nodes[].battle.capture_targets`).
  - `data/events/travel_events.json` writes `sq_blood_ties_daren_captured` / `sq_blood_ties_daren_killed` (different identifier!) for the random-encounter version of the same fight.
  - `data/dialogue/sq_blood_ties_daren_captured.json` redundantly sets `sq_blood_ties_daren_captured` again on resolution.
  - The MEMORY.md note records that earlier dialogue files conditioned on `_daren_captured` (with leading underscore). The fix was to standardize on the prefixed `sq_blood_ties_daren_*` form, but the quest_definitions.json battle-side **still has the unprefixed names** as of this audit. The system "works" because dialogue resolution sets the prefixed version itself, masking the inconsistency.
  - **Root cause:** no schema validation; no flag registry; data authored in three separate JSON files without a shared vocabulary.

## 4. Blood Ties End-to-End Trace

Numbered cross-system writes from accept to completion (capture branch):

1. **Player enters Pine Crossing tavern.** `town_menu.gd` filters `tavern.quests[]` by `show_conditions` → renders Kael NPC because `not_flag sq_blood_ties_active` AND `not_flag sq_blood_ties_complete`.
2. **Player clicks "Talk."** `town_menu` emits `town_closed`, calls `DialogueManager.start_dialogue("sq_blood_ties_accept")`.
3. **Player picks "We'll bring him back alive" / "You have a deal."** Dialogue node `accept` runs effects:
   - `start_quest sq_blood_ties` → `QuestManager._quests` set, `EventBus.set_flag("sq_blood_ties_active", true)`, `quest_started` signal.
   - `advance_quest sq_blood_ties stage=1` → stage = 1, `quest_stage_changed` signal.
4. **Signal fan-out.** `world_map.gd` receives `quest_started` and `quest_stage_changed` → calls `_sync_quest_nodes()` (spawns `Daren's Camp` at (180, 510) because `spawn_on_stage=0 ≤ 1`) and `_update_quest_indicators()` (toggles "!" on Pine Crossing — but since `quest_active` predicate now passes, it stays).
5. **Player travels.** Two paths:
   - **(a) Quest node:** Player clicks Daren's Camp. `_trigger_location_event` → `LocationType.QUEST` → `_enter_quest_battle(loc)` → reads `_quest_battle_data[node_id]`, sets `GameManager.pending_battle = {enemies, source: "quest_battle", capture_targets: [{Daren, ...}]}`, transitions to combat.
   - **(b) Travel encounter:** During `_travel_path`, `EventManager.roll_travel_encounter()` may pick `sq_blood_ties_encounter` (weight 100, gated on `sq_blood_ties_active`). `world_map._travel_path` reads its `capture_targets` (line 448), saves remaining path, calls `_start_encounter_battle`.
6. **Combat.** `battlefield.gd` reads `pending_battle.capture_targets`. After victory, for each target unit: if found in `bound_enemies` (captured) → set `GameManager.pending_post_battle_dialogue = "sq_blood_ties_daren_captured"`, `EventBus.set_flag("daren_captured")`. Else → `pending_post_battle_dialogue = "sq_blood_ties_daren_killed"`, `EventBus.set_flag("daren_killed")`. Captured units are also pushed to `GameManager.captured_enemies` (for unrelated bounty turn-in).
7. **Return to overworld.** `world_map._ready` reads `pending_post_battle_dialogue`, clears it, awaits 0.3s, then `DialogueManager.start_dialogue("sq_blood_ties_daren_captured")`.
8. **Dialogue plays the resolution.** Final node `join` runs effects (in order):
   - `recruit_unit Kael BOUNTY_HUNTER` → builds `UnitData` from inline stats, equips `Hunter's Bow` from inline weapon dict, `GameManager.add_unit()` → emits `show_notification`.
   - `advance_quest sq_blood_ties stage=2`.
   - `complete_quest sq_blood_ties` → clears `_active`, sets `_complete` flag, emits `quest_completed`.
   - `set_flag sq_blood_ties_daren_captured` (redundant — battle already set `daren_captured`, but with different name).
9. **Signal fan-out (completion).** `world_map._on_quest_changed` → `_sync_quest_nodes()` removes Daren's Camp from the map (no longer in `get_active_quest_nodes()`), `_update_quest_indicators()` clears `!` on Pine Crossing.

Killed-branch (from step 7): same shape, dialogue `gold` node runs `add_gold 80`, `advance_quest`, `complete_quest`, `set_flag sq_blood_ties_daren_killed`. No recruit.

## 5. Dialogue Integration

Dialogue is the de-facto effect dispatcher; QuestManager is just a status book.

- **Choice → flag:** `select_choice(idx)` runs `_execute_effects(choice.effects)` then navigates to `choice.next`. Effect of kind `set_flag` writes both `_dialogue_local_flags` and `EventBus._flags` (DialogueManager keeps a local mirror for per-run scope, but in practice all flags live globally because EventBus is the canonical store).
- **Choice → combat:** `start_combat` effect is **not handled by DialogueManager itself** — `dialogue_manager.gd` line 277 explicitly `pass`es. Instead, `world_map.gd` is connected to `DialogueManager.effect_executed` and stores the enemy group in `_encounter_combat_data` (line 335). After `dialogue_finished` fires, the calling code (`_travel_path` line 431) checks `_encounter_combat_data` and triggers `_start_encounter_battle`. This is a deferred-effect pattern: the dialogue completes its narrative, then the world processes accumulated effects.
- **Choice → quest advance:** `advance_quest` / `start_quest` / `complete_quest` effects call QuestManager methods directly — synchronous, in-order with other effects.
- **Choice gating:** `_get_filtered_choices` runs `EventBus.evaluate_condition(choice.condition)` for each choice; failed conditions hide the choice entirely (no greyed-out preview).
- **Stat checks:** intercepted before normal navigation. Effect `stat_check` constructs a `StatCheckDisplay`, awaits its result, then routes to `success_next` or `fail_next`. This is a third deferred-effect mechanism distinct from `start_combat`.
- **Effect catalog (full list of `_execute_effect` cases in `dialogue_manager.gd:247–281`):** `add_gold`, `add_food`, `heal_party`, `damage_party`, `set_flag`, `clear_flag`, `start_quest`, `complete_quest`, `advance_quest`, `give_item`, `start_combat` (deferred), `recruit_unit`. All emit `effect_executed` afterward for any external listeners.

## 6. TS Schema Coverage

Comparing Godot reality to `phaser/src/domain/quest.ts` and `predicate.ts`:

### Covered correctly

- ✅ `QuestDef.id, name, initialStage, stages` — superset of Godot's flat schema (Godot has no `initialStage` because it's always 0; TS makes it explicit).
- ✅ `QuestStage.onEnter / onExit / listeners / transitions` — strictly more powerful than Godot's display-only stages. The current Godot patterns (advance via dialogue effect, complete via dialogue effect) become `onEnter` effects on the next stage and a `transitions[]` predicate watching `flag` setters.
- ✅ `QuestEffect.setFlag` covers `set_flag` / `clear_flag` (latter = `setFlag value=false`).
- ✅ `QuestEffect.grantItem`, `recruitUnit`, `completeQuest`, `startDialogue` cover the dialogue effects.
- ✅ `Predicate.flag / notFlag / questStage / questComplete` covers all current `evaluate_condition` cases used in quest gates.
- ✅ `QuestListener.on: BattleVictory | LocationArrived | ItemAcquired | FlagSet` covers the implicit triggers — battle victory + capture flag setter is exactly what Blood Ties needs to auto-advance from stage 1 → 2.

### Needs adjustment

- ⚠️ `QuestEffect.spawnNode / unlockNode` use `MapNodeRef`, but Godot's `quest_nodes[]` carry inline `{ x, y, region, connections, name, battle: {...} }`. The TS `MapNodeRef` is presumably an opaque id; that means dynamic-quest-node geometry has to live elsewhere — either in a sibling `MapNodeDef` registry referenced by id, or `spawnNode` needs to embed a `MapNodeDef` payload. Decide: registry-by-id or inline payload.
- ⚠️ `QuestEffect.recruitUnit` is `{ classId, level }` but Godot inlines the *full stat block* + a *full weapon dict* in dialogue JSON. Either the TS recruits look up a UnitDef-by-class-and-level table (cleaner) or the effect grows to carry stats/equipment. The cleaner option requires defining "level-N templates per class" in unit data.
- ⚠️ `Predicate` lacks `goldAtMost`, `hasUnit by name (not class)`, `partySize`, `hasFood`, `statMin`. The Godot `evaluate_condition` supports `min_party_size`, `has_unit_class`, `stat_min`, `has_food`, `has_item`. TS has `partyHas` (class) and `goldAtLeast` and `hasItem` — but missing `partySizeAtLeast`, `foodAtLeast`, `statAtLeast`. **Add these.**

### Gaps requiring new TS fields

- ❌ **Capture-target resolution.** Godot's most distinctive cross-system pattern is `capture_targets[]` on a battle config: a battle outcome maps a unit_name to (a) follow-up dialogue and (b) a flag. The TS `QuestEffect` set has nothing equivalent. Two options:
  1. Express it as a `QuestListener` on `BattleVictory` with predicate `cleared(encounterId)` and emit `setFlag` + `startDialogue`. This works **if** battle outcomes can carry "captured unit ids" into the predicate environment. That requires the battle-victory event to publish per-unit capture status to the event bus.
  2. Add a richer `BattleEncounterDef` type (outside quest.ts) with a `captureTargets: { unitId, captureFlag, killFlag, captureDialogue, killDialogue }[]`, and let `QuestListener` listen on a downstream `UnitCaptured` event.
  Option (2) matches the Godot architecture better. Recommend adding a `'UnitCaptured' | 'UnitKilled'` to `QuestListenerEvent`.
- ❌ **Dynamic quest node geometry.** As noted under "needs adjustment" — TS `spawnNode` needs either a `MapNodeDef` registry or an inline payload. If registry: `data/maps/quest_nodes/*.json` per node. If inline: the `QuestEffect.spawnNode` variant needs to grow.
- ❌ **`source` (display origin) and `description` (long text)** fields are not in `QuestDef`. Add as optional display fields (or move to a sibling `QuestDisplay` type). The quest log UI needs them.
- ❌ **`location_indicators[]`** — yellow "!" on map nodes for active quests. Not currently expressible. Can be expressed as a `QuestStage.onEnter: spawnIndicator` / `onExit: clearIndicator` effect, OR a dedicated `QuestDef.indicators?: { ref: MapNodeRef; stages?: StageId[] }[]` declarative field. Recommend declarative — cleaner for save round-trip.
- ❌ **`FlagScope`** is defined but not actually used. Recommend a flag registry (`FlagDef`) that asserts a scope per key, so the migration can detect Godot-style "permanent" flags vs "per-run" and migrate them safely.

## 7. Recommended TS Schema Adjustments

Concrete proposals (all within the spirit of foundation v2 §13–§14, 0–1 new files):

1. **`QuestListenerEvent`** — add `'UnitCaptured'` and `'UnitKilled'` to handle the capture pattern declaratively.
2. **`Predicate`** — add `partySizeAtLeast: number`, `foodAtLeast: number`, `statAtLeast: { stat: StatKey; min: number }`, `unitCaptured: UnitId`. These cover all `evaluate_condition` cases observed in Godot.
3. **`QuestDef`** — add optional `source?: string`, `description?: string`, `indicators?: { ref: MapNodeRef; stages?: StageId[] }[]` to cover display + map-indicator data without abusing effects.
4. **`QuestEffect.recruitUnit`** — decision required: (a) extend to `{ classId, level, statOverrides?, weaponItemId? }` for parity with Godot inline stats, OR (b) require recruitable units to come from a `UnitTemplateDef` registry. **Recommend (b)** — cleaner, makes balance changes data-driven.
5. **`QuestEffect.spawnNode`** — same decision: payload vs registry. **Recommend payload** for quest-spawned nodes since they're tightly coupled to their parent quest (`MapNodeDef` inlined) — avoids splitting one quest's data across two files. Static map nodes stay in the map registry.
6. **`FlagKey` registry** — populate from current Godot flag corpus. Initial entries:
   - `prologue_seen` (scope: `permanent`)
   - `crossroads_cleared` (scope: `run`)
   - `sq_blood_ties_active`, `sq_blood_ties_complete` (scope: `run`, owned by quest manager)
   - `sq_blood_ties_daren_captured`, `sq_blood_ties_daren_killed` (scope: `run`)
   - `daren_captured`, `daren_killed` — **flag the duplicate-naming bug here**; do not migrate the unprefixed forms; consolidate on the `sq_blood_ties_*` namespace going forward.
7. **Validation:** schema should reject any data file that writes a flag key not in the registry (catch the Blood Ties bug at compile/load time).

### Future work (out of scope for this commit)

- Decide between `MapNodeDef` inline-vs-registry for `spawnNode` (OQ added to CONTEXT.md §12).
- Decide unit-template-registry shape for `recruitUnit` parity with Godot inline stats.
- Build a flag registry generator from Godot data as a one-time migration tool.

## Sources

- `autoload/quest_manager.gd` — full state-management surface; small (189 lines).
- `autoload/event_bus.gd` — flag store + shared `evaluate_condition()` switch (10 condition kinds).
- `autoload/dialogue_manager.gd` — effect dispatcher (12 effect kinds), conditional choice filtering, stat-check side-channel.
- `data/quests/quest_definitions.json` — only one quest, but exhibits all current shape patterns.
- `data/dialogue/sq_blood_ties_*.json` — branch-resolution effect lists (recruit, advance, complete, set_flag).
- `data/events/travel_events.json` — alternate route to the same battle, **with mismatched flag names**.
- `data/towns/pine_crossing.json` — tavern quest entry exhibiting `show_conditions` predicate gating.
- `scripts/overworld/world_map.gd` — quest-node spawn/despawn (`_sync_quest_nodes`), indicator updates, `start_combat` deferred-effect bridge, post-battle dialogue triggering.
- `scripts/combat/battlefield.gd` (lines 770–795) — capture-target resolution: maps captured/killed units to dialogue + flag writes.
- `scripts/ui/quest_log_panel.gd` — read-only UI consumer; defines what fields the QuestDef must surface for display.
- `scripts/ui/town_menu.gd` (lines 619–705) — tavern quest panel rendering with `show_conditions` filter.
