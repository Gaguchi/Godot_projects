/**
 * ui/filigree/kit.tsx — the Filigree kit's pieces as React (owner 2026-10-24: walnut and brass over the pixel world).
 *
 * The stylesheet is the kit's own, generated from tools/pxworld (`styles/filigree-kit.css`); it draws a control's
 * hover, press and focus as CLASSES (`hov`, `prs`, `foc`, `dis`), because the boards it was designed on are still
 * pictures. `useKitState` sets those classes from the real pointer and keyboard, so a control here is the board's
 * control, pixel for pixel, with no second copy of its rules.
 *
 * A window's children are placed from the window's own top-left, frame included, as on the boards. A window given
 * no height is sized by its body (`fw--flow`).
 */
import React, { useMemo, useState } from 'react'
import '../../styles/filigree-kit.css'
import '../../styles/filigree.css'

export interface KitState {
  readonly cls: string
  readonly hovered: boolean
  readonly handlers: {
    readonly onPointerEnter: () => void
    readonly onPointerLeave: () => void
    readonly onPointerDown: () => void
    readonly onPointerUp: () => void
    readonly onFocus: (e: React.FocusEvent) => void
    readonly onBlur: () => void
  }
}

export function useKitState(disabled = false): KitState {
  const [hov, setHov] = useState(false)
  const [prs, setPrs] = useState(false)
  const [foc, setFoc] = useState(false)
  const handlers = useMemo(() => ({
    onPointerEnter: () => setHov(true),
    onPointerLeave: () => { setHov(false); setPrs(false) },
    onPointerDown: () => setPrs(true),
    onPointerUp: () => setPrs(false),
    // the ring is for the keyboard: a click focuses too, and must not leave a ring behind it
    onFocus: (e: React.FocusEvent) => setFoc((e.target as HTMLElement).matches(':focus-visible')),
    onBlur: () => setFoc(false),
  }), [])
  const cls = disabled ? `dis${foc ? ' foc' : ''}` : [prs ? 'prs' : hov ? 'hov' : '', foc ? 'foc' : ''].filter((c) => c !== '').join(' ')
  return { cls, hovered: hov, handlers }
}

export type WinKind = 'win' | 'lit' | 'tag' | 'taglit'

interface WinProps {
  readonly x: number
  readonly y: number
  readonly w: number
  /** Omit for a window sized by its body. */
  readonly h?: number
  readonly kind?: WinKind
  readonly className?: string
  readonly style?: React.CSSProperties
  readonly testId?: string
  readonly role?: string
  readonly label?: string
  readonly children?: React.ReactNode
}

export function Win({ x, y, w, h, kind = 'win', className = '', style, testId, role, label, children }: WinProps): React.JSX.Element {
  const flow = h === undefined
  const cls = ['fw', kind === 'win' ? '' : `fw--${kind}`, flow ? 'fw--flow' : '', className].filter((c) => c !== '').join(' ')
  return (
    <div className={cls} style={{ left: x, top: y, width: w, ...(flow ? {} : { height: h }), ...style }} data-testid={testId} role={role} aria-label={label}>
      {flow ? <div className="fw__body">{children}</div> : children}
    </div>
  )
}

interface FBtnProps {
  readonly children: React.ReactNode
  readonly onPress?: () => void
  readonly variant?: 'primary' | 'secondary' | 'danger'
  /** A refused control stays on the glass and says why (BRIEF §5): the reason is the tip. */
  readonly disabledReason?: string | null
  readonly testId?: string
  readonly autoFocus?: boolean
  readonly style?: React.CSSProperties
}

export function FBtn({ children, onPress, variant = 'secondary', disabledReason = null, testId, autoFocus, style }: FBtnProps): React.JSX.Element {
  const disabled = disabledReason !== null
  const k = useKitState(disabled)
  const kind = variant === 'primary' ? ' pri' : variant === 'danger' ? ' dgr' : ''
  return (
    <span className="fbtn" style={style}>
      <button
        type="button"
        className={`btn${kind}${k.cls === '' ? '' : ` ${k.cls}`}`}
        aria-disabled={disabled || undefined}
        data-reason={disabled ? disabledReason : undefined}
        data-testid={testId}
        autoFocus={autoFocus}
        onClick={() => { if (!disabled) onPress?.() }}
        style={disabled ? { cursor: 'default' } : undefined}
        {...k.handlers}
      >
        {children}
      </button>
      {disabled && k.hovered && <span className="tip refuse" role="tooltip">{disabledReason}</span>}
    </span>
  )
}

interface FCmdProps {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly label: string
  readonly note?: React.ReactNode
  /** Where the note starts, from the row's left. */
  readonly noteX?: number
  readonly onPress: () => void
  readonly testId?: string
}

/** A command row: the whole row is the control, the label lights and takes the pointer mark. */
export function FCmd({ x, y, w, h, label, note, noteX = 154, onPress, testId }: FCmdProps): React.JSX.Element {
  const k = useKitState()
  return (
    <button type="button" className="fcmd" style={{ left: x, top: y, width: w, height: h }} data-testid={testId} onClick={onPress} {...k.handlers}>
      <span className={`cmd abs${k.cls === '' ? '' : ` ${k.cls}`}`} style={{ left: -4, top: Math.round((h - 22) / 2) }}>{label}</span>
      {note !== undefined && <span className="abs s13 dim nowrap" style={{ left: noteX, top: Math.round((h - 16) / 2) + 1 }}>{note}</span>}
    </button>
  )
}

export function Key({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <span className="key">{children}</span>
}

/** A kit icon at 1:1, set into a line of text. */
export function FIcon({ name, w = 24, h = 24, style }: { readonly name: string; readonly w?: number; readonly h?: number; readonly style?: React.CSSProperties }): React.JSX.Element {
  return <img className="ficon" src={`/art/ui/icon_${name}.png`} width={w} height={h} alt="" draggable={false} style={style} />
}

/** A face behind the brass lip. `src` is art already at the stage's pixel size (`imgW` wide); `dx, dy` seat the head.
 *  The art is the niche's own ground, cropped by it: nothing of it ever reaches past the frame. */
export function Niche({ x, y, size = 52, src, dx, dy, imgW }: { readonly x: number; readonly y: number; readonly size?: number; readonly src: string | null; readonly dx: number; readonly dy: number; readonly imgW: number }): React.JSX.Element {
  const artStyle: React.CSSProperties = src === null ? {} : { backgroundImage: `url('${src}')`, backgroundSize: `${imgW}px auto`, backgroundPosition: `${-dx + 4}px ${-dy + 4}px`, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' }
  return <div className="fniche" style={{ left: x, top: y, width: size, height: size, ...artStyle }} />
}
