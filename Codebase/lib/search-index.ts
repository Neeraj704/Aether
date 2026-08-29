import { COMPONENTS, LAYERS, LAYER_MAP } from '@/mock/layers'
import { BLOG_POSTS, DOC_SECTIONS, MARKETPLACE_PRESETS, type Bot } from '@/mock/data'
import { fuzzyScore } from '@/lib/utils'

export type ResultKind = 'bot' | 'component' | 'preset' | 'doc' | 'layer' | 'page' | 'action' | 'post'

export interface SearchResult {
  id: string
  kind: ResultKind
  title: string
  subtitle: string
  href?: string
  /** Actions run instead of navigating. */
  action?: string
  keywords?: string
}

export const KIND_LABEL: Record<ResultKind, string> = {
  action: 'Actions',
  bot: 'Your bots',
  component: 'Components',
  preset: 'Marketplace',
  layer: 'Layers',
  doc: 'Documentation',
  post: 'Blog',
  page: 'Pages',
}

const PAGES: SearchResult[] = [
  { id: 'p-dash', kind: 'page', title: 'Dashboard', subtitle: 'Portfolio overview', href: '/app' },
  { id: 'p-bots', kind: 'page', title: 'My Bots', subtitle: 'All your agents', href: '/app/bots' },
  { id: 'p-live', kind: 'page', title: 'Live Monitor', subtitle: 'Running bots and positions', href: '/app/live' },
  { id: 'p-market', kind: 'page', title: 'Marketplace', subtitle: 'Community presets', href: '/app/marketplace' },
  { id: 'p-billing', kind: 'page', title: 'Billing', subtitle: 'Plan, credits and invoices', href: '/app/billing' },
  { id: 'p-credits', kind: 'page', title: 'Credits', subtitle: 'Buy simulation credits', href: '/app/billing/credits' },
  { id: 'p-settings', kind: 'page', title: 'Settings', subtitle: 'Account and preferences', href: '/app/settings' },
  { id: 'p-notifs', kind: 'page', title: 'Notifications', subtitle: 'Everything that happened', href: '/app/notifications' },
  { id: 'p-docs', kind: 'page', title: 'Documentation', subtitle: 'Guides and reference', href: '/docs' },
  { id: 'p-pricing', kind: 'page', title: 'Pricing', subtitle: 'Compare plans', href: '/pricing' },
  { id: 'p-library', kind: 'page', title: 'Component Library', subtitle: 'All 12 layers', href: '/app/library' },
]

const ACTIONS: SearchResult[] = [
  { id: 'a-new-bot', kind: 'action', title: 'Create new bot', subtitle: 'Start from a blank canvas', action: 'new-bot', keywords: 'add create build' },
  { id: 'a-theme', kind: 'action', title: 'Toggle theme', subtitle: 'Switch light and dark', action: 'toggle-theme', keywords: 'dark light appearance' },
  { id: 'a-sidebar', kind: 'action', title: 'Toggle sidebar', subtitle: 'Collapse or expand navigation', action: 'toggle-sidebar' },
  { id: 'a-mark-read', kind: 'action', title: 'Mark all notifications read', subtitle: 'Clear the badge', action: 'mark-read' },
]

/**
 * Builds the full searchable set. Bots come from the live store so newly
 * created agents are findable immediately.
 */
export function buildIndex(bots: Bot[]): SearchResult[] {
  return [
    ...ACTIONS,
    ...bots.map<SearchResult>((b) => ({
      id: `bot-${b.id}`,
      kind: 'bot',
      title: b.name,
      subtitle: `${b.status} · ${b.nodes.length} nodes`,
      href: `/app/bots/${b.id}`,
      keywords: b.tags.join(' '),
    })),
    ...COMPONENTS.map<SearchResult>((c) => ({
      id: `comp-${c.id}`,
      kind: 'component',
      title: c.name,
      subtitle: `${LAYER_MAP[c.layer].roman}. ${LAYER_MAP[c.layer].name} · ${c.tagline}`,
      href: `/app/library/${c.id}`,
      keywords: `${c.tagline} ${c.inputs.join(' ')} ${c.outputs.join(' ')}`,
    })),
    ...LAYERS.map<SearchResult>((l) => ({
      id: `layer-${l.id}`,
      kind: 'layer',
      title: `${l.roman}. ${l.name}`,
      subtitle: l.short,
      href: `/app/library?layer=${l.id}`,
    })),
    ...MARKETPLACE_PRESETS.map<SearchResult>((p) => ({
      id: `preset-${p.id}`,
      kind: 'preset',
      title: p.name,
      subtitle: `${p.author.name} · ${p.tagline}`,
      href: `/app/marketplace/${p.id}`,
      keywords: p.tags.join(' '),
    })),
    ...DOC_SECTIONS.map<SearchResult>((d) => ({
      id: `doc-${d.slug}`,
      kind: 'doc',
      title: d.title,
      subtitle: `${d.category} · ${d.summary}`,
      href: `/docs/${d.slug}`,
    })),
    ...BLOG_POSTS.map<SearchResult>((p) => ({
      id: `post-${p.slug}`,
      kind: 'post',
      title: p.title,
      subtitle: p.excerpt,
      href: `/blog/${p.slug}`,
    })),
    ...PAGES,
  ]
}

/** Ranked search. Empty query returns a curated default set. */
export function searchIndex(index: SearchResult[], query: string, limit = 40) {
  const q = query.trim()
  if (!q) {
    return [
      ...index.filter((r) => r.kind === 'action'),
      ...index.filter((r) => r.kind === 'bot').slice(0, 4),
      ...index.filter((r) => r.kind === 'page').slice(0, 5),
    ]
  }

  return index
    .map((r) => {
      const title = fuzzyScore(q, r.title) * 3
      const sub = fuzzyScore(q, r.subtitle)
      const keys = r.keywords ? fuzzyScore(q, r.keywords) * 0.6 : 0
      return { r, score: title + sub + keys }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r)
}

export function groupResults(results: SearchResult[]) {
  const order: ResultKind[] = ['action', 'bot', 'component', 'layer', 'preset', 'doc', 'post', 'page']
  const groups = new Map<ResultKind, SearchResult[]>()
  for (const r of results) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r])
  return order.filter((k) => groups.has(k)).map((k) => ({ kind: k, items: groups.get(k)! }))
}
