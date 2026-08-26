'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

/** Counts up on mount. Respects reduced motion by jumping to the end. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutExpo, matching EASE_AETHER's deceleration feel
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setValue(target * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration])

  return value
}

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (v: number) => string
  className?: string
}) {
  const animated = useCountUp(value)
  return <span className={cn('tabular', className)}>{format(animated)}</span>
}

/**
 * KPI tile. `tone` colours the value for P&L-style metrics; `hint` explains
 * how the number is computed so no metric is unexplained (§4).
 */
export function Stat({
  label,
  value,
  delta,
  tone = 'neutral',
  hint,
  loading,
  className,
}: {
  label: string
  value: React.ReactNode
  delta?: string
  tone?: 'neutral' | 'profit' | 'loss'
  hint?: string
  loading?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-[0.04em] text-tertiary uppercase">
          {label}
        </span>
        {hint ? (
          <Tooltip content={hint}>
            <button
              type="button"
              aria-label={`About ${label}`}
              className="cursor-help text-tertiary transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3" />
            </button>
          </Tooltip>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'tabular text-2xl font-semibold tracking-[-0.02em]',
              tone === 'profit' && 'text-profit',
              tone === 'loss' && 'text-loss',
            )}
          >
            {value}
          </span>
          {delta ? (
            <span
              className={cn(
                'tabular text-xs font-medium',
                tone === 'profit' && 'text-profit',
                tone === 'loss' && 'text-loss',
                tone === 'neutral' && 'text-muted-foreground',
              )}
            >
              {delta}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** Compact label/value row for detail panels and config summaries. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="tabular text-[13px] font-medium">{value}</span>
    </div>
  )
}
