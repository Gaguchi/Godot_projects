extends Control
## Battle UI Layout Showcase — v3
## Press 1-4 or click buttons to switch layouts.
## Uses proper Godot container hierarchy — no absolute positioning.

# ── Palette ──
const BG := Color(0.04, 0.045, 0.06, 0.95)
const BG2 := Color(0.025, 0.03, 0.045, 0.98)
const IRON := Color(0.20, 0.21, 0.26)
const EMBER := Color(0.69, 0.44, 0.25)
const PARCHMENT := Color(0.832, 0.812, 0.761)
const WORN := Color(0.478, 0.463, 0.439)
const MOSS := Color(0.353, 0.541, 0.353)
const BLOOD := Color(0.769, 0.267, 0.267)
const SKY := Color(0.353, 0.541, 0.671)
const PURPLE := Color(0.5, 0.3, 0.65)
const GRID_A := Color(0.07, 0.09, 0.055)
const GRID_B := Color(0.058, 0.076, 0.045)
const CARD_COLORS := {"Attack": BLOOD, "Skill": SKY, "Spell": PURPLE, "Item": MOSS}

# ── Mock Data ──
var mock_turn := [
	{"name": "Roy", "ini": "L", "team": "p", "color": EMBER, "active": true},
	{"name": "Bandit", "ini": "F", "team": "e", "color": BLOOD, "active": false},
	{"name": "Marcus", "ini": "K", "team": "p", "color": SKY, "active": false},
	{"name": "Rogue", "ini": "T", "team": "e", "color": Color(0.4, 0.4, 0.45), "active": false},
	{"name": "Lilina", "ini": "M", "team": "p", "color": PURPLE, "active": false},
	{"name": "Brigand", "ini": "F", "team": "e", "color": BLOOD, "active": false},
]
var mock_party := [
	{"name": "Roy", "cls": "LORD", "lv": 5, "hp": 28, "mhp": 32, "arm": 6, "marm": 8, "weapon": "Iron Sword", "atk": 8, "hit": 90, "color": EMBER, "active": true},
	{"name": "Marcus", "cls": "KNIGHT", "lv": 4, "hp": 35, "mhp": 40, "arm": 12, "marm": 14, "weapon": "Steel Lance", "atk": 11, "hit": 80, "color": SKY, "active": false},
	{"name": "Lilina", "cls": "MAGE", "lv": 3, "hp": 12, "mhp": 22, "arm": 0, "marm": 0, "weapon": "Fire Tome", "atk": 10, "hit": 85, "color": PURPLE, "active": false},
]
var mock_cards := [
	{"name": "Slash", "type": "Attack", "ap": 1, "desc": "Deal 8 physical damage.", "range": "1"},
	{"name": "Shield Bash", "type": "Attack", "ap": 2, "desc": "5 dmg, DEF-2 for 2 turns.", "range": "1"},
	{"name": "Heal", "type": "Skill", "ap": 1, "desc": "Restore 12 HP to ally.", "range": "1-2"},
	{"name": "Fireball", "type": "Spell", "ap": 2, "desc": "10 magic dmg, AOE r2.", "range": "1-3"},
	{"name": "Rally", "type": "Skill", "ap": 1, "desc": "+3 STR all allies.", "range": "Self"},
]
var mock_log := [
	{"t": "Roy plays Slash on Bandit -- 8 dmg", "c": SKY},
	{"t": "Bandit attacks Roy for 5 dmg", "c": BLOOD},
	{"t": "Marcus plays Shield Bash -- 5 dmg", "c": SKY},
	{"t": "Brigand attacks Marcus (armor)", "c": BLOOD},
	{"t": "Lilina plays Fireball -- 2 hit!", "c": PURPLE},
	{"t": "Rogue attacks Lilina for 7 dmg", "c": BLOOD},
	{"t": "Roy leveled up! STR+2 SPD+1", "c": EMBER},
	{"t": "Rogue was defeated!", "c": EMBER},
]
var mock_units := [
	{"x": 3, "y": 2, "color": EMBER, "ini": "L", "hp": 28, "mhp": 32, "team": "p"},
	{"x": 2, "y": 4, "color": SKY, "ini": "K", "hp": 35, "mhp": 40, "team": "p"},
	{"x": 4, "y": 5, "color": PURPLE, "ini": "M", "hp": 12, "mhp": 22, "team": "p"},
	{"x": 8, "y": 2, "color": BLOOD, "ini": "F", "hp": 17, "mhp": 25, "team": "e"},
	{"x": 9, "y": 4, "color": BLOOD, "ini": "F", "hp": 18, "mhp": 22, "team": "e"},
	{"x": 7, "y": 5, "color": Color(0.4, 0.4, 0.45), "ini": "T", "hp": 8, "mhp": 19, "team": "e"},
]

var _holder: Control
var _btns: Array[Button] = []
var _names := ["A: FE Classic", "B: Cinematic", "C: Command Bar", "D: Card Master"]


