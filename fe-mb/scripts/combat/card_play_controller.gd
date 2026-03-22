class_name CardPlayController
extends Node
## CardPlayController - Manages card play orchestration during combat
## Handles: card selection, targeting, effect resolution, AP tracking,
## capture buttons, damage preview, deck management interaction, hand UI interaction.
## The battlefield state machine remains in battlefield.gd.

signal card_played(unit: Node2D, card: CardData, target_info: Variant)
signal card_cancelled
signal ap_exhausted(unit: Node2D)
signal targeting_started(card: CardData)
signal targeting_ended
signal action_phase_entered
signal turn_ended

const DEBUG_COMBAT: bool = true
const CAPTURE_AP_COST: int = 2

# --- References (set via setup()) ---
var _deck_managers: Dictionary = {}  # Node2D unit -> DeckManager
var _card_hand_ui: CanvasLayer = null  # CardHandUI instance
var _card_effect_resolver = null       # CardEffectResolver instance
var _battle_grid = null                # BattleGrid
var _battlefield = null                # Battlefield (parent)
var _battle_input = null               # BattleInput
var _grid_overlay = null               # GridOverlay
var _combat_animator = null            # CombatAnimator
var _units_container: Node2D = null
var _combat_log = null
var _ui_node: CanvasLayer = null        # $UI from battlefield

# --- Card state ---
var _current_ap: int = 3
var _max_ap: int = 3
var _pending_card: CardData = null
var _pending_card_index: int = -1

# --- Capture buttons ---
var _capture_buttons: Array[Button] = []

# --- Targeting UI ---
var _targeting_label: Label = null
var _damage_preview_label: Label = null
var _last_preview_tile: Vector2i = Vector2i(-1, -1)


## Setup references. Called once from battlefield._ready().
func setup(config: Dictionary) -> void:
	_deck_managers = config.get("deck_managers", {})
	_card_hand_ui = config.get("card_hand_ui")
	_card_effect_resolver = config.get("card_effect_resolver")
	_battle_grid = config.get("battle_grid")
	_battlefield = config.get("battlefield")
	_battle_input = config.get("battle_input")
	_grid_overlay = config.get("grid_overlay")
	_combat_animator = config.get("combat_animator")
	_units_container = config.get("units_container")
	_combat_log = config.get("combat_log")
	_ui_node = config.get("ui_node")

	# Connect CardHandUI signals
	_card_hand_ui.card_selected.connect(_on_card_selected)
	_card_hand_ui.card_hovered.connect(_on_card_hovered)
	_card_hand_ui.end_turn_pressed.connect(_on_card_end_turn)

	# Connect BattleInput targeting signals
	_battle_input.target_selection_cancelled.connect(_on_target_selection_cancelled)
	_battle_input.card_target_confirmed.connect(_on_card_target_confirmed)
	_battle_input.ground_target_confirmed.connect(_on_ground_target_confirmed)

	# Build targeting UI elements
	_build_targeting_ui()


## Initialize deck managers for player units at battle start.
func init_decks(player_units: Array) -> void:
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


## Get the deck_managers dictionary (battlefield needs read access for enemy turn cleanup etc.)
func get_deck_managers() -> Dictionary:
	return _deck_managers


## Start the action phase for a unit (draw cards, reset AP, show hand).
func start_action_phase(unit: Node2D) -> void:
	_pending_card = null
	_pending_card_index = -1

	var data: UnitData = unit.get_unit_data()
	_max_ap = data.max_ap if "max_ap" in data else 3
	_current_ap = _max_ap

	var dm = _deck_managers.get(unit)
	if dm:
		dm.discard_hand()
		dm.draw_cards(dm.max_hand_size, true)
		if DEBUG_COMBAT:
			dm.validate("start_turn %s" % data.unit_name)
		_card_hand_ui.show_hand(data, dm.hand, _current_ap, _max_ap, dm.get_draw_count(), dm.get_discard_count())
	else:
		_card_hand_ui.show_hand(data, [], _current_ap, _max_ap, 0, 0)

	_create_capture_buttons(unit)

	if DEBUG_COMBAT and dm:
		print("[Deck] %s state: draw=%d hand=%d discard=%d total=%d" % [
			data.unit_name, dm.get_draw_count(), dm.hand.size(), dm.get_discard_count(), dm.get_total_count()
		])
	print("[Turn] %s — Action Phase (AP:%d, Cards:%d, Captures:%d)" % [
		data.unit_name, _current_ap, dm.hand.size() if dm else 0, _capture_buttons.size()
	])

	action_phase_entered.emit()


