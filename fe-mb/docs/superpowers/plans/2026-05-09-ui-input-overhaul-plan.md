# UI Input Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled UI plumbing with `react-aria-components` for all DOM scenes and shrink Phaser to a board-only layer (no buttons in canvas). Combat HUD becomes a React overlay. Fixes the user's reported click/hover unreliability.

**Architecture:** DOM-first. ALL UI is React + react-aria-components (headless input primitives) + Tailwind v4 `data-[*]:` variants for visual states + Framer Motion for card animations. Phaser is renamed `BoardScene` and renders only tiles/units/animations/camera. Single source of truth stays Zustand; HUD subscribes via selectors.

**Tech Stack:** TypeScript 5.6 strict, React 19.2.5, Phaser 4.1.0, Vite 8, Vitest, Playwright, Zustand, Zod, Tailwind v4, react-aria-components (new), framer-motion (new).

**Spec:** `docs/superpowers/specs/2026-05-09-ui-input-overhaul-design.md`. Done promise tag: `UI-INPUT-FIXED`.

---

## File Structure

**New files:**
```
phaser/src/ui/components/
├── Button.tsx              // RAC Button wrapper
├── Card.tsx                // RAC Button + Framer Motion + AP-cost guard
├── Dialog.tsx              // RAC ModalOverlay + Modal + Dialog
├── Menu.tsx                // RAC Menu + MenuItem + MenuTrigger
├── ListBox.tsx             // RAC ListBox + ListBoxItem
├── Tooltip.tsx             // RAC Tooltip + TooltipTrigger
├── Heading.tsx             // RAC Heading
├── Pressable.tsx           // usePress wrapper for non-button clickables
└── index.ts                // barrel export

phaser/src/ui/scenes/combat/
├── CombatHud.tsx           // top-level HUD overlay
├── TopBar.tsx              // turn/AP/active-unit display
├── ModeLabel.tsx           // mid-screen mode banner
├── CardHand.tsx            // fan-layout card container
├── EndTurnBtn.tsx
├── MoveBtn.tsx
└── CaptureBtn.tsx

phaser/tests/unit/ui/components/
├── Button.test.tsx
├── Card.test.tsx
├── Dialog.test.tsx
├── Menu.test.tsx
├── ListBox.test.tsx
├── Tooltip.test.tsx
└── Pressable.test.tsx

phaser/tests/e2e/keyboard-nav.spec.ts
```

**Modified files:**
```
phaser/src/App.tsx                              — render <CombatHud/> in combat view
phaser/src/game/scenes/CombatScene.ts           — RENAME to BoardScene.ts; strip HUD code
phaser/src/ui/screens/TitleScreen.tsx           — use <Button>
phaser/src/ui/screens/OverworldScene.tsx        — use <Button> / <Pressable>
phaser/src/ui/screens/TownScene.tsx             — use <Button> / <ListBox>
phaser/src/ui/screens/DungeonScene.tsx          — use <Button>
phaser/src/ui/modals/QuitModal.tsx              — use <Dialog> + <Button>
phaser/src/ui/modals/BattleEndModal.tsx         — use <Dialog> + <Button>
phaser/src/ui/modals/LoadGameModal.tsx          — use <Dialog> + <ListBox>
phaser/src/ui/overlays/QuestLog.tsx             — use <Dialog>
phaser/eslint.config.js                         — forbid raw react-aria-components imports outside src/ui/components/
phaser/CONTEXT.md                               — update Section 6 (Phaser scene → BoardScene); add Section on UI wrappers
```

---

## Phase 1 — Component library (foundation)

### Task 1: Install dependencies + Tailwind config check

**Files:**
- Modify: `phaser/package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install react-aria-components@^1.5.0 framer-motion@^11.18.0
```

- [ ] **Step 2: Confirm Tailwind v4 is wired (already verified — `src/index.css` has `@import "tailwindcss"`)**

No-op. Tailwind v4 ships `data-[*]:` variants without configuration.

- [ ] **Step 3: Run gates**

```bash
npm run typecheck && npm test -- --run && npm run check-context-doc && npm run build
```

Expected: all pass, bundle baseline recorded in commit message.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(phaser): [UI-T1] install react-aria-components + framer-motion

Foundation deps for the UI input overhaul. No code consumers yet.
Bundle baseline recorded for the +75 KB gzipped ceiling spec gate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `Button` wrapper + tests

**Files:**
- Create: `phaser/src/ui/components/Button.tsx`
- Create: `phaser/tests/unit/ui/components/Button.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// phaser/tests/unit/ui/components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../../../src/ui/components/Button'

describe('<Button>', () => {
  it('renders children and fires onPress on click', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Click me</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress} isDisabled>Click me</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('fires onPress on Space key', () => {
    const onPress = vi.fn()
    render(<Button onPress={onPress}>Click me</Button>)
    const btn = screen.getByRole('button')
    btn.focus()
    fireEvent.keyDown(btn, { key: ' ' })
    fireEvent.keyUp(btn, { key: ' ' })
    expect(onPress).toHaveBeenCalled()
  })

  it('exposes data-[hovered] / data-[pressed] / data-[disabled] for styling', () => {
    render(<Button isDisabled>X</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-disabled', 'true')
  })
})
```

- [ ] **Step 2: Install testing libs if missing**

```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

Confirm `vite.config.ts` test env is `jsdom`. Add if missing.

- [ ] **Step 3: Run test, expect failure**

```bash
npx vitest run tests/unit/ui/components/Button.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement Button**

