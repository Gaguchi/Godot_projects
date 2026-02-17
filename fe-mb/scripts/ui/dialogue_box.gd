class_name DialogueBox
extends CanvasLayer
## DialogueBox - Visual novel-style dialogue box UI.
## Built entirely programmatically. Stone & Steel color palette.

# --- Signals ---
signal advance_requested
signal choice_selected(index: int)

# --- Color Palette ---
const COLOR_PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const COLOR_IRON_BORDER := Color(0.227, 0.239, 0.282)
const COLOR_EMBER := Color(0.69, 0.44, 0.25)
const COLOR_PARCHMENT := Color(0.832, 0.812, 0.761)
const COLOR_WORN_STONE := Color(0.478, 0.463, 0.439)
const COLOR_CHOICE_BG := Color(0.08, 0.085, 0.11, 0.95)

# --- Typewriter ---
const TYPEWRITER_SPEED: float = 0.03  # Seconds per character

# --- Node References ---
var _panel: PanelContainer
var _portrait_rect: TextureRect
var _speaker_label: Label
var _text_label: RichTextLabel
var _choices_container: VBoxContainer
var _continue_indicator: Label

# --- State ---
var _is_typing: bool = false
var _typewriter_timer: Timer
var _full_text: String = ""
var _char_index: int = 0
var _blink_timer: Timer
var _blink_visible: bool = true


func _ready() -> void:
	layer = 20
	_build_ui()
	_setup_timers()


func _build_ui() -> void:
	# --- Panel Container (bottom 200px, full width) ---
	_panel = PanelContainer.new()
	_panel.name = "DialoguePanel"

	# Anchor to bottom of screen
	_panel.anchor_left = 0.0
	_panel.anchor_right = 1.0
	_panel.anchor_top = 1.0
	_panel.anchor_bottom = 1.0
	_panel.offset_top = -200
	_panel.offset_bottom = 0
	_panel.offset_left = 0
	_panel.offset_right = 0

	# Style: stone dark background with iron border on top
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = COLOR_PANEL_BG
	panel_style.border_color = COLOR_IRON_BORDER
	panel_style.border_width_top = 2
	panel_style.border_width_bottom = 0
	panel_style.border_width_left = 0
	panel_style.border_width_right = 0
	_panel.add_theme_stylebox_override("panel", panel_style)

	add_child(_panel)

	# --- Margin Container ---
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	_panel.add_child(margin)

	# --- HBoxContainer (portrait + text) ---
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 12)
	margin.add_child(hbox)

	# --- Portrait (hidden by default) ---
	_portrait_rect = TextureRect.new()
	_portrait_rect.name = "Portrait"
	_portrait_rect.custom_minimum_size = Vector2(128, 128)
	_portrait_rect.expand_mode = TextureRect.EXPAND_KEEP_SIZE
	_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_portrait_rect.visible = false
	hbox.add_child(_portrait_rect)

	# --- VBoxContainer (speaker, text, choices, continue) ---
	var vbox := VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 6)
	hbox.add_child(vbox)

	# --- Speaker Label ---
	_speaker_label = Label.new()
	_speaker_label.name = "SpeakerLabel"
	_speaker_label.add_theme_font_size_override("font_size", 14)
	_speaker_label.add_theme_color_override("font_color", COLOR_EMBER)
	vbox.add_child(_speaker_label)

	# --- Text Label (RichTextLabel for typewriter) ---
	_text_label = RichTextLabel.new()
	_text_label.name = "TextLabel"
	_text_label.bbcode_enabled = false
	_text_label.fit_content = true
	_text_label.scroll_active = false
	_text_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_text_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_text_label.add_theme_font_size_override("normal_font_size", 13)
	_text_label.add_theme_color_override("default_color", COLOR_PARCHMENT)
	vbox.add_child(_text_label)

	# --- Choices Container (hidden until choices) ---
	_choices_container = VBoxContainer.new()
	_choices_container.name = "ChoicesContainer"
	_choices_container.add_theme_constant_override("separation", 4)
	_choices_container.visible = false
	vbox.add_child(_choices_container)

	# --- Continue Indicator ---
	_continue_indicator = Label.new()
	_continue_indicator.name = "ContinueIndicator"
	_continue_indicator.text = "  ▼"
	_continue_indicator.add_theme_font_size_override("font_size", 12)
	_continue_indicator.add_theme_color_override("font_color", COLOR_WORN_STONE)
	_continue_indicator.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_continue_indicator.visible = false
	vbox.add_child(_continue_indicator)


func _setup_timers() -> void:
	# Typewriter timer
	_typewriter_timer = Timer.new()
	_typewriter_timer.wait_time = TYPEWRITER_SPEED
	_typewriter_timer.one_shot = false
	_typewriter_timer.timeout.connect(_on_typewriter_tick)
	add_child(_typewriter_timer)

	# Blink timer for continue indicator
	_blink_timer = Timer.new()
	_blink_timer.wait_time = 0.5
	_blink_timer.one_shot = false
	_blink_timer.timeout.connect(_on_blink_tick)
	add_child(_blink_timer)
	_blink_timer.start()


