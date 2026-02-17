class_name QuestLogPanel
extends CanvasLayer
## QuestLogPanel - Overlay showing active and completed quests.
## Left: quest list. Right: selected quest details.
## Close with Escape or X button.

signal closed

const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_SIDEBAR_BG := Color(0.04, 0.045, 0.065, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_MOSS := Color(0.353, 0.541, 0.353)
const COLOR_OVERLAY := Color(0, 0, 0, 0.8)

var _quest_buttons: Dictionary = {}  # quest_id -> Button
var _selected_quest_id: String = ""
var _detail_container: VBoxContainer
var _list_container: VBoxContainer


func _ready() -> void:
	layer = 25
	_build_ui()


func _build_ui() -> void:
	# Dark overlay
	var bg := ColorRect.new()
	bg.color = COLOR_OVERLAY
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(bg)

	# Root margin
	var root_margin := MarginContainer.new()
	root_margin.anchor_right = 1.0
	root_margin.anchor_bottom = 1.0
	root_margin.add_theme_constant_override("margin_left", 60)
	root_margin.add_theme_constant_override("margin_right", 60)
	root_margin.add_theme_constant_override("margin_top", 40)
	root_margin.add_theme_constant_override("margin_bottom", 40)
	add_child(root_margin)

	var main_panel := PanelContainer.new()
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_IRON_BORDER
	panel_style.set_border_width_all(2)
	panel_style.set_corner_radius_all(4)
	panel_style.content_margin_left = 0
	panel_style.content_margin_right = 0
	panel_style.content_margin_top = 0
	panel_style.content_margin_bottom = 0
	main_panel.add_theme_stylebox_override("panel", panel_style)
	root_margin.add_child(main_panel)

	var outer_vbox := VBoxContainer.new()
	outer_vbox.add_theme_constant_override("separation", 0)
	main_panel.add_child(outer_vbox)

	# Header bar
	var header_bar := PanelContainer.new()
	var header_style := StyleBoxFlat.new()
	header_style.bg_color = Color(0.07, 0.075, 0.1)
	header_style.content_margin_left = 16
	header_style.content_margin_right = 16
	header_style.content_margin_top = 10
	header_style.content_margin_bottom = 10
	header_bar.add_theme_stylebox_override("panel", header_style)
	outer_vbox.add_child(header_bar)

	var header_hbox := HBoxContainer.new()
	header_bar.add_child(header_hbox)

	var title := Label.new()
	title.text = "Quest Log"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", COLOR_EMBER)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_hbox.add_child(title)

	var close_btn := Button.new()
	close_btn.text = "X"
	close_btn.custom_minimum_size = Vector2(32, 32)
	close_btn.add_theme_font_size_override("font_size", 16)
	close_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	close_btn.add_theme_color_override("font_hover_color", Color(0.769, 0.267, 0.267))
	var close_style := StyleBoxFlat.new()
	close_style.bg_color = Color(0, 0, 0, 0)
	close_btn.add_theme_stylebox_override("normal", close_style)
	close_btn.add_theme_stylebox_override("hover", close_style)
	close_btn.pressed.connect(_close)
	header_hbox.add_child(close_btn)

	# Body: left list + right detail
	var body_hbox := HBoxContainer.new()
	body_hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body_hbox.add_theme_constant_override("separation", 0)
	outer_vbox.add_child(body_hbox)

	# Left: quest list
	var list_panel := PanelContainer.new()
	list_panel.custom_minimum_size = Vector2(240, 0)
	var list_style := StyleBoxFlat.new()
	list_style.bg_color = COLOR_SIDEBAR_BG
	list_style.border_color = COLOR_IRON_BORDER
	list_style.border_width_right = 1
	list_style.content_margin_left = 8
	list_style.content_margin_right = 8
	list_style.content_margin_top = 10
	list_style.content_margin_bottom = 10
	list_panel.add_theme_stylebox_override("panel", list_style)
	body_hbox.add_child(list_panel)

	var list_scroll := ScrollContainer.new()
	list_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	list_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	list_panel.add_child(list_scroll)

	_list_container = VBoxContainer.new()
	_list_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list_container.add_theme_constant_override("separation", 4)
	list_scroll.add_child(_list_container)

	# Right: detail panel
	var detail_margin := MarginContainer.new()
	detail_margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_margin.add_theme_constant_override("margin_left", 16)
	detail_margin.add_theme_constant_override("margin_right", 16)
	detail_margin.add_theme_constant_override("margin_top", 12)
	detail_margin.add_theme_constant_override("margin_bottom", 12)
	body_hbox.add_child(detail_margin)

	_detail_container = VBoxContainer.new()
	_detail_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail_container.add_theme_constant_override("separation", 8)
	detail_margin.add_child(_detail_container)

	_populate_quest_list()


func _populate_quest_list() -> void:
	for child in _list_container.get_children():
		child.queue_free()
	_quest_buttons.clear()

	var active := QuestManager.get_active_quests()
	var completed := QuestManager.get_completed_quests()

	if active.is_empty() and completed.is_empty():
		var empty := Label.new()
		empty.text = "No quests yet."
		empty.add_theme_font_size_override("font_size", 14)
		empty.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_list_container.add_child(empty)
		return

	# Active quests
	if not active.is_empty():
		var active_header := Label.new()
		active_header.text = "Active"
		active_header.add_theme_font_size_override("font_size", 12)
		active_header.add_theme_color_override("font_color", COLOR_EMBER)
		_list_container.add_child(active_header)

		for quest_id in active:
			_add_quest_button(quest_id, false)

	# Completed quests
	if not completed.is_empty():
		var comp_header := Label.new()
		comp_header.text = "Completed"
		comp_header.add_theme_font_size_override("font_size", 12)
		comp_header.add_theme_color_override("font_color", COLOR_MOSS)
		_list_container.add_child(comp_header)

		for quest_id in completed:
			_add_quest_button(quest_id, true)

	# Auto-select first
	if not active.is_empty():
		_select_quest(active[0])
	elif not completed.is_empty():
		_select_quest(completed[0])


func _add_quest_button(quest_id: String, is_complete: bool) -> void:
	var def: Dictionary = QuestManager.get_definition(quest_id)
	var quest_name: String = def.get("name", quest_id)

	var btn := Button.new()
	btn.text = quest_name
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.custom_minimum_size = Vector2(0, 30)
	btn.add_theme_font_size_override("font_size", 13)

	if is_complete:
		btn.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.7))
	else:
		btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0, 0, 0, 0)
	normal.border_width_left = 3
	normal.border_color = Color(0, 0, 0, 0)
	normal.content_margin_left = 8
	normal.content_margin_right = 4
	normal.content_margin_top = 2
	normal.content_margin_bottom = 2
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.bg_color = Color(0.08, 0.085, 0.11, 0.5)
	hover.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("hover", hover)

	var captured_id: String = quest_id
	btn.pressed.connect(func(): _select_quest(captured_id))
	_list_container.add_child(btn)
	_quest_buttons[quest_id] = btn


