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

## Speed-based turn system
var turn_queue: Array = []
var current_turn_index: int = 0
var active_unit: Node2D = null
var _previous_active_unit: Node2D = null

## Card-based combat system
var _deck_managers: Dictionary = {}  # Node2D unit → DeckManager
var _card_hand_ui: CanvasLayer = null  # CardHandUI instance
var _card_effect_resolver = null     # CardEffectResolver instance
var _current_ap: int = 3
var _max_ap: int = 3
var _has_moved_this_turn: bool = false
var _pending_card: CardData = null   # Card currently being targeted
var _pending_card_index: int = -1
var _skip_move_btn: Button = null    # "Skip Move" button during move phase
var _capture_buttons: Array[Button] = []  # Floating capture buttons above enemies
var _targeting_label: Label = null   # "Select target for [card]" status text
var _damage_preview_label: Label = null  # Floating damage number over hovered target
var _last_preview_tile: Vector2i = Vector2i(-1, -1)  # Track last tile to avoid re-computing


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
	battle_input.subdue_requested.connect(_on_subdue_requested)
	battle_input.undo_move_requested.connect(_on_undo_move_requested)
	battle_input.target_selection_cancelled.connect(_on_target_selection_cancelled)
	battle_input.card_target_confirmed.connect(_on_card_target_confirmed)

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

	# Targeting status label (top-center, shown during target selection)
	_targeting_label = Label.new()
	_targeting_label.visible = false
	_targeting_label.add_theme_font_size_override("font_size", 16)
	_targeting_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	_targeting_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_targeting_label.add_theme_constant_override("shadow_offset_x", 1)
	_targeting_label.add_theme_constant_override("shadow_offset_y", 1)
	_targeting_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_targeting_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_targeting_label.offset_top = 50
	_targeting_label.offset_left = -200
	_targeting_label.offset_right = 200
	$UI.add_child(_targeting_label)

	# Damage preview label (floating over hovered target during card targeting)
	_damage_preview_label = Label.new()
	_damage_preview_label.visible = false
	_damage_preview_label.add_theme_font_size_override("font_size", 20)
	_damage_preview_label.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))  # Red for damage
	_damage_preview_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_damage_preview_label.add_theme_constant_override("shadow_offset_x", 2)
	_damage_preview_label.add_theme_constant_override("shadow_offset_y", 2)
	_damage_preview_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	$UI.add_child(_damage_preview_label)

	# Card Hand UI
	var card_hand_script = load("res://scripts/ui/card_hand_ui.gd")
	_card_hand_ui = CanvasLayer.new()
	_card_hand_ui.set_script(card_hand_script)
	add_child(_card_hand_ui)
	_card_hand_ui.card_selected.connect(_on_card_selected)
	_card_hand_ui.card_hovered.connect(_on_card_hovered)
	_card_hand_ui.end_turn_pressed.connect(_on_card_end_turn)
	battle_input.ground_target_confirmed.connect(_on_ground_target_confirmed)

	# Card effect resolver
	var resolver_script = load("res://scripts/combat/card_effect_resolver.gd")
	_card_effect_resolver = RefCounted.new()
	_card_effect_resolver.set_script(resolver_script)

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
	if current_state == BattleState.SELECTING_TARGET and _pending_card and active_unit:
		_update_damage_preview()
	elif _damage_preview_label and _damage_preview_label.visible:
		_damage_preview_label.visible = false
		_last_preview_tile = Vector2i(-1, -1)

	# Update capture button positions (track enemy world positions → screen space)
	if current_state == BattleState.PLAYER_ACTION_PHASE:
		_update_capture_button_positions()

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
	var success_rate: int = _get_subdue_chance(attacker, target)
	var roll: int = randi() % 100
	var success: bool = roll < success_rate

	if DEBUG_COMBAT:
		print("[Subdue] %s attempts to subdue %s | Chance: %d%% Roll: %d → %s" % [
			atk_data.unit_name, def_data.unit_name, success_rate, roll,
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

	_finish_unit_turn(attacker)


## Calculate subdue success chance based on target HP% and attacker class
func _get_subdue_chance(attacker: Node2D, target: Node2D) -> int:
	var def_data: UnitData = target.get_unit_data()
	var hp_pct: float = float(def_data.current_hp) / float(def_data.max_hp) * 100.0

	var atk_data: UnitData = attacker.get_unit_data()
	var is_hunter: bool = atk_data.unit_class == UnitData.UnitClass.BOUNTY_HUNTER

	if is_hunter:
		if hp_pct > 50.0: return 15
		elif hp_pct > 40.0: return 30
		elif hp_pct > 25.0: return 60
		elif hp_pct > 10.0: return 85
		else: return 100
	else:
		if hp_pct > 50.0: return 0
		elif hp_pct > 40.0: return 10
		elif hp_pct > 25.0: return 30
		elif hp_pct > 10.0: return 60
		elif hp_pct > 5.0: return 85
		else: return 100


## Card selected from hand UI — determine if we need target selection or auto-resolve
func _on_card_selected(card: CardData, index: int) -> void:
	if _current_ap < card.ap_cost:
		print("[Action] Card '%s' selected but not enough AP (%d/%d)" % [card.card_name, _current_ap, card.ap_cost])
		return

	_pending_card = card
	_pending_card_index = index
	print("[Action] Card selected: '%s' (AP:%d, Target:%s)" % [card.card_name, card.ap_cost, CardData.TargetType.keys()[card.target_type]])

	# Hide capture buttons and range preview during card play
	_clear_capture_buttons()
	grid_overlay.set_card_range_tiles([])

	match card.target_type:
		CardData.TargetType.SELF:
			_resolve_card_on_target(active_unit)
		CardData.TargetType.ALL_ENEMIES:
			_resolve_card_aoe_enemies()
		CardData.TargetType.ALL_ALLIES:
			_resolve_card_aoe_allies()
		CardData.TargetType.ENEMY:
			_enter_card_target_mode(card)
		CardData.TargetType.ALLY:
			_enter_card_ally_target_mode(card)
		CardData.TargetType.GROUND:
			_enter_card_ground_target_mode(card)


## Card hovered in hand — show range preview on grid
func _on_card_hovered(card: CardData, index: int) -> void:
	if current_state != BattleState.PLAYER_ACTION_PHASE or not active_unit:
		grid_overlay.set_card_range_tiles([])
		return

	if card == null or index < 0:
		grid_overlay.set_card_range_tiles([])
		return

	# Don't show range for SELF cards or unplayable cards
	if card.target_type == CardData.TargetType.SELF or card.target_type == CardData.TargetType.ALL_ENEMIES or card.target_type == CardData.TargetType.ALL_ALLIES:
		grid_overlay.set_card_range_tiles([])
		return

	if card.ap_cost > _current_ap:
		grid_overlay.set_card_range_tiles([])
		return

	# Calculate range tiles from active unit position
	var unit_pos: Vector2i = battle_grid.world_to_grid(active_unit.position)
	var range_tiles: Array = []
	for x in range(GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			var tile := Vector2i(x, y)
			var dist: int = abs(tile.x - unit_pos.x) + abs(tile.y - unit_pos.y)
			if dist >= card.range_min and dist <= card.range_max:
				range_tiles.append(tile)

	grid_overlay.set_card_range_tiles(range_tiles)


## Enter card target selection mode for single-target cards
func _enter_card_target_mode(card: CardData) -> void:
	current_state = BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = battle_grid.world_to_grid(active_unit.position)
	var valid_targets: Array[Vector2i] = []

	# Find enemies within card range
	for enemy in enemy_units:
		if not is_instance_valid(enemy) or not enemy.get_unit_data() or not enemy.get_unit_data().is_alive():
			continue
		if enemy.get_unit_data().is_bound:
			continue
		var enemy_pos: Vector2i = battle_grid.world_to_grid(enemy.position)
		var dist: int = abs(enemy_pos.x - unit_pos.x) + abs(enemy_pos.y - unit_pos.y)
		if dist >= card.range_min and dist <= card.range_max:
			valid_targets.append(enemy_pos)

	if valid_targets.is_empty():
		_pending_card = null
		current_state = BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid targets for '%s'" % card.card_name)
		_show_no_targets_message("No targets in range")
		return

	print("[Action] Enemy targeting for '%s' — %d valid targets" % [card.card_name, valid_targets.size()])
	_show_targeting_label("Select target for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	battle_input.enter_card_target_selection(active_unit, valid_targets)


## Enter card ally target selection mode
func _enter_card_ally_target_mode(card: CardData) -> void:
	current_state = BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = battle_grid.world_to_grid(active_unit.position)
	var valid_targets: Array[Vector2i] = []

	for ally in player_units:
		if not is_instance_valid(ally) or not ally.get_unit_data() or not ally.get_unit_data().is_alive():
			continue
		var ally_pos: Vector2i = battle_grid.world_to_grid(ally.position)
		var dist: int = abs(ally_pos.x - unit_pos.x) + abs(ally_pos.y - unit_pos.y)
		if dist >= card.range_min and dist <= card.range_max:
			valid_targets.append(ally_pos)

	if valid_targets.is_empty():
		_pending_card = null
		current_state = BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid ally targets for '%s'" % card.card_name)
		_show_no_targets_message("No allies in range")
		return

	print("[Action] Ally targeting for '%s' — %d valid targets" % [card.card_name, valid_targets.size()])
	_show_targeting_label("Select ally for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	battle_input.enter_card_target_selection(active_unit, valid_targets)


## Enter ground target selection mode for AOE spells
func _enter_card_ground_target_mode(card: CardData) -> void:
	current_state = BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = battle_grid.world_to_grid(active_unit.position)
	var valid_tiles: Array[Vector2i] = []

	for x in range(GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			var tile := Vector2i(x, y)
			var dist: int = abs(tile.x - unit_pos.x) + abs(tile.y - unit_pos.y)
			if dist >= card.range_min and dist <= card.range_max:
				valid_tiles.append(tile)

	if valid_tiles.is_empty():
		_pending_card = null
		current_state = BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid ground tiles for '%s'" % card.card_name)
		return

	print("[Action] Ground targeting for '%s' — %d tiles, AOE %d" % [card.card_name, valid_tiles.size(), card.aoe_radius])
	_show_targeting_label("Select tile for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	battle_input.enter_ground_target_selection(active_unit, valid_tiles, card.aoe_radius)


## Called when player clicks a valid target during card targeting
func _on_card_target_confirmed(target: Node2D) -> void:
	print("[Action] Card target confirmed: %s" % target.get_unit_data().unit_name)
	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.set_targeting_mode(false)
	_resolve_card_on_target(target)


## Called when player clicks a valid ground tile for AOE spell
func _on_ground_target_confirmed(tile: Vector2i) -> void:
	print("[Action] Ground target confirmed at (%d,%d)" % [tile.x, tile.y])
	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.set_targeting_mode(false)
	_resolve_card_on_ground(tile)


## Resolve a card on a single target
func _resolve_card_on_target(target: Node2D) -> void:
	if _pending_card == null or not is_instance_valid(active_unit):
		return

	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active_unit.get_unit_data()
	var target_data: UnitData = target.get_unit_data()

	# Deduct AP
	_current_ap -= card.ap_cost

	# Build battle context
	var target_pos: Vector2i = battle_grid.world_to_grid(target.position)
	var context := {
		"terrain_def_bonus": battle_grid.get_terrain_def_bonus(target_pos) if target != active_unit else 0,
	}

	# Resolve card effects
	var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, target_data, context)

	# Play card from deck
	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.play_card(card)

	# Log
	if combat_log:
		if result.damage_dealt > 0:
			combat_log.log_card_play(caster_data.unit_name, card.card_name, target_data.unit_name, result.damage_dealt)
		elif result.healing_done > 0:
			combat_log.log_card_heal(caster_data.unit_name, card.card_name, target_data.unit_name, result.healing_done)
		else:
			combat_log.log_card_effect(caster_data.unit_name, card.card_name)

	if DEBUG_COMBAT:
		var effect_str := ""
		if result.damage_dealt > 0:
			effect_str = "%d dmg" % result.damage_dealt
		if result.healing_done > 0:
			effect_str += "%d heal" % result.healing_done
		for eff in result.effects_applied:
			effect_str += " +%s" % eff.get("type", "")
		print("[Card] %s plays %s on %s → %s (AP left: %d)" % [
			caster_data.unit_name, card.card_name, target_data.unit_name, effect_str, _current_ap
		])

	# Animate
	if result.damage_dealt > 0 and target != active_unit:
		await combat_animator.play_single_attack(active_unit, target, result.damage_dealt, card.is_magic)
	elif result.healing_done > 0:
		# Simple heal flash
		var heal_tween: Tween = create_tween()
		heal_tween.tween_property(target, "modulate", Color(0.5, 1.0, 0.5), 0.15)
		heal_tween.tween_property(target, "modulate", Color.WHITE, 0.15)
		await heal_tween.finished
	else:
		await get_tree().create_timer(0.2).timeout

	# Handle card draw/AP effects
	for eff in result.effects_applied:
		match eff.get("type", ""):
			"draw":
				if dm:
					dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)
			"steal_gold":
				GameManager.add_gold(eff.get("amount", 0))
				EventBus.show_notification.emit("Stole %dg!" % eff.get("amount", 0))
			"subdue":
				# Capture attempt via card
				_attempt_card_subdue(active_unit, target)

	# Handle death
	if result.target_died and target != active_unit:
		_handle_unit_death(target, active_unit)

	# Check battle end
	if _check_battle_end():
		_card_hand_ui.hide_hand()
		return

	# Update UI and continue turn
	_pending_card = null
	_pending_card_index = -1

	if dm:
		_card_hand_ui.update_hand(dm.hand)
		_card_hand_ui.update_ap(_current_ap, _max_ap)
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())

	# Refresh party sidebar
	if party_sidebar:
		var sidebar_units: Array = []
		for unit in units_container.get_children():
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
				sidebar_units.append(unit)
		party_sidebar.update_units(sidebar_units)

	# Check if turn should continue
	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		current_state = BattleState.PLAYER_ACTION_PHASE
		_show_unit_info(active_unit)
		# Update subdue availability (unit may have moved closer to enemies)
		_create_capture_buttons()


## Resolve AOE card on all enemies
func _resolve_card_aoe_enemies() -> void:
	if _pending_card == null or not is_instance_valid(active_unit):
		return

	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active_unit.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.play_card(card)

	var total_damage: int = 0
	var killed: Array = []

	for enemy in enemy_units.duplicate():
		if not is_instance_valid(enemy) or not enemy.get_unit_data() or not enemy.get_unit_data().is_alive():
			continue
		if enemy.get_unit_data().is_bound:
			continue
		var target_pos: Vector2i = battle_grid.world_to_grid(enemy.position)
		var context := {"terrain_def_bonus": battle_grid.get_terrain_def_bonus(target_pos)}
		var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, enemy.get_unit_data(), context)
		total_damage += result.damage_dealt
		if result.target_died:
			killed.append(enemy)

	if combat_log:
		combat_log.log_card_play(caster_data.unit_name, card.card_name, "all enemies", total_damage)

	if DEBUG_COMBAT:
		print("[Card] %s plays %s on ALL ENEMIES → %d total dmg, %d killed (AP left: %d)" % [
			caster_data.unit_name, card.card_name, total_damage, killed.size(), _current_ap
		])

	# Brief flash animation
	for enemy in enemy_units:
		if is_instance_valid(enemy):
			enemy.modulate = Color(1.0, 0.5, 0.5)
	await get_tree().create_timer(0.3).timeout
	for enemy in enemy_units:
		if is_instance_valid(enemy):
			enemy.modulate = Color.WHITE

	for dead in killed:
		_handle_unit_death(dead, active_unit)

	# Handle effects
	for eff in card.effects:
		match eff.get("type", ""):
			"draw":
				if dm: dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)

	_pending_card = null
	if _check_battle_end():
		_card_hand_ui.hide_hand()
		return

	_post_card_play_update()


## Resolve AOE card on all allies
func _resolve_card_aoe_allies() -> void:
	if _pending_card == null or not is_instance_valid(active_unit):
		return

	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active_unit.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.play_card(card)

	var total_healing: int = 0
	for ally in player_units:
		if not is_instance_valid(ally) or not ally.get_unit_data() or not ally.get_unit_data().is_alive():
			continue
		var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, ally.get_unit_data(), {})
		total_healing += result.healing_done

	if combat_log and total_healing > 0:
		combat_log.log_card_heal(caster_data.unit_name, card.card_name, "all allies", total_healing)

	# Heal flash
	for ally in player_units:
		if is_instance_valid(ally):
			ally.modulate = Color(0.5, 1.0, 0.5)
	await get_tree().create_timer(0.3).timeout
	for ally in player_units:
		if is_instance_valid(ally):
			ally.modulate = Color.WHITE

	# Handle effects
	for eff in card.effects:
		match eff.get("type", ""):
			"draw":
				if dm: dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)

	_pending_card = null
	_post_card_play_update()


