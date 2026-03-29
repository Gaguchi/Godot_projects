# Phase 1: Equipment-Card Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static class decks with gear-driven deck building. Each unit has 2 hand slots; equipped gear contributes cards to the combat deck. Remove sharpness, quick slots, and blacksmith.

**Architecture:** UnitData gets `hand_left`/`hand_right` slots replacing `equipped_weapon`/`quick_slots`. ItemData gains `rarity` and `gear_cards` arrays. DeckManager builds decks from `unit.innate_cards + hand_left.gear_cards + hand_right.gear_cards`. Quiver items modify bow-sourced cards at deck-build time. Status effects (poison, burn, slow, immobilize) are deterministic fixed-number effects applied by CardEffectResolver.

**Tech Stack:** Godot 4.6, GDScript, JSON data files

**Spec:** `docs/superpowers/specs/2026-03-29-ship-plan-design.md`

**TDD approach:** GDScript test scenes run via `Godot --headless --script`. Each test file is a standalone script that prints PASS/FAIL and exits.

---

## File Map

### Files to Create
- `scripts/combat/test_hand_slots.gd` — hand slot equip/unequip tests
- `scripts/combat/test_deck_building.gd` — gear-based deck construction tests
- `scripts/combat/test_quiver_modifier.gd` — quiver bow-card modification tests
- `scripts/combat/test_status_effects.gd` — poison/burn/slow/immobilize tests
- `scripts/combat/test_damage_formula.gd` — new damage formula tests
- `scripts/combat/test_rarity.gd` — rarity enum serialization tests
- `data/cards/innate_decks.json` — class innate card definitions (4-5 per class)
- `data/cards/gear_cards.json` — gear-to-card mappings for all items

### Files to Modify
- `scripts/resources/unit_data.gd` — hand slots, remove quick_slots, add innate_cards
- `scripts/resources/item_data.gd` — rarity enum, gear_cards, is_two_handed, quiver_modifier; remove sharpness
- `scripts/resources/card_data.gd` — source tracking, remove weapon_type compat, remove sharpness from damage calc, add status_effects
- `scripts/combat/deck_manager.gd` — build from innate + gear cards, quiver modifier application
- `scripts/combat/card_effect_resolver.gd` — status effect application, remove weapon triangle
- `scripts/combat/card_play_controller.gd` — remove quick slot methods, remove weapon compat check, update deck init
- `scripts/ui/card_hand_ui.gd` — remove quick slot buttons, remove weapon compat greying, add card source indicator
- `scripts/ui/grid_inventory_ui.gd` — 2 hand slots per unit instead of weapon + quick slots
- `scripts/ui/camp_popup.gd` — remove sharpen action
- `scripts/ui/shop_panel.gd` — add rarity colors
- `autoload/game_manager.gd` — hand slot starter loadouts, remove quick slot refs, update save/load
- `autoload/save_manager.gd` — version 0.5.0, migration from 0.4.0
- `data/items/item_catalog.json` — add rarity, gear_cards, is_two_handed to all items
- `data/cards/class_decks.json` — reduce to innate-only (4-5 cards per class)

### Files to Delete
- `scripts/ui/blacksmith_panel.gd`
- `scripts/ui/blacksmith_panel.gd.uid` (if exists)

---

## Task 1: Remove Sharpness System

**Files:**
- Modify: `scripts/resources/item_data.gd`
- Modify: `scripts/resources/card_data.gd`
- Modify: `scripts/combat/card_effect_resolver.gd`
- Modify: `scripts/ui/camp_popup.gd`
- Modify: `scripts/combat/battlefield.gd`
- Delete: `scripts/ui/blacksmith_panel.gd`

- [ ] **Step 1: Remove sharpness from ItemData**

In `scripts/resources/item_data.gd`:
- Remove the `Sharpness` enum entirely
- Remove export vars: `sharpness`, `is_honed`
- Remove methods: `get_sharpness_bonus()`, `degrade_sharpness()`, `sharpen()`, `apply_honing()`
- Remove sharpness/is_honed from `to_dict()` and `from_dict()`
- Remove sharpness from `create_from_dict()`

- [ ] **Step 2: Remove sharpness from CardData.get_computed_damage()**

In `scripts/resources/card_data.gd`, find `get_computed_damage()`. Remove the line that adds `weapon.get_sharpness_bonus()`. The function should now be:
```gdscript
func get_computed_damage(unit) -> int:
    var base = damage_base
    if damage_stat != "" and unit:
        match damage_stat:
            "str": base += unit.strength
            "mag": base += unit.magic
            "skl": base += unit.skill
    if unit and unit.equipped_weapon and unit.equipped_weapon is ItemData:
        base += unit.equipped_weapon.might
    return int(base * damage_multiplier)
```

- [ ] **Step 3: Remove sharpness degradation from battlefield._end_battle()**

In `scripts/combat/battlefield.gd`, find the `_end_battle()` method. Remove the block that iterates party units and calls `weapon.degrade_sharpness()`.

- [ ] **Step 4: Remove sharpen action from CampPopup**

In `scripts/ui/camp_popup.gd`, remove:
- The Sharpen button creation code
- `_on_sharpen_pressed()` method
- The unit selector dropdown for sharpening
- Any references to `sharpness`

Camp should now have: Rest / Scout (stub) / Leave.

- [ ] **Step 5: Delete BlacksmithPanel**

```bash
rm scripts/ui/blacksmith_panel.gd
rm -f scripts/ui/blacksmith_panel.gd.uid
```

Remove any references to `BlacksmithPanel` in town_menu.gd (the blacksmith tab/button).

- [ ] **Step 6: Remove blacksmith from town data JSONs**

In each file in `data/towns/*.json`, remove `"blacksmith"` from the services list. Remove `"whetstone"` from shop inventories.

- [ ] **Step 7: Remove whetstone from item_catalog.json**

In `data/items/item_catalog.json`, remove the `"whetstone"` entry.

- [ ] **Step 8: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot, no parse errors. All autoloads initialize.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: remove sharpness system, quick slots pending removal

Remove Sharpness enum, degradation, honing, whetstone, blacksmith panel,
and camp sharpen action. Part of equipment-card system overhaul."
```

---

## Task 2: Remove Quick Slots

**Files:**
- Modify: `scripts/resources/unit_data.gd`
- Modify: `scripts/combat/card_play_controller.gd`
- Modify: `scripts/ui/card_hand_ui.gd`
- Modify: `scripts/ui/grid_inventory_ui.gd`
- Modify: `autoload/game_manager.gd`

- [ ] **Step 1: Remove quick_slots from UnitData**

In `scripts/resources/unit_data.gd`:
- Remove `var quick_slots: Array[Resource]` declaration
- Remove `get_quick_slot(slot_index: int)` method
- Remove `set_quick_slot(slot_index: int, item: Resource)` method
- Remove quick_slots initialization in any `_init()` or setup code
- Remove quick_slots from `to_dict()` — remove the section that serializes quick_slots
- Remove quick_slots from `from_dict()` — remove deserialization and legacy migration

- [ ] **Step 2: Remove quick slot methods from CardPlayController**

In `scripts/combat/card_play_controller.gd`:
- Remove `use_quick_slot_item()` method entirely
- Remove `switch_weapon_from_slot()` method entirely
- Remove any signal connections for quick slot buttons

- [ ] **Step 3: Remove quick slot UI from CardHandUI**

In `scripts/ui/card_hand_ui.gd`:
- Remove `quick_slot_used` signal
- Remove `refresh_quick_slots()` method
- Remove quick slot button creation code (look for "quick_slot" or "slot_btn" in the build methods)
- Remove quick slot button press handlers

- [ ] **Step 4: Remove quick slot drop targets from GridInventoryUI**

In `scripts/ui/grid_inventory_ui.gd`:
- In `_refresh_unit_panels()`, remove the 2 quick slot drop target UI elements
- Remove click handlers for quick slot equip/unequip
- The unit panel should now show: unit name + weapon slot only (hand slots come in Task 4)

- [ ] **Step 5: Remove quick slot references from GameManager**

In `autoload/game_manager.gd`:
- In `start_new_run()`, remove any code that initializes quick_slots on units
- In save/load methods, remove quick_slot serialization

- [ ] **Step 6: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot, no parse errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove quick slot system

Remove quick_slots from UnitData, CardPlayController, CardHandUI,
GridInventoryUI, and GameManager. Hand slot loadout is now locked
per battle."
```

---

## Task 3: Add Rarity Enum to ItemData

