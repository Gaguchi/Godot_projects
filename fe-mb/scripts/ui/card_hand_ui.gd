extends CanvasLayer
## CardHandUI - Bottom-of-screen card hand display for combat
## Shows current hand, AP counter, deck/discard counts, and End Turn button

signal card_selected(card: CardData, index: int)
signal card_hovered(card: CardData, index: int)  # -1 index = no card hovered
signal end_turn_pressed

# Stone & Steel palette (from UIColors)
const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_BLOOD := UIColors.COLOR_BLOOD
const COLOR_MOSS := UIColors.COLOR_MOSS
const COLOR_MAGE_PURPLE := UIColors.COLOR_MAGE_PURPLE
const COLOR_ITEM_GREEN := UIColors.COLOR_ITEM_GREEN
const COLOR_SKILL_BLUE := UIColors.COLOR_SKILL_BLUE
const COLOR_CARD_DIM := UIColors.COLOR_CARD_DIM

const CARD_WIDTH: int = 140
const CARD_HEIGHT: int = 180
const CARD_SPACING: int = 8
const CARD_HOVER_RAISE: int = 30

var _card_containers: Array[PanelContainer] = []
var _current_hand: Array = []  # Array of CardData
var _current_ap: int = 0
var _max_ap: int = 3
var _current_unit: UnitData = null
var _selected_index: int = -1
var _hovered_index: int = -1

var _hand_container: HBoxContainer
var _ap_label: Label
var _deck_label: Label
var _discard_label: Label
var _end_turn_btn: Button
var _unit_name_label: Label
var _bottom_bar: PanelContainer


func _ready() -> void:
	layer = 10
	_build_ui()
	hide_hand()


func _build_ui() -> void:
	# Bottom bar container
	_bottom_bar = PanelContainer.new()
	_bottom_bar.name = "BottomBar"
	var bar_style := StyleBoxFlat.new()
	bar_style.bg_color = Color(0.03, 0.035, 0.05, 0.95)
	bar_style.border_color = COLOR_IRON_BORDER
	bar_style.border_width_top = 2
	bar_style.set_content_margin_all(8)
	bar_style.content_margin_top = 6
	bar_style.content_margin_bottom = 6
	_bottom_bar.add_theme_stylebox_override("panel", bar_style)

	# Anchor to bottom — MUST be MOUSE_FILTER_IGNORE so it doesn't eat clicks
	# when _bottom_bar is hidden (otherwise blocks Skip Move and other $UI buttons)
	var anchor := Control.new()
	anchor.name = "Anchor"
	anchor.mouse_filter = Control.MOUSE_FILTER_IGNORE
	anchor.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	anchor.offset_top = -210
	add_child(anchor)
	anchor.add_child(_bottom_bar)
	_bottom_bar.set_anchors_preset(Control.PRESET_FULL_RECT)

	# Main HBox: [UnitInfo | Cards | AP + EndTurn]
	var main_hbox := HBoxContainer.new()
	main_hbox.add_theme_constant_override("separation", 12)
	_bottom_bar.add_child(main_hbox)

	# Left: unit name + deck/discard info
	var left_vbox := VBoxContainer.new()
	left_vbox.custom_minimum_size = Vector2(100, 0)
	left_vbox.add_theme_constant_override("separation", 4)

	_unit_name_label = Label.new()
	_unit_name_label.add_theme_font_size_override("font_size", 14)
	_unit_name_label.add_theme_color_override("font_color", COLOR_EMBER)
	left_vbox.add_child(_unit_name_label)

	_deck_label = Label.new()
	_deck_label.add_theme_font_size_override("font_size", 11)
	_deck_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	left_vbox.add_child(_deck_label)

	_discard_label = Label.new()
	_discard_label.add_theme_font_size_override("font_size", 11)
	_discard_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	left_vbox.add_child(_discard_label)

	main_hbox.add_child(left_vbox)

	# Center: card hand
	_hand_container = HBoxContainer.new()
	_hand_container.add_theme_constant_override("separation", CARD_SPACING)
	_hand_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_hand_container.alignment = BoxContainer.ALIGNMENT_CENTER
	main_hbox.add_child(_hand_container)

	# Right: AP + End Turn
	var right_vbox := VBoxContainer.new()
	right_vbox.custom_minimum_size = Vector2(110, 0)
	right_vbox.add_theme_constant_override("separation", 6)
	right_vbox.alignment = BoxContainer.ALIGNMENT_CENTER

	_ap_label = Label.new()
	_ap_label.add_theme_font_size_override("font_size", 16)
	_ap_label.add_theme_color_override("font_color", COLOR_EMBER)
	_ap_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	right_vbox.add_child(_ap_label)

	_end_turn_btn = Button.new()
	_end_turn_btn.text = "End Turn"
	_end_turn_btn.custom_minimum_size = Vector2(100, 36)
	_style_end_turn_btn()
	_end_turn_btn.pressed.connect(_on_end_turn)
	right_vbox.add_child(_end_turn_btn)

	main_hbox.add_child(right_vbox)


