/**
 * boardPalette — THE named-constant canvas palette for the combat board.
 *
 * Phaser can't read CSS custom properties, so every color the canvas paints
 * is a numeric mirror of the "Field Ledger" tokens in `src/index.css` (the
 * mirrored CSS var is named in each comment; "derived" = a board-only shade
 * mixed from that token family). Keep this file and index.css in sync —
 * no other color literals belong in `src/game/`.
 *
 * The board is the ONE surface that stays dark in Field Ledger: it is trodden
 * earth seen from above, and the overlay grammar needs light-on-dark to read.
 * Everything here is therefore the leather/earth side of the palette, lifted
 * where a 2px stroke or a 6px HP bar would otherwise disappear.
 *
 * Grid overlay vocabulary (genre grammar — one hue never means two things):
 *   field-blue  = my movement range
 *   attack-red  = valid card-target tiles / enemy strike reach
 *   red-purple  = enemy danger union ("stand here and get hit")
 *   arcane      = AoE preview
 *   brass       = the active unit (the one "act here" accent on the board)
 */

// ---------------------------------------------------------------- tiles ----
/** Base tile fill before per-tile variance. Derived: --iron-800 #2b1e14
 *  (packed earth under the leather chrome). */
export const TILE_BASE = 0x2b1e14
export const TILE_FILL_ALPHA = 0.26
/** Tile grout line. Mirrors --iron-700 #6a4b2f, dropped toward the ground. */
export const TILE_STROKE = 0x4a3521
export const TILE_STROKE_ALPHA = 0.5
/** Tint over the painted ground sprites. Derived: --color-parchment-dim
 *  (#d5c8ad) darkened — daylight on turf, not candlelight on stone. */
export const TILE_SPRITE_TINT = 0xb0a084

/** Pure black — shadows, strokes, and invisible hit-targets only (surfaces
 *  themselves always use the walnut/leather family, never #000). */
export const BLACK = 0x000000

// ---------------------------------------------------------------- frame ----
/** Ground-shadow slab under the board. Pure shadow, alpha-carried. */
export const FRAME_SHADOW = BLACK
export const FRAME_SHADOW_ALPHA = 0.3
/** Leather frame plate. Mirrors --iron-900 #1c140d. */
export const FRAME_FILL = 0x1c140d
export const FRAME_FILL_ALPHA = 0.5
/** Frame edge line — struck brass. Mirrors --iron-edge #b08a3e. */
export const FRAME_EDGE = 0xb08a3e
export const FRAME_EDGE_ALPHA = 0.8

// --------------------------------------------------------- grid overlays ----
/** My movement range — field blue. Derived: --color-ally (#3f628a) deepened
 *  for a translucent quad over dark ground. */
export const MOVE_RANGE = 0x24455f
export const MOVE_RANGE_IDLE_ALPHA = 0.42
export const MOVE_RANGE_MODE_ALPHA = 0.72
export const MOVE_RANGE_DRAG_ALPHA = 0.95

/** Valid card-target tiles — attack-red family (never mud-brass).
 *  Fill derived from --color-ember (#9a2c22) darkened; edge is the ember
 *  lifted so oxblood still reads as a 2px stroke on tan ground. */
export const CARD_TARGET_FILL = 0x5e1a13
export const CARD_TARGET_EDGE = 0xb8402c
export const CARD_TARGET_ALPHA = 0.52
/** Hovered / pinned valid target tile brightens toward commitment. */
export const CARD_TARGET_HOT_ALPHA = 0.85
export const CARD_TARGET_EDGE_ALPHA = 0.92

/** Tab-toggled enemy danger union — red-purple wash ("move here = get hit").
 *  Derived: --color-ember crossed toward --color-gem-arcane. */
export const DANGER_UNION = 0x3c1c36
export const DANGER_UNION_ALPHA = 0.72

