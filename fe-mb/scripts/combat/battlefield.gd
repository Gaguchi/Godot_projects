extends Node2D
## Battlefield - Main combat scene coordinator
## Delegates to: BattleGrid, BattleInput, EnemyAI, CombatAnimator
## Uses speed-based individual turn system

signal battle_finished(victory: bool)

const DEBUG_COMBAT: bool = true

enum BattleState {
	IDLE,               # Between turns, processing queue
	PLAYER_UNIT_TURN,   # Move phase — player choosing where to move (or skip)
	PLAYER_ACTION_PHASE,# Action phase — player playing cards / subdue
	ENEMY_UNIT_TURN,    # An enemy unit is acting (AI processing)
	ANIMATING,          # Movement/combat animation playing
	SELECTING_TARGET,   # Player choosing card target
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

var bound_enemies: Array = []  # UnitData of enemies bound during this battle

var current_state: BattleState = BattleState.IDLE
var player_units: Array = []
var enemy_units: Array = []
var party_sidebar: PartySidebar

## Speed-based turn system (managed by TurnManager)
var turn_manager: TurnManager = null
var active_unit: Node2D = null  # Local convenience reference, set by TurnManager signals

## Card-based combat system (delegated to CardPlayController)
var card_play_controller: CardPlayController = null
var _card_hand_ui: CanvasLayer = null  # CardHandUI instance (also held by card_play_controller)
var _has_moved_this_turn: bool = false
var _skip_move_btn: Button = null    # "Skip Move" button during move phase


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

	# Create TurnManager
	turn_manager = TurnManager.new()
	turn_manager.name = "TurnManager"
	add_child(turn_manager)
	turn_manager.turn_started.connect(_on_turn_started)
	turn_manager.queue_rebuilt.connect(_on_queue_rebuilt)

	# Connect input signals
	battle_input.unit_selected.connect(_on_unit_selected)
	battle_input.unit_deselected.connect(_on_unit_deselected)
	battle_input.move_requested.connect(_on_move_requested)
	battle_input.attack_requested.connect(_on_attack_requested)
	battle_input.attack_after_move_requested.connect(_on_attack_after_move_requested)
	battle_input.wait_requested.connect(_on_wait_requested)
	battle_input.subdue_requested.connect(_on_subdue_requested)
	battle_input.undo_move_requested.connect(_on_undo_move_requested)

	# Wait button (hidden — End Turn in card UI replaces it)
	if wait_button:
		wait_button.visible = false

	# Skip Move button (shown during move phase, bottom-center)
	_skip_move_btn = Button.new()
	_skip_move_btn.text = "Skip Move"
	_skip_move_btn.visible = false
	_skip_move_btn.custom_minimum_size = Vector2(130, 40)
	var skip_style := StyleBoxFlat.new()
	skip_style.bg_color = Color(0.15, 0.08, 0.05, 0.95)
	skip_style.border_color = Color(0.69, 0.44, 0.25)
	skip_style.set_border_width_all(1)
	skip_style.set_corner_radius_all(4)
	skip_style.set_content_margin_all(6)
	_skip_move_btn.add_theme_stylebox_override("normal", skip_style)
	var skip_hover := StyleBoxFlat.new()
	skip_hover.bg_color = Color(0.25, 0.14, 0.08, 0.95)
	skip_hover.border_color = Color(0.69, 0.44, 0.25)
	skip_hover.set_border_width_all(2)
	skip_hover.set_corner_radius_all(4)
	skip_hover.set_content_margin_all(6)
	_skip_move_btn.add_theme_stylebox_override("hover", skip_hover)
	_skip_move_btn.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	_skip_move_btn.add_theme_color_override("font_hover_color", Color(0.69, 0.44, 0.25))
	_skip_move_btn.add_theme_font_size_override("font_size", 14)
	_skip_move_btn.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_skip_move_btn.offset_top = -55
	_skip_move_btn.offset_bottom = -15
	_skip_move_btn.offset_left = -65
	_skip_move_btn.offset_right = 65
	_skip_move_btn.pressed.connect(_on_skip_move_pressed)
	$UI.add_child(_skip_move_btn)

