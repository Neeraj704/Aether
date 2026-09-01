'use client'

import { useReveal } from '@/lib/use-reveal'
import { FaqAccordion } from '@/components/marketing/faq-accordion'

export function Faq() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-[760px] px-5 lg:px-8">
        <p data-reveal className="eyebrow text-brand">
          Questions
        </p>
        <h2
          data-reveal
          className="mt-3 text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
        >
          The things people ask first.
        </h2>

        <div data-reveal className="mt-10">
          <FaqAccordion />
        </div>
      </div>
    </section>
  )
}
