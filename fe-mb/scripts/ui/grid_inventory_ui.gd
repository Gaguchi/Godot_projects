class_name GridInventoryUI
extends CanvasLayer
## GridInventoryUI - Diablo/RE4-style grid inventory for the shared party bag.
## Left: 8x4 item grid with click-to-move. Right: unit panels with weapon/quick slots.
## Close with Escape or X button.

signal closed

# --- Layout constants ---
const CELL_SIZE: int = 48
const GRID_COLS: int = 8
const GRID_ROWS: int = 4

# --- Colors (Stone & Steel palette) ---
const COLOR_PANEL_BG    := UIColors.COLOR_PANEL_BG
const COLOR_SIDEBAR_BG  := UIColors.COLOR_SIDEBAR_BG
const COLOR_IRON_BORDER := UIColors.COLOR_IRON_BORDER
const COLOR_EMBER       := UIColors.COLOR_EMBER
const COLOR_PARCHMENT   := UIColors.COLOR_PARCHMENT
const COLOR_WORN_STONE  := UIColors.COLOR_WORN_STONE
const COLOR_OVERLAY     := UIColors.COLOR_OVERLAY_MEDIUM
const COLOR_MOSS        := UIColors.COLOR_MOSS_GREEN
const COLOR_BLOOD       := UIColors.COLOR_BLOOD_RED

# Item-type cell tint colors
const COLOR_CELL_WEAPON     := Color(0.25, 0.27, 0.32, 0.9)   # Iron grey
const COLOR_CELL_CONSUMABLE := Color(0.15, 0.28, 0.18, 0.9)   # Moss green
const COLOR_CELL_FOOD       := Color(0.35, 0.26, 0.10, 0.9)   # Amber
const COLOR_CELL_EMPTY      := Color(0.07, 0.075, 0.10, 1.0)  # Very dark

# --- State ---
var _held_item_index: int = -1   # -1 = nothing held; >= 0 = bag_items index
var _held_source: String = ""    # "bag", "weapon_N", "quick_N_M"

# Node refs (set during _build_ui)
var _grid_area: Control          # The 8x4 drawing surface
var _cell_rects: Array           # Array[ColorRect] — 32 cell backgrounds
var _item_panels: Dictionary     # bag_items_index -> Panel (the item visual block)
var _info_name_label: Label
var _info_detail_label: Label
var _unit_panel_vbox: VBoxContainer   # Container holding per-unit rows (right side)
var _held_label: Label               # Floating label tracking cursor when holding


func _ready() -> void:
	layer = 25
	_cell_rects = []
	_item_panels = {}
	_build_ui()
	_refresh_grid()
	_refresh_unit_panels()


# ---------------------------------------------------------------------------
#  UI CONSTRUCTION
# ---------------------------------------------------------------------------

func _build_ui() -> void:
	# Dark background overlay — stops all clicks from passing through
	var bg := ColorRect.new()
	bg.color = COLOR_OVERLAY
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(bg)

	# Centred outer margin
	var root_margin := MarginContainer.new()
	root_margin.anchor_right = 1.0
	root_margin.anchor_bottom = 1.0
	root_margin.add_theme_constant_override("margin_left", 50)
	root_margin.add_theme_constant_override("margin_right", 50)
	root_margin.add_theme_constant_override("margin_top", 30)
	root_margin.add_theme_constant_override("margin_bottom", 30)
	root_margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root_margin)

	# Main panel
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

	# --- Header ---
	outer_vbox.add_child(_build_header())

	# --- Body: left grid + divider + right units ---
	var body_hbox := HBoxContainer.new()
	body_hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body_hbox.add_theme_constant_override("separation", 0)
	outer_vbox.add_child(body_hbox)

	body_hbox.add_child(_build_left_panel())

	# Vertical divider
	var div := ColorRect.new()
	div.custom_minimum_size.x = 2
	div.color = Color(COLOR_IRON_BORDER, 0.6)
	body_hbox.add_child(div)

	body_hbox.add_child(_build_right_panel())

	# Floating "held item" label — rendered at canvas layer top
	_held_label = Label.new()
	_held_label.add_theme_font_size_override("font_size", 11)
	_held_label.add_theme_color_override("font_color", COLOR_EMBER)
	_held_label.visible = false
	_held_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_held_label)


