# Materials — panels, typography, color (CSS-achievable, zero external assets)

Why game panels don't look like web cards: a web card is a flat rectangle
(solid fill, uniform 1px border, uniform radius, one drop shadow). A game
panel is a **physical object**: it has a material, a light source, wear, and
craftsmanship. Reference points for *construction*: Darkest Dungeon, Diablo IV,
Slay the Spire, Baldur's Gate 3, Octopath Traveler.

> **HOUSE RULE (FE_MB, 2026-08-28) — construction yes, lighting no.**
> The recipes below are generic craft. This project's light model is
> **"Field Ledger"** (`docs/superpowers/specs/2026-08-28-ui-retheme-field-ledger-design.md`):
> a quartermaster's ledger and camp table **in daylight**, two grounds —
> **canvas = read, leather = act**. **Nothing glows.** Wherever a recipe here
> reaches for a torch, an ember, a halo or a vignette, take the *construction*
> (bevel pair, seam, texture, socket, silhouette) and drop the *emission*.
> Rows tagged **⚠ house rule** below are the ones that conflict.

## 1. Panel construction

### 1.1 The border is an object, not a line
- True 9-slice: author the frame (corner flourish + edge bar) as one small
  inline SVG and use `border-image: url("data:image/svg+xml,...") 24 / 24px round;`
  — the single highest-leverage "looks like a game" technique.
- Poor-man's multi-material frame — **stacked box-shadow fillets** (the exact
  BG3/Diablo idiom: two hairline metallic lines separated by a dark seam):

```css
.panel {
  background: #1a1612;
  border: 1px solid #0a0806;                 /* outermost dark seam */
  box-shadow:
    inset 0 0 0 1px #4a3b28,                 /* inner bronze fillet */
    inset 0 0 0 2px #0a0806,                 /* seam */
    inset 0 1px 0 3px rgba(255,220,150,.07), /* top bevel catchlight */
    0 8px 24px rgba(0,0,0,.6);               /* drop into the scene */
}
```

### 1.2 Corner jewelry breaks the rectangle
Pro panels never have four identical rounded corners — they have rivets,
notches, clasps, filigree.
- Notched corners: `clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, …)`
  (clip-path clips box-shadow — put the shadow on a wrapper).
- Rivets: `::before/::after` 6px circles of
  `radial-gradient(circle at 35% 35%, #cfa85a, #4a3b28 70%)` in the corners.

### 1.3 Texture, never flat fill
Low-contrast (±3–5% luminance) — felt, not seen. SVG turbulence data-URI:

```css
.panel::after {
  content:""; position:absolute; inset:0; pointer-events:none; opacity:.06;
  mix-blend-mode:overlay;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```
`baseFrequency`: `0.9` paper · `0.04 0.09` (anisotropic) brushed metal/wood ·
two layers (fine + coarse at .03) = stone.

### 1.4 Inner light — panels are lit BY the scene, and they never emit
The principle is one light source and a material that responds to it. What
changes between games is *which* light. Pick one and derive every panel from
it — mixing torch-glow panels with daylight panels is the tell.

```css
/* recessed well (inventory slot, portrait frame) — universal */
box-shadow: inset 0 2px 8px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.05);
```

**The FE_MB pair — two grounds, one daylight key (high, from the left).**

```css
/* PAGE — a linen ledger sheet on the camp table. What you READ.
   Flat ink rules, a dashed tooled edge, a hairline paper-white inner lip,
   and a short contact shadow that seats it on the table. No inner glow. */
.page {
  background: linear-gradient(180deg, #e7dec9 0%, #ddd2b8 72%, #cbbc9c 100%);
  border: 1px dashed rgba(42,33,25,.28);
  box-shadow: 0 1px 2px rgba(30,20,10,.28),        /* contact, not float */
              inset 0 0 0 1px rgba(255,252,244,.5); /* paper lip */
  color: #2a2119;                                   /* walnut ink */
}
/* FIELD — a saddle-leather strap. What you ACT ON. Leather sits flat and
   takes a HARD edge: a top catchlight, an under-seam, a short shadow. */
.strap {
  background: linear-gradient(158deg, #4a3421 0%, #1c140d 100%);
  border: 1px solid rgba(28,18,9,.9);
  box-shadow:
    inset 0 1px 0 rgba(214,178,108,.26),   /* catchlight — 1px, not a bloom */
    inset 0 -2px 5px rgba(0,0,0,.5),       /* under-seam */
    inset 0 0 0 5px rgba(176,138,62,.30),  /* tooled brass line inside the edge */
    0 3px 8px rgba(0,0,0,.42);             /* contact shadow */
  color: #f1e9d8;                          /* bone */
}
```

The two grounds are a seam on purpose: **the page describes the field.** The
one primary action on a page is the one piece of *leather* on it — that is how
you direct the eye without light.

**⚠ house rule — the "playable now" pulse.** A `0 0 12px` emissive halo is the
retired candle-lit idiom. Signal availability with **material and edge**
instead: a brass edge the disabled state doesn't get, plus a second
non-colour channel (a filled pip, a rivet, a label). Reserve motion for the
moment something *changes*, not for an idle state.

