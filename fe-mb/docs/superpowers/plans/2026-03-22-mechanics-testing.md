# Mechanics Redesign — Testing & Polish Plan

> **Status:** Pending manual testing in Godot
> **Depends on:** `docs/superpowers/plans/2026-03-22-mechanics-redesign.md` (implementation complete)
> **Spec:** `docs/superpowers/specs/2026-03-22-mechanics-redesign.md`

**Goal:** Verify all mechanics redesign changes work in-game, fix bugs found during testing, polish rough edges.

---

## What Was Implemented (15 commits)

### Phase 1: Data Layer
- ItemData: sharpness enum (Sharp/Normal/Dull), grid_width/grid_height, CROSSBOW weapon type, honed flag
- UnitData: quick_slots[2] replacing inventory array, legacy migration in from_dict
- CardData: CROSSBOW deserialization, Bounty Hunter cards updated
- item_catalog.json: prices reduced ~70-80%, grid sizes, whetstone + iron_crossbow added
- Town JSONs: guild → blacksmith in all 5 towns, whetstone added to shops

### Phase 2: Party Bag
- GameManager: 8x4 grid bag (bag_grid, bag_items), all manipulation methods
- Food as computed property from bag Food Rations (current_uses = hops remaining)
- consume_food() searches bag, handles multi-item spanning, triggers starvation
- add_food() tops up existing rations then creates new ones
- start_new_run() initializes bag with 2x Food Rations + 1x Vulnerary

### Phase 3: Combat Integration
- CardData.get_computed_damage(): now adds weapon.might + weapon.get_sharpness_bonus()
- Weapon triangle removed from CardEffectResolver and CardPlayController
- Weapon-card compatibility: cards greyed out if weapon_type doesn't match equipped weapon
- Post-battle sharpness degradation in battlefield._end_battle()

### Phase 4: UI Rewrites
- CampPopup: 4 choices (Rest/Sharpen/Scout/Leave), unit selector for multi-sharpen
- BlacksmithPanel: shows weapon list with sharpness, Sharpen All at 15g/weapon with Honed bonus
- ShopPanel: buy places items in bag, sell lists bag items, no more per-unit inventory
- Combat quick slots: 2 buttons in card hand UI, use consumable or switch weapon for 1 AP

### Phase 5: Grid Inventory UI
- GridInventoryUI: CanvasLayer with 8x4 cell grid, click-to-pick/place, item info panel
- Unit panel: weapon slot + 2 quick slot drop targets per unit
- Organize button calls bag_auto_sort()
- Accessible from overworld HUD "Inventory" button

### Phase 6: Save & Integration
- Save version 0.3.0 → 0.4.0, bag serialization, migration for old saves
- Fixed broken references: dialogue_manager, event_bus, combat_test_launcher

---

## Testing Checklist

### Priority 1: Core Systems (must work)

- [ ] **New Run startup** — Start new game. Verify: 80g, bag has 2 Food Rations + 1 Vulnerary, weapons equipped on units at Sharp sharpness.
- [ ] **Travel & food consumption** — Travel between nodes. Verify: food counter decreases by 1 per hop, Food Rations current_uses decrements, empty rations removed from bag.
- [ ] **Starvation** — Travel with 0 food in bag. Verify: party takes 3 HP damage per hop, notification shows.
- [ ] **Combat damage formula** — Enter battle. Verify: card damage includes weapon might (compare Slash damage with/without weapon). Check damage preview on hover matches actual damage dealt.
- [ ] **Weapon-card compatibility** — In combat, verify: cards matching equipped weapon type are playable, mismatched weapon_type cards are greyed out, NONE-type cards (skills/spells) always playable.
- [ ] **Sharpness degradation** — Win a battle. Verify: equipped weapons drop 1 sharpness tier (Sharp→Normal). Win another: Normal→Dull. Dull stays Dull.
- [ ] **Camp choices** — Arrive at camp. Verify: Rest/Sharpen/Scout/Leave buttons appear. Rest heals 20% and consumes 1 food. Sharpen restores a weapon to Sharp and consumes 1 food. Leave closes popup.
- [ ] **Shop buy** — Visit town shop. Verify: new prices shown, buying places item in bag grid, food_rations get current_uses=3, "Bag full!" shown if bag is full.
- [ ] **Shop sell** — Verify: sell mode shows bag items (not per-unit inventory), selling removes from bag and adds gold.

