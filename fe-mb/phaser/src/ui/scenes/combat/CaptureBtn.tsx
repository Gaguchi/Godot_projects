import React from 'react'
import { Button, Tooltip } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'

interface CaptureCandidate {
  enemyId: string
  enemyName: string
  chancePct: number
}

function manhattanDistance(a: string, b: string): number {
  const [ax, ay] = a.split(',').map(Number)
  const [bx, by] = b.split(',').map(Number)
  return Math.abs((ax ?? 0) - (bx ?? 0)) + Math.abs((ay ?? 0) - (by ?? 0))
}

export function CaptureBtn(): React.JSX.Element | null {
  const dispatch = useCombatStore((s) => s.dispatch)
  const team = useCombatStore((s) => s.state.turn.team)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const units = useCombatStore((s) => s.state.units)
  const rngState = useCombatStore((s) => s.state.rng)

  if (!activeId || team !== 'party' || subPhase === 'RESOLVING') return null
  const activeUnit = units[activeId as unknown as string]
  if (!activeUnit?.position) return null
  const activePos = activeUnit.position as unknown as string

  // Find adjacent enemies with HP < 50%
  const candidates: CaptureCandidate[] = []
  for (const u of Object.values(units)) {
    if (u.hp.current <= 0) continue
    if (!u.position) continue
    const isEnemy = (u.classId as unknown as string).includes('bandit')
    if (!isEnemy) continue
    const enemyPos = u.position as unknown as string
    if (manhattanDistance(activePos, enemyPos) !== 1) continue
    const hpFraction = u.hp.current / Math.max(1, u.hp.max)
    if (hpFraction >= 0.5) continue
    // Capture chance estimate matching the reducer formula (HP-based + adjacency bonus,
    // assumes 1 attacker = the active unit; bountyHunter not modeled here)
    const chance = Math.max(0, Math.min(1, (1 - hpFraction) * 0.6 + 0.25))
    candidates.push({
      enemyId: u.id as unknown as string,
      enemyName: u.name,
      chancePct: Math.round(chance * 100),
    })
  }

  if (candidates.length === 0) return null

  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-auto">
      {candidates.map((c) => {
        const btn = (
          <Button
            key={c.enemyId}
            id={`capture-${c.enemyId}`}
            variant="danger"
            onPress={() => {
              dispatch(
                {
                  type: 'capture',
                  payload: {
                    targetId: c.enemyId as never,
                    attackerIds: [activeId],
                  },
                },
                createRng(rngState),
              )
            }}
            className="!text-xs"
          >
            Capture {c.enemyName} ({c.chancePct}%)
          </Button>
        )
        return (
          <Tooltip
            key={c.enemyId}
            trigger={btn}
            content={`Capture chance based on ${c.enemyName}'s low HP and your adjacency. Roll determines success.`}
          />
        )
      })}
    </div>
  )
}
