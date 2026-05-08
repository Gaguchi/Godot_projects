import { describe, it, expect } from 'vitest'
import { runEffects, type Middleware, type PipelineCtx } from '../../../src/systems/effectPipeline'
import type { CardEffect } from '../../../src/domain/card'
import { asUnitId, asCardId } from '../../../src/domain/ids'

const dmg = (target: string, amount: number, ap = false): CardEffect => ({
  kind: 'Damage', targetId: asUnitId(target), amount, damageType: 'physical', source: asCardId('test'), armorPiercing: ap,
})

const stubCtx: PipelineCtx = { sourceUnitId: asUnitId('roy'), now: 0 }

describe('effectPipeline.runEffects', () => {
  it('passes through with no middleware', () => {
    const r = runEffects([dmg('e', 5)], [], stubCtx)
    expect(r.emitted).toEqual([dmg('e', 5)])
  })

  it('source modifier increases damage (stage 1)', () => {
    const sourceMod: Middleware = (e) => e.kind === 'Damage' ? [{ ...e, amount: e.amount + 3 }] : [e]
    const r = runEffects([dmg('e', 5)], [{ stage: 1, fn: sourceMod }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ kind: 'Damage', amount: 8 })
  })

  it('respects stage ordering (1=source, 2=target, 3=terrain, 4=card, 5=armor, 6=clamp)', () => {
    const order: string[] = []
    const middlewares: { stage: 1|2|3|4|5|6; fn: Middleware }[] = []
    const stages = [1, 2, 3, 4, 5, 6] as const
    for (const s of stages) {
      middlewares.push({ stage: s, fn: (e) => { order.push(`s${s}`); return [e] } })
    }
    runEffects([dmg('e', 5)], middlewares, stubCtx)
    expect(order).toEqual(['s1','s2','s3','s4','s5','s6'])
  })

  it('armor reducer at stage 5 reduces non-piercing damage', () => {
    const armor: Middleware = (e) => e.kind === 'Damage' && !e.armorPiercing ? [{ ...e, amount: Math.max(0, e.amount - 3) }] : [e]
    const r = runEffects([dmg('e', 7), dmg('e', 7, true)], [{ stage: 5, fn: armor }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ amount: 4 })
    expect(r.emitted[1]).toMatchObject({ amount: 7 })
  })

  it('clamp at stage 6 floors damage at 0', () => {
    const clamp: Middleware = (e) => e.kind === 'Damage' ? [{ ...e, amount: Math.max(0, e.amount) }] : [e]
    const r = runEffects([dmg('e', -5)], [{ stage: 6, fn: clamp }], stubCtx)
    expect(r.emitted[0]).toMatchObject({ amount: 0 })
  })

  it('middleware can spawn additional effects', () => {
    const spawn: Middleware = (e) => e.kind === 'Damage' ? [e, { kind: 'GainAp', unitId: asUnitId('roy'), amount: 1 }] : [e]
    const r = runEffects([dmg('e', 3)], [{ stage: 4, fn: spawn }], stubCtx)
    expect(r.emitted.length).toBe(2)
  })

  it('middleware can absorb effects (return empty)', () => {
    const absorb: Middleware = () => []
    const r = runEffects([dmg('e', 3)], [{ stage: 2, fn: absorb }], stubCtx)
    expect(r.emitted.length).toBe(0)
  })
})
