extends Node2D
## Battlefield - Main combat scene coordinator
## Delegates to: BattleGrid, BattleInput, EnemyAI, CombatAnimator

signal battle_finished(victory: bool)

const DEBUG_COMBAT: bool = true

enum BattleState {
	PLAYER_TURN,
	ENEMY_TURN,
	ANIMATING,
	SELECTING_TARGET,
	ACTION_MENU,
	BATTLE_END
}

const TILE_SIZE: int = 64
const GRID_WIDTH: int = 10
const GRID_HEIGHT: int = 7

@onready var tilemap: TileMapLayer = $TileMapLayer
@onready var grid_overlay: Node2D = $GridOverlay
@onready var units_container: Node2D = $Units
@onready var turn_banner: Label = $UI/TurnBanner
@onready var unit_info: PanelContainer = $UI/UnitInfo
@onready var action_menu: PanelContainer = $UI/ActionMenu
@onready var combat_forecast: PanelContainer = $UI/CombatForecast
@onready var camera: Camera2D = $Camera2D

## Sub-components
@onready var battle_grid: BattleGrid = $BattleGrid
@onready var battle_input: BattleInput = $BattleInput
@onready var enemy_ai: EnemyAI = $EnemyAI
@onready var combat_animator: CombatAnimator = $CombatAnimator

var camera_speed: float = 400.0
var min_zoom: Vector2 = Vector2(0.5, 0.5)
var max_zoom: Vector2 = Vector2(2.0, 2.0)
var target_zoom: Vector2 = Vector2(1.0, 1.0)
var is_camera_dragging: bool = false
var camera_drag_start: Vector2 = Vector2.ZERO

var UnitScene: PackedScene = preload("res://scenes/units/unit.tscn")

var current_state: BattleState = BattleState.PLAYER_TURN
var player_units: Array = []
var enemy_units: Array = []
var units_acted: Array = []


func _ready() -> void:
	print("[Battlefield] _ready() START")

	# Verify all node references
	print("[Battlefield] battle_grid=%s battle_input=%s enemy_ai=%s combat_animator=%s" % [battle_grid, battle_input, enemy_ai, combat_animator])
	print("[Battlefield] camera=%s units_container=%s grid_overlay=%s" % [camera, units_container, grid_overlay])

	if not battle_grid or not battle_input or not enemy_ai or not combat_animator:
		printerr("[Battlefield] FATAL: One or more components are null! Scene will not work.")
		return

	GameManager.change_state(GameManager.GameState.COMBAT)

	# Configure components
	battle_grid.configure(GRID_WIDTH, GRID_HEIGHT, TILE_SIZE)
	grid_overlay.configure(GRID_WIDTH, GRID_HEIGHT, TILE_SIZE)
	print("[Battlefield] Components configured")

	# Wire up component references
	battle_input.battle_grid = battle_grid
	battle_input.grid_overlay = grid_overlay
	battle_input.units_container = units_container
	battle_input.action_menu = action_menu
	battle_input.unit_info_panel = unit_info
	battle_input.combat_forecast_panel = combat_forecast

	enemy_ai.battle_grid = battle_grid

	combat_animator.battlefield = self
	combat_animator.battle_grid = battle_grid
	print("[Battlefield] References wired up")

	# Connect input signals
	battle_input.unit_selected.connect(_on_unit_selected)
	battle_input.unit_deselected.connect(_on_unit_deselected)
	battle_input.move_requested.connect(_on_move_requested)
	battle_input.attack_requested.connect(_on_attack_requested)
	battle_input.attack_after_move_requested.connect(_on_attack_after_move_requested)
	battle_input.wait_requested.connect(_on_wait_requested)
	battle_input.undo_move_requested.connect(_on_undo_move_requested)
	battle_input.target_selection_cancelled.connect(_on_target_selection_cancelled)

	# Connect UI buttons
	$UI/ActionMenu/VBox/AttackBtn.pressed.connect(battle_input.on_attack_pressed)
	$UI/ActionMenu/VBox/WaitBtn.pressed.connect(battle_input.on_wait_pressed)
	$UI/ActionMenu/VBox/ItemBtn.pressed.connect(battle_input.on_item_pressed)
	print("[Battlefield] Signals connected")

	_clear_placeholder_units()
	GameManager.ensure_party()
	print("[Battlefield] Party size: %d" % GameManager.party.size())
	_spawn_party_units()
	_spawn_enemy_units()

	# Sync grid after spawning
	battle_grid.sync_units_from_container(units_container)
	print("[Battlefield] Units in container: %d, Units in grid: %d" % [units_container.get_child_count(), battle_grid.unit_grid.size()])

	await get_tree().process_frame
	await get_tree().process_frame
	_start_battle()
	print("[Battlefield] _ready() COMPLETE")


