import React from 'react'
import {
  ListBox as RACListBox,
  ListBoxItem as RACListBoxItem,
  type ListBoxProps as RACListBoxProps,
  type ListBoxItemProps as RACListBoxItemProps,
} from 'react-aria-components'

export type ListBoxProps<T extends object> = RACListBoxProps<T>

export function ListBox<T extends object>({
  className, ...rest
}: ListBoxProps<T>): React.JSX.Element {
  return (
    <RACListBox
      {...rest}
      className={`outline-none flex flex-col gap-1 ${className ?? ''}`.trim()}
    />
  )
}

export function ListBoxItem(props: RACListBoxItemProps): React.JSX.Element {
  return (
    <RACListBoxItem
      {...props}
      className={
        'px-3 py-2 font-mono text-sm cursor-pointer outline-none rounded ' +
        'border border-transparent ' +
        'data-[hovered]:bg-stone-800 data-[hovered]:border-stone-600 ' +
        'data-[focused]:bg-stone-800 ' +
        'data-[selected]:bg-amber-900/40 data-[selected]:border-amber-700 data-[selected]:text-amber-100 ' +
        'data-[focus-visible]:ring-2 data-[focus-visible]:ring-amber-400 ' +
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed'
      }
    />
  )
}
