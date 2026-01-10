extends Control

signal close_requested

@onready var master_slider: HSlider = $Panel/TabContainer/Audio/VBox/MasterRow/HSlider
@onready var music_slider: HSlider = $Panel/TabContainer/Audio/VBox/MusicRow/HSlider
@onready var sfx_slider: HSlider = $Panel/TabContainer/Audio/VBox/SFXRow/HSlider

@onready var window_mode_opt: OptionButton = $Panel/TabContainer/Video/VBox/WindowModeRow/OptionButton
@onready var vsync_check: CheckBox = $Panel/TabContainer/Video/VBox/VSyncRow/CheckBox

func _ready() -> void:
	$Panel/CloseBtn.pressed.connect(_on_close_pressed)
	
	# Connect Audio
	master_slider.value_changed.connect(_on_master_changed)
	music_slider.value_changed.connect(_on_music_changed)
	sfx_slider.value_changed.connect(_on_sfx_changed)
	
	# Connect Video
	window_mode_opt.item_selected.connect(_on_window_mode_selected)
	vsync_check.toggled.connect(_on_vsync_toggled)
	
	# Populate Options
	_populate_video_options()

func setup() -> void:
	# Load current values from SettingsManager
	master_slider.value = SettingsManager.master_volume
	music_slider.value = SettingsManager.music_volume
	sfx_slider.value = SettingsManager.sfx_volume
	
	# Set Video UI state
	# Iterate options to find matching ID
	for i in range(window_mode_opt.item_count):
		if window_mode_opt.get_item_id(i) == SettingsManager.window_mode:
			window_mode_opt.selected = i
			break
			
	vsync_check.button_pressed = SettingsManager.vsync_enabled

func _populate_video_options() -> void:
	window_mode_opt.clear()
	window_mode_opt.add_item("Windowed", DisplayServer.WINDOW_MODE_WINDOWED)
	window_mode_opt.add_item("Fullscreen", DisplayServer.WINDOW_MODE_FULLSCREEN)
	window_mode_opt.add_item("Exclusive Fullscreen", DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)

func _on_master_changed(value: float) -> void:
	SettingsManager.master_volume = value
	SettingsManager.apply_settings()

func _on_music_changed(value: float) -> void:
	SettingsManager.music_volume = value
	SettingsManager.apply_settings()

func _on_sfx_changed(value: float) -> void:
	SettingsManager.sfx_volume = value
	SettingsManager.apply_settings()

func _on_window_mode_selected(index: int) -> void:
	var mode = window_mode_opt.get_item_id(index)
	SettingsManager.window_mode = mode
	SettingsManager.apply_settings()

func _on_vsync_toggled(toggled: bool) -> void:
	SettingsManager.vsync_enabled = toggled
	SettingsManager.apply_settings()

func _on_close_pressed() -> void:
	SettingsManager.save_settings() # Save on close
	close_requested.emit()
