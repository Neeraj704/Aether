'use client'

import Link from 'next/link'
import { Bell, Check, Trash2, ArrowUpRight } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { relativeTime } from '@/lib/utils'
import { PillButton } from '@/components/ui/pill-button'

export default function NotificationsPage() {
  const notifications = useWorkspace((s) => s.notifications)
  const markAllRead = useWorkspace((s) => s.markAllRead)
  const markRead = useWorkspace((s) => s.markRead)

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications Log</h1>
          <p className="text-xs text-muted-foreground">
            System updates, backtest completions, and live trade alerts
          </p>
        </div>
        {notifications.some((n) => !n.read) && (
          <PillButton onClick={markAllRead} size="sm" variant="secondary" className="gap-2">
            <Check className="size-3.5" /> Mark all read
          </PillButton>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl">
            <Bell className="size-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold">No notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Notifications will appear here as your bots complete backtests or trigger alerts.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`rounded-xl border p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                n.read ? 'border-border bg-card/50 opacity-80' : 'border-brand/40 bg-brand/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 size-2.5 rounded-full shrink-0 ${
                    n.read ? 'bg-transparent border border-muted-foreground' : 'bg-brand'
                  }`}
                />
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                  <span className="text-[11px] text-tertiary mt-1">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
              </div>

              {n.href && (
                <Link
                  href={n.href}
                  className="text-xs font-semibold text-brand hover:underline shrink-0 flex items-center gap-1"
                >
                  View <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
