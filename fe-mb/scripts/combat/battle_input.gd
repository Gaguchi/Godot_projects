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
signal subdue_requested(attacker: Node2D, target: Node2D)
signal undo_move_requested()
signal target_selection_cancelled()
signal card_target_confirmed(target: Node2D)
signal ground_target_confirmed(tile: Vector2i)

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
var _last_hovered_unit: Node2D = null

## Whether input is enabled
var input_enabled: bool = false
var is_selecting_target: bool = false
var _is_post_move_target: bool = false  # Target selection after moving
var _subdue_mode: bool = false  # When true, clicks on adjacent enemies attempt subdue instead of attack
var _card_targeting: bool = false  # When true, selecting target for a card
var _card_target_tiles: Array[Vector2i] = []  # Valid card target positions
var _ground_targeting: bool = false  # When true, selecting ground tile for AOE
var _ground_target_tiles: Array[Vector2i] = []
var _ground_aoe_radius: int = 0


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
	if not grid_overlay:
		return

	var hover: Vector2i = grid_overlay.get_hover_tile()
	if hover == last_hover_tile:
		return
	last_hover_tile = hover

	# AOE preview works even when input_enabled is false (visual only)
	if _ground_targeting and _ground_aoe_radius > 0:
		_update_aoe_preview(hover)

	if not input_enabled:
		return

	# Show/hide unit name tooltip on hover
	var hovered_unit: Node2D = null
	if battle_grid and battle_grid.is_in_bounds(hover):
		hovered_unit = battle_grid.get_unit_at(hover)
	if hovered_unit and hovered_unit.has_method("show_name_tooltip"):
		hovered_unit.show_name_tooltip(true)
	if _last_hovered_unit and _last_hovered_unit != hovered_unit and is_instance_valid(_last_hovered_unit):
		if _last_hovered_unit.has_method("show_name_tooltip"):
			_last_hovered_unit.show_name_tooltip(false)
	_last_hovered_unit = hovered_unit

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
	if _ground_targeting:
		_handle_ground_target_click(grid_pos)
		return

	if _card_targeting:
		_handle_card_target_click(grid_pos)
		return

	if is_selecting_target:
		_handle_target_selection(grid_pos)
		return

	if not active_unit or not selected_unit:
		return

	var clicked_unit: Node2D = battle_grid.get_unit_at(grid_pos)

	if clicked_unit:
		var clicked_data: UnitData = clicked_unit.get_unit_data()
		if not clicked_data.is_player_unit:
			# In card mode, clicking enemies just shows info (no direct attack)
			_show_unit_info(clicked_unit)
	elif grid_pos in walkable_tiles:
		# Store pre-move position for undo
		pre_move_position = battle_grid.world_to_grid(selected_unit.position)
		move_requested.emit(selected_unit, grid_pos)


func _handle_right_click() -> void:
	if _ground_targeting:
		_ground_targeting = false
		_ground_target_tiles.clear()
		if grid_overlay:
			grid_overlay.set_aoe_preview_tiles([])
			grid_overlay.clear_highlights()
		print("[Input] Ground targeting cancelled (right-click)")
		target_selection_cancelled.emit()
		return

	if _card_targeting:
		# Cancel card targeting — return to hand
		_card_targeting = false
		_card_target_tiles.clear()
		if grid_overlay:
			grid_overlay.clear_highlights()
		print("[Input] Card targeting cancelled (right-click)")
		target_selection_cancelled.emit()
		return

	if is_selecting_target and _is_post_move_target and pre_move_position != Vector2i(-1, -1):
		_is_post_move_target = false
		is_selecting_target = false
		attacking_unit = null
		undo_move_requested.emit()
	elif is_selecting_target:
		is_selecting_target = false
		_is_post_move_target = false
		attacking_unit = null
		target_selection_cancelled.emit()


func _handle_enemy_click(enemy: Node2D, grid_pos: Vector2i) -> void:
	if not selected_unit:
		_show_unit_info(enemy)
		return

	# Check if enemy is bound (can't attack or subdue bound enemies)
	var enemy_data: UnitData = enemy.get_unit_data()
	if enemy_data and enemy_data.is_bound:
		return

	if grid_pos in attackable_tiles:
		var attacker: Node2D = selected_unit
		# Subdue mode: only works at melee range (distance 1)
		if _subdue_mode:
			var attacker_pos: Vector2i = battle_grid.world_to_grid(attacker.position)
			var dist: int = abs(grid_pos.x - attacker_pos.x) + abs(grid_pos.y - attacker_pos.y)
			if dist == 1:
				attacking_unit = attacker
				_clear_selection_visuals()
				_subdue_mode = false
				subdue_requested.emit(attacker, enemy)
				return
		# Normal attack
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


