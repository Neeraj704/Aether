'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { COMPONENTS, LAYERS } from '@/mock/layers'
import { useReveal } from '@/lib/use-reveal'

/** Component count per layer, so each card advertises real depth. */
const COUNTS = LAYERS.reduce<Record<string, number>>((acc, l) => {
  acc[l.id] = COMPONENTS.filter((c) => c.layer === l.id).length
  return acc
}, {})

export function LayerShowcase() {
  const railRef = useRef<HTMLUListElement | null>(null)
  const revealRef = useReveal<HTMLDivElement>()

  const nudge = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 328, behavior: 'smooth' })
  }

  return (
    <section className="overflow-hidden py-20 sm:py-28">
      <div ref={revealRef} className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p data-reveal className="eyebrow text-brand">
              The stack
            </p>
            <h2
              data-reveal
              className="mt-3 max-w-xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
            >
              Twelve layers. Use as many as your idea deserves.
            </h2>
          </div>
          <div data-reveal className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Scroll layers left"
              className="glass flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-[18px]" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Scroll layers right"
              className="glass flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="size-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {/*
        The rail is centred on the same 1120px column as the heading, but its
        padding is what bleeds the cards to the viewport edge  so the first
        card lines up with the h2 without depending on 100vw (which would
        include the scrollbar and drift by ~15px).
      */}
      <ul
        ref={railRef}
        className="mx-auto mt-12 flex max-w-[1120px] snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] lg:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {LAYERS.map((layer) => (
          <li
            key={layer.id}
            className="glass flex w-[300px] shrink-0 snap-start flex-col rounded-[var(--radius-md)] p-6"
          >
            <div className="flex items-baseline justify-between">
              <span
                className="text-[26px] font-semibold leading-none tracking-[-0.02em]"
                style={{ color: layer.hue }}
              >
                {layer.roman}
              </span>
              <span className="rounded-[var(--radius-pill)] bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {COUNTS[layer.id]} components
              </span>
            </div>
            <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em]">{layer.name}</h3>
            <p className="mt-2 text-[14px] font-medium leading-6 text-foreground/80">{layer.short}</p>
            <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{layer.description}</p>
            <span
              aria-hidden
              className="mt-6 block h-px w-full"
              style={{ background: `linear-gradient(90deg, ${layer.hue}, transparent)` }}
            />
          </li>
        ))}
        <li className="flex w-[300px] shrink-0 snap-start items-center">
          <Link
            href="/docs/layer-reference"
            className="glass flex h-full w-full flex-col justify-center gap-2 rounded-[var(--radius-md)] p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <span className="text-[17px] font-semibold tracking-[-0.015em]">Read the full reference</span>
            <span className="flex items-center gap-1.5 text-[14px] text-brand">
              Every layer, every port type
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </span>
          </Link>
        </li>
      </ul>
    </section>
  )
}
