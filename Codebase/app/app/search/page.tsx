'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search as SearchIcon,
  Bot,
  Layers,
  Store,
  BookOpen,
  FileText,
  LayoutGrid,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { useWorkspace, useMarketplacePresets } from '@/lib/workspace-store'
import { buildIndex, searchIndex, KIND_LABEL, type ResultKind, type SearchResult } from '@/lib/search-index'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<ResultKind, typeof Bot> = {
  bot: Bot,
  component: Layers,
  layer: Layers,
  preset: Store,
  doc: BookOpen,
  post: FileText,
  page: LayoutGrid,
  action: Sparkles,
}

function SearchPageContent() {
  const searchParams = useSearchParams()
  const bots = useWorkspace((s) => s.bots)
  const marketplacePresets = useMarketplacePresets()

  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [kindFilter, setKindFilter] = useState<string>('all')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) {
      setQuery(q)
    }
  }, [searchParams])

  const index = useMemo(() => buildIndex(bots, marketplacePresets), [bots, marketplacePresets])
  const results = useMemo(() => searchIndex(index, query), [index, query])

  const filteredResults = useMemo(() => {
    if (kindFilter === 'all') return results
    return results.filter((r) => r.kind === kindFilter)
  }, [results, kindFilter])

  // Group by kind
  const grouped = useMemo(() => {
    const map = new Map<ResultKind, SearchResult[]>()
    filteredResults.forEach((item) => {
      const list = map.get(item.kind) || []
      list.push(item)
      map.set(item.kind, list)
    })
    return Array.from(map.entries())
  }, [filteredResults])

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Search Bar Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Global Workspace Search</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Search across trading bots, 12-layer components, documentation, marketplace presets, and research articles.
          </p>
        </div>

        <div className="relative w-full">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything in Aether..."
            className="pl-12 h-12 text-sm sm:text-base rounded-2xl border-border bg-card shadow-sm"
          />
        </div>

        {/* Kind Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setKindFilter('all')}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer',
              kindFilter === 'all' ? 'bg-brand text-brand-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            All Results ({results.length})
          </button>
          {(['page', 'bot', 'component', 'preset', 'doc', 'post'] as ResultKind[]).map((kind) => {
            const count = results.filter((r) => r.kind === kind).length
            if (count === 0 && query) return null
            return (
              <button
                key={kind}
                onClick={() => setKindFilter(kind)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                  kindFilter === kind ? 'bg-brand text-brand-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{KIND_LABEL[kind]}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center flex flex-col items-center justify-center gap-2">
          <SearchIcon className="size-10 text-muted-foreground" />
          <h3 className="text-base font-bold">No results found</h3>
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t find anything matching &ldquo;{query}&rdquo;. Try another term.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([kind, items]) => {
            const Icon = KIND_ICONS[kind] || SearchIcon
            return (
              <div key={kind} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3.5 text-brand" /> {KIND_LABEL[kind]} ({items.length})
                </div>

                <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href || '#'}
                      className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:text-brand group-hover:bg-brand/10 transition-colors">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-brand transition-colors truncate">
                            {item.title}
                          </span>
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>

                      <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground animate-pulse">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  )
}