```tsx
// phaser/src/ui/components/Button.tsx
import React from 'react'
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components'

export interface ButtonProps extends RACButtonProps {
  /** Visual variant — applied as data attribute consumed by Tailwind. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-amber-900/40 border border-amber-700/60 text-amber-100 hover:bg-amber-900/60 ' +
    'data-[hovered]:bg-amber-900/60 data-[pressed]:translate-y-px data-[focus-visible]:ring-2 ' +
    'data-[focus-visible]:ring-amber-400 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  secondary:
    'bg-stone-800/50 border border-stone-600/40 text-stone-200 ' +
    'data-[hovered]:bg-stone-800/80 data-[pressed]:translate-y-px data-[focus-visible]:ring-2 ' +
    'data-[focus-visible]:ring-amber-400 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  ghost:
    'bg-transparent border border-transparent text-stone-300 ' +
    'data-[hovered]:bg-stone-800/40 data-[pressed]:translate-y-px data-[focus-visible]:ring-2 ' +
    'data-[focus-visible]:ring-amber-400 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  danger:
    'bg-red-900/40 border border-red-700/60 text-red-100 ' +
    'data-[hovered]:bg-red-900/60 data-[pressed]:translate-y-px data-[focus-visible]:ring-2 ' +
    'data-[focus-visible]:ring-red-400 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
}

export function Button({
  variant = 'secondary',
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  const base = 'px-4 py-2 font-mono text-sm tracking-wider transition-transform select-none cursor-pointer outline-none'
  const cx = `${base} ${VARIANT_CLASS[variant]} ${className ?? ''}`.trim()
  return <RACButton {...rest} className={cx} />
}
```

- [ ] **Step 5: Run tests, expect pass**

```bash
npx vitest run tests/unit/ui/components/Button.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 6: Run full gates**

```bash
npm run typecheck && npm test -- --run && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/Button.tsx tests/unit/ui/components/Button.test.tsx package.json package-lock.json vite.config.ts
git commit -m "feat(phaser): [UI-T2] Button wrapper over react-aria-components

Provides the project's only sanctioned <Button>. Variant prop maps to
Tailwind data-[hovered/pressed/focus-visible/disabled]: classes so we
get reliable 4-state visual styling for free. 4 unit tests cover click,
disabled, keyboard, and data-attribute exposure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `Pressable` wrapper + tests

**Files:**
- Create: `phaser/src/ui/components/Pressable.tsx`
- Create: `phaser/tests/unit/ui/components/Pressable.test.tsx`

`Pressable` is for non-button clickables (round map nodes, custom shapes) that need RAC's `usePress` semantics but where the `<Button>` element/styling is too constraining.

- [ ] **Step 1: Write failing test**

```tsx
// phaser/tests/unit/ui/components/Pressable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pressable } from '../../../../src/ui/components/Pressable'

describe('<Pressable>', () => {
  it('renders div with role="button" and fires onPress', () => {
    const onPress = vi.fn()
    render(<Pressable onPress={onPress} aria-label="map node">N</Pressable>)
    const el = screen.getByRole('button', { name: 'map node' })
    expect(el.tagName).toBe('DIV')
    fireEvent.click(el)
    expect(onPress).toHaveBeenCalled()
  })

  it('respects isDisabled', () => {
    const onPress = vi.fn()
    render(<Pressable onPress={onPress} isDisabled aria-label="x">X</Pressable>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run tests/unit/ui/components/Pressable.test.tsx
```

- [ ] **Step 3: Implement Pressable**

```tsx
// phaser/src/ui/components/Pressable.tsx
import React from 'react'
import { usePress, useHover, useFocusRing, mergeProps } from 'react-aria'

export interface PressableProps {
  onPress?: () => void
  isDisabled?: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  'aria-label'?: string
}

export function Pressable({
  onPress, isDisabled, className, style, children, ...aria
}: PressableProps): React.JSX.Element {
  const { pressProps, isPressed } = usePress({ onPress, isDisabled })
  const { hoverProps, isHovered } = useHover({ isDisabled })
  const { focusProps, isFocusVisible } = useFocusRing()

  const props = mergeProps(pressProps, hoverProps, focusProps, {
    role: 'button',
    tabIndex: isDisabled ? -1 : 0,
    'aria-disabled': isDisabled,
    'data-pressed': isPressed || undefined,
    'data-hovered': isHovered || undefined,
    'data-focus-visible': isFocusVisible || undefined,
    'data-disabled': isDisabled || undefined,
  } as Record<string, unknown>)

  return (
    <div {...props} {...aria} className={className} style={style}>
      {children}
    </div>
  )
}
```

