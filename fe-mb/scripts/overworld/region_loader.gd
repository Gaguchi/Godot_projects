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
		return _regions_cache[region_index].duplicate(true)
	
	# Try to load from file
	var region_file = REGIONS_PATH + "region_%02d.tres" % region_index
	
	if ResourceLoader.exists(region_file):
		var region = ResourceLoader.load(region_file) as RegionData
		if region:
			_regions_cache[region_index] = region
			print("[RegionLoader] Loaded region %d: %s" % [region_index, region.region_name])
			# Return a valid deep copy so runtime changes don't affect the cache/file
			return region.duplicate(true)
	
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
	var start_conns: Array[int] = [1, 2]
	start.connected_locations = start_conns
	
	var battle1 = _create_location(1, "Forest Path", LocationData.LocationType.CAMP, Vector2(200, 150))
	var battle1_conns: Array[int] = [0, 3]
	battle1.connected_locations = battle1_conns

	var battle2 = _create_location(2, "Mountain Road", LocationData.LocationType.CAMP, Vector2(200, 350))
	var battle2_conns: Array[int] = [0, 3]
	battle2.connected_locations = battle2_conns
	
	var town = _create_location(3, "Trading Post", LocationData.LocationType.TOWN, Vector2(400, 250))
	var town_conns: Array[int] = [1, 2, 4, 5]
	town.connected_locations = town_conns
	
	var dungeon = _create_location(4, "Dark Cavern", LocationData.LocationType.DUNGEON, Vector2(550, 150))
	var dungeon_conns: Array[int] = [3, 6]
	dungeon.connected_locations = dungeon_conns
	
	var event = _create_location(5, "Ancient Shrine", LocationData.LocationType.CAMP, Vector2(550, 350))
	var event_conns: Array[int] = [3, 6]
	event.connected_locations = event_conns
	
	var exit = _create_location(6, "Region Exit", LocationData.LocationType.EXIT, Vector2(740, 250))
	var exit_conns: Array[int] = [4, 5]
	exit.connected_locations = exit_conns
	
	var location_list: Array[LocationData] = [start, battle1, battle2, town, dungeon, event, exit]
	region.locations = location_list
	
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
