/**
 * ui/combat/UnitToken.tsx — a unit on a tile (board Hyb64Combat): the board sprite at half size (52 × 76, the
 * field's scale) standing in its ring. The ring is the side, by SHAPE: a rectangle is ours, a lozenge is theirs;
 * the acting unit's ring is brass and a marker hangs over its head. Half the ring is drawn behind the figure and
 * half over its feet, so the figure stands IN it. Under the feet, a strength bar in the side's own hue.
 *
 * The token never does its own arithmetic: `rect` comes from `geometry.ts#tileRect` (board-local), so the board,
 * the tokens and the Playwright clicks all read the same pitch. Tokens paint in row order (a unit lower on the
 * field stands in front of one above it); a fallen or captured unit sits BELOW the living (a corpse used to paint
 * over whoever walked onto its tile), and a prisoner reads as a prisoner, not as a combatant.
 */
import React from 'react'
import { spriteIdFor } from '../../content/index'
import type { BattleFieldToken } from '../../engine/types'
import { initialsOf } from '../names'
import { fieldArt } from './fieldArt'

export interface TokenExtras {
  readonly displayName?: string
  readonly pinnedTarget?: boolean
  /** The number a same-named foe wears (`names.ts`): a small plaque at the figure's shoulder. */
  readonly ordinal?: number
  /** A short badge over the token (the capture % while aiming a capture). */
  readonly badge?: string
  /** A muted badge instead: why this unit is NOT a target (e.g. "too strong to take alive"). */
  readonly mutedBadge?: string
}

/** The board sprite's half size, and where its feet are in it (tools/pxworld px-combat: left = cx − 26, feet + 2). */
const FIG_W = 52
const FIG_H = 76

export function UnitToken({ token, rect, row, active, extras, onClick }: { readonly token: BattleFieldToken; readonly rect: { readonly x: number; readonly y: number; readonly size: number }; readonly row: number; readonly active: boolean; readonly extras?: TokenExtras | undefined; readonly onClick: () => void }): React.JSX.Element {
  const size = rect.size
  const k = size / fieldArt.tile
  const spriteId = spriteIdFor(token.unitId, token.classId)
  const name = extras?.displayName ?? token.name
  const ours = token.team === 'party'
  const down = token.fallen || token.captured
  const cls = ['token', `token--${token.team}`]
  if (token.fallen) cls.push('token--fallen')
  if (token.captured) cls.push('token--captured')
  if (active) cls.push('token--acting')
  const ratio = token.hp.max <= 0 ? 0 : Math.max(0, token.hp.current) / token.hp.max
  const ring = `${active ? (ours ? 'acting' : 'acting_theirs') : ours ? 'ours' : 'theirs'}`
  const feet = fieldArt.feet * k
  return (
    // the living paint in row order above every corpse and prisoner (z 1)
    <div className={cls.join(' ')} data-testid={`token-${token.unitId}`} data-unit={token.unitId} style={{ left: rect.x, top: rect.y, width: size, height: size, zIndex: down ? 1 : 10 + row }}>
      {!down && <img className="token__base" src={`/art/field/base_${ring}_back.png`} width={size} height={size} alt="" draggable={false} />}
      {!down && <i className="token__shadow" style={{ left: size / 2 - 18 * k, top: feet - 4 * k, width: 36 * k, height: 9 * k }} />}
      {spriteId !== null && !token.captured ? (
        <img className="token__sprite" src={`/sprites/units/board/${spriteId}.png`} alt={name} draggable={false} width={Math.round(FIG_W * k)} height={Math.round(FIG_H * k)} style={{ left: Math.round(size / 2 - (FIG_W / 2) * k), top: Math.round(feet + 2 * k - FIG_H * k) }} />
      ) : (
        // a prisoner wears the chain the Field Report lists him under, never his initials
        <span className="token__initials" aria-label={token.captured ? `${name}, taken prisoner` : undefined}>
          {token.captured ? <img src="/art/ui/kicon_capture.png" width={24} height={24} alt="" draggable={false} /> : initialsOf(name)}
        </span>
      )}
      {!down && <img className="token__base token__base--front" src={`/art/field/base_${ring}_front.png`} width={size} height={size} alt="" draggable={false} />}
      {!down && <span className="token__hp" style={{ left: 9 * k, top: size - 6 * k, width: 30 * k }}><i style={{ width: `${Math.round(ratio * 100)}%` }} /></span>}
      {active && <img className="token__acting" src="/art/field/acting.png" width={fieldArt.acting[0]} height={fieldArt.acting[1]} alt="" draggable={false} style={{ left: Math.round(size / 2 - fieldArt.acting[0] / 2), top: Math.round(feet - FIG_H * k - fieldArt.acting[1] - 2) }} />}
      {!down && extras?.ordinal !== undefined && <span className="token__ordinal" aria-hidden>{extras.ordinal}</span>}
      {extras?.pinnedTarget === true && <span className="token__ring token__ring--target" />}
      {extras?.badge !== undefined && <span className="token__badge">{extras.badge}</span>}
      {extras?.badge === undefined && extras?.mutedBadge !== undefined && <span className="token__badge token__badge--muted">{extras.mutedBadge}</span>}
      <span className="token__hit" onClick={onClick} />
    </div>
  )
}
