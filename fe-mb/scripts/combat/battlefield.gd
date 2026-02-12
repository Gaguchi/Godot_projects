extends Node2D
## Battlefield - Main combat scene coordinator
## Delegates to: BattleGrid, BattleInput, EnemyAI, CombatAnimator
## Uses speed-based individual turn system

signal battle_finished(victory: bool)

const DEBUG_COMBAT: bool = true

enum BattleState {
	IDLE,               # Between turns, processing queue
	PLAYER_UNIT_TURN,   # A player unit is acting
	ENEMY_UNIT_TURN,    # An enemy unit is acting (AI processing)
	ANIMATING,          # Movement/combat animation playing
	SELECTING_TARGET,   # Player choosing attack target after move
	BATTLE_END
}

const TILE_SIZE: int = 64
const GRID_WIDTH: int = 14
const GRID_HEIGHT: int = 10

@onready var tilemap: TileMapLayer = $TileMapLayer
@onready var grid_overlay: Node2D = $GridOverlay
@onready var units_container: Node2D = $Units
@onready var turn_banner: Label = $UI/TurnBanner
@onready var unit_info: PanelContainer = $UI/UnitInfo
@onready var combat_forecast: PanelContainer = $UI/CombatForecast
@onready var camera: Camera2D = $Camera2D
@onready var terrain_info: PanelContainer = $UI/TerrainInfo
@onready var wait_button: Button = $UI/WaitButton
@onready var turn_order_display = $UI/TurnOrderBar
@onready var combat_log = $UI/CombatLog

## Sub-components
@onready var battle_grid: BattleGrid = $BattleGrid
@onready var battle_input: BattleInput = $BattleInput
@onready var enemy_ai: EnemyAI = $EnemyAI
@onready var combat_animator: CombatAnimator = $CombatAnimator

var camera_speed: float = 400.0
var min_zoom: Vector2 = Vector2(0.5, 0.5)
var max_zoom: Vector2 = Vector2(2.0, 2.0)
var target_zoom: Vector2 = Vector2(0.75, 0.75)
var is_camera_dragging: bool = false
var camera_drag_start: Vector2 = Vector2.ZERO
var _camera_tween: Tween = null
var _banner_base_y: float = -1.0

var UnitScene: PackedScene = preload("res://scenes/units/unit.tscn")

var current_state: BattleState = BattleState.IDLE
var player_units: Array = []
var enemy_units: Array = []
var party_sidebar: PartySidebar

## Speed-based turn system
var turn_queue: Array = []
var current_turn_index: int = 0
var active_unit: Node2D = null
var _previous_active_unit: Node2D = null


func _ready() -> void:
	print("[Battlefield] _ready() START")

	if not battle_grid or not battle_input or not enemy_ai or not combat_animator:
		printerr("[Battlefield] FATAL: One or more components are null!")
		return

	GameManager.change_state(GameManager.GameState.COMBAT)

	# Configure components
	battle_grid.configure(GRID_WIDTH, GRID_HEIGHT, TILE_SIZE)
	grid_overlay.configure(GRID_WIDTH, GRID_HEIGHT, TILE_SIZE)

	# Wire up component references
	battle_input.battle_grid = battle_grid
	battle_input.grid_overlay = grid_overlay
	battle_input.units_container = units_container
	battle_input.unit_info_panel = unit_info
	battle_input.combat_forecast_panel = combat_forecast

	enemy_ai.battle_grid = battle_grid

	combat_animator.battlefield = self
	combat_animator.battle_grid = battle_grid

	# Connect input signals
	battle_input.unit_selected.connect(_on_unit_selected)
	battle_input.unit_deselected.connect(_on_unit_deselected)
	battle_input.move_requested.connect(_on_move_requested)
	battle_input.attack_requested.connect(_on_attack_requested)
	battle_input.attack_after_move_requested.connect(_on_attack_after_move_requested)
	battle_input.wait_requested.connect(_on_wait_requested)
	battle_input.undo_move_requested.connect(_on_undo_move_requested)
	battle_input.target_selection_cancelled.connect(_on_target_selection_cancelled)

	# Wait button
	if wait_button:
		wait_button.pressed.connect(_on_wait_button_pressed)
		wait_button.visible = false

	_clear_placeholder_units()
	GameManager.ensure_party()
	_spawn_party_units()
	_spawn_enemy_units()

	battle_grid.sync_units_from_container(units_container)
	print("[Battlefield] Units in container: %d" % units_container.get_child_count())

	# Set up party sidebar
	party_sidebar = PartySidebar.new()
	$UI.add_child(party_sidebar)
	var sidebar_units: Array = []
	for unit in units_container.get_children():
		if unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
			sidebar_units.append(unit)
	party_sidebar.setup(sidebar_units)

	await get_tree().process_frame
	await get_tree().process_frame
	_start_battle()
	print("[Battlefield] _ready() COMPLETE")