func _build_header() -> Control:
	var header := PanelContainer.new()
	var hs := StyleBoxFlat.new()
	hs.bg_color = Color(0.07, 0.075, 0.10)
	hs.content_margin_left = 16
	hs.content_margin_right = 16
	hs.content_margin_top = 10
	hs.content_margin_bottom = 10
	header.add_theme_stylebox_override("panel", hs)

	var hbox := HBoxContainer.new()
	header.add_child(hbox)

	var title := Label.new()
	title.text = "INVENTORY"
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", COLOR_EMBER)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(title)

	var org_btn := _make_header_button("Organize")
	org_btn.pressed.connect(_on_organize_pressed)
	hbox.add_child(org_btn)

	var close_btn := _make_header_button("X")
	close_btn.custom_minimum_size = Vector2(32, 32)
	close_btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
	close_btn.add_theme_color_override("font_hover_color", COLOR_BLOOD)
	close_btn.pressed.connect(_close)
	hbox.add_child(close_btn)

	return header


func _make_header_button(label_text: String) -> Button:
	var btn := Button.new()
	btn.text = label_text
	btn.custom_minimum_size = Vector2(80, 32)
	btn.add_theme_font_size_override("font_size", 13)
	btn.add_theme_color_override("font_color", COLOR_WORN_STONE)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	btn.mouse_filter = Control.MOUSE_FILTER_STOP
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.10, 0.10, 0.13)
	s.border_color = COLOR_IRON_BORDER
	s.set_border_width_all(1)
	s.content_margin_left = 6
	s.content_margin_right = 6
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	btn.add_theme_stylebox_override("normal", s)
	var sh := s.duplicate()
	sh.bg_color = Color(0.14, 0.12, 0.09)
	sh.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("hover", sh)
	return btn


