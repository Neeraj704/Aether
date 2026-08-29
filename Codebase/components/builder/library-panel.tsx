'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, GripVertical, Lock, Package, Search, X } from 'lucide-react'
import { COMPONENTS, LAYERS, LAYER_MAP, type ComponentDef, type LayerId } from '@/mock/layers'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { useWorkspace } from '@/lib/workspace-store'
import { useBuilder } from '@/lib/builder-store'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { cn, fuzzyScore } from '@/lib/utils'

export const DRAG_MIME = 'application/x-aether-component'
export const DRAG_PRESET_MIME = 'application/x-aether-preset'

function LibraryRow({
  comp,
  locked,
  onUnlockRequest,
}: {
  comp: ComponentDef
  locked: boolean
  onUnlockRequest: (comp: ComponentDef) => void
}) {
  const addNode = useBuilder((s) => s.addNode)
  const layer = LAYER_MAP[comp.layer]

  return (
    <li>
      <div
        draggable={!locked}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, comp.id)
          e.dataTransfer.effectAllowed = 'copy'
          const dragEl = document.createElement('div')
          dragEl.className =
            'fixed -top-[9999px] left-0 pointer-events-none z-50 flex items-center gap-2 rounded-[12px] border border-brand/60 bg-background/95 px-3 py-2 text-foreground shadow-2xl backdrop-blur-xl'
          dragEl.style.width = '200px'
          dragEl.innerHTML = `<span class="size-2 rounded-full" style="background: ${layer.hue}"></span><span class="text-xs font-medium truncate">${comp.name}</span>`
          document.body.appendChild(dragEl)
          e.dataTransfer.setDragImage(dragEl, 100, 20)
          setTimeout(() => document.body.removeChild(dragEl), 0)
        }}
        onDoubleClick={() => {
          if (locked) onUnlockRequest(comp)
          else addNode(comp.id, 120, 0)
        }}
        className={cn(
          'group/row flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors',
          locked
            ? 'cursor-pointer text-muted-foreground hover:bg-secondary'
            : 'cursor-grab hover:bg-secondary active:cursor-grabbing',
        )}
      >
        <GripVertical className="size-3 shrink-0 opacity-0 group-hover/row:opacity-40 transition-opacity" />
        <span
          className="size-1.5 rounded-full shrink-0"
          style={{ background: layer.hue }}
        />
        <Tooltip content={comp.tagline}>
          <span className="min-w-0 flex-1 truncate">{comp.name}</span>
        </Tooltip>
        {locked ? (
          <button
            type="button"
            onClick={() => onUnlockRequest(comp)}
            className="flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-warning/12 px-1.5 py-0.5 text-[10px] font-medium text-warning"
          >
            <Lock className="size-2.5" />
            {comp.price > 0 ? comp.price : comp.tier}
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function LibraryPanel({
  onUnlockRequest,
}: {
  onUnlockRequest: (comp: ComponentDef) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<LayerId[]>(['data', 'features'])
  const { plan, unlocked } = useSession()
  const myPresets = useWorkspace((s) => s.myPresets)
  const addBlock = useBuilder((s) => s.addBlock)

  const access = { plan, unlocked }

  /** When searching, every layer that has a hit is force-expanded. */
  const grouped = useMemo(() => {
    const matched = query
      ? COMPONENTS.map((c) => ({
          c,
          score: Math.max(
            fuzzyScore(query, c.name) * 2,
            fuzzyScore(query, c.tagline),
            fuzzyScore(query, c.id),
          ),
        }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((r) => r.c)
      : COMPONENTS

    return LAYERS.map((layer) => ({
      layer,
      items: matched.filter((c) => c.layer === layer.id),
    })).filter((g) => g.items.length > 0)
  }, [query])

  const savedBlocks = myPresets.filter((p) => p.nodes && p.nodes.length > 0)

  return (
    <aside data-tour="library-panel" className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tertiary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 100+ nodes"
            aria-label="Search component library"
            className="h-8 pr-7 pl-8 text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-tertiary hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-tertiary">Drag onto the canvas, or double-click.</p>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        {savedBlocks.length > 0 && !query ? (
          <section className="mb-2">
            <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-tertiary uppercase">
              Your blocks
            </p>
            <ul>
              {savedBlocks.map((p) => (
                <li key={p.id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_PRESET_MIME, p.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onDoubleClick={() => addBlock(p.nodes ?? [], p.edges ?? [])}
                    className="flex cursor-grab items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] hover:bg-secondary active:cursor-grabbing"
                  >
                    <Package className="size-3.5 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="tabular shrink-0 text-[11px] text-tertiary">
                      {p.nodeCount}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-tertiary">
            No nodes match “{query}”.
          </p>
        ) : null}

        {grouped.map(({ layer, items }) => {
          const expanded = Boolean(query) || open.includes(layer.id)
          return (
            <section key={layer.id}>
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) =>
                    prev.includes(layer.id)
                      ? prev.filter((l) => l !== layer.id)
                      : [...prev, layer.id],
                  )
                }
                aria-expanded={expanded}
                className="flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-secondary"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 shrink-0 text-tertiary transition-transform',
                    expanded && 'rotate-90',
                  )}
                />
                <span
                  className="tabular shrink-0 text-[11px] font-semibold"
                  style={{ color: layer.hue }}
                >
                  {layer.roman}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {layer.name}
                </span>
                <span className="tabular shrink-0 text-[11px] text-tertiary">{items.length}</span>
              </button>

              {expanded ? (
                <ul className="mb-1 ml-4 border-l border-border pl-1.5">
                  {items.map((comp) => (
                    <LibraryRow
                      key={comp.id}
                      comp={comp}
                      locked={!hasComponent(comp.id, access)}
                      onUnlockRequest={onUnlockRequest}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
