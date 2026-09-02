'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bot as BotIcon,
  Plus,
  Search,
  Copy,
  Trash2,
  ExternalLink,
  Upload,
  Download,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Activity,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { downloadBotExport, parseBotImport } from '@/lib/graph-utils'
import {
  listBots,
  createBot as createBotDB,
  deleteBot as deleteBotDB,
  duplicateBotRemote,
  archiveBot as archiveBotDB,
  unarchiveBot as unarchiveBotDB,
} from '@/lib/bots'
import type { Bot } from '@/mock/data'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'

export default function MyBotsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const localBots = useWorkspace((s) => s.bots)
  const [bots, setBots] = useState<Bot[]>(localBots)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [botToDelete, setBotToDelete] = useState<{ id: string; name: string } | null>(null)
  const [botToArchive, setBotToArchive] = useState<{ id: string; name: string; archived: boolean } | null>(null)

  useEffect(() => {
    let active = true
    listBots(true)
      .then((remote) => {
        if (!active) return
        if (remote && remote.length > 0) {
          setBots(remote)
        }
      })
      .catch((err) => {
        console.error('Failed to load bots:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filteredBots = bots.filter((bot) => {
    const matchSearch =
      bot.name.toLowerCase().includes(search.toLowerCase()) ||
      bot.description.toLowerCase().includes(search.toLowerCase()) ||
      bot.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))

    let matchStatus = false
    if (statusFilter === 'all') {
      matchStatus = !bot.archived
    } else if (statusFilter === 'archived') {
      matchStatus = Boolean(bot.archived)
    } else {
      matchStatus = bot.status === statusFilter && !bot.archived
    }

    return matchSearch && matchStatus
  })

  const handleCreateBot = async () => {
    try {
      const bot = await createBotDB({ name: 'Untitled Strategy Bot' })
      setBots((prev) => [bot, ...prev])
      useWorkspace.getState().saveGraph(bot.id, bot.graph)
      toast.success('Bot created', 'Redirecting to strategy builder...')
      router.push(`/app/builder/${bot.id}`)
    } catch (err: any) {
      toast.error('Failed to create bot', err?.message)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await duplicateBotRemote(id)
      setBots((prev) => [copy, ...prev])
      useWorkspace.getState().saveGraph(copy.id, copy.graph)
      toast.success('Bot duplicated', `Created "${copy.name}"`)
    } catch (err: any) {
      toast.error('Duplication failed', err?.message || 'Could not duplicate bot.')
    }
  }

  const handleToggleArchive = async (id: string, currentlyArchived: boolean) => {
    try {
      if (currentlyArchived) {
        await unarchiveBotDB(id)
        setBots((prev) => prev.map((b) => (b.id === id ? { ...b, archived: false } : b)))
        useWorkspace.getState().updateBot(id, { archived: false })
        toast.success('Bot restored', 'Moved out of archive.')
      } else {
        await archiveBotDB(id)
        setBots((prev) => prev.map((b) => (b.id === id ? { ...b, archived: true } : b)))
        useWorkspace.getState().updateBot(id, { archived: true })
        toast.info('Bot archived', 'Moved to archived bots.')
      }
    } catch (err: any) {
      toast.error('Archival failed', err?.message)
    } finally {
      setBotToArchive(null)
    }
  }

  const handleDelete = (id: string, name: string) => {
    setBotToDelete({ id, name })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string
        const imported = parseBotImport(text)
        const newBot = await createBotDB({
          name: imported.bot.name,
          description: imported.bot.description,
          tags: imported.bot.tags,
          graph: imported.graph,
        })
        setBots((prev) => [newBot, ...prev])
        useWorkspace.getState().saveGraph(newBot.id, newBot.graph)
        toast.success('Bot Imported', `"${newBot.name}" imported successfully.`)
        router.push(`/app/builder/${newBot.id}`)
      } catch (err: any) {
        toast.error('Import Failed', err?.message || 'Invalid strategy file.')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Trading Bots</h1>
          <p className="text-xs text-muted-foreground">
            Manage, configure, and monitor your algorithmic trading graphs
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <PillButton variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="size-4" /> Import Bot
          </PillButton>
          <PillButton onClick={handleCreateBot} className="gap-2">
            <Plus className="size-4" /> Create New Bot
          </PillButton>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bots by name or tag..."
            className="pl-9 text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['all', 'live', 'backtested', 'draft', 'paused', 'error', 'archived'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`h-8 px-3 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-brand text-brand-foreground font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bots List */}
      {filteredBots.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl">
          <BotIcon className="size-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold">
            {statusFilter === 'archived' ? 'No archived bots' : 'No bots found'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            {statusFilter === 'archived'
              ? 'You do not have any archived trading bots.'
              : 'No trading bots match your search criteria. Create a new bot to get started.'}
          </p>
          {statusFilter !== 'archived' && (
            <PillButton onClick={handleCreateBot} size="sm">
              Create Bot
            </PillButton>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBots.map((bot) => (
            <div
              key={bot.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-5 transition-all duration-200 relative overflow-hidden ${
                bot.status === 'live'
                  ? 'border-profit/40 shadow-sm shadow-profit/5'
                  : bot.archived
                  ? 'border-border/60 opacity-75 hover:opacity-100'
                  : 'border-border hover:border-brand/40'
              }`}
            >
              {bot.status === 'live' && (
                <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-profit/80 via-brand to-profit/80 animate-pulse" />
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <Link
                      href={`/app/bots/${bot.id}`}
                      className="font-bold text-base hover:text-brand transition-colors truncate"
                    >
                      {bot.name}
                    </Link>
                    <span className="text-[11px] text-tertiary">
                      Updated {new Date(bot.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {bot.archived && (
                      <Badge variant="outline" size="sm" className="text-muted-foreground border-border">
                        Archived
                      </Badge>
                    )}
                    {bot.status === 'live' ? (
                      <Link href={`/app/bots/${bot.id}?tab=live`} title="Open Live Monitor">
                        <StatusBadge status="live" className="cursor-pointer hover:ring-1 hover:ring-profit/50 transition-all" />
                      </Link>
                    ) : (
                      <StatusBadge status={bot.status} />
                    )}

                    <Menu>
                      <MenuTrigger
                        render={
                          <button
                            type="button"
                            title="More actions"
                            aria-label="More actions"
                            className="size-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                          >
                            <MoreVertical className="size-3.5" />
                          </button>
                        }
                      />
                      <MenuContent align="end" className="w-48">
                        <MenuItem onClick={() => handleDuplicate(bot.id)}>
                          <Copy className="size-3.5" />
                          <span>Duplicate Bot</span>
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            downloadBotExport(bot)
                            toast.success('Bot Exported', `Saved ${bot.name}.aether.json`)
                          }}
                        >
                          <Download className="size-3.5" />
                          <span>Export JSON</span>
                        </MenuItem>
                        <MenuItem
                          onClick={() =>
                            setBotToArchive({
                              id: bot.id,
                              name: bot.name,
                              archived: Boolean(bot.archived),
                            })
                          }
                        >
                          {bot.archived ? (
                            <>
                              <ArchiveRestore className="size-3.5" />
                              <span>Restore Bot</span>
                            </>
                          ) : (
                            <>
                              <Archive className="size-3.5" />
                              <span>Archive Bot</span>
                            </>
                          )}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                          destructive
                          onClick={() => handleDelete(bot.id, bot.name)}
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete Bot</span>
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {bot.description || 'No description provided for this bot.'}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" size="sm">
                    {bot.graph?.nodes?.length ?? (bot as any).nodes?.length ?? 0} nodes
                  </Badge>
                  <Badge variant="outline" size="sm">
                    v{bot.versions.length}
                  </Badge>
                  {bot.tags.map((t) => (
                    <Badge key={t} variant="neutral" size="sm">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                    {bot.headlineMetric.label}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      bot.headlineMetric.positive ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {bot.headlineMetric.value || 'Not run'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {bot.status === 'live' ? (
                    <Link
                      href={`/app/bots/${bot.id}?tab=live`}
                      className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-profit/10 text-profit border border-profit/25 hover:bg-profit/20 hover:border-profit/40 text-xs font-semibold transition-all gap-2 group shadow-xs"
                      title="Open Live Monitor"
                    >
                      <span className="relative flex size-2 shrink-0">
                        <span className="absolute -inset-0.5 animate-ping rounded-full bg-profit/60" />
                        <span className="relative size-2 rounded-full bg-profit" />
                      </span>
                      <span>Live Monitor</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/app/bots/${bot.id}`}
                      className="h-8 px-3 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary text-xs font-medium transition-colors"
                    >
                      Overview
                    </Link>
                  )}

                  <Link
                    href={`/app/builder/${bot.id}`}
                    className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:opacity-90 transition-opacity gap-1"
                  >
                    Builder <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={botToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setBotToDelete(null)
        }}
        title={`Delete "${botToDelete?.name}"?`}
        description="This permanently removes the bot, its saved versions, and its backtest history from the database. This can't be undone."
        confirmLabel="Delete bot"
        destructive
        onConfirm={async () => {
          if (botToDelete) {
            try {
              await deleteBotDB(botToDelete.id)
              useWorkspace.getState().deleteBot(botToDelete.id)
              setBots((prev) => prev.filter((b) => b.id !== botToDelete.id))
              toast.info('Bot deleted', `"${botToDelete.name}" was permanently removed.`)
            } catch (e: any) {
              toast.error('Delete failed', e?.message || 'Could not delete bot.')
            } finally {
              setBotToDelete(null)
            }
          }
        }}
      />

      {/* Archive / Unarchive Confirmation */}
      <ConfirmDialog
        open={botToArchive !== null}
        onOpenChange={(open) => {
          if (!open) setBotToArchive(null)
        }}
        title={botToArchive?.archived ? `Restore "${botToArchive?.name}"?` : `Archive "${botToArchive?.name}"?`}
        description={
          botToArchive?.archived
            ? 'This will restore the strategy bot back into your active bots list.'
            : 'This will move the strategy bot to your archive without deleting its data or backtest history.'
        }
        confirmLabel={botToArchive?.archived ? 'Restore Bot' : 'Archive Bot'}
        onConfirm={() => {
          if (botToArchive) {
            handleToggleArchive(botToArchive.id, botToArchive.archived)
          }
        }}
      />
    </div>
  )
}
