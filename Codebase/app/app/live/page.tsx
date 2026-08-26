'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Radio,
  Pause,
  Play,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'

export default function LiveMonitoringPage() {
  const bots = useWorkspace((s) => s.bots)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)

  const liveBots = bots.filter((b) => b.status === 'live')
  const [killConfirmed, setKillConfirmed] = useState(false)

  const mockPositions = [
    { id: 'pos-1', symbol: 'NIFTY24AUGFUT', side: 'LONG', size: 150, entry: 24520, mark: 24685, pnl: 24750, pnlPct: 1.34, bot: 'Nifty Momentum v4' },
    { id: 'pos-2', symbol: 'RELIANCE', side: 'SHORT', size: 250, entry: 2980, mark: 2942, pnl: 9500, pnlPct: 1.28, bot: 'Headline Reversal' },
    { id: 'pos-3', symbol: 'BANKNIFTY24AUGFUT', side: 'LONG', size: 60, entry: 51200, mark: 51050, pnl: -9000, pnlPct: -0.58, bot: 'Bank Nifty Mean Reversion' },
  ]

  const mockLogs = [
    { id: 'l1', time: '15:28:42', type: 'fill', bot: 'Nifty Momentum v4', text: 'FILLED: Buy 150 NIFTY24AUGFUT @ 24,520 (Slippage: +0.4 pts)' },
    { id: 'l2', time: '15:28:41', type: 'risk', bot: 'Nifty Momentum v4', text: 'RISK GATE PASSED: Exposure 12.4% below 25.0% ceiling' },
    { id: 'l3', time: '15:25:10', type: 'signal', bot: 'Headline Reversal', text: 'SIGNAL EMITTED: Technical Analyst (0.78 confidence) -> SHORT RELIANCE' },
    { id: 'l4', time: '15:20:02', type: 'warn', bot: 'Bank Nifty Mean Reversion', text: 'DRAWDOWN WARNING: Intra-day drawdown reached -1.2%' },
    { id: 'l5', time: '15:15:00', type: 'system', bot: 'System Engine', text: 'HEARTBEAT OK: Latency 14ms across NSE Level 2 feeds' },
  ]

  const handleKillAll = () => {
    liveBots.forEach((b) => setBotStatus(b.id, 'paused'))
    toast.error('EMERGENCY KILL TRIGGERED', 'All live bots have been paused and execution halted.')
    setKillConfirmed(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-profit opacity-75" />
            <span className="relative size-3 rounded-full bg-profit" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Execution & Monitoring</h1>
            <p className="text-xs text-muted-foreground">
              Real-time feed from active strategy graphs and order gateways
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {liveBots.length > 0 && (
            <button
              onClick={() => {
                liveBots.forEach((b) => setBotStatus(b.id, 'paused'))
                toast.info('All bots paused', 'Live execution paused.')
              }}
              className="h-9 px-4 rounded-full border border-warn/30 bg-warn/10 text-xs font-semibold text-warn hover:bg-warn/20 transition-colors flex items-center gap-2"
            >
              <Pause className="size-3.5" /> Pause All
            </button>
          )}

          <button
            onClick={() => setKillConfirmed(true)}
            className="h-9 px-4 rounded-full border border-destructive/40 bg-destructive/15 text-xs font-semibold text-destructive hover:bg-destructive/25 transition-colors flex items-center gap-2"
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

      {/* Active Live Bots Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bots.slice(0, 3).map((bot) => (
          <div key={bot.id} className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <StatusBadge status={bot.status} />
                <span className="text-[11px] font-mono text-tertiary">14ms latency</span>
              </div>
              <Link href={`/app/builder/${bot.id}`} className="font-bold text-base hover:text-brand transition-colors">
                {bot.name}
              </Link>
              <p className="text-xs text-muted-foreground line-clamp-2">{bot.description}</p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">90d Return</span>
                <span className={`text-sm font-bold ${bot.headlineMetric.positive ? 'text-profit' : 'text-loss'}`}>
                  {bot.headlineMetric.value || '—'}
                </span>
              </div>

              {bot.status === 'live' ? (
                <button
                  onClick={() => {
                    setBotStatus(bot.id, 'paused')
                    toast.info('Bot Paused', `${bot.name} paused.`)
                  }}
                  className="h-8 px-3 rounded-lg border border-warn/30 bg-warn/10 text-xs font-medium text-warn hover:bg-warn/20"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => {
                    setBotStatus(bot.id, 'live')
                    toast.success('Bot Live', `${bot.name} is now live.`)
                  }}
                  className="h-8 px-3 rounded-lg border border-profit/30 bg-profit/10 text-xs font-medium text-profit hover:bg-profit/20"
                >
                  Start Live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live Positions Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">Active Market Positions</h2>
          <span className="text-xs text-muted-foreground font-mono">3 Open Positions</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
              <tr>
                <th className="p-3 pl-4">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Size</th>
                <th className="p-3">Entry Price</th>
                <th className="p-3">Mark Price</th>
                <th className="p-3">Unrealized P&L</th>
                <th className="p-3 pr-4">Originating Bot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockPositions.map((pos) => (
                <tr key={pos.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-3 pl-4 font-bold text-foreground">{pos.symbol}</td>
                  <td className="p-3">
                    <Badge variant={pos.side === 'LONG' ? 'profit' : 'loss'} size="sm">
                      {pos.side}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono">{pos.size}</td>
                  <td className="p-3 font-mono">₹{pos.entry.toLocaleString('en-IN')}</td>
                  <td className="p-3 font-mono">₹{pos.mark.toLocaleString('en-IN')}</td>
                  <td className={`p-3 font-bold font-mono ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toLocaleString('en-IN')} ({pos.pnlPct}%)
                  </td>
                  <td className="p-3 pr-4 text-tertiary">{pos.bot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Logs Feed */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold tracking-tight">Real-time Execution & Audit Trail</h2>
        <div className="rounded-xl border border-border bg-card p-4 font-mono text-xs flex flex-col gap-2.5 max-h-80 overflow-y-auto">
          {mockLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <span className="text-tertiary shrink-0">{log.time}</span>
              <Badge
                variant={
                  log.type === 'fill'
                    ? 'profit'
                    : log.type === 'risk'
                    ? 'brand'
                    : log.type === 'warn'
                    ? 'warn'
                    : 'neutral'
                }
                size="sm"
              >
                {log.type}
              </Badge>
              <span className="text-muted-foreground font-semibold shrink-0">[{log.bot}]</span>
              <span className="text-foreground truncate">{log.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