# =============================================================================
# Input Handling
# =============================================================================

func _input(event: InputEvent) -> void:
	if not _panel.visible:
		return

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_handle_advance()
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_SPACE or event.keycode == KEY_ENTER:
			_handle_advance()


func _handle_advance() -> void:
	if _is_typing:
		# Skip typewriter, show all text immediately
		_finish_typing()
		get_viewport().set_input_as_handled()
	elif not _choices_container.visible or _choices_container.get_child_count() == 0:
		# No choices visible, advance dialogue
		advance_requested.emit()
		get_viewport().set_input_as_handled()
	# When choices are visible, do NOT consume the event — let buttons receive it


# =============================================================================
# Public Methods
# =============================================================================

## Show a dialogue line with speaker name and text (typewriter effect)
func show_line(speaker: String, text: String, portrait: String) -> void:
	# Set speaker
	if speaker == "" or speaker == "Narrator":
		_speaker_label.text = ""
		_speaker_label.visible = false
	else:
		_speaker_label.text = speaker
		_speaker_label.visible = true

	# Portrait — only load if it's a valid resource path
	if portrait != "" and portrait.begins_with("res://"):
		var tex := load(portrait)
		if tex:
			_portrait_rect.texture = tex
			_portrait_rect.visible = true
		else:
			_portrait_rect.visible = false
	else:
		_portrait_rect.visible = false

	# Hide choices and continue indicator
	_choices_container.visible = false
	_continue_indicator.visible = false

	# Start typewriter
	_start_typewriter(text)


## Show choice buttons
func show_choices(choices: Array) -> void:
	# Clear old choice buttons
	for child in _choices_container.get_children():
		child.queue_free()

	# Wait a frame for queue_free to process before adding new children
	await get_tree().process_frame

	for i in range(choices.size()):
		var choice: Dictionary = choices[i]
		var btn := Button.new()
		btn.text = "  %s" % choice.get("text", "...")
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT

		# Style the button
		btn.add_theme_font_size_override("font_size", 13)
		btn.add_theme_color_override("font_color", COLOR_PARCHMENT)
		btn.add_theme_color_override("font_hover_color", COLOR_EMBER)

		# Normal style
		var normal_style := StyleBoxFlat.new()
		normal_style.bg_color = COLOR_CHOICE_BG
		normal_style.border_color = COLOR_IRON_BORDER
		normal_style.border_width_top = 1
		normal_style.border_width_bottom = 1
		normal_style.border_width_left = 1
		normal_style.border_width_right = 1
		normal_style.content_margin_left = 6
		normal_style.content_margin_top = 4
		normal_style.content_margin_bottom = 4
		normal_style.corner_radius_top_left = 2
		normal_style.corner_radius_top_right = 2
		normal_style.corner_radius_bottom_left = 2
		normal_style.corner_radius_bottom_right = 2
		btn.add_theme_stylebox_override("normal", normal_style)

		# Hover style
		var hover_style := normal_style.duplicate()
		hover_style.border_color = COLOR_EMBER
		btn.add_theme_stylebox_override("hover", hover_style)

		# Pressed style
		var pressed_style := normal_style.duplicate()
		pressed_style.bg_color = Color(0.1, 0.1, 0.14, 0.95)
		pressed_style.border_color = COLOR_EMBER
		btn.add_theme_stylebox_override("pressed", pressed_style)

		# Focus style (same as hover for keyboard navigation)
		var focus_style := hover_style.duplicate()
		btn.add_theme_stylebox_override("focus", focus_style)

		# Connect signal with index capture
		var idx := i
		btn.pressed.connect(func() -> void: _on_choice_button_pressed(idx))

		_choices_container.add_child(btn)

	_choices_container.visible = true
	_continue_indicator.visible = false


## Hide choice buttons
func hide_choices() -> void:
	for child in _choices_container.get_children():
		child.queue_free()
	_choices_container.visible = false


## Close and free this dialogue box
func close() -> void:
	_typewriter_timer.stop()
	_blink_timer.stop()
	queue_free()


# =============================================================================
# Typewriter
# =============================================================================

func _start_typewriter(text: String) -> void:
	_full_text = text
	_char_index = 0
	_is_typing = true
	_text_label.text = _full_text
	_text_label.visible_characters = 0
	_typewriter_timer.start()


func _finish_typing() -> void:
	_is_typing = false
	_typewriter_timer.stop()
	_text_label.visible_characters = -1  # Show all
	_continue_indicator.visible = not _choices_container.visible
	_blink_visible = true
	_continue_indicator.modulate.a = 1.0


func _on_typewriter_tick() -> void:
	_char_index += 1
	_text_label.visible_characters = _char_index

	if _char_index >= _full_text.length():
		_finish_typing()


# =============================================================================
# Blink
# =============================================================================

func _on_blink_tick() -> void:
	if _continue_indicator.visible:
		_blink_visible = not _blink_visible
		_continue_indicator.modulate.a = 1.0 if _blink_visible else 0.0


# =============================================================================
# Choice callbacks
# =============================================================================

func _on_choice_button_pressed(index: int) -> void:
	get_viewport().set_input_as_handled()
	choice_selected.emit(index)
