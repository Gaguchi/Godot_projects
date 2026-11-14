/**
 * ui/combat/Board.tsx — the field (boards Hyb64Combat, F64CombatEnemy): a clearing drawn at 1:1, the battle's own
 * dirt patch and boulders laid on it as tiles (`fieldArt.ts`), the marks as cell modifiers, then whoever stands on
 * it. Tokens are absolutely positioned from `tileRect`, so a move animates as a CSS transition of `left/top`
 * without touching state. Every click goes through `onTile`; the screen decides.
 *
 * The board carries its own patch of the ground as a background (the big picture, offset by the board's origin),
 * so the ground under the tiles is the ground round them, and it travels with the board when the Field Report
 * shrinks it into its plate.
 *
 * A MARK IS A MARK, never a tint of the ground: a tile the player may act on wears a box (an ink line, a line of
 * the mark's own hue, a thin wash inside), read the same on grass and on dirt. Reach is steel, a target is
 * oxblood, a tile a ward or a heal may land on is moss (the danger hue is never aimed at your own knight), the
 * enemy's reach is a hatch.
 *
 * HOVER HAS ONE OWNER: the board itself. Per-cell enter/leave lost the tile the moment the pointer crossed a token,
 * which killed the AoE preview exactly where the player was aiming. The board maps the pointer through
 * `clientToStage` (the one DOM reader) and `tileAtStagePoint` instead, so nothing but `geometry.ts` measures.
 */
import React from 'react'
import { cellKey } from '../../engine/autotile'
import type { TileKey } from '../../engine/types'
import { clientToStage } from '../StageView'
import { dirtPiece, fieldArt, rockPiece } from './fieldArt'
import { gridOrigin, parseTile, plateTransform, tileAtStagePoint, tileCentre, tileRect, tileSize, type BoardView } from './geometry'
import { UnitToken, type TokenExtras } from './UnitToken'

export interface BoardOverlays {
  readonly reach: ReadonlySet<TileKey>
  readonly reachMode: boolean
  readonly targets: ReadonlySet<TileKey>
  /** Whom the offered targets are FOR. A ward or a heal painted its legal tiles in threat-red — the game's one
   *  "danger" hue aimed at your own knight — so the tone rides with the selection. */
  readonly targetTone: 'foe' | 'ally'
  readonly aoe: ReadonlySet<TileKey>
  readonly danger: ReadonlySet<TileKey>
  readonly pinned: TileKey | null
  readonly hover: TileKey | null
  /** The tile a drag is currently over (the "hit tile" of the gesture). */
  readonly dragOver: TileKey | null
}

export interface FloatText {
  readonly id: number
  readonly tile: TileKey
  readonly text: string
  readonly tone: 'hit' | 'heal' | 'armor' | 'status' | 'miss'
  /** Vertical nudge in TILES — two floats on neighbouring tiles would otherwise overprint each other. */
  readonly dy?: number
}

interface Props {
  readonly view: BoardView
  readonly overlays: BoardOverlays
  readonly extras: Readonly<Record<string, TokenExtras>>
  readonly floats: readonly FloatText[]
  readonly onTile: (tile: TileKey) => void
  readonly onHover: (tile: TileKey | null) => void
  readonly onCancel: () => void
  readonly onTilePointerDown?: (tile: TileKey, e: React.PointerEvent) => void
}

