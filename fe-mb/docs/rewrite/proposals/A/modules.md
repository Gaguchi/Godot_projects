# Proposal A — module map

One flat `GameState`, one root reducer, one sub-reducer per domain, one
post-reduce **settle** step that is the whole flow controller. 41 engine
files; an implementer holds five folders in their head:

```
src/engine/
├── types.ts  actions.ts  rules.ts  reducer.ts  content.ts     (contract)
├── rng.ts  autotile.ts  boardFloor.ts                        (ported, final)
├── combat/   12 files   pure over CombatState                (brief §2.1–2.8, 2.15, 2.16)
├── run/      14 files   pure over RunState                   (brief §2.6–2.7, 2.9–2.14, 2.16)
├── procgen/   2 files   graphs + board floors                (brief §2.11, §2.8)
├── save/      2 files   GameState ⇄ SaveFile                 (brief §2.14)
└── flow/      2 files   settle (flow controller) + runtime   (brief §7.13, §7.16, §7.30, §8.3)
```

Import fence (eslint `no-restricted-imports`, extending the existing rule):

| folder | may import |
|---|---|
| `combat/*` | `../types`, `../actions`, `../rules`, `../rng`, `../boardFloor`, siblings in `combat/` |
| `run/*` | the same plus `../combat/{seed,resolve,deck}` (run seeds and resolves battles; never the combat reducer) and `../procgen/*` |
| `procgen/*` | `../types`, `../rules`, `../rng`, `../boardFloor`, `../autotile` |
| `save/*` | `../types`, `../rules`, `zod` |
| `flow/*` | everything under `engine/` |
| `reducer.ts` | `combat/reducer`, `run/reducer`, `flow/settle`, `types`, `actions` |
| `content.ts` | `../content/schemas`, `../content/index` (the generated JSON index), `zod` |
| anything in `engine/` | never `react`, `react-dom`, `**/ui/**`, `window`, `document`, `localStorage`, `Date`, `Math.random` |

Every function below is **pure**: same inputs → same outputs, inputs never
mutated. Functions that roll take an `RngState` (or the state that carries
one) and return the advanced state. No function takes an `RNG` object it did
not create from state itself.

`EngineEnv = { readonly content: Content; readonly rules: Rules }` is the
third argument of every reducer and of every function that reads content or
a number. Tests build fixtures for both.

---

## 0. Structural shapes the engine relies on (content module contract)

The engine reads these fields of the content types. If the CONTENT PORT
agent named or shaped anything differently, the judge reconciles here.

```ts
Card            { id; name; apCost: 0|1|2|3; range: {min; max}; targetKind: 'enemy'|'ally'|'self'|'tile'|'all_enemies'|'all_allies';
                  aoeRadius: 0|1|2; weaponType: WeaponType|null; damageStat?: 'str'|'mag'|'skl'; effects: CardEffect[] }
CardEffect      | { kind:'Damage'; target:'target'|'area'; base; damageType; armorPiercing?: boolean }
                | { kind:'Heal'; target:'self'|'target'|'ally'|'area'; amount }
                | { kind:'ApplyStatus'; target; status: StatusId; value; turns; splash?: 'adjacent' }
                | { kind:'RemoveStatus'; target; what:'armor'|'debuff'; amount: number|'all' }
                | { kind:'Move'; target:'self'; distance }
                | { kind:'GrantArmor'; target; amount }
                | { kind:'DrawCards'; target:'self'; count }
                | { kind:'GainAp'; target:'self'|'ally'; amount }
ClassDef        { id; name; baseStats: UnitStats; startingHp; startingMov; innateCardIds: string[] }
Item            { id; name; kind:'food'|'potion'|'weapon'|'shield'|'quiver'|'tome'|'staff'; rarity; region: 'borderlands'|'thornwood'|'ashfall'|'none';
                  gridSize:{width;height}; buyPrice?: number; sellPrice; weaponClass?; twoHanded?; gearCardIds?: string[]; quiverModifier?: QuiverModifier; effect?: CardEffect }
CharacterDef    { id; displayName; classId; level; team; startingGear:{left;right}; bag?: string[]; statOverrides?: Partial<UnitStats>;
                  portrait:{accent;faction;shape}; signatureCardIds: string[]; passiveIds: PassiveId[]; joinDialogueId?; recruitable: boolean }
EnemyGroup      { id; name; members: { id?; name; classId; level; count; bountyValue? }[]; victoryEvent?: string /* checkEventId */ }
EnemyAiProfile  { classId; role:'rusher'|'archer'|'healer'|'tank'; movement; preferredRange?: {min;max};
                  actions: { id; range:{min;max}; weight; situation?: 'always'|'self_low_hp'|'target_low_hp'|'ally_wounded'; aoeRadius?; damageStat?; effects: CardEffect[] }[] }
EncounterTable  { id; regionId?; entries: { id; weight; oneShot; conditions: Predicate[]; outcome: EncounterOutcome }[] }
EncounterOutcome | { kind:'dialogue'; dialogueId } | { kind:'battle'; enemyGroupId; captureTargets?: CaptureTarget[] } | { kind:'checkEvent'; checkEventId }
CaptureTarget   { unitId; capturedDialogueId; killedDialogueId; capturedFlag; killedFlag }
CheckEvent      { id; title; description; choices: { id; text; check?: CheckRequirement; onPass:{narration; effects: QuestEffect[]}; onFail?: {…} }[] }
CheckRequirement | { kind:'stat'; stat: StatKey; threshold } | { kind:'class'; classId } | { kind:'gold'; amount } | { kind:'food'; amount }
DungeonDef      { id; name; regionId; gate?: Predicate; combatEnemyGroupId; eliteEnemyGroupId; bossEnemyGroupId; roomEventIds: string[] }
TownDef         { id; name; description; regionId; innHealCostPerUnit; shopStockIds: string[]; rumors: string[];
                  tavernQuests: { questId; npcName; npcDescription; dialogueId; visibleIf?: Predicate }[] }
OverworldSheet  { id; startNodeId; nodes: SheetNode[]; edges: SheetEdge[] }   // see types.ts ASSUMPTIONS 4
QuestDef        { id; name; initialStage; stages: Record<string, { id; onEnter: QuestEffect[]; transitions: { when: Predicate; to }[]; onExit: QuestEffect[] }> }
QuestEffect     setFlag{key;value;scope?} | recruitCharacter{characterId} | spawnNode{nodeId} | unlockNode{nodeId} | startDialogue{dialogueId}
                | startQuest{questId} | advanceQuestStage{questId;toStage} | completeQuest{questId} | addGold{amount} | addItem{itemId}
                | addFood{amount} | damageParty{amount} | healParty{percent} | startCombat{enemyGroupId; captureTargets?} | promptName{target:'mc'|'company'}
DialogueTree    { id; startNodeId; nodes: Record<string, { id; speaker?: characterId; text; choices: DialogueChoice[]; onEnter?: QuestEffect[] }> }
DialogueChoice  { id; text; visibleIf?; enabledIf?; effects: QuestEffect[]; next?: nodeId|'end'; check?: CheckRequirement; onPass?; onFail? }
Predicate       always | never | flag{key;equals?} | notFlag{key} | questStage{questId;stage} | questComplete{questId} | questStarted{questId}
                | partyHas{classId} | hasItem{itemId} | goldAtLeast{amount} | visited{nodeId} | cleared{encounterId} | allOf{preds} | anyOf{preds} | not{pred}
Region          { id; name; tier: 1|2|3 }
```