func _build_left_panel() -> Control:
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_bottom", 14)
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	margin.add_child(vbox)

	# Section label
	var grid_header := Label.new()
	grid_header.text = "Party Bag"
	grid_header.add_theme_font_size_override("font_size", 14)
	grid_header.add_theme_color_override("font_color", COLOR_WORN_STONE)
	vbox.add_child(grid_header)

	# Grid drawing area
	_grid_area = Control.new()
	_grid_area.custom_minimum_size = Vector2(GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE)
	_grid_area.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_grid_area.mouse_filter = Control.MOUSE_FILTER_STOP
	vbox.add_child(_grid_area)

	# Cell background rects
	for row in GRID_ROWS:
		for col in GRID_COLS:
			var cell := ColorRect.new()
			cell.position = Vector2(col * CELL_SIZE + 1, row * CELL_SIZE + 1)
			cell.size = Vector2(CELL_SIZE - 2, CELL_SIZE - 2)
			cell.color = COLOR_CELL_EMPTY
			cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
			_grid_area.add_child(cell)
			_cell_rects.append(cell)

	# Outer grid border
	var grid_border := Panel.new()
	grid_border.position = Vector2.ZERO
	grid_border.size = Vector2(GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE)
	grid_border.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gb_style := StyleBoxFlat.new()
	gb_style.bg_color = Color(0, 0, 0, 0)
	gb_style.border_color = COLOR_IRON_BORDER
	gb_style.set_border_width_all(1)
	grid_border.add_theme_stylebox_override("panel", gb_style)
	_grid_area.add_child(grid_border)

	# Grid lines
	for col in range(1, GRID_COLS):
		var line := ColorRect.new()
		line.position = Vector2(col * CELL_SIZE, 0)
		line.size = Vector2(1, GRID_ROWS * CELL_SIZE)
		line.color = Color(COLOR_IRON_BORDER, 0.4)
		line.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_grid_area.add_child(line)
	for row in range(1, GRID_ROWS):
		var line := ColorRect.new()
		line.position = Vector2(0, row * CELL_SIZE)
		line.size = Vector2(GRID_COLS * CELL_SIZE, 1)
		line.color = Color(COLOR_IRON_BORDER, 0.4)
		line.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_grid_area.add_child(line)

	# Transparent click-catcher for empty cell clicks (place held item)
	var grid_click := Button.new()
	grid_click.name = "GridClickArea"
	grid_click.position = Vector2.ZERO
	grid_click.size = Vector2(GRID_COLS * CELL_SIZE, GRID_ROWS * CELL_SIZE)
	var transparent := StyleBoxFlat.new()
	transparent.bg_color = Color(0, 0, 0, 0)
	transparent.set_border_width_all(0)
	grid_click.add_theme_stylebox_override("normal", transparent)
	grid_click.add_theme_stylebox_override("hover", transparent)
	grid_click.add_theme_stylebox_override("pressed", transparent)
	grid_click.mouse_filter = Control.MOUSE_FILTER_STOP
	grid_click.pressed.connect(_on_grid_click)
	_grid_area.add_child(grid_click)

	# Item info panel below grid
	var info_panel := PanelContainer.new()
	var info_style := StyleBoxFlat.new()
	info_style.bg_color = Color(0.06, 0.065, 0.09)
	info_style.border_color = Color(COLOR_IRON_BORDER, 0.5)
	info_style.set_border_width_all(1)
	info_style.content_margin_left = 10
	info_style.content_margin_right = 10
	info_style.content_margin_top = 8
	info_style.content_margin_bottom = 8
	info_panel.add_theme_stylebox_override("panel", info_style)
	info_panel.custom_minimum_size = Vector2(0, 70)
	vbox.add_child(info_panel)

	var info_vbox := VBoxContainer.new()
	info_vbox.add_theme_constant_override("separation", 3)
	info_panel.add_child(info_vbox)

	_info_name_label = Label.new()
	_info_name_label.text = "Select an item"
	_info_name_label.add_theme_font_size_override("font_size", 14)
	_info_name_label.add_theme_color_override("font_color", COLOR_PARCHMENT)
	info_vbox.add_child(_info_name_label)

	_info_detail_label = Label.new()
	_info_detail_label.text = ""
	_info_detail_label.add_theme_font_size_override("font_size", 12)
	_info_detail_label.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_info_detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	info_vbox.add_child(_info_detail_label)

	return margin


func _build_right_panel() -> Control:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(260, 0)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED

	var margin := MarginContainer.new()
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	scroll.add_child(margin)

	_unit_panel_vbox = VBoxContainer.new()
	_unit_panel_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_unit_panel_vbox.add_theme_constant_override("separation", 8)
	margin.add_child(_unit_panel_vbox)

	return scroll


# ---------------------------------------------------------------------------
#  DATA REFRESH
# ---------------------------------------------------------------------------

## Repopulate the grid visuals from GameManager.bag_items / bag_grid.
func _refresh_grid() -> void:
	# Reset all cell backgrounds to empty
	for i in _cell_rects.size():
		(_cell_rects[i] as ColorRect).color = COLOR_CELL_EMPTY

	# Remove old item panels
	for key in _item_panels:
		var p = _item_panels[key]
		if is_instance_valid(p):
			p.queue_free()
	_item_panels.clear()

	# Place each bag item
	for idx in range(GameManager.bag_items.size()):
		var entry: Dictionary = GameManager.bag_items[idx]
		var item: ItemData = entry["item"] as ItemData
		if not item:
			continue
		_place_item_visual(idx, item, entry["grid_x"], entry["grid_y"])


