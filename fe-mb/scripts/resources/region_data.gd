extends Resource
class_name RegionData
## RegionData - Hand-crafted region layout for the world map

@export var region_id: int = 0
@export var region_name: String = "Unknown Region"
@export var region_description: String = ""
@export var background_color: Color = Color(0.15, 0.12, 0.1, 1)

## Hand-crafted locations for this region
@export var locations: Array[LocationData] = []

## Threat timer for this region (turns before enemy catches up)
@export var threat_turns: int = 12

## Difficulty modifier for this region
@export var difficulty: int = 1


## Get starting location (first location with CAMP type or id=0)
func get_start_location() -> LocationData:
	for loc in locations:
		if loc.id == 0:
			return loc
	return locations[0] if not locations.is_empty() else null


## Get exit location
func get_exit_location() -> LocationData:
	for loc in locations:
		if loc.location_type == LocationData.LocationType.EXIT:
			return loc
	return null


## Get location by ID
func get_location(id: int) -> LocationData:
	for loc in locations:
		if loc.id == id:
			return loc
	return null