## Show the hand UI for a unit
func show_hand(unit: UnitData, hand: Array, ap: int, max_ap: int, draw_count: int, discard_count: int) -> void:
	_current_unit = unit
	_current_hand = hand.duplicate()  # Copy to avoid mutating DeckManager's array
	_current_ap = ap
	_max_ap = max_ap
	_selected_index = -1
	_hovered_index = -1

	_unit_name_label.text = unit.unit_name
	_update_ap_display()
	_deck_label.text = "Draw: %d" % draw_count
	_discard_label.text = "Discard: %d" % discard_count

	_rebuild_cards()
	_bottom_bar.visible = true


## Hide the hand UI
func hide_hand() -> void:
	_bottom_bar.visible = false
	_current_hand = []  # Detach from dm.hand — do NOT .clear() which mutates the DeckManager's array
	_selected_index = -1


## Update AP display
func update_ap(ap: int, max_ap: int) -> void:
	_current_ap = ap
	_max_ap = max_ap
	_update_ap_display()
	_refresh_card_playability()


## Update deck/discard counts
func update_deck_info(draw_count: int, discard_count: int) -> void:
	_deck_label.text = "Draw: %d" % draw_count
	_discard_label.text = "Discard: %d" % discard_count


## Update hand after a card is played or drawn
func update_hand(hand: Array) -> void:
	_current_hand = hand.duplicate()  # Copy to avoid mutating DeckManager's array
	_selected_index = -1
	_rebuild_cards()


## Rebuild card visuals from current hand
func _rebuild_cards() -> void:
	# Clear old cards
	for child in _hand_container.get_children():
		child.queue_free()
	_card_containers.clear()

	# Create new card panels
	for i in _current_hand.size():
		var card: CardData = _current_hand[i]
		var panel := _create_card_panel(card, i)
		_hand_container.add_child(panel)
		_card_containers.append(panel)

	_refresh_card_playability()


## Create a visual card panel
func _create_card_panel(card: CardData, index: int) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP

	# Style based on card type
	var accent_color := _get_card_type_color(card.card_type)
	var style := StyleBoxFlat.new()
	style.bg_color = COLOR_PANEL_BG
	style.border_color = accent_color
	style.set_border_width_all(2)
	style.set_corner_radius_all(6)
	style.set_content_margin_all(8)
	panel.add_theme_stylebox_override("panel", style)

	# Content VBox
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	vbox.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Top row: name + AP cost
	var top_hbox := HBoxContainer.new()
	top_hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var name_label := Label.new()
	name_label.text = card.card_name
	name_label.add_theme_font_size_override("font_size", 12)
	name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_hbox.add_child(name_label)

	var ap_badge := Label.new()
	ap_badge.text = "%d AP" % card.ap_cost
	ap_badge.add_theme_font_size_override("font_size", 11)
	ap_badge.add_theme_color_override("font_color", COLOR_EMBER)
	ap_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_hbox.add_child(ap_badge)

	vbox.add_child(top_hbox)

	# Separator
	var sep := ColorRect.new()
	sep.color = accent_color.darkened(0.4)
	sep.custom_minimum_size = Vector2(0, 1)
	sep.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(sep)

	# Card type tag
	var type_label := Label.new()
	type_label.text = _get_card_type_name(card.card_type)
	type_label.add_theme_font_size_override("font_size", 10)
	type_label.add_theme_color_override("font_color", accent_color)
	type_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(type_label)

	# Description
	var desc_label := Label.new()
	desc_label.name = "Description"
	if _current_unit:
		desc_label.text = card.get_description_filled(_current_unit)
	else:
		desc_label.text = card.description
	desc_label.add_theme_font_size_override("font_size", 11)
	desc_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	desc_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	desc_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vbox.add_child(desc_label)

	# Range + AOE info (if not self-targeting)
	if card.target_type != CardData.TargetType.SELF:
		var range_label := Label.new()
		var rng_text: String
		if card.range_min == card.range_max:
			rng_text = "Range: %d" % card.range_min
		else:
			rng_text = "Range: %d-%d" % [card.range_min, card.range_max]
		if card.aoe_radius > 0:
			rng_text += "  AOE: %d" % card.aoe_radius
		if card.target_type == CardData.TargetType.GROUND:
			rng_text += "  [Ground]"
		range_label.text = rng_text
		range_label.add_theme_font_size_override("font_size", 10)
		range_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		range_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		vbox.add_child(range_label)

	panel.add_child(vbox)

	# Connect mouse events
	panel.gui_input.connect(_on_card_gui_input.bind(index))
	panel.mouse_entered.connect(_on_card_hover.bind(index, true))
	panel.mouse_exited.connect(_on_card_hover.bind(index, false))

	return panel


