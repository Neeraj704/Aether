'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { create } from 'zustand'
import {
  ArrowRight,
  Bot as BotIcon,
  Box,
  FileText,
  Layers,
  Newspaper,
  Search,
  Sparkles,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession, toast } from '@/lib/store'
import { useWorkspace, useMarketplacePresets } from '@/lib/workspace-store'
import {
  KIND_LABEL,
  buildIndex,
  groupResults,
  searchIndex,
  type ResultKind,
  type SearchResult,
} from '@/lib/search-index'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/misc'

interface PaletteState {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

export const usePalette = create<PaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}))

const ICONS: Record<ResultKind, typeof BotIcon> = {
  action: Sparkles,
  bot: BotIcon,
  component: Box,
  layer: Layers,
  preset: Store,
  doc: FileText,
  post: Newspaper,
  page: ArrowRight,
}

/**
 * Global Cmd+K palette. The same ranking engine backs the full-page
 * /app/search route, so results are always consistent.
 */
export function CommandPalette() {
  const router = useRouter()
  const { open, setOpen, toggle } = usePalette()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const bots = useWorkspace((s) => s.bots)
  const marketplacePresets = useMarketplacePresets()
  const createBot = useWorkspace((s) => s.createBot)
  const markAllRead = useWorkspace((s) => s.markAllRead)
  const setTheme = useSession((s) => s.setTheme)
  const theme = useSession((s) => s.theme)
  const toggleSidebar = useSession((s) => s.toggleSidebar)

  const index = useMemo(() => buildIndex(bots, marketplacePresets), [bots, marketplacePresets])
  const results = useMemo(() => searchIndex(index, query), [index, query])
  const groups = useMemo(() => groupResults(results), [results])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])

  useEffect(() => setCursor(0), [query])

  const runAction = useCallback(
    (action: string) => {
      if (action === 'new-bot') {
        const bot = createBot()
        router.push(`/app/builder/${bot.id}`)
        toast.success('New bot created', 'Blank canvas ready. Start with a data feed.')
      } else if (action === 'toggle-theme') {
        setTheme(theme === 'dark' ? 'light' : 'dark')
      } else if (action === 'toggle-sidebar') {
        toggleSidebar()
      } else if (action === 'mark-read') {
        markAllRead()
        toast.success('All caught up')
      }
    },
    [createBot, markAllRead, router, setTheme, theme, toggleSidebar],
  )

  const select = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      if (result.action) runAction(result.action)
      else if (result.href) router.push(result.href)
    },
    [router, runAction, setOpen],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = flat[cursor]
      if (hit) select(hit)
    }
  }

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  let running = -1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="lg" showClose={false} className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search bots, components, docs, or run a command…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-tertiary"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
              No matches for {`"${query}"`}. Try a component name, a layer, or a bot.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-[0.04em] text-tertiary uppercase">
                  {KIND_LABEL[group.kind]}
                </p>
                {group.items.map((item) => {
                  running += 1
                  const active = running === cursor
                  const Icon = ICONS[item.kind]
                  return (
                    <button
                      key={item.id}
                      data-active={active}
                      onMouseMove={() => setCursor(flat.indexOf(item))}
                      onClick={() => select(item)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-left',
                        active && 'bg-secondary',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4 shrink-0',
                          active ? 'text-brand' : 'text-muted-foreground',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </span>
                      {active ? <Kbd>↵</Kbd> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-tertiary">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> select
          </span>
          <span className="ml-auto">{flat.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