## Capture attempt via Capture card
func _attempt_card_subdue(attacker: Node2D, target: Node2D) -> void:
	var success_rate: int = _get_subdue_chance(attacker, target)
	var roll: int = randi() % 100
	var success: bool = roll < success_rate
	var def_data: UnitData = target.get_unit_data()

	if success:
		def_data.is_bound = true
		target.set_bound(true)
		bound_enemies.append(def_data)
		if combat_log:
			combat_log.log_subdue(attacker.get_unit_data().unit_name, def_data.unit_name, true, true)
	else:
		if combat_log:
			combat_log.log_subdue(attacker.get_unit_data().unit_name, def_data.unit_name, false, true)


## Resolve a ground-targeted AOE card on a tile
func _resolve_card_on_ground(tile: Vector2i) -> void:
	if _pending_card == null or not is_instance_valid(active_unit):
		return

	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active_unit.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.play_card(card)

	# Gather AOE tiles
	var aoe_tiles: Array[Vector2i] = _get_aoe_tiles(tile, card.aoe_radius)
	var targets_hit: Array = []
	var total_damage: int = 0

	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			var unit_data: UnitData = unit_on_tile.get_unit_data()
			if unit_data and unit_data.is_alive() and not unit_data.is_player_unit and not unit_data.is_bound:
				var context := {"terrain_def_bonus": battle_grid.get_terrain_def_bonus(aoe_tile)}
				var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, unit_data, context)
				total_damage += result.damage_dealt
				targets_hit.append({"unit": unit_on_tile, "damage": result.damage_dealt, "died": result.target_died})

	if combat_log:
		combat_log.log_card_play(caster_data.unit_name, card.card_name, "ground (%d,%d)" % [tile.x, tile.y], total_damage)

	print("[Card] %s casts %s at (%d,%d) — AOE %d tiles, %d targets hit, %d total dmg (AP:%d)" % [
		caster_data.unit_name, card.card_name, tile.x, tile.y,
		aoe_tiles.size(), targets_hit.size(), total_damage, _current_ap
	])

	# Flash AOE area purple
	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			unit_on_tile.modulate = Color(0.7, 0.3, 1.0)
	await get_tree().create_timer(0.35).timeout
	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			unit_on_tile.modulate = Color.WHITE

	# Handle deaths
	for hit in targets_hit:
		if hit.died and is_instance_valid(hit.unit):
			_handle_unit_death(hit.unit, active_unit)

	# Handle card effects (draw, AP gain, etc.)
	for eff in card.effects:
		match eff.get("type", ""):
			"draw":
				if dm: dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)

	_pending_card = null
	if _check_battle_end():
		_card_hand_ui.hide_hand()
		_clear_capture_buttons()
		return

	_post_card_play_update()


