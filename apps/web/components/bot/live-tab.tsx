'use client'

import { useState, useEffect, useCallback } from 'react'
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
  type LiveStateResponse,
  type LiveNodeStep,
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
import { Field, Input } from '@/components/ui/input'

interface LiveTabProps {
  bot: Bot
  onSwitchTab?: (tab: string) => void
}

export function LiveTab({ bot, onSwitchTab }: LiveTabProps) {
  const isLive = bot.status === 'live'
  const setBotStatus = useWorkspace((s) => s.setBotStatus)

  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null)
  const [loading, setLoading] = useState(isLive)
  const [isPollingActive, setIsPollingActive] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<string>('all')
  
  // Start Modal State
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [startSymbol, setStartSymbol] = useState('BTCUSDT')
  const [startCapital, setStartCapital] = useState(100000)

  // Fetch live state from engine
  const fetchState = useCallback(async () => {
    if (!isLive) return
    try {
      const state = await getLiveState(bot.id)
      setLiveState(state)
    } catch (err: any) {
      console.warn('[LiveTab] Failed to poll live state:', err)
    } finally {
      setLoading(false)
    }
  }, [bot.id, isLive])

  // Polling loop (defaults to 10s checks)
  useEffect(() => {
    if (!isLive || !isPollingActive) return
    fetchState()
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
      setLiveState(null)
      setActionLoading(false)
    }
  }

  if (!isLive) {
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

              <Field label="Trading Pair Symbol">
                <Input
                  value={startSymbol}
                  onChange={(e) => setStartSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. BTCUSDT, ETHUSDT"
                />
              </Field>

              <Field label="Simulated Starting Capital (INR / USD)">
                <Input
                  type="number"
                  value={startCapital}
                  onChange={(e) => setStartCapital(Number(e.target.value))}
                  min={1000}
                  step={10000}
                />
              </Field>
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

  const session = liveState?.session
  const position = liveState?.position
  const trades = liveState?.trades || []
  const evaluation = liveState?.evaluation
  const steps = evaluation?.steps || []
  const candle = evaluation?.candle
  const logs = liveState?.logs || []

  // Extract configured resolution & interval from bot graph or backend state
  const ohlcvNode = bot.graph?.nodes?.find((n) => n.componentId === 'ohlcv-feed')
  const botResolution = (ohlcvNode?.config?.resolution as string) || liveState?.resolution || '1m'
  const botInterval = (ohlcvNode?.config?.interval as number) || liveState?.interval || (botResolution === '1m' ? 60 : 900)
  const intervalDisplay = botInterval < 60 ? `${botInterval}s` : botResolution

  const currentEquity = session?.equity ?? session?.capital ?? 100000
  const startingCapital = session?.capital ?? 100000
  const totalReturn = startingCapital > 0 ? ((currentEquity - startingCapital) / startingCapital) * 100 : 0

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true
    return log.type === logFilter
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex size-2.5">
            <span className={`absolute inset-0 rounded-full ${isPollingActive ? 'animate-ping bg-profit opacity-75' : 'bg-muted-foreground'}`} />
            <span className={`relative size-2.5 rounded-full ${isPollingActive ? 'bg-profit' : 'bg-muted-foreground'}`} />
          </div>
          <CardTitle>Live Paper Monitor &mdash; {bot.name}</CardTitle>
          <span className="text-[10px] font-mono text-profit bg-profit/10 border border-profit/20 rounded-full px-2 py-0.5 animate-pulse">
            {intervalDisplay} Polling Loop Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPollingActive(!isPollingActive)}
            className="h-8 px-2.5 rounded-full border border-border bg-secondary/50 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isPollingActive ? <Pause className="size-3" /> : <Play className="size-3" />}
            {isPollingActive ? 'Pause Poll' : 'Resume Poll'}
          </button>
          <button
            onClick={fetchState}
            className="h-8 w-8 rounded-full border border-border bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh state now"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleStopLive}
            disabled={actionLoading}
            className="h-8 px-3 rounded-full border border-destructive/40 bg-destructive/15 text-[11px] font-semibold text-destructive hover:bg-destructive/25 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Square className="size-3 fill-current" />
            Stop Bot
          </button>
          <PillLink href="/app/live" size="sm">
            All Live Bots &rarr;
          </PillLink>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Paper Trading Compliance Banner */}
        <div className="flex items-center gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <strong>Paper trading only</strong> &mdash; Simulated execution environment. No real funds are being used.
          </span>
        </div>

        {/* Live Session Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current Equity</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-foreground">
                {formatINR(currentEquity)}
              </span>
              <span className={`text-xs font-semibold ${totalReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
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

          <div className="rounded-xl border border-border bg-card p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Last Bar Ingested</span>
            <span className="text-xs font-mono text-muted-foreground truncate">
              {session?.lastBarTime ? formatDate(session.lastBarTime) : `Awaiting next ${botResolution} bar...`}
            </span>
          </div>
        </div>

        {/* Live Market Ingest & In-Flight Candle Section */}
        {candle && (
          <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative size-2 rounded-full bg-brand" />
                </span>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Live Feed Ingest: {candle.symbol} ({botResolution})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Bar Open Time: {candle.openTime ? formatDate(candle.openTime) : 'Real-time'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
              <div className="flex flex-col bg-secondary/30 p-2.5 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase">Open</span>
                <span className="font-bold text-foreground">${Number(candle.open).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col bg-secondary/30 p-2.5 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase">High</span>
                <span className="font-bold text-profit">${Number(candle.high).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col bg-secondary/30 p-2.5 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase">Low</span>
                <span className="font-bold text-loss">${Number(candle.low).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col bg-secondary/30 p-2.5 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase">Latest Close (LTP)</span>
                <span className="font-bold text-brand">${Number(candle.close).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col bg-secondary/30 p-2.5 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase">Bar Volume</span>
                <span className="font-bold text-foreground">{Number(candle.volume).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

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
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
              Awaiting first DAG execution cycle...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {steps.map((st) => {
                const isExpanded = expandedNodeId === st.nodeId

                return (
                  <div
                    key={st.nodeId}
                    className="rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between gap-3 shadow-sm hover:border-brand/40 transition-colors"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" size="sm" className="capitalize text-[10px] font-mono">
                          {st.layer}
                        </Badge>
                        <span className="text-[10px] font-mono font-semibold text-brand">
                          {st.metricLabel}: {st.metricValue}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-foreground truncate">{st.nodeName}</h5>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {st.summary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border flex flex-col gap-2">
                      <button
                        onClick={() => setExpandedNodeId(isExpanded ? null : st.nodeId)}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-between font-mono cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Output JSON' : 'Inspect Output Payload'}</span>
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>

                      {isExpanded && (
                        <pre className="text-[10px] font-mono bg-black/80 text-emerald-400 p-2.5 rounded-lg overflow-x-auto max-h-40">
                          {JSON.stringify(st.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Active Position Section */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary flex items-center gap-2">
              Active Position
              <span className={`size-1.5 rounded-full ${position ? 'bg-profit animate-ping' : 'bg-muted-foreground'}`} />
            </h4>
            <span className="text-xs text-muted-foreground font-mono">
              Symbol: {session?.symbol || 'BTCUSDT'} ({botResolution} Interval)
            </span>
          </div>

          {position ? (
            <Table>
              <THead>
                <TR>
                  <TH>Symbol</TH>
                  <TH>Side</TH>
                  <TH numeric>Size</TH>
                  <TH numeric>Entry Price</TH>
                  <TH numeric>Stop Price</TH>
                  <TH numeric>Confidence</TH>
                </TR>
              </THead>
              <TBody>
                <TR>
                  <TD className="font-semibold text-foreground">{session?.symbol || 'BTCUSDT'}</TD>
                  <TD>
                    <Badge variant={position.side === 'long' ? 'profit' : 'loss'} size="sm" className="uppercase font-mono text-[10px]">
                      {position.side}
                    </Badge>
                  </TD>
                  <TD numeric className="font-mono">{position.size}</TD>
                  <TD numeric className="font-mono">{formatINR(position.entry_price)}</TD>
                  <TD numeric className="font-mono text-muted-foreground">
                    {position.stop_price ? formatINR(position.stop_price) : 'None'}
                  </TD>
                  <TD numeric className="font-mono font-semibold text-brand">
                    {Math.round((position.confidence || 0.75) * 100)}%
                  </TD>
                </TR>
              </TBody>
            </Table>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
              <Zap className="size-4 text-brand animate-pulse" />
              <p className="font-medium text-foreground">Currently flat &mdash; No open position</p>
              <p className="text-[11px]">The strategy graph is active and inspecting every {botResolution} bar for entry triggers.</p>
            </div>
          )}
        </div>

        {/* Closed Trades History */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
              Session Closed Trades ({trades.length})
            </h4>
            <span className="text-[11px] font-mono text-tertiary">Persisted in Supabase</span>
          </div>

          {trades.length === 0 ? (
            <div className="rounded-xl border border-border bg-card/40 p-5 text-center text-xs text-muted-foreground">
              No trades closed yet during this live session.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Symbol</TH>
                  <TH>Side</TH>
                  <TH>Entry</TH>
                  <TH>Exit</TH>
                  <TH numeric>P&L</TH>
                  <TH numeric>Return</TH>
                </TR>
              </THead>
              <TBody>
                {trades.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-semibold text-foreground">{t.symbol}</TD>
                    <TD>
                      <Badge variant={t.side === 'long' ? 'profit' : 'loss'} size="sm" className="uppercase font-mono text-[10px]">
                        {t.side}
                      </Badge>
                    </TD>
                    <TD className="font-mono text-[11px] text-muted-foreground">{formatDate(t.entryTime)}</TD>
                    <TD className="font-mono text-[11px] text-muted-foreground">{formatDate(t.exitTime)}</TD>
                    <TD numeric className={`font-bold font-mono ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatINR(t.pnl, { signed: true })}
                    </TD>
                    <TD numeric className={`font-mono ${t.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatPct(t.pnlPct)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        {/* Live Execution Console Logs */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary flex items-center gap-2">
              Agent Execution & Scheduling Log
              <span className="text-[10px] font-mono text-profit flex items-center gap-1">
                <Zap className="size-3" /> APScheduler {intervalDisplay} Loop
              </span>
            </h4>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['all', 'data', 'features', 'signal', 'risk', 'fill', 'system'].map((f) => (
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

          <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 shadow-inner max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5" /> Engine Stream Log ({bot.name})
              </div>
              <span className="text-[10px] text-tertiary">
                Session ID: {session?.id ? session.id.slice(0, 8) : '—'}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {filteredLogs.length === 0 ? (
                <div className="text-muted-foreground py-4 text-center text-xs">
                  Awaiting next scheduled evaluation tick...
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-2 leading-relaxed border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                  >
                    <span className="text-tertiary select-none text-[11px] shrink-0">[{log.time}]</span>
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
                          : 'neutral'
                      }
                      size="sm"
                      className="uppercase text-[9px] shrink-0"
                    >
                      {log.type}
                    </Badge>
                    <span className="text-emerald-400/80 font-semibold shrink-0">[{log.node}]</span>
                    <span className="text-foreground/90">{log.text}</span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