func _process(delta: float) -> void:
	_handle_camera_input(delta)

	if current_state == BattleState.PLAYER_UNIT_TURN or current_state == BattleState.SELECTING_TARGET:
		battle_input.update_hover()

	# Terrain info on hover
	if grid_overlay and current_state != BattleState.BATTLE_END:
		_update_terrain_info(grid_overlay.get_hover_tile())

	# Zoom input - works in all states except BATTLE_END
	if current_state != BattleState.BATTLE_END:
		if Input.is_action_just_pressed("camera_zoom_in"):
			_zoom_camera(0.15)
		elif Input.is_action_just_pressed("camera_zoom_out"):
			_zoom_camera(-0.15)
		if Input.is_action_just_pressed("camera_reset"):
			_reset_camera_view()


func _input(event: InputEvent) -> void:
	# Middle-mouse drag panning
	if event is InputEventMouseButton and current_state != BattleState.BATTLE_END:
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			is_camera_dragging = event.pressed
			if event.pressed:
				camera_drag_start = event.position

	if event is InputEventMouseMotion and is_camera_dragging and camera:
		var drag_delta: Vector2 = event.relative / camera.zoom
		camera.position -= drag_delta
		_clamp_camera_position()

	if current_state == BattleState.PLAYER_UNIT_TURN or current_state == BattleState.SELECTING_TARGET:
		battle_input.handle_input(event)


# --- Signal Handlers ---

func _on_unit_selected(unit: Node2D) -> void:
	_show_unit_info(unit)
	EventBus.unit_selected.emit(unit)


func _on_unit_deselected() -> void:
	if current_state == BattleState.PLAYER_UNIT_TURN:
		# Re-select the active unit since it's still their turn
		if active_unit and is_instance_valid(active_unit):
			battle_input.set_active_unit(active_unit)


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

	battle_grid.move_unit(start_pos, target)
	EventBus.unit_moved.emit(unit, start_pos, target)

	# After movement: check for enemies in range
	var enemies_in_range: Array[Vector2i] = battle_grid.get_attackable_enemies(unit)

	if enemies_in_range.is_empty():
		# No enemies reachable - auto-wait
		_finish_unit_turn(unit)
	else:
		# Enemies in range - enter target selection
		current_state = BattleState.SELECTING_TARGET
		battle_input.input_enabled = true
		battle_input.enter_target_selection_after_move(unit, enemies_in_range)


func _on_attack_requested(attacker: Node2D, target: Node2D) -> void:
	await _execute_combat(attacker, target)
	if is_instance_valid(attacker) and attacker.has_method("mark_acted"):
		attacker.mark_acted()
	if not _check_battle_end():
		_advance_turn()


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
	if is_instance_valid(attacker) and attacker.has_method("mark_acted"):
		attacker.mark_acted()
	if not _check_battle_end():
		_advance_turn()


func _on_wait_requested(unit: Node2D) -> void:
	_finish_unit_turn(unit)


func _on_wait_button_pressed() -> void:
	if active_unit and current_state == BattleState.PLAYER_UNIT_TURN:
		battle_input.deselect_unit()
		_finish_unit_turn(active_unit)


func _on_target_selection_cancelled() -> void:
	# Return to the active unit's turn
	current_state = BattleState.PLAYER_UNIT_TURN
	if active_unit and is_instance_valid(active_unit):
		battle_input.input_enabled = true
		battle_input.set_active_unit(active_unit)


func _on_undo_move_requested() -> void:
	var unit: Node2D = battle_input.selected_unit
	var pre_pos: Vector2i = battle_input.pre_move_position
	if not unit or pre_pos == Vector2i(-1, -1):
		return

	var current_pos: Vector2i = battle_grid.world_to_grid(unit.position)
	unit.position = battle_grid.grid_to_world(pre_pos)
	battle_grid.move_unit(current_pos, pre_pos)

	battle_input.pre_move_position = Vector2i(-1, -1)
	current_state = BattleState.PLAYER_UNIT_TURN
	battle_input.input_enabled = true
	battle_input.set_active_unit(unit)