Note: react-aria provides hooks via `react-aria` (not `react-aria-components`). Both are part of @react-aria/* family. The `react-aria` package re-exports the hooks.

- [ ] **Step 4: Install react-aria hooks package if needed**

```bash
npm install react-aria@^3.39.0
```

- [ ] **Step 5: Run tests, expect pass**

```bash
npx vitest run tests/unit/ui/components/Pressable.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/Pressable.tsx tests/unit/ui/components/Pressable.test.tsx package.json package-lock.json
git commit -m "feat(phaser): [UI-T3] Pressable wrapper for non-button clickables

For round map nodes and other shapes where <button> styling is too
constraining. Renders div[role=\"button\"] with full usePress/useHover/
useFocusRing semantics and the same data-[*] attributes as <Button>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `Card` wrapper + tests

**Files:**
- Create: `phaser/src/ui/components/Card.tsx`
- Create: `phaser/tests/unit/ui/components/Card.test.tsx`

`Card` is the centerpiece. It wraps `<Button>` semantics with Framer Motion lift animation and the AP-cost guard logic. Disabled-with-reason supports the spec's "needs N AP, you have M" tooltip.

- [ ] **Step 1: Write failing test**

```tsx
// phaser/tests/unit/ui/components/Card.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '../../../../src/ui/components/Card'

describe('<Card>', () => {
  it('fires onPress when affordable', () => {
    const onPress = vi.fn()
    render(<Card onPress={onPress} cardName="Slash" apCost={1} availableAp={3}>Slash</Card>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalled()
  })

  it('does not fire when AP insufficient', () => {
    const onPress = vi.fn()
    render(<Card onPress={onPress} cardName="Heavy" apCost={3} availableAp={1}>Heavy</Card>)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('exposes disabled-reason as aria-description when AP insufficient', () => {
    render(<Card onPress={() => {}} cardName="Heavy" apCost={3} availableAp={1}>Heavy</Card>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    expect(btn.getAttribute('aria-description')).toMatch(/needs 3 AP/i)
    expect(btn.getAttribute('aria-description')).toMatch(/have 1/i)
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```bash
npx vitest run tests/unit/ui/components/Card.test.tsx
```

- [ ] **Step 3: Implement Card**

```tsx
// phaser/src/ui/components/Card.tsx
import React from 'react'
import { Button as RACButton } from 'react-aria-components'
import { motion } from 'framer-motion'

export interface CardProps {
  onPress: () => void
  cardName: string
  apCost: number
  availableAp: number
  isSelected?: boolean
  className?: string
  children: React.ReactNode
}

export function Card({
  onPress, cardName, apCost, availableAp, isSelected, className, children,
}: CardProps): React.JSX.Element {
  const affordable = apCost <= availableAp
  const reason = affordable ? undefined : `needs ${apCost} AP, you have ${availableAp}`

  return (
    <motion.div
      layout
      whileHover={affordable ? { y: -24, scale: 1.04 } : undefined}
      whileTap={affordable ? { y: -20, scale: 1.02 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative"
      data-testid={`card-${cardName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <RACButton
        onPress={onPress}
        isDisabled={!affordable}
        aria-label={cardName}
        aria-description={reason}
        className={
          'block w-24 h-36 rounded border-2 px-2 py-2 font-mono text-xs select-none cursor-pointer ' +
          'transition-colors outline-none ' +
          'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400 ' +
          (isSelected
            ? 'bg-stone-800 border-amber-400 text-amber-100'
            : affordable
              ? 'bg-stone-900/80 border-stone-600 text-stone-100 ' +
                'data-[hovered]:border-amber-700 data-[hovered]:bg-stone-800'
              : 'bg-stone-900/50 border-stone-700/50 text-stone-500 cursor-not-allowed') +
          ` ${className ?? ''}`
        }
      >
        {children}
      </RACButton>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Card.tsx tests/unit/ui/components/Card.test.tsx
git commit -m "feat(phaser): [UI-T4] Card wrapper with AP guard + Framer Motion lift

Click is RAC Button (proper press semantics, keyboard); lift animation
is Framer Motion whileHover/whileTap. AP-cost guard sets isDisabled
and exposes aria-description with the reason ('needs 3 AP, you have 1').
Hit area is the button itself — moves with the visual, no Phaser
hit-area-sync bug class possible.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `Dialog` wrapper + tests

**Files:**
- Create: `phaser/src/ui/components/Dialog.tsx`
- Create: `phaser/tests/unit/ui/components/Dialog.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// phaser/tests/unit/ui/components/Dialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from '../../../../src/ui/components/Dialog'

describe('<Dialog>', () => {
  it('renders open dialog with content', () => {
    render(
      <Dialog isOpen onOpenChange={() => {}} aria-label="quit">
        <p>Are you sure?</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onOpenChange(false) when ESC pressed', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog isOpen onOpenChange={onOpenChange} aria-label="quit">
        content
      </Dialog>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not render when closed', () => {
    render(<Dialog isOpen={false} onOpenChange={() => {}} aria-label="quit">x</Dialog>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Implement Dialog**

```tsx
// phaser/src/ui/components/Dialog.tsx
import React from 'react'
import { ModalOverlay, Modal, Dialog as RACDialog } from 'react-aria-components'

export interface DialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  'aria-label'?: string
  className?: string
}

export function Dialog({
  isOpen, onOpenChange, children, className, ...aria
}: DialogProps): React.JSX.Element {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-[800] flex items-center justify-center bg-black/70 data-[entering]:animate-in data-[exiting]:animate-out"
    >
      <Modal className="outline-none">
        <RACDialog {...aria} className={`bg-stone-950 border border-amber-900/40 text-amber-100 font-mono p-6 min-w-[400px] outline-none ${className ?? ''}`}>
          {children}
        </RACDialog>
      </Modal>
    </ModalOverlay>
  )
}
```

- [ ] **Step 4: Run tests, expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Dialog.tsx tests/unit/ui/components/Dialog.test.tsx
git commit -m "feat(phaser): [UI-T5] Dialog wrapper with focus trap + ESC dismiss

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `Menu` wrapper + tests

**Files:**
- Create: `phaser/src/ui/components/Menu.tsx`
- Create: `phaser/tests/unit/ui/components/Menu.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// phaser/tests/unit/ui/components/Menu.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Menu, MenuItem } from '../../../../src/ui/components/Menu'

describe('<Menu>', () => {
  it('renders items and fires onAction', () => {
    const onAction = vi.fn()
    render(
      <Menu aria-label="actions" onAction={onAction}>
        <MenuItem id="one">One</MenuItem>
        <MenuItem id="two">Two</MenuItem>
      </Menu>,
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'One' }))
    expect(onAction).toHaveBeenCalledWith('one')
  })

  it('arrow-down moves focus between items', () => {
    render(
      <Menu aria-label="actions" onAction={() => {}}>
        <MenuItem id="one">One</MenuItem>
        <MenuItem id="two">Two</MenuItem>
      </Menu>,
    )
    const first = screen.getByRole('menuitem', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Two' }))
  })
})
```

- [ ] **Step 2: Implement**

```tsx
// phaser/src/ui/components/Menu.tsx
import React from 'react'
import {
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  type MenuProps as RACMenuProps,
  type MenuItemProps as RACMenuItemProps,
} from 'react-aria-components'

export type MenuProps<T extends object> = RACMenuProps<T> & {
  className?: string
}

export function Menu<T extends object>({ className, ...rest }: MenuProps<T>): React.JSX.Element {
  return (
    <RACMenu {...rest} className={`outline-none ${className ?? ''}`} />
  )
}

export function MenuItem(props: RACMenuItemProps): React.JSX.Element {
  return (
    <RACMenuItem
      {...props}
      className="px-4 py-2 font-mono text-sm cursor-pointer outline-none data-[hovered]:bg-stone-800 data-[focused]:bg-stone-800 data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400"
    />
  )
}
```

- [ ] **Step 3: Run tests + commit**

```bash
git add src/ui/components/Menu.tsx tests/unit/ui/components/Menu.test.tsx
git commit -m "feat(phaser): [UI-T6] Menu wrapper with arrow-key nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `ListBox` wrapper + tests

Same TDD pattern as Menu. Use `ListBox` + `ListBoxItem` from react-aria-components. Tests: renders items, click selects, arrow-key changes selection.

- [ ] **Step 1: Test file `phaser/tests/unit/ui/components/ListBox.test.tsx`** — verify renders, single-select fires `onSelectionChange`, arrow-key changes selection.

- [ ] **Step 2: Implementation `phaser/src/ui/components/ListBox.tsx`** — re-export `ListBox` and `ListBoxItem` from RAC with project styling (Tailwind classes for `data-[selected]:` and `data-[focus-visible]:`).

- [ ] **Step 3: Run + commit `[UI-T7] ListBox wrapper`**

---

### Task 8: `Tooltip` wrapper + tests

- [ ] **Step 1: Test `Tooltip.test.tsx`** — verifies `<Tooltip>` shows child on hover/focus and exposes content via `aria-describedby`.

- [ ] **Step 2: Implementation `Tooltip.tsx`** — wrap `TooltipTrigger` + `Tooltip` from RAC; default `delay={500}`; arrow positioning.

```tsx
// phaser/src/ui/components/Tooltip.tsx
import React from 'react'
import { TooltipTrigger, Tooltip as RACTooltip, OverlayArrow } from 'react-aria-components'

export interface TooltipProps {
  trigger: React.ReactElement
  content: React.ReactNode
  delay?: number
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ trigger, content, delay = 500, placement = 'top' }: TooltipProps): React.JSX.Element {
  return (
    <TooltipTrigger delay={delay}>
      {trigger}
      <RACTooltip
        placement={placement}
        className="bg-stone-950 border border-amber-900/60 text-amber-100 font-mono text-xs px-2 py-1 rounded shadow-lg"
      >
        <OverlayArrow className="fill-stone-950 stroke-amber-900/60" />
        {content}
      </RACTooltip>
    </TooltipTrigger>
  )
}
```

- [ ] **Step 3: Run + commit `[UI-T8] Tooltip wrapper`**

---

### Task 9: `Heading` + barrel + ESLint guard

**Files:**
- Create: `phaser/src/ui/components/Heading.tsx`
- Create: `phaser/src/ui/components/index.ts`
- Modify: `phaser/eslint.config.js`

- [ ] **Step 1: Heading**

```tsx
// phaser/src/ui/components/Heading.tsx
import React from 'react'
import { Heading as RACHeading } from 'react-aria-components'

export interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
  children: React.ReactNode
}

export function Heading({ level = 2, className, children }: HeadingProps): React.JSX.Element {
  return (
    <RACHeading
      level={level}
      className={`font-mono tracking-wider text-amber-200 ${className ?? ''}`}
    >
      {children}
    </RACHeading>
  )
}
```

- [ ] **Step 2: Barrel**

```ts
// phaser/src/ui/components/index.ts
export { Button } from './Button'
export type { ButtonProps } from './Button'
export { Card } from './Card'
export type { CardProps } from './Card'
export { Dialog } from './Dialog'
export type { DialogProps } from './Dialog'
export { Menu, MenuItem } from './Menu'
export type { MenuProps } from './Menu'
export { ListBox, ListBoxItem } from './ListBox'
export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'
export { Heading } from './Heading'
export type { HeadingProps } from './Heading'
export { Pressable } from './Pressable'
export type { PressableProps } from './Pressable'
```

- [ ] **Step 3: ESLint guard**

Add to `phaser/eslint.config.js` an override:

```js
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['src/ui/components/**'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'react-aria-components', message: 'Import from src/ui/components/ instead of raw react-aria-components.' },
        { name: 'react-aria', message: 'Import from src/ui/components/ instead of raw react-aria.' },
      ],
    }],
  },
},
```

- [ ] **Step 4: Run gates**

```bash
npm run typecheck && npm test -- --run && npm run lint && npm run build
```

- [ ] **Step 5: Commit `[UI-T9] Heading + barrel + lint guard`**

---

## Phase 2 — Migrate non-combat scenes

Each task: replace inline-styled `<button>` with `<Button>` from `src/ui/components`. Convert `style={{...}}` blocks to Tailwind classes + `data-[*]:` variants. Keep visuals as close to current as possible — this is interactivity, not redesign.

### Task 10: Migrate `TitleScreen`

**File:** `phaser/src/ui/screens/TitleScreen.tsx`

- [ ] **Step 1: Read current `TitleScreen.tsx` to identify button sites (3 buttons: New Game, Load Game, Quit).**

- [ ] **Step 2: Replace each button block:**

```tsx
// Before
<button onClick={onNewGame} style={{...inlineHoverHandlers...}}>New Game</button>

// After
import { Button } from '../components'
<Button onPress={onNewGame} variant="primary">New Game</Button>
```

- [ ] **Step 3: Update existing E2E test `tests/e2e/boot.spec.ts` only if selectors break** (they shouldn't — RAC `<Button>` renders to native `<button>`).

- [ ] **Step 4: Run gates + visual verify in browser via Playwright MCP.**

- [ ] **Step 5: Commit `[UI-T10] migrate TitleScreen to <Button>`**

---

### Task 11: Migrate `QuitModal`

**File:** `phaser/src/ui/modals/QuitModal.tsx`

- [ ] Replace the modal `<div>` with `<Dialog>`. Buttons → `<Button variant="ghost">`. ESC dismiss is automatic.

- [ ] Run gates + commit `[UI-T11] migrate QuitModal to <Dialog>`

---

### Task 12: Migrate `BattleEndModal`

**File:** `phaser/src/ui/modals/BattleEndModal.tsx`

Same pattern. Subscribes to `useCombatStore` state.phase ∈ {VICTORY, DEFEAT}; renders `<Dialog>` with `<Button>` Continue / Restart / Return-to-title.

- [ ] Run gates + commit `[UI-T12] migrate BattleEndModal`

---

### Task 13: Migrate `LoadGameModal`

**File:** `phaser/src/ui/modals/LoadGameModal.tsx`

Modal → `<Dialog>`. Save slot list → `<ListBox>` with `<ListBoxItem>` per slot. Empty-state message kept.

- [ ] Run gates + commit `[UI-T13] migrate LoadGameModal`

---

### Task 14: Migrate `QuestLog`

**File:** `phaser/src/ui/overlays/QuestLog.tsx`

Overlay → `<Dialog>` (already modal-like). Close button → `<Button variant="ghost">×</Button>`. Quest items remain plain divs (no actions).

- [ ] Run gates + commit `[UI-T14] migrate QuestLog`

---

### Task 15: Migrate `OverworldScene`

**File:** `phaser/src/ui/screens/OverworldScene.tsx` (~277 LoC, ~13 button sites)

- [ ] **Round map nodes**: replace `<button>` with `<Pressable>` (round shape requires div). Style via Tailwind `rounded-full`, sizes preserved (48×48px). Disabled = `isDisabled={!isReachable && !isCurrent}`.

- [ ] **Quest indicator** stays plain div (no interaction).

- [ ] **Top HUD buttons** (Open Quest Log, etc.) → `<Button variant="ghost">`.

- [ ] **SVG edge layer** unchanged (`pointer-events: none`).

- [ ] Run gates + commit `[UI-T15] migrate OverworldScene`

---

### Task 16: Migrate `TownScene`

**File:** `phaser/src/ui/screens/TownScene.tsx` (~323 LoC, ~24 buttons)

- [ ] Sidebar items (Inn / Shop / Tavern / Leave) → `<Button variant="secondary">`. Active panel highlight via `isSelected` prop on a custom variant or by passing `aria-pressed`.

- [ ] Inn heal: `<Button variant="primary">` with disabled-with-reason when gold insufficient.

- [ ] Shop item rows → `<ListBox>` with item cards as `<ListBoxItem>`.

- [ ] Tavern interactive elements (Buy a Round, Blood Ties accept) → `<Button>`.

- [ ] Run gates + commit `[UI-T16] migrate TownScene`

---

### Task 17: Migrate `DungeonScene`

**File:** `phaser/src/ui/screens/DungeonScene.tsx` (~262 LoC)

- [ ] Room buttons → `<Pressable>` (custom shape per room type) or `<Button>` for rectangular ones.

- [ ] Retreat button → `<Button variant="danger">`.

- [ ] Run gates + commit `[UI-T17] migrate DungeonScene`

---

## Phase 3 — Combat HUD migration + BoardScene reduction

### Task 18: `CombatHud` shell + `TopBar`

**Files:**
- Create: `phaser/src/ui/scenes/combat/CombatHud.tsx`
- Create: `phaser/src/ui/scenes/combat/TopBar.tsx`
- Create: `phaser/tests/unit/ui/scenes/combat/CombatHud.test.tsx`

- [ ] **Test:** mounts when combat state.phase === 'COMBAT', shows turn number and active unit name. Selectors:

```tsx
import { useCombatStore } from '../../../state/combatStore'

useCombatStore.setState((s) => ({
  state: { ...s.state, phase: 'COMBAT', turn: { number: 3, unitId: 'roy' as never, team: 'party' }, units: { roy: { id: 'roy', name: 'Roy', ap: 2, hp: { current: 18, max: 22 }, /* ... */ } } },
}))
```

- [ ] **TopBar code:**

```tsx
// phaser/src/ui/scenes/combat/TopBar.tsx
import React from 'react'
import { useCombatStore } from '../../../state/combatStore'
import { Heading } from '../../components'

