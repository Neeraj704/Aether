'use client'

import { motion } from 'motion/react'
import { ArrowRight, Play } from 'lucide-react'
import { PillLink } from '@/components/ui/pill-button'
import { FlowSplit } from '@/components/landing/flow-split'
import { EASE_AETHER } from '@/lib/utils'

const HEADLINE = ['Assemble', 'a', 'trading', 'agent', 'the', 'way', 'you', 'think.']

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      {/* Aurora wash  the one place the brand gradient runs at full strength. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18%] size-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_22%,transparent),transparent_62%)] blur-[90px]" />
        <div className="absolute left-[12%] top-[24%] size-[26rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-2)_16%,transparent),transparent_65%)] blur-[80px]" />
        <div className="absolute right-[8%] top-[8%] size-[24rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-3)_14%,transparent),transparent_65%)] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_AETHER }}
          className="mx-auto flex max-w-fit items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-secondary/60 px-3.5 py-1.5 backdrop-blur-xl"
        >
          <span className="size-1.5 rounded-full bg-profit shadow-[0_0_0_3px_color-mix(in_oklab,var(--profit)_22%,transparent)]" />
          <span className="text-[12px] font-medium text-muted-foreground">
            12 layers · 60+ components · no code
          </span>
        </motion.div>

        <h1 className="mx-auto mt-7 max-w-4xl text-balance text-center text-[clamp(2.5rem,7vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.85, delay: 0.08 + i * 0.055, ease: EASE_AETHER }}
              className="mr-[0.28em] inline-block"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55, ease: EASE_AETHER }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-center text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]"
        >
          Aether is a visual workbench for algorithmic strategies. Drag layers onto a canvas  data,
          features, analysts, debate, risk, execution  then backtest the whole graph before a single
          rupee is at stake.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.68, ease: EASE_AETHER }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <PillLink href="/signup" size="lg" className="w-full sm:w-auto">
            Start building free
            <ArrowRight className="size-[18px]" strokeWidth={1.75} />
          </PillLink>
          <PillLink href="/how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
            <Play className="size-[15px]" strokeWidth={2} />
            See how it works
          </PillLink>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-4 text-center text-[13px] text-tertiary"
        >
          Free forever on paper trading. No card required.
        </motion.p>

        <FlowSplit />
      </div>
    </section>
  )
}
