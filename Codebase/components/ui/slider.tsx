'use client'

import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: SliderPrimitive.Root.Props) {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn('w-full', className)} {...props}>
      <SliderPrimitive.Control className="flex h-5 w-full touch-none items-center select-none">
        <SliderPrimitive.Track className="h-1 w-full rounded-[var(--radius-pill)] bg-input">
          <SliderPrimitive.Indicator className="rounded-[var(--radius-pill)] bg-brand" />
          <SliderPrimitive.Thumb
            className={cn(
              'size-4 rounded-full border border-black/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]',
              'outline-none focus-visible:ring-3 focus-visible:ring-brand/30',
            )}
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

/** Slider with an inline right-aligned tabular readout, used all over the Inspector. */
export function SliderWithValue({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  unit,
  className,
}: {
  label?: string
  value: number
  onValueChange: (v: number) => void
  min: number
  max: number
  step: number
  unit?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        {label ? <span className="text-[13px] font-medium">{label}</span> : <span />}
        <span className="tabular text-[13px] text-muted-foreground">
          {value}
          {unit ?? ''}
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onValueChange(Array.isArray(v) ? v[0] : v)}
      />
    </div>
  )
}
