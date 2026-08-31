'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Sliders, Zap, CheckCircle2 } from 'lucide-react'
import { useSession } from '@/lib/store'
import { PillButton } from '@/components/ui/pill-button'
import { cn } from '@/lib/utils'

type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'

const LEVELS: Array<{
  id: ExperienceLevel
  title: string
  tagline: string
  description: string
  icon: typeof Sparkles
}> = [
  {
    id: 'beginner',
    title: 'Beginner Trader',
    tagline: 'Streamlined & Guided',
    description: "We'll highlight the settings that matter most for your level with clean, intuitive defaults.",
    icon: Sparkles,
  },
  {
    id: 'intermediate',
    title: 'Algorithmic Practitioner',
    tagline: 'Balanced Power',
    description: 'Direct visual graph workflows with standard technical indicators, risk gates, and backtest tuning.',
    icon: Sliders,
  },
  {
    id: 'advanced',
    title: 'Quantitative Engineer',
    tagline: 'Deep Customization',
    description: 'Full exposure to raw parameter matrices, Monte Carlo distributions, slippage models, and multi-agent debate nodes.',
    icon: Zap,
  },
]

export default function OnboardingWelcomePage() {
  const router = useRouter()
  const onboarding = useSession((s) => s.onboarding)
  const setOnboardingAnswer = useSession((s) => s.setOnboardingAnswer)

  const [selected, setSelected] = useState<ExperienceLevel | null>(onboarding.experience || null)

  const handleSelect = (lvl: ExperienceLevel) => {
    setSelected(lvl)
    setOnboardingAnswer({ experience: lvl })
  }

  const handleContinue = () => {
    if (!selected) return
    setOnboardingAnswer({ experience: selected })
    router.push('/onboarding/start')
  }

  return (
    <div className="flex max-w-2xl w-full flex-col gap-8 text-center animate-in fade-in duration-300">
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">
          Step 1 of 5 · Experience Profile
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
          How would you describe your quant background?
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          We tailor your strategy builder workspace and inspector depth to match your preferred level of precision.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 text-left">
        {LEVELS.map((lvl) => {
          const Icon = lvl.icon
          const isSelected = selected === lvl.id

          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => handleSelect(lvl.id)}
              className={cn(
                'group relative flex items-start gap-4 rounded-2xl border p-5 transition-all cursor-pointer',
                isSelected
                  ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10 ring-1 ring-brand/30'
                  : 'border-border bg-card/60 hover:border-border-hover hover:bg-card',
              )}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isSelected ? 'bg-brand text-brand-foreground' : 'bg-secondary text-muted-foreground group-hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
              </div>

              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">{lvl.title}</h3>
                    <span className="text-[11px] font-medium text-brand">{lvl.tagline}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="size-5 text-brand shrink-0" />}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{lvl.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <PillButton
          size="lg"
          onClick={handleContinue}
          disabled={!selected}
          className="w-full sm:w-auto px-8 gap-2"
        >
          Continue to Strategy Start &rarr;
        </PillButton>
      </div>
    </div>
  )
}