func _place_item_visual(idx: int, item: ItemData, gx: int, gy: int) -> void:
	var w: int = item.grid_width
	var h: int = item.grid_height
	var cell_color: Color = _get_item_color(item)
	var is_held: bool = (idx == _held_item_index)

	# Tint cell backgrounds
	for dy in h:
		for dx in w:
			var ci: int = (gy + dy) * GRID_COLS + (gx + dx)
			if ci < _cell_rects.size():
				(_cell_rects[ci] as ColorRect).color = cell_color if not is_held else Color(cell_color, 0.4)

	# Build the item panel
	var px: int = gx * CELL_SIZE + 2
	var py: int = gy * CELL_SIZE + 2
	var pw: int = w * CELL_SIZE - 4
	var ph: int = h * CELL_SIZE - 4

	var panel := Panel.new()
	panel.position = Vector2(px, py)
	panel.size = Vector2(pw, ph)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var ps := StyleBoxFlat.new()
	ps.bg_color = cell_color if not is_held else Color(cell_color, 0.35)
	ps.border_color = COLOR_EMBER if is_held else Color(COLOR_IRON_BORDER, 0.7)
	ps.set_border_width_all(2 if is_held else 1)
	ps.set_corner_radius_all(2)
	panel.add_theme_stylebox_override("panel", ps)

	# Item name label centred in the panel
	var name_lbl := Label.new()
	name_lbl.text = _short_name(item.item_name)
	name_lbl.add_theme_font_size_override("font_size", 10)
	name_lbl.add_theme_color_override("font_color", COLOR_PARCHMENT if not is_held else Color(COLOR_PARCHMENT, 0.5))
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	name_lbl.anchor_left = 0.0
	name_lbl.anchor_right = 1.0
	name_lbl.anchor_top = 0.0
	name_lbl.anchor_bottom = 1.0
	name_lbl.offset_left = 0
	name_lbl.offset_right = 0
	name_lbl.offset_top = 0
	name_lbl.offset_bottom = 0
	name_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
	name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(name_lbl)

	# Uses count (consumables, bottom-right)
	if item.item_type == ItemData.ItemType.CONSUMABLE and not item.is_unbreakable:
		var uses_lbl := Label.new()
		uses_lbl.text = str(item.current_uses)
		uses_lbl.add_theme_font_size_override("font_size", 9)
		uses_lbl.add_theme_color_override("font_color", COLOR_EMBER)
		uses_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		uses_lbl.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		uses_lbl.anchor_left = 0.0
		uses_lbl.anchor_right = 1.0
		uses_lbl.anchor_top = 0.0
		uses_lbl.anchor_bottom = 1.0
		uses_lbl.offset_left = 2
		uses_lbl.offset_right = -2
		uses_lbl.offset_top = 2
		uses_lbl.offset_bottom = -2
		uses_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		panel.add_child(uses_lbl)

	# Transparent click button (sits on top of everything in the panel)
	var click_btn := Button.new()
	click_btn.position = Vector2.ZERO
	click_btn.size = Vector2(pw, ph)
	click_btn.flat = true
	var btn_style := StyleBoxFlat.new()
	btn_style.bg_color = Color(0, 0, 0, 0)
	btn_style.set_border_width_all(0)
	click_btn.add_theme_stylebox_override("normal", btn_style)
	click_btn.add_theme_stylebox_override("hover", btn_style)
	click_btn.add_theme_stylebox_override("pressed", btn_style)
	click_btn.mouse_filter = Control.MOUSE_FILTER_STOP
	var captured_idx: int = idx
	click_btn.pressed.connect(func(): _on_bag_item_clicked(captured_idx))
	panel.add_child(click_btn)

	_grid_area.add_child(panel)
	_item_panels[idx] = panel


