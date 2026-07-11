# Amateur-signal checklist

Sweep every rendered screenshot against these. Each row: signal → why it reads
amateur → the professional alternative. Ordered by how fast a player notices.

## A. Typography (the fastest tell)

| Signal | Why | Alternative |
|---|---|---|
| Default/system font (Arial, Roboto, Inter, unstyled serif) | The "nobody chose this" fingerprint; Inter now specifically reads "AI web app" | 1 display face matching the fiction + 1 workhorse body face, embedded (self-hosted), never fallback |
| Ornate display face used for body text (or below ~16px) | Hairlines collapse; reads as costume, not craft | Display for titles/names only; body face carries paragraphs |
| One font size everywhere | No hierarchy — reads as a form | Committed scale; numbers the player cares about are the LARGEST text on the element |
| Inconsistent capitalization across screens | No style guide → no team → rushed | One convention per element class (CAPS+tracking for buttons/labels, Title Case for names, sentence case body) |
| Caps without letter-spacing | Typeset like a memo | +0.05–0.15em on anything uppercase; never letter-space lowercase |
| Truncated labels / ellipses / overflow | Layout never met real content | Design for the longest string; autofit or rewrite the copy |
| Pure #fff on #000 | Web default contrast | Warm off-whites (#e8ddc4-family) on deep warm darks; tint everything toward the palette |
| Jittering numbers | Proportional digits | `font-variant-numeric: tabular-nums` on every changing number |
| Text floating on busy art with no treatment | Illegible + flat | 1–2px dark outline, drop shadow, or scrim gradient behind — text is a rendered object |

## B. Web-tech leakage (deadly for DOM-over-canvas games)

| Signal | Alternative |
|---|---|
| Browser text selection highlights | `user-select: none` on all chrome (keep only where copying matters, e.g. seed codes) |
| I-beam cursor over labels | `cursor: default` (or custom cursor set) |
| Native OS scrollbars inside panels | Thin themed scrollbars (`scrollbar-width`/`::-webkit-scrollbar`) or edge-fade masks + wheel scrolling |
| Native `<select>`/checkbox/browser-blue focus ring | Skinned controls (react-aria pattern); themed focus treatment — never bare `outline:none` |
| Right-click context menu, image drag ghosts | Suppress contextmenu on the game surface; `draggable=false` |
| Rubber-band overscroll / pinch zoom | `overscroll-behavior:none`, `touch-action:manipulation` |
| FOUC / fonts+images popping in | Preload behind a loading state, reveal with a transition |
| `title=""` attribute tooltips | The project's styled Tooltip component |
| Unicode glyphs as UI (×, ▾, emoji icons) | The project's icon set — one family, consistent stroke, silhouette-first |

## C. Components & patterns

| Signal | Alternative |
|---|---|
| Web-form buttons (the Tailwind/Bootstrap silhouette) | Buttons of the game's material world: bevel, texture, edge light, distinct silhouette |
| Modals for everything (gray scrim stacks) | Reserve modals for hard interrupts; use side panels, expanding cards, anchored popovers, inline confirms |
| Mixed icon families / emoji as icons | One set (game-icons.net for fantasy), one stroke weight, recolored to palette; icons in shaped sockets (circle=status, diamond=slot) |
| Keyboard-shortcut text as primary UI ("Press E to end turn") | Clickable affordance first; shortcut as a small styled keycap chip on it |
| Player-visible dev strings (codenames, enum names, unlocalized keys) | Display-name layer over every id; lint for unmapped keys |
| Empty states as plain italics or nothing | Designed empty state: dimmed silhouette art + in-voice flavor + pointer to the action that fills it |
| Raw numbers (`0.30000000000000004`, unformatted lists) | Round/format at display boundary; animate changes; show outcomes not formulas |
| Comma-joined data as content ("Slash, Thrust, Guard Break") | Render the actual objects (mini cards, icon chips) |
| CRUD table rows with per-row buttons | Master-detail: compact list + rich inspect pane + ONE primary action |
| Equal-rank actions in three different button styles | One primary per view; everything else secondary/ghost, consistently |

## D. Motion & feedback

| Signal | Alternative |
|---|---|
| No hover/press state | Full state set; press feedback on pointerdown (≤80ms) |
| Hard cuts between screens | 200–400ms transitions, one easing vocabulary, consistent direction language |
| Linear easing / no easing | ease-out entrances, ease-in exits, overshoot only for rewards |
| Silent state changes (HP just becomes smaller) | ≥2 channels per meaningful event: bar ghost-trail + number float; gold flies + counter rolls |
| Everything animates equally (or 1s+ everywhere) | Motion hierarchy: micro 100–200ms, screen 200–400ms, ceremony longer but skippable; frequent actions fastest |
| No UI sound | Hover tick, confirm, cancel, error thud, reward sting |
| Dead screens at rest | 2–4 subtle ambient loops at co-prime periods (flicker, motes, breathing) — amplitude ≤3%, felt not seen |

## E. Layout & composition

| Signal | Alternative |
|---|---|
| Elements floating unanchored | Pin to edges/corners with consistent margins; group related controls in one panel |
| Dead space (tiny widgets in a void) | Compose negative space: key art, scene, emblem, atmosphere layers — or tighten |
| Misaligned baselines / mixed paddings | One grid, one spacing scale (4/8/12/16/24/32), aligned optical edges |
| Content stretching at wide aspect | Max content width, safe-zone margins, letterboxed composition |
| Every panel a different radius/border/shadow | ONE panel recipe tokenized; variants only by deliberate hierarchy |
| Chrome parked over the board/world center | Screen center belongs to the world; chrome lives on edges; interrupts only during interrupts |
| Overlapping UI (panels clipping each other) | Layout audit per screen state; z-discipline; collision = P0 bug |

## F. "AI-generated" tells (2025–26 vintage)

- Indigo/purple gradient accents; gradient text headlines
- Inter + gray-50 background + white cards `rounded-xl shadow-md`
- Three feature cards in a grid (icon, title, one-liner)
- Uniform `space-y-4` rhythm — nothing groups
- Emoji as icons; Title Case On Everything; copy like "Unleash your potential"
- Fix: obey the project token file; reject any output that ships a default.

## Priority order (highest credibility-per-hour)

1. Kill web leakage (B) — one afternoon, permanent gain.
2. Full state set + UI sounds (D).
3. Screen transitions — no hard cuts anywhere (D).
4. Typography commit (A).
5. String hygiene + designed empty states (C).
6. Alignment/anchoring pass (E).

Final heuristic: **screenshot the screen and ask "could this be mistaken for
an admin dashboard or a browser page?"** If yes, one of the rows above leaks.