	# Card Hand UI
	var card_hand_script = load("res://scripts/ui/card_hand_ui.gd")
	_card_hand_ui = CanvasLayer.new()
	_card_hand_ui.set_script(card_hand_script)
	add_child(_card_hand_ui)

	# Card effect resolver
	var resolver_script = load("res://scripts/combat/card_effect_resolver.gd")
	var card_effect_resolver = RefCounted.new()
	card_effect_resolver.set_script(resolver_script)

	# Card Play Controller — manages card selection, targeting, resolution, AP, captures
	card_play_controller = CardPlayController.new()
	card_play_controller.name = "CardPlayController"
	add_child(card_play_controller)
	card_play_controller.setup({
		"deck_managers": {},  # Will be populated in _start_battle via init_decks()
		"card_hand_ui": _card_hand_ui,
		"card_effect_resolver": card_effect_resolver,
		"battle_grid": battle_grid,
		"battlefield": self,
		"battle_input": battle_input,
		"grid_overlay": grid_overlay,
		"combat_animator": combat_animator,
		"units_container": units_container,
		"combat_log": combat_log,
		"ui_node": $UI,
	})
	card_play_controller.turn_ended.connect(_on_card_turn_ended)

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

	if current_state in [BattleState.PLAYER_UNIT_TURN, BattleState.PLAYER_ACTION_PHASE, BattleState.SELECTING_TARGET]:
		battle_input.update_hover()

	# Damage preview during card targeting
	if current_state == BattleState.SELECTING_TARGET and card_play_controller.get_pending_card() and active_unit:
		card_play_controller.update_damage_preview()
	elif current_state != BattleState.SELECTING_TARGET:
		card_play_controller.hide_damage_preview()

	# Update capture button positions (track enemy world positions → screen space)
	if current_state == BattleState.PLAYER_ACTION_PHASE:
		card_play_controller.update_capture_button_positions()

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
	# Middle-mouse drag panning (always works, even over UI)
	if event is InputEventMouseButton and current_state != BattleState.BATTLE_END:
		if event.button_index == MOUSE_BUTTON_MIDDLE:
			is_camera_dragging = event.pressed
			if event.pressed:
				camera_drag_start = event.position

	if event is InputEventMouseMotion and is_camera_dragging and camera:
		var drag_delta: Vector2 = event.relative / camera.zoom
		camera.position -= drag_delta
		_clamp_camera_position()


func _unhandled_input(event: InputEvent) -> void:
	# Grid clicks — only fire if no UI button consumed the event
	if current_state in [BattleState.PLAYER_UNIT_TURN, BattleState.SELECTING_TARGET]:
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

	# Movement done — transition to action phase
	_has_moved_this_turn = true
	_show_unit_info(unit)
	_enter_action_phase()


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


func _on_subdue_requested(attacker: Node2D, target: Node2D) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var atk_data: UnitData = attacker.get_unit_data()
	var def_data: UnitData = target.get_unit_data()
	var capture_info: Dictionary = _get_capture_chance(attacker, target)
	var success_rate: int = capture_info.chance
	var roll: int = randi() % 100
	var success: bool = roll < success_rate

	if DEBUG_COMBAT:
		print("[Subdue] %s attempts to subdue %s | Chance: %d%% (Adjacent: %d) Roll: %d → %s" % [
			atk_data.unit_name, def_data.unit_name, success_rate,
			capture_info.adjacent_count, roll,
			"SUCCESS" if success else "FAIL"
		])

	# Animate attacker sliding toward target
	var atk_pos: Vector2 = attacker.position
	var def_pos: Vector2 = target.position
	var slide_target: Vector2 = atk_pos.lerp(def_pos, 0.3)
	var slide_tween: Tween = create_tween()
	slide_tween.tween_property(attacker, "position", slide_target, 0.15)
	slide_tween.tween_property(attacker, "position", atk_pos, 0.15)
	await slide_tween.finished

