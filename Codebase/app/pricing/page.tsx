'use client'

import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { PLANS, PLAN_COMPARISON } from '@/mock/data'
import { PillLink } from '@/components/ui/pill-button'
import { Segmented } from '@/components/ui/tabs'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { FaqAccordion } from '@/components/marketing/faq-accordion'
import { cn, formatINR } from '@/lib/utils'

export default function PricingPage() {
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')

  const subscriptionPlans = PLANS.filter((p) => p.id !== 'payg')
  const paygPlan = PLANS.find((p) => p.id === 'payg')

  return (
    <>
      <SiteNav />
      <main className="pt-28 pb-20 px-5 sm:px-8 max-w-[1200px] mx-auto flex flex-col gap-16">
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-4 max-w-3xl mx-auto">
          <span className="eyebrow text-brand">Transparent Pricing</span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">
            Start free. Pay when it earns its place.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl text-pretty">
            Subscribe for higher limits, or buy credits and unlock only the components you use. All plans include full historical backtesting.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-4 flex items-center gap-3">
            <Segmented<'monthly' | 'annual'>
              value={interval}
              onValueChange={setInterval}
              options={[
                { value: 'monthly', label: 'Monthly billing' },
                { value: 'annual', label: 'Annual billing (Save ~17%)' },
              ]}
            />
          </div>
        </div>

        {/* Main 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {subscriptionPlans.map((plan) => {
            const price =
              interval === 'annual' && plan.annual > 0
                ? Math.round(plan.annual / 12)
                : plan.monthly

            return (
              <div
                key={plan.id}
                className={cn(
                  'glass relative flex flex-col justify-between rounded-[var(--radius-lg)] p-7 border border-border transition-transform duration-200 hover:-translate-y-1',
                  plan.highlight && 'ring-2 ring-brand border-brand/40 bg-brand/[0.03]',
                )}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-0.5 text-[11px] font-semibold text-brand-foreground shadow-sm">
                    Most popular
                  </span>
                )}

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground min-h-[2.25rem] leading-relaxed">
                      {plan.blurb}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 pt-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {price === 0 ? 'Free' : formatINR(price)}
                      </span>
                      {price > 0 && (
                        <span className="text-xs text-muted-foreground font-normal">/ month</span>
                      )}
                    </div>
                    {interval === 'annual' && plan.annual > 0 && (
                      <span className="text-[11px] text-tertiary">
                        {formatINR(plan.annual)} billed annually
                      </span>
                    )}
                  </div>

                  <PillLink
                    href="/signup"
                    variant={plan.highlight ? 'primary' : 'secondary'}
                    className="w-full justify-center mt-2"
                  >
                    {plan.cta}
                  </PillLink>

                  <div className="border-t border-border pt-5 mt-2 flex flex-col gap-3">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider text-[11px]">
                      Features included:
                    </span>
                    <ul className="flex flex-col gap-2.5 text-xs text-muted-foreground">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5">
                          <Check className="size-4 shrink-0 text-profit mt-0.5" strokeWidth={2} />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pay-as-you-go Option */}
        {paygPlan && (
          <div className="glass rounded-[var(--radius-lg)] p-6 sm:p-8 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-wider text-gold">
                  Alternative Model
                </span>
              </div>
              <h3 className="text-xl font-bold">{paygPlan.name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {paygPlan.blurb}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
                {paygPlan.features.map((feat) => (
                  <span key={feat} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-gold shrink-0" />
                    {feat}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 w-full md:w-auto">
              <PillLink href="/signup" variant="secondary" className="w-full sm:w-auto justify-center">
                {paygPlan.cta} &rarr;
              </PillLink>
            </div>
          </div>
        )}

        {/* Detailed Plan Comparison Table */}
        <div className="flex flex-col gap-6 pt-6">
          <div className="text-center flex flex-col items-center gap-2">
            <span className="eyebrow text-brand">Comparison</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Compare features side by side
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg">
              Detailed breakdown of node limits, historical depth, layer access, and execution modes across tiers.
            </p>
          </div>

          <div className="glass rounded-2xl border border-border overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH className="w-1/3 min-w-[200px]">Feature</TH>
                  <TH className="w-1/6 min-w-[120px] text-center">Free</TH>
                  <TH className="w-1/6 min-w-[120px] text-center">Starter</TH>
                  <TH className="w-1/6 min-w-[120px] text-center font-bold text-foreground">Pro</TH>
                  <TH className="w-1/6 min-w-[120px] text-center">Pay-as-you-go</TH>
                </TR>
              </THead>
              <TBody>
                {PLAN_COMPARISON.map((group) => (
                  <>
                    <TR key={group.group} className="bg-secondary/40 font-semibold">
                      <TD colSpan={5} className="py-2.5 text-xs text-foreground uppercase tracking-wider font-bold">
                        {group.group}
                      </TD>
                    </TR>
                    {group.rows.map((row) => (
                      <TR key={row.label}>
                        <TD className="text-xs font-medium text-foreground">{row.label}</TD>
                        <TD className="text-center text-xs">
                          {typeof row.free === 'boolean' ? (
                            row.free ? (
                              <Check className="size-4 text-profit mx-auto" />
                            ) : (
                              <span className="text-tertiary">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{row.free || '—'}</span>
                          )}
                        </TD>
                        <TD className="text-center text-xs">
                          {typeof row.starter === 'boolean' ? (
                            row.starter ? (
                              <Check className="size-4 text-profit mx-auto" />
                            ) : (
                              <span className="text-tertiary">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{row.starter || '—'}</span>
                          )}
                        </TD>
                        <TD className="text-center text-xs font-semibold">
                          {typeof row.pro === 'boolean' ? (
                            row.pro ? (
                              <Check className="size-4 text-gold mx-auto" />
                            ) : (
                              <span className="text-tertiary">—</span>
                            )
                          ) : (
                            <span className="text-foreground">{row.pro || '—'}</span>
                          )}
                        </TD>
                        <TD className="text-center text-xs">
                          {typeof row.payg === 'boolean' ? (
                            row.payg ? (
                              <Check className="size-4 text-brand mx-auto" />
                            ) : (
                              <span className="text-tertiary">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">{row.payg || '—'}</span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </>
                ))}
              </TBody>
            </Table>
          </div>
        </div>

        {/* FAQs */}
        <div className="flex flex-col gap-6 pt-10 max-w-[800px] mx-auto w-full">
          <div className="text-center flex flex-col items-center gap-2">
            <span className="eyebrow text-brand">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
          </div>
          <div className="mt-4">
            <FaqAccordion />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
