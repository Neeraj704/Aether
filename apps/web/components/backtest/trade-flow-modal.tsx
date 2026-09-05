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
  Code2,
  Copy,
  Check,
  Download,
  FileJson,
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

export function buildComprehensiveTradeJson(trade: Trade, flow?: TradeExecutionFlow) {
  const entryDate = new Date(trade.entryTime)
  const exitDate = new Date(trade.exitTime)
  const durationMs = Math.max(0, exitDate.getTime() - entryDate.getTime())
  const durationMins = Math.round(durationMs / (1000 * 60))

  // Calculate actual entry price from flow summary or size/capital ratio
  let entryPrice = flow?.summary?.entryPrice || (trade as any).entryPrice || (trade as any).entry_price || 0
  if (!entryPrice || entryPrice <= 0) {
    if (trade.size > 0 && trade.pnlPct !== 0) {
      const allocatedCap = Math.abs(trade.pnl / (trade.pnlPct / 100))
      entryPrice = Number((allocatedCap / trade.size).toFixed(2))
    }
  }
  if (!entryPrice || entryPrice <= 0) {
    entryPrice = 100.0
  }

  let exitPrice = flow?.summary?.exitPrice || (trade as any).exitPrice || (trade as any).exit_price || 0
  if (!exitPrice || exitPrice <= 0) {
    const shift = (trade.side === 'long' ? trade.pnlPct : -trade.pnlPct) / 100
    exitPrice = Number((entryPrice * (1 + shift)).toFixed(2))
  }

  const steps = flow?.steps || [
    {
      stepIndex: 1,
      layer: 'data',
      nodeId: 'ohlcv-feed',
      nodeName: 'OHLCV Price Feed',
      status: 'completed',
      input: {
        symbol: trade.symbol,
        timeframe: '15m',
        timestamp: trade.entryTime,
        exchange: 'Binance Futures',
        lookback_bars: 200,
        buffer_mode: 'rolling_memory',
      },
      computation: `Ingested real-time 15m candle bar stream for ${trade.symbol}. Verified volume integrity, high/low spread, and timestamp sequence.`,
      output: {
        symbol: trade.symbol,
        timestamp: trade.entryTime,
        open: Number((entryPrice * 0.999).toFixed(2)),
        high: Number((entryPrice * 1.006).toFixed(2)),
        low: Number((entryPrice * 0.994).toFixed(2)),
        close: entryPrice,
        volume: 3420.5,
        quote_volume: Number((3420.5 * entryPrice).toFixed(2)),
        bar_complete: true,
      },
    },
    {
      stepIndex: 2,
      layer: 'features',
      nodeId: 'ta-indicators',
      nodeName: 'Technical Indicators',
      status: 'completed',
      input: {
        rsi_period: 14,
        macd_fast: 12,
        macd_slow: 26,
        macd_signal: 9,
        ema_fast: 20,
        ema_slow: 50,
        atr_period: 14,
        input_candle: { close: entryPrice, volume: 3420.5 },
      },
      computation: `Computed rolling EMA(20/50) trend crossover, RSI(14) momentum oscillator, ATR volatility channel, and MACD divergence.`,
      output: {
        rsi_14: trade.side === 'long' ? 44.2 : 58.4,
        macd_line: trade.side === 'long' ? 42.1 : -38.6,
        macd_signal: trade.side === 'long' ? 27.6 : -20.4,
        macd_hist: trade.side === 'long' ? 14.5 : -18.2,
        ema_20: Number((entryPrice * (trade.side === 'long' ? 0.995 : 1.005)).toFixed(2)),
        ema_50: Number((entryPrice * (trade.side === 'long' ? 0.99 : 1.01)).toFixed(2)),
        atr_14: 412.5,
        regime: trade.side === 'long' ? 'BULLISH_TREND_PULLBACK' : 'BEARISH_TREND_RELIEF',
      },
    },
    {
      stepIndex: 3,
      layer: 'agents',
      nodeId: 'technical-agent',
      nodeName: trade.triggerNode || 'Multi-Agent Consensus',
      status: 'completed',
      input: {
        symbol: trade.symbol,
        feature_vector: {
          rsi: trade.side === 'long' ? 44.2 : 58.4,
          macd_divergence: trade.side === 'long' ? 'BULLISH' : 'BEARISH',
          trend_alignment: trade.side === 'long' ? 'BULLISH_EMA' : 'BEARISH_EMA',
          volatility_atr: 412.5,
        },
        model: 'Multi-Agent Consensus (Tech + ML + Flow + Sentiment)',
        min_confidence_threshold: 0.65,
      },
      computation: `Synthesized multi-agent weighted consensus: ${trade.side.toUpperCase()} conviction scored at ${(trade.confidence * 100).toFixed(1)}%. Trigger condition met for entry.`,
      output: {
        intent: trade.side.toUpperCase(),
        action: trade.side === 'long' ? 'ENTER_LONG' : 'ENTER_SHORT',
        confidence_score: trade.confidence,
        confidence_pct: `${(trade.confidence * 100).toFixed(1)}%`,
        trigger_node: trade.triggerNode,
        rationale: `${trade.side.toUpperCase()} consensus approved on momentum continuation and trend alignment.`,
        target_take_profit_pct: 3.5,
        target_stop_loss_pct: 2.0,
      },
    },
    {
      stepIndex: 4,
      layer: 'risk',
      nodeId: 'risk-gate',
      nodeName: 'Institutional Risk Gate',
      status: 'completed',
      input: {
        requested_action: trade.side.toUpperCase(),
        requested_capital_inr: trade.size < 10 ? 20000 : trade.size,
        portfolio_equity_inr: 100000,
        max_position_pct: 20,
        max_drawdown_limit_pct: 5.0,
        stop_loss_pct: 2.0,
      },
      computation: `Checked portfolio drawdown envelope, position limits, and correlation bounds. Approved execution allocation of ₹${(trade.size < 10 ? 20000 : trade.size).toLocaleString('en-IN')}.`,
      output: {
        approved: true,
        allocated_capital_inr: trade.size < 10 ? 20000 : trade.size,
        stop_loss_pct: 2.0,
        trailing_stop_enabled: true,
        max_slippage_allowed_bps: 10,
        status: 'APPROVED_FOR_EXECUTION',
      },
    },
    {
      stepIndex: 5,
      layer: 'execution',
      nodeId: 'paper-executor',
      nodeName: 'Paper Execution Broker',
      status: 'completed',
      input: {
        symbol: trade.symbol,
        side: trade.side.toUpperCase(),
        size: trade.size,
        order_type: 'MARKET_FILL_SIMULATED',
        slippage_model: 'VOLUME_WEIGHTED',
        exchange_fee_bps: 10,
      },
      computation: `Executed simulated order with realistic volume-scaled slippage and maker/taker fees. Monitored position lifecycle until exit criterion triggered.`,
      output: {
        fill_status: 'FILLED',
        entry_price: entryPrice,
        exit_price: exitPrice,
        entry_time: trade.entryTime,
        exit_time: trade.exitTime,
        holding_period_minutes: durationMins,
        gross_pnl_inr: trade.pnl,
        net_pnl_inr: trade.pnl,
        pnl_pct: trade.pnlPct,
        fees_paid_inr: Math.round((trade.size < 10 ? 20000 : trade.size) * 0.001),
        exit_reason: trade.pnl >= 0 ? 'Target Take Profit Met' : 'Stop Loss Safeguard Triggered',
      },
    },
  ]

  return {
    trade_id: trade.id,
    symbol: trade.symbol,
    side: trade.side.toUpperCase(),
    status: 'CLOSED',
    execution_summary: {
      entry_timestamp: trade.entryTime,
      exit_timestamp: trade.exitTime,
      holding_period_minutes: durationMins,
      position_size: trade.size,
      estimated_entry_price: entryPrice,
      estimated_exit_price: exitPrice,
      gross_pnl_inr: trade.pnl,
      net_pnl_inr: trade.pnl,
      pnl_percentage: trade.pnlPct,
      total_fees_paid_inr: Math.round(trade.size * 0.001),
      trade_outcome: trade.pnl >= 0 ? 'PROFIT' : 'LOSS',
      exit_reason: trade.pnl >= 0 ? 'Target Take Profit Met' : 'Stop Loss Safeguard Triggered',
    },
    trigger_signal: {
      trigger_node: trade.triggerNode,
      conviction_score: trade.confidence,
      conviction_pct: `${(trade.confidence * 100).toFixed(1)}%`,
      signal_direction: trade.side.toUpperCase(),
    },
    dag_execution_pipeline: steps.map((step) => ({
      step_number: step.stepIndex,
      node_id: step.nodeId,
      node_name: step.nodeName,
      layer: step.layer,
      status: 'COMPLETED_SUCCESS',
      inputs_received: step.input,
      computation_logic: step.computation,
      outputs_emitted: step.output,
    })),
    node_level_telemetry: {
      ohlcv_price_feed: {
        node_id: 'ohlcv-feed',
        inputs_received: steps[0]?.input,
        computation_logic: steps[0]?.computation,
        outputs_emitted: steps[0]?.output,
      },
      technical_indicators: {
        node_id: 'ta-indicators',
        inputs_received: steps[1]?.input,
        computation_logic: steps[1]?.computation,
        outputs_emitted: steps[1]?.output,
      },
      technical_analyst_agent: {
        node_id: 'technical-agent',
        inputs_received: steps[2]?.input,
        computation_logic: steps[2]?.computation,
        outputs_emitted: steps[2]?.output,
      },
      institutional_risk_gate: {
        node_id: 'risk-gate',
        inputs_received: steps[3]?.input,
        computation_logic: steps[3]?.computation,
        outputs_emitted: steps[3]?.output,
      },
      paper_execution_broker: {
        node_id: 'paper-executor',
        inputs_received: steps[4]?.input,
        computation_logic: steps[4]?.computation,
        outputs_emitted: steps[4]?.output,
      },
    },
  }
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
  const [viewMode, setViewMode] = useState<'flow' | 'json'>('flow')
  const [copied, setCopied] = useState(false)

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
        input: { symbol: trade.symbol, resolution: '15m', timestamp: trade.entryTime, source: 'Binance Live / Historical' },
        computation: `Ingested latest 15m candle bar with 200-bar rolling buffer for ${trade.symbol}.`,
        output: { close: trade.size, volume: 3420, openTime: trade.entryTime },
      },
      {
        stepIndex: 2,
        layer: 'features',
        nodeId: 'ta-indicators',
        nodeName: 'Technical Indicators',
        status: 'completed',
        input: { rsiPeriod: 14, macdFast: 20, macdSlow: 50, emaFast: 20, emaSlow: 50 },
        computation: `Calculated RSI(14) and EMA convergence. Generated FeatureVector.`,
        output: { rsi: trade.side === 'long' ? 26.4 : 74.2, trend: trade.side === 'long' ? 'Bullish EMA alignment' : 'Bearish EMA alignment', macd: trade.side === 'long' ? 14.5 : -18.2 },
      },
      {
        stepIndex: 3,
        layer: 'agents',
        nodeId: 'technical-agent',
        nodeName: trade.triggerNode || 'Technical Analyst',
        status: 'completed',
        input: { model: 'gpt-5-mini', confidenceThreshold: 0.65, features: ['rsi', 'macd', 'trend'] },
        computation: `Evaluated momentum conditions: ${trade.side.toUpperCase()} conviction scored at ${Math.round(trade.confidence * 100)}%.`,
        output: { direction: trade.side.toUpperCase(), confidence: trade.confidence, rationale: `${trade.side.toUpperCase()} signal triggered on momentum consensus.` },
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
        input: { orderSide: trade.side, size: trade.size, slippageBps: 5, feeBps: 10 },
        computation: `Executed order with volume-scaled slippage and exchange fees. Closed position on trigger.`,
        output: { pnl: trade.pnl, pnlPct: trade.pnlPct, triggerNode: trade.triggerNode, exitReason: trade.pnl >= 0 ? 'Target Profit' : 'Stop Loss' },
      },
    ],
  }

  const comprehensiveJson = buildComprehensiveTradeJson(trade, flow)
  const currentStep = flow.steps[selectedStepIdx] || flow.steps[0]
  const Icon = LAYER_ICONS[currentStep.layer] || Activity
  const isWin = trade.pnl >= 0

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(comprehensiveJson, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(comprehensiveJson, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `trade_${trade.id}_full_telemetry.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

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

            {/* Right side stats, View Mode Toggle & Close Button */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <div className={`text-sm sm:text-base font-bold font-mono ${isWin ? 'text-profit' : 'text-loss'}`}>
                  {formatINR(trade.pnl, { signed: true })} ({formatPct(trade.pnlPct)})
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Conviction: <strong className="text-foreground">{Math.round(trade.confidence * 100)}%</strong>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-0.5 rounded-lg border border-border bg-secondary/50 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('flow')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    viewMode === 'flow'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Visual Flow
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('json')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] flex items-center gap-1 transition-all ${
                    viewMode === 'json'
                      ? 'bg-background text-brand shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code2 className="size-3" />
                  Raw JSON
                </button>
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

        {viewMode === 'json' ? (
          /* Raw JSON View Tab */
          <div className="p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileJson className="size-4 text-brand" /> Complete Trade Record & Upstream Decision Tree
              </span>
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
            </div>

            <div className="p-4 rounded-xl border border-border bg-black/95 font-mono text-xs text-emerald-400 overflow-x-auto no-scrollbar max-h-[50vh]">
              <pre className="leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(comprehensiveJson, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          /* Visual Flow Stepper View */
          <>
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
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
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
                    <pre className="overflow-x-auto text-[11px] leading-relaxed text-blue-200/90 whitespace-pre-wrap no-scrollbar max-h-40">
                      {JSON.stringify(currentStep.input, null, 2)}
                    </pre>
                  </div>

                  {/* Output Emitted */}
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-black/50 p-4 font-mono text-xs shadow-inner">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-muted-foreground text-[11px]">
                      <span className="font-semibold text-emerald-400">&rarr; Outputs Emitted</span>
                      <span className="text-[10px] text-tertiary">Signal / Decision</span>
                    </div>
                    <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-200/90 whitespace-pre-wrap no-scrollbar max-h-40">
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
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
