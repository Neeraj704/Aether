'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LineChart, Globe, Download } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { downloadBotExport } from '@/lib/graph-utils'
import { Stat } from '@/components/ui/stat'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatPct } from '@/lib/utils'
import { GraphThumbnail } from './graph-thumbnail'

export function OverviewTab({ bot }: { bot: Bot }) {
  const router = useRouter()
  const runs = useWorkspace((s) => s.runs).filter((r) => r.botId === bot.id)
  const recentRuns = runs.slice(0, 3)

  const handlePublish = () => {
    router.push(`/app/marketplace/publish/${bot.id}`)
  }

  const handleExport = () => {
    downloadBotExport(bot)
    toast.success('Strategy Exported', `Saved ${bot.name}.aether.json`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Thumbnail + Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <GraphThumbnail botId={bot.id} nodes={bot.graph?.nodes ?? (bot as any).nodes ?? []} />
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-border bg-card">
          <Stat label="Nodes" value={bot.graph?.nodes?.length ?? (bot as any).nodes?.length ?? 0} hint="Total component nodes in graph" />
          <Stat label="Versions" value={bot.versions.length} hint="Saved strategy revisions" />
          <Stat label="Total Backtests" value={bot.runIds.length} hint="Historical simulation runs" />
          <Stat
            label={bot.headlineMetric.label || 'Headline Metric'}
            value={bot.headlineMetric.value || '—'}
            tone={bot.headlineMetric.positive ? 'profit' : 'loss'}
            hint="Latest verified performance metric"
          />
        </div>
      </div>

      {/* Description & Tags */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Strategy Overview</CardTitle>
          <div className="flex items-center gap-2">
            <PillButton variant="secondary" size="sm" onClick={handleExport}>
              <Download className="size-3.5 mr-1" /> Export JSON
            </PillButton>
            <PillButton variant="secondary" size="sm" onClick={handlePublish}>
              <Globe className="size-3.5 mr-1" /> Publish to marketplace
            </PillButton>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {bot.description ? bot.description : <span className="italic text-tertiary">No description provided yet.</span>}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-tertiary">Tags:</span>
            {bot.tags.length > 0 ? (
              bot.tags.map((t) => (
                <Badge key={t} variant="neutral" size="sm">
                  #{t}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-tertiary italic">None</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Backtest Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Backtests</CardTitle>
          {recentRuns.length > 0 && (
            <PillLink href={`/app/bots/${bot.id}/backtest`} size="sm">
              Run new backtest
            </PillLink>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {recentRuns.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No backtests yet"
              description="Run a backtest to simulate this strategy on historical market data."
              action={{ label: 'Run your first backtest', href: `/app/bots/${bot.id}/backtest` }}
            />
          ) : (
            <div className="divide-y divide-border">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatDate(run.createdAt, { withTime: true })}</span>
                      <Badge variant="outline" size="sm" className="capitalize">
                        {run.config.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-tertiary">
                      Symbols: {run.config.symbols} &bull; Capital: ₹{run.config.capital.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-tertiary">Total Return</span>
                      <span className={`text-sm font-bold tabular ${run.metrics.totalReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatPct(run.metrics.totalReturn)}
                      </span>
                    </div>

                    <Link
                      href={`/app/bots/${bot.id}/backtest/${run.id}`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      View report &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