---

## 1. Root files

### `types.ts`, `actions.ts`, `rules.ts`
The three proposal files. `rules.ts` also exports `rngLabels` and
`DUNGEON_COMBAT_LOOT_CHANCE`.

### `content.ts` — typed, validated registry (brief §7.23, DECISIONS "Content = JSON + strict Zod")
```ts
export function buildContent(raw: RawContentIndex): Content            // Zod-parse every file, build id maps, run crossRefLint; throws ContentError listing every dangling ref
export function crossRefLint(content: Content): readonly string[]      // every id kind + every flag read has a writer + every effect param consumed + gear card counts (rules.gear) + no gear buyPrice 0 + potions carry effect
export function contentVersion(content: Content): string               // stable hash of the parsed JSON, stored in SaveFile
```
`RawContentIndex` is whatever `src/content/index.ts` (generated by
`import.meta.glob` at build time / `fs` in the CLI) exports. Imports
`zod`; it is the only engine file besides `save/schema.ts` that does.

### `reducer.ts` — the root reducer
```ts
export interface EngineEnv { readonly content: Content; readonly rules: Rules }
export function reduce(state: GameState, action: Action, env: EngineEnv): ReduceResult
export function isLegal(state: GameState, action: Action, env: EngineEnv): { ok: true } | { ok: false; reason: string }
export function initialState(meta?: Partial<MetaState>): GameState        // title screen, run null, combat null
```
Algorithm (one function, ~80 lines):
1. `isLegal` gate by screen/modal/pending-slot (table in §7 below). Illegal → `{ state, effects: [refused] }`, unchanged reference.
2. Route by `action.type` prefix: `combat/ tutorial/` → `combat/reducer`; `meta/ save/ ui/ dev/` handled inline; everything else → `run/reducer`.
3. `flow/settle` on the result (battle resolution, quest fixed point, pending-combat seeding, travel resume, autosave hint). Returns the final `ReduceResult`.
4. Dev builds `Object.freeze` the returned state deeply (a `freeze` helper in `flow/settle`).

---

## 2. `combat/` — pure over `CombatState` (brief §2.1–2.8, §2.15, §2.16)

### `combat/reducer.ts`
```ts
export function reduceCombat(state: GameState, action: CombatAction | TutorialAction, env: EngineEnv): ReduceResult
```
Owns the `switch` over `combat/*` + `tutorial/skip`. Every case validates in
the reducer (bounds, obstacles, occupancy, move range, card range,
targetKind, AP, hand membership, active unit, team). Delegates to the
modules below; never touches `state.run` (the consumables were copied into
`combat.consumables` at seed time). Implements §2.1 legality, §2.3 play
resolution order, §2.6 capture, §2.3 consumables, §2.4 statuses.

### `combat/seed.ts` — one seeder (§2.8, §2.15, §7.5, §7.20, §7.26)
```ts
export function seedBattle(spec: BattleSpec, env: EngineEnv): CombatState          // throws SeedError (never a stub battle)
export function buildEnemyUnits(spec: BattleSpec, env: EngineEnv): readonly CombatUnit[]   // group members × count, `_N` suffixes, level = max(authored, spec level) → scaleEnemy; bountyValue copied
export function placeUnits(party: readonly PartyUnit[], enemies: readonly Omit<CombatUnit,'position'>[], grid: CombatGrid, env: EngineEnv): { party: CombatUnit[]; enemies: CombatUnit[] }  // party slots from rules; enemies within one move + attack (asserted)
export function battleIdFor(origin: BattleOrigin, run: RunState): string           // rngLabels.battle* minus the prefix
```
Asserts every unit has a position; resets ap/armor/statuses/hasMoved/
coverUsed; party enters at RUN HP; decks built per unit; `turn = { round: 1,
unitId: initiativeQueue(units)[0] }`; the first unit draws 5.

