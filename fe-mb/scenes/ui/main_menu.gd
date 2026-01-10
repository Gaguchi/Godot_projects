extends Control

@onready var continue_btn: Button = $VBoxContainer/ContinueBtn
@onready var new_game_btn: Button = $VBoxContainer/NewGameBtn
@onready var exit_btn: Button = $VBoxContainer/ExitBtn
@onready var version_label: Label = $VersionLabel
@onready var save_load_menu: Control = $SaveLoadMenu

func _ready() -> void:
	# Update Load Game button text
	continue_btn.text = "Load Game"
	continue_btn.disabled = false
	
	new_game_btn.pressed.connect(_on_new_game_pressed)
	continue_btn.pressed.connect(_on_load_game_pressed)
	exit_btn.pressed.connect(_on_exit_pressed)
	
	# Connect to Save/Load Menu
	save_load_menu.close_requested.connect(_on_menu_closed)
	save_load_menu.slot_selected.connect(_on_slot_selected)
	save_load_menu.hide()
	
	# Simple version display
	version_label.text = "v0.1.0"

func _on_new_game_pressed() -> void:
	# Open menu in SAVE mode (to pick a slot to overwrite/start in)
	save_load_menu.setup(true, "Select Save Slot")
	save_load_menu.show()

func _on_load_game_pressed() -> void:
	save_load_menu.setup(false, "Select Run to Load")
	save_load_menu.show()

func _on_slot_selected(slot_index: int) -> void:
	if save_load_menu.is_save_mode:
		# NEW GAME Logic
		print("[MainMenu] Starting new game in Slot %d" % slot_index)
		GameManager.current_save_slot = slot_index
		GameManager.start_new_run()
		
		# Initial Save
		SaveManager.save_game(slot_index)
		
		# Proceed to World Map
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
	else:
		# LOAD GAME Logic
		print("[MainMenu] Loading game from Slot %d" % slot_index)
		if SaveManager.load_game(slot_index):
			GameManager.current_save_slot = slot_index
			SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
		else:
			print("[MainMenu] Load failed!")

func _on_menu_closed() -> void:
	save_load_menu.hide()

func _on_exit_pressed() -> void:
	get_tree().quit()
