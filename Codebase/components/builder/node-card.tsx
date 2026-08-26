'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle, Lock, Settings2 } from 'lucide-react'
import { COMPONENT_MAP, LAYER_MAP, PORT_COLORS, type PortType } from '@/mock/layers'
import { NODE_H, NODE_W } from '@/lib/builder-store'
import { cn } from '@/lib/utils'

export interface LoomNodeData {
  componentId: string
  enabled: boolean
  needsConfig: boolean
  locked: boolean
  hasError: boolean
  [key: string]: unknown
}

/** Evenly spaces N handles down the card edge. */
function handleTop(index: number, count: number) {
  return `${((index + 1) / (count + 1)) * 100}%`
}

function PortHandle({
  type,
  position,
  index,
  count,
}: {
  type: PortType
  position: Position
  index: number
  count: number
}) {
  const isTarget = position === Position.Left
  return (
    <Handle
      id={type}
      type={isTarget ? 'target' : 'source'}
      position={position}
      title={type}
      style={{
        top: handleTop(index, count),
        background: PORT_COLORS[type],
        borderColor: 'color-mix(in oklab, black 25%, transparent)',
      }}
      className="!size-2.5 !border"
    />
  )
}

export function LoomNode({ data, selected }: NodeProps & { data: LoomNodeData }) {
  const comp = COMPONENT_MAP[data.componentId]
  if (!comp) return null

  const layer = LAYER_MAP[comp.layer]
  const dimmed = !data.enabled || data.locked

  return (
    <div
      style={{ width: NODE_W, height: NODE_H, '--layer': layer.hue } as React.CSSProperties}
      className={cn(
        'group relative flex flex-col justify-center gap-1 rounded-[var(--radius-md)] border bg-card px-3 py-2.5',
        'transition-[border-color,box-shadow,opacity] duration-150',
        // The layer colour reads as a left spine rather than a full tint.
        'border-l-[3px]',
        dimmed ? 'opacity-55' : 'opacity-100',
        data.hasError
          ? 'border-destructive shadow-[0_0_0_1px_var(--destructive)]'
          : selected
            ? 'border-brand shadow-[0_0_0_1px_var(--brand),var(--shadow-md)]'
            : 'border-border hover:border-tertiary',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-[-3px] w-[3px] rounded-l-[var(--radius-md)]"
        style={{ background: layer.hue }}
      />

      {comp.inputs.map((t, i) => (
        <PortHandle key={t} type={t} position={Position.Left} index={i} count={comp.inputs.length} />
      ))}
      {comp.outputs.map((t, i) => (
        <PortHandle
          key={t}
          type={t}
          position={Position.Right}
          index={i}
          count={comp.outputs.length}
        />
      ))}

      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] leading-tight font-medium text-balance">
          {comp.name}
        </p>
        <span className="mt-px flex shrink-0 items-center gap-1">
          {data.locked ? <Lock className="size-3 text-warning" /> : null}
          {data.needsConfig && !data.locked ? (
            <Settings2 className="size-3 text-warning" />
          ) : null}
          {data.hasError ? <AlertTriangle className="size-3 text-destructive" /> : null}
        </span>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-tertiary">
        <span className="tabular font-medium" style={{ color: layer.hue }}>
          {layer.roman}
        </span>
        <span className="truncate">
          {data.locked
            ? 'Locked'
            : !data.enabled
              ? 'Disabled'
              : data.needsConfig
                ? 'Needs config'
                : comp.tagline}
        </span>
      </p>
    </div>
  )
}