### `combat/deck.ts` — gear-as-deck (§2.7)
```ts
export function buildDeck(unit: PartyUnit | CombatUnit, env: EngineEnv): DeckState   // innate + left + right + signature, source-tagged uids `${cardId}#${n}`; quiver mods on bow damage cards in the other hand; 2H locks right
export function drawCards(deck: DeckState, count: number, rng: RngState): { deck: DeckState; rng: RngState; reshuffled: boolean }
export function discardHand(deck: DeckState): DeckState
export function deckSize(deck: DeckState): number                                    // draw + hand + discard — the zero-loss invariant
```

### `combat/turn.ts` — initiative, turn boundaries (§2.1, §2.4, §7.1)
```ts
export function initiativeQueue(units: Readonly<Record<string, CombatUnit>>): readonly string[]   // living, on-board; (spd + slowDelta) desc, party first, id asc — NEVER stored
export function successor(units: Readonly<Record<string, CombatUnit>>, currentId: string): { unitId: string; wrapped: boolean }  // queue over living ∪ {current}
export function endTurn(state: CombatState, env: EngineEnv): CombatReduceResult       // (1) tick ending unit's ownerTurnEnd statuses (DOT, decrement, expire) (2) checkEnd (3) successor: ap=3, hasMoved=false, actionsTaken=0, coverUsed=[], armor reset if knob, ownerTurnStart expiries (4) ending unit discards hand, next draws to 5 (5) selection idle; round++ on wrap
export function activeUnit(state: CombatState): CombatUnit
export function isPartyTurn(state: CombatState): boolean
```
The initiative strip = `initiativeQueue` rotated to `turn.unitId` (a UI
selector; 8 visible + "+N").

### `combat/targeting.ts` — geometry (§2.3, §2.5, §7.4)
```ts
export function tileKey(x: number, y: number): TileKey
export function parseTile(t: TileKey): { x: number; y: number }
export function manhattan(a: TileKey, b: TileKey): number
export function neighbours4(t: TileKey): readonly TileKey[]
export function inBounds(grid: CombatGrid, t: TileKey): boolean
export function isBlocked(state: CombatState, t: TileKey, mover?: string): boolean    // obstacle or living unit (corpses never block, §7.3)
export function unitAt(state: CombatState, t: TileKey): CombatUnit | null            // LIVING, on-board only
export function reachable(state: CombatState, unitId: string): Readonly<Record<TileKey, readonly TileKey[]>>  // 4-dir BFS ≤ mov (0 if immobilized) through free tiles; value = path
export function distanceField(state: CombatState, dest: TileKey, mover: string): Readonly<Record<TileKey, number>>  // flood from dest, living units are walls (AI stepping, §2.5)
export function tilesInRange(grid: CombatGrid, origin: TileKey, min: number, max: number): readonly TileKey[]   // obstacles excluded, no LOS
export function tilesInAoe(grid: CombatGrid, centre: TileKey, radius: number): readonly TileKey[]
export function legalTargets(state: CombatState, unitId: string, card: Card, env: EngineEnv): readonly TileKey[]   // range ∩ targetKind (enemy/ally/self/tile/all_*)
export function dangerUnion(state: CombatState, env: EngineEnv): readonly TileKey[]   // every enemy's move+attack reach (Tab overlay)
```

### `combat/damage.ts` — one formula, one split, one cover step (§2.2, §2.16)
```ts
export function resolveCoverTarget(state: CombatState, attackerId: string, targetId: string, env: EngineEnv): { targetId: string; protectorId: string | null }
   // protector = living unit of target's team, orthogonally adjacent to target, passives ∋ 'genatsvale', coverUsed ∌ targetId, id ≠ target; lowest id wins
export function rawDamage(base: number, stat: DamageStat | undefined, source: CombatUnit, target: CombatUnit, type: DamageType, grid: CombatGrid, env: EngineEnv): { afterDr: number; terms: Pick<DamageForecast,'baseTerm'|'statName'|'statTerm'|'empowerTerm'|'drTerm'|'terrainDr'> }
export function splitDamage(target: Pick<CombatUnit,'hp'|'armor'>, amount: number, type: DamageType, armorPiercing: boolean): { hpLost: number; armorLost: number; newHp: number; newArmor: number }
export function forecast(state: CombatState, attackerId: string, card: Pick<Card,'damageStat'|'effects'>, targetId: string, env: EngineEnv): DamageForecast | null   // calls resolveCoverTarget; null for utility cards
export function dealDamage(state: CombatState, attackerId: string | null, targetId: string, amount: number, type: DamageType, opts: { armorPiercing: boolean; cause: UnitHitCause; cover: boolean }, env: EngineEnv): CombatReduceResult
   // cover → swap target + append coverUsed on the protector; riposte if adjacent physical > 0 from a unit; emits unitHit/unitDied; sets position null on death
export function grantArmor(unit: CombatUnit, amount: number, env: EngineEnv): CombatUnit   // knob armorCap
```
Forecast == applied: `dealDamage` calls `rawDamage` + `splitDamage`; the HUD
calls `forecast`, which calls the same two. The enemy AI's expected-damage
scorer calls `forecast` too.

### `combat/statuses.ts` — fixed numbers, explicit expiry (§2.4, §7.6)
```ts
export function mergeStatus(statuses: readonly ActiveStatus[], next: ActiveStatus, env: EngineEnv): readonly ActiveStatus[]  // stackable: sum + max turns; else max stacks + max turns
export function tickOwnerTurnEnd(state: CombatState, unitId: string, env: EngineEnv): CombatReduceResult   // DOT damage (poison piercing, burn magic split) then decrement 'ownerTurnEnd' & 'turns', expire at 0; DOT death flips phase via checkEnd
export function tickOwnerTurnStart(unit: CombatUnit, env: EngineEnv): { unit: CombatUnit; expired: readonly StatusId[] }
export function tickGlobalTurn(units: Readonly<Record<string, CombatUnit>>, env: EngineEnv): Readonly<Record<string, CombatUnit>>   // 'turns' expiry on every endTurn
export function slowDelta(unit: CombatUnit): number
export function isImmobilized(unit: CombatUnit): boolean
export function isTaunting(unit: CombatUnit): boolean
export function riposteStacks(unit: CombatUnit): number
export function empowerBonus(unit: CombatUnit): number
export function consumeEmpower(unit: CombatUnit): CombatUnit
export function cleanse(unit: CombatUnit, what: 'debuff' | 'armor', amount: number | 'all'): CombatUnit
```
Expiry data lives in `rules.combat.statuses`; a card may override
`expiresAt` per application (stance-style buffs), the default comes from the
rule. A 1-turn taunt/riposte/empower applied on the owner's turn is
`ownerTurnStart` → survives the whole enemy phase, expires when the owner's
next turn starts.

### `combat/cards.ts` — play resolution + effect switch + items (§2.3, §7.21)
```ts
export function canPlay(state: CombatState, cardUid: string, tile: TileKey | null, env: EngineEnv): { ok: true; card: Card } | { ok: false; reason: string }
export function playCard(state: CombatState, cardUid: string, tile: TileKey | null, env: EngineEnv): CombatReduceResult
   // refuse if ap < apCost → discard FIRST → targets = living unit per tile → expand AOE → split foe/ally by team → resolve effects in order → quiver mods on foes → consume empower → ap -= cost (floor 0) → checkEnd
export function applyEffects(state: CombatState, sourceId: string, effects: readonly CardEffect[], targets: { primary: TileKey | null; units: readonly string[]; foes: readonly string[]; allies: readonly string[] }, mod: QuiverModifier | null, env: EngineEnv): CombatReduceResult
   // exhaustive switch over CardEffect.kind with the explicit target selector; tile-target statuses never touch allies; beneficial riders on enemy-target cards go to `self`
