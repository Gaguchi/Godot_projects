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
