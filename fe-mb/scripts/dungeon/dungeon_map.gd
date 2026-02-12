extends Node2D
## DungeonMap - Controller for Slay the Spire-style dungeon navigation

signal room_entered(room_data: DungeonRoomData)
signal floor_completed(floor_number: int)
signal dungeon_completed()
signal dungeon_exited()

const DungeonRoomNodeScene = preload("res://scenes/dungeon/dungeon_room_node.tscn")

@onready var rooms_container: Node2D = $Rooms
@onready var connections_layer: Node2D = $Connections
@onready var camera: Camera2D = $Camera2D
@onready var ui_panel: PanelContainer = $UI/InfoPanel
@onready var room_type_label: Label = $UI/InfoPanel/VBox/RoomType
@onready var room_info_label: Label = $UI/InfoPanel/VBox/RoomInfo
@onready var enter_btn: Button = $UI/InfoPanel/VBox/EnterBtn
@onready var floor_label: Label = $UI/FloorLabel
@onready var exit_btn: Button = $UI/ExitBtn
@onready var inventory_btn: Button = $UI/InventoryBtn

# Dungeon state
var current_floor: int = 1
var max_floors: int = 3
var rooms: Array[DungeonRoomData] = []
var room_nodes: Dictionary = {}  # id -> DungeonRoomNode
var current_room_id: int = 0
var selected_room: DungeonRoomData = null

# Dungeon parameters
var dungeon_difficulty: int = 1


func _ready() -> void:
	# Keep logic, but ensure we are in DUNGEON state if we just loaded directly or restored
	if GameManager.current_state != GameManager.GameState.DUNGEON:
		GameManager.change_state(GameManager.GameState.DUNGEON)
		
	_connect_ui_signals()
	
	if GameManager.has_active_dungeon_state():
		_restore_dungeon_state()
		
		# Check if we just returned from a victory
		if GameManager.last_battle_victory:
			# Reset flag to avoid re-triggering
			GameManager.last_battle_victory = false
			
			var current_room = _get_room_by_id(current_room_id)
			if current_room and current_room.room_type == DungeonRoomData.RoomType.BOSS:
				print("[DungeonMap] Boss defeated!")
				# Short delay to let the map load
				await get_tree().create_timer(1.0).timeout
				_on_floor_completed()
	else:
		start_dungeon(1, 3) # Default start if loaded directly
	
	_update_floor_display()


func _connect_ui_signals() -> void:
	enter_btn.pressed.connect(_on_enter_pressed)
	exit_btn.pressed.connect(_on_exit_pressed)
	inventory_btn.pressed.connect(_on_inventory_pressed)


## Generate a new dungeon floor
func generate_floor() -> void:
	# Clear existing
	for child in rooms_container.get_children():
		child.queue_free()
	for child in connections_layer.get_children():
		child.queue_free()
	room_nodes.clear()
	
	# Generate new rooms
	rooms = DungeonGenerator.generate_floor(current_floor, dungeon_difficulty)
	
	# Create visual nodes
	for room in rooms:
		var node = DungeonRoomNodeScene.instantiate()
		node.setup(room)
		node.room_clicked.connect(_on_room_clicked)
		node.room_hovered.connect(_on_room_hovered)
		rooms_container.add_child(node)
		room_nodes[room.id] = node
	
	# Draw connections
	_draw_connections()
	
	# Set starting position (entrance room, id 0)
	current_room_id = 0
	_update_reachable_rooms()
	
	# Position camera at entrance
	_focus_camera_on_room(0)
	
	print("[DungeonMap] Generated floor %d with %d rooms" % [current_floor, rooms.size()])


func _draw_connections() -> void:
	for room in rooms:
		for connected_id in room.connected_rooms:
			var other = _get_room_by_id(connected_id)
			if other:
				var line = Line2D.new()
				line.add_point(room.position)
				line.add_point(other.position)
				line.width = 2.0
				line.default_color = Color(0.227, 0.239, 0.282, 0.5)
				connections_layer.add_child(line)


func _get_room_by_id(id: int) -> DungeonRoomData:
	for room in rooms:
		if room.id == id:
			return room
	return null


func _update_reachable_rooms() -> void:
	var current_room = _get_room_by_id(current_room_id)
	if not current_room:
		return
	
	for id in room_nodes:
		var node = room_nodes[id]
		var room_connected = id in current_room.connected_rooms
		node.set_reachable(room_connected)
		node.set_current(id == current_room_id)
		
		var room = _get_room_by_id(id)
		if room:
			node.set_completed(room.visited and id != current_room_id)


func _on_room_clicked(room_data: DungeonRoomData) -> void:
	selected_room = room_data
	_show_room_info(room_data)


