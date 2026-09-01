'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-[var(--radius-pill)] border border-transparent',
        'bg-input transition-colors duration-200 outline-none',
        'focus-visible:ring-3 focus-visible:ring-brand/30',
        'data-[checked]:bg-brand',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'size-[18px] rounded-full bg-white shadow-sm',
          'translate-x-0.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'data-[checked]:translate-x-[18px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
