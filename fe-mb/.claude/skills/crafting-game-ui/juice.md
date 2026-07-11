# Juice — motion & feedback catalog (React DOM + CSS + Phaser tweens)

Sources distilled: "Juice it or lose it" (Jonasson/Purho), "The Art of
Screenshake" (Nijman/Vlambeer), *Game Feel* (Swink), fighting-game hitstop
analyses, Balatro source breakdowns.

## Meta-rules

1. **The 100ms rule**: response to input must BEGIN within ~100ms or it reads
   as lag. Fire every effect on the exact event frame; the tail can be long,
   the attack must be instant. (ADSR: fast attack, slow release → ease-out.)
2. **Transform + opacity only** in DOM (compositor-friendly); never animate
   top/left/width/height.
3. **Juice amplitude ∝ gameplay meaning.** Reserve the big effects (long
   hitstop, zoom, flash, slow-mo) for kills/crits/player-death. If everything
   is loud, nothing is.
4. **Enter decelerating, exit accelerating** — and exits are FASTER. Never
   overshoot on exit.
5. Provide a reduced-motion path (collapse duration tokens, kill loops).
6. One cheap primitive applied universally beats many bespoke effects —
   Balatro's `juice_up` = decaying sinusoidal wobble on scale+rotation
   (~0.4s, `sin(t·f)·e^(-t·d)`) used on EVERYTHING that changes.

## Cheat sheet

| Event | Duration | Easing | Notes |
|---|---|---|---|
| Button press-down | 40–80ms | ease-out | on POINTERDOWN, scale 0.96–0.97 |
| Button release | 150–250ms | back-out | overshoot to ~1.02 |
| Tooltip in / out | 120–150 / 90ms | cubic-out / cubic-in | fade + 8px rise |
| Panel in / out | 180–250 / 120–160ms | quint-out / cubic-in | translateY 12–24px, never full-width travel |
| Modal in / out | 250–300 / 150–200ms | expo-out / cubic-in | scale 0.96→1 |
| Reward / hero moment | 350–450ms | back-out (~1.05) | + 30–60ms child stagger, cap total ~300ms |
| Card hover lift | 150ms | cubic-out | rise 8–16px, scale 1.05–1.08, z-top, neighbors part |
| Invalid action | 300–400ms | linear keyframes | ±6px decaying X-shake on the ELEMENT + 100ms red flash; never screenshake for errors |
| HP front fill | snap (≤50ms) or 80–120ms | cubic-out | cost registers on the impact frame |
| HP ghost trail | hold 300–500ms, drain 400–800ms | cubic-in-out | white/pale segment behind fill; re-hold if hit again; invert (ghost leads) for heals |
| Damage popup | 600–1200ms total | spawn back-out 1.4→1.0; float ease-out or ballistic arc | ±8–16px x-jitter; fade last 200–300ms; 1–2px dark outline always |
| Crit popup | +hang time | bigger overshoot 2.0→1.1 | 150–200% size, yellow/orange; weight = slowness |
| Hitstop | light 0–40 / std 60–80 / heavy 100–150 / kill 150–250ms | timeScale dip, ramp back 100ms | freeze actors, keep UI+particles running |
| Victim flash | 50–80ms | tint fill white | 1–2 frames, on impact |
| Knockback | 80–120ms + return | cubic-out | 4–10px opposite the hit |
| Screenshake | small 100ms/0.003 · big 200–300ms/0.008–0.012 | decaying random | Phaser `camera.shake(d, i)`; rotational ±1–2° reads more violent; shake canvas+HUD together (HUD-only reads as a bug) |
| Camera kick | 120–180ms | cubic-out return | 4–8px directional, away from impact — reads recoil, not earthquake |
| Phase banner | in 150–250 / hold 500–700 / out 150–200ms | expo-out / linear drift / expo-in | see grammar below |
| Number counters | duration ∝ magnitude | per-digit roll, ~50ms stagger | numbers never snap (Balatro DynaText) |
| Ambient loops | 2–8s, co-prime periods | sine in-out | amplitude ≤3% scale / ≤2px; felt not seen |

## Recipes

### HP bar ghost trail (pure CSS, no JS timer)
Two stacked fills. Front: `transition: width 100ms cubic-bezier(.33,1,.68,1)`.
Ghost: `transition: width 600ms cubic-bezier(.65,0,.35,1) 350ms` — the 350ms
delay IS the hold. Kill/restart the ghost transition if a second hit lands.
At <25% HP: pulse fill opacity 1→0.7→1 (~800ms loop) + hue toward red.
Flash the bar container white 60–100ms at the damage moment.

### Damage popup color contract
white/off-white = your damage · yellow/orange bigger = crit · red + larger +
steeper = damage TAKEN (safety-critical channel) · green slower drift = heal ·
grey italic = MISS. Blocked: number shrinks into a shield icon. Cap ~8–10
simultaneous; aggregate beyond ("×5"). Multi-hits stagger left→right — a
legible drumroll, not simultaneous math (the most-copied Balatro pattern).

### Phase banner (FE grammar)
Full-width band across the vertical center; ribbon (30–40% black) fades in
100ms ahead of text; text slides in expo-out, HOLDS 500–700ms with a slow
8–12px linear drift (never static) + optional shine sweep, exits same
direction expo-in. Blue/gold = player, red = enemy. Audio sting per side.
Input locked for duration minus ~200ms (let eager players buffer). Skippable.

### Button feedback (two stages)
Press on pointerdown: scale 0.96 + translateY(1px), 40–80ms ease-out — the
single highest-ROI juice in any UI. Release: spring back 150–250ms back-out.
Hover: lift −2px + shadow deepen or scale 1.03, 100–150ms in / ~80ms out (so
trails across a card hand don't smear). Disabled: NO motion — deadness
communicates unavailability.

### Cards in hand (StS/Balatro)
Fan: per-index rotation ~4–6°/card, cosine y-drop, overlap compresses as hand
grows; positions always LERPED toward slots (exponential smoothing), never
snapped — reflow is a cascade. Hover: straighten to 0°, scale ~1.2, lift above
fan, neighbors slide apart, z-top. Drag: keep grab-point under cursor, rotate
with smoothed velocity (±3–6°), settle with wobble. Draws fly from the draw
pile (60ms stagger, motion streak); discards fly out shrinking; exhaust burns
with a distinct dissolve+sound. Text-heavy cards get NO idle tilt (readability);
reserve pseudo-3D idle for art-only objects.

### Ambient motion (alive at rest)
2–4 loops at co-prime periods (2.1s + 3.7s…): candle flicker (opacity
0.85–1.0 + scale 0.98–1.03, irregular keyframes), dust/ember motes (1–3/sec,
4–8s life, slow rise, sine x-wander), breathing on portraits (scale y 1.03 >
x 1.015, phase-offset per unit), banner sway (skewX ±1.5°). If a playtester
can NAME the motion, it's too loud.

### Permanence
Corpse markers, scorch decals, cracked tiles, visible discard pile — the
battlefield should tell the story of the fight without animating anything.

## Easing tokens worth standardizing

```css
--ease-out-cubic: cubic-bezier(0.33, 1, 0.68, 1);
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);   /* "expensive" settle */
--ease-in-cubic:  cubic-bezier(0.32, 0, 0.67, 0);   /* exits */
--ease-out-back:  cubic-bezier(0.34, 1.56, 0.64, 1); /* rewards only */
```
Phaser: `Cubic.easeOut`, `Quint.easeOut`, `Expo.easeOut`, `Back.easeOut`
(pass ~1.2 for subtle UI instead of the default 1.70158).