## Get all tiles within manhattan distance of center
func _get_aoe_tiles(center: Vector2i, radius: int) -> Array[Vector2i]:
	var tiles: Array[Vector2i] = [center]
	if radius <= 0:
		return tiles
	for x in range(center.x - radius, center.x + radius + 1):
		for y in range(center.y - radius, center.y + radius + 1):
			var pos := Vector2i(x, y)
			if pos == center:
				continue
			var dist: int = abs(pos.x - center.x) + abs(pos.y - center.y)
			if dist <= radius and battle_grid.is_in_bounds(pos):
				tiles.append(pos)
	return tiles


## Common UI update after playing a card
func _post_card_play_update() -> void:
	var dm = _deck_managers.get(active_unit)
	if dm:
		_card_hand_ui.update_hand(dm.hand)
		_card_hand_ui.update_ap(_current_ap, _max_ap)
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())

	if party_sidebar:
		var sidebar_units: Array = []
		for unit in units_container.get_children():
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
				sidebar_units.append(unit)
		party_sidebar.update_units(sidebar_units)

	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		current_state = BattleState.PLAYER_ACTION_PHASE
		_show_unit_info(active_unit)
		_create_capture_buttons()


## End Turn button pressed (or auto-end when AP/cards run out)
func _on_card_end_turn() -> void:
	print("[Action] End Turn pressed")
	_card_hand_ui.hide_hand()
	_clear_capture_buttons()
	_hide_targeting_label()
	if _skip_move_btn:
		_skip_move_btn.visible = false
	_pending_card = null

	# Discard remaining hand
	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.discard_hand()

	_finish_unit_turn(active_unit)