## Rebuild the right-side unit panels entirely.
func _refresh_unit_panels() -> void:
	if not _unit_panel_vbox:
		return
	for child in _unit_panel_vbox.get_children():
		child.queue_free()

	# Header label
	var units_header := Label.new()
	units_header.text = "Party"
	units_header.add_theme_font_size_override("font_size", 14)
	units_header.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_unit_panel_vbox.add_child(units_header)

	for unit_res in GameManager.party:
		var unit := unit_res as UnitData
		if not unit or not unit.is_alive():
			continue
		_build_unit_row(unit)


func _build_unit_row(unit: UnitData) -> void:
	var root := PanelContainer.new()
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var rs := StyleBoxFlat.new()
	rs.bg_color = Color(0.06, 0.065, 0.09)
	rs.border_color = Color(COLOR_IRON_BORDER, 0.5)
	rs.set_border_width_all(1)
	rs.set_corner_radius_all(3)
	rs.content_margin_left = 10
	rs.content_margin_right = 10
	rs.content_margin_top = 8
	rs.content_margin_bottom = 8
	root.add_theme_stylebox_override("panel", rs)
	_unit_panel_vbox.add_child(root)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 5)
	root.add_child(vbox)

	# Unit name + class
	var name_lbl := Label.new()
	name_lbl.text = "%s  [%s]" % [unit.unit_name, unit.get_class_name()]
	name_lbl.add_theme_font_size_override("font_size", 13)
	name_lbl.add_theme_color_override("font_color", COLOR_PARCHMENT)
	vbox.add_child(name_lbl)

	# Equipped weapon slot
	var weapon_item := unit.equipped_weapon as ItemData if unit.equipped_weapon else null
	var weapon_label: String = "Weapon: %s" % (weapon_item.item_name if weapon_item else "None")
	if weapon_item:
		weapon_label = "Wep: %s" % weapon_item.item_name
	var weapon_btn := _make_slot_button(weapon_label, weapon_item != null)
	var captured_unit_w: UnitData = unit
	weapon_btn.pressed.connect(func(): _on_unit_weapon_slot_clicked(captured_unit_w))
	vbox.add_child(weapon_btn)



func _make_slot_button(label_text: String, has_item: bool) -> Button:
	var btn := Button.new()
	btn.text = label_text
	btn.custom_minimum_size = Vector2(0, 26)
	btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	btn.add_theme_font_size_override("font_size", 11)
	btn.add_theme_color_override("font_color", COLOR_PARCHMENT if has_item else COLOR_WORN_STONE)
	btn.add_theme_color_override("font_hover_color", COLOR_EMBER)
	btn.mouse_filter = Control.MOUSE_FILTER_STOP

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.09, 0.095, 0.12)
	normal.border_color = Color(COLOR_IRON_BORDER, 0.6)
	normal.set_border_width_all(1)
	normal.content_margin_left = 6
	normal.content_margin_right = 6
	normal.content_margin_top = 3
	normal.content_margin_bottom = 3
	btn.add_theme_stylebox_override("normal", normal)
	var hover := normal.duplicate()
	hover.bg_color = Color(0.12, 0.11, 0.09)
	hover.border_color = COLOR_EMBER
	btn.add_theme_stylebox_override("hover", hover)
	return btn


# ---------------------------------------------------------------------------
#  INTERACTION — GRID
# ---------------------------------------------------------------------------

func _on_grid_click() -> void:
	var mouse_pos: Vector2 = _grid_area.get_local_mouse_position()
	var col: int = int(mouse_pos.x / CELL_SIZE)
	var row: int = int(mouse_pos.y / CELL_SIZE)
	if col < 0 or col >= GRID_COLS or row < 0 or row >= GRID_ROWS:
		return

	if _held_item_index < 0:
		# Nothing held — check if we clicked on an item
		var ci: int = row * GRID_COLS + col
		var bag_idx: int = GameManager.bag_grid[ci]
		if bag_idx >= 0:
			_pick_up_from_bag(bag_idx)
		else:
			_clear_info()
	else:
		# Have a held item — try to place it here
		_try_place_held_at(col, row)


