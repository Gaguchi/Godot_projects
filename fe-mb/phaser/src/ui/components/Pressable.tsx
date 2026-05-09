import React from 'react'
import { usePress, useHover, useFocusRing, mergeProps } from 'react-aria'

export interface PressableProps {
  onPress?: () => void
  isDisabled?: boolean
  id?: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
  'aria-label'?: string
  'aria-describedby'?: string
}

export function Pressable({
  onPress, isDisabled, id, className, style, children,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: PressableProps): React.JSX.Element {
  const { pressProps, isPressed } = usePress({
    ...(onPress ? { onPress } : {}),
    ...(isDisabled !== undefined ? { isDisabled } : {}),
  })
  const { hoverProps, isHovered } = useHover(
    isDisabled !== undefined ? { isDisabled } : {},
  )
  const { focusProps, isFocusVisible } = useFocusRing()

  const merged = mergeProps(pressProps, hoverProps, focusProps)

  return (
    <div
      {...merged}
      id={id}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled || undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-pressed={isPressed || undefined}
      data-hovered={isHovered || undefined}
      data-focus-visible={isFocusVisible || undefined}
      data-disabled={isDisabled || undefined}
      className={className}
      style={style}
    >
      {children}
    </div>
  )
}
