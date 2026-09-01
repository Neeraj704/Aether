'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Play, AlertCircle, Coins, Sparkles } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { creditCost } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Segmented } from '@/components/ui/tabs'
import { DataRow } from '@/components/ui/stat'
import { DatePicker } from '@/components/ui/date-picker'

export type BacktestConfigValues = {
  from: string
  to: string
  symbols: string
  capital: number
  fees: number
  slippage: number
  seed: number
  type: BacktestRun['config']['type']
}

// Available Binance 15m historical data bounds cached in database
const EARLIEST_INGESTED_DATE = '2026-03-05'
const LATEST_INGESTED_DATE = '2026-09-01'

export function ConfigPanel({
  bot,
  onStartRun,
}: {
  bot: Bot
  onStartRun: (config: BacktestConfigValues) => void
}) {
  const credits = useSession((s) => s.credits)
  const spendCredits = useSession((s) => s.spendCredits)

  const [from, setFrom] = useState('2026-06-01')
  const [to, setTo] = useState(LATEST_INGESTED_DATE)
  const [symbols, setSymbols] = useState(
    bot.tags.includes('eth') ? 'ETHUSDT' : 'BTCUSDT'
  )
  const [capital, setCapital] = useState(100000)
  const [fees, setFees] = useState(3)
  const [slippage, setSlippage] = useState(8)
  const [seed, setSeed] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [type, setType] = useState<BacktestRun['config']['type']>('historical')

  const cost = creditCost(type, bot.graph?.nodes?.length ?? (bot as any).nodes?.length ?? 0)
  const hasEnoughCredits = credits >= cost

  const handleRun = () => {
    if (!hasEnoughCredits) return
    spendCredits(cost)
    onStartRun({
      from,
      to,
      symbols: symbols.trim() || 'BTCUSDT',
      capital: Number(capital) || 100000,
      fees: Number(fees) || 3,
      slippage: Number(slippage) || 8,
      seed: Number(seed) || 1041,
      type,
    })
  }

  const setPresetRange = (days: number) => {
    const end = new Date(LATEST_INGESTED_DATE + 'T00:00:00')
    const start = new Date(end.getTime() - days * 86400000)
    const startStr = start.toISOString().slice(0, 10)
    const validStart = startStr < EARLIEST_INGESTED_DATE ? EARLIEST_INGESTED_DATE : startStr
    setFrom(validStart)
    setTo(LATEST_INGESTED_DATE)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Simulation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Set up parameters for historical replay against verified Binance 15m market feeds.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Test Type Selection */}
        <Field label="Simulation Engine Type" help="Select how historical bars will be replayed.">
          <div className="pt-1">
            <Segmented<BacktestRun['config']['type']>
              options={[
                { value: 'historical', label: 'Historical Replay' },
                { value: 'paper', label: 'Paper Trading' },
                { value: 'walk-forward', label: 'Walk-Forward' },
                { value: 'monte-carlo', label: 'Monte Carlo' },
              ]}
              value={type}
              onValueChange={setType}
            />
          </div>
        </Field>

        {/* Date Range with Custom DatePicker and Presets */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-foreground">Date Range (Cached Data Available: Mar 2026 – Sep 2026)</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPresetRange(30)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                30D
              </button>
              <button
                type="button"
                onClick={() => setPresetRange(60)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                60D
              </button>
              <button
                type="button"
                onClick={() => setPresetRange(90)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                90D
              </button>
              <button
                type="button"
                onClick={() => setPresetRange(180)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-brand hover:bg-secondary transition-colors"
              >
                Full 180D
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Start Date">
              <DatePicker
                value={from}
                onChange={setFrom}
                minDate={EARLIEST_INGESTED_DATE}
                maxDate={to}
              />
            </Field>
            <Field label="End Date">
              <DatePicker
                value={to}
                onChange={setTo}
                minDate={from}
                maxDate={LATEST_INGESTED_DATE}
              />
            </Field>
          </div>
        </div>

        {/* Symbols & Capital */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Symbols / Universe" help="Available cached symbols: BTCUSDT, ETHUSDT.">
            <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} placeholder="BTCUSDT, ETHUSDT" />
          </Field>
          <Field label="Starting Capital ($ / USDT)">
            <Input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              min={1000}
              step={5000}
            />
          </Field>
        </div>

        {/* Frictions & Seed */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Taker Fees (bps)" help="Exchange trading fees (default: 3 bps)">
            <Input type="number" value={fees} onChange={(e) => setFees(Number(e.target.value))} min={0} />
          </Field>
          <Field label="Slippage (bps)" help="Volume-scaled slippage floor">
            <Input type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} min={0} />
          </Field>
          <Field label="PRNG Seed" help="Deterministic seed for repeatability">
            <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </Field>
        </div>

        {/* Credit Breakdown */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 flex flex-col gap-1">
          <DataRow label="Graph Complexity" value={`${bot.graph?.nodes?.length ?? (bot as any).nodes?.length ?? 0} nodes`} />
          <DataRow label="Estimated Credit Cost" value={`${cost} credits`} />
          <DataRow
            label="Your Credit Balance"
            value={
              <span className="flex items-center gap-1">
                <Coins className="size-3 text-brand" />
                <span className="tabular font-medium">{credits}</span>
              </span>
            }
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="text-xs text-muted-foreground">
          {!hasEnoughCredits ? (
            <span className="flex items-center gap-1.5 text-warn">
              <AlertCircle className="size-3.5" />
              Not enough credits.{' '}
              <Link href="/app/billing/credits" className="font-semibold text-brand hover:underline">
                Top up now
              </Link>
            </span>
          ) : (
            'Ready to run against historical market data.'
          )}
        </div>
        <PillButton
          onClick={handleRun}
          disabled={!hasEnoughCredits}
          className="w-full sm:w-auto gap-2"
        >
          <Play className="size-4 fill-current" />
          Start Simulation
        </PillButton>
      </CardFooter>
    </Card>
  )
}
