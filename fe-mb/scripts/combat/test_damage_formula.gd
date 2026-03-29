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
	if dmg == 10:
		passed += 1
		print("PASS: damage = card_base(4) + STR(6) = 10")
	else:
		failed += 1
		print("FAIL: damage = %d, expected 10" % dmg)

	# Test 2: Magic uses MAG
	unit.magic = 8
	var spell = CardData.new()
	spell.damage_base = 5
	spell.damage_stat = "mag"
	spell.damage_multiplier = 1.0
	spell.is_magic = true
	var magic_dmg = spell.get_computed_damage(unit)
	if magic_dmg == 13:
		passed += 1
		print("PASS: magic = card_base(5) + MAG(8) = 13")
	else:
		failed += 1
		print("FAIL: magic = %d, expected 13" % magic_dmg)

	# Test 3: weapon.might NOT in formula
	var sword = ItemData.new()
	sword.might = 99
	unit.hand_left = sword
	var dmg2 = card.get_computed_damage(unit)
	if dmg2 == 10:
		passed += 1
		print("PASS: weapon.might ignored")
	else:
		failed += 1
		print("FAIL: damage = %d, weapon.might leaked" % dmg2)

	# Test 4: Multiplier works
	card.damage_multiplier = 2.0
	var dmg3 = card.get_computed_damage(unit)
	if dmg3 == 20:
		passed += 1
		print("PASS: 2x multiplier = 20")
	else:
		failed += 1
		print("FAIL: multiplied = %d, expected 20" % dmg3)

	print("\n%d passed, %d failed" % [passed, failed])
	quit(failed)
