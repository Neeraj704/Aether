import { createClient } from '@/lib/supabase/client'
import type { Preset, MyPreset, PublishedPreset, Review, BotGraph } from '@/mock/data'
import { emptyGraph } from '@/mock/data'
import { cloneGraph } from '@/lib/graph-utils'
import type { LayerId, PlanTier } from '@/mock/layers'
import { createPreset, getPreset, updatePresetMeta } from '@/lib/presets'

export interface PublishWizardInput {
  tagline: string
  description: string
  authorNotes?: string
  category: string
  tags: string[]
  price: number
  tier?: PlanTier
  sampleRunId?: string
}

export interface MarketplaceFilters {
  category?: string
  tier?: string
  search?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function mapListingRow(row: any, reviews: Review[] = []): Preset {
  const graph: BotGraph = row.graph || emptyGraph()
  const authorName = row.profiles?.display_name || row.author_name || 'Aether Quant'
  const authorHandle = authorName.toLowerCase().replace(/[^a-z0-9]/g, '')

  const clones = Number(row.clones || 0)
  const rating = Number(row.rating || 0)
  const reviewCount = Number(row.review_count ?? reviews.length)

  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || 'Systematic strategy blueprint',
    description: row.description || '',
    authorNotes: row.author_notes || '',
    author: {
      name: authorName,
      initials: getInitials(authorName),
      handle: `@${authorHandle}`,
    },
    price: Number(row.price || 0),
    forks: clones,
    rating: rating > 0 ? rating : 5.0,
    reviewCount: reviewCount,
    layers: (row.layers || []) as LayerId[],
    nodeCount: row.node_count ?? graph.nodes?.length ?? 0,
    tier: (row.tier || 'free') as PlanTier,
    headline: {
      label: 'Verified Backtest',
      value: row.sample_run_id ? 'Verified' : 'Ready',
      positive: true,
    },
    createdAt: row.published_at || row.created_at || new Date().toISOString(),
    category: row.category || 'Momentum',
    tags: row.tags || [],
    graph,
    reviews,
    sampleRunId: row.sample_run_id || '',
    trending: clones >= 10 || rating >= 4.5,
  }
}

export async function listMarketplace(filters?: MarketplaceFilters): Promise<Preset[]> {
  const supabase = createClient()
  let query = supabase
    .from('marketplace_listings')
    .select(`
      *,
      profiles:owner_id (
        display_name
      ),
      marketplace_reviews (
        id,
        rating,
        body,
        created_at,
        reviewer_id,
        profiles:reviewer_id (
          display_name
        )
      )
    `)
    .eq('status', 'published')
    .order('clones', { ascending: false })

  if (filters?.category && filters.category !== 'All') {
    query = query.ilike('category', filters.category)
  }

  if (filters?.tier && filters.tier !== 'all') {
    query = query.eq('tier', filters.tier)
  }

  if (filters?.search && filters.search.trim()) {
    const s = filters.search.trim()
    query = query.or(`name.ilike.%${s}%,tagline.ilike.%${s}%,description.ilike.%${s}%`)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Error fetching marketplace listings:', error)
    return []
  }

  return data.map((row) => {
    const rawReviews = (row.marketplace_reviews || []).map((r: any) => {
      const revName = r.profiles?.display_name || 'Trader'
      return {
        id: r.id,
        author: revName,
        initials: getInitials(revName),
        rating: r.rating,
        createdAt: r.created_at,
        body: r.body || '',
      } as Review
    })

    return mapListingRow(row, rawReviews)
  })
}

