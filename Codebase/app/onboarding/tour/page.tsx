'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/store'
import { useWorkspace, useHydrated } from '@/lib/workspace-store'
import { useBuilder } from '@/lib/builder-store'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { LibraryPanel } from '@/components/builder/library-panel'
import { LoomCanvas } from '@/components/builder/canvas'
import { Inspector } from '@/components/builder/inspector'
import { ConsolePanel } from '@/components/builder/console-panel'
import { SpotlightTour } from '@/components/onboarding/spotlight-tour'

export default function OnboardingTourPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const bots = useWorkspace((s) => s.bots)
  const draftBotId = useSession((s) => s.onboarding.draftBotId)
  const bot = bots.find((b) => b.id === draftBotId) || bots[0]
  const load = useBuilder((s) => s.load)

  useEffect(() => {
    if (bot) {
      load(bot.id, bot.graph.nodes, bot.graph.edges, bot.graph.notes, bot.graph.frames)
    }
  }, [bot, load])

  if (!hydrated || !bot) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground animate-pulse">
        Initializing interactive builder tour...
      </div>
    )
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden">
      {/* Real builder underneath */}
      <BuilderToolbar
        bot={bot}
        onRename={() => {}}
        onSave={() => {}}
        onValidate={() => {}}
      />

      <div className="flex min-h-0 flex-1">
        <LibraryPanel onUnlockRequest={() => {}} />

        <div className="flex min-w-0 flex-1 flex-col">
          <LoomCanvas onRequestUnlock={() => {}} />
          <ConsolePanel onJump={() => {}} />
        </div>

        <Inspector onUnlockRequest={() => {}} onSaveBlock={() => {}} />
      </div>

      {/* Spotlight Tour Overlay */}
      <SpotlightTour
        onComplete={() => router.push('/onboarding/first-node')}
        onSkip={() => router.push('/onboarding/first-node')}
      />
    </div>
  )
}