func _ready() -> void:
	anchors_preset = Control.PRESET_FULL_RECT

	var root := VBoxContainer.new()
	root.anchors_preset = Control.PRESET_FULL_RECT
	root.add_theme_constant_override("separation", 0)
	add_child(root)

	root.add_child(_build_switcher())

	_holder = VBoxContainer.new()
	_holder.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_holder.add_theme_constant_override("separation", 0)
	root.add_child(_holder)

	_switch_to(0)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1: _switch_to(0)
			KEY_2: _switch_to(1)
			KEY_3: _switch_to(2)
			KEY_4: _switch_to(3)


func _switch_to(idx: int) -> void:
	for c in _holder.get_children():
		_holder.remove_child(c)
		c.queue_free()
	var layout: Control
	match idx:
		0: layout = _layout_a()
		1: layout = _layout_b()
		2: layout = _layout_c()
		3: layout = _layout_d()
	layout.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_holder.add_child(layout)
	for i in _btns.size():
		_btns[i].add_theme_color_override("font_color", EMBER if i == idx else WORN)


func _build_switcher() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(_label("BATTLE UI", 11, WORN))

	_btns.clear()
	for i in _names.size():
		var b := Button.new()
		b.text = " %s [%d] " % [_names[i], i + 1]
		b.custom_minimum_size.y = 26
		b.add_theme_font_size_override("font_size", 11)
		b.add_theme_stylebox_override("normal", _sb(BG, IRON, 1))
		b.add_theme_stylebox_override("hover", _sb(BG, EMBER, 1))
		b.add_theme_color_override("font_color", WORN)
		b.add_theme_color_override("font_hover_color", PARCHMENT)
		var idx := i
		b.pressed.connect(func(): _switch_to(idx))
		h.add_child(b)
		_btns.append(b)

	p.add_child(h)
	return p


# ═══════════════════════════════════════════════════════════════
# LAYOUT A — FE Classic
# ═══════════════════════════════════════════════════════════════
# Thin sidebar left (party HP) | Battlefield | nothing right
# Turn order top-center
# Contextual unit info floats bottom-left of battlefield
# Log ticker floats bottom-right of battlefield
# Card strip at bottom

func _layout_a() -> VBoxContainer:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)

	# -- Top: turn order bar --
	col.add_child(_turn_bar_h())

	# -- Middle: sidebar + battlefield --
	var mid := HBoxContainer.new()
	mid.add_theme_constant_override("separation", 0)
	mid.size_flags_vertical = Control.SIZE_EXPAND_FILL

	# Sidebar
	var sidebar := _fe_sidebar()
	mid.add_child(sidebar)

	# Battlefield area (expandable, with floating overlays)
	var bf_wrap := _battlefield_wrap()

	# Floating: unit info bottom-left
	var info := _unit_info_compact()
	info.anchor_left = 0.0
	info.anchor_top = 1.0
	info.anchor_bottom = 1.0
	info.offset_left = 6
	info.offset_top = -140
	info.offset_bottom = -6
	bf_wrap.add_child(info)

	# Floating: log ticker bottom-right
	var ticker := _log_ticker(3)
	ticker.anchor_left = 1.0
	ticker.anchor_right = 1.0
	ticker.anchor_top = 1.0
	ticker.anchor_bottom = 1.0
	ticker.offset_right = -6
	ticker.offset_left = -380
	ticker.offset_top = -58
	ticker.offset_bottom = -6
	bf_wrap.add_child(ticker)

	# Floating: terrain badge
	var terr := _terrain_badge()
	terr.anchor_left = 0.0
	terr.anchor_top = 1.0
	terr.anchor_bottom = 1.0
	terr.offset_left = 6
	terr.offset_top = -170
	terr.offset_bottom = -146
	bf_wrap.add_child(terr)

	mid.add_child(bf_wrap)
	col.add_child(mid)

	# -- Bottom: card strip --
	col.add_child(_card_strip_sts())

	return col


# ═══════════════════════════════════════════════════════════════
# LAYOUT B — Cinematic
# ═══════════════════════════════════════════════════════════════
# NO side panels. Battlefield fills everything above cards.
# Active unit badge: top-left floating
# Turn order: vertical, top-right floating
# Last event: single line floating on battlefield
# Card strip: semi-transparent bottom