var _debug_frame_count: int = 0

func _process(delta: float) -> void:
	_debug_frame_count += 1
	if _debug_frame_count == 1:
		print("[Battlefield] _process() running (first frame). State=%d camera=%s" % [current_state, camera])

	_handle_camera_input(delta)

	if current_state == BattleState.PLAYER_TURN or current_state == BattleState.SELECTING_TARGET:
		battle_input.update_hover()

	# Zoom input - works in all states except BATTLE_END
	if current_state != BattleState.BATTLE_END:
		if Input.is_action_just_pressed("camera_zoom_in"):
			_zoom_camera(0.15)
		elif Input.is_action_just_pressed("camera_zoom_out"):
			_zoom_camera(-0.15)
		# Reset camera to show full grid
		if Input.is_action_just_pressed("camera_reset"):
			_reset_camera_view()


func _input(event: InputEvent) -> void:
	# Middle-mouse drag panning (works in all states except BATTLE_END)
	if event is InputEventMouseButton and current_state != BattleState.BATTLE_END:
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			is_camera_dragging = event.pressed
			if event.pressed:
				camera_drag_start = event.position

	if event is InputEventMouseMotion and is_camera_dragging and camera:
		var drag_delta: Vector2 = event.relative / camera.zoom
		camera.position -= drag_delta
		_clamp_camera_position()

	if current_state == BattleState.PLAYER_TURN or current_state == BattleState.SELECTING_TARGET or current_state == BattleState.ACTION_MENU:
		battle_input.handle_input(event)


# --- Signal Handlers ---

func _on_unit_selected(unit: Node2D) -> void:
	_show_unit_info(unit)
	EventBus.unit_selected.emit(unit)


func _on_unit_deselected() -> void:
	current_state = BattleState.PLAYER_TURN
	battle_input.input_enabled = true


func _on_move_requested(unit: Node2D, target: Vector2i) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var start_pos: Vector2i = battle_grid.world_to_grid(unit.position)
	battle_grid.update_astar_obstacles(start_pos)
	var path: PackedVector2Array = battle_grid.get_grid_path(start_pos, target)

	if path.is_empty():
		unit.position = battle_grid.grid_to_world(target)
	else:
		await combat_animator.animate_movement(unit, path)

	# Update grid tracking
	battle_grid.move_unit(start_pos, target)
	EventBus.unit_moved.emit(unit, start_pos, target)

	# Show action menu
	current_state = BattleState.ACTION_MENU
	battle_input.input_enabled = true
	battle_input.show_action_menu(unit)


func _on_attack_requested(attacker: Node2D, target: Node2D) -> void:
	await _execute_combat(attacker, target)
	units_acted.append(attacker)
	battle_input.units_acted = units_acted
	if attacker.has_method("mark_acted"):
		attacker.mark_acted()
	if not _check_battle_end():
		_check_turn_end()


