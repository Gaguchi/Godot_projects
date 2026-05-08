# Research #3: Existing Godot Quest System Audit

**Status:** `[STUB — to be filled before TS QuestDef schema is finalized]`
**Deliverable target:** 1–2 pages summarizing the Godot quest system + proposed TS schema.
**Blocks:** `QuestDef` schema finalization in TS foundation Week 1.

---

## Required Outputs

When this stub is filled, it must answer:

1. **Quest data shape (current Godot).** Read `data/quests/quest_definitions.json` end-to-end. Document the actual fields used: stage labels, conditions, rewards, branching points.
2. **QuestManager autoload behavior.** Read `autoload/quest_manager.gd`. Document:
   - How are quests started?
   - How do stages advance?
   - What's the condition-check protocol (sync/event-driven)?
   - Where are rewards granted?
   - How are completed quests pruned?
3. **Flag system in EventBus.** Read flag-related code in `autoload/event_bus.gd` (or wherever `_flags` lives). Document:
   - Is the flag dictionary typed?
   - Are flag names conventionally namespaced (e.g., `quest_X_Y`)?
   - Where does `EventBus.set_flag()` get called from?
   - Are flags ever cleared (run reset, scope-based, never)?
   - What's the bug pattern from MEMORY.md (`_daren_captured` vs `daren_captured`)?
4. **Blood Ties end-to-end trace.** Pick one quest (Blood Ties is the working one). Trace every cross-system write:
   - Where does it write to party (e.g., Daren joining)?
   - Where to inventory (rewards)?
   - Where to world (gold, location locks, quest indicators)?
   - Where to combat (forced encounters, capture state)?
   - Where to dialogue (gated branches)?
5. **Integration with dialogue.** Read `autoload/dialogue_manager.gd` and the Blood Ties dialogue JSONs. Document:
   - How do choices set flags?
   - How do effects (e.g., `start_combat`, `advance_quest`) get dispatched?
6. **Proposed TS schema.** Translate the Godot patterns into the TS shapes from §13–§14 of the foundation v2 spec:
   - `QuestDef`, `QuestStage`, `QuestListener`, `QuestEffect`
   - `Predicate` AST mapping for the existing condition kinds
   - `FlagKey` registry covering current Godot flag names
   - `FlagScope` assignments for each existing flag

## Files to Read

- `autoload/quest_manager.gd`
- `autoload/event_bus.gd`
- `autoload/dialogue_manager.gd`
- `data/quests/quest_definitions.json`
- `data/dialogue/*.json` (especially Blood Ties)
- `scripts/overworld/world_map.gd` (for map gating + quest indicator logic)
- `scripts/ui/quest_log_panel.gd` (for UI consumption of quest state)

## How To Fill This

Spawn a subagent (likely `Explore` for the read-heavy phase, then `general-purpose` for the synthesis). Brief: "Audit the Godot quest system end-to-end. Translate to TS schemas in foundation v2 §13–§14. Output 1–2 pages."
