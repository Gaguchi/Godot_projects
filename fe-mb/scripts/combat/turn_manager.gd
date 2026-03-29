class_name TurnManager
extends Node
## TurnManager - Manages the speed-based turn queue for combat
## Owns turn order, active unit tracking, and queue advancement.
## Emits signals so the battlefield can react to turn changes.

signal turn_started(unit: Node2D)
signal turn_ended(unit: Node2D)
signal queue_rebuilt

const DEBUG_TURNS: bool = true

## The ordered list of units for this round, sorted by speed descending
var _turn_queue: Array = []

## Index of the next unit to act (points past the current active unit after advance)
var _current_index: int = 0

## The unit whose turn it currently is
var _active_unit: Node2D = null

## The previously active unit (for clearing highlights)
var _previous_active_unit: Node2D = null


## Build (or rebuild) the turn queue from all alive units in the given container.
## Sorts by speed descending; player units break ties; leftmost x breaks further ties.
## Resets all units' turn state via reset_turn().
func build_queue(units_container: Node2D) -> void:
	_turn_queue.clear()
	var all_units: Array = []

	for unit in units_container.get_children():
		if not is_instance_valid(unit) or not unit.has_method("get_unit_data"):
			continue
		var data: UnitData = unit.get_unit_data()
		if data and data.is_alive():
			all_units.append(unit)
			if unit.has_method("reset_turn"):
				unit.reset_turn()

	# Sort by speed descending; player units break ties; leftmost x breaks further ties
	all_units.sort_custom(func(a: Node2D, b: Node2D) -> bool:
		var sa: int = a.get_unit_data().speed
		var sb: int = b.get_unit_data().speed
		if sa != sb:
			return sa > sb
		if a.get_unit_data().is_player_unit != b.get_unit_data().is_player_unit:
			return a.get_unit_data().is_player_unit
		return a.position.x < b.position.x
	)

	_turn_queue = all_units
	_current_index = 0

	if DEBUG_TURNS:
		var order_str: String = ""
		for u in _turn_queue:
			var d: UnitData = u.get_unit_data()
			order_str += "%s(spd%d) " % [d.unit_name, d.speed]
		print("[TurnManager] Turn order: %s" % order_str)

	queue_rebuilt.emit()


## Advance to the next valid unit in the queue.
## Skips dead, invalid, and bound units.
## When the queue is exhausted, rebuilds for a new round.
## Emits turn_started with the new active unit.
func advance_turn(units_container: Node2D) -> void:
	# Clear previous active unit highlight
	if is_instance_valid(_previous_active_unit):
		if _previous_active_unit.has_method("set_active_turn"):
			_previous_active_unit.set_active_turn(false)

	# Skip dead/invalid/bound units (use untyped var to avoid freed instance assignment error)
	while _current_index < _turn_queue.size():
		var candidate = _turn_queue[_current_index]
		if is_instance_valid(candidate) and candidate.get_unit_data() and candidate.get_unit_data().is_alive() and not candidate.get_unit_data().is_bound:
			break
		_current_index += 1

	# All units acted - new round
	if _current_index >= _turn_queue.size():
		build_queue(units_container)
		if _turn_queue.is_empty():
			return

	_active_unit = _turn_queue[_current_index]
	_current_index += 1
	_previous_active_unit = _active_unit

	# Highlight active unit
	if is_instance_valid(_active_unit) and _active_unit.has_method("set_active_turn"):
		_active_unit.set_active_turn(true)

	if DEBUG_TURNS:
		var data: UnitData = _active_unit.get_unit_data()
		print("[TurnManager] Turn started: %s (%s)" % [data.unit_name, "Player" if data.is_player_unit else "Enemy"])

	turn_started.emit(_active_unit)


## Remove a unit from the turn queue (e.g. when it dies).
## Adjusts the current index to avoid skipping units.
func remove_unit(unit: Node2D) -> void:
	var idx: int = _turn_queue.find(unit)
	if idx != -1:
		_turn_queue.remove_at(idx)
		if idx < _current_index:
			_current_index -= 1


## Get the currently active unit (whose turn it is).
func get_active_unit() -> Node2D:
	return _active_unit


## Get the full turn queue array (read-only use intended).
func get_turn_order() -> Array:
	return _turn_queue


## Get the current index in the queue (points past the active unit).
## Useful for the turn order display which needs active_index = current_index - 1.
func get_current_index() -> int:
	return _current_index


## Clear active unit highlight (e.g. at battle end).
func clear_active_highlight() -> void:
	if _active_unit and is_instance_valid(_active_unit) and _active_unit.has_method("set_active_turn"):
		_active_unit.set_active_turn(false)


## Check if the turn queue is empty.
func is_queue_empty() -> bool:
	return _turn_queue.is_empty()
