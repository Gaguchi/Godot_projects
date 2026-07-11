/**
 * boardPalette — THE named-constant canvas palette for the combat board.
 *
 * Phaser can't read CSS custom properties, so every color the canvas paints
 * is a numeric mirror of the Forged & Lit tokens in `src/index.css` (the
 * mirrored CSS var is named in each comment; "derived" = a board-only shade
 * mixed from that token family). Keep this file and index.css in sync —
 * no other color literals belong in `src/game/`.
 *
 * Grid overlay vocabulary (genre grammar — one hue never means two things):
 *   steel-blue  = my movement range
 *   attack-red  = valid card-target tiles / enemy strike reach
 *   red-purple  = enemy danger union ("stand here and get hit")
 *   arcane      = AoE preview
 *   hearth      = the active unit (the one "act here" amber on the board)
 */

// ---------------------------------------------------------------- tiles ----
/** Base tile fill before per-tile variance. Mirrors --color-ink #1a1410. */
export const TILE_BASE = 0x1a1410
export const TILE_FILL_ALPHA = 0.30
/** Tile grout line. Derived from the --iron-700 family (#322a20), warmed. */
export const TILE_STROKE = 0x3a3226
export const TILE_STROKE_ALPHA = 0.55
/** Tint over the painted ground sprites. Derived: --color-parchment-dim
 *  (#b9a079) darkened so the field stays moody under the warm chrome. */
export const TILE_SPRITE_TINT = 0x9c8b74

/** Pure black — shadows, strokes, and invisible hit-targets only (surfaces
 *  themselves always use the warm ink family, never #000). */
export const BLACK = 0x000000

// ---------------------------------------------------------------- frame ----
/** Ground-shadow slab under the board. Pure shadow, alpha-carried. */
export const FRAME_SHADOW = BLACK
export const FRAME_SHADOW_ALPHA = 0.35
/** Forged-iron frame plate. Mirrors --iron-900 #15110d. */
export const FRAME_FILL = 0x15110d
export const FRAME_FILL_ALPHA = 0.55
/** Frame edge line. Mirrors --iron-edge #5a4a36. */
export const FRAME_EDGE = 0x5a4a36
export const FRAME_EDGE_ALPHA = 0.85

// --------------------------------------------------------- grid overlays ----
/** My movement range — steel-blue. Derived: --color-ally (#7ba6dd) deepened
 *  for a translucent quad over dark ground. */
export const MOVE_RANGE = 0x1f4a5a
export const MOVE_RANGE_IDLE_ALPHA = 0.4
export const MOVE_RANGE_MODE_ALPHA = 0.7
export const MOVE_RANGE_DRAG_ALPHA = 0.95

/** Valid card-target tiles — attack-red family (never mud-amber).
 *  Fill derived from --color-ember (#c0392b) darkened; edge mirrors
 *  --color-ember exactly so the red reads even on tan ground. */
export const CARD_TARGET_FILL = 0x6a1a1a
export const CARD_TARGET_EDGE = 0xc0392b
export const CARD_TARGET_ALPHA = 0.5
/** Hovered / pinned valid target tile brightens toward commitment. */
export const CARD_TARGET_HOT_ALPHA = 0.85
export const CARD_TARGET_EDGE_ALPHA = 0.9

/** Tab-toggled enemy danger union — red-purple wash ("move here = get hit").
 *  Derived: --color-ember crossed toward arcane purple. */
export const DANGER_UNION = 0x3a1a3a
export const DANGER_UNION_ALPHA = 0.72

/** Hover-a-unit threat preview (IDLE): where THIS unit can go / strike. */
export const HOVER_MOVE_ALLY = MOVE_RANGE          // same steel-blue vocabulary
export const HOVER_MOVE_ENEMY = 0x4a2a4a           // derived: danger-union, lifted
export const HOVER_ATTACK_ENEMY = CARD_TARGET_FILL // attack-red family
export const HOVER_ATTACK_ALLY = 0x6a3a1a          // derived: --color-hearth-soft deepened
export const HOVER_ALPHA = 0.72

/** AoE splash preview. Mirrors the --color-gem-arcane family (#8a63d6). */
export const AOE_PREVIEW = 0x9966cc
export const AOE_FILL_ALPHA = 0.25
export const AOE_EDGE_ALPHA = 0.8

// ---------------------------------------------------------------- units ----
/** Ally team color. Mirrors --color-ally #7ba6dd. */
export const UNIT_ALLY = 0x7ba6dd
/** Enemy team color. Mirrors --color-enemy #d0685c. */
export const UNIT_ENEMY = 0xd0685c
/** Token rims — derived near-black shades of each team hue. */
export const UNIT_ALLY_RIM = 0x14283c
export const UNIT_ENEMY_RIM = 0x3a1410
/** Sheen highlight / hit-flash white (alpha-carried). */
export const FLASH_WHITE = 0xffffff

/** Active-unit ring — the one hearth amber on the board.
 *  Mirrors --color-hearth #e8a93a. */
export const ACTIVE_RING = 0xe8a93a
/** Pinned card-target ring ("who I am hitting"). Mirrors --color-ember. */
export const TARGET_RING = 0xc0392b

/** HP bar well. Mirrors --color-ash #0b0907 family. */
export const HP_BAR_BG = 0x0a0806

// ------------------------------------------------------------- HP tiers ----
/** Tier thresholds shared with ui/scenes/combat/hpTier.ts (the DOM side) —
 *  bar-on-board and HP text can never disagree about "wounded". */
export const HP_TIER_THRESHOLDS = { warn: 0.5, crit: 0.25 } as const

export type HpTier = 'ok' | 'warn' | 'crit'

export function hpTierFor(current: number, max: number): HpTier {
  const p = current / Math.max(1, max)
  return p > HP_TIER_THRESHOLDS.warn ? 'ok' : p > HP_TIER_THRESHOLDS.crit ? 'warn' : 'crit'
}

/** Canvas HP bar fills. Mirror --hp-ok / --hp-warn / --hp-crit. */
export const HP_TIER_FILL: Record<HpTier, number> = {
  ok: 0x6ea96a,   // --hp-ok
  warn: 0xd4a72c, // --hp-warn
  crit: 0xc0392b, // --hp-crit
}

// ------------------------------------------------- canvas text (CSS str) ----
/** Unit name label. Mirrors --color-parchment #e8d8c0. */
export const TEXT_NAME = '#e8d8c0'
/** Text outline/stroke — pure black is correct for canvas legibility. */
export const TEXT_OUTLINE = '#000000'
/** Floating heal number / heal forecast. Derived buff-green (no CSS token). */
export const TEXT_HEAL = '#44dd66'
/** Floating physical damage / damage forecast. Derived from the
 *  --color-damage-text family, brightened for the 20px stroked popup. */
export const TEXT_DAMAGE = '#ff6644'
/** Floating magic damage. Derived arcane-blue of the --color-ally family. */
export const TEXT_MAGIC = '#88aaff'
/** Lethal "KO" badge — parchment text on a deep blood plate. */
export const KO_TEXT = '#ffe9b0'
export const KO_BG = '#7c1d1d'
