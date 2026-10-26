/**
 * ui/components/Tooltip.tsx — the on-glass reason surface (ARCHITECTURE §3 has always listed a
 * `components/Tooltip`; until now it did not exist and every disabled-with-reason in the game was delivered as a
 * native `title=""`).
 *
 * A refusal is CONTENT — the one sentence that tells the player what to change — so it may not be handed to the
 * browser's own chrome. `title=` is unstyled and unthemed, arrives about a second late, disappears on a keypress,
 * is unreachable from the keyboard, and does not scale with the stage; four of the gate's severe findings were the
 * same sentence hiding inside one.
 *
 * `useTip(text)` gives an element three things: a ref, the hover/focus handlers, and the bubble to render beside
 * it. The bubble portals into `#game-stage`, so it scales, clips and letterboxes with the game like every other
 * surface, and is clamped inside the 1280×720 sheet rather than the window. Focus opens it, so a control reached
 * by Tab speaks its reason exactly as a hovered one does, and `aria-describedby` points at it while it is up.
 *
 * The anchor also carries `data-reason` whenever the text is a refusal. THAT is the string the tests read: the
 * sentence a control refuses with is a contract; where the pixels land is not.
 *
 * One bubble at a time — a hover claims the surface from a focused control and vice versa, the same
 * one-suspender rule the overlays follow.
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clientToStage, stagePortalContainer } from '../StageView'
import { STAGE_W } from '../stage'

/** Gap between the anchor and the bubble, and the margin the bubble keeps from the edge of the sheet. */
const GAP = 7
const PAD = 8

// ── the single open bubble ────────────────────────────────────────────────
type Listener = (id: string | null) => void
const listeners = new Set<Listener>()
let current: string | null = null
function claim(id: string | null): void {
  current = id
  for (const l of listeners) l(current)
}

export interface TipHandle {
  /** Put this on the element the bubble points at. */
  readonly tipRef: (el: HTMLElement | null) => void
  /** Spread this on the same element. */
  readonly tipProps: {
    readonly onPointerEnter: () => void
    readonly onPointerLeave: () => void
    readonly onFocus: () => void
    readonly onBlur: () => void
    readonly 'aria-describedby': string | undefined
    readonly 'data-reason': string | undefined
  }
  /** Render this as a sibling — it portals itself onto the stage. */
  readonly tip: React.ReactNode
}

/**
 * @param text  what the bubble says; `null` disables it entirely (no listeners, no node).
 * @param isReason  true for a refusal (oxblood hairline + `data-reason`), false for a plain note such as a
 *                  name that would otherwise have nowhere to be read.
 */
export function useTip(text: string | null, isReason = true): TipHandle {
  const id = useId()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLElement | null>(null)
  const tipRef = useCallback((el: HTMLElement | null) => { anchor.current = el }, [])

  useEffect(() => {
    const l: Listener = (cur) => { if (cur !== id) setOpen(false) }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      if (current === id) claim(null)
    }
  }, [id])

  const show = useCallback(() => { if (text !== null) { claim(id); setOpen(true) } }, [id, text])
  const hide = useCallback(() => { setOpen(false); if (current === id) claim(null) }, [id])

  const live = open && text !== null
  return {
    tipRef,
    tipProps: {
      onPointerEnter: show,
      onPointerLeave: hide,
      onFocus: show,
      onBlur: hide,
      'aria-describedby': live ? id : undefined,
      'data-reason': isReason && text !== null ? text : undefined,
    },
    tip: live ? <TipBubble id={id} text={text} anchor={anchor} isReason={isReason} /> : null,
  }
}

function TipBubble({ id, text, anchor, isReason }: {
  readonly id: string
  readonly text: string
  readonly anchor: React.RefObject<HTMLElement | null>
  readonly isReason: boolean
}): React.JSX.Element | null {
  const box = useRef<HTMLDivElement | null>(null)
  const [at, setAt] = useState<{ readonly x: number; readonly y: number } | null>(null)
  useLayoutEffect(() => {
    const el = anchor.current
    const bubble = box.current
    if (el === null || bubble === null) return
    const r = el.getBoundingClientRect()
    const tl = clientToStage(r.left, r.top)
    const br = clientToStage(r.right, r.bottom)
    if (tl === null || br === null) return
    const w = bubble.offsetWidth
    const h = bubble.offsetHeight
    // above by default; below when the anchor sits against the top of the sheet
    const above = tl.y - GAP - h >= PAD
    setAt({
      x: Math.min(Math.max((tl.x + br.x) / 2, PAD + w / 2), STAGE_W - PAD - w / 2),
      y: above ? tl.y - GAP - h : br.y + GAP,
    })
  }, [anchor, text])
  const host = stagePortalContainer()
  if (host === undefined) return null
  return createPortal(
    <div
      ref={box}
      id={id}
      role="tooltip"
      className={`tip${isReason ? ' tip--reason' : ''}`}
      style={{ left: at?.x ?? 0, top: at?.y ?? 0, visibility: at === null ? 'hidden' : 'visible' }}
    >
      {text}
    </div>,
    host,
  )
}
