import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { BotStatus } from '@/mock/data'
import type { PlanTier } from '@/mock/layers'

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-secondary text-secondary-foreground',
        brand: 'border-brand/25 bg-brand/12 text-brand',
        profit: 'border-profit/25 bg-profit/12 text-profit',
        loss: 'border-loss/25 bg-loss/12 text-loss',
        warn: 'border-warn/25 bg-warn/12 text-warn',
        warning: 'border-warn/25 bg-warn/12 text-warn',
        locked: 'border-locked/25 bg-locked/12 text-locked',
        gold: 'border-gold/30 bg-gold/12 text-gold',
        purple: 'border-purple-500/30 bg-purple-500/15 text-purple-400',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
      size: {
        sm: 'h-[18px] px-1.5 text-[10px] tracking-[0.02em]',
        md: 'h-[22px] px-2 text-[11px]',
        lg: 'h-7 px-2.5 text-xs',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
)

export function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

const STATUS_MAP: Record<BotStatus, { label: string; variant: VariantProps<typeof badgeVariants>['variant'] }> = {
  draft: { label: 'Draft', variant: 'outline' },
  backtested: { label: 'Backtested', variant: 'brand' },
  live: { label: 'Live', variant: 'profit' },
  paused: { label: 'Paused', variant: 'warn' },
  error: { label: 'Error', variant: 'loss' },
}

export function StatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: BotStatus
  size?: VariantProps<typeof badgeVariants>['size']
  className?: string
}) {
  const { label, variant } = STATUS_MAP[status]
  return (
    <Badge variant={variant} size={size} className={className}>
      {status === 'live' ? (
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-profit opacity-75" />
          <span className="relative size-1.5 rounded-full bg-profit" />
        </span>
      ) : null}
      {label}
    </Badge>
  )
}

const TIER_MAP: Record<PlanTier, { label: string; variant: VariantProps<typeof badgeVariants>['variant'] }> = {
  free: { label: 'Free', variant: 'outline' },
  starter: { label: 'Starter', variant: 'brand' },
  pro: { label: 'Pro', variant: 'gold' },
  elite: { label: 'Elite', variant: 'purple' },
}

export function TierBadge({
  tier,
  size = 'sm',
  className,
}: {
  tier: PlanTier
  size?: VariantProps<typeof badgeVariants>['size']
  className?: string
}) {
  const { label, variant } = TIER_MAP[tier]
  return (
    <Badge variant={variant} size={size} className={cn('uppercase', className)}>
      {label}
    </Badge>
  )
}

export { badgeVariants }
