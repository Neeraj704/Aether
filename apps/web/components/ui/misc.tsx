'use client'

import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import { cn } from '@/lib/utils'

export function Separator({
  className,
  vertical,
}: {
  className?: string
  vertical?: boolean
}) {
  return (
    <div
      role="separator"
      className={cn(vertical ? 'w-px self-stretch' : 'h-px w-full', 'bg-border', className)}
    />
  )
}

export function Progress({
  value,
  max = 100,
  tone = 'brand',
  className,
}: {
  value: number
  max?: number
  tone?: 'brand' | 'profit' | 'loss' | 'warn' | 'gold'
  className?: string
}) {
  return (
    <ProgressPrimitive.Root value={value} max={max} className={cn('w-full', className)}>
      <ProgressPrimitive.Track className="h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-input">
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full rounded-[var(--radius-pill)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
            tone === 'brand' && 'bg-brand',
            tone === 'profit' && 'bg-profit',
            tone === 'loss' && 'bg-loss',
            tone === 'warn' && 'bg-warn',
            tone === 'gold' && 'bg-gold',
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export function Avatar({
  initials,
  size = 32,
  className,
}: {
  initials: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-gradient-to-br from-brand to-[#7b61ff] font-semibold text-white select-none',
        className,
      )}
    >
      {initials}
    </span>
  )
}

/** Keyboard shortcut hint. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-border',
        'bg-secondary px-1.5 font-sans text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** Small colour-coded dot, used for port types and layer chips. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: color }}
      className={cn('size-2 shrink-0 rounded-full', className)}
    />
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <span className="eyebrow text-brand">{eyebrow}</span> : null}
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