## Toggle subdue mode on/off
func set_subdue_mode(enabled: bool) -> void:
	_subdue_mode = enabled


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
	_subdue_mode = false

	# Clear hover tooltip
	if _last_hovered_unit and is_instance_valid(_last_hovered_unit) and _last_hovered_unit.has_method("show_name_tooltip"):
		_last_hovered_unit.show_name_tooltip(false)
	_last_hovered_unit = null

	_fade_panel_out(unit_info_panel)
	_fade_panel_out(combat_forecast_panel)
	if grid_overlay:
		grid_overlay.clear_highlights()

	unit_deselected.emit()


func _clear_selection_visuals() -> void:
	if grid_overlay:
		grid_overlay.clear_highlights()
	_fade_panel_out(unit_info_panel)
	_fade_panel_out(combat_forecast_panel)


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

	var blood_red := UIColors.COLOR_BLOOD_RED
	var parchment := UIColors.COLOR_PARCHMENT

	var atk_panel: VBoxContainer = combat_forecast_panel.get_node("VBox/HBox/AttackerPanel")
	atk_panel.get_node("AttackerName").text = atk_data.unit_name

	# Predicted HP for attacker
	var atk_hp_label: Label = atk_panel.get_node("AttackerHP")
	if forecast.defender_can_counter:
		var atk_total_dmg: int = forecast.defender_damage * (2 if forecast.defender_doubles else 1)
		var atk_hp_after: int = max(0, atk_data.current_hp - atk_total_dmg)
		if atk_hp_after == 0:
			atk_hp_label.text = "HP: %d → 0 KO" % atk_data.current_hp
			atk_hp_label.add_theme_color_override("font_color", blood_red)
		else:
			atk_hp_label.text = "HP: %d → %d" % [atk_data.current_hp, atk_hp_after]
			atk_hp_label.add_theme_color_override("font_color", parchment)
	else:
		atk_hp_label.text = "HP: %d" % atk_data.current_hp
		atk_hp_label.add_theme_color_override("font_color", parchment)

	atk_panel.get_node("AttackerArm").text = "Arm: %d" % atk_data.current_armor
	atk_panel.get_node("AttackerDmg").text = "Dmg: %d%s" % [forecast.attacker_damage, " x2" if forecast.attacker_doubles else ""]
	atk_panel.get_node("AttackerHit").text = "Hit: %d%%" % forecast.attacker_hit
	atk_panel.get_node("AttackerCrit").text = "Crit: %d%%" % forecast.attacker_crit

	var def_panel: VBoxContainer = combat_forecast_panel.get_node("VBox/HBox/DefenderPanel")
	def_panel.get_node("DefenderName").text = def_data.unit_name

	# Predicted HP for defender
	var def_hp_label: Label = def_panel.get_node("DefenderHP")
	var def_total_dmg: int = forecast.attacker_damage * (2 if forecast.attacker_doubles else 1)
	var def_hp_after: int = max(0, def_data.current_hp - def_total_dmg)
	if def_hp_after == 0:
		def_hp_label.text = "HP: %d → 0 KO" % def_data.current_hp
		def_hp_label.add_theme_color_override("font_color", blood_red)
	else:
		def_hp_label.text = "HP: %d → %d" % [def_data.current_hp, def_hp_after]
		def_hp_label.add_theme_color_override("font_color", parchment)

	def_panel.get_node("DefenderArm").text = "Arm: %d" % def_data.current_armor
	if forecast.defender_can_counter:
		def_panel.get_node("DefenderDmg").text = "Dmg: %d%s" % [forecast.defender_damage, " x2" if forecast.defender_doubles else ""]
		def_panel.get_node("DefenderHit").text = "Hit: %d%%" % forecast.defender_hit
		def_panel.get_node("DefenderCrit").text = "Crit: %d%%" % forecast.defender_crit
	else:
		def_panel.get_node("DefenderDmg").text = "Dmg: --"
		def_panel.get_node("DefenderHit").text = "Hit: --"
		def_panel.get_node("DefenderCrit").text = "No Counter"

	_fade_panel_in(combat_forecast_panel)


func _hide_combat_forecast() -> void:
	_fade_panel_out(combat_forecast_panel)