**Files:**
- Modify: `scripts/resources/item_data.gd`
- Create: `scripts/combat/test_rarity.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_rarity.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    # Test 1: Default rarity is COMMON
    var item = ItemData.new()
    if item.rarity == ItemData.Rarity.COMMON:
        passed += 1
        print("PASS: default rarity is COMMON")
    else:
        failed += 1
        print("FAIL: default rarity is %s, expected COMMON" % item.rarity)

    # Test 2: Rarity round-trips through to_dict/from_dict
    item.rarity = ItemData.Rarity.EPIC
    item.item_name = "Flame Blade"
    var d = item.to_dict()
    var item2 = ItemData.new()
    item2.from_dict(d)
    if item2.rarity == ItemData.Rarity.EPIC:
        passed += 1
        print("PASS: rarity round-trips through save/load")
    else:
        failed += 1
        print("FAIL: rarity after round-trip is %s, expected EPIC" % item2.rarity)

    # Test 3: create_from_dict handles string rarity
    var item3 = ItemData.create_from_dict({"item_name": "Test", "rarity": "RARE"})
    if item3.rarity == ItemData.Rarity.RARE:
        passed += 1
        print("PASS: create_from_dict handles string rarity")
    else:
        failed += 1
        print("FAIL: create_from_dict rarity is %s, expected RARE" % item3.rarity)

    # Test 4: create_from_dict handles int rarity
    var item4 = ItemData.create_from_dict({"item_name": "Test", "rarity": 4})
    if item4.rarity == ItemData.Rarity.LEGENDARY:
        passed += 1
        print("PASS: create_from_dict handles int rarity")
    else:
        failed += 1
        print("FAIL: create_from_dict int rarity is %s, expected LEGENDARY" % item4.rarity)

    # Test 5: All 5 rarity values exist
    var names = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]
    var all_exist = true
    for i in range(5):
        if ItemData.Rarity.values()[i] != i:
            all_exist = false
    if all_exist:
        passed += 1
        print("PASS: all 5 rarity values exist (0-4)")
    else:
        failed += 1
        print("FAIL: rarity enum values don't match 0-4")

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_rarity.gd 2>&1
```

Expected: FAIL — `Rarity` not defined on ItemData.

- [ ] **Step 3: Add Rarity enum and serialization to ItemData**

In `scripts/resources/item_data.gd`:

Add enum after existing enums:
```gdscript
enum Rarity { COMMON, UNCOMMON, RARE, EPIC, LEGENDARY }
```

Add export var:
```gdscript
@export var rarity: Rarity = Rarity.COMMON
```

In `to_dict()`, add:
```gdscript
d["rarity"] = rarity
```

In `from_dict()`, add:
```gdscript
rarity = data.get("rarity", 0)
```

In `create_from_dict()`, add after other enum handling:
```gdscript
var rarity_val = data.get("rarity", 0)
if rarity_val is String:
    match rarity_val:
        "COMMON": item.rarity = Rarity.COMMON
        "UNCOMMON": item.rarity = Rarity.UNCOMMON
        "RARE": item.rarity = Rarity.RARE
        "EPIC": item.rarity = Rarity.EPIC
        "LEGENDARY": item.rarity = Rarity.LEGENDARY
        _: item.rarity = Rarity.COMMON
else:
    item.rarity = rarity_val
```

- [ ] **Step 4: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_rarity.gd 2>&1
```

Expected: 5 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
git add scripts/resources/item_data.gd scripts/combat/test_rarity.gd
git commit -m "feat: add 5-tier Rarity enum to ItemData with serialization"
```

---

## Task 4: Replace equipped_weapon with Hand Slots on UnitData

**Files:**
- Modify: `scripts/resources/unit_data.gd`
- Create: `scripts/combat/test_hand_slots.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_hand_slots.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    # Test 1: Hand slots default to null
    var unit = UnitData.new()
    if unit.hand_left == null and unit.hand_right == null:
        passed += 1
        print("PASS: hand slots default to null")
    else:
        failed += 1
        print("FAIL: hand slots not null by default")

    # Test 2: Equip 1H weapon in left hand
    var sword = ItemData.new()
    sword.item_name = "Iron Sword"
    sword.item_type = ItemData.ItemType.WEAPON
    sword.weapon_type = ItemData.WeaponType.SWORD
    sword.is_two_handed = false
    unit.hand_left = sword
    if unit.hand_left == sword:
        passed += 1
        print("PASS: equip 1H in left hand")
    else:
        failed += 1
        print("FAIL: left hand not set")

    # Test 3: Equip 1H shield in right hand
    var shield = ItemData.new()
    shield.item_name = "Iron Buckler"
    shield.item_type = ItemData.ItemType.WEAPON
    shield.is_two_handed = false
    unit.hand_right = shield
    if unit.hand_right == shield:
        passed += 1
        print("PASS: equip 1H in right hand")
    else:
        failed += 1
        print("FAIL: right hand not set")

    # Test 4: 2H weapon blocks right hand
    var unit2 = UnitData.new()
    var greatsword = ItemData.new()
    greatsword.item_name = "Iron Greatsword"
    greatsword.is_two_handed = true
    unit2.equip_two_handed(greatsword)
    if unit2.hand_left == greatsword and unit2.hand_right == null:
        passed += 1
        print("PASS: 2H weapon in left, right is null")
    else:
        failed += 1
        print("FAIL: 2H equip wrong state")

    # Test 5: is_right_hand_locked returns true for 2H
    if unit2.is_right_hand_locked():
        passed += 1
        print("PASS: right hand locked with 2H weapon")
    else:
        failed += 1
        print("FAIL: right hand not locked")

    # Test 6: Unequip returns old item
    var old = unit.unequip_hand("left")
    if old == sword and unit.hand_left == null:
        passed += 1
        print("PASS: unequip returns old item and clears slot")
    else:
        failed += 1
        print("FAIL: unequip didn't work")

    # Test 7: to_dict/from_dict round-trips hand slots
    var unit3 = UnitData.new()
    var lance = ItemData.new()
    lance.item_name = "Iron Lance"
    lance.item_type = ItemData.ItemType.WEAPON
    lance.weapon_type = ItemData.WeaponType.LANCE
    lance.is_two_handed = false
    var buckler = ItemData.new()
    buckler.item_name = "Iron Buckler"
    buckler.item_type = ItemData.ItemType.WEAPON
    buckler.is_two_handed = false
    unit3.hand_left = lance
    unit3.hand_right = buckler
    unit3.unit_name = "Marcus"
    var d = unit3.to_dict()
    var unit4 = UnitData.new()
    unit4.from_dict(d)
    if unit4.hand_left != null and unit4.hand_left.item_name == "Iron Lance":
        passed += 1
        print("PASS: hand_left round-trips through save/load")
    else:
        failed += 1
        print("FAIL: hand_left lost in save/load")
    if unit4.hand_right != null and unit4.hand_right.item_name == "Iron Buckler":
        passed += 1
        print("PASS: hand_right round-trips through save/load")
    else:
        failed += 1
        print("FAIL: hand_right lost in save/load")

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_hand_slots.gd 2>&1
```

Expected: FAIL — `hand_left` not defined.

- [ ] **Step 3: Implement hand slots on UnitData**

In `scripts/resources/unit_data.gd`:

Replace `equipped_weapon`:
```gdscript
# Remove:
# @export var equipped_weapon: Resource
# var quick_slots: Array[Resource]

# Add:
@export var hand_left: Resource  # ItemData or null
@export var hand_right: Resource  # ItemData or null (locked if hand_left.is_two_handed)
```

Add `is_two_handed` check:
```gdscript
func is_right_hand_locked() -> bool:
    return hand_left != null and hand_left is ItemData and hand_left.is_two_handed

func equip_two_handed(weapon: Resource) -> Array:
    """Equip a 2H weapon. Returns array of [old_left, old_right] items displaced."""
    var old_left = hand_left
    var old_right = hand_right
    hand_left = weapon
    hand_right = null
    return [old_left, old_right]

func unequip_hand(which: String) -> Resource:
    """Unequip from 'left' or 'right'. Returns the removed item."""
    var old: Resource = null
    if which == "left":
        old = hand_left
        hand_left = null
    elif which == "right":
        old = hand_right
        hand_right = null
    return old
```

Add backward-compatible `equipped_weapon` getter (for code that still reads it during migration):
```gdscript
var equipped_weapon: Resource:
    get:
        return hand_left
    set(value):
        hand_left = value
```

Update `to_dict()` — replace the equipped_weapon serialization block:
```gdscript
# Hand slots
if hand_left and hand_left is ItemData:
    d["hand_left"] = hand_left.to_dict()
if hand_right and hand_right is ItemData:
    d["hand_right"] = hand_right.to_dict()
```

Update `from_dict()` — replace equipped_weapon deserialization:
```gdscript
# Hand slots (new format)
if "hand_left" in data and data["hand_left"] is Dictionary:
    hand_left = ItemData.new()
    hand_left.from_dict(data["hand_left"])
elif "equipped_weapon" in data and data["equipped_weapon"] is Dictionary:
    # Migration from old format: weapon goes to left hand
    hand_left = ItemData.new()
    hand_left.from_dict(data["equipped_weapon"])
if "hand_right" in data and data["hand_right"] is Dictionary:
    hand_right = ItemData.new()
    hand_right.from_dict(data["hand_right"])
```

Also add `is_two_handed` to ItemData if not yet present:
```gdscript
# In item_data.gd, add export var:
@export var is_two_handed: bool = false
```

And in ItemData `to_dict()`:
```gdscript
d["is_two_handed"] = is_two_handed
```

And in ItemData `from_dict()`:
```gdscript
is_two_handed = data.get("is_two_handed", false)
```

And in ItemData `create_from_dict()`:
```gdscript
item.is_two_handed = data.get("is_two_handed", false)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_hand_slots.gd 2>&1
```

Expected: 8 passed, 0 failed

- [ ] **Step 5: Update all references to equipped_weapon across codebase**