## Finish a unit's turn (mark acted, advance queue)
func _finish_unit_turn(unit: Node2D) -> void:
	if is_instance_valid(unit) and unit.has_method("mark_acted"):
		unit.mark_acted()
	_advance_turn()


# --- Combat ---

func _execute_combat(attacker: Node2D, defender: Node2D) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var atk_data: UnitData = attacker.get_unit_data()
	var def_data: UnitData = defender.get_unit_data()
	var def_pos: Vector2i = battle_grid.world_to_grid(defender.position)

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

	# Log combat results
	if combat_log:
		for entry in result.log:
			var is_player: bool = atk_data.is_player_unit if entry.attacker == atk_data.unit_name else def_data.is_player_unit
			if entry.hit:
				combat_log.log_attack(entry.attacker, entry.defender, entry.damage, entry.crit, is_player)
			else:
				combat_log.log_miss(entry.attacker, entry.defender, is_player)

	var frame_tween: Tween = _frame_combatants(attacker, defender)
	if frame_tween:
		await frame_tween.finished

	await combat_animator.play_combat(result, attacker, defender)

	if not result.defender_alive:
		_handle_unit_death(defender, attacker)
	if not result.attacker_alive:
		_handle_unit_death(attacker, null)

	# Refresh party sidebar after combat
	if party_sidebar:
		var sidebar_units: Array = []
		for unit in units_container.get_children():
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
				sidebar_units.append(unit)
		party_sidebar.update_units(sidebar_units)


func _handle_unit_death(dead_unit: Node2D, killer: Node2D) -> void:
	var dead_data: UnitData = dead_unit.get_unit_data()
	var dead_pos: Vector2i = battle_grid.world_to_grid(dead_unit.position)

	EventBus.unit_died.emit(dead_unit)
	battle_grid.remove_unit_at(dead_pos)

	if combat_log:
		combat_log.log_death(dead_data.unit_name, dead_data.is_player_unit)

	# Remove from turn queue so freed instances don't linger
	var idx: int = turn_queue.find(dead_unit)
	if idx != -1:
		turn_queue.remove_at(idx)
		if idx < current_turn_index:
			current_turn_index -= 1

	if not dead_data.is_player_unit and killer:
		var gains: Dictionary = killer.get_unit_data().add_experience(30)
		if not gains.is_empty():
			EventBus.unit_leveled_up.emit(killer.get_unit_data(), gains)
			if combat_log:
				combat_log.log_level_up(killer.get_unit_data().unit_name, gains)
			await _show_level_up_notification(killer.get_unit_data(), gains)

	if dead_data.is_player_unit:
		GameManager.remove_unit(dead_data)

	# Update party sidebar on death
	if party_sidebar:
		var sidebar_units: Array = []
		for unit in units_container.get_children():
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
				sidebar_units.append(unit)
		party_sidebar.update_units(sidebar_units)

	dead_unit.queue_free()


# --- Speed-Based Turn System ---

func _start_battle() -> void:
	print("[Battlefield] Battle started!")
	_gather_units()
	for unit in units_container.get_children():
		if unit.has_method("get_unit_data") and unit.get_unit_data():
			unit.get_unit_data().reset_armor()
	_build_turn_queue()
	if combat_log:
		combat_log.log_system("Battle Start")
	_show_turn_banner("Battle Start")
	await get_tree().create_timer(0.3).timeout
	_advance_turn()


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


func _build_turn_queue() -> void:
	turn_queue.clear()
	var all_units: Array = []

	for unit in units_container.get_children():
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue
		var data: UnitData = unit.get_unit_data()
		if data and data.is_alive():
			all_units.append(unit)
			if unit.has_method("reset_turn"):
				unit.reset_turn()

	# Sort by speed descending; player units break ties
	all_units.sort_custom(func(a: Node2D, b: Node2D) -> bool:
		var sa: int = a.get_unit_data().speed
		var sb: int = b.get_unit_data().speed
		if sa != sb:
			return sa > sb
		if a.get_unit_data().is_player_unit != b.get_unit_data().is_player_unit:
			return a.get_unit_data().is_player_unit
		return a.position.x < b.position.x
	)

	turn_queue = all_units
	current_turn_index = 0
	enemy_ai.reset_turn()

	if DEBUG_COMBAT:
		var order_str: String = ""
		for u in turn_queue:
			var d: UnitData = u.get_unit_data()
			order_str += "%s(spd%d) " % [d.unit_name, d.speed]
		print("[Battlefield] Turn order: %s" % order_str)


