# Genre grammar — tactical RPG + deckbuilder conventions

Convention is free usability: players arrive already knowing this language.
Sources: Into the Breach GDC postmortem, FE 3H/Engage, Triangle Strategy,
Wildermyth, Tactics Ogre Reborn; StS, Monster Train, Inscryption, Balatro.

## Tactical grid combat

### Turn structure decides the UI
- **Team-phase games (FE, ItB, Wildermyth)** — no turn-order widget. The
  load-bearing UI: phase banner between sides, **acted-units grey out**, and
  danger-zone overlays (whole enemy team moves at once → aggregate threat view).
- **Individual-initiative games (Triangle Strategy, Tactics Ogre)** — a
  portrait turn-order strip pinned to a screen EDGE (bottom or right), left =
  next; it visibly re-sorts on speed changes/deaths. Never over the board.

### Grid overlay color vocabulary (near-universal)
- **Blue** = my movement range · **red** = attack range/fringe ·
  **purple** = enemy threat ("move here = get hit") · **yellow** = AoE preview
  · **green** = heal/support range.
- Flat translucent quads ~35–50% alpha with a brighter 1px border; subtle
  pulse, no hard animation (they persist for seconds).
- Contrast-test the move-vs-threat pair at a glance (Triangle Strategy had to
  patch theirs). One hue must never mean two things.
- **Movement path arrow**: thick bent arrow along the exact walk path,
  updating per hovered tile — the commitment preview.
- Danger zones need BOTH granularities: per-enemy pin ("watch this archer")
  and global toggle ("show the whole no-go region").

### Threat telegraphy (the Into the Breach standard)
Deterministic intent drawn ON THE BOARD: line/arc from enemy to target tile +
attack-type icon on the tile; resolution order as numerals on demand; full
consequence preview (damage numbers, push arrows) before commit; generous
undo. ItB deliberately constrained game design (3 attack types, orthogonal
only) to keep the board readable — "the grid IS the UI."

### Attack forecast (the FE commit gate)
- Appears after target selection, before confirm. **You on the left, them on
  the right**, mirrored columns, numbers center-aligned for row comparison.
- Content: portraits, names, damage, HP → predicted HP, hit%, crit%, ×2 badge.
  **Outcomes, never formulas** ("7 dmg ×2, 84%, HP 30→16" — not "Atk 21 − Def 14").
- It's a decision surface: swapping weapon/card live-updates the numbers.
- Deterministic games: prefer ItB-style predicted-HP deltas painted on the
  board units over a modal panel.

### Layout map (why things sit where they sit)
| Region | Contents |
|---|---|
| Bottom-left | Your unit card (portrait, HP, weapon) — "self" corner |
| Bottom-right / opposite | Enemy card during targeting; End Turn |
| Top-left | Terrain/passive reference info |
| Top-right | Query-on-demand tools (attack order, objectives) |
| Top-center | The one global "score" (if any) |
| Bottom edge strip | Turn-order bar or card hand — sequential content reads as a timeline |
| Screen center | NOTHING persistent. The board. Banners/forecasts intrude only as interrupts |

### Other load-bearing conventions
- Action menu pops ADJACENT to the unit after move placement (side with room),
  frequency-sorted, Wait last; every step reversible (B-cancel stack) until
  the final confirm.
- Selection feedback + range paint on the SAME frame as the click (<100ms).
- Terrain info: tiny always-on corner panel for the hovered tile, toggleable.
- Enemy turn: camera-follow + brief highlight per actor, ≤~1s each or
  accelerable/skippable; player-taken damage is the LOUDEST feedback channel.
- Phase banner = the state-machine boundary (input lock, camera handoff,
  audio sting). See juice.md for timings.

## Deckbuilder card game

### Card anatomy (StS canonical, top→bottom)
Cost gem (top-left, over the frame corner) → name plate → art window (~45%) →
type line → rules text (~35%). **Frame color = card type; frame material =
rarity** — two orthogonal facts, zero text. Upgrades diff visibly (green name+,
changed numbers highlighted). Description numbers are LIVE-COMPUTED for
current state ("Deal 9", not "Deal 6 (+3 Str)"). Card text density trades off
against idle animation: text-heavy cards stay still (Hearthstone rule).
Minimal-text cards (Inscryption/Balatro) can afford constant physical motion.

### Hand
Shallow fan arc (rotation ~5°/card, cosine y-drop), overlap compresses with
hand size, positions lerped never snapped. Hover: straighten + scale ~1.2 +
lift above fan + neighbors part + z-top. Support click-to-play,
hover-to-inspect, drag-to-target simultaneously. Fan works to ~10 cards.

### Energy/AP
One large themed orb/counter ADJACENT TO THE HAND (where the eye already is),
`current/max`. Pips make affordability arithmetic visual. **Unaffordability
shows on the cards too** (red-tinted cost gem / desaturated card), not only
on the meter.

### Targeting
Bézier arrow from card (docked at a fixed staging slot) to cursor, built from
15–20 triangle segments rotated to the tangent, growing toward a big arrowhead;
curve arcs over the battlefield. Target under cursor gets outline/brighten.
Oversized hitboxes + wide enemy spacing — targeting must never feel finicky.
Non-targeted cards use a drop-zone threshold line. Let players queue the next
card while animations resolve — responsiveness > animation completion.

### Piles
Draw bottom-left, discard bottom-right, icon + big count badge, click = full
sorted grid. Cards VISIBLY FLY to/from the piles (60ms stagger, streak trails)
— the travel animation is how players learn the economy. Exhaust/destroy gets
a distinct dissolve + sound.

### Rewards
Claim one line at a time (each with its own sound/flair — a ritual, not a
dump). Pick-1-of-3 with **Skip as a first-class button**. Rarity announced by
frame glow/beam before text. Shop items bounce in with staggered spring drops.

## Overworld / menu screens (supporting grammar)

- Title screen: key art or an animated scene, a wordmark (not a boxed form
  field), ONE primary action, quiet secondaries. Dead black = unfinished.
- Town/shop: master-detail (stock list + inspect pane + one Buy), merchant
  presence/flavor, grouped stock with sticky headers, themed scroll.
- Arrival at a place: a moment (name flourish, illustration, ambient sound),
  not a context menu.
- Game over / victory: a scene with mood (vignette, art, music sting), stats
  as a designed tally, one primary next action.
