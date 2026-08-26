'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  History,
  Layers,
  LineChart,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react'
import type { Bot } from '@/mock/data'
import { COMPONENT_MAP, LAYERS } from '@/mock/layers'
import { useBuilder } from '@/lib/builder-store'
import { nodeLimitFor } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { CheckboxRow } from '@/components/ui/checkbox'
import { cn, formatDate, relativeTime } from '@/lib/utils'

export function BuilderToolbar({
  bot,
  onRename,
  onSave,
  onValidate,
}: {
  bot: Bot
  onRename: (name: string) => void
  onSave: () => void
  onValidate: () => void
}) {
  const {
    nodes,
    dirty,
    past,
    future,
    undo,
    redo,
    collapsedLayers,
    toggleLayer,
  } = useBuilder()
  const plan = useSession((s) => s.plan)
  const [name, setName] = useState(bot.name)
  const [editing, setEditing] = useState(false)

  const limit = nodeLimitFor(plan)
  const overLimit = nodes.length > limit

  const commitName = () => {
    setEditing(false)
    const next = name.trim()
    if (next && next !== bot.name) onRename(next)
    else setName(bot.name)
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Tooltip content="Back to bots">
        <Button render={<Link href="/app/bots" />} variant="ghost" size="icon-sm">
          <ArrowLeft />
          <span className="sr-only">Back to bots</span>
        </Button>
      </Tooltip>

      <div className="flex min-w-0 items-center gap-2">
        {editing ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setName(bot.name)
                setEditing(false)
              }
            }}
            aria-label="Bot name"
            className="h-7 w-56 text-[13px] font-medium"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="max-w-56 truncate rounded-[var(--radius-sm)] px-1.5 py-1 text-[13px] font-medium hover:bg-secondary"
          >
            {bot.name}
          </button>
        )}

        <span
          className={cn(
            'tabular hidden shrink-0 text-[11px] sm:inline',
            overLimit ? 'text-destructive' : 'text-tertiary',
          )}
        >
          {nodes.length}
          {Number.isFinite(limit) ? `/${limit}` : ''} nodes
        </span>

        {dirty ? (
          <Badge variant="warning" className="shrink-0">
            Unsaved
          </Badge>
        ) : (
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-tertiary md:flex">
            <Check className="size-3" />
            Saved {relativeTime(bot.updatedAt)}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Undo (⌘Z)">
          <Button variant="ghost" size="icon-sm" disabled={past.length === 0} onClick={undo}>
            <Undo2 />
            <span className="sr-only">Undo</span>
          </Button>
        </Tooltip>
        <Tooltip content="Redo (⇧⌘Z)">
          <Button variant="ghost" size="icon-sm" disabled={future.length === 0} onClick={redo}>
            <Redo2 />
            <span className="sr-only">Redo</span>
          </Button>
        </Tooltip>

        <Menu>
          <MenuTrigger
            render={
              <Button variant="ghost" size="sm">
                <Layers data-icon="inline-start" />
                Layers
                <ChevronDown data-icon="inline-end" className="size-3" />
              </Button>
            }
          />
          <MenuContent className="w-60">
            <MenuLabel>Show layers</MenuLabel>
            <div className="px-1 py-0.5">
              {LAYERS.map((layer) => {
                const count = nodes.filter(
                  (n) => COMPONENT_MAP[n.componentId]?.layer === layer.id,
                ).length
                return (
                  <CheckboxRow
                    key={layer.id}
                    label={`${layer.roman} · ${layer.name}${count ? `  (${count})` : ''}`}
                    checked={!collapsedLayers.includes(layer.id)}
                    onCheckedChange={() => toggleLayer(layer.id)}
                  />
                )
              })}
            </div>
          </MenuContent>
        </Menu>

        <Menu>
          <MenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <History />
                <span className="sr-only">Version history</span>
              </Button>
            }
          />
          <MenuContent className="w-64">
            <MenuLabel>Version history</MenuLabel>
            {bot.versions.map((v) => (
              <MenuItem key={v.id} render={<Link href={`/app/builder/${bot.id}/version/${v.id}`} />}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium">
                    {v.label} · {v.nodeCount} nodes
                  </span>
                  <span className="truncate text-[11px] text-tertiary">
                    {formatDate(v.createdAt, { withTime: true })} — {v.note}
                  </span>
                </span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem render={<Link href={`/app/bots/${bot.id}`} />}>Bot overview</MenuItem>
          </MenuContent>
        </Menu>

        <Button variant="outline" size="sm" onClick={onValidate}>
          <BadgeCheck data-icon="inline-start" />
          Validate
        </Button>

        <Button variant="outline" size="sm" disabled={!dirty} onClick={onSave}>
          <Save data-icon="inline-start" />
          Save
        </Button>

        <Button render={<Link href={`/app/backtest/new?bot=${bot.id}`} />} size="sm">
          <LineChart data-icon="inline-start" />
          Backtest
        </Button>
      </div>
    </header>
  )
}
