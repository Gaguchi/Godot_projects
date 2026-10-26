/**
 * ui/combat/Board.tsx — the field as a CSS grid (ARCHITECTURE §5): a `px_grass` cell under everything (flipped by a
 * per-cell hash so the repeat never reads as a grid), the autotiled dirt piece for floor cells, walls for obstacles,
 * and the overlay grammar as cell modifiers. Tokens are absolutely positioned from `tileRect`, so a move animates as
 * a CSS transition of `left/top` without touching state. Every click goes through `onTile`; the screen decides.
 *
 * HOVER HAS ONE OWNER: the board itself. Per-cell `onMouseEnter/Leave` lost the tile the moment the pointer crossed a
 * token (`.token__hit` covers the tile and has no handlers), which killed the AoE preview exactly where the player was
 * aiming. The board maps the pointer through `clientToStage` (the one DOM reader) and `tileAtStagePoint` instead, so
 * nothing but `geometry.ts` measures.
 */
import React from 'react'
import { autotileKey, cellKey } from '../../engine/autotile'
import type { TileKey } from '../../engine/types'
import { clientToStage } from '../StageView'
import { gridOrigin, plateTransform, tileAtStagePoint, tileCentre, tileRect, tileSize, type BoardView } from './geometry'
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

function hash(x: number, y: number): number {
  return ((x * 2654435761) ^ (y * 40503)) >>> 0
}

export function Board({ view, overlays, extras, floats, onTile, onHover, onCancel, onTilePointerDown }: Props): React.JSX.Element {
  const { width, height } = view.grid
  const size = tileSize(width, height)
  const origin = gridOrigin(width, height)
  const walls = new Set(view.grid.obstacles)
  const floor = new Set(view.grid.floor ?? [])

  /** Client point → tile, through the one DOM reader and the one geometry module. */
  const tileAt = (e: { clientX: number; clientY: number }): TileKey | null => {
    const p = clientToStage(e.clientX, e.clientY)
    return p === null ? null : tileAtStagePoint(p.x, p.y, width, height)
  }

  const cells: React.JSX.Element[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = cellKey(x, y)
      const h = hash(x, y)
      const wall = walls.has(tile)
      const cls = ['board__cell']
      if ((x + y) % 2 === 1) cls.push('board__cell--alt')
      if (wall) cls.push('board__cell--wall')
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
          {!wall && <img src="/art/terrain/px/px_grass.png" alt="" draggable={false} style={{ transform: `scale(${(h & 1) === 1 ? -1 : 1}, ${(h & 2) === 2 ? -1 : 1})` }} />}
          {!wall && floor.has(tile) && <img src={`/art/terrain/px/${autotileKey(floor, x, y, 'dirt')}.png`} alt="" draggable={false} />}
        </div>,
      )
    }
  }
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
        gridTemplateColumns: `repeat(${width}, var(--tile))`,
        ['--tile' as string]: `${size}px`,
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
      {view.tokens.map((t) => {
        const r = tileRect(width, height, t.tile)
        return (
          <UnitToken
            key={t.unitId}
            token={t}
            rect={{ x: r.x - origin.x, y: r.y - origin.y, size: r.size }}
            active={view.activeUnitId === t.unitId}
            extras={extras[t.unitId]}
            onClick={() => onTile(t.tile)}
          />
        )
      })}
      {floats.map((f) => {
        const c = tileCentre(width, height, f.tile)
        return (
          <span key={f.id} className={`float float--${f.tone}`} style={{ left: c.x - origin.x, top: c.y - origin.y - size * 0.3 + (f.dy ?? 0) * size }}>
            {f.text}
          </span>
        )
      })}
    </div>
  )
}
