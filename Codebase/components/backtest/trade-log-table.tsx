'use client'

import { useMemo, useState } from 'react'
import { Search, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { Trade } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, SortHeader } from '@/components/ui/table'
import { Segmented } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatINR, formatPct } from '@/lib/utils'

export function TradeLogTable({ trades }: { trades: Trade[] }) {
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all')

  const [sortKey, setSortKey] = useState<'entryTime' | 'pnl' | 'pnlPct'>('entryTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filteredAndSorted = useMemo(() => {
    return trades
      .filter((t) => {
        const matchSearch = search.trim() === '' || t.symbol.toLowerCase().includes(search.toLowerCase()) || t.triggerNode.toLowerCase().includes(search.toLowerCase())
        const matchSide = sideFilter === 'all' || t.side === sideFilter
        return matchSearch && matchSide
      })
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1
        if (sortKey === 'entryTime') {
          return mul * (new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())
        }
        if (sortKey === 'pnl') {
          return mul * (a.pnl - b.pnl)
        }
        if (sortKey === 'pnlPct') {
          return mul * (a.pnlPct - b.pnlPct)
        }
        return 0
      })
  }, [trades, search, sideFilter, sortKey, sortDir])

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle>Executed Trade Log</CardTitle>
          <span className="text-xs text-muted-foreground">
            Showing {filteredAndSorted.length} of {trades.length} simulated trades
          </span>
        </div>

        {/* Search & Filter bar */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or node..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Segmented<'all' | 'long' | 'short'>
            options={[
              { value: 'all', label: 'All' },
              { value: 'long', label: 'Long' },
              { value: 'short', label: 'Short' },
            ]}
            value={sideFilter}
            onValueChange={setSideFilter}
            size="sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredAndSorted.length === 0 ? (
          <EmptyState
            title="No trades match filter"
            description="Try expanding your search query or changing the side filter."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Symbol</TH>
                <TH>Side</TH>
                <SortHeader
                  label="Entry Time"
                  dir={sortKey === 'entryTime' ? sortDir : null}
                  onClick={() => toggleSort('entryTime')}
                />
                <TH>Exit Time</TH>
                <TH numeric>Position Size</TH>
                <SortHeader
                  label="P&L (₹)"
                  numeric
                  dir={sortKey === 'pnl' ? sortDir : null}
                  onClick={() => toggleSort('pnl')}
                />
                <SortHeader
                  label="P&L %"
                  numeric
                  dir={sortKey === 'pnlPct' ? sortDir : null}
                  onClick={() => toggleSort('pnlPct')}
                />
                <TH>Trigger Node</TH>
                <TH numeric>Confidence</TH>
              </TR>
            </THead>
            <TBody>
              {filteredAndSorted.map((trade) => (
                <TR key={trade.id}>
                  <TD className="font-semibold text-foreground">{trade.symbol}</TD>
                  <TD>
                    <Badge
                      variant={trade.side === 'long' ? 'profit' : 'loss'}
                      size="sm"
                      className="uppercase font-mono text-[10px]"
                    >
                      {trade.side === 'long' ? (
                        <ArrowUpRight className="size-3 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="size-3 mr-0.5" />
                      )}
                      {trade.side}
                    </Badge>
                  </TD>
                  <TD className="text-muted-foreground text-xs">{formatDate(trade.entryTime, { withTime: true })}</TD>
                  <TD className="text-muted-foreground text-xs">{formatDate(trade.exitTime, { withTime: true })}</TD>
                  <TD numeric>{formatINR(trade.size)}</TD>
                  <TD numeric className={`font-bold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatINR(trade.pnl, { signed: true })}
                  </TD>
                  <TD numeric className={`font-bold ${trade.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPct(trade.pnlPct)}
                  </TD>
                  <TD className="text-muted-foreground text-xs">{trade.triggerNode}</TD>
                  <TD numeric className="font-mono text-xs">
                    {Math.round(trade.confidence * 100)}%
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
