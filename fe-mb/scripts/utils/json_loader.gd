class_name JSONLoader
extends RefCounted

static func load_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		push_warning("JSONLoader: Failed to open file: %s" % path)
		return null

	var json := JSON.new()
	var err := json.parse(file.get_as_text())
	file.close()

	if err != OK:
		push_warning("JSONLoader: Parse error in %s: %s" % [path, json.get_error_message()])
		return null

	return json.data


static func file_exists(path: String) -> bool:
	return FileAccess.file_exists(path)
