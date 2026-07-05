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
import { buildSaveFile } from './persistence/save'
import { writeSlot, readSlot } from './persistence/saveSlots'
import { diagLog, diag } from './state/diagLog'
import { useCombatStore } from './state/combatStore'
import { useRunStore } from './state/runStore'
import { buildUnit } from './systems/buildUnit'
import { asNodeId } from './domain/ids'

/** Starting roster seeded into the run at New Game: [classId, name, stableId]. */
const STARTING_PARTY: Array<[string, string, string]> = [
  ['lord', 'Roy', 'roy'],
  ['knight', 'Marcus', 'marcus'],
  ['mage', 'Lilina', 'lilina'],
]
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'
import { useMetaStore } from './state/metaStore'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

// One-shot dialogue registry bootstrap so DialogueModal can find trees by id.
bootstrapDialogues()
diag('lifecycle', 'app boot')

// Dev-only debug surface. Claude diagnostic API entry point:
// `window.__debug.diag` (recent / byCategory / byLevel / search / dump).
if (import.meta.env.DEV) {
  ;(window as unknown as { __debug?: Record<string, unknown> }).__debug = {
    combatStore: useCombatStore,
    runStore: useRunStore,
    metaStore: useMetaStore,
    busRefs: { errorBus, eventBus, actionLog },
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
    for (const [classId, name, id] of STARTING_PARTY) {
      const u = buildUnit(classId, 1, name, id)
      if (u) run.dispatch({ type: 'recruitUnit', payload: { unit: u } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Q key opens quest log when in overworld/town/dungeon
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'q' && (view === 'overworld' || view === 'town' || view === 'dungeon' || view === 'camp')) {
        setQuestLogOpen((prev) => !prev)
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
      if (view === 'title') return
      // If a modal is already open, close it instead of toggling pause.
      if (saveModalOpen) { setSaveModalOpen(false); return }
      if (loadModalOpen) { setLoadModalOpen(false); return }
      if (questLogOpen) { setQuestLogOpen(false); return }
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

  // F-26: Permadeath sync. When combat phase becomes VICTORY/DEFEAT, walk
  // the units and record fallen party members in runStore.deathLog. On
  // VICTORY, also remove them from runStore.party so subsequent battles
  // are seeded without them.
  useEffect(() => {
    const unsub = useCombatStore.subscribe((s) => {
      if (s.state.phase !== 'VICTORY' && s.state.phase !== 'DEFEAT') return
      const fallenPartyIds: string[] = []
      for (const u of Object.values(s.state.units)) {
        if (u.hp.current > 0) continue
        if ((u.classId as unknown as string).includes('bandit')) continue
        fallenPartyIds.push(u.id as unknown as string)
      }
      if (fallenPartyIds.length === 0) return
      const turn = s.state.turn.number
      for (const id of fallenPartyIds) {
        useRunStore.getState().dispatch({
          type: 'fallenUnit',
          payload: { unitId: id as never, cause: 'battle', turn },
        })
      }
      // On VICTORY, sweep dead party from runStore.party so they don't reseed
      if (s.state.phase === 'VICTORY') {
        useRunStore.getState().dispatch({
          type: 'sweepFallenUnits',
          payload: { unitIds: fallenPartyIds as never[] },
        })
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
      for (const [classId, name, id] of STARTING_PARTY) {
        const u = buildUnit(classId, 1, name, id)
        if (u) run.dispatch({ type: 'recruitUnit', payload: { unit: u } })
      }
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
      useRunStore.getState().dispatch({
        type: 'hydrateFromSave',
        payload: {
          gold: save.run.gold,
          worldPosition: save.run.worldPosition,
          partyUnits: save.run.partyUnits as { id: string; [k: string]: unknown }[],
          partyOrder: save.run.partyOrder,
          inventoryItems: save.run.inventoryItems,
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

  const onContinueToOverworld = useCallback(() => {
    // Travel encounter resolved successfully — consume pending path and arrive
    const run = useRunStore.getState()
    const pending = run.pendingTravelPath
    if (pending && pending.remainingNodeIds.length > 0) {
      const nextNode = pending.remainingNodeIds[0]!
      run.dispatch({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nextNode as unknown as string) } })
      run.dispatch({ type: 'startTravelPath', payload: { path: { ...pending, remainingNodeIds: [] } } })
    }
    useCombatStore.getState().reset()
    setView('overworld')
  }, [])

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <GameStage>
        <div id="app-root" className="relative h-full w-full overflow-hidden">
          {view === 'title' && (
            <TitleScreen
              onNewGame={onNewGame}
              onLoadGame={onLoadGame}
              onQuit={onQuit}
            />
          )}
          {view === 'overworld' && (
            <OverworldScene
              onTravelToCombat={() => setView('combat')}
              onEnterTown={(_nodeId, panel) => { setTownInitialPanel(panel ?? null); setView('town') }}
              onEnterCamp={() => setView('camp')}
              onEnterDungeon={() => setView('dungeon')}
              onWin={() => setView('title')}
            />
          )}
          {view === 'combat' && (
            <>
              {/* Combat backdrop — same atmospheric pattern as overworld/dungeon
                  sits BEHIND the Phaser canvas so the gridless area no longer
                  reads as a black void. */}
              <div
                aria-hidden
                className="fixed inset-0 -z-10"
                style={{
                  background: [
                    'radial-gradient(ellipse 70% 50% at 50% 45%, #382818 0%, transparent 60%)',
                    'linear-gradient(to bottom, #1a1612 0%, #0b0907 55%, #050403 100%)',
                  ].join(', '),
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
              <div id="game-canvas-container" className="absolute inset-0" />
              <div id="react-shell" />
              <CombatHud />
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
              onCombatRoom={() => setView('combat')}
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
          />
          <QuestLog open={questLogOpen} onClose={() => setQuestLogOpen(false)} />
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
            </div>
          )}
        </div>
        </GameStage>
      </ErrorBoundary>
    </ViewContext.Provider>
  )
}
