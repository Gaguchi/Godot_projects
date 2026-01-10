extends Node2D
## Battlefield - Main combat scene controller
## Manages grid, units, turns, and combat flow

signal battle_finished(victory: bool)

## Debug Flags
const DEBUG_SPAWN = true
const DEBUG_COMBAT = true

enum BattleState {
	PLAYER_TURN,
	ENEMY_TURN,
	ANIMATING,
	SELECTING_TARGET,
	ACTION_MENU,
	BATTLE_END
}

const TILE_SIZE: int = 32
const GRID_WIDTH: int = 10
const GRID_HEIGHT: int = 10

@onready var tilemap: TileMapLayer = $TileMapLayer
@onready var grid_overlay: Node2D = $GridOverlay
@onready var units_container: Node2D = $Units
@onready var turn_banner: Label = $UI/TurnBanner
@onready var unit_info: PanelContainer = $UI/UnitInfo
@onready var action_menu: PanelContainer = $UI/ActionMenu
@onready var combat_forecast: PanelContainer = $UI/CombatForecast

var UnitScene = preload("res://scenes/units/unit.tscn")
var DamageNumberScene = preload("res://scenes/ui/damage_number.tscn")

var current_state: BattleState = BattleState.PLAYER_TURN
var player_units: Array = []
var enemy_units: Array = []
var selected_unit: Node2D = null
var attacking_unit: Node2D = null  # Unit that clicked Attack (preserved during target selection)
var units_acted: Array = []  # Units that have acted this turn

# Grid data
var walkable_tiles: Array[Vector2i] = []
var attackable_tiles: Array[Vector2i] = []  # Enemies in range from current position
var attack_range_tiles: Array[Vector2i] = []  # All tiles reachable by attack (move + attack)
var can_attack_without_moving: bool = false

# Pathfinding
var astar: AStarGrid2D
var last_hover_tile: Vector2i = Vector2i(-1, -1)


func _ready() -> void:
	_setup_pathfinding()
	_connect_ui_signals()
	_clear_placeholder_units()
	
	# Ensure units exist for debugging/first load
	GameManager.ensure_party()
	
	_spawn_party_units()
	_spawn_enemy_units()
	
	# Wait for parent scene to initialize units
	await get_tree().process_frame
	await get_tree().process_frame
	_start_battle()


func _setup_pathfinding() -> void:
	astar = AStarGrid2D.new()
	astar.region = Rect2i(0, 0, GRID_WIDTH, GRID_HEIGHT)
	astar.cell_size = Vector2(TILE_SIZE, TILE_SIZE)
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	astar.update()


func _process(_delta: float) -> void:
	# Handle path preview during player turn
	if current_state == BattleState.PLAYER_TURN and selected_unit:
		if grid_overlay:
			var hover = grid_overlay.get_hover_tile()
			if hover != last_hover_tile:
				last_hover_tile = hover
				_update_path_preview(hover)
	
	# Handle combat forecast during target selection
	elif current_state == BattleState.SELECTING_TARGET and attacking_unit:
		if grid_overlay:
			var hover = grid_overlay.get_hover_tile()
			if hover != last_hover_tile:
				last_hover_tile = hover
				# Show forecast if hovering over an attackable tile
				if hover in attackable_tiles:
					var target = _get_unit_at(hover)
					if target:
						_show_combat_forecast(attacking_unit, target)
				else:
					_hide_combat_forecast()


func _connect_ui_signals() -> void:
	var attack_btn = $UI/ActionMenu/VBox/AttackBtn
	var wait_btn = $UI/ActionMenu/VBox/WaitBtn
	var item_btn = $UI/ActionMenu/VBox/ItemBtn
	
	attack_btn.pressed.connect(_on_attack_pressed)
	wait_btn.pressed.connect(_on_wait_pressed)
	item_btn.pressed.connect(_on_item_pressed)


func _start_battle() -> void:
	print("[Battlefield] Battle started!")
	_gather_units()
	_start_player_turn()


func _gather_units() -> void:
	player_units.clear()
	enemy_units.clear()
	
	for unit in units_container.get_children():
		if not unit.has_method("get_unit_data"):
			continue
		var data = unit.get_unit_data()
		if data == null:
			push_warning("[Battlefield] Unit %s has no data!" % unit.name)
			continue
		if data.is_player_unit:
			player_units.append(unit)
		else:
			enemy_units.append(unit)
	
	print("[Battlefield] Found %d player units and %d enemy units" % [player_units.size(), enemy_units.size()])


