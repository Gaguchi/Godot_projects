/**
 * ui/components/CheckTag.tsx — the badge on a choice that ASKS for something: what it asks (a stat and its
 * threshold, a class, gold, food), who in the company answers it best, and whether they clear it.
 *
 * ONE component, because the talk box and the road-event card render the same badge and each carried its own
 * copy of it — including a copy each of a literal `✓` / `✗`, which is a Dingbat served from whatever fallback
 * face the machine happens to have, at whatever weight that face draws it (RE-GATE B 2.8; BRIEF §5 "one
 * inline-SVG set"). The verdict is now drawn in the project's one hand, in the badge's own colour and size.
 */
import React from 'react'
import { Icon } from './Icon'

export function CheckTag({ text, ok }: {
  readonly text: string
  /** true = the company clears it, false = it falls short, null = it is a cost, not a test. */
  readonly ok: boolean | null
}): React.JSX.Element {
  const tone = ok === true ? ' talk__tag--ok' : ok === false ? ' talk__tag--risk' : ''
  return (
    <span className={`talk__tag${tone}`} data-ok={ok === null ? undefined : ok ? 'yes' : 'no'}>
      {text}
      {ok !== null && <Icon name={ok ? 'check' : 'cross'} size={11} title={ok ? 'within reach' : 'falls short'} />}
    </span>
  )
}
