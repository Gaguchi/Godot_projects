import React from 'react'
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components'

export interface ButtonProps extends RACButtonProps {
  /** Visual variant — applied via Tailwind data-[*]: variants for state. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-amber-900/40 border border-amber-700/60 text-amber-100 ' +
    'data-[hovered]:bg-amber-900/60 data-[hovered]:border-amber-500 ' +
    'data-[pressed]:translate-y-px data-[pressed]:bg-amber-900/80 ' +
    'data-[focus-visible]:[box-shadow:var(--focus-ring)] ' +
    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  secondary:
    'bg-stone-800/50 border border-stone-600/40 text-stone-200 ' +
    'data-[hovered]:bg-stone-800/80 data-[hovered]:border-stone-400 ' +
    'data-[pressed]:translate-y-px data-[pressed]:bg-stone-800 ' +
    'data-[focus-visible]:[box-shadow:var(--focus-ring)] ' +
    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  ghost:
    'bg-transparent border border-transparent text-stone-300 ' +
    'data-[hovered]:bg-stone-800/40 data-[hovered]:border-stone-700 ' +
    'data-[pressed]:translate-y-px data-[pressed]:bg-stone-800/60 ' +
    'data-[focus-visible]:[box-shadow:var(--focus-ring)] ' +
    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
  danger:
    'bg-red-900/40 border border-red-700/60 text-red-100 ' +
    'data-[hovered]:bg-red-900/60 data-[hovered]:border-red-500 ' +
    'data-[pressed]:translate-y-px data-[pressed]:bg-red-900/80 ' +
    'data-[focus-visible]:[box-shadow:var(--focus-ring)] ' +
    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
}

const BASE_CLASS =
  'inline-flex items-center justify-center px-4 py-2 font-body font-medium text-[0.95rem] tracking-wide ' +
  'motion-safe:transition-[transform,background-color,border-color,box-shadow] motion-safe:duration-100 ' +
  'select-none cursor-pointer outline-none rounded'

export function Button({
  variant = 'secondary',
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  const cx = `${BASE_CLASS} ${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`
  return <RACButton {...rest} className={cx} />
}
