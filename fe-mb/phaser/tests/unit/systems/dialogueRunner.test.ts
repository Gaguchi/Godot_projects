import { describe, it, expect } from 'vitest'
import { step, visibleChoices, isChoiceEnabled } from '../../../src/systems/dialogueRunner'
import type { DialogueTree } from '../../../src/domain/dialogue'
import { asDialogueId, asDialogueNodeId, asFlagKey } from '../../../src/domain/ids'
import type { PredicateState } from '../../../src/systems/predicates'

const tree: DialogueTree = {
  id: asDialogueId('greet'),
  startNodeId: asDialogueNodeId('start'),
  nodes: {
    start: {
      id: asDialogueNodeId('start'),
      text: 'Hello traveler.',
      choices: [
        { id: 'help', text: 'Help me', effects: [{ kind: 'setFlag', key: asFlagKey('greeted'), value: true }], next: 'end' },
        { id: 'leave', text: 'Goodbye', effects: [], next: 'end' },
        { id: 'gated', text: 'Secret', visibleIf: { kind: 'flag', key: asFlagKey('unlocked') }, effects: [], next: 'end' },
      ],
    },
  },
}

const baseState = (): PredicateState => ({
  flags: new Map(), questStates: {}, party: { units: {} }, inventory: { items: [] },
  gold: 0, visitedNodes: new Set(), clearedEncounters: new Set(),
})

describe('dialogueRunner', () => {
  it('step returns next node + effects', () => {
    const r = step(tree, asDialogueNodeId('start'), 'help', baseState())
    expect(r.nextNodeId).toBe('end')
    expect(r.effects).toHaveLength(1)
  })

  it('visibleChoices filters by visibleIf', () => {
    const v = visibleChoices(tree, asDialogueNodeId('start'), baseState())
    expect(v.map(c => c.id)).toEqual(['help', 'leave'])
  })

  it('visibleChoices includes gated when flag set', () => {
    const s = baseState(); s.flags.set('unlocked', { value: true, scope: 'run' })
    const v = visibleChoices(tree, asDialogueNodeId('start'), s)
    expect(v.map(c => c.id)).toContain('gated')
  })

  it('throws on unknown node or choice', () => {
    expect(() => step(tree, asDialogueNodeId('phantom'), 'x', baseState())).toThrow()
    expect(() => step(tree, asDialogueNodeId('start'), 'phantom', baseState())).toThrow()
  })

  it('throws when choice not visible', () => {
    expect(() => step(tree, asDialogueNodeId('start'), 'gated', baseState())).toThrow()
  })

  it('isChoiceEnabled defaults true with no enabledIf', () => {
    expect(isChoiceEnabled(tree.nodes['start']!.choices[0]!, baseState())).toBe(true)
  })
})
