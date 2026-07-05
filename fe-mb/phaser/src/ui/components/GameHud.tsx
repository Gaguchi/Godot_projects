import React from 'react'
import { useRunStore } from '../../state/runStore'
import { CharacterPortrait } from './CharacterPortrait'
import { Icon } from './Icon'

/**
 * Persistent game HUD for the non-combat scenes (overworld / town / dungeon /
 * camp). Replaces the old scattered corner-text with one cohesive readout:
 *
 *   - a PARTY roster (portrait + name + HP meter + numeral) — always visible,
 *   - a context + RESOURCE bar (region · location · day · food · gold),
 *   - an OBJECTIVE line when a quest is active.
 *
 * Pure presentation: reads runStore via selectors, dispatches nothing. The
 * party panel side is configurable so it can dodge the town's left sidebar.
 *
 * `surface` switches the chrome between the default dark iron slab and a warm
 * cartographer's-ledger look for the overworld split-view (where the HUD sits
 * over the bright travel band — the heavy iron drop shadow would otherwise
 * paint a hard dark rectangle onto the band sky).
 */
export interface GameHudProps {
  location?: string | undefined
  regionName?: string | undefined
  /** Which side the party roster docks to (default left). Town uses 'right'. */
  partySide?: 'left' | 'right'
  /**
   * Full position-class override for the party roster (e.g. the overworld docks
   * it onto the map zone, below the travel band, instead of the default corner).
   * When set, partySide is ignored.
   */
  partyClassName?: string
  /**
   * Chrome surface. 'dark' (default) = forged-iron slab for town/dungeon/camp.
   * 'parchment' = the overworld split-view ledger look: the roster becomes a
   * pinned cartographer's card and the resource bar drops its heavy band-eating
   * shadow for a band-safe inset bevel.
   */
  surface?: 'dark' | 'parchment'
}

function hpFill(c: number, m: number): string {
  const p = c / Math.max(1, m)
  return p > 0.5 ? 'var(--hp-ok)' : p > 0.25 ? 'var(--hp-warn)' : 'var(--hp-crit)'
}
function hpText(c: number, m: number): string {
  const p = c / Math.max(1, m)
  return p > 0.5
    ? 'text-[color:var(--hp-ok)]'
    : p > 0.25
      ? 'text-[color:var(--hp-warn)]'
      : 'text-[color:var(--hp-crit-text)]'
}
function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Band-safe resource-bar shadow: keep the inset bevel, kill the heavy drop. */
const BAND_SAFE_SHADOW = 'inset 0 1px 0 rgba(122,99,60,0.45), 0 1px 3px rgba(0,0,0,0.35)'

/** Parchment ledger tones — cartographer's chrome, not a combat slab. */
const LEDGER_BG = '#e6d6ac'
const LEDGER_BORDER = 'rgba(91,65,38,0.5)'
const LEDGER_INK = '#5b4126'
const LEDGER_INK_SOFT = 'rgba(91,65,38,0.3)'
const LEDGER_HP_FILL = '#7a8a4f'

