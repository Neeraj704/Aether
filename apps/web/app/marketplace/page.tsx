'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Store,
  Search,
  GitFork,
  Star,
} from 'lucide-react'
import type { Preset } from '@/mock/data'
import { Logo } from '@/components/brand/logo'
import { TierBadge, Badge } from '@/components/ui/badge'
import { PillLink } from '@/components/ui/pill-button'
import { Input } from '@/components/ui/input'
import { listMarketplace } from '@/lib/marketplace'

export default function PublicMarketplacePage() {
  const [marketplacePresets, setMarketplacePresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = ['All', 'Starter', 'Debate', 'Options', 'Momentum', 'Risk', 'Adaptive', 'Research', 'Learning']

  useEffect(() => {
    let active = true
    listMarketplace({
      category: selectedCategory,
      search: search,
    })
      .then((presets) => {
        if (!active) return
        setMarketplacePresets(presets)
      })
      .catch((err) => {
        console.error('Error fetching public marketplace listings:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedCategory, search])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Public Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
        <Logo />

        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <PillLink href="/signup" size="sm">
            Get Started Free
          </PillLink>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1300px] w-full mx-auto p-6 sm:p-10 flex flex-col gap-10">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-4 py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand">
            <Store className="size-3.5" /> Community Algorithm Hub
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl text-balance">
            Battle-tested trading strategies and modular graph blocks
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Browse verified quantitative architectures designed by systematic traders. Inspect backtests, fork to your workspace, and customize execution in seconds.
          </p>
        </div>

        {/* Filter Toolbar */}
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

        {/* Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground animate-pulse font-mono">
            Loading public marketplace...
          </div>
        ) : marketplacePresets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center flex flex-col items-center justify-center gap-3">
            <Store className="size-10 text-muted-foreground" />
            <h3 className="text-base font-bold">No public strategies available</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Check back soon as quantitative traders publish strategies to the marketplace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketplacePresets.map((preset) => (
              <div
                key={preset.id}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-6 hover:border-brand/40 transition-all duration-200 shadow-xs"
              >
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] text-tertiary font-medium">
                        By {preset.author.name}
                      </span>
                      <Link
                        href={`/marketplace/${preset.id}`}
                        className="font-bold text-base tracking-tight hover:text-brand transition-colors truncate"
                      >
                        {preset.name}
                      </Link>
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
                    <div>
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

                  <PillLink
                    href={`/signup?clone=${preset.id}`}
                    size="sm"
                    className="gap-1.5"
                  >
                    <GitFork className="size-3.5" /> Clone Preset
                  </PillLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
