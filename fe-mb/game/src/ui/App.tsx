/**
 * ui/App.tsx — the screen router (ARCHITECTURE §4): `state.screen.kind` picks the screen; overlays come from
 * `overlayOf`, modals from `state.ui.modal`. Screens are dumb: they select state and dispatch.
 *
 * Every screen is real; the narrative overlays (`ui/overlays`) sit above whichever screen is up.
 * Two boot-time strands pass through here rather than through the reducer: `bootNote` (a save that could not be
 * read — the Title screen says so in words, brief §2.14) and the dev badge (`ui.devHud`, CONTRACT §10: a `?screen=`
 * session is a scratch session with no autosave, and must say so on the glass).
 *
 * The REFUSAL SURFACE is mounted here, once, beside the modal and overlay layers, because the frame is what owns it:
 * a refusal is the reducer answering the player, and the reducer can answer on any screen. It used to be pasted into
 * two screens of the ten, so a refused combat play returned a perfect sentence that nothing on the glass ever spoke
 * (RE-GATE C 3.6). One mount, every screen; the seat is the screen's, in CSS (`.place__toast[data-screen]`).
 */
import React from 'react'
import type { GameState, ScreenKind } from '../engine/types'
import { CombatScreen } from './combat'
import { OverworldScreen } from './overworld/OverworldScreen'
import { Modals } from './modals/index'
import { Overlays } from './overlays/index'
import { RefusalToast } from './components/RefusalToast'
import { CampScreen } from './screens/Camp'
import { DungeonScreen } from './screens/Dungeon'
import { FieldReport } from './screens/FieldReport'
import { LedgerScreen } from './screens/Ledger'
import { PrologueScreen } from './screens/Prologue'
import { TitleScreen } from './screens/Title'
import { TownScreen } from './screens/Town'
import { useGame } from './store'

const selectScreen = (s: GameState): ScreenKind => s.screen.kind
const selectDevHud = (s: GameState): boolean => s.ui.devHud

/** The scratch-session mark: a scrap of tape in the corner, never over anything the player clicks. */
function DevBadge({ screen }: { readonly screen: ScreenKind }): React.JSX.Element {
  return (
    <div
      aria-hidden
      data-testid="dev-badge"
      style={{
        position: 'absolute', left: 8, bottom: 8, zIndex: 90, pointerEvents: 'none',
        font: '600 10px/1 var(--font-display, system-ui)', letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'var(--color-parchment-dim)', background: 'rgba(23, 17, 12, 0.72)',
        border: '1px solid var(--color-edge-dark, rgba(0,0,0,0.5))', borderRadius: 2, padding: '4px 7px', opacity: 0.7,
      }}
    >
      dev · {screen} · no autosave
    </div>
  )
}

export function App({ bootNote = null }: { readonly bootNote?: string | null } = {}): React.JSX.Element {
  const screen = useGame(selectScreen)
  const devHud = useGame(selectDevHud)
  let body: React.ReactNode
  switch (screen) {
    case 'title': body = <TitleScreen note={bootNote} />; break
    case 'prologue': body = <PrologueScreen />; break
    case 'overworld': body = <OverworldScreen />; break
    case 'town': body = <TownScreen />; break
    case 'camp': body = <CampScreen />; break
    case 'dungeon': body = <DungeonScreen />; break
    case 'combat': body = <CombatScreen />; break
    case 'battleEnd': body = <><CombatScreen /><FieldReport /></>; break
    case 'win': body = <LedgerScreen />; break
    case 'gameOver': body = <LedgerScreen />; break
  }
  return (
    <>
      {body}
      <Modals />
      <Overlays />
      <RefusalToast screen={screen} />
      {devHud && <DevBadge screen={screen} />}
    </>
  )
}