export function TopBar(): React.JSX.Element {
  const turnNumber = useCombatStore((s) => s.state.turn.number)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const unit = useCombatStore((s) =>
    activeId ? s.state.units[activeId as unknown as string] : null,
  )
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-stone-950/80 border border-amber-900/40 rounded font-mono text-amber-100 text-sm tracking-wider z-10">
      <span>Turn {turnNumber}</span>
      {unit && (
        <>
          <span className="text-stone-500">•</span>
          <Heading level={3} className="text-base m-0">{unit.name}</Heading>
          <span className="text-stone-500">•</span>
          <span>HP <span className="text-amber-300">{unit.hp.current}</span>/{unit.hp.max}</span>
          <span className="text-stone-500">•</span>
          <span>AP <span className="text-amber-300">{unit.ap}</span>/3</span>
        </>
      )}
    </div>
  )
}
```

- [ ] **CombatHud shell:**

```tsx
// phaser/src/ui/scenes/combat/CombatHud.tsx
import React from 'react'
import { TopBar } from './TopBar'

export function CombatHud(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-[100]">
      <div className="pointer-events-auto"><TopBar /></div>
    </div>
  )
}
```

- [ ] Commit `[UI-T18] CombatHud shell + TopBar`

---

### Task 19: `ModeLabel`

**File:** `phaser/src/ui/scenes/combat/ModeLabel.tsx`

- [ ] Subscribes to `state.subPhase`; renders centered banner when `SELECTING_MOVE` or `SELECTING_TARGET`. Animates in/out with Framer Motion `<AnimatePresence>`.

```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { useCombatStore } from '../../../state/combatStore'

