extends Node

## DataRegistry — Loads and validates all game data at startup.
## Registered as an autoload singleton. Do NOT add class_name.

# --- Public data stores ---
var cards: Dictionary = {}
var items: Dictionary = {}
var class_decks: Dictionary = {}
var quests: Dictionary = {}
var enemy_groups: Dictionary = {}
var travel_events: Array = []
var towns: Dictionary = {}
var dialogue_ids: Array = []

# --- Paths ---
const CARD_CATALOG_PATH := "res://data/cards/card_catalog.json"
const CLASS_DECKS_PATH := "res://data/cards/class_decks.json"
const ITEM_CATALOG_PATH := "res://data/items/item_catalog.json"
const QUEST_DEFS_PATH := "res://data/quests/quest_definitions.json"
const ENEMY_GROUPS_PATH := "res://data/events/enemy_groups.json"
const TRAVEL_EVENTS_PATH := "res://data/events/travel_events.json"
const TOWNS_DIR := "res://data/towns/"
const DIALOGUE_DIR := "res://data/dialogue/"


func _ready() -> void:
	_load_all()
	_validate_all()
	print("[DataRegistry] Loaded: %d cards, %d items, %d quests, %d enemy groups, %d events, %d towns" % [
		cards.size(), items.size(), quests.size(), enemy_groups.size(),
		travel_events.size(), towns.size()
	])


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

func _load_all() -> void:
	_load_cards()
	_load_items()
	_load_class_decks()
	_load_quests()
	_load_enemy_groups()
	_load_travel_events()
	_load_towns()
	_scan_dialogue_ids()


func _load_cards() -> void:
	var data = JSONLoader.load_json(CARD_CATALOG_PATH)
	if data is Dictionary:
		cards = data
	else:
		push_warning("[DataRegistry] Failed to load card catalog")


func _load_items() -> void:
	var data = JSONLoader.load_json(ITEM_CATALOG_PATH)
	if data is Dictionary:
		items = data
	else:
		push_warning("[DataRegistry] Failed to load item catalog")


func _load_class_decks() -> void:
	var data = JSONLoader.load_json(CLASS_DECKS_PATH)
	if data is Dictionary:
		class_decks = data
	else:
		push_warning("[DataRegistry] Failed to load class decks")


func _load_quests() -> void:
	var data = JSONLoader.load_json(QUEST_DEFS_PATH)
	if data is Dictionary and data.has("quests") and data["quests"] is Array:
		for quest in data["quests"]:
			if quest is Dictionary and quest.has("id"):
				quests[quest["id"]] = quest
			else:
				push_warning("[DataRegistry] Quest entry missing 'id' field")
	else:
		push_warning("[DataRegistry] Failed to load quest definitions")


func _load_enemy_groups() -> void:
	var data = JSONLoader.load_json(ENEMY_GROUPS_PATH)
	if data is Dictionary:
		enemy_groups = data
	else:
		push_warning("[DataRegistry] Failed to load enemy groups")


func _load_travel_events() -> void:
	var data = JSONLoader.load_json(TRAVEL_EVENTS_PATH)
	if data is Array:
		travel_events = data
	else:
		push_warning("[DataRegistry] Failed to load travel events")


func _load_towns() -> void:
	var dir := DirAccess.open(TOWNS_DIR)
	if not dir:
		push_warning("[DataRegistry] Cannot open towns directory: %s" % TOWNS_DIR)
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.ends_with(".json"):
			var town_id := file_name.get_basename()
			var data = JSONLoader.load_json(TOWNS_DIR + file_name)
			if data is Dictionary:
				towns[town_id] = data
			else:
				push_warning("[DataRegistry] Failed to load town file: %s" % file_name)
		file_name = dir.get_next()
	dir.list_dir_end()


func _scan_dialogue_ids() -> void:
	var dir := DirAccess.open(DIALOGUE_DIR)
	if not dir:
		push_warning("[DataRegistry] Cannot open dialogue directory: %s" % DIALOGUE_DIR)
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.ends_with(".json"):
			dialogue_ids.append(file_name.get_basename())
		file_name = dir.get_next()
	dir.list_dir_end()


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

func _validate_all() -> void:
	_validate_class_decks()
	_validate_towns()
	_validate_travel_events()
	_validate_quests()