func _layout_b() -> VBoxContainer:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)

	# -- Battlefield: takes all space above cards --
	var bf_wrap := _battlefield_wrap()

	# Floating: active unit badge top-left
	var badge := _active_badge()
	badge.anchor_left = 0.0
	badge.anchor_top = 0.0
	badge.offset_left = 6
	badge.offset_top = 4
	bf_wrap.add_child(badge)

	# Floating: phase label top-center
	var phase := _label("PLAYER PHASE  --  Turn 3", 13, EMBER)
	phase.anchor_left = 0.5
	phase.anchor_right = 0.5
	phase.offset_left = -90
	phase.offset_right = 90
	phase.offset_top = 6
	phase.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bf_wrap.add_child(phase)

	# Floating: turn order vertical top-right
	var turn := _turn_bar_v()
	turn.anchor_left = 1.0
	turn.anchor_right = 1.0
	turn.anchor_top = 0.0
	turn.offset_right = -4
	turn.offset_left = -74
	turn.offset_top = 4
	bf_wrap.add_child(turn)

	# Floating: last event line bottom-left
	var last: Dictionary = mock_log[mock_log.size() - 1]
	var ev := _label(last.t, 12, Color(last.c.r, last.c.g, last.c.b, 0.7))
	ev.anchor_top = 1.0
	ev.anchor_bottom = 1.0
	ev.offset_left = 8
	ev.offset_top = -22
	ev.offset_bottom = -4
	bf_wrap.add_child(ev)

	bf_wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(bf_wrap)

	# -- Bottom: card strip (semi-transparent) --
	col.add_child(_card_strip_transparent())

	return col


# ═══════════════════════════════════════════════════════════════
# LAYOUT C — Command Bar
# ═══════════════════════════════════════════════════════════════
# Top bar: party portraits + turn order + phase (integrated strip)
# Bottom bar: active unit detail | cards | AP
# NO side panels. Full-width battlefield between bars.
# Log: toggle button floating on battlefield

func _layout_c() -> VBoxContainer:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)

	# -- Top: command bar --
	col.add_child(_cmd_top_bar())

	# -- Middle: battlefield with floating log toggle --
	var bf_wrap := _battlefield_wrap()

	var log_toggle := _log_toggle()
	log_toggle.anchor_left = 1.0
	log_toggle.anchor_right = 1.0
	log_toggle.anchor_top = 0.0
	log_toggle.offset_right = -6
	log_toggle.offset_left = -250
	log_toggle.offset_top = 4
	bf_wrap.add_child(log_toggle)

	bf_wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(bf_wrap)

	# -- Bottom: command bar with unit detail + cards --
	col.add_child(_cmd_bottom_bar())

	return col


# ═══════════════════════════════════════════════════════════════
# LAYOUT D — Card Master (Slay the Spire focused)
# ═══════════════════════════════════════════════════════════════
# Cards are BIGGER. Large AP orb. Draw/Discard piles visible.
# Compact top strip: unit portraits + turn pips
# NO side panels, NO log panel
# Enemy intents floating above enemies on grid
# Battlefield fills between strips

func _layout_d() -> VBoxContainer:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 0)

	# -- Top: compact portrait strip --
	col.add_child(_sts_top_strip())

	# -- Battlefield with enemy intents --
	var bf_wrap := _battlefield_wrap()

	# Floating: last 2 events bottom-left
	var ticker := _log_ticker(2)
	ticker.anchor_top = 1.0
	ticker.anchor_bottom = 1.0
	ticker.offset_left = 8
	ticker.offset_top = -40
	ticker.offset_bottom = -4
	bf_wrap.add_child(ticker)

	bf_wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(bf_wrap)

	# -- Bottom: premium card strip (bigger cards + orb) --
	col.add_child(_card_strip_premium())

	return col


# ═══════════════════════════════════════════════════════════════
# BATTLEFIELD (shared, draws into whatever size it gets)
# ═══════════════════════════════════════════════════════════════

func _battlefield_wrap() -> Control:
	# A Control that expands to fill, with grid drawn by child
	var bf := Control.new()
	bf.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bf.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bf.clip_contents = true

	var grid := _GridDrawer.new()
	grid.anchors_preset = Control.PRESET_FULL_RECT
	grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grid.units = mock_units
	bf.add_child(grid)

	return bf