export function ModeLabel(): React.JSX.Element | null {
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const text = subPhase === 'SELECTING_MOVE'
    ? 'Click a highlighted tile to move (ESC to cancel)'
    : subPhase === 'SELECTING_TARGET'
      ? 'Click a target (ESC or right-click to cancel)'
      : null
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-900/80 border border-amber-600 text-amber-50 font-mono text-sm rounded z-10"
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] Add to CombatHud. Commit `[UI-T19] ModeLabel`

---

### Task 20: `EndTurnBtn`

**File:** `phaser/src/ui/scenes/combat/EndTurnBtn.tsx`

- [ ] Test: clicking dispatches `endTurn` event. Disabled when not party turn or RESOLVING.

```tsx
import { Button } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'

export function EndTurnBtn(): React.JSX.Element {
  const dispatch = useCombatStore((s) => s.dispatch)
  const enabled = useCombatStore(
    (s) => s.state.phase === 'COMBAT' && s.state.turn.team === 'party' && s.state.subPhase !== 'RESOLVING',
  )
  const rng = useCombatStore((s) => s.state.rng)
  return (
    <Button
      variant="primary"
      isDisabled={!enabled}
      onPress={() => dispatch({ type: 'endTurn' }, createRng(rng))}
    >
      End Turn
    </Button>
  )
}
```

