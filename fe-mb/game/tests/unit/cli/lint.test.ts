/**
 * CONTRACT §10: `cli lint` = `lintContent` + `bootstrapQuests` + **the effect-param lint over `CONSUMED_PARAMS`**.
 * That third pass had no importer anywhere in the tree until CLI-09, so a card effect carrying a parameter the
 * resolver never reads would have shipped silently. `cards.ts` calls the table "the lint's truth table"; this is
 * the lint that makes the claim true.
 */
import { describe, expect, it } from 'vitest'
import { content } from '../../../src/content/index'
import { CONSUMED_PARAMS } from '../../../src/engine/combat/cards'
import { lintEffectParams } from '../../../scripts/cli'

type Cards = Pick<typeof content, 'cards'>

describe('lintEffectParams', () => {
  it('passes the shipped content', () => {
    expect(lintEffectParams(content)).toEqual([])
  })

  it('names a param the resolver never reads', () => {
    const card = { ...Object.values(content.cards)[0]!, id: 'fixture_card' }
    const bogus = { ...card, effects: [{ kind: 'Damage', target: 'target', base: 3, radius: 2 }] } as unknown as (typeof card)
    const errors = lintEffectParams({ cards: { fixture_card: bogus } } as unknown as Cards)
    expect(errors).toEqual(["card fixture_card Damage: param 'radius' is never read by the resolver"])
  })

  it('names an effect kind the resolver has no case for', () => {
    const card = { ...Object.values(content.cards)[0]!, id: 'fixture_card' }
    const bogus = { ...card, effects: [{ kind: 'Teleport', target: 'self', distance: 3 }] } as unknown as (typeof card)
    const errors = lintEffectParams({ cards: { fixture_card: bogus } } as unknown as Cards)
    expect(errors).toEqual(["card fixture_card: unknown effect kind 'Teleport'"])
  })

  it('accepts every param the truth table lists', () => {
    for (const [kind, params] of Object.entries(CONSUMED_PARAMS)) {
      const effect = Object.fromEntries(params.map((p) => [p, p === 'kind' ? kind : 1]))
      const card = { id: `fixture_${kind}`, effects: [effect] }
      expect(lintEffectParams({ cards: { [card.id]: card } } as unknown as Cards), kind).toEqual([])
    }
  })
})