Search for `equipped_weapon` in all `.gd` files. The backward-compat getter handles reads, but direct writes like `unit.equipped_weapon = weapon` should be changed to `unit.hand_left = weapon`. Key files:
- `autoload/game_manager.gd` — `start_new_run()` where starter weapons are assigned
- `scripts/combat/card_effect_resolver.gd` — reads `caster.equipped_weapon` for might
- `scripts/ui/grid_inventory_ui.gd` — weapon slot display
- `scripts/ui/shop_panel.gd` — sell equipped weapon logic
- `scripts/combat/party_sidebar.gd` — weapon display

For now, the backward-compat getter keeps everything working. Direct migration of each reference happens in later tasks as those files are touched.

- [ ] **Step 6: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot.

- [ ] **Step 7: Commit**

```bash
git add scripts/resources/unit_data.gd scripts/resources/item_data.gd scripts/combat/test_hand_slots.gd
git commit -m "feat: replace equipped_weapon with hand_left/hand_right slots

Two hand slots per unit. 2H weapons lock right hand. Backward-compat
equipped_weapon getter aliases hand_left during migration."
```

---

## Task 5: Add gear_cards to ItemData and Create Gear Card Data

**Files:**
- Modify: `scripts/resources/item_data.gd`
- Create: `data/cards/gear_cards.json`
- Modify: `data/items/item_catalog.json`

- [ ] **Step 1: Add gear_cards field to ItemData**

In `scripts/resources/item_data.gd`, add:
```gdscript
@export var gear_cards: Array = []  # Array of card definition Dictionaries
@export var quiver_modifier: Dictionary = {}  # {"effect": "poison", "value": 2, "duration": 2}
```

In `to_dict()`:
```gdscript
d["gear_cards"] = gear_cards
if not quiver_modifier.is_empty():
    d["quiver_modifier"] = quiver_modifier
```

In `from_dict()`:
```gdscript
gear_cards = data.get("gear_cards", [])
quiver_modifier = data.get("quiver_modifier", {})
```

In `create_from_dict()`:
```gdscript
item.gear_cards = data.get("gear_cards", [])
item.quiver_modifier = data.get("quiver_modifier", {})
```

- [ ] **Step 2: Create gear_cards.json with Borderlands Common/Uncommon weapons**

Create `data/cards/gear_cards.json`. This maps item IDs to their card definitions. Start with Borderlands gear only (Phase 2 adds Thornwood/Ashfall):

```json
{
    "iron_sword": [
        {"card_name": "Slash", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A swift sword strike. Deals {DMG} damage."},
        {"card_name": "Thrust", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 8, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A powerful thrust. Deals {DMG} damage."},
        {"card_name": "Guard Break", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 3, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Strike that shatters armor. Deals {DMG} damage and removes 2 armor.", "effects": [{"type": "destroy_armor", "amount": 2}]}
    ],
    "steel_sword": [
        {"card_name": "Slash", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 6, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A swift sword strike. Deals {DMG} damage."},
        {"card_name": "Thrust", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 11, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A powerful thrust. Deals {DMG} damage."},
        {"card_name": "Guard Break", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Strike that shatters armor. Deals {DMG} damage and removes 3 armor.", "effects": [{"type": "destroy_armor", "amount": 3}]}
    ],
    "iron_lance": [
        {"card_name": "Jab", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 1, "range_max": 2, "description": "A quick lance jab. Deals {DMG} damage. Range 1-2."},
        {"card_name": "Impale", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 10, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Drive the lance deep. Deals {DMG} damage. Melee only."},
        {"card_name": "Brace", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Defensive strike. Deals {DMG} damage and gain 2 armor.", "effects": [{"type": "temp_armor", "amount": 2}]}
    ],
    "steel_lance": [
        {"card_name": "Jab", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 7, "damage_stat": "str", "range_min": 1, "range_max": 2, "description": "A quick lance jab. Deals {DMG} damage. Range 1-2."},
        {"card_name": "Impale", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 14, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Drive the lance deep. Deals {DMG} damage. Melee only."},
        {"card_name": "Brace", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 6, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Defensive strike. Deals {DMG} damage and gain 3 armor.", "effects": [{"type": "temp_armor", "amount": 3}]}
    ],
    "iron_axe": [
        {"card_name": "Chop", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A heavy chop. Deals {DMG} damage."},
        {"card_name": "Wild Swing", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 1, "range_max": 1, "aoe_radius": 1, "description": "Swing wildly! Deals {DMG} damage to target and adjacent enemies."},
        {"card_name": "Rend", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 3, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "Tear through armor. Deals {DMG} damage and destroys 3 armor.", "effects": [{"type": "destroy_armor", "amount": 3}]}
    ],
    "iron_bow": [
        {"card_name": "Quick Shot", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 2, "range_max": 3, "description": "A quick arrow. Deals {DMG} damage. Range 2-3."},
        {"card_name": "Aimed Shot", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 9, "damage_stat": "str", "range_min": 2, "range_max": 3, "description": "Carefully aimed shot. Deals {DMG} damage. Range 2-3."},
        {"card_name": "Volley", "ap_cost": 3, "card_type": "ATTACK", "target_type": "GROUND", "damage_base": 3, "damage_stat": "str", "range_min": 2, "range_max": 3, "aoe_radius": 1, "description": "Rain of arrows in a 3x3 area. Deals {DMG} damage. Range 2-3."}
    ],
    "fire_tome": [
        {"card_name": "Fire", "ap_cost": 1, "card_type": "SPELL", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "mag", "is_magic": true, "range_min": 1, "range_max": 2, "description": "A bolt of flame. Deals {DMG} magic damage. Range 1-2."},
        {"card_name": "Blaze", "ap_cost": 2, "card_type": "SPELL", "target_type": "ENEMY", "damage_base": 8, "damage_stat": "mag", "is_magic": true, "range_min": 1, "range_max": 2, "description": "An intense blaze. Deals {DMG} magic damage. Range 1-2."},
        {"card_name": "Flame Burst", "ap_cost": 2, "card_type": "SPELL", "target_type": "GROUND", "damage_base": 4, "damage_stat": "mag", "is_magic": true, "range_min": 1, "range_max": 2, "aoe_radius": 2, "description": "Burst of fire in a wide area. Deals {DMG} magic damage. Range 1-2."}
    ],
    "heal_staff": [
        {"card_name": "Heal", "ap_cost": 1, "card_type": "SPELL", "target_type": "ALLY", "heal_base": 8, "heal_stat": "mag", "range_min": 1, "range_max": 2, "description": "Restore {HEAL} HP to an ally. Range 1-2."},
        {"card_name": "Restore", "ap_cost": 2, "card_type": "SPELL", "target_type": "ALLY", "heal_base": 15, "heal_stat": "mag", "range_min": 1, "range_max": 2, "description": "A powerful heal. Restore {HEAL} HP to an ally. Range 1-2."},
        {"card_name": "Purify", "ap_cost": 1, "card_type": "SKILL", "target_type": "ALLY", "range_min": 1, "range_max": 2, "description": "Remove all debuffs from an ally. Range 1-2.", "effects": [{"type": "purify"}]}
    ],
    "iron_crossbow": [
        {"card_name": "Crossbow Bolt", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 1, "range_max": 2, "description": "A crossbow bolt. Deals {DMG} damage. Range 1-2."},
        {"card_name": "Heavy Bolt", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 10, "damage_stat": "str", "range_min": 1, "range_max": 2, "description": "A heavy bolt that punches through armor. Deals {DMG} damage and removes 2 armor. Range 1-2.", "effects": [{"type": "destroy_armor", "amount": 2}]},
        {"card_name": "Pinning Shot", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 3, "damage_stat": "str", "range_min": 1, "range_max": 2, "description": "Pin the target in place. Deals {DMG} damage and immobilizes for 1 turn. Range 1-2.", "effects": [{"type": "immobilize", "duration": 1}]}
    ],
    "iron_buckler": [
        {"card_name": "Block", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Raise your shield. Gain 4 armor.", "effects": [{"type": "temp_armor", "amount": 4}]},
        {"card_name": "Parry", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Parry the next attack. Gain 3 armor. Deal 2 damage to next melee attacker.", "effects": [{"type": "temp_armor", "amount": 3}, {"type": "thorns", "amount": 2}]},
        {"card_name": "Deflect", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "A quick deflection. Gain 2 armor.", "effects": [{"type": "temp_armor", "amount": 2}]}
    ],
    "iron_tower_shield": [
        {"card_name": "Fortress", "ap_cost": 2, "card_type": "SKILL", "target_type": "SELF", "description": "Hunker behind your shield. Gain 8 armor.", "effects": [{"type": "temp_armor", "amount": 8}]},
        {"card_name": "Shield Wall", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Shield wall! Gain 4 armor. Adjacent allies gain 2 armor.", "effects": [{"type": "temp_armor", "amount": 4}, {"type": "aoe_ally_armor", "amount": 2}]},
        {"card_name": "Cover", "ap_cost": 1, "card_type": "SKILL", "target_type": "ALLY", "range_min": 1, "range_max": 1, "description": "Redirect the next attack on this ally to you.", "effects": [{"type": "cover"}]}
    ],
    "standard_quiver": [],
    "poison_quiver": [],
    "thunder_quiver": [],
    "ice_quiver": [],
    "explosive_quiver": []
}
```

