extends Control

signal close_requested
signal slot_selected(slot_index: int)

var is_save_mode: bool = true  # Just for UI text updating

@onready var title_label: Label = $Panel/VBox/TitleLabel
@onready var slots_container: VBoxContainer = $Panel/VBox/Slots
@onready var back_btn: Button = $Panel/VBox/BackBtn

func _ready() -> void:
	back_btn.pressed.connect(_on_back_pressed)
	# Initial refresh in case setup isn't called immediately
	_refresh_slots()

func setup(mode_save: bool, title_override: String = "") -> void:
	is_save_mode = mode_save
	if title_override != "":
		title_label.text = title_override
	else:
		title_label.text = "Save Game" if is_save_mode else "Load Game"
	_refresh_slots()

func _refresh_slots() -> void:
	for i in range(3):
		var slot_index = i + 1
		# Ensure we have children (in case scene structure changes, but for now it's hardcoded)
		if i >= slots_container.get_child_count():
			break
			
		var btn = slots_container.get_child(i) as Button
		var metadata = SaveManager.get_slot_metadata(slot_index)
		
		# Disconnect old signals to avoid dupes
		if btn.pressed.is_connected(_on_slot_pressed):
			btn.pressed.disconnect(_on_slot_pressed)
		
		btn.pressed.connect(_on_slot_pressed.bind(slot_index))
		
		if metadata.is_empty() or not metadata.get("exists", false):
			btn.text = "Slot %d: Empty" % slot_index
			# If loading, disable empty slots
			btn.disabled = not is_save_mode
		else:
			var info = "Slot %d\n%s\nFloor %d | Gold: %d" % [
				slot_index, 
				metadata.get("date", "Unknown"), 
				metadata.get("floor", 1), 
				metadata.get("gold", 0)
			]
			btn.text = info
			btn.disabled = false

func _on_slot_pressed(slot_index: int) -> void:
	slot_selected.emit(slot_index)

func _on_back_pressed() -> void:
	close_requested.emit()
	if visible:
		hide()
