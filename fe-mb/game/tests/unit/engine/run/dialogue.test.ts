import { describe, expect, it } from 'vitest'
import { bustsAfter, choose, continueDialogue, currentNode, openDialogue, renderText, speakerName, visibleChoices } from '../../../../src/engine/run/dialogue'
import { questStatus } from '../../../../src/engine/run/quests'
import type { RunState, Unit } from '../../../../src/engine/types'
import { env, envWith, kinds, makeRun, unit } from './narrativeFixture'

const talk = (run: RunState, id: string, e = env) => openDialogue(run, id, 'travel', e).state

const withKael = (): RunState => {
  const base = makeRun()
  const kael: Unit = unit('kael', 'bandit_archer', { name: 'Kael', stats: { str: 7 } })
  return { ...base, party: { ...base.party, kael }, partyOrder: [...base.partyOrder, 'kael'] }
}

describe('dialogue — open / step / close', () => {
  it('openDialogue sets the slot at startNodeId with busts from its speaker, applies onEnter, emits dialogueOpened', () => {
    const r = openDialogue(makeRun(), 'bandit_threat', 'travel', env)
    expect(r.state.pendingDialogue).toEqual({ dialogueId: 'bandit_threat', nodeId: 'start', source: 'travel', busts: [null, 'bandit_leader'] })
    expect(r.effects).toEqual([{ kind: 'dialogueOpened', dialogueId: 'bandit_threat', nodeId: 'start' }])
    expect(currentNode(r.state, env)?.id).toBe('start')
    expect(currentNode(makeRun(), env)).toBeNull()
  })

  it('openDialogue throws while a check event is open and on an unknown tree', () => {
    const checking = makeRun({ pendingCheckEvent: { checkEventId: 'ambush_toll', source: 'travel', result: null } })
    expect(() => openDialogue(checking, 'bandit_threat', 'travel', env)).toThrow(/one suspender at a time/)
    expect(() => openDialogue(makeRun(), 'no_such_tree', 'travel', env)).toThrow(/unknown tree/)
  })

  it('choose refuses hidden / disabled / unknown choices (state reference unchanged, one refused)', () => {
    const broke = talk(makeRun({ gold: 5 }), 'bandit_threat') // "Pay the toll" is visibleIf goldAtLeast 15
    const hidden = choose(broke, 'c0', null, env)
    expect(hidden.state).toBe(broke)
    expect(kinds(hidden.effects)).toEqual(['refused'])
    const unknown = choose(broke, 'c9', null, env)
    expect(unknown.state).toBe(broke)
    expect(kinds(unknown.effects)).toEqual(['refused'])
    const gated = {
      id: 'fx_gated',
      startNodeId: 'start',
      nodes: { start: { id: 'start', text: 'Gate.', choices: [{ id: 'locked', text: 'Needs a mage', enabledIf: { kind: 'partyHas', classId: 'warlord' }, effects: [], next: 'end' }, { id: 'open', text: 'Fine', effects: [], next: 'end' }] } },
    }
    const fx = envWith({ dialogues: [gated] })
    const run = talk(makeRun(), 'fx_gated', fx)
    const disabled = choose(run, 'locked', null, fx)
    expect(disabled.state).toBe(run)
    expect(kinds(disabled.effects)).toEqual(['refused'])
    expect(visibleChoices(run, fx).map((c) => [c.id, c.enabled])).toEqual([['locked', false], ['open', true]])
    const none = choose(makeRun(), 'open', null, fx)
    expect(none.state).toEqual(makeRun())
    expect(kinds(none.effects)).toEqual(['refused'])
  })

  it('a plain choice applies its effects, moves to next and applies that node onEnter', () => {
    const rich = talk(makeRun({ gold: 40 }), 'bandit_threat')
    const r = choose(rich, 'c0', null, env) // pay 15 → 'pay'
    expect(r.state.gold).toBe(25)
    expect(r.state.pendingDialogue?.nodeId).toBe('pay')
    expect(kinds(r.effects)).toEqual(['goldChanged'])
    const fight = choose(rich, 'c2', null, env) // startCombat → 'fight'
    expect(fight.state.pendingCombat?.enemies).toMatchObject({ kind: 'group', enemyGroupId: 'bandits_small' })
    expect(fight.state.pendingDialogue?.nodeId).toBe('fight')
  })

  it('check choices route to onPass/onFail (auto-pick when no unit is given; explicit unit honoured)', () => {
    // intimidate is STR 6 as of 0055 — a first-region beat the STARTING party can answer (Oak 6, the MC 5).
    const run = talk(withKael(), 'bandit_threat')
    const auto = choose(run, 'c1', null, env) // auto-pick takes the best: Kael 7
    expect(auto.state.pendingDialogue?.nodeId).toBe('intimidate_success')
    expect(auto.state.pendingCombat).toBeNull()
    const oak = choose(run, 'c1', 'oak', env)
    expect(oak.state.pendingDialogue?.nodeId).toBe('intimidate_success')
    const mc = choose(run, 'c1', 'mc', env) // named explicitly, the foundling's STR 5 fails it
    expect(mc.state.pendingDialogue?.nodeId).toBe('intimidate_fail')
    expect(mc.state.pendingCombat?.enemies).toMatchObject({ enemyGroupId: 'bandits_small' }) // intimidate_fail.onEnter → startCombat
    const weak = talk(makeRun(), 'bandit_threat') // no Kael: auto-picks Oak, who now clears it
    expect(choose(weak, 'c1', null, env).state.pendingDialogue?.nodeId).toBe('intimidate_success')
    const nobody = choose(run, 'c1', 'nobody', env)
    expect(nobody.state).toBe(run)
    expect(kinds(nobody.effects)).toEqual(['refused'])
  })

  it("'end' closes the slot with dialogueClosed after the choice effects", () => {
    const paid = choose(talk(makeRun({ gold: 40 }), 'bandit_threat'), 'c0', null, env).state
    const r = choose(paid, 'continue', null, env)
    expect(r.state.pendingDialogue).toBeNull()
    expect(r.effects).toEqual([{ kind: 'dialogueClosed', dialogueId: 'bandit_threat' }])
  })

  it('continueDialogue closes a zero-choice node and is refused otherwise', () => {
    const terminal = {
      id: 'fx_terminal',
      startNodeId: 'only',
      nodes: { only: { id: 'only', text: 'The road is quiet.', onEnter: [{ kind: 'addGold', amount: 5 }], choices: [] } },
    }
    const fx = envWith({ dialogues: [terminal] })
    const opened = openDialogue(makeRun({ gold: 0 }), 'fx_terminal', 'travel', fx)
    expect(opened.state.gold).toBe(5)
    expect(kinds(opened.effects)).toEqual(['dialogueOpened', 'goldChanged'])
    expect(visibleChoices(opened.state, fx)).toEqual([])
    const closed = continueDialogue(opened.state, fx)
    expect(closed.state.pendingDialogue).toBeNull()
    expect(closed.effects).toEqual([{ kind: 'dialogueClosed', dialogueId: 'fx_terminal' }])
    const withChoices = talk(makeRun(), 'bandit_threat')
    const refused = continueDialogue(withChoices, env)
    expect(refused.state).toBe(withChoices)
    expect(kinds(refused.effects)).toEqual(['refused'])
    expect(continueDialogue(makeRun(), env).state).toEqual(makeRun())
  })

  it('a node whose choices are ALL hidden or ALL disabled can still be closed (no wedged run)', () => {
    // `content/lint.ts` forbids authoring this; the engine still has to degrade instead of locking the run
    // (CONTRACT-CHANGES 0031 — Continue was gated on the RAW choice count, so nothing was legal).
    const wedge = {
      id: 'fx_wedge',
      startNodeId: 'start',
      nodes: {
        start: {
          id: 'start',
          text: 'Nobody is going to answer that.',
          choices: [
            { id: 'rich', text: 'Buy your way out', visibleIf: { kind: 'goldAtLeast', amount: 100000 }, effects: [], next: 'end' },
            { id: 'friend', text: 'Send the bandit in', enabledIf: { kind: 'partyHas', classId: 'bandit' }, effects: [], next: 'end' },
          ],
        },
      },
    }
    const fx = envWith({ dialogues: [wedge] })
    const run = talk(makeRun({ gold: 0 }), 'fx_wedge', fx)
    expect(fx.content.dialogues['fx_wedge']?.nodes['start']?.choices).toHaveLength(2)
    expect(visibleChoices(run, fx).filter((c) => c.enabled)).toEqual([])
    const closed = continueDialogue(run, fx)
    expect(closed.state.pendingDialogue).toBeNull()
    expect(closed.effects).toEqual([{ kind: 'dialogueClosed', dialogueId: 'fx_wedge' }])
    // One playable choice is enough to keep Continue off the band.
    const playable = talk(makeRun({ gold: 100000 }), 'fx_wedge', fx)
    expect(continueDialogue(playable, fx).state).toBe(playable)
  })

  it('visibleChoices hides visibleIf failures and greys disabled ones with the best-in-party candidate', () => {
    const run = talk(withKael(), 'bandit_threat')
    const rows = visibleChoices(run, env)
    expect(rows.map((c) => c.id)).toEqual(['c0', 'c1', 'c2'])
    expect(rows[1]?.bestCandidate).toMatchObject({ unitId: 'kael', statValue: 7, meetsThreshold: true })
    expect(rows[0]?.bestCandidate).toBeNull()
    expect(rows.every((c) => c.enabled)).toBe(true)
    expect(visibleChoices(talk(makeRun({ gold: 5 }), 'bandit_threat'), env).map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('an accept dialogue starts its quest through the engine path (sq_blood_ties_accept → startQuest)', () => {
    let run = talk(makeRun(), 'sq_blood_ties_accept')
    run = choose(run, 'continue', null, env).state // explain
    run = choose(run, 'continue', null, env).state // request
    const accepted = choose(run, 'c0', null, env)
    expect(accepted.state.pendingDialogue?.nodeId).toBe('accept')
    expect(questStatus(accepted.state, 'sq_blood_ties')).toBe('active')
    expect(accepted.state.spawnedNodes['darens_camp']).toBe(true)
    expect(kinds(accepted.effects)).toEqual(['questStarted'])
    const closed = choose(accepted.state, 'continue', null, env)
    expect(closed.state.pendingDialogue).toBeNull()
    expect(questStatus(closed.state, 'sq_blood_ties')).toBe('active')
  })

  it('promptName fired mid-dialogue sits on top of the dialogue, which continues after', () => {
    const naming = {
      id: 'fx_naming',
      startNodeId: 'start',
      nodes: {
        start: { id: 'start', speaker: 'guildmistress_anya', text: 'And your name, captain?', choices: [{ id: 'tell', text: 'Tell her', effects: [{ kind: 'promptName', target: 'mc' }], next: 'after' }] },
        after: { id: 'after', speaker: 'guildmistress_anya', text: 'Welcome to the guild, {mc}.', choices: [{ id: 'continue', text: 'Continue', effects: [], next: 'end' }] },
      },
    }
    const fx = envWith({ dialogues: [naming] })
    const r = choose(talk(makeRun(), 'fx_naming', fx), 'tell', null, fx)
    expect(r.state.pendingNamePrompt).toEqual({ target: 'mc' })
    expect(r.state.pendingDialogue?.nodeId).toBe('after')
  })
})

describe('dialogue — busts, text, speakers', () => {
  it("busts follow the speaker's side: party team / narrator faction left, everyone else right; a slot keeps its occupant", () => {
    const none: readonly [string | null, string | null] = [null, null]
    expect(bustsAfter(none, undefined, env)).toBe(none) // narrator leaves both
    expect(bustsAfter(none, 'mc', env)).toEqual(['mc', null])
    expect(bustsAfter(['mc', null], 'bandit_leader', env)).toEqual(['mc', 'bandit_leader'])
    expect(bustsAfter(['mc', 'bandit_leader'], 'oak', env)).toEqual(['oak', 'bandit_leader'])
    expect(bustsAfter(['oak', 'bandit_leader'], 'lilina', env)).toEqual(['lilina', 'bandit_leader']) // party team, whatever her portrait faction
    expect(bustsAfter(['lilina', 'bandit_leader'], 'daren', env)).toEqual(['lilina', 'daren'])
    expect(bustsAfter(['lilina', 'daren'], 'kael', env)).toEqual(['kael', 'daren']) // a recruitable unit is our side before he joins
    const same: readonly [string | null, string | null] = ['kael', 'daren']
    expect(bustsAfter(same, 'daren', env)).toBe(same)
    expect(bustsAfter(same, 'guildmistress_anya', env)).toEqual(['kael', 'guildmistress_anya'])
    // Through a real tree: the Blood Ties resolution alternates kael (left) and daren (right).
    let run = talk(makeRun(), 'sq_blood_ties_daren_captured')
    expect(run.pendingDialogue?.busts).toEqual(['kael', null])
    run = choose(run, 'continue', null, env).state
    expect(run.pendingDialogue?.busts).toEqual(['kael', 'daren'])
    run = choose(run, 'continue', null, env).state
    expect(run.pendingDialogue?.busts).toEqual(['kael', 'daren'])
  })

  it('renders {mc}/{company} and the mc speaker with the run name, and the placeholder before it is set', () => {
    const unnamed = makeRun()
    expect(renderText('{mc} of {company} — {mc}.', unnamed, env)).toBe('the foundling of the company — the foundling.')
    expect(speakerName('mc', unnamed, env)).toBe('The Foundling')
    const named = makeRun({ mcName: 'Corwin', companyName: 'the Ember March' })
    expect(renderText('{mc} of {company}.', named, env)).toBe('Corwin of the Ember March.')
    expect(speakerName('mc', named, env)).toBe('Corwin')
    expect(speakerName(undefined, named, env)).toBeNull()
    expect(speakerName('oak', named, env)).toBe('Bagrat "Oak"')
    expect(speakerName('kael', named, env)).toBe('Kael') // not in the party yet: content display name
    expect(speakerName('bandit_leader', named, env)).toBe('Bandit Leader')
    expect(speakerName('nobody_here', named, env)).toBe('nobody_here')
    expect(renderText('No braces here.', named, env)).toBe('No braces here.')
  })
})
