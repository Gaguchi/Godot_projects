/**
 * ui/combat/UnitToken.tsx — a unit on a tile: the board bake (`/sprites/units/board/<spriteId>.png`, LINEAR-scaled by
 * the browser, never nearest), a team base (disc = ally, star = enemy — shape, not just colour), an HP pill in the
 * shared tiers, the name on the active unit only, and the brass / ember rings for "acting" / "aimed at".
 *
 * The token never does its own arithmetic: `rect` comes from `geometry.ts#tileRect` (board-local), so the board, the
 * tokens and the Playwright clicks all read the same pitch. A fallen or captured unit sits BELOW the living (a corpse
 * used to paint over whoever walked onto its tile), and a prisoner reads as a prisoner, not as a combatant.
 */
import React from 'react'
import { Icon } from '../components/Icon'
import { spriteIdFor } from '../../content/index'
import type { BattleFieldToken } from '../../engine/types'
import { initialsOf } from '../names'

export interface TokenExtras {
  readonly displayName?: string
  readonly pinnedTarget?: boolean
  /** A short badge over the token (the capture % while aiming a capture). */
  readonly badge?: string
  /** A muted badge instead: why this unit is NOT a target (e.g. "too strong to take alive"). */
  readonly mutedBadge?: string
}

function tierColor(current: number, max: number): string {
  const f = max <= 0 ? 0 : current / max
  return f <= 0.25 ? 'var(--hp-crit)' : f <= 0.5 ? 'var(--hp-warn)' : 'var(--hp-ok)'
}

export function UnitToken({ token, rect, active, extras, onClick }: { readonly token: BattleFieldToken; readonly rect: { readonly x: number; readonly y: number; readonly size: number }; readonly active: boolean; readonly extras?: TokenExtras | undefined; readonly onClick: () => void }): React.JSX.Element {
  const size = rect.size
  const spriteId = spriteIdFor(token.unitId, token.classId)
  const name = extras?.displayName ?? token.name
  const cls = ['token', `token--${token.team}`]
  if (token.fallen) cls.push('token--fallen')
  if (token.captured) cls.push('token--captured')
  const ratio = token.hp.max <= 0 ? 0 : Math.max(0, token.hp.current) / token.hp.max
  return (
    <div className={cls.join(' ')} data-testid={`token-${token.unitId}`} data-unit={token.unitId} style={{ left: rect.x, top: rect.y, width: size, height: size }}>
      {active && <span className="token__ring" />}
      {extras?.pinnedTarget === true && <span className="token__ring token__ring--target" />}
      <span className="token__base" />
      {spriteId !== null && !token.captured ? (
        <img className="token__sprite" src={`/sprites/units/board/${spriteId}.png`} alt={name} draggable={false} style={{ height: size * 1.05, marginBottom: size * 0.08 }} />
      ) : (
        // a prisoner wears the same chain the Field Report lists him under, never his initials
        <span className="token__initials" style={{ fontSize: size * 0.32 }} aria-label={token.captured ? `${name}, taken prisoner` : undefined}>{token.captured ? <Icon name="shackles" size={Math.round(size * 0.42)} /> : initialsOf(name)}</span>
      )}
      {!token.fallen && !token.captured && (
        <span className="token__hp"><i style={{ width: `${Math.round(ratio * 100)}%`, background: tierColor(token.hp.current, token.hp.max) }} /></span>
      )}
      {active && <span className="token__name">{name}</span>}
      {extras?.badge !== undefined && <span className="token__name token__badge">{extras.badge}</span>}
      {extras?.badge === undefined && extras?.mutedBadge !== undefined && <span className="token__name token__badge token__badge--muted">{extras.mutedBadge}</span>}
      <span className="token__hit" onClick={onClick} />
    </div>
  )
}
