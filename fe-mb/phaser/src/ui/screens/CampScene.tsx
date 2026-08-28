import React from 'react'
import { useRunStore } from '../../state/runStore'
import { Button, GameHud, Heading } from '../components'
import { diag } from '../../state/diagLog'

export interface CampSceneProps {
  onLeave: () => void
}

const HEAL_PERCENT = 0.2

/**
 * Camp — a FIELD surface, not a page. The company is stopped on open ground:
 * trodden earth underfoot, the sky going down warm at the top of the frame.
 * Chrome is saddle leather (the one `hud-panel` recipe), text is the bone ramp
 * that recipe re-declares. No candle, no pooled glow, no vignette — the light
 * is just daylight falling off.
 */
const CAMP_GROUND =
  'linear-gradient(180deg, '
  + 'color-mix(in oklab, var(--iron-700) 46%, var(--iron-900)) 0%, '
  + 'var(--iron-800) 48%, '
  + 'var(--iron-900) 100%)'

/** HP tier fill + numeral colour, same contract the HUD uses: the numeral
 *  next to the bar is the redundant channel, so hue is never the sole cue. */
function hpFill(c: number, m: number): string {
  const p = c / Math.max(1, m)
  return p > 0.5 ? 'var(--hp-ok)' : p > 0.25 ? 'var(--hp-warn)' : 'var(--hp-crit)'
}
function hpTextColor(c: number, m: number): string {
  const p = c / Math.max(1, m)
  return p > 0.5 ? 'var(--hp-ok)' : p > 0.25 ? 'var(--hp-warn)' : 'var(--hp-crit-text)'
}

export function CampScene({ onLeave }: CampSceneProps): React.JSX.Element {
  const dispatchRun = useRunStore((s) => s.dispatch)
  const partyUnits = useRunStore((s) => s.party.units)
  const inventoryItems = useRunStore((s) => s.inventory.items)
  const flags = useRunStore((s) => s.flags)

  const partyArr = Object.values(partyUnits)
  const wounded = partyArr.filter((u) => u.hp.current < u.hp.max && u.hp.current > 0)
  const foodCount = inventoryItems.filter(
    (i) => (i.itemId as unknown as string) === 'food_rations',
  ).length
  const canRest = foodCount > 0 && partyArr.length > 0

  const onRest = (): void => {
    if (!canRest) return
    diag('route', 'camp.rest', { wounded: wounded.length, healPercent: HEAL_PERCENT })
    // Spend 1 food
    dispatchRun({ type: 'consumeFoodPerHop' })
    // Heal 20% of max HP across the party
    dispatchRun({ type: 'restParty', payload: { percent: HEAL_PERCENT } })
  }

  const onScout = (): void => {
    diag('route', 'camp.scout (stub)', { flagCount: flags.enumerate().length })
  }

  return (
    <div
      className="fixed inset-0 overflow-auto text-[color:var(--color-parchment)]"
      style={{ background: CAMP_GROUND }}
    >
      {/* trodden earth: a broad daylight fall-off from the sky, then the ground
          grain. Linear, top-down — nothing pools, nothing flickers. */}
      <div aria-hidden className="hearth-glow pointer-events-none absolute inset-0" />
      {/* the horizon: the lower frame is GROUND, not empty screen — a ridge
          line and a darker earth band under it give the void somewhere to be */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          // sits BELOW the panel stack so its edge never cuts across content
          height: '24%',
          background:
            'linear-gradient(180deg, rgba(214,178,108,0.05) 0px, rgba(20,13,6,0.10) 2px, '
            + 'rgba(20,13,6,0.38) 45%, rgba(20,13,6,0.66) 100%)',
        }}
      />
      <div aria-hidden className="iron-grain pointer-events-none absolute inset-0" />
      {/* The floating roster is suppressed here: the Party panel below carries
          the same three units at full width, and the roster's leather slab
          overlapped the "Camp" heading and its flavour line in the corner. */}
      <GameHud location="Camp" showParty={false} />
      <div className="relative mx-auto max-w-4xl px-8 pb-12 pt-24">
        <Heading level={1} className="mb-2 text-3xl">Camp</Heading>
        <p className="mb-8 italic text-[color:var(--color-parchment-dim)]">
          Kit spread on the grass, horses picketed. The road waits.
        </p>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CampOption
            title="Rest"
            description={
              canRest
                ? `Heal ${Math.floor(HEAL_PERCENT * 100)}% of max HP. Costs 1 food.`
                : 'Need food to rest.'
            }
            disabled={!canRest}
            onPress={onRest}
            footer={`${foodCount} food remaining · ${wounded.length} wounded`}
          />
          <CampOption
            title="Scout"
            description="Survey the road ahead for danger."
            disabled={true}
            onPress={onScout}
            footer="Coming soon"
          />
          <CampOption
            title="Leave"
            description="Break camp and return to the road."
            disabled={false}
            onPress={onLeave}
            footer="No cost"
          />
        </div>

        <PartyStatus />
      </div>
    </div>
  )
}

interface CampOptionProps {
  title: string
  description: string
  disabled: boolean
  onPress: () => void
  footer: string
}

function CampOption({ title, description, disabled, onPress, footer }: CampOptionProps): React.JSX.Element {
  return (
    <div className="hud-panel flex flex-col gap-3 p-4">
      <Heading level={2} className="hud-panel-header pb-2 text-xl">{title}</Heading>
      <p className="flex-1 text-sm text-[color:var(--color-parchment-dim)]">{description}</p>
      <div className="text-xs text-[color:var(--color-text-muted)]">{footer}</div>
      <Button
        onPress={onPress}
        isDisabled={disabled}
        variant={title === 'Rest' ? 'primary' : 'secondary'}
      >
        {title}
      </Button>
    </div>
  )
}

function PartyStatus(): React.JSX.Element {
  const partyUnits = useRunStore((s) => s.party.units)
  const partyArr = Object.values(partyUnits)
  if (partyArr.length === 0) {
    return (
      <div className="hud-panel flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="voice-display text-sm tracking-[0.18em] text-[color:var(--color-parchment-dim)]">
          No one left to muster
        </span>
        <span className="text-xs text-[color:var(--color-text-muted)]">
          Recruit at a town before you take the road again.
        </span>
      </div>
    )
  }
  return (
    <div className="hud-panel p-4">
      <Heading level={2} className="hud-panel-header mb-3 pb-2 text-lg">Party</Heading>
      {/* One cell per soldier on the same three-up rhythm as the options above,
          so the roster fills its panel instead of stranding a 570px HP bar
          beside a name and leaving the right half of the frame empty. */}
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {partyArr.map((u) => {
          const pct = Math.max(0, Math.min(1, u.hp.current / u.hp.max))
          return (
            <li key={u.id as unknown as string} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="voice-display truncate text-[color:var(--color-parchment)]">{u.name}</span>
                <span
                  className="numeral text-xs"
                  style={{ color: hpTextColor(u.hp.current, u.hp.max) }}
                >
                  {u.hp.current}
                  <span className="text-[color:var(--color-text-muted)]">/{u.hp.max}</span>
                </span>
              </div>
              <div className="hp-bar">
                <div
                  className="hp-bar__fill"
                  style={{ width: `${pct * 100}%`, background: hpFill(u.hp.current, u.hp.max) }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