func _start_player_turn() -> void:
	current_state = BattleState.PLAYER_TURN
	units_acted.clear()
	
	# Reset all player units for new turn
	for unit in player_units:
		if unit.has_method("reset_turn"):
			unit.reset_turn()
	
	_show_turn_banner("Player Phase")
	EventBus.turn_started.emit(true)


func _start_enemy_turn() -> void:
	current_state = BattleState.ENEMY_TURN
	units_acted.clear()
	
	_show_turn_banner("Enemy Phase")
	EventBus.turn_started.emit(false)
	
	# Process enemy AI after short delay
	await get_tree().create_timer(0.5).timeout
	_process_enemy_ai()


func _show_turn_banner(text: String) -> void:
	turn_banner.text = text
	turn_banner.visible = true
	await get_tree().create_timer(1.0).timeout
	turn_banner.visible = false


func _process_enemy_ai() -> void:
	# Make a copy of the array since units may be freed during iteration
	var enemies_to_process = enemy_units.duplicate()
	
	for enemy in enemies_to_process:
		if not is_instance_valid(enemy):
			continue
		if enemy in units_acted:
			continue
		var data = enemy.get_unit_data()
		if not data or not data.is_alive():
			continue
		
		# Simple AI: move toward nearest player unit and attack if in range
		await _enemy_act(enemy)
		units_acted.append(enemy)
		await get_tree().create_timer(0.3).timeout
		
		# Check if battle ended mid-turn
		if _check_battle_end():
			return
	
	_end_enemy_turn()


func _enemy_act(enemy: Node2D) -> void:
	# Find nearest player unit
	var nearest_player = _find_nearest_unit(enemy, player_units)
	if not nearest_player:
		return
	
	var enemy_pos = world_to_grid(enemy.position)
	var target_pos = world_to_grid(nearest_player.position)
	var distance = abs(enemy_pos.x - target_pos.x) + abs(enemy_pos.y - target_pos.y)
	
	# If in attack range, attack
	if distance <= 1:  # Melee range
		await _execute_combat(enemy, nearest_player)
	else:
		# Move toward target (simplified movement)
		var direction = (target_pos - enemy_pos).sign()
		var move_range = enemy.get_unit_data().movement
		var new_pos = enemy_pos + direction * min(move_range, distance - 1)
		
		# Prevent moving into occupied tiles
		if _get_unit_at(new_pos) != null:
			# Try horizontal or vertical only if diagonal is blocked
			var alt_pos = enemy_pos + Vector2i(direction.x, 0)
			if _get_unit_at(alt_pos) == null and _is_tile_walkable(alt_pos):
				new_pos = alt_pos
			else:
				alt_pos = enemy_pos + Vector2i(0, direction.y)
				if _get_unit_at(alt_pos) == null and _is_tile_walkable(alt_pos):
					new_pos = alt_pos
				else:
					# Stay put if blocked
					new_pos = enemy_pos
		
		new_pos = new_pos.clamp(Vector2i.ZERO, Vector2i(GRID_WIDTH - 1, GRID_HEIGHT - 1))
		
		if new_pos != enemy_pos:
			await _move_unit_animated(enemy, new_pos)
		else:
			print("[Battlefield] Enemy blocked, staying at %s" % enemy_pos)


func _find_nearest_unit(from_unit: Node2D, unit_list: Array) -> Node2D:
	var nearest: Node2D = null
	var nearest_dist: float = INF
	var from_pos = from_unit.position
	
	for unit in unit_list:
		if not is_instance_valid(unit):
			continue
		if not unit.get_unit_data() or not unit.get_unit_data().is_alive():
			continue
		var dist = from_pos.distance_to(unit.position)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = unit
	
	return nearest


func _end_enemy_turn() -> void:
	# Check win/lose conditions
	if _check_battle_end():
		return
	
	_start_player_turn()


func _check_battle_end() -> bool:
	var players_alive = player_units.filter(func(u): return is_instance_valid(u) and u.get_unit_data() and u.get_unit_data().is_alive())
	var enemies_alive = enemy_units.filter(func(u): return is_instance_valid(u) and u.get_unit_data() and u.get_unit_data().is_alive())
	
	if players_alive.is_empty():
		_end_battle(false)
		return true
	elif enemies_alive.is_empty():
		_end_battle(true)
		return true
	
	return false


