import React from 'react'
import { Icon } from '../../components/Icon'
import { hpTier, HP_FILL } from './hpTier'

/**
 * Shared combat-HUD primitives. One implementation each for AP pips, the HP
 * meter, and the team sigil so the readouts are identical everywhere (TopBar,
 * UnitDetailPanel, InitiativeEntry). Redundant encoding lives here: team is a
 * SHAPE (shield vs fangs) + colour, HP tier is a colour paired with a label.
 */

/** AP shown as filled/empty pips — the single glowing readout in the HUD. */
export function ApPips({ current, max = 3 }: { current: number; max?: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${current} of ${max} action points`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`ap-pip ${i < current ? 'ap-pip--full' : 'ap-pip--empty'}`} />
      ))}
    </div>
  )
}

/** Token-driven HP meter. Tier colour is paired with a numeral/label elsewhere. */
export function HpMeter({
  current,
  max,
  width = 64,
}: {
  current: number
  max: number
  width?: number | string
}): React.JSX.Element {
  const tier = hpTier(current, max)
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100))
  return (
    <div className="hp-bar" style={{ width }} role="img" aria-label={`${current} of ${max} health`}>
      <div className="hp-bar__fill" style={{ width: `${pct}%`, background: HP_FILL[tier] }} />
    </div>
  )
}

/** Forged keycap chip — physical key labels (Tab/Esc/RMB) rendered as small
 *  iron keys, never bracketed dev-notation like "[Tab]". */
export function Keycap({ label }: { label: string }): React.JSX.Element {
  return (
    <kbd
      className="numeral inline-flex h-[18px] items-center justify-center rounded-[3px] px-1.5 text-[0.6rem] uppercase leading-none tracking-[0.06em] text-parchment-dim"
      style={{
        background: 'linear-gradient(180deg, var(--iron-700), var(--iron-900))',
        border: '1px solid color-mix(in oklab, var(--iron-edge) 80%, transparent)',
        boxShadow:
          'inset 0 1px 0 color-mix(in oklab, var(--color-parchment) 14%, transparent), inset 0 -2px 0 color-mix(in oklab, var(--color-ash) 85%, transparent)',
      }}
    >
      {label}
    </kbd>
  )
}

/** Team sigil — shield (ally) vs fangs (enemy): a non-colour team signal. */
export function TeamSigil({ enemy, size = 16 }: { enemy: boolean; size?: number }): React.JSX.Element {
  return enemy ? (
    <span className="text-enemy">
      <Icon name="fangs" size={size} aria-label="Enemy" />
    </span>
  ) : (
    <span className="text-ally">
      <Icon name="shield" size={size} aria-label="Ally" />
    </span>
  )
}
