'use client'

import Link from 'next/link'
import { ArrowRight, GitFork, Star } from 'lucide-react'
import { MARKETPLACE_PRESETS } from '@/mock/data'
import { LAYER_MAP } from '@/mock/layers'
import { useReveal } from '@/lib/use-reveal'
import { cn, formatCompact, formatINR } from '@/lib/utils'

export function MarketplaceTeaser() {
  const ref = useReveal<HTMLDivElement>()
  const featured = MARKETPLACE_PRESETS.filter((p) => p.trending).slice(0, 3)

  return (
    <section className="py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p data-reveal className="eyebrow text-brand">
              Marketplace
            </p>
            <h2
              data-reveal
              className="mt-3 max-w-xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
            >
              Fork a graph that already works.
            </h2>
          </div>
          {/* TODO(phase5): point at public /marketplace once built */}
          <Link
            data-reveal
            href="/app/marketplace"
            className="flex items-center gap-1.5 text-[14px] font-medium text-brand hover:underline"
          >
            Browse all presets
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {featured.map((p) => (
            <li key={p.id} data-reveal>
              {/* TODO(phase5): public detail route at /marketplace/:id */}
              <Link
                href={`/marketplace/${p.id}`}
                className="glass flex h-full flex-col rounded-[var(--radius-md)] p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16px] font-semibold tracking-[-0.015em]">{p.name}</h3>
                  <span
                    className={cn(
                      'shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold',
                      p.price === 0 ? 'bg-secondary text-muted-foreground' : 'bg-accent text-brand',
                    )}
                  >
                    {p.price === 0 ? 'Free' : formatINR(p.price)}
                  </span>
                </div>

                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{p.tagline}</p>

                <div className="mt-5 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-[22px] font-semibold tabular-nums tracking-[-0.02em]',
                      p.headline.positive ? 'text-profit' : 'text-loss',
                    )}
                  >
                    {p.headline.value}
                  </span>
                  <span className="text-[12px] text-tertiary">{p.headline.label}</span>
                </div>

                {/* Layer fingerprint  shows the shape of the graph at a glance. */}
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {p.layers.map((id) => (
                    <li
                      key={id}
                      className="rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: LAYER_MAP[id].hue,
                        background: `color-mix(in oklab, ${LAYER_MAP[id].hue} 14%, transparent)`,
                      }}
                    >
                      {LAYER_MAP[id].roman}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center gap-4 pt-6 text-[12px] text-tertiary">
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 text-gold" strokeWidth={2} />
                    {p.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork className="size-3.5" strokeWidth={1.75} />
                    {formatCompact(p.forks)}
                  </span>
                  <span className="ml-auto">{p.nodeCount} nodes</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