func _advance_turn() -> void:
	# Clear previous active unit highlight
	if is_instance_valid(_previous_active_unit):
		if _previous_active_unit.has_method("set_active_turn"):
			_previous_active_unit.set_active_turn(false)

	# Skip dead/invalid units (use untyped var to avoid freed instance assignment error)
	while current_turn_index < turn_queue.size():
		var candidate = turn_queue[current_turn_index]
		if is_instance_valid(candidate) and candidate.get_unit_data() and candidate.get_unit_data().is_alive():
			break
		current_turn_index += 1

	# All units acted - new round
	if current_turn_index >= turn_queue.size():
		_build_turn_queue()
		if turn_queue.is_empty():
			return

	active_unit = turn_queue[current_turn_index]
	current_turn_index += 1
	_previous_active_unit = active_unit

	# Highlight active unit
	if is_instance_valid(active_unit) and active_unit.has_method("set_active_turn"):
		active_unit.set_active_turn(true)

	# Update turn order display
	_update_turn_order_display()

	var data: UnitData = active_unit.get_unit_data()

	# Update party sidebar active indicator
	if party_sidebar:
		if data.is_player_unit:
			party_sidebar.set_active(active_unit)
		else:
			party_sidebar.clear_active()

	if data.is_player_unit:
		_start_player_unit_turn(active_unit)
	else:
		_start_enemy_unit_turn(active_unit)


func _start_player_unit_turn(unit: Node2D) -> void:
	current_state = BattleState.PLAYER_UNIT_TURN
	battle_input.input_enabled = true

	# Focus camera on the unit
	var cam_tween: Tween = _focus_camera_on(unit.position)
	if cam_tween:
		await cam_tween.finished

	battle_input.set_active_unit(unit)
	_show_unit_info(unit)

	if wait_button:
		wait_button.visible = true

	if DEBUG_COMBAT:
		print("[Turn] %s's turn (Player)" % unit.get_unit_data().unit_name)


func _start_enemy_unit_turn(unit: Node2D) -> void:
	current_state = BattleState.ENEMY_UNIT_TURN
	battle_input.input_enabled = false

	if wait_button:
		wait_button.visible = false

	# Focus camera and wait for it to settle
	var cam_tween: Tween = _focus_camera_on(unit.position)
	if cam_tween:
		await cam_tween.finished
	await get_tree().create_timer(0.4).timeout

	if DEBUG_COMBAT:
		print("[Turn] %s's turn (Enemy)" % unit.get_unit_data().unit_name)

	_process_single_enemy(unit)


func _process_single_enemy(enemy: Node2D) -> void:
	if not is_instance_valid(enemy):
		_advance_turn()
		return

	var data: UnitData = enemy.get_unit_data()
	if not data or not data.is_alive():
		_advance_turn()
		return

	battle_grid.sync_units_from_container(units_container)
	var decision: Dictionary = enemy_ai.decide_action(enemy, player_units, enemy_units)
	var enemy_pos: Vector2i = battle_grid.world_to_grid(enemy.position)

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

	if is_instance_valid(enemy) and enemy.has_method("mark_acted"):
		enemy.mark_acted()

	if not _check_battle_end():
		_advance_turn()


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
	if wait_button:
		wait_button.visible = false

	# Clear active unit highlight
	if active_unit and is_instance_valid(active_unit) and active_unit.has_method("set_active_turn"):
		active_unit.set_active_turn(false)

	print("[Battlefield] Battle ended - Victory: ", victory)

	if combat_log:
		combat_log.log_system("Victory!" if victory else "Defeat...")

	_show_turn_banner("Victory!" if victory else "Defeat...")

	if victory:
		GameManager.battles_won += 1
	GameManager.last_battle_victory = victory

	EventBus.battle_ended.emit(victory)
	battle_finished.emit(victory)

	await get_tree().create_timer(2.0).timeout

	# Determine return destination based on combat source
	var source = GameManager.pending_battle.get("source", "")
	GameManager.pending_battle = {}  # Clear combat context

	if victory:
		match source:
			"dungeon":
				GameManager.change_state(GameManager.GameState.DUNGEON)
				SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
			"overworld", _:
				GameManager.change_state(GameManager.GameState.OVERWORLD)
				SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
	else:
		print("[Battlefield] Defeat... Run Ended")
		GameManager.end_run(false)
		GameManager.change_state(GameManager.GameState.OVERWORLD)
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")


