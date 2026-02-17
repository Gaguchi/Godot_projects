class_name CombatLog
extends PanelContainer
## CombatLog - Scrollable combat event log during battle
## Color-coded entries: player=blue, enemy=red, system=gold

const MAX_ENTRIES: int = 100
const PLAYER_COLOR: Color = Color(0.353, 0.541, 0.671)
const ENEMY_COLOR: Color = Color(0.769, 0.267, 0.267)
const SYSTEM_COLOR: Color = Color(0.69, 0.44, 0.25)
const SUBDUE_COLOR: Color = Color(0.6, 0.5, 0.8)

var _scroll: ScrollContainer
var _log_vbox: VBoxContainer
var _entry_count: int = 0


func _ready() -> void:
	_build_ui()


func _build_ui() -> void:
	# Semi-transparent dark panel style
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.055, 0.08, 0.9)
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 6
	style.content_margin_right = 6
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	add_theme_stylebox_override("panel", style)

	# Header label
	var header: Label = Label.new()
	header.text = "Combat Log"
	header.add_theme_font_size_override("font_size", 13)
	header.add_theme_color_override("font_color", Color(0.478, 0.463, 0.439))
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# Scroll container for log entries
	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED

	# VBox inside scroll
	_log_vbox = VBoxContainer.new()
	_log_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_log_vbox.add_theme_constant_override("separation", 2)
	_scroll.add_child(_log_vbox)

	# Outer VBox to hold header + scroll
	var outer_vbox: VBoxContainer = VBoxContainer.new()
	outer_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	outer_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	outer_vbox.add_theme_constant_override("separation", 2)
	outer_vbox.add_child(header)
	outer_vbox.add_child(_scroll)
	add_child(outer_vbox)


## Add a color-coded entry to the log
func add_entry(text: String, color: Color = Color.WHITE) -> void:
	var label: Label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_log_vbox.add_child(label)
	_entry_count += 1

	# Prune old entries
	if _entry_count > MAX_ENTRIES:
		var oldest: Node = _log_vbox.get_child(0)
		_log_vbox.remove_child(oldest)
		oldest.queue_free()
		_entry_count -= 1

	# Auto-scroll to bottom (deferred so layout updates first)
	_scroll.call_deferred("set_v_scroll", 99999)


## Log an attack hit
func log_attack(attacker_name: String, defender_name: String, damage: int, is_crit: bool, is_player: bool) -> void:
	var color: Color = PLAYER_COLOR if is_player else ENEMY_COLOR
	if is_crit:
		add_entry("%s crits %s for %d!" % [attacker_name, defender_name, damage], SYSTEM_COLOR)
	else:
		add_entry("%s hits %s for %d" % [attacker_name, defender_name, damage], color)


## Log a miss
func log_miss(attacker_name: String, defender_name: String, is_player: bool) -> void:
	var color: Color = PLAYER_COLOR if is_player else ENEMY_COLOR
	add_entry("%s misses %s" % [attacker_name, defender_name], color.lerp(Color.GRAY, 0.4))


## Log a unit death
func log_death(unit_name: String, _is_player: bool) -> void:
	add_entry("%s was defeated!" % unit_name, SYSTEM_COLOR)


## Log a level up with stat gains
func log_level_up(unit_name: String, gains: Dictionary) -> void:
	var gains_str: String = ""
	for stat in gains:
		if gains[stat] > 0:
			gains_str += "%s+%d " % [stat.to_upper(), gains[stat]]
	gains_str = gains_str.strip_edges()
	if gains_str.is_empty():
		gains_str = "No gains"
	add_entry("%s leveled up! %s" % [unit_name, gains_str], SYSTEM_COLOR)


## Log a subdue attempt
func log_subdue(attacker_name: String, target_name: String, success: bool, is_player: bool) -> void:
	if success:
		add_entry("%s subdued %s!" % [attacker_name, target_name], SUBDUE_COLOR)
	else:
		var color: Color = PLAYER_COLOR if is_player else ENEMY_COLOR
		add_entry("%s failed to subdue %s" % [attacker_name, target_name], color.lerp(Color.GRAY, 0.4))


## Log an untie action
func log_untie(rescuer_name: String, target_name: String, _is_player: bool) -> void:
	add_entry("%s freed %s!" % [rescuer_name, target_name], SUBDUE_COLOR)


## Log a card play (damage)
func log_card_play(unit_name: String, card_name: String, target_name: String, damage: int) -> void:
	add_entry("%s plays %s on %s - %d dmg" % [unit_name, card_name, target_name, damage], PLAYER_COLOR)


## Log a card heal
func log_card_heal(unit_name: String, card_name: String, target_name: String, healing: int) -> void:
	add_entry("%s plays %s on %s - %d heal" % [unit_name, card_name, target_name, healing], Color(0.353, 0.541, 0.353))


## Log a card effect (no damage/heal)
func log_card_effect(unit_name: String, card_name: String) -> void:
	add_entry("%s plays %s" % [unit_name, card_name], PLAYER_COLOR)


## Log a system message
func log_system(text: String) -> void:
	add_entry(text, SYSTEM_COLOR)


## Clear all entries
func clear_log() -> void:
	for child in _log_vbox.get_children():
		child.queue_free()
	_entry_count = 0
