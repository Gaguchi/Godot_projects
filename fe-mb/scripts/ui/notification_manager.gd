extends CanvasLayer
class_name NotificationManagerClass
## NotificationManager - Global toast notification system
## Connects to EventBus.show_notification and displays sliding toasts.

const MAX_VISIBLE: int = 3
const TOAST_HOLD_TIME: float = 3.0
const TOAST_SLIDE_IN: float = 0.3
const TOAST_FADE_OUT: float = 0.5
const TOAST_WIDTH: float = 320.0
const TOAST_MARGIN: float = 12.0
const TOAST_SPACING: float = 6.0

# Stone & Steel palette
const PANEL_BG := Color(0.05, 0.055, 0.08, 0.95)
const IRON_BORDER := Color(0.227, 0.239, 0.282, 0.9)
const PARCHMENT := Color(0.832, 0.812, 0.761)
const WORN_STONE := Color(0.478, 0.463, 0.439)
const EMBER := Color(0.69, 0.44, 0.25)
const MOSS := Color(0.353, 0.541, 0.353)
const BLOOD := Color(0.769, 0.267, 0.267)

var _active_toasts: Array[Control] = []
var _toast_container: VBoxContainer


func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS

	# Container anchored to top-right
	var margin = MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	margin.set_anchor_and_offset(SIDE_LEFT, 1.0, -(TOAST_WIDTH + TOAST_MARGIN))
	margin.set_anchor_and_offset(SIDE_RIGHT, 1.0, -TOAST_MARGIN)
	margin.set_anchor_and_offset(SIDE_TOP, 0.0, TOAST_MARGIN)
	margin.set_anchor_and_offset(SIDE_BOTTOM, 1.0, 0)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(margin)

	_toast_container = VBoxContainer.new()
	_toast_container.alignment = BoxContainer.ALIGNMENT_BEGIN
	_toast_container.add_theme_constant_override("separation", int(TOAST_SPACING))
	_toast_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(_toast_container)

	# Connect to EventBus
	if EventBus:
		EventBus.show_notification.connect(_on_show_notification)

	print("[NotificationManager] Initialized")


func _on_show_notification(message: String) -> void:
	show_toast(message)


## Show a toast notification. Accent color is auto-detected from message content.
func show_toast(message: String, accent_override: Color = Color.TRANSPARENT) -> void:
	var accent_color := _detect_accent(message) if accent_override == Color.TRANSPARENT else accent_override

	var toast := _create_toast(message, accent_color)
	_toast_container.add_child(toast)
	_active_toasts.append(toast)

	# Remove oldest if over limit
	while _active_toasts.size() > MAX_VISIBLE:
		var oldest = _active_toasts.pop_front()
		if is_instance_valid(oldest):
			var fade = create_tween()
			fade.tween_property(oldest, "modulate:a", 0.0, 0.1)
			fade.tween_callback(oldest.queue_free)

	# Animate slide-in from right
	toast.modulate = Color(1, 1, 1, 0)
	toast.position.x = 40
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(toast, "modulate:a", 1.0, TOAST_SLIDE_IN).set_ease(Tween.EASE_OUT)
	tween.tween_property(toast, "position:x", 0.0, TOAST_SLIDE_IN).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)

	# Hold then fade out
	await get_tree().create_timer(TOAST_HOLD_TIME).timeout
	if not is_instance_valid(toast):
		return

	var fade_tween := create_tween()
	fade_tween.set_parallel(true)
	fade_tween.tween_property(toast, "modulate:a", 0.0, TOAST_FADE_OUT)
	fade_tween.tween_property(toast, "position:x", 30.0, TOAST_FADE_OUT).set_trans(Tween.TRANS_CUBIC)
	await fade_tween.finished

	if is_instance_valid(toast):
		_active_toasts.erase(toast)
		toast.queue_free()


func _create_toast(message: String, accent_color: Color) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(TOAST_WIDTH, 0)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Stone panel style
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL_BG
	style.border_color = IRON_BORDER
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 8
	style.content_margin_bottom = 8

	# Accent bar on left edge
	if accent_color != Color.TRANSPARENT:
		style.border_width_left = 3
		style.border_color = IRON_BORDER
		# We'll draw the accent via a child instead for per-edge control

	panel.add_theme_stylebox_override("panel", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 8)
	hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Accent bar (thin colored strip on left)
	if accent_color != Color.TRANSPARENT:
		var bar := ColorRect.new()
		bar.custom_minimum_size = Vector2(3, 0)
		bar.size_flags_vertical = Control.SIZE_EXPAND_FILL
		bar.color = accent_color
		bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		hbox.add_child(bar)

	# Message label
	var label := Label.new()
	label.text = message
	label.add_theme_font_size_override("font_size", 14)
	label.add_theme_color_override("font_color", PARCHMENT)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(label)

	panel.add_child(hbox)
	return panel


## Auto-detect accent color from message content
func _detect_accent(message: String) -> Color:
	var lower = message.to_lower()

	# Positive events
	if "gold" in lower or "found" in lower or "earned" in lower or "reward" in lower:
		return EMBER
	if "heal" in lower or "rest" in lower or "recover" in lower or "welcome" in lower:
		return MOSS
	# Negative events
	if "ambush" in lower or "damage" in lower or "defeat" in lower or "lost" in lower \
		or "died" in lower or "fell" in lower:
		return BLOOD

	return IRON_BORDER
