'use client'

import { useEffect, useState } from 'react'
import { useReactFlow, useStore } from '@xyflow/react'
import {
  Check,
  Grid2x2,
  Grid3x3,
  Magnet,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Rows3,
  Spline,
  Waves,
  Zap,
} from 'lucide-react'
import { useBuilder, type EdgeKind, type GridMode } from '@/lib/builder-store'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function HudButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          'flex size-7 items-center justify-center rounded-[8px] transition-colors',
          active
            ? 'bg-brand/15 text-brand'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          '[&_svg]:size-3.5',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/** Small popover used for the grid and edge-style pickers. */
function HudPopover<T extends string>({
  label,
  icon,
  value,
  options,
  onSelect,
}: {
  label: string
  icon: React.ReactNode
  value: T
  options: { value: T; label: string }[]
  onSelect: (v: T) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <span className="relative">
      <Tooltip content={label}>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          className={cn(
            'flex size-7 items-center justify-center rounded-[8px] transition-colors [&_svg]:size-3.5',
            open
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {icon}
        </button>
      </Tooltip>

      {open ? (
        <span
          className="absolute bottom-full left-1/2 mb-2 flex w-40 -translate-x-1/2 flex-col gap-0.5 rounded-[10px] border border-border bg-popover/95 p-1 shadow-[var(--shadow-float)] backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onSelect(o.value)
                setOpen(false)
              }}
              className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[12px] hover:bg-secondary"
            >
              <Check
                className={cn('size-3 shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')}
              />
              {o.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  )
}

export function ViewportHud() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const { view, setView, tidyUp } = useBuilder()

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-[var(--radius-pill)] border border-border bg-popover/90 p-1 shadow-[var(--shadow-float)] backdrop-blur-2xl">
        <HudButton label="Zoom out" onClick={() => zoomOut({ duration: 180 })}>
          <Minus />
        </HudButton>

        <Tooltip content="Reset to 100%">
          <button
            type="button"
            onClick={() => setViewport({ x: 40, y: 40, zoom: 1 }, { duration: 220 })}
            className="tabular min-w-11 rounded-[8px] px-1 text-center text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>
        </Tooltip>

        <HudButton label="Zoom in" onClick={() => zoomIn({ duration: 180 })}>
          <Plus />
        </HudButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <HudButton
          label="Zoom to fit"
          onClick={() => fitView({ duration: 380, padding: 0.18 })}
        >
          <Maximize2 />
        </HudButton>

        <HudButton label="Tidy up by layer" onClick={tidyUp}>
          <Rows3 />
        </HudButton>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <HudPopover<GridMode>
          label="Grid"
          icon={view.grid === 'lines' ? <Grid2x2 /> : <Grid3x3 />}
          value={view.grid}
          options={[
            { value: 'dots', label: 'Dot grid' },
            { value: 'lines', label: 'Line grid' },
            { value: 'off', label: 'No grid' },
          ]}
          onSelect={(grid) => setView({ grid })}
        />

        <HudPopover<EdgeKind>
          label="Connection style"
          icon={<Spline />}
          value={view.edgeKind}
          options={[
            { value: 'smooth', label: 'Stepped' },
            { value: 'bezier', label: 'Curved' },
            { value: 'straight', label: 'Straight' },
          ]}
          onSelect={(edgeKind) => setView({ edgeKind })}
        />

        <HudButton
          label={view.snap ? 'Snapping on' : 'Snapping off'}
          active={view.snap}
          onClick={() => setView({ snap: !view.snap })}
        >
          <Magnet />
        </HudButton>

        <HudButton
          label={view.lanes ? 'Layer lanes shown' : 'Layer lanes hidden'}
          active={view.lanes}
          onClick={() => setView({ lanes: !view.lanes })}
        >
          <Waves />
        </HudButton>

        <HudButton
          label={view.animateEdges ? 'Flow animation on' : 'Flow animation off'}
          active={view.animateEdges}
          onClick={() => setView({ animateEdges: !view.animateEdges })}
        >
          <Zap />
        </HudButton>

        <HudButton
          label={view.minimap ? 'Minimap shown' : 'Minimap hidden'}
          active={view.minimap}
          onClick={() => setView({ minimap: !view.minimap })}
        >
          <MapIcon />
        </HudButton>
      </div>
    </div>
  )
}