# Inner class that draws the grid to fill whatever size it gets
class _GridDrawer extends Control:
	var units: Array = []

	func _draw() -> void:
		var sz := size
		var ts := 48.0
		var cols := int(sz.x / ts) + 1
		var rows := int(sz.y / ts) + 1

		# Checkerboard
		for r in rows:
			for c in cols:
				var col: Color = Color(0.07, 0.09, 0.055) if (r + c) % 2 == 0 else Color(0.058, 0.076, 0.045)
				draw_rect(Rect2(c * ts, r * ts, min(ts, sz.x - c * ts), min(ts, sz.y - r * ts)), col)

		# Grid lines
		var line_col := Color(0.16, 0.17, 0.20, 0.35)
		for c in range(1, cols):
			draw_line(Vector2(c * ts, 0), Vector2(c * ts, sz.y), line_col, 1.0)
		for r in range(1, rows):
			draw_line(Vector2(0, r * ts), Vector2(sz.x, r * ts), line_col, 1.0)

		# Movement highlights (blue around first player unit)
		var move_col := Color(0.353, 0.541, 0.671, 0.18)
		for off in [Vector2(2,2), Vector2(3,1), Vector2(4,2), Vector2(3,3), Vector2(2,3), Vector2(4,1), Vector2(2,1), Vector2(4,3)]:
			if off.x * ts < sz.x and off.y * ts < sz.y:
				draw_rect(Rect2(off * ts, Vector2(ts, ts)), move_col)

		# Attack range (red)
		var atk_col := Color(0.769, 0.267, 0.267, 0.14)
		for off in [Vector2(1,2), Vector2(5,2), Vector2(3,0), Vector2(3,4)]:
			if off.x * ts < sz.x and off.y * ts < sz.y:
				draw_rect(Rect2(off * ts, Vector2(ts, ts)), atk_col)

		# Units
		for u in units:
			var cx: float = u.x * ts + ts * 0.5
			var cy: float = u.y * ts + ts * 0.5
			if cx > sz.x or cy > sz.y:
				continue
			var rad := ts * 0.32

			# Circle
			draw_circle(Vector2(cx, cy), rad, u.color)
			var bright: Color = Color(u.color.r * 1.4, u.color.g * 1.4, u.color.b * 1.4).clamp()
			draw_arc(Vector2(cx, cy), rad, 0, TAU, 32, bright, 1.0)

			# Initial letter
			var font := ThemeDB.fallback_font
			var fsize := 13
			var text_sz := font.get_string_size(u.ini, HORIZONTAL_ALIGNMENT_CENTER, -1, fsize)
			draw_string(font, Vector2(cx - text_sz.x * 0.5, cy + text_sz.y * 0.25), u.ini, HORIZONTAL_ALIGNMENT_CENTER, -1, fsize, Color.WHITE)

			# HP bar below unit
			var bw := ts * 0.65
			var bh := 3.5
			var bx: float = cx - bw * 0.5
			var by: float = cy + rad + 3
			draw_rect(Rect2(bx, by, bw, bh), Color(0.1, 0.1, 0.1, 0.85))
			var ratio: float = float(u.hp) / float(u.mhp) if u.mhp > 0 else 0.0
			var hpc: Color
			if ratio > 0.5:
				hpc = Color(0.353, 0.541, 0.353)
			elif ratio > 0.25:
				hpc = Color(0.69, 0.44, 0.25)
			else:
				hpc = Color(0.769, 0.267, 0.267)
			draw_rect(Rect2(bx, by, bw * ratio, bh), hpc)

			# Enemy intent icons (above enemies)
			if u.team == "e":
				var intent_y: float = cy - rad - 14
				var intent_bg := Rect2(cx - 14, intent_y, 28, 14)
				draw_rect(intent_bg, Color(0, 0, 0, 0.55))
				draw_rect(intent_bg, Color(u.color.r, u.color.g, u.color.b, 0.6), false, 1.0)
				var itxt := "ATK" if u.hp > 10 else "DEF"
				var itsz := font.get_string_size(itxt, HORIZONTAL_ALIGNMENT_CENTER, -1, 9)
				draw_string(font, Vector2(cx - itsz.x * 0.5, intent_y + 11), itxt, HORIZONTAL_ALIGNMENT_CENTER, -1, 9, u.color)


# ═══════════════════════════════════════════════════════════════
# CARD STRIPS (3 variants)
# ═══════════════════════════════════════════════════════════════

# Standard Slay the Spire reading flow
func _card_strip_sts() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 200
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0, 0, true))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(_pile_icon("Draw", 7))
	h.add_child(_ap_orb(2, 3, 40))
	for c in mock_cards:
		h.add_child(_card(c, Vector2(126, 172)))
	h.add_child(_end_btn())
	h.add_child(_pile_icon("Disc", 0))

	p.add_child(h)
	return p


# Semi-transparent (Layout B)
func _card_strip_transparent() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 192
	p.add_theme_stylebox_override("panel", _sb(Color(BG2.r, BG2.g, BG2.b, 0.8), Color(IRON.r, IRON.g, IRON.b, 0.3), 0, 0, true))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(_pile_icon("Draw", 7))
	h.add_child(_ap_orb(2, 3, 36))
	for c in mock_cards:
		h.add_child(_card(c, Vector2(118, 158)))
	h.add_child(_end_btn())
	h.add_child(_pile_icon("Disc", 0))

	p.add_child(h)
	return p


# Premium (Layout D) — bigger cards
func _card_strip_premium() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 215
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0, 0, true))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(_pile_icon("Draw", 7))
	h.add_child(_ap_orb(2, 3, 48))
	for c in mock_cards:
		h.add_child(_card(c, Vector2(136, 182)))
	h.add_child(_end_btn())
	h.add_child(_pile_icon("Disc", 0))

	p.add_child(h)
	return p


# ═══════════════════════════════════════════════════════════════
# LAYOUT-SPECIFIC COMPONENTS
# ═══════════════════════════════════════════════════════════════

func _fe_sidebar() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.x = 130
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0, 0, false, 1))

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)

	for u in mock_party:
		var active: bool = u.get("active", false)
		var slot := VBoxContainer.new()
		slot.add_theme_constant_override("separation", 2)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 3)
		if active:
			row.add_child(_label(">", 13, EMBER))
		var nm := _label(u.name, 12, PARCHMENT if active else WORN)
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(nm)
		row.add_child(_label("Lv%d" % u.lv, 10, WORN))
		slot.add_child(row)

		slot.add_child(_hp_row(u.hp, u.mhp, 88, 6))
		slot.add_child(_label(u.weapon, 10, WORN))
		v.add_child(slot)

		var sep := ColorRect.new()
		sep.color = Color(IRON.r, IRON.g, IRON.b, 0.3)
		sep.custom_minimum_size.y = 1
		v.add_child(sep)

	p.add_child(v)
	return p


