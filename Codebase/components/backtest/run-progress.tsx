'use client'

import { useEffect, useState, useRef } from 'react'
import { Terminal, CheckCircle2 } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { generateBacktest } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { slugId } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { BacktestConfigValues } from './config-panel'

const MOCK_STEPS = [
  'Initializing simulation environment and fetching historical feeds...',
  'Parsing OHLCV candle series and feature engineering pipelines...',
  'Running Technical Analyst agent evaluation on 15m timeframe...',
  'Gradient Boosting Forecast: directional signal generated...',
  'Confidence Gate: signal calibrated (score 0.74, threshold 0.60)...',
  'Risk Gate: position cap check passed. Avoided 4 high-drawdown entries...',
  'Paper Executor: simulating order fills with slippage & fee deductions...',
  'Compiling equity curve, trade log, and layer attribution statistics...',
]

export function RunProgress({
  bot,
  config,
  onComplete,
}: {
  bot: Bot
  config: BacktestConfigValues
  onComplete: (run: BacktestRun) => void
}) {
  const addRun = useWorkspace((s) => s.addRun)

  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<{ timestamp: string; text: string }[]>([])
  const completedRef = useRef(false)

  useEffect(() => {
    const totalDuration = config.type === 'monte-carlo' || config.type === 'walk-forward' ? 3800 : 2600
    const stepInterval = totalDuration / MOCK_STEPS.length
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      const pct = Math.min(100, Math.round((currentStep / MOCK_STEPS.length) * 100))
      setProgress(pct)

      if (currentStep <= MOCK_STEPS.length) {
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs((prev) => [...prev, { timestamp: timeStr, text: MOCK_STEPS[currentStep - 1] }])
      }

      if (currentStep >= MOCK_STEPS.length) {
        clearInterval(timer)
        if (!completedRef.current) {
          completedRef.current = true
          setTimeout(() => {
            const run = generateBacktest({
              id: slugId('run'),
              botId: bot.id,
              botName: bot.name,
              from: config.from,
              to: config.to,
              symbols: config.symbols,
              capital: config.capital,
              fees: config.fees,
              slippage: config.slippage,
              seed: config.seed,
              type: config.type,
            })
            addRun(run)
            onComplete(run)
          }, 300)
        }
      }
    }, stepInterval)

    return () => clearInterval(timer)
  }, [bot, config, addRun, onComplete])

  return (
    <Card className="max-w-2xl mx-auto w-full">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-lg flex items-center justify-center gap-2">
          {progress < 100 ? (
            <div className="size-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          ) : (
            <CheckCircle2 className="size-5 text-profit" />
          )}
          Simulating {bot.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Running {config.type} simulation across {config.symbols}... ({progress}%)
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Progress Bar */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-brand transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Streaming Log Tail */}
        <div className="rounded-xl border border-border bg-black/90 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 min-h-56 max-h-72 overflow-y-auto no-scrollbar shadow-inner">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
            <Terminal className="size-3.5" /> AETHER Simulation Console Log Output
          </div>
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="text-tertiary select-none">[{l.timestamp}]</span>
              <span className="text-foreground/90">{l.text}</span>
            </div>
          ))}
          {progress < 100 && (
            <div className="flex items-center gap-1 text-tertiary text-[11px] animate-pulse">
              <span>&gt; Executing step...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