func _end_battle(victory: bool) -> void:
	current_state = BattleState.BATTLE_END
	print("[Battlefield] Battle ended - Victory: ", victory)
	
	if victory:
		GameManager.battles_won += 1
	
	GameManager.last_battle_victory = victory
	
	EventBus.battle_ended.emit(victory)
	battle_finished.emit(victory)
	
	await get_tree().create_timer(2.0).timeout
	
	if victory:
		# Return to dungeon map
		SceneLoader.change_scene_to_file("res://scenes/dungeon/dungeon_map.tscn")
	else:
		# Game Over or Run Ended
		print("[Battlefield] Defeat... Run Ended")
		GameManager.end_run(false)
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")


func _input(event: InputEvent) -> void:
	if current_state != BattleState.PLAYER_TURN and current_state != BattleState.SELECTING_TARGET:
		return
	
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var click_pos = get_global_mouse_position()
		var grid_pos = world_to_grid(click_pos)
		print("[Battlefield] INPUT: Click at World %s -> Grid %s" % [click_pos, grid_pos])
		_handle_click(grid_pos)
	
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		print("[Battlefield] INPUT: Right Click (Deselect)")
		_deselect_unit()


func _handle_click(grid_pos: Vector2i) -> void:
	if current_state == BattleState.SELECTING_TARGET:
		_handle_target_selection(grid_pos)
		return
	
	# Check if clicked on a unit
	var clicked_unit = _get_unit_at(grid_pos)
	
	if clicked_unit:
		var clicked_data = clicked_unit.get_unit_data()
		print("[Battlefield] Clicked Unit: %s (%s)" % [clicked_data.unit_name, "Player" if clicked_data.is_player_unit else "Enemy"])
		
		if clicked_data.is_player_unit:
			_select_unit(clicked_unit)
		else:
			# Clicked on enemy - check if we can attack them
			if selected_unit:
				if grid_pos in attackable_tiles:
					print("[Battlefield] Enemy is in immediate attack range. Attacking!")
					# Direct attack without moving!
					attacking_unit = selected_unit
					var attacker = selected_unit
					_deselect_unit()
					await _execute_combat(attacker, clicked_unit)
					units_acted.append(attacker)
					if not _check_battle_end():
						_check_turn_end()
				elif grid_pos in attack_range_tiles:
					print("[Battlefield] Enemy is in COMBINED range (Move+Attack). Executing Move-Then-Attack.")
					# Find the best tile to move to
					var move_tile = _find_attack_position(selected_unit, clicked_unit)
					if move_tile != Vector2i(-1, -1):
						# Move
						await _move_unit_animated(selected_unit, move_tile)
						# Attack
						attacking_unit = selected_unit
						var attacker = selected_unit
						_deselect_unit()
						await _execute_combat(attacker, clicked_unit)
						units_acted.append(attacker)
						if not _check_battle_end():
							_check_turn_end()
					else:
						print("[Battlefield] Could not find valid attack position!")
						_show_unit_info(clicked_unit)
				else:
					print("[Battlefield] Enemy is out of range.")
					_show_unit_info(clicked_unit)
			else:
				# Just show enemy stats
				print("[Battlefield] No unit selected. Showing enemy info.")
				_show_unit_info(clicked_unit)
	elif selected_unit and grid_pos in walkable_tiles:
		# Move selected unit
		print("[Battlefield] Clicked valid movement tile.")
		_move_unit(selected_unit, grid_pos)
	elif selected_unit:
		print("[Battlefield] Clicked invalid tile (or outside move range). Deselecting.")
		_deselect_unit()


func _select_unit(unit: Node2D) -> void:
	if unit in units_acted:
		print("[Battlefield] Unit already acted this turn")
		return
	
	selected_unit = unit
	_show_unit_info(unit)
	
	# Calculate movement and attack ranges
	_calculate_movement_range(unit)
	_calculate_attack_in_place(unit)
	_calculate_combined_attack_range(unit)
	
	# Update grid overlay with combined range
	if grid_overlay:
		grid_overlay.set_walkable_tiles(walkable_tiles)
		grid_overlay.set_attackable_tiles(attack_range_tiles)
		grid_overlay.set_selected_tile(world_to_grid(unit.position))
	
	EventBus.unit_selected.emit(unit)


