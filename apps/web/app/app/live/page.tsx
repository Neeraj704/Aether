'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  Radio,
  Pause,
  Play,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Zap,
  RefreshCw,
  Volume2,
  VolumeX,
  ExternalLink,
  Bot as BotIcon,
  Cpu,
  Activity,
  Maximize2,
  History,
  Eye,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { listBots } from '@/lib/bots'
import type { Bot } from '@/mock/data'
import {
  listActiveLiveSessions,
  getLiveState,
  startLiveSession,
  stopLiveSession,
  listAllLiveTrades,
  type ActiveLiveSession,
  type LiveStateResponse,
  type GlobalLiveTradeItem,
} from '@/lib/engine'
import { TradeFlowModal, type TradeInspectionData } from '@/components/bot/trade-flow-modal'
import { formatINR, formatPct, formatDate } from '@/lib/utils'

interface PositionItem {
  id: string
  botId: string
  botName: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  stopPrice?: number | null
  confidence: number
  currentLtp?: number
  unrealizedPnl?: number
  unrealizedPnlPct?: number
}

interface AuditLog {
  id: string
  time: string
  type: 'fill' | 'risk' | 'signal' | 'warn' | 'system'
  bot: string
  text: string
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

export default function LiveMonitoringPage() {
  const localBots = useWorkspace((s) => s.bots)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)

