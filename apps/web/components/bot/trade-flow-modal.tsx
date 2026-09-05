'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
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
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  Terminal,
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
    open?: number
    high?: number
    low?: number
    close?: number
    volume?: number
    open_time?: string
    [key: string]: any
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
    direction?: string
    confidence?: number
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
    approved?: boolean
    direction?: string
    stopPrice?: number | null
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

const LAYER_BADGE_VARIANTS: Record<string, 'neutral' | 'brand' | 'profit' | 'loss' | 'warn'> = {
  data: 'neutral',
  features: 'brand',
  agents: 'brand',
  ml: 'brand',
  models: 'brand',
  risk: 'profit',
  execution: 'neutral',
}

export function TradeFlowModal({ open, onOpenChange, trade }: TradeFlowModalProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'rationale' | 'raw'>('pipeline')
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'step-0': true,
    'step-1': true,
    'step-2': true,
    'step-3': true,
    'step-4': true,
    candle: true,
    features: true,
    signal: true,
    risk: true,
    exec: true,
  })
  const [copied, setCopied] = useState(false)

  if (!trade) return null

  const ef = trade.executionFlow || {}
  const rawSteps: any[] = Array.isArray(ef.steps) ? ef.steps : Array.isArray(ef.flow) ? ef.flow : []

  // Extract candle/features/signal/risk from executionFlow steps if missing directly on trade
  const candleStep = rawSteps.find((s) => s.nodeId === 'ohlcv-feed' || s.layer === 'data' || s.type === 'candle')
  const featuresStep = rawSteps.find((s) => s.nodeId === 'ta-indicators' || s.layer === 'features' || s.type === 'features')
  const signalStep = rawSteps.find((s) => s.layer === 'agents' || s.layer === 'models' || s.layer === 'ml' || s.layer === 'signal' || s.nodeId?.includes('agent') || s.nodeId?.includes('forecast') || s.type === 'signal')
  const riskStep = rawSteps.find((s) => s.nodeId === 'risk-gate' || s.layer === 'risk' || s.type === 'risk')
  const execStep = rawSteps.find((s) => s.nodeId === 'paper-executor' || s.layer === 'execution' || s.type === 'fill')

  const candleData = trade.entryCandle || candleStep?.output || ef.summary?.entryCandle
  const featuresData = trade.entryFeatures || featuresStep?.output || ef.summary?.entryFeatures
  const signalData = trade.entrySignal || signalStep?.output || ef.summary?.entrySignal
  const riskData = trade.entryRisk || riskStep?.output || ef.summary?.entryRisk

  const isLong = trade.side === 'long'
  const fillPrice = trade.entryPrice || ef.summary?.entryPrice || execStep?.output?.entryPrice || candleData?.close || 0
  const stopLoss = trade.stopPrice ?? ef.summary?.stopPrice ?? riskData?.stopPrice ?? riskStep?.output?.stopPrice ?? null
  const orderSize = trade.size || ef.summary?.size || execStep?.output?.size || riskData?.sizedQuantity || 0
  const confidence = trade.confidence || ef.summary?.confidence || signalData?.confidence || 0.75
  const confidencePct = Math.round(confidence * 100)

  const toggleNode = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCopyJson = () => {
    const fullAudit = {
      tradeId: trade.isOpenPosition ? 'active-open-position' : (ef.tradeId || 'closed-trade'),
      symbol: trade.symbol,
      side: trade.side,
      size: orderSize,
      entryPrice: fillPrice,
      stopPrice: stopLoss,
      confidence: confidence,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      exitPrice: trade.exitPrice || ef.summary?.exitPrice,
      pnl: trade.pnl ?? ef.summary?.netPnl,
      pnlPct: trade.pnlPct ?? ef.summary?.pnlPct,
      candleSnapshot: candleData,
      features: featuresData,
      signal: signalData,
      riskDecision: riskData,
      executionFlow: ef,
      rawPosition: trade.rawPosition,
    }
    navigator.clipboard.writeText(JSON.stringify(fullAudit, null, 2))
    setCopied(true)
    toast.success('Copied Audit Trail', 'Full trade execution JSON copied to clipboard.')
    setTimeout(() => setCopied(false), 2000)
  }

  const nodeCount = rawSteps.length > 0 ? rawSteps.length : 5

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
                <span className="font-semibold text-foreground">{formatINR(fillPrice)}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-tertiary block">Order Size</span>
                <span className="font-semibold text-foreground">{orderSize}</span>
              </div>
              <div className="h-6 w-px bg-border/60" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-tertiary block">Stop Loss</span>
                <span className="font-semibold text-loss">
                  {stopLoss ? formatINR(stopLoss) : 'None'}
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
              Execution Flow ({nodeCount} Nodes)
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
                className="gap-1 text-[11px] h-7 border-border/80 cursor-pointer"
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
                  {signalData?.rationale ||
                    `Executed ${trade.side.toUpperCase()} order on ${trade.symbol} based on quantitative multi-node strategy consensus.`}
                </p>
                {(riskData?.reason || ef.summary?.exitReason) && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-brand/10">
                    <strong className="text-tertiary">Risk / Execution Gate:</strong>{' '}
                    {riskData?.reason || ef.summary?.exitReason}
                  </p>
                )}
              </div>

              {/* Node by Node DAG Flow Stepper */}
              <div className="space-y-3">
                {rawSteps.length > 0 ? (
                  rawSteps.map((step: any, idx: number) => {
                    const stepKey = `step-${idx}`
                    const isExpanded = expandedNodes[stepKey] ?? false
                    const layerVariant = LAYER_BADGE_VARIANTS[step.layer] || 'neutral'

                    return (
                      <div key={stepKey} className="rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-border/80">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-tertiary">
                              {step.stepIndex || idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">
                                  {step.nodeName || step.nodeId}
                                </span>
                                <Badge variant={layerVariant} size="sm" className="text-[9px]">
                                  {step.nodeId}
                                </Badge>
                                {step.layer && (
                                  <span className="text-[9px] uppercase font-mono text-tertiary">
                                    Layer: {step.layer}
                                  </span>
                                )}
                              </div>
                              {step.computation && (
                                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-2">
                                  {step.computation}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleNode(stepKey)}
                            className="text-[10px] text-brand hover:underline flex items-center gap-1 cursor-pointer font-medium shrink-0 ml-2"
                          >
                            {isExpanded ? 'Hide I/O' : 'Inspect I/O'}
                            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                          </button>
                        </div>

                        {/* Structured Output Highlight if Available */}
                        {step.output && typeof step.output === 'object' && Object.keys(step.output).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                            {Object.entries(step.output)
                              .filter(([k, v]) => v !== null && v !== undefined && typeof v !== 'object')
                              .slice(0, 6)
                              .map(([key, val]) => (
                                <div key={key} className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40">
                                  <span className="text-tertiary text-[10px] uppercase">{key}: </span>
                                  <strong className="text-foreground">
                                    {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : String(val)}
                                  </strong>
                                </div>
                              ))}
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-3 space-y-2 pt-2 border-t border-border/40">
                            {step.input && Object.keys(step.input).length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase font-mono text-tertiary block mb-1">
                                  Input Parameters:
                                </span>
                                <div className="p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-cyan-400 overflow-x-auto max-h-[220px]">
                                  <pre>{JSON.stringify(step.input, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                            {step.output && (
                              <div>
                                <span className="text-[10px] uppercase font-mono text-tertiary block mb-1">
                                  Output Payload:
                                </span>
                                <div className="p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[260px]">
                                  <pre>{JSON.stringify(step.output, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <>
                    {/* Fallback Node 1: Ingest */}
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
                              Candle timestamp: {candleData?.open_time ? formatDate(candleData.open_time, { withTime: true }) : formatDate(trade.entryTime, { withTime: true })}
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

                      {candleData ? (
                        <div className="grid grid-cols-5 gap-2 p-2.5 rounded-lg bg-secondary/30 font-mono text-xs text-center border border-border/40">
                          <div>
                            <span className="text-[9px] uppercase text-tertiary block">Open</span>
                            <span className="font-semibold text-foreground">${candleData.open?.toLocaleString() ?? fillPrice}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-tertiary block">High</span>
                            <span className="font-semibold text-profit">${candleData.high?.toLocaleString() ?? fillPrice}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-tertiary block">Low</span>
                            <span className="font-semibold text-loss">${candleData.low?.toLocaleString() ?? fillPrice}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-tertiary block">Close</span>
                            <span className="font-bold text-foreground">${candleData.close?.toLocaleString() ?? fillPrice}</span>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase text-tertiary block">Volume</span>
                            <span className="font-semibold text-tertiary">{candleData.volume?.toFixed ? candleData.volume.toFixed(2) : String(candleData.volume || 100)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono">Candle data ingested at execution tick.</p>
                      )}

                      {expandedNodes['candle'] && (
                        <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                          <pre>{JSON.stringify(candleData || { symbol: trade.symbol, price: fillPrice }, null, 2)}</pre>
                        </div>
                      )}
                    </div>

                    {/* Fallback Node 2: Technical Indicators */}
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
                              Regime: {featuresData?.regime || 'Trend/Momentum'}
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

                      {featuresData ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                            <span className="text-tertiary text-[10px]">RSI(14): </span>
                            <strong className="text-foreground">{featuresData.rsi?.toFixed ? featuresData.rsi.toFixed(1) : String(featuresData.rsi ?? '—')}</strong>
                          </div>
                          <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                            <span className="text-tertiary text-[10px]">Fast EMA: </span>
                            <strong className="text-foreground">${featuresData.ema_fast?.toLocaleString ? featuresData.ema_fast.toLocaleString() : String(featuresData.ema_fast ?? '—')}</strong>
                          </div>
                          <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                            <span className="text-tertiary text-[10px]">Slow EMA: </span>
                            <strong className="text-foreground">${featuresData.ema_slow?.toLocaleString ? featuresData.ema_slow.toLocaleString() : String(featuresData.ema_slow ?? '—')}</strong>
                          </div>
                          <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                            <span className="text-tertiary text-[10px]">MACD: </span>
                            <strong className="text-foreground">{featuresData.macd?.toFixed ? featuresData.macd.toFixed(2) : String(featuresData.macd ?? '—')}</strong>
                          </div>
                          <div className="px-2.5 py-1 rounded-md bg-secondary/50 border border-border/40 font-mono text-xs">
                            <span className="text-tertiary text-[10px]">MACD Signal: </span>
                            <strong className="text-foreground">{featuresData.macd_signal?.toFixed ? featuresData.macd_signal.toFixed(2) : String(featuresData.macd_signal ?? '—')}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono">Calculated momentum indicators for bar.</p>
                      )}

                      {expandedNodes['features'] && (
                        <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                          <pre>{JSON.stringify(featuresData || {}, null, 2)}</pre>
                        </div>
                      )}
                    </div>

                    {/* Fallback Node 3: Signal Agent */}
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
                            {signalData?.rationale || 'Quantitative edge detected on indicator conditions.'}
                          </p>
                        </div>
                      </div>

                      {expandedNodes['signal'] && (
                        <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                          <pre>{JSON.stringify(signalData || { direction: trade.side, confidence, rationale: signalData?.rationale }, null, 2)}</pre>
                        </div>
                      )}
                    </div>

                    {/* Fallback Node 4: Risk Gate */}
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
                            {riskData?.audit?.max_position_pct ?? 20}% equity ({formatINR(riskData?.audit?.allocated_capital ?? 20000)})
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-tertiary block">Stop Loss Price</span>
                          <span className="font-semibold text-loss">
                            {stopLoss ? formatINR(stopLoss) : 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-tertiary block">Min Threshold</span>
                          <span className="font-semibold text-foreground">
                            {riskData?.audit?.confidence_threshold ?? 65}% Conviction
                          </span>
                        </div>
                      </div>

                      {expandedNodes['risk'] && (
                        <div className="mt-3 p-3 rounded-lg bg-black/80 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                          <pre>{JSON.stringify(riskData || { approved: true, sizedQuantity: orderSize, stopPrice: stopLoss }, null, 2)}</pre>
                        </div>
                      )}
                    </div>

                    {/* Fallback Node 5: Paper Execution */}
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
                              Simulated Fill: {orderSize} units @ {formatINR(fillPrice)}
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
                          <strong className="text-foreground">{trade.side.toUpperCase()} {orderSize} {trade.symbol}</strong>
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
                            entryPrice: fillPrice,
                            size: orderSize,
                            stopPrice: stopLoss,
                            entryTime: trade.entryTime,
                            exitTime: trade.exitTime,
                            pnl: trade.pnl,
                            pnlPct: trade.pnlPct,
                          }, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </>
                )}
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

                <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                  <span className="text-tertiary text-[10px] block mb-1">Analyst Rationale:</span>
                  <p className="text-foreground text-xs leading-relaxed font-semibold">
                    {signalData?.rationale || `${trade.side.toUpperCase()} setup triggered with ${confidencePct}% confidence.`}
                  </p>
                </div>

                {(signalData?.audit?.applied_rule || signalStep?.computation) && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Applied Rule:</span>
                    <strong className="text-brand text-sm">{signalData?.audit?.applied_rule || signalStep?.computation}</strong>
                  </div>
                )}

                {signalData?.audit?.system_prompt && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">System Prompt:</span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {signalData.audit.system_prompt}
                    </p>
                  </div>
                )}

                {signalData?.audit?.model_config && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Model Parameters:</span>
                    <pre className="text-[11px] text-emerald-400">
                      {JSON.stringify(signalData.audit.model_config, null, 2)}
                    </pre>
                  </div>
                )}

                {signalData?.audit?.confidence_formula && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Confidence Formula:</span>
                    <code className="text-amber-400">{signalData.audit.confidence_formula}</code>
                  </div>
                )}

                {riskData?.reason && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 font-mono text-xs">
                    <span className="text-tertiary text-[10px] block mb-1">Risk Gate Validation:</span>
                    <p className="text-emerald-400 font-semibold">{riskData.reason}</p>
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
              <div className="p-4 rounded-xl bg-black/95 border border-border/80 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[500px]">
                <pre>{JSON.stringify(ef.steps ? ef : trade, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogBody>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-secondary/20 flex items-center justify-between">
          <span className="text-xs text-tertiary font-mono">
            Audit ID: {trade.isOpenPosition ? 'active-open-position' : (ef.tradeId || 'trade-audit')}
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close Inspector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

