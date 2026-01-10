extends Control

@onready var continue_btn: Button = $VBoxContainer/ContinueBtn
@onready var new_game_btn: Button = $VBoxContainer/NewGameBtn
@onready var settings_btn: Button = $VBoxContainer/SettingsBtn
@onready var exit_btn: Button = $VBoxContainer/ExitBtn
@onready var version_label: Label = $VersionLabel
@onready var save_load_menu: Control = $SaveLoadMenu
@onready var settings_menu: Control = $SettingsMenu

func _ready() -> void:
	# Update Load Game button text
	continue_btn.text = "Load Game"
	continue_btn.disabled = false
	
	new_game_btn.pressed.connect(_on_new_game_pressed)
	continue_btn.pressed.connect(_on_load_game_pressed)
	settings_btn.pressed.connect(_on_settings_pressed)
	exit_btn.pressed.connect(_on_exit_pressed)
	
	# Connect to Save/Load Menu
	save_load_menu.close_requested.connect(_on_menu_closed)
	save_load_menu.slot_selected.connect(_on_slot_selected)
	save_load_menu.hide()
	
	settings_menu.close_requested.connect(_on_settings_closed)
	settings_menu.hide()
	
	# Simple version display
	version_label.text = "v0.1.0"

func _on_new_game_pressed() -> void:
	# Open menu in SAVE mode (to pick a slot to overwrite/start in)
	save_load_menu.setup(true, "Select Save Slot")
	save_load_menu.show()

func _on_load_game_pressed() -> void:
	save_load_menu.setup(false, "Select Run to Load")
	save_load_menu.show()

func _on_settings_pressed() -> void:
	settings_menu.setup()
	settings_menu.show()

func _on_settings_closed() -> void:
	settings_menu.hide()

func _on_slot_selected(slot_index: int) -> void:
	if save_load_menu.is_save_mode:
		# NEW GAME Logic
		print("[MainMenu] Starting new game in Slot %d" % slot_index)
		GameManager.current_save_slot = slot_index
		GameManager.current_save_slot = slot_index
		GameManager.start_new_run()
		GameManager.change_state(GameManager.GameState.OVERWORLD)
		
		# Initial Save
		SaveManager.save_game(slot_index)
		
		# Proceed to World Map
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
	else:
		# LOAD GAME Logic
		print("[MainMenu] Loading game from Slot %d" % slot_index)
		if SaveManager.load_game(slot_index):
			GameManager.current_save_slot = slot_index
			# The save data might have a state, but we usually load into WorldMap or Dungeon.
			# For now, let's detect where we are going based on SceneLoader logic?
			# Actually, loading usually dumps us into WorldMap or DungeonMap.
			# load_game deserializes state. We should trust the save data or explicit logic.
			# If we just change to WorldMap scene, we should set state to OVERWORLD manually to be safe?
			# Or rely on the scene's _ready()?
			# Let's set it to OVERWORLD as default for now if we are loading WorldMap.
			if GameManager.current_state == GameManager.GameState.MAIN_MENU:
				GameManager.change_state(GameManager.GameState.OVERWORLD)
			
			SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
		else:
			print("[MainMenu] Load failed!")

func _on_menu_closed() -> void:
	save_load_menu.hide()

func _on_exit_pressed() -> void:
	get_tree().quit()