func _on_attack_after_move_requested(attacker: Node2D, target: Node2D, move_tile: Vector2i) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var start_pos: Vector2i = battle_grid.world_to_grid(attacker.position)
	battle_grid.update_astar_obstacles(start_pos)
	var path: PackedVector2Array = battle_grid.get_grid_path(start_pos, move_tile)

	if path.is_empty():
		attacker.position = battle_grid.grid_to_world(move_tile)
	else:
		await combat_animator.animate_movement(attacker, path)

	battle_grid.move_unit(start_pos, move_tile)
	EventBus.unit_moved.emit(attacker, start_pos, move_tile)

	await _execute_combat(attacker, target)
	units_acted.append(attacker)
	battle_input.units_acted = units_acted
	if attacker.has_method("mark_acted"):
		attacker.mark_acted()
	if not _check_battle_end():
		_check_turn_end()


func _on_wait_requested(unit: Node2D) -> void:
	units_acted.append(unit)
	battle_input.units_acted = units_acted
	if unit.has_method("mark_acted"):
		unit.mark_acted()
	_check_turn_end()


func _on_undo_move_requested() -> void:
	var unit: Node2D = battle_input.selected_unit
	var pre_pos: Vector2i = battle_input.pre_move_position
	if not unit or pre_pos == Vector2i(-1, -1):
		return

	# Move unit back
	var current_pos: Vector2i = battle_grid.world_to_grid(unit.position)
	unit.position = battle_grid.grid_to_world(pre_pos)
	battle_grid.move_unit(current_pos, pre_pos)

	# Reopen selection
	battle_input.is_action_menu_open = false
	battle_input.pre_move_position = Vector2i(-1, -1)
	if action_menu:
		action_menu.visible = false
	current_state = BattleState.PLAYER_TURN
	battle_input.input_enabled = true
	# Re-select the unit to show movement range again
	battle_input._select_unit(unit)


func _on_target_selection_cancelled() -> void:
	_check_turn_end()


# --- Combat ---

func _execute_combat(attacker: Node2D, defender: Node2D) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var atk_data: UnitData = attacker.get_unit_data()
	var def_data: UnitData = defender.get_unit_data()
	var def_pos: Vector2i = battle_grid.world_to_grid(defender.position)

	# Calculate with terrain bonuses
	var forecast: Dictionary = CombatManager.calculate_combat(
		atk_data, def_data,
		battle_grid.get_terrain_def_bonus(def_pos),
		battle_grid.get_terrain_avoid_bonus(def_pos)
	)

	if DEBUG_COMBAT:
		print("[Combat] %s vs %s | Hit:%d%% Dmg:%d Crit:%d%%" % [
			atk_data.unit_name, def_data.unit_name,
			forecast.attacker_hit, forecast.attacker_damage, forecast.attacker_crit
		])

	var result: Dictionary = CombatManager.execute_combat(forecast)

	# Frame both combatants in camera
	_frame_combatants(attacker, defender)

	# Play combat animation
	await combat_animator.play_combat(result, attacker, defender)

	# Handle deaths
	if not result.defender_alive:
		_handle_unit_death(defender, attacker)
	if not result.attacker_alive:
		_handle_unit_death(attacker, null)

	current_state = BattleState.PLAYER_TURN
	battle_input.input_enabled = true


func _handle_unit_death(dead_unit: Node2D, killer: Node2D) -> void:
	var dead_data: UnitData = dead_unit.get_unit_data()
	var dead_pos: Vector2i = battle_grid.world_to_grid(dead_unit.position)

	EventBus.unit_died.emit(dead_unit)
	battle_grid.remove_unit_at(dead_pos)

	if not dead_data.is_player_unit and killer:
		killer.get_unit_data().add_experience(30)

	if dead_data.is_player_unit:
		GameManager.remove_unit(dead_data)

	dead_unit.queue_free()


# --- Turn Flow ---

func _start_battle() -> void:
	print("[Battlefield] Battle started!")
	_gather_units()
	for unit in units_container.get_children():
		if unit.has_method("get_unit_data") and unit.get_unit_data():
			unit.get_unit_data().reset_armor()
	_start_player_turn()


