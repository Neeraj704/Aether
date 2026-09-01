'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { LineChart, Trash2, ExternalLink } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { listBacktestRuns, deleteBacktestRun } from '@/lib/engine'
import { toast } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PillLink } from '@/components/ui/pill-button'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, THead, TBody, TR, TH, TD, SortHeader } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDate, formatPct } from '@/lib/utils'

export function BacktestsTab({ bot }: { bot: Bot }) {
  const localRuns = useWorkspace((s) => s.runs).filter((r) => r.botId === bot.id)
  const deleteRunLocal = useWorkspace((s) => s.deleteRun)
  const [runs, setRuns] = useState<BacktestRun[]>(localRuns)
  const [sortKey, setSortKey] = useState<'createdAt' | 'totalReturn' | 'sharpe' | 'trades'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [runToDelete, setRunToDelete] = useState<{ id: string; dateStr: string } | null>(null)

  useEffect(() => {
    let active = true
    listBacktestRuns(bot.id)
      .then((remoteRuns) => {
        if (!active) return
        if (remoteRuns && remoteRuns.length > 0) {
          setRuns(remoteRuns)
        }
      })
      .catch((err) => {
        console.error('Failed to load remote backtest runs:', err)
      })
    return () => {
      active = false
    }
  }, [bot.id])

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'createdAt') {
        return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
      if (sortKey === 'totalReturn') {
        return mul * ((a.metrics?.totalReturn ?? 0) - (b.metrics?.totalReturn ?? 0))
      }
      if (sortKey === 'sharpe') {
        return mul * ((a.metrics?.sharpe ?? 0) - (b.metrics?.sharpe ?? 0))
      }
      if (sortKey === 'trades') {
        return mul * ((a.metrics?.trades ?? 0) - (b.metrics?.trades ?? 0))
      }
      return 0
    })
  }, [runs, sortKey, sortDir])

  const handleDeleteRun = (id: string, dateStr: string) => {
    setRunToDelete({ id, dateStr })
  }

  const handleConfirmDelete = async () => {
    if (runToDelete) {
      try {
        await deleteBacktestRun(runToDelete.id)
      } catch (err) {
        console.error('Engine delete backtest error:', err)
      }
      deleteRunLocal(runToDelete.id)
      setRuns((prev) => prev.filter((r) => r.id !== runToDelete.id))
      toast.info('Backtest deleted', 'Run record removed.')
      setRunToDelete(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Backtest History</CardTitle>
          <span className="text-xs text-muted-foreground">
            {runs.length} total run{runs.length === 1 ? '' : 's'} recorded for this bot
          </span>
        </div>
        <PillLink href={`/app/bots/${bot.id}/backtest`} size="sm">
          Run new backtest
        </PillLink>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="No backtests found"
            description="You haven't run any backtests for this bot yet. Configure and execute your first simulation."
            action={{ label: 'Run new backtest', href: `/app/bots/${bot.id}/backtest` }}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <SortHeader
                  label="Date & Time"
                  dir={sortKey === 'createdAt' ? sortDir : null}
                  onClick={() => toggleSort('createdAt')}
                />
                <TH>Type</TH>
                <TH>Symbols</TH>
                <SortHeader
                  label="Total Return"
                  numeric
                  dir={sortKey === 'totalReturn' ? sortDir : null}
                  onClick={() => toggleSort('totalReturn')}
                />
                <SortHeader
                  label="Sharpe"
                  numeric
                  dir={sortKey === 'sharpe' ? sortDir : null}
                  onClick={() => toggleSort('sharpe')}
                />
                <SortHeader
                  label="Trades"
                  numeric
                  dir={sortKey === 'trades' ? sortDir : null}
                  onClick={() => toggleSort('trades')}
                />
                <TH numeric>Max Drawdown</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {sortedRuns.map((run) => {
                const formattedDate = formatDate(run.createdAt, { withTime: true })
                const totalReturn = run.metrics?.totalReturn ?? 0
                const sharpe = run.metrics?.sharpe ?? 0
                const tradesCount = run.metrics?.trades ?? 0
                const maxDrawdown = run.metrics?.maxDrawdown ?? 0

                return (
                  <TR key={run.id}>
                    <TD className="font-medium text-foreground">
                      <Link
                        href={`/app/bots/${bot.id}/backtest/${run.id}`}
                        className="hover:text-brand hover:underline"
                      >
                        {formattedDate}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant="outline" size="sm" className="capitalize">
                        {run.config?.type || 'historical'}
                      </Badge>
                    </TD>
                    <TD className="text-muted-foreground text-xs">{run.config?.symbols || 'BTC/USDT'}</TD>
                    <TD numeric className={`font-bold ${totalReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatPct(totalReturn)}
                    </TD>
                    <TD numeric>{sharpe.toFixed(2)}</TD>
                    <TD numeric>{tradesCount}</TD>
                    <TD numeric className="text-loss">
                      {formatPct(maxDrawdown)}
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/app/bots/${bot.id}/backtest/${run.id}`}
                          className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
                        >
                          Report <ExternalLink className="size-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteRun(run.id, formattedDate)}
                          className="p-1 rounded text-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Delete run"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        )}
      </CardContent>

      <ConfirmDialog
        open={runToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRunToDelete(null)
        }}
        title={`Delete backtest run from ${runToDelete?.dateStr}?`}
        description="This permanently removes the run and its results from the database. This can't be undone."
        confirmLabel="Delete run"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </Card>
  )
}
