'use client'

import { useEffect, useRef, useState } from 'react'
import { MousePointerClick, Play, Rocket, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ensureGsap, gsap, prefersReducedMotion } from '@/lib/use-reveal'

const STEPS = [
  {
    Icon: MousePointerClick,
    kicker: 'Assemble',
    title: 'Drop in the layers you need',
    body: 'Start from a blank canvas or fork a preset. Pull a data feed, a couple of analysts, a risk gate and an executor onto the grid. Ports only connect where the types match, so the graph stays coherent as it grows.',
  },
  {
    Icon: Wrench,
    kicker: 'Configure',
    title: 'Tune every node in the inspector',
    body: 'Select any node to open its parameters  lookback windows, confidence thresholds, position caps, model choice. Defaults are sane, and every field explains what it does and what it costs you.',
  },
  {
    Icon: Play,
    kicker: 'Backtest',
    title: 'Run it against real history',
    body: 'Pick a period, a symbol set and a starting balance. Get an equity curve, drawdown profile, full trade log and per-layer attribution telling you which nodes actually contributed.',
  },
  {
    Icon: Rocket,
    kicker: 'Deploy',
    title: 'Go live on paper first',
    body: 'Promote a bot to paper trading and watch it work on live data with simulated fills. Real capital is a separate, deliberate step behind its own wall of confirmations.',
  },
]

export function HowItWorks() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || prefersReducedMotion()) return
    // Pinning below `lg` fights mobile scroll momentum, so it stays desktop-only.
    if (!window.matchMedia('(min-width: 1024px)').matches) return

    ensureGsap()
    const ctx = gsap.context(() => {
      ScrollTriggerCreate(el, setActive)
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section className="bg-elevated/40 py-20 sm:py-28">
      <div className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <p className="eyebrow text-brand">How it works</p>
        <h2 className="mt-3 max-w-2xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
          Four steps from idea to a bot you trust.
        </h2>

        <div ref={wrapRef} className="mt-14 lg:grid lg:grid-cols-[1fr_260px] lg:items-start lg:gap-12">
          <ol className="flex flex-col gap-4 lg:gap-0">
            {STEPS.map((s, i) => (
              <li
                key={s.kicker}
                data-step={i}
                className={cn(
                  'glass rounded-[var(--radius-md)] p-6 transition-opacity duration-500 lg:mb-6 lg:p-8',
                  'lg:opacity-40 lg:data-[current=true]:opacity-100',
                )}
                data-current={active === i}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-brand">
                    <s.Icon className="size-[18px]" strokeWidth={1.6} />
                  </span>
                  <span className="eyebrow text-tertiary">
                    Step {i + 1} · {s.kicker}
                  </span>
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.015em]">{s.title}</h3>
                <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>

          {/* Progress rail  pinned alongside the steps on desktop. */}
          <aside className="hidden lg:block">
            <div data-rail className="sticky top-32">
              <div className="glass rounded-[var(--radius-md)] p-6">
                <p className="eyebrow text-tertiary">Progress</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {STEPS.map((s, i) => (
                    <li key={s.kicker} className="flex items-center gap-3">
                      <span
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors duration-500',
                          i <= active ? 'bg-brand' : 'bg-border',
                        )}
                      />
                      <span
                        className={cn(
                          'w-24 shrink-0 text-right text-[12px] font-medium transition-colors duration-500',
                          i === active ? 'text-foreground' : 'text-tertiary',
                        )}
                      >
                        {s.kicker}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

/**
 * One trigger per step card, each flipping the active index as it crosses the
 * middle of the viewport. Kept outside the component so the effect stays legible.
 */
function ScrollTriggerCreate(root: HTMLElement, setActive: (i: number) => void) {
  const cards = root.querySelectorAll<HTMLElement>('[data-step]')
  cards.forEach((card, i) => {
    gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: 'top 62%',
        end: 'bottom 38%',
        onEnter: () => setActive(i),
        onEnterBack: () => setActive(i),
      },
    })
  })
}
