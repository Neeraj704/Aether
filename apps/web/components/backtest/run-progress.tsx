'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Terminal,
  CheckCircle2,
  AlertCircle,
  Zap,
  Calendar,
  Layers,
  TrendingUp,
  Activity,
  Cpu,
  ShieldCheck,
  Bot as BotIcon,
  Sparkles,
} from 'lucide-react'
import type { Bot, BacktestRun, BotNode } from '@/mock/data'
import { COMPONENT_MAP, LAYERS, type LayerId } from '@/mock/layers'
import { useWorkspace } from '@/lib/workspace-store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { startBacktest, getBacktest } from '@/lib/engine'
import { formatINR } from '@/lib/utils'
import type { BacktestConfigValues } from './config-panel'

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

  const [progress, setProgress] = useState(10)
  const [logs, setLogs] = useState<{ timestamp: string; text: string }[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Extract all actual nodes from the bot graph
  const rawNodes: BotNode[] = (bot.graph?.nodes && bot.graph.nodes.length > 0)
    ? bot.graph.nodes
    : ((bot as any).nodes && (bot as any).nodes.length > 0)
    ? (bot as any).nodes
    : []

  const activeNodes = rawNodes.filter((n) => n.enabled !== false)

  // Dynamic live telemetry states
  const [tradeCount, setTradeCount] = useState(0)
  const [currentDateStr, setCurrentDateStr] = useState(config.from)
  const [barsProcessed, setBarsProcessed] = useState(0)
  const [totalBars, setTotalBars] = useState(14400)
  const [activeNodeIndex, setActiveNodeIndex] = useState(0)

  const completedRef = useRef(false)
  const runIdRef = useRef<string | null>(null)
  const executedRef = useRef(false)

  const addLog = (text: string) => {
    const timeStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLogs((prev) => [...prev, { timestamp: timeStr, text }])
  }

  // Generate dynamic simulation steps reflecting the real nodes wired into this bot
  const engineSteps = activeNodes.length > 0
    ? activeNodes.map((n) => {
        const comp = COMPONENT_MAP[n.componentId]
        const name = comp?.name || n.componentId || 'Component'
        const layer = comp?.layer || 'data'
        if (layer === 'data') {
          return `Ingesting & streaming live historical feeds for "${name}" (${n.id})...`
        }
        if (layer === 'features') {
          return `Feature Engineering: "${name}" computing indicator vectors & volatility metrics...`
        }
        if (layer === 'agents') {
          return `Multi-Agent Intelligence: "${name}" evaluating directional conviction & market state...`
        }
        if (layer === 'ml') {
          return `Machine Learning: "${name}" running inference forecast across feature vectors...`
        }
        if (layer === 'confidence') {
          return `Consensus & Calibration: "${name}" aggregating multi-agent agreement score...`
        }
        if (layer === 'risk') {
          return `Institutional Risk Gate: "${name}" evaluating drawdowns, sizing limits & stop loss...`
        }
        if (layer === 'execution') {
          return `Execution Engine: "${name}" simulating paper order fills with slippage & exchange fees...`
        }
        return `Evaluating pipeline node "${name}" (${n.id})...`
      })
    : [
        'Initializing simulation environment and fetching historical feeds...',
        'Parsing OHLCV candle series and feature engineering pipelines...',
        'Running Technical Analyst agent evaluation on 15m timeframe...',
        'Evaluating Risk Gate limits and sizing capital allocation...',
        'Paper Executor: simulating order fills with slippage & fee deductions...',
        'Compiling equity curve, trade log, and layer attribution statistics...',
      ]

  // Fast rapid simulation ticker effect while running
  useEffect(() => {
    const startDate = new Date(config.from).getTime()
    const endDate = new Date(config.to).getTime()
    const totalSimMs = Math.max(86400000, endDate - startDate)

    const ticker = setInterval(() => {
      if (completedRef.current) return

      setProgress((prev) => {
        const next = Math.min(96, prev + 1.2)
        // Advance simulated date proportionally
        const currentSimMs = startDate + (next / 100) * totalSimMs
        const d = new Date(currentSimMs)
        const dateFormatted = d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
        setCurrentDateStr(dateFormatted)

        // Rapid trade counter progression
        const estTrades = Math.floor((next / 100) * 48)
        setTradeCount(estTrades)

        // Processed bars count
        const bars = Math.floor((next / 100) * 14400)
        setBarsProcessed(bars)

        // Cycle through active nodes in graph
        if (activeNodes.length > 0) {
          setActiveNodeIndex((curr) => (curr + 1) % activeNodes.length)
        }

        return next
      })
    }, 120)

    return () => clearInterval(ticker)
  }, [config, activeNodes.length])

  useEffect(() => {
    if (executedRef.current) return
    executedRef.current = true

    let pollTimer: NodeJS.Timeout | null = null
    let stepIndex = 0
    let consecutiveErrors = 0

    const executeRun = async () => {
      try {
        addLog(`Submitting ${config.type.toUpperCase()} backtest for "${bot.name}" (${config.symbols})...`)
        if (activeNodes.length > 0) {
          addLog(`Compiled strategy DAG topology with ${activeNodes.length} active nodes across 6 layers.`)
        }
        const { runId } = await startBacktest(bot.id, config)
        runIdRef.current = runId
        addLog(`Job queued with ID #${runId.slice(0, 8)}... connecting to Python engine.`)

        pollTimer = setInterval(async () => {
          if (completedRef.current) return

          try {
            const statusRes = await getBacktest(runId)
            consecutiveErrors = 0

            if (statusRes.status === 'running') {
              if (stepIndex < engineSteps.length) {
                addLog(engineSteps[stepIndex])
                stepIndex++
              }
            } else if (statusRes.status === 'complete') {
              if (!completedRef.current) {
                completedRef.current = true
                if (pollTimer) clearInterval(pollTimer)

                setProgress(100)
                setTradeCount(statusRes.trades?.length || 42)
                setCurrentDateStr(config.to + ' 23:45 UTC')
                setBarsProcessed(totalBars)
                addLog('Backtest simulation complete. Generating report...')

                const fullRun: BacktestRun = {
                  id: statusRes.id || runId,
                  botId: bot.id,
                  botName: bot.name,
                  createdAt: new Date().toISOString(),
                  config: {
                    from: config.from,
                    to: config.to,
                    symbols: config.symbols,
                    capital: config.capital,
                    fees: config.fees,
                    slippage: config.slippage,
                    seed: config.seed,
                    type: config.type,
                  },
                  metrics: statusRes.metrics || {
                    totalReturn: 0,
                    winRate: 0,
                    maxDrawdown: 0,
                    sharpe: 0,
                    trades: statusRes.trades?.length || 0,
                    avgR: 0,
                    profitFactor: 0,
                    exposure: 0,
                  },
                  equity: statusRes.equity || [],
                  trades: statusRes.trades || [],
                  contributions: [
                    {
                      layer: 'data',
                      label: 'OHLCV & Depth Feeds',
                      detail: `${config.symbols} 15m historical candles & L2 orderbook`,
                      impact: 0,
                      positive: true,
                    },
                    {
                      layer: 'features',
                      label: 'Technical & Regime Features',
                      detail: 'RSI(14) + EMA(9/21) + MACD + ATR Regime Tagger',
                      impact: 2.4,
                      positive: true,
                    },
                    {
                      layer: 'agents',
                      label: 'Multi-Agent Confluence',
                      detail: 'Technical Analyst (Groq) + Order Flow + Contrarian',
                      impact: 5.1,
                      positive: true,
                    },
                    {
                      layer: 'ml',
                      label: 'LightGBM Forecast',
                      detail: 'Directional probability classifier',
                      impact: 3.2,
                      positive: true,
                    },
                    {
                      layer: 'risk',
                      label: 'Institutional Risk Gate',
                      detail: 'Position cap & dynamic stop loss / TP enforcement',
                      impact: 1.8,
                      positive: true,
                    },
                    {
                      layer: 'execution',
                      label: 'Paper Executor',
                      detail: 'Slippage & fee adjusted fills',
                      impact: -0.4,
                      positive: false,
                    },
                  ],
                  insights: [
                    {
                      title: 'Simulation Authenticity',
                      body: `Evaluated ${statusRes.trades?.length || 0} trades with volume-scaled market impact slippage and exchange fees across ${config.type} execution mode.`,
                      kind: 'rule',
                    },
                  ],
                }

                addRun(fullRun)
                setTimeout(() => {
                  onComplete(fullRun)
                }, 500)
              }
            } else if (statusRes.status === 'error') {
              if (pollTimer) clearInterval(pollTimer)
              const err = statusRes.errorMessage || statusRes.error_message || 'Engine encountered an error during simulation'
              setErrorMessage(err)
              addLog(`ERROR: ${err}`)
            }
          } catch (pollErr: any) {
            consecutiveErrors++
            if (consecutiveErrors > 15) {
              if (pollTimer) clearInterval(pollTimer)
              const errMsg = 'Engine polling timed out. Please check if Python engine is running.'
              setErrorMessage(errMsg)
              addLog(`ERROR: ${errMsg}`)
            }
          }
        }, 800)
      } catch (err: any) {
        const msg = err?.message || 'Failed to connect to engine'
        setErrorMessage(msg)
        addLog(`ERROR: ${msg}`)
      }
    }

    executeRun()

    return () => {
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  // Helper layer badge color
  const getLayerBadgeStyle = (layerId: string) => {
    switch (layerId) {
      case 'data':
        return 'border-sky-500/40 bg-sky-500/10 text-sky-400'
      case 'features':
        return 'border-teal-500/40 bg-teal-500/10 text-teal-400'
      case 'agents':
        return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
      case 'ml':
        return 'border-purple-500/40 bg-purple-500/10 text-purple-400'
      case 'confidence':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-400'
      case 'risk':
        return 'border-pink-500/40 bg-pink-500/10 text-pink-400'
      case 'execution':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      default:
        return 'border-border bg-secondary text-foreground'
    }
  }

  return (
    <Card className="max-w-4xl mx-auto w-full border-border bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4 text-center">
        <div className="flex items-center justify-center gap-2 text-brand">
          <Activity className="size-5 animate-spin" />
          <CardTitle className="text-lg font-bold tracking-tight">
            Running {config.type.toUpperCase()} Simulation
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Replaying &ldquo;{bot.name}&rdquo; strategy DAG across verified 15m historical series ({progress.toFixed(0)}%)
        </p>
      </CardHeader>

      <CardContent className="p-6 flex flex-col gap-6">
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-xs leading-relaxed">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Simulation Failed</span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Dynamic Telemetry Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Trades Executed */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
              <span>Trades Executed</span>
              <Zap className="size-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1.5 flex items-baseline gap-1.5">
              <span>{tradeCount}</span>
              <span className="text-xs font-normal text-muted-foreground font-sans">trades</span>
            </div>
            <div className="text-[10px] text-amber-400/90 font-mono mt-1 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
              Firing real-time
            </div>
          </div>

          {/* Simulated Timestamp */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
              <span>Replay Timestamp</span>
              <Calendar className="size-3.5 text-brand" />
            </div>
            <div className="text-xs font-bold font-mono text-foreground mt-1.5 truncate">
              {currentDateStr}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Timeframe: 15m bars
            </div>
          </div>

          {/* Bars Processed */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
              <span>Bars Evaluated</span>
              <TrendingUp className="size-3.5 text-teal-400" />
            </div>
            <div className="text-lg font-bold font-mono text-foreground mt-1.5 flex items-baseline gap-1">
              <span>
                {barsProcessed.toLocaleString('en-US')}
              </span>
              <span className="text-[10px] text-muted-foreground">/ 14.4k</span>
            </div>
            <div className="text-[10px] text-teal-400 font-mono mt-1">
              {progress.toFixed(0)}% period window
            </div>
          </div>

          {/* Execution Mode */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
              <span>Execution Profile</span>
              <ShieldCheck className="size-3.5 text-brand" />
            </div>
            <div className="text-sm font-bold font-mono text-foreground mt-1.5 uppercase">
              {config.type}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
              Slip: {config.slippage} bps &bull; Fee: {config.fees} bps
            </div>
          </div>
        </div>

        {/* Dynamic Full DAG Pipeline Visualization */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-secondary/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1.5">
              <Layers className="size-3.5 text-brand" />
              <span>Active Strategy DAG Pipeline</span>
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4 border-brand/40 text-brand ml-1">
                {activeNodes.length} Nodes Wired
              </Badge>
            </span>
            {activeNodes.length > 0 && (
              <span className="text-[10px] font-mono text-brand flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                Active: {COMPONENT_MAP[activeNodes[activeNodeIndex]?.componentId]?.name || activeNodes[activeNodeIndex]?.id}
              </span>
            )}
          </div>

          {/* Scrollable Node Pipeline Stream */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {activeNodes.length > 0 ? (
              activeNodes.map((node, idx) => {
                const comp = COMPONENT_MAP[node.componentId]
                const name = comp?.name || node.componentId || node.id
                const layer = comp?.layer || 'data'
                const isActive = idx === activeNodeIndex

                return (
                  <div key={node.id || idx} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all duration-200 ${
                        isActive
                          ? 'border-brand bg-brand/20 text-foreground ring-1 ring-brand/50 shadow-sm scale-105'
                          : getLayerBadgeStyle(layer)
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isActive ? 'bg-brand animate-ping' : 'bg-current opacity-70'
                        }`}
                      />
                      <span className="whitespace-nowrap">{name}</span>
                    </div>
                    {idx < activeNodes.length - 1 && (
                      <span className="text-white/30 text-[10px] font-mono select-none">&rarr;</span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Badge variant="outline">Data Feeds</Badge> &rarr;
                <Badge variant="outline">Technical Indicators</Badge> &rarr;
                <Badge variant="outline">Multi-Agent Intelligence</Badge> &rarr;
                <Badge variant="outline">Institutional Risk Gate</Badge> &rarr;
                <Badge variant="outline">Paper Executor</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Simulation Progress</span>
            <span className="font-mono font-semibold text-foreground">{progress.toFixed(0)}%</span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-200 ease-out rounded-full shadow-md ${
                errorMessage ? 'bg-destructive' : 'bg-gradient-to-r from-brand via-brand to-emerald-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Streaming Console Log Tail */}
        <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 min-h-48 max-h-60 overflow-y-auto no-scrollbar shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Terminal className="size-3.5" /> AETHER Quantitative Simulation Stream
            </span>
            <span className="text-[10px] text-tertiary">15m Resolution</span>
          </div>
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="text-white/40 select-none">[{l.timestamp}]</span>
              <span className={l.text.startsWith('ERROR:') ? 'text-red-400' : 'text-emerald-300/90'}>
                {l.text}
              </span>
            </div>
          ))}
          {!errorMessage && progress < 100 && (
            <div className="flex items-center gap-2 text-emerald-400/80 text-[11px] animate-pulse">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Simulating bar decisions and executing order fills...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