## Deck reshuffled — show visual feedback
func _on_deck_reshuffled(unit_name: String) -> void:
	print("[Deck] %s's discard pile reshuffled into draw pile!" % unit_name)
	if combat_log:
		combat_log.log_system("%s's deck reshuffled" % unit_name)
	# Update deck/discard counts in card hand UI
	var dm = _deck_managers.get(active_unit)
	if dm:
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())


func _on_target_selection_cancelled() -> void:
	# Return to action phase (cancel card targeting)
	print("[Action] Card targeting cancelled — returning to action phase")
	_pending_card = null
	_pending_card_index = -1
	current_state = BattleState.PLAYER_ACTION_PHASE
	battle_input.input_enabled = false

	# Restore action phase UI
	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.deselect_card()
	_card_hand_ui.set_targeting_mode(false)
	_create_capture_buttons()
	_show_unit_info(active_unit)


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

	# Create DeckManagers for player units
	_deck_managers.clear()
	for unit in player_units:
		var data: UnitData = unit.get_unit_data()
		if data and not data.deck.is_empty():
			var dm_script = load("res://scripts/combat/deck_manager.gd")
			var dm = RefCounted.new()
			dm.set_script(dm_script)
			dm.init_deck(data.deck)
			dm.deck_shuffled.connect(_on_deck_reshuffled.bind(data.unit_name))
			_deck_managers[unit] = dm
			if DEBUG_COMBAT:
				print("[Deck] %s: initialized %d cards" % [data.unit_name, dm.get_draw_count()])

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

	# Skip dead/invalid/bound units (use untyped var to avoid freed instance assignment error)
	while current_turn_index < turn_queue.size():
		var candidate = turn_queue[current_turn_index]
		if is_instance_valid(candidate) and candidate.get_unit_data() and candidate.get_unit_data().is_alive() and not candidate.get_unit_data().is_bound:
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
	_has_moved_this_turn = false
	_pending_card = null
	_pending_card_index = -1

	# Focus camera on the unit
	var cam_tween: Tween = _focus_camera_on(unit.position)
	if cam_tween:
		await cam_tween.finished

	battle_input.set_active_unit(unit)
	_show_unit_info(unit)

	# Move Phase: show movement range + Skip Move button, NO cards
	_card_hand_ui.hide_hand()
	grid_overlay.set_card_range_tiles([])
	grid_overlay.set_aoe_preview_tiles([])
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

	# Reset AP and draw cards
	var data: UnitData = active_unit.get_unit_data()
	_max_ap = data.max_ap if "max_ap" in data else 3
	_current_ap = _max_ap

	var dm = _deck_managers.get(active_unit)
	if dm:
		dm.discard_hand()
		dm.draw_cards(dm.max_hand_size)
		_card_hand_ui.show_hand(data, dm.hand, _current_ap, _max_ap, dm.get_draw_count(), dm.get_discard_count())
	else:
		_card_hand_ui.show_hand(data, [], _current_ap, _max_ap, 0, 0)

	# Create capture buttons above adjacent enemies
	_create_capture_buttons()

	if DEBUG_COMBAT and dm:
		print("[Deck] %s state: draw=%d hand=%d discard=%d" % [
			data.unit_name, dm.get_draw_count(), dm.hand.size(), dm.get_discard_count()
		])
	print("[Turn] %s — Action Phase (AP:%d, Cards:%d, Captures:%d)" % [
		data.unit_name, _current_ap, dm.hand.size() if dm else 0, _capture_buttons.size()
	])


