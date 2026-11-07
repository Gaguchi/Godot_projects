// Probe: the real run behind UxMarket. Seed 36 (the run PxTownInn and PxCamp trace to), walked
// traders_rest -> frontier_camp -> riverside_market, the town entered, the inn paid, then the market read:
// the day's stock in price order, the purse, the satchel, what the merchant pays for each of ours,
// who can hold the Iron Buckler, the deck sizes, and the buy itself (purse and where it lands).
// Built on dirs/consistency/probe_inn.mts; game/ is only imported, never written.
// Usage (scratchpad root): E:/Work/GameDev/Godot/fe-mb/game/node_modules/.bin/tsx dirs/ux-market/probe_market.mts
const G = 'file:///E:/Work/GameDev/Godot/fe-mb/game/src/'
const { createEnv } = await import(G + 'engine/content.ts')
const { createRuntime } = await import(G + 'engine/flow/runtime.ts')
const { initialState } = await import(G + 'engine/flow/lifecycle.ts')
const { overlayOf, isQuiescent } = await import(G + 'engine/flow/pump.ts')
const { carefulPolicy } = await import(G + 'engine/combat/sim.ts')
const { visibleChoices } = await import(G + 'engine/run/dialogue.ts')
const { foodCount, findSlot } = await import(G + 'engine/run/bag.ts')
const { livingUnits } = await import(G + 'engine/run/party.ts')
const { shopStock, buyPrice, entrySellPrice, sellPrice } = await import(G + 'engine/run/economy.ts')
const { canHold, planEquip } = await import(G + 'engine/run/equipment.ts')
const { buildDeck, deckSize } = await import(G + 'engine/combat/deck.ts')

const env = createEnv()
const route = ['traders_rest', 'frontier_camp', 'riverside_market']
const seed = 36

function autoAnswer(rt: any): boolean {
  const state = rt.getState(); const run = state.run; const ov = overlayOf(state)
  if (ov === null || run === null) return false
  switch (ov.kind) {
    case 'namePrompt': rt.dispatch({ type: 'name/submit', name: ov.prompt.target === 'mc' ? 'The Foundling' : 'The Company' }); return true
    case 'checkEvent': {
      if (ov.event.result !== null) { rt.dispatch({ type: 'check/dismiss' }); return true }
      const c = env.content.checkEvents[ov.event.checkEventId]?.choices[0]; if (!c) return false
      rt.dispatch({ type: 'check/choose', choiceId: c.id, attemptingUnitId: null }); return true
    }
    case 'dialogue': {
      const en = visibleChoices(run, env).filter((c: any) => c.enabled)
      if (en.length > 0) rt.dispatch({ type: 'dialogue/choose', choiceId: en[0].id, attemptingUnitId: null }); else rt.dispatch({ type: 'dialogue/continue' })
      return true
    }
    case 'tutorial': if (state.screen.kind === 'combat') { rt.dispatch({ type: 'tutorial/skip' }); return true } return false
    default: return false
  }
}
function fight(rt: any) {
  for (let i = 0; i < 400; i++) {
    const st = rt.getState(); if (st.combat === null || st.combat.phase !== 'combat') return
    const a = st.combat.units[st.combat.turn.unitId]
    if (a?.team === 'party') { const d = carefulPolicy(st.combat, env); const ef = rt.dispatch('rng' in d ? d.action : d); if (ef.some((e: any) => e.kind === 'refused')) rt.dispatch({ type: 'combat/endTurn' }) }
    rt.drain()
  }
}
function drive(rt: any): string {
  for (let g = 0; g < 500; g++) {
    rt.drain(); const st = rt.getState(); const k = st.screen.kind
    if (k === 'win' || k === 'gameOver' || k === 'title') return 'over'
    if (k === 'combat' && st.combat && st.combat.phase === 'combat') { fight(rt); continue }
    if (k === 'battleEnd' && st.run) {
      for (const id of st.run.pendingLoot) { const t = rt.dispatch({ type: 'run/takeLoot', itemId: id }); if (t.some((e: any) => e.kind === 'refused')) rt.dispatch({ type: 'run/forfeitLoot', itemId: id }) }
      rt.dispatch({ type: 'battleEnd/dismiss' }); continue
    }
    if (autoAnswer(rt)) continue
    if (overlayOf(st)?.kind === 'quickMenu') return 'atNode'
    if (isQuiescent(st)) return 'quiescent'
    return 'stuck'
  }
  return 'stuck'
}

const rt = createRuntime({ env, initial: initialState({ tutorialSeen: true, gameStarted: true }), log: false })
rt.dispatch({ type: 'meta/newRun', seed })
drive(rt)
for (const stop of route) {
  rt.dispatch({ type: 'travel/goTo', nodeId: stop })
  for (let g = 0; g < 50; g++) {
    const rest = drive(rt); const run = rt.getState().run
    if (!run || rest === 'over') break
    if (run.nodeId === stop && (run.pendingTravel === null || run.pendingTravel.path.length === 0)) break
    if (rest === 'atNode') { rt.dispatch({ type: 'travel/continue' }); continue }
    break
  }
}
const refusals = (ef: any[]) => ef.filter((e: any) => e.kind === 'refused')
const enter = rt.dispatch({ type: 'town/enter' }); rt.drain()
let run = rt.getState().run
const before = { day: run.daysElapsed, gold: run.gold, units: livingUnits(run).map((u: any) => `${u.name} ${u.hp.current}/${u.hp.max}`) }
const inn = rt.dispatch({ type: 'town/innHeal' }); rt.drain()
run = rt.getState().run
const town = env.content.towns[run.nodeId]
const stock = [...shopStock(town, run, env)].map((i: any, k: number) => ({ k, id: i.id, name: i.name, buy: buyPrice(i), sell: sellPrice(i, env) }))
const sorted = [...stock].sort((a, b) => (a.buy - b.buy) || (a.k - b.k)).map((i) => `${i.buy} ${i.name}`)
const party = Object.values(run.party) as any[]
const buckler = env.content.items['iron_buckler']
const holders = party.map((u: any) => ({ name: u.name, classId: u.classId, left: u.handLeft, right: u.handRight, hp: `${u.hp.current}/${u.hp.max}`,
  canHold: canHold(u.classId, buckler, env), deck: deckSize(buildDeck(u, env)) }))
const sellOurs = run.bag.map((e: any) => ({ at: [e.x, e.y], item: e.itemId, charges: e.charges, pays: entrySellPrice(e, env) }))
const lands = findSlot(run.bag, 'iron_buckler', env)
const buy = rt.dispatch({ type: 'town/buy', itemId: 'iron_buckler' }); rt.drain()
const after = rt.getState().run
const mc = (Object.values(after.party) as any[]).find((u: any) => u.classId === 'lord')
const plan = planEquip(mc, 'right', 'iron_buckler', after.bag, env)
const deckWith = plan.ok ? deckSize(buildDeck(plan.unit, env)) : plan.reason
console.log(JSON.stringify({
  seed, enterRefused: refusals(enter), before, innRefused: refusals(inn),
  afterInn: { day: run.daysElapsed, gold: run.gold, food: foodCount(run.bag, env), bag: run.bag },
  stockCount: stock.length, sorted, holders, sellOurs, landsAt: lands,
  buyRefused: refusals(buy), afterBuy: { gold: after.gold, bag: after.bag }, foundlingDeckWithBuckler: deckWith,
}, null, 1))
