'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bookmark,
  ArrowLeft,
  Wrench,
  Copy,
  Trash2,
  Share2,
  Layers,
  History,
  Check,
} from 'lucide-react'
import { useWorkspace, useHydrated } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { LAYER_MAP } from '@/mock/layers'
import { Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

export default function PresetDetailPage() {
  const { presetId } = useParams<{ presetId: string }>()
  const router = useRouter()
  const hydrated = useHydrated()
  const myPresets = useWorkspace((s) => s.myPresets)
  const createBotFromPreset = useWorkspace((s) => s.createBotFromPreset)
  const duplicatePreset = useWorkspace((s) => s.duplicatePreset)
  const deletePreset = useWorkspace((s) => s.deletePreset)
  const updatePresetVisibility = useWorkspace((s) => s.updatePresetVisibility)

  const preset = myPresets.find((p) => p.id === presetId)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading preset blueprint...
      </div>
    )
  }

  if (!preset) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
        <Bookmark className="size-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">Preset not found</h2>
        <p className="text-xs text-muted-foreground">This preset may have been deleted or moved.</p>
        <PillButton onClick={() => router.push('/app/presets')}>
          &larr; Back to Presets
        </PillButton>
      </div>
    )
  }

  const handleLoad = () => {
    const bot = createBotFromPreset(preset.id)
    toast.success('Strategy Instantiated', `Opening builder canvas for "${bot.name}"...`)
    router.push(`/app/builder/${bot.id}`)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Back Link */}
      <div>
        <Link
          href="/app/presets"
          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to My Presets
        </Link>
      </div>

      {/* Preset Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-border pb-6">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{preset.name}</h1>
            <Badge
              variant={
                preset.visibility === 'public'
                  ? 'profit'
                  : preset.visibility === 'unlisted'
                    ? 'brand'
                    : 'outline'
              }
              size="md"
              className="capitalize"
            >
              {preset.visibility}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {preset.description || 'Custom strategy preset graph with modular configuration.'}
          </p>
          <div className="flex items-center gap-4 text-xs text-tertiary pt-2">
            <span>Created {formatDate(preset.createdAt, { withTime: true })}</span>
            <span>·</span>
            <span>{preset.nodeCount} node(s)</span>
            <span>·</span>
            <span>{preset.layers.length} layer(s)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PillButton onClick={handleLoad} className="gap-2 shadow-lg shadow-brand/20">
            <Wrench className="size-4" /> Load in Builder
          </PillButton>
          <PillButton variant="secondary" onClick={() => setShareOpen(true)} className="gap-1.5">
            <Share2 className="size-3.5" /> Share
          </PillButton>
          <button
            type="button"
            onClick={() => {
              duplicatePreset(preset.id)
              toast.success('Preset Duplicated', `Created a copy of ${preset.name}`)
            }}
            className="p-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Duplicate preset"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="p-2 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title="Delete preset"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Grid: Layers Breakdown & Version History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Layers Breakdown */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-brand" /> Architecture & Layer Composition
            </h2>

            <div className="flex flex-col gap-3 divide-y divide-border">
              {preset.layers.map((lId) => {
                const layer = LAYER_MAP[lId]
                if (!layer) return null
                return (
                  <div key={lId} className="flex items-start justify-between gap-4 pt-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span
                        style={{ backgroundColor: layer.hue }}
                        className="size-3 rounded-full shrink-0 shadow-xs"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">
                          {layer.roman}. {layer.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {layer.short}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-tertiary bg-secondary px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Version History */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <History className="size-4 text-brand" /> Version History
            </h2>

            <div className="flex flex-col gap-3">
              {preset.versions && preset.versions.length > 0 ? (
                preset.versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="flex flex-col gap-1 rounded-xl border border-border/80 bg-background/50 p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{ver.label}</span>
                      <span className="text-[10px] text-tertiary">{formatDate(ver.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{ver.note || 'No notes attached.'}</p>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic p-2">
                  v1 · Initial release
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteOpen && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Strategy Preset?"
          description={`Are you sure you want to permanently delete "${preset.name}"? This action cannot be undone.`}
          confirmLabel="Delete Preset"
          destructive
          onConfirm={() => {
            deletePreset(preset.id)
            toast.success('Preset Deleted', `${preset.name} has been removed.`)
            router.push('/app/presets')
          }}
        />
      )}

      {/* Share Dialog */}
      {shareOpen && (
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Preset: {preset.name}</DialogTitle>
              <DialogDescription>
                Configure visibility and copy the direct link for other algorithmic traders.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold">Visibility Status</span>
                <Segmented<'private' | 'unlisted' | 'public'>
                  value={preset.visibility}
                  onValueChange={(val) => {
                    updatePresetVisibility(preset.id, val)
                    toast.success('Visibility Updated', `Preset is now ${val}.`)
                  }}
                  options={[
                    { value: 'private', label: 'Private' },
                    { value: 'unlisted', label: 'Unlisted' },
                    { value: 'public', label: 'Public' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold">Share Link</span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/app/marketplace/${preset.publishedId || preset.id}`
                        : `/app/marketplace/${preset.id}`
                    }
                    className="text-xs font-mono select-all"
                  />
                  <PillButton
                    size="sm"
                    onClick={() => {
                      const url = typeof window !== 'undefined'
                        ? `${window.location.origin}/app/marketplace/${preset.publishedId || preset.id}`
                        : `/app/marketplace/${preset.id}`
                      navigator.clipboard.writeText(url)
                      setCopiedLink(true)
                      toast.success('Link Copied')
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                    className="gap-1.5 shrink-0"
                  >
                    {copiedLink ? <Check className="size-3.5 text-profit" /> : <Copy className="size-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </PillButton>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setShareOpen(false)}>
                Close
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
