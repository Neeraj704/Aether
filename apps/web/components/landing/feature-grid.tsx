'use client'

import {
  Blocks,
  GitCompareArrows,
  Layers,
  LineChart,
  ShieldCheck,
  Store,
} from 'lucide-react'
import { useReveal } from '@/lib/use-reveal'

const FEATURES = [
  {
    Icon: Blocks,
    title: 'A canvas, not a config file',
    body: 'Drag components onto an infinite grid, wire ports together, and see the whole strategy at once. Invalid connections refuse to snap, so a broken graph is hard to build by accident.',
  },
  {
    Icon: Layers,
    title: 'Twelve layers of depth',
    body: 'From raw candles through feature engineering, analysts, ML, reinforcement learning, debate, risk, execution and post-trade memory. Use two layers or all twelve.',
  },
  {
    Icon: LineChart,
    title: 'Backtests that explain themselves',
    body: 'Equity curve, drawdown, trade log, and per-layer attribution showing which nodes actually earned their keep. Same seed, same result, every time.',
  },
  {
    Icon: ShieldCheck,
    title: 'Risk sits before execution',
    body: 'Position caps, drawdown brakes, exposure limits and kill switches are structural, not optional. The canvas will not let execution run unguarded.',
  },
  {
    Icon: GitCompareArrows,
    title: 'Compare runs side by side',
    body: 'Stack up to four backtests against each other, diff their graphs, and see exactly which change moved which metric.',
  },
  {
    Icon: Store,
    title: 'A marketplace of real graphs',
    body: 'Fork community presets, read the author notes, inspect every node before you run it. Publish your own and keep 80% of what it earns.',
  },
]

export function FeatureGrid() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <p data-reveal className="eyebrow text-brand">
          Why Aether
        </p>
        <h2
          data-reveal
          className="mt-3 max-w-2xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
        >
          Everything you need to stop guessing.
        </h2>
        <p data-reveal className="mt-4 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
          The parts of a trading system that usually live in scattered notebooks, in one place where
          they can be inspected.
        </p>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <li
              key={title}
              data-reveal
              className="glass group flex flex-col gap-3 rounded-[var(--radius-md)] p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="flex size-10 items-center justify-center rounded-[11px] bg-accent text-brand">
                <Icon className="size-5" strokeWidth={1.6} />
              </span>
              <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="text-[14px] leading-6 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
