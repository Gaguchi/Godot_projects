import React, { useEffect, useRef, useState } from 'react'
import { useCombatStore } from '../../../state/combatStore'

/**
 * Turn-handoff banner. When the active TEAM flips (party <-> enemy) mid-battle,
 * a full-width band wipes across reading "YOUR TURN" / "ENEMY PHASE", then
 * clears — so turn ownership is never lost in a turn-based game where state
 * changes are easy to miss. Purely presentational (pointer-events-none); reads
 * combatStore only. Motion is transform/opacity + collapses under reduced-motion.
 */
export function PhaseBanner(): React.JSX.Element | null {
  const team = useCombatStore((s) => s.state.turn.team)
  const phase = useCombatStore((s) => s.state.phase)
  const prevTeam = useRef<string | null>(null)
  const seq = useRef(0)
  const [banner, setBanner] = useState<{ id: number; enemy: boolean } | null>(null)

  useEffect(() => {
    if (phase !== 'COMBAT' || team == null) {
      prevTeam.current = team ?? null
      return
    }
    if (prevTeam.current !== null && prevTeam.current !== team) {
      seq.current += 1
      setBanner({ id: seq.current, enemy: team !== 'party' })
    }
    prevTeam.current = team
  }, [team, phase])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 1300)
    return () => clearTimeout(t)
  }, [banner])

  if (!banner) return null
  const { enemy } = banner

  return (
    <div
      key={banner.id}
      aria-hidden
      className="phase-banner pointer-events-none absolute left-0 right-0 top-1/2 z-[110] flex justify-center"
    >
      <div
        className="w-full py-5 text-center"
        style={{
          background: enemy
            ? 'linear-gradient(90deg, transparent, rgba(40,14,12,0.92) 18%, rgba(58,18,14,0.92) 82%, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(36,28,16,0.92) 18%, rgba(48,38,22,0.92) 82%, transparent)',
          borderTop: `1px solid ${enemy ? 'rgba(208,104,92,0.5)' : 'rgba(232,169,58,0.5)'}`,
          borderBottom: `1px solid ${enemy ? 'rgba(208,104,92,0.5)' : 'rgba(232,169,58,0.5)'}`,
        }}
      >
        <span
          className={`voice-display text-3xl tracking-[0.4em] ${enemy ? 'text-enemy' : 'text-hearth'}`}
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          {enemy ? 'ENEMY PHASE' : 'YOUR TURN'}
        </span>
      </div>
    </div>
  )
}
