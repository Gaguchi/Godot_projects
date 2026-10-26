import { describe, expect, it } from 'vitest'
import { entryAt, foodCount, isFood } from '../../../../src/engine/run/bag'
import { bountyFor, buyPrice, entrySellPrice, innCost, sellPrice, shopStock } from '../../../../src/engine/run/economy'
import { livingUnits } from '../../../../src/engine/run/party'
import { buy, enterTown, innHeal, leaveTown, sell, talk, tavernBoard, turnIn } from '../../../../src/engine/run/town'
import type { Prisoner, RunState } from '../../../../src/engine/types'
import { env, newRun, withUnit } from '../../../helpers/runs'
import { at, firstNodeOfType } from '../../../helpers/overworld'

const town = firstNodeOfType('TOWN')
const def = env.content.towns[town.id]!
const inTown = (run: RunState): RunState => enterTown(at(run, town.id), env).state
const wound = (run: RunState, by: number): RunState => livingUnits(run).reduce((r, u) => withUnit(r, { ...u, hp: { ...u.hp, current: Math.max(1, u.hp.current - by) } }), run)

describe('run/town — enter / leave', () => {
  it('only a TOWN node opens; leave clears the slot', () => {
    const run = newRun(1)
    const off = enterTown(run, env)
    expect(off.state).toBe(run)
    expect(off.effects[0]?.kind).toBe('refused')
    const on = inTown(run)
    expect(on.town).toEqual({ townId: town.id })
    expect(leaveTown(on).town).toBeNull()
    expect(leaveTown(run)).toBe(run)
  })
})

describe('run/town — Inn (brief §2.10: own action, per wounded unit)', () => {
  it('refuses with nobody wounded or with gold short; otherwise heals every wounded unit to full for wounded × cost', () => {
    const fresh = inTown(newRun(1))
    expect(innHeal(fresh, env).state).toBe(fresh)
    const hurt = wound(fresh, 5)
    const cost = innCost(def, hurt, env)
    expect(cost.total).toBe(livingUnits(hurt).length * def.innHealCostPerUnit)
    const poor = { ...hurt, gold: cost.total - 1 }
    expect(innHeal(poor, env).state).toBe(poor)
    const r = innHeal({ ...hurt, gold: cost.total }, env)
    expect(r.state.gold).toBe(0)
    for (const u of livingUnits(r.state)) expect(u.hp.current).toBe(u.hp.max)
    expect(r.effects).toContainEqual({ kind: 'goldChanged', delta: -cost.total, reason: 'inn' })
    expect(r.effects.some((e) => e.kind === 'partyHealed')).toBe(true)
  })
})

describe('run/town — Shop', () => {
  it('buys a stocked potion into the bag for its price and sells it back at the sell ratio', () => {
    const run = inTown(newRun(1))
    const potion = shopStock(def, run, env).find((i) => i.kind === 'potion')!
    const price = buyPrice(potion)!
    const before = run.bag.length
    const bought = buy(run, potion.id, env)
    expect(bought.state.gold).toBe(run.gold - price)
    expect(bought.state.bag).toHaveLength(before + 1)
    expect(bought.effects).toContainEqual({ kind: 'itemAcquired', itemId: potion.id, rarity: potion.rarity, source: 'shop' })
    const added = bought.state.bag[bought.state.bag.length - 1]!
    const sold = sell(bought.state, added.x, added.y, env)
    expect(sold.state.gold).toBe(bought.state.gold + sellPrice(potion, env))
    expect(sold.state.bag).toHaveLength(before)
    expect(entryAt(sold.state.bag, added.x, added.y)).toBeNull()
  })
  it('a part-used ration sells for what is LEFT in it, and the quote is the price paid', () => {
    // `town/sell` used to pay `sellPrice(item)` with no reference to `entry.charges`, so a 1-of-3 ration fetched
    // the same coin as a full one while `foodChanged` correctly subtracted only the one charge — the purse and
    // the larder disagreed about what had been sold.
    const run = inTown(newRun(1))
    const food = shopStock(def, run, env).find((i) => i.kind === 'food')!
    const stack = food.charges!
    expect(stack).toBeGreaterThan(1)
    const bought = buy(run, food.id, env).state
    const full = bought.bag[bought.bag.length - 1]!
    expect(full.charges).toBe(stack)
    const partial = { ...full, charges: 1 }
    const used = { ...bought, bag: [...bought.bag.slice(0, -1), partial] }

    expect(entrySellPrice(full, env)).toBe(sellPrice(food, env))
    expect(entrySellPrice(partial, env)).toBeLessThan(entrySellPrice(full, env))
    expect(entrySellPrice(partial, env)).toBeGreaterThanOrEqual(1)

    const soldPartial = sell(used, partial.x, partial.y, env)
    expect(soldPartial.state.gold).toBe(used.gold + entrySellPrice(partial, env))
    expect(soldPartial.effects).toContainEqual({ kind: 'foodChanged', delta: -1, reason: 'shop' })
    const soldFull = sell(bought, full.x, full.y, env)
    expect(soldFull.state.gold).toBe(bought.gold + sellPrice(food, env))
    expect(soldFull.effects).toContainEqual({ kind: 'foodChanged', delta: -stack, reason: 'shop' })
    // the goods and the coin move together: more food out, more gold in
    expect(soldFull.state.gold - bought.gold).toBeGreaterThan(soldPartial.state.gold - used.gold)
  })

  it('food bought reports its charges; unbuyable / unstocked / unaffordable / bag-full are refused in place', () => {
    const run = inTown(newRun(1))
    const food = shopStock(def, run, env).find((i) => i.kind === 'food')!
    const r = buy(run, food.id, env)
    expect(isFood(r.state.bag[r.state.bag.length - 1]!, env)).toBe(true)
    expect(foodCount(r.state.bag, env)).toBe(foodCount(run.bag, env) + food.charges!)
    const legendary = Object.values(env.content.items).find((i) => i.rarity === 'legendary')!
    expect(buy(run, legendary.id, env).state).toBe(run)
    const broke = { ...run, gold: 0 }
    expect(buy(broke, food.id, env).state).toBe(broke)
    expect(sell(run, 7, 3, env).state).toBe(run) // empty cell
  })
})

