'use client'

import { useMemo, useState } from 'react'
import { Search, ArrowUpRight, ArrowDownRight, Eye, Sparkles } from 'lucide-react'
import type { Trade } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD, SortHeader } from '@/components/ui/table'
import { Segmented } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatINR, formatPct } from '@/lib/utils'
import { TradeFlowModal } from './trade-flow-modal'

export function TradeLogTable({ trades }: { trades: Trade[] }) {
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all')

  const [sortKey, setSortKey] = useState<'entryTime' | 'pnl' | 'pnlPct'>('entryTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleRowClick = (trade: Trade) => {
    setSelectedTrade(trade)
    setModalOpen(true)
  }

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
        const matchSearch =
          search.trim() === '' ||
          t.symbol.toLowerCase().includes(search.toLowerCase()) ||
          t.triggerNode.toLowerCase().includes(search.toLowerCase())
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
    <>
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Executed Trade Log</CardTitle>
              <Badge variant="outline" className="text-[10px] text-brand bg-brand/5 border-brand/20">
                <Sparkles className="size-3 mr-1" /> Click any trade to inspect DAG flow
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Showing {filteredAndSorted.length} of {trades.length} simulated trades &bull; Click any row to inspect execution
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
        <CardContent className="p-0 flex-1 overflow-y-auto min-h-0 relative">
          {filteredAndSorted.length === 0 ? (
            <EmptyState
              title="No trades match filter"
              description="Try expanding your search query or changing the side filter."
            />
          ) : (
            <Table>
              <THead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 shadow-sm">
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
                  <TH className="w-10"></TH>
                </TR>
              </THead>
              <TBody>
                {filteredAndSorted.map((trade) => (
                  <TR
                    key={trade.id}
                    onClick={() => handleRowClick(trade)}
                    className="cursor-pointer hover:bg-secondary/60 transition-colors group"
                  >
                    <TD className="font-semibold text-foreground group-hover:text-brand transition-colors">
                      {trade.symbol}
                    </TD>
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
                    <TD className="text-muted-foreground text-xs font-mono">
                      {formatDate(trade.entryTime, { withTime: true })}
                    </TD>
                    <TD className="text-muted-foreground text-xs font-mono">
                      {formatDate(trade.exitTime, { withTime: true })}
                    </TD>
                    <TD numeric className="font-mono text-xs">
                      {trade.size < 10
                        ? `${trade.size} ${trade.symbol.replace(/USDT|USD|INR/i, '')}`
                        : formatINR(trade.size)}
                    </TD>
                    <TD numeric className={`font-bold font-mono ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatINR(trade.pnl, { signed: true })}
                    </TD>
                    <TD numeric className={`font-bold font-mono ${trade.pnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatPct(trade.pnlPct)}
                    </TD>
                    <TD className="text-muted-foreground text-xs">{trade.triggerNode}</TD>
                    <TD numeric className="font-mono text-xs">
                      <span className="font-semibold text-foreground">{Math.round(trade.confidence * 100)}%</span>
                    </TD>
                    <TD className="text-right">
                      <div className="size-7 rounded-md bg-secondary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                        <Eye className="size-3.5" />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TradeFlowModal
        trade={selectedTrade}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  )
}