	if success:
		def_data.is_bound = true
		target.set_bound(true)
		bound_enemies.append(def_data)
		if combat_log:
			combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, true, atk_data.is_player_unit)
	else:
		if combat_log:
			combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, false, atk_data.is_player_unit)

	if not _check_battle_end():
		_finish_unit_turn(attacker)


## Count player units adjacent (4-directional) to a target enemy
func _count_adjacent_allies(target: Node2D) -> int:
	var target_pos: Vector2i = battle_grid.world_to_grid(target.position)
	var count: int = 0
	for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
		var adj: Vector2i = target_pos + dir
		var adj_unit: Node2D = battle_grid.get_unit_at(adj)
		if adj_unit and is_instance_valid(adj_unit):
			var adj_data: UnitData = adj_unit.get_unit_data()
			if adj_data and adj_data.is_player_unit and adj_data.is_alive():
				count += 1
	return count


## Calculate capture chance based on target HP%, adjacent allies, and attacker class
## Target must be at 50% HP or below to be capturable at all.
## Returns: {"chance": int (0-100), "adjacent_count": int}
func _get_capture_chance(attacker: Node2D, target: Node2D) -> Dictionary:
	var def_data: UnitData = target.get_unit_data()
	var hp_pct: float = float(def_data.current_hp) / float(def_data.max_hp) * 100.0

	var atk_data: UnitData = attacker.get_unit_data()
	var is_hunter: bool = atk_data.unit_class == UnitData.UnitClass.BOUNTY_HUNTER

	var adjacent: int = _count_adjacent_allies(target)

	# Not capturable above 50% HP
	if hp_pct > 50.0:
		return {"chance": 0, "adjacent_count": adjacent}

	# Base chance from target HP%
	var base: int = 0 if hp_pct > 25.0 else 25

	# Surround bonus: +20% per adjacent ally
	var surround_bonus: int = adjacent * 20

	# Bounty Hunter class bonus
	var class_bonus: int = 10 if is_hunter else 0

	var total: int = clampi(base + surround_bonus + class_bonus, 0, 100)
	return {"chance": total, "adjacent_count": adjacent}


## Card turn ended (from CardPlayController) — finish the unit's turn
func _on_card_turn_ended() -> void:
	if _skip_move_btn:
		_skip_move_btn.visible = false
	_finish_unit_turn(active_unit)


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

## Execute enemy combat — deterministic (always hits, no crit)
func _execute_combat(attacker: Node2D, defender: Node2D) -> void:
	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var atk_data: UnitData = attacker.get_unit_data()
	var def_data: UnitData = defender.get_unit_data()
	var def_pos: Vector2i = battle_grid.world_to_grid(defender.position)
	var atk_pos: Vector2i = battle_grid.world_to_grid(attacker.position)

	# Calculate damage using existing formula (but we skip hit/crit rolls)
	var forecast: Dictionary = CombatManager.calculate_combat(
		atk_data, def_data,
		battle_grid.get_terrain_def_bonus(def_pos),
		battle_grid.get_terrain_avoid_bonus(def_pos)
	)

	var damage: int = forecast.attacker_damage
	var is_magic: bool = forecast.get("attacker_is_magic", false)

	if DEBUG_COMBAT:
		print("[Combat] %s vs %s | Dmg:%d (deterministic)" % [
			atk_data.unit_name, def_data.unit_name, damage
		])

	# Apply damage deterministically
	def_data.take_damage(damage, is_magic)

	# Log
	if combat_log:
		combat_log.log_attack(atk_data.unit_name, def_data.unit_name, damage, false, atk_data.is_player_unit)

	# Animate
	var frame_tween: Tween = _frame_combatants(attacker, defender)
	if frame_tween:
		await frame_tween.finished

	await combat_animator.play_single_attack(attacker, defender, damage, is_magic)

	if not def_data.is_alive():
		_handle_unit_death(defender, attacker)

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
	turn_manager.remove_unit(dead_unit)

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

	# Initialize deck managers via CardPlayController
	card_play_controller.init_decks(player_units)

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
	turn_manager.build_queue(units_container)


