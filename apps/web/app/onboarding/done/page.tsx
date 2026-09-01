'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { LineChart, PartyPopper } from 'lucide-react'
import { useSession } from '@/lib/store'
import { useWorkspace } from '@/lib/workspace-store'
import { PillButton } from '@/components/ui/pill-button'

export default function OnboardingDonePage() {
  const router = useRouter()
  const setOnboardingComplete = useSession((s) => s.setOnboardingComplete)
  const draftBotId = useSession((s) => s.onboarding.draftBotId)
  const bots = useWorkspace((s) => s.bots)
  const bot = bots.find((b) => b.id === draftBotId) || bots[0]

  const handleLaunchBacktest = () => {
    setOnboardingComplete(true)
    if (bot) {
      router.push(`/app/bots/${bot.id}/backtest`)
    } else {
      router.push('/app')
    }
  }

  // Generate lightweight confetti particles
  const particles = Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    x: (i % 6) * 35 - 90 + (Math.random() * 30 - 15),
    y: Math.floor(i / 6) * -30 - 20,
    color: ['#2997ff', '#00b8c4', '#ff6ac1', '#f5a623', '#2fd058'][i % 5],
    size: Math.random() * 6 + 4,
    rotation: Math.random() * 360,
  }))

  return (
    <div className="relative flex max-w-xl w-full flex-col items-center gap-8 text-center animate-in fade-in duration-300">
      {/* Confetti Elements */}
      <div className="pointer-events-none absolute -top-12 inset-x-0 flex justify-center" aria-hidden>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 1, y: 0, x: 0, scale: 0.5, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              y: [0, p.y - 80, 220],
              x: [0, p.x * 1.8, p.x * 2.4],
              scale: [0.5, 1.2, 0.8],
              rotate: [0, p.rotation + 180, p.rotation + 360],
            }}
            transition={{
              duration: 2.2,
              ease: 'easeOut',
              delay: (p.id % 6) * 0.05,
            }}
            style={{
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.id % 2 === 0 ? '50%' : '2px',
            }}
            className="absolute"
          />
        ))}
      </div>

      <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand/20 via-brand/10 to-transparent border border-brand/40 shadow-xl shadow-brand/15 text-brand">
        <PartyPopper className="size-10 text-brand" />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">
          Step 5 of 5 · All Systems Ready
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Your trading bot is ready
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          You have built your visual strategy framework. Let&apos;s run your first historical simulation to inspect profit factor, Sharpe ratio, and drawdowns.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 max-w-md w-full flex items-center justify-between text-left">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Strategy Bot</span>
          <span className="text-sm font-bold text-foreground truncate">{bot ? bot.name : 'My First Strategy'}</span>
        </div>
        <span className="text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20">
          {bot ? `${bot.graph.nodes.length} Nodes Wired` : 'Ready'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <PillButton
          size="lg"
          onClick={handleLaunchBacktest}
          className="w-full sm:w-auto px-8 gap-2 shadow-lg shadow-brand/25"
        >
          <LineChart className="size-4" /> Run First Backtest &rarr;
        </PillButton>
        <button
          type="button"
          onClick={() => {
            setOnboardingComplete(true)
            router.push('/app')
          }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-2 cursor-pointer"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
