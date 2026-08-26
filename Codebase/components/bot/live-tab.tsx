'use client'

import { Radio, Activity } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PillLink } from '@/components/ui/pill-button'

export function LiveTab({ bot, onSwitchTab }: { bot: Bot; onSwitchTab?: (tab: string) => void }) {
  const isLive = bot.status === 'live'

  if (!isLive) {
    return (
      <Card>
        <EmptyState
          icon={Radio}
          title="This bot isn't live"
          description="Promote a backtested version to paper trading to start the live monitor."
          action={{
            label: 'Run backtest',
            href: `/app/bots/${bot.id}/backtest`,
          }}
          secondary={
            onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab('backtests')}
                className="text-xs text-brand hover:underline font-medium mt-1"
              >
                Or view existing backtests &rarr;
              </button>
            )
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full bg-profit animate-pulse" />
          <CardTitle>Live Monitor &mdash; {bot.name}</CardTitle>
        </div>
        <PillLink href="/app/live" size="sm">
          Open full live monitor &rarr;
        </PillLink>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="p-4 rounded-lg bg-secondary/40 border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="size-5 text-brand" />
            <div>
              <h4 className="text-sm font-semibold">Active Session</h4>
              <p className="text-xs text-muted-foreground">
                Bot is currently executing simulated signals in real-time.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono bg-profit/15 text-profit px-2.5 py-1 rounded-full font-semibold">
            STATUS: ACTIVE
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
