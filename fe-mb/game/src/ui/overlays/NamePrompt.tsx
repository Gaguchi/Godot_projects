/**
 * ui/overlays/NamePrompt.tsx — the name slip (board F64Name; brief §2.16): the foundling's name for the register, or
 * the company's for its banner. One field, one button. The reason a name is refused is `run/naming.ts`'s own
 * sentence (through the flow gate), printed under the field the moment it applies, and Set stays dark until the name
 * can be taken. There is no way round it: the prompt is a beat of the story, not a setting.
 */
import React, { useCallback, useState } from 'react'
import { spriteIdFor } from '../../content/index'
import { overlayOf } from '../../engine/flow/pump'
import type { GameState } from '../../engine/types'
import { FBtn, Modal, Niche, faceArt } from '../filigree/kit'
import { dispatch, useGame, useLegal } from '../store'

const MW = 572
const PAD = 20

export function NamePrompt(): React.JSX.Element | null {
  const v = useGame(useCallback((s: GameState) => {
    const o = overlayOf(s)
    if (o?.kind !== 'namePrompt') return null
    const mc = s.run?.party['mc']
    return { target: o.prompt.target, sprite: mc === undefined ? null : spriteIdFor(mc.id, mc.classId) }
  }, []), (a, b) => a?.target === b?.target && a?.sprite === b?.sprite)
  const [name, setName] = useState('')
  const [focused, setFocused] = useState(false)
  const legal = useLegal({ type: 'name/submit', name })
  if (v === null) return null
  const mc = v.target === 'mc'
  const submit = (): void => { if (legal.ok) { dispatch({ type: 'name/submit', name: name.trim() }); setName('') } }
  // the foundling's face sits beside the field; the company has no one face, so its field takes the width
  const fx = mc ? PAD + 104 + 20 : PAD
  const fw = MW - fx - PAD - 12 - 72
  const refused = !legal.ok && name.trim() !== ''
  return (
    <Modal w={MW} h={mc ? 232 : 214} eyebrow={mc ? 'The foundling' : 'The company'} heading={mc ? 'What do they call you?' : 'What will the company be called?'} testId="name-prompt">
      <div className="frule" style={{ left: PAD, top: 83, width: MW - 2 * PAD }} />
      {mc && <Niche x={PAD} y={104} size={104} {...faceArt(v.sprite, 104)} />}
      <div className="s14 lt dim nowrap" style={{ left: fx, top: 108 }}>{mc ? 'A name for the register.' : 'A name for the banner.'}</div>
      <form style={{ left: 0, top: 0 }} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <input
          className={`inp${focused ? ' foc' : ''}${refused ? ' bad' : ''}`}
          style={{ left: fx, top: 134, width: fw }}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={24}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={mc ? 'a name' : 'a banner'}
          aria-label={mc ? 'your name' : 'the company’s name'}
          data-testid="name-input"
        />
      </form>
      <div className={refused ? 'why' : 's13 dim nowrap'} style={{ left: fx, top: 182 }} data-testid="name-why">{legal.ok ? ' ' : refused ? legal.reason : ' '}</div>
      <FBtn variant="primary" w={72} disabledReason={legal.ok ? null : legal.reason} onPress={submit} testId="name-submit" style={{ position: 'absolute', left: fx + fw + 12, top: 137 }}>Set</FBtn>
    </Modal>
  )
}
