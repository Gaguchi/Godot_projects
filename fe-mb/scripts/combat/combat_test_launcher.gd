extends Control
## Combat Test Launcher — Quick scenario picker for testing capture mechanics
## Run this scene directly (F6) to jump straight into combat

var scenarios: Array = [
	{
		"name": "Solo Capture (25% HP)",
		"desc": "1 weak enemy at 25% HP. One unit adjacent = capturable.",
		"party": "default",
		"enemies": [
			{"name": "Wounded Bandit", "class": "FIGHTER", "hp_pct": 0.25, "pos": Vector2i(4, 5)}
		]
	},
	{
		"name": "Surround Capture (50% HP)",
		"desc": "1 enemy at 50% HP. Need 2 adjacent allies to capture.",
		"party": "default",
		"enemies": [
			{"name": "Cornered Thief", "class": "THIEF", "hp_pct": 0.50, "pos": Vector2i(4, 5)}
		]
	},
	{
		"name": "HP Too High",
		"desc": "1 full HP enemy. Buttons should show disabled with threshold.",
		"party": "default",
		"enemies": [
			{"name": "Healthy Guard", "class": "KNIGHT", "hp_pct": 1.0, "pos": Vector2i(4, 5)}
		]
	},
	{
		"name": "All Captured = Victory",
		"desc": "2 low HP enemies. Capture both to win without killing.",
		"party": "default",
		"enemies": [
			{"name": "Bandit A", "class": "FIGHTER", "hp_pct": 0.20, "pos": Vector2i(4, 4)},
			{"name": "Bandit B", "class": "FIGHTER", "hp_pct": 0.20, "pos": Vector2i(4, 6)}
		]
	},
	{
		"name": "Bounty Hunter Test",
		"desc": "Party has a BOUNTY_HUNTER. Relaxed thresholds (solo at 50%).",
		"party": "bounty_hunter",
		"enemies": [
			{"name": "Wanted Criminal", "class": "FIGHTER", "hp_pct": 0.45, "pos": Vector2i(4, 5)}
		]
	},
]


func _ready() -> void:
	_build_menu()


func _build_menu() -> void:
	# Dark background
	var bg := ColorRect.new()
	bg.color = Color(0.08, 0.06, 0.04)
	bg.set_anchors_preset(PRESET_FULL_RECT)
	add_child(bg)

	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(PRESET_CENTER)
	vbox.offset_left = -300
	vbox.offset_right = 300
	vbox.offset_top = -250
	vbox.offset_bottom = 250
	vbox.add_theme_constant_override("separation", 12)
	add_child(vbox)

	# Title
	var title := Label.new()
	title.text = "COMBAT TEST SCENARIOS"
	title.add_theme_font_size_override("font_size", 24)
	title.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Pick a scenario to test capture mechanics"
	subtitle.add_theme_font_size_override("font_size", 14)
	subtitle.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(subtitle)

	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 10)
	vbox.add_child(spacer)

	# Scenario buttons
	for i in scenarios.size():
		var scenario = scenarios[i]
		var btn := Button.new()
		btn.text = scenario.name
		btn.tooltip_text = scenario.desc
		btn.custom_minimum_size = Vector2(0, 44)

		var style := StyleBoxFlat.new()
		style.bg_color = Color(0.15, 0.10, 0.07, 0.95)
		style.border_color = Color(0.69, 0.44, 0.25)
		style.set_border_width_all(1)
		style.set_corner_radius_all(6)
		style.set_content_margin_all(8)
		btn.add_theme_stylebox_override("normal", style)

		var hover := StyleBoxFlat.new()
		hover.bg_color = Color(0.25, 0.16, 0.10, 0.95)
		hover.border_color = Color(0.9, 0.55, 0.3)
		hover.set_border_width_all(2)
		hover.set_corner_radius_all(6)
		hover.set_content_margin_all(8)
		btn.add_theme_stylebox_override("hover", hover)

		btn.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
		btn.add_theme_color_override("font_hover_color", Color(0.9, 0.55, 0.3))
		btn.add_theme_font_size_override("font_size", 16)

		btn.pressed.connect(_on_scenario_selected.bind(i))
		vbox.add_child(btn)

		# Description label
		var desc := Label.new()
		desc.text = "   " + scenario.desc
		desc.add_theme_font_size_override("font_size", 11)
		desc.add_theme_color_override("font_color", Color(0.45, 0.45, 0.45))
		vbox.add_child(desc)


func _on_scenario_selected(index: int) -> void:
	var scenario: Dictionary = scenarios[index]
	print("[TestLauncher] Selected: %s" % scenario.name)

	# Reset GameManager state
	GameManager.party.clear()
	GameManager.pending_battle = {}
	GameManager.gold = 100
	GameManager._init_bag()
	GameManager.add_food(20)

	# Set up party
	_setup_party(scenario.get("party", "default"))

	# Set up enemies
	var enemies: Array = []
	var spawn_positions: Array = []
	for enemy_def in scenario.enemies:
		var enemy := _create_enemy(enemy_def)
		enemies.append(enemy)
		spawn_positions.append(enemy_def.get("pos", Vector2i(-1, -1)))

	GameManager.pending_battle = {
		"enemies": enemies,
		"difficulty": 1,
		"source": "test",
		"spawn_positions": spawn_positions,
	}

	# Change to battlefield
	get_tree().change_scene_to_file("res://scenes/combat/battlefield.tscn")


