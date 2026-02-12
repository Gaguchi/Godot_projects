extends Node2D
class_name MapBackground
## MapBackground - Procedural water/land map background with organic coastlines

const WATER_COLOR = Color(0.10, 0.15, 0.25)
const LAND_BASE_COLOR = Color(0.32, 0.40, 0.22)
const SHORE_COLOR = Color(0.45, 0.55, 0.38, 0.6)
const SHORE_INNER_COLOR = Color(0.38, 0.48, 0.32, 0.3)

var _landmass_polygon: PackedVector2Array
var _coastline: PackedVector2Array
var _inner_shore: PackedVector2Array
var _region_polygons: Dictionary = {}  # region_id -> PackedVector2Array
var _region_tint_colors: Dictionary = {}  # region_id -> Color
var _region_labels: Array[Dictionary] = []  # [{name, position, color}]
var _water_rect: Rect2
var _is_setup: bool = false


func setup(all_positions: Array[Vector2], region_positions: Dictionary, region_data: Array[Dictionary]) -> void:
	print("[MapBackground] Setting up with %d positions" % all_positions.size())

	# Compute water fill area (generous padding for pan/zoom)
	var bounds = _get_bounds(all_positions)
	_water_rect = Rect2(
		bounds.position - Vector2(400, 300),
		bounds.size + Vector2(800, 600)
	)

	# Build landmass polygon from all node positions
	var hull = _convex_hull(all_positions)
	var expanded = _expand_polygon(hull, all_positions, 90.0)
	_landmass_polygon = _make_organic_coastline(expanded, 3, 20.0, 42)

	# Build coastline polylines (same shape, just used for drawing outlines)
	_coastline = _landmass_polygon
	_inner_shore = _offset_polygon_inward(_landmass_polygon, all_positions, 5.0)

	# Build region tint polygons
	var region_tints = {
		"borderlands": Color(0.25, 0.55, 0.18, 0.20),
		"thornwood": Color(0.12, 0.30, 0.08, 0.22),
		"ashfall": Color(0.50, 0.28, 0.10, 0.22)
	}

	for region in region_data:
		var rid = region.id
		var positions = region_positions.get(rid, [])
		if positions.size() < 3:
			continue

		_region_tint_colors[rid] = region_tints.get(rid, Color(0.3, 0.3, 0.3, 0.15))

		var rhull = _convex_hull(positions)
		var rexpanded = _expand_polygon(rhull, positions, 60.0)
		_region_polygons[rid] = _make_organic_coastline(rexpanded, 3, 15.0, hash(rid))

		# Region label at centroid
		var centroid = Vector2.ZERO
		for p in positions:
			centroid += p
		centroid /= positions.size()
		_region_labels.append({
			"name": region.name,
			"position": centroid + Vector2(0, -50),
			"color": Color(region.color, 0.45)
		})

	_is_setup = true
	set_process(false)
	print("[MapBackground] Setup complete, landmass: %d pts" % _landmass_polygon.size())
	queue_redraw()


func _draw() -> void:
	if not _is_setup:
		return

	# 1. Water fill
	draw_rect(_water_rect, WATER_COLOR)

	# 2. Landmass base - use triangulated polygon for safety
	_draw_safe_polygon(_landmass_polygon, LAND_BASE_COLOR)

	# 3. Region tint overlays
	for rid in _region_polygons:
		var poly: PackedVector2Array = _region_polygons[rid]
		_draw_safe_polygon(poly, _region_tint_colors[rid])

	# 4. Coastline outlines
	if _coastline.size() >= 3:
		var closed = PackedVector2Array(_coastline)
		closed.append(_coastline[0])
		draw_polyline(closed, SHORE_COLOR, 3.0, true)

	if _inner_shore.size() >= 3:
		var closed = PackedVector2Array(_inner_shore)
		closed.append(_inner_shore[0])
		draw_polyline(closed, SHORE_INNER_COLOR, 1.5, true)

	# 5. Region name labels
	for label_data in _region_labels:
		var pos: Vector2 = label_data.position
		var col: Color = label_data.color
		draw_string(ThemeDB.fallback_font, pos - Vector2(50, 0), label_data.name, HORIZONTAL_ALIGNMENT_CENTER, 100, 16, col)