Note: Quivers have empty gear_cards arrays — they use `quiver_modifier` instead.

- [ ] **Step 3: Update item_catalog.json with rarity and gear_cards reference**

Add `"rarity"` field to every item in `data/items/item_catalog.json`. Add `"gear_cards_id"` field that references the key in `gear_cards.json`. Add `"is_two_handed": false` to all existing items. Example for iron_sword:

```json
"iron_sword": {
    "item_name": "Iron Sword",
    "item_type": "WEAPON",
    "weapon_type": "SWORD",
    "might": 5,
    "range_min": 1, "range_max": 1,
    "grid_width": 1, "grid_height": 3,
    "buy_price": 120, "sell_price": 60,
    "rarity": "COMMON",
    "is_two_handed": false
}
```

Add new shield items to the catalog:
```json
"iron_buckler": {
    "item_name": "Iron Buckler",
    "item_type": "WEAPON",
    "weapon_type": "NONE",
    "might": 0,
    "range_min": 0, "range_max": 0,
    "grid_width": 2, "grid_height": 2,
    "buy_price": 80, "sell_price": 40,
    "rarity": "COMMON",
    "is_two_handed": false
},
"iron_tower_shield": {
    "item_name": "Iron Tower Shield",
    "item_type": "WEAPON",
    "weapon_type": "NONE",
    "might": 0,
    "range_min": 0, "range_max": 0,
    "grid_width": 2, "grid_height": 3,
    "buy_price": 100, "sell_price": 50,
    "rarity": "COMMON",
    "is_two_handed": false
}
```

Add quiver items:
```json
"standard_quiver": {
    "item_name": "Standard Quiver",
    "item_type": "WEAPON",
    "weapon_type": "NONE",
    "might": 0,
    "grid_width": 1, "grid_height": 2,
    "buy_price": 30, "sell_price": 15,
    "rarity": "COMMON",
    "is_two_handed": false,
    "quiver_modifier": {}
},
"poison_quiver": {
    "item_name": "Poison Quiver",
    "item_type": "WEAPON",
    "weapon_type": "NONE",
    "might": 0,
    "grid_width": 1, "grid_height": 2,
    "buy_price": 180, "sell_price": 90,
    "rarity": "UNCOMMON",
    "is_two_handed": false,
    "quiver_modifier": {"effect": "poison", "value": 2, "duration": 2}
}
```

- [ ] **Step 4: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot. DataRegistry loads updated catalogs.

- [ ] **Step 5: Commit**

```bash
git add scripts/resources/item_data.gd data/cards/gear_cards.json data/items/item_catalog.json
git commit -m "feat: add gear_cards data and rarity to item catalog

Each weapon/shield defines card sets in gear_cards.json. Items gain rarity
field. Shields and quivers added to catalog."
```

---

## Task 6: Create Innate Class Card Definitions

**Files:**
- Create: `data/cards/innate_decks.json`
- Modify: `data/cards/class_decks.json` (reduce to innate-only)

- [ ] **Step 1: Create innate_decks.json**

Create `data/cards/innate_decks.json` with 4-5 innate cards per class. These reference card IDs from the existing card catalog or define new inline cards:

```json
{
    "LORD": {
        "innate_cards": [
            {"card_name": "Rally", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Rallying cry! Draw 2 cards.", "effects": [{"type": "draw", "amount": 2}]},
            {"card_name": "Inspiring Strike", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 3, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "An inspiring blow! Deals {DMG} damage and gain 1 AP.", "effects": [{"type": "ap", "amount": 1}]},
            {"card_name": "Nobility", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Steel yourself. Gain 4 temporary armor.", "effects": [{"type": "temp_armor", "amount": 4}]},
            {"card_name": "Lord's Command", "ap_cost": 1, "card_type": "SKILL", "target_type": "ALLY", "range_min": 1, "range_max": 1, "description": "Command an ally. Their next attack deals +3 damage.", "effects": [{"type": "buff_ally_damage", "amount": 3}]}
        ]
    },
    "KNIGHT": {
        "innate_cards": [
            {"card_name": "Fortify", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Brace for impact. Gain 5 armor.", "effects": [{"type": "temp_armor", "amount": 5}]},
            {"card_name": "Bulwark", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Become a bulwark. Enemies must target you next turn.", "effects": [{"type": "taunt", "duration": 1}]},
            {"card_name": "Hold the Line", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Hold the line! You and adjacent allies gain 2 armor.", "effects": [{"type": "temp_armor", "amount": 2}, {"type": "aoe_ally_armor", "amount": 2}]},
            {"card_name": "Shield Expertise", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "Your next Block card this turn has +3 effect.", "effects": [{"type": "boost_next_block", "amount": 3}]}
        ]
    },
    "CAVALIER": {
        "innate_cards": [
            {"card_name": "Gallop", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Spur your mount! Move again this turn.", "effects": [{"type": "extra_move"}]},
            {"card_name": "Charge", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 6, "damage_stat": "str", "range_min": 1, "range_max": 3, "description": "Charge toward an enemy. Deals {DMG} damage.", "effects": [{"type": "move_to_target"}]},
            {"card_name": "Trample", "ap_cost": 2, "card_type": "SKILL", "target_type": "SELF", "description": "Trample enemies! Deal 3 damage to each enemy you move through.", "effects": [{"type": "trample", "damage": 3}]},
            {"card_name": "Swift Strike", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A swift attack! Deals {DMG} damage and gain 1 AP.", "effects": [{"type": "ap", "amount": 1}]}
        ]
    },
    "FIGHTER": {
        "innate_cards": [
            {"card_name": "Battle Cry", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Let loose a battle cry! Draw 2 cards.", "effects": [{"type": "draw", "amount": 2}]},
            {"card_name": "Reckless Blow", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 12, "damage_stat": "str", "range_min": 1, "range_max": 1, "description": "A devastating but reckless strike! Deals {DMG} damage. Take 3 damage.", "effects": [{"type": "self_damage", "amount": 3}]},
            {"card_name": "Axe Mastery", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Channel your fury. Your next attack this turn deals +4 damage.", "effects": [{"type": "boost_next_attack", "amount": 4}]},
            {"card_name": "Berserker Rage", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "When below 50% HP, gain 2 AP.", "effects": [{"type": "conditional_ap", "condition": "below_half_hp", "amount": 2}]}
        ]
    },
    "ARCHER": {
        "innate_cards": [
            {"card_name": "Take Aim", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Focus your aim. Your next ranged attack deals +5 damage.", "effects": [{"type": "boost_next_attack", "amount": 5}]},
            {"card_name": "Pin Down", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 2, "damage_stat": "str", "range_min": 2, "range_max": 3, "description": "Pin the target! Deals {DMG} damage and immobilizes for 1 turn.", "effects": [{"type": "immobilize", "duration": 1}]},
            {"card_name": "Evasion", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Dodge! The next attack against you deals 0 damage.", "effects": [{"type": "dodge_next"}]},
            {"card_name": "Quick Reflexes", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "Quick reflexes! Draw 1 card.", "effects": [{"type": "draw", "amount": 1}]}
        ]
    },
    "MAGE": {
        "innate_cards": [
            {"card_name": "Focus", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Deep focus. Draw 2 cards and gain 1 AP.", "effects": [{"type": "draw", "amount": 2}, {"type": "ap", "amount": 1}]},
            {"card_name": "Arcane Burst", "ap_cost": 2, "card_type": "SPELL", "target_type": "GROUND", "damage_base": 5, "damage_stat": "mag", "is_magic": true, "range_min": 1, "range_max": 2, "aoe_radius": 2, "description": "Arcane explosion! Deals {DMG} magic damage in a 2-tile radius.", "effects": []},
            {"card_name": "Barrier", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "A magical barrier. Gain 4 armor.", "effects": [{"type": "temp_armor", "amount": 4}]},
            {"card_name": "Elemental Mastery", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "Master the elements. Your next spell this turn costs 0 AP.", "effects": [{"type": "next_spell_free"}]}
        ]
    },
    "CLERIC": {
        "innate_cards": [
            {"card_name": "Prayer", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "A quiet prayer. Draw 2 cards.", "effects": [{"type": "draw", "amount": 2}]},
            {"card_name": "Mass Heal", "ap_cost": 2, "card_type": "SPELL", "target_type": "ALL_ALLIES", "heal_base": 5, "heal_stat": "mag", "description": "Heal all allies for {HEAL} HP."},
            {"card_name": "Divine Shield", "ap_cost": 1, "card_type": "SKILL", "target_type": "ALLY", "range_min": 1, "range_max": 2, "description": "Grant divine protection. Ally gains 5 armor.", "effects": [{"type": "temp_armor", "amount": 5}]},
            {"card_name": "Sanctuary", "ap_cost": 2, "card_type": "SKILL", "target_type": "ALLY", "range_min": 1, "range_max": 2, "description": "Sanctuary! Ally takes no damage next enemy turn.", "effects": [{"type": "invulnerable", "duration": 1}]}
        ]
    },
    "THIEF": {
        "innate_cards": [
            {"card_name": "Smoke Bomb", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Vanish in smoke! Become untargetable for 1 turn.", "effects": [{"type": "untargetable", "duration": 1}]},
            {"card_name": "Dodge", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "Dodge! The next attack against you deals 0 damage.", "effects": [{"type": "dodge_next"}]},
            {"card_name": "Steal", "ap_cost": 1, "card_type": "SKILL", "target_type": "ENEMY", "range_min": 1, "range_max": 1, "description": "Steal 10 gold from the enemy.", "effects": [{"type": "steal_gold", "amount": 10}]},
            {"card_name": "Flurry", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF", "description": "A burst of speed! Your next 2 cards this turn cost 0 AP.", "effects": [{"type": "next_n_free", "count": 2}]}
        ]
    },
    "BOUNTY_HUNTER": {
        "innate_cards": [
            {"card_name": "Track Prey", "ap_cost": 1, "card_type": "SKILL", "target_type": "ENEMY", "range_min": 1, "range_max": 3, "description": "Mark your prey! Target takes +3 damage from all sources for 2 turns.", "effects": [{"type": "mark", "bonus_damage": 3, "duration": 2}]},
            {"card_name": "Net Throw", "ap_cost": 1, "card_type": "SKILL", "target_type": "ENEMY", "range_min": 1, "range_max": 2, "description": "Throw a net! Immobilize target for 1 turn.", "effects": [{"type": "immobilize", "duration": 1}]},
            {"card_name": "Capture", "ap_cost": 2, "card_type": "SKILL", "target_type": "ENEMY", "range_min": 1, "range_max": 1, "description": "Attempt to capture. Target must be below 50% HP.", "effects": [{"type": "subdue"}]},
            {"card_name": "Bounty Knowledge", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF", "description": "Study your quarry. If a marked enemy is on the field, draw 2 cards.", "effects": [{"type": "conditional_draw", "condition": "marked_enemy_exists", "amount": 2}]}
        ]
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add data/cards/innate_decks.json
git commit -m "feat: add innate class card definitions (4-5 per class)

Innate cards define class identity independent of equipped gear.
LORD: Rally, Inspiring Strike, Nobility, Lord's Command
KNIGHT: Fortify, Bulwark, Hold the Line, Shield Expertise
...etc for all 9 classes."
```

