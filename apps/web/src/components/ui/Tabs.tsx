import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
}

/** Abas com tabpanel real (ARIA + navegação por seta) — SegmentedControl não é isso, só parece. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  children,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <TabsPrimitive.List className="inline-flex items-center gap-1 rounded-lg bg-neutral-500/8 p-1">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'rounded-lg px-3 py-1 text-[13px] font-medium whitespace-nowrap',
              'transition-[background-color,color,box-shadow] duration-200 ease-out',
              'text-neutral-600 hover:text-ink-900',
              'data-[state=active]:bg-white data-[state=active]:text-ink-900 data-[state=active]:shadow-sm',
            )}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  )
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Content value={value} className="mt-4 focus:outline-none">
      {children}
    </TabsPrimitive.Content>
  )
}
