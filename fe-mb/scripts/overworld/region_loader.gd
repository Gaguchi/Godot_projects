extends RefCounted
class_name RegionLoader
## RegionLoader - Loads predefined region data from resource files

const REGIONS_PATH = "res://data/regions/"

## Available regions (loaded on demand)
static var _regions_cache: Dictionary = {}


## Load a specific region by index
static func load_region(region_index: int) -> RegionData:
	# Check cache first
	if region_index in _regions_cache:
		return _regions_cache[region_index]
	
	# Try to load from file
	var region_file = REGIONS_PATH + "region_%02d.tres" % region_index
	
	if ResourceLoader.exists(region_file):
		var region = ResourceLoader.load(region_file) as RegionData
		if region:
			_regions_cache[region_index] = region
			print("[RegionLoader] Loaded region %d: %s" % [region_index, region.region_name])
			return region
	
	# Fallback to default region if file doesn't exist
	push_warning("[RegionLoader] Region %d not found, generating fallback" % region_index)
	return _create_fallback_region(region_index)


## Get total number of available regions
static func get_region_count() -> int:
	var count = 0
	var dir = DirAccess.open(REGIONS_PATH)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()
		while file_name != "":
			if file_name.begins_with("region_") and file_name.ends_with(".tres"):
				count += 1
			file_name = dir.get_next()
	return max(count, 1)  # At least 1 region


## Clear the cache (for reloading regions)
static func clear_cache() -> void:
	_regions_cache.clear()


## Create a fallback region if no data file exists
static func _create_fallback_region(region_index: int) -> RegionData:
	var region = RegionData.new()
	region.region_id = region_index
	region.region_name = "Region %d" % (region_index + 1)
	region.difficulty = region_index + 1
	
	# Create basic layout: Start -> Battle -> Battle -> Exit
	var start = _create_location(0, "Starting Camp", LocationData.LocationType.CAMP, Vector2(60, 250))
	start.visited = true
	start.connected_locations = [1, 2]
	
	var battle1 = _create_location(1, "Forest Path", LocationData.LocationType.BATTLE, Vector2(200, 150))
	battle1.connected_locations = [0, 3]
	
	var battle2 = _create_location(2, "Mountain Road", LocationData.LocationType.BATTLE, Vector2(200, 350))
	battle2.connected_locations = [0, 3]
	
	var town = _create_location(3, "Trading Post", LocationData.LocationType.TOWN, Vector2(400, 250))
	town.connected_locations = [1, 2, 4, 5]
	
	var dungeon = _create_location(4, "Dark Cavern", LocationData.LocationType.DUNGEON, Vector2(550, 150))
	dungeon.connected_locations = [3, 6]
	
	var event = _create_location(5, "Ancient Shrine", LocationData.LocationType.EVENT, Vector2(550, 350))
	event.connected_locations = [3, 6]
	
	var exit = _create_location(6, "Region Exit", LocationData.LocationType.EXIT, Vector2(740, 250))
	exit.connected_locations = [4, 5]
	
	region.locations = [start, battle1, battle2, town, dungeon, event, exit]
	
	return region


## Helper to create a location
static func _create_location(id: int, loc_name: String, type: LocationData.LocationType, pos: Vector2) -> LocationData:
	var loc = LocationData.new()
	loc.id = id
	loc.location_name = loc_name
	loc.location_type = type
	loc.position = pos
	loc.revealed = true
	return loc
