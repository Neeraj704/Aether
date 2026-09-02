'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatINR, formatPct, formatDate } from '@/lib/utils'
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  Terminal,
  TrendingUp,
} from 'lucide-react'
import { toast } from '@/lib/store'

export interface TradeInspectionData {
  isOpenPosition: boolean
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  stopPrice?: number | null
  confidence?: number
  entryTime: string
  exitTime?: string | null
  exitPrice?: number | null
  pnl?: number | null
  pnlPct?: number | null
  triggerNode?: string
  entryCandle?: {
    open: number
    high: number
    low: number
    close: number
    volume: number
    open_time?: string
  }
  entryFeatures?: {
    rsi?: number
    macd?: number
    ema_fast?: number
    ema_slow?: number
    macd_signal?: number
    close?: number
    regime?: string
    [key: string]: any
  }
  entrySignal?: {
    direction: string
    confidence: number
    rationale?: string
    price?: number
    audit?: {
      applied_rule?: string
      model_config?: any
      system_prompt?: string
      input_features?: any
      confidence_formula?: string
      [key: string]: any
    }
    [key: string]: any
  }
  entryRisk?: {
    approved: boolean
    direction: string
    stopPrice?: number
    sizedQuantity?: number
    reason?: string
    audit?: {
      stop_loss_pct?: number
      max_position_pct?: number
      portfolio_equity?: number
      allocated_capital?: number
      calculated_quantity?: number
      confidence_threshold?: number
      [key: string]: any
    }
    [key: string]: any
  }
  executionFlow?: any
  rawPosition?: any
}

interface TradeFlowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trade: TradeInspectionData | null
}

