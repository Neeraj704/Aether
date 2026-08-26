'use client'

import { memo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { useBuilder } from '@/lib/builder-store'

interface FrameData {
  id: string
  w: number
  h: number
  label: string
  hue: string
  [key: string]: unknown
}

/**
 * A labelled section drawn behind the graph. The bottom-right corner is a
 * resize grip; the body is transparent so nodes stay clickable through it.
 */
export const FrameBox = memo(function FrameBox({ data }: NodeProps) {
  const d = data as FrameData
  const { updateFrame, removeFrame } = useBuilder()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.label)

  const startResize = (event: React.PointerEvent) => {
    event.stopPropagation()
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startW = d.w
    const startH = d.h

    const move = (e: PointerEvent) => {
      updateFrame(d.id, {
        w: Math.max(240, startW + (e.clientX - startX)),
        h: Math.max(160, startH + (e.clientY - startY)),
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className="group/frame relative rounded-[16px] border-2 border-dashed"
      style={{
        width: d.w,
        height: d.h,
        borderColor: `color-mix(in oklab, ${d.hue} 38%, transparent)`,
        background: `color-mix(in oklab, ${d.hue} 5%, transparent)`,
      }}
    >
      <div className="pointer-events-auto absolute -top-7 left-0 flex items-center gap-1.5">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false)
              updateFrame(d.id, { label: draft.trim() || 'Section' })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
            }}
            className="nodrag w-40 rounded-[6px] border border-border bg-background px-1.5 py-0.5 text-[11px] outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium tracking-[0.02em]"
            style={{ color: d.hue, background: `color-mix(in oklab, ${d.hue} 12%, transparent)` }}
          >
            {d.label}
          </button>
        )}
        <button
          type="button"
          aria-label="Delete section"
          onClick={() => removeFrame(d.id)}
          className="nodrag rounded-[5px] p-0.5 text-tertiary opacity-0 transition-opacity group-hover/frame:opacity-100 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <span
        onPointerDown={startResize}
        className="nodrag absolute -right-1 -bottom-1 size-3 cursor-nwse-resize rounded-[3px] border opacity-0 transition-opacity group-hover/frame:opacity-100"
        style={{ borderColor: d.hue, background: 'var(--background)' }}
        aria-hidden
      />
    </div>
  )
})