func _on_room_hovered(_room_data: DungeonRoomData) -> void:
	# Could show tooltip here
	pass


func _show_room_info(room: DungeonRoomData) -> void:
	ui_panel.visible = true
	
	var type_names = ["Combat", "Elite", "Treasure", "Event", "Rest", "Boss", "Entrance", "Shop"]
	room_type_label.text = "%s %s" % [room.get_icon(), type_names[room.room_type]]
	
	# Build info string
	var info = ""
	match room.room_type:
		DungeonRoomData.RoomType.COMBAT:
			info = "Enemies: %d\nReward: ~%d gold" % [room.enemy_count, room.gold_reward]
		DungeonRoomData.RoomType.ELITE:
			info = "Elite enemy!\nReward: ~%d gold" % room.gold_reward
		DungeonRoomData.RoomType.BOSS:
			info = "Floor Boss\nReward: ~%d gold" % room.gold_reward
		DungeonRoomData.RoomType.TREASURE:
			info = "Contains treasure!\nReward: ~%d gold" % room.gold_reward
		DungeonRoomData.RoomType.REST:
			info = "Rest and recover"
		DungeonRoomData.RoomType.SHOP:
			info = "Buy items and heal"
		DungeonRoomData.RoomType.EVENT:
			info = "Unknown encounter"
		_:
			info = ""
	
	room_info_label.text = info
	
	# Can only enter if connected
	var current_room = _get_room_by_id(current_room_id)
	var can_enter = room.id in current_room.connected_rooms
	enter_btn.disabled = not can_enter
	enter_btn.text = "Enter" if can_enter else "Not Reachable"


func _on_enter_pressed() -> void:
	if not selected_room:
		return
	
	# Move to selected room
	var old_room = _get_room_by_id(current_room_id)
	if old_room:
		old_room.visited = true
	
	current_room_id = selected_room.id
	selected_room.visited = true
	_update_reachable_rooms()
	_focus_camera_on_room(current_room_id)
	
	# Emit signal and trigger room event
	room_entered.emit(selected_room)
	_trigger_room_event(selected_room)


func _trigger_room_event(room: DungeonRoomData) -> void:
	print("[DungeonMap] Entered room: %s" % DungeonRoomData.RoomType.keys()[room.room_type])
	
	match room.room_type:
		DungeonRoomData.RoomType.COMBAT, DungeonRoomData.RoomType.ELITE:
			print("[DungeonMap] Starting combat...")
			_start_dungeon_combat(room)

		DungeonRoomData.RoomType.BOSS:
			print("[DungeonMap] Boss battle!")
			_start_dungeon_combat(room)
		
		DungeonRoomData.RoomType.TREASURE:
			print("[DungeonMap] Found treasure!")
			GameManager.add_gold(room.gold_reward)
			EventBus.show_notification.emit("Found %d gold!" % room.gold_reward)
		
		DungeonRoomData.RoomType.REST:
			print("[DungeonMap] Resting...")
			GameManager.rest_party(0.3)
			EventBus.show_notification.emit("Party rested. Healed 30%%.")
		
		DungeonRoomData.RoomType.SHOP:
			print("[DungeonMap] Entering shop...")
			EventBus.show_notification.emit("Welcome to the shop!")
		
		DungeonRoomData.RoomType.EVENT:
			print("[DungeonMap] Random event!")
			EventBus.show_notification.emit("Something stirs in the shadows...")
	
	# Check if boss defeated -> floor complete
	# DEPRECATED: This check was premature. Now handled in _ready() after returning from combat.
	# if room.room_type == DungeonRoomData.RoomType.BOSS:
	# 	_on_floor_completed()
	
	ui_panel.visible = false


func _on_floor_completed() -> void:
	print("[DungeonMap] Floor %d completed!" % current_floor)
	floor_completed.emit(current_floor)
	GameManager.set_dungeon_floor(current_floor)
	
	if current_floor >= max_floors:
		print("[DungeonMap] Dungeon completed!")
		dungeon_completed.emit()
		GameManager.clear_dungeon_state()
		GameManager.exit_dungeon(true)  # Completed (sets state OVERWORLD)
		# Return to world map
		SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")
	else:
		current_floor += 1
		generate_floor()
		_update_floor_display()


func _on_exit_pressed() -> void:
	print("[DungeonMap] Exiting dungeon...")
	dungeon_exited.emit()
	GameManager.clear_dungeon_state()
	GameManager.exit_dungeon(false)  # Abandoned (sets state OVERWORLD)
	# Return to world map
	SceneLoader.change_scene_to_file("res://scenes/overworld/world_map.tscn")

