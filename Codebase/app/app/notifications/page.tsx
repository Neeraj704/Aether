'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Trash2, ArrowUpRight } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { relativeTime, cn } from '@/lib/utils'
import { PillButton } from '@/components/ui/pill-button'
import { Segmented } from '@/components/ui/tabs'
import type { NotificationKind } from '@/mock/data'

const KINDS: { label: string; value: string }[] = [
  { label: 'All types', value: 'all' },
  { label: 'Backtests', value: 'backtest' },
  { label: 'Trades', value: 'trade' },
  { label: 'Risk', value: 'risk' },
  { label: 'Forks', value: 'fork' },
  { label: 'Reviews', value: 'review' },
  { label: 'Payments', value: 'payment' },
  { label: 'Errors', value: 'error' },
  { label: 'System', value: 'system' },
]

export default function NotificationsPage() {
  const notifications = useWorkspace((s) => s.notifications)
  const markAllRead = useWorkspace((s) => s.markAllRead)
  const markRead = useWorkspace((s) => s.markRead)
  const dismissNotification = useWorkspace((s) => s.dismissNotification)

  const [statusFilter, setStatusFilter] = useState<'all' | 'unread'>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')

  const filtered = notifications.filter((n) => {
    const matchStatus = statusFilter === 'all' || !n.read
    const matchKind = kindFilter === 'all' || n.kind === kindFilter
    return matchStatus && matchKind
  })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications Log</h1>
          <p className="text-xs text-muted-foreground">
            System updates, backtest completions, and live trade alerts
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <PillButton onClick={markAllRead} size="sm" variant="secondary" className="gap-2 shrink-0">
            <Check className="size-3.5" /> Mark all read
          </PillButton>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Segmented<'all' | 'unread'>
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: `All (${notifications.length})` },
              { value: 'unread', label: `Unread (${notifications.filter((n) => !n.read).length})` },
            ]}
          />
        </div>

        {/* Kind Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKindFilter(k.value)}
              className={cn(
                'h-7 px-2.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                kindFilter === k.value
                  ? 'bg-brand text-brand-foreground font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl">
            <Bell className="size-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold">No notifications found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {notifications.length === 0
                ? 'Notifications will appear here as your bots complete backtests or trigger alerts.'
                : 'No notifications match your current filter selection.'}
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn(
                'group rounded-xl border p-4 flex items-start justify-between gap-4 transition-all cursor-pointer hover:border-brand/30',
                n.read ? 'border-border bg-card/50 opacity-85' : 'border-brand/40 bg-brand/5',
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={cn(
                    'mt-1.5 size-2.5 rounded-full shrink-0',
                    n.read ? 'bg-transparent border border-muted-foreground' : 'bg-brand',
                  )}
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{n.title}</h3>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                      {n.kind}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                  <span className="text-[11px] text-tertiary mt-1">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.href && (
                  <Link
                    href={n.href}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-brand hover:underline flex items-center gap-1 p-1"
                  >
                    View <ArrowUpRight className="size-3.5" />
                  </Link>
                )}
                <button
                  type="button"
                  title="Dismiss notification"
                  onClick={(e) => {
                    e.stopPropagation()
                    dismissNotification(n.id)
                  }}
                  className="p-1.5 rounded-lg border border-transparent text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