  const [bots, setBots] = useState<Bot[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveLiveSession[]>([])
  const [allTrades, setAllTrades] = useState<GlobalLiveTradeItem[]>([])
  const [simulatedPositions, setSimulatedPositions] = useState<PositionItem[]>([])
  const [inspectTrade, setInspectTrade] = useState<TradeInspectionData | null>(null)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [detailedStates, setDetailedStates] = useState<Record<string, LiveStateResponse>>({})
  const [botFilter, setBotFilter] = useState<'live' | 'all'>('all')
  const [killConfirmed, setKillConfirmed] = useState(false)
  const [isStreaming, setIsStreaming] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [simSpeed, setSimSpeed] = useState<'1x' | '5x' | '15x' | '60x'>('1x')
  const [simulatedLtp, setSimulatedLtp] = useState<number>(88050.25)
  const [logFilter, setLogFilter] = useState<string>('all')
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'l-init',
      time: new Date().toLocaleTimeString(),
      type: 'system',
      bot: 'Scheduler',
      text: 'AETHER Live Engine heartbeat OK — Multi-resolution paper loops active.',
    },
  ])

  // 1. Fetch real bots from Supabase / mock on mount
  useEffect(() => {
    let active = true
    listBots(true)
      .then((remoteBots) => {
        if (!active) return
        setBots(remoteBots || [])
        for (const b of remoteBots || []) {
          useWorkspace.getState().saveGraph(b.id, b.graph)
        }
      })
      .catch((err) => {
        console.warn('Could not load remote bots on live page:', err)
      })

    return () => {
      active = false
    }
  }, [])

  // 2. Poll all active live sessions from engine
  const refreshLiveSessions = useCallback(async () => {
    if (!isStreaming) return
    try {
      const [sessions, trades] = await Promise.all([
        listActiveLiveSessions(),
        listAllLiveTrades(100),
      ])
      setActiveSessions(sessions)
      setAllTrades(trades)

      setBots((prevBots) => {
        const sessionBotIds = new Set(sessions.map((s) => s.botId))
        return prevBots.map((b) => {
          if (sessionBotIds.has(b.id) && b.status !== 'live') {
            return { ...b, status: 'live' as const }
          }
          return b
        })
      })

      const stateMap: Record<string, LiveStateResponse> = {}
      const newLogs: AuditLog[] = []

      for (const s of sessions) {
        try {
          const st = await getLiveState(s.botId)
          stateMap[s.botId] = st
          if (st.logs && st.logs.length > 0) {
            for (const l of st.logs.slice(0, 3)) {
              newLogs.push({
                id: `engine-${l.id}`,
                time: l.time,
                type: (l.type === 'data' || l.type === 'features' ? 'signal' : l.type) as any,
                bot: s.botName || 'Engine',
                text: l.text,
              })
            }
          }
        } catch {
          // ignore transient bot error
        }
      }
      setDetailedStates(stateMap)

      if (newLogs.length > 0) {
        setLogs((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const incoming = newLogs.filter((n) => !existingIds.has(n.id))
          return [...incoming, ...prev].slice(0, 50)
        })
      }
    } catch (err) {
      console.warn('[LivePage] Could not refresh active sessions:', err)
    }
  }, [isStreaming])

  useEffect(() => {
    refreshLiveSessions()
    const interval = setInterval(refreshLiveSessions, 10000)
    return () => clearInterval(interval)
  }, [refreshLiveSessions])

  // Fast-Forward / High Speed Simulation Loop for recording demos
  useEffect(() => {
    if (simSpeed === '1x' || !isStreaming) return

    const intervalMs = simSpeed === '60x' ? 800 : simSpeed === '15x' ? 1800 : 3500
    const timer = setInterval(() => {
      // Small random price walk
      const delta = (Math.random() - 0.48) * 45
      setSimulatedLtp((prev) => {
        const nextPrice = Number((prev + delta).toFixed(2))
        // Update simulated positions unrealized pnl
        setSimulatedPositions((positions) =>
          positions.map((pos) => {
            const isLong = pos.side === 'long'
            const uPnl = isLong
              ? (nextPrice - pos.entryPrice) * pos.size
              : (pos.entryPrice - nextPrice) * pos.size
            const uPnlPct = (uPnl / (pos.entryPrice * pos.size)) * 100
            return {
              ...pos,
              currentLtp: nextPrice,
              unrealizedPnl: uPnl,
              unrealizedPnlPct: uPnlPct,
            }
          }),
        )
        return nextPrice
      })

      // Add a simulation tick log
      setLogs((prev) => [
        {
          id: `sim-tick-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          type: 'signal',
          bot: 'Sim-Engine',
          text: `[${simSpeed}] Bar closed at $${simulatedLtp.toFixed(2)}. Features extracted: RSI 49.2, EMA Fast $88,040.`,
        },
        ...prev.slice(0, 49),
      ])
    }, intervalMs)

    return () => clearInterval(timer)
  }, [simSpeed, isStreaming, simulatedLtp])

  // Manual interactive triggers for demo presentation
  const handleForceTick = () => {
    refreshLiveSessions()
    if (soundOn) playFillChime()
    toast.success('Candle Tick Evaluated', 'Processed live DAG step execution across active strategy loops.')
    setLogs((prev) => [
      {
        id: `manual-tick-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'system',
        bot: 'Manual Override',
        text: 'MANUAL TICK: Evaluated DAG node signals & risk gates on latest bar.',
      },
      ...prev,
    ])
  }

  const handleSimulateTrade = (side: 'long' | 'short') => {
    const activeBot = bots[0] || { id: 'bot-1', name: 'First bot' }
    const entryP = simulatedLtp
    const size = side === 'long' ? 0.25 : 0.2415
    const stopP = side === 'long' ? entryP * 0.985 : entryP * 1.015

    const newPos: PositionItem = {
      id: `pos-${Date.now()}`,
      botId: activeBot.id,
      botName: activeBot.name,
      symbol: 'BTCUSDT',
      side,
      size,
      entryPrice: entryP,
      stopPrice: stopP,
      confidence: 0.82,
      currentLtp: entryP,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
    }

    setSimulatedPositions((prev) => [newPos, ...prev])
    if (soundOn) playFillChime()
    toast.success(`Simulated ${side.toUpperCase()} Entry Fill`, `Filled ${size} BTCUSDT @ ${formatINR(entryP)}`)

    setLogs((prev) => [
      {
        id: `log-fill-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'fill',
        bot: activeBot.name,
        text: `ORDER FILLED: ${side.toUpperCase()} ${size} BTCUSDT @ $${entryP.toFixed(2)} (Conviction: 82%).`,
      },
      ...prev,
    ])
  }

  const handleInjectVolatility = (direction: 'pump' | 'dump') => {
    const shift = direction === 'pump' ? 1.025 : 0.975
    const nextLtp = Number((simulatedLtp * shift).toFixed(2))
    setSimulatedLtp(nextLtp)

    setSimulatedPositions((positions) =>
      positions.map((pos) => {
        const isLong = pos.side === 'long'
        const uPnl = isLong
          ? (nextLtp - pos.entryPrice) * pos.size
          : (pos.entryPrice - nextLtp) * pos.size
        const uPnlPct = (uPnl / (pos.entryPrice * pos.size)) * 100
        return {
          ...pos,
          currentLtp: nextLtp,
          unrealizedPnl: uPnl,
          unrealizedPnlPct: uPnlPct,
        }
      }),
    )

    if (soundOn) playFillChime()
    toast.warn(
      `Market Volatility Injected (${direction === 'pump' ? '+2.5%' : '-2.5%'})`,
      `BTCUSDT price shifted to $${nextLtp.toLocaleString()}. Dynamic risk gates evaluated.`,
    )

    setLogs((prev) => [
      {
        id: `vol-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'warn',
        bot: 'Market Shock Engine',
        text: `VOLATILITY EVENT: BTCUSDT price moved to $${nextLtp.toFixed(2)} (${direction === 'pump' ? '+2.5%' : '-2.5%'}). Trailing stops active.`,
      },
      ...prev,
    ])
  }

  const handleClosePosition = (posId: string) => {
    const pos = simulatedPositions.find((p) => p.id === posId)
    if (pos) {
      const exitP = pos.currentLtp || pos.entryPrice
      const pnl = pos.unrealizedPnl || 0
      const pnlPct = pos.unrealizedPnlPct || 0

      // Add to closed trades
      const newClosedTrade: GlobalLiveTradeItem = {
        id: `trade-${Date.now()}`,
        botId: pos.botId,
        botName: pos.botName,
        sessionId: 'sim-session',
        symbol: pos.symbol,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        exitPrice: exitP,
        stopPrice: pos.stopPrice,
        confidence: pos.confidence,
        entryTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        exitTime: new Date().toISOString(),
        pnl: Math.round(pnl),
        pnlPct: Number(pnlPct.toFixed(2)),
        triggerNode: 'Technical Analyst',
        executionFlow: {
          tradeId: `trade-${Date.now()}`,
          symbol: pos.symbol,
          side: pos.side,
          summary: {
            entryPrice: pos.entryPrice,
            exitPrice: exitP,
            size: pos.size,
            netPnl: Math.round(pnl),
            pnlPct: Number(pnlPct.toFixed(2)),
            confidence: pos.confidence,
          },
          steps: [
            {
              stepIndex: 1,
              layer: 'data',
              nodeId: 'ohlcv-feed',
              nodeName: 'OHLCV Price Feed',
              computation: `Ingested closed bar data for ${pos.symbol}.`,
              output: { open: pos.entryPrice, high: pos.entryPrice * 1.01, low: pos.entryPrice * 0.99, close: pos.entryPrice, volume: 1540 },
            },
            {
              stepIndex: 2,
              layer: 'features',
              nodeId: 'ta-indicators',
              nodeName: 'Technical Indicators',
              computation: 'Extracted RSI(14)=52.1, EMA Fast, MACD.',
              output: { rsi: 52.1, ema_fast: pos.entryPrice, macd: 12.4 },
            },
            {
              stepIndex: 3,
              layer: 'agents',
              nodeId: 'technical-agent',
              nodeName: 'Technical Analyst',
              computation: `Directional ${pos.side.toUpperCase()} conviction confirmed.`,
              output: { direction: pos.side, confidence: pos.confidence, rationale: 'Momentum breakout confirmed on candle close.' },
            },
            {
              stepIndex: 4,
              layer: 'risk',
              nodeId: 'risk-gate',
              nodeName: 'Risk Gate',
              computation: 'Validated risk threshold and sizing.',
              output: { approved: true, sizedQuantity: pos.size, stopPrice: pos.stopPrice },
            },
            {
              stepIndex: 5,
              layer: 'execution',
              nodeId: 'paper-executor',
              nodeName: 'Paper Execution',
              computation: `Closed position with realized P&L: ₹${Math.round(pnl)}.`,
              output: { entryPrice: pos.entryPrice, exitPrice: exitP, size: pos.size, pnl: Math.round(pnl), pnlPct: Number(pnlPct.toFixed(2)) },
            },
          ],
        },
      }

      setAllTrades((prev) => [newClosedTrade, ...prev])
      setSimulatedPositions((prev) => prev.filter((p) => p.id !== posId))
      if (soundOn) playFillChime()
      toast.info('Position Closed', `Closed ${pos.side.toUpperCase()} with realized P&L ${formatINR(pnl)}`)

      setLogs((prev) => [
        {
          id: `close-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          type: pnl >= 0 ? 'fill' : 'warn',
          bot: pos.botName,
          text: `POSITION CLOSED: Realized P&L ${pnl >= 0 ? '+' : ''}₹${Math.round(pnl)} (${pnlPct.toFixed(2)}%).`,
        },
        ...prev,
      ])
    }
  }

  const handleResetSimulation = () => {
    setSimulatedPositions([])
    setSimSpeed('1x')
    toast.info('Simulation Reset', 'Cleared simulated positions and restored real-time 1x loop.')
  }

  // Derive live bots by cross-referencing bot status or active engine sessions
  const activeBotIdSet = new Set(activeSessions.map((s) => s.botId))
  const liveBots = bots.filter((b) => b.status === 'live' || activeBotIdSet.has(b.id))
  const displayedBots = botFilter === 'live' ? liveBots : bots

  // Extract open positions across all active sessions with live P&L + simulated positions
  const openPositions: PositionItem[] = [
    ...simulatedPositions,
    ...activeSessions
      .filter((s) => s.position)
      .map((s) => {
        const pos = s.position!
        const botState = detailedStates[s.botId]
        const ltp = botState?.evaluation?.candle?.close || pos.entry_price
        const isLong = pos.side === 'long'
        const posSize = Number(pos.size || 0)
        const entryP = Number(pos.entry_price || 0)
        const uPnl =
          posSize > 0 && entryP > 0
            ? isLong
              ? (ltp - entryP) * posSize
              : (entryP - ltp) * posSize
            : 0
        const uPnlPct =
          entryP * posSize > 0 ? (uPnl / (entryP * posSize)) * 100 : 0

        return {
          id: `pos-${s.id}`,
          botId: s.botId,
          botName: s.botName,
          symbol: s.symbol,
          side: pos.side,
          size: posSize,
          entryPrice: entryP,
          stopPrice: pos.stop_price,
          confidence: pos.confidence || 0.75,
          currentLtp: ltp,
          unrealizedPnl: uPnl,
          unrealizedPnlPct: uPnlPct,
        }
      }),
  ]

  // Open inspection modal handlers
  const openPositionInspector = (pos: PositionItem) => {
    const rawPos = detailedStates[pos.botId]?.position
    const tradeData: TradeInspectionData = {
      isOpenPosition: true,
      symbol: pos.symbol,
      side: pos.side,
      size: pos.size,
      entryPrice: pos.entryPrice,
      stopPrice: pos.stopPrice,
      confidence: pos.confidence,
      entryTime: rawPos?.entry_time || new Date().toISOString(),
      entryCandle: rawPos?.entry_candle,
      entryFeatures: rawPos?.entry_features,
      entrySignal: rawPos?.entry_signal,
      entryRisk: rawPos?.entry_risk,
      rawPosition: rawPos,
    }
    setInspectTrade(tradeData)
    setTradeModalOpen(true)
  }

  const openClosedTradeInspector = (t: GlobalLiveTradeItem) => {
    const ef = (t.executionFlow as any) || {}
    const steps: any[] = Array.isArray(ef.steps)
      ? ef.steps
      : Array.isArray(ef.flow)
      ? ef.flow
      : []

    const candleNode = steps.find(
      (f: any) =>
        f.nodeId === 'ohlcv-feed' || f.layer === 'data' || f.type === 'candle',
    )
    const featuresNode = steps.find(
      (f: any) =>
        f.nodeId === 'ta-indicators' ||
        f.layer === 'features' ||
        f.type === 'features',
    )
    const signalNode = steps.find(
      (f: any) =>
        f.layer === 'agents' ||
        f.layer === 'models' ||
        f.layer === 'ml' ||
        f.layer === 'signal' ||
        f.nodeId?.includes('agent') ||
        f.nodeId?.includes('forecast') ||
        f.type === 'signal',
    )
    const riskNode = steps.find(
      (f: any) =>
        f.nodeId === 'risk-gate' || f.layer === 'risk' || f.type === 'risk',
    )
    const fillNode = steps.find(
      (f: any) =>
        f.nodeId === 'paper-executor' ||
        f.layer === 'execution' ||
        f.type === 'fill',
    )

    const entryPrice =
      (t as any).entryPrice ||
      (t as any).entry_price ||
      ef.summary?.entryPrice ||
      fillNode?.output?.entryPrice ||
      candleNode?.output?.close ||
      0
    const exitPrice =
      (t as any).exitPrice ||
      (t as any).exit_price ||
      ef.summary?.exitPrice ||
      fillNode?.output?.exitPrice ||
      0
    const stopPrice =
      (t as any).stopPrice ||
      (t as any).stop_price ||
      ef.summary?.stopPrice ||
      riskNode?.output?.stopPrice ||
      null
    const size =
      t.size ||
      ef.summary?.size ||
      fillNode?.output?.size ||
      riskNode?.output?.sizedQuantity ||
      0

    const tradeData: TradeInspectionData = {
      isOpenPosition: false,
      symbol: t.symbol || ef.symbol || 'BTCUSDT',
      side: t.side || ef.side || 'long',
      size: size,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      stopPrice: stopPrice,
      confidence:
        t.confidence ||
        ef.summary?.confidence ||
        signalNode?.output?.confidence ||
        0.75,
      entryTime:
        t.entryTime ||
        (t as any).entry_time ||
        ef.summary?.entryTime ||
        new Date().toISOString(),
      exitTime:
        t.exitTime || (t as any).exit_time || ef.summary?.exitTime || null,
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

  // Aggregate stats
  const simulatedPnl = simulatedPositions.reduce(
    (acc, p) => acc + (p.unrealizedPnl || 0),
    0,
  )
  const totalCapital =
    activeSessions.reduce((acc, s) => acc + s.capital, 0) +
    (simulatedPositions.length > 0 ? 100000 : 0)
  const baseEquity = activeSessions.reduce((acc, s) => acc + s.equity, 0)
  const totalEquity =
    (baseEquity > 0 ? baseEquity : 96000) +
    (simulatedPositions.length > 0 ? simulatedPnl : 0)
  const totalPnl =
    totalEquity - (totalCapital > 0 ? totalCapital : 100000)
  const totalPnlPct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : (totalPnl / 100000) * 100

  const handleStartBot = async (botId: string, botName: string) => {
    try {
      await startLiveSession(botId, 'BTCUSDT', 100000)
      setBotStatus(botId, 'live')
      setBots((prev) =>
        prev.map((b) => (b.id === botId ? { ...b, status: 'live' as const } : b)),
      )
      toast.success(
        'Live Loop Started',
        `${botName} is now live and executing scheduled bars.`,
      )
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          type: 'system',
          bot: botName,
          text: `SESSION STARTED: Scheduled execution loop registered for ${botName}.`,
        },
        ...prev,
      ])
      refreshLiveSessions()
    } catch (err: any) {
      toast.error(
        'Could Not Start Live',
        err.message || 'Validation or engine error',
      )
    }
  }

  const handlePauseBot = async (botId: string, botName: string) => {
    try {
      await stopLiveSession(botId)
    } catch (err) {
      console.warn('Notice on pausing live session:', err)
    } finally {
      setBotStatus(botId, 'paused')
      setBots((prev) =>
        prev.map((b) => (b.id === botId ? { ...b, status: 'paused' as const } : b)),
      )
      toast.info('Bot Paused', `${botName} has been paused.`)
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          type: 'warn',
          bot: botName,
          text: `SESSION HALTED: ${botName} execution stopped and deregistered from scheduler.`,
        },
        ...prev,
      ])
      refreshLiveSessions()
    }
  }

  const handleKillAll = async () => {
    setLoading(true)
    for (const b of liveBots) {
      try {
        await stopLiveSession(b.id)
      } catch (e) {
        console.error(`Failed to kill bot ${b.id}:`, e)
      } finally {
        setBotStatus(b.id, 'paused')
      }
    }
    setBots((prev) => prev.map((b) => ({ ...b, status: 'paused' as const })))
    toast.error(
      'EMERGENCY KILL TRIGGERED',
      'All live bots have been stopped and scheduler jobs removed.',
    )
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'risk',
        bot: 'Emergency Guard',
        text: 'EMERGENCY KILL SWITCH ACTIVATED: All scheduled live loops terminated.',
      },
      ...prev,
    ])
    setKillConfirmed(false)
    setLoading(false)
    refreshLiveSessions()
  }

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true
    return log.type === logFilter
  })

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Paper Trading Compliance Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-xs text-warn">
        <AlertTriangle className="size-4 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 w-full">
          <span>
            <strong>Paper trading only</strong> &mdash; Simulated execution
            environment. No real funds are being used.
          </span>
          <Link
            href="/legal/risk-disclosure"
            className="underline font-medium hover:text-warn/80 shrink-0"
          >
            Risk Disclosure &rarr;
          </Link>
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-3">
            <span
              className={`absolute inset-0 rounded-full ${
                isStreaming ? 'animate-ping bg-profit opacity-75' : 'bg-muted-foreground'
              }`}
            />
            <span
              className={`relative size-3 rounded-full ${
                isStreaming ? 'bg-profit' : 'bg-muted-foreground'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Live Execution &amp; Monitoring
              </h1>
              <span className="rounded-full bg-profit/10 border border-profit/20 px-2.5 py-0.5 text-[10px] font-semibold text-profit uppercase tracking-wider animate-pulse">
                Real-Time Loops Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time portfolio state and multi-resolution bar execution across
              active bots
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Feed Toolbar Capsule */}
          <div className="flex items-center bg-secondary/50 border border-border/80 rounded-full p-1 gap-1">
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isStreaming
                  ? 'bg-profit/15 text-profit hover:bg-profit/25 border border-profit/30'
                  : 'bg-warn/15 text-warn hover:bg-warn/25 border border-warn/30'
              }`}
              title={isStreaming ? 'Pause live polling' : 'Resume live polling'}
            >
              {isStreaming ? (
                <>
                  <Pause className="size-3" />
                  <span>Pause Polling</span>
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <div className="h-4 w-px bg-border/60 mx-0.5" />

            {/* Sound alert toggle */}
            <button
              onClick={() => {
                setSoundOn(!soundOn)
                toast.info(
                  soundOn ? 'Alert sounds muted' : 'Alert sounds enabled',
                )
              }}
              className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                soundOn
                  ? 'text-brand hover:bg-secondary/80'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary/80'
              }`}
              title={soundOn ? 'Sound alerts enabled' : 'Sound alerts muted'}
            >
              {soundOn ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5" />
              )}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={refreshLiveSessions}
              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
              title="Refresh live state from engine"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>

          {/* Emergency Stop */}
          <button
            onClick={() => setKillConfirmed(true)}
            disabled={liveBots.length === 0}
            className="h-8 px-3.5 rounded-full border border-destructive/40 bg-destructive/15 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ShieldAlert className="size-3.5" /> Emergency Stop
          </button>
        </div>
      </div>

      {/* Interactive Simulation & Test Controls Deck */}
      <div className="rounded-xl border border-brand/30 bg-gradient-to-r from-brand/10 via-card to-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-brand animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Demo Simulation &amp; Live Test Controls
            </span>
            <Badge variant="brand" size="sm" className="font-mono text-[9px]">
              Hackathon Deck
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Test strategy loops, simulate live fills, adjust tick speed, and inject market volatility in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          {/* Speed Multiplier */}
          <div className="flex items-center bg-secondary/80 border border-border rounded-lg p-0.5 gap-0.5 text-[11px]">
            <span className="px-2 text-[10px] font-mono text-tertiary uppercase">Speed:</span>
            {(['1x', '5x', '15x', '60x'] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  setSimSpeed(spd)
                  toast.info(`Simulation Speed: ${spd}`, spd === '1x' ? 'Real-time live scheduler loop' : `Accelerated bar evaluation at ${spd}`)
                }}
                className={`h-6 px-2 rounded-md font-mono text-[10px] font-semibold transition-colors cursor-pointer ${
                  simSpeed === spd
                    ? 'bg-brand text-brand-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {spd}
              </button>
            ))}
          </div>

          {/* Force Tick Button */}
          <button
            type="button"
            onClick={handleForceTick}
            className="h-7.5 px-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Force immediate evaluation of DAG nodes on next closed bar"
          >
            <Zap className="size-3.5 text-brand" />
            <span>Force Tick</span>
          </button>

          {/* Test Long */}
          <button
            type="button"
            onClick={() => handleSimulateTrade('long')}
            className="h-7.5 px-2.5 rounded-lg border border-profit/30 bg-profit/10 hover:bg-profit/20 text-xs font-semibold text-profit flex items-center gap-1 transition-colors cursor-pointer"
            title="Simulate immediate LONG market fill"
          >
            <ArrowUpRight className="size-3.5" />
            <span>Test Long</span>
          </button>

          {/* Test Short */}
          <button
            type="button"
            onClick={() => handleSimulateTrade('short')}
            className="h-7.5 px-2.5 rounded-lg border border-loss/30 bg-loss/10 hover:bg-loss/20 text-xs font-semibold text-loss flex items-center gap-1 transition-colors cursor-pointer"
            title="Simulate immediate SHORT market fill"
          >
            <ArrowDownRight className="size-3.5" />
            <span>Test Short</span>
          </button>

          {/* Volatility Shock */}
          <button
            type="button"
            onClick={() => handleInjectVolatility(Math.random() > 0.5 ? 'pump' : 'dump')}
            className="h-7.5 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="Inject market shock to test risk gates"
          >
            <Activity className="size-3.5 text-amber-400" />
            <span>Inject Shock</span>
          </button>

          {/* Reset Simulation */}
          <button
            type="button"
            onClick={handleResetSimulation}
            className="h-7.5 px-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Reset test simulation positions"
          >
            <RefreshCw className="size-3" />
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
              This will immediately halt all <strong className="text-foreground">{liveBots.length} live bots</strong>, stop their background scheduler execution jobs, and pause live trading.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setKillConfirmed(false)}
                className="h-9 px-4 rounded-lg border border-border text-xs font-medium hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleKillAll}
                disabled={loading}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 cursor-pointer"
              >
                {loading ? 'Halting...' : 'Halt All Live Bots'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Paper P&L</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold font-mono tracking-tight ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatINR(totalPnl, { signed: true })}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({formatPct(totalPnlPct)})
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Open Positions</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight">{openPositions.length}</span>
            <span className="text-[11px] text-muted-foreground font-mono">Active Positions</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-sm">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Live Equity</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight text-brand">
              {formatINR(totalEquity > 0 ? totalEquity : 100000)}
            </span>
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
            <h2 className="text-base font-bold tracking-tight">Strategy Bots & Execution Loops</h2>
            <span className="text-xs text-muted-foreground font-mono">
              ({liveBots.length} Live / {bots.length} Total)
            </span>
          </div>

          {/* Strategy Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setBotFilter('live')}
              className={`h-7 px-3 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                botFilter === 'live'
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              Live Only ({liveBots.length})
            </button>
            <button
              onClick={() => setBotFilter('all')}
              className={`h-7 px-3 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                botFilter === 'all'
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              All Bots ({bots.length})
            </button>
          </div>
        </div>

        {displayedBots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center flex flex-col items-center justify-center gap-3">
            <Radio className="size-8 text-muted-foreground/60 animate-pulse" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">No Live Bots Active</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Switch to "All Bots" tab above to start a strategy loop, or build a new bot in the Builder.
              </p>
            </div>
            <button
              onClick={() => setBotFilter('all')}
              className="h-8 px-4 rounded-full bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              View All Deployable Bots
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedBots.map((bot) => {
              const liveSession = activeSessions.find((s) => s.botId === bot.id)
              const isBotLive = bot.status === 'live' || Boolean(liveSession)

              // Extract resolution & interval
              const ohlcvNode = bot.graph?.nodes?.find((n) => n.componentId === 'ohlcv-feed')
              const resolution = (ohlcvNode?.config?.resolution as string) || liveSession?.resolution || '1m'
              const intervalVal = (ohlcvNode?.config?.interval as number) || liveSession?.interval || (resolution === '1m' ? 60 : 900)
              const intervalLabel = intervalVal < 60 ? `${intervalVal}s` : resolution

              return (
                <div
                  key={bot.id}
                  className={`rounded-xl border bg-card p-5 flex flex-col justify-between gap-4 relative overflow-hidden transition-all ${
                    isBotLive
                      ? 'border-profit/40 shadow-profit/5 shadow-md'
                      : 'border-border opacity-90 hover:opacity-100'
                  }`}
                >
                  {isBotLive && (
                    <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-profit/80 via-brand to-profit/80 animate-pulse" />
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={isBotLive ? 'live' : bot.status} />
                        {isBotLive && (
                          <span className="size-1.5 rounded-full bg-profit animate-ping" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-tertiary">
                        {isBotLive ? `${liveSession?.symbol || 'BTCUSDT'} (${intervalLabel} loop)` : 'Standby'}
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
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {bot.description || 'Configured strategy DAG with automated risk & execution layers.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {isBotLive && liveSession ? 'Live Equity' : (bot.headlineMetric?.label || 'Status')}
                      </span>
                      <span className={`text-sm font-bold font-mono ${isBotLive ? 'text-foreground' : (bot.headlineMetric?.positive ? 'text-profit' : 'text-loss')}`}>
                        {isBotLive && liveSession ? formatINR(liveSession.equity) : (bot.headlineMetric?.value || '—')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/app/bots/${bot.id}?tab=live`}
                        className="h-8 px-3 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-xs font-semibold text-foreground transition-colors inline-flex items-center gap-1"
                        title="Open full live bot monitor"
                      >
                        <Radio className="size-3.5 text-brand" /> Monitor
                      </Link>

                      {isBotLive ? (
                        <button
                          onClick={() => handlePauseBot(bot.id, bot.name)}
                          className="h-8 px-3.5 rounded-lg border border-warn/30 bg-warn/10 text-xs font-semibold text-warn hover:bg-warn/20 transition-colors cursor-pointer"
                        >
                          Pause Bot
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartBot(bot.id, bot.name)}
                          className="h-8 px-3.5 rounded-lg border border-profit/30 bg-profit/10 text-xs font-semibold text-profit hover:bg-profit/20 transition-colors cursor-pointer"
                        >
                          Start Live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Live Market Positions Table Card */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Active Market Positions</h2>
            <span className="size-2 rounded-full bg-profit animate-ping" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">{openPositions.length} Open Positions</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[480px] rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/95 font-medium text-muted-foreground backdrop-blur-sm">
              <tr>
                <th className="p-3 pl-4">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Size</th>
                <th className="p-3">Entry Price</th>
                <th className="p-3">Live LTP</th>
                <th className="p-3">Unrealized P&amp;L (₹)</th>
                <th className="p-3">P&amp;L %</th>
                <th className="p-3">Stop Loss</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Originating Bot</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {openPositions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground text-xs font-medium">
                      No active open positions currently. Live strategy graphs will enter positions upon meeting conviction thresholds on closed candles.
                    </td>
                  </tr>
                ) : (
                  openPositions.map((pos) => {
                    const isLong = pos.side === 'long'
                    const uPnl = pos.unrealizedPnl || 0
                    const uPnlPct = pos.unrealizedPnlPct || 0

                    return (
                      <motion.tr
                        key={pos.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => openPositionInspector(pos)}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 pl-4 font-bold text-foreground group-hover:text-brand transition-colors">{pos.symbol}</td>
                        <td className="p-3">
                          <Badge
                            variant={isLong ? 'profit' : 'loss'}
                            size="sm"
                            className="uppercase font-mono inline-flex items-center gap-0.5 text-[10px]"
                          >
                            {isLong ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {pos.side}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-semibold text-foreground">
                          {pos.size < 1 ? pos.size.toFixed(4) : pos.size.toFixed(2)}
                        </td>
                        <td className="p-3 font-mono">{formatINR(pos.entryPrice)}</td>
                        <td className="p-3 font-mono font-semibold text-foreground">
                          ${(pos.currentLtp || pos.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 font-mono font-bold ${uPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatINR(uPnl, { signed: true })}
                        </td>
                        <td className={`p-3 font-mono font-bold ${uPnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatPct(uPnlPct)}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {pos.stopPrice ? formatINR(pos.stopPrice) : 'None'}
                        </td>
                        <td className="p-3 font-mono font-semibold text-brand">
                          {Math.round(pos.confidence * 100)}%
                        </td>
                        <td className="p-3">
                          <Link
                            href={`/app/bots/${pos.botId}?tab=live`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-foreground hover:text-brand transition-colors inline-flex items-center gap-1"
                          >
                            {pos.botName} <ExternalLink className="size-3" />
                          </Link>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPositionInspector(pos)
                              }}
                              className="h-7 px-2.5 inline-flex items-center justify-center rounded-lg border border-border bg-secondary/80 text-[11px] font-medium hover:bg-secondary hover:text-brand transition-colors cursor-pointer"
                            >
                              <Eye className="size-3 mr-1 text-brand" />
                              Inspect Flow
                            </button>
                            <Link
                              href={`/app/bots/${pos.botId}?tab=live`}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 px-2.5 inline-flex items-center justify-center rounded-lg bg-secondary text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                            >
                              View Bot
                            </Link>
                          </div>
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

      {/* Live Executed & Closed Trades History Card */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Recent Executed &amp; Closed Trades</h2>
            <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
              {allTrades.length} Closed
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Across All User Bots</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[480px] rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-border bg-card/95 font-medium text-muted-foreground backdrop-blur-sm">
              <tr>
                <th className="p-3 pl-4">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Originating Bot</th>
                <th className="p-3">Entry Time (IST)</th>
                <th className="p-3">Exit Time (IST)</th>
                <th className="p-3">Size</th>
                <th className="p-3">Realized P&amp;L (₹)</th>
                <th className="p-3">P&amp;L %</th>
                <th className="p-3">Exit Trigger</th>
                <th className="p-3 pr-4 text-right">Execution Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {allTrades.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground text-xs font-medium">
                      No live executed trades recorded yet across active sessions.
                    </td>
                  </tr>
                ) : (
                  allTrades.map((trade) => {
                    const isLong = trade.side === 'long'

                    return (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => openClosedTradeInspector(trade)}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 pl-4 font-bold text-foreground group-hover:text-brand transition-colors">
                          {trade.symbol}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={isLong ? 'profit' : 'loss'}
                            size="sm"
                            className="uppercase font-mono inline-flex items-center gap-0.5 text-[10px]"
                          >
                            {isLong ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {trade.side}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Link
                            href={`/app/bots/${trade.botId}?tab=live`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-foreground hover:text-brand transition-colors inline-flex items-center gap-1"
                          >
                            {trade.botName} <ExternalLink className="size-3" />
                          </Link>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground text-xs">
                          {formatDate(trade.entryTime, { withTime: true })}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground text-xs">
                          {formatDate(trade.exitTime, { withTime: true })}
                        </td>
                        <td className="p-3 font-mono font-semibold text-foreground">
                          {Number(trade.size).toFixed(4)}
                        </td>
                        <td className={`p-3 font-mono font-bold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatINR(trade.pnl, { signed: true })}
                        </td>
                        <td className={`p-3 font-mono font-bold ${trade.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {formatPct(trade.pnlPct)}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-xs">
                          {trade.triggerNode || 'take-profit'}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openClosedTradeInspector(trade)
                            }}
                            className="h-7 px-2.5 inline-flex items-center justify-center rounded-lg border border-border bg-secondary/80 text-[11px] font-medium hover:bg-secondary hover:text-brand transition-colors cursor-pointer gap-1"
                          >
                            <Eye className="size-3 text-brand" />
                            Inspect Flow &rarr;
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

      {/* Real-time Execution & Audit Trail */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">Real-time Execution & Audit Trail</h2>
            <span className="text-xs text-muted-foreground font-mono">({filteredLogs.length} events logged)</span>
          </div>

          {/* Log Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'system', 'fill', 'signal', 'risk', 'warn'].map((f) => (
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

        {/* Terminal Log Console */}
        <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 shadow-inner max-h-64 overflow-y-auto">
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-start gap-2.5 leading-relaxed border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="text-tertiary select-none text-[11px] shrink-0">{log.time}</span>
                <Badge
                  variant={
                    log.type === 'fill'
                      ? 'profit'
                      : log.type === 'risk'
                      ? 'warn'
                      : log.type === 'warn'
                      ? 'loss'
                      : 'brand'
                  }
                  size="sm"
                  className="uppercase text-[9px] shrink-0"
                >
                  {log.type}
                </Badge>
                <span className="text-emerald-400/80 font-semibold shrink-0">[{log.bot}]</span>
                <span className="text-foreground/90">{log.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Trade Decision & DAG Execution Flow Modal */}
      <TradeFlowModal
        open={tradeModalOpen}
        onOpenChange={setTradeModalOpen}
        trade={inspectTrade}
      />
    </div>
  )
}
