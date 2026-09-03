'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  AlertTriangle,
  LineChart,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { useSession, toast } from '@/lib/store'
import type { Bot, BacktestRun } from '@/mock/data'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Input, Textarea, Field } from '@/components/ui/input'
import { Segmented } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { getBot } from '@/lib/bots'
import { createPreset } from '@/lib/presets'
import { publishPreset } from '@/lib/marketplace'

export default function PublishWizardPage() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()
  const plan = useSession((s) => s.plan)

  const [bot, setBot] = useState<Bot | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  const workspaceRuns = useWorkspace((s) => s.runs).filter((r) => r.botId === botId)
  const [runs, setRuns] = useState<BacktestRun[]>(workspaceRuns)

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Step 1: Info
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')

  // Step 2: Pricing
  const [pricingType, setPricingType] = useState<'free' | 'paid'>('free')
  const [price, setPrice] = useState('299')

  // Step 3: Categorization
  const [category, setCategory] = useState('Momentum')
  const [tagsInput, setTagsInput] = useState('equities, intraday')

  // Step 4: Backtest proof
  const [selectedRunId, setSelectedRunId] = useState('')

  useEffect(() => {
    let active = true
    if (!botId) return

    getBot(botId)
      .then((b) => {
        if (!active || !b) return
        setBot(b)
        setName(b.name)
        setTagline(b.description?.slice(0, 80) || 'Quantitative algorithmic strategy')
        setDescription(b.description || '')
        setTagsInput(b.tags?.join(', ') || 'equities, intraday')
      })
      .catch((err) => {
        console.error('Error fetching bot for publish:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [botId])

  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id)
    }
  }, [runs, selectedRunId])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading strategy for publishing...
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
        <h2 className="text-lg font-bold">Bot not found</h2>
        <PillButton onClick={() => router.push('/app/bots')}>
          &larr; Back to Bots
        </PillButton>
      </div>
    )
  }

  const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0]

  const handlePublish = async () => {
    try {
      setPublishing(true)
      const finalPrice = pricingType === 'paid' ? parseInt(price) || 0 : 0
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      // 1. Create a base preset from the bot's current graph
      const newPreset = await createPreset({
        name: name.trim() || bot.name,
        description: description.trim() || bot.description,
        graph: bot.graph,
        visibility: 'public',
      })

      // 2. Publish the preset to the marketplace
      const listing = await publishPreset(newPreset.id, {
        tagline: tagline.trim() || bot.description.slice(0, 80) || 'Quantitative trading strategy',
        description: description.trim() || bot.description || 'Systematic strategy for automated execution.',
        authorNotes: 'Published from Aether Strategy Studio.',
        category: category || 'Momentum',
        tags,
        price: finalPrice,
        tier: plan === 'pro' ? 'pro' : 'free',
        sampleRunId: selectedRun?.id || undefined,
      })

      toast.success('Strategy Published!', `"${listing.name}" is now live on the community marketplace.`)
      router.push('/app/creator/dashboard')
    } catch (err: any) {
      toast.error('Publishing failed', err?.message || 'Could not publish preset.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[800px] mx-auto w-full">
      {/* Header */}
      <div>
        <Link
          href={`/app/bots/${bot.id}`}
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Bot Overview
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <Globe className="size-3.5" /> Marketplace Publishing Wizard
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Publish &ldquo;{bot.name}&rdquo;
        </h1>
        <p className="text-xs text-muted-foreground">
          Share your systematic strategy with thousands of quant researchers.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
        {[
          { num: 1, label: 'Info' },
          { num: 2, label: 'Pricing' },
          { num: 3, label: 'Category' },
          { num: 4, label: 'Proof' },
          { num: 5, label: 'Review' },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                step === s.num
                  ? 'bg-brand text-brand-foreground'
                  : step > s.num
                    ? 'bg-profit/20 text-profit'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </span>
            <span
              className={`text-xs hidden sm:inline font-medium ${
                step === s.num ? 'text-foreground font-bold' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Info */}
      {step === 1 && (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 animate-in fade-in duration-200">
          <h2 className="text-base font-bold">1. Strategy Identity</h2>
          <Field label="Marketplace Title" htmlFor="title">
            <Input
              id="title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nifty Intraday Flow Reversal"
            />
          </Field>
          <Field label="Short Tagline" htmlFor="tagline">
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One-line summary for catalog cards..."
            />
          </Field>
          <Field label="Detailed Description & Trading Rules" htmlFor="desc">
            <Textarea
              id="desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain data requirements, indicator thresholds, and position management..."
            />
          </Field>
          <div className="flex justify-end pt-2">
            <PillButton onClick={() => setStep(2)} disabled={!name.trim() || !tagline.trim()}>
              Next: Pricing &rarr;
            </PillButton>
          </div>
        </div>
      )}

      {/* Step 2: Pricing */}
      {step === 2 && (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 animate-in fade-in duration-200">
          <h2 className="text-base font-bold">2. Strategy Monetization</h2>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold">Distribution Model</span>
            <Segmented<'free' | 'paid'>
              value={pricingType}
              onValueChange={setPricingType}
              options={[
                { value: 'free', label: 'Free (Open to All)' },
                { value: 'paid', label: 'Paid Preset (80% Creator Rev-Share)' },
              ]}
            />
          </div>

          {pricingType === 'paid' && (
            <div className="flex flex-col gap-3 pt-2">
              {plan !== 'pro' && (
                <div className="p-3 rounded-xl border border-gold/30 bg-gold/10 text-gold text-xs leading-relaxed">
                  Selling paid presets requires an active <strong>Pro</strong> membership. You will be able to publish as draft or upgrade before receiving payouts.
                </div>
              )}
              <Field label="Preset Price (INR ₹)" htmlFor="price">
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="299"
                />
              </Field>
              <span className="text-[11px] text-muted-foreground">
                You will earn 80% (₹{(parseInt(price || '0') * 0.8).toFixed(0)}) on every fork.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <PillButton variant="secondary" onClick={() => setStep(1)}>
              &larr; Back
            </PillButton>
            <PillButton onClick={() => setStep(3)}>Next: Categories &rarr;</PillButton>
          </div>
        </div>
      )}

      {/* Step 3: Categorization */}
      {step === 3 && (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 animate-in fade-in duration-200">
          <h2 className="text-base font-bold">3. Category & Taxonomy</h2>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold">Marketplace Category</span>
            <Segmented<string>
              value={category}
              onValueChange={setCategory}
              options={[
                { value: 'Starter', label: 'Starter' },
                { value: 'Momentum', label: 'Momentum' },
                { value: 'Debate', label: 'Debate' },
                { value: 'Options', label: 'Options' },
              ]}
            />
          </div>

          <Field label="Search Tags (comma-separated)" htmlFor="tags">
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="nifty, breakout, options, intraday"
            />
          </Field>

          <div className="flex items-center justify-between pt-2">
            <PillButton variant="secondary" onClick={() => setStep(2)}>
              &larr; Back
            </PillButton>
            <PillButton onClick={() => setStep(4)}>Next: Attach Proof &rarr;</PillButton>
          </div>
        </div>
      )}

      {/* Step 4: Backtest proof */}
      {step === 4 && (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 animate-in fade-in duration-200">
          <h2 className="text-base font-bold">4. Verified Simulation Proof</h2>
          <p className="text-xs text-muted-foreground">
            Attach verified backtest proof if available, or proceed with graph blueprint verification.
          </p>

          {runs.length === 0 ? (
            <div className="p-4 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground flex flex-col gap-2">
              <span>No prior backtest runs recorded yet for this strategy. The marketplace listing will be tagged as &ldquo;Blueprint Ready&rdquo;.</span>
              <PillLink href={`/app/bots/${bot.id}/backtest`} size="sm" variant="secondary" className="self-start">
                <LineChart className="size-3.5 mr-1" /> Run Backtest Now
              </PillLink>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
              {runs.map((r) => {
                const isSelected = selectedRunId === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand bg-brand/10 ring-1 ring-brand/30'
                        : 'border-border bg-background/50 hover:bg-secondary/40'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground">
                        Run {r.id} · {r.config.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Sharpe {r.metrics.sharpe} · Win Rate {r.metrics.winRate}% · DD {r.metrics.maxDrawdown}%
                      </span>
                    </div>
                    <span className="text-xs font-bold text-profit">
                      +{r.metrics.totalReturn}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <PillButton variant="secondary" onClick={() => setStep(3)}>
              &larr; Back
            </PillButton>
            <PillButton onClick={() => setStep(5)}>Next: Final Review &rarr;</PillButton>
          </div>
        </div>
      )}

      {/* Step 5: Final Review */}
      {step === 5 && (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 animate-in fade-in duration-200">
          <h2 className="text-base font-bold">5. Review & Confirm Publish</h2>

          <div className="rounded-xl border border-border bg-background/50 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-base font-bold text-foreground">{name}</span>
                <span className="text-xs text-muted-foreground">{tagline}</span>
              </div>
              <Badge variant={pricingType === 'paid' ? 'gold' : 'brand'}>
                {pricingType === 'paid' ? `₹${price}` : 'Free'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px]">Nodes</span>
                <span className="font-bold">{bot.graph?.nodes?.length || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px]">Category</span>
                <span className="font-bold">{category}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px]">Status</span>
                <span className="font-bold text-profit">Public Listing</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <PillButton variant="secondary" onClick={() => setStep(4)}>
              &larr; Back
            </PillButton>
            <PillButton
              onClick={handlePublish}
              disabled={publishing}
              className="gap-2 shadow-lg shadow-brand/20"
            >
              <Globe className="size-4" />
              {publishing ? 'Publishing...' : 'Publish to Community Marketplace'}
            </PillButton>
          </div>
        </div>
      )}
    </div>
  )
}
