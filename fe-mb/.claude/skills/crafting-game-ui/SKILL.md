---
name: crafting-game-ui
description: Use when building or changing ANY player-facing game surface (screen, HUD, menu, modal, overlay, card, tooltip) — before writing the UI code and again before calling it done. Also use when game UI reads amateurish, "web app", asset-flip, or AI-generated, or when adding feedback/juice to game events.
---

# Crafting Game UI

## Overview

A game screen is a **composed scene**, not a document. Web grammar — form
buttons, CRUD rows, gray-scrim modals, italic empty states, OS scrollbars —
is what makes a game read as amateur no matter how good the logic is.

**Core principle: darkness/quiet is the material; light, color and motion are
information, spent only on what the player should act on right now.** A screen
where everything is equally lit and equally styled is a dashboard.

Three root causes behind every amateur signal (fix causes, not symptoms):
1. **Defaults left visible** — any unchosen font, button, easing, scrollbar or
   cursor fingerprints "nobody made a decision here."
2. **Missing state model** — pro UI gives every element idle/hover/press/
   disabled states and every screen change a transition. Amateur UI has one
   state per element and hard cuts.
3. **No single system** — pro UI derives everything from one token set
   (2 fonts, one palette, one radius, one motion vocabulary). Ad-hoc screens
   never match.

## Required workflow

**Before building** a surface:
1. Name its **job** and its single **focal point** (what should the eye land
   on in 1 second?). Center of screen belongs to the world, not chrome.
2. Take every color/font/duration/easing from the project's **token system**
   — never invent one-off values. If the project has none, create tokens first.
3. Check [genre-grammar.md](genre-grammar.md) for where this element
   conventionally lives and how it behaves. Convention is free usability.

**While building:**
- Every interactive element: idle / hover / press / disabled-with-reason.
- Every state change the player cares about gets ≥2 feedback channels
  (motion + sound, flash + number). Timings in [juice.md](juice.md).
- Every string is player-fiction: no codenames, no internal ids, no
  "Press X to…" as body copy, no truncation with real content.
- Panels are physical objects (material, bevel, texture, corner treatment) —
  recipes in [materials.md](materials.md).
- Screens transition (150–400ms, transform+opacity); nothing hard-cuts or pops.

**Before claiming done — the Iron Rule:**

```
NO PLAYER-FACING CHANGE IS DONE UNTIL YOU HAVE LOOKED AT IT RENDERED.
```

1. Run the game and **screenshot every surface you touched** (each state:
   idle, hover, targeting, empty, error — not just the happy path).
2. **1-second glance test**: from the screenshot alone, can you state what
   matters and what to do next? Could this frame be mistaken for an admin
   dashboard or a browser page? If yes, find the leak.
3. Sweep the [signals.md](signals.md) checklist against the screenshot.
   Fix, re-render, re-shoot. The screenshot is the deliverable evidence.

## Quick reference — the ten loudest amateur signals

| Signal | Professional replacement |
|---|---|
| Web-form buttons (rounded rect + 1px border) | Buttons made of the game's material (forged metal, parchment tab) with bevel/texture and full state set |
| Placeholder content player-visible (codename title, initials-as-portrait, empty art wells) | Display-name layer; designed fallbacks; fill or remove the well |
| Truncated/overflowing labels | Design for the longest string; resize, wrap, or rewrite |
| OS scrollbars, text selection, I-beam cursor, `title=` tooltips | Themed thin scrollbars or edge fades; `user-select:none`; styled Tooltip |
| Empty states as italic text ("No items") | Dimmed illustrative silhouette + in-voice copy + pointer to the filling action |
| Hard cuts between screens/panels popping in | 150–400ms enter (decelerate) / faster exit (accelerate), staggered children |
| Everything equally lit/saturated | Saturation = importance; one accent "act here" glow per screen |
| Elements floating unanchored in dead space | Pin to edges/corners on one spacing scale; group into panels; compose negative space with art/atmosphere |
| Data as spreadsheet (comma-joined lists, label:value rows, CRUD tables) | Master-detail with icons and one primary action; show outcomes, not components |
| Identical treatment for unequal actions (3 button styles for 3 equal actions, or 1 style for primary+cancel) | Exactly one primary per view; secondary/ghost for the rest — consistently |

## Rationalizations — all mean STOP and run the Iron Rule

| Excuse | Reality |
|---|---|
| "The tests pass, so the UI works" | Tests check logic. Amateur-looking UI passes every test. Look at it. |
| "It's a small change, no need to screenshot" | Truncated titles and overlaps ship exactly this way. 30 seconds. |
| "I followed the design tokens, it must look right" | Tokens can't see collisions, dead space, or clipping. Look at it. |
| "I'll polish it later in a dedicated pass" | Later never has context on what you just changed. Shoot it now. |
| "The screenshot loop is expensive" | One playtest complaint costs more than every screenshot combined. |
| "I can't run the game right now" | Then the change isn't verifiable and isn't done. Fix the loop first. |

## Supporting files

- [signals.md](signals.md) — full amateur-signals checklist (typography, web
  leakage, components, motion, layout, AI-tells), each with the pro alternative.
- [materials.md](materials.md) — CSS recipes: 9-slice frames, stacked-shadow
  fillets, corner jewelry, feTurbulence textures, inner light, engraved-gold
  text, font pairings that read "game", color-system contracts (rarity/element).
- [juice.md](juice.md) — motion & feedback catalog with concrete durations/
  easings: press feedback, HP ghost-trail, damage popups, hitstop, screenshake
  tiers, phase banners, ambient motion budgets, reduced-motion rules.
- [genre-grammar.md](genre-grammar.md) — layout conventions of tactical RPGs
  (ranges, forecasts, phase banners, danger zones) and deckbuilders (card
  anatomy, fan hands, energy orbs, targeting arrows, pile affordances,
  reward rituals).
- [project-hooks.md](project-hooks.md) — how this binds to THIS repo
  (FE_MB `phaser/`): token locations, material rules, screenshot loop,
  known drift points. Read it before touching `phaser/src/ui` or BoardScene.
