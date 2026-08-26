'use client'

import { memo, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Check, MessageSquare, Trash2 } from 'lucide-react'
import { NOTE_HUES, useBuilder, type NoteColor } from '@/lib/builder-store'
import { NOTE_COLORS } from '@/lib/builder-store'
import { cn } from '@/lib/utils'

interface NoteData {
  id: string
  kind: 'note' | 'comment'
  text: string
  color: NoteColor
  resolved?: boolean
  [key: string]: unknown
}

export const StickyNote = memo(function StickyNote({ data }: NodeProps) {
  const d = data as NoteData
  const { updateNote, removeNote } = useBuilder()
  const [editing, setEditing] = useState(d.text.length === 0)
  const [draft, setDraft] = useState(d.text)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  const hue = NOTE_HUES[d.color] ?? NOTE_HUES.amber
  const isComment = d.kind === 'comment'

  const commit = () => {
    setEditing(false)
    if (draft !== d.text) updateNote(d.id, { text: draft })
    if (draft.trim().length === 0) removeNote(d.id)
  }

  return (
    <div
      className={cn(
        'nodrag group/note relative flex w-56 flex-col rounded-[12px] border p-2.5 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.7)] transition-opacity',
        d.resolved && 'opacity-45',
      )}
      style={{
        background: `color-mix(in oklab, ${hue} 16%, var(--card))`,
        borderColor: `color-mix(in oklab, ${hue} 42%, transparent)`,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        {isComment ? (
          <MessageSquare className="size-3" style={{ color: hue }} />
        ) : (
          <span className="size-2 rounded-full" style={{ background: hue }} aria-hidden />
        )}
        <span className="text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: hue }}>
          {isComment ? 'Comment' : 'Note'}
        </span>

        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100">
          {isComment ? (
            <button
              type="button"
              aria-label={d.resolved ? 'Reopen comment' : 'Resolve comment'}
              onClick={() => updateNote(d.id, { resolved: !d.resolved })}
              className="rounded-[5px] p-0.5 text-muted-foreground hover:bg-black/15 hover:text-foreground"
            >
              <Check className="size-3" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => removeNote(d.id)}
            className="rounded-[5px] p-0.5 text-muted-foreground hover:bg-black/15 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </span>
      </div>

      {editing ? (
        <textarea
          ref={ref}
          rows={3}
          value={draft}
          placeholder={isComment ? 'Leave a comment…' : 'Jot something down…'}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commit()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
          }}
          className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-foreground outline-none placeholder:text-tertiary"
        />
      ) : (
        <p
          className={cn(
            'text-[12px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90',
            d.resolved && 'line-through',
          )}
        >
          {d.text}
        </p>
      )}

      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover/note:opacity-100">
        {NOTE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => updateNote(d.id, { color: c })}
            className={cn(
              'size-3 rounded-full ring-offset-1 transition-transform hover:scale-110',
              d.color === c && 'ring-1 ring-foreground/50',
            )}
            style={{ background: NOTE_HUES[c] }}
          />
        ))}
      </div>
    </div>
  )
})
