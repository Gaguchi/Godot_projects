# Visual Style Brief — FE_MB (phaser)

**Date:** 2026-07-06 · **Retheme applied:** 2026-08-28
**Status:** Adopted (closes Atlas story #276) — **tone sections superseded**, see below.

> ## ⚠ SUPERSEDED — the tone half of this brief
>
> **2026-08-28.** The visual identity described by the original version of this brief
> ("Stone & Steel / Forged & Lit" — weathered, lived-in, **amber-lit**, candle-lit
> dark fantasy) is **retired**. It is replaced by **"Field Ledger"**, approved
> 2026-08-28 via a rendered three-way bake-off:
>
> **→ `docs/superpowers/specs/2026-08-28-ui-retheme-field-ledger-design.md` is
> the authority. Its §1 fiction and §3 invariants are binding.**
>
> Why: the story bible (`docs/worldbuilding/story-bible.md`) locks a grounded
> Mount & Blade free-company register — earthy, gallows humour over a warm
> found-family core — and explicitly rejects the candle-lit grimdark look.
>
> **What changed:** the *skin* — the style line, the palette, the light model,
> the reference set. Everything below marked "unchanged" survived the retheme.
> **What did NOT change:** the token SYSTEM (`phaser/src/index.css`), the type
> voices, the layout grammar, the legibility contracts, the component wrappers,
> the ComfyUI character pipeline, and the iconography rules.
>
> **Do not re-introduce:** radial hearth pools, candle flicker, ember-as-fire,
> emissive rims, vignettes, glow-on-hover. *Nothing in this game glows.*

---

## The style, in one line

**Painted sprites on a trodden earth board, read from the company
quartermaster's ledger** — "Field Ledger": daylight, linen and walnut ink for
what you READ, saddle leather and struck brass for what you ACT ON. Grounded
medieval, Mount & Blade energy — working, unglamorous, warm at the centre.
Never bright/cute, never grimdark-gore, and (new) never candle-lit.

## The two grounds

The whole system is one seam, on purpose: **the page describes the field.**

| | **PAGE** (light) | **FIELD** (dark) |
|---|---|---|
| What | information you READ — title, overworld map, town, shop, tavern, quest log, loadout, save/load, dialogue | things you ACT ON — combat board + HUD, camp, dungeon, buttons, cards, straps |
| Material | linen canvas, flat ink rules, dashed tooled edge, brass pins | saddle leather over walnut, brass edges + rivets, dashed stitch headers |
| Ground | `--canvas-base #e7dec9` → `--canvas-mid` → `--canvas-deep` | `--iron-900 #1c140d` / `--iron-800` / `--iron-700 #6a4b2f` |
| Text | walnut ink `#2a2119` | bone `#f1e9d8` |
| Opt in | `.page-canvas` (whole screen) or `.surface-parchment` (a card) | `.surface-iron`, `.hud-panel`, `.btn-forged`, `.forged-card` |

Both scopes re-declare the text + HP ramp on themselves, so a component
dropped into either ground inverts automatically. **Materials act: canvas =
read, leather = act.** The ONE primary action on a page is the one piece of
leather on it — that is how the eye is directed, not with light.

The board stays dark because it is trodden earth seen from above and the
overlay grammar (move / target / danger / AoE) needs light-on-dark to read.

## Direction

- **Characters / creatures / buildings:** ComfyUI-generated painted sprites
  (SDXL `waiIllustriousSDXL_v160` + `DarkFantasy-PixelSprite` LoRA, trigger
  `DFSV1`), full-body, transparent, front-facing. One recipe = one coherent
  cast. Hand-pixeled art is **not** used for characters (procedural pixel
  toolkit rejected — kept only for tiles/icons if ever needed). **Unchanged.**
  *Tone steer for the next bake: earthy and working — mud, wool, oiled leather,
  road dust; daylight key, not torchlight. See `phaser/art/world-bible.md` §1.*
- **UI chrome:** "Field Ledger" — leather straps with brass edges and corner
  rivets (`.hud-panel`), display-serif voice for names/headers, tabular
  numerals for all stats, brass (`--color-hearth`) as the single "act here"
  accent. Brass is a **metal**: it lives in fills, edges, rivets and rules, it
  is never bloomed, and it never carries small text on a light page (the page
  scope swaps in a dark, AA-safe brass). Team is always signalled by SHAPE
  (TeamSigil) + colour, never colour alone. **Shape rule unchanged.**
- **Overworld:** Oregon-Trail split view. Top: side-view travel band under a
  daylight key (`--key-light-dx/dy` — high, from the LEFT; every grounding
  shadow derives from it). Bottom: the map as a **linen ledger page** with
  hand-inked dashed roads, ink sigil nodes, and an oxblood current marker.
  Labels are ink-on-linen — never white text with black shadow. **Unchanged
  in anatomy; re-grounded from parchment-in-the-dark to a page in daylight.**
- **Combat board:** Phaser canvas; unit sprites from the house recipe; terrain
  reads as painted ground tiles. `game/boardPalette.ts` is the ONLY colour
  module for the canvas (numeric mirror of the CSS tokens; BoardScene now
  carries zero colour literals).

## Palette

Authoritative values live in `phaser/src/index.css`; this table is the
role map. Token *names* are frozen (a numeric mirror exists in
`boardPalette.ts`), so several read oddly against their values — **read them
by role, not by noun.**

| Role | Token / hex | Use |
|---|---|---|
| Linen canvas | `--canvas-base #e7dec9` / `-mid #ddd2b8` / `-deep #cbbc9c` | the page ground |
| Walnut ink | `--color-ink #2a2119` | page text; also the darkest chrome seam |
| Bone | `--color-parchment #f1e9d8` | primary text on leather |
| Saddle leather | `--iron-700 #6a4b2f` (`-800`, `-900 #1c140d`) | chrome body, straps, card frames |
| Struck brass | `--color-hearth #d9a93f` / `--iron-edge #b08a3e` | THE "act here" accent — fills, edges, rivets, rules. One per screen. Never a halo. |
| Oxblood | `--color-ember #9a2c22` | danger fills, enemy accent, wax marker |
| Ally blue | `--color-ally #3f628a` | ally accents, movement range (4.7:1 on canvas) |
| Enemy rust | `--color-enemy #a6432f` | enemy accents, threat (4.5:1 on canvas) |
| HP ramp | `--hp-ok #5d7a33` / `--hp-warn #bd7d20` / `--hp-crit #9a2c22` | tier fills, re-derived per ground; always paired with a label/icon change |
| Gem hues | `--color-gem-attack/arcane/ward/focus` | card type — **gem SHAPE is primary**, hue secondary |
| Identity ramp | `--id-gold/steel/rose/moss/arcane/ember/slate/wine` | WHO someone is: portrait rings, name-plate rules, bust accents. Never actions, never threat. |

**Region keys** (`#a07a40` Borderlands tan · `#3a6a3e` Thornwood green ·
`#7a2010` Ashfall red) are **CONTENT**, not chrome — they are tied to the old
three-region world and are out of scope for this retheme. Revisit them with
the open-sheet map, per spec §4.

## References

Tone anchor first; the rest are craft references only.

1. **Mount & Blade (Warband / Bannerlord)** — *the* register: a free company,
   petty realms, matter-of-fact chrome, daylight. This is the tone the story
   bible locks.
2. **Battle Brothers** — a mercenary company read as a ledger: rosters, wages,
   contracts; UI that is furniture, not spectacle.
3. **Fire Emblem GBA** — cast archetypes, readable class silhouettes (homage,
   not clone). *Unchanged.*
4. **The Banner Saga** — side-view caravan travel, painted vistas, permadeath
   weight. *Unchanged (travel band).*
5. **Oregon Trail** — the split anatomy: scene above, instrument below.
   *Unchanged.*
6. **Slay the Spire** — card hand ergonomics, node-map legibility. *Craft only
   — its saturation/glow economy is not our light model.*
7. ~~**Darkest Dungeon**~~ — **RETIRED as a tone reference 2026-08-28.** It was
   the candle-lit anchor; its torch-and-shadow light model is precisely what
   Field Ledger removes. Its *panel craftsmanship* remains a fine craft
   reference (see `materials.md`), its lighting is not.

## Iconography rules — unchanged

- SVG `Icon` component only — **no emoji** anywhere in UI (enforced since
  story 283).
- Line weight ~1.5-2px at 16-24px sizes; filled silhouettes for team sigils.
- Portraits: authored sprite head/torso crop inside archetype shape
  (circle/square/hex/diamond/triangle), initials fallback.
- Icons sit in shaped sockets; the container is semantic.
- **New:** tint by state using flat colour, not `drop-shadow` glow. On a page,
  icons take the walnut ramp; on leather, the bone ramp — the ground scope
  hands them the right value automatically.

## Explicitly NOT

- ❌ **Anything that glows.** No radial hearth pools, no candle flicker, no
  ember-as-fire, no emissive rims, no vignettes, no glow-on-hover. Light is
  daylight; it falls, it does not emit. (Motes may exist only as daylight dust.)
- ❌ Hand-authored pixel art for characters (rejected; ComfyUI is the pipeline).
- ❌ Painterly backdrop as the *navigation substrate* (retired by split-view spec).
- ❌ Bright/saturated "mobile fantasy" palettes, neon rarity glows.
- ❌ White-on-black text over linen surfaces (or bone-on-linen — small text
  must clear AA 4.5:1 against BOTH `--canvas-base` and `--canvas-mid`, and
  small muted text must stay OUT of the bottom deep band of a page gradient).
- ❌ Canvas-rendered UI chrome (rex-ui trap; UI is React DOM).
- ❌ Grimdark-gore — *and*, since 2026-08-28, grimdark **mood**. The world is
  hard; the company likes each other. Gallows humour, not despair.

## Companions

- `docs/superpowers/specs/2026-08-28-ui-retheme-field-ledger-design.md` — **the
  authority for everything visual.**
- `docs/worldbuilding/story-bible.md` — the creative direction the retheme serves.
- `phaser/src/index.css` — the delivered token system.
- `phaser/art/world-bible.md` — generation recipe, per-region material identity.
- `docs/superpowers/specs/2026-06-12-overworld-splitview-design.md` — split-view
  anatomy (still current; its parchment surface is now a linen page).
</content>
