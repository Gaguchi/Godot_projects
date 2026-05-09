import React from 'react'
import { Button as RACButton } from 'react-aria-components'
import { motion, useReducedMotion } from 'framer-motion'

export interface CardProps {
  onPress: () => void
  cardName: string
  apCost: number
  availableAp: number
  isSelected?: boolean
  className?: string
  children: React.ReactNode
}

export function Card({
  onPress, cardName, apCost, availableAp, isSelected, className, children,
}: CardProps): React.JSX.Element {
  const affordable = apCost <= availableAp
  const reason = affordable ? undefined : `needs ${apCost} AP, you have ${availableAp}`
  const reduceMotion = useReducedMotion()

  const lift = !reduceMotion && affordable
    ? { whileHover: { y: -24, scale: 1.04 }, whileTap: { y: -20, scale: 1.02 } }
    : {}

  const buttonClass =
    'block w-24 h-36 rounded border-2 px-2 py-2 font-mono text-xs select-none ' +
    'transition-colors outline-none ' +
    'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400 ' +
    (isSelected
      ? 'bg-stone-800 border-amber-400 text-amber-100'
      : affordable
        ? 'bg-stone-900/80 border-stone-600 text-stone-100 cursor-pointer ' +
          'data-[hovered]:border-amber-700 data-[hovered]:bg-stone-800'
        : 'bg-stone-900/50 border-stone-700/50 text-stone-500 cursor-not-allowed')

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative"
      data-testid={`card-${cardName.toLowerCase().replace(/\s+/g, '-')}`}
      {...lift}
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
    </motion.div>
  )
}
