# Research: Godot Camera & Input Architecture

## Executive Summary
Implementing "Click-to-Select" AND "Drag-to-Pan" on the same surface introduces **Input Ambiguity**. Godot 4's `_input(event)` system requires specific logic to differentiate them. The best pattern is a **State-Based/Threshold** check: "If movement > X pixels, it's a drag; otherwise, it's a click."

## Mechanics Breakdown

### 1. The Threshold Pattern
We cannot trust `InputEventMouseButton.RELEASED` alone to mean "Click".
*   **State**: `is_dragging` (bool), `drag_start_pos` (Vector2).
*   **Threshold**: `DRAG_THRESHOLD = 10.0` (pixels).

#### The Logic Flow:
1.  **Pressed**: Record `drag_start_pos`. Set `is_dragging = false`.
2.  **Motion**: If `distance(current_pos, drag_start_pos) > DRAG_THRESHOLD`:
    *   Set `is_dragging = true`.
    *   Pan the Camera.
3.  **Released**:
    *   If `is_dragging`: Stop panning (Momentum/Inertia optional).
    *   If `!is_dragging`: **Treat as Click**. Raycast to find Map Node.

### 2. Implementation Strategy (Godot 4)

#### Architecture
*   **WorldMapCamera (Node2D)**: Handles Panning/Zooming.
    *   Absorbs `InputEventMouseMotion`.
*   **MapNode (Area2D/Control)**: Handles Selection.
    *   Only receives input if the Camera generally "allows" it (or if we manually raycast).

#### Code Pattern (The "Un-handled" Input Approach)
Using `_unhandled_input` ensures UI (HUD) takes priority.

```gdscript
extends Node2D

var _dragging = false
var _start_pos = Vector2.ZERO
const DRAG_THRESHOLD = 8.0

func _unhandled_input(event):
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT:
            if event.pressed:
                _start_pos = event.position
                _dragging = false
            else:
                # RELEASED
                if not _dragging:
                    _handle_click(get_global_mouse_position())
                _dragging = false
                
    elif event is InputEventMouseMotion:
        if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
            if _start_pos.distance_to(event.position) > DRAG_THRESHOLD:
                _dragging = true
                position -= event.relative * zoom_level # Pan Code
```

### 3. Edge Cases
*   **Micro-drags**: Players often move the mouse 1-2 pixels while clicking. The threshold prevents this from breaking the click.
*   **Touch Input**: This pattern works identically for Touch (just map `InputEventScreenTouch`).

## Pros/Cons
*   **Pros**: Robust, standard behavior.
*   **Cons**: Requires blocking Godot's built-in `Control.gui_input` signals if using `Area2D`, requiring manual raycasting for nodes.

## References
*   [Godot Docs: Handling Mouse Input](https://docs.godotengine.org/en/stable/tutorials/inputs/mouse_and_input_coordinates.html)
*   [InputEvent Demo](https://github.com/godotengine/godot-demo-projects/tree/master/viewport/3d_in_2d)
