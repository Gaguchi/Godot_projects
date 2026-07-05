import React from 'react'
import { Heading as RACHeading } from 'react-aria-components'

export interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
  children: React.ReactNode
}

export function Heading({
  level = 2,
  className,
  children,
}: HeadingProps): React.JSX.Element {
  return (
    <RACHeading
      level={level}
      className={`font-display tracking-[0.06em] text-amber-100 ${className ?? ''}`.trim()}
    >
      {children}
    </RACHeading>
  )
}