describe('run/town — Tavern', () => {
  it('the quest board filters rows by visibleIf and talk opens a tavern dialogue only for a visible row', () => {
    const run = inTown(newRun(1))
    const board = tavernBoard(run, def, env)
    for (const row of board) expect(def.tavernQuests).toContainEqual(row)
    const hidden = def.tavernQuests.find((q) => !board.includes(q))
    if (hidden !== undefined) expect(talk(run, hidden.questId, hidden.dialogueId, env).state).toBe(run)
    const row = board[0]
    if (row !== undefined) {
      const r = talk(run, row.questId, row.dialogueId, env)
      expect(r.state.pendingDialogue).toMatchObject({ dialogueId: row.dialogueId, source: 'tavern' })
    }
  })
  it('the bounty board pays bountyFor per prisoner and removes the row; empty ledger is refused', () => {
    const run = inTown(newRun(1))
    expect(turnIn(run, [], env).state).toBe(run)
    const p1: Prisoner = { unitId: 'bandit_1', name: 'Bandit', classId: 'bandit', level: 1, bountyValue: null, capturedAtBattleId: 'battle:x' }
    const p2: Prisoner = { unitId: 'daren', name: 'Daren', classId: 'bandit', level: 3, bountyValue: 50, capturedAtBattleId: 'battle:x' }
    const jailed = { ...run, prisoners: [p1, p2] }
    const one = turnIn(jailed, [p1.unitId], env)
    expect(one.state.gold).toBe(jailed.gold + bountyFor(p1, env))
    expect(one.state.prisoners).toEqual([p2])
    expect(one.effects).toContainEqual({ kind: 'prisonerTurnedIn', unitId: p1.unitId, gold: bountyFor(p1, env) })
    const all = turnIn(jailed, jailed.prisoners.map((p) => p.unitId), env)
    expect(all.state.gold).toBe(jailed.gold + bountyFor(p1, env) + bountyFor(p2, env))
    expect(all.state.prisoners).toEqual([])
    expect(all.state.stats.goldEarned).toBe(jailed.stats.goldEarned + bountyFor(p1, env) + bountyFor(p2, env))
    expect(turnIn(jailed, ['nobody'], env).state).toBe(jailed)
  })

  it('two prisoners with the SAME unitId are two rows: two bounties paid, two rows gone', () => {
    // Repeatable encounters seed stable enemy ids, so the same named bandit can sit in the wagon twice. The old
    // set-filter deleted both rows for one payment; a `find` per id paid the first row twice on "turn in all".
    const run = inTown(newRun(1))
    const low: Prisoner = { unitId: 'bandit_archer', name: 'Bandit Archer', classId: 'bandit_archer', level: 1, bountyValue: null, capturedAtBattleId: 'battle:a' }
    const high: Prisoner = { ...low, level: 5, capturedAtBattleId: 'battle:b' }
    const jailed = { ...run, prisoners: [low, high] }
    const board = bountyFor(low, env) + bountyFor(high, env)
    expect(bountyFor(high, env)).toBeGreaterThan(bountyFor(low, env))

    const all = turnIn(jailed, jailed.prisoners.map((p) => p.unitId), env)
    expect(all.state.gold).toBe(jailed.gold + board) // the desk pays exactly what it advertised
    expect(all.state.prisoners).toEqual([])
    expect(all.effects.filter((e) => e.kind === 'prisonerTurnedIn')).toHaveLength(2)

    const one = turnIn(jailed, [low.unitId], env)
    expect(one.state.gold).toBe(jailed.gold + bountyFor(low, env))
    expect(one.state.prisoners).toEqual([high]) // one row consumed, not both
  })
})
