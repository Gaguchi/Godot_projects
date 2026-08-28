import React, { useRef, useState } from 'react'
import { useRunStore } from '../../state/runStore'
import pineCrossingTown from '../../data/content/towns/pine_crossing.json'
import riversideMarketTown from '../../data/content/towns/riverside_market.json'
import southJunctionTown from '../../data/content/towns/south_junction.json'
import borderkeepCastleTown from '../../data/content/towns/borderkeep_castle.json'
import northernBridgeTown from '../../data/content/towns/northern_bridge.json'
import type { TownDef } from '../../domain/town'
import { Button, GameHud, Heading } from '../components'
import { InnPanel } from './town/InnPanel'
import { ShopPanel } from './town/ShopPanel'
import { TavernPanel } from './town/TavernPanel'
import { BRASS_PIN, INK_RULE, INK_RULE_STRONG } from './town/townUi'

const TOWN_REGISTRY: Record<string, TownDef> = {
  pine_crossing: pineCrossingTown as TownDef,
  riverside_market: riversideMarketTown as TownDef,
  south_junction: southJunctionTown as TownDef,
  borderkeep_castle: borderkeepCastleTown as TownDef,
  northern_bridge: northernBridgeTown as TownDef,
}

const REGION_DISPLAY: Record<string, string> = {
  borderlands: 'BORDERLANDS',
  thornwood: 'THORNWOOD',
  ashfall: 'ASHFALL REACH',
}

type Panel = 'inn' | 'shop' | 'tavern'

/**
 * The page's index. A ledger contents column reads `entry ....... what it is`,
 * so each row carries its own gloss instead of stuffing the purpose into the
 * name with an em dash.
 */
const PANEL_INDEX: readonly { key: Panel; name: string; gloss: string }[] = [
  { key: 'inn', name: 'The Inn', gloss: 'Board & Care' },
  { key: 'shop', name: 'The Shop', gloss: 'Goods & Coin' },
  { key: 'tavern', name: 'The Tavern', gloss: 'Word & Hire' },
]

/** Left ledger page (the index) width on the 1280 stage. */
const INDEX_W = 272

export interface TownSceneProps {
  onLeave: () => void
  /** Quick-action menu deep-link: open the town with a specific panel active. */
  initialPanel?: Panel
}

/**
 * Town — the quartermaster's ledger, open at this settlement's page.
 *
 * "Field Ledger" identity: a linen sheet lying on the planed-oak camp table in
 * daylight, pinned at the corners with brass. The sheet is a two-page SPREAD:
 * the left page is the ruled index (town name, region, the three entries), the
 * right page is the entry itself. The gutter between them is the ledger's
 * double margin rule.
 *
 * Material contract: canvas = read, leather = act. The index entries are ghost
 * buttons — no material of their own, so they take the page's walnut-ink ramp
 * and read as written index lines. The ONLY leather on the page is the acting
 * control inside an entry (Rest / Buy / Sell / Hire / Talk).
 *
 * Nothing glows: the old dusk gradient, hearth pool, iron grain and carved
 * signboard are gone. The only "light" is the paper's own tone falling from
 * `--canvas-base` toward `--canvas-mid` — the gradient deliberately stops short
 * of `--canvas-deep`, because small muted text in a deep band measures 4.16:1
 * and this page keeps every pair above AA on both bands it actually uses.
 */
