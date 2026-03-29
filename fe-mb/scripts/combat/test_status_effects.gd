extends SceneTree

func _init():
	var passed = 0
	var failed = 0

	var CardEffectResolverScript = preload("res://scripts/combat/card_effect_resolver.gd")

	# Test 1: Poison applies
	var target = UnitData.new()
	target.current_hp = 30
	target.max_hp = 30
	var resolver = CardEffectResolverScript.new()
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
		print("PASS: poison tick deals 2 damage (30->28)")
	else:
		failed += 1
		print("FAIL: HP=%d, tick_dmg=%d" % [target.current_hp, tick_dmg])

	# Test 3: Poison expires after duration
	resolver.tick_status_effects(target)
	if target.status_effects.size() == 0:
		passed += 1
		print("PASS: poison expired after 2 ticks")
	else:
		failed += 1
		print("FAIL: poison still active, %d effects" % target.status_effects.size())

	# Test 4: Burn stacks
	var target2 = UnitData.new()
	target2.current_hp = 40
	target2.max_hp = 40
	resolver.apply_status(target2, {"type": "burn", "value": 3, "duration": 2})
	resolver.apply_status(target2, {"type": "burn", "value": 2, "duration": 2})
	if target2.status_effects.size() == 2:
		passed += 1
		print("PASS: burn stacks (2 separate effects)")
	else:
		failed += 1
		print("FAIL: burn count = %d" % target2.status_effects.size())

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
		print("PASS: slow reduces SPD (10->8)")
	else:
		failed += 1
		print("FAIL: speed=%d expected 8" % target3.speed)

	# Test 7: Slow expires and SPD restores
	resolver.tick_status_effects(target3)
	if target3.speed == 10:
		passed += 1
		print("PASS: slow expired, SPD restored")
	else:
		failed += 1
		print("FAIL: speed=%d expected 10" % target3.speed)

	# Test 8: Immobilize sets MOV to 0
	var target4 = UnitData.new()
	target4.movement = 5
	resolver.apply_status(target4, {"type": "immobilize", "value": 0, "duration": 1})
	if target4.movement == 0:
		passed += 1
		print("PASS: immobilize sets MOV to 0")
	else:
		failed += 1
		print("FAIL: movement=%d expected 0" % target4.movement)

	# Test 9: Immobilize expires and MOV restores
	resolver.tick_status_effects(target4)
	if target4.movement == 5:
		passed += 1
		print("PASS: immobilize expired, MOV restored")
	else:
		failed += 1
		print("FAIL: movement=%d expected 5" % target4.movement)

	# Test 10: Poison does NOT stack (refreshes)
	var target5 = UnitData.new()
	target5.current_hp = 30
	target5.max_hp = 30
	resolver.apply_status(target5, {"type": "poison", "value": 2, "duration": 2})
	resolver.apply_status(target5, {"type": "poison", "value": 3, "duration": 2})
	if target5.status_effects.size() == 1 and target5.status_effects[0]["value"] == 3:
		passed += 1
		print("PASS: poison refreshes with higher value")
	else:
		failed += 1
		print("FAIL: poison effects=%d" % target5.status_effects.size())

	print("\n%d passed, %d failed" % [passed, failed])
	quit(failed)
