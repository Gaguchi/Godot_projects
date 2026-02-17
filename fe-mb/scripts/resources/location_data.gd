extends Resource
class_name LocationData
## LocationData - Data for a single location on the world map

enum LocationType {
	TOWN,       # Shop, recruit, rest
	CAMP,       # Rest and heal
	DUNGEON,    # Enter dungeon (Slay the Spire style)
	EXIT,       # Exit to next region
	QUEST       # Dynamic quest objective (battle, event)
}

@export var id: int = 0
@export var location_name: String = "Unknown"
@export var location_type: LocationType = LocationType.CAMP
@export var position: Vector2 = Vector2.ZERO
@export var connected_locations: Array[int] = []  # IDs of connected locations
@export var visited: bool = false
@export var revealed: bool = false  # Can player see what type it is?
@export var threat_level: int = 0  # 0 = safe, higher = more dangerous

# Battle-specific data
@export var enemy_party_size: int = 2
@export var enemy_level: int = 1

# Event-specific data
@export var event_id: String = ""


## Get icon for this location type
func get_icon_text() -> String:
	match location_type:
		LocationType.TOWN: return "🏘️"
		LocationType.CAMP: return "⛺"
		LocationType.DUNGEON: return "🏰"
		LocationType.EXIT: return "🚪"
		LocationType.QUEST: return "⚔️"
	return "?"


## Get color for this location type
func get_color() -> Color:
	match location_type:
		LocationType.TOWN: return Color.CORNFLOWER_BLUE
		LocationType.CAMP: return Color.FOREST_GREEN
		LocationType.DUNGEON: return Color.DARK_VIOLET
		LocationType.EXIT: return Color.WHITE
		LocationType.QUEST: return Color(0.85, 0.3, 0.2)
	return Color.GRAY
