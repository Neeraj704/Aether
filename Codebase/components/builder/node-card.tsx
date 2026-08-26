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
  const Icon = comp.icon

  return (
    <div
      className={cn(
        'group/node relative flex flex-col rounded-[13px] border bg-[var(--surface-1)] text-left transition-[box-shadow,border-color,transform] duration-150',
        selected
          ? 'border-brand shadow-[0_0_0_1.5px_var(--brand),0_16px_40px_-16px_rgb(0_0_0/0.65)]'
          : 'border-[var(--hairline)] shadow-[0_1px_2px_rgb(0_0_0/0.35),0_10px_28px_-20px_rgb(0_0_0/0.7)] hover:border-[var(--hairline-strong)]',
        d.candidate && 'border-success shadow-[0_0_0_1.5px_var(--success)]',
        d.blocked && 'opacity-40',
        dim && 'opacity-55',
      )}
      style={{ width: NODE_W }}
    >
      {/* Layer accent rail */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[2px] rounded-full"
        style={{ background: layer.hue, opacity: selected ? 1 : 0.55 }}
      />

      <div className="flex items-start gap-2.5 px-3 py-2.5 pl-3.5">
        <span
          className="mt-px flex size-7 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: `color-mix(in oklab, ${layer.hue} 16%, transparent)`, color: layer.hue }}
        >
          <Icon className="size-3.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] leading-tight font-medium text-foreground">
              {comp.name}
            </span>
            {d.locked ? <Lock className="size-3 shrink-0 text-gold" /> : null}
            {!d.enabled ? <EyeOff className="size-3 shrink-0 text-tertiary" /> : null}
            {d.needsConfig ? <AlertTriangle className="size-3 shrink-0 text-warning" /> : null}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <span
              className="tabular text-[9.5px] font-semibold tracking-[0.08em]"
              style={{ color: layer.hue }}
            >
              {layer.roman}
            </span>
            <span className="truncate text-[10.5px] text-tertiary">{layer.name}</span>
          </span>
        </span>
      </div>

      <Ports types={comp.inputs} side="in" />
      <Ports types={comp.outputs} side="out" />

      {/* Handles are deliberately large for easy grabbing, but visually small. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-[var(--hairline-strong)] !opacity-0 transition-opacity group-hover/node:!opacity-100 data-[connectingfrom]:!opacity-100"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-brand !opacity-0 transition-opacity group-hover/node:!opacity-100"
        style={{ right: -6 }}
      />
    </div>
  )
})
