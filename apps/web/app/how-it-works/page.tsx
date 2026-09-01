'use client'

import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { LAYERS } from '@/mock/layers'
import { PillLink } from '@/components/ui/pill-button'

export default function HowItWorksPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[1200px] mx-auto flex flex-col gap-12">
        <div className="text-center flex flex-col items-center gap-4 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-brand">12-Layer Architecture</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            How Aether powers systematic trading
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            From raw exchange feeds to reinforcement learning, every node sits in a structured layer designed to enforce risk limits and eliminate common quant errors.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LAYERS.map((layer) => (
            <div key={layer.id} className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-secondary text-brand">
                  Layer {layer.roman}
                </span>
                <span className="size-3 rounded-full" style={{ backgroundColor: layer.hue }} />
              </div>
              <h3 className="text-lg font-bold">{layer.name}</h3>
              <p className="text-xs text-foreground font-medium">{layer.short}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{layer.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center pt-8">
          <PillLink href="/app" size="lg">
            Try the Visual Builder Now
          </PillLink>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