func _validate_class_decks() -> void:
	for class_name_key in class_decks:
		var deck: Dictionary = class_decks[class_name_key]
		if not deck.has("cards") or not deck["cards"] is Array:
			push_warning("[DataRegistry] Class deck '%s' missing 'cards' array" % class_name_key)
			continue
		for entry in deck["cards"]:
			if entry is Dictionary and entry.has("card_id"):
				var card_id: String = entry["card_id"]
				if not cards.has(card_id):
					push_warning("[DataRegistry] Class deck '%s' references unknown card_id '%s'" % [class_name_key, card_id])


func _validate_towns() -> void:
	for town_id in towns:
		var town: Dictionary = towns[town_id]
		if not town.has("buildings"):
			continue
		var buildings: Dictionary = town["buildings"]

		# Validate shop stock
		if buildings.has("shop") and buildings["shop"] is Dictionary:
			var shop: Dictionary = buildings["shop"]
			if shop.has("stock") and shop["stock"] is Array:
				for item_id in shop["stock"]:
					if not items.has(item_id):
						push_warning("[DataRegistry] Town '%s' shop references unknown item '%s'" % [town_id, item_id])

		# Validate tavern quests and dialogue
		if buildings.has("tavern") and buildings["tavern"] is Dictionary:
			var tavern: Dictionary = buildings["tavern"]
			if tavern.has("quests") and tavern["quests"] is Array:
				for quest_entry in tavern["quests"]:
					if quest_entry is Dictionary:
						if quest_entry.has("quest_id"):
							var qid: String = quest_entry["quest_id"]
							if not quests.has(qid):
								push_warning("[DataRegistry] Town '%s' tavern references unknown quest_id '%s'" % [town_id, qid])
						if quest_entry.has("dialogue_id"):
							var did: String = quest_entry["dialogue_id"]
							if not dialogue_ids.has(did):
								push_warning("[DataRegistry] Town '%s' tavern references missing dialogue file '%s'" % [town_id, did])


func _validate_travel_events() -> void:
	for event in travel_events:
		if not event is Dictionary:
			continue
		var event_id: String = event.get("id", "<unknown>")

		# Battle events: check enemy_group
		if event.get("type") == "battle" and event.has("enemy_group"):
			var eg: String = event["enemy_group"]
			if not enemy_groups.has(eg):
				push_warning("[DataRegistry] Travel event '%s' references unknown enemy_group '%s'" % [event_id, eg])

		# Dialogue events: check dialogue file exists
		if event.get("type") == "dialogue" and event.has("dialogue_id"):
			var did: String = event["dialogue_id"]
			if not dialogue_ids.has(did):
				push_warning("[DataRegistry] Travel event '%s' references missing dialogue file '%s'" % [event_id, did])

		# Capture target dialogues
		if event.has("capture_targets") and event["capture_targets"] is Array:
			for ct in event["capture_targets"]:
				if ct is Dictionary:
					if ct.has("captured_dialogue") and not dialogue_ids.has(ct["captured_dialogue"]):
						push_warning("[DataRegistry] Travel event '%s' capture target references missing dialogue '%s'" % [event_id, ct["captured_dialogue"]])
					if ct.has("killed_dialogue") and not dialogue_ids.has(ct["killed_dialogue"]):
						push_warning("[DataRegistry] Travel event '%s' capture target references missing dialogue '%s'" % [event_id, ct["killed_dialogue"]])


func _validate_quests() -> void:
	for quest_id in quests:
		var quest: Dictionary = quests[quest_id]

		# Check quest_nodes enemy_group references
		if quest.has("quest_nodes") and quest["quest_nodes"] is Array:
			for node in quest["quest_nodes"]:
				if node is Dictionary and node.has("battle") and node["battle"] is Dictionary:
					var battle: Dictionary = node["battle"]
					if battle.has("enemy_group"):
						var eg: String = battle["enemy_group"]
						if not enemy_groups.has(eg):
							push_warning("[DataRegistry] Quest '%s' references unknown enemy_group '%s'" % [quest_id, eg])

					# Check capture target dialogues
					if battle.has("capture_targets") and battle["capture_targets"] is Array:
						for ct in battle["capture_targets"]:
							if ct is Dictionary:
								if ct.has("captured_dialogue") and not dialogue_ids.has(ct["captured_dialogue"]):
									push_warning("[DataRegistry] Quest '%s' capture target references missing dialogue '%s'" % [quest_id, ct["captured_dialogue"]])
								if ct.has("killed_dialogue") and not dialogue_ids.has(ct["killed_dialogue"]):
									push_warning("[DataRegistry] Quest '%s' capture target references missing dialogue '%s'" % [quest_id, ct["killed_dialogue"]])
