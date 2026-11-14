/**
 * ui/overlays/checkReading.ts — what an answer asks of the company, read ONCE for every surface that prints it (the
 * road event, the road talk, the tavern talk).
 *
 * Three things come out of one reading, so they cannot disagree: the tag in figures (`STR 6 · Oak 6`), the verdict
 * the tag is coloured and marked by, and the sentence that says the same thing in words under the list. The verdict
 * is the ENGINE's own: `evaluateCheck` on the unit `autoPick` will send, which is exactly what `check/choose` and
 * `dialogue/choose` run when the player presses the answer (`run/checks.ts`, `run/dialogue.ts`).
 */
import { foodCount } from '../../engine/run/bag'
import { autoPick, checkCandidates, evaluateCheck } from '../../engine/run/checks'
import { displayName, livingUnits } from '../../engine/run/party'
import type { CheckRequirement, EngineEnv, RunState } from '../../engine/types'
import { className } from '../names'

export interface CheckReading {
  readonly tag: string
  readonly ok: boolean
  readonly why: string
}

/** The line under the list for an answer that carries no check at all. */
export const UNTESTED = 'Nothing is tested here: the answer is simply taken.'

const STAT_LABEL: Readonly<Record<string, string>> = { str: 'STR', mag: 'MAG', skl: 'SKL', spd: 'SPD', lck: 'LCK', def: 'DEF', res: 'RES', mov: 'MOV' }

export function readCheck(check: CheckRequirement, run: RunState, env: EngineEnv): CheckReading {
  const ok = evaluateCheck(check, autoPick(check, run, env), run, env)
  switch (check.kind) {
    case 'stat': {
      const stat = STAT_LABEL[check.stat] ?? check.stat
      const best = checkCandidates(check, run)[0]
      if (best === undefined) return { tag: `${stat} ${check.threshold}`, ok, why: `Nobody is fit to answer this: it asks ${stat} ${check.threshold}.` }
      return {
        tag: `${stat} ${check.threshold} · ${best.name} ${best.statValue}`,
        ok,
        why: `${best.name} answers this one: ${stat} ${best.statValue} ${ok ? 'meets' : 'falls short of'} the ${check.threshold} it asks.`,
      }
    }
    case 'class': {
      const wanted = className(check.classId, env)
      const who = livingUnits(run).find((u) => u.classId === check.classId)
      if (who === undefined) return { tag: `needs a ${wanted}`, ok, why: `Nobody in the company is a ${wanted}: this cannot go well.` }
      return { tag: `needs a ${wanted} · ${displayName(who, run)}`, ok, why: `${displayName(who, run)} is the ${wanted} this asks for.` }
    }
    case 'gold':
      return {
        tag: `${check.amount} gold · ${run.gold} held`,
        ok,
        why: ok ? `It costs ${check.amount} gold of the ${run.gold} in the purse.` : `It asks ${check.amount} gold and the purse holds ${run.gold}.`,
      }
    default: {
      const held = foodCount(run.bag, env)
      return {
        tag: `${check.amount} food · ${held} held`,
        ok,
        why: ok ? `It costs ${check.amount} food of the ${held} in the satchel.` : `It asks ${check.amount} food and the satchel holds ${held}.`,
      }
    }
  }
}
