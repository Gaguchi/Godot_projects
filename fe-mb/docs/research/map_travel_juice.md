# Research: Juice & Transitions (The "Travel Feel")

## Executive Summary
Good map travel is more than `position = new_position`. It requires **Anticipation**, **Arcing**, and **Feedback**. The "Gold Standard" is a **Bezier Curve** path with a **Particle Trail** and an easing function (e.g., `ease_in_out`).

## Mechanics Breakdown

### 1. The Path: Bezier Curves
Straight lines feel robotic. Curves feel natural.
*   **Quadratic Bezier**: Uses 3 points (Start, End, Control).
    *   *Control Point*: Usually the midpoint of Start/End, offset perpendicularly by a random amount (curvature).
*   **Formula**:
    ```gdscript
    func _get_bezier_point(t: float, p0, p1, p2):
        var q0 = p0.lerp(p1, t)
        var q1 = p1.lerp(p2, t)
        return q0.lerp(q1, t)
    ```

### 2. The Animation: Tweening
Godot's `Tween` node is perfect here.
*   **Transition**: `Tween.TRANS_QUAD` or `Tween.TRANS_CUBIC`.
*   **Ease**: `Tween.EASE_IN_OUT` (Slow start, fast middle, slow stop).
*   **Duration**: Function of distance (e.g., `distance / speed`).

### 3. The Juice (Visual Feedback)
*   **Dashed Line**: Draw the path *before* movement (or as the mouse hovers).
    *   *Godot Implementation*: `Line2D` with a texture (dashes) and `texture_mode = TILE`.
*   **Particles**:
    *   **Trail**: A `GPUParticles2D` emitting smoke/dust behind the unit.
    *   **Burst**: A one-shot particle explosion (dust cloud) upon **landing** at the destination.
*   **Camera Tracking**: The camera should `lerp` towards the unit's position, but deeply lagging behind slightly to create a smooth "follow" feel.

## Implementation Strategy (Godot)

### Architecture
*   **MapPawn (Node2D)**: The player token.
    *   Contains `Sprite2D` and `GPUParticles2D`.
*   **CurveGenerator**: A helper to calculate the Bezier control point.

### Code Snippet (Tweening Curve)
```gdscript
func travel_to(target_pos: Vector2):
    var t = get_tree().create_tween()
    # Method: We actually tween a float 't' from 0.0 to 1.0
    # and update position in _process based on the curve
    t.tween_method(_update_curve_pos, 0.0, 1.0, 1.5).set_trans(Tween.TRANS_QUAD)
    
func _update_curve_pos(t: float):
    position = _calculate_bezier_point(t, start, control, end)
```

## References
*   [Godot Tween Cheatsheet](https://raw.githubusercontent.com/godotengine/godot-docs/master/img/tween_cheatsheet.png)
*   [The Art of Screenshake and Juice (GDC)](https://www.youtube.com/watch?v=AJdEqSSNZ-U)