export function useItem(state: CombatState, itemId: string, env: EngineEnv): CombatReduceResult   // 1 AP, active PARTY unit, item ∈ consumables, apply item.effect to self, move to consumedItems
export function enemyAct(state: CombatState, unitId: string, actionId: string, tile: TileKey, env: EngineEnv): CombatReduceResult   // same applyEffects path with the profile action's effects; actionsTaken++
```

### `combat/ai.ts` — authored role AI, plans one step at a time (§2.5, §7.4, §7.19)
```ts
export function planEnemyStep(state: CombatState, env: EngineEnv): { action: CombatAction; rng: RngState }
   // phase A (not moved): pick role target (taunters first), desired tile, walk ≤ movement via distanceField with a banned-revisit set → combat/moveUnit (or skip)
   // phase B (budget left): eligible actions by post-move range + situation, weighted rng.nextInt from state.rng → combat/enemyAct
   // else → combat/endTurn. `rng` is the advanced state; the reducer writes it back before applying `action`
export function pickTarget(state: CombatState, self: CombatUnit, profile: EnemyAiProfile, env: EngineEnv): { primary: CombatUnit | null; desiredTile: TileKey | null }
export function expectedDamage(state: CombatState, self: CombatUnit, action: EnemyAiProfile['actions'][number], targetId: string, env: EngineEnv): number   // via damage.forecast (cover-aware)
export function planEnemyTurn(state: CombatState, env: EngineEnv): { actions: readonly CombatAction[]; state: CombatState }   // CLI/tests: loop planEnemyStep+reduce until endTurn
```

### `combat/capture.ts` — the only die in combat (§2.6)
```ts
export function captureChance(target: CombatUnit, adjacentAllies: number, bountyHunter: boolean, env: EngineEnv): number   // clamp01((1−hp/max)·0.6 + 0.25·adj + 0.15·bh)
export function captureContext(state: CombatState, attackerId: string, targetId: string): { adjacent: boolean; adjacentAllies: number; bountyHunter: boolean }
export function capture(state: CombatState, targetId: string, env: EngineEnv): CombatReduceResult   // 2 AP, adjacent; rng.next() < chance from state.rng, written back either way; success → hp 0, captured true, position null
```

### `combat/resolve.ts` — end check + result (§2.8, §7.30)
```ts
export function checkEnd(state: CombatState, env: EngineEnv): CombatPhase   // victory: no enemy alive-and-uncaptured; defeat: no party alive, or mc dead when knobs.mcDeathIsDefeat
export function resolveBattle(state: CombatState, env: EngineEnv): BattleResult   // gold 10+5L per dead non-captured; captured → Prisoner rows (name, bountyValue); survivorHp; fallen; consumedItems; capturedIds; survivingEnemyIds. NO loot here — loot needs the run's bag (excludeOwned) and lives in run/loot
```

### `combat/tutorial.ts` — state-derived overlay (§2.15)
```ts
export type TutorialStep = 'enemyTurn' | 'move' | 'pickCard' | 'target' | 'endTurn' | 'victory'
export function tutorialStep(state: CombatState): TutorialStep | null   // null unless tag === 'tutorial'
export function tutorialSpec(run: RunState, env: EngineEnv): BattleSpec   // 5×5, mc from characters.json at rules.tutorial.mcPosition, authored bandit
```

---

## 3. `run/` — pure over `RunState` (brief §2.6–2.7, §2.9–2.14, §2.16)

### `run/reducer.ts`
```ts
export function reduceRun(state: GameState, action: RunAction | TravelAction | TownAction | CampAction | DungeonAction | DialogueAction | CheckAction | NameAction | QuestAction | BattleEndAction, env: EngineEnv): ReduceResult
```
The `switch`; each case is a one-line delegate to the module that owns the
rule. Sets `screen` for explicit transitions (`town/enter` → town,
`camp/leave` → overworld, `dungeon/enter` → dungeon, `battleEnd/dismiss`
routing). Emits `LocationArrived`, `FlagSet`, `Quest*` from here (never a screen).

### `run/newRun.ts` (§2.13 kit, §2.16 cast)
```ts
export function seedNewRun(seed: number, env: EngineEnv): RunState   // runId `run-${seed}`, rng {seed, counter 0}, day 1, gold 80, kit as data, startParty via buildUnitFromCharacter, location = sheet.startNodeId, everything else empty
```

### `run/party.ts` (§2.16, §2.14, §7.7)
```ts
export function buildUnitFromCharacter(def: CharacterDef, env: EngineEnv): PartyUnit   // deterministic id = def.id; class base + level lift (+1/level, hp +3/level) unless statOverrides; team, hands, passives, signature cards
export function recruitCharacter(run: RunState, characterId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // no-op if in party or deathLog; refuse past partyCap; flag `recruited.<id>` permanent; UnitRecruited
export function removeFallen(run: RunState, fallen: readonly { unitId: string; cause: DeathEntry['cause']; battleId: string | null }[]): RunState   // deathLog once per unit; partyOrder pruned
export function healParty(run: RunState, fraction: number | 'full', onlyWounded?: boolean): { run: RunState; healed: readonly string[] }
export function damageParty(run: RunState, amount: number, cause: DeathEntry['cause']): { run: RunState; died: readonly string[] }
export function livingUnits(run: RunState): readonly PartyUnit[]
export function isMcAlive(run: RunState): boolean
```

### `run/bag.ts` — spatial bag, food charges, equip plans (§2.7, §7.22)
```ts
export function cells(bag: readonly BagEntry[], env: EngineEnv): ReadonlySet<string>          // occupied "x,y" from each item's gridSize
export function findSlot(bag: readonly BagEntry[], itemId: string, env: EngineEnv): { x: number; y: number } | null   // first fit, row-major
export function placeInBag(bag: readonly BagEntry[], itemIds: readonly string[], env: EngineEnv): readonly BagEntry[] | null   // all-or-nothing
export function removeOne(bag: readonly BagEntry[], itemId: string): readonly BagEntry[]                                     // first match by id
export function foodCount(bag: readonly BagEntry[]): number                                                                    // Σ charges of food_rations
export function consumeFood(run: RunState, count: number): { run: RunState; consumed: number }                                // charges first; the ONLY food-spend primitive (hop executor, camp rest, scout all call it)
export function addFood(run: RunState, delta: number, env: EngineEnv): RunState                                               // signed; clamps at 0; positive adds rations of 3 charges (+ remainder)
export function planEquip(run: RunState, unitId: string, itemId: string, slot: HandSlot, env: EngineEnv): { ok: true; run: RunState } | { ok: false; reason: string }   // atomic: displaced items must fit; 2H → left + locks right; non-gear / not-in-bag rejected
export function planUnequip(run: RunState, unitId: string, slot: HandSlot, env: EngineEnv): { ok: true; run: RunState } | { ok: false; reason: string }
export function ownedItemIds(run: RunState): readonly string[]                                                                 // bag + every hand (loot exclusion)
```

### `run/economy.ts` (§2.10, §2.13, §2.6)
```ts
export function shopStock(town: TownDef, run: RunState, env: EngineEnv): readonly Item[]   // shopStockIds ∪ region-'none' food/potions ∪ same-region gear in tier rarities; never epic/legendary; 1–2 rotating picks from deriveRng(run, rngLabels.shop(town, day)) — derived, not stored
export function buyPrice(item: Item): number | null                                          // undefined buyPrice ⇒ null ⇒ unbuyable (never 0)
export function sellPrice(item: Item, env: EngineEnv): number
export function innCost(town: TownDef, run: RunState, env: EngineEnv): { wounded: readonly string[]; total: number }
export function bountyFor(p: Prisoner, env: EngineEnv): number                               // bountyValue > 0 ? bountyValue : tier by level (20/40/60)
export function killGold(level: number, env: EngineEnv): number                              // 10 + 5L
export function addGold(run: RunState, delta: number): RunState                              // clamp ≥ 0
```

### `run/overworld.ts` — the open sheet as a graph (§2.9, §2.13, §6)
```ts
export function visibleNodes(run: RunState, env: EngineEnv): readonly SheetNode[]           // hidden nodes need nodeOverrides.spawned; locked need unlocked
export function adjacency(run: RunState, env: EngineEnv): Readonly<Record<string, readonly string[]>>
export function findPath(run: RunState, to: string, env: EngineEnv): readonly string[] | null   // BFS, undirected; [] when to === current
export function previewPath(run: RunState, to: string, env: EngineEnv): { hops: number; food: number; starvationHp: number } | null   // hover: `N hops · cost N food`, starvation when food < hops
export function edgeKey(a: string, b: string): string                                          // sorted ids joined with '|'
export function isDecisionNode(node: SheetNode, run: RunState): boolean                        // town/camp/dungeon/boss/discovery, or unvisited, or destination
export function areaTier(nodeId: string, env: EngineEnv): RegionTier                            // node.tier ?? rules.travel.tierByDistance over BFS distance from startNodeId
export function enemyLevelFor(tier: RegionTier, salt: string, env: EngineEnv): number           // base = tier·2−1, + fnv(salt) % 2
export function scaleEnemy(base: UnitStats, baseHp: number, level: number, env: EngineEnv): { stats: UnitStats; hp: number }
export function regionOf(nodeId: string, env: EngineEnv): Region
```

### `run/travel.ts` — the hop state machine + encounter roller (§2.9, §2.10 scout, §7.16, §7.19)
```ts
export function startTravel(run: RunState, nodeId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // path via findPath; [] ⇒ atNode (quick menu, no hop); else pendingTravel {walking, hop null}
export function travelStep(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[] }
   // hop === null → BEGIN: to = path[0]; pass = traversals[key].count + 1; consumeFood(1) or starvation 3 HP to each living unit (deaths → deathLog); day += 1; hops += 1;
   //                encounter = scoutedEdges[`${key}#${pass}`] !== undefined ? take-and-delete : (noRollInto(to) ? null : rollHop(...)); hop = {…, resolved: encounter === null};
   //                encounter → open the pending slot (dialogue / pendingCombat / pendingCheckEvent) and status 'suspended'
   // hop !== null && hop.resolved → LAND: location = to; traversals[key] = {count: pass, lastDay: day}; visited; path.shift(); LocationArrived;
   //                discovery node on first visit → pendingCheckEvent{source 'discovery'} + oneShotsFired[nodeId] (suspends, resumes like any slot);
   //                decision node or path empty → 'atNode' else stay 'walking'
export function rollHop(run: RunState, from: string, to: string, pass: number, env: EngineEnv): EncounterRoll | null
   // chance = (edge.rollChance ?? region.encounterChancePerHop) × cooldown; cooldown = 1 on first pass or ≥3 days since, else max(0.25, daysSince/3);
   // hopRng = deriveRng(run.rng, rngLabels.hop(...)); if hopRng.next() < chance → rollEncounter(table, predicateView(run), oneShotsFired, deriveRng(run.rng, rngLabels.encounter(...)))
export function rollEncounter(table: EncounterTable, view: PredicateView, oneShotsFired: Readonly<Record<string, true>>, rng: RngState): { roll: EncounterRoll | null; rng: RngState }   // predicate filter, one-shot filter, weighted rng.next()·Σweight, last-entry fallback
export function openEncounter(run: RunState, roll: EncounterRoll, source: 'travel' | 'discovery', env: EngineEnv): RunState   // marks one-shot fired; dialogue → pendingDialogue; battle → pendingCombat {tag 'travel', captureTargets}; checkEvent → pendingCheckEvent
export function resumeTravel(run: RunState): RunState        // suspended → walking with hop.resolved = true (called by flow/settle only)
export function scout(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // consumeFood(1); BFS depth 3 from location; for each edge: key#(count+1) → rollHop result stored (null = quiet) — what you see is what you get
```

### `run/town.ts` — town + camp services (§2.10)
```ts
export function innHeal(run: RunState, town: TownDef, env: EngineEnv): { run: RunState; effects: readonly Effect[] }      // refuse if gold < total; heals wounded to full
export function buy(run: RunState, town: TownDef, itemId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // in stock, price non-null, gold ≥ price, fits bag
export function sell(run: RunState, itemId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }
export function tavernBoard(run: RunState, town: TownDef, env: EngineEnv): readonly TownDef['tavernQuests'][number][]           // visibleIf filter (the only quest turn-in surface)
export function turnIn(run: RunState, unitIds: readonly string[], env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // gold += Σ bountyFor; rows removed; PrisonerTurnedIn per row
export function campRest(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // refuse at 0 food; consumeFood(1); heal floor(max×0.2) each; day/hop counters untouched
export function townOf(run: RunState, env: EngineEnv): TownDef | null                                     // sheet node → townId → def (every town node has a def — lint)
```

### `run/dungeon.ts` — run side of the crawl (§2.11, §7.18)
```ts
export function canEnterDungeon(run: RunState, env: EngineEnv): { ok: true; def: DungeonDef } | { ok: false; reason: string }   // node is dungeon, gate predicate passes, not already inside
export function enterDungeon(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[] }      // graph = generateDungeon(deriveRng(run.rng, rngLabels.dungeon(id)), def, env); position null
export function moveToRoom(run: RunState, roomId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }
   // successor check (row 0 from entrance); position = room; LocationArrived{dungeon};
   // combat/elite/boss → pendingCombat {tag dungeon:*, group per def}; event → pendingCheckEvent{source dungeon}; rest → healParty(0.3) + cleared; treasure → rollLoot(dungeonTreasure) + 50g + cleared
export function markRoomCleared(run: RunState, roomId: string): RunState                                       // called by applyBattleResult for dungeon battles; boss → bossCleared
export function leaveDungeon(run: RunState): { ok: true; run: RunState } | { ok: false; reason: string }       // entrance or bossCleared only
export function dungeonTier(def: DungeonDef, env: EngineEnv): RegionTier                                         // regions[def.regionId].tier — enemies and loot rows use it
```

### `run/quests.ts` — activation, transitions, effects, flags (§2.12, §7.32)
```ts
export const QUEST_COMPLETE = '__complete__'
export type QuestStatus = 'notStarted' | 'active' | 'complete'
export function questStatus(run: RunState, questId: string): QuestStatus                                         // DERIVED, never mirrored into flags
export function startQuest(run: RunState, questId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }     // idempotent + warn effect if present; error if unknown; seed initialStage; apply its onEnter; QuestStarted
export function advanceQuest(run: RunState, questId: string, toStage: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // refuse not-started/complete/unknown stage; from.onExit then to.onEnter; QuestStageAdvanced
export function completeQuest(run: RunState, questId: string, env: EngineEnv): { run: RunState; effects: readonly Effect[] }  // onExit, sentinel, QuestCompleted; idempotent
export function settleQuests(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[]; passes: number }    // first passing transition per active quest, repeat ≤ maxSettlePasses; warn effect on cap
export function applyQuestEffect(run: RunState, effect: QuestEffect, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // exhaustive; flat; every kind mutates state (spawnNode/unlockNode → nodeOverrides; startCombat → pendingCombat{tag 'quest'}; promptName → pendingNamePrompt; addItem → bag or pendingLoot)
export function applyQuestEffects(run: RunState, effects: readonly QuestEffect[], env: EngineEnv): { run: RunState; effects: readonly Effect[] }
export function setFlag(run: RunState, key: string, value: FlagValue, scope: FlagScope): { run: RunState; effects: readonly Effect[] }   // FlagSet
export function clearFlagScope(run: RunState, scope: FlagScope): RunState
export function bootstrapQuests(env: EngineEnv): readonly string[]   // validation errors: initialStage exists, every transition.to / advanceQuestStage.toStage resolves, no content declares the sentinel
```

### `run/predicates.ts` — one evaluator, 15 kinds (§2.12)
```ts
export function predicateView(run: RunState): PredicateView              // the ONLY builder
export function evaluate(pred: Predicate, view: PredicateView): boolean  // always never flag notFlag questStage questComplete questStarted partyHas hasItem goldAtLeast visited cleared allOf anyOf not
```

### `run/dialogue.ts` — trees, choices, checks (§2.12)
```ts
export function currentNode(run: RunState, env: EngineEnv): DialogueTree['nodes'][string] | null
export function visibleChoices(run: RunState, env: EngineEnv): readonly (DialogueChoice & { enabled: boolean; bestCandidate: CheckCandidate | null })[]   // hidden filtered; disabled stay visible with threshold + best-in-party
export function choose(run: RunState, choiceId: string, attemptingUnitId: string | undefined, env: EngineEnv): { run: RunState; effects: readonly Effect[] }
   // throws on hidden/disabled/unknown (a UI bug, not a flow); check → onPass/onFail; effects applied; next node's onEnter applied; 'end' → slot cleared
export function continueDialogue(run: RunState, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // zero-choice node → end
export function renderText(text: string, run: RunState, env: EngineEnv): string                 // {mc} {company} substitution; placeholder "the foundling" / "the company"
export function speakerName(characterId: string, run: RunState, env: EngineEnv): string           // 'mc' → mcName ?? displayName
export interface CheckCandidate { unitId: string; name: string; classId: string; statValue: number; meetsThreshold: boolean }
export function evaluateCheck(req: CheckRequirement, attempting: PartyUnit | null, run: RunState): boolean   // stat: living && stat ≥ threshold; class: any living; gold/food: totals
export function checkCandidates(req: CheckRequirement, run: RunState): readonly CheckCandidate[]   // living, stat desc, meetsThreshold; [] for non-stat
export function chooseCheckEvent(run: RunState, choiceId: string, attemptingUnitId: string | undefined, env: EngineEnv): { run: RunState; effects: readonly Effect[] }   // auto-pick best living when omitted; class/gold/food auto; result stored in the slot
export function dismissCheckEvent(run: RunState): RunState
```

### `run/loot.ts` — loot by SOURCE (§2.13)
```ts
export function lootRowFor(tag: BattleTag | 'dungeonTreasure', tier: RegionTier, env: EngineEnv): LootRow
export function lootPool(run: RunState, tag: BattleTag | 'dungeonTreasure', env: EngineEnv): readonly Item[]   // hand-slot gear; region === current || 'none' for travel/dungeon-combat rows; minus ownedItemIds
export function rollLoot(row: LootRow, pool: readonly Item[], rng: RngState): { itemIds: readonly string[]; rng: RngState }   // chance gate, weighted rarity, fall DOWN on empty tier, exactly one item
export function grantLoot(run: RunState, itemIds: readonly string[], guaranteed: boolean, source: 'loot' | 'treasure' | 'quest', env: EngineEnv): { run: RunState; placed: readonly string[]; overflow: readonly string[]; effects: readonly Effect[] }   // guaranteed overflow → pendingLoot; travel overflow also → pendingLoot (never silently dropped)
```

### `run/battle.ts` — the run⇄combat seam (§2.8, §7.30, §2.6, §2.12)
```ts
export type BattleOrigin = { kind: 'travel' } | { kind: 'quest' } | { kind: 'dungeon'; roomType: 'combat' | 'elite' | 'boss' } | { kind: 'tutorial' } | { kind: 'finalBoss' }
export function battleSpecFor(run: RunState, pending: PendingCombat, env: EngineEnv): BattleSpec   // battleId + label via rngLabels, tier via areaTier/dungeonTier, level = max(authored, enemyLevelFor), party = living units, consumables = bag potions (one id per charge), rng = deriveRng(run.rng, `battle:${battleId}`)
export function applyBattleResult(run: RunState, result: BattleResult, env: EngineEnv): { run: RunState; report: BattleReport; effects: readonly Effect[] }
   // ONE atomic payout: survivor HP write-back → removeFallen → gold → loot (rollLoot with deriveRng(run.rng, rngLabels.loot(battleId)) + grantLoot) → prisoners append (cap) → consumed items removed first-match → runStats → clearFlagScope('battle') → dungeon room cleared → clearedEncounters[encounterId] on victory → captureTargets → flags + first dialogue → victoryEvent → pendingCheckEvent{victory} → BattleVictory/BattleDefeat + UnitDied + EnemyCaptured + ItemAcquired
export function resolveCaptureTargets(targets: readonly CaptureTarget[], capturedIds: readonly string[], survivingEnemyIds: readonly string[]): readonly QuestEffect[]   // captured → flag + dialogue; dead → flag + dialogue; standing → nothing; only the first dialogue survives
export function runLedger(run: RunState, outcome: 'won' | 'lost', trophyItemId: string | null): RunLedger
```

---

## 4. `procgen/`

### `procgen/dungeonGraph.ts` (§2.11, research canonical algorithm, compact params)
```ts
export function generateDungeon(rng: RngState, def: DungeonDef, env: EngineEnv): { graph: DungeonGraph; rng: RngState }
   // rules.dungeon: 6 rows × 4 cols, 4 path traces (first two distinct start columns), edges advance one row and never cross, prune unvisited;
   // row 0 forced combat, last row forced rest, no elite/rest before row 2; weights combat 45 / event 20 / treasure 15 / rest 5 / elite 5; single boss `r6c0`;
   // event rooms draw checkEventId from def.roomEventIds without replacement (rng)
export function validateDungeon(graph: DungeonGraph): readonly string[]   // unique ids; no consecutive specials on a path; fork destinations distinct types; boss reachable from every last-row node; every row-0 node reachable
export function successors(graph: DungeonGraph, roomId: string | null): readonly string[]   // null ⇒ row 0
```

### `procgen/battleFloor.ts` (§2.1 grid, §4 board terrain)
```ts
export function battleGrid(spec: Pick<BattleSpec,'grid'|'battleId'|'tag'>, rng: RngState, env: EngineEnv): { grid: CombatGrid; rng: RngState }   // authored obstacles for tutorial/boss; travel/dungeon: none unless terrain knob; floor = generateDirtRegion(w, h, deriveRng(rng, rngLabels.floor(battleId))) → sorted keys
```
(`boardFloor.ts`/`autotile.ts` at the engine root are the ported, final
pieces this calls; the UI autotiles `floor` for rendering only.)

---

## 5. `save/` (§2.14, §7.9, §7.31)

### `save/schema.ts`
```ts
export const SaveFileSchema: z.ZodType<SaveFile>   // .strict() at every level; CombatStateSchema is a first-class schema (obstacles: string[] sorted; selection literal idle); RunStateSchema declares EVERY field of RunState
export const MetaStateSchema: z.ZodType<MetaState>
```

### `save/serialize.ts`
```ts
export function toSaveFile(state: GameState, env: EngineEnv): SaveFile          // combat with selection idle; screen persisted; modal dropped
export function fromSaveFile(file: SaveFile): GameState                           // modal null; combat as-is (a hydrated enemy turn resumes by itself via nextPump)
export function parseSave(json: string, env: EngineEnv): { ok: true; file: SaveFile } | { ok: false; reason: 'version' | 'content' | 'schema'; detail: string }   // version/content mismatch ⇒ pre-alpha nuke with a loud reason
export function parseMeta(json: string): MetaState | null
export function replay(initial: GameState, actions: readonly Action[], env: EngineEnv): GameState   // fold reduce; equals a snapshot taken after the same actions (determinism test)
```

---

## 6. `flow/` — the framework-free flow controller

### `flow/settle.ts` — run after EVERY reduce (§7.13, §7.16, §7.30, §2.12 quests, §2.14 rule 6)
```ts
export function settle(result: ReduceResult, env: EngineEnv): ReduceResult
   // bounded loop (≤ 8) until nothing changes:
   //  1. combat && phase !== 'combat'  → resolveBattle → applyBattleResult (or tutorial/defeat/finalBoss branches) → combat = null → screen battleEnd | prologue | gameOver | win; defeat/win also run = null + meta counters; RunEnded
   //  2. run                            → settleQuests (fixed point; effects may open slots or recruit)
   //  3. run.pendingCombat && no dialogue/check/name open && combat === null && screen ∉ {battleEnd} → seedBattle(battleSpecFor) → combat, screen combat, BattleStarted
   //  4. run.pendingTravel?.status === 'suspended' && no slot open && combat === null && screen === overworld → resumeTravel
   //  5. run.activeDungeon?.bossCleared && screen === dungeon && no slot open → exitDungeon → overworld
   // then appends { kind:'autosaveHint', urgent: screen changed || run became null }
export type Overlay = { kind: 'checkEvent' } | { kind: 'dialogue' } | { kind: 'namePrompt' } | { kind: 'quickMenu'; nodeId: string } | null
export function overlayOf(state: GameState): Overlay        // priority: checkEvent > dialogue > namePrompt > quickMenu(atNode) — ONE derivation for UI, isLegal and the pumps
export function nextPump(state: GameState): PumpAction | null   // modal open → null; combat enemy turn → combat/enemyStep; overworld walking & no overlay → travel/step
export function freezeDeep<T>(v: T): T                        // dev-only invariant guard
```
Nothing here knows about React, timers, or storage. Battle resolution,
naming prompts (a `promptName` effect from a dialogue sets the slot; the
overlay derivation shows it; `name/submit` clears it), quest settling and
screen routing are all reducer output.

### `flow/runtime.ts` — the one dispatch chokepoint, host-agnostic
```ts
export interface RuntimeOptions {
  readonly env: EngineEnv
  readonly initial: GameState
  /** Host persistence. Engine builds the SaveFile; the host writes it. urgent ⇒ write now, else next macrotask (debounced). Omit for CLI/tests. */
  readonly persist?: (file: SaveFile, urgent: boolean) => void
  /** Host scheduling of pump steps. Default: run synchronously (CLI/tests). UI: after the effect consumer drains + hop delay / enemy-step delay. Must return a cancel. */
  readonly schedule?: (pump: PumpAction, run: () => void) => () => void
  readonly onError?: (error: unknown, action: Action) => void
}
export interface Runtime {
  getState(): GameState
  dispatch(action: Action): readonly Effect[]                       // reduce → commit → listeners → effect listeners → persist hint → schedule nextPump
  subscribe(listener: (state: GameState, prev: GameState) => void): () => void
  onEffects(listener: (effects: readonly Effect[], state: GameState) => void): () => void
  pump(): boolean                                                  // dispatch one due pump synchronously (returns false when none)
  drain(max?: number): number                                      // pump until none due (CLI autobattle / auto-travel); throws past `max` (default rules.combat.roundCap × 10)
  paused: boolean                                                  // set by the host while a modal/animation blocks; nextPump also refuses on modal
  destroy(): void
}
export function createRuntime(opts: RuntimeOptions): Runtime
```
Re-entrancy: `dispatch` inside a listener is queued and run after the
current commit (a tiny FIFO), so subscriptions never see a half-applied
state (§7.13). One pump may be scheduled at a time; a new commit cancels a
stale schedule.

---

## 7. Legality table (`reducer.ts#isLegal`)

| action prefix | requires |
|---|---|
| `meta/newRun` | screen ∈ {title, win, gameOver} |
| `meta/continueRun` | screen title ∧ run ≠ null |
| `meta/toTitle` | screen ∉ {title}; combat allowed (state persists exactly) |
| `save/resume` | screen title |
| `run/*` | run ≠ null ∧ (modal loadout ∨ screen ∈ {town, camp, overworld, dungeon, battleEnd}) ∧ combat = null |
| `travel/goTo` | screen overworld ∧ overlay null ∧ pendingTravel?.status ≠ walking/suspended |
| `travel/step` | pump only: overworld ∧ walking ∧ overlay null ∧ modal null |
| `travel/continue`, `travel/stay`, `town/enter`, `camp/enter`, `dungeon/enter`, `travel/challengeBoss` | overworld ∧ overlay = quickMenu (node type matches) |
| `town/*` (others) | screen town |
| `camp/rest`, `camp/scout`, `camp/leave` | screen camp |
| `dungeon/moveTo`, `dungeon/leave` | screen dungeon ∧ overlay null |
| `dialogue/*` | overlay dialogue |
| `check/*` | overlay checkEvent |
| `name/submit` | overlay namePrompt ∧ name non-empty after trim |
| `combat/*` | screen combat ∧ combat.phase = combat ∧ modal null; player actions also require the active unit to be party; `enemyStep`/`enemyAct` require enemy |
| `tutorial/skip` | combat.tag = tutorial |
| `battleEnd/dismiss` | screen battleEnd ∧ pendingLoot = [] |
| `ui/openModal` | screen ∉ {title}; `loadout`/`questLog` also not during an enemy turn |
| `quest/*`, `dev/*` | always (tests/CLI); `dev/*` refused in production builds by the host |

---

## 8. `src/ui/store.ts` — React binding (the only file that knows both worlds)

```ts
export const runtime: Runtime                  // createRuntime({ env: bootContent, initial, persist: localStorageWriter, schedule: uiScheduler })
export const dispatch: Runtime['dispatch']
export const getState: Runtime['getState']
export const subscribe: Runtime['subscribe']
export function useGame<T>(selector: (s: GameState) => T, isEqual?: (a: T, b: T) => boolean): T   // useSyncExternalStore; selectors must return stable/primitive values or pass isEqual (shallow provided as `shallow`)
export function useEffects(handler: (effects: readonly Effect[], state: GameState) => void): void  // subscribes in useEffect; the effect consumer (ui/effects) is the ONE subscriber that drives animations/sound and reports `drained()` to the scheduler
export function hasAutosave(): boolean
export function loadAutosave(): { ok: true; file: SaveFile } | { ok: false; reason: string }       // localStorage + parseSave; Title dispatches save/resume on ok, shows a loud toast on error
export const shallow: <T>(a: T, b: T) => boolean
```
Persistence: `persist(file, urgent)` writes `rules.save.runKey` (full
SaveFile) and `rules.save.metaKey` (meta) with one `setItem` each; urgent
writes are synchronous inside `dispatch` (defeat/win/screen change), others
coalesce to the next macrotask. Because defeat sets `run: null` in the same
reduce that flips the screen, the game-over frame can never render before
the null save is on disk.

Scheduler: `uiScheduler(pump, run)` waits for the effect consumer's drain
promise, then `HOP_DELAY_MS` (700) for `travel/step` or `ENEMY_STEP_MS` for
`combat/enemyStep`, honouring reduced motion (both → 0). Pause modal sets
`runtime.paused`; `nextPump` already returns null while a modal is open, so
a snapshot taken under pause is never racy.

---

## 9. `scripts/cli.ts` — headless surface (ARCHITECTURE §6)

```
cli play     --seed N [--screen title|combat|overworld|town|dungeon] [--cmds "…"] [--save file.json]
             REPL over createRuntime with the synchronous scheduler and no persistence (or --save for file persistence)
             commands: new | continue | go <node> | menu | enter | rest | scout | leave | tab <inn|shop|tavern> | buy <item> | sell <item>
                       | talk <n> | choose <n> [unit] | dismiss | name <text> | room <id> | play <handIdx> <x,y|-> | move <x,y> | item <id>
                       | capture <id> | end | auto | skip | show | state | effects | help | quit
cli simulate --seed N --runs 50 [--battle stub|boss|dungeon:<id>|group:<id>] [--policy greedy|random] [--json]
             seeds a battle via dev/startBattle, drains pumps with a greedy party policy; prints win rate, mean turns, first-blood turn;
             a round-cap hit throws with a per-round state dump (never a "STALEMATE" statistic)
cli balance  --seeds 20  asserts rules.balance targets over the simulate matrix; exit 1 on miss
cli travel   --seed N --to <node> [--auto]  walks the sheet resolving encounters with the auto policy; prints day/food/hp per hop
cli replay   <snapshot.json> <actions.json>  asserts replay(initial, actions) deep-equals the snapshot
cli lint     runs buildContent + crossRefLint + bootstrapQuests; exit 1 on any error (part of npm run verify)
cli render   --state file.json  prints the ASCII board / ledger for a saved state (screenshot substitute for engine tests)
```
The CLI imports `src/engine/**` and `src/content/index` only; it constructs
`EngineEnv` by reading the JSON with `fs` and calling `buildContent`.
