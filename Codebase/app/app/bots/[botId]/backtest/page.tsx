'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bot as BotIcon, Info } from 'lucide-react'
import type { BacktestRun } from '@/mock/data'
import { useBot, useHydrated } from '@/lib/workspace-store'
import { BotHeader } from '@/components/bot/bot-header'
import { ConfigPanel, type BacktestConfigValues } from '@/components/backtest/config-panel'
import { RunProgress } from '@/components/backtest/run-progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function BotBacktestConfigPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()

  const hydrated = useHydrated()
  const bot = useBot(botId)

  const [step, setStep] = useState<'configuring' | 'running' | 'done'>('configuring')
  const [configValues, setConfigValues] = useState<BacktestConfigValues | null>(null)

  const handleStartRun = (config: BacktestConfigValues) => {
    setConfigValues(config)
    setStep('running')
  }

  const handleComplete = (run: BacktestRun) => {
    setStep('done')
    router.replace(`/app/bots/${botId}/backtest/${run.id}`)
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-96 max-w-2xl mx-auto w-full rounded-xl" />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 max-w-[1400px] mx-auto w-full">
        <EmptyState
          icon={BotIcon}
          title="Bot not found"
          description="The requested strategy bot could not be found."
          action={{ label: 'Back to all bots', href: '/app/bots' }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <BotHeader bot={bot} />

      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex flex-col gap-6">
        {step === 'configuring' && (
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
            {/* Friendly explanation blurb */}
            <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs text-foreground/90 leading-relaxed">
              <Info className="size-4 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-brand block mb-0.5">What is a Strategy Backtest?</span>
                Backtesting replays your bot's execution graph against tick-level or candle-level historical market data. It calculates hypothetical P&L, drawdown risk, trade frequency, and agent decision impacts before you risk live capital.
              </div>
            </div>

            <ConfigPanel bot={bot} onStartRun={handleStartRun} />
          </div>
        )}

        {step === 'running' && configValues && (
          <div className="py-8">
            <RunProgress bot={bot} config={configValues} onComplete={handleComplete} />
          </div>
        )}

        {step === 'done' && (
          <div className="flex items-center justify-center py-24 text-sm font-semibold text-muted-foreground animate-pulse">
            Backtest complete &mdash; opening report...
          </div>
        )}
      </main>
    </div>
  )
}