func _unit_info_compact() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(240, 128)
	p.add_theme_stylebox_override("panel", _sb(BG, IRON, 1, 3, true))

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)

	var u: Dictionary = mock_party[0]
	var hdr := HBoxContainer.new()
	hdr.add_theme_constant_override("separation", 8)
	hdr.add_child(_label(u.name, 16, PARCHMENT))
	hdr.add_child(_label("%s Lv%d" % [u.cls, u.lv], 11, WORN))
	v.add_child(hdr)
	v.add_child(_bar_labeled("HP", u.hp, u.mhp, _hpc(u.hp, u.mhp), 180))
	if u.marm > 0:
		v.add_child(_bar_labeled("ARM", u.arm, u.marm, SKY, 180))
	v.add_child(_label("%s  Atk %d  Hit %d%%" % [u.weapon, u.atk, u.hit], 11, WORN))

	p.add_child(v)
	return p


func _active_badge() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(Color(BG.r, BG.g, BG.b, 0.75), EMBER, 1, 3, true))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	h.add_child(_circle("L", EMBER, 22))
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 0)
	info.add_child(_label("Roy  Lv5", 12, PARCHMENT))
	info.add_child(_label("Iron Sword", 10, WORN))
	h.add_child(info)
	h.add_child(_hp_only(28, 32, 55, 5))

	p.add_child(h)
	return p


func _terrain_badge() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(BG, IRON, 1, 2))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	h.add_child(_label("Forest", 11, PARCHMENT))
	h.add_child(_label("DEF+2 AVO+15", 10, MOSS))
	p.add_child(h)
	return p


# ── Turn Order: Horizontal ──
func _turn_bar_h() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 38
	p.add_theme_stylebox_override("panel", _sb(BG, IRON, 0, 0, false, 1))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	h.alignment = BoxContainer.ALIGNMENT_CENTER

	for e in mock_turn:
		var active: bool = e.get("active", false)
		var tc: Color = SKY if e.team == "p" else BLOOD
		var slot := PanelContainer.new()
		slot.custom_minimum_size = Vector2(66 if active else 56, 26 if active else 22)
		var bc := EMBER if active else Color(IRON.r, IRON.g, IRON.b, 0.5)
		slot.add_theme_stylebox_override("panel", _sb(Color(tc.r * 0.1, tc.g * 0.1, tc.b * 0.1, 0.9), bc, 2 if active else 1, 3))

		var sh := HBoxContainer.new()
		sh.add_theme_constant_override("separation", 3)
		sh.alignment = BoxContainer.ALIGNMENT_CENTER
		sh.add_child(_circle(e.ini, e.color, 16 if not active else 18))
		sh.add_child(_label(e.name.left(4), 10 if not active else 11, PARCHMENT if active else WORN))
		slot.add_child(sh)
		h.add_child(slot)

	# Phase label at end
	var spacer := Control.new()
	spacer.custom_minimum_size.x = 16
	h.add_child(spacer)
	h.add_child(_label("PLAYER PHASE  Turn 3", 11, EMBER))

	p.add_child(h)
	return p


# ── Turn Order: Vertical ──
func _turn_bar_v() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(Color(BG.r, BG.g, BG.b, 0.65), Color(IRON.r, IRON.g, IRON.b, 0.3), 1, 3))

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)

	for e in mock_turn:
		var active: bool = e.get("active", false)
		var tc: Color = SKY if e.team == "p" else BLOOD
		var slot := PanelContainer.new()
		slot.custom_minimum_size = Vector2(60, 18)
		var bc := EMBER if active else Color(tc.r * 0.25, tc.g * 0.25, tc.b * 0.25, 0.5)
		slot.add_theme_stylebox_override("panel", _sb(Color(tc.r * 0.07, tc.g * 0.07, tc.b * 0.07, 0.8), bc, 1 if not active else 2, 2))
		var sl := _label("%s %s" % [e.ini, e.name.left(3)], 10, PARCHMENT if active else Color(tc.r, tc.g, tc.b, 0.6))
		sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		slot.add_child(sl)
		v.add_child(slot)

	p.add_child(v)
	return p


