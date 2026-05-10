import { describe, it, expect } from 'vitest'
import { step, visibleChoices, isChoiceEnabled } from '../../../src/systems/dialogueRunner'
import type { DialogueTree } from '../../../src/domain/dialogue'
import type { Unit } from '../../../src/domain/unit'
import { asDialogueId, asDialogueNodeId, asFlagKey, asUnitId, asClassId } from '../../../src/domain/ids'
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

const mkUnit = (id: string, str: number, hp = 20): Unit => ({
  id: asUnitId(id), name: id.toUpperCase(), classId: asClassId('lord'), level: 1,
  hp: { current: hp, max: 20 },
  stats: { str, mag: 0, skl: 4, spd: 5, def: 3, res: 1, lck: 0 },
  position: null, ap: 3, armor: 0, statuses: [],
})

describe('dialogueRunner (legacy paths)', () => {
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

describe('dialogueRunner (check-bearing choices)', () => {
  const checkTree: DialogueTree = {
    id: asDialogueId('check'),
    startNodeId: asDialogueNodeId('start'),
    nodes: {
      start: {
        id: asDialogueNodeId('start'),
        text: 'Force the door?',
        choices: [
          {
            id: 'force', text: 'Force', effects: [],
            check: { kind: 'stat', stat: 'str', threshold: 7 },
            onPass: 'won' as never, onFail: 'lost' as never,
          },
        ],
      },
      won: { id: asDialogueNodeId('won'), text: 'Open.', choices: [{ id: 'c', text: 'k', effects: [], next: 'end' }] },
      lost: { id: asDialogueNodeId('lost'), text: 'Stuck.', choices: [{ id: 'c', text: 'k', effects: [], next: 'end' }] },
    },
  }

  it('passing stat check follows onPass', () => {
    const r = step(checkTree, asDialogueNodeId('start'), 'force', baseState(), {
      partyState: { gold: 0, foodCount: 0, party: [mkUnit('strong', 8)] },
    })
    expect(r.nextNodeId).toBe('won')
  })

  it('failing stat check follows onFail', () => {
    const r = step(checkTree, asDialogueNodeId('start'), 'force', baseState(), {
      partyState: { gold: 0, foodCount: 0, party: [mkUnit('weak', 3)] },
    })
    expect(r.nextNodeId).toBe('lost')
  })

  it('explicit attempting unit overrides auto-pick', () => {
    const r = step(checkTree, asDialogueNodeId('start'), 'force', baseState(), {
      partyState: { gold: 0, foodCount: 0, party: [mkUnit('strong', 8), mkUnit('weak', 3)] },
      attemptingUnitId: asUnitId('weak'),
    })
    expect(r.nextNodeId).toBe('lost')
  })

  it('check fails when no party state given', () => {
    const r = step(checkTree, asDialogueNodeId('start'), 'force', baseState())
    expect(r.nextNodeId).toBe('lost')
  })

  it('class check resolves party-wide (no attempting unit needed)', () => {
    const classTree: DialogueTree = {
      id: asDialogueId('cls'),
      startNodeId: asDialogueNodeId('start'),
      nodes: {
        start: {
          id: asDialogueNodeId('start'),
          text: 'Got a healer?',
          choices: [
            {
              id: 'try', text: 'Try', effects: [],
              check: { kind: 'class', classId: asClassId('cleric') },
              onPass: 'good' as never, onFail: 'bad' as never,
            },
          ],
        },
        good: { id: asDialogueNodeId('good'), text: 'Y', choices: [{ id: 'c', text: 'k', effects: [], next: 'end' }] },
        bad: { id: asDialogueNodeId('bad'), text: 'N', choices: [{ id: 'c', text: 'k', effects: [], next: 'end' }] },
      },
    }
    const cleric: Unit = { ...mkUnit('cleric_a', 1), classId: asClassId('cleric') }
    const r = step(classTree, asDialogueNodeId('start'), 'try', baseState(), {
      partyState: { gold: 0, foodCount: 0, party: [cleric] },
    })
    expect(r.nextNodeId).toBe('good')
  })
})