func _pick_up_from_bag(bag_idx: int) -> void:
	if bag_idx < 0 or bag_idx >= GameManager.bag_items.size():
		return
	var entry: Dictionary = GameManager.bag_items[bag_idx]
	var item: ItemData = entry["item"] as ItemData
	if not item:
		return

	# If already holding something different, drop it first (auto-snap)
	if _held_item_index >= 0 and _held_item_index != bag_idx:
		_snap_held_in_place()

	_held_item_index = bag_idx
	_held_source = "bag"
	_show_info(item)
	_held_label.text = "  [%s]" % item.item_name
	_held_label.visible = true
	_refresh_grid()


func _try_place_held_at(col: int, row: int) -> void:
	if _held_item_index < 0:
		return
	if col < 0 or row < 0 or col >= GRID_COLS or row >= GRID_ROWS:
		return

	var entry: Dictionary = GameManager.bag_items[_held_item_index]
	var item: ItemData = entry["item"] as ItemData
	var w: int = item.grid_width
	var h: int = item.grid_height

	if not GameManager.bag_can_place(col, row, w, h, _held_item_index):
		# Can't fit there — keep holding
		return

	# Clear old occupied cells
	var old_gx: int = entry["grid_x"]
	var old_gy: int = entry["grid_y"]
	for dy in h:
		for dx in w:
			var ci: int = (old_gy + dy) * GameManager.BAG_WIDTH + (old_gx + dx)
			if ci < GameManager.bag_grid.size() and GameManager.bag_grid[ci] == _held_item_index:
				GameManager.bag_grid[ci] = -1

	# Write new position
	entry["grid_x"] = col
	entry["grid_y"] = row
	for dy in h:
		for dx in w:
			GameManager.bag_grid[(row + dy) * GameManager.BAG_WIDTH + (col + dx)] = _held_item_index

	_cancel_hold()
	_refresh_grid()


## Leave the held item at its current grid position (no-op for bag source since entry is already valid).
func _snap_held_in_place() -> void:
	_cancel_hold()


# ---------------------------------------------------------------------------
#  INTERACTION — BAG ITEM CLICK
# ---------------------------------------------------------------------------

func _on_bag_item_clicked(bag_idx: int) -> void:
	if _held_item_index == bag_idx:
		# Click on the currently-held item → cancel hold
		_cancel_hold()
		return

	if _held_item_index >= 0:
		# Swap: drop held back in place, then pick up the clicked item
		_snap_held_in_place()
		_pick_up_from_bag(bag_idx)
		return

	# Nothing held: pick it up
	_pick_up_from_bag(bag_idx)


# ---------------------------------------------------------------------------
#  INTERACTION — UNIT SLOTS
# ---------------------------------------------------------------------------

func _on_unit_weapon_slot_clicked(unit: UnitData) -> void:
	if _held_item_index < 0:
		# Nothing held — unequip weapon to bag
		var weapon := unit.equipped_weapon as ItemData
		if not weapon:
			_show_info_text("Empty slot", "No weapon equipped.")
			return
		unit.equip_weapon(null)
		var placed := GameManager.bag_auto_place(weapon)
		if placed < 0:
			# Bag full — put it back
			unit.equip_weapon(weapon)
			_show_info_text("Bag is full!", "Cannot unequip — no room in bag.")
			return
		_pick_up_from_bag(placed)
		return

	# Holding an item — equip it
	var held_entry: Dictionary = GameManager.bag_items[_held_item_index]
	var held_item: ItemData = held_entry["item"] as ItemData

	if held_item.item_type != ItemData.ItemType.WEAPON:
		_show_info_text("Can't equip", "%s is not a weapon." % held_item.item_name)
		return

	var removed: ItemData = GameManager.bag_remove_item(_held_item_index)
	if not removed:
		return

	var old_weapon: ItemData = unit.equip_weapon(removed) as ItemData
	if old_weapon:
		var placed := GameManager.bag_auto_place(old_weapon)
		if placed == -1:
			push_warning("[GridInventoryUI] Bag full — old weapon dropped on equip")

	_cancel_hold()
	_refresh_grid()
	_refresh_unit_panels()


