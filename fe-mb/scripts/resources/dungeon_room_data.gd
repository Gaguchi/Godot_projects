extends Resource
class_name DungeonRoomData
## DungeonRoomData - Data for a single room in a dungeon floor

enum RoomType {
	COMBAT,     # Standard enemy encounter
	ELITE,      # Tough enemy with better rewards
	TREASURE,   # Chest with gold/items
	EVENT,      # Random event (choice-based)
	REST,       # Heal/upgrade opportunity
	BOSS,       # Floor boss (end of floor)
	ENTRANCE,   # Starting room
	SHOP        # Buy items/heal
}

@export var id: int = 0
@export var room_type: RoomType = RoomType.COMBAT
@export var position: Vector2 = Vector2.ZERO  # Position on the dungeon map
@export var row: int = 0  # Floor row (0 = entrance, max = boss)
@export var column: int = 0  # Column in the row

## Connected rooms (can travel to these from here)
@export var connected_rooms: Array[int] = []

@export var visited: bool = false
@export var revealed: bool = true  # Whether player can see room type

## Room-specific data
@export var enemy_count: int = 2
@export var difficulty_modifier: float = 1.0
@export var gold_reward: int = 0
@export var event_id: String = ""


## Get display color for this room type
func get_color() -> Color:
	match room_type:
		RoomType.COMBAT: return Color.INDIAN_RED
		RoomType.ELITE: return Color.ORANGE_RED
		RoomType.TREASURE: return Color.GOLD
		RoomType.EVENT: return Color.MEDIUM_PURPLE
		RoomType.REST: return Color.FOREST_GREEN
		RoomType.BOSS: return Color.DARK_RED
		RoomType.ENTRANCE: return Color.CORNFLOWER_BLUE
		RoomType.SHOP: return Color.CYAN
	return Color.GRAY


## Get icon text for this room type
func get_icon() -> String:
	match room_type:
		RoomType.COMBAT: return "⚔️"
		RoomType.ELITE: return "💀"
		RoomType.TREASURE: return "💰"
		RoomType.EVENT: return "❓"
		RoomType.REST: return "🔥"
		RoomType.BOSS: return "👿"
		RoomType.ENTRANCE: return "🚪"
		RoomType.SHOP: return "🛒"
	return "?"
