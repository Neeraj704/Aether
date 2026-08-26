'use client'

import Link from 'next/link'
import type { BotNode } from '@/mock/data'
import { COMPONENT_MAP, LAYERS } from '@/mock/layers'

export function GraphThumbnail({ botId, nodes }: { botId: string; nodes: BotNode[] }) {
  const layerGroups = LAYERS.map((layer) => {
    const layerNodes = nodes.filter((n) => COMPONENT_MAP[n.componentId]?.layer === layer.id)
    return {
      layer,
      nodes: layerNodes,
    }
  }).filter((g) => g.nodes.length > 0)

  return (
    <Link
      href={`/app/builder/${botId}`}
      className="group relative flex flex-col justify-between h-[180px] rounded-xl border border-border/80 bg-card p-4 hover:border-brand/50 transition-all duration-200 shadow-xs hover:shadow-md overflow-hidden grid-dots"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground/90 group-hover:text-brand transition-colors">
          Strategy Graph Canvas
        </span>
        <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded-full text-tertiary">
          {nodes.length} nodes
        </span>
      </div>

      <div className="flex flex-col gap-2 my-auto">
        {layerGroups.slice(0, 4).map(({ layer, nodes: lNodes }) => (
          <div key={layer.id} className="flex items-center gap-2">
            <span className="w-5 font-mono text-[9px] text-tertiary uppercase shrink-0">
              {layer.roman}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {lNodes.map((node) => {
                const comp = COMPONENT_MAP[node.componentId]
                return (
                  <div
                    key={node.id}
                    title={comp?.name ?? node.componentId}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/80 border border-border/40 text-[10px] truncate max-w-[130px] group-hover:bg-secondary transition-colors"
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: layer.hue }}
                    />
                    <span className="truncate text-foreground/90 font-medium">
                      {comp?.name ?? node.componentId}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {layerGroups.length > 4 && (
          <div className="text-[10px] text-tertiary italic text-center">
            +{layerGroups.length - 4} more layers...
          </div>
        )}
      </div>

      <div className="text-[11px] text-brand opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-right">
        Open in Builder &rarr;
      </div>
    </Link>
  )
}
