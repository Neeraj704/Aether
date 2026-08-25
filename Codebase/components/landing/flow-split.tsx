'use client'

import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HeroGraph } from '@/components/landing/hero-graph'
import { MaxFlowGraph } from '@/components/landing/max-flow-graph'
import { EASE_AETHER, cn } from '@/lib/utils'

/**
 * Two panes, one horizontal scroller: the starter graph sits fully in view
 * on load, and scrolling/clicking right reveals the maxed-out fifteen-node pipeline.
 */
export function FlowSplit() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState<0 | 1>(0)

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    const next = el.scrollLeft > el.scrollWidth / 4 ? 1 : 0
    setPane(next)
  }

  function goTo(index: 0 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.5, ease: EASE_AETHER }}
      className="mt-14 sm:mt-18"
    >
      <div className="relative mx-auto max-w-[960px]">
        {/* Top Center Header Bar with "Example Workflows" and Left/Right Arrows */}
        <div className="mb-5 flex items-center justify-center">
          <div className="flex items-center justify-between gap-3 rounded-full border border-border/80 bg-card/90 px-4 py-2 shadow-lg backdrop-blur-xl transition-all">
            <button
              type="button"
              onClick={() => goTo(0)}
              disabled={pane === 0}
              aria-label="Previous workflow example"
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-all sm:size-8',
                pane === 0
                  ? 'cursor-not-allowed opacity-25 text-muted-foreground'
                  : 'cursor-pointer bg-secondary text-foreground hover:bg-brand/20 hover:text-brand hover:scale-105 active:scale-95 shadow-xs',
              )}
            >
              <ChevronLeft className="size-4 sm:size-4.5" strokeWidth={2.5} />
            </button>

            <div className="flex items-center gap-2.5 px-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[12px]">
                Example Workflows
              </span>
              <span className="h-3.5 w-px bg-border/80" />
              <span className="text-[12px] font-semibold text-foreground sm:text-[13px]">
                {pane === 0 ? 'Starter Graph (5 Nodes)' : 'Full Pipeline (15 Nodes)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={pane === 1}
              aria-label="Next workflow example"
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-all sm:size-8',
                pane === 1
                  ? 'cursor-not-allowed opacity-25 text-muted-foreground'
                  : 'cursor-pointer bg-secondary text-foreground hover:bg-brand/20 hover:text-brand hover:scale-105 active:scale-95 shadow-xs',
              )}
            >
              <ChevronRight className="size-4 sm:size-4.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Outer Split Panel Card Container */}
        <div className="relative group">
          {/* Side arrow overlay button - Left */}
          {pane === 1 && (
            <button
              type="button"
              onClick={() => goTo(0)}
              aria-label="Go to Starter Workflow"
              className="absolute -left-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 p-2.5 text-foreground shadow-xl backdrop-blur-md transition-all hover:bg-secondary hover:scale-110 active:scale-95 sm:flex"
            >
              <ChevronLeft className="size-5" strokeWidth={2.5} />
            </button>
          )}

          {/* Side arrow overlay button - Right */}
          {pane === 0 && (
            <button
              type="button"
              onClick={() => goTo(1)}
              aria-label="Go to Full Pipeline Workflow"
              className="absolute -right-4 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border/80 bg-background/90 p-2.5 text-foreground shadow-xl backdrop-blur-md transition-all hover:bg-secondary hover:scale-110 active:scale-95 sm:flex"
            >
              <ChevronRight className="size-5" strokeWidth={2.5} />
            </button>
          )}

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[var(--radius-lg)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {/* Pane 1: Starter Graph (5 nodes) */}
            <div className="glass flex w-full shrink-0 snap-center flex-col justify-between rounded-[var(--radius-lg)] p-6 sm:p-9 min-h-[360px] sm:min-h-[400px]">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-tertiary">Starter · 5 nodes</span>
                <span className="text-[11px] font-mono text-tertiary">1 / 2</span>
              </div>
              <div className="my-auto flex w-full items-center justify-center py-4">
                <HeroGraph />
              </div>
              <p className="text-center text-[12px] text-tertiary">
                A five-node starter graph. Signal flows left to right, and risk always sits before
                execution.
              </p>
            </div>

            {/* Pane 2: Max Pipeline (15 nodes) */}
            <div className="glass flex w-full shrink-0 snap-center flex-col justify-between rounded-[var(--radius-lg)] p-6 sm:p-9 min-h-[360px] sm:min-h-[400px]">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-tertiary">Max · full pipeline</span>
                <span className="text-[11px] font-mono text-tertiary">2 / 2</span>
              </div>
              <div className="my-auto flex w-full items-center justify-center py-4">
                <MaxFlowGraph />
              </div>
              <p className="text-center text-[12px] text-tertiary">
                Every layer wired at once — multiple data sources, four analyst agents debating, then
                risk, portfolio, and execution in parallel.
              </p>
            </div>
          </div>
        </div>

        {/* Pagination dots */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {[0, 1].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show pane ${i + 1}`}
              onClick={() => goTo(i as 0 | 1)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                pane === i ? 'w-6 bg-foreground/80' : 'w-1.5 bg-foreground/20 hover:bg-foreground/40',
              )}
            />
          ))}
        </div>

        {/* Scroll hint - toggles based on active pane */}
        <motion.button
          type="button"
          onClick={() => goTo(pane === 0 ? 1 : 0)}
          className="mx-auto mt-3 flex items-center gap-1 text-[12px] text-tertiary transition-colors hover:text-foreground"
        >
          {pane === 0 ? (
            <>
              Click arrow or scroll to view max pipeline
              <ChevronRight className="size-3.5" strokeWidth={2} />
            </>
          ) : (
            <>
              <ChevronLeft className="size-3.5" strokeWidth={2} />
              Return to 5-node starter graph
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}
