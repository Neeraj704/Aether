import { cn } from '@/lib/utils'

/**
 * Solid surface card. Default for anything holding a table, chart or dense
 * text — glass behind data hurts legibility (§4).
 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-[var(--radius-md)] border border-border bg-card text-card-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Glass surface. Chrome and overlays only. */
export function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn('glass rounded-[var(--radius-md)]', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1 border-b border-border px-5 py-4', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-[15px] font-semibold tracking-[-0.01em]', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-[13px] leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center gap-2 border-t border-border px-5 py-3', className)}
      {...props}
    />
  )
}