## End the action phase (discard hand, clean up UI).
func end_action_phase() -> void:
	_card_hand_ui.hide_hand()
	_clear_capture_buttons()
	_hide_targeting_label()
	_pending_card = null
	_pending_card_index = -1

	var active = _battlefield.active_unit
	var dm = _deck_managers.get(active)
	if dm:
		dm.discard_hand()
		if DEBUG_COMBAT:
			dm.validate("end_turn discard")


## Get remaining AP for the active unit.
func get_remaining_ap() -> int:
	return _current_ap


## Get the currently pending card (for damage preview in _process).
func get_pending_card() -> CardData:
	return _pending_card


## Hide the hand UI (used when starting move phase, enemy turn, or battle end).
func hide_hand() -> void:
	_card_hand_ui.hide_hand()


## Clear capture buttons (used during enemy turns, battle end, etc.)
func clear_capture_buttons() -> void:
	_clear_capture_buttons()


## Update capture button positions (called from battlefield._process).
func update_capture_button_positions() -> void:
	_update_capture_button_positions()


## Update damage preview (called from battlefield._process during SELECTING_TARGET).
func update_damage_preview() -> void:
	_update_damage_preview()


## Hide damage preview.
func hide_damage_preview() -> void:
	_hide_damage_preview()


## Hide targeting label.
func hide_targeting_label() -> void:
	_hide_targeting_label()


## Clear card range overlay on the grid.
func clear_card_range_overlay() -> void:
	_grid_overlay.set_card_range_tiles([])
	_grid_overlay.set_aoe_preview_tiles([])


# ============================================================
# INTERNAL: Card Selection
# ============================================================

func _on_card_selected(card: CardData, index: int) -> void:
	if _current_ap < card.ap_cost:
		print("[Action] Card '%s' selected but not enough AP (%d/%d)" % [card.card_name, _current_ap, card.ap_cost])
		return

	var active = _battlefield.active_unit
	var active_data: UnitData = active.get_unit_data() if active else null
	if active_data and not _is_card_weapon_compatible(card, active_data):
		print("[Action] Card '%s' incompatible with equipped weapon" % card.card_name)
		return
	_pending_card = card
	_pending_card_index = index
	print("[Action] Card selected: '%s' (AP:%d, Target:%s)" % [card.card_name, card.ap_cost, CardData.TargetType.keys()[card.target_type]])

	_clear_capture_buttons()
	_grid_overlay.set_card_range_tiles([])

	match card.target_type:
		CardData.TargetType.SELF:
			_resolve_card_on_target(active)
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


func _on_card_hovered(card: CardData, index: int) -> void:
	var active = _battlefield.active_unit
	if _battlefield.current_state != _battlefield.BattleState.PLAYER_ACTION_PHASE or not active:
		_grid_overlay.set_card_range_tiles([])
		return

	if card == null or index < 0:
		_grid_overlay.set_card_range_tiles([])
		return

	if card.target_type == CardData.TargetType.SELF or card.target_type == CardData.TargetType.ALL_ENEMIES or card.target_type == CardData.TargetType.ALL_ALLIES:
		_grid_overlay.set_card_range_tiles([])
		return

	if card.ap_cost > _current_ap:
		_grid_overlay.set_card_range_tiles([])
		return

	var unit_pos: Vector2i = _battle_grid.world_to_grid(active.position)
	var range_tiles: Array = []
	for x in range(_battlefield.GRID_WIDTH):
		for y in range(_battlefield.GRID_HEIGHT):
			var tile := Vector2i(x, y)
			var dist: int = abs(tile.x - unit_pos.x) + abs(tile.y - unit_pos.y)
			if dist >= card.range_min and dist <= card.range_max:
				range_tiles.append(tile)

	_grid_overlay.set_card_range_tiles(range_tiles)


# ============================================================
# INTERNAL: Targeting Modes
# ============================================================

