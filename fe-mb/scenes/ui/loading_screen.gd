extends CanvasLayer

@onready var progress_bar: ProgressBar = $Control/VBoxContainer/ProgressBar
@onready var label: Label = $Control/VBoxContainer/Label
@onready var message_label: Label = $Control/VBoxContainer/MessageLabel

var messages: Array[String] = [
	"Sharpening Swords...",
	"Brewing Potions...",
	"Scouting Dungeons...",
	"Consulting the Map...",
	"Rallying the Troops...",
	"Calculating Hit Rates...",
	"Feeding the Horses...",
	"Polishing Armor..."
]

func _ready() -> void:
	message_label.text = messages.pick_random()
	progress_bar.value = 0.0

func update_progress(current_progress: float) -> void:
	var tween = create_tween()
	tween.tween_property(progress_bar, "value", current_progress * 100, 0.1)
