extends Node

## SceneLoader
## Handles threaded loading of scenes with a loading screen.

const LOADING_SCREEN_SCENE = "res://scenes/ui/loading_screen.tscn"

var _current_loading_path: String = ""
var _loading_screen_instance: Node = null
var _progress: Array = []
var _is_loading: bool = false

func change_scene_to_file(path: String) -> void:
	if _is_loading:
		printerr("[SceneLoader] Already loading a scene!")
		return
		
	print("[SceneLoader] Starting load: %s" % path)
	_current_loading_path = path
	
	# Load Loading Screen
	_loading_screen_instance = load(LOADING_SCREEN_SCENE).instantiate()
	get_tree().root.add_child(_loading_screen_instance)
	
	# Request threaded load
	var error = ResourceLoader.load_threaded_request(path)
	if error != OK:
		printerr("[SceneLoader] Failed to start threaded load: %s" % error)
		_cleanup()
		return
		
	_is_loading = true
	set_process(true)

func _process(_delta: float) -> void:
	if not _is_loading:
		set_process(false)
		return
		
	var status = ResourceLoader.load_threaded_get_status(_current_loading_path, _progress)
	
	# Update progress bar if loading screen exists
	if _loading_screen_instance and _loading_screen_instance.has_method("update_progress"):
		_loading_screen_instance.update_progress(_progress[0])
	
	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			# Still working
			pass
		ResourceLoader.THREAD_LOAD_LOADED:
			_finish_loading()
		ResourceLoader.THREAD_LOAD_FAILED:
			printerr("[SceneLoader] Load failed for %s" % _current_loading_path)
			_cleanup()
		ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			printerr("[SceneLoader] Invalid resource: %s" % _current_loading_path)
			_cleanup()

func _finish_loading() -> void:
	print("[SceneLoader] Load complete. Swapping scenes.")
	
	var new_scene_resource = ResourceLoader.load_threaded_get(_current_loading_path)
	if new_scene_resource:
		var result = get_tree().change_scene_to_packed(new_scene_resource)
		if result != OK:
			printerr("[SceneLoader] Failed to change scene to packed resource.")
	
	_cleanup()

func _cleanup() -> void:
	_is_loading = false
	_current_loading_path = ""
	set_process(false)
	
	# Wait a tiny bit to show 100% progress before removing screen
	await get_tree().create_timer(0.2).timeout
	
	if _loading_screen_instance:
		_loading_screen_instance.queue_free()
		_loading_screen_instance = null
