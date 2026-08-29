'use client'

import { Check, Sparkles } from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { TierBadge } from '@/components/ui/badge'
import { PLANS, CREDIT_BUNDLES } from '@/mock/data'
import type { PlanTier } from '@/mock/layers'
import { cn, formatINR } from '@/lib/utils'

export default function BillingPage() {
  const plan = useSession((s) => s.plan)
  const setPlan = useSession((s) => s.setPlan)
  const credits = useSession((s) => s.credits)
  const addCredits = useSession((s) => s.addCredits)

  const handleBuyCredits = (amount: number, price: number) => {
    addCredits(amount)
    toast.success('Credits Added!', `Added ${amount} simulation credits to your account for ${formatINR(price)}.`)
  }

  const handlePlanChange = (targetPlan: PlanTier) => {
    setPlan(targetPlan)
    toast.success('Plan Updated', `Your workspace is now on the ${targetPlan.toUpperCase()} plan.`)
  }

  const subscriptionPlans = PLANS.filter((p) => p.id !== 'payg')

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Subscriptions</h1>
          <p className="text-xs text-muted-foreground">
            Manage your subscription tier, simulation credits, and plan entitlements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Active Plan</span>
            <span className="text-sm font-bold capitalize text-brand">{plan} Tier</span>
          </div>
          <TierBadge tier={plan} size="lg" />
        </div>
      </div>

      {/* Credits Balance & Top-Up Bundles Card */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-card to-background p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gold/15 text-gold shrink-0">
            <Sparkles className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">Simulation Credits Balance</h2>
            <p className="text-xs text-muted-foreground max-w-md">
              Credits are consumed when running high-frequency backtests, Monte Carlo simulations, and unlocking modular layer components.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex flex-col">
            <span className="text-3xl font-extrabold font-mono text-gold tabular-nums">{credits}</span>
            <span className="text-xs text-muted-foreground">Credits Available</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CREDIT_BUNDLES.map((bundle) => (
              <button
                key={bundle.credits}
                onClick={() => handleBuyCredits(bundle.credits, bundle.price)}
                className={cn(
                  'h-9 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  bundle.popular
                    ? 'bg-gold text-black hover:opacity-90 font-bold shadow-sm'
                    : 'border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25',
                )}
                title={bundle.blurb}
              >
                +{bundle.credits} Credits ({formatINR(bundle.price)})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription Plans Matrix */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Select Subscription Plan</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((p) => {
            const isCurrent = plan === p.id
            const tierId = p.id as PlanTier

            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl border p-6 flex flex-col justify-between gap-6 transition-all',
                  isCurrent
                    ? 'border-brand bg-brand/5 ring-1 ring-brand'
                    : p.highlight
                      ? 'border-gold/40 bg-gold/[0.03]'
                      : 'border-border bg-card',
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{p.name} Tier</h3>
                    {isCurrent && (
                      <span className="text-xs font-bold text-brand bg-brand/15 px-2.5 py-0.5 rounded-full">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {p.monthly === 0 ? 'Free' : formatINR(p.monthly)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">/ month</span>
                  </div>
                  <p className="text-xs text-muted-foreground min-h-[2rem] leading-relaxed">
                    {p.blurb}
                  </p>

                  <ul className="flex flex-col gap-2 pt-3 text-xs text-muted-foreground border-t border-border">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="size-4 text-profit shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  disabled={isCurrent}
                  onClick={() => handlePlanChange(tierId)}
                  className={cn(
                    'h-10 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    isCurrent
                      ? 'border border-border text-muted-foreground bg-secondary/50 cursor-default'
                      : p.highlight
                        ? 'bg-gold text-black hover:opacity-90'
                        : 'bg-brand text-brand-foreground hover:opacity-90',
                  )}
                >
                  {isCurrent ? 'Active Plan' : `Switch to ${p.name}`}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