func _gather_units() -> void:
	player_units.clear()
	enemy_units.clear()

	for unit in units_container.get_children():
		if not unit.has_method("get_unit_data"):
			continue
		var data: UnitData = unit.get_unit_data()
		if data == null:
			continue
		if data.is_player_unit:
			player_units.append(unit)
		else:
			enemy_units.append(unit)

	print("[Battlefield] Found %d player units and %d enemy units" % [player_units.size(), enemy_units.size()])


func _start_player_turn() -> void:
	current_state = BattleState.PLAYER_TURN
	units_acted.clear()
	battle_input.units_acted = units_acted
	battle_input.input_enabled = true

	for unit in player_units:
		if unit.has_method("reset_turn"):
			unit.reset_turn()

	_show_turn_banner("Player Phase")
	EventBus.turn_started.emit(true)


func _start_enemy_turn() -> void:
	current_state = BattleState.ENEMY_TURN
	battle_input.input_enabled = false
	units_acted.clear()

	_show_turn_banner("Enemy Phase")
	EventBus.turn_started.emit(false)

	await get_tree().create_timer(0.5).timeout
	_process_enemy_ai()


func _process_enemy_ai() -> void:
	enemy_ai.reset_turn()
	var enemies_to_process: Array = enemy_units.duplicate()

	for enemy in enemies_to_process:
		if not is_instance_valid(enemy):
			continue
		var data: UnitData = enemy.get_unit_data()
		if not data or not data.is_alive():
			continue

		# Sync grid before each enemy acts
		battle_grid.sync_units_from_container(units_container)

		var decision: Dictionary = enemy_ai.decide_action(enemy, player_units, enemy_units)
		var enemy_pos: Vector2i = battle_grid.world_to_grid(enemy.position)

		# Focus camera on acting enemy
		_focus_camera_on(enemy.position)

		match decision.action:
			"attack":
				if decision.move_to != Vector2i(-1, -1):
					battle_grid.update_astar_obstacles(enemy_pos)
					var path: PackedVector2Array = battle_grid.get_grid_path(enemy_pos, decision.move_to)
					if not path.is_empty():
						await combat_animator.animate_movement(enemy, path)
					else:
						enemy.position = battle_grid.grid_to_world(decision.move_to)
					battle_grid.move_unit(enemy_pos, decision.move_to)
					EventBus.unit_moved.emit(enemy, enemy_pos, decision.move_to)
				await _execute_combat(enemy, decision.target)
			"approach":
				battle_grid.update_astar_obstacles(enemy_pos)
				var path: PackedVector2Array = battle_grid.get_grid_path(enemy_pos, decision.move_to)
				if not path.is_empty():
					await combat_animator.animate_movement(enemy, path)
				else:
					enemy.position = battle_grid.grid_to_world(decision.move_to)
				battle_grid.move_unit(enemy_pos, decision.move_to)
				EventBus.unit_moved.emit(enemy, enemy_pos, decision.move_to)
			"idle":
				if DEBUG_COMBAT:
					print("[AI] %s: no action available" % data.unit_name)

		await get_tree().create_timer(0.3).timeout

		if _check_battle_end():
			return

	_end_enemy_turn()


func _end_enemy_turn() -> void:
	if _check_battle_end():
		return
	_start_player_turn()


func _check_turn_end() -> void:
	var all_acted: bool = true
	for unit in player_units:
		if not is_instance_valid(unit):
			continue
		var data: UnitData = unit.get_unit_data()
		if data and data.is_alive() and unit not in units_acted:
			all_acted = false
			break

	if all_acted:
		_start_enemy_turn()


func _check_battle_end() -> bool:
	var players_alive: Array = player_units.filter(func(u): return is_instance_valid(u) and u.get_unit_data() and u.get_unit_data().is_alive())
	var enemies_alive: Array = enemy_units.filter(func(u): return is_instance_valid(u) and u.get_unit_data() and u.get_unit_data().is_alive())

	if players_alive.is_empty():
		_end_battle(false)
		return true
	elif enemies_alive.is_empty():
		_end_battle(true)
		return true
	return false


