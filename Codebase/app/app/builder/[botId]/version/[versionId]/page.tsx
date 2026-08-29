'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  History,
  RotateCcw,
  Clock,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react'
import { useBot, useWorkspace, useHydrated } from '@/lib/workspace-store'
import { useBuilder } from '@/lib/builder-store'
import { toast } from '@/lib/store'
import { PillButton } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoomCanvas } from '@/components/builder/canvas'
import { formatDate } from '@/lib/utils'

export default function VersionRestorePage() {
  const { botId, versionId } = useParams<{ botId: string; versionId: string }>()
  const router = useRouter()
  const hydrated = useHydrated()
  const bot = useBot(botId)
  const { saveGraph, snapshotVersion } = useWorkspace()
  const load = useBuilder((s) => s.load)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const version = bot?.versions.find((v) => v.id === versionId)

  useEffect(() => {
    if (version && bot) {
      const nodes = version.nodes || bot.nodes
      const edges = version.edges || bot.edges
      load(bot.id, nodes, edges, bot.notes, bot.frames)
    }
  }, [version, bot, load])

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading snapshot preview...
      </div>
    )
  }

  if (!bot || !version) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <History className="size-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">Version snapshot not found</h2>
        <p className="text-xs text-muted-foreground">This revision may have been pruned or does not exist.</p>
        <PillButton onClick={() => router.push(`/app/builder/${botId}`)}>
          &larr; Back to Builder
        </PillButton>
      </div>
    )
  }

  const handleRestore = () => {
    const nodes = version.nodes || bot.nodes
    const edges = version.edges || bot.edges
    saveGraph(bot.id, nodes, edges)
    snapshotVersion(bot.id, `Restored from ${version.label}`)
    toast.success('Version Restored', `Loaded graph state from ${version.label}.`)
    router.push(`/app/builder/${bot.id}`)
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* Top Banner Bar */}
      <div className="z-10 flex items-center justify-between border-b border-border bg-card/95 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/builder/${bot.id}`}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Live Builder
          </Link>
          <span className="text-tertiary">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">{bot.name}</span>
            <Badge variant="brand" size="sm">
              Previewing {version.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — {version.note || 'Snapshot revision'} ({formatDate(version.createdAt, { withTime: true })})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <PillButton onClick={() => setConfirmOpen(true)} size="sm" className="gap-1.5 shadow-md shadow-brand/20">
            <RotateCcw className="size-3.5" /> Restore This Version
          </PillButton>
        </div>
      </div>

      {/* Read-Only Canvas Container */}
      <div className="relative flex min-h-0 flex-1">
        <LoomCanvas onRequestUnlock={() => {}} />

        {/* Read-only overlay badge */}
        <div className="pointer-events-none absolute bottom-6 left-6 z-30 rounded-xl border border-border bg-background/90 px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-md flex items-center gap-2">
          <Lock className="size-3.5 text-brand" /> Read-only snapshot preview. Click &quot;Restore This Version&quot; to edit.
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {confirmOpen && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Restore ${version.label}?`}
          description={`This will overwrite the current working graph of "${bot.name}" with this historical snapshot (${version.nodeCount} nodes). A backup version of your current state will be saved automatically.`}
          confirmLabel="Restore Snapshot"
          onConfirm={handleRestore}
        />
      )}
    </div>
  )
}
