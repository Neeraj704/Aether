'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Radio, Terminal, Play, Pause, Zap } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { OPEN_POSITIONS, LIVE_LOG_TEMPLATES } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PillLink } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { hashString, formatINR, formatPct } from '@/lib/utils'

interface DynamicPos {
  id: string
  symbol: string
  side: 'long' | 'short'
  qty: number
  entry: number
  ltp: number
  pnl: number
  pnlPct: number
  lastTickDir?: 'up' | 'down' | null
  lastTickTime?: number
}

interface DynamicLog {
  id: string
  time: string
  text: string
}

export function LiveTab({ bot, onSwitchTab }: { bot: Bot; onSwitchTab?: (tab: string) => void }) {
  const isLive = bot.status === 'live'

  // Deterministically select initial positions & logs based on bot.id
  const posCount = 1 + (hashString(bot.id) % OPEN_POSITIONS.length)
  const initialPositions: DynamicPos[] = OPEN_POSITIONS.slice(0, posCount).map((p) => ({
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    qty: p.qty,
    entry: p.entry,
    ltp: p.ltp,
    pnl: p.pnl,
    pnlPct: p.pnlPct,
  }))

  const logOffset = hashString(bot.id) % Math.max(1, LIVE_LOG_TEMPLATES.length - 3)
  const initialLogs: DynamicLog[] = LIVE_LOG_TEMPLATES.slice(logOffset, logOffset + 4).map((text, i) => ({
    id: `log-init-${i}`,
    time: new Date(Date.now() - (i + 1) * 120000).toLocaleTimeString(),
    text,
  }))

  const [positions, setPositions] = useState<DynamicPos[]>(initialPositions)
  const [logs, setLogs] = useState<DynamicLog[]>(initialLogs)
  const [isLiveActive, setIsLiveActive] = useState(true)

  // Real-time ticking effect
  useEffect(() => {
    if (!isLive || !isLiveActive) return

    const interval = setInterval(() => {
      // Fluctuate LTP & recalculate P&L
      setPositions((prev) =>
        prev.map((pos) => {
          if (Math.random() > 0.65) return pos

          const tickStep = (Math.random() - 0.49) * (pos.entry * 0.001)
          const newLtp = Math.max(1, Math.round((pos.ltp + tickStep) * 100) / 100)
          const tickDir: 'up' | 'down' = newLtp >= pos.ltp ? 'up' : 'down'

          const pnlPerUnit = pos.side === 'long' ? newLtp - pos.entry : pos.entry - newLtp
          const newPnl = Math.round(pnlPerUnit * pos.qty)
          const newPnlPct = Math.round(((newLtp - pos.entry) / pos.entry) * (pos.side === 'long' ? 100 : -100) * 100) / 100

          return {
            ...pos,
            ltp: newLtp,
            pnl: newPnl,
            pnlPct: newPnlPct,
            lastTickDir: tickDir,
            lastTickTime: Date.now(),
          }
        })
      )

      // Dynamic log streaming
      if (Math.random() < 0.3) {
        const templates = [
          `TICK EXECUTED: Order slice matched @ ₹${(24500 + Math.random() * 300).toFixed(1)}`,
          `STRATEGY EVAL: ${bot.name} technical indicators checked OK`,
          `ORDER GATEWAY: 12ms ping roundtrip to NSE co-location server`,
          `RISK CHECK PASSED: Drawdown exposure within limits`,
          `SIGNAL GENERATED: Moving Average Crossover detected on 1M candle`,
        ]
        const text = templates[Math.floor(Math.random() * templates.length)]

        const newLog: DynamicLog = {
          id: `log-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          text,
        }

        setLogs((prev) => [newLog, ...prev.slice(0, 19)])
      }
    }, 1400)

    return () => clearInterval(interval)
  }, [isLive, isLiveActive, bot.name])

  if (!isLive) {
    return (
      <Card>
        <EmptyState
          icon={Radio}
          title="This bot isn't live"
          description="Promote a backtested version to paper trading to start the live monitor."
          action={{
            label: 'Run backtest',
            href: `/app/bots/${bot.id}/backtest`,
          }}
          secondary={
            onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab('backtests')}
                className="text-xs text-brand hover:underline font-medium mt-1"
              >
                Or view existing backtests &rarr;
              </button>
            )
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex size-2.5">
            <span className={`absolute inset-0 rounded-full ${isLiveActive ? 'animate-ping bg-profit opacity-75' : 'bg-muted-foreground'}`} />
            <span className={`relative size-2.5 rounded-full ${isLiveActive ? 'bg-profit' : 'bg-muted-foreground'}`} />
          </div>
          <CardTitle>Live Monitor &mdash; {bot.name}</CardTitle>
          <span className="text-[10px] font-mono text-profit bg-profit/10 border border-profit/20 rounded-full px-2 py-0.5 animate-pulse">
            Real-time Feed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiveActive(!isLiveActive)}
            className="h-8 px-2.5 rounded-full border border-border bg-secondary/50 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            {isLiveActive ? <Pause className="size-3" /> : <Play className="size-3" />}
            {isLiveActive ? 'Pause Ticks' : 'Resume Ticks'}
          </button>
          <PillLink href="/app/live" size="sm">
            Open full live monitor &rarr;
          </PillLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Open Positions Table */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary flex items-center gap-2">
              Active Positions ({positions.length})
              <span className="size-1.5 rounded-full bg-profit animate-ping" />
            </h4>
            <span className="text-xs text-muted-foreground font-mono">
              Live Paper Execution Feed
            </span>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Symbol</TH>
                <TH>Side</TH>
                <TH numeric>Qty</TH>
                <TH numeric>Entry Price</TH>
                <TH numeric>LTP (Live Price)</TH>
                <TH numeric>Unrealised P&L</TH>
              </TR>
            </THead>
            <TBody>
              {positions.map((pos) => {
                const isRecentTick = pos.lastTickTime && Date.now() - pos.lastTickTime < 700
                const tickFlashClass = isRecentTick
                  ? pos.lastTickDir === 'up'
                    ? 'bg-profit/15 text-profit'
                    : 'bg-loss/15 text-loss'
                  : ''

                return (
                  <TR key={pos.id} className={`transition-colors duration-200 ${tickFlashClass}`}>
                    <TD className="font-semibold text-foreground flex items-center gap-1.5">
                      {pos.symbol}
                      {isRecentTick && (
                        <span className={`text-[10px] ${pos.lastTickDir === 'up' ? 'text-profit' : 'text-loss'}`}>
                          {pos.lastTickDir === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={pos.side === 'long' ? 'profit' : 'loss'} size="sm" className="uppercase font-mono text-[10px]">
                        {pos.side}
                      </Badge>
                    </TD>
                    <TD numeric>{pos.qty}</TD>
                    <TD numeric>{formatINR(pos.entry)}</TD>
                    <TD numeric className="font-semibold font-mono">{formatINR(pos.ltp)}</TD>
                    <TD numeric className={`font-bold font-mono transition-colors duration-200 ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatINR(pos.pnl, { signed: true })} ({formatPct(pos.pnlPct)})
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </div>

        {/* Live Execution Console Logs */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
              Recent Agent Activity Stream
            </h4>
            <span className="text-[11px] font-mono text-tertiary">Auto-scroll Active</span>
          </div>
          <div className="rounded-xl border border-border bg-black/95 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 shadow-inner max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
              <div className="flex items-center gap-2">
                <Terminal className="size-3.5" /> Stream Log ({bot.name})
              </div>
              <span className="text-[10px] text-profit flex items-center gap-1">
                <Zap className="size-3" /> Live
              </span>
            </div>
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 leading-relaxed border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-tertiary select-none text-[11px] shrink-0">[{log.time}]</span>
                  <span className="text-foreground/90 leading-normal">{log.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