func _end_battle(victory: bool) -> void:
	current_state = BattleState.BATTLE_END
	battle_input.input_enabled = false
	print("[Battlefield] Battle ended - Victory: ", victory)

	if victory:
		GameManager.battles_won += 1
	GameManager.last_battle_victory = victory

	EventBus.battle_ended.emit(victory)
	battle_finished.emit(victory)

	await get_tree().create_timer(2.0).timeout

	if victory:
		GameManager.change_state(GameManager.GameState.DUNGEON)
		SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
	else:
		print("[Battlefield] Defeat... Run Ended")
		GameManager.end_run(false)
		GameManager.change_state(GameManager.GameState.OVERWORLD)
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")


# --- UI ---

func _show_turn_banner(text: String) -> void:
	turn_banner.text = text
	turn_banner.modulate = Color(1, 1, 1, 0)
	turn_banner.visible = true

	var tween: Tween = create_tween()
	tween.tween_property(turn_banner, "modulate:a", 1.0, 0.25)
	await tween.finished
	await get_tree().create_timer(0.6).timeout

	var fade_out: Tween = create_tween()
	fade_out.tween_property(turn_banner, "modulate:a", 0.0, 0.3)
	await fade_out.finished
	turn_banner.visible = false


func _show_unit_info(unit: Node2D) -> void:
	var data: UnitData = unit.get_unit_data()
	unit_info.visible = true

	var name_label: Label = $UI/UnitInfo/VBox/UnitName
	var class_label: Label = $UI/UnitInfo/VBox/UnitClass
	var hp_bar: ProgressBar = $UI/UnitInfo/VBox/HPBar
	var hp_label: Label = $UI/UnitInfo/VBox/HPLabel

	name_label.text = data.unit_name
	class_label.text = "Class: %s Lv.%d" % [data.get_class_name(), data.level]
	hp_bar.max_value = data.max_hp
	hp_bar.value = data.current_hp
	hp_label.text = "HP: %d/%d" % [data.current_hp, data.max_hp]

	var armor_bar: ProgressBar = $UI/UnitInfo/VBox/ArmorBar
	var armor_label: Label = $UI/UnitInfo/VBox/ArmorLabel
	var weapon_label: Label = $UI/UnitInfo/VBox/WeaponLabel

	if armor_bar:
		armor_bar.max_value = max(1, data.defense)
		armor_bar.value = data.current_armor
		armor_bar.visible = data.defense > 0
	if armor_label:
		armor_label.text = "Armor: %d/%d" % [data.current_armor, data.defense]
		armor_label.visible = data.defense > 0
	if weapon_label:
		if data.equipped_weapon and data.equipped_weapon is ItemData:
			var w: ItemData = data.equipped_weapon as ItemData
			var wname: String = w.item_name if w.item_name != "Item" else w.get_weapon_type_name()
			weapon_label.text = "%s (Atk:%d Hit:%d)" % [wname, w.might, w.hit]
		else:
			weapon_label.text = "Unarmed"


# --- Camera ---

func _handle_camera_input(delta: float) -> void:
	if not camera:
		return

	# Scale pan speed with zoom (pan faster when zoomed in so it feels consistent)
	var direction: Vector2 = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var zoom_factor: float = 1.0 / camera.zoom.x
	camera.position += direction * camera_speed * zoom_factor * delta
	_clamp_camera_position()
	camera.zoom = camera.zoom.lerp(target_zoom, 5.0 * delta)


func _clamp_camera_position() -> void:
	if not camera:
		return
	# Allow panning with margin beyond the grid so edges are reachable when zoomed in
	var margin: float = 64.0
	camera.position = camera.position.clamp(
		Vector2(-margin, -margin),
		Vector2(GRID_WIDTH * TILE_SIZE + margin, GRID_HEIGHT * TILE_SIZE + margin)
	)


func _zoom_camera(amount: float) -> void:
	target_zoom = (target_zoom + Vector2(amount, amount)).clamp(min_zoom, max_zoom)


