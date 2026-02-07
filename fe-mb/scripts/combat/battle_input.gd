class_name BattleInput
extends Node
## BattleInput - Handles player input during combat
## Supports speed-based turn system: one active unit at a time

signal unit_selected(unit: Node2D)
signal unit_deselected()
signal move_requested(unit: Node2D, target: Vector2i)
signal attack_requested(attacker: Node2D, target: Node2D)
signal attack_after_move_requested(attacker: Node2D, target: Node2D, move_tile: Vector2i)
signal wait_requested(unit: Node2D)
signal undo_move_requested()
signal target_selection_cancelled()

## References set by battlefield
var battle_grid: BattleGrid
var grid_overlay: Node2D  # GridOverlay
var units_container: Node2D
var unit_info_panel: PanelContainer
var combat_forecast_panel: PanelContainer

## State
var selected_unit: Node2D = null
var attacking_unit: Node2D = null
var active_unit: Node2D = null  # The unit whose turn it is
var walkable_tiles: Array[Vector2i] = []
var attackable_tiles: Array[Vector2i] = []
var attack_range_tiles: Array[Vector2i] = []
var last_hover_tile: Vector2i = Vector2i(-1, -1)
var pre_move_position: Vector2i = Vector2i(-1, -1)

## Whether input is enabled
var input_enabled: bool = false
var is_selecting_target: bool = false
var _is_post_move_target: bool = false  # Target selection after moving


func handle_input(event: InputEvent) -> void:
	if not input_enabled:
		return

	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			var click_pos: Vector2 = _get_world_mouse_position()
			var grid_pos: Vector2i = battle_grid.world_to_grid(click_pos)
			_handle_click(grid_pos)
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_handle_right_click()


func update_hover() -> void:
	if not input_enabled or not grid_overlay:
		return

	var hover: Vector2i = grid_overlay.get_hover_tile()
	if hover == last_hover_tile:
		return
	last_hover_tile = hover

	if is_selecting_target and attacking_unit:
		_update_target_hover(hover)
	elif selected_unit and not is_selecting_target:
		_update_path_preview(hover)


func _get_world_mouse_position() -> Vector2:
	var viewport: Viewport = get_viewport()
	if viewport:
		return viewport.get_canvas_transform().affine_inverse() * viewport.get_mouse_position()
	return Vector2.ZERO


func _handle_click(grid_pos: Vector2i) -> void:
	if is_selecting_target:
		_handle_target_selection(grid_pos)
		return

	if not active_unit or not selected_unit:
		return

	var clicked_unit: Node2D = battle_grid.get_unit_at(grid_pos)

	if clicked_unit:
		var clicked_data: UnitData = clicked_unit.get_unit_data()
		if not clicked_data.is_player_unit:
			_handle_enemy_click(clicked_unit, grid_pos)
	elif grid_pos in walkable_tiles:
		# Store pre-move position for undo
		pre_move_position = battle_grid.world_to_grid(selected_unit.position)
		move_requested.emit(selected_unit, grid_pos)


func _handle_right_click() -> void:
	if is_selecting_target and _is_post_move_target and pre_move_position != Vector2i(-1, -1):
		# Undo move during post-move target selection
		_is_post_move_target = false
		is_selecting_target = false
		attacking_unit = null
		undo_move_requested.emit()
	elif is_selecting_target:
		# Cancel target selection (e.g. direct attack cancelled) - wait instead
		is_selecting_target = false
		_is_post_move_target = false
		attacking_unit = null
		if active_unit:
			wait_requested.emit(active_unit)


func _handle_enemy_click(enemy: Node2D, grid_pos: Vector2i) -> void:
	if not selected_unit:
		_show_unit_info(enemy)
		return

	if grid_pos in attackable_tiles:
		# Direct attack without moving
		var attacker: Node2D = selected_unit
		attacking_unit = attacker
		_clear_selection_visuals()
		attack_requested.emit(attacker, enemy)
	elif grid_pos in attack_range_tiles:
		# Move + attack
		var move_tile: Vector2i = battle_grid.find_attack_position(selected_unit, grid_pos, walkable_tiles)
		if move_tile != Vector2i(-1, -1):
			var attacker: Node2D = selected_unit
			attacking_unit = attacker
			_clear_selection_visuals()
			attack_after_move_requested.emit(attacker, enemy, move_tile)
		else:
			_show_unit_info(enemy)
	else:
		_show_unit_info(enemy)


## Set the active unit for this turn (called by battlefield)
func set_active_unit(unit: Node2D) -> void:
	active_unit = unit
	_select_unit(unit)


## Enter target selection after movement (no action menu)
func enter_target_selection_after_move(unit: Node2D, attack_tiles: Array[Vector2i]) -> void:
	is_selecting_target = true
	_is_post_move_target = true
	attacking_unit = unit
	selected_unit = unit
	attackable_tiles = attack_tiles

	if grid_overlay:
		grid_overlay.set_walkable_tiles([])
		grid_overlay.set_attackable_tiles(attackable_tiles)


## Public deselect (called by battlefield for cleanup)
func deselect_unit() -> void:
	_deselect_unit()