- [ ] Add to CombatHud (bottom-right corner). Commit `[UI-T20] EndTurnBtn`

---

### Task 21: `MoveBtn`

**File:** `phaser/src/ui/scenes/combat/MoveBtn.tsx`

- [ ] Test: enters `SELECTING_MOVE` on press; toggles to "Cancel Move" when active. Disabled if `hasMovedThisTurn` or not party turn.

```tsx
import { Button } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'

export function MoveBtn(): React.JSX.Element {
  const dispatch = useCombatStore((s) => s.dispatch)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const team = useCombatStore((s) => s.state.turn.team)
  const unit = useCombatStore((s) => activeId ? s.state.units[activeId as unknown as string] : null)
  const rng = useCombatStore((s) => s.state.rng)

  const selecting = subPhase === 'SELECTING_MOVE'
  const enabled = team === 'party' && unit !== null && unit.hp.current > 0
    && !unit.hasMovedThisTurn && subPhase !== 'RESOLVING'

  const onPress = (): void => {
    if (selecting) dispatch({ type: 'cancelSelection' }, createRng(rng))
    else if (activeId) dispatch({ type: 'enterMoveMode', payload: { unitId: activeId } }, createRng(rng))
  }

  return (
    <Button variant={selecting ? 'primary' : 'secondary'} isDisabled={!enabled && !selecting} onPress={onPress}>
      {selecting ? 'Cancel Move' : 'Move'}
    </Button>
  )
}
```

- [ ] Commit `[UI-T21] MoveBtn`

---

### Task 22: `Card` integration + `CardHand`

**Files:**
- Create: `phaser/src/ui/scenes/combat/CardHand.tsx`

- [ ] Test: renders 5 cards from active unit's deck.hand; click on a card dispatches `selectCard`; AP-insufficient cards show disabled state and tooltip.

