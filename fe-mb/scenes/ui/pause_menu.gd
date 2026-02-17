extends Control

signal resume_requested
signal exit_requested

@onready var resume_btn: Button = $Panel/VBox/ResumeBtn
@onready var save_btn: Button = $Panel/VBox/SaveBtn
@onready var load_btn: Button = $Panel/VBox/LoadBtn
@onready var party_btn: Button = $Panel/VBox/PartyBtn
@onready var exit_btn: Button = $Panel/VBox/ExitBtn
@onready var save_load_menu: Control = $SaveLoadMenu
@onready var party_screen: Control = $PartyScreen
@onready var settings_menu: Control = $SettingsMenu

func _ready() -> void:
	resume_btn.pressed.connect(_on_resume_pressed)
	save_btn.pressed.connect(_on_save_pressed)
	load_btn.pressed.connect(_on_load_pressed)
	party_btn.pressed.connect(_on_party_pressed)
	$Panel/VBox/SettingsBtn.pressed.connect(_on_settings_pressed)
	exit_btn.pressed.connect(_on_exit_pressed)
	
	save_load_menu.close_requested.connect(_on_save_menu_closed)
	save_load_menu.slot_selected.connect(_on_slot_selected)
	save_load_menu.hide()
	
	party_screen.close_requested.connect(_on_party_closed)
	party_screen.hide()
	
	settings_menu.close_requested.connect(_on_settings_closed)
	settings_menu.hide()
	
	hide()

func _input(event: InputEvent) -> void:
	if not visible:
		return
		
	if event.is_action_pressed("ui_cancel"):
		if save_load_menu.visible:
			save_load_menu.hide()
		elif party_screen.visible:
			party_screen.hide()
			$Panel.show() # Show buttons again
		elif settings_menu.visible:
			settings_menu.hide()
			$Panel.show()
		else:
			_on_resume_pressed()
			get_viewport().set_input_as_handled()

func open() -> void:
	show()
	get_tree().paused = true

func close() -> void:
	hide()
	get_tree().paused = false
	save_load_menu.hide()
	party_screen.hide()
	settings_menu.hide()

func _on_resume_pressed() -> void:
	resume_requested.emit()
	close()

func _on_save_pressed() -> void:
	save_load_menu.setup(true, "Save Progress")
	save_load_menu.show()

func _on_load_pressed() -> void:
	save_load_menu.setup(false, "Load Game")
	save_load_menu.show()

func _on_party_pressed() -> void:
	party_screen.setup()
	party_screen.show()
	$Panel.hide() # Hide buttons to clear view

func _on_party_closed() -> void:
	party_screen.hide()
	$Panel.show()

func _on_settings_pressed() -> void:
	settings_menu.setup()
	settings_menu.show()
	$Panel.hide()

func _on_settings_closed() -> void:
	settings_menu.hide()
	$Panel.show()

func _on_exit_pressed() -> void:
	close()
	exit_requested.emit()
	# Return to Main Menu
	SceneLoader.change_scene_to_file("res://scenes/ui/main_menu.tscn")

func _on_save_menu_closed() -> void:
	save_load_menu.hide()

func _on_slot_selected(slot_index: int) -> void:
	if save_load_menu.is_save_mode:
		print("[PauseMenu] Saving to slot %d..." % slot_index)
		GameManager.current_save_slot = slot_index
		SaveManager.save_game(slot_index)
		save_load_menu.hide()
	else:
		print("[PauseMenu] Loading from slot %d..." % slot_index)
		save_load_menu.hide()
		close()
		SaveManager.load_game(slot_index)
		GameManager.current_save_slot = slot_index
		GameManager.change_state(GameManager.GameState.OVERWORLD)
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