func _advance_turn() -> void:
	turn_manager.advance_turn(units_container)


## Called when TurnManager rebuilds the queue (new round)
func _on_queue_rebuilt() -> void:
	enemy_ai.reset_turn()


## Called by TurnManager.turn_started signal — routes to player or enemy turn
func _on_turn_started(unit: Node2D) -> void:
	active_unit = unit

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
	_has_moved_this_turn = false

	# Focus camera on the unit
	var cam_tween: Tween = _focus_camera_on(unit.position)
	if cam_tween:
		await cam_tween.finished

	battle_input.set_active_unit(unit)
	_show_unit_info(unit)

	# Move Phase: show movement range + Skip Move button, NO cards
	card_play_controller.hide_hand()
	card_play_controller.clear_card_range_overlay()
	if _skip_move_btn:
		_skip_move_btn.visible = true

	if DEBUG_COMBAT:
		var data: UnitData = unit.get_unit_data()
		print("[Turn] %s's turn (Player) — Move Phase" % data.unit_name)


## Transition from Move phase to Action phase (cards + capture)
func _enter_action_phase() -> void:
	current_state = BattleState.PLAYER_ACTION_PHASE
	battle_input.input_enabled = false
	print("[Phase] → ACTION PHASE for %s" % active_unit.get_unit_data().unit_name)

	# Hide move UI
	if _skip_move_btn:
		_skip_move_btn.visible = false
	battle_input.clear_movement_highlights()

	# Delegate card setup to CardPlayController
	card_play_controller.start_action_phase(active_unit)


## Skip Move button pressed — go straight to action phase
func _on_skip_move_pressed() -> void:
	if active_unit and current_state == BattleState.PLAYER_UNIT_TURN:
		print("[Action] Skip Move pressed")
		_enter_action_phase()


