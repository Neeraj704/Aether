'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { useWorkspace } from '@/lib/workspace-store'
import { TierBadge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { PLANS } from '@/mock/data'
import type { PlanTier } from '@/mock/layers'
import { BillingNav } from '@/components/billing/billing-nav'
import { PlanComparisonMatrix } from '@/components/billing/plan-comparison'
import { cn, formatINR } from '@/lib/utils'

export default function BillingPlansPage() {
  const plan = useSession((s) => s.plan)
  const setPlan = useSession((s) => s.setPlan)
  const pushActivity = useWorkspace((s) => s.pushActivity)
  const pushNotification = useWorkspace((s) => s.pushNotification)

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const handlePlanChange = (targetPlan: PlanTier) => {
    setPlan(targetPlan)
    pushActivity({
      kind: 'payment',
      title: `Switched plan to ${targetPlan.toUpperCase()}`,
      detail: `Workspace subscription updated to ${targetPlan} tier`,
      href: '/app/billing',
    })
    pushNotification({
      kind: 'payment',
      title: `Plan upgraded · ${targetPlan.toUpperCase()}`,
      body: `Your workspace subscription has been updated to ${targetPlan.toUpperCase()}.`,
      href: '/app/billing',
    })
    toast.success('Plan Updated', `Your workspace is now on the ${targetPlan.toUpperCase()} plan.`)
  }

  const subscriptionPlans = PLANS.filter((p) => p.id !== 'payg')

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your subscription tier, simulation quotas, and plan entitlements
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

      {/* Subpage Nav */}
      <BillingNav />

      {/* Subscription Plans Grid */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Workspace Subscription Tiers</h2>
            <p className="text-xs text-muted-foreground">Upgrade for higher node limits, unlimited backtests, and multi-agent debates.</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                billingCycle === 'monthly' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1',
                billingCycle === 'annual' ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Annual Billing <span className="text-[10px] text-profit font-bold">(-20%)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((p) => {
            const isCurrent = plan === p.id
            const price = billingCycle === 'annual' ? Math.round(p.annual / 12) : p.monthly

            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col justify-between rounded-2xl border p-6 transition-all relative',
                  p.id === 'pro'
                    ? 'border-brand/60 bg-gradient-to-b from-brand/10 via-card to-card shadow-xl shadow-brand/10'
                    : 'border-border bg-card',
                  isCurrent && 'ring-2 ring-brand',
                )}
              >
                {p.id === 'pro' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-[11px] font-bold text-brand-foreground uppercase tracking-wider">
                    Most Popular
                  </span>
                )}

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <TierBadge tier={p.id as PlanTier} />
                  </div>
                  <p className="text-xs text-muted-foreground min-h-8">{p.blurb}</p>

                  <div className="flex items-baseline gap-1 pt-2">
                    <span className="text-3xl font-extrabold">{price === 0 ? 'Free' : formatINR(price)}</span>
                    {price > 0 && <span className="text-xs text-muted-foreground">/ month</span>}
                  </div>

                  <div className="flex flex-col gap-2.5 pt-4 border-t border-border">
                    {p.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs">
                        <Check className="size-3.5 text-profit shrink-0" />
                        <span className="text-foreground/90">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4">
                  {isCurrent ? (
                    <div className="w-full py-2.5 text-center text-xs font-bold text-profit border border-profit/30 bg-profit/10 rounded-xl">
                      ✓ Current Active Plan
                    </div>
                  ) : (
                    <PillButton
                      onClick={() => handlePlanChange(p.id as PlanTier)}
                      variant={p.id === 'pro' ? 'primary' : 'secondary'}
                      className="w-full justify-center"
                    >
                      {p.id === 'free' ? 'Downgrade to Free' : `Upgrade to ${p.name}`}
                    </PillButton>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan Comparison Breakdown */}
      <PlanComparisonMatrix />
    </div>
  )
}