func _select_quest(quest_id: String) -> void:
	_selected_quest_id = quest_id
	_update_list_highlight()
	_show_quest_detail(quest_id)


func _update_list_highlight() -> void:
	for qid in _quest_buttons:
		var btn: Button = _quest_buttons[qid]
		if qid == _selected_quest_id:
			var active_style := StyleBoxFlat.new()
			active_style.bg_color = Color(0.1, 0.09, 0.07, 0.5)
			active_style.border_width_left = 3
			active_style.border_color = COLOR_EMBER
			active_style.content_margin_left = 8
			active_style.content_margin_right = 4
			active_style.content_margin_top = 2
			active_style.content_margin_bottom = 2
			btn.add_theme_stylebox_override("normal", active_style)
			btn.add_theme_color_override("font_color", COLOR_EMBER)
		else:
			var normal := StyleBoxFlat.new()
			normal.bg_color = Color(0, 0, 0, 0)
			normal.border_width_left = 3
			normal.border_color = Color(0, 0, 0, 0)
			normal.content_margin_left = 8
			normal.content_margin_right = 4
			normal.content_margin_top = 2
			normal.content_margin_bottom = 2
			btn.add_theme_stylebox_override("normal", normal)
			var is_complete := QuestManager.is_quest_complete(qid)
			btn.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.7) if is_complete else COLOR_PARCHMENT)


func _show_quest_detail(quest_id: String) -> void:
	for child in _detail_container.get_children():
		child.queue_free()

	var def: Dictionary = QuestManager.get_definition(quest_id)
	var is_complete := QuestManager.is_quest_complete(quest_id)
	var current_stage: int = QuestManager.get_quest_stage(quest_id)

	# Quest name
	var name_label := Label.new()
	name_label.text = def.get("name", quest_id)
	name_label.add_theme_font_size_override("font_size", 18)
	name_label.add_theme_color_override("font_color", COLOR_EMBER)
	_detail_container.add_child(name_label)

	# Status badge
	var status_label := Label.new()
	if is_complete:
		status_label.text = "COMPLETED"
		status_label.add_theme_color_override("font_color", COLOR_MOSS)
	else:
		status_label.text = "ACTIVE"
		status_label.add_theme_color_override("font_color", COLOR_EMBER)
	status_label.add_theme_font_size_override("font_size", 11)
	_detail_container.add_child(status_label)

	# Source
	var source: String = def.get("source", "")
	if source != "":
		var source_label := Label.new()
		source_label.text = "From: %s" % source
		source_label.add_theme_font_size_override("font_size", 12)
		source_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_detail_container.add_child(source_label)

	# Separator
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 1)
	sep.color = Color(COLOR_IRON_BORDER, 0.4)
	_detail_container.add_child(sep)

	# Description
	var desc_label := Label.new()
	desc_label.text = def.get("description", "No description available.")
	desc_label.add_theme_font_size_override("font_size", 14)
	desc_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	_detail_container.add_child(desc_label)

	# Stages
	var stages: Array = def.get("stages", [])
	if not stages.is_empty():
		var sep2 := ColorRect.new()
		sep2.custom_minimum_size = Vector2(0, 1)
		sep2.color = Color(COLOR_IRON_BORDER, 0.3)
		_detail_container.add_child(sep2)

		var stages_header := Label.new()
		stages_header.text = "Objectives"
		stages_header.add_theme_font_size_override("font_size", 13)
		stages_header.add_theme_color_override("font_color", COLOR_WORN_STONE)
		_detail_container.add_child(stages_header)

		for stage_data in stages:
			var stage_num: int = stage_data.get("stage", 0)
			var stage_label := Label.new()
			stage_label.autowrap_mode = TextServer.AUTOWRAP_WORD
			stage_label.add_theme_font_size_override("font_size", 13)

			if is_complete or stage_num < current_stage:
				stage_label.text = "[x] %s" % stage_data.get("label", "")
				stage_label.add_theme_color_override("font_color", Color(COLOR_MOSS, 0.7))
			elif stage_num == current_stage:
				stage_label.text = "[ ] %s" % stage_data.get("label", "")
				stage_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
			else:
				stage_label.text = "[ ] %s" % stage_data.get("label", "")
				stage_label.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.5))

			_detail_container.add_child(stage_label)


func _close() -> void:
	closed.emit()
	queue_free()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_close()
		get_viewport().set_input_as_handled()