## Skip Move button pressed — go straight to action phase
func _on_skip_move_pressed() -> void:
	if active_unit and current_state == BattleState.PLAYER_UNIT_TURN:
		print("[Action] Skip Move pressed")
		_enter_action_phase()


# --- Capture Button Overlay System ---

## Create floating "Capture" buttons above adjacent unbound enemies
func _create_capture_buttons() -> void:
	_clear_capture_buttons()
	if not active_unit or not is_instance_valid(active_unit):
		return

	var pos: Vector2i = battle_grid.world_to_grid(active_unit.position)
	for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
		var adj: Vector2i = pos + dir
		var adj_unit: Node2D = battle_grid.get_unit_at(adj)
		if adj_unit and is_instance_valid(adj_unit):
			var adj_data: UnitData = adj_unit.get_unit_data()
			if adj_data and not adj_data.is_player_unit and adj_data.is_alive() and not adj_data.is_bound:
				var btn := _make_capture_button(adj_unit)
				# Disable if not enough AP
				if _current_ap < CAPTURE_AP_COST:
					btn.disabled = true
					btn.modulate = Color(0.5, 0.5, 0.5, 0.7)
				$UI.add_child(btn)
				_capture_buttons.append(btn)
				print("[UI] Capture button created for %s (HP:%d/%d)" % [adj_data.unit_name, adj_data.current_hp, adj_data.max_hp])

	# Position them immediately
	_update_capture_button_positions()


