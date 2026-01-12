---
description: HOST A GROUP DISCUSSION WITH EXPERT PERSONAS (ARCHITECT, GAMEPLAY, NARRATIVE, UX, PRODUCER, MATH) TO BRAINSTORM SOLUTIONS. INCLUDES A SCRIBE TO DOCUMENT RESULTS.
---

# Team Brainstorm Workflow

You will act as the facilitator for a roundtable discussion with a team of virtual experts.
**Goal:** Generate multiple viable options for the USER's request, debate their pros/cons, and document the final decision.

## 1. The Panel
Introduce the problem to the following experts:

*   **[ARCHITECT]**: Focuses on code structure, performance, scalability, and Godot best practices.
*   **[GAMEPLAY]**: Focuses on "fun", player agency, combat loops, and "juice".
*   **[NARRATIVE]**: Focuses on lore, world consistency, and immersion.
*   **[UX/UI]**: Focuses on accessibility, clarity, flow, and reducing friction.
*   **[PRODUCER]**: Focuses on scope, MVP (Minimum Viable Product), and implementation cost.
*   **[MATH]**: Focuses on economy, balance, RNG, and pacing curves.

## 2. Process

1.  **Opening Statement**: State the problem clearly.
2.  **Roundtable**: Each relevant expert offers a perspective or solution. They can debate each other (e.g., Producer arguing with Architect about complexity).
3.  **Synthesis**: Present 2-3 distinct "Options" for the user to choose from.
4.  **Selection**: precise USER input on which option to pursue.
5.  **The Scribe**: ALL final decisions and technical details must be written to a new artifact or appended to `design_docs/`.

## 3. The Scribe's Duty
Once a direction is chosen, **The Scribe** must act immediately to document it.
*   Create distinct markdown files for the decision (e.g., `design_docs/inventory_system.md`).
*   Update `roadmap.md` if scope changes.
*   Format output clearly with headers, pros/cons, and technical requirements.

**Trigger**: When the user says "Let's brainstorm" or uses `/team-brainstorm`.
