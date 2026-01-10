# Godot Development Workflow

When implementing features or solving problems in Godot:

## 1. Roadmap & Task Tracking (CRITICAL)

**Before starting ANY work:**
1.  Read `docs/roadmap.md`.
2.  Confirm the task is listed under a Phase.
3.  If not listed, add it to the appropriate section.
4.  If just "exploring" or "debugging", check if it blocks a roadmap item.

**After completing work:**
1.  Update `docs/roadmap.md` immediately.
2.  Mark tasks as `[x]`.
3.  Add any new "Living System" notes if you added extensible data (e.g., new Item types).

## 2. Check Godot Documentation First

Before writing custom implementations, **always search the Godot documentation** for existing solutions:

// turbo
1. Use `search_web` with query: `site:docs.godotengine.org [feature/problem description]`

2. Check if Godot has a built-in class or method for:
   - UI components (Control, Container subclasses)
   - Physics and collision (Area2D, RayCast, etc.)
   - Animation (AnimationPlayer, Tween, AnimationTree)
   - Audio (AudioStreamPlayer, AudioBus)
   - Input handling (InputEvent classes)
   - File I/O (FileAccess, ResourceLoader)
   - Networking (HTTPRequest, WebSocket)

3. Read the class documentation for proper usage patterns

## 3. Use Godot's Built-in Solutions When Available

Prefer Godot's built-in systems over custom implementations:

| Task | Use This |
|------|----------|
| Animations | AnimationPlayer or Tween |
| UI Layout | Container nodes (VBox, HBox, Grid) |
| Pathfinding | NavigationServer2D/3D |
| State machines | AnimationTree with StateMachine |
| Signals | Built-in signal system |
| Timers | Timer node or get_tree().create_timer() |
| Saving/Loading | ResourceSaver/ResourceLoader |

## 4. Follow GDScript Best Practices

- Use typed variables and return types
- Use `@export` for inspector-visible properties
- Use `@onready` for node references
- Use signals for decoupled communication
- Resource classes for data (extend Resource)

## 5. When Custom Implementation is Needed

Only implement custom solutions when:
- No built-in solution exists
- Built-in solution doesn't fit the use case
- Performance requires specialized approach

Document why a custom approach was chosen.
