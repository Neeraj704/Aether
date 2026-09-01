'use client'

import { useEffect, useRef } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ClipboardPaste,
  Copy,
  CopyPlus,
  EyeOff,
  Eye,
  Frame,
  Lock,
  MessageSquarePlus,
  Scissors,
  StickyNote as StickyNoteIcon,
  Trash2,
  Unlink,
  Wand2,
} from 'lucide-react'
import { COMPONENT_MAP } from '@/mock/layers'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { useBuilder } from '@/lib/builder-store'
import { cn } from '@/lib/utils'

interface Item {
  key: string
  label: string
  icon: typeof Copy
  onSelect: () => void
  hint?: string
  danger?: boolean
  disabled?: boolean
}

function MenuRow({ item, onDone }: { item: Item; onDone: () => void }) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => {
        item.onSelect()
        onDone()
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left text-[12.5px] transition-colors',
        item.danger
          ? 'text-destructive hover:bg-destructive/12'
          : 'text-foreground hover:bg-secondary',
        item.disabled && 'pointer-events-none opacity-40',
      )}
    >
      <item.icon className="size-3.5 shrink-0 opacity-70" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.hint ? (
        <span className="shrink-0 font-mono text-[10px] text-tertiary">{item.hint}</span>
      ) : null}
    </button>
  )
}

export function CanvasContextMenu({
  x,
  y,
  nodeId,
  onClose,
  onUnlock,
  toCanvas,
}: {
  x: number
  y: number
  nodeId?: string
  onClose: () => void
  onUnlock: (componentId: string) => void
  toCanvas: (x: number, y: number) => { x: number; y: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { plan, unlocked } = useSession()
  const {
    nodes,
    edges,
    selection,
    clipboard,
    removeNodes,
    duplicateSelection,
    copySelection,
    paste,
    setEnabled,
    disconnect,
    align,
    tidyUp,
    addNote,
    addFrame,
  } = useBuilder()

  useEffect(() => {
    const onAway = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onAway)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onAway)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const selected = nodes.filter((n) => selection.includes(n.id))
  const target = nodeId ? nodes.find((n) => n.id === nodeId) : null
  const comp = target ? COMPONENT_MAP[target.componentId] : null
  const locked = comp ? !hasComponent(comp.id, { plan, unlocked }) : false
  const allEnabled = selected.length > 0 && selected.every((n) => n.enabled)

  const groups: Item[][] = []

  if (target) {
    const attached = edges
      .filter((e) => selection.includes(e.source) || selection.includes(e.target))
      .map((e) => e.id)

    groups.push([
      ...(locked && comp
        ? [
            {
              key: 'unlock',
              label: `Unlock ${comp.name}`,
              icon: Lock,
              onSelect: () => onUnlock(comp.id),
            },
          ]
        : []),
      { key: 'copy', label: 'Copy', icon: Copy, hint: '⌘C', onSelect: copySelection },
      {
        key: 'dupe',
        label: 'Duplicate',
        icon: CopyPlus,
        hint: '⌘D',
        onSelect: duplicateSelection,
      },
      {
        key: 'toggle',
        label: allEnabled ? 'Disable' : 'Enable',
        icon: allEnabled ? EyeOff : Eye,
        onSelect: () => setEnabled(selection, !allEnabled),
      },
      {
        key: 'unwire',
        label: 'Detach connections',
        icon: Unlink,
        disabled: attached.length === 0,
        onSelect: () => disconnect(attached),
      },
    ])

    if (selected.length > 1) {
      groups.push([
        {
          key: 'align-v',
          label: 'Align vertical centres',
          icon: AlignCenterVertical,
          onSelect: () => align('center-h'),
        },
        {
          key: 'align-h',
          label: 'Align horizontal centres',
          icon: AlignCenterHorizontal,
          onSelect: () => align('middle'),
        },
      ])
    }

    groups.push([
      {
        key: 'delete',
        label: selected.length > 1 ? `Delete ${selected.length} nodes` : 'Delete',
        icon: Trash2,
        hint: '⌫',
        danger: true,
        onSelect: () => removeNodes(selection),
      },
    ])
  } else {
    groups.push([
      {
        key: 'paste',
        label: 'Paste here',
        icon: ClipboardPaste,
        hint: '⌘V',
        disabled: !clipboard || clipboard.nodes.length === 0,
        onSelect: () => paste(toCanvas(x, y)),
      },
      {
        key: 'note',
        label: 'Add sticky note',
        icon: StickyNoteIcon,
        onSelect: () => {
          const p = toCanvas(x, y)
          addNote('note', p.x, p.y)
        },
      },
      {
        key: 'comment',
        label: 'Add comment',
        icon: MessageSquarePlus,
        onSelect: () => {
          const p = toCanvas(x, y)
          addNote('comment', p.x, p.y)
        },
      },
      {
        key: 'frame',
        label: 'Add section frame',
        icon: Frame,
        onSelect: () => {
          const p = toCanvas(x, y)
          addFrame(p.x, p.y)
        },
      },
    ])

    groups.push([
      { key: 'tidy', label: 'Tidy up by layer', icon: Wand2, onSelect: tidyUp },
      {
        key: 'clear-wires',
        label: 'Delete all connections',
        icon: Scissors,
        danger: true,
        disabled: edges.length === 0,
        onSelect: () => disconnect(edges.map((e) => e.id)),
      },
    ])
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute z-50 w-56 rounded-[11px] border border-border bg-popover/95 p-1 shadow-[var(--shadow-float-lg)] backdrop-blur-2xl"
      style={{
        left: Math.min(x, (ref.current?.parentElement?.clientWidth ?? 9999) - 240),
        top: y,
      }}
    >
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 ? <div className="my-1 h-px bg-border" /> : null}
          {group.map((item) => (
            <MenuRow key={item.key} item={item} onDone={onClose} />
          ))}
        </div>
      ))}
    </div>
  )
}