### Priority 2: New Features (should work)

- [ ] **Grid Inventory UI** — Open from overworld HUD. Verify: 8x4 grid renders, items shown at correct positions, click item to pick up, click empty space to place, right-click to cancel. Organize button repacks items.
- [ ] **Quick slot management** — In inventory UI, drag items from bag to unit quick slots. Verify: item moves from bag to slot, slot shows item name.
- [ ] **Weapon equip from bag** — In inventory UI, click a weapon in bag, click a unit's weapon slot. Verify: old weapon returns to bag, new weapon equipped.
- [ ] **Blacksmith** — Visit town blacksmith. Verify: weapon list with sharpness colors, "Sharpen All" costs 15g×weapons, weapons become Sharp+Honed after purchase.
- [ ] **Honed bonus** — After blacksmith sharpening, win a battle. Verify: honed weapon stays Sharp (hone consumed). Second battle: drops to Normal normally.
- [ ] **Combat quick slots** — In battle action phase, verify: quick slot buttons show items, clicking Vulnerary heals for 1 AP, clicking weapon switches equipped weapon for 1 AP.
- [ ] **Whetstone in combat** — Use whetstone from quick slot. Verify: weapon sharpness restored to Sharp, whetstone consumed, 1 AP spent.
- [ ] **Save/Load** — Save game after buying items and using blacksmith. Load it. Verify: bag contents, sharpness states, honed flags, quick slot items all preserved.
- [ ] **Save migration** — Load an old 0.3.0 save (if available). Verify: old food count creates rations in bag, old inventory items migrate to bag or quick slots.

### Priority 3: Edge Cases

- [ ] **Unarmed unit** — Remove weapon from a unit (sell it). Verify: only NONE-type cards playable, damage formula gives 0 weapon might.
- [ ] **Full bag** — Fill the bag completely. Verify: shop buy shows "Bag full!" and refunds gold. Dialogue item rewards show "Bag full!" message.
- [ ] **Crossbow compatibility** — Equip iron_crossbow on a unit. Verify: CROSSBOW-type cards (crossbow_bolt, etc.) are playable, BOW-type cards are greyed out.
- [ ] **Camp with no food** — Visit camp with empty bag. Verify: Rest and Sharpen buttons disabled, Scout and Leave still work.
- [ ] **Camp sharpen with all Sharp** — Visit camp when all weapons are Sharp. Verify: Sharpen button disabled or shows "All weapons sharp".

---

## Known Issues to Investigate

1. **Old inventory_screen.gd** — `scenes/ui/inventory_screen.gd` references removed `unit.inventory` API. Reachable from dormant code paths (dungeon_map, party_screen, old world_map_ui). Not critical but will crash if those paths are ever activated.

2. **Whetstone goes to Sharp** — Implementation uses `sharpen()` (straight to Sharp) instead of "+1 tier" per spec. This is more generous but arguably better UX for a 40g item. May need balance tuning.

3. **Scout action is stub** — Camp Scout button shows "Coming soon" notification. Full implementation (pre-rolling encounters, map overlays) requires encounter visibility system on world_map.

4. **Food setter recursion risk** — `GameManager.food` setter calls `add_food()`/`consume_food()` which read `food` getter. Should be safe (getter doesn't call setter), but watch for infinite recursion if logic changes.

5. **bag_remove_item index instability** — After removing an item, all subsequent bag_items indices shift. Code handles this by restarting iteration after each removal, but external callers holding stale indices will break. Document this hazard.

6. **Combat forecast** — HP prediction in damage preview may not account for the new weapon might + sharpness values correctly (was already a known issue before this redesign).

7. **Quick slot buttons in combat** — Visual styling may need polish. Buttons were added programmatically — verify they don't overlap card hand or other UI elements.

---

## Post-Testing Polish (if time permits)

- [ ] Sharpness indicator on overworld HUD (show weapon condition next to unit name)
- [ ] Grid inventory: highlight cells that would be occupied when hovering with held item
- [ ] Grid inventory: color-code items by type (weapons grey, consumables green, food amber)
- [ ] Camp sharpen: show sharpness tier names in the selector (not just enum values)
- [ ] Shop: show grid size in item details ("Takes 1x3 bag space")
- [ ] Battle end: show sharpness change notification ("Weapons dulled from battle")
