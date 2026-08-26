'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle, EyeOff, Lock } from 'lucide-react'
import { COMPONENT_MAP, LAYER_MAP, PORT_COLORS } from '@/mock/layers'
import { NODE_W } from '@/lib/builder-store'
import { cn } from '@/lib/utils'

export interface NodeCardData {
  componentId: string
  enabled: boolean
  needsConfig?: boolean
  locked: boolean
  /** True while a connection drag is in flight and this node is a legal target. */
  candidate?: boolean
  /** True while a connection drag is in flight and this node is an illegal target. */
  blocked?: boolean
  [key: string]: unknown
}

/** Small coloured dot strip describing a node's port types. */
function Ports({ types, side }: { types: string[]; side: 'in' | 'out' }) {
  if (types.length === 0) return null
  return (
    <span
      className={cn(
        'absolute top-1/2 flex -translate-y-1/2 flex-col gap-1',
        side === 'in' ? '-left-px' : '-right-px',
      )}
      aria-hidden
    >
      {types.slice(0, 4).map((t) => (
        <span
          key={t}
          className="size-1 rounded-full"
          style={{ background: PORT_COLORS[t as keyof typeof PORT_COLORS] ?? 'currentColor' }}
        />
      ))}
    </span>
  )
}

export const NodeCard = memo(function NodeCard({ data, selected }: NodeProps) {
  const d = data as NodeCardData
  const comp = COMPONENT_MAP[d.componentId]
  if (!comp) return null

  const layer = LAYER_MAP[comp.layer]
  const dim = !d.enabled || d.locked

  return (
    <div
      className={cn(
        'group/node relative flex flex-col rounded-[14px] border backdrop-blur-xl text-left transition-[border-color,box-shadow,opacity,background-color] duration-200 shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing active:scale-[1.015] active:shadow-2xl',
        selected
          ? 'border-brand bg-background/90 shadow-[0_0_0_2px_var(--brand),0_12px_32px_-8px_rgba(0,0,0,0.5)]'
          : 'border-border/80 bg-background/75 hover:border-border hover:shadow-lg',
        d.candidate && 'border-success shadow-[0_0_0_2px_var(--success)]',
        d.blocked && 'opacity-40',
        dim && 'opacity-60',
      )}
      style={{ width: NODE_W }}
    >
      {/* Top light catching glass edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[14px] bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />

      {/* Layer accent left border rail */}
      <span
        aria-hidden
        className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full transition-opacity"
        style={{ background: layer.hue, opacity: selected ? 1 : 0.7 }}
      />

      <div className="flex items-start gap-2.5 px-3 py-2.5 pl-3.5">
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] font-mono text-[11px] font-bold shadow-xs"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${layer.hue} 24%, transparent), color-mix(in oklab, ${layer.hue} 12%, transparent))`,
            color: layer.hue,
            border: `1px solid color-mix(in oklab, ${layer.hue} 30%, transparent)`,
          }}
        >
          {layer.roman}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] leading-tight font-medium text-foreground">
              {comp.name}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[10.5px] text-tertiary">
            {comp.tagline || layer.name}
          </span>
        </span>

        {/* Status icon / dot */}
        <span className="mt-0.5 flex shrink-0 items-center gap-1">
          {d.locked ? (
            <Lock className="size-3 text-amber-500" />
          ) : d.needsConfig ? (
            <AlertTriangle className="size-3 text-warning" />
          ) : !d.enabled ? (
            <EyeOff className="size-3 text-tertiary" />
          ) : (
            <span
              className="size-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]"
              title="Enabled & valid"
            />
          )}
        </span>
      </div>

      <Ports types={comp.inputs} side="in" />
      <Ports types={comp.outputs} side="out" />

      {/* Handles with subtle default state and clear hover affordance */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3.5 !border-2 !border-background !bg-muted-foreground/70 !opacity-40 transition-all group-hover/node:!opacity-100 group-hover/node:!scale-110 data-[connectingfrom]:!opacity-100"
        style={{ left: -7 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3.5 !border-2 !border-background !bg-brand !opacity-40 transition-all group-hover/node:!opacity-100 group-hover/node:!scale-110"
        style={{ right: -7 }}
      />
    </div>
  )
})