func _enter_card_target_mode(card: CardData) -> void:
	var active = _battlefield.active_unit
	_battlefield.current_state = _battlefield.BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = _battle_grid.world_to_grid(active.position)
	var valid_targets: Array[Vector2i] = []

	for enemy in _battlefield.enemy_units:
		if not is_instance_valid(enemy) or not enemy.get_unit_data() or not enemy.get_unit_data().is_alive():
			continue
		if enemy.get_unit_data().is_bound:
			continue
		var enemy_pos: Vector2i = _battle_grid.world_to_grid(enemy.position)
		var dist: int = abs(enemy_pos.x - unit_pos.x) + abs(enemy_pos.y - unit_pos.y)
		if dist >= card.range_min and dist <= card.range_max:
			valid_targets.append(enemy_pos)

	if valid_targets.is_empty():
		_pending_card = null
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid targets for '%s'" % card.card_name)
		_show_no_targets_message("No targets in range")
		return

	print("[Action] Enemy targeting for '%s' — %d valid targets" % [card.card_name, valid_targets.size()])
	_show_targeting_label("Select target for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	_battle_input.enter_card_target_selection(active, valid_targets)
	targeting_started.emit(card)


func _enter_card_ally_target_mode(card: CardData) -> void:
	var active = _battlefield.active_unit
	_battlefield.current_state = _battlefield.BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = _battle_grid.world_to_grid(active.position)
	var valid_targets: Array[Vector2i] = []

	for ally in _battlefield.player_units:
		if not is_instance_valid(ally) or not ally.get_unit_data() or not ally.get_unit_data().is_alive():
			continue
		var ally_pos: Vector2i = _battle_grid.world_to_grid(ally.position)
		var dist: int = abs(ally_pos.x - unit_pos.x) + abs(ally_pos.y - unit_pos.y)
		if dist >= card.range_min and dist <= card.range_max:
			valid_targets.append(ally_pos)

	if valid_targets.is_empty():
		_pending_card = null
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid ally targets for '%s'" % card.card_name)
		_show_no_targets_message("No allies in range")
		return

	print("[Action] Ally targeting for '%s' — %d valid targets" % [card.card_name, valid_targets.size()])
	_show_targeting_label("Select ally for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	_battle_input.enter_card_target_selection(active, valid_targets)
	targeting_started.emit(card)


func _enter_card_ground_target_mode(card: CardData) -> void:
	var active = _battlefield.active_unit
	_battlefield.current_state = _battlefield.BattleState.SELECTING_TARGET
	var unit_pos: Vector2i = _battle_grid.world_to_grid(active.position)
	var valid_tiles: Array[Vector2i] = []

	for x in range(_battlefield.GRID_WIDTH):
		for y in range(_battlefield.GRID_HEIGHT):
			var tile := Vector2i(x, y)
			var dist: int = abs(tile.x - unit_pos.x) + abs(tile.y - unit_pos.y)
			if dist >= card.range_min and dist <= card.range_max:
				valid_tiles.append(tile)

	if valid_tiles.is_empty():
		_pending_card = null
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		print("[Action] No valid ground tiles for '%s'" % card.card_name)
		return

	print("[Action] Ground targeting for '%s' — %d tiles, AOE %d" % [card.card_name, valid_tiles.size(), card.aoe_radius])
	_show_targeting_label("Select tile for %s  (Right-click to cancel)" % card.card_name)
	_card_hand_ui.set_targeting_mode(true)
	_battle_input.enter_ground_target_selection(active, valid_tiles, card.aoe_radius)
	targeting_started.emit(card)


# ============================================================
# INTERNAL: Target Confirmation / Cancellation
# ============================================================

func _on_card_target_confirmed(target: Node2D) -> void:
	print("[Action] Card target confirmed: %s" % target.get_unit_data().unit_name)
	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.set_targeting_mode(false)
	targeting_ended.emit()
	_resolve_card_on_target(target)


func _on_ground_target_confirmed(tile: Vector2i) -> void:
	print("[Action] Ground target confirmed at (%d,%d)" % [tile.x, tile.y])
	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.set_targeting_mode(false)
	targeting_ended.emit()
	_resolve_card_on_ground(tile)


func _on_target_selection_cancelled() -> void:
	print("[Action] Card targeting cancelled — returning to action phase")
	_pending_card = null
	_pending_card_index = -1
	_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
	_battle_input.input_enabled = false

	_hide_targeting_label()
	_hide_damage_preview()
	_card_hand_ui.deselect_card()
	_card_hand_ui.set_targeting_mode(false)
	_create_capture_buttons(_battlefield.active_unit)
	_battlefield._show_unit_info(_battlefield.active_unit)
	targeting_ended.emit()
	card_cancelled.emit()


# ============================================================
# INTERNAL: Card Resolution
# ============================================================

func _resolve_card_on_target(target: Node2D) -> void:
	var active = _battlefield.active_unit
	if _pending_card == null or not is_instance_valid(active):
		return

	_battlefield.current_state = _battlefield.BattleState.ANIMATING
	_battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active.get_unit_data()
	var target_data: UnitData = target.get_unit_data()

	_current_ap -= card.ap_cost

	var target_pos: Vector2i = _battle_grid.world_to_grid(target.position)
	var context := {
		"terrain_def_bonus": _battle_grid.get_terrain_def_bonus(target_pos) if target != active else 0,
	}

	var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, target_data, context)

	var dm = _deck_managers.get(active)
	if dm:
		dm.play_card(card)

	# Log
	if _combat_log:
		if result.damage_dealt > 0:
			_combat_log.log_card_play(caster_data.unit_name, card.card_name, target_data.unit_name, result.damage_dealt)
		elif result.healing_done > 0:
			_combat_log.log_card_heal(caster_data.unit_name, card.card_name, target_data.unit_name, result.healing_done)
		else:
			_combat_log.log_card_effect(caster_data.unit_name, card.card_name)

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
	if result.damage_dealt > 0 and target != active:
		await _combat_animator.play_single_attack(active, target, result.damage_dealt, card.is_magic)
	elif result.healing_done > 0:
		var heal_tween: Tween = _battlefield.create_tween()
		heal_tween.tween_property(target, "modulate", Color(0.5, 1.0, 0.5), 0.15)
		heal_tween.tween_property(target, "modulate", Color.WHITE, 0.15)
		await heal_tween.finished
	else:
		await _battlefield.get_tree().create_timer(0.2).timeout

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
				_attempt_card_subdue(active, target)

	# Handle death
	if result.target_died and target != active:
		_battlefield._handle_unit_death(target, active)

	# Check battle end
	if _battlefield._check_battle_end():
		_card_hand_ui.hide_hand()
		return

	# Signal the card was played
	card_played.emit(active, card, target)

	# Update UI and continue turn
	_pending_card = null
	_pending_card_index = -1

	if dm:
		_card_hand_ui.update_hand(dm.hand)
		_card_hand_ui.update_ap(_current_ap, _max_ap)
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())

	_refresh_party_sidebar()

	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		_battlefield._show_unit_info(active)
		_create_capture_buttons(active)


