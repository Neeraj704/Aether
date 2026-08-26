'use client'

import type { BacktestMetrics } from '@/mock/data'
import { Stat } from '@/components/ui/stat'
import { formatPct } from '@/lib/utils'

export function MetricCards({ metrics }: { metrics: BacktestMetrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4 rounded-xl border border-border bg-card">
      <Stat
        label="Total Return"
        value={formatPct(metrics.totalReturn)}
        tone={metrics.totalReturn >= 0 ? 'profit' : 'loss'}
        hint="Cumulative performance over the backtest period relative to initial capital."
      />
      <Stat
        label="Win Rate"
        value={`${metrics.winRate.toFixed(1)}%`}
        hint="Percentage of closed trades that resulted in a positive P&L."
      />
      <Stat
        label="Max Drawdown"
        value={formatPct(metrics.maxDrawdown)}
        tone="loss"
        hint="Largest peak-to-trough decline in equity during the test."
      />
      <Stat
        label="Sharpe Ratio"
        value={metrics.sharpe.toFixed(2)}
        hint="Risk-adjusted return ratio measuring excess return per unit of volatility."
      />
      <Stat
        label="Total Trades"
        value={metrics.trades}
        hint="Total count of completed long and short trades."
      />
      <Stat
        label="Avg R-Multiple"
        value={`${metrics.avgR.toFixed(2)}R`}
        hint="Average trade profit normalized by risk taken (R)."
      />
      <Stat
        label="Profit Factor"
        value={metrics.profitFactor.toFixed(2)}
        hint="Ratio of total gross profits to total gross losses."
      />
      <Stat
        label="Exposure"
        value={`${metrics.exposure.toFixed(1)}%`}
        hint="Percentage of time the strategy held active open market positions."
      />
    </div>
  )
}