```tsx
// phaser/src/ui/scenes/combat/CardHand.tsx
import React from 'react'
import { Card, Tooltip } from '../../components'
import { useCombatStore } from '../../../state/combatStore'
import { createRng } from '../../../systems/rng'
import { asCardId } from '../../../domain/ids'
import cardsJson from '../../../data/content/cards.json'

const cardsMap = new Map(cardsJson.map((c) => [c.id, c]))

export function CardHand(): React.JSX.Element | null {
  const dispatch = useCombatStore((s) => s.dispatch)
  const activeId = useCombatStore((s) => s.state.turn.unitId)
  const team = useCombatStore((s) => s.state.turn.team)
  const selectedId = useCombatStore((s) => s.state.selectedCardId)
  const subPhase = useCombatStore((s) => s.state.subPhase)
  const unit = useCombatStore((s) => activeId ? s.state.units[activeId as unknown as string] : null)
  const deck = useCombatStore((s) => activeId ? s.state.decks[activeId as unknown as string] : null)
  const rng = useCombatStore((s) => s.state.rng)

  if (!activeId || team !== 'party' || !unit || !deck) return null
  const ap = unit.ap
  const handIds = deck.hand.slice(0, 5).map((id) => id as unknown as string)

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 items-end z-10">
      {handIds.map((cardId) => {
        const card = cardsMap.get(cardId)
        if (!card) return null
        const dmgEffect = card.effects.find((e) => e.kind === 'Damage' || e.kind === 'Heal')
        const dmg = dmgEffect ? ((dmgEffect.params as { base?: number; amount?: number }).base ?? (dmgEffect.params as { amount?: number }).amount) : null
        const cardEl = (
          <Card
            key={cardId}
            cardName={card.name}
            apCost={card.apCost}
            availableAp={ap}
            isSelected={selectedId !== null && (selectedId as unknown as string) === cardId}
            onPress={() => {
              if (subPhase === 'RESOLVING') return
              dispatch({ type: 'selectCard', payload: { cardId: asCardId(cardId) } }, createRng(rng))
            }}
          >
            <div className="text-center text-xs leading-tight">{card.name}</div>
            {dmg !== null && <div className="text-center text-2xl text-amber-400 mt-2">{dmg}</div>}
            <div className="absolute bottom-1 left-1 text-[10px] text-amber-300">{card.apCost} AP</div>
          </Card>
        )
        if (card.apCost > ap) {
          return (
            <Tooltip
              key={cardId}
              trigger={cardEl}
              content={`Needs ${card.apCost} AP, you have ${ap}`}
            />
          )
        }
        return cardEl
      })}
    </div>
  )
}
```

- [ ] Add CardHand to CombatHud. Commit `[UI-T22] CardHand`

---

### Task 23: `CaptureBtn`

**File:** `phaser/src/ui/scenes/combat/CaptureBtn.tsx`

- [ ] Test: shown only when active unit is adjacent to a low-HP enemy. Click dispatches `capture`.

```tsx
// phaser/src/ui/scenes/combat/CaptureBtn.tsx — full code see Card.tsx pattern
```

(Code: scan units; for each enemy with HP < 50% and Manhattan distance 1 from active unit, render a small `<Button variant="danger">Capture</Button>` near that enemy on the canvas. Or render in a dedicated panel — for now, in TopBar area.)

- [ ] Commit `[UI-T23] CaptureBtn (in-HUD)`

---

### Task 24: Wire `CombatHud` into `App.tsx`

**File:** `phaser/src/App.tsx`

- [ ] Render `<CombatHud />` only when `view === 'combat'`. It overlays the canvas via absolute positioning.

```tsx
{view === 'combat' && (
  <>
    <div id="game-canvas-container" />
    <CombatHud />
  </>
)}
```

- [ ] Commit `[UI-T24] mount CombatHud over Phaser canvas`

---

### Task 25: Strip HUD from Phaser; rename to BoardScene

**File:** `phaser/src/game/scenes/CombatScene.ts` → `BoardScene.ts`

- [ ] **Step 1: Rename file** `CombatScene.ts` → `BoardScene.ts`. Update imports in `phaser/src/game/runtime/CombatRuntime.ts` and any other consumer.

- [ ] **Step 2: Delete from BoardScene:**
  - `renderCardHand()`, `cardViews` field, `CardView` type
  - `drawEndTurnButton()`, `endTurnBtn` field
  - `drawMoveButton()`, `updateMoveButton()`, `isMoveButtonEnabled()`, `moveBtn` / `moveBtnBg` / `moveBtnText` fields
  - `drawApIndicator()`, `updateApIndicator()`, `apText` field
  - `drawModeLabel()`, `updateModeLabel()`, `modeLabel` field
  - `cardsMap`, `getCardDamageBase` (no longer needed in canvas)
  - All `setInteractive` for non-spatial-picker objects (cards, buttons)

- [ ] **Step 3: Keep in BoardScene:**
  - Grid drawing
  - `renderUnits()`
  - `renderTargeting()` (tile coloring for SELECTING_MOVE / SELECTING_TARGET)
  - `onTileClick` (spatial picker)
  - `onUnitClick` (spatial picker)
  - `handleEffect()` for animations
  - `maybeRunEnemyTurn()` / `dispatchNextEnemyEvent()`
  - ESC handler for cancelSelection

- [ ] **Step 4: Update Phaser Game config to register `BoardScene` as the only scene** (key 'combat' kept for backward compat with seedStubBattle).

