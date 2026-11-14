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
import { useTip } from '../components/Tooltip'
import faces from './faces.json'

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
  /** A set width, for a button that spans its window or pairs with another. */
  readonly w?: number
}

export function FBtn({ children, onPress, variant = 'secondary', disabledReason = null, testId, autoFocus, style, w }: FBtnProps): React.JSX.Element {
  const disabled = disabledReason !== null
  const k = useKitState(disabled)
  // the reason is spoken by the game's ONE reason surface (`components/Tooltip`): hover and focus, one bubble at a time
  const { tipRef, tipProps, tip } = useTip(disabled ? disabledReason : null)
  const kind = variant === 'primary' ? ' pri' : variant === 'danger' ? ' dgr' : ''
  return (
    <span className="fbtn" style={style}>
      <button
        type="button"
        className={`btn${kind}${k.cls === '' ? '' : ` ${k.cls}`}`}
        ref={tipRef}
        aria-disabled={disabled || undefined}
        aria-describedby={tipProps['aria-describedby']}
        data-reason={tipProps['data-reason']}
        data-testid={testId}
        autoFocus={autoFocus}
        onClick={() => { if (!disabled) onPress?.() }}
        style={{ ...(disabled ? { cursor: 'default' } : {}), ...(w !== undefined ? { width: w, padding: 0, textAlign: 'center' as const } : {}) }}
        onPointerEnter={() => { k.handlers.onPointerEnter(); tipProps.onPointerEnter() }}
        onPointerLeave={() => { k.handlers.onPointerLeave(); tipProps.onPointerLeave() }}
        onPointerDown={k.handlers.onPointerDown}
        onPointerUp={k.handlers.onPointerUp}
        onFocus={(e) => { k.handlers.onFocus(e); tipProps.onFocus() }}
        onBlur={() => { k.handlers.onBlur(); tipProps.onBlur() }}
      >
        {children}
      </button>
      {tip}
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
export function Niche({ x, y, size = 52, src, dx, dy, imgW, children }: { readonly x: number; readonly y: number; readonly size?: number; readonly src: string | null; readonly dx: number; readonly dy: number; readonly imgW: number; readonly children?: React.ReactNode }): React.JSX.Element {
  const artStyle: React.CSSProperties = src === null ? {} : { backgroundImage: `url('${src}')`, backgroundSize: `${imgW}px auto`, backgroundPosition: `${-dx + 4}px ${-dy + 4}px`, backgroundRepeat: 'no-repeat', imageRendering: 'pixelated' }
  // children sit under the brass lip (the lip is the niche's ::after), so a layer that fades in never paints over it
  return <div className="fniche" style={{ left: x, top: y, width: size, height: size, ...artStyle }}>{children}</div>
}

/** The satchel's food as pips, in fours (a ration is four): lit for what is held, never fewer than eight seats. */
export function Pips({ on }: { readonly on: number }): React.JSX.Element {
  const total = Math.max(8, Math.ceil(on / 4) * 4)
  return (
    <>
      {Array.from({ length: total }, (_, i) => <i key={i} className={`fpip${i < on ? '' : ' fpip--off'}${i % 4 === 3 && i !== total - 1 ? ' fpip--gap' : ''}`} />)}
    </>
  )
}

/** A plate laid on the world under a place, centred on `cx` (the kit's `.plate`; `lit` = the one pointed at). */
export function Plate({ cx, y, lit = false, children }: { readonly cx: number; readonly y: number; readonly lit?: boolean; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fplate" style={{ left: cx - 160, top: y }}>
      <span className={`plate${lit ? ' lit' : ''}`}>{children}</span>
    </div>
  )
}

/** The bracket cursor round what the pointer rests on. */
export function Brackets({ x, y, w, h }: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): React.JSX.Element {
  return <div className="fbrackets" style={{ left: x, top: y, width: w, height: h }} aria-hidden />
}

/** The brass leader from a window's foot down to the brackets. `x` is its centre. */
export function Leader({ x, y0, y1 }: { readonly x: number; readonly y0: number; readonly y1: number }): React.JSX.Element | null {
  return y1 - y0 < 6 ? null : <div className="fleader" style={{ left: x - 2, top: y0, height: y1 - y0 }} aria-hidden />
}

interface FChoiceProps {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h?: number
  /** The number key that takes it; none for a row the list does not number (a way back with its own key). */
  readonly n?: number | string
  readonly label: string
  /** A second, quieter line under the label. */
  readonly sub?: string
  /** Set by the screen when the same choice is pointed at somewhere else (its building in the square). */
  readonly lit?: boolean
  readonly disabledReason?: string | null
  readonly onPress: () => void
  readonly onHover?: (on: boolean) => void
  readonly testId?: string
  readonly keyHint?: string
  /** What the choice asks of the company (a check), after the line: `ok` says whether someone meets it. */
  readonly tag?: string
  readonly tagOk?: boolean | null
}

/** One numbered choice in a list: its key, the line, the brass pointer when it is the one pointed at. */
export function FChoice({ x, y, w, h = 32, n, label, sub, lit = false, disabledReason = null, onPress, onHover, testId, keyHint, tag, tagOk = null }: FChoiceProps): React.JSX.Element {
  const disabled = disabledReason !== null
  const k = useKitState(disabled)
  const on = !disabled && (lit || k.hovered)
  return (
    <button
      type="button"
      className={`row fchoice${on ? ' hov' : ''}${k.cls.includes('foc') ? ' foc-ring' : ''}`}
      style={{ left: x, top: y, width: w, height: h, cursor: disabled ? 'default' : 'pointer' }}
      aria-disabled={disabled || undefined}
      data-reason={disabled ? disabledReason : undefined}
      data-testid={testId}
      onClick={() => { if (!disabled) onPress() }}
      {...k.handlers}
      onPointerEnter={() => { k.handlers.onPointerEnter(); onHover?.(true) }}
      onPointerLeave={() => { k.handlers.onPointerLeave(); onHover?.(false) }}
      onFocus={(e) => { k.handlers.onFocus(e); onHover?.(true) }}
      onBlur={() => { k.handlers.onBlur(); onHover?.(false) }}
    >
      <span className="abs nowrap" style={{ left: 8, top: sub !== undefined || disabled ? 5 : Math.round((h - 22) / 2), lineHeight: '22px' }}>
        {n !== undefined && <span className={`key${disabled ? ' off' : ''}`}>{n}</span>}
        <span className={`s16 ${disabled ? 'faint' : on ? 'straw' : 'bone'}`} style={{ marginLeft: n === undefined ? 0 : 10 }}>{label}</span>
        {/* what the answer asks of the company: the kit's badge, its verdict DRAWN as well as coloured (BRIEF §5 rule 4) */}
        {tag !== undefined && (
          <span className={`chk${tagOk === true ? ' ok' : tagOk === false ? ' no' : ''}`} data-ok={tagOk === null ? undefined : tagOk ? 'yes' : 'no'}>
            {tag}{tagOk !== null && <img src={`/art/ui/mark_${tagOk ? 'ok' : 'no'}.png`} alt={tagOk ? ', within reach' : ', falls short'} draggable={false} />}
          </span>
        )}
      </span>
      {(sub !== undefined || disabled) && <span className={disabled ? 'why abs' : 'abs s13 dim nowrap'} style={{ left: 41, top: 25 }}>{disabled ? disabledReason : sub}</span>}
      {keyHint !== undefined && <span className="abs nowrap" style={{ right: 6, top: 6 }}><span className="key">{keyHint}</span></span>}
      {on && <img className="abs" src="/art/ui/row_arrow.png" alt="" draggable={false} style={{ left: -14, top: 11 }} />}
    </button>
  )
}

/** A section's own heading inside a window: ochre, a note at the right, a groove under both. */
export function SectionHead({ x, y, w, heading, note }: { readonly x: number; readonly y: number; readonly w: number; readonly heading: string; readonly note?: string }): React.JSX.Element {
  return (
    <>
      <div className="s16 ochre nowrap" style={{ left: x, top: y }}>{heading}</div>
      {note !== undefined && <div className="s13 dim nowrap" style={{ left: x, top: y + 3, width: w, textAlign: 'right' }}>{note}</div>}
      <div className="fgroove" style={{ left: x, top: y + 23, width: w }} />
    </>
  )
}

const GLYPH: Readonly<Record<string, string>> = { '→': 'to', '/': 'slash', '-': 'dash', '+': 'plus' }

/** The kit's cast numerals (tools/pxworld `numeral`, 22 px ochre), set glyph by glyph at 1:1: a number that matters. */
export function Numeral({ text, label }: { readonly text: string; readonly label?: string }): React.JSX.Element {
  return (
    <span className="fnum" role="img" aria-label={label ?? text}>
      {[...text].map((ch, i) => (ch === ' ' ? <i key={i} className="fnum__gap" /> : <img key={i} src={`/art/ui/num_${GLYPH[ch] ?? ch}.png`} alt="" draggable={false} />))}
    </span>
  )
}

/** A gauge with a heal preview: what a bed would mend is the dithered run after the fill. */
export function Gauge({ x, y, w, h = 7, value, max, gain = 0 }: { readonly x: number; readonly y: number; readonly w: number; readonly h?: number; readonly value: number; readonly max: number; readonly gain?: number }): React.JSX.Element {
  const inner = w - 2
  const keep = max <= 0 ? 0 : Math.round((inner * Math.max(0, value)) / max)
  const more = max <= 0 ? 0 : Math.round((inner * Math.min(gain, max - value)) / max)
  return (
    <div className={`fbar${h === 9 ? ' fbar--tall' : ''}`} style={{ left: x, top: y, width: w }} aria-hidden>
      <i style={{ width: keep }} />
      {more > 0 && <b style={{ left: 1 + keep, width: more }} />}
    </div>
  )
}

/** A board sprite standing in a room at 1:1, on its contact shadow, with the kit's ink edge. `foot` is in the sprite. */
export function Stand({ sprite, x, y, foot }: { readonly sprite: string; readonly x: number; readonly y: number; readonly foot: readonly [number, number] }): React.JSX.Element {
  return (
    <>
      <i className="fstand__shadow" style={{ left: x - 30, top: y - 5 }} aria-hidden />
      <img className="fstand" src={`/sprites/units/board/${sprite}.png`} width={104} height={152} alt="" draggable={false} style={{ left: x - foot[0], top: y - foot[1] }} />
    </>
  )
}

/** The face crops at stage scale (`public/sprites/faces/`, 96 px): the head's seat in a 52 px niche, per sprite.
 *  GENERATED with the crops by `tools/pxworld/src/px-popups/export_game.py`; a new sprite gets its face there. */
const FACE = faces as unknown as Readonly<Record<string, readonly [number, number] | undefined>>

/** What a `Niche` of `size` shows for a sprite: its face crop where the game has one, else its full art seated on the head. */
export function faceArt(sprite: string | null, size = 52): { readonly src: string | null; readonly dx: number; readonly dy: number; readonly imgW: number } {
  if (sprite === null) return { src: null, dx: 0, dy: 0, imgW: 0 }
  // a small niche shows the same crop at half size (a whole-number step down); the others keep the art at 1:1
  const k = size <= 34 ? 0.5 : 1
  const pad = (52 - size) / 2
  const seat = FACE[sprite]
  // a niche as large as the crop shows the whole crop
  if (seat !== undefined && size >= 100) return { src: `/sprites/faces/${sprite}.png`, dx: 0, dy: 0, imgW: 96 }
  if (seat !== undefined) return { src: `/sprites/faces/${sprite}.png`, dx: Math.round((seat[0] - 4) * k + 4 + (k === 1 ? pad : 0)), dy: Math.round((seat[1] - 4) * k + 4 + (k === 1 ? pad : 0)), imgW: 96 * k }
  return { src: `/sprites/units/${sprite}.png`, dx: Math.round(112 * k + 4 + (k === 1 ? pad : 0)), dy: Math.round(36 * k + 4 + (k === 1 ? pad : 0)), imgW: Math.round(277 * k) }
}

interface ModalProps {
  readonly w: number
  /** Omit for a window sized by its body. */
  readonly h?: number
  readonly eyebrow?: string
  readonly heading?: string
  /** A quiet line at the head's right: where and when. */
  readonly note?: string
  /** On the layer (scrim and window): what the tests and the Esc handler find. */
  readonly testId?: string
  /** On the window itself. */
  readonly pageTestId?: string
  readonly onScrim?: () => void
  readonly children?: React.ReactNode
}

/**
 * A pop-up over whatever screen is up: one flat ink scrim (no blur, no vignette), then a window in the middle of the
 * stage with an eyebrow and a Jacquard title. It carries its own `.f64` root, because the modal layer sits outside
 * every screen; the world under it stays as the player left it.
 */
export function Modal({ w, h, eyebrow, heading, note, testId, pageTestId, onScrim, children }: ModalProps): React.JSX.Element {
  const flow = h === undefined
  const head = (
    <>
      {eyebrow !== undefined && <div className={`s13 dim nowrap${flow ? '' : ' abs'}`} style={flow ? undefined : { left: 20, top: 14 }}>{eyebrow}</div>}
      {heading !== undefined && <div className={`tt${flow ? '' : ' abs'}`} style={flow ? { marginTop: 2 } : { left: 20, top: eyebrow !== undefined ? 32 : 12 }} data-testid="modal-heading">{heading}</div>}
      {note !== undefined && <div className="abs s13 dim nowrap" style={{ right: 20, top: 14 }}>{note}</div>}
    </>
  )
  return (
    <div className="f64 fmodal" data-testid={testId}>
      <div className="fmodal__scrim" onClick={onScrim} />
      {flow
        ? <div className="fmodal__seat"><Win x={0} y={0} w={w} className="fmodal__win" {...(pageTestId !== undefined ? { testId: pageTestId } : {})}>{head}{children}</Win></div>
        : <Win x={Math.round((1280 - w) / 2)} y={Math.round((720 - h) / 2)} w={w} h={h} {...(pageTestId !== undefined ? { testId: pageTestId } : {})}>{head}{children}</Win>}
    </div>
  )
}

/** A two-state setting (Sound: on). The knob's side carries the state and the word beside it says it again. */
export function FSwitch({ x, y, w, label, on, onToggle, testId }: { readonly x: number; readonly y: number; readonly w: number; readonly label: string; readonly on: boolean; readonly onToggle: () => void; readonly testId?: string }): React.JSX.Element {
  const k = useKitState()
  return (
    <button type="button" role="switch" aria-checked={on} className={`fswitch${k.cls.includes('foc') ? ' foc-ring' : ''}`} style={{ left: x, top: y, width: w }} onClick={onToggle} data-testid={testId} {...k.handlers}>
      <span className="abs s16 bone nowrap" style={{ left: 0, top: 0 }}>{label}</span>
      <span className={`abs s14 nowrap ${on ? 'meadow' : 'dim'}`} style={{ right: 46, top: 1 }}>{on ? 'on' : 'off'}</span>
      <img className="abs" src={`/art/ui/switch_${on ? 'on' : 'off'}${k.hovered ? '_hov' : ''}.png`} width={36} height={18} alt="" draggable={false} style={{ right: 0, top: 0 }} />
    </button>
  )
}