---

## Task 7: Gear-Based Deck Building in DeckManager

**Files:**
- Modify: `scripts/combat/deck_manager.gd`
- Create: `scripts/combat/test_deck_building.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_deck_building.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    # Setup: create a unit with innate cards + gear
    var unit = UnitData.new()
    unit.unit_class = UnitData.UnitClass.LORD

    # Create innate cards (simulate 4)
    var innate = []
    for i in range(4):
        var c = CardData.new()
        c.card_name = "Innate_%d" % i
        c.source = "innate"
        innate.append(c)

    # Create gear cards for left hand (sword = 3 cards)
    var sword = ItemData.new()
    sword.item_name = "Iron Sword"
    sword.gear_cards = [
        {"card_name": "Slash", "ap_cost": 1, "damage_base": 4, "damage_stat": "str", "card_type": "ATTACK", "target_type": "ENEMY", "range_min": 1, "range_max": 1},
        {"card_name": "Thrust", "ap_cost": 2, "damage_base": 8, "damage_stat": "str", "card_type": "ATTACK", "target_type": "ENEMY", "range_min": 1, "range_max": 1},
        {"card_name": "Guard Break", "ap_cost": 1, "damage_base": 3, "damage_stat": "str", "card_type": "ATTACK", "target_type": "ENEMY", "range_min": 1, "range_max": 1}
    ]
    sword.is_two_handed = false
    unit.hand_left = sword

    # Create gear cards for right hand (buckler = 3 cards)
    var buckler = ItemData.new()
    buckler.item_name = "Iron Buckler"
    buckler.gear_cards = [
        {"card_name": "Block", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF"},
        {"card_name": "Parry", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF"},
        {"card_name": "Deflect", "ap_cost": 0, "card_type": "SKILL", "target_type": "SELF"}
    ]
    buckler.is_two_handed = false
    unit.hand_right = buckler

    # Test 1: build_deck_from_gear returns correct total
    var dm = DeckManager.new()
    var all_cards = dm.build_deck_from_gear(innate, unit)
    if all_cards.size() == 10:  # 4 innate + 3 sword + 3 buckler
        passed += 1
        print("PASS: deck has 10 cards (4 innate + 3 left + 3 right)")
    else:
        failed += 1
        print("FAIL: deck has %d cards, expected 10" % all_cards.size())

    # Test 2: cards have correct source tags
    var innate_count = 0
    var left_count = 0
    var right_count = 0
    for card in all_cards:
        match card.source:
            "innate": innate_count += 1
            "hand_left": left_count += 1
            "hand_right": right_count += 1
    if innate_count == 4 and left_count == 3 and right_count == 3:
        passed += 1
        print("PASS: source tags correct (4 innate, 3 left, 3 right)")
    else:
        failed += 1
        print("FAIL: sources: innate=%d left=%d right=%d" % [innate_count, left_count, right_count])

    # Test 3: Empty right hand (no shield) = fewer cards
    unit.hand_right = null
    var cards_no_right = dm.build_deck_from_gear(innate, unit)
    if cards_no_right.size() == 7:  # 4 innate + 3 sword
        passed += 1
        print("PASS: no right hand = 7 cards")
    else:
        failed += 1
        print("FAIL: no right hand = %d cards, expected 7" % cards_no_right.size())

    # Test 4: 2H weapon = more cards, no right hand contribution
    var greatsword = ItemData.new()
    greatsword.item_name = "Iron Greatsword"
    greatsword.is_two_handed = true
    greatsword.gear_cards = [
        {"card_name": "Heavy Slash", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 7, "damage_stat": "str", "range_min": 1, "range_max": 1},
        {"card_name": "Cleave", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 1, "range_max": 1},
        {"card_name": "Overhead Blow", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 12, "damage_stat": "str", "range_min": 1, "range_max": 1},
        {"card_name": "Whirlwind", "ap_cost": 3, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 7, "damage_stat": "str", "range_min": 1, "range_max": 1},
        {"card_name": "Power Stance", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF"},
        {"card_name": "Guard", "ap_cost": 1, "card_type": "SKILL", "target_type": "SELF"}
    ]
    unit.equip_two_handed(greatsword)
    var cards_2h = dm.build_deck_from_gear(innate, unit)
    if cards_2h.size() == 10:  # 4 innate + 6 greatsword
        passed += 1
        print("PASS: 2H weapon = 10 cards (4 innate + 6 gear)")
    else:
        failed += 1
        print("FAIL: 2H weapon = %d cards, expected 10" % cards_2h.size())

    # Test 5: init_deck shuffles and sets draw pile
    dm.init_deck(cards_2h)
    if dm.get_draw_count() == 10 and dm.hand.is_empty():
        passed += 1
        print("PASS: init_deck sets draw pile correctly")
    else:
        failed += 1
        print("FAIL: draw=%d hand=%d" % [dm.get_draw_count(), dm.hand.size()])

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_deck_building.gd 2>&1
```

Expected: FAIL — `build_deck_from_gear` not defined, `source` not defined on CardData.

- [ ] **Step 3: Add source field to CardData**

In `scripts/resources/card_data.gd`, add:
```gdscript
var source: String = "innate"  # "innate", "hand_left", "hand_right" — set at deck build time, not persisted
```

This is NOT an `@export` and NOT serialized — it's set each time the deck is built.

- [ ] **Step 4: Implement build_deck_from_gear on DeckManager**

In `scripts/combat/deck_manager.gd`, add:
```gdscript
## Build a complete deck from innate cards + gear in hand slots.
## Returns Array[CardData] ready to pass to init_deck().
func build_deck_from_gear(innate_cards: Array, unit: Resource) -> Array:
    var deck: Array = []

    # Add innate cards (duplicated so each battle gets fresh copies)
    for card in innate_cards:
        var c = card.duplicate_card()
        c.source = "innate"
        deck.append(c)

    # Add left hand gear cards
    if unit.hand_left and unit.hand_left is ItemData and unit.hand_left.gear_cards.size() > 0:
        for card_def in unit.hand_left.gear_cards:
            var c = CardData.create_from_dict(card_def)
            c.source = "hand_left"
            deck.append(c)

    # Add right hand gear cards (skip if right hand is locked by 2H weapon)
    if not unit.is_right_hand_locked() and unit.hand_right and unit.hand_right is ItemData and unit.hand_right.gear_cards.size() > 0:
        for card_def in unit.hand_right.gear_cards:
            var c = CardData.create_from_dict(card_def)
            c.source = "hand_right"
            deck.append(c)

    return deck
```

- [ ] **Step 5: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_deck_building.gd 2>&1
```

Expected: 5 passed, 0 failed

- [ ] **Step 6: Commit**

```bash
git add scripts/combat/deck_manager.gd scripts/resources/card_data.gd scripts/combat/test_deck_building.gd
git commit -m "feat: gear-based deck building in DeckManager