export function TownScene({ onLeave, initialPanel }: TownSceneProps): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<Panel>(initialPanel ?? 'inn')
  const mainRef = useRef<HTMLElement | null>(null)
  const switchPanel = (p: Panel): void => {
    setActivePanel(p)
    // A new entry always opens at its first line — never mid-scroll from the last.
    if (mainRef.current) mainRef.current.scrollTop = 0
  }
  const worldPosition = useRunStore((s) => s.worldPosition)
  const townId = worldPosition.nodeId as unknown as string
  const town = TOWN_REGISTRY[townId] ?? (pineCrossingTown as TownDef)
  const regionLabel =
    REGION_DISPLAY[town.regionId as unknown as string]
    ?? (town.regionId as unknown as string).toUpperCase()

  return (
    <div
      id="town-scene"
      className="page-canvas relative h-full w-full overflow-hidden font-body"
      style={{ background: 'linear-gradient(168deg, #3f2e1d 0%, #2e2115 46%, #241a10 100%)' }}
    >
      {/* --- the camp table: planed oak boards, key light from the left ----- */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(92deg, rgba(0,0,0,0.30) 0 2px, rgba(255,232,190,0.05) 2px 4px, transparent 4px 132px)',
            'repeating-linear-gradient(92deg, rgba(255,232,190,0.022) 0 1px, transparent 1px 7px)',
          ].join(', '),
        }}
      />

      {/* --- the ledger sheet lying open on it ----------------------------- */}
      <div className="absolute inset-x-3 inset-y-2.5">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(176deg, #f3ecda 0%, var(--canvas-base) 38%, var(--canvas-mid) 100%)',
            boxShadow:
              '0 10px 26px rgba(12,7,3,0.55), inset 0 1px 0 rgba(255,253,247,0.6), inset 0 -2px 0 rgba(122,92,52,0.16)',
          }}
        />
        {/* linen weave — multiply so it bites on a light ground, but kept at a
            whisper: at 0.4 the grain dragged the painted linen a full band
            darker than --canvas-mid and put every muted pair under AA. */}
        <div aria-hidden className="iron-grain absolute inset-0" style={{ mixBlendMode: 'multiply', opacity: 0.08 }} />
        {/* the ledger's ruling — barely inked, so writing that does not sit
            exactly on a line reads as a real hand, not as misregistration. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0 33px, color-mix(in oklab, var(--color-ink) 7%, transparent) 33px 34px)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 7%, #000 93%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 7%, #000 93%, transparent 100%)',
          }}
        />
        {/* the gutter: every ledger page carries a double margin rule */}
        <div aria-hidden className="absolute bottom-0 top-0 w-px" style={{ left: INDEX_W, background: INK_RULE_STRONG }} />
        <div aria-hidden className="absolute bottom-0 top-0 w-px" style={{ left: INDEX_W + 4, background: INK_RULE }} />
        {/* brass pins holding the sheet to the boards */}
        {[
          { top: 12, left: 12 }, { top: 12, right: 12 },
          { bottom: 12, left: 12 }, { bottom: 12, right: 12 },
        ].map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{ ...p, background: BRASS_PIN, boxShadow: '0 1px 2px rgba(20,12,4,0.55)' }}
          />
        ))}
      </div>

      <GameHud regionName={regionLabel} location={town.name} showParty={false} surface="parchment" />

      <div className="relative z-10 flex h-full w-full">
        {/* ---------------- LEFT PAGE — the ruled index ------------------- */}
        <aside className="flex shrink-0 flex-col px-8 pb-9 pt-7" style={{ width: INDEX_W + 12 }}>
          <Heading
            level={2}
            className="!m-0 !text-[1.35rem] !leading-tight !tracking-[0.08em] !text-[color:var(--color-ink)]"
          >
            {town.name}
          </Heading>
          <div
            data-probe="region"
            className="mt-1.5 text-[0.6rem] uppercase tracking-[0.3em] text-[color:var(--color-parchment-dim)]"
          >
            {regionLabel}
          </div>
          <div aria-hidden className="mt-4 h-px w-full" style={{ background: INK_RULE_STRONG }} />
          <div aria-hidden className="mt-[3px] h-px w-full" style={{ background: INK_RULE }} />

          <nav className="mt-4 flex flex-col">
            {PANEL_INDEX.map(({ key, name, gloss }) => {
              const active = activePanel === key
              return (
                <div key={key} className="relative">
                  {/* Selection is carried by THREE channels — a brass pin in
                      the margin, ink weight, and a solid vs dotted rule — so
                      the active entry survives colour-blindness and greyscale. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                      style={{ background: BRASS_PIN, boxShadow: '0 1px 2px rgba(20,12,4,0.5)' }}
                    />
                  )}
                  <Button
                    id={`town-${key}-btn`}
                    variant="ghost"
                    onPress={() => switchPanel(key)}
                    // the index entry the page is currently turned to
                    {...(active ? { 'aria-current': 'page' as const } : {})}
                    className={
                      '!w-full !justify-start !gap-2 !rounded-none !px-0 !py-2.5 !text-left '
                      + 'data-[hovered]:!border-transparent data-[hovered]:!bg-[color:color-mix(in_oklab,var(--color-ink)_6%,transparent)] '
                      + (active
                        ? '!text-[color:var(--color-ink)]'
                        : '!text-[color:var(--color-parchment-dim)] data-[hovered]:!text-[color:var(--color-ink)]')
                    }
                    style={{
                      borderBottom: `1px ${active ? 'solid' : 'dotted'} ${active ? INK_RULE_STRONG : INK_RULE}`,
                    }}
                  >
                    <span className={`voice-display shrink-0 normal-case tracking-[0.05em] ${active ? 'text-[1.02rem]' : 'text-[0.98rem]'}`}>
                      {name}
                    </span>
                    <span aria-hidden className="h-px min-w-3 flex-1" style={{ background: INK_RULE }} />
                    <span
                      data-probe="nav-gloss"
                      className="shrink-0 text-[0.56rem] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]"
                    >
                      {gloss}
                    </span>
                  </Button>
                </div>
              )
            })}
          </nav>

          <div className="flex-1" />
          <div aria-hidden className="mb-3 h-px w-full" style={{ background: INK_RULE }} />
          <Button
            id="town-leave-btn"
            variant="ghost"
            onPress={onLeave}
            className={
              '!justify-start !rounded-none !px-0 !py-1 !text-left !text-[0.66rem] !tracking-[0.22em] '
              + '!text-[color:var(--color-parchment-dim)] data-[hovered]:!border-transparent '
              + 'data-[hovered]:!bg-transparent data-[hovered]:!text-[color:var(--color-ink)]'
            }
          >
            Leave Town
          </Button>
        </aside>

        {/* ---------------- RIGHT PAGE — the entry ------------------------ */}
        {/* pt-[88px] clears the fixed GameHud plate (top-4 + ~64px tall), which
            is centred over this page, so entry headings never run under it. */}
        {/* The HUD plate floats over this page, so a long entry must not slide
            out from under a hard clip — the column dissolves into the paper at
            both ends instead (themed edge fade, never a hard cut). */}
        <main
          id="town-main"
          ref={mainRef}
          className="min-w-0 flex-1 overflow-auto px-9 pb-10 pt-[88px]"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0, transparent 34px, #000 82px, #000 96%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, transparent 34px, #000 82px, #000 96%, transparent 100%)',
          }}
        >
          {/* Turning to a new entry is a page turn, not a hard cut. Keyed on
              the panel so it replays per switch; transform+opacity only, and
              the media query (not just the duration token) kills the loop for
              reduced-motion users. */}
          <div key={activePanel} className="town-entry-in">
            {activePanel === 'inn' && <InnPanel />}
            {activePanel === 'shop' && <ShopPanel town={town} />}
            {activePanel === 'tavern' && <TavernPanel town={town} />}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes townEntryIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: no-preference) {
          .town-entry-in { animation: townEntryIn var(--dur-move) var(--ease-out-quart); }
        }
      `}</style>
    </div>
  )
}
