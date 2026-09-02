'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Radio,
  Terminal,
  Play,
  Pause,
  Zap,
  AlertTriangle,
  Square,
  RefreshCw,
  Activity,
  Layers,
  ShieldCheck,
  Cpu,
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  History,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { Bot } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { formatINR, formatPct, formatDate } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import {
  startLiveSession,
  stopLiveSession,
  getLiveState,
  clearLiveLogs,
  type LiveStateResponse,
  type LiveNodeStep,
  type LiveTrade,
  type LiveLogEntry,
} from '@/lib/engine'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { LivePriceChart } from './live-price-chart'
import { TradeFlowModal, type TradeInspectionData } from './trade-flow-modal'

function formatLogTimestamp(timeStr: string) {
  if (!timeStr) return ''
  // If it already includes milliseconds or formatted IST, return directly
  if (timeStr.includes('.') || timeStr.includes('AM') || timeStr.includes('PM')) return timeStr

  // Fallback conversion for older 24hr UTC timestamps
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    const today = new Date()
    const utcDate = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        parseInt(parts[0], 10),
        parseInt(parts[1], 10),
        parseInt(parts[2] || '0', 10),
      ),
    )
    return utcDate.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }
  return timeStr
}

interface LiveTabProps {
  bot: Bot
  onSwitchTab?: (tab: string) => void
}

