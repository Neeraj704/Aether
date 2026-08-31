'use client'

import { useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookMarked,
  Layers,
  Sparkles,
  Lock,
  Plus,
  Wrench,
  CheckCircle2,
  HelpCircle,
  Code2,
} from 'lucide-react'
import { COMPONENT_MAP, LAYER_MAP, PORT_COLORS, type PortType } from '@/mock/layers'
import { hasComponent, requiredPlan } from '@/lib/entitlements'
import { useSession, toast } from '@/lib/store'
import { useWorkspace, makeNode } from '@/lib/workspace-store'
import { CURRENT_GRAPH_SCHEMA_VERSION } from '@/mock/data'
import { TierBadge } from '@/components/ui/badge'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { UnlockDialog } from '@/components/builder/unlock-dialog'
import { cn } from '@/lib/utils'

const PORT_DESCRIPTIONS: Record<PortType, string> = {
  MarketData: 'Real-time or historical OHLCV bars, order book ticks, or trades.',
  NewsFeed: 'Raw headlines, regulatory filings, or unstructured text streams.',
  FeatureVector: 'Engineered numerical features, normalized indicators, and tensors.',
  Signal: 'Directional bias (-1 to +1) or conviction score emitted by alpha models.',
  RiskDecision: 'Gated signal approved by risk filters with allocated position size.',
  ExecutionOrder: 'Low-latency order instructions routed to broker gateways.',
  TradeOutcome: 'Fill confirmation, execution slippage metrics, and P&L feedback.',
}

