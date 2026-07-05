# Visual Style Brief — FE_MB (phaser)

**Date:** 2026-07-06 · **Status:** Adopted (closes Atlas story #276)
**Companions:** `phaser/art/world-bible.md` (generation recipe, per-region material identity), Forged & Lit token system (`phaser/src/index.css`), split-view design (`docs/superpowers/specs/2026-06-12-overworld-splitview-design.md`).

## The style, in one line

**Painted dark-fantasy sprites over an ironwork UI and a parchment war-map** — "Stone & Steel / Forged & Lit": weathered, lived-in, amber-lit; grounded medieval with an arcane edge, never bright/cute, never grimdark-gore.

## Direction

- **Characters / creatures / buildings:** ComfyUI-generated painted sprites (SDXL `waiIllustriousSDXL_v160` + `DarkFantasy-PixelSprite` LoRA, trigger `DFSV1`), full-body, transparent, front-facing. One recipe = one coherent cast. Hand-pixeled art is **not** used for characters (procedural pixel toolkit rejected — kept only for tiles/icons if ever needed).
- **UI chrome:** "Forged & Lit" — dark iron panels (`hud-panel` recipe), display-serif voice for names/headers, tabular numerals for all stats, amber (`--color-hearth`) as the single warm accent. Team is always signaled by SHAPE (TeamSigil) + color, never color alone.
- **Overworld:** Oregon-Trail split view. Top: painterly side-view travel band (baked region vistas + silhouette mid-layers + soil strip). Bottom: parchment map with hand-inked dashed roads, ink sigil nodes, wax-red current marker. Labels are ink-on-parchment with parchment-light halo — never white text with black shadow.
- **Combat board:** Phaser canvas; unit sprites from the house recipe; terrain reads as painted ground tiles (art pass tracked in Atlas story #282).

## Palette (beyond stone-950 / amber-*)

| Role | Hex | Use |
|---|---|---|
| Hearth amber | `--color-hearth` (amber-300 family) | accents, lantern glow, focus |
| Borderlands tan | `#a07a40` | region key, gear, architecture |
| Thornwood green | `#3a6a3e` | region key, poison theme |
| Ashfall red | `#7a2010` | region key, burn theme |
| Route red (accent) | `--color-accent` | planned path, wax seal marker |
| Parchment | `#d8c9a3` family | map surface, labels halo |
| Sepia ink | `#4a3a24` family | map roads, sigils, labels |
| Ward blue | `--color-gem-ward` | armor, shields |
| Enemy red | `--color-enemy` | enemy names, danger |
| Soil dark | `#16100a` | band ground, caravan silhouette |

## References

1. **Fire Emblem GBA** — cast archetypes, readable class silhouettes (homage, not clone).
2. **The Banner Saga** — side-view caravan travel, painted vistas, permadeath weight.
3. **Oregon Trail** — the split anatomy: scene above, instrument below.
4. **Slay the Spire** — card hand ergonomics, node-map legibility.
5. **Darkest Dungeon** — dark-fantasy tone discipline (grim, not gore).

## Iconography rules

- SVG `Icon` component only — **no emoji** anywhere in UI (enforced since story 283).
- Line weight ~1.5-2px at 16-24px sizes; filled silhouettes for team sigils.
- Portraits: authored sprite head/torso crop inside archetype shape (circle/square/hex/diamond/triangle), initials fallback.
- Drop-shadows on canvas/board elements; UI panels use border + inner glow, not shadows.

## Explicitly NOT

- ❌ Hand-authored pixel art for characters (rejected; ComfyUI is the pipeline).
- ❌ Painterly backdrop as the *navigation substrate* (retired by split-view spec).
- ❌ Bright/saturated "mobile fantasy" palettes, neon rarity glows.
- ❌ White-on-black text over parchment surfaces.
- ❌ Canvas-rendered UI chrome (rex-ui trap; UI is React DOM).
