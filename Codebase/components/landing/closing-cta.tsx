'use client'

import { ArrowRight } from 'lucide-react'
import { PillLink } from '@/components/ui/pill-button'
import { useReveal } from '@/lib/use-reveal'

const ASSURANCES = ['No card required', 'Paper trading by default', 'Cancel anytime']

export function ClosingCta() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[120px]"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--brand) 34%, transparent), transparent)',
        }}
      />

      <div ref={ref} className="relative mx-auto max-w-[760px] px-5 text-center lg:px-8">
        <p data-reveal className="eyebrow text-brand">
          Start building
        </p>
        <h2
          data-reveal
          className="mt-3 text-balance text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.035em]"
        >
          Your strategy deserves better than a spreadsheet.
        </h2>
        <p
          data-reveal
          className="mx-auto mt-5 max-w-[520px] text-pretty text-[17px] leading-relaxed text-muted-foreground"
        >
          Compose twelve layers of logic, backtest against a decade of ticks, and deploy to paper in
          the same afternoon.
        </p>

        <div data-reveal className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PillLink href="/builder" size="lg">
            Open the builder
            <ArrowRight className="size-4" strokeWidth={2} />
          </PillLink>
          <PillLink href="/marketplace" size="lg" variant="secondary">
            Browse strategies
          </PillLink>
        </div>

        <ul
          data-reveal
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground"
        >
          {ASSURANCES.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
