'use client'

import Link from 'next/link'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { Check, Sparkles } from 'lucide-react'
import { PillLink } from '@/components/ui/pill-button'

export default function PricingPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[1200px] mx-auto flex flex-col gap-12">
        <div className="text-center flex flex-col items-center gap-4 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">Transparent Pricing</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Build, test & run visual trading bots
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Start for free on our baseline layers. Upgrade to unlock advanced ML forecasts, reinforcement learning sizing, and live venue execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold">Free Tier</h3>
              <div className="text-4xl font-extrabold">₹0 <span className="text-sm font-normal text-muted-foreground">/ mo</span></div>
              <p className="text-xs text-muted-foreground">Perfect for exploring the 12-layer visual builder concept.</p>

              <div className="border-t border-border pt-4 flex flex-col gap-3 text-xs">
                <span className="font-bold text-foreground">Included:</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> Layer I & II Free Nodes</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> 5 Active Bots</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> 50 Simulation Credits</span>
              </div>
            </div>

            <PillLink href="/signup" variant="secondary" className="w-full text-center">
              Start Free
            </PillLink>
          </div>

          {/* Starter Tier */}
          <div className="rounded-2xl border border-brand bg-brand/10 p-8 flex flex-col justify-between gap-8 relative">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Starter Tier</h3>
                <span className="text-xs font-bold text-brand bg-brand/20 px-3 py-1 rounded-full">Popular</span>
              </div>
              <div className="text-4xl font-extrabold">₹2,999 <span className="text-sm font-normal text-muted-foreground">/ mo</span></div>
              <p className="text-xs text-muted-foreground">For active traders running multi-agent debate strategies.</p>

              <div className="border-t border-border pt-4 flex flex-col gap-3 text-xs">
                <span className="font-bold text-foreground">Everything in Free plus:</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> Starter Layer Components</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> Debate & Sentiment Layer</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> 25 Active Bots</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-profit" /> 250 Simulation Credits</span>
              </div>
            </div>

            <PillLink href="/signup" className="w-full text-center">
              Get Started with Starter
            </PillLink>
          </div>

          {/* Pro Tier */}
          <div className="rounded-2xl border border-gold/40 bg-gold/5 p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-gold">Pro Tier</h3>
              <div className="text-4xl font-extrabold">₹9,999 <span className="text-sm font-normal text-muted-foreground">/ mo</span></div>
              <p className="text-xs text-muted-foreground">Complete quant infrastructure with full 12-layer access.</p>

              <div className="border-t border-border pt-4 flex flex-col gap-3 text-xs">
                <span className="font-bold text-foreground">Everything in Starter plus:</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-gold" /> ALL 12 Layers Unlocked</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-gold" /> RL Policy Trainer & Microstructure</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-gold" /> Unlimited Active Bots</span>
                <span className="flex items-center gap-2"><Check className="size-4 text-gold" /> 1,000 Simulation Credits</span>
              </div>
            </div>

            <PillLink href="/signup" variant="secondary" className="w-full text-center border-gold/50 text-gold hover:bg-gold/10">
              Upgrade to Pro
            </PillLink>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
