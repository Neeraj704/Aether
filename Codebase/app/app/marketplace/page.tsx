'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Store,
  Search,
  GitFork,
  Star,
  Zap,
  TrendingUp,
  Check,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { MARKETPLACE_PRESETS, type Preset } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { Badge, TierBadge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { Input } from '@/components/ui/input'

export default function MarketplacePage() {
  const router = useRouter()
  const forkPreset = useWorkspace((s) => s.forkPreset)
  const forkedPresets = useWorkspace((s) => s.forkedPresets)
  const likedPresets = useWorkspace((s) => s.likedPresets)
  const toggleLikePreset = useWorkspace((s) => s.toggleLikePreset)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = ['All', 'Starter', 'Debate', 'Options', 'Momentum']

  const filteredPresets = MARKETPLACE_PRESETS.filter((preset) => {
    const matchesSearch =
      preset.name.toLowerCase().includes(search.toLowerCase()) ||
      preset.tagline.toLowerCase().includes(search.toLowerCase()) ||
      preset.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory =
      selectedCategory === 'All' || preset.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleFork = (preset: Preset) => {
    const newBot = forkPreset(preset)
    toast.success('Strategy Forked!', `Created "${newBot.name}". Opening builder...`)
    router.push(`/app/builder/${newBot.id}`)
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-brand/15 via-secondary/40 to-background p-6 sm:p-8 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <Store className="size-4" /> Strategy & Block Marketplace
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Battle-tested Graph Templates
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Fork production-grade trading bots and modular layer blocks built by expert quant engineers. Instantly customize them on your visual canvas.
        </p>
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
              className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPresets.map((preset) => {
          const isForked = forkedPresets.includes(preset.id)
          const isLiked = likedPresets.includes(preset.id)

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
                    <h3 className="font-bold text-base tracking-tight hover:text-brand transition-colors">
                      {preset.name}
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
                    {preset.headline.label}
                  </span>
                  <span className="text-sm font-bold text-profit">
                    {preset.headline.value}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLikePreset(preset.id)}
                    className={`p-2 rounded-lg border text-xs transition-colors ${
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
                    className="gap-1.5"
                  >
                    <GitFork className="size-3.5" />
                    {isForked ? 'Forked' : 'Fork Graph'}
                  </PillButton>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