# --- UI ---

func _show_turn_banner(text: String) -> void:
	if not turn_banner:
		return
	turn_banner.text = text
	turn_banner.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	turn_banner.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	turn_banner.modulate = Color(1, 1, 1, 0)
	turn_banner.visible = true

	# Store original Y for slide animation (only once to prevent drift)
	if _banner_base_y < 0:
		_banner_base_y = turn_banner.position.y
	turn_banner.position.y = _banner_base_y + 10
	var base_y: float = _banner_base_y

	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(turn_banner, "modulate:a", 1.0, 0.25)
	tween.tween_property(turn_banner, "position:y", base_y, 0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
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
	name_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	class_label.text = "Class: %s Lv.%d" % [data.get_class_name(), data.level]
	class_label.add_theme_color_override("font_color", Color(0.478, 0.463, 0.439))
	hp_bar.max_value = data.max_hp
	hp_bar.value = data.current_hp
	# Tri-color HP bar: green >50%, ember 25-50%, red <25%
	var hp_ratio: float = float(data.current_hp) / float(data.max_hp) if data.max_hp > 0 else 1.0
	var hp_fill_style: StyleBoxFlat = StyleBoxFlat.new()
	hp_fill_style.corner_radius_top_left = 3
	hp_fill_style.corner_radius_top_right = 3
	hp_fill_style.corner_radius_bottom_left = 3
	hp_fill_style.corner_radius_bottom_right = 3
	if hp_ratio > 0.5:
		hp_fill_style.bg_color = Color(0.353, 0.541, 0.353)  # Moss green
	elif hp_ratio > 0.25:
		hp_fill_style.bg_color = Color(0.69, 0.44, 0.25)  # Ember
	else:
		hp_fill_style.bg_color = Color(0.769, 0.267, 0.267)  # Blood red
	hp_bar.add_theme_stylebox_override("fill", hp_fill_style)
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
		weapon_label.add_theme_color_override("font_color", Color(0.478, 0.463, 0.439))
		if data.equipped_weapon and data.equipped_weapon is ItemData:
			var w: ItemData = data.equipped_weapon as ItemData
			var wname: String = w.item_name if w.item_name != "Item" else w.get_weapon_type_name()
			weapon_label.text = "%s (Atk:%d Hit:%d)" % [wname, w.might, w.hit]
		else:
			weapon_label.text = "Unarmed"

	# Stat grid
	var str_label: Label = $UI/UnitInfo/VBox/StatGrid/STRLabel
	var spd_label: Label = $UI/UnitInfo/VBox/StatGrid/SPDLabel
	var def_label: Label = $UI/UnitInfo/VBox/StatGrid/DEFLabel
	var mov_label: Label = $UI/UnitInfo/VBox/StatGrid/MOVLabel
	if str_label:
		str_label.text = "STR:%d" % data.strength
		str_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	if spd_label:
		spd_label.text = "SPD:%d" % data.speed
		spd_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	if def_label:
		def_label.text = "DEF:%d" % data.defense
		def_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	if mov_label:
		mov_label.text = "MOV:%d" % data.movement
		mov_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))

	# EXP (player units only)
	var exp_bar: ProgressBar = $UI/UnitInfo/VBox/EXPBar
	var exp_label: Label = $UI/UnitInfo/VBox/EXPLabel
	if exp_bar:
		exp_bar.max_value = UnitData.EXP_TO_LEVEL
		exp_bar.value = data.experience
		exp_bar.visible = data.is_player_unit
	if exp_label:
		exp_label.text = "EXP: %d/%d" % [data.experience, UnitData.EXP_TO_LEVEL]
		exp_label.add_theme_color_override("font_color", Color(0.69, 0.44, 0.25))
		exp_label.visible = data.is_player_unit


