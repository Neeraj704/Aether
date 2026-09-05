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
  Coins,
  Calculator,
  Volume2,
  VolumeX,
  Flame,
} from 'lucide-react'
import type { Bot } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { cn, formatINR, formatPct, formatDate } from '@/lib/utils'
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

function playFillChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // audio context blocked or unsupported
  }
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
  const [simSpeed, setSimSpeed] = useState<'1x' | '5x' | '15x' | '60x'>('1x')
  const [soundOn, setSoundOn] = useState(true)
  const [simPosition, setSimPosition] = useState<any | null>(null)
  const [simPriceDelta, setSimPriceDelta] = useState<number>(0)

  // Start Modal State
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [startSymbol, setStartSymbol] = useState('BTCUSDT')
  const [startCapital, setStartCapital] = useState(100000)

  // Real-time countdown timer (synchronized to next candle boundary)
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

  // Insufficient credits notification & fallback detection
  const [hasNotifiedCredits, setHasNotifiedCredits] = useState(false)
  const insufficientCreditsNode = useMemo(() => {
    return steps.find((step: LiveNodeStep) => {
      const out = step.output as any
      return out?.audit?.llm_status === 'skipped_insufficient_credits' || (out?.audit?.credits_required > 0 && out?.audit?.llm_status === 'skipped_insufficient_credits')
    })
  }, [steps])

  useEffect(() => {
    if (insufficientCreditsNode && !hasNotifiedCredits) {
      setHasNotifiedCredits(true)
      toast.warn(
        'AI Credits Depleted (0 Credits)',
        `${insufficientCreditsNode.nodeName} has shifted to automated mathematical indicators (RSI/EMA/MACD). Top up credits to resume LLM reasoning.`,
        { label: 'Top Up Credits', href: '/app/billing/topup' },
      )
    } else if (!insufficientCreditsNode && hasNotifiedCredits) {
      setHasNotifiedCredits(false)
    }
  }, [insufficientCreditsNode, hasNotifiedCredits])

  // Simulation trades & position overrides for demo recording
  const [simTrades, setSimTrades] = useState<LiveTrade[]>([])

  // Extract configured resolution & interval from bot graph or backend state
  const ohlcvNode = bot.graph?.nodes?.find((n: any) => n.componentId === 'ohlcv-feed')
  const botResolution = (ohlcvNode?.config?.resolution as string) || liveState?.resolution || '1m'
  const botInterval = (ohlcvNode?.config?.interval as number) || liveState?.interval || (botResolution === '1m' ? 60 : 900)
  const intervalDisplay = botInterval < 60 ? `${botInterval}s` : botResolution

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

  // Active position combining engine position and simulated position
  const activePosition = useMemo(() => {
    if (simPosition) return simPosition
    return position
  }, [simPosition, position])

  // Combined trades list
  const combinedTrades = useMemo(() => {
    return [...simTrades, ...trades]
  }, [simTrades, trades])

  // Trade Decision & DAG Flow Inspector State
  const [inspectTrade, setInspectTrade] = useState<TradeInspectionData | null>(null)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)

  const openPositionInspector = () => {
    if (!activePosition) return
    const tradeData: TradeInspectionData = {
      isOpenPosition: true,
      symbol: session?.symbol || activePosition.symbol || 'BTCUSDT',
      side: activePosition.side || 'long',
      size: activePosition.size || 0,
      entryPrice: activePosition.entry_price || activePosition.entryPrice || 0,
      stopPrice: activePosition.stop_price || activePosition.stopPrice,
      confidence: activePosition.confidence || 0.85,
      entryTime: activePosition.entry_time || activePosition.entryTime || session?.lastBarTime || new Date().toISOString(),
      entryCandle: activePosition.entry_candle,
      entryFeatures: activePosition.entry_features,
      entrySignal: activePosition.entry_signal,
      entryRisk: activePosition.entry_risk,
      rawPosition: activePosition,
    }
    setInspectTrade(tradeData)
    setTradeModalOpen(true)
  }

  const openClosedTradeInspector = (t: LiveTrade) => {
    const ef = (t.executionFlow as any) || {}
    const steps: any[] = Array.isArray(ef.steps) ? ef.steps : Array.isArray(ef.flow) ? ef.flow : []

    const candleNode = steps.find((f: any) => f.nodeId === 'ohlcv-feed' || f.layer === 'data' || f.type === 'candle')
    const featuresNode = steps.find((f: any) => f.nodeId === 'ta-indicators' || f.layer === 'features' || f.type === 'features')
    const signalNode = steps.find((f: any) => f.layer === 'agents' || f.layer === 'models' || f.layer === 'ml' || f.layer === 'signal' || f.nodeId?.includes('agent') || f.nodeId?.includes('forecast') || f.type === 'signal')
    const riskNode = steps.find((f: any) => f.nodeId === 'risk-gate' || f.layer === 'risk' || f.type === 'risk')
    const fillNode = steps.find((f: any) => f.nodeId === 'paper-executor' || f.layer === 'execution' || f.type === 'fill')

    const entryPrice = (t as any).entryPrice || (t as any).entry_price || ef.summary?.entryPrice || fillNode?.output?.entryPrice || candleNode?.output?.close || 0
    const exitPrice = (t as any).exitPrice || (t as any).exit_price || ef.summary?.exitPrice || fillNode?.output?.exitPrice || 0
    const stopPrice = (t as any).stopPrice || (t as any).stop_price || ef.summary?.stopPrice || riskNode?.output?.stopPrice || null
    const size = t.size || ef.summary?.size || fillNode?.output?.size || riskNode?.output?.sizedQuantity || 0

    const tradeData: TradeInspectionData = {
      isOpenPosition: false,
      symbol: t.symbol || ef.symbol || 'BTCUSDT',
      side: t.side || ef.side || 'long',
      size: size,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      stopPrice: stopPrice,
      confidence: t.confidence || ef.summary?.confidence || signalNode?.output?.confidence || 0.75,
      entryTime: t.entryTime || (t as any).entry_time || ef.summary?.entryTime || new Date().toISOString(),
      exitTime: t.exitTime || (t as any).exit_time || ef.summary?.exitTime || null,
      pnl: t.pnl ?? ef.summary?.netPnl ?? null,
      pnlPct: t.pnlPct ?? ef.summary?.pnlPct ?? null,
      triggerNode: t.triggerNode || signalNode?.nodeName || 'Signal Agent',
      entryCandle: candleNode?.output || (t as any).entry_candle,
      entryFeatures: featuresNode?.output || (t as any).entry_features,
      entrySignal: signalNode?.output || (t as any).entry_signal,
      entryRisk: riskNode?.output || (t as any).entry_risk,
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

  // Fast simulation interval loop when simSpeed !== '1x'
  useEffect(() => {
    if (simSpeed === '1x') return

    const intervalMs = simSpeed === '5x' ? 3000 : simSpeed === '15x' ? 1200 : 400
    const timer = setInterval(() => {
      const stepDelta = (Math.random() - 0.48) * (activeSymbol.includes('BTC') ? 95 : 12)
      setSimPriceDelta((prev) => prev + stepDelta)

      // Decrement countdown faster
      setSecondsToNextBar((prev) => {
        if (prev <= (simSpeed === '60x' ? 15 : 6)) {
          const newTime = new Date().toLocaleTimeString('en-IN', { hour12: false })
          setAccumulatedLogs((logs) => [
            {
              id: `sim-bar-${Date.now()}`,
              time: newTime,
              type: 'features',
              node: 'ta-indicators',
              text: `Bar completed on ${activeSymbol}. Indicators updated: EMA_9=${(88000 + simPriceDelta).toFixed(1)}, RSI_14=${(45 + Math.random() * 20).toFixed(1)}`,
            },
            ...logs.slice(0, 1500),
          ])
          return 60
        }
        return Math.max(1, prev - (simSpeed === '60x' ? 12 : simSpeed === '15x' ? 4 : 2))
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [simSpeed, activeSymbol, simPriceDelta])

  const handleForceTick = () => {
    setSecondsToNextBar(60)
    const tickTime = new Date().toLocaleTimeString('en-IN', { hour12: false })
    const price = (candle?.close || 88120) + simPriceDelta
    const newLog: LiveLogEntry = {
      id: `tick-${Date.now()}`,
      time: tickTime,
      type: 'signal',
      node: 'multi-agent-orchestrator',
      text: `Manual tick forced on ${activeSymbol} @ $${price.toFixed(2)}. Strategy DAG evaluated with confidence 84%.`,
    }
    setAccumulatedLogs((prev) => [newLog, ...prev])
    if (soundOn) playFillChime()
    toast.success('Candle Tick Forced', `Evaluated all DAG nodes on ${activeSymbol} @ $${price.toFixed(2)}`)
    fetchState()
  }

  const handleSimFill = (side: 'long' | 'short') => {
    const ltp = (candle?.close || 88150) + simPriceDelta
    const isLong = side === 'long'
    const stopPrice = isLong ? ltp * 0.975 : ltp * 1.025
    const size = activeSymbol.includes('BTC') ? 0.25 : 2.5
    const newPos = {
      symbol: activeSymbol,
      side,
      size,
      entry_price: ltp,
      stop_price: stopPrice,
      confidence: 0.88,
      entry_time: new Date().toISOString(),
      entry_candle: { open: ltp - 20, high: ltp + 40, low: ltp - 30, close: ltp, volume: 142.5 },
      entry_features: { rsi: isLong ? 34.2 : 68.4, ema9: ltp * 0.99, ema21: ltp * 0.98 },
      entry_signal: { action: isLong ? 'BUY' : 'SELL', confidence: 0.88, reason: 'Trend alignment & momentum cross' },
      entry_risk: { maxLoss: 5000, riskReward: 2.8, sizedQuantity: size, approved: true },
    }
    setSimPosition(newPos)
    const logTime = new Date().toLocaleTimeString('en-IN', { hour12: false })
    setAccumulatedLogs((prev) => [
      {
        id: `fill-${Date.now()}`,
        time: logTime,
        type: 'fill',
        node: 'paper-executor',
        text: `EXECUTED SIMULATED ${side.toUpperCase()} FILL on ${activeSymbol}: ${size} units @ $${ltp.toFixed(2)} (SL: $${stopPrice.toFixed(2)})`,
      },
      ...prev,
    ])
    if (soundOn) playFillChime()
    toast.success(`Simulated ${side.toUpperCase()} Position Opened`, `${size} ${activeSymbol} @ $${ltp.toFixed(2)}`)
  }

  const handleCloseSimPosition = () => {
    if (!activePosition) return
    const ltp = (candle?.close || 88150) + simPriceDelta
    const entryP = Number(activePosition.entry_price || activePosition.entryPrice || ltp)
    const size = Number(activePosition.size || 0.25)
    const isLong = activePosition.side === 'long'
    const pnl = isLong ? (ltp - entryP) * size : (entryP - ltp) * size
    const pnlPct = entryP > 0 ? (pnl / (entryP * size)) * 100 : 0

    const closedTrade: LiveTrade = {
      id: `sim-closed-${Date.now()}`,
      symbol: activeSymbol,
      side: activePosition.side,
      size,
      entryPrice: entryP,
      exitPrice: ltp,
      pnl,
      pnlPct,
      confidence: activePosition.confidence || 0.85,
      entryTime: activePosition.entry_time || activePosition.entryTime || new Date().toISOString(),
      exitTime: new Date().toISOString(),
      triggerNode: 'Manual Demo Exit',
    }

    setSimTrades((prev) => [closedTrade, ...prev])
    setSimPosition(null)
    const logTime = new Date().toLocaleTimeString('en-IN', { hour12: false })
    setAccumulatedLogs((prev) => [
      {
        id: `close-${Date.now()}`,
        time: logTime,
        type: 'fill',
        node: 'paper-executor',
        text: `CLOSED POSITION on ${activeSymbol} @ $${ltp.toFixed(2)}. Realized P&L: ₹${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`,
      },
      ...prev,
    ])
    if (soundOn) playFillChime()
    toast.info('Position Closed', `Realized P&L: ₹${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`)
  }

  const handleVolatilityShock = () => {
    const shockPct = (Math.random() > 0.5 ? 1 : -1) * 0.024
    const delta = (candle?.close || 88000) * shockPct
    setSimPriceDelta((prev) => prev + delta)
    const shockLtp = (candle?.close || 88000) + simPriceDelta + delta
    const logTime = new Date().toLocaleTimeString('en-IN', { hour12: false })
    setAccumulatedLogs((prev) => [
      {
        id: `shock-${Date.now()}`,
        time: logTime,
        type: 'warn',
        node: 'risk-gate',
        text: `VOLATILITY SHOCK INJECTED: Price swung ${(shockPct * 100).toFixed(2)}% to $${shockLtp.toFixed(2)}. Stop-loss triggers & exposure limits verified.`,
      },
      ...prev,
    ])
    if (soundOn) playFillChime()
    toast.warn('Volatility Shock Injected', `Market shifted ${(shockPct * 100).toFixed(2)}% to $${shockLtp.toFixed(2)}`)
  }

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
    if (!session?.id) return combinedTrades
    return combinedTrades.filter((t: any) => t.sessionId === session.id || t.id.startsWith('sim-'))
  }, [combinedTrades, session?.id])

  const displayedTrades = useMemo(() => {
    return combinedTrades.filter((t: any) => {
      if (tradeHistoryFilter === 'session') {
        return session?.id ? (t.sessionId === session.id || t.id.startsWith('sim-')) : true
      }
      if (tradeHistoryFilter === 'long') return t.side === 'long'
      if (tradeHistoryFilter === 'short') return t.side === 'short'
      return true
    })
  }, [combinedTrades, tradeHistoryFilter, session?.id])

  const currentEquity = session?.equity ?? session?.capital ?? 100000
  const startingCapital = session?.capital ?? 100000
  const totalReturn = startingCapital > 0 ? ((currentEquity - startingCapital) / startingCapital) * 100 : 0

  const logsToDisplay = accumulatedLogs.length > 0 ? accumulatedLogs : (liveState?.logs || [])
  const filteredLogs = logsToDisplay.filter((log) => {
    if (logFilter === 'all') return true
    return log.type === logFilter
  })

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

          {/* Interactive Demo Simulation Controls Toolbar */}
          <div className="rounded-xl border border-brand/30 bg-gradient-to-r from-brand/10 via-card/90 to-brand/5 p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center text-brand">
                <Zap className="size-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Live Test Controls & Simulation Deck
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-brand/20 text-brand border border-brand/30">
                    DEMO MODE
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Accelerate candle ticks, inject fills, simulate volatility shocks & test audio alerts
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Speed Multipliers */}
              <div className="flex items-center bg-secondary/80 rounded-lg p-0.5 border border-border">
                {(['1x', '5x', '15x', '60x'] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => {
                      setSimSpeed(spd)
                      toast.info(`Simulation Speed: ${spd}`, spd === '1x' ? 'Real-time 1m cadence' : `Accelerated ${spd} ticker simulation`)
                    }}
                    className={cn(
                      'px-2 py-1 text-[10px] font-mono font-medium rounded transition-all cursor-pointer',
                      simSpeed === spd
                        ? 'bg-brand text-black font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {spd}
                  </button>
                ))}
              </div>

              {/* Force Candle Tick */}
              <Button
                size="xs"
                variant="outline"
                onClick={handleForceTick}
                className="h-7 text-[11px] gap-1 bg-card/80 border-border hover:border-brand/50 hover:text-brand"
                title="Force evaluate next candle now"
              >
                <Zap className="size-3 text-brand" />
                Force Tick
              </Button>

              {/* Sim Long Fill */}
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleSimFill('long')}
                className="h-7 text-[11px] gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                title="Simulate a long market order fill"
              >
                <ArrowUpRight className="size-3" />
                Test Long
              </Button>

              {/* Sim Short Fill */}
              <Button
                size="xs"
                variant="outline"
                onClick={() => handleSimFill('short')}
                className="h-7 text-[11px] gap-1 bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                title="Simulate a short market order fill"
              >
                <ArrowDownRight className="size-3" />
                Test Short
              </Button>

              {/* Volatility Shock */}
              <Button
                size="xs"
                variant="outline"
                onClick={handleVolatilityShock}
                className="h-7 text-[11px] gap-1 bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                title="Inject sudden +/- 2.5% market swing"
              >
                <Flame className="size-3 text-amber-400" />
                Shock
              </Button>

              {/* Audio Sound Toggle */}
              <button
                type="button"
                onClick={() => {
                  setSoundOn(!soundOn)
                  if (!soundOn) playFillChime()
                }}
                className={cn(
                  'h-7 w-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer',
                  soundOn
                    ? 'bg-brand/15 border-brand/40 text-brand'
                    : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground',
                )}
                title={soundOn ? 'Trade chime audio on' : 'Trade chime audio muted'}
              >
                {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </button>

              {/* Close Sim Position if open */}
              {activePosition && (
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={handleCloseSimPosition}
                  className="h-7 text-[10px] gap-1"
                >
                  Close Position
                </Button>
              )}
            </div>
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

            {/* Insufficient Credits Global Live Banner */}
            {insufficientCreditsNode && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0 ring-1 ring-amber-500/30">
                    <Coins className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-amber-300 flex items-center gap-2 flex-wrap">
                      <span>AI Reasoning Shifted to Mathematical Mode</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        0 Credits
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                      {insufficientCreditsNode.nodeName} depleted its AI credits. The bot is safely executing on pure quantitative indicators (RSI, EMA, MACD) without interruption.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <PillLink
                    href="/app/billing/topup"
                    variant="primary"
                    size="sm"
                    className="h-7.5 px-3 text-xs gap-1.5 font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-sm"
                  >
                    <Zap className="size-3.5" /> Top Up Credits
                  </PillLink>
                </div>
              </motion.div>
            )}

            {steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground">
                Waiting for strategy node execution step details...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                {steps.map((step: LiveNodeStep) => {
                  const isExpanded = expandedNodeId === step.nodeId
                  const outputAudit = (step.output as any)?.audit
                  const isInsufficientCredits = outputAudit?.llm_status === 'skipped_insufficient_credits'
                  const isLlmActive = outputAudit?.llm_status === 'ok'

                  return (
                    <div
                      key={step.nodeId}
                      className={cn(
                        'rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 shadow-sm backdrop-blur-sm transition-all',
                        isInsufficientCredits
                          ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-card/70 to-card/90 ring-1 ring-amber-500/20'
                          : 'border-border bg-card/60 hover:border-brand/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                            {step.layer}
                          </span>
                          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            {step.nodeName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {isInsufficientCredits && (
                            <Badge
                              variant="warn"
                              size="sm"
                              className="gap-1 font-mono text-[9px] bg-amber-500/15 border-amber-500/30 text-amber-300"
                            >
                              <Calculator className="size-3 text-amber-400" />
                              Math Fallback
                            </Badge>
                          )}
                          {isLlmActive && (
                            <Badge variant="brand" size="sm" className="gap-1 font-mono text-[9px]">
                              <Zap className="size-3 text-brand" />
                              LLM Active
                            </Badge>
                          )}
                          {step.metricLabel && (
                            <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                              <span className="text-[9px] text-muted-foreground font-normal uppercase">
                                {step.metricLabel}:
                              </span>
                              <span>{step.metricValue}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Insufficient Credits Inline Notice */}
                      {isInsufficientCredits && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Coins className="size-3.5 text-amber-400 shrink-0" />
                            <span>Credits 0 · Automated Math Engine</span>
                          </div>
                          <PillLink
                            href="/app/billing/topup"
                            variant="primary"
                            size="sm"
                            className="h-5 px-2 text-[10px] bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0"
                          >
                            Top Up
                          </PillLink>
                        </div>
                      )}

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
                {activePosition ? (
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
                Symbol: {session?.symbol || activePosition?.symbol || 'BTCUSDT'} ({botResolution} Interval)
              </span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {activePosition ? (
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
                      const posSize = Number(activePosition.size || 0)
                      const entryP = Number(activePosition.entry_price || activePosition.entryPrice || 0)
                      const isLong = activePosition.side === 'long'
                      const ltp = Number((candle?.close || entryP) + simPriceDelta)
                      const uPnl = posSize > 0 && entryP > 0
                        ? (isLong ? (ltp - entryP) * posSize : (entryP - ltp) * posSize)
                        : 0
                      const uPnlPct = (entryP * posSize) > 0 ? (uPnl / (entryP * posSize)) * 100 : 0
                      const stopPrice = activePosition.stop_price || activePosition.stopPrice ? Number(activePosition.stop_price || activePosition.stopPrice) : null
                      const stopDist = stopPrice && ltp > 0 ? Math.abs((stopPrice - ltp) / ltp) * 100 : null

                      return (
                        <TR
                          onClick={openPositionInspector}
                          className="cursor-pointer transition-colors hover:bg-secondary/60 group"
                        >
                          <TD className="font-bold text-foreground group-hover:text-brand transition-colors">
                            {session?.symbol || activePosition.symbol || 'BTCUSDT'}
                          </TD>
                          <TD>
                            <Badge
                              variant={isLong ? 'profit' : 'loss'}
                              size="sm"
                              className="uppercase font-mono text-[10px] inline-flex items-center gap-0.5"
                            >
                              {isLong ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                              {activePosition.side}
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
                            {Math.round((activePosition.confidence || 0.75) * 100)}%
                          </TD>
                          <TD className="text-right pr-4">
                            <div className="flex items-center justify-end gap-2">
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
                            </div>
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

            <CardContent className="p-0 overflow-x-auto overflow-y-auto max-h-[480px]">
              {displayedTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                  <p className="font-medium text-foreground">No trades closed under this filter</p>
                  <p className="text-[11px]">Trades closed during this or past sessions will appear here with complete audit trail.</p>
                </div>
              ) : (
                <Table>
                  <THead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border text-[11px]">
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
