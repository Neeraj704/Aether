'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bookmark,
  Search,
  Plus,
  Wrench,
  Copy,
  Trash2,
  Share2,
  Globe,
  Lock,
  Eye,
  Check,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { useWorkspace, useHydrated, type StoredPreset } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { LAYER_MAP, type LayerId } from '@/mock/layers'
import { Badge } from '@/components/ui/badge'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
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
import { formatDate, cn } from '@/lib/utils'

export default function MyPresetsPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const myPresets = useWorkspace((s) => s.myPresets)
  const createBotFromPreset = useWorkspace((s) => s.createBotFromPreset)
  const duplicatePreset = useWorkspace((s) => s.duplicatePreset)
  const deletePreset = useWorkspace((s) => s.deletePreset)
  const renamePreset = useWorkspace((s) => s.renamePreset)
  const updatePresetVisibility = useWorkspace((s) => s.updatePresetVisibility)

  const [search, setSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const [deleteCandidate, setDeleteCandidate] = useState<StoredPreset | null>(null)
  const [shareCandidate, setShareCandidate] = useState<StoredPreset | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const filteredPresets = myPresets.filter((preset) => {
    const matchSearch =
      preset.name.toLowerCase().includes(search.toLowerCase()) ||
      preset.description.toLowerCase().includes(search.toLowerCase())
    const matchVis = visibilityFilter === 'all' || preset.visibility === visibilityFilter
    return matchSearch && matchVis
  })

  const handleLoadIntoBuilder = (presetId: string) => {
    const newBot = createBotFromPreset(presetId)
    toast.success('Strategy Instantiated', `Created "${newBot.name}". Launching builder canvas...`)
    router.push(`/app/builder/${newBot.id}`)
  }

  const handleStartRename = (preset: StoredPreset) => {
    setEditingId(preset.id)
    setEditingName(preset.name)
  }

  const handleSaveRename = (presetId: string) => {
    if (editingName.trim()) {
      renamePreset(presetId, editingName.trim())
      toast.success('Preset Renamed')
    }
    setEditingId(null)
  }

  const handleCopyShareLink = (preset: StoredPreset) => {
    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/app/marketplace/${preset.publishedId || preset.id}`
      : `/app/marketplace/${preset.id}`
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    toast.success('Link Copied', 'Shareable preset link copied to clipboard.')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading presets library...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Bookmark className="size-3.5" /> Strategy Preset Library
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            My Strategy Presets & Reusable Blocks
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Save sub-graphs, modular multi-agent clusters, and full strategy templates to drop instantly onto any builder canvas.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PillLink href="/app/builder" className="gap-2 shadow-lg shadow-brand/20">
            <Plus className="size-4" /> Save New Block
          </PillLink>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved presets..."
            className="pl-9 text-xs"
          />
        </div>

        <Segmented<string>
          value={visibilityFilter}
          onValueChange={setVisibilityFilter}
          options={[
            { value: 'all', label: `All (${myPresets.length})` },
            { value: 'private', label: 'Private' },
            { value: 'unlisted', label: 'Unlisted' },
            { value: 'public', label: 'Public' },
          ]}
        />
      </div>

      {/* Presets Grid */}
      {filteredPresets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8">
          <EmptyState
            icon={Bookmark}
            title={myPresets.length === 0 ? 'No saved presets yet' : 'No matching presets'}
            description={
              myPresets.length === 0
                ? 'Create reusable sub-graphs inside the strategy builder by selecting nodes and clicking "Save as block" in the inspector.'
                : 'No presets match your current filter and search query.'
            }
            action={
              myPresets.length === 0
                ? { label: 'Go to Strategy Builder', href: '/app/builder' }
                : { label: 'Clear filters', onClick: () => { setSearch(''); setVisibilityFilter('all') } }
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-brand/40 transition-all duration-200"
            >
              <div className="flex flex-col gap-3.5">
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    {editingId === preset.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveRename(preset.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(preset.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="rounded border border-brand bg-background px-2 py-0.5 text-base font-bold outline-none"
                      />
                    ) : (
                      <Link
                        href={`/app/presets/${preset.id}`}
                        className="font-bold text-base tracking-tight hover:text-brand transition-colors truncate"
                      >
                        {preset.name}
                      </Link>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {preset.description || 'Custom graph preset block.'}
                    </p>
                  </div>

                  <Badge
                    variant={
                      preset.visibility === 'public'
                        ? 'profit'
                        : preset.visibility === 'unlisted'
                          ? 'brand'
                          : 'outline'
                    }
                    size="sm"
                    className="capitalize shrink-0"
                  >
                    {preset.visibility}
                  </Badge>
                </div>

                {/* Layer dots strip */}
                <div className="rounded-lg border border-border/60 bg-secondary/40 p-2.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Layers ({preset.layers.length})
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {preset.layers.map((lId) => {
                      const meta = LAYER_MAP[lId]
                      return (
                        <span
                          key={lId}
                          title={`${meta?.roman}. ${meta?.name}`}
                          style={{ backgroundColor: meta?.hue || '#888' }}
                          className="size-2.5 rounded-full shrink-0 shadow-xs"
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center justify-between text-[11px] text-tertiary pt-1">
                  <span>Created {formatDate(preset.createdAt)}</span>
                  <span>{preset.versions?.length || 1} version(s)</span>
                  <span>{preset.nodeCount} node(s)</span>
                </div>
              </div>

              {/* Bottom Actions Toolbar */}
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-2">
                <PillButton
                  size="sm"
                  onClick={() => handleLoadIntoBuilder(preset.id)}
                  className="gap-1.5"
                >
                  <Wrench className="size-3.5" /> Load in Builder
                </PillButton>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Share preset link"
                    onClick={() => setShareCandidate(preset)}
                    className="p-1.5 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Share2 className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    title="Duplicate preset"
                    onClick={() => {
                      duplicatePreset(preset.id)
                      toast.success('Preset Duplicated', `Created a copy of ${preset.name}`)
                    }}
                    className="p-1.5 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <Copy className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    title="Delete preset"
                    onClick={() => setDeleteCandidate(preset)}
                    className="p-1.5 rounded-lg border border-border bg-secondary/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteCandidate && (
        <ConfirmDialog
          open={Boolean(deleteCandidate)}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Delete Strategy Preset?"
          description={`Are you sure you want to permanently delete "${deleteCandidate.name}"? This action cannot be undone.`}
          confirmLabel="Delete Preset"
          destructive
          onConfirm={() => {
            deletePreset(deleteCandidate.id)
            toast.success('Preset Deleted', `${deleteCandidate.name} has been removed.`)
            setDeleteCandidate(null)
          }}
        />
      )}

      {/* Share Preset Dialog */}
      {shareCandidate && (
        <Dialog open={Boolean(shareCandidate)} onOpenChange={(o) => !o && setShareCandidate(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Share Preset: {shareCandidate.name}</DialogTitle>
              <DialogDescription>
                Configure visibility and copy the direct link for other algorithmic traders.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold">Visibility Status</span>
                <Segmented<'private' | 'unlisted' | 'public'>
                  value={shareCandidate.visibility}
                  onValueChange={(val) => {
                    updatePresetVisibility(shareCandidate.id, val)
                    setShareCandidate({ ...shareCandidate, visibility: val })
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
                        ? `${window.location.origin}/app/marketplace/${shareCandidate.publishedId || shareCandidate.id}`
                        : `/app/marketplace/${shareCandidate.id}`
                    }
                    className="text-xs font-mono select-all"
                  />
                  <PillButton
                    size="sm"
                    onClick={() => handleCopyShareLink(shareCandidate)}
                    className="gap-1.5 shrink-0"
                  >
                    {copiedLink ? <Check className="size-3.5 text-profit" /> : <Copy className="size-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </PillButton>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setShareCandidate(null)}>
                Close
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
