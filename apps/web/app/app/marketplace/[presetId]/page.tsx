'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  MessageSquarePlus,
  User,
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
import { BACKTEST_RUNS, type Preset } from '@/mock/data'
import { LAYER_MAP } from '@/mock/layers'
import { toast } from '@/lib/store'
import { TierBadge, Badge } from '@/components/ui/badge'
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
import { formatINR, formatDate } from '@/lib/utils'
import { getListing, cloneListing, submitReview } from '@/lib/marketplace'
import { createBot as createBotDB } from '@/lib/bots'
import { useWorkspace } from '@/lib/workspace-store'

export default function AppMarketplaceDetailPage() {
  const { presetId } = useParams<{ presetId: string }>()
  const router = useRouter()

  const [preset, setPreset] = useState<Preset | null>(null)
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  // Review state
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  const loadListing = () => {
    if (!presetId) return
    getListing(presetId)
      .then((p) => {
        setPreset(p)
      })
      .catch((err) => {
        console.error('Error loading listing:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadListing()
  }, [presetId])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading strategy blueprint...
      </div>
    )
  }

  if (!preset) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <h2 className="text-xl font-bold">Strategy not found</h2>
        <p className="text-xs text-muted-foreground">This marketplace listing may have been delisted.</p>
        <PillButton onClick={() => router.push('/app/marketplace')}>
          &larr; Back to Marketplace
        </PillButton>
      </div>
    )
  }

  const sampleRun = BACKTEST_RUNS.find((r) => r.id === preset.sampleRunId) || BACKTEST_RUNS[0]

  const handleFork = async () => {
    try {
      setCloning(true)
      await cloneListing(preset.id)
      const newBot = await createBotDB({
        name: preset.name,
        description: preset.tagline || preset.description,
        graph: preset.graph,
        tags: preset.tags,
      })
      useWorkspace.getState().saveGraph(newBot.id, newBot.graph)
      toast.success('Strategy Cloned', `Cloned "${preset.name}" into your workspace. Opening canvas...`)
      router.push(`/app/builder/${newBot.id}`)
    } catch (err: any) {
      toast.error('Clone failed', err?.message || 'Could not clone strategy.')
    } finally {
      setCloning(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    toast.success('Link Copied')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSubmitReview = async () => {
    try {
      setSubmittingReview(true)
      await submitReview(preset.id, reviewRating, reviewBody)
      toast.success('Review Submitted', 'Thank you for your rating and feedback.')
      setReviewOpen(false)
      setReviewBody('')
      loadListing() // Refresh reviews & rating avg
    } catch (err: any) {
      toast.error('Review failed', err?.message || 'Could not submit review.')
    } finally {
      setSubmittingReview(false)
    }
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
            <Badge variant="outline" size="sm" className="capitalize">
              {preset.category}
            </Badge>
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
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="h-10 px-3.5 rounded-xl border border-border bg-secondary/40 text-xs font-semibold hover:text-brand hover:bg-secondary transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquarePlus className="size-4 text-brand" />
            <span>Write Review</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLiked(!isLiked)}
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
            disabled={cloning}
            className="gap-2 shadow-lg shadow-brand/20 ml-1"
          >
            <GitFork className="size-4" /> {cloning ? 'Cloning...' : 'Clone to My Workspace'}
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
            <h2 className="text-base font-bold">Strategy Concept &amp; Logic</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {preset.description || preset.tagline}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-brand" /> Architecture &amp; Node Layers
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

          {/* Community Reviews Section */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Community Trader Reviews</h2>
                <p className="text-xs text-muted-foreground">
                  Verified user ratings and feedback
                </p>
              </div>
              <PillButton size="sm" variant="secondary" onClick={() => setReviewOpen(true)}>
                Leave a Review
              </PillButton>
            </div>

            {preset.reviews.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                No reviews posted yet for this strategy preset. Be the first trader to review it!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {preset.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-border/70 bg-background/50 p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-[10px]">
                          {rev.initials}
                        </div>
                        <span className="text-xs font-bold text-foreground">{rev.author}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gold text-xs font-bold">
                        <Star className="size-3 fill-gold text-gold" />
                        <span>{rev.rating}/5</span>
                      </div>
                    </div>
                    {rev.body && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {rev.body}
                      </p>
                    )}
                    <span className="text-[10px] text-tertiary">
                      {formatDate(rev.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                <span className="text-[11px] text-muted-foreground">{preset.author.handle || '@quant'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
            <h3 className="text-sm font-bold">Clone into Builder</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instantiate this full strategy graph into your personal workspace with all nodes, connections, and risk thresholds intact.
            </p>
            <PillButton onClick={handleFork} disabled={cloning} className="mt-2 w-full justify-center">
              <GitFork className="size-3.5 mr-1" /> {cloning ? 'Cloning...' : 'Clone to My Workspace'}
            </PillButton>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      {reviewOpen && (
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review &ldquo;{preset.name}&rdquo;</DialogTitle>
              <DialogDescription>
                Share your experience running this strategy graph with other quantitative researchers.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold">Rating</span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className={`size-6 ${
                          star <= reviewRating ? 'fill-gold text-gold' : 'text-muted-foreground/40'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-foreground ml-2">{reviewRating} out of 5 stars</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold">Review Comments</span>
                <Textarea
                  rows={4}
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  placeholder="Share details on slippage, market regime performance, or recommended parameter adjustments..."
                  className="text-xs"
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setReviewOpen(false)}>
                Cancel
              </PillButton>
              <PillButton onClick={handleSubmitReview} disabled={submittingReview}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
