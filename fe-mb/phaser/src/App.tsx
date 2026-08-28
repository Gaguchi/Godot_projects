import React, { useState, useCallback, useEffect } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
import { GameStage } from './ui/GameStage'
import { TitleScreen } from './ui/screens/TitleScreen'
import { OverworldScene } from './ui/screens/OverworldScene'
import { TownScene } from './ui/screens/TownScene'
import { CampScene } from './ui/screens/CampScene'
import { DungeonScene } from './ui/screens/DungeonScene'
import { LoadGameModal } from './ui/modals/LoadGameModal'
import { SaveGameModal } from './ui/modals/SaveGameModal'
import { PauseMenu } from './ui/modals/PauseMenu'
import { PauseButton } from './ui/components/PauseButton'
import { QuitModal } from './ui/modals/QuitModal'
import { BattleEndModal } from './ui/modals/BattleEndModal'
import { DialogueModal } from './ui/modals/DialogueModal'
import { QuestLog } from './ui/overlays/QuestLog'
import { CombatHud } from './ui/scenes/combat/CombatHud'
import { bootstrapDialogues } from './state/dialogueBootstrap'
import { bootstrapQuests, attachQuestEngine } from './state/questEngine'
import { buildSaveFile } from './persistence/save'
import { writeSlot, readSlot } from './persistence/saveSlots'
import { diagLog, diag } from './state/diagLog'
import { useCombatStore } from './state/combatStore'
import { useRunStore } from './state/runStore'
import { buildStarterParty } from './systems/starterParty'
import { PartyLoadoutModal } from './ui/modals/PartyLoadoutModal'
import { resolveBattle } from './systems/battleResolver'
import { resolveCaptureTargets } from './systems/captureTargets'
import { isEnemyUnit } from './systems/team'
import { createRng, deriveRng } from './systems/rng'
import { allItemDefs } from './data/itemRegistry'
import { seedBossBattle } from './game/scenes/seedBossBattle'
import { seedDungeonBattle } from './game/scenes/seedDungeonBattle'
import { seedGroupBattle } from './game/scenes/seedGroupBattle'
import { seedTutorialBattle } from './game/scenes/seedTutorialBattle'
import { TutorialOverlay } from './ui/overlays/TutorialOverlay'
import { enemyLevelFor } from './systems/difficulty'
import { setMusicContext, sfx, unlockAudio, setMuted } from './audio/engine'
import { asNodeId } from './domain/ids'
import type { Unit } from './domain/unit'
import { errorBus, eventBus, actionLog, busRefs } from './state/appBus'
import { useMetaStore } from './state/metaStore'

// One-shot dialogue registry bootstrap so DialogueModal can find trees by id.
bootstrapDialogues()
// Quest registry + engine. Until this existed, every `listeners` and
// `transitions` block in the quest JSON was dead data and quests advanced only
// when a dialogue node dispatched advanceQuestStage by hand.
bootstrapQuests()
attachQuestEngine(eventBus)
diag('lifecycle', 'app boot')

// Dev-only debug surface. Claude diagnostic API entry point:
// `window.__debug.diag` (recent / byCategory / byLevel / search / dump).
if (import.meta.env.DEV) {
  ;(window as unknown as { __debug?: Record<string, unknown> }).__debug = {
    combatStore: useCombatStore,
    runStore: useRunStore,
    metaStore: useMetaStore,
    busRefs,
    diag: diagLog,
  }
}

