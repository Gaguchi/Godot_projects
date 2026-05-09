import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DialogueModal } from '../../../../src/ui/modals/DialogueModal'
import { useRunStore } from '../../../../src/state/runStore'
import { registerDialogue, clearDialogues } from '../../../../src/state/dialogueRegistry'
import { asDialogueId, asDialogueNodeId } from '../../../../src/domain/ids'

describe('<DialogueModal>', () => {
  beforeEach(() => {
    useRunStore.getState().__resetForTest()
    clearDialogues()
  })

  it('renders nothing when pendingDialogue is null', () => {
    const { container } = render(<DialogueModal />)
    expect(container.querySelector('#dialogue-modal')).toBeNull()
  })

  it('shows missing-tree message when dialogue id not registered', () => {
    useRunStore.getState().dispatch({
      type: 'startDialogue',
      payload: { dialogueId: asDialogueId('phantom'), nodeId: 'start' },
    })
    render(<DialogueModal />)
    expect(screen.getByText(/Dialogue Not Found/)).toBeInTheDocument()
  })

  it('renders speaker + text + choices when tree is registered', () => {
    registerDialogue({
      id: asDialogueId('greeter'),
      startNodeId: asDialogueNodeId('start'),
      nodes: {
        start: {
          id: asDialogueNodeId('start'),
          speaker: 'Old Man',
          text: 'Halt, traveler.',
          choices: [
            { id: 'greet', text: 'Greetings.', effects: [], next: asDialogueNodeId('end_node') },
            { id: 'leave', text: 'Goodbye.', effects: [], next: 'end' },
          ],
        },
        end_node: {
          id: asDialogueNodeId('end_node'),
          text: 'Safe travels.',
          choices: [{ id: 'close', text: 'Done', effects: [], next: 'end' }],
        },
      },
    })
    useRunStore.getState().dispatch({
      type: 'startDialogue',
      payload: { dialogueId: asDialogueId('greeter'), nodeId: 'start' },
    })
    render(<DialogueModal />)
    expect(screen.getByText('Old Man')).toBeInTheDocument()
    expect(screen.getByText('Halt, traveler.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Greetings.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Goodbye.' })).toBeInTheDocument()
  })

  it('clicking a choice with next=end calls endDialogue', () => {
    registerDialogue({
      id: asDialogueId('greeter'),
      startNodeId: asDialogueNodeId('start'),
      nodes: {
        start: {
          id: asDialogueNodeId('start'),
          text: 'Hi',
          choices: [{ id: 'leave', text: 'Bye', effects: [], next: 'end' }],
        },
      },
    })
    useRunStore.getState().dispatch({
      type: 'startDialogue',
      payload: { dialogueId: asDialogueId('greeter'), nodeId: 'start' },
    })
    render(<DialogueModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Bye' }))
    expect(useRunStore.getState().pendingDialogue).toBeNull()
  })

  it('clicking a choice with effects fires them via applyQuestEffects', () => {
    registerDialogue({
      id: asDialogueId('greeter'),
      startNodeId: asDialogueNodeId('start'),
      nodes: {
        start: {
          id: asDialogueNodeId('start'),
          text: 'Take this gold',
          choices: [{ id: 'take', text: 'Thanks', effects: [{ kind: 'addGold', amount: 50 }], next: 'end' }],
        },
      },
    })
    useRunStore.getState().dispatch({
      type: 'startDialogue',
      payload: { dialogueId: asDialogueId('greeter'), nodeId: 'start' },
    })
    render(<DialogueModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Thanks' }))
    expect(useRunStore.getState().gold).toBe(50)
  })
})
