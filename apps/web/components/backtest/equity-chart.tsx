'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'
import type { EquityPoint } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatINR, formatPct } from '@/lib/utils'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const data: EquityPoint = payload[0]?.payload
  if (!data) return null

  const dateStr = new Date(data.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="glass rounded-xl p-3 border border-border/80 text-xs shadow-xl flex flex-col gap-1.5 min-w-44">
      <span className="font-semibold text-foreground/90 border-b border-border/50 pb-1">
        {dateStr}
      </span>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-brand" /> Strategy Equity:
        </span>
        <span className="font-bold tabular text-foreground">{formatINR(data.equity)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-muted-foreground/40" /> Benchmark:
        </span>
        <span className="font-medium tabular text-muted-foreground">{formatINR(data.benchmark)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
        <span className="text-muted-foreground">Drawdown:</span>
        <span className={`font-semibold tabular ${data.drawdown < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
          {formatPct(data.drawdown)}
        </span>
      </div>
    </div>
  )
}

export function EquityChart({ equity }: { equity: EquityPoint[] }) {
  const formattedData = equity.map((item) => ({
    ...item,
    shortDate: new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Equity Curve vs Benchmark</CardTitle>
          <span className="text-xs text-muted-foreground">
            Replayed strategy performance against benchmark index baseline
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-brand" />
            <span className="font-medium">Strategy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/40" />
            <span className="text-muted-foreground">Benchmark</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} vertical={false} />

              <XAxis
                dataKey="shortDate"
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatINR(v, { compact: true })}
                domain={['auto', 'auto']}
              />

              <RechartsTooltip content={<CustomTooltip />} />

              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="var(--muted-foreground)"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />

              <Area
                type="monotone"
                dataKey="equity"
                stroke="var(--brand)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#equityGradient)"
                activeDot={{ r: 5, fill: 'var(--brand)', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