export function LiveTab({ bot, onSwitchTab }: LiveTabProps) {
  const { setBotStatus } = useWorkspace()

  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPollingActive, setIsPollingActive] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<string>('all')

  // Start Modal State
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [startSymbol, setStartSymbol] = useState('BTCUSDT')
  const [startCapital, setStartCapital] = useState(100000)

  // Real-time 1-minute countdown timer (synchronized to next candle boundary)
  const [secondsToNextBar, setSecondsToNextBar] = useState(60)

  // Fetch live state from engine (always allowed so we can inspect error/stopped state)
  const fetchState = useCallback(async () => {
    try {
      const state = await getLiveState(bot.id)
      setLiveState(state)
    } catch (err: any) {
      console.warn('[LiveTab] Failed to poll live state:', err)
    } finally {
      setLoading(false)
    }
  }, [bot.id])

  // Initial load
  useEffect(() => {
    fetchState()
  }, [fetchState])

  const session = liveState?.session
  const position = liveState?.position
  const trades = liveState?.trades || []
  const evaluation = liveState?.evaluation
  const steps = evaluation?.steps || []
  const candle = evaluation?.candle
  const logs = liveState?.logs || []

  // Derive execution states
  const isLive = bot.status === 'live' || liveState?.status === 'running'
  const isError = bot.status === 'error' || liveState?.status === 'error' || Boolean(session?.errorMessage)
  const hasSession = Boolean(session)

  // Trade Decision & DAG Flow Inspector State
  const [inspectTrade, setInspectTrade] = useState<TradeInspectionData | null>(null)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)

  const openPositionInspector = () => {
    if (!position) return
    const tradeData: TradeInspectionData = {
      isOpenPosition: true,
      symbol: session?.symbol || 'BTCUSDT',
      side: position.side || 'long',
      size: position.size || 0,
      entryPrice: position.entry_price || 0,
      stopPrice: position.stop_price,
      confidence: position.confidence || 0.75,
      entryTime: position.entry_time || session?.lastBarTime || new Date().toISOString(),
      entryCandle: position.entry_candle,
      entryFeatures: position.entry_features,
      entrySignal: position.entry_signal,
      entryRisk: position.entry_risk,
      rawPosition: position,
    }
    setInspectTrade(tradeData)
    setTradeModalOpen(true)
  }

  const openClosedTradeInspector = (t: LiveTrade) => {
    const flow = (t.executionFlow as any)?.flow || []
    const candleNode = flow.find((f: any) => f.type === 'candle')
    const featuresNode = flow.find((f: any) => f.type === 'features')
    const signalNode = flow.find((f: any) => f.type === 'signal')
    const riskNode = flow.find((f: any) => f.type === 'risk')
    const fillNode = flow.find((f: any) => f.type === 'fill')

    const tradeData: TradeInspectionData = {
      isOpenPosition: false,
      symbol: t.symbol,
      side: t.side,
      size: t.size,
      entryPrice: fillNode?.output?.entryPrice || 0,
      exitPrice: fillNode?.output?.exitPrice || 0,
      stopPrice: riskNode?.output?.stopPrice || null,
      confidence: t.confidence,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      pnl: t.pnl,
      pnlPct: t.pnlPct,
      triggerNode: t.triggerNode,
      entryCandle: candleNode?.output,
      entryFeatures: featuresNode?.output,
      entrySignal: signalNode?.output,
      entryRisk: riskNode?.output,
      executionFlow: t.executionFlow,
    }
    setInspectTrade(tradeData)
    setTradeModalOpen(true)
  }

  // Auto-sync workspace bot status if engine reports error/running
  useEffect(() => {
    if (liveState?.status === 'running' && bot.status !== 'live') {
      setBotStatus(bot.id, 'live')
    } else if (liveState?.status === 'error' && bot.status !== 'error') {
      setBotStatus(bot.id, 'error')
    }
  }, [liveState?.status, bot.status, bot.id, setBotStatus])

  // Countdown timer effect that ticks every second and triggers DAG update at :00
  useEffect(() => {
    if (!isLive || !isPollingActive) return

    const tickCountdown = () => {
      const sec = new Date().getSeconds()
      const remaining = 60 - sec
      setSecondsToNextBar(remaining === 0 ? 60 : remaining)

      // When the minute boundary passes, trigger state/DAG update
      if (sec === 0 || sec === 1) {
        fetchState()
      }
    }

    tickCountdown()
    const timer = setInterval(tickCountdown, 1000)
    return () => clearInterval(timer)
  }, [isLive, isPollingActive, fetchState])

  // Polling loop backup (10s checks when live)
  useEffect(() => {
    if (!isLive || !isPollingActive) return
    const interval = setInterval(fetchState, 10000)
    return () => clearInterval(interval)
  }, [isLive, isPollingActive, fetchState])

  const handleStartLive = async () => {
    setActionLoading(true)
    try {
      await startLiveSession(bot.id, startSymbol.trim().toUpperCase(), startCapital)
      setBotStatus(bot.id, 'live')
      toast.success('Live Loop Started', `${bot.name} is now actively running in scheduled paper trading.`)
      setStartModalOpen(false)
      fetchState()
    } catch (err: any) {
      toast.error('Could Not Start Live', err.message || 'Validation or engine error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStopLive = async () => {
    setActionLoading(true)
    try {
      await stopLiveSession(bot.id)
    } catch (err: any) {
      console.warn('Notice on stopping server session:', err)
    } finally {
      setBotStatus(bot.id, 'paused')
      toast.info('Bot Stopped', `${bot.name} has been paused and the live loop stopped.`)
      fetchState()
      setActionLoading(false)
    }
  }

  // Accumulate logs in local component state across polls (so logs aren't lost after a few minutes)
  const [accumulatedLogs, setAccumulatedLogs] = useState<LiveLogEntry[]>([])

  useEffect(() => {
    if (liveState?.logs && liveState.logs.length > 0) {
      setAccumulatedLogs((prev) => {
        const existingIds = new Set(prev.map((l) => l.id))
        const newUnique = liveState.logs!.filter((l) => !existingIds.has(l.id))
        if (newUnique.length === 0) return prev
        const merged = [...newUnique, ...prev]
        return merged.slice(0, 1500)
      })
    }
  }, [liveState?.logs])

  const handleClearLogs = async () => {
    setAccumulatedLogs([])
    if (liveState) {
      setLiveState({ ...liveState, logs: [] })
    }
    try {
      await clearLiveLogs(bot.id)
    } catch {}
    toast.info('Logs Cleared', 'Execution logs have been cleared.')
  }

  // Trade history filter (all, this session, long, short)
  const [tradeHistoryFilter, setTradeHistoryFilter] = useState<'all' | 'session' | 'long' | 'short'>('all')

  const sessionTrades = useMemo(() => {
    if (!session?.id) return trades
    return trades.filter((t: any) => t.sessionId === session.id)
  }, [trades, session?.id])

  const displayedTrades = useMemo(() => {
    return trades.filter((t: any) => {
      if (tradeHistoryFilter === 'session') {
        return session?.id ? t.sessionId === session.id : true
      }
      if (tradeHistoryFilter === 'long') return t.side === 'long'
      if (tradeHistoryFilter === 'short') return t.side === 'short'
      return true
    })
  }, [trades, tradeHistoryFilter, session?.id])

  // Extract configured resolution & interval from bot graph or backend state
  const ohlcvNode = bot.graph?.nodes?.find((n: any) => n.componentId === 'ohlcv-feed')
  const botResolution = (ohlcvNode?.config?.resolution as string) || liveState?.resolution || '1m'
  const botInterval = (ohlcvNode?.config?.interval as number) || liveState?.interval || (botResolution === '1m' ? 60 : 900)
  const intervalDisplay = botInterval < 60 ? `${botInterval}s` : botResolution

  const currentEquity = session?.equity ?? session?.capital ?? 100000
  const startingCapital = session?.capital ?? 100000
  const totalReturn = startingCapital > 0 ? ((currentEquity - startingCapital) / startingCapital) * 100 : 0

  const logsToDisplay = accumulatedLogs.length > 0 ? accumulatedLogs : (liveState?.logs || [])
  const filteredLogs = logsToDisplay.filter((log) => {
    if (logFilter === 'all') return true
    return log.type === logFilter
  })

  // Extract all symbols configured on bot plus popular crypto pairs for selection
  const availableSymbols = useMemo(() => {
    const list: string[] = []
    if (ohlcvNode?.config?.symbol) {
      list.push(String(ohlcvNode.config.symbol).toUpperCase())
    }
    if (Array.isArray(ohlcvNode?.config?.symbols)) {
      ohlcvNode.config.symbols.forEach((s: string) => {
        const up = String(s).toUpperCase()
        if (!list.includes(up)) list.push(up)
      })
    }
    if (session?.symbol) {
      const up = session.symbol.toUpperCase()
      if (!list.includes(up)) list.unshift(up)
    }
    const defaults = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT']
    defaults.forEach((s) => {
      if (!list.includes(s)) list.push(s)
    })
    return list
  }, [ohlcvNode, session?.symbol])

  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('')
  const activeSymbol = selectedChartSymbol || session?.symbol || candle?.symbol || (ohlcvNode?.config?.symbol as string) || 'BTCUSDT'

  // If bot is not live, has no past session, and has no error record: render clean EmptyState
  if (!isLive && !hasSession && !isError) {
    return (
      <>
        <Card>
          <EmptyState
            icon={Radio}
            title="This bot isn't running live"
            description="Start the scheduled paper-trading loop to execute bars against live Binance feeds."
            action={{
              label: 'Start Live Paper Trading',
              onClick: () => setStartModalOpen(true),
            }}
            secondary={
              onSwitchTab && (
                <button
                  type="button"
                  onClick={() => onSwitchTab('backtests')}
                  className="text-xs text-brand hover:underline font-medium mt-1 cursor-pointer"
                >
                  Or view historical backtests &rarr;
                </button>
              )
            }
          />
        </Card>

        {/* Start Live Dialog */}
        <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Deploy to Scheduled Paper Trading</DialogTitle>
              <DialogDescription>
                Execute this strategy graph automatically on every closed candle using live exchange data.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  <strong>Paper trading only</strong> &mdash; Simulated execution loop. No real funds are at risk.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Trading Pair Symbol</label>
                <Input
                  value={startSymbol}
                  onChange={(e) => setStartSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. BTCUSDT, ETHUSDT"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Simulated Starting Capital (INR / USD)</label>
                <Input
                  type="number"
                  value={startCapital}
                  onChange={(e) => setStartCapital(Number(e.target.value))}
                  min={1000}
                  step={10000}
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setStartModalOpen(false)}>
                Cancel
              </Button>
              <PillButton size="sm" onClick={handleStartLive} disabled={actionLoading}>
                <Play className="size-3.5 mr-1 fill-current" />
                {actionLoading ? 'Validating & Starting...' : 'Start Paper Trading'}
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Active / Error / Past Session View
  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-2.5">
              <span
                className={`absolute inset-0 rounded-full ${
                  isLive && isPollingActive
                    ? 'animate-ping bg-profit opacity-75'
                    : isError
                    ? 'bg-loss'
                    : 'bg-muted-foreground'
                }`}
              />
              <span
                className={`relative size-2.5 rounded-full ${
                  isLive && isPollingActive ? 'bg-profit' : isError ? 'bg-loss' : 'bg-muted-foreground'
                }`}
              />
            </div>
            <CardTitle>Live Paper Monitor &mdash; {bot.name}</CardTitle>
            {isLive ? (
              <span className="text-[10px] font-mono text-profit bg-profit/10 border border-profit/20 rounded-full px-2 py-0.5 animate-pulse">
                {intervalDisplay} Polling Loop Active
              </span>
            ) : isError ? (
              <span className="text-[10px] font-mono text-loss bg-loss/10 border border-loss/30 rounded-full px-2 py-0.5 font-bold">
                Execution Halted (Error)
              </span>
            ) : (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
                Paused
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <button
                  onClick={() => setIsPollingActive(!isPollingActive)}
                  className="h-8 px-2.5 rounded-full border border-border bg-secondary/50 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isPollingActive ? <Pause className="size-3" /> : <Play className="size-3" />}
                  {isPollingActive ? 'Pause Poll' : 'Resume Poll'}
                </button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopLive}
                  disabled={actionLoading}
                  className="text-xs h-8"
                >
                  <Square className="size-3 mr-1 fill-current" />
                  Stop Live
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => setStartModalOpen(true)}
                disabled={actionLoading}
                className="text-xs h-8 bg-brand hover:bg-brand/90"
              >
                <Play className="size-3 mr-1 fill-current" />
                {isError ? 'Restart Live Paper Trading' : 'Resume Paper Trading'}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Diagnostic Error Banner when Bot execution stopped unexpectedly */}
          {isError && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-loss/40 bg-loss/10 text-loss backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 shrink-0 mt-0.5 text-loss" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sm">Execution Loop Halted</span>
                  <span className="text-xs text-loss/90 font-mono break-all">
                    {session?.errorMessage || (bot as any).errorMessage || 'Execution encountered an error and was halted.'}
                  </span>
                  {session?.stoppedAt && (
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Stopped at: {formatDate(session.stoppedAt, { withTime: true })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchState()}
                  className="text-xs h-8"
                >
                  <RefreshCw className="size-3 mr-1" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStartModalOpen(true)}
                  className="text-xs h-8 bg-brand hover:bg-brand/90"
                >
                  <Play className="size-3 mr-1 fill-current" />
                  Restart Live Loop
                </Button>
              </div>
            </div>
          )}

          {/* Paper Trading Notice Banner */}
          <div className="flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <strong>Paper trading only</strong> &mdash; Simulated execution environment. No real funds are being used.
            </span>
          </div>

          {/* Metrics Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current Equity</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-foreground">
                  {formatINR(currentEquity)}
                </span>
                <span className={`text-xs font-mono font-semibold ${totalReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cash Balance</span>
              <span className="text-lg font-bold font-mono text-foreground">
                {formatINR(session?.cash ?? startingCapital)}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1 shadow-sm">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Max Drawdown</span>
              <span className="text-lg font-bold font-mono text-loss">
                {((session?.maxDrawdown ?? 0) * 100).toFixed(2)}%
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between gap-1 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Last Bar Ingested
                </span>
                {isLive && (
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-profit bg-profit/10 border border-profit/25 px-2 py-0.5 rounded-full">
                    <span className="relative flex size-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-profit opacity-75" />
                      <span className="relative size-1.5 rounded-full bg-profit" />
                    </span>
                    <span>Next in {secondsToNextBar}s</span>
                  </div>
                )}
              </div>

              <span className="text-xs font-mono text-foreground font-medium truncate">
                {session?.lastBarTime ? formatDate(session.lastBarTime, { withTime: true }) : `Awaiting next ${botResolution} bar...`}
              </span>

              {/* Smooth 1-minute countdown progress bar */}
              {isLive && (
                <div className="w-full bg-secondary/60 h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-profit transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${((60 - secondsToNextBar) / 60) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Live Market Ingest & Real-Time Price Chart */}
          <LivePriceChart
            symbol={activeSymbol}
            availableSymbols={availableSymbols}
            onSymbolChange={setSelectedChartSymbol}
            defaultTimeframe={botResolution || '1m'}
            currentCandle={candle}
          />

          {/* Live Node Pipeline & Strategy Signal Inspector */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-brand" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                  DAG Node Pipeline & Strategy Inspector
                </h4>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {steps.length} Nodes Evaluated on Latest Tick
              </span>
            </div>

            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
                Waiting for strategy node execution step details...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {steps.map((step: LiveNodeStep) => {
                  const isExpanded = expandedNodeId === step.nodeId
                  return (
                    <div
                      key={step.nodeId}
                      className="rounded-xl border border-border bg-card/60 p-3.5 flex flex-col justify-between gap-2 shadow-sm backdrop-blur-sm transition-all hover:border-brand/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                            {step.layer}
                          </span>
                          <span className="font-semibold text-xs text-foreground">
                            {step.nodeName}
                          </span>
                        </div>

                        {step.metricLabel && (
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                            <span className="text-[9px] text-muted-foreground font-normal uppercase">
                              {step.metricLabel}:
                            </span>
                            <span>{step.metricValue}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-mono">
                        {step.summary || 'Executed cleanly.'}
                      </p>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedNodeId(isExpanded ? null : step.nodeId)}
                          className="text-[10px] font-medium text-brand hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? 'Hide Output JSON' : 'Inspect Output Payload'}
                          {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                        </button>
                        <span className="text-[10px] font-mono text-tertiary">
                          {step.executionTimeMs ? `${step.executionTimeMs}ms` : 'Sync'}
                        </span>
                      </div>

                      {/* Expandable JSON Output Inspection */}
                      {isExpanded && (
                        <div className="mt-2 p-2.5 rounded-lg bg-black/90 border border-border font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-48">
                          <pre>{JSON.stringify(step.output, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active Positions Table Card */}
          <Card className="flex flex-col border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3 px-4 bg-secondary/20">
              <div className="flex items-center gap-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity className="size-3.5 text-brand" />
                  Active Market Position
                </h4>
                {position ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Contract
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Flat
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Symbol: {session?.symbol || 'BTCUSDT'} ({botResolution} Interval)
              </span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {position ? (
                <Table>
                  <THead className="bg-secondary/40 border-b border-border text-[11px]">
                    <TR>
                      <TH>Symbol</TH>
                      <TH>Side</TH>
                      <TH numeric>Position Size</TH>
                      <TH numeric>Entry Price</TH>
                      <TH numeric>Live LTP</TH>
                      <TH numeric>Unrealized P&L (₹)</TH>
                      <TH numeric>P&L %</TH>
                      <TH numeric>Stop Loss</TH>
                      <TH numeric>Confidence</TH>
                      <TH className="text-right pr-4">Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {(() => {
                      const posSize = Number(position.size || 0)
                      const entryP = Number(position.entry_price || 0)
                      const isLong = position.side === 'long'
                      const ltp = Number(candle?.close || entryP)
                      const uPnl = posSize > 0 && entryP > 0
                        ? (isLong ? (ltp - entryP) * posSize : (entryP - ltp) * posSize)
                        : 0
                      const uPnlPct = (entryP * posSize) > 0 ? (uPnl / (entryP * posSize)) * 100 : 0
                      const stopPrice = position.stop_price ? Number(position.stop_price) : null
                      const stopDist = stopPrice && ltp > 0 ? Math.abs((stopPrice - ltp) / ltp) * 100 : null

                      return (
                        <TR
                          onClick={openPositionInspector}
                          className="cursor-pointer transition-colors hover:bg-secondary/60 group"
                        >
                          <TD className="font-bold text-foreground group-hover:text-brand transition-colors">
                            {session?.symbol || 'BTCUSDT'}
                          </TD>
                          <TD>
                            <Badge
                              variant={isLong ? 'profit' : 'loss'}
                              size="sm"
                              className="uppercase font-mono text-[10px] inline-flex items-center gap-0.5"
                            >
                              {isLong ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                              {position.side}
                            </Badge>
                          </TD>
                          <TD numeric className="font-mono text-foreground font-semibold">
                            {posSize < 1 ? posSize.toFixed(4) : posSize.toFixed(2)}
                          </TD>
                          <TD numeric className="font-mono">{formatINR(entryP)}</TD>
                          <TD numeric className="font-mono font-semibold text-foreground">
                            ${ltp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TD>
                          <TD numeric className={`font-mono font-bold ${uPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatINR(uPnl, { signed: true })}
                          </TD>
                          <TD numeric className={`font-mono font-bold ${uPnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {formatPct(uPnlPct)}
                          </TD>
                          <TD numeric className="font-mono text-muted-foreground">
                            {stopPrice ? (
                              <span>
                                {formatINR(stopPrice)}{' '}
                                {stopDist !== null && (
                                  <span className="text-[10px] text-tertiary">({stopDist.toFixed(1)}% away)</span>
                                )}
                              </span>
                            ) : (
                              'None'
                            )}
                          </TD>
                          <TD numeric className="font-mono font-semibold text-brand">
                            {Math.round((position.confidence || 0.75) * 100)}%
                          </TD>
                          <TD className="text-right pr-4">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPositionInspector()
                              }}
                              className="gap-1.5 text-xs font-mono group-hover:border-brand group-hover:text-brand"
                            >
                              <Eye className="size-3.5 text-brand" />
                              Inspect Flow &rarr;
                            </Button>
                          </TD>
                        </TR>
                      )
                    })()}
                  </TBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="size-8 rounded-full bg-secondary/80 flex items-center justify-center text-tertiary">
                    <Zap className="size-4 text-brand animate-pulse" />
                  </div>
                  <p className="font-medium text-foreground text-sm">Currently flat &mdash; No open position</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    The bot is continuously evaluating every {botResolution} candle for setup conditions and will enter upon meeting confidence thresholds.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Closed Trades History Card */}
          <Card className="flex flex-col border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border py-3 px-4 gap-2 bg-secondary/20">
              <div className="flex items-center gap-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <History className="size-3.5 text-brand" />
                  Closed Trades History
                </h4>
                <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                  {trades.length} Total
                </Badge>
              </div>

              {/* Side & Session Filters */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTradeHistoryFilter('all')}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    tradeHistoryFilter === 'all'
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All ({trades.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTradeHistoryFilter('session')}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    tradeHistoryFilter === 'session'
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  This Session ({sessionTrades.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTradeHistoryFilter('long')}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    tradeHistoryFilter === 'long'
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Longs ({trades.filter((t) => t.side === 'long').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTradeHistoryFilter('short')}
                  className={`h-6 px-2.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    tradeHistoryFilter === 'short'
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Shorts ({trades.filter((t) => t.side === 'short').length})
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {displayedTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                  <p className="font-medium text-foreground">No trades closed under this filter</p>
                  <p className="text-[11px]">Trades closed during this or past sessions will appear here with complete audit trail.</p>
                </div>
              ) : (
                <Table>
                  <THead className="bg-secondary/40 border-b border-border text-[11px]">
                    <TR>
                      <TH>Symbol</TH>
                      <TH>Side</TH>
                      <TH>Entry Time (IST)</TH>
                      <TH>Exit Time (IST)</TH>
                      <TH numeric>Position Size</TH>
                      <TH numeric>Realized P&L (₹)</TH>
                      <TH numeric>P&L %</TH>
                      <TH>Exit Trigger</TH>
                      <TH className="text-right pr-4">Execution Flow</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {displayedTrades.map((t) => (
                      <TR
                        key={t.id}
                        onClick={() => openClosedTradeInspector(t)}
                        className="cursor-pointer transition-colors hover:bg-secondary/60 group"
                      >
                        <TD className="font-bold text-foreground group-hover:text-brand transition-colors">
                          {t.symbol}
                        </TD>
                        <TD>
                          <Badge
                            variant={t.side === 'long' ? 'profit' : 'loss'}
                            size="sm"
                            className="uppercase font-mono text-[10px] inline-flex items-center gap-0.5"
                          >
                            {t.side === 'long' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {t.side}
                          </Badge>
                        </TD>
                        <TD className="font-mono text-xs text-muted-foreground">{formatDate(t.entryTime, { withTime: true })}</TD>
                        <TD className="font-mono text-xs text-muted-foreground">{formatDate(t.exitTime, { withTime: true })}</TD>
                        <TD numeric className="font-mono font-semibold text-foreground">
                          {Number(t.size).toFixed(4)}
                        </TD>
                        <TD numeric className={`font-mono font-bold ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatINR(t.pnl, { signed: true })}
                        </TD>
                        <TD numeric className={`font-mono font-bold ${t.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatPct(t.pnlPct)}
                        </TD>
                        <TD className="text-xs font-mono text-muted-foreground">{t.triggerNode || 'Take Profit / Signal'}</TD>
                        <TD className="text-right pr-4">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              openClosedTradeInspector(t)
                            }}
                            className="gap-1.5 text-xs font-mono group-hover:border-brand group-hover:text-brand"
                          >
                            <Eye className="size-3.5 text-brand" />
                            Inspect Flow &rarr;
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Live Execution Console Logs */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary flex items-center gap-2">
                Agent Execution & Scheduling Log
                <span className="text-[10px] font-mono text-profit flex items-center gap-1">
                  <Zap className="size-3" /> APScheduler {intervalDisplay} Loop
                </span>
              </h4>

              {/* Filter Pills & Clear Action */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="h-6 px-2.5 rounded-full border border-border bg-secondary/50 hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive text-muted-foreground text-[10px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer mr-1 shrink-0"
                  title="Clear all logs"
                >
                  <Trash2 className="size-2.5" />
                  Clear
                </button>
                {['all', 'data', 'features', 'signal', 'risk', 'fill', 'system', 'warn'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`h-6 px-2.5 rounded-full text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                      logFilter === f
                        ? 'bg-foreground text-background font-semibold'
                        : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 shadow-inner max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
                <div className="flex items-center gap-2">
                  <Terminal className="size-3.5" /> Engine Stream Log ({bot.name})
                  <span className="text-[10px] text-tertiary font-mono">({filteredLogs.length} events in buffer)</span>
                </div>
                <span className="text-[10px] text-tertiary">
                  Session ID: {session?.id ? session.id.slice(0, 8) : '—'}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {filteredLogs.length === 0 ? (
                  <div className="text-muted-foreground py-4 text-center text-xs">
                    {isLive ? 'Awaiting next scheduled evaluation tick...' : 'No activity logs in buffer.'}
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <motion.div
                      key={log.id ? `${log.id}-${idx}` : `log-${idx}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-start gap-2 leading-relaxed border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                    >
                      <span className="text-tertiary select-none text-[11px] shrink-0 font-mono">
                        [{formatLogTimestamp(log.time)}]
                      </span>
                      <Badge
                        variant={
                          log.type === 'data'
                            ? 'neutral'
                            : log.type === 'features'
                            ? 'brand'
                            : log.type === 'signal'
                            ? 'brand'
                            : log.type === 'risk'
                            ? 'warn'
                            : log.type === 'fill'
                            ? 'profit'
                            : log.type === 'warn'
                            ? 'loss'
                            : 'neutral'
                        }
                        size="sm"
                        className="uppercase text-[9px] shrink-0"
                      >
                        {log.type}
                      </Badge>
                      <span className="text-emerald-400/80 font-semibold shrink-0">[{log.node}]</span>
                      <span className="text-foreground/90 break-all">{log.text}</span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Start Live Dialog */}
      <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Deploy to Scheduled Paper Trading</DialogTitle>
            <DialogDescription>
              Execute this strategy graph automatically on every closed candle using live exchange data.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>Paper trading only</strong> &mdash; Simulated execution loop. No real funds are at risk.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Trading Pair Symbol</label>
              <Input
                value={startSymbol}
                onChange={(e) => setStartSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. BTCUSDT, ETHUSDT"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Simulated Starting Capital (INR / USD)</label>
              <Input
                type="number"
                value={startCapital}
                onChange={(e) => setStartCapital(Number(e.target.value))}
                min={1000}
                step={10000}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setStartModalOpen(false)}>
              Cancel
            </Button>
            <PillButton size="sm" onClick={handleStartLive} disabled={actionLoading}>
              <Play className="size-3.5 mr-1 fill-current" />
              {actionLoading ? 'Validating & Starting...' : 'Start Paper Trading'}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trade Decision & DAG Execution Flow Modal */}
      <TradeFlowModal
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        trade={inspectTrade}
      />
    </>
  )
}
