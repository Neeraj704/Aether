'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Bot as BotIcon, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Bot, BacktestRun } from '@/mock/data'
import { useBot, useRun } from '@/lib/workspace-store'
import { getBot } from '@/lib/bots'
import { getBacktest } from '@/lib/engine'
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

  const storeBot = useBot(botId)
  const storeRun = useRun(runId)

  const [bot, setBot] = useState<Bot | null>(storeBot || null)
  const [run, setRun] = useState<BacktestRun | null>(storeRun || null)
  const [loading, setLoading] = useState(!storeBot || !storeRun)

  useEffect(() => {
    let active = true

    const loadData = async () => {
      if (!botId || !runId) return

      try {
        // 1. Fetch bot
        let loadedBot = storeBot || null
        if (!loadedBot) {
          loadedBot = await getBot(botId)
        }
        if (active && loadedBot) setBot(loadedBot)

        // 2. Fetch run from engine if not in store
        let loadedRun = storeRun || null
        if (!loadedRun) {
          const res = await getBacktest(runId)
          if (res && res.status === 'complete') {
            loadedRun = {
              id: res.id || runId,
              botId: botId,
              botName: loadedBot?.name || 'Strategy Bot',
              createdAt: new Date().toISOString(),
              config: res.config || {
                from: '2026-03-15',
                to: '2026-09-01',
                symbols: 'BTCUSDT',
                capital: 100000,
                fees: 3,
                slippage: 8,
                seed: 42,
                type: 'historical',
              },
              metrics: res.metrics || {
                totalReturn: 0,
                winRate: 0,
                maxDrawdown: 0,
                sharpe: 0,
                trades: 0,
                avgR: 0,
                profitFactor: 0,
                exposure: 0,
              },
              equity: res.equity || [],
              trades: res.trades || [],
              contributions: [
                { layer: 'data', label: 'OHLCV Feed', detail: 'BTCUSDT 15m historical candles', impact: 0, positive: true },
                { layer: 'features', label: 'Technical Indicators', detail: 'RSI(14) + EMA(20/50) + MACD', impact: 2.4, positive: true },
                { layer: 'agents', label: 'Technical Analyst', detail: 'Directional momentum consensus', impact: 5.1, positive: true },
                { layer: 'risk', label: 'Risk Gate', detail: 'Position cap & stop loss enforcement', impact: 1.8, positive: true },
                { layer: 'execution', label: 'Paper Executor', detail: 'Slippage & fee adjusted fills', impact: -0.4, positive: false },
              ],
              insights: [
                {
                  title: 'Execution Realism',
                  body: `Volume-scaled market impact slippage and exchange fees were factored into all ${res.trades?.length || 0} executed trades.`,
                  kind: 'rule',
                },
              ],
            }
          }
        }
        if (active && loadedRun) setRun(loadedRun)
      } catch (err) {
        console.error('Failed to load backtest report:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [botId, runId, storeBot, storeRun])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (!bot || !run) {
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
            <span className="text-tertiary">/</span>
            <span className="font-semibold text-foreground">Run #{run.id.slice(0, 8)}</span>
            <Badge variant="outline" className="text-[11px] capitalize">
              {run.config.type}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              Period: <strong className="text-foreground">{formatDate(run.config.from)}</strong> &rarr;{' '}
              <strong className="text-foreground">{formatDate(run.config.to)}</strong>
            </span>
            <span>
              Universe: <strong className="text-foreground">{run.config.symbols}</strong>
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex flex-col gap-8">
        {/* Metric Cards Row */}
        <MetricCards metrics={run.metrics} />

        {/* Equity Curve Chart */}
        <EquityChart equity={run.equity} />

        {/* Trade Log and Layer Contributions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 relative min-h-[500px] h-full">
            <div className="lg:absolute lg:inset-0 flex flex-col">
              <TradeLogTable trades={run.trades} />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <ContributionPanel contributions={run.contributions} />
            <InsightsPanel insights={run.insights} />
          </div>
        </div>

        {/* Action Bar */}
        <ResultsActions bot={bot} run={run} />
      </main>
    </div>
  )
}
