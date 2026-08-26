'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Play, AlertCircle, Coins } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { creditCost } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Segmented } from '@/components/ui/tabs'
import { DataRow } from '@/components/ui/stat'

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

export function ConfigPanel({
  bot,
  onStartRun,
}: {
  bot: Bot
  onStartRun: (config: BacktestConfigValues) => void
}) {
  const credits = useSession((s) => s.credits)
  const spendCredits = useSession((s) => s.spendCredits)

  const todayStr = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgoStr = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(ninetyDaysAgoStr)
  const [to, setTo] = useState(todayStr)
  const [symbols, setSymbols] = useState(
    bot.tags.includes('index')
      ? 'NIFTY'
      : bot.tags.includes('options')
      ? 'NIFTY options'
      : bot.tags.includes('news')
      ? 'RELIANCE, HDFCBANK, INFY'
      : 'NIFTY, BANKNIFTY'
  )
  const [capital, setCapital] = useState(500000)
  const [fees, setFees] = useState(3)
  const [slippage, setSlippage] = useState(8)
  const [seed, setSeed] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [type, setType] = useState<BacktestRun['config']['type']>('historical')

  const cost = creditCost(type, bot.nodes.length)
  const hasEnoughCredits = credits >= cost

  const handleRun = () => {
    if (!hasEnoughCredits) return
    spendCredits(cost)
    onStartRun({
      from,
      to,
      symbols: symbols.trim() || 'NIFTY',
      capital: Number(capital) || 500000,
      fees: Number(fees) || 3,
      slippage: Number(slippage) || 8,
      seed: Number(seed) || 1041,
      type,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Simulation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Set up parameters for historical replay, walk-forward testing, or Monte Carlo simulation.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Test Type Selection */}
        <Field label="Simulation Engine Type" help="Select how historical bars will be replayed.">
          <div className="pt-1">
            <Segmented<BacktestRun['config']['type']>
              options={[
                { value: 'historical', label: 'Historical Replay' },
                { value: 'walk-forward', label: 'Walk-Forward' },
                { value: 'monte-carlo', label: 'Monte Carlo' },
                { value: 'paper', label: 'Paper Trading' },
                { value: 'ab', label: 'A/B Compare' },
              ]}
              value={type}
              onValueChange={setType}
            />
          </div>
        </Field>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="From Date">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To Date">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>

        {/* Symbols & Capital */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Symbols / Universe" help="Comma-separated ticker symbols.">
            <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} placeholder="e.g. NIFTY, RELIANCE" />
          </Field>
          <Field label="Starting Capital (₹)">
            <Input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              min={10000}
              step={10000}
            />
          </Field>
        </div>

        {/* Frictions & Seed */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Brokerage / Fees (₹)" help="Estimated per-trade fee">
            <Input type="number" value={fees} onChange={(e) => setFees(Number(e.target.value))} min={0} />
          </Field>
          <Field label="Slippage (bps)" help="Execution slippage in basis points">
            <Input type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} min={0} />
          </Field>
          <Field label="PRNG Seed" help="Deterministic seed for repeatability">
            <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </Field>
        </div>

        {/* Credit Breakdown */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 flex flex-col gap-1">
          <DataRow label="Graph Complexity" value={`${bot.nodes.length} nodes`} />
          <DataRow label="Estimated Credit Cost" value={`${cost} credits`} />
          <DataRow
            label="Your Credit Balance"
            value={
              <span className={`flex items-center gap-1 ${hasEnoughCredits ? 'text-foreground' : 'text-destructive font-bold'}`}>
                <Coins className="size-3.5 text-gold" /> {credits} credits
              </span>
            }
          />
        </div>

        {!hasEnoughCredits && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>You don't have enough credits to run this backtest.</span>
            <Link href="/app/billing/credits" className="font-bold underline ml-auto">
              Top up credits &rarr;
            </Link>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <PillButton onClick={handleRun} disabled={!hasEnoughCredits} size="md">
          <Play className="size-4 mr-1 fill-current" /> Run Backtest
        </PillButton>
      </CardFooter>
    </Card>
  )
}
