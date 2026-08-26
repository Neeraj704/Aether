import Link from 'next/link'
import { Bot, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PillButton, PillLink } from '@/components/ui/pill-button'

/**
 * Every empty state gets an illustration slot, a real explanation and one
 * primary action (§4) — never a bare "No data".
 */
export function EmptyState({
  icon: Icon = Bot,
  title,
  description,
  action,
  secondary,
  className,
}: {
  icon?: LucideIcon
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
  secondary?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="relative flex size-14 items-center justify-center">
        <div className="absolute inset-0 rounded-[var(--radius-md)] bg-brand/10" />
        <Icon className="relative size-6 text-brand" strokeWidth={1.6} />
      </div>

      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>

      {action ? (
        action.href ? (
          <PillLink href={action.href} size="sm">
            {action.label}
          </PillLink>
        ) : (
          <PillButton size="sm" onClick={action.onClick}>
            {action.label}
          </PillButton>
        )
      ) : null}

      {secondary}
    </div>
  )
}

/** Failed-request state. Always offers a retry (§4). */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this data. This is a prototype, so nothing is actually broken upstream.',
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 px-6 py-16 text-center', className)}
    >
      <div className="relative flex size-14 items-center justify-center">
        <div className="absolute inset-0 rounded-[var(--radius-md)] bg-destructive/10" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="relative size-6 text-destructive"
          strokeWidth={1.6}
          stroke="currentColor"
        >
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
          <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <PillButton size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </PillButton>
      ) : null}
    </div>
  )
}

/** Inline "you need a bigger plan" nudge used across gated surfaces. */
export function UpgradeNudge({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-gold/25 bg-gold/8 px-4 py-3',
        className,
      )}
    >
      <p className="text-[13px] text-foreground">{message}</p>
      <Link
        href="/pricing"
        className="text-[13px] font-medium text-gold underline-offset-4 hover:underline"
      >
        Compare plans
      </Link>
    </div>
  )
}
