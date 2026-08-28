import React, { useEffect, useRef, useState } from 'react'
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
  /** Hide the floating party roster (town panels — it overlapped shop rows;
   *  the loadout screen (I) carries party detail there). */
  showParty?: boolean
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

/**
 * FOOD is the run-killer stat — tint it in three tiers so it pulls the eye
 * BEFORE starvation lands, not only at zero: calm parchment while stocked,
 * the HP warn amber when the larder runs low (1–4), crit red + a slow pulse
 * when empty (every further hop now costs HP).
 */
function foodTint(food: number): string {
  if (food === 0) return 'food-crit text-[color:var(--hp-crit-text)]'
  if (food <= 4) return 'text-[color:var(--hp-warn)]'
  return 'text-[color:var(--color-parchment)]'
}

/* The parchment roster is a `.surface-parchment` page scope: the scope
   re-declares the text/HP ramp tokens, so the SAME token classNames used by
   the dark slab resolve to the walnut-ink page values — no raw hexes here. */

export function GameHud({
  location,
  regionName,
  partySide = 'left',
  showParty = true,
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

  // Scale-pop the FOOD numeral when a hop consumes a ration, so the travel
  // cost registers as an event (second feedback channel next to the tint).
  const prevFoodRef = useRef(food)
  const [foodPopKey, setFoodPopKey] = useState(0)
  useEffect(() => {
    if (food < prevFoodRef.current) setFoodPopKey((k) => k + 1)
    prevFoodRef.current = food
  }, [food])

  const activeQuest = Object.entries(questStates).find(([, q]) => q.currentStage !== '__complete__')
  const objective = activeQuest
    ? `${titleCase(activeQuest[0].replace(/^sq_/, ''))} — ${titleCase(activeQuest[1].currentStage)}`
    : null

  const partyPos = partyClassName ?? (partySide === 'right' ? 'top-16 right-4' : 'top-4 left-4')

  const parchment = surface === 'parchment'

  /**
   * Parchment roster is a pinned ledger card — the `.surface-parchment` page
   * recipe (linen gradient, dashed tooled edge) plus its token scope, which
   * re-resolves every colour class below to the walnut-ink page ramp. The
   * dark slab keeps the `hud-panel` leather recipe.
   */
  const rosterClass = parchment
    ? `surface-parchment pointer-events-none fixed ${partyPos} z-[60] w-60 rounded-md p-2.5`
    : `hud-panel pointer-events-none fixed ${partyPos} z-[60] w-60 p-2.5`

  return (
    <>
      {/* Party roster */}
      {showParty && order.length > 0 && (
        <div className={rosterClass}>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
              Party
            </span>
            <span className="numeral text-[0.6rem] text-[color:var(--color-text-muted)]">
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
                    <CharacterPortrait speaker={u.name} unitId={u.id as unknown as string} classId={u.classId as unknown as string} size={30} active={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="voice-display truncate text-[0.82rem] text-[color:var(--color-parchment)]">
                        {u.name}
                      </span>
                      <span className={`numeral text-[0.65rem] ${hpText(u.hp.current, u.hp.max)}`}>
                        {u.hp.current}
                        <span className="text-[color:var(--color-text-muted)]">
                          /{u.hp.max}
                        </span>
                      </span>
                    </div>
                    <div className="hp-bar mt-1">
                      <div className="hp-bar__fill" style={{ width: `${pct}%`, background: hpFill(u.hp.current, u.hp.max) }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {objective && (
            <div
              className={`mt-2.5 flex items-start gap-1.5 border-t pt-2 ${parchment ? 'border-[color:var(--canvas-rule)]' : 'border-[rgba(120,98,60,0.22)]'}`}
            >
              {/* --color-hearth is scope-aware: struck brass on leather, the
                  AA-safe dark brass inside the parchment scope. */}
              <span className="text-hearth mt-0.5 flex">
                <Icon name="quest" size={12} />
              </span>
              <span className="text-parchment text-[0.7rem] leading-tight">
                {objective}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Context + resources */}
      <div
        className={
          // The resource bar used to be leather on EVERY screen, so a dark
          // riveted plate floated over each linen page and became the loudest
          // object on it — out-shouting the page's actual primary action. On a
          // page ground it becomes a pinned ledger tag; the scope re-declares
          // the text ramp, so the numerals invert to walnut ink on their own.
          (parchment
            ? 'surface-parchment rounded-md'
            : 'hud-panel')
          + ' pointer-events-none fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-3 px-4 py-2'
        }
        style={parchment ? { boxShadow: BAND_SAFE_SHADOW } : undefined}
      >
        {(regionName || location) && (
          <>
            <span className="flex flex-col leading-none">
              {regionName && (
                <span className="text-[0.55rem] uppercase tracking-[0.24em] text-[color:var(--color-text-muted)]">{regionName}</span>
              )}
              {location && <span className="voice-display text-sm text-[color:var(--color-parchment)]">{location}</span>}
            </span>
            <div className="hud-divider" />
          </>
        )}
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Day</span>
          <span className="numeral text-sm text-[color:var(--color-parchment)]">{days}</span>
        </span>
        <div className="hud-divider" />
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Food</span>
          <span key={foodPopKey} className={`numeral text-sm ${foodTint(food)} ${foodPopKey > 0 ? 'food-pop' : ''}`}>{food}</span>
        </span>
        <div className="hud-divider" />
        <span className="flex flex-col items-center leading-none">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Gold</span>
          {/* var(), not the text-hearth utility: Tailwind's @theme utility bakes
              the ROOT brass and would ignore the page scope's text-safe value. */}
          <span className="numeral text-sm" style={{ color: 'var(--color-hearth)' }}>{gold}</span>
        </span>
      </div>

      {/* Local feedback motion — durations collapse under reduced-motion via
          the token override, and the loops are additionally gated motion-safe. */}
      <style>{`
        @keyframes hudFoodPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.45; }
        }
        @keyframes hudFoodPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .food-crit { animation: hudFoodPulse 800ms ease-in-out infinite; }
          .food-pop  { animation: hudFoodPop var(--dur-quick) var(--ease-out-quart); }
          .food-crit.food-pop {
            animation:
              hudFoodPop var(--dur-quick) var(--ease-out-quart),
              hudFoodPulse 800ms ease-in-out infinite;
          }
        }
      `}</style>
    </>
  )
}