func _update_terrain_info(grid_pos: Vector2i) -> void:
	if not terrain_info or not battle_grid.is_in_bounds(grid_pos):
		if terrain_info:
			terrain_info.visible = false
		return

	var terrain: BattleGrid.TerrainType = battle_grid.get_terrain(grid_pos)
	var def_bonus: int = battle_grid.get_terrain_def_bonus(grid_pos)
	var avoid_bonus: int = battle_grid.get_terrain_avoid_bonus(grid_pos)

	var terrain_name: String
	match terrain:
		BattleGrid.TerrainType.PLAIN: terrain_name = "Plain"
		BattleGrid.TerrainType.FOREST: terrain_name = "Forest"
		BattleGrid.TerrainType.MOUNTAIN: terrain_name = "Mountain"
		BattleGrid.TerrainType.FORT: terrain_name = "Fort"
		BattleGrid.TerrainType.WATER: terrain_name = "Water"
		_: terrain_name = "Unknown"

	var name_lbl: Label = terrain_info.get_node("HBox/TerrainName")
	var def_lbl: Label = terrain_info.get_node("HBox/DefBonus")
	var avo_lbl: Label = terrain_info.get_node("HBox/AvoBonus")

	if name_lbl:
		name_lbl.text = terrain_name
		name_lbl.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	if def_lbl:
		def_lbl.text = "DEF+%d" % def_bonus
		def_lbl.add_theme_color_override("font_color", Color(0.353, 0.541, 0.353) if def_bonus > 0 else Color(0.478, 0.463, 0.439))
	if avo_lbl:
		avo_lbl.text = "AVO+%d" % avoid_bonus
		avo_lbl.add_theme_color_override("font_color", Color(0.353, 0.541, 0.353) if avoid_bonus > 0 else Color(0.478, 0.463, 0.439))

	terrain_info.visible = true


func _update_turn_order_display() -> void:
	if turn_order_display and turn_order_display.has_method("update_queue"):
		turn_order_display.update_queue(turn_queue, current_turn_index - 1)


func _show_level_up_notification(unit_data: UnitData, gains: Dictionary) -> void:
	var panel: PanelContainer = PanelContainer.new()
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.055, 0.08, 0.95)
	style.border_color = Color(0.69, 0.44, 0.25)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)

	var vbox: VBoxContainer = VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER

	var title: Label = Label.new()
	title.text = "%s leveled up to Lv.%d!" % [unit_data.unit_name, unit_data.level]
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color(0.69, 0.44, 0.25))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(title)

	var gains_text: String = ""
	for stat in gains:
		if gains[stat] > 0:
			gains_text += "%s+%d  " % [stat.to_upper(), gains[stat]]
	if gains_text.is_empty():
		gains_text = "No stat gains"

	var gains_label: Label = Label.new()
	gains_label.text = gains_text.strip_edges()
	gains_label.add_theme_font_size_override("font_size", 14)
	gains_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	gains_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(gains_label)

	panel.add_child(vbox)
	$UI.add_child(panel)

	# Center on screen
	panel.anchors_preset = Control.PRESET_CENTER
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH

	# Animate: fade in, hold, fade out
	panel.modulate = Color(1, 1, 1, 0)
	var tween: Tween = create_tween()
	tween.tween_property(panel, "modulate:a", 1.0, 0.2)
	tween.tween_interval(1.5)
	tween.tween_property(panel, "modulate:a", 0.0, 0.3)
	await tween.finished
	panel.queue_free()


# --- Camera ---

func _handle_camera_input(delta: float) -> void:
	if not camera:
		return

	var direction: Vector2 = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var zoom_factor: float = 1.0 / camera.zoom.x
	camera.position += direction * camera_speed * zoom_factor * delta
	_clamp_camera_position()
	camera.zoom = camera.zoom.lerp(target_zoom, 5.0 * delta)


func _clamp_camera_position() -> void:
	if not camera:
		return
	var margin: float = 64.0
	camera.position = camera.position.clamp(
		Vector2(-margin, -margin),
		Vector2(GRID_WIDTH * TILE_SIZE + margin, GRID_HEIGHT * TILE_SIZE + margin)
	)


func _zoom_camera(amount: float) -> void:
	target_zoom = (target_zoom + Vector2(amount, amount)).clamp(min_zoom, max_zoom)


func _reset_camera_view() -> void:
	var grid_pixel_size: Vector2 = Vector2(GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE)
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	var fit_zoom: float = minf(viewport_size.x / grid_pixel_size.x, viewport_size.y / grid_pixel_size.y) * 0.95
	target_zoom = Vector2(fit_zoom, fit_zoom).clamp(min_zoom, max_zoom)
	camera.position = grid_pixel_size / 2.0


