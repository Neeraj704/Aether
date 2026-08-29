'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, MousePointerClick, ChevronRight } from 'lucide-react'
import { useSession } from '@/lib/store'
import { useWorkspace, useHydrated } from '@/lib/workspace-store'
import { useBuilder } from '@/lib/builder-store'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { LibraryPanel } from '@/components/builder/library-panel'
import { LoomCanvas } from '@/components/builder/canvas'
import { Inspector } from '@/components/builder/inspector'
import { ConsolePanel } from '@/components/builder/console-panel'
import { PillButton } from '@/components/ui/pill-button'

export default function OnboardingFirstNodePage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const bots = useWorkspace((s) => s.bots)
  const draftBotId = useSession((s) => s.onboarding.draftBotId)
  const bot = bots.find((b) => b.id === draftBotId) || bots[0]
  const load = useBuilder((s) => s.load)
  const nodes = useBuilder((s) => s.nodes)

  const initialCountRef = useRef<number | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (bot) {
      load(bot.id, bot.nodes, bot.edges, bot.notes, bot.frames)
    }
  }, [bot, load])

  useEffect(() => {
    if (initialCountRef.current === null && nodes.length >= 0) {
      initialCountRef.current = nodes.length
    } else if (initialCountRef.current !== null && nodes.length > initialCountRef.current && !completed) {
      setCompleted(true)
      const t = setTimeout(() => {
        router.push('/onboarding/done')
      }, 600)
      return () => clearTimeout(t)
    }
  }, [nodes.length, completed, router])

  if (!hydrated || !bot) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground animate-pulse">
        Preparing canvas sandbox...
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

      {/* Instruction Overlay Card pinned near Library panel */}
      <div className="pointer-events-none fixed top-24 left-72 z-50 flex max-w-sm flex-col gap-3 rounded-2xl border border-brand/50 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <Sparkles className="size-4 animate-bounce" /> Interactive Challenge
        </div>
        <h3 className="text-base font-bold text-foreground">
          Drag a Data Source onto the canvas
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          From Layer I (Data Feeds) in the left panel, grab an <strong className="text-foreground">OHLCV Candle Stream</strong> or <strong className="text-foreground">NSE Level 2</strong> block and drag it onto the grid.
        </p>

        {completed ? (
          <div className="flex items-center gap-2 rounded-lg bg-profit/10 border border-profit/30 p-2.5 text-xs font-semibold text-profit">
            <Sparkles className="size-3.5" /> Node placed! Advancing to final step...
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3 pointer-events-auto">
            <button
              type="button"
              onClick={() => router.push('/onboarding/done')}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Skip this step &rarr;
            </button>
            <PillButton
              size="sm"
              onClick={() => router.push('/onboarding/done')}
              className="gap-1 shadow-sm"
            >
              Done <ChevronRight className="size-3.5" />
            </PillButton>
          </div>
        )}
      </div>
    </div>
  )
}