## Create a styled capture button for a specific enemy
func _make_capture_button(target: Node2D) -> Button:
	var btn := Button.new()
	var chance: int = _get_subdue_chance(active_unit, target)
	btn.text = "Capture %d%% [%dAP]" % [chance, CAPTURE_AP_COST]
	btn.custom_minimum_size = Vector2(110, 28)
	btn.set_meta("target_unit", target)

	# Red/danger style — emphasize risk
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.2, 0.06, 0.06, 0.92)
	normal.border_color = Color(0.769, 0.267, 0.267)
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(4)
	normal.set_content_margin_all(4)
	btn.add_theme_stylebox_override("normal", normal)

	var hover := StyleBoxFlat.new()
	hover.bg_color = Color(0.35, 0.1, 0.1, 0.95)
	hover.border_color = Color(0.9, 0.35, 0.35)
	hover.set_border_width_all(2)
	hover.set_corner_radius_all(4)
	hover.set_content_margin_all(4)
	btn.add_theme_stylebox_override("hover", hover)

	btn.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))
	btn.add_theme_color_override("font_hover_color", Color(0.9, 0.35, 0.35))
	btn.add_theme_font_size_override("font_size", 12)
	btn.mouse_filter = Control.MOUSE_FILTER_STOP

	btn.pressed.connect(_on_capture_button_pressed.bind(target))
	return btn