func _focus_camera_on(pos: Vector2) -> Tween:
	if not camera:
		return null
	if _camera_tween and _camera_tween.is_running():
		_camera_tween.kill()
	_camera_tween = create_tween()
	_camera_tween.tween_property(camera, "position", pos, 0.3).set_trans(Tween.TRANS_QUAD)
	return _camera_tween


func _frame_combatants(a: Node2D, b: Node2D) -> Tween:
	if not camera or not is_instance_valid(a) or not is_instance_valid(b):
		return null
	var midpoint: Vector2 = (a.position + b.position) / 2.0
	if _camera_tween and _camera_tween.is_running():
		_camera_tween.kill()
	_camera_tween = create_tween()
	_camera_tween.tween_property(camera, "position", midpoint, 0.2).set_trans(Tween.TRANS_QUAD)
	return _camera_tween


# --- Unit Spawning ---

func _clear_placeholder_units() -> void:
	for child in units_container.get_children():
		child.queue_free()


func _spawn_party_units() -> void:
	print("[Battlefield] --- Spawning Party Units ---")
	var spawn_points: Array = [
		Vector2i(1, 3), Vector2i(1, 5), Vector2i(1, 7),
		Vector2i(2, 3), Vector2i(2, 5), Vector2i(2, 7)
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
		unit.position = battle_grid.grid_to_world(target_grid_pos)
		units_container.add_child(unit)
		print("[Battlefield] Spawned '%s' at Grid %s (spd %d)" % [unit_data.unit_name, target_grid_pos, unit_data.speed])


func _spawn_enemy_units() -> void:
	print("[Battlefield] --- Spawning Enemy Units ---")

	# Check for pre-built enemies from pending_battle (overworld/dungeon context)
	var pending_enemies: Array = []
	if not GameManager.pending_battle.is_empty():
		pending_enemies = GameManager.pending_battle.get("enemies", [])

	# Build spawn positions
	var enemy_spawns: Array = []
	for x in range(GRID_WIDTH - 3, GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			enemy_spawns.append(Vector2i(x, y))
	enemy_spawns.shuffle()

	if not pending_enemies.is_empty():
		# Use pre-built enemy data from GameManager.pending_battle
		var valid_spawns: int = 0
		for enemy_data in pending_enemies:
			if valid_spawns >= enemy_spawns.size():
				break

			var target_grid_pos: Vector2i = enemy_spawns[valid_spawns]
			var existing: Node2D = battle_grid.get_unit_at(target_grid_pos)
			if existing:
				valid_spawns += 1
				continue

			var unit: Node2D = UnitScene.instantiate()
			unit.unit_data = enemy_data
			unit.position = battle_grid.grid_to_world(target_grid_pos)
			units_container.add_child(unit)
			battle_grid.place_unit(unit, target_grid_pos)
			print("[Battlefield] Spawned '%s' at Grid %s (spd %d)" % [enemy_data.unit_name, target_grid_pos, enemy_data.speed])
			valid_spawns += 1
	else:
		# Fallback: procedural generation (legacy behavior)
		var difficulty: int = GameManager.active_dungeon_difficulty if GameManager.has_active_dungeon_state() else 1
		var num_enemies: int = 2 + difficulty

		var valid_spawns: int = 0
		for i in range(enemy_spawns.size()):
			if valid_spawns >= num_enemies:
				break

			var target_grid_pos: Vector2i = enemy_spawns[i]
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
			enemy_data.speed = 3 + randi() % (difficulty + 3)
			enemy_data.defense = 1 + int(difficulty / 2.0)
			enemy_data.current_armor = enemy_data.defense

			var weapon: ItemData = ItemData.new()
			weapon.weapon_type = (randi() % 3) as ItemData.WeaponType
			weapon.might = 3
			weapon.hit = 80
			weapon.range_max = 1
			enemy_data.equipped_weapon = weapon

			unit.unit_data = enemy_data
			unit.position = battle_grid.grid_to_world(target_grid_pos)
			units_container.add_child(unit)

			battle_grid.place_unit(unit, target_grid_pos)
			print("[Battlefield] Spawned '%s' at Grid %s (spd %d)" % [enemy_data.unit_name, target_grid_pos, enemy_data.speed])
			valid_spawns += 1
