'use client'

import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Star,
  GitFork,
  CheckCircle2,
  Layers,
  TrendingUp,
  ShieldCheck,
  Zap,
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
import { MARKETPLACE_PRESETS, BACKTEST_RUNS, type Preset } from '@/mock/data'
import { LAYER_MAP, COMPONENT_MAP } from '@/mock/layers'
import { TierBadge, Badge } from '@/components/ui/badge'
import { PillLink } from '@/components/ui/pill-button'
import { formatINR } from '@/lib/utils'

export default function PublicPresetDetailPage() {
  const { presetId } = useParams<{ presetId: string }>()
  const preset = MARKETPLACE_PRESETS.find((p) => p.id === presetId)

  if (!preset) {
    notFound()
  }

  const sampleRun = BACKTEST_RUNS.find((r) => r.id === preset.sampleRunId) || BACKTEST_RUNS[0]

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold text-sm">
            Æ
          </div>
          <span className="font-bold tracking-tight text-base">Aether</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <PillLink href={`/signup?clone=${preset.id}`} size="sm">
            Sign Up to Clone
          </PillLink>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1100px] w-full mx-auto p-6 sm:p-10 flex flex-col gap-8">
        <div>
          <Link
            href="/marketplace"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Marketplace Catalog
          </Link>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-8">
          <div className="flex flex-col gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">By {preset.author.name}</span>
              <TierBadge tier={preset.tier} size="md" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{preset.name}</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {preset.tagline}
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
              <div className="flex items-center gap-1 text-gold font-medium">
                <Star className="size-3.5 fill-gold text-gold" />
                <span>{preset.rating} rating</span>
                <span className="text-tertiary">({preset.reviewCount} reviews)</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <GitFork className="size-3.5" />
                <span>{preset.forks} forks</span>
              </div>
              <span>·</span>
              <span>{preset.nodeCount} graph nodes</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <PillLink
              href={`/signup?clone=${preset.id}`}
              size="lg"
              className="gap-2 shadow-lg shadow-brand/20 justify-center"
            >
              <GitFork className="size-4" /> Clone Strategy to Workspace
            </PillLink>
            <span className="text-[11px] text-center text-muted-foreground">
              Free instant paper-trading sandbox
            </span>
          </div>
        </div>

        {/* Verified Backtest Stats */}
        {sampleRun && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">Total Return</span>
              <div className="text-2xl font-bold text-profit">+{sampleRun.metrics.totalReturn}%</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">Sharpe Ratio</span>
              <div className="text-2xl font-bold text-foreground">{sampleRun.metrics.sharpe}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">Win Rate</span>
              <div className="text-2xl font-bold text-foreground">{sampleRun.metrics.winRate}%</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-medium">Max Drawdown</span>
              <div className="text-2xl font-bold text-loss">{sampleRun.metrics.maxDrawdown}%</div>
            </div>
          </div>
        )}

        {/* Backtest Equity Curve */}
        {sampleRun && (
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Verified Simulation Equity Curve</h2>
                <p className="text-xs text-muted-foreground">Historical performance backtested against tick data</p>
              </div>
              <span className="text-xs font-semibold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Backtest Verified
              </span>
            </div>

            <div className="h-[280px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sampleRun.equity.map((pt) => ({
                    date: pt.date.slice(5),
                    equity: pt.equity,
                    benchmark: pt.benchmark,
                  }))}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [typeof val === 'number' ? formatINR(val) : 'N/A', 'Equity']}
                  />
                  <Line type="monotone" dataKey="equity" stroke="#2997ff" strokeWidth={2.2} dot={false} />
                  <Line type="monotone" dataKey="benchmark" stroke="#666" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Strategy Description & Layers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
              <h2 className="text-base font-bold">Strategy Concept & Logic</h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {preset.description || preset.tagline}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Layers className="size-4 text-brand" /> Architecture & Node Layers
              </h2>
              <div className="flex flex-col gap-2.5 divide-y divide-border">
                {preset.layers.map((lId) => {
                  const layer = LAYER_MAP[lId]
                  if (!layer) return null
                  return (
                    <div key={lId} className="flex items-center justify-between pt-2.5 first:pt-0">
                      <div className="flex items-center gap-2.5">
                        <span style={{ backgroundColor: layer.hue }} className="size-2.5 rounded-full" />
                        <span className="text-xs font-bold">{layer.roman}. {layer.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{layer.short}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
              <h3 className="text-sm font-bold">Author Profile</h3>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/15 font-bold text-brand text-sm">
                  {preset.author.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">{preset.author.name}</span>
                  <span className="text-[11px] text-muted-foreground">@{preset.author.handle || 'quant'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
              <h3 className="text-sm font-bold">Ready to customize?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fork this blueprint directly onto your visual node canvas to adjust thresholds, test alternate tickers, or plug into your broker.
              </p>
              <PillLink href={`/signup?clone=${preset.id}`} className="mt-2 w-full justify-center">
                Sign Up & Clone Strategy
              </PillLink>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
