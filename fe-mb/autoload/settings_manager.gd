extends Node

## SettingsManager
## Handles persistent user settings (Audio, Video, Gameplay)

const SETTINGS_PATH = "user://settings.cfg"

# Audio Buses
const BUS_MASTER = "Master"
const BUS_MUSIC = "Music"
const BUS_SFX = "SFX"

# Settings Data
var master_volume: float = 1.0
var music_volume: float = 1.0
var sfx_volume: float = 1.0
var window_mode: int = DisplayServer.WINDOW_MODE_WINDOWED
var vsync_enabled: bool = true

func _ready() -> void:
	load_settings()
	apply_settings()

func load_settings() -> void:
	var config = ConfigFile.new()
	var err = config.load(SETTINGS_PATH)
	
	if err != OK:
		print("[SettingsManager] No settings file found, using defaults.")
		return
		
	# Audio
	master_volume = config.get_value("Audio", "master_volume", 1.0)
	music_volume = config.get_value("Audio", "music_volume", 1.0)
	sfx_volume = config.get_value("Audio", "sfx_volume", 1.0)
	
	# Video
	window_mode = config.get_value("Video", "window_mode", DisplayServer.WINDOW_MODE_WINDOWED)
	vsync_enabled = config.get_value("Video", "vsync_enabled", true)
	
	print("[SettingsManager] Settings loaded successfully.")

func save_settings() -> void:
	var config = ConfigFile.new()
	
	# Audio
	config.set_value("Audio", "master_volume", master_volume)
	config.set_value("Audio", "music_volume", music_volume)
	config.set_value("Audio", "sfx_volume", sfx_volume)
	
	# Video
	config.set_value("Video", "window_mode", window_mode)
	config.set_value("Video", "vsync_enabled", vsync_enabled)
	
	config.save(SETTINGS_PATH)
	print("[SettingsManager] Settings saved.")

func apply_settings() -> void:
	_apply_audio_settings()
	_apply_video_settings()

func _apply_audio_settings() -> void:
	_set_bus_volume(BUS_MASTER, master_volume)
	_set_bus_volume(BUS_MUSIC, music_volume)
	_set_bus_volume(BUS_SFX, sfx_volume)

func _apply_video_settings() -> void:
	DisplayServer.window_set_mode(window_mode)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if vsync_enabled else DisplayServer.VSYNC_DISABLED)

func _set_bus_volume(bus_name: String, linear_value: float) -> void:
	var bus_index = AudioServer.get_bus_index(bus_name)
	if bus_index == -1:
		return
		
	var db_value = linear_to_db(path_safe_linear(linear_value))
	AudioServer.set_bus_volume_db(bus_index, db_value)
	AudioServer.set_bus_mute(bus_index, linear_value < 0.01)

# Helper to prevent -inf issues with 0 volume
func path_safe_linear(val: float) -> float:
	return max(val, 0.0001) if val > 0 else 0.0
