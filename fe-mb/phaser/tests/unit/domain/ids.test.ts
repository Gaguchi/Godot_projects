import { describe, it, expect } from 'vitest'
import { asUnitId, asItemId, asCardId, asFlagKey } from '../../../src/domain/ids'

describe('branded ids', () => {
  it('preserves string value through brand cast', () => {
    expect(asUnitId('roy')).toBe('roy')
    expect(asItemId('iron_sword')).toBe('iron_sword')
    expect(asCardId('slash')).toBe('slash')
    expect(asFlagKey('quest.bloodTies.complete')).toBe('quest.bloodTies.complete')
  })
})
