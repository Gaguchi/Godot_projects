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