export function GameHud({
  location,
  regionName,
  partySide = 'left',
  partyClassName,
  surface = 'dark',
}: GameHudProps): React.JSX.Element {
  const units = useRunStore((s) => s.party.units)
  const order = useRunStore((s) => s.party.partyOrder)
  const gold = useRunStore((s) => s.gold)
  const days = useRunStore((s) => s.daysElapsed)
  const items = useRunStore((s) => s.inventory.items)
  const questStates = useRunStore((s) => s.questStates)
  const food = items.filter((i) => (i.itemId as unknown as string) === 'food_rations').length

  const activeQuest = Object.entries(questStates).find(([, q]) => q.currentStage !== '__complete__')
  const objective = activeQuest
    ? `${titleCase(activeQuest[0].replace(/^sq_/, ''))} — ${titleCase(activeQuest[1].currentStage)}`
    : null

  const partyPos = partyClassName ?? (partySide === 'right' ? 'top-16 right-4' : 'top-4 left-4')

  const parchment = surface === 'parchment'

  /**
   * Parchment roster restyles the slab as a pinned ledger card; the dark slab
   * keeps the `hud-panel` iron recipe. We drop the `hud-panel` class under
   * parchment so its iron gradient/bevel doesn't bleed through the overrides.
   */
  const rosterClass = parchment
    ? `pointer-events-none fixed ${partyPos} z-[60] w-60 rounded-md p-2.5`
    : `hud-panel pointer-events-none fixed ${partyPos} z-[60] w-60 p-2.5`
  const rosterStyle: React.CSSProperties | undefined = parchment
    ? {
        background: LEDGER_BG,
        border: `1px solid ${LEDGER_BORDER}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }
    : undefined

  return (
    <>
      {/* Party roster */}
      {order.length > 0 && (
        <div className={rosterClass} style={rosterStyle}>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <span
              className={`text-[0.6rem] uppercase tracking-[0.22em] ${parchment ? '' : 'text-[color:var(--color-text-muted)]'}`}
              style={parchment ? { color: LEDGER_INK } : undefined}
            >
              Party
            </span>
            <span
              className={`numeral text-[0.6rem] ${parchment ? '' : 'text-[color:var(--color-text-muted)]'}`}
              style={parchment ? { color: LEDGER_INK } : undefined}
            >
              {order.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {order.map((uid) => {
              const u = units[uid as unknown as string]
              if (!u) return null
              const dead = u.hp.current <= 0
              const pct = Math.max(0, Math.min(100, (u.hp.current / Math.max(1, u.hp.max)) * 100))
              return (
                <div key={uid as unknown as string} className={`flex items-center gap-2 ${dead ? 'opacity-40 grayscale' : ''}`}>
                  {/* clip-path: circle(50%) inscribes any portrait glyph (e.g.
                      Lilina's diamond) inside the round ring so its points
                      can't poke out at 12/6 o'clock. */}
                  <div
                    className="shrink-0 overflow-hidden rounded-full ring-1 ring-amber-700/50"
                    style={{ clipPath: 'circle(50%)' }}
                  >
                    <CharacterPortrait speaker={u.name} size={30} active={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`voice-display truncate text-[0.82rem] ${parchment ? '' : 'text-amber-100'}`}
                        style={parchment ? { color: LEDGER_INK } : undefined}
                      >
                        {u.name}
                      </span>
                      <span
                        className={`numeral text-[0.65rem] ${parchment ? '' : hpText(u.hp.current, u.hp.max)}`}
                        style={parchment ? { color: LEDGER_INK } : undefined}
                      >
                        {u.hp.current}
                        <span
                          style={parchment ? { color: LEDGER_INK_SOFT } : undefined}
                          className={parchment ? '' : 'text-[color:var(--color-text-muted)]'}
                        >
                          /{u.hp.max}
                        </span>
                      </span>
                    </div>
                    {parchment ? (
                      <div
                        className="mt-1 overflow-hidden rounded-full"
                        style={{ height: 3, background: LEDGER_INK_SOFT }}
                      >
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LEDGER_HP_FILL }} />
                      </div>
                    ) : (
                      <div className="hp-bar mt-1">
                        <div className="hp-bar__fill" style={{ width: `${pct}%`, background: hpFill(u.hp.current, u.hp.max) }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {objective && (
            <div
              className={`mt-2.5 flex items-start gap-1.5 pt-2 ${parchment ? '' : 'border-t border-[rgba(120,98,60,0.22)]'}`}
              style={parchment ? { borderTop: `1px solid ${LEDGER_INK_SOFT}` } : undefined}
            >
              <span
                className={`mt-0.5 flex ${parchment ? '' : 'text-hearth'}`}
                style={parchment ? { color: LEDGER_INK } : undefined}
              >
                <Icon name="quest" size={12} />
              </span>
              <span
                className={`text-[0.7rem] leading-tight ${parchment ? '' : 'text-parchment'}`}
                style={parchment ? { color: LEDGER_INK } : undefined}
              >
                {objective}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Context + resources */}
      <div
        className="hud-panel pointer-events-none fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-3 px-4 py-2"
        style={parchment ? { boxShadow: BAND_SAFE_SHADOW } : undefined}
      >
        {(regionName || location) && (
          <>
            <span className="flex flex-col leading-none">
              {regionName && (
                <span className="text-[0.55rem] uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">{regionName}</span>
              )}
              {location && <span className="voice-display text-sm text-amber-100">{location}</span>}
            </span>
            <div className="hud-divider" />
          </>
        )}
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Day</span>
          <span className="numeral text-sm text-amber-100">{days}</span>
        </span>
        <div className="hud-divider" />
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Food</span>
          <span className={`numeral text-sm ${food === 0 ? 'text-[color:var(--color-damage-text)]' : 'text-amber-100'}`}>{food}</span>
        </span>
        <div className="hud-divider" />
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Gold</span>
          <span className="numeral text-sm text-hearth">{gold}</span>
        </span>
      </div>
    </>
  )
}