# ── Layout C: Command top bar ──
func _cmd_top_bar() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 50
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0, 0, false, 1))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	h.alignment = BoxContainer.ALIGNMENT_CENTER

	# Party portraits
	for u in mock_party:
		var active: bool = u.get("active", false)
		var slot := PanelContainer.new()
		slot.custom_minimum_size = Vector2(96, 36)
		slot.add_theme_stylebox_override("panel", _sb(Color(u.color.r * 0.08, u.color.g * 0.08, u.color.b * 0.08, 0.9), EMBER if active else Color(IRON.r, IRON.g, IRON.b, 0.5), 2 if active else 1, 3))
		var sh := HBoxContainer.new()
		sh.add_theme_constant_override("separation", 4)
		sh.add_child(_circle(u.cls.left(1), u.color, 22))
		var sv := VBoxContainer.new()
		sv.add_theme_constant_override("separation", 0)
		sv.add_child(_label(u.name, 11, PARCHMENT if active else WORN))
		sv.add_child(_hp_only(u.hp, u.mhp, 48, 4))
		sh.add_child(sv)
		slot.add_child(sh)
		h.add_child(slot)

	h.add_child(_vdiv(30))

	# Turn order inline
	h.add_child(_label("TURN:", 10, WORN))
	for e in mock_turn:
		var active: bool = e.get("active", false)
		var tc: Color = SKY if e.team == "p" else BLOOD
		var m := PanelContainer.new()
		m.custom_minimum_size = Vector2(26, 22)
		m.add_theme_stylebox_override("panel", _sb(Color(tc.r * 0.07, tc.g * 0.07, tc.b * 0.07, 0.9), EMBER if active else Color(tc.r * 0.25, tc.g * 0.25, tc.b * 0.25, 0.6), 1 if not active else 2, 2))
		var ml := _label(e.ini, 11, PARCHMENT if active else tc)
		ml.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		m.add_child(ml)
		h.add_child(m)

	h.add_child(_vdiv(30))

	var pv := VBoxContainer.new()
	pv.add_theme_constant_override("separation", 0)
	pv.add_child(_label("PLAYER PHASE", 13, EMBER))
	pv.add_child(_label("Turn 3", 10, WORN))
	h.add_child(pv)

	p.add_child(h)
	return p


# ── Layout C: Command bottom bar ──
func _cmd_bottom_bar() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 200
	p.add_theme_stylebox_override("panel", _sb(BG2, IRON, 0, 0, true))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)

	# Left: active unit detail
	var detail := VBoxContainer.new()
	detail.add_theme_constant_override("separation", 3)
	detail.custom_minimum_size.x = 165

	var u: Dictionary = mock_party[0]
	detail.add_child(_label(u.name, 16, EMBER))
	detail.add_child(_label("%s Lv%d" % [u.cls, u.lv], 10, WORN))
	detail.add_child(_bar_labeled("HP", u.hp, u.mhp, _hpc(u.hp, u.mhp), 130))
	if u.marm > 0:
		detail.add_child(_bar_labeled("ARM", u.arm, u.marm, SKY, 130))
	detail.add_child(_label("%s  Atk %d" % [u.weapon, u.atk], 11, WORN))
	var terrain_row := HBoxContainer.new()
	terrain_row.add_theme_constant_override("separation", 6)
	terrain_row.add_child(_label("Forest", 10, PARCHMENT))
	terrain_row.add_child(_label("DEF+2", 10, MOSS))
	detail.add_child(terrain_row)
	h.add_child(detail)

	h.add_child(_vdiv(175))

	# Center: cards
	var cards := HBoxContainer.new()
	cards.add_theme_constant_override("separation", 8)
	cards.alignment = BoxContainer.ALIGNMENT_CENTER
	cards.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cards.add_child(_pile_icon("Draw", 7))
	cards.add_child(_ap_orb(2, 3, 38))
	for c in mock_cards:
		cards.add_child(_card(c, Vector2(120, 168)))
	cards.add_child(_end_btn())
	cards.add_child(_pile_icon("Disc", 0))
	h.add_child(cards)

	p.add_child(h)
	return p


# ── Layout C: Log toggle ──
func _log_toggle() -> Control:
	var container := Control.new()
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var btn := Button.new()
	btn.text = "LOG"
	btn.custom_minimum_size = Vector2(52, 22)
	btn.add_theme_font_size_override("font_size", 10)
	btn.add_theme_stylebox_override("normal", _sb(Color(BG.r, BG.g, BG.b, 0.6), IRON, 1, 3))
	btn.add_theme_stylebox_override("hover", _sb(Color(BG.r, BG.g, BG.b, 0.85), EMBER, 1, 3))
	btn.add_theme_color_override("font_color", WORN)
	btn.add_theme_color_override("font_hover_color", EMBER)
	btn.position = Vector2(190, 0)
	container.add_child(btn)

	var log_p := _log_panel(Vector2(240, 200))
	log_p.position = Vector2(0, 26)
	log_p.visible = false
	container.add_child(log_p)

	btn.pressed.connect(func(): log_p.visible = not log_p.visible)
	return container


