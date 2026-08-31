'use client'

import { useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Star,
  GitFork,
  CheckCircle2,
  Layers,
  Flag,
  Share2,
  Check,
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
import { BACKTEST_RUNS } from '@/mock/data'
import { LAYER_MAP } from '@/mock/layers'
import { useWorkspace, useMarketplacePresets } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { TierBadge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { formatINR } from '@/lib/utils'

export default function AppMarketplaceDetailPage() {
  const { presetId } = useParams<{ presetId: string }>()
  const router = useRouter()
  const marketplacePresets = useMarketplacePresets()
  const forkPreset = useWorkspace((s) => s.forkPreset)
  const forkedPresets = useWorkspace((s) => s.forkedPresets)
  const likedPresets = useWorkspace((s) => s.likedPresets)
  const toggleLikePreset = useWorkspace((s) => s.toggleLikePreset)

  const preset = marketplacePresets.find((p) => p.id === presetId)
  if (!preset) {
    notFound()
  }

  const sampleRun = BACKTEST_RUNS.find((r) => r.id === preset.sampleRunId) || BACKTEST_RUNS[0]
  const isForked = forkedPresets.includes(preset.id)
  const isLiked = likedPresets.includes(preset.id)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  const handleFork = () => {
    const newBot = forkPreset(preset)
    toast.success('Strategy Cloned', `Cloned "${preset.name}". Opening canvas...`)
    router.push(`/app/builder/${newBot.id}`)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    toast.success('Link Copied')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSubmitReport = () => {
    if (!reportReason.trim()) return
    toast.success('Report Submitted', 'Thank you for keeping the marketplace safe.')
    setReportReason('')
    setReportOpen(false)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Back Link */}
      <div>
        <Link
          href="/app/marketplace"
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Marketplace
        </Link>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-6">
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">By {preset.author.name}</span>
            <TierBadge tier={preset.tier} size="md" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{preset.name}</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
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

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleLikePreset(preset.id)}
            className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
              isLiked
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
            }`}
            title="Like preset"
          >
            <Star className={`size-4 ${isLiked ? 'fill-gold' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2.5 rounded-xl border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Share preset"
          >
            {copiedLink ? <Check className="size-4 text-profit" /> : <Share2 className="size-4" />}
          </button>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="p-2.5 rounded-xl border border-border bg-secondary/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="Report preset"
          >
            <Flag className="size-4" />
          </button>

          <PillButton
            size="lg"
            onClick={handleFork}
            className="gap-2 shadow-lg shadow-brand/20 ml-2"
          >
            <GitFork className="size-4" /> {isForked ? 'Clone Again' : 'Clone to My Bots'}
          </PillButton>
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
              <p className="text-xs text-muted-foreground">Historical tick-level execution backtest</p>
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

      {/* Description & Layers */}
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
            <h3 className="text-sm font-bold">Author Information</h3>
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
            <h3 className="text-sm font-bold">Clone into Builder</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instantiate this full strategy graph into your personal workspace with all nodes, connections, and risk thresholds intact.
            </p>
            <PillButton onClick={handleFork} className="mt-2 w-full justify-center">
              <GitFork className="size-3.5 mr-1" /> Clone to My Bots
            </PillButton>
          </div>
        </div>
      </div>

      {/* Report Preset Dialog */}
      {reportOpen && (
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Report Strategy Preset</DialogTitle>
              <DialogDescription>
                Flag inappropriate content, misleading claims, or broken graph parameters.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-3">
              <Textarea
                rows={4}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue with this preset..."
                className="text-xs"
              />
            </DialogBody>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setReportOpen(false)}>
                Cancel
              </PillButton>
              <PillButton onClick={handleSubmitReport} disabled={!reportReason.trim()}>
                Submit Report
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