func _resolve_card_aoe_enemies() -> void:
	var active = _battlefield.active_unit
	if _pending_card == null or not is_instance_valid(active):
		return

	_battlefield.current_state = _battlefield.BattleState.ANIMATING
	_battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active)
	if dm:
		dm.play_card(card)

	var total_damage: int = 0
	var killed: Array = []

	for enemy in _battlefield.enemy_units.duplicate():
		if not is_instance_valid(enemy) or not enemy.get_unit_data() or not enemy.get_unit_data().is_alive():
			continue
		if enemy.get_unit_data().is_bound:
			continue
		var target_pos: Vector2i = _battle_grid.world_to_grid(enemy.position)
		var context := {"terrain_def_bonus": _battle_grid.get_terrain_def_bonus(target_pos)}
		var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, enemy.get_unit_data(), context)
		total_damage += result.damage_dealt
		if result.target_died:
			killed.append(enemy)

	if _combat_log:
		_combat_log.log_card_play(caster_data.unit_name, card.card_name, "all enemies", total_damage)

	if DEBUG_COMBAT:
		print("[Card] %s plays %s on ALL ENEMIES → %d total dmg, %d killed (AP left: %d)" % [
			caster_data.unit_name, card.card_name, total_damage, killed.size(), _current_ap
		])

	# Brief flash animation
	for enemy in _battlefield.enemy_units:
		if is_instance_valid(enemy):
			enemy.modulate = Color(1.0, 0.5, 0.5)
	await _battlefield.get_tree().create_timer(0.3).timeout
	for enemy in _battlefield.enemy_units:
		if is_instance_valid(enemy):
			enemy.modulate = Color.WHITE

	for dead in killed:
		_battlefield._handle_unit_death(dead, active)

	# Handle effects
	for eff in card.effects:
		match eff.get("type", ""):
			"draw":
				if dm: dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)

	_pending_card = null
	card_played.emit(active, card, null)

	if _battlefield._check_battle_end():
		_card_hand_ui.hide_hand()
		return

	_post_card_play_update()


func _resolve_card_aoe_allies() -> void:
	var active = _battlefield.active_unit
	if _pending_card == null or not is_instance_valid(active):
		return

	_battlefield.current_state = _battlefield.BattleState.ANIMATING
	_battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active)
	if dm:
		dm.play_card(card)

	var total_healing: int = 0
	for ally in _battlefield.player_units:
		if not is_instance_valid(ally) or not ally.get_unit_data() or not ally.get_unit_data().is_alive():
			continue
		var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, ally.get_unit_data(), {})
		total_healing += result.healing_done

	if _combat_log and total_healing > 0:
		_combat_log.log_card_heal(caster_data.unit_name, card.card_name, "all allies", total_healing)

	# Heal flash
	for ally in _battlefield.player_units:
		if is_instance_valid(ally):
			ally.modulate = Color(0.5, 1.0, 0.5)
	await _battlefield.get_tree().create_timer(0.3).timeout
	for ally in _battlefield.player_units:
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
	card_played.emit(active, card, null)

	_post_card_play_update()


