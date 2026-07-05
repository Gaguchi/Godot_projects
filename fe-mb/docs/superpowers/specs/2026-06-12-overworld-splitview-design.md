# Overworld Split View — "The Trail and the Map" (2026-06-12)

> Supersedes the *rendering* decisions of `2026-06-06-overworld-grounding-design.md`
> (the painterly backdrop-as-navigation-substrate is retired). The systems layer
> (route planning, encounter rolls, food-per-hop, quick-action menu) is unchanged.

## User direction (verbatim intent)

"A split view of the map and a sideview like in Oregon Trail." Two surfaces, both
always visible:

1. **Travel band** (top) — a side-view landscape. You *watch* the party caravan
   walk: parallax scenery scrolls by while traveling, stands still while idle.
   Pure feedback/flavor — zero interaction.
2. **Paper map** (bottom) — the interactive navigation surface. Parchment,
   hand-inked roads, cartographer's sigils. All planning/clicking happens here.

This is the Oregon Trail anatomy: scene on top, instrument below.

## Layout (stage 1280×720)

| Zone | Y range | Height | Notes |
|---|---|---|---|
| Travel band | 0–264 | 264 | full width; top HUD bar overlays it |
| Seam | 264–276 | 12 | carved desk-edge divider; casts shadow onto map |
| Paper map | 276–720 | 444 | full-bleed parchment; pans X only |

- Party roster panel docks on the MAP zone (left, below seam), not over the band.
- Map surface stays 2120 wide; node Y respread from [150,620] → [70,380], map
  `height` → 444. Camera pans X only, clamped to [1280−2120, 0].

## Travel band internals (band-local coords, h=264)

- **Far layer**: the baked region vista (`public/art/backdrops/*.png`) as a
  mirror-tiled horizontal strip (img, img-flipped, img…) so the scroll loop is
  seamless by construction. Scroll ≈8 px/s when traveling.
- **Mid layer**: deterministic region silhouettes (SVG tile, 640 wide, repeated):
  borderlands = rolling grass hills + lone trees; thornwood = dense spiked
  spruce treeline; ashfall = jagged rock spires + ember glow dots. Sits around
  y 140–215. Scroll ≈30 px/s.
- **Ground strip**: y 204–264. Dark soil gradient, a lighter worn road track
  ~y 228–244 with wheel-rut dashes, sparse tufts/stones. Scroll ≈80 px/s.
- **Caravan**: anchored at x≈400, feet baseline y≈240. Near-black silhouette
  (#16100a): draft horse + covered wagon, spoked wheels, 2 walking figures
  behind. A lantern hangs off the wagon — warm glow (`--color-hearth`),
  flickering. Traveling: wheels rotate, figures bob, whole group gentle walk-bob.
  Idle: everything stops except lantern flicker + a 2px breathing bob.
- **Atmosphere**: region fog drift (existing turbulence technique, tinted);
  ashfall adds drifting ember motes. Vignette at band edges.
- **Direction**: `direction: 1 | -1` flips scroll direction and mirrors the
  caravan (journey can head back west).
- All animation = CSS keyframes toggled with `animation-play-state` — no rAF
  loops for the band. Deterministic positions via hash (Math.random is banned).
- Band art lives in `src/ui/screens/overworld/TravelBand.tsx` + `bandArt.ts`;
  keyframes in a NEW `overworld-band.css` imported by TravelBand (index.css has
  unrelated uncommitted WIP — do not touch it).

## Paper map restyle (the war-map surface)

- **Surface**: reclaim `PaperMap.tsx` (parchment + biome ink symbols + double
  border + compass). It fills the whole map zone — viewport crops the sheet, so
  no "floating sheet in a void". The burnt-edge vignette only shows at sheet
  ends = edge of charted territory.
- **Roads**: replace the carved-ditch casing with hand-inked cartography:
  dashed ink strokes (the classic travel-map dotted line) with a light
  hand-wobble displacement. States: distant = ink dashed 45% opacity;
  reachable/adjacent = ink dashed full; hover = solid thin mid-ink; planned =
  wet-ink overdraw in route red (`accent`); active hop = solid route red +
  ember comet. Keep `OverworldRoads`/`roadStyle` public APIs; add `palette`.
- **Nodes**: keep `NodeBeacon` structure (ground-seat + parchment disc + ink
  sigil + ping). Tune for parchment: sepia contact shadow (not black), ink
  rings, wax-red current marker. Add `palette` prop.
- **Labels**: ink-colored hand-lettered (voice-display), parchment-light halo —
  NEVER white text with black shadow on parchment.
- **Region identity = ink palette swap** (single source:
  `src/ui/screens/overworld/palette.ts`): borderlands sepia/warm; thornwood
  green-black ink on cooler parchment; ashfall scorched ink, charred parchment,
  ember-red accent.

## Retired

- `Backdrop.tsx`, `ValueMaskLayer.tsx` (delete; backdrops move to the band).
- The staged dark field + atmosphere gradients in OverworldScene's map area.
- White-on-map label text.

## Unchanged

- All runStore actions, encounter rolls, multi-stop route planner, quick-action
  menu, hover cost tooltip, GameHud top bar, dialogue/check-event modals.
- ComfyUI pipeline: the band's far layers reuse the existing bakes now; a later
  pass can re-bake layer-separated side-view plates per region.

## Verification

`npm run verify` green; Playwright screenshots of all 3 regions, idle + traveling.