export default function ComponentDetailPage() {
  const { componentId } = useParams<{ componentId: string }>()
  const router = useRouter()
  const { plan, unlocked } = useSession()
  const createBot = useWorkspace((s) => s.createBot)

  const comp = COMPONENT_MAP[componentId]
  if (!comp) {
    notFound()
  }

  const layer = LAYER_MAP[comp.layer]
  const isAvailable = hasComponent(comp.id, { plan, unlocked })
  const [unlockOpen, setUnlockOpen] = useState(false)

  const handleTryInNewBot = () => {
    if (!isAvailable) {
      setUnlockOpen(true)
      return
    }

    const newNode = makeNode(comp.id, 80, 80)
    const newBot = createBot({
      name: `${comp.name} Bot`,
      description: `Strategy initialized with ${comp.name} from Layer ${layer?.roman || 'I'}.`,
      graph: {
        nodes: [newNode],
        edges: [],
        notes: [],
        frames: [],
        schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
      },
      tags: [comp.layer, 'custom'],
    })

    toast.success('Strategy Created', `Initialized bot with ${comp.name}. Opening builder...`)
    router.push(`/app/builder/${newBot.id}`)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Back Link */}
      <div>
        <Link
          href={`/app/library?layer=${comp.layer}`}
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Component Library
        </Link>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-6">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <span
              style={{ backgroundColor: layer?.hue || '#888' }}
              className="size-2 rounded-full"
            />
            Layer {layer?.roman}: {layer?.name}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{comp.name}</h1>
            <TierBadge tier={comp.tier} size="md" />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            {comp.tagline}
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-3 shrink-0">
          <PillButton
            size="lg"
            onClick={handleTryInNewBot}
            className="gap-2 shadow-lg shadow-brand/20"
          >
            {isAvailable ? (
              <>
                <Wrench className="size-4" /> Try it in a new bot
              </>
            ) : (
              <>
                <Lock className="size-4" /> Unlock with Credits
              </>
            )}
          </PillButton>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Details & Ports & Fields */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Functional Description */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookMarked className="size-4 text-brand" /> Overview & Mechanics
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {comp.description}
            </p>
          </div>

          {/* Example Quant Use Case */}
          {comp.useCase && (
            <div className="flex flex-col gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-6">
              <h2 className="text-base font-bold flex items-center gap-2 text-brand">
                <Sparkles className="size-4" /> Recommended Use Case
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {comp.useCase}
              </p>
            </div>
          )}

          {/* Port Specifications */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-brand" /> Port Interfaces
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Inputs */}
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                  Input Requirements ({comp.inputs.length})
                </span>
                {comp.inputs.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    Root source node (No inputs required)
                  </span>
                ) : (
                  <div className="flex flex-col gap-2 pt-1">
                    {comp.inputs.map((port) => (
                      <div key={port} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            style={{ backgroundColor: PORT_COLORS[port] || '#888' }}
                            className="size-2 rounded-full shrink-0"
                          />
                          <span className="text-xs font-bold text-foreground">{port}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground pl-3.5">
                          {PORT_DESCRIPTIONS[port]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outputs */}
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-tertiary">
                  Emitted Outputs ({comp.outputs.length})
                </span>
                {comp.outputs.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    Terminal execution sink (No downstream output)
                  </span>
                ) : (
                  <div className="flex flex-col gap-2 pt-1">
                    {comp.outputs.map((port) => (
                      <div key={port} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            style={{ backgroundColor: PORT_COLORS[port] || '#888' }}
                            className="size-2 rounded-full shrink-0"
                          />
                          <span className="text-xs font-bold text-foreground">{port}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground pl-3.5">
                          {PORT_DESCRIPTIONS[port]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Architectural Guidelines */}
          {comp.docs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-profit/30 bg-profit/5 p-5 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-profit uppercase tracking-wider">When to Use</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{comp.docs.whenToUse}</p>
              </div>

              <div className="rounded-2xl border border-warn/30 bg-warn/5 p-5 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-warn uppercase tracking-wider">When to Skip</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{comp.docs.whenToSkip}</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-foreground">Best Practices</h3>
                <ul className="list-disc pl-4 text-xs text-muted-foreground flex flex-col gap-1.5">
                  {comp.docs.bestPractices.map((bp, i) => (
                    <li key={i}>{bp}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-destructive">Common Mistakes</h3>
                <ul className="list-disc pl-4 text-xs text-muted-foreground flex flex-col gap-1.5">
                  {comp.docs.commonMistakes.map((cm, i) => (
                    <li key={i}>{cm}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Config Parameters Table */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Code2 className="size-4 text-brand" /> Configurable Parameters
            </h2>

            {[...comp.fields, ...(comp.advancedFields || [])].length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                This component uses auto-calibrated presets without manual configuration parameters.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {[...comp.fields, ...(comp.advancedFields || [])].map((field) => (
                  <div key={field.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-mono text-foreground">
                        {field.label}
                      </span>
                      <span className="text-[10px] font-mono text-tertiary uppercase bg-secondary px-2 py-0.5 rounded">
                        {field.type}
                      </span>
                    </div>
                    {field.help && (
                      <span className="text-xs text-muted-foreground">{field.help}</span>
                    )}
                    {'value' in field && field.value !== undefined && (
                      <span className="text-[11px] text-tertiary font-mono">
                        Default: {typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Entitlements & Layer Info */}
        <div className="flex flex-col gap-6">
          {/* Plan Availability Card */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold">Access & Plan Tier</h3>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs text-muted-foreground">Required Tier</span>
              <TierBadge tier={comp.tier} />
            </div>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs text-muted-foreground">Your Plan</span>
              <span className="text-xs font-semibold capitalize text-foreground">{plan}</span>
            </div>

            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="text-xs font-bold">
                {isAvailable ? (
                  <span className="text-profit flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Unlocked
                  </span>
                ) : (
                  <span className="text-warn flex items-center gap-1">
                    <Lock className="size-3.5" /> Locked
                  </span>
                )}
              </span>
            </div>

            {!isAvailable && (
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2">
                <PillButton onClick={() => setUnlockOpen(true)} size="sm" className="w-full">
                  Unlock with Credits
                </PillButton>
                <PillLink href="/pricing" variant="secondary" size="sm" className="w-full justify-center">
                  Upgrade Subscription
                </PillLink>
              </div>
            )}
          </div>

          {/* Layer Metadata Card */}
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: layer?.hue || '#888' }}
                className="size-3 rounded-full"
              />
              <h3 className="text-sm font-bold">
                Layer {layer?.roman}: {layer?.name}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {layer?.description}
            </p>
            <Link
              href={`/app/library?layer=${comp.layer}`}
              className="text-xs text-brand font-semibold hover:underline pt-2 inline-flex items-center gap-1"
            >
              Browse all Layer {layer?.roman} blocks &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Unlock Dialog */}
      <UnlockDialog
        comp={unlockOpen ? comp : null}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => {
          setUnlockOpen(false)
          toast.success('Component Unlocked', `${comp.name} is now available in your workspace.`)
        }}
      />
    </div>
  )
}
