class_name BountyBoard
extends VBoxContainer
## BountyBoard - Shows captured enemies and allows turn-in for gold.
## Embedded inside TownMenu's tavern panel.

signal gold_changed

const COLOR_PANEL_BG := UIColors.COLOR_PANEL_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER := UIColors.COLOR_EMBER
const COLOR_PARCHMENT := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE := UIColors.COLOR_WORN_STONE
const COLOR_MOSS := UIColors.COLOR_MOSS
const COLOR_SUBDUE := UIColors.COLOR_SUBDUE

var _list_container: VBoxContainer


func _ready() -> void:
	add_theme_constant_override("separation", 6)
	_build_ui()


func _build_ui() -> void:
	_list_container = VBoxContainer.new()
	_list_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list_container.add_theme_constant_override("separation", 6)
	add_child(_list_container)
	_refresh()


func _refresh() -> void:
	for child in _list_container.get_children():
		child.queue_free()

	if GameManager.captured_enemies.is_empty():
		var empty := Label.new()
		empty.text = "No prisoners to turn in."
		empty.add_theme_font_size_override("font_size", 13)
		empty.add_theme_color_override("font_color", Color(COLOR_WORN_STONE, 0.6))
		_list_container.add_child(empty)
		return

	for i in range(GameManager.captured_enemies.size()):
		var unit_data: UnitData = GameManager.captured_enemies[i]
		var bounty: int = GameManager.get_bounty_value(unit_data)

		var row_panel := PanelContainer.new()
		var row_style := StyleBoxFlat.new()
		row_style.bg_color = Color(0.06, 0.065, 0.09, 0.7)
		row_style.border_color = Color(COLOR_SUBDUE, 0.3)
		row_style.border_width_left = 3
		row_style.set_corner_radius_all(2)
		row_style.content_margin_left = 10
		row_style.content_margin_right = 10
		row_style.content_margin_top = 6
		row_style.content_margin_bottom = 6
		row_panel.add_theme_stylebox_override("panel", row_style)
		_list_container.add_child(row_panel)

		var hbox := HBoxContainer.new()
		hbox.add_theme_constant_override("separation", 10)
		row_panel.add_child(hbox)

		# Unit info
		var info_vbox := VBoxContainer.new()
		info_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_vbox.add_theme_constant_override("separation", 1)
		hbox.add_child(info_vbox)

		var name_label := Label.new()
		name_label.text = unit_data.unit_name
		name_label.add_theme_font_size_override("font_size", 14)
		name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
		info_vbox.add_child(name_label)

		var detail_label := Label.new()
		detail_label.text = "%s  Lv.%d" % [unit_data.get_class_name(), unit_data.level]
		detail_label.add_theme_font_size_override("font_size", 11)
		detail_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		info_vbox.add_child(detail_label)

		# Bounty value
		var bounty_label := Label.new()
		bounty_label.text = "%dg" % bounty
		bounty_label.add_theme_font_size_override("font_size", 14)
		bounty_label.add_theme_color_override("font_color", COLOR_EMBER)
		bounty_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		hbox.add_child(bounty_label)

		# Turn In button
		var turn_in_btn := Button.new()
		turn_in_btn.text = "Turn In"
		turn_in_btn.custom_minimum_size = Vector2(80, 28)
		turn_in_btn.add_theme_font_size_override("font_size", 12)
		turn_in_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
		turn_in_btn.add_theme_color_override("font_hover_color", COLOR_MOSS)
		turn_in_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER

		var btn_style := StyleBoxFlat.new()
		btn_style.bg_color = Color(0.06, 0.065, 0.09, 0.9)
		btn_style.border_color = COLOR_IRON_BORDER
		btn_style.set_border_width_all(1)
		btn_style.set_corner_radius_all(2)
		btn_style.content_margin_left = 6
		btn_style.content_margin_right = 6
		btn_style.content_margin_top = 3
		btn_style.content_margin_bottom = 3
		turn_in_btn.add_theme_stylebox_override("normal", btn_style)

		var btn_hover := btn_style.duplicate()
		btn_hover.border_color = COLOR_MOSS
		turn_in_btn.add_theme_stylebox_override("hover", btn_hover)

		var captured_index: int = i
		var captured_bounty: int = bounty
		var captured_name: String = unit_data.unit_name
		turn_in_btn.pressed.connect(func():
			_turn_in(captured_index, captured_bounty, captured_name)
		)
		hbox.add_child(turn_in_btn)

	# Turn In All button if multiple prisoners
	if GameManager.captured_enemies.size() > 1:
		var total_bounty: int = 0
		for unit in GameManager.captured_enemies:
			total_bounty += GameManager.get_bounty_value(unit)

		var all_row := HBoxContainer.new()
		all_row.add_theme_constant_override("separation", 10)
		all_row.alignment = BoxContainer.ALIGNMENT_END
		_list_container.add_child(all_row)

		var total_label := Label.new()
		total_label.text = "%d prisoners  —  Total: %dg" % [GameManager.captured_enemies.size(), total_bounty]
		total_label.add_theme_font_size_override("font_size", 13)
		total_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
		all_row.add_child(total_label)

		var all_btn := Button.new()
		all_btn.text = "Turn In All (%dg)" % total_bounty
		all_btn.custom_minimum_size = Vector2(130, 30)
		all_btn.add_theme_font_size_override("font_size", 13)
		all_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
		all_btn.add_theme_color_override("font_hover_color", COLOR_MOSS)

		var all_style := StyleBoxFlat.new()
		all_style.bg_color = Color(0.06, 0.065, 0.09, 0.95)
		all_style.border_color = COLOR_MOSS
		all_style.set_border_width_all(1)
		all_style.set_corner_radius_all(3)
		all_style.content_margin_left = 8
		all_style.content_margin_right = 8
		all_style.content_margin_top = 4
		all_style.content_margin_bottom = 4
		all_btn.add_theme_stylebox_override("normal", all_style)

		var all_hover := all_style.duplicate()
		all_hover.bg_color = Color(0.08, 0.09, 0.07, 0.95)
		all_btn.add_theme_stylebox_override("hover", all_hover)

		var captured_total: int = total_bounty
		all_btn.pressed.connect(func():
			_turn_in_all(captured_total)
		)
		all_row.add_child(all_btn)


func _turn_in(index: int, bounty: int, unit_name: String) -> void:
	if index < 0 or index >= GameManager.captured_enemies.size():
		return
	GameManager.captured_enemies.remove_at(index)
	GameManager.add_gold(bounty)
	EventBus.show_notification.emit("Turned in %s for %dg bounty!" % [unit_name, bounty])
	gold_changed.emit()
	_refresh()


func _turn_in_all(total_bounty: int) -> void:
	var count: int = GameManager.captured_enemies.size()
	GameManager.captured_enemies.clear()
	GameManager.add_gold(total_bounty)
	EventBus.show_notification.emit("Turned in %d prisoners for %dg!" % [count, total_bounty])
	gold_changed.emit()
	_refresh()