```css
.playable   { border-color: #b08a3e; box-shadow: inset 0 1px 0 rgba(230,200,135,.34); }
.playable[data-disabled] { opacity:.52; filter:saturate(.35); box-shadow:none; }
```

### 1.5 Bevel pair — one global light source (top/top-left)
```css
border-top: 1px solid rgba(255,235,190,.14);
border-bottom: 1px solid rgba(0,0,0,.65);
/* metal fillet strip: two-tone break at ~50% sells "reflective" */
background: linear-gradient(#f5dea0, #b98a2e 45%, #6e4c14 55%, #d9b45e);
```

### 1.6 Silhouette irregularity
One non-rectangular element kills the dashboard read: a header plate
overhanging the panel (negative margin + own frame), a banner with a chevron
tail (`clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 10px), 0 100%)`),
a portrait breaking the frame.

## 2. Typography

### 2.1 The two-font contract
The display font carries 90% of the genre feel; the body font carries 100% of
legibility. Darkest Dungeon pairs a distressed gothic display with plain
Ubuntu body — nobody notices, body text should disappear. Diablo IV's beta
shipped a neutral sans UI and the community revolted ("sterile"); Blizzard
swapped to a serif before launch — font choice is CONTENT in fantasy.

Free faces that read "game" (dark fantasy):
- **Display:** Cinzel (epic inscriptional), Grenze Gotisch (blackletter-ish,
  readable), IM Fell (authentic ink-bleed, parchment lore), Metamorphous
  (carved stone), Almendra (calligraphic, has small caps), Marcellus (quiet
  alternative). Logo-only: Cinzel Decorative, Pirata One.
- **Body:** Alegreya (+SC, the strongest free "fantasy book" face), EB Garamond
  (parchment/lore), Vollkorn (holds up on dark better than Garamond — thin
  serifs vanish on dark), Kreon (the actual StS slab — great on cards).
- **Numbers:** tabular always; slab or condensed sturdy face.
- **Avoid:** Papyrus, Lobster, LOTR-clone faces, thin geometric sans on dark
  fantasy, ornate faces below ~16px, distressed faces for body.
- **Self-host fonts** for shipped games — CDN fallback flashes Georgia.

### 2.2 Finishing moves — text as a rendered object
```css
/* StS card-title treatment */
.card-title { -webkit-text-stroke: 1px rgba(0,0,0,.85);
  text-shadow: 0 2px 2px rgba(0,0,0,.7); paint-order: stroke fill; }

/* Engraved gold header (Diablo/BG3) */
.gold {
  background: linear-gradient(#f8e7b0 20%, #d4af5a 45%, #8a5a1a 55%, #e8c874 80%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.9)) drop-shadow(0 0 6px rgba(255,200,90,.25));
}

.label { font-variant-caps: small-caps; letter-spacing: .08em; }
h1 { text-transform: uppercase; letter-spacing: .12em; }
```
**⚠ house rule** — keep the gold-gradient *fill* and the 1px dark drop for
bite; drop the second `drop-shadow(0 0 6px …)` (that is the bloom). On a page,
skip the gradient entirely: a title is stamped walnut ink between two flat ink
rules, and it carries by size, tracking and the display face alone.
Page text = warm near-black on warm off-white — never #000 on #fff. FE_MB's
live pair is walnut ink `#2a2119` on linen `#e7dec9` (11.8:1), with
`#57493a` for secondary and `#5e5040` for muted. Check small text against
BOTH the top and mid stops of a page gradient, and keep muted text out of the
bottom deep band (it measured 4.16:1 there — below AA).

### 2.3 HUD hierarchy — role-coded treatments, not a type scale
1. **Numbers biggest and instant** — damage/HP/cost are the largest text on
   any combat element, colored + outlined; words don't compete.
2. Names in the display face, small-caps/caps + tracking.
3. Keywords inline-colored (`<span class="kw">`) matching icon/glow hues.
4. **3 sizes max per panel** (title / body / flavor).
5. **Dim, don't shrink** — secondary info drops contrast, not size.
6. Ornamental separators: gradient hairline fading at both ends + center
   fleuron, instead of solid borders.

## 3. Iconography

- **Silhouette-first**: fill it solid black — still recognizable at 24px?
  Design at final size. game-icons.net (CC-BY, 4000+) is genre-correct and
  consistent by construction; Feather/Heroicons read SaaS.
- One shape language, one stroke weight. Mixing outline + filled = amateur tell.
- Icons sit in **shaped sockets** (circle = status, diamond = slot, shield =
  defense) with the recessed-well inset shadow; the container is semantic.
- **Tint by state, not per-icon**: base = the ground's own ink (bone on
  leather, walnut on canvas); buff = gold, debuff = sickly green/purple,
  disabled = 40% + desaturate. **⚠ house rule:** tint with flat colour, not
  emission — `filter: drop-shadow(0 0 4px …)` is a glow and is out. If a state
  needs to shout, give it a shape or a socket change as well as a hue.
- Stat rows: `icon + bold tabular value`, value right of icon — `⚔ 12` reads
  faster than "Attack: 12".

## 4. Color systems

