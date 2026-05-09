import React from 'react'
import { Button as RACButton } from 'react-aria-components'

export interface CardProps {
  onPress: () => void
  cardName: string
  apCost: number
  availableAp: number
  isSelected?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Card wrapper. Click is RAC Button; hover lift is pure Tailwind/CSS so we
 * don't pay for Framer Motion in the bundle. data-[hovered]:/data-[pressed]:
 * variants come from RAC's state machine.
 *
 * prefers-reduced-motion users get no transform via Tailwind's
 * motion-safe:/motion-reduce: variants.
 */
export function Card({
  onPress, cardName, apCost, availableAp, isSelected, className, children,
}: CardProps): React.JSX.Element {
  const affordable = apCost <= availableAp
  const reason = affordable ? undefined : `needs ${apCost} AP, you have ${availableAp}`

  const buttonClass =
    'block w-24 h-36 rounded border-2 px-2 py-2 font-mono text-xs select-none ' +
    'outline-none ' +
    'transition-[transform,background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none ' +
    'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400 ' +
    (isSelected
      ? 'bg-stone-800 border-amber-400 text-amber-100 -translate-y-2'
      : affordable
        ? 'bg-stone-900/80 border-stone-600 text-stone-100 cursor-pointer ' +
          'data-[hovered]:border-amber-700 data-[hovered]:bg-stone-800 ' +
          'motion-safe:data-[hovered]:-translate-y-6 motion-safe:data-[hovered]:scale-105 ' +
          'data-[hovered]:shadow-[0_8px_16px_rgba(0,0,0,0.5)] ' +
          'data-[pressed]:translate-y-0 data-[pressed]:scale-100'
        : 'bg-stone-900/50 border-stone-700/50 text-stone-500 cursor-not-allowed')

  return (
    <div
      className="relative"
      data-testid={`card-${cardName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <RACButton
        onPress={onPress}
        isDisabled={!affordable}
        aria-label={cardName}
        data-selected={isSelected || undefined}
        data-disabled-reason={reason}
        className={`${buttonClass}${className ? ` ${className}` : ''}`}
      >
        {children}
      </RACButton>
    </div>
  )
}