## Update capture button screen positions to track enemy world positions
func _update_capture_button_positions() -> void:
	var canvas_xform: Transform2D = get_viewport().get_canvas_transform()
	for btn in _capture_buttons:
		if not is_instance_valid(btn):
			continue
		var target = btn.get_meta("target_unit")
		if is_instance_valid(target):
			var screen_pos: Vector2 = canvas_xform * target.position
			btn.position = screen_pos + Vector2(-55, -50)  # Centered above unit
		else:
			btn.visible = false


## Clear all capture buttons
func _clear_capture_buttons() -> void:
	for btn in _capture_buttons:
		if is_instance_valid(btn):
			btn.queue_free()
	_capture_buttons.clear()


## Capture button pressed — costs 2 AP, stays in action phase if AP remains
const CAPTURE_AP_COST: int = 2

func _on_capture_button_pressed(target: Node2D) -> void:
	if not active_unit or current_state != BattleState.PLAYER_ACTION_PHASE:
		return
	if not is_instance_valid(target):
		return
	if _current_ap < CAPTURE_AP_COST:
		print("[Action] CAPTURE failed — not enough AP (%d/%d)" % [_current_ap, CAPTURE_AP_COST])
		return

	current_state = BattleState.ANIMATING
	battle_input.input_enabled = false
	_clear_capture_buttons()

	var atk_data: UnitData = active_unit.get_unit_data()
	var def_data: UnitData = target.get_unit_data()
	var success_rate: int = _get_subdue_chance(active_unit, target)
	var roll: int = randi() % 100
	var success: bool = roll < success_rate

	# Deduct AP
	_current_ap -= CAPTURE_AP_COST

	if DEBUG_COMBAT:
		print("[Capture] %s attempts capture on %s | Chance: %d%% Roll: %d → %s (AP left: %d)" % [
			atk_data.unit_name, def_data.unit_name, success_rate, roll,
			"SUCCESS" if success else "FAIL", _current_ap
		])

	# Animate attacker sliding toward target
	var atk_pos: Vector2 = active_unit.position
	var def_pos: Vector2 = target.position
	var slide_target: Vector2 = atk_pos.lerp(def_pos, 0.3)
	var slide_tween: Tween = create_tween()
	slide_tween.tween_property(active_unit, "position", slide_target, 0.15)
	slide_tween.tween_property(active_unit, "position", atk_pos, 0.15)
	await slide_tween.finished

	if success:
		def_data.is_bound = true
		target.set_bound(true)
		bound_enemies.append(def_data)
		if combat_log:
			combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, true, true)
		EventBus.show_notification.emit("Captured %s!" % def_data.unit_name)
	else:
		if combat_log:
			combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, false, true)
		EventBus.show_notification.emit("Capture failed! (%d%%)" % success_rate)

	# Check battle end (capture counts as defeating an enemy)
	if _check_battle_end():
		_card_hand_ui.hide_hand()
		_clear_capture_buttons()
		return

	# Update UI and continue action phase if AP remains
	var dm = _deck_managers.get(active_unit)
	if dm:
		_card_hand_ui.update_ap(_current_ap, _max_ap)

	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		current_state = BattleState.PLAYER_ACTION_PHASE
		_create_capture_buttons()  # Refresh — captured enemy's button disappears


func _start_enemy_unit_turn(unit: Node2D) -> void:
	current_state = BattleState.ENEMY_UNIT_TURN
	battle_input.input_enabled = false
	_card_hand_ui.hide_hand()
	_clear_capture_buttons()
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
	_card_hand_ui.hide_hand()
	_clear_capture_buttons()
	_hide_targeting_label()
	_hide_damage_preview()
	if _skip_move_btn:
		_skip_move_btn.visible = false

	# Clear active unit highlight
	if active_unit and is_instance_valid(active_unit) and active_unit.has_method("set_active_turn"):
		active_unit.set_active_turn(false)

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


