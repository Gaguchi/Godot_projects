extends Node

## Audio Manager
## Handles Music (with cross-fading) and SFX (pooling).

# --- Configuration ---
const CROSSFADE_DURATION: float = 1.0
const SFX_POOL_SIZE: int = 16

# --- State ---
var _music_players: Array[AudioStreamPlayer] = []
var _sfx_players: Array[AudioStreamPlayer] = []
var _active_music_index: int = 0
var _next_sfx_index: int = 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS # Music plays during pause
	
	# Setup Music Players (2 for cross-fading)
	for i in range(2):
		var player = AudioStreamPlayer.new()
		player.bus = "Music"
		add_child(player)
		_music_players.append(player)
		
	# Setup SFX Pool
	for i in range(SFX_POOL_SIZE):
		var player = AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_sfx_players.append(player)

# --- Music ---

func play_music(stream: AudioStream, fade: float = CROSSFADE_DURATION) -> void:
	var current_player = _music_players[_active_music_index]
	
	# If same music is playing, do nothing
	if current_player.stream == stream and current_player.playing:
		return
		
	# Swap players
	var next_index = (_active_music_index + 1) % 2
	var next_player = _music_players[next_index]
	
	# Setup new track
	next_player.stream = stream
	next_player.volume_db = -80.0
	next_player.play()
	
	# Cross-fade
	var tween = create_tween()
	tween.set_parallel(true)
	
	# Fade out current
	if current_player.playing:
		tween.tween_property(current_player, "volume_db", -80.0, fade)
		tween.tween_callback(current_player.stop).set_delay(fade)
	
	# Fade in new
	tween.tween_property(next_player, "volume_db", 0.0, fade)
	
	_active_music_index = next_index

func stop_music(fade: float = CROSSFADE_DURATION) -> void:
	var current_player = _music_players[_active_music_index]
	if not current_player.playing:
		return
		
	var tween = create_tween()
	tween.tween_property(current_player, "volume_db", -80.0, fade)
	tween.tween_callback(current_player.stop).set_delay(fade)

# --- SFX ---

func play_sfx(stream: AudioStream, pitch_variance: float = 0.0) -> void:
	if not stream:
		return
		
	var player = _sfx_players[_next_sfx_index]
	
	# Interrupt if busy (Pool cycling)
	if player.playing:
		player.stop()
		
	player.stream = stream
	player.volume_db = 0.0 # Reset volume
	
	if pitch_variance > 0.0:
		player.pitch_scale = randf_range(1.0 - pitch_variance, 1.0 + pitch_variance)
	else:
		player.pitch_scale = 1.0
		
	player.play()
	
	# Cycle index
	_next_sfx_index = (_next_sfx_index + 1) % SFX_POOL_SIZE
