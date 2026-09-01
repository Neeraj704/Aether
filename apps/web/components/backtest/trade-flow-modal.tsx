'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  CheckCircle2,
  TrendingUp,
  Brain,
  Scale,
  Gauge,
  LineChart,
  GraduationCap,
  HardDrive,
  RefreshCw,
} from 'lucide-react'
import type { Trade, TradeExecutionFlow } from '@/mock/data'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatINR, formatPct } from '@/lib/utils'

const LAYER_ICONS: Record<string, any> = {
  data: Database,
  features: Activity,
  agents: Cpu,
  ml: Brain,
  rl: RefreshCw,
  debate: Scale,
  confidence: Gauge,
  risk: ShieldCheck,
  execution: Zap,
  monitoring: LineChart,
  learning: GraduationCap,
  memory: HardDrive,
}

const LAYER_COLORS: Record<string, string> = {
  data: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  features: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  agents: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ml: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rl: 'text-green-400 bg-green-500/10 border-green-500/20',
  debate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confidence: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  risk: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  execution: 'text-red-400 bg-red-500/10 border-red-500/20',
  monitoring: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  learning: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  memory: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
}

export function TradeFlowModal({
  trade,
  open,
  onOpenChange,
}: {
  trade: Trade | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0)

  if (!trade) return null

  const flow: TradeExecutionFlow = trade.executionFlow || {
    tradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    summary: {
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      entryPrice: trade.size > 0 ? Math.round(trade.pnl / (trade.pnlPct / 100)) : 100,
      exitPrice: trade.size > 0 ? Math.round((trade.pnl / (trade.pnlPct / 100)) * (1 + trade.pnlPct / 100)) : 100,
      size: trade.size,
      grossPnl: trade.pnl,
      netPnl: trade.pnl,
      pnlPct: trade.pnlPct,
      exitReason: trade.pnl >= 0 ? 'Target Profit Condition' : 'Stop Loss Trigger Hit',
      feesPaid: Math.round(trade.size * 0.001),
      confidence: trade.confidence,
    },
    steps: [
      {
        stepIndex: 1,
        layer: 'data',
        nodeId: 'ohlcv-feed',
        nodeName: 'OHLCV Price Feed',
        status: 'completed',
        input: { symbol: trade.symbol, resolution: '15m', timestamp: trade.entryTime },
        computation: `Ingested latest 15m candle bar with 200-bar rolling buffer for ${trade.symbol}.`,
        output: { close: trade.size, volume: 3420 },
      },
      {
        stepIndex: 2,
        layer: 'features',
        nodeId: 'ta-indicators',
        nodeName: 'Technical Indicators',
        status: 'completed',
        input: { rsiPeriod: 14, macdFast: 20, macdSlow: 50 },
        computation: `Calculated RSI(14) and EMA convergence. Generated FeatureVector.`,
        output: { rsi: trade.side === 'long' ? 26.4 : 74.2, trend: trade.side === 'long' ? 'Bullish EMA alignment' : 'Bearish EMA alignment' },
      },
      {
        stepIndex: 3,
        layer: 'agents',
        nodeId: 'technical-agent',
        nodeName: 'Technical Analyst',
        status: 'completed',
        input: { model: 'gpt-5-mini', confidenceThreshold: 0.65 },
        computation: `Evaluated momentum conditions: ${trade.side.toUpperCase()} conviction scored at ${Math.round(trade.confidence * 100)}%.`,
        output: { direction: trade.side, confidence: trade.confidence, rationale: `${trade.side.toUpperCase()} signal triggered on momentum consensus.` },
      },
      {
        stepIndex: 4,
        layer: 'risk',
        nodeId: 'risk-gate',
        nodeName: 'Risk Gate',
        status: 'completed',
        input: { capital: 100000, maxPosPct: 20, stopLossPct: 2.5 },
        computation: `Approved trade sizing: Allocated ₹${trade.size.toLocaleString('en-IN')} with 2.5% stop guard.`,
        output: { approved: true, sizedQty: trade.size, stopPrice: 'Dynamic 2.5% band' },
      },
      {
        stepIndex: 5,
        layer: 'execution',
        nodeId: 'paper-executor',
        nodeName: 'Paper Executor',
        status: 'completed',
        input: { orderSide: trade.side, size: trade.size },
        computation: `Executed order with volume-scaled slippage and exchange fees. Closed position on trigger.`,
        output: { pnl: trade.pnl, pnlPct: trade.pnlPct, triggerNode: trade.triggerNode },
      },
    ],
  }

  const currentStep = flow.steps[selectedStepIdx] || flow.steps[0]
  const Icon = LAYER_ICONS[currentStep.layer] || Activity
  const isWin = trade.pnl >= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-4xl max-h-[88vh] overflow-y-auto p-0 gap-0 border-border bg-card shadow-2xl rounded-2xl"
      >
        {/* Clean Sticky Header */}
        <div className="p-5 sm:p-6 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Trade Decision Flow & Audit
                </span>
                <Badge
                  variant={trade.side === 'long' ? 'profit' : 'loss'}
                  size="sm"
                  className="uppercase font-mono text-[11px]"
                >
                  {trade.side === 'long' ? (
                    <ArrowUpRight className="size-3.5 mr-1" />
                  ) : (
                    <ArrowDownRight className="size-3.5 mr-1" />
                  )}
                  {trade.side} {trade.symbol}
                </Badge>
                <Badge variant="outline" className="font-mono text-[11px] text-muted-foreground">
                  #{trade.id.slice(0, 10)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Step-by-step DAG execution breakdown showing received inputs, computed formulas, and emitted decisions.
              </p>
            </div>

            {/* Right side stats & Explicit Close Button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <div className={`text-sm sm:text-base font-bold font-mono ${isWin ? 'text-profit' : 'text-loss'}`}>
                  {formatINR(trade.pnl, { signed: true })} ({formatPct(trade.pnlPct)})
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Conviction: <strong className="text-foreground">{Math.round(trade.confidence * 100)}%</strong>
                </div>
              </div>

              {/* Prominent High-Contrast Close Button */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="size-8 rounded-full bg-secondary/80 hover:bg-destructive hover:text-white border border-border flex items-center justify-center text-foreground transition-all cursor-pointer shadow-sm"
                aria-label="Close dialog"
              >
                <span className="text-sm font-bold leading-none">&times;</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-border/50 text-xs">
            <div className="bg-secondary/40 rounded-lg p-2 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Entry Timestamp</span>
              <span className="font-mono font-medium text-foreground text-[11px] truncate">
                {formatDate(trade.entryTime, { withTime: true })}
              </span>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Exit Timestamp</span>
              <span className="font-mono font-medium text-foreground text-[11px] truncate">
                {formatDate(trade.exitTime, { withTime: true })}
              </span>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Position Size</span>
              <span className="font-mono font-medium text-foreground text-[11px]">{formatINR(trade.size)}</span>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase font-medium">Trigger Node</span>
              <span className="font-medium text-foreground text-[11px] truncate">{trade.triggerNode}</span>
            </div>
          </div>
        </div>

        {/* Pipeline Stepper Navigation */}
        <div className="p-5 sm:p-6 pb-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-brand" /> Execution Pipeline Sequence
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {flow.steps.map((step, idx) => {
              const StepIcon = LAYER_ICONS[step.layer] || Activity
              const isSelected = selectedStepIdx === idx
              const colorClass = LAYER_COLORS[step.layer] || 'text-brand bg-brand/10 border-brand/20'

              return (
                <button
                  key={step.stepIndex}
                  onClick={() => setSelectedStepIdx(idx)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'border-brand ring-1 ring-brand bg-brand/5 shadow-sm'
                      : 'border-border bg-card/40 hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className={`size-6 rounded-md flex items-center justify-center border text-xs font-bold ${colorClass}`}>
                      <StepIcon className="size-3.5" />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">Step {step.stepIndex}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground line-clamp-1">
                    {step.nodeName}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {step.layer} layer
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Active Step Deep Inspector */}
        <div className="p-5 sm:p-6 pt-3 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-5 flex flex-col gap-4">
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                <div className={`size-8 rounded-lg flex items-center justify-center border ${LAYER_COLORS[currentStep.layer]}`}>
                  <Icon className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Step {currentStep.stepIndex}: {currentStep.nodeName}
                    <Badge variant="outline" className="text-[10px] uppercase font-mono capitalize">
                      {currentStep.layer} Layer
                    </Badge>
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono">
                    Component Node: {currentStep.nodeId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-profit text-xs font-semibold">
                <CheckCircle2 className="size-4" /> Validated
              </div>
            </div>

            {/* Computation & Rationale */}
            <div className="flex flex-col gap-1.5 bg-background/80 rounded-lg p-3.5 border border-border/50">
              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="size-3 text-brand" /> Decision Logic & Computational Reason
              </span>
              <p className="text-xs text-foreground/90 leading-relaxed font-mono">
                {currentStep.computation}
              </p>
            </div>

            {/* Input vs Output Split Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input Received */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-black/50 p-4 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 text-muted-foreground text-[11px]">
                  <span className="font-semibold text-blue-400">&larr; Inputs Received</span>
                  <span className="text-[10px] text-tertiary">JSON Payload</span>
                </div>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-blue-200/90 whitespace-pre-wrap no-scrollbar">
                  {JSON.stringify(currentStep.input, null, 2)}
                </pre>
              </div>

              {/* Output Emitted */}
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-black/50 p-4 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 text-muted-foreground text-[11px]">
                  <span className="font-semibold text-emerald-400">&rarr; Outputs Emitted</span>
                  <span className="text-[10px] text-tertiary">Signal / Decision</span>
                </div>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-200/90 whitespace-pre-wrap no-scrollbar">
                  {JSON.stringify(currentStep.output, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedStepIdx === 0}
              onClick={() => setSelectedStepIdx((prev) => Math.max(0, prev - 1))}
            >
              &larr; Previous Node
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              Node {selectedStepIdx + 1} of {flow.steps.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedStepIdx === flow.steps.length - 1}
              onClick={() => setSelectedStepIdx((prev) => Math.min(flow.steps.length - 1, prev + 1))}
            >
              Next Node &rarr;
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