export function Board({ view, overlays, extras, floats, onTile, onHover, onCancel, onTilePointerDown }: Props): React.JSX.Element {
  const { width, height } = view.grid
  const size = tileSize(width, height)
  const origin = gridOrigin(width, height)
  const walls = new Set(view.grid.obstacles)
  const floor = new Set(view.grid.floor ?? [])
  const k = size / fieldArt.tile
  const activeTile = view.activeUnitId === null ? null : view.tokens.find((t) => t.unitId === view.activeUnitId)?.tile ?? null

  /** Client point → tile, through the one DOM reader and the one geometry module. */
  const tileAt = (e: { clientX: number; clientY: number }): TileKey | null => {
    const p = clientToStage(e.clientX, e.clientY)
    return p === null ? null : tileAtStagePoint(p.x, p.y, width, height)
  }

  const cells: React.JSX.Element[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = cellKey(x, y)
      const wall = walls.has(tile)
      const cls = ['board__cell']
      if (wall) cls.push('board__cell--wall')
      if (activeTile === tile) cls.push('board__cell--active')
      if (overlays.reach.has(tile)) cls.push('board__cell--reach')
      if (overlays.reachMode) cls.push('board__cell--mode')
      if (overlays.danger.has(tile)) cls.push('board__cell--danger')
      if (overlays.targets.has(tile)) cls.push('board__cell--target', ...(overlays.targetTone === 'ally' ? ['board__cell--mend'] : []))
      if (overlays.aoe.has(tile)) cls.push('board__cell--aoe')
      if (overlays.pinned === tile) cls.push('board__cell--pinned')
      if (overlays.hover === tile) cls.push('board__cell--hover')
      if (overlays.dragOver === tile) cls.push('board__cell--drop')
      cells.push(
        <div key={tile} className={cls.join(' ')} data-tile={tile} onClick={() => onTile(tile)}>
          {!wall && floor.has(tile) && <img className="board__dirt" src={`/art/field/${dirtPiece(floor, x, y)}.png`} alt="" draggable={false} />}
        </div>,
      )
    }
  }
  const [rx, ry, rr, rb] = fieldArt.rock.box
  return (
    <div
      className="board"
      data-testid="board"
      data-source={view.source}
      style={{
        left: origin.x,
        top: origin.y,
        width: width * size,
        height: height * size,
        gridTemplateColumns: `repeat(${width}, ${size}px)`,
        gridAutoRows: `${size}px`,
        backgroundPosition: `${-origin.x}px ${-origin.y}px`,
        // The frozen field is a PLATE beside the report, not a full-size board behind it (geometry.ts#PLATE).
        // `transform-origin: 0 0` is set in CSS so the translate is plain stage arithmetic.
        ...(view.source === 'report' ? { transform: plateTransform(width, height) } : {}),
      }}
      onContextMenu={(e) => { e.preventDefault(); onCancel() }}
      onMouseMove={(e) => onHover(tileAt(e))}
      onMouseLeave={() => onHover(null)}
      onPointerDown={(e) => { const t = tileAt(e); if (t !== null) onTilePointerDown?.(t, e) }}
    >
      {cells}
      {/* a boulder fills its tile and throws its shadow past it: drawn over the marks, under whoever stands near */}
      {view.grid.obstacles.map((tile) => {
        const { x, y } = parseTile(tile)
        return <img key={`rock-${tile}`} className="board__rock" src={`/art/field/${rockPiece(x, y)}.png`} alt="" draggable={false} width={Math.round((rr - rx) * k)} height={Math.round((rb - ry) * k)} style={{ left: x * size + Math.round(rx * k), top: y * size + Math.round(ry * k), zIndex: 10 + y }} />
      })}
      {view.tokens.map((t) => {
        const r = tileRect(width, height, t.tile)
        return (
          <UnitToken
            key={t.unitId}
            token={t}
            rect={{ x: r.x - origin.x, y: r.y - origin.y, size: r.size }}
            row={parseTile(t.tile).y}
            active={view.activeUnitId === t.unitId}
            extras={extras[t.unitId]}
            onClick={() => onTile(t.tile)}
          />
        )
      })}
      {floats.map((f) => {
        const c = tileCentre(width, height, f.tile)
        return (
          <span key={f.id} className={`float float--${f.tone}`} style={{ left: c.x - origin.x, top: c.y - origin.y - size * 0.9 + (f.dy ?? 0) * size }}>
            {f.text}
          </span>
        )
      })}
    </div>
  )
}