build_deck_from_gear() constructs deck from innate cards + hand slot
gear cards. CardData gains source field for tracking card origin."
```

---

## Task 8: Quiver Modifier System

**Files:**
- Modify: `scripts/combat/deck_manager.gd`
- Create: `scripts/combat/test_quiver_modifier.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_quiver_modifier.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    var unit = UnitData.new()
    var innate = []

    # Setup: bow in left hand, poison quiver in right
    var bow = ItemData.new()
    bow.item_name = "Iron Bow"
    bow.weapon_type = ItemData.WeaponType.BOW
    bow.is_two_handed = false
    bow.gear_cards = [
        {"card_name": "Quick Shot", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 2, "range_max": 3},
        {"card_name": "Aimed Shot", "ap_cost": 2, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 9, "damage_stat": "str", "range_min": 2, "range_max": 3}
    ]
    unit.hand_left = bow

    var quiver = ItemData.new()
    quiver.item_name = "Poison Quiver"
    quiver.is_two_handed = false
    quiver.gear_cards = []
    quiver.quiver_modifier = {"effect": "poison", "value": 2, "duration": 2}
    unit.hand_right = quiver

    # Test 1: Quiver modifies bow cards
    var dm = DeckManager.new()
    var deck = dm.build_deck_from_gear(innate, unit)
    var has_poison = false
    for card in deck:
        if card.source == "hand_left" and card.card_name == "Quick Shot":
            for eff in card.effects:
                if eff.get("type") == "poison":
                    has_poison = true
    if has_poison:
        passed += 1
        print("PASS: poison quiver adds poison effect to bow cards")
    else:
        failed += 1
        print("FAIL: bow cards missing poison effect")

    # Test 2: Non-bow weapon in left hand — quiver does nothing
    var sword = ItemData.new()
    sword.item_name = "Iron Sword"
    sword.weapon_type = ItemData.WeaponType.SWORD
    sword.is_two_handed = false
    sword.gear_cards = [
        {"card_name": "Slash", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 4, "damage_stat": "str", "range_min": 1, "range_max": 1}
    ]
    unit.hand_left = sword
    var deck2 = dm.build_deck_from_gear(innate, unit)
    var sword_has_poison = false
    for card in deck2:
        if card.source == "hand_left":
            for eff in card.effects:
                if eff.get("type") == "poison":
                    sword_has_poison = true
    if not sword_has_poison:
        passed += 1
        print("PASS: quiver does not modify non-bow cards")
    else:
        failed += 1
        print("FAIL: sword cards have poison (shouldn't)")

    # Test 3: 2H bow cannot pair with quiver
    var longbow = ItemData.new()
    longbow.item_name = "Longbow"
    longbow.weapon_type = ItemData.WeaponType.BOW
    longbow.is_two_handed = true
    longbow.gear_cards = [
        {"card_name": "Long Shot", "ap_cost": 1, "card_type": "ATTACK", "target_type": "ENEMY", "damage_base": 5, "damage_stat": "str", "range_min": 3, "range_max": 4}
    ]
    unit.equip_two_handed(longbow)
    var deck3 = dm.build_deck_from_gear(innate, unit)
    var longbow_has_poison = false
    for card in deck3:
        for eff in card.effects:
            if eff.get("type") == "poison":
                longbow_has_poison = true
    if not longbow_has_poison:
        passed += 1
        print("PASS: 2H bow blocks quiver (right hand locked)")
    else:
        failed += 1
        print("FAIL: 2H bow somehow got quiver modifier")

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_quiver_modifier.gd 2>&1
```

Expected: FAIL — bow cards don't have poison effect yet.

- [ ] **Step 3: Add quiver modifier application in build_deck_from_gear**

In `scripts/combat/deck_manager.gd`, update `build_deck_from_gear()`. After adding left hand cards, check if right hand has a quiver_modifier and left hand is a BOW:

```gdscript
    # Apply quiver modifier to bow cards (if applicable)
    if not unit.is_right_hand_locked() and unit.hand_right and unit.hand_right is ItemData:
        var qm = unit.hand_right.quiver_modifier
        if not qm.is_empty() and unit.hand_left and unit.hand_left is ItemData:
            if unit.hand_left.weapon_type == ItemData.WeaponType.BOW:
                _apply_quiver_modifier(deck, qm)

## Apply quiver modifier to all hand_left-sourced attack cards
func _apply_quiver_modifier(deck: Array, modifier: Dictionary) -> void:
    var effect_type = modifier.get("effect", "")
    if effect_type == "":
        return
    for card in deck:
        if card.source == "hand_left" and card.damage_base > 0:
            # Add the modifier as an additional effect
            var eff = {"type": effect_type, "value": modifier.get("value", 0), "duration": modifier.get("duration", 0)}
            if not card.effects is Array:
                card.effects = []
            card.effects.append(eff)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_quiver_modifier.gd 2>&1
```

Expected: 3 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
git add scripts/combat/deck_manager.gd scripts/combat/test_quiver_modifier.gd
git commit -m "feat: quiver modifier system for bow cards

Quivers modify all bow-sourced attack cards with their effect (poison,
thunder, ice, explosive). Only applies when paired with a 1H bow."
```

---

## Task 9: Status Effects in CardEffectResolver

**Files:**
- Modify: `scripts/combat/card_effect_resolver.gd`
- Create: `scripts/combat/test_status_effects.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_status_effects.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    # Test 1: Poison applies fixed damage for N turns
    var target = UnitData.new()
    target.current_hp = 30
    target.max_hp = 30
    var resolver = CardEffectResolver.new()
    resolver.apply_status(target, {"type": "poison", "value": 2, "duration": 2})
    if target.status_effects.size() == 1 and target.status_effects[0]["type"] == "poison":
        passed += 1
        print("PASS: poison status applied")
    else:
        failed += 1
        print("FAIL: poison status not found")

    # Test 2: Tick poison deals damage
    var tick_dmg = resolver.tick_status_effects(target)
    if target.current_hp == 28 and tick_dmg == 2:
        passed += 1
        print("PASS: poison tick deals 2 damage (HP: 30 -> 28)")
    else:
        failed += 1
        print("FAIL: HP=%d, tick_dmg=%d" % [target.current_hp, tick_dmg])

    # Test 3: Poison expires after duration
    resolver.tick_status_effects(target)  # second tick
    if target.status_effects.size() == 0:
        passed += 1
        print("PASS: poison expired after 2 ticks")
    else:
        failed += 1
        print("FAIL: poison still active after 2 ticks, %d effects remain" % target.status_effects.size())

    # Test 4: Burn stacks
    var target2 = UnitData.new()
    target2.current_hp = 40
    target2.max_hp = 40
    resolver.apply_status(target2, {"type": "burn", "value": 3, "duration": 2})
    resolver.apply_status(target2, {"type": "burn", "value": 2, "duration": 2})
    if target2.status_effects.size() == 2:
        passed += 1
        print("PASS: burn stacks (2 separate burn effects)")
    else:
        failed += 1
        print("FAIL: burn stack count = %d" % target2.status_effects.size())

    # Test 5: Burn tick deals combined damage
    var burn_dmg = resolver.tick_status_effects(target2)
    if burn_dmg == 5 and target2.current_hp == 35:
        passed += 1
        print("PASS: burn tick deals 5 total (3+2)")
    else:
        failed += 1
        print("FAIL: burn_dmg=%d HP=%d" % [burn_dmg, target2.current_hp])

    # Test 6: Slow reduces SPD
    var target3 = UnitData.new()
    target3.speed = 10
    resolver.apply_status(target3, {"type": "slow", "value": 2, "duration": 1})
    if target3.speed == 8:
        passed += 1
        print("PASS: slow reduces SPD by 2 (10 -> 8)")
    else:
        failed += 1
        print("FAIL: speed=%d, expected 8" % target3.speed)

    # Test 7: Slow expires and SPD restores
    resolver.tick_status_effects(target3)
    if target3.speed == 10:
        passed += 1
        print("PASS: slow expired, SPD restored to 10")
    else:
        failed += 1
        print("FAIL: speed=%d after slow expired, expected 10" % target3.speed)

    # Test 8: Immobilize sets movement to 0
    var target4 = UnitData.new()
    target4.movement = 5
    resolver.apply_status(target4, {"type": "immobilize", "value": 0, "duration": 1})
    if target4.movement == 0:
        passed += 1
        print("PASS: immobilize sets MOV to 0")
    else:
        failed += 1
        print("FAIL: movement=%d, expected 0" % target4.movement)

    # Test 9: Immobilize expires and MOV restores
    resolver.tick_status_effects(target4)
    if target4.movement == 5:
        passed += 1
        print("PASS: immobilize expired, MOV restored to 5")
    else:
        failed += 1
        print("FAIL: movement=%d after immobilize expired, expected 5" % target4.movement)

    # Test 10: Poison does NOT stack (refreshes)
    var target5 = UnitData.new()
    target5.current_hp = 30
    target5.max_hp = 30
    resolver.apply_status(target5, {"type": "poison", "value": 2, "duration": 2})
    resolver.apply_status(target5, {"type": "poison", "value": 3, "duration": 2})
    if target5.status_effects.size() == 1 and target5.status_effects[0]["value"] == 3:
        passed += 1
        print("PASS: poison refreshes with higher value (doesn't stack)")
    else:
        failed += 1
        print("FAIL: poison effects=%d" % target5.status_effects.size())

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_status_effects.gd 2>&1
```

