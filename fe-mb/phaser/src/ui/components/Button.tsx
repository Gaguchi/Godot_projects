import React from 'react'
import { Button as RACButton, type ButtonProps as RACButtonProps } from 'react-aria-components'

export interface ButtonProps extends RACButtonProps {
  /** Visual variant — forged-iron recipes live in index.css (.btn-forged*). */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Prose label (dialogue choices, event options): sentence case at reading
   *  size instead of the default etched-caps chrome label. */
  prose?: boolean
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-forged btn-forged--primary',
  secondary: 'btn-forged',
  ghost: 'btn-forged btn-forged--ghost',
  danger: 'btn-forged btn-forged--danger',
}

const BASE_CLASS =
  'inline-flex items-center justify-center px-4 py-2 font-body ' +
  'select-none cursor-pointer outline-none'

export function Button({
  variant = 'secondary',
  prose = false,
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  const cx = `${BASE_CLASS} ${VARIANT_CLASS[variant]}${prose ? ' btn-prose' : ''}${className ? ` ${className}` : ''}`
  return <RACButton {...rest} className={cx} />
}