# ── Layout D: Compact top strip ──
func _sts_top_strip() -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size.y = 34
	p.add_theme_stylebox_override("panel", _sb(Color(BG2.r, BG2.g, BG2.b, 0.8), Color(IRON.r, IRON.g, IRON.b, 0.4), 0, 0))

	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)

	for u in mock_party:
		var active: bool = u.get("active", false)
		var uh := HBoxContainer.new()
		uh.add_theme_constant_override("separation", 4)
		uh.add_child(_circle(u.cls.left(1), u.color, 18))
		uh.add_child(_label(u.name, 11, PARCHMENT if active else WORN))
		uh.add_child(_hp_only(u.hp, u.mhp, 40, 4))
		h.add_child(uh)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(spacer)

	h.add_child(_label("TURN:", 10, WORN))
	for e in mock_turn:
		var active: bool = e.get("active", false)
		var tc: Color = SKY if e.team == "p" else BLOOD
		h.add_child(_circle(e.ini, PARCHMENT if active else tc, 20 if active else 16))

	h.add_child(_label("Turn 3", 11, EMBER))

	p.add_child(h)
	return p


# ═══════════════════════════════════════════════════════════════
# SHARED SMALL COMPONENTS
# ═══════════════════════════════════════════════════════════════

func _card(data: Dictionary, sz: Vector2) -> PanelContainer:
	var accent: Color = CARD_COLORS.get(data.type, WORN)
	var p := PanelContainer.new()
	p.custom_minimum_size = sz
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.03, 0.035, 0.05, 0.95)
	s.border_color = accent
	s.set_border_width_all(2)
	s.border_width_bottom = 3
	s.set_corner_radius_all(4)
	s.set_content_margin_all(6)
	s.shadow_color = Color(0, 0, 0, 0.35)
	s.shadow_size = 3
	s.shadow_offset = Vector2(0, 2)
	p.add_theme_stylebox_override("panel", s)

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)

	# Name + AP badge
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 3)
	var nm := _label(data.name, 12, PARCHMENT)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(nm)

	var ap := PanelContainer.new()
	ap.custom_minimum_size = Vector2(22, 16)
	ap.add_theme_stylebox_override("panel", _sb(Color(EMBER.r * 0.2, EMBER.g * 0.2, EMBER.b * 0.2, 0.9), EMBER, 1, 8))
	var apl := _label(str(data.ap), 10, EMBER)
	apl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ap.add_child(apl)
	top.add_child(ap)
	v.add_child(top)

	# Accent line
	var line := ColorRect.new()
	line.color = accent
	line.custom_minimum_size.y = 2
	v.add_child(line)

	# Type
	v.add_child(_label(data.type, 10, accent))

	# Description
	var desc := _label(data.desc, 10, WORN)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	desc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	desc.custom_minimum_size.y = 32
	v.add_child(desc)

	# Range
	v.add_child(_label("Range: %s" % data.range, 9, Color(WORN.r, WORN.g, WORN.b, 0.6)))

	p.add_child(v)
	return p


func _ap_orb(current: int, max_ap: int, orb_size: float) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.custom_minimum_size.x = orb_size + 4

	var orb := Panel.new()
	orb.custom_minimum_size = Vector2(orb_size, orb_size)
	var os := StyleBoxFlat.new()
	os.bg_color = Color(EMBER.r * 0.12, EMBER.g * 0.12, EMBER.b * 0.12, 0.95)
	os.border_color = EMBER
	os.set_border_width_all(2)
	os.set_corner_radius_all(int(orb_size / 2.0))
	os.shadow_color = Color(EMBER.r * 0.25, EMBER.g * 0.25, EMBER.b * 0.1, 0.3)
	os.shadow_size = 5
	orb.add_theme_stylebox_override("panel", os)

	var nl := _label("%d/%d" % [current, max_ap], 15, EMBER)
	nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	nl.anchors_preset = Control.PRESET_FULL_RECT
	nl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	orb.add_child(nl)
	v.add_child(orb)

	var al := _label("AP", 9, WORN)
	al.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(al)
	return v


func _pile_icon(text: String, count: int) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.custom_minimum_size.x = 34

	var icon := Panel.new()
	icon.custom_minimum_size = Vector2(30, 40)
	var is2 := StyleBoxFlat.new()
	is2.bg_color = Color(0.07, 0.065, 0.055, 0.9)
	is2.border_color = Color(IRON.r + 0.08, IRON.g + 0.08, IRON.b + 0.08)
	is2.set_border_width_all(1)
	is2.set_corner_radius_all(3)
	icon.add_theme_stylebox_override("panel", is2)
	var cl := _label(str(count), 13, PARCHMENT)
	cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	cl.anchors_preset = Control.PRESET_FULL_RECT
	cl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.add_child(cl)
	v.add_child(icon)

	var tl := _label(text, 9, WORN)
	tl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(tl)
	return v