## Handle card click
func _on_card_gui_input(event: InputEvent, index: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if index < _current_hand.size():
			var card: CardData = _current_hand[index]
			if card.ap_cost <= _current_ap:
				_selected_index = index
				_refresh_card_selection()
				card_selected.emit(card, index)


## Handle card hover
func _on_card_hover(index: int, entering: bool) -> void:
	if entering:
		_hovered_index = index
		if index < _current_hand.size():
			card_hovered.emit(_current_hand[index], index)
	elif _hovered_index == index:
		_hovered_index = -1
		card_hovered.emit(null, -1)
	_refresh_card_hover()


## Refresh hover visual (raise card)
func _refresh_card_hover() -> void:
	for i in _card_containers.size():
		var panel: PanelContainer = _card_containers[i]
		if i == _hovered_index:
			panel.position.y = -CARD_HOVER_RAISE
		else:
			panel.position.y = 0


## Refresh selection highlight
func _refresh_card_selection() -> void:
	for i in _card_containers.size():
		var panel: PanelContainer = _card_containers[i]
		var card: CardData = _current_hand[i] if i < _current_hand.size() else null
		if card == null:
			continue
		var accent := _get_card_type_color(card.card_type)
		var style: StyleBoxFlat = panel.get_theme_stylebox("panel").duplicate()
		if i == _selected_index:
			style.border_color = Color.WHITE
			style.set_border_width_all(3)
		else:
			style.border_color = accent
			style.set_border_width_all(2)
		panel.add_theme_stylebox_override("panel", style)


## Refresh which cards are playable (enough AP)
func _refresh_card_playability() -> void:
	for i in _card_containers.size():
		if i >= _current_hand.size():
			break
		var card: CardData = _current_hand[i]
		var panel: PanelContainer = _card_containers[i]
		var playable: bool = card.ap_cost <= _current_ap
		panel.modulate = Color.WHITE if playable else COLOR_CARD_DIM


## Update AP display text
func _update_ap_display() -> void:
	var dots := ""
	for i in _max_ap:
		if i < _current_ap:
			dots += "● "
		else:
			dots += "○ "
	_ap_label.text = "AP: %s" % dots.strip_edges()


## End turn button handler
func _on_end_turn() -> void:
	end_turn_pressed.emit()


## Style the End Turn button
func _style_end_turn_btn() -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.15, 0.08, 0.05, 0.95)
	normal.border_color = COLOR_EMBER
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(4)
	normal.set_content_margin_all(6)
	_end_turn_btn.add_theme_stylebox_override("normal", normal)

	var hover := StyleBoxFlat.new()
	hover.bg_color = Color(0.25, 0.14, 0.08, 0.95)
	hover.border_color = COLOR_EMBER
	hover.set_border_width_all(2)
	hover.set_corner_radius_all(4)
	hover.set_content_margin_all(6)
	_end_turn_btn.add_theme_stylebox_override("hover", hover)

	var pressed := StyleBoxFlat.new()
	pressed.bg_color = Color(0.1, 0.05, 0.03, 0.95)
	pressed.border_color = COLOR_EMBER
	pressed.set_border_width_all(1)
	pressed.set_corner_radius_all(4)
	pressed.set_content_margin_all(6)
	_end_turn_btn.add_theme_stylebox_override("pressed", pressed)

	_end_turn_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	_end_turn_btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	_end_turn_btn.add_theme_font_size_override("font_size", 14)


## Get accent color for card type
func _get_card_type_color(ct: CardData.CardType) -> Color:
	match ct:
		CardData.CardType.ATTACK: return COLOR_BLOOD
		CardData.CardType.SKILL: return COLOR_SKILL_BLUE
		CardData.CardType.SPELL: return COLOR_MAGE_PURPLE
		CardData.CardType.ITEM: return COLOR_ITEM_GREEN
	return COLOR_IRON_BORDER


## Expose card playability refresh (for external callers such as CardPlayController)
func refresh_card_playability() -> void:
	_refresh_card_playability()


## Deselect the currently selected card (cancel targeting)
func deselect_card() -> void:
	_selected_index = -1
	_refresh_card_selection()
	# Restore full interactivity
	for i in _card_containers.size():
		if i < _current_hand.size():
			_card_containers[i].mouse_filter = Control.MOUSE_FILTER_STOP


## Enter targeting mode — dim unselected cards, disable clicks on other cards
func set_targeting_mode(active: bool) -> void:
	if active and _selected_index >= 0:
		for i in _card_containers.size():
			if i != _selected_index:
				_card_containers[i].modulate = COLOR_CARD_DIM
				_card_containers[i].mouse_filter = Control.MOUSE_FILTER_IGNORE
	else:
		_refresh_card_playability()
		for i in _card_containers.size():
			_card_containers[i].mouse_filter = Control.MOUSE_FILTER_STOP


## Get display name for card type
func _get_card_type_name(ct: CardData.CardType) -> String:
	match ct:
		CardData.CardType.ATTACK: return "Attack"
		CardData.CardType.SKILL: return "Skill"
		CardData.CardType.SPELL: return "Spell"
		CardData.CardType.ITEM: return "Item"
	return "Unknown"