func _on_inventory_pressed() -> void:
	# Save state before leaving, just in case (though we rely on _restore_dungeon_state)
	GameManager.save_dungeon_state(rooms, current_room_id, dungeon_difficulty, max_floors)
	
	if has_node("/root/SceneLoader"):
		get_node("/root/SceneLoader").change_scene_to_file("res://scenes/ui/inventory_screen.tscn", false)
	else:
		get_tree().change_scene_to_file("res://scenes/ui/inventory_screen.tscn")


func _update_floor_display() -> void:
	if floor_label:
		floor_label.text = "Floor %d / %d" % [current_floor, max_floors]


func _focus_camera_on_room(room_id: int) -> void:
	var room = _get_room_by_id(room_id)
	if room and camera:
		var tween = create_tween()
		tween.tween_property(camera, "position", room.position, 0.3).set_ease(Tween.EASE_OUT)


## Build enemies and transition to combat for a dungeon room
func _start_dungeon_combat(room: DungeonRoomData) -> void:
	var enemies: Array = []
	var num = room.enemy_count if room.enemy_count > 0 else (2 + dungeon_difficulty)
	var is_boss = room.room_type == DungeonRoomData.RoomType.BOSS
	var is_elite = room.room_type == DungeonRoomData.RoomType.ELITE

	for i in range(num):
		var enemy = UnitData.new()
		if is_boss:
			enemy.unit_name = "Boss"
			enemy.max_hp = 25 + (dungeon_difficulty * 5)
			enemy.strength = 5 + dungeon_difficulty * 2
			enemy.speed = 4 + dungeon_difficulty
			enemy.defense = 3 + dungeon_difficulty
		elif is_elite:
			enemy.unit_name = "Elite %d" % (i + 1)
			enemy.max_hp = 20 + (dungeon_difficulty * 3)
			enemy.strength = 4 + dungeon_difficulty
			enemy.speed = 4 + randi() % (dungeon_difficulty + 2)
			enemy.defense = 2 + int(dungeon_difficulty / 2.0)
		else:
			enemy.unit_name = "Monster %d" % (i + 1)
			enemy.max_hp = 14 + (dungeon_difficulty * 2)
			enemy.strength = 3 + dungeon_difficulty
			enemy.speed = 3 + randi() % (dungeon_difficulty + 2)
			enemy.defense = 1 + int(dungeon_difficulty / 2.0)

		enemy.is_player_unit = false
		enemy.current_hp = enemy.max_hp
		enemy.current_armor = enemy.defense

		var weapon = ItemData.new()
		weapon.weapon_type = (randi() % 3) as ItemData.WeaponType
		weapon.might = 3 + int(dungeon_difficulty / 2.0)
		weapon.hit = 80
		weapon.range_max = 1
		enemy.equipped_weapon = weapon

		enemies.append(enemy)

	GameManager.pending_battle = {
		"enemies": enemies,
		"difficulty": dungeon_difficulty,
		"source": "dungeon",
		"room_type": DungeonRoomData.RoomType.keys()[room.room_type]
	}

	GameManager.save_dungeon_state(rooms, current_room_id, dungeon_difficulty, max_floors)
	EventBus.combat_started.emit()
	SceneLoader.change_scene_to_file("res://scenes/combat/battlefield.tscn")


## Initialize dungeon with parameters
func start_dungeon(difficulty: int = 1, floors: int = 3) -> void:
	print("[DungeonMap] Starting NEW dungeon")
	GameManager.clear_dungeon_state()
	dungeon_difficulty = difficulty
	max_floors = floors
	current_floor = 1
	generate_floor()
	_update_floor_display()

func _restore_dungeon_state() -> void:
	print("[DungeonMap] Restoring dungeon state")
	var state = GameManager.load_dungeon_state()
	rooms = state.rooms
	current_room_id = state.current_room_id
	dungeon_difficulty = state.difficulty
	max_floors = state.max_floors
	current_floor = state.floor
	
	# Clear existing visuals
	for child in rooms_container.get_children():
		child.queue_free()
	for child in connections_layer.get_children():
		child.queue_free()
	room_nodes.clear()
	
	# Recreate visuals
	for room in rooms:
		var node = DungeonRoomNodeScene.instantiate()
		node.setup(room)
		node.room_clicked.connect(_on_room_clicked)
		node.room_hovered.connect(_on_room_hovered)
		rooms_container.add_child(node)
		room_nodes[room.id] = node
		
		# Update visual state immediately
		node.set_current(room.id == current_room_id)
		node.set_completed(room.visited and room.id != current_room_id)
		
	_draw_connections()
	_update_reachable_rooms()
	_focus_camera_on_room(current_room_id)
