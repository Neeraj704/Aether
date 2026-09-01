'use client'

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root
export const TabPanel = TabsPrimitive.Panel

/** Underline tabs — the default for page-level sections. */
export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.List
      className={cn('relative flex items-center gap-1 border-b border-border', className)}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          'absolute bottom-0 left-0 h-0.5 bg-brand',
          'w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)]',
          'transition-[translate,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        )}
      />
    </TabsPrimitive.List>
  )
}

export function Tab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'relative cursor-pointer px-3 pb-2.5 text-[13px] font-medium whitespace-nowrap',
        'text-muted-foreground transition-colors outline-none hover:text-foreground',
        'data-[selected]:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Segmented pill control — for compact in-card view switches. */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: string }[]
  value: T
  onValueChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-[var(--radius-pill)] border border-border bg-secondary p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(o.value)}
            className={cn(
              'cursor-pointer rounded-[var(--radius-pill)] font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-xs',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
