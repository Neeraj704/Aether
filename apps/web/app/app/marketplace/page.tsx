'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Store,
  Search,
  GitFork,
  Star,
  Plus,
} from 'lucide-react'
import type { Preset } from '@/mock/data'
import { toast } from '@/lib/store'
import { Badge, TierBadge } from '@/components/ui/badge'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Input } from '@/components/ui/input'
import { listMarketplace, cloneListing } from '@/lib/marketplace'
import { createBot as createBotDB } from '@/lib/bots'
import { useWorkspace } from '@/lib/workspace-store'

export default function MarketplacePage() {
  const router = useRouter()
  const [marketplacePresets, setMarketplacePresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [clonedIds, setClonedIds] = useState<string[]>([])
  const [likedIds, setLikedIds] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = ['All', 'Starter', 'Debate', 'Options', 'Momentum', 'Risk', 'Adaptive', 'Research', 'Learning']

  const fetchListings = () => {
    listMarketplace({
      category: selectedCategory,
      search: search,
    })
      .then((presets) => {
        setMarketplacePresets(presets)
      })
      .catch((err) => {
        console.error('Failed to load marketplace listings:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchListings()
  }, [selectedCategory, search])

  const handleFork = async (preset: Preset) => {
    try {
      setCloningId(preset.id)
      // 1. Clone listing to user's presets via atomic RPC & DB insert
      const myPreset = await cloneListing(preset.id)
      // 2. Also create a bot instance in builder for immediate editing
      const newBot = await createBotDB({
        name: preset.name,
        description: preset.tagline || preset.description,
        graph: preset.graph,
        tags: preset.tags,
      })
      useWorkspace.getState().saveGraph(newBot.id, newBot.graph)
      setClonedIds((prev) => [...prev, preset.id])
      toast.success('Strategy Cloned!', `Cloned "${preset.name}" into your workspace. Launching builder...`)
      router.push(`/app/builder/${newBot.id}`)
    } catch (err: any) {
      toast.error('Clone failed', err?.message || 'Could not clone preset.')
    } finally {
      setCloningId(null)
    }
  }

  const toggleLike = (id: string) => {
    setLikedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-brand/15 via-secondary/40 to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Store className="size-4" /> Strategy &amp; Block Marketplace
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Battle-tested Graph Templates
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Fork production-grade trading bots and modular layer blocks built by expert quant engineers. Instantly customize them on your visual canvas.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <PillLink href="/app/creator/dashboard" variant="secondary" className="text-xs">
            Creator Dashboard &rarr;
          </PillLink>
        </div>
      </div>

      {/* Search & Categories */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search strategy presets..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-brand text-brand-foreground font-semibold'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Presets Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground animate-pulse font-mono">
          Loading community marketplace...
        </div>
      ) : marketplacePresets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center flex flex-col items-center justify-center gap-3">
          <Store className="size-10 text-muted-foreground" />
          <h3 className="text-base font-bold">No marketplace strategies found</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Be the first creator to publish a systematic trading strategy to the community marketplace!
          </p>
          <PillLink href="/app/presets" size="sm" className="mt-2">
            Publish from My Presets
          </PillLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {marketplacePresets.map((preset) => {
            const isForked = clonedIds.includes(preset.id)
            const isLiked = likedIds.includes(preset.id)

            return (
              <div
                key={preset.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-brand/40 transition-all duration-200"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] text-tertiary font-medium">
                        By {preset.author.name}
                      </span>
                      <h3 className="font-bold text-base tracking-tight hover:text-brand transition-colors truncate">
                        <Link href={`/app/marketplace/${preset.id}`} className="hover:underline">
                          {preset.name}
                        </Link>
                      </h3>
                    </div>
                    <TierBadge tier={preset.tier} />
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {preset.tagline}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1 text-gold font-medium">
                      <Star className="size-3.5 fill-gold text-gold" />
                      <span>{preset.rating}</span>
                      <span className="text-tertiary">({preset.reviewCount})</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium">
                      <GitFork className="size-3.5" />
                      <span>{preset.forks} forks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{preset.nodeCount} nodes</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {preset.tags.map((t) => (
                      <Badge key={t} variant="neutral" size="sm">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                      {preset.price > 0 ? `Price: ₹${preset.price}` : 'Free'}
                    </span>
                    <span className="text-sm font-bold text-profit">
                      {preset.headline.label}: {preset.headline.value}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleLike(preset.id)}
                      className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        isLiked
                          ? 'border-gold/50 bg-gold/10 text-gold'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Star className={`size-3.5 ${isLiked ? 'fill-gold' : ''}`} />
                    </button>

                    <PillButton
                      size="sm"
                      onClick={() => handleFork(preset)}
                      disabled={cloningId === preset.id}
                      className="gap-1.5"
                    >
                      <GitFork className="size-3.5" />
                      {cloningId === preset.id ? 'Cloning...' : isForked ? 'Cloned' : 'Clone Graph'}
                    </PillButton>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