### 4.1 Near-monochrome base + rationed accents
All reference games: environment/chrome ≤ ~20% saturation; 2–3 saturated
accents spent ONLY on decisions/importance. **Saturation = interactivity.**

```css
:root {
  --void:#0b0908; --panel:#1a1510; --panel-raised:#241d15;
  --frame:#4a3b28; --frame-hi:#8a6f42;
  --ink:#e8ddc4; --ink-dim:#a3937a; --ink-faint:#6b5f4d;
  --gold:#d4af5a; --blood:#a32c22; --arcane:#5a8fd4; --venom:#6f9c3f;
}
```

**⚠ house rule — "saturation = interactivity" holds, but FE_MB spends it as
MATERIAL, not light.** The live values are in `phaser/src/index.css`; do not
copy the block above into the project. The rationed accent is struck brass
(`#d9a93f` / edge `#b08a3e`), and it appears as fills, edges, rivets and rules
— one per screen, never bloomed, and never as small text on a light page (raw
brass is ~3.2:1 on linen; the page scope swaps in a dark, AA-safe brass).

### 4.2 Semantic color is a contract players already know
- **Rarity:** grey/white → green → blue → purple → orange/gold. Keep rarity
  hues OFF the damage-type palette. Rarity = name color + edge accent, never
  a full bright outline (reads as form validation).
- **Damage/element:** physical bone/red, fire orange-red, cold/arcane blue,
  poison green, holy gold-white, shadow purple. Buff green/gold, debuff purple/red.
- Apply the SAME hue for a concept across every surface: keyword text = icon
  tint = glow = floating number. Cross-surface consistency is what reads "pro".
- Warm-shift and desaturate accents vs web-brand colors (rare blue `#5a8fd4`,
  not `#3b82f6`) so they sit inside the palette.

## 5. Atmosphere layers (fixed, pointer-events:none overlays)

Atmosphere is a *ground*, not a spotlight. Two of the four classic layers below
are direction-dependent — pick them to match your light model, not by habit.

```css
/* 1a. ⚠ house rule — VIGNETTE IS OUT for FE_MB. A radial darkening is the
       torch-in-a-crypt idiom; under an open sky it just reads as a dirty lens.
       Frame with material instead: the page is an OBJECT on a table, narrower
       than the stage, with the table visible either side of it. */
/* 1b. Daylight wash — the FE_MB replacement. Light FALLS from the top; it
       never pools at a point and never emits from a panel. */
.daylight { background: linear-gradient(180deg,
  rgba(255,248,228,.16) 0%, rgba(255,248,228,.05) 40%, transparent 70%); }
/* 2. Color-grade wash — unifies disparate art (keep; warm and very low) */
.grade { background: rgba(180,120,40,.05); mix-blend-mode: overlay; }
/* 3. Film grain — §1.3 turbulence at opacity .04–.09, over CHROME and PAGE
      grounds only. Never over numeric data. */
/* 4. Motes. The generic recipe is 2–3px radial dots on translateY(-100vh),
      12–20s staggered — that part is sound. What they ARE is the decision:
      ⚠ house rule — NOT embers (embers imply fire, and there is no fire in
      Field Ledger). They are DAYLIGHT DUST lifting off a camp track: pale
      warm-white, no flicker, opacity peaking ~.34 then fading, transform +
      opacity only, gated by prefers-reduced-motion. Same motion contract,
      different fiction — keep the keyframe, change the colour and drop the
      flicker. */
/* 5. ⚠ house rule — hover is a light response in torch games; here it is an
      EDGE response. Never web-blue, and never a halo: brighten the catchlight
      and bring the brass edge up. */
.btn:hover { border-color: rgba(176,138,62,.85);
  box-shadow: inset 0 1px 0 rgba(230,200,135,.30),
              inset 0 -2px 4px rgba(0,0,0,.40), 0 2px 5px rgba(20,13,6,.45); }
```

## 6. Web habit → game replacement cheat sheet

| Web habit | Game replacement |
|---|---|
| 1px grey border | double metal fillet w/ dark seam (stacked inset shadows) |
| border-radius everywhere | notched/mitred corners + corner rivets |
| flat hex background | material gradient + turbulence grain |
| outward drop shadow only | + inner recess or inner glow |
| Inter/Roboto | Alegreya/EB Garamond body + Cinzel/Grenze display |
| #fff text | warm bone #e8ddc4 on dark; warm near-black on a light page |
| blue focus ring | a ring in the game's own metal (FE_MB: dark halo + brass, `--focus-ring`) — ⚠ house rule: a ring, not a torch glow |
| hairline divider | fading gradient rule + center fleuron (FE_MB: a flat ink rule on canvas, a dashed stitch line on leather) |
| Heroicons | silhouette icons in shaped sockets |
| full brand palette | desaturated base + 2–3 rationed accents + rarity/element contracts |
| no atmosphere | grade + grain overlays, and ONE light model applied everywhere — ⚠ house rule: for FE_MB that's a top-down daylight wash, **not** a vignette |
| directing the eye with a glow | ⚠ house rule: direct it with MATERIAL — one leather primary on a canvas page, everything else recedes to ghost |