## Update damage preview label position and text during card targeting
func _update_damage_preview() -> void:
	if not _damage_preview_label or not grid_overlay:
		return

	var hover: Vector2i = grid_overlay.get_hover_tile()
	if hover == _last_preview_tile:
		return  # No change
	_last_preview_tile = hover

	if not battle_grid.is_in_bounds(hover):
		_damage_preview_label.visible = false
		return

	var target_unit: Node2D = battle_grid.get_unit_at(hover)
	if not target_unit or not is_instance_valid(target_unit):
		_damage_preview_label.visible = false
		return

	var target_data: UnitData = target_unit.get_unit_data()
	if not target_data:
		_damage_preview_label.visible = false
		return

	var caster_data: UnitData = active_unit.get_unit_data()
	var card: CardData = _pending_card

	# Compute preview
	var preview_text: String = ""
	var preview_color: Color = Color(1.0, 0.3, 0.3)  # Red for damage

	if card.damage_base > 0 or card.damage_stat != "":
		var damage: int = _compute_card_damage_preview(card, caster_data, target_data, hover)
		var hits: int = int(card.damage_multiplier) if card.damage_multiplier > 1.0 else 1
		if hits > 1:
			preview_text = "%d x%d" % [damage / hits, hits]
		else:
			preview_text = "%d" % damage
		# Show KO indicator
		if damage >= target_data.current_hp:
			preview_text += " KO"
			preview_color = Color(1.0, 0.15, 0.15)
	elif card.heal_base > 0 or card.heal_stat != "":
		var heal: int = card.get_computed_healing(caster_data)
		var actual_heal: int = min(heal, target_data.max_hp - target_data.current_hp)
		preview_text = "+%d" % actual_heal
		preview_color = Color(0.3, 1.0, 0.3)  # Green for healing

	if preview_text.is_empty():
		_damage_preview_label.visible = false
		return

	_damage_preview_label.text = preview_text
	_damage_preview_label.add_theme_color_override("font_color", preview_color)

	# Position above the target unit (world → screen space)
	var canvas_xform: Transform2D = get_viewport().get_canvas_transform()
	var screen_pos: Vector2 = canvas_xform * target_unit.position
	_damage_preview_label.position = screen_pos + Vector2(-30, -70)
	_damage_preview_label.visible = true


## Compute card damage preview without applying it
func _compute_card_damage_preview(card: CardData, caster: UnitData, target: UnitData, target_tile: Vector2i) -> int:
	var raw_damage: int = card.get_computed_damage(caster)

	# Flat DR from DEF or RES
	var dr: int = 0
	if card.is_magic:
		dr = int(target.resistance / 2.0)
	else:
		dr = int(target.defense / 2.0)

	# Terrain defense bonus
	dr += battle_grid.get_terrain_def_bonus(target_tile)

	# Weapon triangle bonus
	var triangle_dmg: int = 0
	if card.weapon_type != ItemData.WeaponType.NONE and target.equipped_weapon and target.equipped_weapon is ItemData:
		triangle_dmg = ItemData.get_triangle_advantage(card.weapon_type, target.equipped_weapon.weapon_type)

	var damage_per_hit: int = max(0, raw_damage - dr + triangle_dmg)
	var hits: int = int(card.damage_multiplier) if card.damage_multiplier > 1.0 else 1
	return damage_per_hit * hits


## Show "Select target for [card]" label at top of screen
func _show_targeting_label(text: String) -> void:
	if _targeting_label:
		_targeting_label.text = text
		_targeting_label.visible = true


## Hide the targeting label
func _hide_targeting_label() -> void:
	if _targeting_label:
		_targeting_label.visible = false


## Hide the damage preview label
func _hide_damage_preview() -> void:
	if _damage_preview_label:
		_damage_preview_label.visible = false
	_last_preview_tile = Vector2i(-1, -1)


## Show a brief "No targets in range" flash message
func _show_no_targets_message(text: String) -> void:
	if not _targeting_label:
		return
	_targeting_label.text = text
	_targeting_label.add_theme_color_override("font_color", Color(0.769, 0.267, 0.267))
	_targeting_label.visible = true
	# Flash red then fade
	await get_tree().create_timer(1.0).timeout
	_targeting_label.visible = false
	_targeting_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))


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
