# Materials — panels, typography, color (CSS-achievable, zero external assets)

Why game panels don't look like web cards: a web card is a flat rectangle
(solid fill, uniform 1px border, uniform radius, one drop shadow). A game
panel is a **physical object**: it has a material, a light source, wear, and
craftsmanship. Reference points: Darkest Dungeon, Diablo IV, Slay the Spire,
Baldur's Gate 3, Octopath Traveler.

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

### 1.4 Inner light — panels are lit from the scene
```css
/* recessed well (inventory slot, portrait frame) */
box-shadow: inset 0 2px 8px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.05);
/* torchlit interior */
background: radial-gradient(120% 90% at 50% 0%, rgba(255,170,60,.10), transparent 60%), #17120c;
/* "playable now" pulse */
.playable { box-shadow: 0 0 12px 2px rgba(120,220,120,.55); animation: pulse 1.6s ease-in-out infinite; }
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
Parchment text = warm near-black `#2a2118` on `#e4d5b0` — never #000 on #fff.

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
- **Tint by state, not per-icon**: base = bone/parchment ink; buff = gold glow,
  debuff = sickly green/purple, disabled = 40% + desaturate. Use
  `filter: drop-shadow(0 0 4px var(--glow))` (follows silhouette; box-shadow doesn't).
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

```css
/* 1. Vignette — cheapest atmosphere win */
.vignette { position:fixed; inset:0; pointer-events:none;
  background: radial-gradient(ellipse 120% 100% at 50% 45%,
    transparent 55%, rgba(0,0,0,.35) 78%, rgba(0,0,0,.72) 100%); }
/* 2. Color-grade wash — unifies disparate art */
.grade { background: rgba(180,120,40,.05); mix-blend-mode: overlay; }
/* 3. Film grain — §1.3 turbulence at opacity .04–.06 */
/* 4. Ember motes — 2-3px radial dots, translateY(-100vh) + flicker, 12-20s staggered */
/* 5. Hover = light response, never web-blue: */
.btn:hover { box-shadow: inset 0 0 12px rgba(255,180,80,.18),
  0 0 10px rgba(255,170,60,.30); border-color: var(--frame-hi); }
```

## 6. Web habit → game replacement cheat sheet

| Web habit | Game replacement |
|---|---|
| 1px grey border | double metal fillet w/ dark seam (stacked inset shadows) |
| border-radius everywhere | notched/mitred corners + corner rivets |
| flat hex background | material gradient + turbulence grain |
| outward drop shadow only | + inner recess or inner glow |
| Inter/Roboto | Alegreya/EB Garamond body + Cinzel/Grenze display |
| #fff text | warm bone #e8ddc4; gold-gradient headers |
| blue focus ring | torchlight glow |
| hairline divider | fading gradient rule + center fleuron |
| Heroicons | silhouette icons in shaped sockets |
| full brand palette | desaturated base + 2–3 rationed accents + rarity/element contracts |
| no atmosphere | vignette + grade + grain overlays |