export function TradeFlowModal({ open, onOpenChange, trade }: TradeFlowModalProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'rationale' | 'raw'>('pipeline')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    signal: true,
    risk: true,
  })
  const [copied, setCopied] = useState(false)

  if (!trade) return null

  const isLong = trade.side === 'long'
  const confidencePct = Math.round((trade.confidence || trade.entrySignal?.confidence || 0.75) * 100)

  const toggleNode = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopyJson = () => {
    const fullAudit = {
      tradeId: trade.isOpenPosition ? 'active-open-position' : (trade.executionFlow?.tradeId || 'closed-trade'),
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      entryPrice: trade.entryPrice,
      stopPrice: trade.stopPrice,
      confidence: trade.confidence,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl,
      pnlPct: trade.pnlPct,
      candleSnapshot: trade.entryCandle,
      features: trade.entryFeatures,
      signal: trade.entrySignal,
      riskDecision: trade.entryRisk,
      raw: trade.rawPosition || trade.executionFlow,
    }
    navigator.clipboard.writeText(JSON.stringify(fullAudit, null, 2))
    setCopied(true)
    toast.success('Copied Audit Trail', 'Full trade execution JSON copied to clipboard.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="border border-white/10 bg-background/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header Bar */}
        <div className="p-6 border-b border-border/60 bg-gradient-to-r from-card/80 to-secondary/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${isLong ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss'}`}>
                {isLong ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {trade.symbol}
                  </h3>
                  <Badge variant={isLong ? 'profit' : 'loss'} size="sm" className="uppercase font-mono text-[10px] tracking-wider font-semibold">
                    {trade.side}
                  </Badge>
                  {trade.isOpenPosition ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Position
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-tertiary border border-border">
                      Closed Trade
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 font-mono">
                  <Clock className="size-3 text-tertiary" />
                  Entry: {formatDate(trade.entryTime, { withTime: true })}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <span className="text-[10px] uppercase text-tertiary block">Fill Price</span>
                <span className="font-semibold text-foreground">{formatINR(trade.entryPrice)}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-tertiary block">Order Size</span>
                <span className="font-semibold text-foreground">{trade.size}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-tertiary block">Stop Loss</span>
                <span className="font-semibold text-loss">
                  {trade.stopPrice ? formatINR(trade.stopPrice) : 'None'}
                </span>
              </div>
              {trade.pnl !== null && trade.pnl !== undefined && (
                <>
                  <div className="h-6 w-px bg-border/60" />
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-tertiary block">Net P&amp;L</span>
                    <span className={`font-bold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatINR(trade.pnl)} ({formatPct(trade.pnlPct || 0)})
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 mt-5 border-b border-border/40 pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('pipeline')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pipeline'
                  ? 'border-brand text-brand font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5" />
              Execution Flow ({'5 Nodes'})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rationale')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rationale'
                  ? 'border-brand text-brand font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="size-3.5" />
              Trade Rationale &amp; Audit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'border-brand text-brand font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCode className="size-3.5" />
              Raw JSON Payload
            </button>

            <div className="ml-auto">
              <Button
                variant="outline"
                size="xs"
                onClick={handleCopyJson}
                className="gap-1 text-[11px] h-7 border-border/80"
              >
                {copied ? <Check className="size-3 text-profit" /> : <Copy className="size-3 text-tertiary" />}
                {copied ? 'Copied' : 'Copy Full Flow'}
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <DialogBody className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {/* Core Strategy Explanation Banner */}
              <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                  <Sparkles className="size-4" />
                  <span>Why this trade was triggered</span>
                  <Badge variant="brand" size="sm" className="ml-auto font-mono text-[10px]">
                    {confidencePct}% Conviction
                  </Badge>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-mono">
                  {trade.entrySignal?.rationale ||
                    `Executed ${trade.side.toUpperCase()} order on ${trade.symbol} based on quantitative multi-node strategy consensus.`}
                </p>
                {trade.entryRisk?.reason && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-brand/10">
                    <strong className="text-tertiary">Risk Gate:</strong> {trade.entryRisk.reason}
                  </p>
                )}
              </div>

              {/* Node by Node DAG Flow Stepper */}
              <div className="space-y-3">
                {/* Node 1: Ingest */}
                <div className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-tertiary">
                        1
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Data Ingest &amp; Bar Close</span>
                          <Badge variant="neutral" size="sm" className="text-[9px]">ohlcv-feed</Badge>
                        </div>
                        <span className="text-[10px] text-tertiary font-mono">
                          Candle timestamp: {trade.entryCandle?.open_time ? formatDate(trade.entryCandle.open_time, { withTime: true }) : formatDate(trade.entryTime, { withTime: true })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNode('candle')}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {expandedNodes['candle'] ? 'Hide I/O' : 'Inspect I/O'}
                      {expandedNodes['candle'] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  {trade.entryCandle ? (
                    <div className="grid grid-cols-5 gap-2 p-2.5 rounded-lg bg-secondary/30 font-mono text-xs text-center border border-border/40">
                      <div>
                        <span className="text-[9px] uppercase text-tertiary block">Open</span>
                        <span className="font-semibold text-foreground">${trade.entryCandle.open?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-tertiary block">High</span>
                        <span className="font-semibold text-profit">${trade.entryCandle.high?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-tertiary block">Low</span>
                        <span className="font-semibold text-loss">${trade.entryCandle.low?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-tertiary block">Close</span>
                        <span className="font-bold text-foreground">${trade.entryCandle.close?.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-tertiary block">Volume</span>
                        <span className="font-semibold text-tertiary">{trade.entryCandle.volume?.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">Candle data ingested at execution tick.</p>
                  )}

                  {expandedNodes['candle'] && (
                    <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(trade.entryCandle || { symbol: trade.symbol, price: trade.entryPrice }, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Node 2: Technical Indicators */}
                <div className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-tertiary">
                        2
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Indicator Feature Vector</span>
                          <Badge variant="brand" size="sm" className="text-[9px]">ta-indicators</Badge>
                        </div>
                        <span className="text-[10px] text-tertiary font-mono">
                          Regime: {trade.entryFeatures?.regime || 'Trend/Momentum'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNode('features')}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {expandedNodes['features'] ? 'Hide I/O' : 'Inspect I/O'}
                      {expandedNodes['features'] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  {trade.entryFeatures ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                        <span className="text-tertiary text-[10px]">RSI(14): </span>
                        <strong className="text-foreground">{trade.entryFeatures.rsi?.toFixed(1) ?? '—'}</strong>
                      </div>
                      <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                        <span className="text-tertiary text-[10px]">Fast EMA: </span>
                        <strong className="text-foreground">${trade.entryFeatures.ema_fast?.toLocaleString() ?? '—'}</strong>
                      </div>
                      <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                        <span className="text-tertiary text-[10px]">Slow EMA: </span>
                        <strong className="text-foreground">${trade.entryFeatures.ema_slow?.toLocaleString() ?? '—'}</strong>
                      </div>
                      <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                        <span className="text-tertiary text-[10px]">MACD: </span>
                        <strong className="text-foreground">{trade.entryFeatures.macd?.toFixed(2) ?? '—'}</strong>
                      </div>
                      <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                        <span className="text-tertiary text-[10px]">MACD Signal: </span>
                        <strong className="text-foreground">{trade.entryFeatures.macd_signal?.toFixed(2) ?? '—'}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">Calculated momentum indicators for bar.</p>
                  )}

                  {expandedNodes['features'] && (
                    <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(trade.entryFeatures || {}, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Node 3: Signal Agent */}
                <div className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Technical Analyst Signal Agent</span>
                          <Badge variant="brand" size="sm" className="text-[9px]">technical-agent</Badge>
                        </div>
                        <span className="text-[10px] text-tertiary font-mono">
                          Decision: {trade.side.toUpperCase()} ({confidencePct}% Conviction)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNode('signal')}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {expandedNodes['signal'] ? 'Hide I/O' : 'Inspect I/O'}
                      {expandedNodes['signal'] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-tertiary text-[11px]">Direction:</span>
                      <strong className={isLong ? 'text-profit' : 'text-loss'}>{trade.side.toUpperCase()}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-tertiary text-[11px]">Confidence Score:</span>
                      <strong className="text-brand">{confidencePct}%</strong>
                    </div>
                    <div className="pt-1.5 border-t border-border/30">
                      <span className="text-tertiary text-[11px] block mb-0.5">Analyst Rationale:</span>
                      <p className="text-foreground leading-relaxed">
                        {trade.entrySignal?.rationale || 'Quantitative edge detected on indicator conditions.'}
                      </p>
                    </div>
                  </div>

                  {expandedNodes['signal'] && (
                    <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(trade.entrySignal || {}, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Node 4: Risk Gate */}
                <div className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                        4
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Risk Manager &amp; Sizing Gate</span>
                          <Badge variant="neutral" size="sm" className="text-[9px]">risk-gate</Badge>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Risk Assessment: APPROVED
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNode('risk')}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {expandedNodes['risk'] ? 'Hide I/O' : 'Inspect I/O'}
                      {expandedNodes['risk'] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-secondary/30 font-mono text-xs border border-border/40">
                    <div>
                      <span className="text-[9px] uppercase text-tertiary block">Allocated Sizing</span>
                      <span className="font-semibold text-foreground">
                        {trade.entryRisk?.audit?.max_position_pct ?? 20}% equity ({formatINR(trade.entryRisk?.audit?.allocated_capital ?? 20000)})
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-tertiary block">Stop Loss Price</span>
                      <span className="font-semibold text-loss">
                        {trade.stopPrice ? formatINR(trade.stopPrice) : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-tertiary block">Min Threshold</span>
                      <span className="font-semibold text-foreground">
                        {trade.entryRisk?.audit?.confidence_threshold ?? 65}% Conviction
                      </span>
                    </div>
                  </div>

                  {expandedNodes['risk'] && (
                    <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify(trade.entryRisk || {}, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Node 5: Paper Execution */}
                <div className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                        5
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">Paper Trading Execution</span>
                          <Badge variant="brand" size="sm" className="text-[9px]">paper-executor</Badge>
                        </div>
                        <span className="text-[10px] text-tertiary font-mono">
                          Simulated Fill: {trade.size} units @ {formatINR(trade.entryPrice)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNode('exec')}
                      className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {expandedNodes['exec'] ? 'Hide I/O' : 'Inspect I/O'}
                      {expandedNodes['exec'] ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 text-xs font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-tertiary text-[11px]">Filled Order:</span>
                      <strong className="text-foreground">{trade.side.toUpperCase()} {trade.size} {trade.symbol}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-tertiary text-[11px]">Execution Time (IST):</span>
                      <span className="text-muted-foreground">{formatDate(trade.entryTime, { withTime: true })}</span>
                    </div>
                    {trade.exitTime && (
                      <div className="flex items-center justify-between pt-1 border-t border-border/30">
                        <span className="text-tertiary text-[11px]">Closed Time (IST):</span>
                        <span className="text-muted-foreground">{formatDate(trade.exitTime, { withTime: true })}</span>
                      </div>
                    )}
                  </div>

                  {expandedNodes['exec'] && (
                    <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <pre>{JSON.stringify({
                        entryPrice: trade.entryPrice,
                        size: trade.size,
                        stopPrice: trade.stopPrice,
                        entryTime: trade.entryTime,
                        exitTime: trade.exitTime,
                        pnl: trade.pnl,
                        pnlPct: trade.pnlPct,
                      }, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rationale' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Terminal className="size-4 text-brand" />
                  Strategy Rule &amp; Analyst Prompt Context
                </h4>
                
                {trade.entrySignal?.audit?.applied_rule && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Applied Rule:</span>
                    <strong className="text-brand text-sm">{trade.entrySignal.audit.applied_rule}</strong>
                  </div>
                )}

                {trade.entrySignal?.audit?.system_prompt && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">System Prompt:</span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {trade.entrySignal.audit.system_prompt}
                    </p>
                  </div>
                )}

                {trade.entrySignal?.audit?.model_config && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Model Parameters:</span>
                    <pre className="text-[11px] text-emerald-400">
                      {JSON.stringify(trade.entrySignal.audit.model_config, null, 2)}
                    </pre>
                  </div>
                )}

                {trade.entrySignal?.audit?.confidence_formula && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Confidence Formula:</span>
                    <code className="text-amber-400">{trade.entrySignal.audit.confidence_formula}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>Complete Trade Audit Payload</span>
                <span>JSON Schema 1.0</span>
              </div>
              <div className="p-4 rounded-xl bg-black/95 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[450px]">
                <pre>{JSON.stringify(trade, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogBody>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-secondary/20 flex items-center justify-between">
          <span className="text-xs text-tertiary font-mono">
            Audit ID: {trade.isOpenPosition ? 'active-open-position' : (trade.executionFlow?.tradeId || 'trade-audit')}
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close Inspector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
