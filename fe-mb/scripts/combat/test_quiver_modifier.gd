extends SceneTree

const DeckManagerScript = preload("res://scripts/combat/deck_manager.gd")

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
    var dm = DeckManagerScript.new()
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

    # Test 2: Non-bow weapon — quiver does nothing
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
        print("FAIL: sword cards have poison")

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
        print("FAIL: 2H bow got quiver modifier")

    print("\n%d passed, %d failed" % [passed, failed])
    quit(failed)