func _end_btn() -> Button:
	var b := Button.new()
	b.text = "End Turn"
	b.custom_minimum_size = Vector2(84, 36)
	b.add_theme_font_size_override("font_size", 12)
	var ns := StyleBoxFlat.new()
	ns.bg_color = Color(0.06, 0.05, 0.03, 0.95)
	ns.border_color = EMBER
	ns.set_border_width_all(1)
	ns.border_width_bottom = 2
	ns.set_corner_radius_all(3)
	ns.set_content_margin_all(5)
	ns.shadow_color = Color(0, 0, 0, 0.25)
	ns.shadow_size = 2
	b.add_theme_stylebox_override("normal", ns)
	var hs := ns.duplicate()
	hs.bg_color = Color(0.09, 0.07, 0.045, 0.95)
	hs.set_border_width_all(2)
	b.add_theme_stylebox_override("hover", hs)
	b.add_theme_color_override("font_color", PARCHMENT)
	b.add_theme_color_override("font_hover_color", EMBER)
	return b


func _log_ticker(lines: int) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	var start: int = max(0, mock_log.size() - lines)
	for i in range(start, mock_log.size()):
		var entry: Dictionary = mock_log[i]
		v.add_child(_label(entry.t, 11, Color(entry.c.r, entry.c.g, entry.c.b, 0.7)))
	c.add_child(v)
	return c


func _log_panel(sz: Vector2) -> PanelContainer:
	var p := PanelContainer.new()
	p.custom_minimum_size = sz
	p.add_theme_stylebox_override("panel", _sb(BG, IRON, 1, 3, true))

	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	v.add_child(_label("COMBAT LOG", 10, WORN))
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(sz.x - 14, sz.y - 26)
	var sv := VBoxContainer.new()
	sv.add_theme_constant_override("separation", 2)
	sv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for entry in mock_log:
		var el := _label(entry.t, 11, entry.c)
		el.autowrap_mode = TextServer.AUTOWRAP_WORD
		sv.add_child(el)
	sc.add_child(sv)
	v.add_child(sc)

	p.add_child(v)
	return p


func _vdiv(height: float) -> ColorRect:
	var d := ColorRect.new()
	d.color = IRON
	d.custom_minimum_size = Vector2(1, height)
	return d


# ═══════════════════════════════════════════════════════════════
# PRIMITIVES
# ═══════════════════════════════════════════════════════════════

func _label(text: String, font_size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.45))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 1)
	return l


func _sb(bg_col: Color, border_col: Color, bw: int, corner: int = 3, shadow: bool = false, border_right: int = -1) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg_col
	s.border_color = border_col
	s.set_border_width_all(bw)
	s.set_corner_radius_all(corner)
	s.set_content_margin_all(6)
	if border_right >= 0:
		s.border_width_right = border_right
	if shadow:
		s.shadow_color = Color(0, 0, 0, 0.3)
		s.shadow_size = 3
		s.shadow_offset = Vector2(0, 2)
	return s


func _circle(ini: String, color: Color, sz: float) -> Panel:
	var p := Panel.new()
	p.custom_minimum_size = Vector2(sz, sz)
	var s := StyleBoxFlat.new()
	s.bg_color = color
	s.set_corner_radius_all(int(sz / 2.0))
	p.add_theme_stylebox_override("panel", s)
	var l := Label.new()
	l.text = ini
	l.add_theme_font_size_override("font_size", int(sz * 0.45))
	l.add_theme_color_override("font_color", Color.WHITE)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.anchors_preset = Control.PRESET_FULL_RECT
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(l)
	return p


func _hp_row(hp: int, mhp: int, w: float, h: float) -> HBoxContainer:
	var r := HBoxContainer.new()
	r.add_theme_constant_override("separation", 4)
	r.add_child(_hp_only(hp, mhp, w, h))
	r.add_child(_label("%d/%d" % [hp, mhp], 10, _hpc(hp, mhp)))
	return r


func _hp_only(hp: int, mhp: int, w: float, h: float) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(w, h)
	b.max_value = mhp
	b.value = hp
	b.show_percentage = false
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.12, 0.12, 0.12)
	bg.set_corner_radius_all(1)
	b.add_theme_stylebox_override("background", bg)
	var f := StyleBoxFlat.new()
	f.bg_color = _hpc(hp, mhp)
	f.set_corner_radius_all(1)
	b.add_theme_stylebox_override("fill", f)
	return b


func _bar_labeled(text: String, cur: int, mx: int, col: Color, w: float) -> HBoxContainer:
	var r := HBoxContainer.new()
	r.add_theme_constant_override("separation", 5)
	var l := _label(text, 10, WORN)
	l.custom_minimum_size.x = 26
	r.add_child(l)
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(w, 8)
	b.max_value = mx
	b.value = cur
	b.show_percentage = false
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.12, 0.12, 0.12)
	bg.set_corner_radius_all(1)
	b.add_theme_stylebox_override("background", bg)
	var f := StyleBoxFlat.new()
	f.bg_color = col
	f.set_corner_radius_all(1)
	b.add_theme_stylebox_override("fill", f)
	r.add_child(b)
	r.add_child(_label("%d/%d" % [cur, mx], 10, col))
	return r


func _hpc(hp: int, mhp: int) -> Color:
	if mhp <= 0: return BLOOD
	var r := float(hp) / float(mhp)
	if r > 0.5: return MOSS
	if r > 0.25: return EMBER
	return BLOOD
