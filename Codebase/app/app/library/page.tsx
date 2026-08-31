'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  BookMarked,
  Search,
  Lock,
} from 'lucide-react'
import {
  COMPONENTS,
  LAYERS,
  PORT_COLORS,
  type LayerId,
  type PlanTier,
} from '@/mock/layers'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { TierBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/tabs'
import { fuzzyScore, cn } from '@/lib/utils'

function LibraryContent() {
  const searchParams = useSearchParams()
  const plan = useSession((s) => s.plan)
  const unlocked = useSession((s) => s.unlocked)

  const layerParam = searchParams.get('layer') as LayerId | null

  const [query, setQuery] = useState('')
  const [selectedLayer, setSelectedLayer] = useState<string>(layerParam || 'all')
  const [tierFilter, setTierFilter] = useState<'all' | PlanTier>('all')

  useEffect(() => {
    if (layerParam && LAYERS.some((l) => l.id === layerParam)) {
      setSelectedLayer(layerParam)
    }
  }, [layerParam])

  const filteredComponents = useMemo(() => {
    return COMPONENTS.filter((comp) => {
      const matchQuery =
        !query.trim() ||
        fuzzyScore(query, comp.name) > 0 ||
        fuzzyScore(query, comp.tagline) > 0 ||
        comp.inputs.some((i) => i.toLowerCase().includes(query.toLowerCase())) ||
        comp.outputs.some((o) => o.toLowerCase().includes(query.toLowerCase()))

      const matchLayer = selectedLayer === 'all' || comp.layer === selectedLayer
      const matchTier = tierFilter === 'all' || comp.tier === tierFilter

      return matchQuery && matchLayer && matchTier
    })
  }, [query, selectedLayer, tierFilter])

  // Group filtered components by Layer
  const layerGroups = useMemo(() => {
    return LAYERS.map((layer) => ({
      layer,
      items: filteredComponents.filter((c) => c.layer === layer.id),
    })).filter((g) => g.items.length > 0)
  }, [filteredComponents])

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <BookMarked className="size-3.5" /> 12-Layer Quantitative Architecture
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Component & Intelligence Library
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Explore 36+ battle-tested modules spanning real-time data feeds, alpha generation, multi-agent debate, stochastic risk filters, and low-latency broker execution.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search components or port types..."
              className="pl-9 text-xs"
            />
          </div>

          <Segmented<'all' | PlanTier>
            value={tierFilter}
            onValueChange={setTierFilter}
            options={[
              { value: 'all', label: 'All Tiers' },
              { value: 'free', label: 'Free' },
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
            ]}
          />
        </div>

        {/* Layer Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedLayer('all')}
            className={cn(
              'h-7 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
              selectedLayer === 'all'
                ? 'bg-brand text-brand-foreground font-semibold'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            All Layers ({COMPONENTS.length})
          </button>
          {LAYERS.map((layer) => {
            const count = COMPONENTS.filter((c) => c.layer === layer.id).length
            const isSelected = selectedLayer === layer.id
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => setSelectedLayer(layer.id)}
                className={cn(
                  'h-7 px-2.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                  isSelected
                    ? 'bg-brand text-brand-foreground font-semibold'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  style={{ backgroundColor: layer.hue }}
                  className="size-2 rounded-full shrink-0"
                />
                <span>{layer.roman}. {layer.name}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Layer Groups Display */}
      {layerGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border rounded-2xl gap-2">
          <BookMarked className="size-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">No matching components</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Try adjusting your search query or selecting a different layer/tier filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {layerGroups.map(({ layer, items }) => (
            <div key={layer.id} id={layer.id} className="flex flex-col gap-4">
              {/* Layer Section Header */}
              <div className="flex items-center gap-3 border-b border-border pb-2.5">
                <span
                  style={{ backgroundColor: layer.hue }}
                  className="size-3 rounded-full shrink-0"
                />
                <h2 className="text-lg font-bold tracking-tight">
                  Layer {layer.roman}: {layer.name}
                </h2>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  — {layer.short}
                </span>
                <span className="ml-auto text-xs text-tertiary font-mono">
                  {items.length} block(s)
                </span>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((comp) => {
                  const unlockedStatus = hasComponent(comp.id, { plan, unlocked })

                  return (
                    <Link
                      key={comp.id}
                      href={`/app/library/${comp.id}`}
                      className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-brand/40 transition-all duration-200"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-mono text-tertiary uppercase tracking-wider">
                              Layer {layer.roman}
                            </span>
                            <h3 className="font-bold text-base tracking-tight group-hover:text-brand transition-colors truncate">
                              {comp.name}
                            </h3>
                          </div>
                          <TierBadge tier={comp.tier} />
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {comp.tagline}
                        </p>

                        {/* Ports Breakdown */}
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50 text-[11px]">
                          {comp.inputs.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-tertiary font-medium">In:</span>
                              {comp.inputs.map((port) => (
                                <span
                                  key={port}
                                  className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px]"
                                >
                                  <span
                                    style={{ backgroundColor: PORT_COLORS[port] || '#888' }}
                                    className="size-1.5 rounded-full"
                                  />
                                  {port}
                                </span>
                              ))}
                            </div>
                          )}

                          {comp.outputs.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-tertiary font-medium">Out:</span>
                              {comp.outputs.map((port) => (
                                <span
                                  key={port}
                                  className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px]"
                                >
                                  <span
                                    style={{ backgroundColor: PORT_COLORS[port] || '#888' }}
                                    className="size-1.5 rounded-full"
                                  />
                                  {port}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {unlockedStatus ? (
                            <span className="text-profit font-semibold">Available</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-warn">
                              <Lock className="size-3" /> Requires {comp.tier.toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-brand flex items-center gap-1 group-hover:underline">
                          View Docs &rarr;
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ComponentLibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading component library...</div>}>
      <LibraryContent />
    </Suspense>
  )
}