func _start_enemy_unit_turn(unit: Node2D) -> void:
	current_state = BattleState.ENEMY_UNIT_TURN
	battle_input.input_enabled = false
	card_play_controller.hide_hand()
	card_play_controller.clear_capture_buttons()
	if _skip_move_btn:
		_skip_move_btn.visible = false

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
		"untie":
			# Free a bound ally
			var bound_target: Node2D = decision.target
			if is_instance_valid(bound_target):
				var bound_data: UnitData = bound_target.get_unit_data()
				bound_data.is_bound = false
				bound_target.set_bound(false)
				# Remove from bound_enemies tracking
				var idx: int = bound_enemies.find(bound_data)
				if idx >= 0:
					bound_enemies.remove_at(idx)
				if combat_log:
					combat_log.log_untie(data.unit_name, bound_data.unit_name, false)
				if DEBUG_COMBAT:
					print("[AI] %s freed %s!" % [data.unit_name, bound_data.unit_name])
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
	var enemies_alive: Array = enemy_units.filter(func(u): return is_instance_valid(u) and u.get_unit_data() and u.get_unit_data().is_alive() and not u.get_unit_data().is_bound)

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
	card_play_controller.hide_hand()
	card_play_controller.clear_capture_buttons()
	card_play_controller.hide_targeting_label()
	card_play_controller.hide_damage_preview()
	if _skip_move_btn:
		_skip_move_btn.visible = false

	# Clear active unit highlight
	turn_manager.clear_active_highlight()

	print("[Battlefield] Battle ended - Victory: ", victory)

	if combat_log:
		combat_log.log_system("Victory!" if victory else "Defeat...")

	_show_turn_banner("Victory!" if victory else "Defeat...")

	if victory:
		GameManager.battles_won += 1

		# Award gold based on enemies defeated
		var gold_reward: int = 0
		for unit in enemy_units:
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data():
				gold_reward += 10 + unit.get_unit_data().level * 5
		if gold_reward > 0:
			GameManager.add_gold(gold_reward)
			EventBus.show_notification.emit("Earned %d gold from battle." % gold_reward)

		# Transfer captured enemies to GameManager for bounty turn-in
		for unit_data in bound_enemies:
			GameManager.add_captured_enemy(unit_data)
		# Check capture targets for post-battle dialogue resolution
		var capture_targets: Array = GameManager.pending_battle.get("capture_targets", [])
		for ct in capture_targets:
			var target_name: String = ct.get("unit_name", "")
			var was_captured: bool = false
			for bd in bound_enemies:
				if bd.unit_name == target_name:
					was_captured = true
					break
			if was_captured:
				GameManager.pending_post_battle_dialogue = ct.get("captured_dialogue", "")
				if ct.has("captured_flag"):
					EventBus.set_flag(ct.captured_flag, true)
			else:
				GameManager.pending_post_battle_dialogue = ct.get("killed_dialogue", "")
				if ct.has("killed_flag"):
					EventBus.set_flag(ct.killed_flag, true)

	# Degrade weapon sharpness after battle
	if victory:
		for unit in player_units:
			if is_instance_valid(unit) and unit.has_method("get_unit_data"):
				var data: UnitData = unit.get_unit_data()
				if data and data.is_alive():
					if data.hand_left and data.hand_left is ItemData:
						data.hand_left.degrade_sharpness()
					if data.hand_right and data.hand_right is ItemData:
						data.hand_right.degrade_sharpness()

	GameManager.last_battle_victory = victory

	EventBus.battle_ended.emit(victory)
	battle_finished.emit(victory)

	await get_tree().create_timer(2.0).timeout

	# Determine return destination based on combat source
	var source = GameManager.pending_battle.get("source", "")
	GameManager.pending_battle = {}  # Clear combat context

	# Auto-save after combat resolution
	if victory and GameManager.current_save_slot > 0:
		SaveManager.save_game(GameManager.current_save_slot)

	if victory:
		match source:
			"dungeon":
				GameManager.change_state(GameManager.GameState.DUNGEON)
				SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
			"overworld", "travel_encounter", _:
				GameManager.change_state(GameManager.GameState.OVERWORLD)
				SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
	else:
		print("[Battlefield] Defeat... Run Ended")
		GameManager.pending_travel_path.clear()  # Cancel remaining travel on defeat
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
		turn_order_display.update_queue(turn_manager.get_turn_order(), turn_manager.get_current_index() - 1)


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
		# Optional: use custom spawn positions if provided (for test scenarios)
		var custom_spawns: Array = GameManager.pending_battle.get("spawn_positions", [])
		var valid_spawns: int = 0
		for i in pending_enemies.size():
			var enemy_data = pending_enemies[i]
			var target_grid_pos: Vector2i

			# Use custom position if available and valid
			if i < custom_spawns.size() and custom_spawns[i] is Vector2i and custom_spawns[i] != Vector2i(-1, -1):
				target_grid_pos = custom_spawns[i]
			else:
				if valid_spawns >= enemy_spawns.size():
					break
				target_grid_pos = enemy_spawns[valid_spawns]
				valid_spawns += 1

			var existing: Node2D = battle_grid.get_unit_at(target_grid_pos)
			if existing:
				continue

			var unit: Node2D = UnitScene.instantiate()
			unit.unit_data = enemy_data
			unit.position = battle_grid.grid_to_world(target_grid_pos)
			units_container.add_child(unit)
			battle_grid.place_unit(unit, target_grid_pos)
			print("[Battlefield] Spawned '%s' at Grid %s (spd %d, HP %d/%d)" % [enemy_data.unit_name, target_grid_pos, enemy_data.speed, enemy_data.current_hp, enemy_data.max_hp])
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
