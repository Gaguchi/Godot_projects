extends SceneTree

const DeckManagerScript = preload("res://scripts/combat/deck_manager.gd")

func _init():
	var passed = 0
	var failed = 0

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
	var dm = DeckManagerScript.new()
	var all_cards = dm.build_deck_from_gear(innate, unit)
	if all_cards.size() == 10:
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

	# Test 3: Empty right hand = fewer cards
	unit.hand_right = null
	var cards_no_right = dm.build_deck_from_gear(innate, unit)
	if cards_no_right.size() == 7:
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
	if cards_2h.size() == 10:
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
