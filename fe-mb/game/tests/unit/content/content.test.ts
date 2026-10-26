import { describe, expect, it } from 'vitest'
import { quiverEffects } from '../../../src/engine/combat/deck'
import { content, getCard, getEnemyAI, getNode, spriteIdFor, starterCharacters } from '../../../src/content/index'
import { lintContent, lintContentWarnings } from '../../../src/content/lint'
import { CardEffectSchema, QuiverModifierSchema } from '../../../src/content/schemas'

const count = (t: Readonly<Record<string, unknown>>) => Object.keys(t).length

describe('content registry', () => {
  it('loads and is deep-frozen', () => {
    expect(Object.isFrozen(content)).toBe(true)
    expect(Object.isFrozen(content.cards)).toBe(true)
    expect(Object.isFrozen(getCard('iron_sword_slash').effects)).toBe(true)
    expect(() => getCard('nope')).toThrow(/unknown card 'nope'/)
  })

  it('matches the brief counts', () => {
    // 161 ported + 6 for the two Thornwood commons the tier-2 loot row needed + 2 of Kael's signature cards.
    expect(count(content.cards)).toBe(169)
    expect(count(content.items)).toBe(51)
    const byRarity: Record<string, number> = {}
    for (const it of Object.values(content.items)) byRarity[it.rarity] = (byRarity[it.rarity] ?? 0) + 1
    expect(byRarity).toEqual({ common: 16, uncommon: 25, rare: 3, epic: 4, legendary: 3 })
    expect(count(content.classes)).toBe(13)
    expect(content.classes['cleric']).toBeDefined() // raider_cleric renamed (brief §3)
    expect(content.classes['raider_cleric']).toBeUndefined()
    // 9 ported groups + the authored final-boss group the BOSS node needs + the Smuggler's Cave crew
    // + the light corridor pack the dungeons field instead of the ROADSIDE ambush roster (0055).
    expect(Object.keys(content.enemyGroups).sort()).toEqual([
      'ashfall_raiders', 'ashford_company', 'bandit_lookouts', 'bandits_small', 'brigands', 'darens_gang',
      'mage_circle', 'shield_wall', 'smuggler_crew', 'thornwood_ambush', 'wolf_alpha_pack', 'wolves',
    ])
    expect(count(content.enemyAI)).toBe(10)
    expect(count(content.encounterTables)).toBe(3)
    expect(count(content.checkEvents)).toBe(26) // 14 shipped + the six discovery events + the six underground ones (0108)
    expect(count(content.dungeons)).toBe(5)
    expect(count(content.towns)).toBe(5)
    expect(count(content.quests)).toBe(2)
    expect(count(content.dialogues)).toBe(13)
    expect(count(content.regions)).toBe(3)
    expect(content.overworld.nodes).toHaveLength(47)
    expect(content.overworld.edges).toHaveLength(68)
  })

  it('applies the §2/§3 content rulings', () => {
    expect(content.enemyGroups['wolves']!.members.every((m) => m.classId === 'wolf')).toBe(true)
    expect(content.enemyGroups['bandits_small']!.members.find((m) => m.name === 'Bandit Archer')!.classId).toBe('bandit_archer')
    expect(content.enemyGroups['darens_gang']!.members.find((m) => m.id === 'daren')!.bountyValue).toBe(50)
    expect(content.items['healing_potion']!.effect).toEqual({ kind: 'Heal', amount: 10 })
    expect(content.items['power_elixir']!.effect).toEqual({ kind: 'GainAp', amount: 3 })
    // 4 charges at 40 gold = 10 gold a hop (0055): at 3-for-50 the larder ate two thirds of every purse.
    expect(content.items['food_rations']!.charges).toBe(4)
    for (const it of Object.values(content.items)) {
      if (it.rarity === 'epic' || it.rarity === 'legendary') expect(it.buyPrice).toBeUndefined()
      else expect(it.buyPrice).toBeGreaterThan(0)
    }
    expect(content.classes['lord']!).not.toHaveProperty('growthRates')
    expect(content.classes['lord']!.innateCardIds).toContain('lord_charge')
    expect(getCard('lord_charge').effects[0]).toEqual({ kind: 'Move', target: 'self', distance: 2 })
    expect(getCard('frost_axe_shatter').effects[1]).toEqual({ kind: 'RemoveStatus', target: 'target', remove: 'armor', all: true })
  })

  it('carries statuses on enemy AI actions', () => {
    expect(getEnemyAI('thief').actions.find((a) => a.id === 'envenomed_stab')!.applyStatus).toEqual({ effectId: 'poison', value: 2, turns: 2 })
    expect(getEnemyAI('ember_mage').actions.find((a) => a.id === 'ember_bolt')!.applyStatus).toEqual({ effectId: 'burn', value: 2, turns: 2 })
    const howl = getEnemyAI('alpha_wolf').actions.find((a) => a.id === 'alpha_howl')!
    expect(howl.kind).toBe('buff')
    expect(howl.applyStatus).toEqual({ effectId: 'empower', value: 2, turns: 1 })
    expect(content.enemyAI['bandit_priest']).toBeUndefined()
  })

  it('ships one open sheet with tiers, a boss and matching encounter tables', () => {
    const w = content.overworld
    expect(w.startNodeId).toBe('frontier_camp')
    const boss = w.nodes.filter((n) => n.type === 'BOSS')
    expect(boss).toHaveLength(1)
    expect(boss[0]!.id).toBe('the_iron_throne')
    expect(boss[0]!.areaTier).toBe(3)
    expect(boss[0]!.enemyGroupId).toBe('ashford_company')
    expect(getNode('frontier_camp').areaTier).toBe(1)
    expect(getNode('darens_camp').hidden).toBe(true)
    for (const e of w.edges) expect(content.encounterTables[e.encounterTableId]).toBeDefined()
    expect(new Set(w.nodes.map((n) => n.regionId))).toEqual(new Set(['borderlands', 'thornwood', 'ashfall']))
    expect(w.edges.some((e) => e.from === 'border_fortress' && e.to === 'thornwood_gate')).toBe(true)
  })

  it('has the cast keyed by character id', () => {
    expect(starterCharacters().map((c) => c.id)).toEqual(['mc', 'oak', 'lilina'])
    const oak = content.characters['oak']!
    expect(oak.kind === 'unit' && oak.passiveIds).toEqual(['genatsvale'])
    expect(oak.kind === 'unit' && oak.spriteId).toBe('marcus')
    expect(spriteIdFor('mc', 'lord')).toBe('roy')
    expect(spriteIdFor('wolf_2', 'wolf')).toBe('wolf')
    expect(spriteIdFor('bandits_small_0', 'bandit')).toBe('bandit')
    expect(spriteIdFor(null, 'cleric')).toBe('raider_cleric')
    expect(spriteIdFor('nobody', 'nothing')).toBeNull()
    for (const d of Object.values(content.dialogues)) {
      for (const n of Object.values(d.nodes)) {
        if (n.speaker !== undefined) expect(content.characters[n.speaker], `${d.id}/${n.id} speaker`).toBeDefined()
        expect(n.text).not.toMatch(/\b(Roy|Marcus)\b/)
      }
    }
    expect(content.dialogues['prologue']!.nodes['intro_3']!.speaker).toBe('mc')
    expect(content.dialogues['prologue']!.nodes['intro_4']!.speaker).toBe('oak')
  })

  it('activates quests with startQuest and never declares __complete__', () => {
    for (const q of Object.values(content.quests)) expect(q.stages['__complete__']).toBeUndefined()
    expect(content.dialogues['sq_blood_ties_accept']!.nodes['accept']!.onEnter).toEqual([{ kind: 'startQuest', questId: 'sq_blood_ties' }])
    // The guild-registration beat (§2.16): Anya asks the foundling's name before she writes them into the register —
    // and the prompt rides the CHOICE that answers her, never the node's onEnter. Raised on entry it opened OVER the
    // line that asks, so the player typed a name into an empty prompt and read the question afterwards (3.6).
    const register = content.dialogues['sq_caravan_accept']!.nodes['accept']!
    expect(register.onEnter).toEqual([{ kind: 'startQuest', questId: 'sq_missing_caravan' }])
    expect(register.text).toMatch(/I put no one on the guild's books unnamed/)
    expect(register.choices[0]!.effects).toEqual([{ kind: 'promptName', target: 'mc' }])
    const join = content.dialogues['sq_blood_ties_daren_captured']!.nodes['join']!
    expect(join.onEnter).toContainEqual({ kind: 'recruitCharacter', characterId: 'kael' })
    // …and the company is named once the first companion has joined, right after he does (§2.16 "at a guild, once a
    // few companions have joined"). Both `promptName` beats exist, so the lint's exemption for the kind is gone.
    expect(join.choices[0]!.effects).toContainEqual({ kind: 'promptName', target: 'company' })
    // The rule, not the two instances: no naming prompt anywhere is raised by the node that asks for the name.
    for (const d of Object.values(content.dialogues)) {
      for (const n of Object.values(d.nodes)) {
        expect((n.onEnter ?? []).some((e) => e.kind === 'promptName'), `${d.id}/${n.id}`).toBe(false)
      }
    }
    const gate = content.towns['pine_crossing']!.tavernQuests[0]!.visibleIf
    expect(gate).toEqual({ kind: 'not', pred: { kind: 'questStarted', questId: 'sq_blood_ties' } })
  })

  it('passes the cross-reference lint', () => {
    expect(lintContent(content)).toEqual([])
  })

  it('the caravan wreck stays in the table until the manifest is taken', () => {
    // Both wrecks were one-shots with a "Leave it for the crows." exit, so declining twice stranded the quest.
    const wrecks = Object.values(content.encounterTables).flatMap((t) => t.entries).filter((e) => e.outcome.kind === 'dialogue' && e.outcome.dialogueId === 'sq_caravan_found')
    expect(wrecks).toHaveLength(2)
    for (const e of wrecks) {
      expect(e.oneShot).toBe(false)
      expect(e.conditions).toContainEqual({ kind: 'notFlag', key: 'caravan_supplies_found' })
    }
  })

  it('a bandit parley that fails ends in steel, and passing beats failing', () => {
    // Every fail narration promised a fight and carried no effect; the only effect in the event was `addGold -30`
    // on the pay-toll PASS, so passing the gold check was strictly worse than failing it.
    for (const ch of content.checkEvents['bandit_parley']!.choices) {
      expect(ch.check).toBeDefined()
      expect(ch.onFail?.effects).toEqual([{ kind: 'startCombat', enemyGroupId: 'brigands' }])
      expect(ch.onPass.effects.length).toBeGreaterThan(0)
    }
  })

  it('prints every approximated card as a warning and never silently drains the list (DECISIONS: no silent approximations)', () => {
    const warnings = lintContentWarnings(content)
    const todos = warnings.filter((w) => w.includes('TODO(mechanic)'))
    // The 27 rows still standing in docs/research/gear-content-deviations.md, each with the mechanic it waits on.
    expect(todos).toHaveLength(27)
    for (const card of Object.values(content.cards)) {
      if (card.todoMechanic === undefined) continue
      expect(todos).toContain(`card ${card.id}: TODO(mechanic) ${card.todoMechanic}`)
    }
    // The rest of the warning list, pinned so a new authoring smell cannot slip in unnoticed: every DISCOVERY node
    // has its event, every dungeon has an event deck, and only two thresholds sit outside the authoring band.
    // The authoring band is [4, 9] as of 0055 — its floor is the lowest stat a level-1 starter can still fail on
    // (LCK 4), so the shipped first-region checks no longer warn just for being passable in the first hour.
    expect(warnings.filter((w) => !w.includes('TODO(mechanic)'))).toEqual([])
  })

  it('every check the party is offered can actually be passed', () => {
    // A STR 8 boulder and a `cleric` prayer were authored against a party whose ceilings are STR 7 and no cleric:
    // guaranteed failures whose pass narration and reward were dead content.
    const broken = (patch: Parameters<typeof lintContent>[0]) => lintContent(patch)
    const ev = content.checkEvents['blocked_passage']!
    const force = ev.choices[0]!
    const tooStrong = { ...content, checkEvents: { ...content.checkEvents, blocked_passage: { ...ev, choices: [{ ...force, check: { kind: 'stat' as const, stat: 'str' as const, threshold: 8 } }, ...ev.choices.slice(1)] } } }
    expect(broken(tooStrong)).toContain('check event blocked_passage/force: STR 8 is unreachable — the best obtainable unit is kael at 7')
    const noCleric = { ...content, checkEvents: { ...content.checkEvents, blocked_passage: { ...ev, choices: [{ ...force, check: { kind: 'class' as const, classId: 'cleric' } }, ...ev.choices.slice(1)] } } }
    expect(broken(noCleric)).toContain("check event blocked_passage/force: needs class 'cleric', which no starter or recruitable character has")
  })

  /**
   * RE-GATE C 3.5. The reach lint above asks whether ANY obtainable unit could pass; Kael (STR 7 / SKL 9 / SPD 8 /
   * LCK 6) answers for almost everything, and he joins deep inside Blood Ties, which runs AWAY from the throne.
   * With no XP, no level-up and no stat-granting item anywhere in the engine, a company that walks the road it is
   * pointed down keeps the sheet `starter: true` ships for the whole run — so the rule is region-blind.
   */
  it('fails the lint when a decision is above the STARTING party sheet, in the FIRST region', () => {
    const ev = content.checkEvents['bandit_hideout']!   // a tier-1 DISCOVERY node event
    const search = ev.choices[0]!
    const aboveTheSheet = { ...ev, choices: [{ ...search, check: { kind: 'stat' as const, stat: 'skl' as const, threshold: 7 } }, ...ev.choices.slice(1)] }
    const errors = lintContent({ ...content, checkEvents: { ...content.checkEvents, bandit_hideout: aboveTheSheet } })
    expect(errors.some((e) => e.startsWith('check event bandit_hideout: a decision the company the game guarantees cannot answer'))).toBe(true)
    // Kael can pass SKL 7, so the older reach rule stays silent on exactly this content — which is why it shipped.
    expect(errors.some((e) => e.includes('SKL 7 is unreachable'))).toBe(false)
  })

  it('fails the lint on the same shape in the LAST region — the sheet never grows, so neither does the exemption', () => {
    // The shipped tier-3 shrine WAS this: LCK 6 was its only check, against the foundling's LCK 4, so the whole
    // card was one struck row over a no-op. It read that way live at Cragmaw Fortress (RE-GATE C 3.5).
    const ev = content.checkEvents['ancient_shrine']!   // ashfall (tier 3): Kael territory
    const only = ev.choices.find((c) => c.check !== undefined)!
    const raised = { ...ev, choices: ev.choices.map((c) => (c === only ? { ...c, check: { kind: 'stat' as const, stat: 'skl' as const, threshold: 9 } } : c)) }
    const errors = lintContent({ ...content, checkEvents: { ...content.checkEvents, ancient_shrine: raised } })
    expect(errors.some((e) => e.startsWith('check event ancient_shrine: a decision the company the game guarantees cannot answer'))).toBe(true)
  })

  it('still lets a decision ask for MORE than the starting sheet, as long as it also carries a door the company can open', () => {
    // What recruiting Kael is FOR. `disarm_trap` keeps SKL 7 (his) beside STR 6 (Oak's) and the bigger purse rides
    // the specialist's door: 60 gold against 30.
    const ev = content.checkEvents['disarm_trap']!
    const skill = ev.choices.find((c) => c.id === 'disarm_skill')!
    const muscle = ev.choices.find((c) => c.id === 'muscle_through')!
    expect(skill.check).toEqual({ kind: 'stat', stat: 'skl', threshold: 7 })
    expect(muscle.check).toEqual({ kind: 'stat', stat: 'str', threshold: 6 })
    expect(lintContent(content).filter((e) => e.includes('disarm_trap'))).toEqual([])
  })

  it('counts a purse or a larder check as a live door — a stat is fixed by the sheet, gold is not', () => {
    // `warlords_camp` offers SPD 8 (Kael's) beside a 60-gold bribe. The bribe is answerable by PLAY, so the card
    // is a real decision for a company that never met Kael, and the lint must not read it as a wall.
    const ev = content.checkEvents['warlords_camp']!
    expect(ev.choices.map((c) => c.check?.kind)).toContain('gold')
    expect(lintContent(content).filter((e) => e.includes('warlords_camp'))).toEqual([])
    const noPurse = { ...ev, choices: ev.choices.filter((c) => c.check?.kind !== 'gold') }
    expect(lintContent({ ...content, checkEvents: { ...content.checkEvents, warlords_camp: noPurse } })
      .some((e) => e.startsWith('check event warlords_camp: a decision the company the game guarantees cannot answer'))).toBe(true)
  })

  it('every decision the shipped world can open offers the guaranteed company at least one live door', () => {
    // The ratchet 3.5 asked for: twelve stat checks and one class check sat above the sheet, and four decisions
    // carried nothing else. Any future authoring that recreates that shape reddens here, in every region.
    expect(lintContent(content).filter((e) => e.includes('cannot answer'))).toEqual([])
  })

  /**
   * RE-GATE C 3.13. `classes.json#weaponClasses` is the data home of the training rule; these are the three ways
   * it can be authored wrong, and every one of them is silent at runtime.
   */
  describe('a hand the game deals is a hand its holder is trained to', () => {
    it('fails on a character shipped holding gear its own chassis refuses', () => {
      const lilina = content.characters['lilina']!
      if (lilina.kind !== 'unit') throw new Error('fixture')
      const armed = { ...lilina, startingGear: { ...lilina.startingGear, right: 'iron_tower_shield' } }
      expect(lintContent({ ...content, characters: { ...content.characters, lilina: armed } }))
        .toContain('character lilina: starts with Iron Tower Shield in the right hand, and Mages do not carry shields')
    })

    it('fails when a weaponClass has items on the shelf and nobody the player can field is trained to it', () => {
      // Kael is the only archer the player can recruit; take bows off his chassis and eight bow items, five
      // quivers and three crossbows become drops nothing in the company can ever hold.
      const archer = content.classes['bandit_archer']!
      const grounded = { ...archer, weaponClasses: archer.weaponClasses.filter((w) => w !== 'bow') }
      const errors = lintContent({ ...content, classes: { ...content.classes, bandit_archer: grounded } })
      expect(errors).toContain("weaponClass 'bow': items ship in it and no class the player can field is trained to it — every one of those drops is dead loot")
    })

    it('fails a party chassis trained to no card-bearing arm at all', () => {
      const mage = content.classes['mage']!
      const disarmed = { ...mage, weaponClasses: [] }
      expect(lintContent({ ...content, classes: { ...content.classes, mage: disarmed } }).some((e) => e.startsWith('class mage:'))).toBe(true)
    })

    it('the shipped roster is clean, and between them the company covers every arm on the shelf', () => {
      expect(lintContent(content).filter((e) => e.includes('trained') || e.includes('dead loot'))).toEqual([])
    })
  })

  it('fails the lint on a check whose pass only costs while its failure is free', () => {
    const ev = content.checkEvents['bandit_parley']!
    const toll = ev.choices[1]!
    const inverted = { ...ev, choices: [ev.choices[0]!, { ...toll, onFail: { ...toll.onFail!, effects: [] } }, ...ev.choices.slice(2)] }
    expect(lintContent({ ...content, checkEvents: { ...content.checkEvents, bandit_parley: inverted } }))
      .toContain('check event bandit_parley/pay_toll: passing only costs the party while failing is free — the reward is inverted')
  })

  it('fails the lint on a dialogue choice that spends gold or food with nothing gating it', () => {
    const tree = content.dialogues['wounded_traveler']!
    const start = tree.nodes['start']!
    const gift = start.choices[0]!
    const ungated = { ...gift, check: undefined, onPass: undefined, onFail: undefined, next: 'give_food', effects: [{ kind: 'addFood' as const, amount: -2 }] }
    const broken = { ...content, dialogues: { ...content.dialogues, wounded_traveler: { ...tree, nodes: { ...tree.nodes, start: { ...start, choices: [ungated, ...start.choices.slice(1)] } } } } }
    expect(lintContent(broken)).toContain('dialogue wounded_traveler/start/c0: spends gold or food with no check / visibleIf — the player can pay with nothing')
  })

  it('fails the lint when a quest stage waits on a flag only a declinable one-shot writes', () => {
    // The shipped bug: both caravan-wreck entries were one-shots with a "Leave it for the crows." exit, so declining
    // both stranded `sq_missing_caravan` at `find_supplies` with no NPC on any board.
    const patchOneShot = (tableId: string, entryId: string) => {
      const t = content.encounterTables[tableId]!
      return { ...t, entries: t.entries.map((e) => (e.id === entryId ? { ...e, oneShot: true } : e)) }
    }
    const broken = {
      ...content,
      encounterTables: {
        ...content.encounterTables,
        borderlands_road: patchOneShot('borderlands_road', 'sq_caravan_wreck'),
        thornwood_road: patchOneShot('thornwood_road', 'sq_caravan_wreck_tw'),
      },
    }
    expect(lintContent(broken)).toContain("quest sq_missing_caravan/find_supplies: transition to 'return_reward' waits on flag 'caravan_supplies_found', whose every writer sits behind a one-shot the player can decline — the stage can strand")
    expect(lintContent(content).some((p) => p.includes('can strand'))).toBe(false)
  })

  it('fails the lint when a named enemy has two unconditioned homes', () => {
    const cave = content.dungeons['smugglers_cave']!
    const named = [{ unitId: 'daren', capturedDialogueId: 'sq_blood_ties_daren_captured', killedDialogueId: 'sq_blood_ties_daren_killed', capturedFlag: 'daren_captured', killedFlag: 'daren_killed' }]
    const broken = { ...content, dungeons: { ...content.dungeons, smugglers_cave: { ...cave, bossEnemyGroupId: 'darens_gang', bossCaptureTargets: named } } }
    expect(lintContent(broken).join('\n')).toMatch(/capture target 'daren' is fielded by 2 unconditioned battle sources/)
  })

  it('fails the lint on a dungeon whose elite or boss room fields the room before it', () => {
    const mine = content.dungeons['iron_mine']!
    const flat = { ...mine, eliteEnemyGroupId: mine.combatEnemyGroupId, bossEnemyGroupId: mine.combatEnemyGroupId }
    const problems = lintContent({ ...content, dungeons: { ...content.dungeons, iron_mine: flat } })
    expect(problems).toContain(`dungeon iron_mine: combat and elite rooms both field '${mine.combatEnemyGroupId}' — the elite room is the corridor again`)
    expect(problems).toContain(`dungeon iron_mine: elite and boss rooms both field '${mine.combatEnemyGroupId}' — the boss fight is the room before it`)
  })

  /**
   * RE-GATE C 3.6. `promptName` suspends the run with a text field over everything; raised in a node's `onEnter`
   * it opens over the very line that asks for the name.
   */
  it('fails the lint on a naming prompt raised by the node that asks for the name', () => {
    const tree = content.dialogues['sq_caravan_accept']!
    const node = tree.nodes['accept']!
    const raised = { ...node, onEnter: [{ kind: 'promptName' as const, target: 'mc' as const }, ...(node.onEnter ?? [])] }
    expect(lintContent({ ...content, dialogues: { ...content.dialogues, sq_caravan_accept: { ...tree, nodes: { ...tree.nodes, accept: raised } } } }))
      .toContain('dialogue sq_caravan_accept/accept: promptName in onEnter opens the prompt over the line that asks for the name — put it on the choice that answers')
  })

  /**
   * RE-GATE C 3.7. Kael's briefing is the game's only tutorialisation of capture and it called the verb "Subdue",
   * a word on no button, in no menu and in no CLI verb (ARCHITECTURE §5.1, "One name per thing, everywhere").
   */
  it('fails the lint when content teaches a mechanic by a name the UI does not use', () => {
    const tree = content.dialogues['sq_blood_ties_accept']!
    const node = tree.nodes['request']!
    const subdue = { ...node, text: "Use the Subdue skill when he's weakened." }
    expect(lintContent({ ...content, dialogues: { ...content.dialogues, sq_blood_ties_accept: { ...tree, nodes: { ...tree.nodes, request: subdue } } } }))
      .toContain('dialogue sq_blood_ties_accept/request: says "Subdue" — the combat command, the CLI verb and the bounty desk all call it Capture')
    // …and the shipped briefing teaches the word the button carries.
    expect(content.dialogues['sq_blood_ties_accept']!.nodes['request']!.text).toMatch(/\bCapture\b/)
    for (const d of Object.values(content.dialogues)) {
      for (const n of Object.values(d.nodes)) expect(n.text, `${d.id}/${n.id}`).not.toMatch(/subdue/i)
    }
  })

  /**
   * RE-GATE C 3.8. The event deck is dealt across the WHOLE graph without replacement, so a short deck leaves
   * event rooms on the empty-room fallback — Smuggler's Cave shipped two for a graph that dealt four.
   */
  it('fails the lint on a dungeon whose event deck is shorter than the graph deals', () => {
    const cave = content.dungeons['smugglers_cave']!
    const thin = { ...cave, roomEvents: cave.roomEvents.slice(0, 2) }
    expect(lintContent({ ...content, dungeons: { ...content.dungeons, smugglers_cave: thin } }))
      .toContain('dungeon smugglers_cave: 2 roomEvents against a graph that deals up to 6 event rooms — the rest fall through to the empty room')
    const doubled = { ...cave, roomEvents: [...cave.roomEvents.slice(0, 5), cave.roomEvents[0]!] }
    expect(lintContent({ ...content, dungeons: { ...content.dungeons, smugglers_cave: doubled } }))
      .toContain('dungeon smugglers_cave: the same event is in the deck twice — the deck is dealt without replacement')
  })

  it('fails the lint when an enemy AI profile and its class disagree about movement', () => {
    const bandit = content.enemyAI['bandit']!
    const drifted = { ...content, enemyAI: { ...content.enemyAI, bandit: { ...bandit, movement: 9 } } }
    expect(lintContent(drifted)).toContain('enemy AI bandit: movement 9 != class bandit startingMov 4 (the danger overlay reads the class, the AI reads this)')
  })

  it('fails the lint when a weighted loot rarity has no region-legal item behind it', () => {
    // Thornwood shipped ZERO common gear against a tier-2 row that weights common at 50, and `fallDown.common` is
    // null — half of every tier-2 drop evaporated in silence.
    const quiver = content.items['standard_quiver']!
    const items = Object.fromEntries(
      Object.entries(content.items)
        .filter(([, it]) => !(it.region === 'thornwood' && it.rarity === 'common'))
        .map(([id, it]) => [id, id === 'standard_quiver' ? { ...quiver, region: 'borderlands' as const } : it]),
    )
    const problems = lintContent({ ...content, items }).filter((p) => p.startsWith('loot row'))
    expect(problems.join('\n')).toMatch(/loot row travel tier 2 in thornwood: weights common at 50/)
    expect(lintContent(content).some((p) => p.includes('loot row'))).toBe(false)
  })

  it('fails the lint on a quiver with no modifier, and the entry-level quiver now carries one', () => {
    const quiver = content.items['standard_quiver']!
    expect(quiver.quiverModifier).toEqual({ kind: 'thunder', value: 1, turns: 0 })
    const inert = { ...content, items: { ...content.items, standard_quiver: { ...quiver, quiverModifier: undefined } } }
    expect(lintContent(inert)).toContain('item standard_quiver: quiver carries 0 cards AND no quiverModifier — it would occupy a hand slot and do nothing')
  })

  it('refuses a quiver modifier whose duration the CardEffect schema would reject', () => {
    // `combat/deck.ts#quiverEffects` turns poison/slow straight into `ApplyStatus { turns }`, and CardEffect's
    // `turns` is `min(1)` — a `turns: 0` poison quiver minted a malformed effect.
    expect(QuiverModifierSchema.safeParse({ kind: 'poison', value: 2, turns: 0 }).success).toBe(false)
    expect(QuiverModifierSchema.safeParse({ kind: 'slow', value: 2, turns: 0 }).success).toBe(false)
    expect(QuiverModifierSchema.safeParse({ kind: 'thunder', value: 3, turns: 1 }).success).toBe(false)
    expect(QuiverModifierSchema.safeParse({ kind: 'poison', value: 2, turns: 2 }).success).toBe(true)
    expect(QuiverModifierSchema.safeParse({ kind: 'thunder', value: 3, turns: 0 }).success).toBe(true)
    for (const it of Object.values(content.items)) {
      if (it.quiverModifier === undefined) continue
      for (const e of quiverEffects(it.quiverModifier)) expect(CardEffectSchema.safeParse(e).success).toBe(true)
    }
  })

  it('fails the lint on a party class that draws its whole deck every turn', () => {
    const kael = content.characters['kael']!
    expect(kael.kind === 'unit' && kael.signatureCardIds).toEqual(['kael_hunters_patience', 'kael_hamstring'])
    const stripped = { ...content, characters: { ...content.characters, kael: { ...kael, signatureCardIds: [] } } }
    expect(lintContent(stripped)).toContain('character kael: deck is 5 cards against a hand of 5 — it draws whole every turn (add class innates or signatureCardIds)')
  })

  it('fails the lint on a dialogue node whose every choice is gated (no unconditional way out)', () => {
    const tree = content.dialogues['bandit_threat']!
    const node = tree.nodes['start']!
    const gated = { ...node, choices: node.choices.map((ch) => ({ ...ch, visibleIf: ch.visibleIf ?? { kind: 'goldAtLeast' as const, amount: 99999 } })) }
    const broken = { ...content, dialogues: { ...content.dialogues, bandit_threat: { ...tree, nodes: { ...tree.nodes, start: gated } } } }
    expect(lintContent(broken)).toContain('dialogue bandit_threat/start: every choice is gated (visibleIf/enabledIf) — the node needs one unconditional way out')
  })

  it('fails the lint on a quest effect kind the engine implements and nothing emits (brief §7.8)', () => {
    const quest = content.quests['sq_blood_ties']!
    const stage = quest.stages['find_daren']!
    const broken = { ...content, quests: { ...content.quests, sq_blood_ties: { ...quest, stages: { ...quest.stages, find_daren: { ...stage, onEnter: [] } } } } }
    expect(lintContent(broken)).toContain("quest effect 'spawnNode': the engine implements it but no content emits it (brief §7.8)")
    // and the exemption list expires: the moment content emits an exempted kind, the lint says to delete the entry
    expect(lintContent(content).some((p) => p.includes('delete its exemption'))).toBe(false)
  })

  it('fails the lint on a startCombat capture target that is not a member of its group', () => {
    const ev = content.checkEvents['darens_camp']!
    const choice = ev.choices[0]!
    const eff = choice.onPass.effects[0]!
    expect(eff.kind).toBe('startCombat')
    const bad = { ...eff, captureTargets: [{ unitId: 'not_in_the_gang', capturedDialogueId: 'sq_blood_ties_daren_captured', killedDialogueId: 'sq_blood_ties_daren_killed', capturedFlag: 'daren_captured', killedFlag: 'daren_killed' }] }
    const broken = {
      ...content,
      checkEvents: { ...content.checkEvents, darens_camp: { ...ev, choices: [{ ...choice, onPass: { ...choice.onPass, effects: [bad] } }, ...ev.choices.slice(1)] } },
    }
    expect(lintContent(broken)).toContain("check event darens_camp/storm: capture target 'not_in_the_gang' is not a member id of group darens_gang")
  })

  it('fails the lint on a dangling reference', () => {
    const broken = {
      ...content,
      classes: { ...content.classes, lord: { ...content.classes['lord']!, innateCardIds: ['no_such_card'] } },
    }
    expect(lintContent(broken)).toContain("class lord: unknown innate card 'no_such_card'")
  })
})
