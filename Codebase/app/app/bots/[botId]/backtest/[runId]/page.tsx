'use client'

import { useParams } from 'next/navigation'
import { Bot as BotIcon, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useBot, useRun, useHydrated } from '@/lib/workspace-store'
import { BotHeader } from '@/components/bot/bot-header'
import { MetricCards } from '@/components/backtest/metric-cards'
import { EquityChart } from '@/components/backtest/equity-chart'
import { TradeLogTable } from '@/components/backtest/trade-log-table'
import { ContributionPanel } from '@/components/backtest/contribution-panel'
import { InsightsPanel } from '@/components/backtest/insights-panel'
import { ResultsActions } from '@/components/backtest/results-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'

export default function BacktestReportPage() {
  const { botId, runId } = useParams<{ botId: string; runId: string }>()

  const hydrated = useHydrated()
  const bot = useBot(botId)
  const run = useRun(runId)

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (!bot || !run || run.botId !== botId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 max-w-[1400px] mx-auto w-full">
        <EmptyState
          icon={BotIcon}
          title="Backtest report not found"
          description="The requested simulation run report could not be found for this strategy bot."
          action={{ label: 'Back to bot overview', href: `/app/bots/${botId}` }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <BotHeader bot={bot} />

      {/* Sub-header strip for run context */}
      <div className="border-b border-border bg-card/40 px-6 py-3 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto w-full flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <Button render={<Link href={`/app/bots/${botId}?tab=backtests`} />} variant="ghost" size="xs">
              <ArrowLeft className="size-3 mr-1" /> All Backtests
            </Button>

            <span className="text-tertiary">|</span>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Run #{run.id}</span>
              <Badge variant="outline" size="sm" className="capitalize font-mono">
                {run.config.type}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 text-tertiary">
            <span>Range: {run.config.from} &rarr; {run.config.to}</span>
            <span>Created: {formatDate(run.createdAt, { withTime: true })}</span>
            <span className="font-mono">Seed: {run.config.seed}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex flex-col gap-6">
        {/* 1. Metric Cards Grid */}
        <MetricCards metrics={run.metrics} />

        {/* 2. Mandatory Disclaimer Line */}
        <p className="text-[11px] text-tertiary text-center tracking-wide">
          Backtest results describe the past. They do not forecast or guarantee future performance.
        </p>

        {/* 3. Equity Curve Chart */}
        <EquityChart equity={run.equity} />

        {/* 4. Action Bar */}
        <ResultsActions bot={bot} run={run} />

        {/* 5. Trade Log Table */}
        <TradeLogTable trades={run.trades} />

        {/* 6. Contribution & Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContributionPanel contributions={run.contributions} />
          <InsightsPanel insights={run.insights} />
        </div>
      </main>
    </div>
  )
}
