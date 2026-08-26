'use client'

import { Radio, Terminal } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { OPEN_POSITIONS, LIVE_LOG_TEMPLATES } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PillLink } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { hashString, formatINR, formatPct } from '@/lib/utils'

export function LiveTab({ bot, onSwitchTab }: { bot: Bot; onSwitchTab?: (tab: string) => void }) {
  const isLive = bot.status === 'live'

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

  // Deterministically select positions & log lines based on bot.id
  const posCount = 1 + (hashString(bot.id) % OPEN_POSITIONS.length)
  const botPositions = OPEN_POSITIONS.slice(0, posCount)

  const logOffset = hashString(bot.id) % (LIVE_LOG_TEMPLATES.length - 3)
  const botLogs = LIVE_LOG_TEMPLATES.slice(logOffset, logOffset + 4)
  const relativeTimestamps = ['just now', '2m ago', '5m ago', '9m ago']

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2.5 rounded-full bg-profit animate-pulse" />
          <CardTitle>Live Monitor &mdash; {bot.name}</CardTitle>
        </div>
        <PillLink href="/app/live" size="sm">
          Open full live monitor &rarr;
        </PillLink>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Open Positions Table */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
              Active Positions ({botPositions.length})
            </h4>
            <span className="text-xs text-muted-foreground font-mono">
              Live Paper Execution
            </span>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Symbol</TH>
                <TH>Side</TH>
                <TH numeric>Qty</TH>
                <TH numeric>Entry Price</TH>
                <TH numeric>LTP</TH>
                <TH numeric>Unrealised P&L</TH>
              </TR>
            </THead>
            <TBody>
              {botPositions.map((pos) => (
                <TR key={pos.id}>
                  <TD className="font-semibold text-foreground">{pos.symbol}</TD>
                  <TD>
                    <Badge variant={pos.side === 'long' ? 'profit' : 'loss'} size="sm" className="uppercase font-mono text-[10px]">
                      {pos.side}
                    </Badge>
                  </TD>
                  <TD numeric>{pos.qty}</TD>
                  <TD numeric>{formatINR(pos.entry)}</TD>
                  <TD numeric>{formatINR(pos.ltp)}</TD>
                  <TD numeric className={`font-bold ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatINR(pos.pnl, { signed: true })} ({formatPct(pos.pnlPct)})
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {/* Live Execution Console Logs */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-tertiary">
            Recent Agent Activity Log
          </h4>
          <div className="rounded-xl border border-border bg-black/90 p-4 font-mono text-xs text-emerald-400 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-muted-foreground text-[11px]">
              <Terminal className="size-3.5" /> Stream Log ({bot.name})
            </div>
            {botLogs.map((logText, i) => (
              <div key={i} className="flex items-start gap-2 leading-relaxed">
                <span className="text-tertiary select-none text-[11px]">[{relativeTimestamps[i] || 'just now'}]</span>
                <span className="text-foreground/90">{logText}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
