'use client'

import { Check } from 'lucide-react'
import { PLANS } from '@/mock/data'
import { PillLink } from '@/components/ui/pill-button'
import { useReveal } from '@/lib/use-reveal'
import { cn, formatINR } from '@/lib/utils'

export function PricingTeaser() {
  const ref = useReveal<HTMLDivElement>()
  const plans = PLANS.filter((p) => p.id !== 'payg')

  return (
    <section className="bg-elevated/40 py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <div className="text-center">
          <p data-reveal className="eyebrow text-brand">
            Pricing
          </p>
          <h2
            data-reveal
            className="mx-auto mt-3 max-w-2xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
          >
            Start free. Pay when it earns its place.
          </h2>
          <p
            data-reveal
            className="mx-auto mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground"
          >
            Subscribe for higher limits, or buy credits and unlock only the components you use.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              data-reveal
              className={cn(
                'glass relative flex flex-col rounded-[var(--radius-lg)] p-7',
                plan.highlight && 'ring-1 ring-brand',
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-7 rounded-[var(--radius-pill)] bg-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{plan.name}</h3>
              <p className="mt-1.5 min-h-[2.75rem] text-[13px] leading-6 text-muted-foreground">
                {plan.blurb}
              </p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[34px] font-semibold tracking-[-0.03em]">
                  {plan.monthly === 0 ? 'Free' : formatINR(plan.monthly)}
                </span>
                {plan.monthly > 0 && (
                  <span className="text-[13px] text-muted-foreground">/ month</span>
                )}
              </p>

              <PillLink
                href="/pricing"
                variant={plan.highlight ? 'primary' : 'secondary'}
                className="mt-6 w-full"
              >
                {plan.cta}
              </PillLink>

              <ul className="mt-7 flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-profit" strokeWidth={2} />
                    <span className="text-[13px] leading-6 text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p data-reveal className="mt-8 text-center text-[13px] text-tertiary">
          Prices in INR, billed via Razorpay. Annual billing saves two months.{' '}
          <a href="/pricing" className="text-brand hover:underline">
            Compare every plan
          </a>
        </p>
      </div>
    </section>
  )
}
