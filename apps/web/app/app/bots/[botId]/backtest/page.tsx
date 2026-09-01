'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Bot as BotIcon, Info } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { useBot } from '@/lib/workspace-store'
import { getBot } from '@/lib/bots'
import { BotHeader } from '@/components/bot/bot-header'
import { ConfigPanel, type BacktestConfigValues } from '@/components/backtest/config-panel'
import { RunProgress } from '@/components/backtest/run-progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function BotBacktestConfigPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()

  const storeBot = useBot(botId)
  const [bot, setBot] = useState<Bot | null>(storeBot || null)
  const [loading, setLoading] = useState(!storeBot)

  const [step, setStep] = useState<'configuring' | 'running' | 'done'>('configuring')
  const [configValues, setConfigValues] = useState<BacktestConfigValues | null>(null)

  useEffect(() => {
    let active = true

    const fetchBot = async () => {
      if (!botId) return
      try {
        const fetched = await getBot(botId)
        if (active) {
          if (fetched) {
            setBot(fetched)
          } else if (storeBot) {
            setBot(storeBot)
          }
        }
      } catch (err) {
        console.error('Failed to load bot for backtest:', err)
        if (active && storeBot) {
          setBot(storeBot)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchBot()

    return () => {
      active = false
    }
  }, [botId, storeBot])

  const handleStartRun = (config: BacktestConfigValues) => {
    setConfigValues(config)
    setStep('running')
  }

  const handleComplete = (run: BacktestRun) => {
    setStep('done')
    router.replace(`/app/bots/${botId}/backtest/${run.id}`)
  }

  if (loading) {
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
            <div className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs text-foreground/90 leading-relaxed">
              <Info className="size-4 text-brand shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-brand block mb-0.5">What is a Strategy Backtest?</span>
                Backtesting replays your bot&apos;s execution graph against verified 15m Binance historical crypto data. It computes authentic fills with volume-scaled market impact slippage and fee deductions to give you real Sharpe ratios and equity curves.
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
