'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-left text-[13px]', className)}
        {...props}
      />
    </div>
  )
}

export function THead({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-card [&_th]:border-b [&_th]:border-border', className)}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={className} {...props} />
}

export function TR({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors last:border-0 hover:bg-secondary/60',
        className,
      )}
      {...props}
    />
  )
}

export function TH({
  className,
  numeric,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-[11px] font-medium tracking-[0.04em] text-tertiary uppercase',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function TD({
  className,
  numeric,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn('px-3 py-2.5 align-middle', numeric && 'tabular text-right', className)}
      {...props}
    />
  )
}

/** Clickable sort header. `dir` is null when this column is not the active sort. */
export function SortHeader({
  label,
  dir,
  onClick,
  numeric,
  className,
}: {
  label: string
  dir: 'asc' | 'desc' | null
  onClick: () => void
  numeric?: boolean
  className?: string
}) {
  return (
    <TH numeric={numeric} className={cn('p-0', className)}>
      <button
        onClick={onClick}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1 px-3 py-2.5 transition-colors hover:text-foreground',
          numeric && 'justify-end',
          dir && 'text-foreground',
        )}
      >
        {label}
        {dir === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : dir === 'desc' ? (
          <ArrowDown className="size-3" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TH>
  )
}
