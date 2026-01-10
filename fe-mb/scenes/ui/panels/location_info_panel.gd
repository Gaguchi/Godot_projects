extends PanelContainer

signal travel_requested(location)

@onready var title_label: Label = %TitleLabel
@onready var desc_label: Label = %DescriptionLabel
@onready var travel_btn: Button = %TravelButton

var _current_location: LocationData

func _ready():
	travel_btn.pressed.connect(func(): travel_requested.emit(_current_location))

func setup(location: LocationData):
	_current_location = location
	title_label.text = location.location_name
	desc_label.text = _get_description(location.type)
	
	# Logic to disable button if already there or unreachable could go here
	
func _get_description(type: int) -> String:
	match type:
		LocationData.LocationType.TOWN: return "A safe haven to rest and trade."
		LocationData.LocationType.BATTLE: return "Enemy forces detected ahead."
		LocationData.LocationType.EVENT: return "Unknown anomaly."
		LocationData.LocationType.CAMP: return "A quiet spot to recover."
		LocationData.LocationType.DUNGEON: return "A dangerous dungeon entrance."
		LocationData.LocationType.EXIT: return "Gateway to the next region."
		_: return "Unknown location."