## Draw polygon with triangulation safety check to avoid freezes
func _draw_safe_polygon(poly: PackedVector2Array, color: Color) -> void:
	if poly.size() < 3:
		return
	# Pre-triangulate to check if polygon is valid
	var triangles = Geometry2D.triangulate_polygon(poly)
	if triangles.is_empty():
		# Polygon is degenerate/self-intersecting, fall back to convex decomposition
		var convex_parts = Geometry2D.decompose_polygon_in_convex(poly)
		for part in convex_parts:
			if part.size() >= 3:
				draw_polygon(part, [color])
	else:
		draw_polygon(poly, [color])


# --- Geometry Helpers ---

func _get_bounds(points: Array[Vector2]) -> Rect2:
	if points.is_empty():
		return Rect2()
	var min_p = Vector2(points[0])
	var max_p = Vector2(points[0])
	for p in points:
		min_p.x = min(min_p.x, p.x)
		min_p.y = min(min_p.y, p.y)
		max_p.x = max(max_p.x, p.x)
		max_p.y = max(max_p.y, p.y)
	return Rect2(min_p, max_p - min_p)


## Graham scan convex hull
func _convex_hull(points: Array) -> PackedVector2Array:
	if points.size() < 3:
		var result = PackedVector2Array()
		for p in points:
			result.append(p)
		return result

	var sorted_pts = points.duplicate()
	sorted_pts.sort_custom(func(a, b): return a.x < b.x if a.x != b.x else a.y < b.y)

	var lower: Array[Vector2] = []
	for p in sorted_pts:
		while lower.size() >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
			lower.pop_back()
		lower.append(p)

	var upper: Array[Vector2] = []
	for i in range(sorted_pts.size() - 1, -1, -1):
		var p = sorted_pts[i]
		while upper.size() >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
			upper.pop_back()
		upper.append(p)

	lower.pop_back()
	upper.pop_back()

	var result = PackedVector2Array()
	for p in lower:
		result.append(p)
	for p in upper:
		result.append(p)
	return result


func _cross(o: Vector2, a: Vector2, b: Vector2) -> float:
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)


## Expand polygon outward from centroid
func _expand_polygon(hull: PackedVector2Array, all_points: Array, padding: float) -> PackedVector2Array:
	var centroid = Vector2.ZERO
	for p in all_points:
		centroid += p
	centroid /= all_points.size()

	var expanded = PackedVector2Array()
	for p in hull:
		var dir = (p - centroid).normalized()
		expanded.append(p + dir * padding)
	return expanded


## Subdivide edges and apply gentle noise for organic coastline
func _make_organic_coastline(hull: PackedVector2Array, subdivisions: int, noise_amount: float, seed_val: int) -> PackedVector2Array:
	if hull.size() < 3:
		return hull

	var rng = RandomNumberGenerator.new()
	rng.seed = seed_val

	var result = PackedVector2Array()
	for i in range(hull.size()):
		var a = hull[i]
		var b = hull[(i + 1) % hull.size()]
		var edge_len = a.distance_to(b)

		# Skip noise on very short edges to prevent self-intersection
		var use_noise = edge_len > noise_amount * 3.0

		for s in range(subdivisions):
			var t = float(s) / subdivisions
			var point = a.lerp(b, t)
			if use_noise and s > 0:  # Don't offset the vertex itself
				var edge_dir = (b - a).normalized()
				var normal = Vector2(-edge_dir.y, edge_dir.x)
				var offset = rng.randf_range(-noise_amount, noise_amount)
				point += normal * offset
			result.append(point)

	return result


## Offset polygon inward for inner shore line
func _offset_polygon_inward(polygon: PackedVector2Array, all_points: Array, amount: float) -> PackedVector2Array:
	if polygon.is_empty() or all_points.is_empty():
		return polygon

	var centroid = Vector2.ZERO
	for p in all_points:
		centroid += p
	centroid /= all_points.size()

	var result = PackedVector2Array()
	for p in polygon:
		var dir = (p - centroid).normalized()
		result.append(p - dir * amount)
	return result