func _resolve_card_on_ground(tile: Vector2i) -> void:
	var active = _battlefield.active_unit
	if _pending_card == null or not is_instance_valid(active):
		return

	_battlefield.current_state = _battlefield.BattleState.ANIMATING
	_battle_input.input_enabled = false

	var card: CardData = _pending_card
	var caster_data: UnitData = active.get_unit_data()
	_current_ap -= card.ap_cost

	var dm = _deck_managers.get(active)
	if dm:
		dm.play_card(card)

	# Gather AOE tiles
	var aoe_tiles: Array[Vector2i] = _get_aoe_tiles(tile, card.aoe_radius)
	var targets_hit: Array = []
	var total_damage: int = 0

	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = _battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			var unit_data: UnitData = unit_on_tile.get_unit_data()
			if unit_data and unit_data.is_alive() and not unit_data.is_player_unit and not unit_data.is_bound:
				var context := {"terrain_def_bonus": _battle_grid.get_terrain_def_bonus(aoe_tile)}
				var result: Dictionary = _card_effect_resolver.resolve_card(card, caster_data, unit_data, context)
				total_damage += result.damage_dealt
				targets_hit.append({"unit": unit_on_tile, "damage": result.damage_dealt, "died": result.target_died})

	if _combat_log:
		_combat_log.log_card_play(caster_data.unit_name, card.card_name, "ground (%d,%d)" % [tile.x, tile.y], total_damage)

	print("[Card] %s casts %s at (%d,%d) — AOE %d tiles, %d targets hit, %d total dmg (AP:%d)" % [
		caster_data.unit_name, card.card_name, tile.x, tile.y,
		aoe_tiles.size(), targets_hit.size(), total_damage, _current_ap
	])

	# Flash AOE area purple
	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = _battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			unit_on_tile.modulate = Color(0.7, 0.3, 1.0)
	await _battlefield.get_tree().create_timer(0.35).timeout
	for aoe_tile in aoe_tiles:
		var unit_on_tile: Node2D = _battle_grid.get_unit_at(aoe_tile)
		if unit_on_tile and is_instance_valid(unit_on_tile):
			unit_on_tile.modulate = Color.WHITE

	# Handle deaths
	for hit in targets_hit:
		if hit.died and is_instance_valid(hit.unit):
			_battlefield._handle_unit_death(hit.unit, active)

	# Handle card effects (draw, AP gain, etc.)
	for eff in card.effects:
		match eff.get("type", ""):
			"draw":
				if dm: dm.draw_cards(eff.get("amount", 1))
			"ap":
				_current_ap += eff.get("amount", 1)

	_pending_card = null
	card_played.emit(active, card, tile)

	if _battlefield._check_battle_end():
		_card_hand_ui.hide_hand()
		_clear_capture_buttons()
		return

	_post_card_play_update()


## Capture attempt via Capture card (surround-based chance)
func _attempt_card_subdue(attacker: Node2D, target: Node2D) -> void:
	var capture_info: Dictionary = _battlefield._get_capture_chance(attacker, target)
	var success_rate: int = capture_info.chance
	var roll: int = randi() % 100
	var success: bool = roll < success_rate
	var def_data: UnitData = target.get_unit_data()

	if DEBUG_COMBAT:
		print("[Card Capture] Chance: %d%% (Adjacent: %d) Roll: %d → %s" % [
			success_rate, capture_info.adjacent_count, roll,
			"SUCCESS" if success else "FAIL"])

	if success:
		def_data.is_bound = true
		target.set_bound(true)
		_battlefield.bound_enemies.append(def_data)
		if _combat_log:
			_combat_log.log_subdue(attacker.get_unit_data().unit_name, def_data.unit_name, true, true)
		EventBus.show_notification.emit("Captured %s!" % def_data.unit_name)
	else:
		if _combat_log:
			_combat_log.log_subdue(attacker.get_unit_data().unit_name, def_data.unit_name, false, true)
		EventBus.show_notification.emit("Capture failed! (%d%%)" % success_rate)


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
			if dist <= radius and _battle_grid.is_in_bounds(pos):
				tiles.append(pos)
	return tiles


