'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  Radio,
  Pause,
  Play,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Zap,
  RefreshCw,
  Plus,
  X,
  Filter,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'

interface Position {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  size: number
  entry: number
  mark: number
  pnl: number
  pnlPct: number
  bot: string
  lastTickDir?: 'up' | 'down' | null
  lastTickTime?: number
}

interface AuditLog {
  id: string
  time: string
  type: 'fill' | 'risk' | 'signal' | 'warn' | 'system'
  bot: string
  text: string
  isNew?: boolean
}

const SAMPLE_SYMBOLS = [
  { symbol: 'NIFTY24AUGFUT', basePrice: 24500, tickStep: 2.5 },
  { symbol: 'BANKNIFTY24AUGFUT', basePrice: 51200, tickStep: 5.0 },
  { symbol: 'RELIANCE', basePrice: 2950, tickStep: 0.5 },
  { symbol: 'TCS', basePrice: 4200, tickStep: 1.0 },
  { symbol: 'INFY', basePrice: 1850, tickStep: 0.5 },
  { symbol: 'HDFCBANK', basePrice: 1640, tickStep: 0.4 },
]

export default function LiveMonitoringPage() {
  const bots = useWorkspace((s) => s.bots)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)

  const liveBots = bots.filter((b) => b.status === 'live')
  const [botFilter, setBotFilter] = useState<'live' | 'all'>('all')
  const displayedBots = botFilter === 'live' ? liveBots : bots
  const [killConfirmed, setKillConfirmed] = useState(false)
  const [isStreaming, setIsStreaming] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [tickSpeed, setTickSpeed] = useState<number>(1200) // ms
  const [latency, setLatency] = useState(14)
  const [logFilter, setLogFilter] = useState<string>('all')

  // Live Positions State
  const [positions, setPositions] = useState<Position[]>([
    { id: 'pos-1', symbol: 'NIFTY24AUGFUT', side: 'LONG', size: 150, entry: 24520, mark: 24685, pnl: 24750, pnlPct: 1.34, bot: 'Nifty Momentum v4' },
    { id: 'pos-2', symbol: 'RELIANCE', side: 'SHORT', size: 250, entry: 2980, mark: 2942, pnl: 9500, pnlPct: 1.28, bot: 'Headline Reversal' },
    { id: 'pos-3', symbol: 'BANKNIFTY24AUGFUT', side: 'LONG', size: 60, entry: 51200, mark: 51050, pnl: -9000, pnlPct: -0.58, bot: 'Debate Engine' },
  ])

  // Live Logs State
  const [logs, setLogs] = useState<AuditLog[]>([
    { id: 'l1', time: new Date().toLocaleTimeString(), type: 'fill', bot: 'Nifty Momentum v4', text: 'FILLED: Buy 150 NIFTY24AUGFUT @ 24,520 (Slippage: +0.4 pts)' },
    { id: 'l2', time: new Date(Date.now() - 3000).toLocaleTimeString(), type: 'risk', bot: 'Nifty Momentum v4', text: 'RISK GATE PASSED: Exposure 12.4% below 25.0% ceiling' },
    { id: 'l3', time: new Date(Date.now() - 8000).toLocaleTimeString(), type: 'signal', bot: 'Headline Reversal', text: 'SIGNAL EMITTED: Technical Analyst (0.78 confidence) -> SHORT RELIANCE' },
    { id: 'l4', time: new Date(Date.now() - 15000).toLocaleTimeString(), type: 'warn', bot: 'Debate Engine', text: 'DRAWDOWN WARNING: Intra-day drawdown reached -1.2%' },
    { id: 'l5', time: new Date(Date.now() - 25000).toLocaleTimeString(), type: 'system', bot: 'System Engine', text: 'HEARTBEAT OK: Latency 14ms across NSE Level 2 feeds' },
  ])

  // Reconnect Gateway Handler
  const handleReconnect = () => {
    setLatency(Math.floor(10 + Math.random() * 6))
    setIsStreaming(true)
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'system',
        bot: 'Gateway',
        text: 'RECONNECTED: Restored low-latency feed to NSE Level 2 feed gateway',
        isNew: true,
      },
      ...prev,
    ])
    toast.success('Reconnected', 'Restored low-latency feed to NSE Level 2 gateway.')
  }

  // Aggregate stats
  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0)
  const openCount = positions.length

  // Live Tick Simulation Loop
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      // 1. Update Latency randomly
      setLatency(Math.floor(11 + Math.random() * 8))

      // 2. Fluctuate positions' mark prices & recalculate P&L
      setPositions((prev) =>
        prev.map((pos) => {
          // 70% chance of price movement per tick
          if (Math.random() > 0.7) return pos

          const changeStep = (Math.random() - 0.49) * (pos.entry * 0.0012)
          const newMark = Math.max(1, Math.round((pos.mark + changeStep) * 100) / 100)
          const tickDir: 'up' | 'down' = newMark >= pos.mark ? 'up' : 'down'

          // Compute new P&L
          const pnlPerUnit = pos.side === 'LONG' ? newMark - pos.entry : pos.entry - newMark
          const newPnl = Math.round(pnlPerUnit * pos.size)
          const newPnlPct = Math.round(((newMark - pos.entry) / pos.entry) * (pos.side === 'LONG' ? 100 : -100) * 100) / 100

          return {
            ...pos,
            mark: newMark,
            pnl: newPnl,
            pnlPct: newPnlPct,
            lastTickDir: tickDir,
            lastTickTime: Date.now(),
          }
        })
      )

      // 3. Occasionally add a new dynamic log entry (every ~4-6 ticks)
      if (Math.random() < 0.28) {
        const botsList = liveBots.length > 0 ? liveBots.map((b) => b.name) : ['Nifty Momentum v4', 'Headline Reversal', 'Debate Engine']
        const randomBot = botsList[Math.floor(Math.random() * botsList.length)]

        const logEvents: Array<{ type: AuditLog['type']; text: string }> = [
          { type: 'fill', text: `TICK EXECUTION: Rebalanced hedge position @ ₹${(24500 + Math.random() * 200).toFixed(1)}` },
          { type: 'signal', text: `INDICATOR TRIGGER: RSI oversold crossover (0.${Math.floor(70 + Math.random() * 25)} confidence)` },
          { type: 'risk', text: `SLIPPAGE MONITOR: 0.12 pts within max tolerance threshold` },
          { type: 'system', text: `L2 ORDERBOOK DEPTH: 14,200 bid vs 11,800 ask across top 5 levels` },
          { type: 'warn', text: `VOLATILITY SPIKE: 1-min ATR increased to 18.4 pts` },
        ]
        const event = logEvents[Math.floor(Math.random() * logEvents.length)]

        const newLog: AuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          time: new Date().toLocaleTimeString(),
          type: event.type,
          bot: randomBot,
          text: event.text,
          isNew: true,
        }

        if (soundOn && (event.type === 'risk' || event.type === 'warn')) {
          if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
            try {
              const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
              const ctx = new AudioCtx()
              const osc = ctx.createOscillator()
              const gain = ctx.createGain()
              osc.type = 'sine'
              osc.frequency.setValueAtTime(event.type === 'risk' ? 880 : 660, ctx.currentTime)
              gain.gain.setValueAtTime(0.04, ctx.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
              osc.connect(gain)
              gain.connect(ctx.destination)
              osc.start()
              osc.stop(ctx.currentTime + 0.15)
            } catch {
              // ignore audio context restrictions
            }
          }
          if (event.type === 'risk') {
            toast.error('Risk Alert', `${randomBot}: ${event.text}`)
          } else {
            toast.info('System Warning', `${randomBot}: ${event.text}`)
          }
        }

        setLogs((prev) => [newLog, ...prev.slice(0, 49)])
      }
    }, tickSpeed)

    return () => clearInterval(interval)
  }, [isStreaming, tickSpeed, liveBots, soundOn])

  // Helper to add a manual test order
  const handleSimulateTrade = () => {
    const symObj = SAMPLE_SYMBOLS[Math.floor(Math.random() * SAMPLE_SYMBOLS.length)]
    const side: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT'
    const size = Math.floor(20 + Math.random() * 150)
    const entry = symObj.basePrice
    const mark = entry
    const botName = liveBots.length > 0 ? liveBots[Math.floor(Math.random() * liveBots.length)].name : 'Nifty Momentum v4'

    const newPos: Position = {
      id: `pos-${Date.now()}`,
      symbol: symObj.symbol,
      side,
      size,
      entry,
      mark,
      pnl: 0,
      pnlPct: 0,
      bot: botName,
      lastTickDir: 'up',
      lastTickTime: Date.now(),
    }

    setPositions((prev) => [newPos, ...prev])

    // Log the order
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'fill',
        bot: botName,
        text: `MARKET ORDER EXECUTED: ${side} ${size} ${symObj.symbol} @ ₹${entry.toLocaleString('en-IN')}`,
      },
      ...prev,
    ])

    toast.success('Market Order Executed', `${side} ${size} ${symObj.symbol} placed via ${botName}`)
  }

  // Helper to close a position
  const handleClosePosition = (posId: string) => {
    const pos = positions.find((p) => p.id === posId)
    if (!pos) return

    setPositions((prev) => prev.filter((p) => p.id !== posId))

    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'fill',
        bot: pos.bot,
        text: `POSITION CLOSED: ${pos.symbol} (${pos.side}) liquidated @ ₹${pos.mark.toLocaleString('en-IN')} (P&L: ₹${pos.pnl.toLocaleString('en-IN')})`,
      },
      ...prev,
    ])

    toast.info('Position Closed', `${pos.symbol} position was closed at ₹${pos.mark.toLocaleString('en-IN')}`)
  }

  const handleKillAll = () => {
    liveBots.forEach((b) => setBotStatus(b.id, 'paused'))
    toast.error('EMERGENCY KILL TRIGGERED', 'All live bots have been paused and execution halted.')
    setKillConfirmed(false)
  }

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true
    return log.type === logFilter
  })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-3">
            <span className={`absolute inset-0 rounded-full ${isStreaming ? 'animate-ping bg-profit opacity-75' : 'bg-muted-foreground'}`} />
            <span className={`relative size-3 rounded-full ${isStreaming ? 'bg-profit' : 'bg-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Live Execution & Monitoring</h1>
              <span className="rounded-full bg-profit/10 border border-profit/20 px-2.5 py-0.5 text-[10px] font-semibold text-profit uppercase tracking-wider animate-pulse">
                Real-time WebSocket Feed
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Live tick stream from active strategy graph instances and order gateways
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Stream pause/play toggle */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`h-9 px-3.5 rounded-full border text-xs font-semibold flex items-center gap-2 transition-all ${
              isStreaming
                ? 'border-profit/30 bg-profit/10 text-profit hover:bg-profit/20'
                : 'border-warn/30 bg-warn/10 text-warn hover:bg-warn/20'
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="size-3.5" /> Pause Feed
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Resume Feed
              </>
            )}
          </button>

          {/* Tick Speed Toggle */}
          <button
            onClick={() => setTickSpeed((prev) => (prev === 1200 ? 500 : prev === 500 ? 2500 : 1200))}
            className="h-9 px-3 rounded-full border border-border bg-secondary/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5 transition-colors"
            title="Cycle tick simulation speed"
          >
            <Zap className="size-3.5 text-brand" />
            <span>{tickSpeed === 500 ? 'Fast (0.5s)' : tickSpeed === 1200 ? 'Normal (1.2s)' : 'Slow (2.5s)'}</span>
          </button>

          {/* Sound alert toggle */}
          <button
            onClick={() => {
              setSoundOn(!soundOn)
              toast.info(soundOn ? 'Alert sounds muted' : 'Alert sounds enabled')
            }}
            className={`h-9 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              soundOn
                ? 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
                : 'border-border bg-transparent text-muted-foreground hover:bg-secondary/40'
            }`}
            title={soundOn ? 'Audible risk/warn alerts enabled' : 'Audible alerts muted'}
          >
            {soundOn ? (
              <Volume2 className="size-3.5 text-brand" />
            ) : (
              <VolumeX className="size-3.5 text-muted-foreground" />
            )}
            <span>{soundOn ? 'Sound On' : 'Sound Off'}</span>
          </button>

          {/* Reconnect Gateway */}
          <button
            onClick={handleReconnect}
            className="h-9 px-3 rounded-full border border-border bg-secondary/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reconnect to feed gateway"
          >
            <RefreshCw className="size-3.5 text-brand" />
            <span>Reconnect</span>
          </button>

          {/* Manual Trade Simulation */}
          <button
            onClick={handleSimulateTrade}
            className="h-9 px-3.5 rounded-full border border-brand/30 bg-brand/10 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" /> Execute Test Trade
          </button>

          {/* Emergency Stop */}
          <button
            onClick={() => setKillConfirmed(true)}
            className="h-9 px-4 rounded-full border border-destructive/40 bg-destructive/15 text-xs font-semibold text-destructive hover:bg-destructive/25 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShieldAlert className="size-3.5" /> Emergency Stop
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Emergency Stop */}
      {killConfirmed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-xl border border-destructive/50 bg-card p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="size-6" />
              <h3 className="text-lg font-bold">Emergency Stop Confirmation</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will immediately pause all <strong className="text-foreground">{liveBots.length} live bots</strong> and cancel open orders. Are you sure you want to trigger an emergency shutdown?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setKillConfirmed(false)}
                className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleKillAll}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90"
              >
                Halt All Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unrealized P&L</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold font-mono tracking-tight transition-colors duration-300 ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-profit font-semibold flex items-center">
              <ArrowUpRight className="size-3" /> Live Ticking
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Open Positions</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight">{openCount}</span>
            <span className="text-[11px] text-muted-foreground font-mono">Active Contracts</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Gateway Latency</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight text-brand">{latency} ms</span>
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative size-2 rounded-full bg-brand" />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Live Bots</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight">{liveBots.length} / {bots.length}</span>
            <span className="text-[11px] text-muted-foreground">Running</span>
          </div>
        </div>
      </div>

      {/* Strategy Bots Section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Active & Deployable Strategies</h2>
            <span className="text-xs text-muted-foreground font-mono">
              ({liveBots.length} Live / {bots.length} Total)
            </span>
          </div>

          {/* Strategy Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setBotFilter('live')}
              className={`h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
                botFilter === 'live'
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              Live Only ({liveBots.length})
            </button>
            <button
              onClick={() => setBotFilter('all')}
              className={`h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
                botFilter === 'all'
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              All Bots ({bots.length})
            </button>
          </div>
        </div>

        {/* Dynamic Grid of All Filtered Bots */}
        {displayedBots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center flex flex-col items-center justify-center gap-3">
            <Radio className="size-8 text-muted-foreground/60 animate-pulse" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">No Live Bots Active</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Switch to "All Bots" tab above to activate a strategy, or build a new bot in the Builder.
              </p>
            </div>
            <button
              onClick={() => setBotFilter('all')}
              className="h-8 px-4 rounded-full bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              View All Deployable Bots
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedBots.map((bot) => (
              <div
                key={bot.id}
                className={`rounded-xl border bg-card p-5 flex flex-col justify-between gap-4 relative overflow-hidden transition-all ${
                  bot.status === 'live'
                    ? 'border-profit/40 shadow-profit/5 shadow-md'
                    : 'border-border opacity-90 hover:opacity-100'
                }`}
              >
                {bot.status === 'live' && (
                  <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-profit/80 via-brand to-profit/80 animate-pulse" />
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={bot.status} />
                    <span className="text-[11px] font-mono text-tertiary">
                      {bot.status === 'live' ? `${latency}ms latency` : 'Standby'}
                    </span>
                  </div>
                  <Link
                    href={`/app/bots/${bot.id}?tab=live`}
                    className="font-bold text-base hover:text-brand transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{bot.name}</span>
                    <span className="text-xs text-tertiary group-hover:text-brand group-hover:translate-x-0.5 transition-all">
                      &rarr;
                    </span>
                  </Link>
                  <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {bot.headlineMetric.label || '90d Return'}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        bot.headlineMetric.positive ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {bot.headlineMetric.value || '—'}
                    </span>
                  </div>

                  {bot.status === 'live' ? (
                    <button
                      onClick={() => {
                        setBotStatus(bot.id, 'paused')
                        toast.info('Bot Paused', `${bot.name} paused.`)
                      }}
                      className="h-8 px-3.5 rounded-lg border border-warn/30 bg-warn/10 text-xs font-semibold text-warn hover:bg-warn/20 transition-colors"
                    >
                      Pause Bot
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setBotStatus(bot.id, 'live')
                        toast.success('Bot Live', `${bot.name} is now live & monitoring trades.`)
                      }}
                      className="h-8 px-3.5 rounded-lg border border-profit/30 bg-profit/10 text-xs font-semibold text-profit hover:bg-profit/20 transition-colors"
                    >
                      Start Live
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Market Positions Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Active Market Positions</h2>
            <span className="size-2 rounded-full bg-profit animate-ping" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">{positions.length} Open Positions</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
              <tr>
                <th className="p-3 pl-4">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Size</th>
                <th className="p-3">Entry Price</th>
                <th className="p-3">Mark Price</th>
                <th className="p-3">Unrealized P&L</th>
                <th className="p-3">Originating Bot</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs font-medium">
                      No active open positions currently. Click "Execute Test Trade" to simulate a live market fill.
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => {
                    const isRecentTick = pos.lastTickTime && Date.now() - pos.lastTickTime < 700
                    const tickFlashClass = isRecentTick
                      ? pos.lastTickDir === 'up'
                        ? 'bg-profit/15 text-profit'
                        : 'bg-loss/15 text-loss'
                      : ''

                    return (
                      <motion.tr
                        key={pos.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`hover:bg-secondary/30 transition-colors ${tickFlashClass}`}
                      >
                        <td className="p-3 pl-4 font-bold text-foreground flex items-center gap-1.5">
                          {pos.symbol}
                          {isRecentTick && (
                            <span className={`text-[10px] ${pos.lastTickDir === 'up' ? 'text-profit' : 'text-loss'}`}>
                              {pos.lastTickDir === 'up' ? '▲' : '▼'}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={pos.side === 'LONG' ? 'profit' : 'loss'} size="sm" className="uppercase font-mono">
                            {pos.side}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono">{pos.size}</td>
                        <td className="p-3 font-mono">₹{pos.entry.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono font-semibold transition-colors duration-200">
                          ₹{pos.mark.toLocaleString('en-IN')}
                        </td>
                        <td className={`p-3 font-bold font-mono transition-colors duration-200 ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toLocaleString('en-IN')} ({pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct}%)
                        </td>
                        <td className="p-3 text-tertiary">{pos.bot}</td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            onClick={() => handleClosePosition(pos.id)}
                            className="h-7 px-2.5 rounded border border-border bg-secondary/50 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                          >
                            Close
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Logs Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Real-time Execution & Audit Trail</h2>
            <span className="text-xs text-muted-foreground font-mono">({logs.length} events logged)</span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="size-3.5 text-muted-foreground mr-1 shrink-0" />
            {['all', 'fill', 'signal', 'risk', 'warn', 'system'].map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium capitalize transition-colors ${
                  logFilter === f
                    ? 'bg-foreground text-background font-semibold'
                    : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs flex flex-col gap-2.5 max-h-96 overflow-y-auto shadow-inner">
          <AnimatePresence initial={false}>
            {filteredLogs.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-xs">No audit events match current filter.</div>
            ) : (
              filteredLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-start gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0 group"
                >
                  <span className="text-tertiary shrink-0 text-[11px] select-none">{log.time}</span>
                  <Badge
                    variant={
                      log.type === 'fill'
                        ? 'profit'
                        : log.type === 'risk'
                        ? 'warn'
                        : log.type === 'warn'
                        ? 'loss'
                        : log.type === 'signal'
                        ? 'brand'
                        : 'neutral'
                    }
                    size="sm"
                    className="uppercase text-[10px] shrink-0"
                  >
                    {log.type}
                  </Badge>
                  <span className="text-emerald-400/80 font-semibold shrink-0">[{log.bot}]</span>
                  <span className="text-foreground/90 truncate group-hover:text-white transition-colors">{log.text}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