func _setup_party(party_type: String) -> void:
	match party_type:
		"bounty_hunter":
			_add_party_unit("Roy", UnitData.UnitClass.LORD, {
				"max_hp": 22, "strength": 6, "speed": 7, "skill": 6,
				"luck": 7, "defense": 5, "resistance": 2
			}, ItemData.WeaponType.SWORD, 5)
			_add_party_unit("Hawk", UnitData.UnitClass.BOUNTY_HUNTER, {
				"max_hp": 24, "strength": 7, "speed": 6, "skill": 8,
				"luck": 5, "defense": 5, "resistance": 3
			}, ItemData.WeaponType.BOW, 6)
			_add_party_unit("Lilina", UnitData.UnitClass.MAGE, {
				"max_hp": 18, "magic": 8, "speed": 6, "skill": 5,
				"luck": 6, "defense": 3, "resistance": 7
			}, ItemData.WeaponType.TOME, 5)
		_:  # "default"
			_add_party_unit("Roy", UnitData.UnitClass.LORD, {
				"max_hp": 22, "strength": 6, "speed": 7, "skill": 6,
				"luck": 7, "defense": 5, "resistance": 2
			}, ItemData.WeaponType.SWORD, 5)
			_add_party_unit("Marcus", UnitData.UnitClass.KNIGHT, {
				"max_hp": 28, "strength": 8, "speed": 4, "skill": 7,
				"luck": 4, "defense": 10, "resistance": 1
			}, ItemData.WeaponType.LANCE, 7)
			_add_party_unit("Lilina", UnitData.UnitClass.MAGE, {
				"max_hp": 18, "magic": 8, "speed": 6, "skill": 5,
				"luck": 6, "defense": 3, "resistance": 7
			}, ItemData.WeaponType.TOME, 5)


func _add_party_unit(uname: String, uclass: UnitData.UnitClass, stats: Dictionary, wtype: ItemData.WeaponType, wmight: int) -> void:
	var u := UnitData.new()
	u.unit_name = uname
	u.unit_class = uclass
	u.is_player_unit = true
	u.max_hp = stats.get("max_hp", 20)
	u.current_hp = u.max_hp
	u.strength = stats.get("strength", 5)
	u.magic = stats.get("magic", 0)
	u.skill = stats.get("skill", 5)
	u.speed = stats.get("speed", 5)
	u.luck = stats.get("luck", 5)
	u.defense = stats.get("defense", 5)
	u.resistance = stats.get("resistance", 2)
	u.movement = stats.get("movement", 5)
	u.current_armor = u.defense if uclass != UnitData.UnitClass.MAGE else 0

	var w := ItemData.new()
	w.weapon_type = wtype
	w.might = wmight
	w.hit = 90
	w.weight = 5
	if wtype == ItemData.WeaponType.TOME or wtype == ItemData.WeaponType.BOW:
		w.range_max = 2
	u.equipped_weapon = w

	GameManager._assign_starting_deck(u)
	GameManager.add_unit(u)


func _create_enemy(def: Dictionary) -> UnitData:
	var class_map := {
		"FIGHTER": UnitData.UnitClass.FIGHTER,
		"THIEF": UnitData.UnitClass.THIEF,
		"KNIGHT": UnitData.UnitClass.KNIGHT,
		"MAGE": UnitData.UnitClass.MAGE,
		"ARCHER": UnitData.UnitClass.ARCHER,
	}

	var e := UnitData.new()
	e.unit_name = def.get("name", "Enemy")
	e.unit_class = class_map.get(def.get("class", "FIGHTER"), UnitData.UnitClass.FIGHTER)
	e.is_player_unit = false
	e.max_hp = def.get("max_hp", 20)
	e.strength = def.get("strength", 6)
	e.magic = def.get("magic", 0)
	e.skill = def.get("skill", 5)
	e.speed = def.get("speed", 5)
	e.luck = def.get("luck", 3)
	e.defense = def.get("defense", 4)
	e.resistance = def.get("resistance", 2)
	e.movement = def.get("movement", 2)  # Low movement so they stay put

	# Set HP to target percentage
	var hp_pct: float = def.get("hp_pct", 1.0)
	e.current_hp = maxi(1, int(e.max_hp * hp_pct))
	e.current_armor = e.defense if e.unit_class != UnitData.UnitClass.MAGE else 0

	# Give a basic weapon
	var w := ItemData.new()
	match e.unit_class:
		UnitData.UnitClass.FIGHTER:
			w.weapon_type = ItemData.WeaponType.AXE
			w.might = 6
		UnitData.UnitClass.THIEF:
			w.weapon_type = ItemData.WeaponType.SWORD
			w.might = 3
		UnitData.UnitClass.KNIGHT:
			w.weapon_type = ItemData.WeaponType.LANCE
			w.might = 7
		UnitData.UnitClass.MAGE:
			w.weapon_type = ItemData.WeaponType.TOME
			w.might = 5
			w.range_max = 2
		_:
			w.weapon_type = ItemData.WeaponType.SWORD
			w.might = 5
	w.hit = 80
	w.weight = 6
	e.equipped_weapon = w

	return e