## Common UI update after playing a card
func _post_card_play_update() -> void:
	var active = _battlefield.active_unit
	var dm = _deck_managers.get(active)
	if dm:
		_card_hand_ui.update_hand(dm.hand)
		_card_hand_ui.update_ap(_current_ap, _max_ap)
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())

	_refresh_party_sidebar()

	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		_battlefield._show_unit_info(active)
		_create_capture_buttons(active)


## End Turn button pressed (or auto-end when AP/cards run out)
func _on_card_end_turn() -> void:
	print("[Action] End Turn pressed")
	end_action_phase()
	turn_ended.emit()


## Deck reshuffled — show visual feedback
func _on_deck_reshuffled(unit_name: String) -> void:
	print("[Deck] %s's discard pile reshuffled into draw pile!" % unit_name)
	if _combat_log:
		_combat_log.log_system("%s's deck reshuffled" % unit_name)
	var active = _battlefield.active_unit
	var dm = _deck_managers.get(active)
	if dm:
		_card_hand_ui.update_deck_info(dm.get_draw_count(), dm.get_discard_count())


# ============================================================
# INTERNAL: Capture Button Overlay System
# ============================================================

func _create_capture_buttons(active_unit: Node2D) -> void:
	_clear_capture_buttons()
	if not active_unit or not is_instance_valid(active_unit):
		return

	var pos: Vector2i = _battle_grid.world_to_grid(active_unit.position)
	for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
		var adj: Vector2i = pos + dir
		var adj_unit: Node2D = _battle_grid.get_unit_at(adj)
		if adj_unit and is_instance_valid(adj_unit):
			var adj_data: UnitData = adj_unit.get_unit_data()
			if adj_data and not adj_data.is_player_unit and adj_data.is_alive() and not adj_data.is_bound:
				var btn := _make_capture_button(active_unit, adj_unit)
				if _current_ap < CAPTURE_AP_COST:
					btn.disabled = true
					btn.modulate = Color(0.5, 0.5, 0.5, 0.7)
				_ui_node.add_child(btn)
				_capture_buttons.append(btn)
				if DEBUG_COMBAT:
					var capture_info: Dictionary = _battlefield._get_capture_chance(active_unit, adj_unit)
					print("[UI] Capture button for %s (HP:%d/%d, Adjacent:%d, Chance:%d%%)" % [
						adj_data.unit_name, adj_data.current_hp, adj_data.max_hp,
						capture_info.adjacent_count, capture_info.chance])

	_update_capture_button_positions()


func _make_capture_button(active_unit: Node2D, target: Node2D) -> Button:
	var btn := Button.new()
	var capture_info: Dictionary = _battlefield._get_capture_chance(active_unit, target)
	var chance: int = capture_info.chance

	btn.text = "Capture %d%% [%dAP]" % [chance, CAPTURE_AP_COST]
	btn.custom_minimum_size = Vector2(120, 28)
	btn.set_meta("target_unit", target)

	var bg_color: Color
	var border_color: Color
	var hover_bg: Color
	var hover_border: Color
	var font_color: Color
	var font_hover: Color

	if chance >= 60:
		bg_color = Color(0.06, 0.18, 0.06, 0.92)
		border_color = Color(0.267, 0.769, 0.267)
		hover_bg = Color(0.1, 0.3, 0.1, 0.95)
		hover_border = Color(0.35, 0.9, 0.35)
		font_color = Color(0.761, 0.832, 0.761)
		font_hover = Color(0.35, 0.9, 0.35)
	elif chance >= 20:
		bg_color = Color(0.18, 0.14, 0.04, 0.92)
		border_color = Color(0.769, 0.6, 0.2)
		hover_bg = Color(0.28, 0.22, 0.08, 0.95)
		hover_border = Color(0.9, 0.7, 0.3)
		font_color = Color(0.832, 0.78, 0.65)
		font_hover = Color(0.9, 0.7, 0.3)
	else:
		bg_color = Color(0.18, 0.06, 0.06, 0.92)
		border_color = Color(0.5, 0.3, 0.3)
		hover_bg = Color(0.28, 0.1, 0.1, 0.95)
		hover_border = Color(0.7, 0.4, 0.4)
		font_color = Color(0.65, 0.55, 0.55)
		font_hover = Color(0.7, 0.4, 0.4)

	var normal := StyleBoxFlat.new()
	normal.bg_color = bg_color
	normal.border_color = border_color
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(4)
	normal.set_content_margin_all(4)
	btn.add_theme_stylebox_override("normal", normal)

	var hover := StyleBoxFlat.new()
	hover.bg_color = hover_bg
	hover.border_color = hover_border
	hover.set_border_width_all(2)
	hover.set_corner_radius_all(4)
	hover.set_content_margin_all(4)
	btn.add_theme_stylebox_override("hover", hover)

	btn.add_theme_color_override("font_color", font_color)
	btn.add_theme_color_override("font_hover_color", font_hover)
	btn.add_theme_font_size_override("font_size", 12)
	btn.mouse_filter = Control.MOUSE_FILTER_STOP

	btn.pressed.connect(_on_capture_button_pressed.bind(target))
	return btn


