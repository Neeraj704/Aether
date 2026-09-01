'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  className,
  disabled,
  id,
}: {
  options: (string | { value: string; label: string })[]
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const active = items.find((i) => i.value === value)

  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onValueChange(v as string)}>
      <SelectPrimitive.Trigger
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-input bg-secondary/80 px-3',
          'text-xs font-semibold text-foreground transition-[border-color,box-shadow] outline-none cursor-pointer',
          'focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate text-left', !active && 'text-muted-foreground')}>
          {active?.label ?? placeholder}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="z-[9999]">
          <SelectPrimitive.Popup
            className={cn(
              'max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-xl p-1 border border-border bg-card/95 text-foreground shadow-2xl backdrop-blur-xl',
              'origin-[var(--transform-origin)] transition-[transform,opacity,scale] duration-150',
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            )}
          >
            <SelectPrimitive.List>
              {items.map((item) => (
                <SelectPrimitive.Item
                  key={item.value}
                  value={item.value}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2',
                    'text-xs font-medium text-foreground outline-none select-none transition-colors',
                    'data-[highlighted]:bg-brand data-[highlighted]:text-primary-foreground',
                  )}
                >
                  <SelectPrimitive.ItemText className="truncate">
                    {item.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
