'use client'

import { useState } from 'react'
import {
  CreditCard,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Building,
  ArrowUpRight,
} from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { TierBadge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'

export default function BillingPage() {
  const plan = useSession((s) => s.plan)
  const setPlan = useSession((s) => s.setPlan)
  const credits = useSession((s) => s.credits)
  const addCredits = useSession((s) => s.addCredits)

  const handleBuyCredits = (amount: number, cost: string) => {
    addCredits(amount)
    toast.success('Credits Added!', `Added ${amount} simulation credits to your account.`)
  }

  const handlePlanChange = (targetPlan: 'free' | 'starter' | 'pro') => {
    setPlan(targetPlan)
    toast.success('Plan Updated', `Your workspace is now on the ${targetPlan.toUpperCase()} plan.`)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Subscriptions</h1>
          <p className="text-xs text-muted-foreground">
            Manage your subscription tier, simulation credits, and payment methods
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

      {/* Credits Card */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-card to-background p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gold/15 text-gold">
            <Sparkles className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold">Simulation Credits Balance</h2>
            <p className="text-xs text-muted-foreground max-w-md">
              Credits are consumed when running high-frequency backtests, Monte Carlo simulations, and RL policy training loops.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col text-right sm:text-left">
            <span className="text-3xl font-extrabold font-mono text-gold">{credits}</span>
            <span className="text-xs text-muted-foreground">Credits Available</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBuyCredits(100, '₹499')}
              className="h-9 px-3.5 rounded-lg border border-gold/40 bg-gold/15 text-xs font-semibold text-gold hover:bg-gold/25 transition-colors"
            >
              +100 Credits (₹499)
            </button>
            <button
              onClick={() => handleBuyCredits(500, '₹1,999')}
              className="h-9 px-3.5 rounded-lg bg-gold text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              +500 Credits (₹1,999)
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Plans Matrix */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Select Subscription Plan</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between gap-6 ${
            plan === 'free' ? 'border-brand bg-brand/5' : 'border-border bg-card'
          }`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Free Tier</h3>
                {plan === 'free' && <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-full">Current Plan</span>}
              </div>
              <div className="text-3xl font-extrabold">₹0 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              <p className="text-xs text-muted-foreground">For learning visual bot building and standard backtesting.</p>

              <ul className="flex flex-col gap-2 pt-4 text-xs">
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> Layer I & II Free Components</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> 5 Active Bots</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> 50 Simulation Credits / mo</li>
              </ul>
            </div>

            <button
              disabled={plan === 'free'}
              onClick={() => handlePlanChange('free')}
              className={`h-10 rounded-lg text-xs font-bold transition-all ${
                plan === 'free'
                  ? 'border border-border text-muted-foreground cursor-default'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {plan === 'free' ? 'Active Plan' : 'Downgrade to Free'}
            </button>
          </div>

          {/* Starter Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between gap-6 ${
            plan === 'starter' ? 'border-brand bg-brand/5' : 'border-border bg-card'
          }`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Starter Tier</h3>
                {plan === 'starter' && <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-full">Current Plan</span>}
              </div>
              <div className="text-3xl font-extrabold">₹2,999 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              <p className="text-xs text-muted-foreground">For active retail traders deploying multi-agent setups.</p>

              <ul className="flex flex-col gap-2 pt-4 text-xs">
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> Starter & Free Layer Components</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> 25 Active Bots</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> 250 Simulation Credits / mo</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-profit" /> Debate & Sentiment Layer</li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanChange('starter')}
              className={`h-10 rounded-lg text-xs font-bold transition-all ${
                plan === 'starter'
                  ? 'border border-border text-muted-foreground cursor-default'
                  : 'bg-brand text-brand-foreground hover:opacity-90'
              }`}
            >
              {plan === 'starter' ? 'Active Plan' : 'Upgrade to Starter'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`rounded-xl border p-6 flex flex-col justify-between gap-6 relative overflow-hidden ${
            plan === 'pro' ? 'border-gold bg-gold/5' : 'border-border bg-card'
          }`}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gold">Pro Tier</h3>
                {plan === 'pro' && <span className="text-xs font-bold text-gold bg-gold/15 px-2.5 py-1 rounded-full">Current Plan</span>}
              </div>
              <div className="text-3xl font-extrabold">₹9,999 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
              <p className="text-xs text-muted-foreground">Full suite for institutional quants & high-frequency bots.</p>

              <ul className="flex flex-col gap-2 pt-4 text-xs">
                <li className="flex items-center gap-2"><Check className="size-4 text-gold" /> ALL 12 Layers Unlocked</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-gold" /> Unlimited Active Bots</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-gold" /> 1,000 Simulation Credits / mo</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-gold" /> RL Policy Training & Microstructure</li>
              </ul>
            </div>

            <button
              onClick={() => handlePlanChange('pro')}
              className={`h-10 rounded-lg text-xs font-bold transition-all ${
                plan === 'pro'
                  ? 'border border-gold/40 text-gold cursor-default'
                  : 'bg-gold text-black hover:opacity-90'
              }`}
            >
              {plan === 'pro' ? 'Active Plan' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