export async function getListing(id: string): Promise<Preset | null> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('marketplace_listings')
    .select(`
      *,
      profiles:owner_id (
        display_name
      ),
      marketplace_reviews (
        id,
        rating,
        body,
        created_at,
        reviewer_id,
        profiles:reviewer_id (
          display_name
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !row) {
    return null
  }

  const reviews: Review[] = (row.marketplace_reviews || []).map((r: any) => {
    const revName = r.profiles?.display_name || 'Trader'
    return {
      id: r.id,
      author: revName,
      initials: getInitials(revName),
      rating: r.rating,
      createdAt: r.created_at,
      body: r.body || '',
    }
  })

  return mapListingRow(row, reviews)
}

export async function publishPreset(
  presetId: string,
  wizard: PublishWizardInput,
): Promise<Preset> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('You must be signed in to publish a preset')
  }

  // 1. Fetch source preset
  const preset = await getPreset(presetId)
  if (!preset) {
    throw new Error(`Preset with ID ${presetId} not found`)
  }

  const clonedGraph = cloneGraph(preset.graph)
  const nodeCount = clonedGraph.nodes?.length ?? 0

  // 2. Insert into marketplace_listings
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      preset_id: preset.id,
      owner_id: user.id,
      name: preset.name,
      tagline: wizard.tagline.trim(),
      description: wizard.description.trim() || preset.description,
      author_notes: wizard.authorNotes?.trim() || '',
      category: wizard.category || 'Momentum',
      tags: wizard.tags || [],
      price: wizard.price || 0,
      tier: wizard.tier || 'free',
      graph: clonedGraph,
      node_count: nodeCount,
      layers: preset.layers || [],
      sample_run_id: wizard.sampleRunId || null,
      clones: 0,
      revenue: 0,
      rating: 5.0,
      review_count: 0,
      status: 'published',
    })
    .select(`
      *,
      profiles:owner_id (
        display_name
      )
    `)
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to publish marketplace listing')
  }

  // 3. Mark preset as published
  await updatePresetMeta(preset.id, {
    publishedId: data.id,
    visibility: 'public',
  })

  return mapListingRow(data, [])
}

export async function unpublishListing(listingId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('marketplace_listings')
    .update({ status: 'unpublished' })
    .eq('id', listingId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function cloneListing(listingId: string): Promise<MyPreset> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Please log in or sign up to clone strategy presets')
  }

  // 1. Fetch listing
  const { data: listing, error: listError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (listError || !listing) {
    throw new Error('Marketplace listing not found')
  }

  // 2. Atomically increment clone count via Postgres RPC
  try {
    await supabase.rpc('increment_listing_clones', { listing_id: listingId })
  } catch (rpcErr) {
    console.warn('RPC clone counter notice:', rpcErr)
  }

  // 3. Create independent preset for the current user
  const clonedGraph = cloneGraph(listing.graph)
  const newPreset = await createPreset({
    name: `${listing.name} (Clone)`,
    description: listing.tagline || listing.description || 'Cloned from marketplace.',
    graph: clonedGraph,
    layers: listing.layers,
    visibility: 'private',
  })

  return newPreset
}

export async function submitReview(
  listingId: string,
  rating: number,
  body = '',
): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Must be authenticated to review a strategy')
  }

  const sanitizedRating = Math.max(1, Math.min(5, Math.round(rating)))

  const { error } = await supabase
    .from('marketplace_reviews')
    .upsert(
      {
        listing_id: listingId,
        reviewer_id: user.id,
        rating: sanitizedRating,
        body: body.trim(),
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'listing_id, reviewer_id',
      },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function getMyCreatorStats(): Promise<{
  listings: PublishedPreset[]
  totalClones: number
  totalRevenue: number
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { listings: [], totalClones: 0, totalRevenue: 0 }
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('owner_id', user.id)
    .order('published_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching creator listings:', error)
    return { listings: [], totalClones: 0, totalRevenue: 0 }
  }

  let totalClones = 0
  let totalRevenue = 0

  const listings: PublishedPreset[] = data.map((row) => {
    const clones = Number(row.clones || 0)
    const price = Number(row.price || 0)
    const rev = Number(row.revenue || (clones * price * 0.8))

    totalClones += clones
    totalRevenue += rev

    return {
      id: row.id,
      name: row.name,
      clones,
      revenue: rev,
      rating: Number(row.rating || 5.0),
      reviews: Number(row.review_count || 0),
      publishedAt: row.published_at || row.created_at,
      price,
      graph: row.graph || emptyGraph(),
    }
  })

  return {
    listings,
    totalClones,
    totalRevenue,
  }
}
