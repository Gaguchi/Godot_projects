/**
 * ui/components/LedgerPage.tsx — the ONE linen page kit (crafting-game-ui project-hooks: "build ONE <LedgerPage>
 * instead of the six copies"). A sheet pinned to the camp table: 168° linen gradient, feint ruling every 30px, a
 * double margin rule, four brass pins in the corners. Information you READ lives on it (canvas = read); the one
 * leather primary on the page is the thing you ACT on.
 */
import React from 'react'

export interface LedgerPageProps {
  readonly children: React.ReactNode
  /** Sheet width on the 1280 stage (the title uses 820 so the table shows either side). */
  readonly width?: number
  readonly height?: number
  /** Pass INSTEAD of `height` for a sheet that should be as tall as what is written on it, and no taller: the
   *  page takes `height: auto` with this as its floor. A fixed height on a page whose lists grow (the Field
   *  Report's party and loot, the quest log's contracts) is what leaves a third of the sheet ruled and empty at
   *  small content and clips it at large (GATE2-16). */
  readonly minHeight?: number
  readonly className?: string
  readonly testId?: string
}

const PIN: React.CSSProperties = {
  position: 'absolute',
  width: 8,
  height: 8,
  borderRadius: 9999,
  background: 'var(--brass-fill)',
  boxShadow: '0 1px 1px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(0,0,0,0.35)',
}

export function LedgerPage({ children, width = 820, height = 668, minHeight, className = '', testId }: LedgerPageProps): React.JSX.Element {
  return (
    <section
      className={`page-canvas ${className}`}
      data-testid={testId}
      style={{
        position: 'relative',
        width,
        ...(minHeight === undefined ? { height } : { height: 'auto', minHeight }),
        // NOTE: the centring margin lives in `styles/index.css` (`.page-canvas`), not here — an inline style
        // cannot be overridden by a stylesheet, and the Field Report needs its sheet on the right of the table.
        background:
          'repeating-linear-gradient(180deg, transparent 0 29px, rgba(42,33,25,0.09) 29px 30px), linear-gradient(168deg, var(--canvas-lit) 0%, var(--canvas-base) 42%, var(--canvas-mid) 100%)',
        boxShadow: 'var(--elevation-raised), inset 0 0 0 1px rgba(255,252,244,0.5)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {/* double margin rule */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 26, width: 1, background: 'var(--canvas-rule)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 30, width: 1, background: 'var(--canvas-rule)', opacity: 0.6 }} />
      <div style={{ ...PIN, top: 12, left: 12 }} />
      <div style={{ ...PIN, top: 12, right: 12 }} />
      <div style={{ ...PIN, bottom: 12, left: 12 }} />
      <div style={{ ...PIN, bottom: 12, right: 12 }} />
      <div style={{ position: 'relative', padding: '40px 56px 40px 64px', height: '100%', boxSizing: 'border-box' }}>{children}</div>
    </section>
  )
}

/** A walnut ink rule with optional brass corner brackets — the title's heading furniture. */
export function InkRule({ brackets = false }: { readonly brackets?: boolean }): React.JSX.Element {
  return (
    <div style={{ position: 'relative', height: 1, background: 'var(--color-ink)', opacity: 0.75, margin: '10px 0' }}>
      {brackets && (
        <>
          <span style={{ position: 'absolute', left: -14, top: -6, width: 10, height: 12, borderLeft: '2px solid var(--iron-edge)', borderTop: '2px solid var(--iron-edge)' }} />
          <span style={{ position: 'absolute', right: -14, top: -6, width: 10, height: 12, borderRight: '2px solid var(--iron-edge)', borderTop: '2px solid var(--iron-edge)' }} />
        </>
      )}
    </div>
  )
}