func _reset_camera_view() -> void:
	# Zoom to fit the entire grid with some padding
	var grid_pixel_size: Vector2 = Vector2(GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE)
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	var fit_zoom: float = minf(viewport_size.x / grid_pixel_size.x, viewport_size.y / grid_pixel_size.y) * 0.95
	target_zoom = Vector2(fit_zoom, fit_zoom).clamp(min_zoom, max_zoom)
	camera.position = grid_pixel_size / 2.0


func _focus_camera_on(pos: Vector2) -> void:
	if not camera:
		return
	var tween: Tween = create_tween()
	tween.tween_property(camera, "position", pos, 0.3).set_trans(Tween.TRANS_QUAD)


func _frame_combatants(a: Node2D, b: Node2D) -> void:
	if not camera or not is_instance_valid(a) or not is_instance_valid(b):
		return
	var midpoint: Vector2 = (a.position + b.position) / 2.0
	var tween: Tween = create_tween()
	tween.tween_property(camera, "position", midpoint, 0.2).set_trans(Tween.TRANS_QUAD)


# --- Unit Spawning ---

func _clear_placeholder_units() -> void:
	for child in units_container.get_children():
		child.queue_free()


func _spawn_party_units() -> void:
	print("[Battlefield] --- Spawning Party Units ---")
	var spawn_points: Array = [
		Vector2i(1, 2), Vector2i(1, 3), Vector2i(1, 4),
		Vector2i(0, 2), Vector2i(0, 3), Vector2i(0, 4)
	]

	for i in range(GameManager.party.size()):
		if i >= spawn_points.size():
			break

		var unit_data: UnitData = GameManager.party[i]
		if unit_data == null or not unit_data.is_alive():
			continue

		var target_grid_pos: Vector2i = spawn_points[i]
		var unit: Node2D = UnitScene.instantiate()
		unit.unit_data = unit_data
		var world_pos: Vector2 = battle_grid.grid_to_world(target_grid_pos)
		unit.position = world_pos
		units_container.add_child(unit)
		print("[Battlefield] Spawned '%s' at Grid %s -> World %s" % [unit_data.unit_name, target_grid_pos, world_pos])


func _spawn_enemy_units() -> void:
	print("[Battlefield] --- Spawning Enemy Units ---")
	var difficulty: int = GameManager.active_dungeon_difficulty if GameManager.has_active_dungeon_state() else 1
	var num_enemies: int = 2 + difficulty

	var enemy_spawns: Array = []
	for x in range(GRID_WIDTH - 3, GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			enemy_spawns.append(Vector2i(x, y))
	enemy_spawns.shuffle()

	var valid_spawns: int = 0
	for i in range(enemy_spawns.size()):
		if valid_spawns >= num_enemies:
			break

		var target_grid_pos: Vector2i = enemy_spawns[i]

		# Check for overlap
		var existing: Node2D = battle_grid.get_unit_at(target_grid_pos)
		if existing:
			continue

		var unit: Node2D = UnitScene.instantiate()
		var enemy_data: UnitData = UnitData.new()
		enemy_data.unit_name = "Enemy %d" % (valid_spawns + 1)
		enemy_data.is_player_unit = false
		enemy_data.max_hp = 15 + (difficulty * 2)
		enemy_data.current_hp = enemy_data.max_hp
		enemy_data.strength = 3 + difficulty
		enemy_data.defense = 1 + int(difficulty / 2.0)
		enemy_data.current_armor = enemy_data.defense

		var weapon: ItemData = ItemData.new()
		weapon.weapon_type = randi() % 3
		weapon.might = 3
		weapon.hit = 80
		weapon.range_max = 1
		enemy_data.equipped_weapon = weapon

		unit.unit_data = enemy_data
		unit.position = battle_grid.grid_to_world(target_grid_pos)
		units_container.add_child(unit)

		# Track in grid immediately for overlap detection
		battle_grid.place_unit(unit, target_grid_pos)

		print("[Battlefield] Spawned '%s' at Grid %s" % [enemy_data.unit_name, target_grid_pos])
		valid_spawns += 1