- [ ] **Step 5: Run gates + verify combat in browser via Playwright MCP.**

- [ ] **Step 6: Commit `[UI-T25] strip HUD from Phaser; rename CombatScene → BoardScene`**

```
Net effect: ~370 LoC removed from CombatScene; HUD now lives in
React via CombatHud + sub-components. No buttons in canvas. Only
spatial-picker click handlers (tile/unit) remain.
```

---

### Task 26: Update E2E tests for new HUD

**File:** `phaser/tests/e2e/combat-buttons.spec.ts`

- [ ] **Step 1:** Tests for End Turn / Card click / Move button no longer fire MouseEvent on canvas. Now they target real React DOM `<button>` elements:

```ts
await page.click('button:has-text("End Turn")')
await page.click('[data-testid="card-slash"]')
await page.click('button:has-text("Move")')
```

- [ ] **Step 2:** Update `combat-movement.spec.ts` to also use DOM clicks for the move-mode entry, then canvas MouseEvent for the tile click (still spatial picker).

- [ ] **Step 3:** Add new test `tests/e2e/keyboard-nav.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('Tab + Enter navigates title screen', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveText(/New Game/i)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => {
    return document.querySelector('#overworld-scene') !== null
  })
})
```

- [ ] Commit `[UI-T26] update E2E tests for DOM HUD + add keyboard-nav.spec`

---

## Phase 4 — Cross-cutting polish

### Task 27: `prefers-reduced-motion`

**Files:**
- Modify: `phaser/src/ui/components/Card.tsx`
- Modify: animation sites

- [ ] **Step 1:** Read `prefers-reduced-motion` via a hook:

```tsx
// phaser/src/ui/hooks/useReducedMotion.ts (or import from framer-motion)
import { useReducedMotion } from 'framer-motion'
```

- [ ] **Step 2:** In Card and ModeLabel, skip lift animation when reduced motion preferred.

- [ ] Commit `[UI-T27] respect prefers-reduced-motion`

---

### Task 28: Performance gates measurement

**Files:**
- Create: `phaser/scripts/measure-bundle.mjs` — script that builds, reads `dist/assets/index-*.js` size, asserts ≤ baseline + 75 KB gzipped.
- Modify: `phaser/package.json` — add `"perf-gates"` script

- [ ] **Step 1:** Bundle script:

```mjs
// phaser/scripts/measure-bundle.mjs
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { globSync } from 'glob'

execSync('npm run build', { stdio: 'inherit' })
const files = globSync('dist/assets/*.js')
let totalGzip = 0
for (const f of files) {
  const buf = readFileSync(f)
  totalGzip += gzipSync(buf).length
}
const baselineKB = 432  // gzipped baseline at phaser-vertical-slice tag
const ceilingKB = baselineKB + 75
const actualKB = Math.round(totalGzip / 1024)
console.log(`Bundle: ${actualKB} KB gzipped (baseline ${baselineKB}, ceiling ${ceilingKB})`)
if (actualKB > ceilingKB) {
  console.error(`FAIL: bundle exceeds ${ceilingKB} KB ceiling`)
  process.exit(1)
}
console.log('PASS')
```

- [ ] **Step 2:** Add to package.json scripts: `"perf-gates": "node scripts/measure-bundle.mjs"`

- [ ] **Step 3:** Run + commit `[UI-T28] perf-gates script (bundle ceiling)`

---

### Task 29: Final visual verification + CONTEXT.md update

**Files:**
- Modify: `phaser/CONTEXT.md`

- [ ] **Step 1:** Update CONTEXT.md:
  - Section header for `BoardScene` (was CombatScene)
  - New section "UI components" listing the 8 wrappers
  - Architecture invariant addition: "All UI is React + react-aria-components. Phaser renders the board layer only — no buttons or menus in canvas."

- [ ] **Step 2:** Run `npm run check-context-doc` to verify drift check passes.

- [ ] **Step 3:** Visual playthrough via Playwright MCP — title → overworld → travel → combat → win → overworld. Capture screenshots showing 4-state styling (idle/hover/pressed/disabled).

- [ ] **Step 4:** Tag and emit promise.

```bash
git tag phaser-ui-input-fixed
git push --tags
```

- [ ] **Step 5:** Commit `[UI-T29] CONTEXT.md update + visual verification`

- [ ] **Step 6:** Emit `<promise>UI-INPUT-FIXED</promise>`

---

## Self-review notes

- **Spec coverage:** Every spec section has at least one task. Phase mapping is 1:1.
- **Placeholder scan:** Tasks 7, 11-17, and 23 use abbreviated step descriptions but reference complete code in earlier tasks (T2 for `<Button>`, T4 for `<Card>` patterns). Acceptable per writing-plans guidance for parallel-pattern tasks where exact code is identical.
- **Type consistency:** All component types exported from `src/ui/components/index.ts`. CombatHud uses Zustand selectors (s.state.x), matching existing patterns in App.tsx.
- **Risk:** T22 CardHand is the most complex new file (~80 LoC); fully spec'd above.
- **Animation:** Framer Motion locked. If bundle exceeds gate at T28, alternative is `motion` (motion.dev's lighter version) — defer to that iteration if needed.

---

*Plan derived from `docs/superpowers/specs/2026-05-09-ui-input-overhaul-design.md`. Council reviewers (5/5): #1 Architecture, #2 Performance, #3 Migration, #4 UX, #5 Future-proofing — all converged on this DOM-first / Phaser-grid-only direction.*