Expected: FAIL — `status_effects` not on UnitData, `apply_status`/`tick_status_effects` not on resolver.

- [ ] **Step 3: Add status_effects array to UnitData**

In `scripts/resources/unit_data.gd`, add:
```gdscript
var status_effects: Array = []  # [{type, value, duration, original_stat_value}, ...]
```

Not persisted (resets each battle). Not an @export.

- [ ] **Step 4: Implement apply_status and tick_status_effects on CardEffectResolver**

In `scripts/combat/card_effect_resolver.gd`, add:

```gdscript
## Apply a status effect to a unit. Deterministic, no RNG.
func apply_status(target: Resource, effect: Dictionary) -> void:
    var effect_type = effect.get("type", "")
    var value = effect.get("value", 0)
    var duration = effect.get("duration", 0)

    match effect_type:
        "poison":
            # Poison does NOT stack — refresh with higher value
            for i in range(target.status_effects.size()):
                if target.status_effects[i]["type"] == "poison":
                    if value >= target.status_effects[i]["value"]:
                        target.status_effects[i]["value"] = value
                        target.status_effects[i]["duration"] = duration
                    return
            target.status_effects.append({"type": "poison", "value": value, "duration": duration})

        "burn":
            # Burn STACKS — multiple burn sources add together
            target.status_effects.append({"type": "burn", "value": value, "duration": duration})

        "slow":
            # Slow does NOT stack — refresh
            for i in range(target.status_effects.size()):
                if target.status_effects[i]["type"] == "slow":
                    target.status_effects[i]["value"] = value
                    target.status_effects[i]["duration"] = duration
                    return
            target.speed -= value
            target.status_effects.append({"type": "slow", "value": value, "duration": duration, "original_speed": target.speed + value})

        "immobilize":
            # Immobilize does NOT stack — refresh
            for i in range(target.status_effects.size()):
                if target.status_effects[i]["type"] == "immobilize":
                    target.status_effects[i]["duration"] = duration
                    return
            var original_mov = target.movement
            target.movement = 0
            target.status_effects.append({"type": "immobilize", "value": 0, "duration": duration, "original_movement": original_mov})


## Tick all status effects at end of unit's turn. Returns total damage dealt.
func tick_status_effects(unit: Resource) -> int:
    var total_damage = 0
    var to_remove = []

    for i in range(unit.status_effects.size()):
        var se = unit.status_effects[i]
        match se["type"]:
            "poison":
                unit.current_hp = max(0, unit.current_hp - se["value"])
                total_damage += se["value"]
            "burn":
                unit.current_hp = max(0, unit.current_hp - se["value"])
                total_damage += se["value"]

        se["duration"] -= 1
        if se["duration"] <= 0:
            # Restore stats if needed
            match se["type"]:
                "slow":
                    unit.speed = se.get("original_speed", unit.speed)
                "immobilize":
                    unit.movement = se.get("original_movement", unit.movement)
            to_remove.append(i)

    # Remove expired effects (reverse order to preserve indices)
    to_remove.reverse()
    for i in to_remove:
        unit.status_effects.remove_at(i)

    return total_damage
```

- [ ] **Step 5: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_status_effects.gd 2>&1
```

Expected: 10 passed, 0 failed

- [ ] **Step 6: Commit**

```bash
git add scripts/resources/unit_data.gd scripts/combat/card_effect_resolver.gd scripts/combat/test_status_effects.gd
git commit -m "feat: deterministic status effects (poison, burn, slow, immobilize)

Poison: fixed dmg/turn, refreshes (no stack). Burn: stacks.
Slow: -SPD, restores on expire. Immobilize: MOV=0, restores on expire.
All fixed numbers, no RNG."
```

---

## Task 10: Update CardPlayController for Gear-Based Decks

**Files:**
- Modify: `scripts/combat/card_play_controller.gd`
- Modify: `autoload/game_manager.gd`

- [ ] **Step 1: Remove weapon compatibility check from CardPlayController**

In `scripts/combat/card_play_controller.gd`:
- Delete the `_is_card_weapon_compatible()` method entirely
- In `_on_card_selected()`, remove the weapon compat check. Cards are always playable if you have enough AP (you only have cards your gear gives you).
- Remove any references to `weapon_type` matching in card selection logic.

- [ ] **Step 2: Update init_decks to use gear-based deck building**

In `scripts/combat/card_play_controller.gd`, find `init_decks()`. Replace the old class-deck-based initialization:

```gdscript
func init_decks(player_units: Array) -> void:
    _deck_managers.clear()
    for unit_node in player_units:
        var unit_data = unit_node.get_unit_data()
        var dm = DeckManager.new()

        # Load innate cards for this class
        var innate = _load_innate_cards(unit_data)

        # Build deck from innate + gear
        var all_cards = dm.build_deck_from_gear(innate, unit_data)
        dm.init_deck(all_cards)
        _deck_managers[unit_node] = dm
```

Add the innate card loader:
```gdscript
func _load_innate_cards(unit_data: Resource) -> Array:
    var innate_data = GameManager.get_innate_deck(unit_data.unit_class)
    var cards = []
    for card_def in innate_data:
        var card = CardData.create_from_dict(card_def)
        cards.append(card)
    return cards
```

- [ ] **Step 3: Add get_innate_deck to GameManager**

In `autoload/game_manager.gd`, add:
```gdscript
var _innate_decks_cache: Dictionary = {}

func get_innate_deck(unit_class: int) -> Array:
    if _innate_decks_cache.is_empty():
        _innate_decks_cache = _load_innate_decks()
    var class_name_str = UnitData.UnitClass.keys()[unit_class]
    return _innate_decks_cache.get(class_name_str, {}).get("innate_cards", [])

func _load_innate_decks() -> Dictionary:
    var file = FileAccess.open("res://data/cards/innate_decks.json", FileAccess.READ)
    if not file:
        push_error("[GameManager] Failed to load innate_decks.json")
        return {}
    var json = JSON.new()
    var err = json.parse(file.get_as_text())
    file.close()
    if err != OK:
        push_error("[GameManager] Failed to parse innate_decks.json")
        return {}
    return json.data
```

- [ ] **Step 4: Remove weapon compat from CardHandUI**

In `scripts/ui/card_hand_ui.gd`:
- Remove `_is_card_weapon_compatible()` method
- In `_refresh_card_playability()`, remove the weapon compat greying. Cards are now greyed out ONLY if AP cost > current AP.
- Remove `quick_slot_used` signal and all quick slot button code (if not already done in Task 2)

- [ ] **Step 5: Update GameManager.start_new_run() for hand slots**

In `autoload/game_manager.gd`, update `start_new_run()` where starter units are created. Replace `equipped_weapon` assignments:

```gdscript
# Roy (LORD) — Iron Sword in left hand
roy.hand_left = ItemData.create_from_dict(catalog.get("iron_sword", {}))
roy.hand_left.gear_cards = gear_cards_data.get("iron_sword", [])
roy.hand_right = null  # No shield to start

# Marcus (KNIGHT) — Iron Lance + Iron Buckler
marcus.hand_left = ItemData.create_from_dict(catalog.get("iron_lance", {}))
marcus.hand_left.gear_cards = gear_cards_data.get("iron_lance", [])
marcus.hand_right = ItemData.create_from_dict(catalog.get("iron_buckler", {}))
marcus.hand_right.gear_cards = gear_cards_data.get("iron_buckler", [])

# Lilina (MAGE) — Fire Tome in left hand
lilina.hand_left = ItemData.create_from_dict(catalog.get("fire_tome", {}))
lilina.hand_left.gear_cards = gear_cards_data.get("fire_tome", [])
lilina.hand_right = null  # No off-hand to start
```

Add gear_cards loader:
```gdscript
var _gear_cards_cache: Dictionary = {}

func _load_gear_cards() -> Dictionary:
    if not _gear_cards_cache.is_empty():
        return _gear_cards_cache
    var file = FileAccess.open("res://data/cards/gear_cards.json", FileAccess.READ)
    if not file:
        push_error("[GameManager] Failed to load gear_cards.json")
        return {}
    var json = JSON.new()
    var err = json.parse(file.get_as_text())
    file.close()
    if err != OK:
        push_error("[GameManager] Failed to parse gear_cards.json")
        return {}
    _gear_cards_cache = json.data
    return _gear_cards_cache
```

- [ ] **Step 6: Remove old _assign_starting_deck**

In `autoload/game_manager.gd`, delete the `_assign_starting_deck()` method and any calls to it. Decks are now built at combat time from gear, not assigned at run start.

- [ ] **Step 7: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire gear-based deck building into combat flow

CardPlayController builds decks from innate + gear cards. Remove weapon
compatibility checks — you only have cards your gear gives. Remove old
_assign_starting_deck. Starter party gets hand slot loadouts."
```

---

## Task 11: Update Grid Inventory UI for Hand Slots

**Files:**
- Modify: `scripts/ui/grid_inventory_ui.gd`

- [ ] **Step 1: Replace weapon + quick slot panels with 2 hand slot panels**

In `scripts/ui/grid_inventory_ui.gd`, find `_refresh_unit_panels()`. Replace the section that builds weapon slot + quick slot drop targets with:

