'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GitCompareArrows,
  Plus,
  X,
  Bot as BotIcon,
  Bookmark,
  Activity,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useWorkspace, useHydrated, type StoredPreset } from '@/lib/workspace-store'
import { BACKTEST_RUNS, MARKETPLACE_PRESETS, type Bot, type BacktestRun, type Preset } from '@/mock/data'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { PillButton } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/tabs'
import { cn, formatINR, formatPct } from '@/lib/utils'

interface CompareSlot {
  id: string
  kind: 'bot' | 'preset' | 'run'
  title: string
  subtitle: string
  bot?: Bot
  run?: BacktestRun
  preset?: Preset | StoredPreset
}

const SLOT_COLORS = ['#2997ff', '#00b8c4', '#ff6ac1', '#ff9f0a']

function CompareContent() {
  const searchParams = useSearchParams()
  const hydrated = useHydrated()
  const bots = useWorkspace((s) => s.bots)
  const runs = useWorkspace((s) => s.runs)
  const myPresets = useWorkspace((s) => s.myPresets)

  const [slots, setSlots] = useState<(CompareSlot | null)[]>([null, null, null, null])
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null)
  const [pickerTab, setPickerTab] = useState<'bots' | 'runs' | 'presets'>('bots')

  // Pre-fill run from query param on mount
  useEffect(() => {
    const runId = searchParams.get('run')
    if (runId) {
      const targetRun = runs.find((r) => r.id === runId) || BACKTEST_RUNS.find((r) => r.id === runId)
      if (targetRun) {
        setSlots((prev) => {
          const next = [...prev]
          next[0] = {
            id: targetRun.id,
            kind: 'run',
            title: targetRun.botName,
            subtitle: `Run ${targetRun.id} (${targetRun.config.type})`,
            run: targetRun,
          }
          return next
        })
      }
    }
  }, [searchParams, runs])

  // Helper to find run for a slot
  const getSlotRun = (slot: CompareSlot): BacktestRun | null => {
    if (slot.run) return slot.run
    if (slot.bot) {
      return runs.find((r) => r.botId === slot.bot?.id) || BACKTEST_RUNS.find((r) => r.botId === slot.bot?.id) || null
    }
    if (slot.preset && 'sampleRunId' in slot.preset && slot.preset.sampleRunId) {
      return BACKTEST_RUNS.find((r) => r.id === (slot.preset as Preset).sampleRunId) || null
    }
    return null
  }

  const activeSlots = slots.filter((s): s is CompareSlot => s !== null)

  const handleAddSlot = (item: CompareSlot) => {
    if (activeSlotIdx === null) return
    setSlots((prev) => {
      const next = [...prev]
      next[activeSlotIdx] = item
      return next
    })
    setActiveSlotIdx(null)
  }

  const handleRemoveSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev]
      next[idx] = null
      return next
    })
  }

  // Combined Equity Chart Data
  const chartData = useMemo(() => {
    if (activeSlots.length === 0) return []

    // Build timeline using max points from all runs
    const slotRuns = activeSlots.map(getSlotRun)
    const longestRun = slotRuns.reduce((acc, r) => (r && r.equity.length > (acc?.equity.length || 0) ? r : acc), slotRuns[0])
    if (!longestRun) return []

    return longestRun.equity.map((pt, i) => {
      const row: Record<string, string | number> = { date: pt.date.slice(5) }
      slotRuns.forEach((r, sIdx) => {
        if (r && r.equity[i]) {
          row[`slot_${sIdx}`] = r.equity[i].equity
        }
      })
      return row
    })
  }, [activeSlots])

  // Diff calculations for Bot vs Bot
  const botSlots = activeSlots.filter((s) => s.bot)

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <GitCompareArrows className="size-3.5" /> Strategy Overlay & Differential Analysis
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Strategy Compare Engine
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
          Overlay up to four trading bots, marketplace presets, or historical backtest runs side-by-side to compare equity trajectories and risk attribution.
        </p>
      </div>

      {/* 4 Slots Selector Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {slots.map((slot, idx) => {
          const color = SLOT_COLORS[idx]
          if (slot) {
            return (
              <div
                key={`${slot.id}-${idx}`}
                className="relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      style={{ backgroundColor: color }}
                      className="size-3 rounded-full shrink-0 shadow-xs"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {slot.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {slot.subtitle}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSlot(idx)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-tertiary border-t border-border/60 pt-2">
                  <span className="capitalize font-mono">Slot {idx + 1} ({slot.kind})</span>
                  <button
                    onClick={() => setActiveSlotIdx(idx)}
                    className="text-brand font-semibold hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>
            )
          }

          return (
            <button
              key={`empty-${idx}`}
              onClick={() => setActiveSlotIdx(idx)}
              className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border bg-card/40 hover:border-brand/50 hover:bg-card/80 transition-all gap-2 text-center group cursor-pointer"
            >
              <div
                style={{ borderColor: color }}
                className="size-8 rounded-full border border-dashed flex items-center justify-center text-muted-foreground group-hover:text-brand group-hover:scale-105 transition-all"
              >
                <Plus className="size-4" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                + Add Strategy to Slot {idx + 1}
              </span>
            </button>
          )
        })}
      </div>

      {activeSlots.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center flex flex-col items-center justify-center gap-3">
          <GitCompareArrows className="size-10 text-muted-foreground" />
          <h3 className="text-base font-bold">Select at least two strategies to compare</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Click on any empty slot above to select active bots, community marketplace templates, or completed simulation runs.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Overlaid Equity Curve Chart */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Multi-Series Equity Trajectory Overlay</h2>
                <p className="text-xs text-muted-foreground">Comparative portfolio equity curves indexed from start</p>
              </div>
              <div className="flex items-center gap-3">
                {activeSlots.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs font-medium">
                    <span style={{ backgroundColor: SLOT_COLORS[i] }} className="size-2.5 rounded-full" />
                    <span className="truncate max-w-[120px]">{s.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-[320px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#666"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [typeof val === 'number' ? formatINR(val) : 'N/A', 'Equity']}
                  />
                  {activeSlots.map((s, i) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={`slot_${i}`}
                      name={s.title}
                      stroke={SLOT_COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side-by-Side Metrics Table */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold">Side-by-Side Performance Attribution</h2>
              <p className="text-xs text-muted-foreground">Direct quantitative metric comparison</p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-48 pl-4">Performance Metric</TH>
                    {activeSlots.map((slot, i) => (
                      <TH key={slot.id} className="min-w-40">
                        <div className="flex items-center gap-1.5">
                          <span style={{ backgroundColor: SLOT_COLORS[i] }} className="size-2 rounded-full" />
                          <span className="truncate">{slot.title}</span>
                        </div>
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {/* Total Return */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Total Return</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      const val = run?.metrics.totalReturn ?? 0
                      return (
                        <TD key={slot.id} className={cn('text-xs font-bold', val >= 0 ? 'text-profit' : 'text-loss')}>
                          {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Win Rate */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Win Rate</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-foreground font-medium">
                          {run ? `${run.metrics.winRate}%` : '—'}
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Max Drawdown */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Max Drawdown</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-loss font-semibold">
                          {run ? `${run.metrics.maxDrawdown}%` : '—'}
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Sharpe Ratio */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Sharpe Ratio</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-foreground font-bold">
                          {run ? run.metrics.sharpe.toFixed(2) : '—'}
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Total Trades */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Total Trades</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-foreground">
                          {run ? run.metrics.trades : '—'}
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Profit Factor */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Profit Factor</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-foreground font-medium">
                          {run ? run.metrics.profitFactor.toFixed(2) : '—'}
                        </TD>
                      )
                    })}
                  </TR>

                  {/* Market Exposure */}
                  <TR>
                    <TD className="pl-4 font-semibold text-xs">Market Exposure</TD>
                    {activeSlots.map((slot) => {
                      const run = getSlotRun(slot)
                      return (
                        <TD key={slot.id} className="text-xs text-foreground">
                          {run ? `${run.metrics.exposure}%` : '—'}
                        </TD>
                      )
                    })}
                  </TR>
                </TBody>
              </Table>
            </div>
          </div>

          {/* Node Difference View (for 2 Bot Selections) */}
          {botSlots.length >= 2 && (
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold">Graph Architecture Diff ({botSlots[0].title} vs {botSlots[1].title})</h2>
                <p className="text-xs text-muted-foreground">Node topological differences between selected bots</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Nodes in {botSlots[0].title} ({botSlots[0].bot?.nodes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {botSlots[0].bot?.nodes.map((n) => (
                      <Badge key={n.id} variant="neutral" size="sm">
                        {n.componentId}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-background/50 p-4 flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Nodes in {botSlots[1].title} ({botSlots[1].bot?.nodes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {botSlots[1].bot?.nodes.map((n) => (
                      <Badge key={n.id} variant="neutral" size="sm">
                        {n.componentId}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selection Modal */}
      {activeSlotIdx !== null && (
        <Dialog open={activeSlotIdx !== null} onOpenChange={(open) => !open && setActiveSlotIdx(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Select Strategy for Slot {activeSlotIdx + 1}</DialogTitle>
              <DialogDescription>
                Choose an active trading bot, community preset, or completed simulation run.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Segmented<'bots' | 'runs' | 'presets'>
                value={pickerTab}
                onValueChange={setPickerTab}
                options={[
                  { value: 'bots', label: `My Bots (${bots.length})` },
                  { value: 'runs', label: `Backtests (${runs.length})` },
                  { value: 'presets', label: `Presets (${myPresets.length + MARKETPLACE_PRESETS.length})` },
                ]}
              />

              <div className="max-h-72 overflow-y-auto divide-y divide-border flex flex-col pr-1">
                {pickerTab === 'bots' &&
                  bots.map((b) => (
                    <div
                      key={b.id}
                      onClick={() =>
                        handleAddSlot({
                          id: b.id,
                          kind: 'bot',
                          title: b.name,
                          subtitle: `${b.status} · ${b.nodes.length} nodes`,
                          bot: b,
                        })
                      }
                      className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{b.name}</span>
                        <span className="text-[11px] text-muted-foreground">{b.nodes.length} nodes · {b.status}</span>
                      </div>
                      <PillButton size="sm" variant="secondary">
                        Select
                      </PillButton>
                    </div>
                  ))}

                {pickerTab === 'runs' &&
                  runs.map((r) => (
                    <div
                      key={r.id}
                      onClick={() =>
                        handleAddSlot({
                          id: r.id,
                          kind: 'run',
                          title: r.botName,
                          subtitle: `Run ${r.id} · ${r.metrics.totalReturn}%`,
                          run: r,
                        })
                      }
                      className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{r.botName}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {r.id} · Sharpe {r.metrics.sharpe} · {r.metrics.totalReturn}%
                        </span>
                      </div>
                      <PillButton size="sm" variant="secondary">
                        Select
                      </PillButton>
                    </div>
                  ))}

                {pickerTab === 'presets' &&
                  [...myPresets, ...MARKETPLACE_PRESETS].map((p) => {
                    const tagline = 'tagline' in p ? p.tagline : p.description
                    return (
                      <div
                        key={p.id}
                        onClick={() =>
                          handleAddSlot({
                            id: p.id,
                            kind: 'preset',
                            title: p.name,
                            subtitle: tagline || 'Custom preset block',
                            preset: p,
                          })
                        }
                        className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                          <span className="text-[11px] text-muted-foreground truncate">{tagline || 'Preset graph'}</span>
                        </div>
                        <PillButton size="sm" variant="secondary" className="shrink-0">
                          Select
                        </PillButton>
                      </div>
                    )
                  })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading comparison engine...</div>}>
      <CompareContent />
    </Suspense>
  )
}
