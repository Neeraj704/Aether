'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[6px]',
        'border border-input bg-card transition-colors outline-none',
        'focus-visible:ring-3 focus-visible:ring-brand/30',
        'data-[checked]:border-brand data-[checked]:bg-brand data-[checked]:text-primary-foreground',
        'data-[indeterminate]:border-brand data-[indeterminate]:bg-brand data-[indeterminate]:text-primary-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex data-[unchecked]:hidden"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <Minus className="size-3" strokeWidth={3} />
            ) : (
              <Check className="size-3" strokeWidth={3} />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

/** Checkbox + label row, clickable across the whole row. */
export function CheckboxRow({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-1 py-1 text-[13px] hover:bg-secondary',
        className,
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="select-none">{label}</span>
    </label>
  )
}