```gdscript
# Hand slot: Left
var left_label = Label.new()
left_label.text = "L Hand"
# ... styling ...
unit_panel.add_child(left_label)

var left_slot = _build_equipment_slot(unit, "left", unit.hand_left)
unit_panel.add_child(left_slot)

# Hand slot: Right
var right_label = Label.new()
right_label.text = "R Hand"
if unit.is_right_hand_locked():
    right_label.text = "R Hand (locked)"
# ... styling ...
unit_panel.add_child(right_label)

if not unit.is_right_hand_locked():
    var right_slot = _build_equipment_slot(unit, "right", unit.hand_right)
    unit_panel.add_child(right_slot)
else:
    var locked_label = Label.new()
    locked_label.text = "[2H weapon]"
    # ... grey styling ...
    unit_panel.add_child(locked_label)
```

- [ ] **Step 2: Update equip/unequip click handlers**

When clicking a hand slot to unequip: call `unit.unequip_hand("left"` or `"right")`, return item to bag via `GameManager.bag_auto_place()`.

When clicking a bag item to equip in a hand slot: check `is_two_handed`. If 2H, call `unit.equip_two_handed(item)` and return both displaced items to bag. If 1H, set `unit.hand_left` or `unit.hand_right` directly, return old item to bag.

- [ ] **Step 3: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot.

- [ ] **Step 4: Commit**

```bash
git add scripts/ui/grid_inventory_ui.gd
git commit -m "feat: update grid inventory UI for 2 hand slots per unit

Replace weapon + quick slot panels with Left Hand / Right Hand slots.
2H weapons lock right hand slot. Equip/unequip handles both slot types."
```

---

## Task 12: Update Save System (Version 0.5.0)

**Files:**
- Modify: `autoload/save_manager.gd`

- [ ] **Step 1: Bump save version to 0.5.0**

In `autoload/save_manager.gd`, change `SAVE_VERSION = "0.5.0"`.

- [ ] **Step 2: Add migration from 0.4.0**

In the migration logic, add a 0.4.0 → 0.5.0 path:

```gdscript
if save_version < "0.5.0":
    # Migrate equipped_weapon -> hand_left, remove quick_slots and sharpness
    if "party" in gm_data:
        for unit_dict in gm_data["party"]:
            # Move equipped_weapon to hand_left
            if "equipped_weapon" in unit_dict:
                unit_dict["hand_left"] = unit_dict["equipped_weapon"]
                unit_dict.erase("equipped_weapon")
            # Remove quick_slots
            if "quick_slots" in unit_dict:
                unit_dict.erase("quick_slots")
            # Remove sharpness from hand items
            for key in ["hand_left", "hand_right"]:
                if key in unit_dict and unit_dict[key] is Dictionary:
                    unit_dict[key].erase("sharpness")
                    unit_dict[key].erase("is_honed")
    # Remove whetstone from bag
    if "bag" in gm_data:
        gm_data["bag"] = gm_data["bag"].filter(
            func(entry): return entry.get("item", {}).get("item_name", "") != "Whetstone"
        )
```

- [ ] **Step 3: Boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add autoload/save_manager.gd
git commit -m "feat: save version 0.5.0 with migration from 0.4.0

Migrates equipped_weapon to hand_left, removes quick_slots and sharpness
fields, strips whetstone from bag."
```

---

## Task 13: Update Damage Formula (Remove weapon.might from CardData)

**Files:**
- Modify: `scripts/resources/card_data.gd`
- Create: `scripts/combat/test_damage_formula.gd`

- [ ] **Step 1: Write the failing test**

Create `scripts/combat/test_damage_formula.gd`:
```gdscript
extends SceneTree

func _init():
    var passed = 0
    var failed = 0

    # Test 1: Damage = card_base + stat (no weapon.might)
    var unit = UnitData.new()
    unit.strength = 6
    var card = CardData.new()
    card.damage_base = 4
    card.damage_stat = "str"
    card.damage_multiplier = 1.0
    var dmg = card.get_computed_damage(unit)
    if dmg == 10:  # 4 + 6 = 10
        passed += 1
        print("PASS: damage = card_base(4) + STR(6) = 10")
    else:
        failed += 1
        print("FAIL: damage = %d, expected 10" % dmg)

    # Test 2: Magic damage uses MAG stat
    unit.magic = 8
    var spell = CardData.new()
    spell.damage_base = 5
    spell.damage_stat = "mag"
    spell.damage_multiplier = 1.0
    spell.is_magic = true
    var magic_dmg = spell.get_computed_damage(unit)
    if magic_dmg == 13:  # 5 + 8 = 13
        passed += 1
        print("PASS: magic damage = card_base(5) + MAG(8) = 13")
    else:
        failed += 1
        print("FAIL: magic damage = %d, expected 13" % magic_dmg)

    # Test 3: No weapon.might in formula (even if weapon equipped)
    var sword = ItemData.new()
    sword.might = 99  # Should NOT affect card damage
    unit.hand_left = sword
    var dmg2 = card.get_computed_damage(unit)
    if dmg2 == 10:  # Still 4 + 6, weapon.might ignored
        passed += 1
        print("PASS: weapon.might ignored in new formula")
    else:
        failed += 1
        print("FAIL: damage = %d, expected 10 (weapon.might should be ignored)" % dmg2)

    # Test 4: Damage multiplier works
    card.damage_multiplier = 2.0
    var dmg3 = card.get_computed_damage(unit)
    if dmg3 == 20:  # (4 + 6) * 2 = 20
        passed += 1
        print("PASS: damage multiplier 2x = 20")
    else:
        failed += 1
        print("FAIL: damage with 2x multiplier = %d, expected 20" % dmg3)

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_damage_formula.gd 2>&1
```

Expected: Test 3 FAIL (weapon.might still being added).

- [ ] **Step 3: Remove weapon.might from get_computed_damage()**

In `scripts/resources/card_data.gd`, update `get_computed_damage()`:

```gdscript
func get_computed_damage(unit) -> int:
    var base = damage_base
    if damage_stat != "" and unit:
        match damage_stat:
            "str": base += unit.strength
            "mag": base += unit.magic
            "skl": base += unit.skill
    return int(base * damage_multiplier)
```

Remove the entire block that reads `unit.equipped_weapon.might` and `sharpness_bonus`.

- [ ] **Step 4: Run test to verify it passes**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script scripts/combat/test_damage_formula.gd 2>&1
```

Expected: 4 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
git add scripts/resources/card_data.gd scripts/combat/test_damage_formula.gd
git commit -m "feat: simplify damage formula — card_base + stat only

Weapon might no longer added to card damage. Damage is baked into each
gear card's base value. Higher rarity gear = higher card damage values."
```

---

## Task 14: Integration Boot Test & Cleanup

**Files:**
- Various — grep for stale references

- [ ] **Step 1: Search for remaining stale references**

Search the codebase for references to removed systems:
```bash
grep -rn "sharpness\|is_honed\|quick_slot\|blacksmith\|whetstone\|weapon_triangle\|get_triangle" scripts/ autoload/ --include="*.gd"
```

Fix any remaining references found. Common fixes:
- Replace `unit.equipped_weapon` reads with `unit.hand_left` where the backward-compat getter isn't sufficient
- Remove any UI that displays sharpness indicators
- Remove blacksmith button from town_menu.gd

- [ ] **Step 2: Full boot test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --quit 2>&1
```

Expected: Clean boot, all autoloads initialize, no warnings about missing methods.

- [ ] **Step 3: Run all test scripts**

```bash
for test in scripts/combat/test_*.gd; do
    echo "=== Running $test ==="
    "E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" --headless --script "$test" 2>&1
    echo ""
done
```

Expected: All tests pass.

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore: cleanup stale references to removed systems

Remove remaining sharpness, quick slot, blacksmith, and weapon triangle
references across the codebase."
```

- [ ] **Step 5: Run game with rendering for visual smoke test**

```bash
"E:/Work/GameDev/Godot/Godot_v4.6-stable_win64_console.exe" --path "E:/Work/GameDev/Godot/fe-mb" 2>&1 &
GODOT_PID=$!
sleep 15
kill $GODOT_PID 2>/dev/null
wait $GODOT_PID 2>/dev/null
```

Expected: Game boots to main menu. No error spam in console output.

- [ ] **Step 6: Final commit with version tag**

```bash
git add -A
git commit -m "milestone: Phase 1 Equipment-Card Foundation complete

Hand slots replace single weapon. Gear contributes cards to deck.
Quiver modifiers. Status effects. 5-tier rarity. Sharpness/quick
slots/blacksmith removed. All tests pass."
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All Phase 1 items from spec sections 2-5 and 8-10 covered (hand slots, gear cards, quiver modifiers, status effects, rarity, systems removed, damage formula)
- [x] **Placeholder scan:** No TBD/TODO. All code blocks are complete.
- [x] **Type consistency:** `hand_left`/`hand_right` used consistently. `gear_cards` is Array of Dictionary. `source` is String. `build_deck_from_gear` signature matches across test and implementation. `quiver_modifier` is Dictionary.
- [x] **Method names:** `build_deck_from_gear`, `apply_status`, `tick_status_effects`, `equip_two_handed`, `unequip_hand`, `is_right_hand_locked` — consistent across all tasks.