func _update_capture_button_positions() -> void:
	var canvas_xform: Transform2D = _battlefield.get_viewport().get_canvas_transform()
	for btn in _capture_buttons:
		if not is_instance_valid(btn):
			continue
		var target = btn.get_meta("target_unit")
		if is_instance_valid(target):
			var screen_pos: Vector2 = canvas_xform * target.position
			btn.position = screen_pos + Vector2(-55, -50)
		else:
			btn.visible = false


func _clear_capture_buttons() -> void:
	for btn in _capture_buttons:
		if is_instance_valid(btn):
			btn.queue_free()
	_capture_buttons.clear()


func _on_capture_button_pressed(target: Node2D) -> void:
	var active = _battlefield.active_unit
	if not active or _battlefield.current_state != _battlefield.BattleState.PLAYER_ACTION_PHASE:
		return
	if not is_instance_valid(target):
		return
	if _current_ap < CAPTURE_AP_COST:
		print("[Action] CAPTURE failed — not enough AP (%d/%d)" % [_current_ap, CAPTURE_AP_COST])
		return

	_battlefield.current_state = _battlefield.BattleState.ANIMATING
	_battle_input.input_enabled = false
	_clear_capture_buttons()

	var atk_data: UnitData = active.get_unit_data()
	var def_data: UnitData = target.get_unit_data()
	var capture_info: Dictionary = _battlefield._get_capture_chance(active, target)
	var success_rate: int = capture_info.chance
	var roll: int = randi() % 100
	var success: bool = roll < success_rate

	_current_ap -= CAPTURE_AP_COST

	if DEBUG_COMBAT:
		print("[Capture] %s attempts capture on %s | Chance: %d%% (Adjacent: %d) Roll: %d → %s (AP left: %d)" % [
			atk_data.unit_name, def_data.unit_name, success_rate,
			capture_info.adjacent_count, roll,
			"SUCCESS" if success else "FAIL", _current_ap
		])

	# Animate attacker sliding toward target
	var atk_pos: Vector2 = active.position
	var def_pos: Vector2 = target.position
	var slide_target: Vector2 = atk_pos.lerp(def_pos, 0.3)
	var slide_tween: Tween = _battlefield.create_tween()
	slide_tween.tween_property(active, "position", slide_target, 0.15)
	slide_tween.tween_property(active, "position", atk_pos, 0.15)
	await slide_tween.finished

	if success:
		def_data.is_bound = true
		target.set_bound(true)
		_battlefield.bound_enemies.append(def_data)
		if _combat_log:
			_combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, true, true)
		EventBus.show_notification.emit("Captured %s!" % def_data.unit_name)
	else:
		if _combat_log:
			_combat_log.log_subdue(atk_data.unit_name, def_data.unit_name, false, true)
		EventBus.show_notification.emit("Capture failed! (%d%%)" % success_rate)

	# Check battle end
	if _battlefield._check_battle_end():
		_card_hand_ui.hide_hand()
		_clear_capture_buttons()
		return

	# Update UI and continue action phase if AP remains
	var dm = _deck_managers.get(active)
	if dm:
		_card_hand_ui.update_ap(_current_ap, _max_ap)

	if _current_ap <= 0 or (dm and dm.hand.is_empty()):
		_on_card_end_turn()
	else:
		_battlefield.current_state = _battlefield.BattleState.PLAYER_ACTION_PHASE
		_create_capture_buttons(active)


# ============================================================
# INTERNAL: Targeting UI
# ============================================================

func _build_targeting_ui() -> void:
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
	_ui_node.add_child(_targeting_label)

	# Damage preview label (floating over hovered target during card targeting)
	_damage_preview_label = Label.new()
	_damage_preview_label.visible = false
	_damage_preview_label.add_theme_font_size_override("font_size", 20)
	_damage_preview_label.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3))
	_damage_preview_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_damage_preview_label.add_theme_constant_override("shadow_offset_x", 2)
	_damage_preview_label.add_theme_constant_override("shadow_offset_y", 2)
	_damage_preview_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ui_node.add_child(_damage_preview_label)