# ---------------------------------------------------------------------------
#  ORGANIZE
# ---------------------------------------------------------------------------

func _on_organize_pressed() -> void:
	if _held_item_index >= 0:
		_cancel_hold()
	GameManager.bag_auto_sort()
	_refresh_grid()
	_show_info_text("Organized", "Items repacked into available space.")


# ---------------------------------------------------------------------------
#  ITEM INFO
# ---------------------------------------------------------------------------

func _show_info(item: ItemData) -> void:
	if not item:
		_clear_info()
		return
	_info_name_label.text = item.item_name
	var detail := ""

	match item.item_type:
		ItemData.ItemType.WEAPON:
			detail = "%s  |  Might: %d" % [item.get_weapon_type_name(), item.might]
			if item.range_max > 1:
				detail += "  |  Range %d-%d" % [item.range_min, item.range_max]
		ItemData.ItemType.CONSUMABLE:
			if item.item_name == "Food Rations":
				detail = "Food — %d uses remaining" % item.current_uses
			elif item.heal_amount > 0:
				detail = "Restores %d HP" % item.heal_amount
			else:
				detail = item.description if item.description != "" else "Consumable"
			if not item.is_unbreakable:
				detail += "  |  Uses: %d/%d" % [item.current_uses, item.max_uses]
		_:
			detail = item.description if item.description != "" else "Key item"

	_info_detail_label.text = detail


func _show_info_text(title: String, detail: String) -> void:
	_info_name_label.text = title
	_info_detail_label.text = detail


func _clear_info() -> void:
	_info_name_label.text = "Select an item"
	_info_detail_label.text = ""


# ---------------------------------------------------------------------------
#  STATE MANAGEMENT
# ---------------------------------------------------------------------------

func _cancel_hold() -> void:
	_held_item_index = -1
	_held_source = ""
	_held_label.visible = false


# ---------------------------------------------------------------------------
#  INPUT
# ---------------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	# Right-click: cancel hold
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_RIGHT:
			if _held_item_index >= 0:
				_cancel_hold()
				_refresh_grid()
				get_viewport().set_input_as_handled()
				return

	# Escape: cancel hold, or close
	if event.is_action_pressed("ui_cancel"):
		if _held_item_index >= 0:
			_cancel_hold()
			_refresh_grid()
		else:
			_close()
		get_viewport().set_input_as_handled()
		return

	# Track held-label position with mouse
	if event is InputEventMouseMotion and _held_label and _held_label.visible:
		_held_label.position = get_viewport().get_mouse_position() + Vector2(12, -20)


# ---------------------------------------------------------------------------
#  CLOSE
# ---------------------------------------------------------------------------

func _close() -> void:
	closed.emit()
	queue_free()


# ---------------------------------------------------------------------------
#  HELPERS
# ---------------------------------------------------------------------------

func _get_item_color(item: ItemData) -> Color:
	if item.item_name == "Food Rations":
		return COLOR_CELL_FOOD
	match item.item_type:
		ItemData.ItemType.WEAPON:     return COLOR_CELL_WEAPON
		ItemData.ItemType.CONSUMABLE: return COLOR_CELL_CONSUMABLE
		_:                            return COLOR_CELL_EMPTY


## Shorten long item names to fit within a small cell.
func _short_name(s: String) -> String:
	if s.length() <= 9:
		return s
	var parts := s.split(" ")
	if parts.size() >= 2:
		return parts[0].substr(0, 5) + "\n" + parts[1].substr(0, 5)
	return s.substr(0, 8) + "."
