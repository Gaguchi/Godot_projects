import React from 'react'
import { useRunStore } from '../../state/runStore'
import { Button, GameHud, Heading } from '../components'
import { diag } from '../../state/diagLog'

export interface CampSceneProps {
  onLeave: () => void
}

const HEAL_PERCENT = 0.2

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
      className="fixed inset-0 overflow-auto text-amber-100"
      style={{ background: 'linear-gradient(to bottom, #221a10 0%, #15100a 58%, #0b0806 100%)' }}
    >
      <div aria-hidden className="hearth-glow pointer-events-none absolute inset-0" />
      <GameHud location="Camp" />
      <div className="relative mx-auto max-w-4xl px-8 pb-12 pt-24">
        <Heading level={1} className="text-3xl mb-2">Camp</Heading>
        <p className="text-parchment-dim italic mb-8">
          The fire crackles. The road waits.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
    <div className="border border-stone-700 bg-stone-900/60 rounded-md p-4 flex flex-col gap-3">
      <Heading level={2} className="text-xl">{title}</Heading>
      <p className="text-sm text-stone-300 flex-1">{description}</p>
      <div className="text-xs text-stone-500">{footer}</div>
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
  if (partyArr.length === 0) return <div className="text-stone-500 italic">No party.</div>
  return (
    <div className="border border-stone-700 bg-stone-900/40 rounded-md p-4">
      <Heading level={2} className="text-lg mb-3">Party</Heading>
      <ul className="space-y-1 text-sm">
        {partyArr.map((u) => {
          const pct = Math.max(0, Math.min(1, u.hp.current / u.hp.max))
          const barColor = pct > 0.66 ? 'bg-emerald-600' : pct > 0.33 ? 'bg-amber-500' : 'bg-red-600'
          return (
            <li key={u.id as unknown as string} className="flex items-center gap-3">
              <span className="voice-display text-stone-200 w-32 truncate">{u.name}</span>
              <span className="numeral text-stone-400 w-20 text-right">
                {u.hp.current} / {u.hp.max}
              </span>
              <div className="flex-1 h-2 bg-stone-800 rounded">
                <div
                  className={`h-2 rounded ${barColor}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