func _show_targeting_label(text: String) -> void:
	if _targeting_label:
		_targeting_label.text = text
		_targeting_label.visible = true


func _hide_targeting_label() -> void:
	if _targeting_label:
		_targeting_label.visible = false


func _hide_damage_preview() -> void:
	if _damage_preview_label:
		_damage_preview_label.visible = false
	_last_preview_tile = Vector2i(-1, -1)


func _show_no_targets_message(text: String) -> void:
	if not _targeting_label:
		return
	_targeting_label.text = text
	_targeting_label.add_theme_color_override("font_color", Color(0.769, 0.267, 0.267))
	_targeting_label.visible = true
	await _battlefield.get_tree().create_timer(1.0).timeout
	_targeting_label.visible = false
	_targeting_label.add_theme_color_override("font_color", Color(0.832, 0.812, 0.761))


func _update_damage_preview() -> void:
	if not _damage_preview_label or not _grid_overlay:
		return

	var hover: Vector2i = _grid_overlay.get_hover_tile()
	if hover == _last_preview_tile:
		return
	_last_preview_tile = hover

	if not _battle_grid.is_in_bounds(hover):
		_damage_preview_label.visible = false
		return

	var target_unit: Node2D = _battle_grid.get_unit_at(hover)
	if not target_unit or not is_instance_valid(target_unit):
		_damage_preview_label.visible = false
		return

	var target_data: UnitData = target_unit.get_unit_data()
	if not target_data:
		_damage_preview_label.visible = false
		return

	var active = _battlefield.active_unit
	var caster_data: UnitData = active.get_unit_data()
	var card: CardData = _pending_card

	var preview_text: String = ""
	var preview_color: Color = Color(1.0, 0.3, 0.3)

	if card.damage_base > 0 or card.damage_stat != "":
		var damage: int = _compute_card_damage_preview(card, caster_data, target_data, hover)
		var hits: int = int(card.damage_multiplier) if card.damage_multiplier > 1.0 else 1
		if hits > 1:
			preview_text = "%d x%d" % [damage / hits, hits]
		else:
			preview_text = "%d" % damage
		if damage >= target_data.current_hp:
			preview_text += " KO"
			preview_color = Color(1.0, 0.15, 0.15)
	elif card.heal_base > 0 or card.heal_stat != "":
		var heal: int = card.get_computed_healing(caster_data)
		var actual_heal: int = min(heal, target_data.max_hp - target_data.current_hp)
		preview_text = "+%d" % actual_heal
		preview_color = Color(0.3, 1.0, 0.3)

	if preview_text.is_empty():
		_damage_preview_label.visible = false
		return

	_damage_preview_label.text = preview_text
	_damage_preview_label.add_theme_color_override("font_color", preview_color)

	var canvas_xform: Transform2D = _battlefield.get_viewport().get_canvas_transform()
	var screen_pos: Vector2 = canvas_xform * target_unit.position
	_damage_preview_label.position = screen_pos + Vector2(-30, -70)
	_damage_preview_label.visible = true


func _compute_card_damage_preview(card: CardData, caster: UnitData, target: UnitData, target_tile: Vector2i) -> int:
	var raw_damage: int = card.get_computed_damage(caster)

	var dr: int = 0
	if card.is_magic:
		dr = int(target.resistance / 2.0)
	else:
		dr = int(target.defense / 2.0)

	dr += _battle_grid.get_terrain_def_bonus(target_tile)

	var damage_per_hit: int = max(0, raw_damage - dr)
	var hits: int = int(card.damage_multiplier) if card.damage_multiplier > 1.0 else 1
	return damage_per_hit * hits


## Check if a card is compatible with the unit's equipped weapon
func _is_card_weapon_compatible(card: CardData, unit: UnitData) -> bool:
	# Cards with weapon_type NONE (skills, spells) are always playable
	if card.weapon_type == ItemData.WeaponType.NONE:
		return true
	# No weapon equipped — only NONE-type cards work
	if not unit.equipped_weapon or not unit.equipped_weapon is ItemData:
		return false
	# Must match equipped weapon type
	return card.weapon_type == unit.equipped_weapon.weapon_type


# ============================================================
# INTERNAL: Helpers
# ============================================================

func _refresh_party_sidebar() -> void:
	if _battlefield.party_sidebar:
		var sidebar_units: Array = []
		for unit in _units_container.get_children():
			if is_instance_valid(unit) and unit.has_method("get_unit_data") and unit.get_unit_data() and unit.get_unit_data().is_player_unit:
				sidebar_units.append(unit)
		_battlefield.party_sidebar.update_units(sidebar_units)