/** Hover-a-unit threat preview (IDLE): where THIS unit can go / strike. */
export const HOVER_MOVE_ALLY = MOVE_RANGE           // same field-blue vocabulary
export const HOVER_MOVE_ENEMY = 0x4c2846            // derived: danger-union, lifted
export const HOVER_ATTACK_ENEMY = CARD_TARGET_FILL  // attack-red family
export const HOVER_ATTACK_ALLY = 0x5e3f18           // derived: raw brass, deepened
export const HOVER_ALPHA = 0.72

/** AoE splash preview. Mirrors the --color-gem-arcane family (#7d63c4). */
export const AOE_PREVIEW = 0x8f74d2
export const AOE_FILL_ALPHA = 0.25
export const AOE_EDGE_ALPHA = 0.8

// ---------------------------------------------------------------- units ----
/** Ally team color. Derived: --color-ally #3f628a lifted for a token that has
 *  to hold its own against turf (the page-safe #3f628a vanishes here). */
export const UNIT_ALLY = 0x6f93bd
/** Enemy team color. Derived: --color-enemy #a6432f lifted the same way. */
export const UNIT_ENEMY = 0xc0644e
/** Token rims — derived near-black shades of each team hue. */
export const UNIT_ALLY_RIM = 0x16293a
export const UNIT_ENEMY_RIM = 0x3a170f
/** Sheen highlight / hit-flash white (alpha-carried). */
export const FLASH_WHITE = 0xffffff

/** Active-unit ring — the one struck brass on the board.
 *  Mirrors --color-hearth #d9a93f. */
export const ACTIVE_RING = 0xd9a93f
/** Pinned card-target ring ("who I am hitting"). Mirrors --color-gem-attack. */
export const TARGET_RING = 0xb8402c

/** HP bar well. Mirrors the --color-ash #17110c family. */
export const HP_BAR_BG = 0x120d08

// ------------------------------------------------------------- HP tiers ----
/** Tier thresholds shared with ui/scenes/combat/hpTier.ts (the DOM side) —
 *  bar-on-board and HP text can never disagree about "wounded". */
export const HP_TIER_THRESHOLDS = { warn: 0.5, crit: 0.25 } as const

export type HpTier = 'ok' | 'warn' | 'crit'

export function hpTierFor(current: number, max: number): HpTier {
  const p = current / Math.max(1, max)
  return p > HP_TIER_THRESHOLDS.warn ? 'ok' : p > HP_TIER_THRESHOLDS.crit ? 'warn' : 'crit'
}

/** Canvas HP bar fills. Mirror the leather-scope --hp-ok / --hp-warn /
 *  --hp-crit (the board is a dark ground, so it uses the lifted tier set). */
export const HP_TIER_FILL: Record<HpTier, number> = {
  ok: 0x7ba33f,   // --hp-ok (leather scope)
  warn: 0xd9a93f, // --hp-warn (leather scope)
  crit: 0xa6432f, // --hp-crit, lifted for a 3px bar
}

// ------------------------------------------------- canvas text (CSS str) ----
/** Unit name label. Mirrors --color-parchment #f1e9d8. */
export const TEXT_NAME = '#f1e9d8'
/** Text outline/stroke — pure black is correct for canvas legibility. */
export const TEXT_OUTLINE = '#000000'
/** Floating heal number / heal forecast. Derived field-green (--hp-ok lifted). */
export const TEXT_HEAL = '#8fd45f'
/** Floating physical damage / damage forecast. Derived from the
 *  --color-damage-text family, brightened for the 20px stroked popup. */
export const TEXT_DAMAGE = '#ff7a5c'
/** Floating magic damage. Derived: --color-ally lifted to a cold sky blue. */
export const TEXT_MAGIC = '#8fb4e8'
/** Lethal "KO" badge — bone text on a deep oxblood plate. */
export const KO_TEXT = '#f1e9d8'
export const KO_BG = '#6e1d16'
