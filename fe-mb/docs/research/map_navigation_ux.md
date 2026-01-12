# Research: Modern Map Navigation UX Patterns

## Executive Summary
Top-tier Roguelites (Slay the Spire, Monster Train, Inkbound) have standardized "Direct Manipulation" as the default map control scheme. The clunky "Click to Confirm" popup is largely absent in modern titles, replaced by **Instant Traversal** or **Hold-to-Confirm**. "Drag-to-Pan" is the expected behavior for large maps.

## Industry Standards

### 1. Slay the Spire (The Classic)
*   **Scroll**: Mouse Wheel or Edge Panning.
*   **Drag**: Click-and-drag on background pans the map (PC).
*   **Selection**: Single Click on a node.
*   **Travel**:
    *   **Instant**: Clicking a node immediately moves the player icon there.
    *   **Animation**: A simple tween (slide) with a dashed line trail.
    *   **Controller**: Stick hops between nodes; 'A' to travel.
*   **Key Takeaway**: Speed is king. Once a player knows what they want, they don't want to confirm it.

### 2. Monster Train (The Strategist)
*   **Scroll**: Free scrolling of the entire vertical track.
*   **Compact View**: Press 'M' to see a minimized, icon-only version of the whole run.
*   **Selection**: Click-to-Travel.
*   **Key Takeaway**: Visibility of the *future* is crucial. Players scroll to the boss to see rewards before choosing the first path.

### 3. Inkbound (The Modern/Juicy)
*   **Movement**: WASD or Click-to-Move *avatar* in a 3D space (not just a 2D map).
*   **Juice**: The player physically runs between nodes.
*   **Resources**: Movement in combat is a resource, but map movement is free.
*   **Key Takeaway**: Making the map a physical space increases immersion but adds significant dev cost.

## Best Practices for Our Project
Given our *Fire Emblem* (Unit-focused) theme:
1.  **Drag-to-Pan**: Essential. The map will likely be larger than the screen.
2.  **No Popups**: Remove the "Do you want to travel here?" window entirely.
3.  **Hold-to-Confirm (Optional)**: If mis-clicks are fatal (Permadeath), adding a 0.5s "Fill Ring" animation on click prevents accidental movement without breaking flow.
4.  **Zoom**: Mouse wheel should Zoom In/Out, not just scroll.

## References
*   [Slay the Spire Control Scheme](https://slay-the-spire.fandom.com/wiki/Controls)
*   [Inkbound Gameplay Deep Dive](https://store.steampowered.com/app/2062800/Inkbound/)
