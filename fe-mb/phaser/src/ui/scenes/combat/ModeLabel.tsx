import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCombatStore } from '../../../state/combatStore'

export function ModeLabel(): React.JSX.Element {
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const text = subPhase === 'SELECTING_MOVE'
    ? 'Click a highlighted tile to move (ESC to cancel)'
    : subPhase === 'SELECTING_TARGET'
      ? 'Click a target (ESC or right-click to cancel)'
      : null

  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={subPhase}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-900/80 border border-amber-500 text-amber-50 font-mono text-sm tracking-wider rounded shadow-lg z-10"
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
