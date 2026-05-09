import React from 'react'
import {
  Menu as RACMenu,
  MenuItem as RACMenuItem,
  type MenuProps as RACMenuProps,
  type MenuItemProps as RACMenuItemProps,
} from 'react-aria-components'

export type MenuProps<T extends object> = RACMenuProps<T>

export function Menu<T extends object>({
  className, ...rest
}: MenuProps<T>): React.JSX.Element {
  return (
    <RACMenu
      {...rest}
      className={`outline-none flex flex-col ${className ?? ''}`.trim()}
    />
  )
}

export function MenuItem(props: RACMenuItemProps): React.JSX.Element {
  return (
    <RACMenuItem
      {...props}
      className={
        'px-4 py-2 font-mono text-sm cursor-pointer outline-none ' +
        'data-[hovered]:bg-stone-800 data-[focused]:bg-stone-800 ' +
        'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400 ' +
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed'
      }
    />
  )
}
