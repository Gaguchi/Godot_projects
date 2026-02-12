extends CanvasLayer

@onready var gold_display = %GoldDisplay
@onready var supplies_display = %SuppliesDisplay
@onready var threat_bar = %ThreatBar
@onready var location_panel = %LocationInfoPanel

func _ready():
	# Connect to GameManager signals if available
	if GameManager.has_signal("resources_changed"):
		GameManager.resources_changed.connect(_update_resources)
	
	_update_resources()
	_update_resources()
	location_panel.hide()
	
	var inv_btn = find_child("InventoryBtn", true, false)
	if inv_btn:
		inv_btn.pressed.connect(_on_inventory_pressed)

func _on_inventory_pressed():
	if has_node("/root/SceneLoader"):
		get_node("/root/SceneLoader").change_scene_to_file("res://scenes/ui/inventory_screen.tscn", false)
	else:
		get_tree().change_scene_to_file("res://scenes/ui/inventory_screen.tscn")

func _update_resources():
	# Assuming GameManager has these properties
	if "gold" in GameManager:
		gold_display.update_value(GameManager.gold)
	if "supplies" in GameManager:
		supplies_display.update_value(GameManager.supplies)
	
func show_location_info(location: LocationData):
	location_panel.setup(location)
	location_panel.show()

func hide_location_info():
	location_panel.hide()

func update_threat(current: int, max_threat: int):
	threat_bar.max_value = max_threat
	threat_bar.value = current
