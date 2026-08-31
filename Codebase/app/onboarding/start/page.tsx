'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Plus, Star, GitFork, CheckCircle2 } from 'lucide-react'
import { MARKETPLACE_PRESETS } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { useSession } from '@/lib/store'
import { PillButton } from '@/components/ui/pill-button'
import { cn } from '@/lib/utils'

export default function OnboardingStartPage() {
  const router = useRouter()
  const createBot = useWorkspace((s) => s.createBot)
  const forkPreset = useWorkspace((s) => s.forkPreset)
  const setOnboardingAnswer = useSession((s) => s.setOnboardingAnswer)

  const curatedPresets = MARKETPLACE_PRESETS.slice(0, 3)

  const [mode, setMode] = useState<'template' | 'blank'>('template')
  const [selectedPresetId, setSelectedPresetId] = useState<string>(curatedPresets[0].id)

  const handleContinue = () => {
    let botId = ''
    if (mode === 'template') {
      const preset = MARKETPLACE_PRESETS.find((p) => p.id === selectedPresetId) || curatedPresets[0]
      const forkedBot = forkPreset(preset)
      botId = forkedBot.id
      setOnboardingAnswer({ startChoice: 'template', draftBotId: botId })
    } else {
      const newBot = createBot({ name: 'My First Strategy' })
      botId = newBot.id
      setOnboardingAnswer({ startChoice: 'blank', draftBotId: botId })
    }
    router.push('/onboarding/tour')
  }

  const selectedPreset = curatedPresets.find((p) => p.id === selectedPresetId)

  return (
    <div className="flex max-w-3xl w-full flex-col gap-8 text-center animate-in fade-in duration-300">
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">
          Step 2 of 5 · Strategy Foundation
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">
          Choose how you want to start building
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Start with a battle-tested algorithmic blueprint or launch a clean canvas from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
        {/* Template Path */}
        <div
          onClick={() => setMode('template')}
          className={cn(
            'flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer',
            mode === 'template'
              ? 'border-brand bg-brand/5 shadow-lg shadow-brand/10 ring-1 ring-brand/30'
              : 'border-border bg-card/60 hover:border-border-hover hover:bg-card',
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Layers className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Start with a Template</h3>
                  <p className="text-xs text-muted-foreground">Curated, battle-tested presets</p>
                </div>
              </div>
              {mode === 'template' && <CheckCircle2 className="size-5 text-brand shrink-0" />}
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2 pt-2">
              {curatedPresets.map((preset) => {
                const isItemActive = mode === 'template' && selectedPresetId === preset.id
                return (
                  <div
                    key={preset.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMode('template')
                      setSelectedPresetId(preset.id)
                    }}
                    className={cn(
                      'rounded-xl border p-3 transition-all flex flex-col gap-1.5 cursor-pointer',
                      isItemActive
                        ? 'border-brand bg-card shadow-sm ring-1 ring-brand/20'
                        : 'border-border/60 bg-background/50 hover:bg-secondary/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {preset.name}
                      </span>
                      <span className="text-[11px] font-bold text-profit shrink-0">
                        {preset.headline.value}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {preset.tagline}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-tertiary pt-0.5">
                      <span className="flex items-center gap-1 text-gold font-medium">
                        <Star className="size-3 fill-gold text-gold" /> {preset.rating}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="size-3" /> {preset.forks} forks
                      </span>
                      <span>{preset.nodeCount} nodes</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Blank Canvas Path */}
        <div
          onClick={() => setMode('blank')}
          className={cn(
            'flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer',
            mode === 'blank'
              ? 'border-brand bg-brand/5 shadow-lg shadow-brand/10 ring-1 ring-brand/30'
              : 'border-border bg-card/60 hover:border-border-hover hover:bg-card',
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Plus className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Blank Canvas</h3>
                  <p className="text-xs text-muted-foreground">Architect from pure primitives</p>
                </div>
              </div>
              {mode === 'blank' && <CheckCircle2 className="size-5 text-brand shrink-0" />}
            </div>

            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-border bg-background/30 gap-2">
              <div className="size-12 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground">
                <Layers className="size-6" />
              </div>
              <p className="text-xs font-medium text-foreground">Clean 12-Layer Sandbox</p>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                Connect data streams, alpha generators, risk gates, and execution brokers on a clean visual workspace.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push('/onboarding/welcome')}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          &larr; Back to Experience
        </button>

        <PillButton size="lg" onClick={handleContinue} className="px-8 gap-2">
          {mode === 'template'
            ? `Continue with ${selectedPreset?.name || 'Template'} →`
            : 'Continue with Blank Canvas →'}
        </PillButton>
      </div>
    </div>
  )
}