export function App(): React.JSX.Element {
  // Dev-only fast-path: ?view=combat URL param skips title and jumps straight
  // into a stub battle. Used by E2E tests that exercise combat interactions.
  const initialView: View = (() => {
    if (!import.meta.env.DEV) return 'title'
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (v === 'combat' || v === 'overworld' || v === 'town' || v === 'dungeon' || v === 'camp') return v
    return 'title'
  })()
  const [view, setView] = useState<View>(initialView)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false)
  const [quitModalOpen, setQuitModalOpen] = useState(false)
  const [questLogOpen, setQuestLogOpen] = useState(false)
  const [loadoutOpen, setLoadoutOpen] = useState(false)
  const [townInitialPanel, setTownInitialPanel] = useState<'inn' | 'shop' | 'tavern' | null>(null)
  const dispatchMeta = useMetaStore((s) => s.dispatch)

  // Dev-only: when booting straight into a scene via ?view=, seed a real run
  // (party + gold + food, NO prologue) so the HUD/party/combat are
  // representative and manual/Playwright testing skips the ~16-node prologue.
  // Runs once; the normal title → New Game flow is untouched.
  useEffect(() => {
    if (!import.meta.env.DEV || initialView === 'title') return
    const run = useRunStore.getState()
    if (run.party.partyOrder.length > 0) return
    run.dispatch({ type: 'addGold', payload: { amount: 80 } })
    run.dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'addFood', amount: 5 }] } })
    for (const u of buildStarterParty()) {
      run.dispatch({ type: 'recruitUnit', payload: { unit: u } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Audio: unlock on first gesture (autoplay policy), ambient bed follows the
  // active view, master mute follows metaStore.
  useEffect(() => {
    const unlock = (): void => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  useEffect(() => {
    setMusicContext(
      view === 'combat' ? 'combat'
        : view === 'town' ? 'town'
          : view === 'overworld' || view === 'camp' || view === 'dungeon' ? 'overworld'
            : 'none',
    )
  }, [view])
  const audioMuted = useMetaStore((s) => s.audioMuted)
  useEffect(() => { setMuted(audioMuted) }, [audioMuted])

  // Q key opens quest log when in overworld/town/dungeon
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'q' && (view === 'overworld' || view === 'town' || view === 'dungeon' || view === 'camp')) {
        setQuestLogOpen((prev) => !prev)
      }
      if (e.key.toLowerCase() === 'i' && (view === 'overworld' || view === 'town' || view === 'dungeon' || view === 'camp')) {
        setLoadoutOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  // Esc opens pause menu in any non-title view. In combat, the BoardScene
  // already handles Esc for cancel-selection; we only intercept when no
  // selection is active so canceling stays the priority.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // BoardScene marks the event consumed when this Esc cancelled a combat
      // selection — one keystroke must not also open the pause menu.
      if (e.defaultPrevented) return
      if (view === 'title') return
      // If a modal is already open, close it instead of toggling pause.
      if (saveModalOpen) { setSaveModalOpen(false); return }
      if (loadModalOpen) { setLoadModalOpen(false); return }
      if (questLogOpen) { setQuestLogOpen(false); return }
      if (loadoutOpen) { setLoadoutOpen(false); return }
      // In combat, cancel-selection takes priority when something's active.
      if (view === 'combat') {
        const cs = useCombatStore.getState()
        if (cs.state.subPhase !== 'IDLE') return    // BoardScene handles cancel
      }
      setPauseMenuOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, saveModalOpen, loadModalOpen, questLogOpen])

  // F-26 + story 458: battle-end sync, fired ONCE per phase transition (the
  // previous every-change subscription re-dispatched fallenUnit on every
  // store update during VICTORY). On VICTORY/DEFEAT: record fallen party in
  // deathLog; on VICTORY additionally sweep the fallen from the party and
  // pay out the BattleResult (gold per §11 formula + gear loot rolled via
  // deriveRng('loot:BATTLE')) through the atomic applyBattleResult action.
  useEffect(() => {
    let lastPhase: string = useCombatStore.getState().state.phase
    const unsub = useCombatStore.subscribe((s) => {
      const phase = s.state.phase
      if (phase === lastPhase) return
      lastPhase = phase
      if (phase !== 'VICTORY' && phase !== 'DEFEAT') return

      const fallenPartyIds: string[] = []
      const partyIds: string[] = []
      const enemyIds: string[] = []
      for (const u of Object.values(s.state.units)) {
        if (isEnemyUnit(u)) { enemyIds.push(u.id as unknown as string); continue }
        partyIds.push(u.id as unknown as string)
        if (u.hp.current <= 0) fallenPartyIds.push(u.id as unknown as string)
      }
      const turn = s.state.turn.number
      for (const id of fallenPartyIds) {
        useRunStore.getState().dispatch({
          type: 'fallenUnit',
          payload: { unitId: id as never, cause: 'battle', turn },
        })
      }
      if (phase === 'VICTORY') {
        const run = useRunStore.getState()
        if (fallenPartyIds.length > 0) {
          run.dispatch({ type: 'sweepFallenUnits', payload: { unitIds: fallenPartyIds as never[] } })
        }
        const battleId = `${run.worldPosition.nodeId as unknown as string}:d${run.daysElapsed}`
        const result = resolveBattle({
          state: s.state,
          battleId,
          partyIds: partyIds as never[],
          enemyIds: enemyIds as never[],
          consumedTravelHop: null,
          lootRng: deriveRng(createRng(run.rngState), `loot:${battleId}`),
          lootPool: allItemDefs(),
        })
        run.dispatch({ type: 'applyBattleResult', payload: { result } })
        // resolveBattle has always BUILT these (BattleVictory, UnitDied,
        // EnemyCaptured...) and nothing ever published them, so quest stages
        // listening for a battle outcome could never fire. Replay them now
        // that the store has settled, so listeners read post-battle state.
        eventBus.replayAll(result.emittedEvents)
        // Named-enemy outcomes from the encounter that started this fight.
        // captureTargets was declared in the schema and read by nothing, so
        // the Blood Ties capture chain could never fire.
        const targets = run.pendingCaptureTargets
        if (targets.length > 0) {
          const survivingEnemyIds = Object.values(s.state.units)
            .filter(u => isEnemyUnit(u) && u.hp.current > 0 && !u.captured)
            .map(u => u.id as unknown as string)
          const effects = resolveCaptureTargets(targets, {
            capturedIds: result.capturedEnemies.map(c => c.id as unknown as string),
            survivingEnemyIds,
          })
          if (effects.length > 0) {
            run.dispatch({ type: 'applyQuestEffects', payload: { effects } })
          }
          run.dispatch({ type: 'setPendingCaptureTargets', payload: { targets: [] } })
        }
        // Final boss down → the run is complete (win screen renders off
        // battleTag; meta records the completion once).
        if (s.state.battleTag === 'finalBoss') {
          useMetaStore.getState().dispatch({ type: 'recordRunCompleted', payload: { won: true } })
        }
        sfx('victory')
      }
      if (phase === 'DEFEAT') {
        useMetaStore.getState().dispatch({ type: 'recordRunCompleted', payload: { won: false } })
        sfx('defeat')
      }
    })
    return () => { unsub() }
  }, [])

  const onNewGame = useCallback(() => {
    dispatchMeta({ type: 'startNewRun' })
    // Seed starting state: 80g, 5 food rations. Party is seeded at the first
    // combat by seedStubBattle / seedDungeonBattle. (Pre-alpha; richer party
    // creation lands later.)
    const run = useRunStore.getState()
    run.dispatch({ type: 'addGold', payload: { amount: 80 } })
    run.dispatch({ type: 'applyQuestEffects', payload: { effects: [{ kind: 'addFood', amount: 5 }] } })
    // Seed the starting party into the RUN so it's present from the first step
    // on the overworld (HUD roster) — not only conjured at the first battle.
    // Guard against double-seeding on a same-session second New Game.
    if (run.party.partyOrder.length === 0) {
      for (const u of buildStarterParty()) {
        run.dispatch({ type: 'recruitUnit', payload: { unit: u } })
      }
    }
    // First game ever → guided tutorial battle (ship plan §12) BEFORE the
    // overworld. Continue-after-victory routes through onContinueToOverworld,
    // which fires the prologue.
    if (!useMetaStore.getState().tutorialSeen) {
      const rng = deriveRng(createRng(run.rngState), 'battle:tutorial')
      useCombatStore.getState().dispatch(seedTutorialBattle(rng.state()), rng)
      useMetaStore.getState().dispatch({ type: 'markTutorialSeen' })
      setView('combat')
      return
    }
    setView('overworld')
    // GP-G1: prologue trigger on first new game. Flag is permanent so it
    // doesn't fire again on subsequent runs.
    if (!run.flags.has('prologue_seen' as never)) {
      run.dispatch({
        type: 'startDialogue',
        payload: { dialogueId: 'prologue' as never, nodeId: 'start' },
      })
    }
  }, [dispatchMeta])

  const onLoadGame = useCallback(() => {
    setLoadModalOpen(true)
  }, [])

  const onSaveGame = useCallback((slotId: string) => {
    const meta = useMetaStore.getState()
    const save = buildSaveFile({
      meta: { gameStarted: meta.gameStarted, totalRuns: meta.totalRuns },
      run: useRunStore.getState(),
      combat: useCombatStore.getState().state.phase === 'COMBAT' ? useCombatStore.getState().state : null,
      actionLog: actionLog.serialize(),
    })
    writeSlot(slotId, save, `Slot ${Number(slotId) + 1}`)
    setSaveModalOpen(false)
    setPauseMenuOpen(false)
  }, [])

  const onSlotLoad = useCallback((slotId: string) => {
    const result = readSlot(slotId)
    if (!result || !result.ok) {
      // Bad save — close modal silently. Could add error toast later.
      setLoadModalOpen(false)
      return
    }
    // Hydrate run state from the save (minimal restore: gold, party, world position).
    // Full hydration with combat/actionLog lands when persistence-load is wired
    // through the reducer chain. For now, restore the run essentials.
    const save = result.save
    if (save.run) {
      // Full hydration (story 477): flags, quests, RNG, stats, one-shots,
      // visited/cleared maps all restore atomically alongside the essentials.
      useRunStore.getState().dispatch({
        type: 'hydrateFromSave',
        payload: {
          gold: save.run.gold,
          worldPosition: save.run.worldPosition,
          partyUnits: save.run.partyUnits as { id: string; [k: string]: unknown }[],
          partyOrder: save.run.partyOrder,
          inventoryItems: save.run.inventoryItems,
          flags: save.run.flags,
          questStates: save.run.questStates,
          rngState: save.run.rngState,
          daysElapsed: save.run.daysElapsed,
          runStats: save.run.runStats,
          oneShotsFired: save.run.oneShotsFired,
          visitedNodes: save.run.visitedNodes,
          clearedEncounters: save.run.clearedEncounters,
          deathLog: save.run.deathLog,
        },
      })
    }
    setLoadModalOpen(false)
    setPauseMenuOpen(false)
    // Bring the player back to overworld after a load (combat state is reset).
    useCombatStore.getState().reset()
    setView('overworld')
  }, [])

  const onQuit = useCallback(() => {
    // window.close() only works for windows opened via window.open(); in a
    // normal browser tab it silently fails. Try it; if the tab is still here
    // a moment later, show the fallback "thanks for playing" overlay.
    try { window.close() } catch { /* ignore */ }
    setQuitModalOpen(true)
  }, [])

  const onBattleRestart = useCallback(() => {
    useCombatStore.getState().reset()
    // Trigger view re-flip so CombatScene's create() runs again and reseeds
    setView('title')
    setTimeout(() => setView('combat'), 50)
  }, [])

  const onReturnToTitle = useCallback(() => {
    useCombatStore.getState().reset()
    setView('title')
  }, [])

  // Win / game-over → New Run: wipe combat + run state, then run the normal
  // New Game seeding (fresh party with starter loadouts, gold, food).
  const onNewRun = useCallback(() => {
    useCombatStore.getState().reset()
    useRunStore.getState().dispatch({ type: 'resetRun' })
    onNewGame()
  }, [onNewGame])

  /** Current living party, in order — the payload every battle seeder takes. */
  const livingParty = (): Unit[] => {
    const run = useRunStore.getState()
    return run.party.partyOrder
      .map((id) => run.party.units[id as unknown as string])
      .filter((u): u is Unit => u !== undefined && u.hp.current > 0)
  }

  // The Iron Throne (exit node): hand-crafted final boss (ship plan §12).
  const onChallengeBoss = useCallback(() => {
    const run = useRunStore.getState()
    const rng = deriveRng(createRng(run.rngState), 'battle:finalBoss')
    useCombatStore.getState().dispatch(seedBossBattle(rng.state(), livingParty()), rng)
    setView('combat')
  }, [])

  // Dungeon combat rooms seed their room-appropriate enemy group (was: every
  // dungeon fight fell through to the stub bandit battle).
  const onDungeonCombat = useCallback((roomType: 'combat' | 'elite' | 'boss') => {
    const run = useRunStore.getState()
    const dungeonId = (run.activeDungeon?.dungeonId as unknown as string) ?? 'smugglers_cave'
    const rng = deriveRng(createRng(run.rngState), `battle:${dungeonId}:${roomType}`)
    try {
      useCombatStore.getState().dispatch(seedDungeonBattle(dungeonId, roomType, rng.state(), livingParty()), rng)
    } catch (e) {
      diag('route', `dungeon battle seed failed, stub fallback: ${(e as Error).message}`, undefined, 'warn')
    }
    setView('combat')
  }, [])

  // Travel-encounter battles: seed the ROLLED enemy group scaled to the
  // region's difficulty band (was: every travel fight was 3 stub bandits).
  const onTravelToCombat = useCallback((nodeId: unknown, enemyGroupId?: string) => {
    if (enemyGroupId) {
      const run = useRunStore.getState()
      const mapId = run.worldPosition.mapId as unknown as string
      const level = enemyLevelFor(mapId, `${mapId}:${String(nodeId)}:${run.daysElapsed}`)
      const rng = deriveRng(createRng(run.rngState), `battle:${enemyGroupId}:${String(nodeId)}`)
      try {
        useCombatStore.getState().dispatch(seedGroupBattle(enemyGroupId, level, rng.state(), livingParty()), rng)
      } catch (e) {
        diag('route', `group battle seed failed, stub fallback: ${(e as Error).message}`, undefined, 'warn')
      }
    }
    setView('combat')
  }, [])

  const onContinueToOverworld = useCallback(() => {
    // Travel encounter resolved successfully — consume pending path and arrive
    const run = useRunStore.getState()
    const pending = run.pendingTravelPath
    if (pending && pending.remainingNodeIds.length > 0) {
      const nextNode = pending.remainingNodeIds[0]!
      run.dispatch({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nextNode as unknown as string) } })
      run.dispatch({ type: 'startTravelPath', payload: { path: { ...pending, remainingNodeIds: [] } } })
    }
    const wasTutorial = useCombatStore.getState().state.battleTag === 'tutorial'
    useCombatStore.getState().reset()
    setView('overworld')
    // Tutorial → overworld handoff fires the prologue (deferred from New Game).
    if (wasTutorial && !run.flags.has('prologue_seen' as never)) {
      run.dispatch({
        type: 'startDialogue',
        payload: { dialogueId: 'prologue' as never, nodeId: 'start' },
      })
    }
  }, [])

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <GameStage>
        <div id="app-root" className="relative h-full w-full overflow-hidden">
          {/* Phaser canvas host. Must stay mounted for the app's lifetime:
              main.tsx parents the canvas into this div ONCE at boot. If this
              div unmounts (it used to render only while view === 'combat'),
              React destroys the canvas with it and every battle after the
              first draws into a detached canvas — an invisible board. Hidden,
              never unmounted, outside combat. */}
          <div
            id="game-canvas-container"
            className="absolute inset-0"
            style={{ visibility: view === 'combat' ? 'visible' : 'hidden' }}
          />
          {view === 'title' && (
            <TitleScreen
              onNewGame={onNewGame}
              onLoadGame={onLoadGame}
              onQuit={onQuit}
            />
          )}
          {view === 'overworld' && (
            <OverworldScene
              onTravelToCombat={onTravelToCombat}
              onEnterTown={(_nodeId, panel) => { setTownInitialPanel(panel ?? null); setView('town') }}
              onEnterCamp={() => setView('camp')}
              onEnterDungeon={() => setView('dungeon')}
              onWin={onChallengeBoss}
            />
          )}
          {view === 'combat' && (
            <>
              {/* Combat backdrop — trodden field around the board. Flat earth
                  lit from above (Field Ledger has no candle pool), so the
                  gridless area reads as ground, not a void. */}
              <div
                aria-hidden
                className="fixed inset-0 -z-10"
                style={{
                  background: 'linear-gradient(to bottom, #33261a 0%, #241a11 52%, #191209 100%)',
                }}
              />
              <div
                aria-hidden
                className="fixed inset-0 -z-10 pointer-events-none opacity-[0.20] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.0' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.0 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
                  backgroundSize: '220px 220px',
                }}
              />
              {/* Daylight grade OVER the (transparent) canvas, under the HUD.
                  The old radial vignette is gone — this is a directional wash
                  (sky above, shaded soil below) so the field reads as outdoors
                  without pulling a spotlight onto the board. */}
              <div
                aria-hidden
                className="fixed inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(255,248,228,0.05) 0%, transparent 26%, rgba(24,17,10,0.32) 100%)',
                }}
              />
              <div id="react-shell" />
              <CombatHud />
              <TutorialOverlay />
            </>
          )}
          {view === 'town' && (
            <TownScene
              onLeave={() => setView('overworld')}
              {...(townInitialPanel ? { initialPanel: townInitialPanel } : {})}
            />
          )}
          {view === 'camp' && (
            <CampScene onLeave={() => setView('overworld')} />
          )}
          {view === 'dungeon' && (
            <DungeonScene
              onClearAndExit={() => setView('overworld')}
              onCombatRoom={onDungeonCombat}
              onLeave={() => setView('overworld')}
            />
          )}
          {view !== 'title' && (
            <div className="fixed top-2 right-2 z-[120] pointer-events-auto">
              <PauseButton onPress={() => setPauseMenuOpen(true)} />
            </div>
          )}
          <PauseMenu
            open={pauseMenuOpen}
            canSave={view !== 'title'}
            onClose={() => setPauseMenuOpen(false)}
            onResume={() => setPauseMenuOpen(false)}
            onSaveGame={() => { setPauseMenuOpen(false); setSaveModalOpen(true) }}
            onLoadGame={() => { setPauseMenuOpen(false); setLoadModalOpen(true) }}
            onReturnToTitle={() => {
              setPauseMenuOpen(false)
              useCombatStore.getState().reset()
              setView('title')
            }}
            onQuit={() => { setPauseMenuOpen(false); onQuit() }}
          />
          <SaveGameModal
            open={saveModalOpen}
            onClose={() => setSaveModalOpen(false)}
            onSave={onSaveGame}
          />
          <DevHud errorBus={errorBus} eventBus={eventBus} actionLog={actionLog} />
          <LoadGameModal
            open={loadModalOpen}
            onClose={() => setLoadModalOpen(false)}
            onSelect={onSlotLoad}
          />
          <QuitModal open={quitModalOpen} onClose={() => setQuitModalOpen(false)} />
          <BattleEndModal
            onRestart={onBattleRestart}
            onReturnToTitle={onReturnToTitle}
            onContinueToOverworld={onContinueToOverworld}
            onNewRun={onNewRun}
          />
          <QuestLog open={questLogOpen} onClose={() => setQuestLogOpen(false)} />
          <PartyLoadoutModal open={loadoutOpen} onClose={() => setLoadoutOpen(false)} />
          <DialogueModal />
          {/* Quest log key hint — a small key-hint chip, not raw debug text */}
          {(view === 'overworld' || view === 'town' || view === 'dungeon' || view === 'camp') && !questLogOpen && (
            <div
              style={{
                position: 'fixed',
                bottom: 8,
                left: 8,
                zIndex: 100,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                fontSize: 11,
                letterSpacing: '0.04em',
                color: '#c9985c',
                background: 'rgba(16,10,5,0.66)',
                border: '1px solid rgba(201,152,92,0.3)',
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '0 4px',
                  borderRadius: 2,
                  border: '1px solid rgba(201,152,92,0.45)',
                  color: '#e8c98a',
                }}
              >
                Q
              </span>
              Quest Log
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '0 4px',
                  borderRadius: 2,
                  border: '1px solid rgba(201,152,92,0.45)',
                  color: '#e8c98a',
                  marginLeft: 8,
                }}
              >
                I
              </span>
              Loadout
            </div>
          )}
        </div>
        </GameStage>
      </ErrorBoundary>
    </ViewContext.Provider>
  )
}
