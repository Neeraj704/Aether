'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Sparkles,
  Code2,
  Copy,
  Check,
  Download,
  FileJson,
} from 'lucide-react'
import type { Trade } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, THead, TBody, TR, TH, TD, SortHeader } from '@/components/ui/table'
import { Segmented } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatDate, formatINR, formatPct } from '@/lib/utils'
import { TradeFlowModal, buildComprehensiveTradeJson } from './trade-flow-modal'

export function TradeLogTable({ trades }: { trades: Trade[] }) {
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all')

  const [sortKey, setSortKey] = useState<'entryTime' | 'pnl' | 'pnlPct'>('entryTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Raw JSON Modal State
  const [jsonModalOpen, setJsonModalOpen] = useState(false)
  const [jsonModalTitle, setJsonModalTitle] = useState('Raw Trade JSON')
  const [rawJsonContent, setRawJsonContent] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleRowClick = (trade: Trade) => {
    setSelectedTrade(trade)
    setModalOpen(true)
  }

  const handleViewRawJson = (e: React.MouseEvent, trade: Trade) => {
    e.stopPropagation()
    setJsonModalTitle(`Trade JSON (${trade.symbol} ${trade.side.toUpperCase()}) - #${trade.id.slice(0, 8)}`)
    setRawJsonContent(buildComprehensiveTradeJson(trade, trade.executionFlow))
    setJsonModalOpen(true)
    setCopied(false)
  }

  const handleViewAllJson = () => {
    setJsonModalTitle(`All Executed Trades (${filteredAndSorted.length} Trades)`)
    setRawJsonContent({
      report_type: 'EXECUTED_TRADE_LOGS_FULL_TELEMETRY',
      total_trades: filteredAndSorted.length,
      generated_at: new Date().toISOString(),
      trades: filteredAndSorted.map((t) => buildComprehensiveTradeJson(t, t.executionFlow)),
    })
    setJsonModalOpen(true)
    setCopied(false)
  }

  const handleCopyJson = () => {
    if (!rawJsonContent) return
    navigator.clipboard.writeText(JSON.stringify(rawJsonContent, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJson = () => {
    if (!rawJsonContent) return
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawJsonContent, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `trade_logs_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
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

          {/* Search, Filter & JSON Export Bar */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewAllJson}
              className="h-8 px-2.5 text-xs font-mono gap-1.5 shrink-0 border-brand/30 hover:border-brand text-brand hover:bg-brand/10"
              title="View all trades in raw JSON format"
            >
              <FileJson className="size-3.5" />
              <span>Raw JSON</span>
            </Button>
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
                  <TH className="w-24 text-right">Actions</TH>
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleViewRawJson(e, trade)}
                          className="h-7 px-2 rounded-md bg-secondary border border-border/80 flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-brand hover:border-brand/50 hover:bg-brand/10 transition-colors"
                          title="View raw JSON payload for this trade"
                        >
                          <Code2 className="size-3" />
                          <span>JSON</span>
                        </button>
                        <div className="size-7 rounded-md bg-secondary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                          <Eye className="size-3.5" />
                        </div>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Visual DAG Stepper Modal */}
      <TradeFlowModal
        trade={selectedTrade}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      {/* Dedicated Raw JSON Viewer Modal */}
      <Dialog open={jsonModalOpen} onOpenChange={setJsonModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 border-b border-border/60 pb-4 shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground font-mono">
                <FileJson className="size-4 text-brand" />
                <span>{jsonModalTitle}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Raw JSON payload with full node-level upstream telemetry, feature vectors, risk decisions, and execution metrics.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyJson}
                className="h-8 gap-1.5 text-xs font-mono border-border hover:border-brand"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-profit" />
                    <span className="text-profit">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-muted-foreground" />
                    <span>Copy JSON</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadJson}
                className="h-8 gap-1.5 text-xs font-mono border-border hover:border-brand"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span>Download</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="p-4 flex-1 overflow-y-auto bg-black/95 font-mono text-xs text-emerald-400 no-scrollbar">
            <pre className="leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(rawJsonContent, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