func _select_unit(unit: Node2D) -> void:
	selected_unit = unit

	# Calculate ranges
	walkable_tiles = battle_grid.get_reachable_tiles(unit)
	attackable_tiles = battle_grid.get_attackable_enemies(unit)
	attack_range_tiles = battle_grid.get_combined_attack_range(unit, walkable_tiles)

	if grid_overlay:
		grid_overlay.set_walkable_tiles(walkable_tiles)
		grid_overlay.set_attackable_tiles(attack_range_tiles)
		grid_overlay.set_selected_tile(battle_grid.world_to_grid(unit.position))

	unit_selected.emit(unit)


func _deselect_unit() -> void:
	selected_unit = null
	attacking_unit = null
	walkable_tiles.clear()
	attackable_tiles.clear()
	attack_range_tiles.clear()
	last_hover_tile = Vector2i(-1, -1)
	pre_move_position = Vector2i(-1, -1)
	is_selecting_target = false
	_is_post_move_target = false

	if unit_info_panel:
		unit_info_panel.visible = false
	if combat_forecast_panel:
		combat_forecast_panel.visible = false
	if grid_overlay:
		grid_overlay.clear_highlights()

	unit_deselected.emit()


func _clear_selection_visuals() -> void:
	if grid_overlay:
		grid_overlay.clear_highlights()
	if unit_info_panel:
		unit_info_panel.visible = false
	if combat_forecast_panel:
		combat_forecast_panel.visible = false


func _update_path_preview(hover_tile: Vector2i) -> void:
	if not selected_unit or not grid_overlay:
		return

	if hover_tile.x < 0 or hover_tile not in walkable_tiles:
		grid_overlay.set_path_preview([])
		return

	var start: Vector2i = battle_grid.world_to_grid(selected_unit.position)
	battle_grid.update_astar_obstacles(start)
	var path: PackedVector2Array = battle_grid.get_grid_path(start, hover_tile)
	grid_overlay.set_path_preview(path)


func _update_target_hover(hover_tile: Vector2i) -> void:
	if hover_tile in attackable_tiles:
		var target: Node2D = battle_grid.get_unit_at(hover_tile)
		if target and attacking_unit:
			_show_combat_forecast(attacking_unit, target)
			return
	_hide_combat_forecast()


func _handle_target_selection(grid_pos: Vector2i) -> void:
	if grid_pos not in attackable_tiles:
		if _is_post_move_target:
			# Clicking outside attack range after move = wait
			is_selecting_target = false
			_is_post_move_target = false
			if is_instance_valid(attacking_unit):
				wait_requested.emit(attacking_unit)
			_deselect_unit()
		else:
			target_selection_cancelled.emit()
			_deselect_unit()
		return

	var target: Node2D = battle_grid.get_unit_at(grid_pos)
	if target and is_instance_valid(attacking_unit):
		var attacker: Node2D = attacking_unit
		is_selecting_target = false
		_is_post_move_target = false
		_deselect_unit()
		attack_requested.emit(attacker, target)
	else:
		if is_instance_valid(attacking_unit):
			wait_requested.emit(attacking_unit)
		_deselect_unit()


func _show_unit_info(unit: Node2D) -> void:
	unit_selected.emit(unit)


func _show_combat_forecast(attacker: Node2D, defender: Node2D) -> void:
	if not combat_forecast_panel:
		return

	var atk_data: UnitData = attacker.get_unit_data()
	var def_data: UnitData = defender.get_unit_data()
	var def_pos: Vector2i = battle_grid.world_to_grid(defender.position)

	var forecast: Dictionary = CombatManager.calculate_combat(
		atk_data, def_data,
		battle_grid.get_terrain_def_bonus(def_pos),
		battle_grid.get_terrain_avoid_bonus(def_pos)
	)

	var atk_panel: VBoxContainer = combat_forecast_panel.get_node("VBox/HBox/AttackerPanel")
	atk_panel.get_node("AttackerName").text = atk_data.unit_name
	atk_panel.get_node("AttackerHP").text = "HP: %d" % atk_data.current_hp
	atk_panel.get_node("AttackerArm").text = "Arm: %d" % atk_data.current_armor
	atk_panel.get_node("AttackerDmg").text = "Dmg: %d%s" % [forecast.attacker_damage, " x2" if forecast.attacker_doubles else ""]
	atk_panel.get_node("AttackerHit").text = "Hit: %d%%" % forecast.attacker_hit
	atk_panel.get_node("AttackerCrit").text = "Crit: %d%%" % forecast.attacker_crit

	var def_panel: VBoxContainer = combat_forecast_panel.get_node("VBox/HBox/DefenderPanel")
	def_panel.get_node("DefenderName").text = def_data.unit_name
	def_panel.get_node("DefenderHP").text = "HP: %d" % def_data.current_hp
	def_panel.get_node("DefenderArm").text = "Arm: %d" % def_data.current_armor
	if forecast.defender_can_counter:
		def_panel.get_node("DefenderDmg").text = "Dmg: %d%s" % [forecast.defender_damage, " x2" if forecast.defender_doubles else ""]
		def_panel.get_node("DefenderHit").text = "Hit: %d%%" % forecast.defender_hit
		def_panel.get_node("DefenderCrit").text = "Crit: %d%%" % forecast.defender_crit
	else:
		def_panel.get_node("DefenderDmg").text = "Dmg: --"
		def_panel.get_node("DefenderHit").text = "Hit: --"
		def_panel.get_node("DefenderCrit").text = "No Counter"

	combat_forecast_panel.visible = true


func _hide_combat_forecast() -> void:
	if combat_forecast_panel:
		combat_forecast_panel.visible = false