func _deselect_unit() -> void:
	selected_unit = null
	walkable_tiles.clear()
	attackable_tiles.clear()
	attack_range_tiles.clear()
	can_attack_without_moving = false
	last_hover_tile = Vector2i(-1, -1)
	action_menu.visible = false
	unit_info.visible = false
	_hide_combat_forecast()
	current_state = BattleState.PLAYER_TURN
	# Clear grid highlights
	if grid_overlay:
		grid_overlay.clear_highlights()


## Update path preview when hovering over tiles
func _update_path_preview(hover_tile: Vector2i) -> void:
	if not selected_unit or not grid_overlay:
		return
	
	# Clear path if not hovering a valid tile
	if hover_tile.x < 0 or hover_tile not in walkable_tiles:
		grid_overlay.set_path_preview([])
		return
	
	var start = world_to_grid(selected_unit.position)
	
	# Update AStar with current obstacles (units)
	_update_astar_obstacles()
	
	# Get path from AStar
	var path = astar.get_id_path(start, hover_tile)
	grid_overlay.set_path_preview(path)


## Update AStar grid with current unit positions as obstacles
func _update_astar_obstacles() -> void:
	# First, clear all solid points
	for x in range(GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			astar.set_point_solid(Vector2i(x, y), false)
	
	# Mark tiles with units as solid (except the selected unit's position)
	var selected_pos = world_to_grid(selected_unit.position) if selected_unit else Vector2i(-1, -1)
	for unit in units_container.get_children():
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue
		var unit_pos = world_to_grid(unit.position)
		if unit_pos != selected_pos:
			astar.set_point_solid(unit_pos, true)


## Show combat forecast panel with predicted battle results
func _show_combat_forecast(attacker: Node2D, defender: Node2D) -> void:
	if not combat_forecast:
		return
	
	var atk_data = attacker.get_unit_data()
	var def_data = defender.get_unit_data()
	
	# Calculate forecast
	var forecast = CombatManager.calculate_combat(atk_data, def_data)
	
	# Update attacker panel
	var atk_panel = combat_forecast.get_node("VBox/HBox/AttackerPanel")
	atk_panel.get_node("AttackerName").text = atk_data.unit_name
	atk_panel.get_node("AttackerHP").text = "HP: %d" % atk_data.current_hp
	atk_panel.get_node("AttackerDmg").text = "Dmg: %d%s" % [forecast.attacker_damage, " x2" if forecast.attacker_doubles else ""]
	atk_panel.get_node("AttackerHit").text = "Hit: %d%%" % forecast.attacker_hit
	atk_panel.get_node("AttackerCrit").text = "Crit: %d%%" % forecast.attacker_crit
	
	# Update defender panel
	var def_panel = combat_forecast.get_node("VBox/HBox/DefenderPanel")
	def_panel.get_node("DefenderName").text = def_data.unit_name
	def_panel.get_node("DefenderHP").text = "HP: %d" % def_data.current_hp
	if forecast.defender_can_counter:
		def_panel.get_node("DefenderDmg").text = "Dmg: %d%s" % [forecast.defender_damage, " x2" if forecast.defender_doubles else ""]
		def_panel.get_node("DefenderHit").text = "Hit: %d%%" % forecast.defender_hit
		def_panel.get_node("DefenderCrit").text = "Crit: %d%%" % forecast.defender_crit
	else:
		def_panel.get_node("DefenderDmg").text = "Dmg: --"
		def_panel.get_node("DefenderHit").text = "Hit: --"
		def_panel.get_node("DefenderCrit").text = "No Counter"
	
	combat_forecast.visible = true


## Hide combat forecast panel
func _hide_combat_forecast() -> void:
	if combat_forecast:
		combat_forecast.visible = false


func _show_unit_info(unit: Node2D) -> void:
	var data: UnitData = unit.get_unit_data()
	unit_info.visible = true
	
	var name_label = $UI/UnitInfo/VBox/UnitName
	var class_label = $UI/UnitInfo/VBox/UnitClass
	var hp_bar = $UI/UnitInfo/VBox/HPBar
	var hp_label = $UI/UnitInfo/VBox/HPLabel
	
	name_label.text = data.unit_name
	class_label.text = "Class: %s Lv.%d" % [data.get_class_name(), data.level]
	hp_bar.max_value = data.max_hp
	hp_bar.value = data.current_hp
	hp_label.text = "HP: %d/%d" % [data.current_hp, data.max_hp]


func _calculate_movement_range(unit: Node2D) -> void:
	walkable_tiles.clear()
	
	var start = world_to_grid(unit.position)
	var movement = unit.get_unit_data().movement
	
	# BFS for movement range
	var visited = {}
	var queue = [[start, movement]]
	
	while not queue.is_empty():
		var current = queue.pop_front()
		var pos: Vector2i = current[0]
		var remaining: int = current[1]
		
		if pos in visited:
			continue
		visited[pos] = true
		
		# Include current position as walkable (staying in place)
		if _is_tile_walkable(pos) and (pos == start or not _get_unit_at(pos)):
			if pos != start:
				walkable_tiles.append(pos)
		
		if remaining > 0:
			for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
				var next_pos = pos + dir
				if _is_in_bounds(next_pos) and _is_tile_walkable(next_pos):
					queue.append([next_pos, remaining - 1])


## Check if unit can attack enemies without moving (for attack-in-place)
func _calculate_attack_in_place(unit: Node2D) -> void:
	attackable_tiles.clear()
	can_attack_without_moving = false
	
	var unit_pos = world_to_grid(unit.position)
	var weapon = unit.get_unit_data().equipped_weapon
	
	var min_range = 1
	var max_range = 1
	if weapon and weapon is ItemData:
		min_range = weapon.range_min
		max_range = weapon.range_max
	
	# Find enemies in attack range from current position
	for x in range(-max_range, max_range + 1):
		for y in range(-max_range, max_range + 1):
			var dist = abs(x) + abs(y)
			if dist >= min_range and dist <= max_range:
				var tile = unit_pos + Vector2i(x, y)
				if _is_in_bounds(tile):
					var target = _get_unit_at(tile)
					if target and not target.get_unit_data().is_player_unit:
						attackable_tiles.append(tile)
						can_attack_without_moving = true


## Calculate combined attack range (all tiles reachable by move + attack)
func _calculate_combined_attack_range(unit: Node2D) -> void:
	attack_range_tiles.clear()
	
	var unit_pos = world_to_grid(unit.position)
	var weapon = unit.get_unit_data().equipped_weapon
	
	var min_range = 1
	var max_range = 1
	if weapon and weapon is ItemData:
		min_range = weapon.range_min
		max_range = weapon.range_max
	
	# All positions we can attack from (current + walkable)
	var attack_positions: Array[Vector2i] = [unit_pos]
	attack_positions.append_array(walkable_tiles)
	
	var attack_tiles_set = {}  # Use dict as set for deduplication
	
	for pos in attack_positions:
		for x in range(-max_range, max_range + 1):
			for y in range(-max_range, max_range + 1):
				var dist = abs(x) + abs(y)
				if dist >= min_range and dist <= max_range:
					var tile = pos + Vector2i(x, y)
					if _is_in_bounds(tile):
						# Only add if it's not a walkable tile (those are already blue)
						if tile not in walkable_tiles and tile != unit_pos:
							attack_tiles_set[tile] = true
	
	for tile in attack_tiles_set.keys():
		attack_range_tiles.append(tile)


func _move_unit(unit: Node2D, target: Vector2i) -> void:
	var old_pos = world_to_grid(unit.position)
	print("[Battlefield] Moving unit '%s' from %s to %s" % [unit.get_unit_data().unit_name, old_pos, target])
	
	await _move_unit_animated(unit, target)
	
	# Show action menu
	_show_action_menu(unit)


func _show_action_menu(unit: Node2D) -> void:
	current_state = BattleState.ACTION_MENU
	action_menu.visible = true
	
	# Clear movement highlights, calculate attack range
	if grid_overlay:
		grid_overlay.set_walkable_tiles([])
	
	# Check if there are attackable enemies
	_calculate_attack_range(unit)
	
	# Show attack range on grid
	if grid_overlay:
		grid_overlay.set_attackable_tiles(attackable_tiles)
	
	var attack_btn = $UI/ActionMenu/VBox/AttackBtn
	attack_btn.disabled = attackable_tiles.is_empty()


func _calculate_attack_range(unit: Node2D) -> void:
	attackable_tiles.clear()
	var unit_pos = world_to_grid(unit.position)
	var weapon = unit.get_unit_data().equipped_weapon
	
	var min_range = 1
	var max_range = 1
	if weapon and weapon is ItemData:
		min_range = weapon.range_min
		max_range = weapon.range_max
	
	# Find all tiles in attack range
	for x in range(-max_range, max_range + 1):
		for y in range(-max_range, max_range + 1):
			var dist = abs(x) + abs(y)
			if dist >= min_range and dist <= max_range:
				var tile = unit_pos + Vector2i(x, y)
				if _is_in_bounds(tile):
					var target = _get_unit_at(tile)
					if target and not target.get_unit_data().is_player_unit:
						attackable_tiles.append(tile)


## Find a valid tile to move to that allows attacking the target
func _find_attack_position(attacker: Node2D, target: Node2D) -> Vector2i:
	var target_pos = world_to_grid(target.position)
	var best_pos = Vector2i(-1, -1)
	var min_cost = INF
	
	var weapon = attacker.get_unit_data().equipped_weapon
	var min_range = 1
	var max_range = 1
	if weapon and weapon is ItemData:
		min_range = weapon.range_min
		max_range = weapon.range_max
		
	# Check all walkable tiles
	for tile in walkable_tiles:
		# Calculate distance to target from this tile
		var dist = abs(tile.x - target_pos.x) + abs(tile.y - target_pos.y)
		
		# If tile allows attacking
		if dist >= min_range and dist <= max_range:
			# Prioritize tiles closer to current position (less movement)
			var move_cost = abs(tile.x - world_to_grid(attacker.position).x) + abs(tile.y - world_to_grid(attacker.position).y)
			if move_cost < min_cost:
				min_cost = move_cost
				best_pos = tile
				
	return best_pos


## Move unit with a path-following animation
func _move_unit_animated(unit: Node2D, target: Vector2i) -> void:
	var start_pos = world_to_grid(unit.position)
	print("[Battlefield] Animating move for '%s' from %s to %s" % [unit.get_unit_data().unit_name, start_pos, target])
	
	# Clean up obstacles for pathfinding (temporarily ignore self)
	_update_astar_obstacles()
	
	var path = astar.get_id_path(start_pos, target)
	if path.is_empty():
		push_warning("[Battlefield] No path found for animation! Teleporting.")
		unit.position = grid_to_world(target)
		EventBus.unit_moved.emit(unit, start_pos, target)
		return
		
	# Animate along path
	for point in path:
		# Skip start point (already there)
		if point == start_pos:
			continue
			
		var world_target = grid_to_world(point)
		var tween = create_tween()
		tween.tween_property(unit, "position", world_target, 0.2).set_trans(Tween.TRANS_LINEAR)
		await tween.finished
	
	EventBus.unit_moved.emit(unit, start_pos, target)


func _on_attack_pressed() -> void:
	action_menu.visible = false
	current_state = BattleState.SELECTING_TARGET
	attacking_unit = selected_unit  # Save reference before any state changes
	print("[Battlefield] Select a target to attack. Attackable tiles: ", attackable_tiles)


func _on_wait_pressed() -> void:
	action_menu.visible = false
	units_acted.append(selected_unit)
	_deselect_unit()
	_check_turn_end()


func _on_item_pressed() -> void:
	# TODO: Implement item menu
	print("[Battlefield] Item menu not implemented yet")


func _handle_target_selection(grid_pos: Vector2i) -> void:
	print("[Battlefield] Target selection at: ", grid_pos, " Attackable: ", attackable_tiles)
	
	# If clicked outside attackable tiles, cancel attack but still end the unit's turn
	if grid_pos not in attackable_tiles:
		print("[Battlefield] Invalid target - ending unit's turn")
		if is_instance_valid(attacking_unit):
			units_acted.append(attacking_unit)
		attacking_unit = null
		_deselect_unit()
		_check_turn_end()
		return
	
	var target = _get_unit_at(grid_pos)
	print("[Battlefield] Target found: ", target.get_unit_data().unit_name if target else "None")
	
	if target and is_instance_valid(attacking_unit):
		var attacker = attacking_unit
		attacking_unit = null
		_deselect_unit()  # Deselect first to clear state
		await _execute_combat(attacker, target)
		units_acted.append(attacker)
		if not _check_battle_end():
			_check_turn_end()
	else:
		print("[Battlefield] No valid target or attacker")
		if is_instance_valid(attacking_unit):
			units_acted.append(attacking_unit)
		attacking_unit = null
		_deselect_unit()
		_check_turn_end()


func _execute_combat(attacker: Node2D, defender: Node2D) -> void:
	current_state = BattleState.ANIMATING
	
	var forecast = CombatManager.calculate_combat(
		attacker.get_unit_data(),
		defender.get_unit_data()
	)
	
	print("[Battlefield] Combat Forecast:")
	print("  Attacker: %s (HP: %d)" % [attacker.get_unit_data().unit_name, attacker.get_unit_data().current_hp])
	print("  Defender: %s (HP: %d)" % [defender.get_unit_data().unit_name, defender.get_unit_data().current_hp])
	print("  Hit Chance: %d%%, Dmg: %d, Crit: %d%%" % [forecast.attacker_hit, forecast.attacker_damage, forecast.attacker_crit])
	
	var result = CombatManager.execute_combat(forecast)
	print("[Battlefield] Combat Result: AttackerAlive=%s, DefenderAlive=%s" % [result.attacker_alive, result.defender_alive])
	
	# Show damage numbers with delays for visual feedback
	for entry in result.log:
		# Find which unit is the defender for this attack
		var target_unit = defender if entry.attacker == attacker.get_unit_data().unit_name else attacker
		
		if is_instance_valid(target_unit):
			_spawn_damage_number(target_unit.position, entry.damage, entry.crit, not entry.hit)
		
		# Log to console
		if entry.hit:
			print("%s hit %s for %d damage%s" % [
				entry.attacker,
				entry.defender,
				entry.damage,
				" (CRITICAL!)" if entry.crit else ""
			])
		else:
			print("%s missed %s" % [entry.attacker, entry.defender])
		
		# Wait between attacks for visual clarity
		await get_tree().create_timer(0.4).timeout
	
	# Handle deaths
	if not result.defender_alive:
		EventBus.unit_died.emit(defender)
		defender.queue_free()
		if not defender.get_unit_data().is_player_unit:
			# Award EXP for kill
			attacker.get_unit_data().add_experience(30)
	
	if not result.attacker_alive:
		EventBus.unit_died.emit(attacker)
		attacker.queue_free()
		if attacker.get_unit_data().is_player_unit:
			GameManager.remove_unit(attacker.get_unit_data())
	
	current_state = BattleState.PLAYER_TURN


## Spawn a floating damage number
func _spawn_damage_number(world_pos: Vector2, damage: int, is_crit: bool, is_miss: bool) -> void:
	var type_str = "MISS" if is_miss else ("CRIT" if is_crit else "HIT")
	print("[Battlefield] Visual Effect: %s for %d at %s" % [type_str, damage, world_pos])
	
	var dmg_num = DamageNumberScene.instantiate()
	dmg_num.damage_value = damage
	dmg_num.is_critical = is_crit
	dmg_num.is_miss = is_miss
	dmg_num.position = world_pos + Vector2(0, -10)  # Offset above unit
	add_child(dmg_num)


func _check_turn_end() -> void:
	var all_acted = true
	for unit in player_units:
		if not is_instance_valid(unit):
			continue
		var data = unit.get_unit_data()
		if data and data.is_alive() and unit not in units_acted:
			all_acted = false
			break
	
	if all_acted:
		_start_enemy_turn()


func _get_unit_at(grid_pos: Vector2i) -> Node2D:
	for unit in units_container.get_children():
		if world_to_grid(unit.position) == grid_pos:
			return unit
	return null


func _is_in_bounds(pos: Vector2i) -> bool:
	return pos.x >= 0 and pos.x < GRID_WIDTH and pos.y >= 0 and pos.y < GRID_HEIGHT


func _is_tile_walkable(pos: Vector2i) -> bool:
	# TODO: Check tilemap for terrain passability
	return _is_in_bounds(pos)


## Convert world position to grid coordinates
func world_to_grid(world_pos: Vector2) -> Vector2i:
	return Vector2i(int(world_pos.x / TILE_SIZE), int(world_pos.y / TILE_SIZE))


## Convert grid coordinates to world position (center of tile)
func grid_to_world(grid_pos: Vector2i) -> Vector2:
	return Vector2(grid_pos.x * TILE_SIZE + TILE_SIZE / 2, grid_pos.y * TILE_SIZE + TILE_SIZE / 2)


# --- Unit Spawning ---

func _clear_placeholder_units() -> void:
	for child in units_container.get_children():
		child.queue_free()

func _spawn_party_units() -> void:
	print("\n[Battlefield] --- Spawning Party Units ---")
	print("[Battlefield] Party size in GameManager: ", GameManager.party.size())
	
	var spawn_points = [
		Vector2i(1, 4), Vector2i(1, 5), Vector2i(1, 6),
		Vector2i(0, 4), Vector2i(0, 5), Vector2i(0, 6)
	]
	
	for i in range(GameManager.party.size()):
		if i >= spawn_points.size():
			push_warning("[Battlefield] Not enough spawn points for party member %d" % i)
			break
			
		var unit_data = GameManager.party[i]
		if unit_data == null:
			push_error("[Battlefield] Party index %d is NULL!" % i)
			continue
			
		if not unit_data.is_alive():
			print("[Battlefield] Skipping dead unit: %s" % unit_data.unit_name)
			continue
			
		var target_grid_pos = spawn_points[i]
		
		# OVERLAP CHECK
		var existing = _get_unit_at(target_grid_pos)
		if existing:
			push_error("[Battlefield] CRITICAL: Overlap detected at %s! Existing: %s, New: %s" % [target_grid_pos, existing.name, unit_data.unit_name])
			
		var unit = UnitScene.instantiate()
		unit.unit_data = unit_data
		unit.position = grid_to_world(target_grid_pos)
		
		units_container.add_child(unit)
		print("[Battlefield] Spawned Party Unit '%s': Grid=%s World=%s" % [unit_data.unit_name, target_grid_pos, unit.position])
	print("[Battlefield] --- Party Spawn Complete ---\n")

func _spawn_enemy_units() -> void:
	print("\n[Battlefield] --- Spawning Enemy Units ---")
	var difficulty = GameManager.active_dungeon_difficulty if GameManager.has_active_dungeon_state() else 1
	var num_enemies = 2 + difficulty
	print("[Battlefield] Difficulty: %d, Spawning %d enemies" % [difficulty, num_enemies])
	
	var enemy_spawns = []
	for x in range(GRID_WIDTH - 3, GRID_WIDTH):
		for y in range(GRID_HEIGHT):
			enemy_spawns.append(Vector2i(x, y))
	enemy_spawns.shuffle()
	
	var valid_spawns = 0
	for i in range(enemy_spawns.size()):
		if valid_spawns >= num_enemies:
			break
			
		var target_grid_pos = enemy_spawns[i]
		
		# OVERLAP CHECK
		var existing = _get_unit_at(target_grid_pos)
		if existing:
			print("[Battlefield] Skipping spawn at %s - Occupied by %s" % [target_grid_pos, existing.name])
			continue
			
		var unit = UnitScene.instantiate()
		# Create temporary enemy data
		var enemy_data = UnitData.new()
		enemy_data.unit_name = "Enemy %d" % (valid_spawns + 1)
		enemy_data.is_player_unit = false
		enemy_data.max_hp = 15 + (difficulty * 2)
		enemy_data.current_hp = enemy_data.max_hp
		enemy_data.strength = 3 + difficulty
		enemy_data.defense = 1 + (difficulty / 2)
		
		# Give a weapon
		var weapon = ItemData.new()
		weapon.weapon_type = randi() % 3 # Sword, Lance, Axe
		weapon.might = 3
		weapon.hit = 80
		weapon.range_max = 1
		enemy_data.equipped_weapon = weapon
		
		unit.unit_data = enemy_data
		unit.position = grid_to_world(target_grid_pos)
		
		units_container.add_child(unit)
		print("[Battlefield] Spawned Enemy Unit '%s': Grid=%s World=%s" % [enemy_data.unit_name, target_grid_pos, unit.position])
		valid_spawns += 1
		
	print("[Battlefield] --- Enemy Spawn Complete ---\n")