func _fade_panel_in(panel: Control) -> void:
	if not panel:
		return
	panel.modulate = Color(1, 1, 1, 0)
	panel.visible = true
	var tween = panel.create_tween()
	tween.tween_property(panel, "modulate:a", 1.0, 0.15).set_ease(Tween.EASE_OUT)


func _fade_panel_out(panel: Control) -> void:
	if not panel or not panel.visible:
		return
	var tween = panel.create_tween()
	tween.tween_property(panel, "modulate:a", 0.0, 0.1).set_ease(Tween.EASE_IN)
	await tween.finished
	if is_instance_valid(panel):
		panel.visible = false
		panel.modulate = Color(1, 1, 1, 1)


## Enter card target selection mode — highlights valid target tiles
func enter_card_target_selection(unit: Node2D, valid_targets: Array[Vector2i]) -> void:
	_card_targeting = true
	_card_target_tiles = valid_targets
	attacking_unit = unit
	input_enabled = true
	print("[Input] Card target selection started — %d valid targets" % valid_targets.size())

	if grid_overlay:
		grid_overlay.set_walkable_tiles([])
		grid_overlay.set_attackable_tiles(valid_targets)


## Handle click during card target selection
func _handle_card_target_click(grid_pos: Vector2i) -> void:
	if grid_pos in _card_target_tiles:
		var target: Node2D = battle_grid.get_unit_at(grid_pos)
		if target:
			_card_targeting = false
			_card_target_tiles.clear()
			if grid_overlay:
				grid_overlay.clear_highlights()
			card_target_confirmed.emit(target)
			return

	# Clicked outside valid targets — cancel
	_card_targeting = false
	_card_target_tiles.clear()
	if grid_overlay:
		grid_overlay.clear_highlights()
	target_selection_cancelled.emit()


## Clear movement highlights (called after unit has moved this turn)
func clear_movement_highlights() -> void:
	walkable_tiles.clear()
	attack_range_tiles.clear()
	if grid_overlay:
		grid_overlay.set_walkable_tiles([])
		grid_overlay.set_attackable_tiles([])


## Enter ground target selection mode — highlights valid tiles for AOE
func enter_ground_target_selection(unit: Node2D, valid_tiles: Array[Vector2i], aoe_radius: int) -> void:
	_ground_targeting = true
	_ground_target_tiles = valid_tiles
	_ground_aoe_radius = aoe_radius
	attacking_unit = unit
	input_enabled = true

	if grid_overlay:
		grid_overlay.set_walkable_tiles([])
		grid_overlay.set_attackable_tiles(valid_tiles)
	print("[Input] Ground target selection started — %d valid tiles, AOE radius %d" % [valid_tiles.size(), aoe_radius])


## Update AOE impact zone preview around hovered tile
func _update_aoe_preview(hover: Vector2i) -> void:
	if not grid_overlay or not battle_grid:
		return

	# Only show preview if hovering over a valid target tile
	if hover not in _ground_target_tiles:
		grid_overlay.set_aoe_preview_tiles([])
		return

	var preview: Array = [hover]
	for x in range(hover.x - _ground_aoe_radius, hover.x + _ground_aoe_radius + 1):
		for y in range(hover.y - _ground_aoe_radius, hover.y + _ground_aoe_radius + 1):
			var pos := Vector2i(x, y)
			if pos == hover:
				continue
			var dist: int = abs(pos.x - hover.x) + abs(pos.y - hover.y)
			if dist <= _ground_aoe_radius and battle_grid.is_in_bounds(pos):
				preview.append(pos)

	grid_overlay.set_aoe_preview_tiles(preview)


## Handle click during ground target selection
func _handle_ground_target_click(grid_pos: Vector2i) -> void:
	if grid_pos in _ground_target_tiles:
		print("[Input] Ground target confirmed at (%d,%d)" % [grid_pos.x, grid_pos.y])
		_ground_targeting = false
		_ground_target_tiles.clear()
		if grid_overlay:
			grid_overlay.set_aoe_preview_tiles([])
			grid_overlay.clear_highlights()
		ground_target_confirmed.emit(grid_pos)
		return

	# Clicked outside valid tiles — cancel
	print("[Input] Ground target click outside valid area (%d,%d) — cancelled" % [grid_pos.x, grid_pos.y])
	_ground_targeting = false
	_ground_target_tiles.clear()
	if grid_overlay:
		grid_overlay.set_aoe_preview_tiles([])
		grid_overlay.clear_highlights()
	target_selection_cancelled.emit()
